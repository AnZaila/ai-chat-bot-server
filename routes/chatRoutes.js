const express = require("express");
const { createChatCompletion, createChatCompletionStream } = require("../controllers/chatController");
const { requireAuth } = require("../middleware/authMiddleware");

const chatRoutes = express.Router();

chatRoutes.post("/", requireAuth, createChatCompletion);
chatRoutes.post("/stream", requireAuth, createChatCompletionStream);

module.exports = chatRoutes;
