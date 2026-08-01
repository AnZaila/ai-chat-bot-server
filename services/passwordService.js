const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const PASSWORD_HASH_VERSION = "scrypt-v1";
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);

  return `${PASSWORD_HASH_VERSION}:${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [version, salt, hash] = String(storedHash).split(":");

  if (version !== PASSWORD_HASH_VERSION || !salt || !hash) {
    return false;
  }

  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  const hashBuffer = Buffer.from(hash, "hex");

  return (
    hashBuffer.length === derivedKey.length &&
    crypto.timingSafeEqual(hashBuffer, derivedKey)
  );
}

module.exports = {
  hashPassword,
  verifyPassword,
};
