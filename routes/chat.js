const express = require('express');
const router = express.Router();
const { getOpenRouterCompletion } = require('../services/openrouter');
const nlpNer = require('../nlp_ner');

// Health Check Endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    configuredModel: process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini',
    hasApiKey: Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here')
  });
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

// Chat Completion Endpoint with NLP/NER Orchestration
router.post('/chat', async (req, res, next) => {
  try {
    const { message, history, systemPrompt } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        error: 'Message is required and cannot be empty.'
      });
    }

    const promptDate = new Date();
    const promptTime = getFormattedTimestamp(promptDate);
    const startTime = Date.now();

    // 🧠 1. Execute Real-Time Step-by-Step Cognitive Architecture Pipeline
    const { nlpResult, reply } = await nlpNer.runCognitivePipeline({
      promptText: message.trim(),
      history: history || [],
      broadcastFn: req.app.get('broadcastTerminalLog'),
      getCompletionFn: ({ targetModel }) => getOpenRouterCompletion({
        message: message.trim(),
        history: history || [],
        systemPrompt: systemPrompt,
        targetModel,
      }),
    });

    const outputDate = new Date();
    const outputTime = getFormattedTimestamp(outputDate);
    const duration = Date.now() - startTime;

    console.log(`⏰ OUTPUT TIMESTAMP : ${outputTime} (Duration: ${duration}ms)`);
    console.log(`📤 AI RESPONSE      :\n"${reply.trim()}"`);
    console.log('==================================================\n');

    res.json({
      reply: reply,
      domain: nlpResult.domainKey,
      domainBadge: nlpResult.badge,
      modelUsed: nlpResult.selectedModel,
    });
  } catch (err) {
    const errTime = getFormattedTimestamp();
    console.error(`\n⏰ ERROR TIMESTAMP  : ${errTime}`);
    console.error(`❌ OPENROUTER ERROR : ${err.message}`);
    console.error('==================================================\n');
    next(err);
  }
});

module.exports = router;
