const express = require("express");
const { createChatCompletion } = require("../controllers/chatController");
const { requireAuth } = require("../middleware/authMiddleware");

const chatRoutes = express.Router();

chatRoutes.post("/", requireAuth, createChatCompletion);

module.exports = chatRoutes;
