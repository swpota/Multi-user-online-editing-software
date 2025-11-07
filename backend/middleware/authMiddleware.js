const jwt = require("jsonwebtoken");
const pool = require("../db");

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
    console.error("Token 验证失败:", error);
    res.status(401).json({ message: "认证失败，token 无效" });
  }
};

module.exports = { protect };
