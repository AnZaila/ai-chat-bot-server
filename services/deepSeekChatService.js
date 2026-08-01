const runtimeConfig = require("../config/runtimeConfig");
const { createHttpError } = require("../utils/httpError");

const assistantInstruction =
  "You are a concise, helpful AI chat assistant. Reply in the same language as the user by default.";

function createRequestBody(chatMessages, modelName, stream = false) {
  return {
    model: modelName || runtimeConfig.deepSeekModel,
    messages: [
      { role: "system", content: assistantInstruction },
      ...chatMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
    stream,
    thinking: { type: "disabled" },
  };
}

async function requestDeepSeekReply(chatMessages, modelName) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), runtimeConfig.deepSeekRequestTimeoutMs);

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

    if (!deepSeekResponse.ok) {
      const errorBody = await deepSeekResponse.text().catch(() => "");
      let errorMsg = "DeepSeek API request failed.";
      try {
        const parsed = JSON.parse(errorBody);
        errorMsg = parsed.error?.message || errorMsg;
      } catch { /* ignore parse errors */ }
      throw createHttpError(
        deepSeekResponse.status >= 500 ? 502 : deepSeekResponse.status,
        errorMsg,
        "DEEPSEEK_REQUEST_FAILED",
      );
    }

    const body = await deepSeekResponse.json();
    const reply = body.choices?.[0]?.message?.content;
    if (!reply) {
      throw createHttpError(502, "The model did not return text.", "DEEPSEEK_EMPTY_REPLY");
    }
    return { reply };
  } catch (error) {
    if (error.name === "AbortError") {
      throw createHttpError(504, "The AI service timed out.", "DEEPSEEK_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 发起流式请求，返回 fetch Response 供调用方通过 body.getReader() 读取 SSE 流。
 */
async function streamDeepSeekReply(chatMessages, modelName) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), runtimeConfig.deepSeekRequestTimeoutMs);

  try {
    const deepSeekResponse = await fetch(`${runtimeConfig.deepSeekBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtimeConfig.deepSeekApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createRequestBody(chatMessages, modelName, true)),
      signal: abortController.signal,
    });

    if (!deepSeekResponse.ok) {
      const errorBody = await deepSeekResponse.text().catch(() => "");
      let errorMsg = "DeepSeek API request failed.";
      try { errorMsg = JSON.parse(errorBody).error?.message || errorMsg; } catch { /* */ }
      throw createHttpError(
        deepSeekResponse.status >= 500 ? 502 : deepSeekResponse.status,
        errorMsg,
        "DEEPSEEK_REQUEST_FAILED",
      );
    }

    return deepSeekResponse;
  } catch (error) {
    if (error.name === "AbortError") {
      throw createHttpError(504, "The AI service timed out.", "DEEPSEEK_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  requestDeepSeekReply,
  streamDeepSeekReply,
};
