const { BaseTool } = require('./base');
const { conversationStore } = require('../db/conversationStore');
const { db } = require('../db');

/**
 * Base Memory Provider Interface
 */
class MemoryProvider {
  constructor(name = 'base_memory_provider') {
    this.name = name;
  }

  async storeMemory(userId, memoryItem) {
    throw new Error(`storeMemory not implemented for ${this.name}`);
  }

  async searchMemory(userId, query, limit = 5) {
    throw new Error(`searchMemory not implemented for ${this.name}`);
  }

  async retrieveRelevantMemories(userId, query, limit = 5) {
    throw new Error(`retrieveRelevantMemories not implemented for ${this.name}`);
  }
}

/**
 * Cognitive Memory Store: In-memory fallback
 */
class CognitiveMemoryStore extends MemoryProvider {
  constructor() {
    super('cognitive_in_memory_store');
    this.userMemories = new Map();
  }

  async storeMemory(userId = 'default_user', { key, content, type = 'CONVERSATION', tags = [], metadata = {} }) {
    if (!this.userMemories.has(userId)) {
      this.userMemories.set(userId, []);
    }

    const memories = this.userMemories.get(userId);

    // If storing a profile attribute (e.g., USER_PROFILE_NAME), update the existing attribute to avoid stale duplicates
    if (type === 'PROFILE' || (key && key.startsWith('USER_PROFILE_'))) {
      const existingIdx = memories.findIndex(m => m.key === key || (m.type === 'PROFILE' && m.key === key));
      if (existingIdx !== -1) {
        memories[existingIdx].content = content;
        memories[existingIdx].metadata = metadata;
        memories[existingIdx].tags = Array.isArray(tags) ? tags : [];
        memories[existingIdx].lastAccessed = new Date().toISOString();
        memories[existingIdx].updatedAt = new Date().toISOString();
        return memories[existingIdx];
      }
    }

    const memoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      key: key || content.substring(0, 30),
      content,
      type,
      tags: Array.isArray(tags) ? tags : [],
      metadata,
      createdAt: new Date().toISOString(),
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
    };

    memories.push(memoryEntry);
    return memoryEntry;
  }

  async searchMemory(userId = 'default_user', query = '', limit = 5) {
    const list = this.userMemories.get(userId) || [];
    if (list.length === 0) {
      return [];
    }

    const lowerQuery = (query || '').toLowerCase().trim();
    const queryTokens = lowerQuery.split(/\W+/).filter(t => t.length > 2);

    const isIdentityQuery = 
      lowerQuery.includes('name') ||
      lowerQuery.includes('who am i') ||
      lowerQuery.includes('about me') ||
      lowerQuery.includes('my profile') ||
      lowerQuery.includes('where do i') ||
      lowerQuery.includes('what do you know') ||
      lowerQuery.includes('remember me');

    const scored = list.map(item => {
      let score = 0;

      // Give highest priority to user profile facts
      if (item.type === 'PROFILE') {
        if (isIdentityQuery || queryTokens.length === 0) {
          score += 10;
        }
        if (lowerQuery.includes('name') && item.key === 'USER_PROFILE_NAME') {
          score += 20;
        }
        if ((lowerQuery.includes('study') || lowerQuery.includes('college')) && item.key === 'USER_PROFILE_COLLEGE') {
          score += 20;
        }
        if ((lowerQuery.includes('live') || lowerQuery.includes('location')) && item.key === 'USER_PROFILE_LOCATION') {
          score += 20;
        }
      }

      const targetText = `${item.key} ${item.content} ${item.tags.join(' ')}`.toLowerCase();
      for (const token of queryTokens) {
        if (targetText.includes(token)) {
          score += 2;
        }
      }

      return { item, score };
    });

    return scored
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(entry => {
        entry.item.accessCount++;
        entry.item.lastAccessed = new Date().toISOString();
        return entry.item;
      });
  }

  async retrieveRelevantMemories(userId = 'default_user', query = '', limit = 5) {
    return this.searchMemory(userId, query, limit);
  }
}

/**
 * PostgreSQL + pgvector Hybrid Memory Store
 */
class PostgresPgVectorMemoryStore extends MemoryProvider {
  constructor() {
    super('postgres_pgvector_memory_store');
    this.fallbackStore = new CognitiveMemoryStore();
  }

  async storeMemory(userId = 'default_user', memoryItem) {
    // Always keep in fallback store for instant access and profile resolution
    await this.fallbackStore.storeMemory(userId, memoryItem);

    if (db.isConnected) {
      return await conversationStore.saveMessage({
        conversationId: memoryItem.conversationId || 'default_memory_session',
        userId,
        sender: memoryItem.sender || 'system',
        text: memoryItem.content || memoryItem.key || '',
        route: 'MEMORY',
        tool_used: true,
        tools: ['memory'],
        domain: 'MEMORY',
        domain_badge: '🧠 Vector Memory',
        metadata: {
          key: memoryItem.key,
          type: memoryItem.type || 'MEMORY',
          tags: memoryItem.tags || [],
          ...(memoryItem.metadata || {}),
        },
      });
    }

    return null;
  }

  async searchMemory(userId = 'default_user', query = '', limit = 5) {
    // 1. Get profile items and active cognitive memories
    const inMemResults = await this.fallbackStore.searchMemory(userId, query, limit);
    const profileItems = inMemResults.filter(item => item.type === 'PROFILE');

    // 2. Query pgvector semantic search if available
    if (db.isConnected && query) {
      try {
        const vectorResults = await conversationStore.searchSemanticConversations({
          userId,
          query,
          limit,
        });

        if (vectorResults.length > 0) {
          const vectorMemories = vectorResults.map(r => ({
            id: r.id,
            key: r.conversation_title || r.content.substring(0, 30),
            content: r.content,
            type: 'SEMANTIC_VECTOR',
            similarity: parseFloat(r.similarity || 0),
            sender: r.sender,
            createdAt: r.created_at,
          }));

          // Merge profile items at the top followed by vector semantic results
          const combined = [...profileItems];
          for (const vm of vectorMemories) {
            if (!combined.some(c => c.content === vm.content)) {
              combined.push(vm);
            }
          }
          return combined.slice(0, limit);
        }
      } catch (err) {
        console.warn(`[MEMORY_TOOL] pgvector search error, using in-memory fallback: ${err.message}`);
      }
    }

    // Fallback to in-memory store
    return inMemResults;
  }

  async retrieveRelevantMemories(userId = 'default_user', query = '', limit = 5) {
    return this.searchMemory(userId, query, limit);
  }
}

class MemoryTool extends BaseTool {
  constructor() {
    super({
      name: 'memory',
      description: 'Accesses, searches, and stores Cognitive Memory via PostgreSQL pgvector similarity search and in-memory store.',
      category: 'MEMORY',
    });

    this.provider = new PostgresPgVectorMemoryStore();
  }

  async search(userId, query, limit = 5) {
    return await this.provider.searchMemory(userId, query, limit);
  }

  async store(userId, memoryItem) {
    return await this.provider.storeMemory(userId, memoryItem);
  }

  async execute(params = {}, context = {}) {
    const userId = params.userId || context.userId || 'default_user';
    const query = params.query || '';
    const memories = await this.search(userId, query, params.limit || 5);

    return {
      success: true,
      data: memories,
      count: memories.length,
      isVector: db.isConnected,
      answer: memories.length > 0
        ? `Retrieved ${memories.length} relevant historical memory record(s)${db.isConnected ? ' via pgvector' : ''}.`
        : 'No previous memories found for this query.',
    };
  }
}

module.exports = {
  MemoryProvider,
  CognitiveMemoryStore,
  PostgresPgVectorMemoryStore,
  MemoryTool,
  memoryTool: new MemoryTool(),
};
