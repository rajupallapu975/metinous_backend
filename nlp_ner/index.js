const { extractEntities } = require('./entityExtractor');
const { classifyDomain } = require('./domainClassifier');
const { orchestrateModel } = require('./modelOrchestrator');

const processPrompt = (promptText = '') => {
  // 1. Extract Named Entities (NER)
  const entities = extractEntities(promptText);

  // 2. Classify Domain Intent (NLP)
  const { domainKey, scores } = classifyDomain(promptText, entities);

  // 3. Orchestrate Expert Model & System Prompt
  const orchestration = orchestrateModel(domainKey);

  // Build detected entities summary string for terminal logging
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

const { runCognitivePipeline } = require('./cognitiveArchitecture');

module.exports = {
  processPrompt,
  extractEntities,
  classifyDomain,
  orchestrateModel,
  runCognitivePipeline,
};
