const express = require("express");
const { createChatCompletion } = require("../controllers/chatController");

const chatRoutes = express.Router();

chatRoutes.post("/", createChatCompletion);

module.exports = chatRoutes;
