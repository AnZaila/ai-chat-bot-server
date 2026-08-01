const runtimeConfig = require("../config/runtimeConfig");
const { findActiveSession } = require("../services/sessionService");

function getRequestToken(req) {
  const bearerToken =
    typeof req.headers.authorization === "string" &&
    req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : "";

  return req.cookies[runtimeConfig.authCookieName] || bearerToken;
}

async function requireAuth(req, res, next) {
  try {
    const token = getRequestToken(req);
    const session = await findActiveSession(token);

    if (!session?.user) {
      res.status(401).json({
        code: "UNAUTHENTICATED",
        message: "Please sign in first.",
      });
      return;
    }

    req.authToken = token;
    req.session = {
      id: session.id,
      expiresAt: session.expiresAt,
    };
    req.user = session.user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth,
};
