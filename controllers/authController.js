const runtimeConfig = require("../config/runtimeConfig");
const { loginUser, registerUser, toPublicUser } = require("../services/authService");

function buildCookieOptions() {
  return {
    httpOnly: true,
    maxAge: runtimeConfig.authCookieMaxAgeMs,
    sameSite: "lax",
    secure: runtimeConfig.nodeEnv === "production",
  };
}

function setAuthCookie(res, token) {
  res.cookie(runtimeConfig.authCookieName, token, buildCookieOptions());
}

async function register(req, res, next) {
  try {
    const result = await registerUser(req.body);
    setAuthCookie(res, result.token);
    res.status(201).json({ user: result.user });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await loginUser(req.body);
    setAuthCookie(res, result.token);
    res.json({ user: result.user });
  } catch (error) {
    next(error);
  }
}

function getCurrentUser(req, res) {
  res.json({ user: toPublicUser(req.user) });
}

function logout(req, res) {
  res.clearCookie(runtimeConfig.authCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: runtimeConfig.nodeEnv === "production",
  });
  res.status(204).send();
}

module.exports = {
  getCurrentUser,
  login,
  logout,
  register,
};
