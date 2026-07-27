const runtimeConfig = {
  port: process.env.PORT || "3000",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  deepSeekApiKey: process.env.DEEPSEEK_API_KEY || "",
  deepSeekModel: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  deepSeekBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  authTokenSecret: process.env.AUTH_TOKEN_SECRET || "replace-this-secret-before-production",
  authCookieName: process.env.AUTH_COOKIE_NAME || "ai_chat_auth",
  authCookieMaxAgeMs: Number(process.env.AUTH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000),
  nodeEnv: process.env.NODE_ENV || "development",
};

module.exports = runtimeConfig;
