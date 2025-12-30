/**
 * 日志管理系统
 * 使用 winston 进行日志记录
 */
const winston = require("winston");
const path = require("path");
const { getConfig } = require("../config/env");

const config = getConfig();
const isDevelopment = config.server.nodeEnv === "development";

// 定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 控制台格式（开发环境使用）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// 创建日志目录
const logDir = path.join(__dirname, "../logs");

// 创建 logger 实例
const logger = winston.createLogger({
  level: isDevelopment ? "debug" : "info",
  format: logFormat,
  defaultMeta: { service: "collaborative-docs" },
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // 异常处理
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "exceptions.log"),
    }),
  ],
  // 拒绝处理
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "rejections.log"),
    }),
  ],
});

// 开发环境：同时输出到控制台
if (isDevelopment) {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// 生产环境：只记录 warn 及以上级别到控制台
if (!isDevelopment) {
  logger.add(
    new winston.transports.Console({
      level: "warn",
      format: consoleFormat,
    })
  );
}

// 便捷方法
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;

