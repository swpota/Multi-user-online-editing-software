/**
 * 统一错误处理中间件
 */

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 统一错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  const config = require("../config/env").getConfig();
  const isDevelopment = config.server.nodeEnv === "development";

  // 设置默认错误信息
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // 开发环境：返回详细错误信息
  if (isDevelopment) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }

  // 生产环境：只返回安全的错误信息
  // 操作错误（可预期的错误）：发送消息给客户端
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  // 编程错误或未知错误：不泄露错误详情
  console.error("ERROR 💥", err);

  return res.status(500).json({
    status: "error",
    message: "服务器内部错误",
  });
};

/**
 * 处理异步错误
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 处理 404 错误
 */
const notFoundHandler = (req, res, next) => {
  const err = new AppError(`找不到 ${req.originalUrl} 路径`, 404);
  next(err);
};

/**
 * 处理 JWT 错误
 */
const handleJWTError = () => {
  return new AppError("无效的 token，请重新登录", 401);
};

/**
 * 处理 JWT 过期错误
 */
const handleJWTExpiredError = () => {
  return new AppError("Token 已过期，请重新登录", 401);
};

/**
 * 处理数据库错误
 */
const handleDBError = (err) => {
  // 处理唯一约束错误
  if (err.code === "23505") {
    const field = err.detail.match(/\(([^)]+)\)/);
    return new AppError(`${field ? field[1] : "字段"} 已存在`, 409);
  }

  // 处理外键约束错误
  if (err.code === "23503") {
    return new AppError("关联的资源不存在", 404);
  }

  // 处理非空约束错误
  if (err.code === "23502") {
    return new AppError("缺少必需的字段", 400);
  }

  // 其他数据库错误
  return new AppError("数据库操作失败", 500);
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler,
  notFoundHandler,
  handleJWTError,
  handleJWTExpiredError,
  handleDBError,
};

