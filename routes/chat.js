const express = require('express');
const router = express.Router();
const { orchestrator } = require('../core/orchestrator');
const { conversationStore } = require('../db/conversationStore');
const { db } = require('../db');

// Health Check Endpoint (Includes PostgreSQL & pgvector status)
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    configuredModel: process.env.OPENROUTER_MODEL || process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini',
    hasApiKey: Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here'),
    searxngUrl: process.env.SEARXNG_URL || 'http://localhost:8080',
    database: db.getStatus(),
  });
});

// High-Performance Image Proxy (Resolves Browser CORS issues in Flutter Web)
router.get('/image-proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl || typeof targetUrl !== 'string' || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      return res.status(400).send('Invalid or missing image URL parameter.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const imageResponse = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (!imageResponse.ok) {
      return res.status(imageResponse.status).send('Failed to fetch upstream image.');
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const buffer = await imageResponse.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err) {
    return res.status(500).send(`Image proxy error: ${err.message}`);
  }
});

// Helper for ISO / Local Timestamp with milliseconds
const getFormattedTimestamp = (date = new Date()) => {
  const pad = (n, width = 2) => String(n).padStart(width, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const millis = pad(date.getMilliseconds(), 3);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${millis}`;
};

// Chat Completion Endpoint with Metinous Cognitive Orchestration
router.post('/chat', async (req, res, next) => {
  try {
    const { message, history, systemPrompt, userId, chatId } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        error: 'Message is required and cannot be empty.'
      });
    }

    const promptDate = new Date();
    const promptTime = getFormattedTimestamp(promptDate);
    const startTime = Date.now();

    console.log(`\n==================================================`);
    console.log(`📥 INPUT TIMESTAMP  : ${promptTime}`);
    console.log(`💬 USER MESSAGE     : "${message.trim()}"`);

    // Execute Master Cognitive Orchestrator
    const response = await orchestrator.processQuery({
      query: message.trim(),
      history: history || [],
      systemPrompt,
      userId: userId || 'user_001',
      chatId: chatId || 'chat_001',
      broadcastFn: req.app.get('broadcastTerminalLog'),
    });

    const outputDate = new Date();
    const outputTime = getFormattedTimestamp(outputDate);
    const duration = Date.now() - startTime;

    console.log(`🧭 ROUTE DECISION   : ${response.route} (Tools: ${response.tools.length > 0 ? response.tools.join(', ') : 'None'})`);
    console.log(`⏰ OUTPUT TIMESTAMP : ${outputTime} (Duration: ${duration}ms)`);
    console.log(`📤 AI RESPONSE      :\n"${response.answer}"`);
    if (response.sources && response.sources.length > 0) {
      console.log(`🔗 SOURCES (${response.sources.length}):`);
      response.sources.forEach((s, idx) => console.log(`   [${idx + 1}] ${s.title} (${s.url})`));
    }
    console.log('==================================================\n');

    res.json(response.toJSON());
  } catch (err) {
    const errTime = getFormattedTimestamp();
    console.error(`\n⏰ ERROR TIMESTAMP  : ${errTime}`);
    console.error(`❌ ORCHESTRATION ERROR : ${err.message}`);
    console.error('==================================================\n');
    next(err);
  }
});

// -------------------------------------------------------------
// CONVERSATIONS & PGVECTOR MEMORY ENDPOINTS
// -------------------------------------------------------------

// List user conversations
router.get('/conversations', async (req, res, next) => {
  try {
    const userId = req.query.userId || 'default_user';
    const limit = parseInt(req.query.limit || '30', 10);
    const conversations = await conversationStore.getUserConversations(userId, limit);
    res.json({
      success: true,
      userId,
      count: conversations.length,
      conversations,
      database: db.getStatus(),
    });
  } catch (err) {
    next(err);
  }
});

// Get message history for a conversation
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const limit = parseInt(req.query.limit || '100', 10);
    const messages = await conversationStore.getMessages(conversationId, limit);
    res.json({
      success: true,
      conversationId,
      count: messages.length,
      messages,
    });
  } catch (err) {
    next(err);
  }
});

// Semantic Vector Similarity Search via pgvector
router.post('/conversations/search', async (req, res, next) => {
  try {
    const { query, userId = 'default_user', limit = 5 } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    const results = await conversationStore.searchSemanticConversations({
      userId,
      query,
      limit,
    });

    res.json({
      success: true,
      query,
      count: results.length,
      results,
      database: db.getStatus(),
    });
  } catch (err) {
    next(err);
  }
});

// Delete a conversation session
router.delete('/conversations/:id', async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const deleted = await conversationStore.deleteConversation(conversationId);
    res.json({
      success: deleted,
      conversationId,
      message: deleted ? 'Conversation deleted successfully.' : 'Could not delete conversation.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
