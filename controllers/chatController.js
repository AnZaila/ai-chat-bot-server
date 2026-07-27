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

const supportedModels = new Set(["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat"]);

function resolveModelName(modelName) {
  if (typeof modelName !== "string") {
    return runtimeConfig.deepSeekModel;
  }

  const normalizedModelName = modelName.trim();

  return supportedModels.has(normalizedModelName) ? normalizedModelName : runtimeConfig.deepSeekModel;
}

function sanitizeChatMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => {
      return (
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
      );
    })
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

function sanitizeUserContent(content) {
  return typeof content === "string" ? content.trim() : "";
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
    const error = new Error("Conversation was not found.");
    error.status = 404;
    throw error;
  }

  if (conversation.model !== modelName) {
    return touchConversation(conversation.id, { model: modelName });
  }

  return conversation;
}

async function createChatCompletion(req, res, next) {
  try {
    const userContent = sanitizeUserContent(req.body.content);

    if (!userContent) {
      res.status(400).json({
        message: "Please send a valid message.",
      });
      return;
    }

    const modelName = resolveModelName(req.body.model);
    const conversation = await resolveConversation({
      conversationId: req.body.conversationId,
      userId: req.user.id,
      modelName,
      userContent,
    });

    const userMessage = await saveMessage(conversation.id, "user", userContent);
    const chatMessages = await getRecentMessages(conversation.id);
    const completionResult = await requestDeepSeekReply(chatMessages, modelName);
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
  sanitizeChatMessages,
};
