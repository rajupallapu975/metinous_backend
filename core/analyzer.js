/**
 * Metinous AI — Input Analyzer
 * Inspects prompt structure, entities, URLs, math tokens, and temporal indicators.
 */

class InputAnalyzer {
  /**
   * Analyzes prompt text and returns extracted features
   */
  analyze(promptText = '') {
    const raw = (promptText || '').trim();
    const lower = raw.toLowerCase();

    // 1. URL Detection
    const urlMatches = raw.match(/https?:\/\/[^\s$.?#].[^\s]*/gi) || [];
    const hasUrl = urlMatches.length > 0;
    const extractedUrl = hasUrl ? urlMatches[0].replace(/[),.;]+$/, '') : null;

    // 2. Math Expression Detection
    // Strict arithmetic pattern: numbers, operators (+, -, *, /, %, **, ^, x), parentheses, spaces, optional "what is" or "calculate"
    const cleanedMath = raw
      .replace(/^(what is|calculate|compute|solve|eval|evaluate|how much is)\s+/i, '')
      .replace(/[?!=]+$/, '')
      .trim();

    const isMathPattern =
      /^[-\d\s\.\(\)\+\*\/\%\^\*\*x]+$/.test(cleanedMath) &&
      /[\+\-\*\/\%\^\*\*x]/.test(cleanedMath) &&
      /\d/.test(cleanedMath);

    // 3. Time / Date Query Detection
    const isTimeQuery =
      /^(what\s+is\s+the\s+time|what\s+time\s+is\s+it|current\s+time|time\s+now|tell\s+me\s+the\s+time|time\s+in\s+india|what\s+is\s+today'?s?\s+date|what\s+date\s+is\s+it\s+today|today'?s?\s+date|current\s+date)\b/i.test(lower) ||
      (lower.includes('time') && (lower.includes('now') || lower.includes('current') || lower.includes('what is'))) ||
      (lower.includes('date') && (lower.includes('today') || lower.includes('current') || lower.includes('what is')));

    // 4. Memory Query Detection (Cross-Chat Recall & Profile Inquiries)
    const isMemoryQuery =
      /^(what did i tell you|do you remember|what do you know about me|what is my name|what'?s my name|whats my name|tell me my name|who am i|where do i live|where do i study|what is my job|my details|my profile|recall|from our previous chat|what did i say|remember me|do you know me|do you know my name|my name\?)\b/i.test(lower) ||
      lower.includes('what is my name') ||
      lower.includes("what's my name") ||
      lower.includes('whats my name') ||
      lower.includes('tell me my name') ||
      lower.includes('who am i') ||
      lower.includes('do you know my name') ||
      lower.includes('do you know me') ||
      lower.includes('what do you know about me') ||
      lower.includes('where do i study') ||
      lower.includes('which college') ||
      lower.includes('where do i live') ||
      lower.includes('where do i work') ||
      (lower.includes('my name') && (lower.includes('tell') || lower.includes('what') || lower.includes('know') || lower.includes('remember') || lower.includes('say'))) ||
      (lower.includes('what did i') && (lower.includes('tell') || lower.includes('say'))) ||
      (lower.includes('do you remember') && (lower.includes('metinous') || lower.includes('me') || lower.includes('said') || lower.includes('name')));

    // 5. Explicit Web / Current Information Intent Detection
    const currentKeywords = [
      'latest', 'current', 'news', 'price', 'net worth', 'today', 'this week',
      'recent', 'who is', 'who was', 'who won', 'match score', 'stock price', 'weather',
      'released', 'release date', 'ceo of', 'president of', 'founder of',
      'search', 'find', 'lookup', 'look up', 'google', 'linkedin', 'linkdin',
      'github', 'twitter', 'instagram', 'facebook', 'youtube', 'details of',
      'information about', 'search in', 'search on', 'check on', 'browse', 'find on',
    ];

    const hasCurrentKeyword = currentKeywords.some(kw => lower.includes(kw));

    const isSearchIntent =
      /^(search|find|lookup|look up|google|check|browse|who is|who was|tell me about)\b/i.test(lower) ||
      lower.includes('search in') ||
      lower.includes('search on') ||
      lower.includes('search linkedin') ||
      lower.includes('search linkdin') ||
      lower.includes('linkedin') ||
      lower.includes('linkdin') ||
      lower.includes('github') ||
      hasCurrentKeyword;

    // Exclude general educational queries (e.g. "What is Python?", "Explain recursion")
    const isEducational =
      /^(what is|explain|how does|what are|define|describe|tutorial on)\s+(python|recursion|machine learning|neural network|javascript|html|css|docker|git|oop|polymorphism|data structure|binary search|bubble sort|quick sort|react|node|flutter)\b/i.test(lower);

    // 6. Web Fetch intent (e.g. "summarize https://...", "read https://...", "check this link")
    const isWebFetchIntent = hasUrl && (
      lower.includes('summarize') ||
      lower.includes('read') ||
      lower.includes('fetch') ||
      lower.includes('analyze') ||
      lower.includes('what does this page') ||
      raw.split(/\s+/).length <= 4
    );

    return {
      rawPrompt: raw,
      lowerPrompt: lower,
      hasUrl,
      extractedUrl,
      isMathPattern,
      cleanedMathExpression: cleanedMath,
      isTimeQuery,
      isMemoryQuery,
      hasCurrentKeyword,
      isSearchIntent,
      isEducational,
      isWebFetchIntent,
      wordCount: raw.split(/\s+/).filter(Boolean).length,
    };
  }
}

module.exports = {
  InputAnalyzer,
  inputAnalyzer: new InputAnalyzer(),
};
