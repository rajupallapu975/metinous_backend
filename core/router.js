const { RouteCategories } = require('../models/schemas');
const { inputAnalyzer } = require('./analyzer');

/**
 * Metinous AI — Cognitive Router
 * Performs deterministic & heuristic classification into routing domains.
 */
class CognitiveRouter {
  constructor() {
    this.categories = RouteCategories;
  }

  /**
   * Resolves follow-up search queries from conversation history (e.g. "search in linkedin" -> "Pallapu Satya Ananda Raju linkedin")
   */
  _resolveFollowupQuery(promptText = '', history = []) {
    const raw = (promptText || '').trim();
    const lower = raw.toLowerCase();

    const isFollowupSearch =
      /^(search|find|lookup|look up|check|browse)\s+(in|on|at|for|about)?\s*(linkedin|linkdin|google|github|twitter|instagram|facebook|youtube|web|internet)?/i.test(lower) ||
      lower === 'search in linkdin' ||
      lower === 'search in linkedin' ||
      lower === 'search on linkedin' ||
      lower === 'search linkedin' ||
      lower === 'search linkdin' ||
      lower === 'search github' ||
      lower === 'search twitter' ||
      lower === 'search google' ||
      lower === 'linkdin' ||
      lower === 'linkedin';

    if (isFollowupSearch && Array.isArray(history) && history.length > 0) {
      const lastUserMsg = [...history].reverse().find(
        h => (h.role === 'user' || h.sender === 'user') && h.content && h.content.trim().length > 0
      );

      if (lastUserMsg) {
        const cleanEntity = lastUserMsg.content
          .replace(/^(who is|who was|what is|tell me about|details of|search for|about)\s+/i, '')
          .replace(/[?.,!]+$/, '')
          .trim();

        let platform = '';
        if (lower.includes('linkedin') || lower.includes('linkdin')) platform = 'linkedin';
        else if (lower.includes('github')) platform = 'github';
        else if (lower.includes('twitter') || lower.includes('x.com')) platform = 'twitter';
        else if (lower.includes('instagram')) platform = 'instagram';
        else if (lower.includes('youtube')) platform = 'youtube';

        return `${cleanEntity} ${platform}`.trim();
      }
    }

    return promptText;
  }

  /**
   * Routes a user prompt to the target category
   * @param {string} promptText
   * @param {Object} context
   * @returns {{category: string, confidence: number, reason: string, toolNeeded: string|null, metadata: Object}}
   */
  route(promptText = '', context = {}) {
    const analysis = inputAnalyzer.analyze(promptText);
    const history = context.history || [];

    // 1. Web Fetch Check (Explicit URL with action)
    if (analysis.hasUrl && analysis.isWebFetchIntent) {
      return {
        category: this.categories.WEB_FETCH,
        confidence: 0.98,
        reason: `Detected target URL '${analysis.extractedUrl}' with fetch/summarize intent.`,
        toolNeeded: 'web_fetch',
        metadata: { url: analysis.extractedUrl },
      };
    }

    // 2. Local Time Check
    if (analysis.isTimeQuery) {
      return {
        category: this.categories.TIME,
        confidence: 0.99,
        reason: 'Detected real-time / current date query.',
        toolNeeded: 'time',
        metadata: { timezone: 'Asia/Kolkata' },
      };
    }

    // 3. Calculator Check
    if (analysis.isMathPattern) {
      return {
        category: this.categories.CALCULATOR,
        confidence: 0.98,
        reason: 'Detected pure mathematical arithmetic expression.',
        toolNeeded: 'calculator',
        metadata: { expression: analysis.cleanedMathExpression },
      };
    }

    // 4. Memory Check
    if (analysis.isMemoryQuery) {
      return {
        category: this.categories.MEMORY,
        confidence: 0.92,
        reason: 'Detected conversational recall / user memory request.',
        toolNeeded: 'memory',
        metadata: { query: promptText },
      };
    }

    // 5. Educational / General Knowledge filter (Must remain CHAT without web search)
    if (analysis.isEducational) {
      return {
        category: this.categories.CHAT,
        confidence: 0.95,
        reason: 'Detected general educational / programming concept question. No external search needed.',
        toolNeeded: null,
        metadata: {},
      };
    }

    // 6. Web Search Check (Entities, current facts, search instructions, platform lookups)
    if (analysis.isSearchIntent || analysis.hasCurrentKeyword) {
      const resolvedSearchQuery = this._resolveFollowupQuery(promptText, history);
      return {
        category: this.categories.WEB,
        confidence: 0.92,
        reason: `Detected search intent / external fact lookup (Resolved query: "${resolvedSearchQuery}").`,
        toolNeeded: 'web_search',
        metadata: { query: resolvedSearchQuery },
      };
    }

    // 7. General Default -> CHAT
    return {
      category: this.categories.CHAT,
      confidence: 0.85,
      reason: 'Standard conversational / generative request.',
      toolNeeded: null,
      metadata: {},
    };
  }
}

const cognitiveRouter = new CognitiveRouter();

module.exports = {
  CognitiveRouter,
  cognitiveRouter,
};
