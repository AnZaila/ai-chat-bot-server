const prismaClient = require("../lib/prismaClient");
const runtimeConfig = require("../config/runtimeConfig");
const { createSessionToken, hashSessionToken } = require("./tokenService");

function getSessionExpiryDate() {
  return new Date(Date.now() + runtimeConfig.authCookieMaxAgeMs);
}

function getRequestIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

function getRequestUserAgent(req) {
  const userAgent = req.get("user-agent");
  return typeof userAgent === "string" ? userAgent.slice(0, 191) : null;
}

async function createSession(userId, req) {
  const token = createSessionToken();
  const session = await prismaClient.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      userAgent: getRequestUserAgent(req),
      ipAddress: getRequestIp(req),
      expiresAt: getSessionExpiryDate(),
    },
  });

  return {
    session,
    token,
  };
}

async function findActiveSession(token) {
  if (typeof token !== "string" || token.length < 32) {
    return null;
  }

  return prismaClient.session.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
        },
      },
    },
  });
}

async function revokeSession(token) {
  if (typeof token !== "string" || token.length < 32) {
    return;
  }

  await prismaClient.session.updateMany({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

module.exports = {
  createSession,
  findActiveSession,
  revokeSession,
};
