const { getActiveLLMProvider } = require('../llm');

const getOpenRouterCompletion = async ({ message, history = [], systemPrompt = "You are a helpful AI assistant.", targetModel = null }) => {
  const provider = getActiveLLMProvider();
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role || 'user', content: h.content || '' })),
    { role: 'user', content: message }
  ];

  const result = await provider.generateCompletion({
    prompt: message,
    messages: formattedMessages,
    systemPrompt,
    targetModel,
  });

  return {
    reply: result.reply,
    modelUsed: result.modelUsed,
  };
};

module.exports = {
  getOpenRouterCompletion
};
