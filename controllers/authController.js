const runtimeConfig = require("../config/runtimeConfig");
const { loginUser, registerUser, toPublicUser } = require("../services/authService");
const { createSession, revokeSession } = require("../services/sessionService");

function buildCookieOptions() {
  return {
    httpOnly: true,
    maxAge: runtimeConfig.authCookieMaxAgeMs,
    sameSite: "lax",
    secure: runtimeConfig.isProduction,
  };
}

function setAuthCookie(res, token) {
  res.cookie(runtimeConfig.authCookieName, token, buildCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(runtimeConfig.authCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: runtimeConfig.isProduction,
  });
}

async function register(req, res, next) {
  try {
    const user = await registerUser(req.body);
    const { token } = await createSession(user.id, req);
    setAuthCookie(res, token);
    res.status(201).json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const user = await loginUser(req.body);
    const { token } = await createSession(user.id, req);
    setAuthCookie(res, token);
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
}

function getCurrentUser(req, res) {
  res.json({ user: toPublicUser(req.user) });
}

async function logout(req, res, next) {
  try {
    await revokeSession(req.authToken);
    clearAuthCookie(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCurrentUser,
  login,
  logout,
  register,
};
