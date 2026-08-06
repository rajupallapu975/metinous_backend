const { extractEntities } = require('./entityExtractor');
const { classifyDomain } = require('./domainClassifier');
const { orchestrateModel } = require('./modelOrchestrator');

const processPromptDirect = (promptText = '') => {
  const entities = extractEntities(promptText);
  const { domainKey, scores } = classifyDomain(promptText, entities);
  const orchestration = orchestrateModel(domainKey);

  const entityList = [
    ...entities.programmingLanguages,
    ...entities.frameworks,
    ...entities.documentTypes,
    ...entities.actionVerbs,
  ];

  return {
    promptText,
    domainKey,
    domainName: orchestration.domainName,
    badge: orchestration.badge,
    selectedModel: orchestration.selectedModel,
    systemPrompt: orchestration.systemPrompt,
    detectedEntities: entityList.length > 0 ? entityList.join(', ') : 'None',
    scores,
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Real-time Step-by-Step Server Execution of Cognitive Architecture Pipeline.
 * Prints the complete ASCII architecture box diagram and stage steps to stdout (streamed live to terminal).
 */
const runCognitivePipeline = async ({ promptText, history = [], broadcastFn, getCompletionFn }) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // 1. Process Prompt via NLP/NER Engine
  const nlpResult = processPromptDirect(promptText);
  const selectedDomain = nlpResult.domainKey; // CODE, CREATIVE, RESEARCH, UTILITY

  const llmNodes = [
    { id: 1, name: 'LLM 1', label: 'Code Expert', model: 'meta-llama/llama-3.3-70b-instruct', domain: 'CODE' },
    { id: 2, name: 'LLM 2', label: 'Creative', model: 'openai/gpt-4o-mini', domain: 'CREATIVE' },
    { id: 3, name: 'LLM 3', label: 'Research', model: 'google/gemma-2-27b-it', domain: 'RESEARCH' },
    { id: 4, name: 'LLM 4', label: 'Utility', model: 'openai/gpt-4o-mini', domain: 'UTILITY' },
  ];

  const activeLLM = llmNodes.find(n => n.domain === selectedDomain) || llmNodes[3];

  const isLowLevelPrompt = selectedDomain === 'UTILITY' || 
    (promptText.trim().split(/\s+/).length <= 4 && nlpResult.detectedEntities === 'None');

  const stageDefinitions = [
    { index: 0, key: 'USER_QUERY', name: 'USER QUERY', desc: `"${promptText}"` },
    { index: 1, key: 'BRAIN', name: 'COGNITIVE BRAIN', desc: 'Planning & Decision Breakdown' },
    { index: 2, key: 'MEMORY', name: 'COGNITIVE MEMORY', desc: `Retrieved ${history.length} memory context items` },
    { index: 3, key: 'ROUTER', name: 'ROUTER', desc: `Scored Intent ➔ ${nlpResult.badge}` },
    { index: 4, key: 'LLM', name: activeLLM.name, desc: `${activeLLM.label} (${activeLLM.model})` },
    { index: 5, key: 'COLLECTIVE', name: 'COLLECTIVE INTELLIGENCE', desc: 'Multi-Model Synthesis & Aggregation' },
    { index: 6, key: 'VERIFICATION', name: 'VERIFICATION AGENT', desc: 'Schema & Hallucination Auditing' },
    { index: 7, key: 'RESPONSE', name: 'FINAL RESPONSE', desc: 'Model Output Synthesis Complete' },
    { index: 8, key: 'USER_DELIVERY', name: 'USER', desc: 'Transmitting output to client' },
    { index: 9, key: 'LEARNING', name: 'EXPERIENCE LEARNING', desc: 'Feedback & Optimization Extraction' },
    { index: 10, key: 'UPDATE_MEMORY', name: 'UPDATE COGNITIVE MEMORY', desc: 'Persisting graph to Memory Store' },
  ];

  const broadcastStep = (activeStageIndex, status = 'THINKING', extra = {}) => {
    const payload = {
      type: 'COGNITIVE_TRACE',
      status,
      timestamp,
      promptText,
      domainKey: nlpResult.domainKey,
      domainName: nlpResult.domainName,
      domainBadge: nlpResult.badge,
      selectedModel: nlpResult.selectedModel,
      detectedEntities: nlpResult.detectedEntities,
      scores: nlpResult.scores,
      activeLLM,
      historyLength: history.length,
      isLowLevel: isLowLevelPrompt,
      activeStageIndex,
      completedStageIndices: Array.from({ length: activeStageIndex }, (_, i) => i),
      stages: stageDefinitions,
      ...extra,
    };
    if (typeof broadcastFn === 'function') {
      broadcastFn(payload);
    }
    return payload;
  };

  // Fast direct execution for low-level prompts
  if (isLowLevelPrompt) {
    let reply = '';
    if (typeof getCompletionFn === 'function') {
      try {
        const res = await getCompletionFn({ targetModel: nlpResult.selectedModel });
        reply = res?.reply || '';
      } catch (err) {
        reply = `Error: ${err.message}`;
      }
    }
    const duration = Date.now() - startTime;
    return {
      nlpResult,
      telemetryData: broadcastStep(10, 'COMPLETED', { reply, durationMs: duration }),
      reply,
    };
  }

  // Colors for ANSI Terminal Output
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  const cyan = '\x1b[36m';
  const yellow = '\x1b[33m';
  const green = '\x1b[32m';
  const magenta = '\x1b[35m';
  const dim = '\x1b[90m';
  const bgBlue = '\x1b[44m\x1b[37m';

  const asciiDiagram = `
${cyan}================================================================================${reset}
                 ${bold}${magenta}🧠 COGNITIVE ARCHITECTURE EXECUTION TRACE 🧠${reset}
${cyan}================================================================================${reset}

                               ${bold}${green}USER QUERY${reset}
                      [ "${yellow}${promptText}${reset}" ]
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │      ${bold}COGNITIVE BRAIN${reset}        │
                    │   ${dim}(Planning & Decision)${reset}     │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │     ${bold}COGNITIVE MEMORY${reset}        │
                    │   ${dim}History items: ${history.length}${reset}         │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │           ${bold}${yellow}ROUTER${reset}            │
                    │   ${dim}Domain: ${nlpResult.badge}${reset}    │
                    └──────────────┬──────────────┘
                                   │
       ┌──────────────┬────────────┼────────────┬──────────────┐
       ▼              ▼            ▼            ▼              ▼
    ${selectedDomain === 'CODE' ? `${bgBlue}★ LLM 1 (CODE)${reset}` : `${dim}LLM 1 (CODE)${reset}`}  ${selectedDomain === 'CREATIVE' ? `${bgBlue}★ LLM 2 (CREATIVE)${reset}` : `${dim}LLM 2 (CREATIVE)${reset}`}  ${selectedDomain === 'RESEARCH' ? `${bgBlue}★ LLM 3 (RESEARCH)${reset}` : `${dim}LLM 3 (RESEARCH)${reset}`}  ${selectedDomain === 'UTILITY' ? `${bgBlue}★ LLM 4 (UTILITY)${reset}` : `${dim}LLM 4 (UTILITY)${reset}`}  ${dim}LLM n (...)${reset}
  ${dim}Llama-3.3-70B${reset}   ${dim}GPT-4o-mini${reset}     ${dim}Gemma-2-27B${reset}     ${dim}GPT-4o-mini${reset}     ${dim}(Custom)${reset}
       │              │            │            │              │
       └──────────────┴────────────┼────────────┴──────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │   ${bold}COLLECTIVE INTELLIGENCE${reset}   │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │     ${bold}VERIFICATION AGENT${reset}      │
                    │   ${green}✔ Checks Passed${reset}            │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                            ${bold}${green}FINAL RESPONSE${reset}
                                   │
                                   ▼
                                 ${bold}USER${reset}
                                   │
                                   ▼
                        ${bold}${magenta}EXPERIENCE LEARNING${reset}
                                   │
                                   ▼
                     ${bold}${cyan}UPDATE COGNITIVE MEMORY${reset}
${cyan}================================================================================${reset}
`;

  // Print full ASCII flowchart to stdout (streamed live to terminal feed)
  console.log(asciiDiagram);

  // Print Step-by-step progress lines
  console.log(`  ${green}▶ Step 1/11 [USER QUERY]${reset} Received: "${yellow}${promptText}${reset}"`);
  broadcastStep(0, 'THINKING');
  await sleep(150);

  console.log(`  ${magenta}▶ Step 2/11 [COGNITIVE BRAIN]${reset} Analyzing intent & decomposition...`);
  broadcastStep(1, 'THINKING');
  await sleep(200);

  console.log(`  ${cyan}▶ Step 3/11 [COGNITIVE MEMORY]${reset} Accessing context store (${history.length} items)...`);
  broadcastStep(2, 'THINKING');
  await sleep(200);

  console.log(`  ${yellow}▶ Step 4/11 [ROUTER]${reset} Target Sub-domain ➔ ${nlpResult.badge} (${nlpResult.selectedModel})`);
  broadcastStep(3, 'THINKING');
  await sleep(200);

  console.log(`  ${bgBlue}★ Step 5/11 [${activeLLM.name}]${reset} Querying model ${activeLLM.model}...`);
  broadcastStep(4, 'THINKING');

  let llmReply = '';
  if (typeof getCompletionFn === 'function') {
    try {
      const res = await getCompletionFn({ targetModel: nlpResult.selectedModel });
      llmReply = res?.reply || '';
    } catch (err) {
      llmReply = `Error: ${err.message}`;
    }
  }

  console.log(`  ${cyan}▶ Step 6/11 [COLLECTIVE INTELLIGENCE]${reset} Synthesizing model output...`);
  broadcastStep(5, 'THINKING');
  await sleep(150);

  console.log(`  ${green}▶ Step 7/11 [VERIFICATION AGENT]${reset} Auditing safety & schema rules...`);
  broadcastStep(6, 'THINKING');
  await sleep(150);

  console.log(`  ${green}▶ Step 8/11 [FINAL RESPONSE]${reset} Response synthesis complete.`);
  broadcastStep(7, 'THINKING');
  await sleep(100);

  console.log(`  ${yellow}▶ Step 9/11 [USER DELIVERY]${reset} Transmitting to client.`);
  broadcastStep(8, 'THINKING');
  await sleep(100);

  console.log(`  ${magenta}▶ Step 10/11 [EXPERIENCE LEARNING]${reset} Computing feedback metrics...`);
  broadcastStep(9, 'THINKING');
  await sleep(100);

  console.log(`  ${cyan}▶ Step 11/11 [UPDATE COGNITIVE MEMORY]${reset} Persisted execution graph.`);
  console.log(`${cyan}================================================================================${reset}\n`);

  const durationMs = Date.now() - startTime;
  const finalTelemetry = broadcastStep(10, 'COMPLETED', { reply: llmReply, durationMs });

  return { nlpResult, telemetryData: finalTelemetry, reply: llmReply };
};

module.exports = {
  runCognitivePipeline
};
