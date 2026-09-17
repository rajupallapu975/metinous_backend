/**
 * Metinous AI — Comprehensive End-to-End Test Matrix
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const { timeTool } = require('../tools/time_tool');
const { calculatorTool } = require('../tools/calculator_tool');
const { webSearchTool } = require('../tools/web_search');
const { webFetchTool } = require('../tools/web_fetch');
const { memoryTool } = require('../tools/memory');
const { cognitiveRouter } = require('../core/router');
const { orchestrator } = require('../core/orchestrator');

const runTests = async () => {
  console.log('🧪 ================================================================');
  console.log('🧪 METINOUS AI — SYSTEM VALIDATION TEST SUITE');
  console.log('🧪 ================================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      process.stdout.write(`⏳ [TEST] ${name} ... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      failed++;
    }
  };

  // -------------------------------------------------------------
  // UNIT TESTS: TIME TOOL (Subtask 2)
  // -------------------------------------------------------------
  await test('TimeTool returns IST timezone and formatted answer without LLM', async () => {
    const res = await timeTool.execute({ timezone: 'Asia/Kolkata' });
    assert.strictEqual(res.success, true);
    assert.ok(res.data.time, 'Should contain time');
    assert.ok(res.data.date, 'Should contain date');
    assert.ok(res.data.formattedAnswer.includes('IST'), 'Should include IST');
  });

  // -------------------------------------------------------------
  // UNIT TESTS: CALCULATOR TOOL (Subtask 2)
  // -------------------------------------------------------------
  await test('CalculatorTool: 92837 * 782 = 72598534', async () => {
    const res = await calculatorTool.execute({ expression: '92837 * 782' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.result, 72598534);
  });

  await test('CalculatorTool: 100 / 4 = 25', async () => {
    const res = await calculatorTool.execute({ expression: '100 / 4' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.result, 25);
  });

  await test('CalculatorTool: (20 + 5) * 3 = 75', async () => {
    const res = await calculatorTool.execute({ expression: '(20 + 5) * 3' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.result, 75);
  });

  await test('CalculatorTool: -10 + 5 = -5', async () => {
    const res = await calculatorTool.execute({ expression: '-10 + 5' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.result, -5);
  });

  await test('CalculatorTool: Invalid syntax handled safely without crash', async () => {
    const res = await calculatorTool.execute({ expression: '5 ++* 3' });
    assert.strictEqual(res.success, false);
    assert.ok(res.data.error, 'Should contain error explanation');
  });

  // -------------------------------------------------------------
  // UNIT TESTS: ROUTER CATEGORIZATION (Subtask 1)
  // -------------------------------------------------------------
  await test('CognitiveRouter: "What is Python?" ➔ CHAT', () => {
    const route = cognitiveRouter.route('What is Python?');
    assert.strictEqual(route.category, 'CHAT');
    assert.strictEqual(route.toolNeeded, null);
  });

  await test('CognitiveRouter: "Explain recursion in Python" ➔ CHAT', () => {
    const route = cognitiveRouter.route('Explain recursion in Python');
    assert.strictEqual(route.category, 'CHAT');
    assert.strictEqual(route.toolNeeded, null);
  });

  await test('CognitiveRouter: "What time is it?" ➔ TIME', () => {
    const route = cognitiveRouter.route('What time is it?');
    assert.strictEqual(route.category, 'TIME');
    assert.strictEqual(route.toolNeeded, 'time');
  });

  await test('CognitiveRouter: "92837 * 782" ➔ CALCULATOR', () => {
    const route = cognitiveRouter.route('92837 * 782');
    assert.strictEqual(route.category, 'CALCULATOR');
    assert.strictEqual(route.toolNeeded, 'calculator');
  });

  await test('CognitiveRouter: "Who is Nikhil Kamath?" ➔ WEB', () => {
    const route = cognitiveRouter.route('Who is Nikhil Kamath?');
    assert.strictEqual(route.category, 'WEB');
    assert.strictEqual(route.toolNeeded, 'web_search');
  });

  await test('CognitiveRouter: "What is Elon Musk\'s current net worth?" ➔ WEB', () => {
    const route = cognitiveRouter.route("What is Elon Musk's current net worth?");
    assert.strictEqual(route.category, 'WEB');
    assert.strictEqual(route.toolNeeded, 'web_search');
  });

  await test('CognitiveRouter: "What did I tell you about Metinous AI?" ➔ MEMORY', () => {
    const route = cognitiveRouter.route('What did I tell you about Metinous AI?');
    assert.strictEqual(route.category, 'MEMORY');
    assert.strictEqual(route.toolNeeded, 'memory');
  });

  await test('CognitiveRouter: "Summarize https://example.com" ➔ WEB_FETCH', () => {
    const route = cognitiveRouter.route('Summarize https://example.com');
    assert.strictEqual(route.category, 'WEB_FETCH');
    assert.strictEqual(route.toolNeeded, 'web_fetch');
  });

  // -------------------------------------------------------------
  // UNIT TESTS: WEB FETCH & SSRF PROTECTION (Subtask 3)
  // -------------------------------------------------------------
  await test('WebFetchTool: SSRF Blocks 127.0.0.1 and private IPs', async () => {
    const res = await webFetchTool.fetchPage('http://127.0.0.1:8080/secret');
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('forbidden') || res.error.includes('local'), 'Should reject loopback/private IP');
  });

  await test('WebFetchTool: Fetches public webpage cleanly', async () => {
    const res = await webFetchTool.fetchPage('https://example.com');
    assert.strictEqual(res.success, true);
    assert.ok(res.title.includes('Example Domain'), 'Should parse title');
    assert.ok(res.content.length > 0, 'Should extract text content');
  });

  // -------------------------------------------------------------
  // UNIT TESTS: FREE WEB SEARCH (Subtask 3)
  // -------------------------------------------------------------
  await test('WebSearchTool: Searches query without paid APIs', async () => {
    const res = await webSearchTool.search('Nikhil Kamath', 3);
    assert.strictEqual(res.success, true);
    assert.ok(res.results.length > 0, 'Should return search results');
    assert.ok(res.results[0].title, 'First result has title');
    assert.ok(res.results[0].url, 'First result has url');
  });

  // -------------------------------------------------------------
  // INTEGRATION TESTS: ORCHESTRATOR FULL FLOW
  // -------------------------------------------------------------
  await test('Orchestrator: TIME query resolves locally without LLM', async () => {
    const resp = await orchestrator.processQuery({ query: 'What is the current time?' });
    assert.strictEqual(resp.route, 'TIME');
    assert.strictEqual(resp.tool_used, true);
    assert.ok(resp.answer.includes('IST'));
  });

  await test('Orchestrator: CALCULATOR query calculates locally without LLM', async () => {
    const resp = await orchestrator.processQuery({ query: '92837 * 782' });
    assert.strictEqual(resp.route, 'CALCULATOR');
    assert.strictEqual(resp.tool_used, true);
    assert.ok(resp.answer.includes('72,598,534') || resp.answer.includes('72598534'));
  });

  await test('Orchestrator: WEB query retrieves live evidence and ground answers with sources', async () => {
    const resp = await orchestrator.processQuery({ query: 'Who is Nikhil Kamath?' });
    assert.strictEqual(resp.route, 'WEB');
    assert.strictEqual(resp.tool_used, true);
    assert.ok(resp.sources.length > 0, 'Must include verifiable sources');
    assert.ok(resp.answer.length > 20, 'Should generate synthesized answer');
  });

  await test('Orchestrator: CHAT query generates educational response via LLM', async () => {
    const resp = await orchestrator.processQuery({ query: 'What is Python in one sentence?' });
    assert.strictEqual(resp.route, 'CHAT');
    assert.strictEqual(resp.tool_used, false);
    assert.strictEqual(resp.sources.length, 0);
    assert.ok(resp.answer.toLowerCase().includes('python'));
  });

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
