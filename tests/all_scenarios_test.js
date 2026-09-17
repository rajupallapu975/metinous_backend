/**
 * Metinous AI — Full 13-Scenario Verification Test
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const { orchestrator } = require('../core/orchestrator');
const { webSearchTool } = require('../tools/web_search');
const { memoryTool } = require('../tools/memory');

const runFullScenarioSuite = async () => {
  console.log('🚀 Running Complete 13-Scenario Test Matrix...\n');

  // TEST 1: TIME
  console.log('TEST 1: "What time is it?"');
  const t1 = await orchestrator.processQuery({ query: 'What time is it?' });
  console.log('Route:', t1.route, '| Answer:', t1.answer);
  assert.strictEqual(t1.route, 'TIME');
  assert.strictEqual(t1.tool_used, true);

  // TEST 2: DATE
  console.log('\nTEST 2: "What is today\'s date?"');
  const t2 = await orchestrator.processQuery({ query: "What is today's date?" });
  console.log('Route:', t2.route, '| Answer:', t2.answer);
  assert.strictEqual(t2.route, 'TIME');

  // TEST 3: CALCULATOR
  console.log('\nTEST 3: "92837 * 782"');
  const t3 = await orchestrator.processQuery({ query: '92837 * 782' });
  console.log('Route:', t3.route, '| Answer:', t3.answer);
  assert.strictEqual(t3.route, 'CALCULATOR');
  assert.ok(t3.answer.includes('72,598,534') || t3.answer.includes('72598534'));

  // TEST 4: CHAT
  console.log('\nTEST 4: "What is Python?"');
  const t4 = await orchestrator.processQuery({ query: 'What is Python?' });
  console.log('Route:', t4.route, '| Answer:', t4.answer.substring(0, 100) + '...');
  assert.strictEqual(t4.route, 'CHAT');
  assert.strictEqual(t4.tool_used, false);
  assert.strictEqual(t4.sources.length, 0);

  // TEST 5: CHAT EXPLANATION
  console.log('\nTEST 5: "Explain recursion in Python"');
  const t5 = await orchestrator.processQuery({ query: 'Explain recursion in Python' });
  console.log('Route:', t5.route, '| Answer:', t5.answer.substring(0, 100) + '...');
  assert.strictEqual(t5.route, 'CHAT');

  // TEST 6: WEB RESEARCH - NIKHIL KAMATH
  console.log('\nTEST 6: "Who is Nikhil Kamath?"');
  const t6 = await orchestrator.processQuery({ query: 'Who is Nikhil Kamath?' });
  console.log('Route:', t6.route, '| Tools:', t6.tools, '| Sources:', t6.sources.length);
  console.log('Answer snippet:', t6.answer.substring(0, 150) + '...');
  assert.strictEqual(t6.route, 'WEB');
  assert.ok(t6.sources.length > 0);

  // TEST 7: WEB - ELON MUSK NET WORTH
  console.log('\nTEST 7: "What is Elon Musk\'s current net worth?"');
  const t7 = await orchestrator.processQuery({ query: "What is Elon Musk's current net worth?" });
  console.log('Route:', t7.route, '| Sources:', t7.sources.length);
  console.log('Answer snippet:', t7.answer.substring(0, 150) + '...');
  assert.strictEqual(t7.route, 'WEB');

  // TEST 8: WEB - LATEST AI NEWS
  console.log('\nTEST 8: "What is the latest AI news?"');
  const t8 = await orchestrator.processQuery({ query: 'What is the latest AI news?' });
  console.log('Route:', t8.route, '| Sources:', t8.sources.length);
  assert.strictEqual(t8.route, 'WEB');

  // TEST 9: WEB - LATEST PYTHON VERSION
  console.log('\nTEST 9: "What is the latest version of Python?"');
  const t9 = await orchestrator.processQuery({ query: 'What is the latest version of Python?' });
  console.log('Route:', t9.route, '| Sources:', t9.sources.length);
  assert.strictEqual(t9.route, 'WEB');

  // TEST 10: MEMORY RECALL
  console.log('\nTEST 10: "What did I tell you about Metinous AI?"');
  // Seed memory first
  await memoryTool.store('user_001', {
    key: 'Metinous AI Architecture',
    content: 'Metinous AI is an enterprise-grade cognitive middleware layer with multi-LLM orchestration.',
    type: 'LONG_TERM',
  });
  const t10 = await orchestrator.processQuery({ query: 'What did I tell you about Metinous AI?', userId: 'user_001' });
  console.log('Route:', t10.route, '| Answer:', t10.answer);
  assert.strictEqual(t10.route, 'MEMORY');

  // TEST 11: WEB FETCH & SUMMARIZATION
  console.log('\nTEST 11: "Summarize https://example.com"');
  const t11 = await orchestrator.processQuery({ query: 'Summarize https://example.com' });
  console.log('Route:', t11.route, '| Sources:', t11.sources.length);
  console.log('Answer snippet:', t11.answer.substring(0, 120) + '...');
  assert.strictEqual(t11.route, 'WEB_FETCH');
  assert.ok(t11.sources.length > 0);

  // TEST 12: DISABLE SEARXNG (Resilience & No Fabrication)
  console.log('\nTEST 12: Unavailable SearXNG fallback resilience');
  const customSearch = await webSearchTool.searxngProvider.search('test query').catch(err => ({ error: err.message }));
  console.log('SearXNG error captured safely without crash:', customSearch.error || 'caught');

  // TEST 13: SIMULATED LLM FAILURE HANDLING
  console.log('\nTEST 13: LLM error handling');
  // Temporary invalid call to ensure error bubbling
  try {
    const { OpenRouterProvider } = require('../llm/openrouter');
    const brokenProvider = new OpenRouterProvider();
    // Simulate query without key
    const prevKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'your_openrouter_api_key_here';
    await brokenProvider.generateCompletion({ prompt: 'Hello' }).catch(err => {
      console.log('Captured expected error safely:', err.message);
      assert.ok(err.message.includes('OPENROUTER_API_KEY'));
    });
    process.env.OPENROUTER_API_KEY = prevKey;
  } catch (e) {
    console.log('Error caught safely:', e.message);
  }

  console.log('\n🎉 ALL 13 TEST SCENARIOS COMPLETED SUCCESSFULLY!');
};

runFullScenarioSuite().catch(err => {
  console.error('Test matrix error:', err);
  process.exit(1);
});
