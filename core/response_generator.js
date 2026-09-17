const { ChatResponse } = require('../models/schemas');

/**
 * Metinous AI — Response Generator
 * Assembles and verifies final response structure with images and sources.
 */
class ResponseGenerator {
  /**
   * Generates a standard ChatResponse object
   */
  generate({
    answer = '',
    route = 'CHAT',
    tool_used = false,
    tools = [],
    sources = [],
    images = [],
    domain = 'UTILITY',
    domainBadge = '⚡ Utility',
    modelUsed = 'openai/gpt-4o-mini',
    metadata = {},
  }) {
    // Clean and normalize sources (deduplicate by URL)
    const seenUrls = new Set();
    const cleanSources = [];

    for (const src of sources) {
      if (src.url && !seenUrls.has(src.url)) {
        seenUrls.add(src.url);
        cleanSources.push({
          title: src.title || src.url,
          url: src.url,
        });
      }
    }

    // Clean and normalize images (deduplicate by URL)
    const seenImgUrls = new Set();
    const cleanImages = [];

    for (const img of images) {
      const imgUrl = img.url || img.image || (typeof img === 'string' ? img : '');
      if (imgUrl && !seenImgUrls.has(imgUrl) && (imgUrl.startsWith('http://') || imgUrl.startsWith('https://'))) {
        seenImgUrls.add(imgUrl);
        cleanImages.push({
          url: imgUrl,
          thumbnail: img.thumbnail || imgUrl,
          title: img.title || 'Image',
          source: img.source || '',
        });
      }
    }

    return new ChatResponse({
      answer,
      reply: answer,
      route,
      tool_used: Boolean(tool_used),
      tools: Array.isArray(tools) ? tools : [],
      sources: cleanSources,
      images: cleanImages,
      domain,
      domainBadge,
      modelUsed,
      metadata,
    });
  }
}

const responseGenerator = new ResponseGenerator();

module.exports = {
  ResponseGenerator,
  responseGenerator,
};
