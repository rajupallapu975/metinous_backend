/**
 * Metinous AI — Evidence Builder
 * Assembles and formats retrieved search results, web pages, and memories into clean LLM context.
 */

class EvidenceBuilder {
  /**
   * Formats search results and fetched documents into bounded LLM context
   * @param {Object} params
   * @param {Array} [params.searchResults=[]]
   * @param {Array} [params.fetchedPages=[]]
   * @param {Array} [params.memoryItems=[]]
   * @param {number} [params.maxChars=10000]
   */
  buildEvidenceContext({ query = '', searchResults = [], fetchedPages = [], memoryItems = [], maxChars = 10000 }) {
    const sections = [];
    const sourceItems = [];
    let currentLength = 0;

    // Prune noisy/unrelated snippets if query has a distinctive identifier token
    let filteredSearchResults = searchResults;
    if (query && searchResults.length > 0) {
      const stopWords = ['who', 'what', 'when', 'where', 'photos', 'images', 'about', 'search', 'linkedin', 'linkdin', 'google', 'github', 'twitter', 'facebook', 'instagram', 'profile', 'profiles', 'find', 'lookup'];
      const queryTokens = query.toLowerCase().split(/\W+/).filter(t => t.length >= 4 && !stopWords.includes(t));
      if (queryTokens.length >= 2) {
        const sorted = [...queryTokens].sort((a, b) => b.length - a.length);
        const rarestToken = sorted[0]; // e.g. "jaliparthi"
        if (rarestToken.length >= 5) {
          const matching = searchResults.filter(r => `${r.title} ${r.content} ${r.url}`.toLowerCase().includes(rarestToken));
          if (matching.length > 0) {
            filteredSearchResults = matching;
          }
        }
      }
    }

    // 1. Process Web Search Results
    if (filteredSearchResults && filteredSearchResults.length > 0) {
      const searchLines = ['=== RETRIEVED REAL-TIME WEB EVIDENCE ==='];

      filteredSearchResults.forEach((res, index) => {
        if (!res.url || !res.title) return;
        sourceItems.push({
          title: res.title,
          url: res.url,
          content: res.content || '',
        });

        const entry = `[SOURCE ${index + 1}]\nTitle: ${res.title}\nURL: ${res.url}\nSnippet: ${res.content || 'N/A'}\n`;
        searchLines.push(entry);
      });

      searchLines.push('========================================');
      const searchBlock = searchLines.join('\n');
      sections.push(searchBlock);
      currentLength += searchBlock.length;
    }

    // 2. Process Fetched Web Pages
    if (fetchedPages && fetchedPages.length > 0) {
      const fetchLines = ['=== FETCHED WEB PAGE DOCUMENTS ==='];

      fetchedPages.forEach((page, index) => {
        if (!page.url) return;
        sourceItems.push({
          title: page.title || 'Web Document',
          url: page.url,
          content: page.content || '',
        });

        const entry = `[DOCUMENT ${index + 1}]\nTitle: ${page.title || 'N/A'}\nURL: ${page.url}\nContent:\n${page.content || 'No content'}\n`;
        fetchLines.push(entry);
      });

      fetchLines.push('==================================');
      const fetchBlock = fetchLines.join('\n');
      sections.push(fetchBlock);
      currentLength += fetchBlock.length;
    }

    // 3. Process Memory Items
    if (memoryItems && memoryItems.length > 0) {
      const memLines = ['=== RELEVANT CONVERSATIONAL MEMORY & USER PROFILE ==='];

      const profileItems = memoryItems.filter(m => m.type === 'PROFILE');
      const nonProfileItems = memoryItems.filter(m => m.type !== 'PROFILE');

      if (profileItems.length > 0) {
        profileItems.forEach(mem => {
          memLines.push(`[CURRENT VERIFIED USER PROFILE RECORD (PRIMARY SOURCE OF TRUTH)]: ${mem.content}`);
        });
      }

      nonProfileItems.forEach((mem, index) => {
        memLines.push(`[HISTORICAL TRANSCRIPT ${index + 1} (${mem.type || 'NOTE'})]: ${mem.content || mem.key}`);
      });

      memLines.push('=====================================================');
      const memBlock = memLines.join('\n');
      sections.push(memBlock);
      currentLength += memBlock.length;
    }

    let combined = sections.join('\n\n');
    if (combined.length > maxChars) {
      combined = combined.substring(0, maxChars) + '\n\n[Note: Retrieved evidence was truncated to fit context limits.]';
    }

    return {
      evidenceContext: combined,
      sources: sourceItems,
      hasEvidence: sections.length > 0,
    };
  }
}

const evidenceBuilder = new EvidenceBuilder();

module.exports = {
  EvidenceBuilder,
  evidenceBuilder,
};
