const runtimeConfig = require("../config/runtimeConfig");

const assistantInstruction =
  "You are a concise, helpful AI chat assistant. Reply in the same language as the user by default.";

function hasDeepSeekCredentials() {
  return runtimeConfig.deepSeekApiKey.trim().length > 0;
}

function buildFallbackReply(chatMessages) {
  const latestUserMessage = [...chatMessages].reverse().find((message) => message.role === "user");
  const currentTopic = latestUserMessage ? latestUserMessage.content : "这个问题";

  return [
    "当前服务端尚未配置 DeepSeek API Key，因此先返回本地占位回复。",
    `你刚刚提到：“${currentTopic}”`,
    "在服务端 .env 中填入 DEEPSEEK_API_KEY 后，该接口会自动切换为真实模型回复。",
  ].join("\n\n");
}

async function requestDeepSeekReply(chatMessages) {
  if (!hasDeepSeekCredentials()) {
    return {
      reply: buildFallbackReply(chatMessages),
      isFallback: true,
    };
  }

  const deepSeekResponse = await fetch(`${runtimeConfig.deepSeekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtimeConfig.deepSeekApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: runtimeConfig.deepSeekModel,
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
        : "DeepSeek API 请求失败。";
    const error = new Error(errorMessage);
    error.status = deepSeekResponse.status;
    throw error;
  }

  const reply = responseBody.choices?.[0]?.message?.content;

  return {
    reply: reply || "模型没有返回文本内容，请稍后再试。",
    isFallback: false,
  };
}

module.exports = {
  buildFallbackReply,
  requestDeepSeekReply,
};
