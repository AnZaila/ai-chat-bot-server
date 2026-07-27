require("dotenv").config();

const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

const runtimeConfig = require("./config/runtimeConfig");
const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const conversationRoutes = require("./routes/conversationRoutes");

const app = express();

app.use(logger("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(function allowLocalClient(req, res, next) {
  res.header("Access-Control-Allow-Origin", runtimeConfig.clientOrigin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.header("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.get("/api/health", function healthCheck(req, res) {
  res.json({
    ok: true,
    service: "ai-chat-bot-server",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/conversations", conversationRoutes);

app.use(function notFound(req, res, next) {
  next(createError(404, "API route was not found."));
});

app.use(function errorHandler(err, req, res, next) {
  res.status(err.status || 500).json({
    message: err.message || "Service is temporarily unavailable.",
  });
});

module.exports = app;
