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
const { applyCors } = require("./middleware/corsMiddleware");
const { attachRequestContext } = require("./middleware/requestContextMiddleware");
const { applySecurityHeaders } = require("./middleware/securityHeadersMiddleware");

const app = express();

app.disable("x-powered-by");

if (runtimeConfig.isProduction) {
  app.set("trust proxy", 1);
}

app.use(attachRequestContext);
app.use(logger(runtimeConfig.isProduction ? "combined" : "dev"));
app.use(applySecurityHeaders);
app.use(applyCors);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", function healthCheck(req, res) {
  res.json({
    ok: true,
    service: "ai-chat-bot-server",
    requestId: req.requestId,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/conversations", conversationRoutes);

app.use(function notFound(req, res, next) {
  next(createError(404, "API route was not found."));
});

app.use(function errorHandler(err, req, res, next) {
  const status = Number.isInteger(err.status) ? err.status : 500;
  const isOperationalError = err.isOperational || status < 500;
  const message = isOperationalError
    ? err.message
    : "Service is temporarily unavailable.";

  if (status >= 500) {
    console.error({
      err,
      requestId: req.requestId,
    });
  }

  res.status(status).json({
    code: err.code || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
    message,
    requestId: req.requestId,
  });
});

module.exports = app;
