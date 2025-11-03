const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

// 我们需要再次配置数据库连接池来查询用户信息
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 这就是我们的“保安”中间件
const protect = async (req, res, next) => {
  let token;

  // 1. 从请求头中寻找令牌
  // 客户端应该在 Authorization 头中以 'Bearer <token>' 的格式发送令牌
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // 提取令牌 (去掉 'Bearer ' 前缀)
      token = req.headers.authorization.split(" ")[1];

      // 2. 验证令牌
      // jwt.verify 会解码令牌，如果令牌无效或已过期，它会抛出错误
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. 从数据库中获取用户信息，并附加到请求对象上
      // 我们不选择密码哈希值，确保它不会泄露
      const userResult = await pool.query(
        "SELECT id, email, created_at FROM users WHERE id = $1",
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ message: "认证失败，用户不存在" });
      }

      // 将用户信息附加到 req 对象，这样后续的路由处理函数就能直接使用 req.user
      req.user = userResult.rows[0];

      // 4. 一切正常，调用 next() 将控制权交给下一个中间件或路由处理函数
      next();
    } catch (error) {
      console.error("令牌验证失败:", error.message);
      return res.status(401).json({ message: "认证失败，无效的令牌" });
    }
  }

  // 如果请求头中没有令牌
  if (!token) {
    return res.status(401).json({ message: "认证失败，缺少令牌" });
  }
};

module.exports = { protect };
