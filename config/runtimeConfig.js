const runtimeConfig = {
  port: process.env.PORT || "3000",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  deepSeekApiKey: process.env.DEEPSEEK_API_KEY || "",
  deepSeekModel: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  deepSeekBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
};

module.exports = runtimeConfig;
