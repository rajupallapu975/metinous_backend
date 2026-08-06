const domainConfig = {
  CODE: {
    domainName: 'Engineering & Logic',
    badge: '💻 Code Expert',
    model: process.env.MODEL_CODE || 'meta-llama/llama-3.3-70b-instruct',
    systemPrompt: 'You are an expert Software Engineer and Logic Specialist. Provide clean, well-commented code with clear explanations.',
  },
  CREATIVE: {
    domainName: 'Creative Writing & Communication',
    badge: '🎨 Creative Expert',
    model: process.env.MODEL_CREATIVE || 'openai/gpt-4o-mini',
    systemPrompt: 'You are a master Creative Writer and Communications Specialist. Provide engaging, well-structured prose.',
  },
  RESEARCH: {
    domainName: 'Research & Deep Analysis',
    badge: '🔬 Research Expert',
    model: process.env.MODEL_RESEARCH || 'google/gemma-2-27b-it',
    systemPrompt: 'You are a Senior Research Analyst. Provide comprehensive, objective summaries and structured insights.',
  },
  UTILITY: {
    domainName: 'Quick Utility & Everyday Q&A',
    badge: '⚡ Fast Utility',
    model: process.env.MODEL_UTILITY || 'openai/gpt-4o-mini',
    systemPrompt: 'You are a fast, concise AI Assistant.',
  },
};

const orchestrateModel = (domainKey) => {
  const config = domainConfig[domainKey] || domainConfig.UTILITY;
  return {
    domainKey,
    domainName: config.domainName,
    badge: config.badge,
    selectedModel: config.model,
    systemPrompt: config.systemPrompt,
  };
};

module.exports = {
  orchestrateModel,
  domainConfig
};
