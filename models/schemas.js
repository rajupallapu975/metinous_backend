/**
 * Metinous AI — Core Data Models & Schemas
 */

const RouteCategories = Object.freeze({
  CHAT: 'CHAT',
  TIME: 'TIME',
  CALCULATOR: 'CALCULATOR',
  WEB: 'WEB',
  WEB_FETCH: 'WEB_FETCH',
  MEMORY: 'MEMORY',
  IMAGE_SEARCH: 'IMAGE_SEARCH',
});

class ChatRequest {
  constructor({ message, history = [], systemPrompt = '', userId = 'default_user', chatId = 'default_chat' }) {
    if (!message || typeof message !== 'string' || message.trim() === '') {
      throw new Error('Message is required and cannot be empty.');
    }
    this.message = message.trim();
    this.history = Array.isArray(history) ? history : [];
    this.systemPrompt = systemPrompt || '';
    this.userId = userId;
    this.chatId = chatId;
  }
}

class ChatResponse {
  constructor({
    answer,
    reply,
    route = RouteCategories.CHAT,
    tool_used = false,
    tools = [],
    sources = [],
    images = [],
    domain = 'UTILITY',
    domainBadge = '⚡ Utility',
    modelUsed = 'openai/gpt-4o-mini',
    metadata = {}
  }) {
    const finalAnswer = answer || reply || '';
    this.answer = finalAnswer;
    this.reply = finalAnswer; // Backward compatibility with existing Flutter client
    this.route = route;
    this.tool_used = Boolean(tool_used);
    this.tools = Array.isArray(tools) ? tools : [];
    this.sources = Array.isArray(sources) ? sources : [];
    this.images = Array.isArray(images) ? images : [];
    this.domain = domain;
    this.domainBadge = domainBadge;
    this.modelUsed = modelUsed;
    this.metadata = metadata;
  }

  toJSON() {
    return {
      answer: this.answer,
      reply: this.reply,
      route: this.route,
      tool_used: this.tool_used,
      tools: this.tools,
      sources: this.sources,
      images: this.images,
      domain: this.domain,
      domainBadge: this.domainBadge,
      modelUsed: this.modelUsed,
      metadata: this.metadata,
    };
  }
}

class SourceItem {
  constructor({ title, url, snippet = '' }) {
    this.title = title || url || 'Source';
    this.url = url || '';
    if (snippet) {
      this.snippet = snippet;
    }
  }
}

module.exports = {
  RouteCategories,
  ChatRequest,
  ChatResponse,
  SourceItem,
};
