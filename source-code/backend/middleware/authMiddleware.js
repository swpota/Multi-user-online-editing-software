/**
 * JWT身份认证中间件
 * 这个中间件用来验证用户是否登录，所有需要登录才能访问的接口都会用到它
 */

const jwt = require("jsonwebtoken");
const pool = require("../db");
const { getConfig } = require("../config/env");
const { handleJWTError, handleJWTExpiredError, AppError } = require("./errorHandler");
const logger = require("../utils/logger");

const config = getConfig();

/**
 * protect - 验证用户token的中间件
 * 从请求头拿到token，验证后把用户信息挂到req.user上，后面的路由就能直接用了
 */
const protect = async (req, res, next) => {
  let token;

  // 从请求头获取token，格式是 "Bearer xxxxx"
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 没token就直接返回未授权
  if (!token) {
    return res.status(401).json({ message: "认证失败，没有提供 token" });
  }

  try {
    // 验证token，拿到里面的用户id
    const decoded = jwt.verify(token, config.jwt.secret);

    // 用id去数据库查用户信息
    const userResult = await pool.query(
      `SELECT id, email, phone, role, avatar_url, full_name, 
              contact_email, contact_phone, created_at
         FROM users WHERE id = $1`,
      [decoded.id]
    );

    // 用户不存在（可能被删了）
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "认证失败，用户不存在" });
    }

    // 把用户信息挂到req上，后面的路由就能通过req.user拿到了
    req.user = userResult.rows[0];
    next();
  } catch (error) {
    logger.error("Token验证失败:", error);

    // 根据错误类型返回不同的提示
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: handleJWTError().message });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: handleJWTExpiredError().message });
    }

    res.status(401).json({ message: "认证失败，token无效" });
  }
};

module.exports = { protect };
