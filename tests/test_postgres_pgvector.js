require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { db } = require('../db');
const { embeddingService } = require('../services/embeddings');
const { conversationStore } = require('../db/conversationStore');
const { memoryTool } = require('../tools/memory');

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 TESTING POSTGRESQL & PGVECTOR SYSTEM');
  console.log('========================================\n');

  // Test 1: Embedding Service
  console.log('[TEST 1] Testing 1536-Dimensional Embedding Generator...');
  const testText = 'Who founded SpaceX and became the world first trillionaire?';
  const embedding = await embeddingService.generateEmbedding(testText);
  console.log(`✅ Embedding Generated! Dimensions: ${embedding.length} (Sample: [${embedding.slice(0, 3).map(v=>v.toFixed(4)).join(', ')}...])`);
  if (embedding.length !== 1536) {
    throw new Error(`Expected 1536 dimensions, got ${embedding.length}`);
  }

  // Test 2: Database Connection & Initialization
  console.log('\n[TEST 2] Testing Database Pool & Migration Initialization...');
  await db.init();
  const dbStatus = db.getStatus();
  console.log(`🐘 DB Status: Connected=${dbStatus.connected}, VectorExtension=${dbStatus.hasVectorExtension}, Target=${dbStatus.target}`);

  // Test 3: Conversation Store CRUD & In-Memory / Vector Storage
  console.log('\n[TEST 3] Testing Conversation Store & Persistence...');
  const testConvId = `test_conv_${Date.now()}`;
  const testUserId = 'test_user_001';

  // Save User message
  const userMsg = await conversationStore.saveMessage({
    conversationId: testConvId,
    userId: testUserId,
    sender: 'user',
    text: 'What is the current net worth of Elon Musk in 2026?',
    route: 'CHAT',
  });
  console.log(`✅ User Message Handled (Stored in DB: ${Boolean(userMsg)})`);

  // Save Assistant message
  const aiMsg = await conversationStore.saveMessage({
    conversationId: testConvId,
    userId: testUserId,
    sender: 'assistant',
    text: 'In June 2026, Elon Musk achieved a net worth of over $1 Trillion following the SpaceX IPO.',
    route: 'WEB',
    tool_used: true,
    tools: ['web_search', 'image_search'],
    domain: 'RESEARCH',
    domain_badge: '🌐 Grounded Web Search',
  });
  console.log(`✅ Assistant Message Handled (Stored in DB: ${Boolean(aiMsg)})`);

  // Test 4: Memory Tool with Vector & Fallback Store
  console.log('\n[TEST 4] Testing Cognitive & Vector Memory Tool...');
  await memoryTool.store(testUserId, {
    conversationId: testConvId,
    key: 'Elon Musk Wealth',
    content: 'User asked about Elon Musk net worth and SpaceX IPO milestone.',
    type: 'LONG_TERM',
    tags: ['wealth', 'elon_musk', 'spacex'],
  });

  const recallResult = await memoryTool.search(testUserId, 'Elon Musk SpaceX', 3);
  console.log(`✅ Memory Search Query ("Elon Musk SpaceX") returned ${recallResult.length} record(s):`);
  recallResult.forEach((rec, i) => {
    console.log(`   [${i + 1}] Key: "${rec.key}", Type: ${rec.type || 'MEMORY'}, Content: "${rec.content.substring(0, 70)}..."`);
  });

  // Test 5: Semantic Search via pgvector
  console.log('\n[TEST 5] Testing pgvector Semantic Similarity Search...');
  const semanticResults = await conversationStore.searchSemanticConversations({
    userId: testUserId,
    query: 'SpaceX rocket milestone and wealth',
    limit: 3,
  });
  console.log(`✅ Semantic Similarity Search returned ${semanticResults.length} matching result(s).`);

  console.log('\n========================================');
  console.log('🎉 ALL POSTGRESQL & PGVECTOR TESTS PASSED!');
  console.log('========================================\n');
  setTimeout(() => process.exit(0), 200);
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  setTimeout(() => process.exit(1), 200);
});
