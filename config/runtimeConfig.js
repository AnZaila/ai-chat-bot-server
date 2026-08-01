const DEFAULT_AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEVELOPMENT_AUTH_SECRET = "development-only-auth-secret-change-before-production";

function parseNumber(value, fallbackValue) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function parseCsv(value, fallbackValues = []) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallbackValues;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireInProduction(name, value, nodeEnv) {
  if (nodeEnv === "production" && (!value || String(value).trim().length === 0)) {
    throw new Error(`${name} is required in production.`);
  }
}

function createRuntimeConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  const clientOrigins = parseCsv(env.CLIENT_ORIGINS || env.CLIENT_ORIGIN, [
    "http://localhost:5173",
  ]);
  const authTokenSecret = env.AUTH_TOKEN_SECRET || DEVELOPMENT_AUTH_SECRET;

  requireInProduction("DATABASE_URL", env.DATABASE_URL, nodeEnv);
  requireInProduction("DEEPSEEK_API_KEY", env.DEEPSEEK_API_KEY, nodeEnv);
  requireInProduction("AUTH_TOKEN_SECRET", env.AUTH_TOKEN_SECRET, nodeEnv);

  if (nodeEnv === "production" && authTokenSecret.length < 48) {
    throw new Error("AUTH_TOKEN_SECRET must be at least 48 characters in production.");
  }

  return {
    port: env.PORT || "3000",
    clientOrigins,
    deepSeekApiKey: env.DEEPSEEK_API_KEY || "",
    deepSeekModel: env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    deepSeekBaseUrl: env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    deepSeekRequestTimeoutMs: parseNumber(env.DEEPSEEK_REQUEST_TIMEOUT_MS, 45000),
    chatMessageMaxLength: parseNumber(env.CHAT_MESSAGE_MAX_LENGTH, 8000),
    conversationListLimit: parseNumber(env.CONVERSATION_LIST_LIMIT, 60),
    authTokenSecret,
    authCookieName: env.AUTH_COOKIE_NAME || "ai_chat_auth",
    authCookieMaxAgeMs: parseNumber(env.AUTH_COOKIE_MAX_AGE_MS, DEFAULT_AUTH_COOKIE_MAX_AGE_MS),
    nodeEnv,
    isProduction: nodeEnv === "production",
  };
}

module.exports = createRuntimeConfig();
module.exports.createRuntimeConfig = createRuntimeConfig;
