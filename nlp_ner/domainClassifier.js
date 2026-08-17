const classifyDomain = (text = '', entities = {}) => {
  const lower = text.toLowerCase();
  
  let scores = {
    CODE: 0,
    CREATIVE: 0,
    RESEARCH: 0,
    UTILITY: 0,
    CUSTOM: 0,
  };

  // 1. Check Coding & Logic Domain
  if (entities.programmingLanguages.length > 0) scores.CODE += 5;
  if (entities.frameworks.length > 0) scores.CODE += 4;
  const codeKeywords = ['code', 'function', 'bug', 'error', 'algorithm', 'loop', 'class', 'api', 'syntax', 'fibonacci', 'array', 'string', 'variable', 'git'];
  codeKeywords.forEach((kw) => {
    if (lower.includes(kw)) scores.CODE += 2;
  });

  // 2. Check Creative & Communication Domain
  const creativeKeywords = ['email', 'essay', 'poem', 'story', 'blog', 'marketing', 'draft', 'rewrite', 'slogan', 'letter', 'headline', 'tone'];
  creativeKeywords.forEach((kw) => {
    if (lower.includes(kw)) scores.CREATIVE += 3;
  });

  // 3. Check Research & Analysis Domain
  const researchKeywords = ['summarize', 'analyze', 'analysis', 'research', 'report', 'document', 'history', 'explain in detail', 'overview', 'comparison', 'pros and cons'];
  researchKeywords.forEach((kw) => {
    if (lower.includes(kw)) scores.RESEARCH += 3;
  });

  // 4. Check Quick Utility & General Q&A Domain
  const utilityKeywords = ['hi', 'hello', 'hey', 'what is', 'who is', 'quick', 'define', 'meaning', 'help', 'thanks'];
  utilityKeywords.forEach((kw) => {
    if (lower.includes(kw)) scores.UTILITY += 2;
  });

  // 5. Check Custom Expert Domain
  const customKeywords = ['gemini', 'flash', 'custom', 'translate', 'language', 'french', 'spanish', 'german', 'convert'];
  customKeywords.forEach((kw) => {
    if (lower.includes(kw)) scores.CUSTOM += 4;
  });

  // Find domain with max score
  let maxDomain = 'UTILITY';
  let maxScore = scores.UTILITY;

  Object.keys(scores).forEach((domain) => {
    if (scores[domain] > maxScore) {
      maxScore = scores[domain];
      maxDomain = domain;
    }
  });

  return {
    domainKey: maxDomain,
    scores,
  };
};

module.exports = {
  classifyDomain
};
