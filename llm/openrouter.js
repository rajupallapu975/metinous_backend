const { LLMProvider } = require('./provider');

class OpenRouterProvider extends LLMProvider {
  constructor() {
    super('openrouter');
  }

  get apiKey() {
    return process.env.OPENROUTER_API_KEY;
  }

  get baseUrl() {
    return process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions';
  }

  get defaultModel() {
    return process.env.OPENROUTER_MODEL || process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini';
  }

  /**
   * Internal helper to query a specific model with timeout
   */
  async _queryModel(selectedModel, messages, temperature = 0.7, maxTokens = 1024, timeoutMs = 25000) {
    const apiKey = this.apiKey;
    if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
      const error = new Error('OPENROUTER_API_KEY is not configured in server .env file.');
      error.statusCode = 401;
      throw error;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`[OPENROUTER] Querying ${selectedModel} (timeout: ${timeoutMs}ms, messages: ${messages.length}, maxTokens: ${maxTokens})...`);
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://metinous.ai',
          'X-Title': 'Metinous AI Ecosystem'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        
        // Auto-recover from HTTP 402 credit limit by immediately retrying with affordable token count
        const affordMatch = errText.match(/can only afford\s+(\d+)/i);
        if (response.status === 402 && affordMatch) {
          const allowedTokens = Math.max(60, parseInt(affordMatch[1], 10) - 15);
          console.log(`🔄 [OPENROUTER 402 RECOVERY] Retrying with affordable token budget: ${allowedTokens}...`);
          clearTimeout(timeoutId);
          return await this._queryModel(selectedModel, messages, temperature, allowedTokens, timeoutMs);
        }

        throw new Error(`OpenRouter API error (Status ${response.status}): ${errText}`);
      }

      const data = await response.json();
      clearTimeout(timeoutId);

      const choices = data?.choices;
      if (!choices || choices.length === 0) {
        throw new Error('OpenRouter returned an empty choice set.');
      }

      const reply = choices[0]?.message?.content || '';
      return {
        reply,
        modelUsed: selectedModel,
        usage: data?.usage || {},
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Generates completion with fallbacks
   */
  async generateCompletion({
    prompt,
    messages = [],
    systemPrompt = 'You are Metinous AI, an advanced intelligent AI assistant.',
    targetModel = null,
    temperature = 0.7,
    maxTokens = 600,
  }) {
    const primaryModel = targetModel || this.defaultModel;

    let formattedMessages = [];
    if (messages && messages.length > 0) {
      formattedMessages = messages
        .filter(m => m.content && m.content.trim() !== '')
        .map(m => ({ role: m.role || 'user', content: m.content }));

      // Append current user prompt if provided and not already duplicate
      if (prompt) {
        const lastMsg = formattedMessages[formattedMessages.length - 1];
        if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== prompt) {
          formattedMessages.push({ role: 'user', content: prompt });
        }
      }

      // Ensure system prompt is at the head
      const sysIdx = formattedMessages.findIndex(m => m.role === 'system');
      if (sysIdx !== -1) {
        formattedMessages[sysIdx] = { role: 'system', content: systemPrompt };
      } else {
        formattedMessages.unshift({ role: 'system', content: systemPrompt });
      }
    } else if (prompt) {
      formattedMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];
    }

    const fallbackModels = [
      primaryModel,
      'openai/gpt-4o-mini',
      'google/gemini-2.5-flash',
      'z-ai/glm-5.2:free',
      'liquid/lfm-2.5-2.6b:free',
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let lastError = null;

    for (const model of fallbackModels) {
      try {
        return await this._queryModel(model, formattedMessages, temperature, maxTokens, 20000);
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ [OPENROUTER WARNING] Model ${model} failed: ${err.message}`);

        // If error was 402 credit limit with max_tokens, retry this model once with reduced max_tokens
        if (err.message.includes('402') || err.message.includes('credits') || err.message.includes('max_tokens')) {
          try {
            console.log(`🔄 [OPENROUTER RETRY] Retrying ${model} with maxTokens=350...`);
            return await this._queryModel(model, formattedMessages, temperature, 350, 15000);
          } catch (retryErr) {
            console.warn(`⚠️ [OPENROUTER RETRY FAILED] ${retryErr.message}`);
          }
        }
      }
    }

    throw new Error(`All OpenRouter model endpoints failed. Last error: ${lastError?.message || 'Unknown'}`);
  }
}

module.exports = {
  OpenRouterProvider,
};
