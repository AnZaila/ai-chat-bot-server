const prismaClient = require("../lib/prismaClient");
const runtimeConfig = require("../config/runtimeConfig");
const { createHttpError } = require("../utils/httpError");

function createConversationTitle(content) {
  const normalizedContent = String(content || "").replace(/\s+/g, " ").trim();

  if (!normalizedContent) {
    return "New conversation";
  }

  return normalizedContent.length > 28
    ? `${normalizedContent.slice(0, 28)}...`
    : normalizedContent;
}

function toMessageDto(message) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  };
}

function toConversationDto(conversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    model: conversation.model,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

function parseConversationId(conversationId) {
  const parsedConversationId = Number(conversationId);

  if (!Number.isInteger(parsedConversationId) || parsedConversationId <= 0) {
    throw createHttpError(404, "Conversation was not found.", "CONVERSATION_NOT_FOUND");
  }

  return parsedConversationId;
}

async function getConversationById(userId, parsedId) {
  const conversation = await prismaClient.conversation.findFirst({
    where: { id: parsedId, userId },
  });

  if (!conversation) {
    throw createHttpError(404, "Conversation was not found.", "CONVERSATION_NOT_FOUND");
  }

  return conversation;
}

async function createConversation({ userId, model, title }) {
  return prismaClient.conversation.create({
    data: {
      userId,
      model,
      title: title || "New conversation",
    },
  });
}

async function listConversations(userId) {
  const conversations = await prismaClient.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: runtimeConfig.conversationListLimit,
  });

  return conversations.map(toConversationDto);
}

async function getConversationWithMessages(userId, conversationId) {
  const parsedConversationId = parseConversationId(conversationId);
  const conversation = await prismaClient.conversation.findFirst({
    where: {
      id: parsedConversationId,
      userId,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    throw createHttpError(404, "Conversation was not found.", "CONVERSATION_NOT_FOUND");
  }

  return {
    ...toConversationDto(conversation),
    messages: conversation.messages.map(toMessageDto),
  };
}

async function deleteConversation(userId, conversationId) {
  const parsedConversationId = parseConversationId(conversationId);
  const { count } = await prismaClient.conversation.deleteMany({
    where: { id: parsedConversationId, userId },
  });

  if (count === 0) {
    throw createHttpError(404, "Conversation was not found.", "CONVERSATION_NOT_FOUND");
  }
}

async function saveMessage(conversationId, role, content) {
  return prismaClient.message.create({
    data: {
      conversationId,
      role,
      content,
    },
  });
}

async function touchConversation(conversationId, data = {}) {
  return prismaClient.conversation.update({
    where: { id: conversationId },
    data,
  });
}

async function getRecentMessages(conversationId, limit = 12) {
  const messages = await prismaClient.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return messages.reverse().map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

module.exports = {
  createConversation,
  createConversationTitle,
  deleteConversation,
  getConversationById,
  getConversationWithMessages,
  getRecentMessages,
  listConversations,
  parseConversationId,
  saveMessage,
  toConversationDto,
  toMessageDto,
  touchConversation,
};
