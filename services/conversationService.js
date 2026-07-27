const prismaClient = require("../lib/prismaClient");

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
    const error = new Error("Conversation was not found.");
    error.status = 404;
    throw error;
  }

  return parsedConversationId;
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
    take: 60,
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
    const error = new Error("Conversation was not found.");
    error.status = 404;
    throw error;
  }

  return {
    ...toConversationDto(conversation),
    messages: conversation.messages.map(toMessageDto),
  };
}

async function deleteConversation(userId, conversationId) {
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

  await prismaClient.conversation.delete({
    where: { id: conversation.id },
  });
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
  getConversationWithMessages,
  getRecentMessages,
  listConversations,
  parseConversationId,
  saveMessage,
  toConversationDto,
  toMessageDto,
  touchConversation,
};
