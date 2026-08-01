const crypto = require("crypto");

const runtimeConfig = require("../config/runtimeConfig");

function createSessionToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function hashSessionToken(token) {
  return crypto
    .createHmac("sha256", runtimeConfig.authTokenSecret)
    .update(token)
    .digest("hex");
}

module.exports = {
  createSessionToken,
  hashSessionToken,
};
