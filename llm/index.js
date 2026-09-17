const { LLMProvider } = require('./provider');
const { OpenRouterProvider } = require('./openrouter');

class LLMManager {
  constructor() {
    this.providers = new Map();
    this.registerProvider('openrouter', new OpenRouterProvider());
    this.activeProviderName = 'openrouter';
  }

  registerProvider(name, providerInstance) {
    this.providers.set(name.toLowerCase(), providerInstance);
  }

  getProvider(name) {
    const provider = this.providers.get((name || this.activeProviderName).toLowerCase());
    if (!provider) {
      throw new Error(`LLM Provider '${name}' not found.`);
    }
    return provider;
  }

  getActiveProvider() {
    return this.getProvider(this.activeProviderName);
  }

  setActiveProvider(name) {
    if (!this.providers.has(name.toLowerCase())) {
      throw new Error(`Cannot set active provider: '${name}' is not registered.`);
    }
    this.activeProviderName = name.toLowerCase();
  }
}

const llmManager = new LLMManager();

module.exports = {
  LLMProvider,
  OpenRouterProvider,
  llmManager,
  getActiveLLMProvider: () => llmManager.getActiveProvider(),
};
