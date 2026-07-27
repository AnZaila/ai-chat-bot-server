const runtimeConfig = require("../config/runtimeConfig");

const assistantInstruction =
  "You are a concise, helpful AI chat assistant. Reply in the same language as the user by default.";

async function requestDeepSeekReply(chatMessages, modelName) {
  const deepSeekResponse = await fetch(`${runtimeConfig.deepSeekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtimeConfig.deepSeekApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName || runtimeConfig.deepSeekModel,
      messages: [
        {
          role: "system",
          content: assistantInstruction,
        },
        ...chatMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      thinking: {
        type: "disabled",
      },
    }),
  });

  const responseBody = await deepSeekResponse.json();

  if (!deepSeekResponse.ok) {
    const errorMessage =
      responseBody.error && responseBody.error.message
        ? responseBody.error.message
        : "DeepSeek API request failed.";
    const error = new Error(errorMessage);
    error.status = deepSeekResponse.status;
    throw error;
  }

  const reply = responseBody.choices?.[0]?.message?.content;

  return {
    reply: reply || "The model did not return text. Please try again later.",
  };
}

module.exports = {
  requestDeepSeekReply,
};
