const getOpenRouterCompletion = async ({ message, history = [], systemPrompt = "You are a helpful AI assistant.", targetModel = null }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = targetModel || process.env.DEFAULT_MODEL || "openai/gpt-4o-mini";

  if (!apiKey || apiKey === "your_openrouter_api_key_here") {
    const error = new Error("OPENROUTER_API_KEY is not configured in server .env file.");
    error.statusCode = 401;
    throw error;
  }

  const messages = [
    {
      role: "system",
      content: systemPrompt
    },
    ...history,
    {
      role: "user",
      content: message
    }
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://flutter-chatbot-app",
      "X-Title": "Flutter Chatbot App"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    const error = new Error(`OpenRouter API Error (${response.status}): ${errText}`);
    error.statusCode = response.status;
    throw error;
  }

  const data = await response.json();
  const choices = data?.choices;
  if (!choices || choices.length === 0) {
    throw new Error("Empty response received from OpenRouter API.");
  }

  const reply = choices[0]?.message?.content || "";
  return { reply, modelUsed: model };
};

module.exports = {
  getOpenRouterCompletion
};
