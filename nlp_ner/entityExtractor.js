const extractEntities = (text = '') => {
  const lower = text.toLowerCase();
  const entities = {
    programmingLanguages: [],
    frameworks: [],
    documentTypes: [],
    actionVerbs: [],
    detectedTopics: [],
  };

  // Programming Languages NER
  const languages = ['python', 'javascript', 'js', 'typescript', 'ts', 'java', 'cpp', 'c++', 'c#', 'golang', 'go', 'rust', 'ruby', 'php', 'sql', 'dart', 'html', 'css'];
  languages.forEach((lang) => {
    const regex = new RegExp(`\\b${lang.replace('+', '\\+')}\\b`, 'i');
    if (regex.test(lower)) {
      entities.programmingLanguages.push(lang.toUpperCase());
    }
  });

  // Frameworks NER
  const frameworks = ['flutter', 'react', 'node', 'express', 'django', 'flask', 'spring', 'angular', 'vue', 'nextjs'];
  frameworks.forEach((fw) => {
    if (lower.includes(fw)) {
      entities.frameworks.push(fw);
    }
  });

  // Document & Content Types NER
  const docTypes = ['pdf', 'csv', 'essay', 'report', 'paper', 'article', 'resume', 'email', 'blog', 'story', 'poem', 'script'];
  docTypes.forEach((doc) => {
    if (lower.includes(doc)) {
      entities.documentTypes.push(doc);
    }
  });

  // Action Verbs NER
  const actions = ['write', 'build', 'create', 'debug', 'fix', 'summarize', 'explain', 'draft', 'optimize', 'convert', 'translate'];
  actions.forEach((act) => {
    if (lower.includes(act)) {
      entities.actionVerbs.push(act);
    }
  });

  return entities;
};

module.exports = {
  extractEntities
};
