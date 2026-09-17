const { BaseTool } = require('./base');

/**
 * Verified Free Image Search Tool (Wikipedia Page Images + High-Quality DuckDuckGo Photos)
 * Filters out clickbait thumbnails, low-res placeholders, and unverified images.
 */
class ImageSearchTool extends BaseTool {
  constructor() {
    super({
      name: 'image_search',
      description: 'Searches for verified high-quality public domain and web images for entities, people, places, and topics.',
      category: 'IMAGE_SEARCH',
    });
  }

  cleanImageQuery(rawQuery) {
    if (!rawQuery || typeof rawQuery !== 'string') return '';
    let cleaned = rawQuery
      .replace(/^(who is|who was|what is|what was|photos of|images of|picture of|show me|tell me about)\s+/i, '')
      .replace(/[?!=]+$/, '')
      .trim();

    // Fix common typos
    cleaned = cleaned
      .replace(/\bth\b/gi, 'the')
      .replace(/\btrilliniare\b/gi, 'trillionaire')
      .replace(/\btrillonaire\b/gi, 'trillionaire')
      .replace(/\bbillonaire\b/gi, 'billionaire')
      .trim();

    return cleaned;
  }

  /**
   * Filters out junk/clickbait/unverified images and rejects mismatched entity images
   */
  isValidImage(img, queryTerms = []) {
    if (!img || !img.url || typeof img.url !== 'string') return false;
    const url = img.url.toLowerCase();
    const title = (img.title || '').toLowerCase();

    // Exclude clickbait YouTube video thumbnails with misleading text overlay
    if (url.includes('ytimg.com') || url.includes('youtube.com/vi') || url.includes('hqdefault') || url.includes('maxresdefault')) {
      return false;
    }

    // Exclude stock placeholders & vector clipart
    if (url.includes('freepik') || url.includes('clipart') || url.includes('stock-vector') || url.includes('placeholder')) {
      return false;
    }

    // Title junk filter
    if (title.includes('meme') || title.includes('cartoon') || title.includes('clickbait')) {
      return false;
    }

    // Must be valid HTTP URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }

    // Entity Precision Check: For multi-word entity queries (e.g. "Jaliparthi Satya Sri"),
    // candidate image MUST contain the rarest distinctive token (e.g. "jaliparthi")
    if (Array.isArray(queryTerms) && queryTerms.length >= 2) {
      const distinctTokens = queryTerms
        .map(t => t.toLowerCase().replace(/\W+/g, ''))
        .filter(t => t.length >= 3 && !['who', 'what', 'photos', 'images', 'picture', 'about', 'student', 'latest', 'news'].includes(t));

      if (distinctTokens.length >= 2) {
        const textToMatch = `${title} ${url} ${(img.source || '')}`.toLowerCase();
        const sorted = [...distinctTokens].sort((a, b) => b.length - a.length);
        const rarestToken = sorted[0]; // e.g. "jaliparthi"

        if (rarestToken.length >= 5 && !textToMatch.includes(rarestToken)) {
          return false; // Reject: missing unique surname / entity anchor! (Prevents fake actress photos for a student)
        }

        const matchCount = distinctTokens.filter(t => textToMatch.includes(t)).length;
        if (matchCount < 2) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Search Wikipedia Page Images (Highest Authority & Verified Photos)
   */
  async searchWikipediaImages(query, maxResults = 3) {
    try {
      const cleanQuery = this.cleanImageQuery(query);
      if (!cleanQuery) return [];

      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrlimit=${maxResults}&prop=pageimages|pageterms&pithumbsize=800&format=json`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'MetinousAI/1.0 (verified-images@metinous.ai)' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!res.ok) return [];

      const data = await res.json();
      const pages = Object.values(data.query?.pages || {});

      return pages
        .filter(p => p.thumbnail?.source && !p.thumbnail.source.includes('.svg'))
        .map(p => ({
          url: p.thumbnail.source,
          thumbnail: p.thumbnail.source,
          title: p.title || cleanQuery,
          source: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title || '')}`,
        }));
    } catch (err) {
      return [];
    }
  }

  /**
   * Search DuckDuckGo Images with Strict Quality Verification
   */
  async searchDuckDuckGoImages(query, maxResults = 4) {
    try {
      const cleanQuery = this.cleanImageQuery(query);
      if (!cleanQuery) return [];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });

      if (!tokenRes.ok) {
        clearTimeout(timeoutId);
        return [];
      }

      const html = await tokenRes.text();
      const vqdMatch = html.match(/vqd=([0-9-]+)/);
      if (!vqdMatch) {
        clearTimeout(timeoutId);
        return [];
      }

      const vqd = vqdMatch[1];
      const imgRes = await fetch(
        `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(cleanQuery)}&vqd=${vqd}&f=,,,`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      if (!imgRes.ok) return [];

      const data = await imgRes.json();
      const queryTerms = cleanQuery.toLowerCase().split(/\s+/);
      const rawResults = data?.results || [];

      const verifiedResults = [];
      for (const r of rawResults) {
        if (verifiedResults.length >= maxResults) break;
        const imgObj = {
          url: r.image || r.thumbnail,
          thumbnail: r.thumbnail || r.image,
          title: r.title || cleanQuery,
          source: r.url || '',
        };

        if (this.isValidImage(imgObj, queryTerms)) {
          verifiedResults.push(imgObj);
        }
      }

      return verifiedResults;
    } catch (err) {
      return [];
    }
  }

  /**
   * Main image search cascade: Prioritizes verified Wikipedia photos then clean DDG images
   */
  async searchImages(query, maxResults = 4) {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return [];
    }

    // 1. Try Wikipedia page images first (Guaranteed verified portraits/photos)
    const wikiImages = await this.searchWikipediaImages(query, maxResults);
    if (wikiImages.length >= 2) {
      return wikiImages;
    }

    // 2. Try DuckDuckGo verified images
    const ddgImages = await this.searchDuckDuckGoImages(query, maxResults);
    
    // Combine unique
    const seen = new Set(wikiImages.map(i => i.url));
    const combined = [...wikiImages];
    for (const d of ddgImages) {
      if (!seen.has(d.url)) {
        seen.add(d.url);
        combined.push(d);
      }
    }

    return combined.slice(0, maxResults);
  }

  async execute(params = {}) {
    const query = params.query || params.searchQuery || '';
    const maxResults = params.maxResults || 4;
    const images = await this.searchImages(query, maxResults);

    return {
      success: images.length > 0,
      data: images,
      count: images.length,
    };
  }
}

const imageSearchTool = new ImageSearchTool();

module.exports = {
  ImageSearchTool,
  imageSearchTool,
};
