const crypto = require("crypto");

function attachRequestContext(req, res, next) {
  const incomingRequestId = req.get("x-request-id");
  const requestId =
    typeof incomingRequestId === "string" && incomingRequestId.trim()
      ? incomingRequestId.trim().slice(0, 80)
      : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

module.exports = {
  attachRequestContext,
};
