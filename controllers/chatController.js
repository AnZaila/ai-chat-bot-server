const { buildFallbackReply, requestDeepSeekReply } = require("../services/deepSeekChatService");

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

async function createChatCompletion(req, res, next) {
  try {
    const chatMessages = sanitizeChatMessages(req.body.messages);

    if (chatMessages.length === 0) {
      res.status(400).json({
        message: "请至少发送一条有效消息。",
      });
      return;
    }

    const completionResult = await requestDeepSeekReply(chatMessages);

    res.json(completionResult);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  buildFallbackReply,
  createChatCompletion,
  sanitizeChatMessages,
};
