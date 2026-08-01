/**
 * runtimeConfig — 集中式运行时配置
 *
 * 职责:
 *   1. 从 process.env 读取所有环境变量
 *   2. 统一做类型转换与默认值填充
 *   3. 生产环境执行强制校验（fail-fast）
 *   4. 导出不可变配置对象，禁止运行时篡改
 *
 * 约定:
 *   - 所有可配置项一律通过此模块访问，禁止直接读取 process.env
 *   - 敏感值（密钥、连接串）仅在此处集中出现
 *   - 测试可通过 createRuntimeConfig(env) 注入自定义环境
 */

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 3000;
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_TIMEOUT_MS = 45_000;
const DEFAULT_CHAT_MESSAGE_MAX_LENGTH = 8_000;
const DEFAULT_CONVERSATION_LIST_LIMIT = 60;
const DEFAULT_AUTH_COOKIE_NAME = "ai_chat_auth";
const DEFAULT_AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
const DEFAULT_CLIENT_ORIGINS = ["http://localhost:5173"];

/** 仅开发环境使用的 fallback secret，生产环境严禁使用。
 *  故意设为短于 PROD_SECRET_MIN_LENGTH，作为纵深防御：即使上层的
 *  isProduction 检查被意外删除，此值也无法通过生产环境的长度校验。 */
const DEV_AUTH_SECRET = "dev-secret-do-not-use-in-production";

/** 生产环境要求 AUTH_TOKEN_SECRET 最小长度 */
const PROD_SECRET_MIN_LENGTH = 48;

/** DATABASE_URL 支持的 scheme */
const DB_SCHEMES = ["mysql", "postgresql", "postgres"];

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 安全解析非负整数，失败或空值时返回 fallbackValue。
 * 显式设为 0 是合法的（如 PORT=0 让 OS 分配端口）。
 */
function parseNumber(value, fallbackValue) {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallbackValue;
}

/**
 * 解析逗号分隔的字符串为数组，空项自动过滤
 */
function parseCsv(value, fallbackValues = []) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallbackValues;
  }
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 生产环境强制校验：值为空时立即抛出，实现 fail-fast
 */
function requireInProduction(name, value, nodeEnv) {
  if (nodeEnv === "production" && (!value || String(value).trim().length === 0)) {
    throw new Error(
      `[Config] ${name} is required in production but is empty or missing.`
    );
  }
}

/**
 * 校验 DATABASE_URL 格式（宽松校验 scheme 前缀）
 */
function validateDatabaseUrl(url, nodeEnv) {
  if (!url || url.trim().length === 0) {
    if (nodeEnv === "production") {
      throw new Error("[Config] DATABASE_URL is required in production.");
    }
    return;
  }
  const scheme = url.split("://")[0];
  if (!DB_SCHEMES.includes(scheme)) {
    throw new Error(
      `[Config] DATABASE_URL has unsupported scheme "${scheme}". ` +
      `Expected one of: ${DB_SCHEMES.join(", ")}.`
    );
  }
}

// ---------------------------------------------------------------------------
// 工厂函数
// ---------------------------------------------------------------------------

/**
 * 创建运行时配置对象。
 *
 * @param {Record<string, string|undefined>} env — 环境变量映射，默认 process.env
 * @returns {object} 冻结的不可变配置对象
 */
function createRuntimeConfig(env = process.env) {
  // ---- 基础环境 ----
  // 企业级：NODE_ENV 未显式设置时拒绝启动，避免静默回退导致生产安全配置跳过
  const nodeEnv = env.NODE_ENV;
  if (!nodeEnv) {
    throw new Error(
      "[Config] NODE_ENV is required. " +
      "Set NODE_ENV=development for local development, " +
      "or NODE_ENV=production for deployment. " +
      "Copy .env.example to .env and edit as needed."
    );
  }
  const isProduction = nodeEnv === "production";
  const isDevelopment = nodeEnv === "development";
  const isTest = nodeEnv === "test";

  // ---- 服务器 ----
  const port = parseNumber(env.PORT, DEFAULT_PORT);

  // ---- CORS ----
  const clientOrigins = parseCsv(
    env.CLIENT_ORIGINS || env.CLIENT_ORIGIN,
    DEFAULT_CLIENT_ORIGINS
  );

  // ---- 数据库 ----
  const databaseUrl = (env.DATABASE_URL || "").trim();
  validateDatabaseUrl(databaseUrl, nodeEnv);

  // ---- AI / LLM ----
  const deepSeekApiKey = env.DEEPSEEK_API_KEY || "";
  if (!deepSeekApiKey) {
    console.warn(
      "[Config] DEEPSEEK_API_KEY is not set — AI chat requests will fail. " +
      "Set it in your .env file or deployment environment."
    );
  }
  const deepSeekModel = env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
  const deepSeekBaseUrl = env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL;
  const deepSeekRequestTimeoutMs = parseNumber(
    env.DEEPSEEK_REQUEST_TIMEOUT_MS,
    DEFAULT_DEEPSEEK_TIMEOUT_MS
  );

  // ---- 认证 ----
  // 生产环境必须在回退到 DEV_AUTH_SECRET 之前检查原始值
  if (isProduction && !env.AUTH_TOKEN_SECRET) {
    throw new Error(
      "[Config] AUTH_TOKEN_SECRET is required in production but is empty or missing."
    );
  }
  const authTokenSecret = env.AUTH_TOKEN_SECRET || DEV_AUTH_SECRET;
  if (!isProduction && !env.AUTH_TOKEN_SECRET) {
    console.warn(
      "[Config] AUTH_TOKEN_SECRET is not set — using a weak built-in fallback. " +
      "This is unsafe outside local development. " +
      "Set a strong random secret in production."
    );
  }
  const authCookieName = env.AUTH_COOKIE_NAME || DEFAULT_AUTH_COOKIE_NAME;
  const authCookieMaxAgeMs = parseNumber(
    env.AUTH_COOKIE_MAX_AGE_MS,
    DEFAULT_AUTH_COOKIE_MAX_AGE_MS
  );

  // ---- 聊天业务 ----
  const chatMessageMaxLength = parseNumber(
    env.CHAT_MESSAGE_MAX_LENGTH,
    DEFAULT_CHAT_MESSAGE_MAX_LENGTH
  );
  const conversationListLimit = parseNumber(
    env.CONVERSATION_LIST_LIMIT,
    DEFAULT_CONVERSATION_LIST_LIMIT
  );

  // ---- 生产环境强制校验 ----
  if (isProduction) {
    requireInProduction("DATABASE_URL", databaseUrl, nodeEnv);
    requireInProduction("DEEPSEEK_API_KEY", deepSeekApiKey, nodeEnv);

    if (authTokenSecret.length < PROD_SECRET_MIN_LENGTH) {
      throw new Error(
        `[Config] AUTH_TOKEN_SECRET must be at least ${PROD_SECRET_MIN_LENGTH} ` +
        `characters in production (got ${authTokenSecret.length}).`
      );
    }
  }

  // ---- 组装配置对象 ----
  const config = {
    // 环境
    nodeEnv,
    isProduction,
    isDevelopment,
    isTest,

    // 服务器
    port,

    // CORS（冻结数组防篡改）
    clientOrigins: Object.freeze(clientOrigins),

    // 数据库
    databaseUrl,

    // AI / LLM
    deepSeekApiKey,
    deepSeekModel,
    deepSeekBaseUrl,
    deepSeekRequestTimeoutMs,

    // 认证
    authTokenSecret,
    authCookieName,
    authCookieMaxAgeMs,

    // 聊天业务
    chatMessageMaxLength,
    conversationListLimit,
  };

  // 组装配置对象（调用方可直接使用，不需要额外冻结）
  return config;
}

// ---------------------------------------------------------------------------
// 默认导出（生产入口）
// ---------------------------------------------------------------------------

const defaultConfig = createRuntimeConfig();
defaultConfig.createRuntimeConfig = createRuntimeConfig;
module.exports = deepFreeze(defaultConfig);

/**
 * 递归冻结对象及所有嵌套对象/数组，防止绕过顶层 Object.freeze
 */
function deepFreeze(obj) {
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}
