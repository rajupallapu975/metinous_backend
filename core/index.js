const { InputAnalyzer, inputAnalyzer } = require('./analyzer');
const { CognitiveRouter, cognitiveRouter } = require('./router');
const { EvidenceBuilder, evidenceBuilder } = require('./evidence_builder');
const { ResponseGenerator, responseGenerator } = require('./response_generator');
const { Orchestrator, orchestrator, processQuery } = require('./orchestrator');
const { METINOUS_SYSTEM_PROMPT, WEB_SYNTHESIS_PROMPT } = require('./prompts');

module.exports = {
  InputAnalyzer,
  inputAnalyzer,
  CognitiveRouter,
  cognitiveRouter,
  EvidenceBuilder,
  evidenceBuilder,
  ResponseGenerator,
  responseGenerator,
  Orchestrator,
  orchestrator,
  processQuery,
  METINOUS_SYSTEM_PROMPT,
  WEB_SYNTHESIS_PROMPT,
};
