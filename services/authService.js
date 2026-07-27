const prismaClient = require("../lib/prismaClient");
const { createAuthToken } = require("./tokenService");
const { hashPassword, verifyPassword } = require("./passwordService");

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function normalizeUsername(username) {
  if (typeof username !== "string") {
    return null;
  }

  const trimmedUsername = username.trim();
  return trimmedUsername || null;
}

function assertValidCredentials(email, password) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("Please enter a valid email address.");
    error.status = 400;
    throw error;
  }

  if (typeof password !== "string" || password.length < 6) {
    const error = new Error("Password must be at least 6 characters.");
    error.status = 400;
    throw error;
  }
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
  };
}

async function registerUser({ email, password, username }) {
  const normalizedEmail = normalizeEmail(email);
  assertValidCredentials(normalizedEmail, password);

  const existingUser = await prismaClient.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    const error = new Error("This email is already registered.");
    error.status = 409;
    throw error;
  }

  const user = await prismaClient.user.create({
    data: {
      email: normalizedEmail,
      username: normalizeUsername(username),
      passwordHash: await hashPassword(password),
    },
  });

  return {
    token: createAuthToken(user.id),
    user: toPublicUser(user),
  };
}

async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  assertValidCredentials(normalizedEmail, password);

  const user = await prismaClient.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    const error = new Error("Email or password is incorrect.");
    error.status = 401;
    throw error;
  }

  return {
    token: createAuthToken(user.id),
    user: toPublicUser(user),
  };
}

module.exports = {
  loginUser,
  registerUser,
  toPublicUser,
};
