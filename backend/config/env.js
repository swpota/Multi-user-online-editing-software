/**
 * 环境变量配置和验证
 */

require("dotenv").config();

/**
 * 验证必需的环境变量
 */
const validateEnv = () => {
  const required = [
    "DATABASE_URL",
    "JWT_SECRET",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ 缺少必需的环境变量:");
    missing.forEach((key) => {
      console.error(`   - ${key}`);
    });
    console.error("\n请创建 .env 文件并设置这些变量。");
    process.exit(1);
  }

  // 验证 JWT_SECRET 长度
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn("⚠️  警告: JWT_SECRET 长度应该至少为 32 个字符，建议使用更长的密钥。");
  }
};

/**
 * 获取环境变量配置
 */
const getConfig = () => {
  return {
    // 数据库配置
    database: {
      url: process.env.DATABASE_URL,
      // 连接池配置
      pool: {
        min: parseInt(process.env.DB_POOL_MIN || "2", 10),
        max: parseInt(process.env.DB_POOL_MAX || "10", 10),
        idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || "30000", 10),
      },
    },

    // JWT 配置
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || "24h", // 增加到 24 小时，避免频繁过期
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    },

    // 服务器配置
    server: {
      port: parseInt(process.env.PORT || "5000", 10),
      nodeEnv: process.env.NODE_ENV || "development",
    },

    // CORS 配置
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      // 支持多个 origin（用逗号分隔）
      origins: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
        : ["http://localhost:5173"],
    },

    // 文件上传配置
    upload: {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10) * 1024 * 1024, // 转换为字节
      allowedMimeTypes: process.env.ALLOWED_MIME_TYPES
        ? process.env.ALLOWED_MIME_TYPES.split(",").map((type) => type.trim())
        : [
            "image/jpeg",
            "image/png",
            "image/gif",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
    },

    // 速率限制配置
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 分钟
      max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10), // 限制每个 IP 100 次请求
      // 登录和注册的速率限制
      auth: {
        windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 分钟
        max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || "50", 10), // 增加到 50 次，避免正常使用被限制
      },
    },
  };
};

// 在模块加载时验证环境变量
if (process.env.NODE_ENV !== "test") {
  validateEnv();
}

module.exports = {
  getConfig,
  validateEnv,
};

