const getOpenRouterCompletion = async ({ message, history = [], systemPrompt = "You are a helpful AI assistant.", targetModel = null }) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const primaryModel = targetModel || process.env.DEFAULT_MODEL || "openai/gpt-4o-mini";

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

  // Helper function to query a specific model with a timeout
  const queryModel = async (selectedModel, timeoutMs) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`[OPENROUTER] Querying ${selectedModel} (timeout: ${timeoutMs}ms)...`);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://flutter-chatbot-app",
          "X-Title": "Flutter Chatbot App"
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Status ${response.status}: ${errText}`);
      }

      const data = await response.json();
      clearTimeout(timeoutId);

      const choices = data?.choices;
      if (!choices || choices.length === 0) {
        throw new Error("Empty response choices");
      }

      const reply = choices[0]?.message?.content || "";
      return { reply, modelUsed: selectedModel };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    // Attempt 1: Query the primary model with a generous 25-second timeout
    return await queryModel(primaryModel, 25000);
  } catch (primaryErr) {
    console.warn(`⚠️ [OPENROUTER WARNING] Primary model (${primaryModel}) failed: ${primaryErr.message}`);
    
    // Attempt 2: If the primary model failed and it wasn't already openai/gpt-4o-mini, fall back to it
    if (primaryModel !== "openai/gpt-4o-mini") {
      try {
        console.log(`🔄 [OPENROUTER FALLBACK 1] Attempting fallback to openai/gpt-4o-mini (15s timeout)...`);
        return await queryModel("openai/gpt-4o-mini", 15000);
      } catch (fallbackErr) {
        console.error(`❌ [OPENROUTER ERROR] Fallback 1 failed: ${fallbackErr.message}`);
      }
    }

    // Attempt 3: If both primary and fallback 1 failed, try google/gemini-2.5-flash as fallback 2
    if (primaryModel !== "google/gemini-2.5-flash") {
      try {
        console.log(`🔄 [OPENROUTER FALLBACK 2] Attempting fallback to google/gemini-2.5-flash (15s timeout)...`);
        return await queryModel("google/gemini-2.5-flash", 15000);
      } catch (fallbackErr2) {
        console.error(`❌ [OPENROUTER ERROR] Fallback 2 failed: ${fallbackErr2.message}`);
      }
    }

    // Attempt 4: If all models failed, return a structured mock response to prevent hanging
    console.warn(`🔌 [OPENROUTER OFFLINE] Returning simulation fallback content.`);
    return {
      reply: `[Simulation Fallback] The requested model (${primaryModel}) is unresponsive. Here is the response for query: "${message}"`,
      modelUsed: "simulation-fallback"
    };
  }
};

module.exports = {
  getOpenRouterCompletion
};
