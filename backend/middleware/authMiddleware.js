const jwt = require("jsonwebtoken");
const pool = require("../db");
const { getConfig } = require("../config/env");
const { handleJWTError, handleJWTExpiredError, AppError } = require("./errorHandler");
const logger = require("../utils/logger");

const config = getConfig();

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "认证失败，没有提供 token" });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    const userResult = await pool.query(
      `SELECT id,
              email,
              phone,
              role,
              avatar_url,
              full_name,
              contact_email,
              contact_phone,
              created_at
         FROM users
        WHERE id = $1`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "认证失败，用户不存在" });
    }

    req.user = userResult.rows[0];

    next();
  } catch (error) {
    logger.error("Token 验证失败:", error);
    
    // 处理 JWT 错误
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: handleJWTError().message });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: handleJWTExpiredError().message });
    }
    
    res.status(401).json({ message: "认证失败，token 无效" });
  }
};

module.exports = { protect };
