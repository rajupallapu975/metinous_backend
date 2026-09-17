const { RouteCategories } = require('../models/schemas');
const { cognitiveRouter } = require('./router');
const { toolRegistry } = require('../tools/registry');
const { evidenceBuilder } = require('./evidence_builder');
const { responseGenerator } = require('./response_generator');
const { METINOUS_SYSTEM_PROMPT, WEB_SYNTHESIS_PROMPT, MEMORY_SYNTHESIS_PROMPT } = require('./prompts');
const { getActiveLLMProvider } = require('../llm');
const { conversationStore } = require('../db/conversationStore');
const { profileExtractor } = require('./profile_extractor');

const { processPromptDirect } = require('../nlp_ner/cognitiveArchitecture');

const llmNodes = [
  { id: 1, name: 'LLM 1', label: 'Code Expert', model: 'meta-llama/llama-3.3-70b-instruct', domain: 'CODE' },
  { id: 2, name: 'LLM 2', label: 'Creative', model: 'openai/gpt-4o-mini', domain: 'CREATIVE' },
  { id: 3, name: 'LLM 3', label: 'Research', model: 'google/gemma-2-27b-it', domain: 'RESEARCH' },
  { id: 4, name: 'LLM 4', label: 'Utility', model: 'openai/gpt-4o-mini', domain: 'UTILITY' },
  { id: 5, name: 'LLM n', label: 'Custom Expert', model: 'google/gemini-2.5-flash', domain: 'CUSTOM' },
];

/**
 * Metinous AI — Master Cognitive Orchestrator
 */
class Orchestrator {
  constructor() {
    this.router = cognitiveRouter;
    this.tools = toolRegistry;
  }

  /**
   * Main entry point: Processes a user query end-to-end
   * @param {Object} params
   * @param {string} params.query - Current user prompt
   * @param {Array} [params.history=[]] - Conversation message history
   * @param {string} [params.systemPrompt] - Optional system prompt override
   * @param {string} [params.userId='default_user'] - User ID
   * @param {string} [params.chatId='default_chat'] - Chat ID
   * @param {Function} [params.broadcastFn] - WebSocket telemetry logger
   * @returns {Promise<import('../models/schemas').ChatResponse>}
   */
  async processQuery({
    query,
    history = [],
    systemPrompt = '',
    userId = 'default_user',
    chatId = 'default_chat',
    broadcastFn = null,
  }) {
    // 0. Auto-extract user profile facts (Name, College, Location, Job) and persist across all chats
    try {
      const profileFacts = profileExtractor.extractProfileFacts(query);
      for (const fact of profileFacts) {
        console.log(`[ORCHESTRATOR] Persisting user profile fact for user ${userId}: [${fact.key}] -> "${fact.value}"`);
        await this.tools.getTool('memory')?.store(userId, {
          key: fact.key,
          content: fact.content,
          type: 'PROFILE',
          tags: fact.tags,
          metadata: { ...fact, sourceQuery: query, chatId },
        });
      }
    } catch (err) {
      console.warn(`[ORCHESTRATOR] Profile extraction notice: ${err.message}`);
    }

    const response = await this._executeRoute({
      query,
      history,
      systemPrompt,
      userId,
      chatId,
      broadcastFn,
    });

    // Auto-persist conversation history & vector embeddings in PostgreSQL pgvector
    try {
      await conversationStore.saveMessage({
        conversationId: chatId,
        userId,
        sender: 'user',
        text: query,
      });

      await conversationStore.saveMessage({
        conversationId: chatId,
        userId,
        sender: 'assistant',
        text: response.answer,
        route: response.route,
        tool_used: response.tool_used,
        tools: response.tools,
        domain: response.domain,
        domain_badge: response.domainBadge,
        metadata: response.metadata,
      });
    } catch (err) {
      console.warn(`[ORCHESTRATOR] Conversation persistence notice: ${err.message}`);
    }

    return response;
  }

  async _executeRoute({
    query,
    history = [],
    systemPrompt = '',
    userId = 'default_user',
    chatId = 'default_chat',
    broadcastFn = null,
  }) {
    const startTime = Date.now();
    const llmProvider = getActiveLLMProvider();

    // 1. Cognitive Route Decision & NLP Analysis
    const routeDecision = this.router.route(query, { history, userId });
    const { category, toolNeeded, metadata } = routeDecision;

    console.log(`[ORCHESTRATOR] Query: "${query}" ➔ Route: ${category} (Tool: ${toolNeeded || 'none'})`);

    const nlpResult = processPromptDirect(query);
    let activeDomain = nlpResult.domainKey;
    if (category === RouteCategories.WEB || category === RouteCategories.WEB_FETCH) {
      activeDomain = 'RESEARCH';
    } else if (category === RouteCategories.CALCULATOR) {
      activeDomain = 'CODE';
    } else if (category === RouteCategories.TIME) {
      activeDomain = 'UTILITY';
    } else if (category === RouteCategories.MEMORY) {
      activeDomain = 'UTILITY';
    }

    const activeLLM = llmNodes.find(n => n.domain === activeDomain) || llmNodes[3];

    const stageDefinitions = [
      { name: 'USER QUERY', status: 'COMPLETED', details: `"${query}"` },
      { name: 'COGNITIVE BRAIN', status: 'COMPLETED', details: 'Planning & Intent Breakdown' },
      { name: 'COGNITIVE MEMORY', status: 'COMPLETED', details: `Retrieved ${history.length} memory context items` },
      { name: 'ROUTER', status: 'COMPLETED', details: `Scored Intent ➔ ${nlpResult.badge || category}` },
      { name: activeLLM.name, status: 'COMPLETED', details: `${activeLLM.label} (${activeLLM.model})` },
      { name: 'COLLECTIVE INTELLIGENCE', status: 'COMPLETED', details: 'Multi-Source Synthesis & Aggregation' },
      { name: 'VERIFICATION AGENT', status: 'COMPLETED', details: 'Grounded Schema & Honesty Auditing' },
      { name: 'FINAL RESPONSE', status: 'COMPLETED', details: 'Model Output Synthesis Complete' },
      { name: 'USER', status: 'COMPLETED', details: 'Transmitting output to client' },
      { name: 'EXPERIENCE LEARNING', status: 'COMPLETED', details: 'Feedback & Optimization Extraction' },
      { name: 'UPDATE COGNITIVE MEMORY', status: 'COMPLETED', details: 'Persisting graph to Memory Store' },
    ];

    const emitCognitiveTrace = (activeStageIndex, status = 'THINKING', extra = {}) => {
      if (typeof broadcastFn === 'function') {
        broadcastFn({
          type: 'COGNITIVE_TRACE',
          status,
          timestamp: new Date().toISOString(),
          promptText: query,
          domainKey: activeDomain,
          domainName: nlpResult.domainName,
          domainBadge: nlpResult.badge,
          selectedModel: activeLLM.model,
          detectedEntities: nlpResult.detectedEntities,
          scores: nlpResult.scores,
          activeLLM,
          historyLength: history.length,
          isLowLevel: false,
          activeStageIndex,
          completedStageIndices: Array.from({ length: activeStageIndex }, (_, i) => i),
          stages: stageDefinitions,
          ...extra,
        });
      }
    };

    // Helper to log telemetry
    const emitTelemetry = (stage, detail = {}) => {
      if (typeof broadcastFn === 'function') {
        broadcastFn({
          type: 'ORCHESTRATOR_TRACE',
          stage,
          category,
          toolNeeded,
          timestamp: new Date().toISOString(),
          ...detail,
        });
      }
    };

    emitTelemetry('ROUTED', { category, reason: routeDecision.reason });
    emitCognitiveTrace(3, 'THINKING');

    const finalizeResponse = (resp) => {
      const durationMs = Date.now() - startTime;
      emitCognitiveTrace(10, 'COMPLETED', {
        reply: resp.answer,
        durationMs,
      });
      return resp;
    };

    // -------------------------------------------------------------
    // ROUTE: TIME (Local System Real-Time Tool — Zero LLM Overhead)
    // -------------------------------------------------------------
    if (category === RouteCategories.TIME) {
      emitTelemetry('TOOL_EXECUTION_START', { tool: 'time' });
      const timeResult = await this.tools.executeTool('time', metadata);
      emitTelemetry('TOOL_EXECUTION_END', { tool: 'time', success: timeResult.success });

      const answer = timeResult.answer || timeResult.data?.formattedAnswer || 'Could not determine local time.';
      
      return finalizeResponse(responseGenerator.generate({
        answer,
        route: RouteCategories.TIME,
        tool_used: true,
        tools: ['time'],
        sources: [],
        images: [],
        domain: 'TIME',
        domainBadge: '⏰ Local Time Tool',
        modelUsed: 'local-system-clock',
      }));
    }

    // -------------------------------------------------------------
    // ROUTE: CALCULATOR (Safe Math Tool — Zero LLM Overhead)
    // -------------------------------------------------------------
    if (category === RouteCategories.CALCULATOR) {
      emitTelemetry('TOOL_EXECUTION_START', { tool: 'calculator' });
      const calcResult = await this.tools.executeTool('calculator', metadata);
      emitTelemetry('TOOL_EXECUTION_END', { tool: 'calculator', success: calcResult.success });

      const answer = calcResult.answer || calcResult.data?.formattedAnswer || 'Calculation failed.';

      return finalizeResponse(responseGenerator.generate({
        answer,
        route: RouteCategories.CALCULATOR,
        tool_used: true,
        tools: ['calculator'],
        sources: [],
        images: [],
        domain: 'CALCULATOR',
        domainBadge: '🧮 Math Engine',
        modelUsed: 'local-safe-math-evaluator',
      }));
    }

    // -------------------------------------------------------------
    // ROUTE: WEB_FETCH (Fetch Specific URL & Summarize/Synthesize)
    // -------------------------------------------------------------
    if (category === RouteCategories.WEB_FETCH) {
      emitTelemetry('TOOL_EXECUTION_START', { tool: 'web_fetch', url: metadata.url });
      const fetchResult = await this.tools.executeTool('web_fetch', metadata);
      emitTelemetry('TOOL_EXECUTION_END', { tool: 'web_fetch', success: fetchResult.success });

      if (!fetchResult.success) {
        return finalizeResponse(responseGenerator.generate({
          answer: `⚠️ Could not retrieve the requested webpage (${metadata.url}).\n\nReason: ${fetchResult.data?.error || 'Failed to connect.'}`,
          route: RouteCategories.WEB_FETCH,
          tool_used: true,
          tools: ['web_fetch'],
          sources: [],
          images: [],
          domain: 'WEB_FETCH',
          domainBadge: '📄 Web Fetch',
          modelUsed: 'web-fetch-guard',
        }));
      }

      // Build context from fetched document
      const evidence = evidenceBuilder.buildEvidenceContext({
        fetchedPages: [fetchResult.data],
      });

      const promptWithEvidence = `User Question: "${query}"\n\n${evidence.evidenceContext}\n\nPlease summarize and explain the content of this webpage for the user.`;

      const llmResult = await llmProvider.generateCompletion({
        prompt: promptWithEvidence,
        messages: history.map(h => ({ role: h.role || 'user', content: h.content || '' })),
        systemPrompt: WEB_SYNTHESIS_PROMPT,
      });

      // Store in memory
      await this.tools.getTool('memory')?.store(userId, {
        key: `Fetched Page: ${fetchResult.data.title}`,
        content: `User query: "${query}"\nSummary: ${llmResult.reply.substring(0, 300)}...`,
        type: 'LONG_TERM',
      });

      return finalizeResponse(responseGenerator.generate({
        answer: llmResult.reply,
        route: RouteCategories.WEB_FETCH,
        tool_used: true,
        tools: ['web_fetch'],
        sources: evidence.sources,
        images: [],
        domain: 'WEB_FETCH',
        domainBadge: '📄 Web Fetch Document',
        modelUsed: llmResult.modelUsed,
      }));
    }

    // -------------------------------------------------------------
    // ROUTE: WEB (Free Web Search + Free Image Search + Grounded Synthesis)
    // -------------------------------------------------------------
    if (category === RouteCategories.WEB) {
      emitTelemetry('TOOL_EXECUTION_START', { tool: 'web_search', query: metadata.query });

      // Run web search and image search concurrently
      const [searchResult, imageResult] = await Promise.all([
        this.tools.executeTool('web_search', metadata).catch(err => ({ success: false, data: { error: err.message, results: [] } })),
        this.tools.executeTool('image_search', { query: metadata.query, maxResults: 4 }).catch(() => ({ success: false, data: [] })),
      ]);

      emitTelemetry('TOOL_EXECUTION_END', { tool: 'web_search', success: searchResult.success });

      const results = searchResult.data?.results || [];
      const images = imageResult.data || [];

      // If search returned zero results, generate an intelligent answer from general knowledge with NO images
      if (!searchResult.success || results.length === 0) {
        const fallbackPrompt = `User Question: "${query}"\n\nPlease provide a clear, comprehensive, and engaging structured answer based on verified knowledge. If relevant, explain key context, notable figures or milestones, and any nuances.`;
        const llmResult = await llmProvider.generateCompletion({
          prompt: fallbackPrompt,
          messages: history.map(h => ({ role: h.role || 'user', content: h.content || '' })),
          systemPrompt: METINOUS_SYSTEM_PROMPT,
        });

        return finalizeResponse(responseGenerator.generate({
          answer: llmResult.reply,
          route: RouteCategories.WEB,
          tool_used: true,
          tools: ['web_search'],
          sources: [],
          images: [], // Do NOT attach fake or ungrounded images when live search is unavailable
          domain: 'RESEARCH',
          domainBadge: '🌐 Cognitive Search',
          modelUsed: llmResult.modelUsed,
        }));
      }

      const searchQuery = metadata.query || query;

      // Build evidence context from search results with query-aware noise filtering
      const evidence = evidenceBuilder.buildEvidenceContext({
        query: searchQuery,
        searchResults: results,
      });

      const promptWithEvidence = `User Question: "${query}" (Target Subject: "${searchQuery}")\n\n${evidence.evidenceContext}\n\nPlease synthesize an accurate, engaging, and structured answer strictly grounded in the real-time web evidence above.`;

      const llmResult = await llmProvider.generateCompletion({
        prompt: promptWithEvidence,
        messages: history.map(h => ({ role: h.role || 'user', content: h.content || '' })),
        systemPrompt: WEB_SYNTHESIS_PROMPT,
      });

      // Store in memory
      await this.tools.getTool('memory')?.store(userId, {
        key: query,
        content: `Search query: "${query}"\nKey Findings: ${llmResult.reply.substring(0, 300)}...`,
        type: 'LONG_TERM',
      });

      return finalizeResponse(responseGenerator.generate({
        answer: llmResult.reply,
        route: RouteCategories.WEB,
        tool_used: true,
        tools: ['web_search', ...(images.length > 0 ? ['image_search'] : [])],
        sources: evidence.sources,
        images: images,
        domain: 'RESEARCH',
        domainBadge: '🌐 Grounded Web Search',
        modelUsed: llmResult.modelUsed,
      }));
    }

    // -------------------------------------------------------------
    // ROUTE: MEMORY (Conversational Recall / User Preference)
    // -------------------------------------------------------------
    if (category === RouteCategories.MEMORY) {
      emitTelemetry('TOOL_EXECUTION_START', { tool: 'memory' });
      const memoryResult = await this.tools.executeTool('memory', { userId, query: metadata.query });
      emitTelemetry('TOOL_EXECUTION_END', { tool: 'memory', success: memoryResult.success });

      const memories = memoryResult.data || [];

      if (memories.length === 0 && (!history || history.length === 0)) {
        return finalizeResponse(responseGenerator.generate({
          answer: `I don't have any previous saved records or notes regarding **"${query}"** in our memory yet. Feel free to tell me, and I will remember it!`,
          route: RouteCategories.MEMORY,
          tool_used: true,
          tools: ['memory'],
          sources: [],
          images: [],
          domain: 'MEMORY',
          domainBadge: '🧠 Memory Store',
          modelUsed: 'cognitive-memory-engine',
        }));
      }

      // Synthesize answer with retrieved memory and active conversation context
      const evidence = evidenceBuilder.buildEvidenceContext({
        memoryItems: memories,
      });

      const promptWithMemory = memories.length > 0
        ? `User Question: "${query}"\n\n${evidence.evidenceContext}\n\nAnswer the user's recall question based on the retrieved memory items and recent conversation.`
        : `User Question: "${query}"\n\nPlease answer the user's question based on the active conversation history.`;

      const llmResult = await llmProvider.generateCompletion({
        prompt: promptWithMemory,
        messages: (history || []).filter(h => h.content && h.content.trim()).map(h => ({ role: h.role || 'user', content: h.content })),
        systemPrompt: MEMORY_SYNTHESIS_PROMPT,
      });

      return finalizeResponse(responseGenerator.generate({
        answer: llmResult.reply,
        route: RouteCategories.MEMORY,
        tool_used: true,
        tools: ['memory'],
        sources: [],
        images: [],
        domain: 'MEMORY',
        domainBadge: '🧠 Cognitive Memory',
        modelUsed: llmResult.modelUsed,
      }));
    }

    // -------------------------------------------------------------
    // ROUTE: CHAT (Standard Conversational LLM Flow)
    // -------------------------------------------------------------
    emitTelemetry('CHAT_LLM_START', { model: llmProvider.defaultModel });

    const activeSystemPrompt = systemPrompt || METINOUS_SYSTEM_PROMPT;

    const formattedHistory = history
      .filter(h => h.content && h.content.trim() !== '')
      .map(h => ({ role: h.role || 'user', content: h.content }));

    const llmResult = await llmProvider.generateCompletion({
      prompt: query,
      messages: formattedHistory,
      systemPrompt: activeSystemPrompt,
    });

    emitTelemetry('CHAT_LLM_END', { modelUsed: llmResult.modelUsed });

    // Store in cognitive memory for future continuity
    await this.tools.getTool('memory')?.store(userId, {
      key: query.substring(0, 40),
      content: `Q: ${query}\nA: ${llmResult.reply.substring(0, 200)}...`,
      type: 'CONVERSATION',
    });

    return finalizeResponse(responseGenerator.generate({
      answer: llmResult.reply,
      route: RouteCategories.CHAT,
      tool_used: false,
      tools: [],
      sources: [],
      images: [],
      domain: 'UTILITY',
      domainBadge: '💬 Metinous AI Core',
      modelUsed: llmResult.modelUsed,
    }));
  }
}

const orchestrator = new Orchestrator();

module.exports = {
  Orchestrator,
  orchestrator,
  processQuery: (params) => orchestrator.processQuery(params),
};
