const crypto = require("crypto");

const runtimeConfig = require("../config/runtimeConfig");

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload) {
  return crypto
    .createHmac("sha256", runtimeConfig.authTokenSecret)
    .update(payload)
    .digest("base64url");
}

function createAuthToken(userId) {
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: userId,
      exp: Date.now() + runtimeConfig.authCookieMaxAgeMs,
    }),
  );
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

function verifyAuthToken(token) {
  if (typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const tokenParts = token.split(".");

  if (tokenParts.length !== 2) {
    return null;
  }

  const [payload, signature] = tokenParts;
  const expectedSignature = signPayload(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  try {
    const parsedPayload = JSON.parse(base64UrlDecode(payload));

    if (!parsedPayload.sub || parsedPayload.exp < Date.now()) {
      return null;
    }

    return Number(parsedPayload.sub);
  } catch (error) {
    return null;
  }
}

module.exports = {
  createAuthToken,
  verifyAuthToken,
};
