const { db } = require('./index');
const { embeddingService } = require('../services/embeddings');
const pgvector = require('pgvector/pg');

/**
 * Metinous AI — Conversation & pgvector Vector Store Repository
 */
class ConversationStore {
  /**
   * Ensures conversation session exists, or creates a new one
   */
  async ensureConversation({ conversationId, userId = 'default_user', title = 'New Chat', metadata = {} }) {
    if (!db.isConnected) return null;

    const id = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();

    const query = `
      INSERT INTO conversations (id, user_id, title, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $5)
      ON CONFLICT (id) DO UPDATE 
      SET updated_at = $5,
          title = CASE WHEN conversations.title = 'New Chat' AND $3 != 'New Chat' THEN $3 ELSE conversations.title END
      RETURNING *;
    `;

    try {
      const res = await db.query(query, [id, userId, title, JSON.stringify(metadata), now]);
      return res.rows[0];
    } catch (err) {
      console.warn(`[CONVERSATION_STORE] Failed to ensure conversation: ${err.message}`);
      return null;
    }
  }

  /**
   * Saves a message and stores its vector embedding in pgvector
   */
  async saveMessage({
    conversationId,
    userId = 'default_user',
    sender = 'user', // 'user' | 'assistant' | 'system'
    text = '',
    route = 'CHAT',
    tool_used = false,
    tools = [],
    domain = 'GENERAL',
    domain_badge = '',
    metadata = {},
  }) {
    if (!db.isConnected) return null;

    const convId = conversationId || 'default_chat';
    await this.ensureConversation({
      conversationId: convId,
      userId,
      title: sender === 'user' ? text.substring(0, 45) : 'New Chat',
    });

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();

    try {
      // 1. Insert message into messages table
      const msgQuery = `
        INSERT INTO messages (id, conversation_id, user_id, sender, text, route, tool_used, tools, domain, domain_badge, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
      `;

      const msgRes = await db.query(msgQuery, [
        messageId,
        convId,
        userId,
        sender,
        text,
        route,
        Boolean(tool_used),
        JSON.stringify(tools || []),
        domain || 'GENERAL',
        domain_badge || '',
        JSON.stringify(metadata || {}),
        now,
      ]);

      // 2. Generate embedding & insert into conversation_embeddings
      if (text && text.trim().length > 0) {
        const embedding = await embeddingService.generateEmbedding(text);
        const embedId = `emb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const embedQuery = `
          INSERT INTO conversation_embeddings (id, message_id, conversation_id, user_id, sender, content, embedding, metadata, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id;
        `;

        await db.query(embedQuery, [
          embedId,
          messageId,
          convId,
          userId,
          sender,
          text,
          pgvector.toSql(embedding),
          JSON.stringify(metadata || {}),
          now,
        ]);
      }

      return msgRes.rows[0];
    } catch (err) {
      console.warn(`[CONVERSATION_STORE] Failed to save message: ${err.message}`);
      return null;
    }
  }

  /**
   * Retrieves messages for a specific conversation session
   */
  async getMessages(conversationId, limit = 50) {
    if (!db.isConnected) return [];

    const query = `
      SELECT * FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT $2;
    `;

    try {
      const res = await db.query(query, [conversationId, limit]);
      return res.rows;
    } catch (err) {
      console.warn(`[CONVERSATION_STORE] Failed to get messages: ${err.message}`);
      return [];
    }
  }

  /**
   * Lists conversations for a user
   */
  async getUserConversations(userId = 'default_user', limit = 20) {
    if (!db.isConnected) return [];

    const query = `
      SELECT c.*, 
             COUNT(m.id) AS message_count,
             (SELECT text FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT $2;
    `;

    try {
      const res = await db.query(query, [userId, limit]);
      return res.rows;
    } catch (err) {
      console.warn(`[CONVERSATION_STORE] Failed to get user conversations: ${err.message}`);
      return [];
    }
  }

  /**
   * Semantic Vector Search over past conversations using pgvector cosine distance (<=>)
   */
  async searchSemanticConversations({ userId = 'default_user', query, limit = 5 }) {
    if (!db.isConnected || !query || query.trim() === '') return [];

    try {
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Using cosine distance operator `<=>` (1 - distance = cosine similarity)
      const searchQuery = `
        SELECT 
          e.id,
          e.message_id,
          e.conversation_id,
          e.sender,
          e.content,
          e.created_at,
          (1 - (e.embedding <=> $1)) AS similarity,
          c.title AS conversation_title
        FROM conversation_embeddings e
        JOIN conversations c ON e.conversation_id = c.id
        WHERE e.user_id = $2
        ORDER BY e.embedding <=> $1
        LIMIT $3;
      `;

      const res = await db.query(searchQuery, [
        pgvector.toSql(queryEmbedding),
        userId,
        limit,
      ]);

      return res.rows;
    } catch (err) {
      console.warn(`[CONVERSATION_STORE] Vector similarity search failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Deletes a conversation session
   */
  async deleteConversation(conversationId) {
    if (!db.isConnected) return false;

    try {
      await db.query('DELETE FROM conversations WHERE id = $1;', [conversationId]);
      return true;
    } catch (err) {
      console.warn(`[CONVERSATION_STORE] Failed to delete conversation: ${err.message}`);
      return false;
    }
  }
}

const conversationStore = new ConversationStore();

module.exports = {
  ConversationStore,
  conversationStore,
};
