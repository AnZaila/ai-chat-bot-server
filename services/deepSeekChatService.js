const runtimeConfig = require("../config/runtimeConfig");
const { createHttpError } = require("../utils/httpError");

const assistantInstruction =
  "You are a concise, helpful AI chat assistant. Reply in the same language as the user by default.";

async function readJsonResponse(response) {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText);
  } catch (error) {
    return {
      raw: responseText,
    };
  }
}

function createRequestBody(chatMessages, modelName) {
  return {
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
  };
}

async function requestDeepSeekReply(chatMessages, modelName) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, runtimeConfig.deepSeekRequestTimeoutMs);

  try {
    const deepSeekResponse = await fetch(`${runtimeConfig.deepSeekBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtimeConfig.deepSeekApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createRequestBody(chatMessages, modelName)),
      signal: abortController.signal,
    });

    const responseBody = await readJsonResponse(deepSeekResponse);

    if (!deepSeekResponse.ok) {
      const upstreamMessage =
        responseBody.error && responseBody.error.message
          ? responseBody.error.message
          : "DeepSeek API request failed.";

      throw createHttpError(
        deepSeekResponse.status >= 500 ? 502 : deepSeekResponse.status,
        upstreamMessage,
        "DEEPSEEK_REQUEST_FAILED",
      );
    }

    const reply = responseBody.choices?.[0]?.message?.content;

    if (!reply) {
      throw createHttpError(
        502,
        "The model did not return text. Please try again later.",
        "DEEPSEEK_EMPTY_REPLY",
      );
    }

    return {
      reply,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw createHttpError(504, "The AI service timed out. Please try again.", "DEEPSEEK_TIMEOUT");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  requestDeepSeekReply,
};
