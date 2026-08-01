const runtimeConfig = require("../config/runtimeConfig");
const prismaClient = require("../lib/prismaClient");
const {
  createConversation,
  createConversationTitle,
  getConversationById,
  getRecentMessages,
  parseConversationId,
  saveMessage,
  toConversationDto,
  toMessageDto,
  touchConversation,
} = require("../services/conversationService");
const { requestDeepSeekReply, streamDeepSeekReply } = require("../services/deepSeekChatService");
const { createHttpError } = require("../utils/httpError");

const supportedModels = new Set(["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat"]);

function resolveModelName(modelName) {
  if (typeof modelName !== "string") {
    return runtimeConfig.deepSeekModel;
  }

  const normalizedModelName = modelName.trim();

  return supportedModels.has(normalizedModelName) ? normalizedModelName : runtimeConfig.deepSeekModel;
}

function sanitizeUserContent(content) {
  return typeof content === "string" ? content.trim() : "";
}

function assertValidUserContent(content) {
  if (!content) {
    throw createHttpError(400, "Please send a valid message.", "EMPTY_MESSAGE");
  }

  if (content.length > runtimeConfig.chatMessageMaxLength) {
    throw createHttpError(
      413,
      `Message is too long. Please keep it under ${runtimeConfig.chatMessageMaxLength} characters.`,
      "MESSAGE_TOO_LONG",
    );
  }
}

async function resolveConversation({ conversationId, userId, modelName, userContent }) {
  if (!conversationId) {
    return createConversation({
      userId,
      model: modelName,
      title: createConversationTitle(userContent),
    });
  }

  const parsedConversationId = parseConversationId(conversationId);
  const conversation = await getConversationById(userId, parsedConversationId);

  if (conversation.model !== modelName) {
    return touchConversation(conversation.id, { model: modelName });
  }

  return conversation;
}

async function createChatCompletion(req, res, next) {
  try {
    const userContent = sanitizeUserContent(req.body.content);
    assertValidUserContent(userContent);

    const modelName = resolveModelName(req.body.model);
    const conversation = await resolveConversation({
      conversationId: req.body.conversationId,
      userId: req.user.id,
      modelName,
      userContent,
    });

    const userMessage = await saveMessage(conversation.id, "user", userContent);
    const chatMessages = await getRecentMessages(conversation.id);
    let completionResult;

    try {
      completionResult = await requestDeepSeekReply(chatMessages, modelName);
    } catch (error) {
      if (error.isOperational && String(error.code || "").startsWith("DEEPSEEK_")) {
        const updatedConversation = await touchConversation(conversation.id, {
          model: modelName,
        });

        res.status(error.status || 502).json({
          code: error.code,
          conversation: toConversationDto(updatedConversation),
          messages: [toMessageDto(userMessage)],
          message: error.message,
          requestId: req.requestId,
        });
        return;
      }

      throw error;
    }

    const [assistantMessage, updatedConversation] = await prismaClient.$transaction(
      async (tx) => {
        const msg = await tx.message.create({
          data: { conversationId: conversation.id, role: "assistant", content: completionResult.reply },
        });
        const conv = await tx.conversation.update({
          where: { id: conversation.id },
          data: { model: modelName },
        });
        return [msg, conv];
      },
    );

    res.json({
      conversation: toConversationDto(updatedConversation),
      messages: [toMessageDto(userMessage), toMessageDto(assistantMessage)],
      reply: completionResult.reply,
    });
  } catch (error) {
    next(error);
  }
}

async function createChatCompletionStream(req, res, next) {
  let conversation;
  let userMessage;
  let modelName;

  try {
    const userContent = sanitizeUserContent(req.body.content);
    assertValidUserContent(userContent);

    modelName = resolveModelName(req.body.model);
    conversation = await resolveConversation({
      conversationId: req.body.conversationId,
      userId: req.user.id,
      modelName,
      userContent,
    });

    userMessage = await saveMessage(conversation.id, "user", userContent);
  } catch (error) {
    next(error);
    return;
  }

  // 设置 SSE 响应头
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // 发送用户消息确认
  res.write(`data: ${JSON.stringify({ type: "user_message", message: toMessageDto(userMessage) })}\n\n`);

  let fullReply = "";

  try {
    const chatMessages = await getRecentMessages(conversation.id);
    const streamResponse = await streamDeepSeekReply(chatMessages, modelName);
    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullReply += delta;
            res.write(`data: ${JSON.stringify({ type: "chunk", content: delta })}\n\n`);
          }
        } catch { /* skip malformed chunks */ }
      }
    }
  } catch (error) {
    // 流中断：无任何回复时告知客户端
    if (!fullReply) {
      const errMsg = error.isOperational ? error.message : "AI service unavailable.";
      res.write(`data: ${JSON.stringify({ type: "error", message: errMsg })}\n\n`);
      res.end();
      return;
    }
    // 已有部分回复则继续保存
  }

  // 持久化 assistant 消息
  try {
    const [assistantMessage, updatedConversation] = await prismaClient.$transaction(
      async (tx) => {
        const msg = await tx.message.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: fullReply || "(empty reply)",
          },
        });
        const conv = await tx.conversation.update({
          where: { id: conversation.id },
          data: { model: modelName },
        });
        return [msg, conv];
      },
    );

    res.write(
      `data: ${JSON.stringify({
        type: "done",
        conversation: toConversationDto(updatedConversation),
        message: toMessageDto(assistantMessage),
      })}\n\n`,
    );
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: "error", message: "Failed to save message." })}\n\n`);
  }

  res.end();
}

module.exports = {
  createChatCompletion,
  createChatCompletionStream,
  resolveModelName,
};
