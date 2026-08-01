const runtimeConfig = require("../config/runtimeConfig");
const prismaClient = require("../lib/prismaClient");
const {
  createConversation,
  createConversationTitle,
  getRecentMessages,
  parseConversationId,
  saveMessage,
  toConversationDto,
  toMessageDto,
  touchConversation,
} = require("../services/conversationService");
const { requestDeepSeekReply } = require("../services/deepSeekChatService");
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
  const conversation = await prismaClient.conversation.findFirst({
    where: {
      id: parsedConversationId,
      userId,
    },
  });

  if (!conversation) {
    throw createHttpError(404, "Conversation was not found.", "CONVERSATION_NOT_FOUND");
  }

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

    const assistantMessage = await saveMessage(conversation.id, "assistant", completionResult.reply);
    const updatedConversation = await touchConversation(conversation.id, {
      model: modelName,
    });

    res.json({
      conversation: toConversationDto(updatedConversation),
      messages: [toMessageDto(userMessage), toMessageDto(assistantMessage)],
      reply: completionResult.reply,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createChatCompletion,
  resolveModelName,
};
