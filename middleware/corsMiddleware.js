const runtimeConfig = require("../config/runtimeConfig");

function applyCors(req, res, next) {
  const origin = req.get("origin");

  if (origin && runtimeConfig.clientOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }

  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id");
  res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.header("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
}

module.exports = {
  applyCors,
};
