/**
 * Base LLM Provider Abstraction
 */

class LLMProvider {
  constructor(name = 'base-provider') {
    this.name = name;
  }

  /**
   * Generates a completion
   * @param {Object} params
   * @param {string} params.prompt - Current user prompt
   * @param {Array} params.messages - Formatted conversation history [{role, content}]
   * @param {string} params.systemPrompt - System instructions
   * @param {string} params.targetModel - Optional target model override
   * @param {number} params.temperature - Sampling temperature
   * @param {number} params.maxTokens - Max tokens to generate
   * @returns {Promise<{reply: string, modelUsed: string, usage?: Object}>}
   */
  async generateCompletion(params) {
    throw new Error(`generateCompletion not implemented for ${this.name}`);
  }
}

module.exports = {
  LLMProvider,
};
