const { BaseTool } = require('./base');

/**
 * Base Web Search Provider Abstraction
 */
class WebSearchProvider {
  constructor(name = 'base_search_provider') {
    this.name = name;
  }

  /**
   * Performs search
   * @param {string} query
   * @param {number} maxResults
   * @returns {Promise<Array<{title: string, url: string, content: string}>>}
   */
  async search(query, maxResults = 5) {
    throw new Error(`search() not implemented for ${this.name}`);
  }
}

/**
 * Free Self-Hosted SearXNG Search Provider
 */
class SearXNGProvider extends WebSearchProvider {
  constructor(baseUrl = null) {
    super('searxng');
    this._baseUrl = baseUrl;
  }

  get baseUrl() {
    return this._baseUrl || process.env.SEARXNG_URL || 'http://localhost:8080';
  }

  async search(query, maxResults = 5) {
    const cleanUrl = this.baseUrl.replace(/\/+$/, '');
    const searchUrl = `${cleanUrl}/search?q=${encodeURIComponent(query)}&format=json&language=en`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(searchUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MetinousAI-SearchEngine/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`SearXNG returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawResults = data?.results || [];

      return rawResults.slice(0, maxResults).map(r => ({
        title: r.title || 'Untitled',
        url: r.url || '',
        content: r.content || r.snippet || '',
      }));
    } catch (err) {
      clearTimeout(timeoutId);
      throw new Error(`SearXNG (${this.baseUrl}) error: ${err.message}`);
    }
  }
}

/**
 * High-Reliability DuckDuckGo HTML Search Provider
 */
class DuckDuckGoHtmlProvider extends WebSearchProvider {
  constructor() {
    super('duckduckgo_html');
  }

  async search(query, maxResults = 5) {
    const searchUrl = 'https://html.duckduckgo.com/html/';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(searchUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        body: `q=${encodeURIComponent(query)}&b=`,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`DuckDuckGo HTML returned HTTP ${response.status}`);
      }

      const html = await response.text();
      const results = [];

      // Split on web-result container blocks
      const blocks = html.split(/class=['"][^'"]*web-result[^'"]*['"]/i);
      for (let i = 1; i < blocks.length; i++) {
        if (results.length >= maxResults) break;
        const block = blocks[i];
        const titleMatch = /<a[^>]+class=['"][^'"]*result__a[^'"]*['"][^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/i.exec(block);
        const snippetMatch = /<a[^>]+class=['"][^'"]*result__snippet[^'"]*['"][^>]*>([\s\S]*?)<\/a>/i.exec(block);

        if (titleMatch) {
          let rawUrl = titleMatch[1];
          if (rawUrl.includes('uddg=')) {
            try {
              const u = new URL(rawUrl, 'https://duckduckgo.com').searchParams.get('uddg');
              if (u) rawUrl = decodeURIComponent(u);
            } catch (_) {}
          }

          const title = titleMatch[2].replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
          const content = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim() : '';

          if (rawUrl.startsWith('http')) {
            results.push({
              title: title || 'Web Result',
              url: rawUrl,
              content: content || title,
            });
          }
        }
      }

      return results;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}

/**
 * Free DuckDuckGo Lite Search Provider
 */
class DuckDuckGoLiteProvider extends WebSearchProvider {
  constructor() {
    super('duckduckgo_lite');
  }

  async search(query, maxResults = 5) {
    const searchUrl = 'https://lite.duckduckgo.com/lite/';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(searchUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html',
        },
        body: `q=${encodeURIComponent(query)}`,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`DuckDuckGo Lite returned HTTP ${response.status}`);
      }

      const html = await response.text();
      const results = [];

      const linkPattern = /class=['"]result-link['"][^>]*href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/gi;
      const snippetPattern = /class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/gi;

      const links = [];
      let m;
      while ((m = linkPattern.exec(html)) !== null) {
        let rawUrl = m[1];
        if (rawUrl.includes('uddg=')) {
          try {
            const u = new URL(rawUrl, 'https://duckduckgo.com').searchParams.get('uddg');
            if (u) rawUrl = decodeURIComponent(u);
          } catch (_) {}
        }
        links.push({ url: rawUrl, title: m[2].trim() });
      }

      const snippets = [];
      while ((m = snippetPattern.exec(html)) !== null) {
        snippets.push(m[1].replace(/<[^>]+>/g, '').trim());
      }

      const count = Math.min(links.length, maxResults);
      for (let i = 0; i < count; i++) {
        if (links[i].url && links[i].url.startsWith('http')) {
          results.push({
            title: links[i].title,
            url: links[i].url,
            content: snippets[i] || '',
          });
        }
      }

      return results;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}

/**
 * Free Wikipedia Full-Text Search API Provider (MediaWiki)
 */
class WikipediaSearchApiProvider extends WebSearchProvider {
  constructor() {
    super('wikipedia_search');
  }

  async search(query, maxResults = 4) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=${maxResults}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(searchUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'MetinousAI/1.0 (contact@metinous.ai)',
        },
      });

      clearTimeout(timeoutId);
      if (!response.ok) return [];

      const data = await response.json();
      const searchItems = data?.query?.search || [];

      return searchItems.map(item => ({
        title: item.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`,
        content: item.snippet
          ? item.snippet.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
          : `Wikipedia knowledge page for ${item.title}`,
      }));
    } catch (err) {
      clearTimeout(timeoutId);
      return [];
    }
  }
}

/**
 * Free DuckDuckGo Instant Answer API Provider
 */
class DuckDuckGoApiProvider extends WebSearchProvider {
  constructor() {
    super('duckduckgo_api');
  }

  async search(query, maxResults = 5) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=0`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'MetinousAI/1.0',
        },
      });

      clearTimeout(timeoutId);
      if (!response.ok) return [];

      const data = await response.json();
      const results = [];

      if (data.AbstractText && data.AbstractURL) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL,
          content: data.AbstractText,
        });
      }

      const topics = data.RelatedTopics || [];
      for (const topic of topics) {
        if (results.length >= maxResults) break;
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || query,
            url: topic.FirstURL,
            content: topic.Text,
          });
        }
      }

      return results;
    } catch (err) {
      clearTimeout(timeoutId);
      return [];
    }
  }
}

class WebSearchTool extends BaseTool {
  constructor() {
    super({
      name: 'web_search',
      description: 'Executes live web search using free providers (DuckDuckGo HTML / SearXNG / DuckDuckGo Lite / Wikipedia MediaWiki / DDG API). Returns structured results with title, URL, and snippet.',
      category: 'WEB',
    });

    this.ddgHtmlProvider = new DuckDuckGoHtmlProvider();
    this.searxngProvider = new SearXNGProvider();
    this.ddgLiteProvider = new DuckDuckGoLiteProvider();
    this.wikiSearchProvider = new WikipediaSearchApiProvider();
    this.ddgApiProvider = new DuckDuckGoApiProvider();
  }

  /**
   * Normalizes conversational questions and cleans common typos for better search hit rate
   */
  cleanSearchQuery(rawQuery) {
    if (!rawQuery || typeof rawQuery !== 'string') return '';
    let cleaned = rawQuery
      .replace(/^(who is|who was|what is|what was|what are|tell me about|how much is|can you find|search for|lookup|give me information on)s+/i, '')
      .replace(/[?!=]+$/, '')
      .trim();

    // Fix common typos in queries
    cleaned = cleaned
      .replace(/\bth\b/gi, 'the')
      .replace(/\btrilliniare\b/gi, 'trillionaire')
      .replace(/\btrillonaire\b/gi, 'trillionaire')
      .replace(/\bbillonaire\b/gi, 'billionaire')
      .replace(/\bceos\b/gi, 'CEO')
      .trim();

    return cleaned;
  }

  async executeProviderSearch(provider, query, maxResults) {
    try {
      const results = await provider.search(query, maxResults);
      if (Array.isArray(results) && results.length > 0) {
        return results;
      }
    } catch (err) {
      // Provider failed, fall to next
    }
    return null;
  }

  async search(query, maxResults = 5) {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return { success: false, provider: 'none', query: '', results: [] };
    }

    const rawClean = query.trim();
    const keywordQuery = this.cleanSearchQuery(rawClean) || rawClean;
    const queriesToTry = [keywordQuery, rawClean].filter((v, i, a) => a.indexOf(v) === i);

    for (const q of queriesToTry) {
      // 1. DuckDuckGo HTML (Top reliability and coverage)
      const ddgHtmlRes = await this.executeProviderSearch(this.ddgHtmlProvider, q, maxResults);
      if (ddgHtmlRes) {
        return { success: true, provider: 'duckduckgo_html', query: q, results: ddgHtmlRes };
      }

      // 2. Wikipedia MediaWiki Full-Text Search
      const wikiRes = await this.executeProviderSearch(this.wikiSearchProvider, q, maxResults);
      if (wikiRes) {
        return { success: true, provider: 'wikipedia_search', query: q, results: wikiRes };
      }

      // 3. DuckDuckGo Lite
      const ddgLiteRes = await this.executeProviderSearch(this.ddgLiteProvider, q, maxResults);
      if (ddgLiteRes) {
        return { success: true, provider: 'duckduckgo_lite', query: q, results: ddgLiteRes };
      }

      // 4. DuckDuckGo API
      const ddgApiRes = await this.executeProviderSearch(this.ddgApiProvider, q, maxResults);
      if (ddgApiRes) {
        return { success: true, provider: 'duckduckgo_api', query: q, results: ddgApiRes };
      }

      // 5. SearXNG
      const searxngRes = await this.executeProviderSearch(this.searxngProvider, q, maxResults);
      if (searxngRes) {
        return { success: true, provider: 'searxng', query: q, results: searxngRes };
      }
    }

    return {
      success: false,
      provider: 'none',
      query: keywordQuery,
      results: [],
      error: 'Could not retrieve live web search results from any free search provider.',
    };
  }

  async execute(params = {}) {
    const query = params.query || params.searchQuery || '';
    const maxResults = params.maxResults || 5;
    const searchData = await this.search(query, maxResults);

    return {
      success: searchData.success,
      data: searchData,
      sources: (searchData.results || []).map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
      })),
    };
  }
}

module.exports = {
  WebSearchProvider,
  DuckDuckGoHtmlProvider,
  DuckDuckGoLiteProvider,
  WikipediaSearchApiProvider,
  DuckDuckGoApiProvider,
  SearXNGProvider,
  WebSearchTool,
  webSearchTool: new WebSearchTool(),
};
