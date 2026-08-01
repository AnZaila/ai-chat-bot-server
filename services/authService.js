const prismaClient = require("../lib/prismaClient");
const { createHttpError } = require("../utils/httpError");
const { hashPassword, verifyPassword } = require("./passwordService");

const EMAIL_MAX_LENGTH = 191;
const USERNAME_MAX_LENGTH = 40;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function normalizeUsername(username) {
  if (typeof username !== "string") {
    return null;
  }

  const trimmedUsername = username.trim();
  return trimmedUsername ? trimmedUsername.slice(0, USERNAME_MAX_LENGTH) : null;
}

function assertValidEmail(email) {
  if (
    email.length > EMAIL_MAX_LENGTH ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw createHttpError(400, "Please enter a valid email address.", "INVALID_EMAIL");
  }
}

function assertValidPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw createHttpError(
      400,
      `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`,
      "INVALID_PASSWORD",
    );
  }
}

function assertValidCredentials(email, password) {
  assertValidEmail(email);
  assertValidPassword(password);
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

  return prismaClient.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw createHttpError(409, "This email is already registered.", "EMAIL_EXISTS");
    }

    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        username: normalizeUsername(username),
        passwordHash: await hashPassword(password),
      },
    });

    // 不将 passwordHash 传出 service 层
    const { passwordHash: _, ...publicUser } = user;
    return publicUser;
  });
}

async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  assertValidCredentials(normalizedEmail, password);

  const user = await prismaClient.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw createHttpError(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
  }

  // 不将 passwordHash 传出 service 层
  const { passwordHash: _, ...publicUser } = user;
  return publicUser;
}

module.exports = {
  loginUser,
  registerUser,
  toPublicUser,
};
