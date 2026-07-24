require("dotenv").config();

const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

const runtimeConfig = require("./config/runtimeConfig");
const chatRoutes = require("./routes/chatRoutes");

const app = express();

app.use(logger("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(function allowLocalClient(req, res, next) {
  res.header("Access-Control-Allow-Origin", runtimeConfig.clientOrigin);
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

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

app.use("/api/chat", chatRoutes);

app.use(function notFound(req, res, next) {
  next(createError(404, "接口不存在。"));
});

app.use(function errorHandler(err, req, res, next) {
  res.status(err.status || 500).json({
    message: err.message || "服务暂时不可用。",
  });
});

module.exports = app;
