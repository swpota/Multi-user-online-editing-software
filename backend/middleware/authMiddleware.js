/**
 * JWT身份认证中间件
 * 功能：验证用户的JWT Token，确保只有已登录的用户才能访问受保护的API
 * 使用：在需要身份认证的路由中使用protect中间件
 * 示例：app.get("/api/documents", protect, async (req, res) => {...})
 */

// 引入jsonwebtoken库，用于验证JWT Token
const jwt = require("jsonwebtoken");
// 引入数据库连接池，用于查询用户信息
const pool = require("../db");
// 引入配置获取函数，用于获取JWT密钥
const { getConfig } = require("../config/env");
// 引入错误处理函数，用于处理JWT相关错误
const { handleJWTError, handleJWTExpiredError, AppError } = require("./errorHandler");
// 引入日志工具，用于记录认证相关的错误
const logger = require("../utils/logger");

// 获取系统配置（包含JWT密钥）
const config = getConfig();

/**
 * protect中间件函数
 * 功能：验证请求中的JWT Token，并将用户信息附加到req.user
 * 参数：
 *   req - Express请求对象
 *   res - Express响应对象
 *   next - Express next函数，调用后继续执行下一个中间件
 * 返回：
 *   - 如果Token有效：调用next()继续执行，req.user包含用户信息
 *   - 如果Token无效：返回401错误响应
 */
const protect = async (req, res, next) => {
  // 声明token变量，用于存储从请求头中提取的JWT Token
  let token;

  // 检查请求头中是否包含Authorization字段
  // Authorization字段格式："Bearer <token>"
  if (
    req.headers.authorization &&                       // 确保authorization字段存在
    req.headers.authorization.startsWith("Bearer")     // 确保格式以"Bearer "开头
  ) {
    // 从"Bearer <token>"中提取token部分
    // split(" ") 按空格分割字符串，[1]取第二部分（即token）
    token = req.headers.authorization.split(" ")[1];
  }

  // 如果没有提取到token，返回401未授权错误
  if (!token) {
    return res.status(401).json({ message: "认证失败，没有提供 token" });
  }

  try {
    // 使用JWT密钥验证token的有效性
    // jwt.verify会检查：
    // 1. token签名是否正确
    // 2. token是否过期
    // 3. token格式是否正确
    // 返回解码后的payload（包含用户id和role等信息）
    const decoded = jwt.verify(token, config.jwt.secret);

    // 从数据库查询用户完整信息
    // 使用参数化查询($1)防止SQL注入
    const userResult = await pool.query(
      `SELECT id,              -- 用户ID
              email,           -- 邮箱
              phone,           -- 手机号
              role,            -- 角色（admin/editor）
              avatar_url,      -- 头像URL
              full_name,       -- 姓名
              contact_email,   -- 联系邮箱
              contact_phone,   -- 联系手机
              created_at       -- 注册时间
         FROM users
        WHERE id = $1`,         // 根据token中的用户ID查询
      [decoded.id]              // 参数数组，对应$1
    );

    // 如果数据库中找不到该用户（可能已被删除）
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "认证失败，用户不存在" });
    }

    // 将用户信息附加到req对象上，后续的路由处理器可以通过req.user访问
    req.user = userResult.rows[0];

    // 调用next()，继续执行下一个中间件或路由处理器
    next();
  } catch (error) {
    // 记录Token验证失败的错误日志
    logger.error("Token验证失败:", error);
    
    // 处理不同类型的JWT错误
    // JsonWebTokenError: token格式错误或签名无效
    if (error.name === "JsonWebTokenError") {
      // 返回401错误响应，包含错误信息
      return res.status(401).json({ message: handleJWTError().message });
    }
    // TokenExpiredError: token已过期
    if (error.name === "TokenExpiredError") {
      // 返回401错误响应，包含错误信息
      return res.status(401).json({ message: handleJWTExpiredError().message });
    }
    
    // 其他未知的认证错误
    // 返回401错误响应，包含错误信息
    res.status(401).json({ message: "认证失败，token无效" });
  }
};

// 导出protect中间件，供其他模块使用
// 使用方式：const { protect } = require("./middleware/authMiddleware");
module.exports = { protect };
