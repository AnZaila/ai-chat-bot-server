const prismaClient = require("../lib/prismaClient");
const runtimeConfig = require("../config/runtimeConfig");
const { verifyAuthToken } = require("../services/tokenService");

async function requireAuth(req, res, next) {
  try {
    const bearerToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : "";
    const token = req.cookies[runtimeConfig.authCookieName] || bearerToken;
    const userId = verifyAuthToken(token);

    if (!userId) {
      res.status(401).json({ message: "Please sign in first." });
      return;
    }

    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    if (!user) {
      res.status(401).json({ message: "Please sign in first." });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth,
};
