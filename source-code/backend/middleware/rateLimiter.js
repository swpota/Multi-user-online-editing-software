/**
 * 请求速率限制中间件
 */
const rateLimit = require("express-rate-limit");
const { getConfig } = require("../config/env");

const config = getConfig();

/**
 * 通用 API 速率限制
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 分钟
  max: config.rateLimit.max, // 限制每个 IP 100 次请求
  message: {
    error: "请求过于频繁，请稍后再试",
    retryAfter: "15 分钟",
  },
  standardHeaders: true, // 返回速率限制信息在 `RateLimit-*` 头中
  legacyHeaders: false, // 禁用 `X-RateLimit-*` 头
});

/**
 * 认证相关 API 速率限制（更严格）
 * 用于登录、注册、密码重置等敏感操作
 */
const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs, // 15 分钟
  max: config.rateLimit.auth.max, // 限制每个 IP 50 次请求，避免正常使用被限制
  message: {
    error: "认证请求过于频繁，请稍后再试",
    retryAfter: "15 分钟",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // 跳过成功的请求（只计算失败的请求），这样密码错误或注册失败才会被限制
  skipSuccessfulRequests: true,
  // 不跳过失败的请求
  skipFailedRequests: false,
});

/**
 * 文件上传速率限制
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小时
  max: 20, // 限制每个 IP 20 次上传
  message: {
    error: "文件上传过于频繁，请稍后再试",
    retryAfter: "1 小时",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
};

