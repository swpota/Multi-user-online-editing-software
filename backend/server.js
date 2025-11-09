// 引入必要的库
require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const pool = require("./db");
// --- (新增) 引入 http 和 socket.io ---
const http = require("http");
const { Server } = require("socket.io");
// ---

const { protect } = require("./middleware/authMiddleware");
const documentRoutes = require("./routes/documentRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const commentRoutes = require("./routes/commentRoutes");
const taskRoutes = require("./routes/taskRoutes");
const { createNotificationRoutes } = require("./routes/notificationRoutes");
const chatRoutes = require("./routes/chatRoutes");
const fileRoutes = require("./routes/fileRoutes");
const crypto = require("crypto");

// 初始化 Express 应用
const app = express();

// --- (新增) 创建 HTTP 服务器并集成 Express ---
const server = http.createServer(app);
// ---

// --- (新增) 初始化 Socket.IO 服务器 ---
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // 允许你的前端地址进行连接
    methods: ["GET", "POST"],
  },
});
// ---

// 新增：用于追踪每个房间里的用户
const roomOccupants = {};

const PORT = process.env.PORT || 5000;

// 中间件配置
app.use(cors());
app.use(express.json());

// --- API 路由定义 ---

// 1. 用户注册路由
app.post("/api/auth/register", async (req, res) => {
  const {
    email,
    phone,
    password,
    fullName,
    contactEmail,
    contactPhone,
  } = req.body;

  const normalizedEmail = email ? email.trim().toLowerCase() : null;
  const normalizedPhone = phone ? phone.trim() : null;

  if ((!normalizedEmail && !normalizedPhone) || !password) {
    return res
      .status(400)
      .json({ message: "注册失败：至少提供邮箱或手机号，并设置密码" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "密码长度不能少于 6 位" });
  }

  try {
    if (normalizedEmail) {
      const emailExists = await pool.query(
        "SELECT 1 FROM users WHERE email = $1",
        [normalizedEmail]
      );
      if (emailExists.rows.length > 0) {
        return res.status(409).json({ message: "该邮箱已被注册" });
      }
    }

    if (normalizedPhone) {
      const phoneExists = await pool.query(
        "SELECT 1 FROM users WHERE phone = $1",
        [normalizedPhone]
      );
      if (phoneExists.rows.length > 0) {
        return res.status(409).json({ message: "该手机号已被注册" });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const preferredContactEmail = contactEmail
      ? contactEmail.trim().toLowerCase()
      : normalizedEmail;
    const preferredContactPhone = contactPhone
      ? contactPhone.trim()
      : normalizedPhone;

    const newUser = await pool.query(
      `INSERT INTO users (email,
                          phone,
                          password_hash,
                          role,
                          full_name,
                          contact_email,
                          contact_phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id,
               email,
               phone,
               role,
               avatar_url,
               full_name,
               contact_email,
               contact_phone,
               created_at`,
      [
        normalizedEmail,
        normalizedPhone,
        passwordHash,
        "editor",
        fullName ? fullName.trim() : null,
        preferredContactEmail,
        preferredContactPhone,
      ]
    );

    res.status(201).json({
      message: "用户注册成功",
      user: newUser.rows[0],
    });
  } catch (error) {
    console.error("注册过程中发生错误:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 2. 用户登录路由
app.post("/api/auth/login", async (req, res) => {
  const { identifier, password } = req.body;

  const normalizedIdentifier = identifier ? identifier.trim() : "";

  if (!normalizedIdentifier || !password) {
    return res
      .status(400)
      .json({ message: "登录失败：请输入邮箱/手机号和密码" });
  }

  try {
    const isEmail = normalizedIdentifier.includes("@");

    const result = await pool.query(
      `SELECT id,
              email,
              phone,
              role,
              avatar_url,
              password_hash,
              full_name,
              contact_email,
              contact_phone,
              created_at
         FROM users
        WHERE ${isEmail ? "LOWER(email) = $1" : "phone = $1"}`,
      [isEmail ? normalizedIdentifier.toLowerCase() : normalizedIdentifier]
    );

    const user = result.rows[0];

    if (!user) {
      return res
        .status(401)
        .json({ message: "认证失败：账号或密码不正确" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "认证失败：账号或密码不正确" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const { password_hash, ...safeUser } = user;

    res.status(200).json({
      message: "登录成功",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("登录过程中发生错误:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// --- (新增) 3. 请求密码重置路由 ---
app.post("/api/auth/request-password-reset", async (req, res) => {
  const { identifier } = req.body;

  const normalizedIdentifier = identifier ? identifier.trim() : "";

  if (!normalizedIdentifier) {
    return res.status(400).json({ message: "请输入邮箱或手机号" });
  }

  try {
    const isEmail = normalizedIdentifier.includes("@");
    const userResult = await pool.query(
      `SELECT id,
              email,
              phone,
              contact_email
         FROM users
        WHERE ${isEmail ? "LOWER(email) = $1" : "phone = $1"}`,
      [isEmail ? normalizedIdentifier.toLowerCase() : normalizedIdentifier]
    );
    const user = userResult.rows[0];

    // 安全性：即使找不到用户，也返回一个成功的消息
    if (!user) {
      return res.status(200).json({
        message: "如果该账号存在，一封密码重置通知已发送",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000);

    await pool.query(
      "UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3",
      [resetToken, expires, user.id]
    );

    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;
    const recipientEmail = user.email || user.contact_email || "<未设置邮箱>";

    console.log("--- 模拟发送密码重置邮件 ---");
    console.log(`收件人: ${recipientEmail}`);
    console.log(`重置链接: ${resetUrl}`);
    console.log("--------------------------");

    res.status(200).json({
      message: "如果该账号存在，一封密码重置通知已发送",
    });
  } catch (error) {
    console.error("请求密码重置时出错:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// --- (新增) 4. 重置密码路由 ---
app.post("/api/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: "令牌和新密码不能为空" });
  }

  try {
    // 1. 查找用户，同时验证 token 是否匹配且未过期
    // a. token 必须与数据库中的完全一致
    // b. reset_password_expires 必须是未来的时间 (大于 NOW())
    const userResult = await pool.query(
      "SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()",
      [token]
    );

    const user = userResult.rows[0];

    if (!user) {
      // 如果找不到，说明 token 无效或已过期
      return res.status(400).json({ message: "密码重置令牌无效或已过期" });
    }

    // 2. 将新密码哈希化
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 3. 更新用户密码
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      user.id,
    ]);

    // 4. (重要安全步骤) 清除已使用的重置令牌，防止重复使用
    await pool.query(
      "UPDATE users SET reset_password_token = NULL, reset_password_expires = NULL WHERE id = $1",
      [user.id]
    );

    res.status(200).json({ message: "密码已成功重置" });
  } catch (error) {
    console.error("重置密码时出错:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// --- (新增) 用户搜索 API ---
app.get("/api/users/search", protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    // 使用 ILIKE 进行不区分大小写的模糊搜索，并排除请求者自己
    const users = await pool.query(
      "SELECT id, email FROM users WHERE email ILIKE $1 AND id != $2 LIMIT 5",
      [`%${q}%`, req.user.id]
    );

    res.json(users.rows);
  } catch (error) {
    console.error("搜索用户失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// --- (新增) 配置静态文件服务 ---
// 这使得可以通过 http://localhost:5000/avatars/filename.png 这样的URL访问图片
app.use(express.static("public"));

app.use("/api/admin", adminRoutes);

// 3. --- 挂载用户路由 ---
app.use("/api/users", userRoutes);
// 4. --- 挂载文档路由（传入 io 实例） ---
app.use("/api/documents", documentRoutes(io));

// 5. --- 挂载评论路由（传入 io 实例） ---
app.use("/api", commentRoutes(io));

// 6. --- 挂载任务路由（传入 io 实例） ---
app.use("/api", taskRoutes(io));

// 7. --- 挂载通知路由（传入 io 实例） ---
app.use("/api", createNotificationRoutes(io));

// 8. --- 挂载聊天路由（传入 io 实例） ---
app.use("/api", chatRoutes(io));

// 9. --- 挂载文件路由（传入 io 实例） ---
app.use("/api", fileRoutes(io));

// --- (修改) WebSocket 实时协作逻辑 ---
io.on("connection", (socket) => {
  console.log("一个客户端已连接:", socket.id);

  // 1. 当用户加入一个文档房间时
  socket.on("joinDocument", (data) => {
    const { documentId, user } = data;

    // --- 新增逻辑 ---
    socket.join(documentId);
    // 同时加入用户专属房间，用于接收个人通知（评论提及、任务分配等）
    socket.join(`user_${user.id}`);
    // 将用户信息存储在 socket 实例上，以便在断开连接时使用
    socket.documentId = documentId;
    socket.user = user;

    // 如果房间还不存在，则初始化
    if (!roomOccupants[documentId]) {
      roomOccupants[documentId] = [];
    }

    // 添加新用户到房间列表 (如果尚未存在)
    if (!roomOccupants[documentId].find((u) => u.id === user.id)) {
      roomOccupants[documentId].push(user);
    }

    console.log(
      `用户 ${user.email} (${socket.id}) 加入了文档房间 ${documentId}`
    );

    // 向该房间的所有人广播更新后的用户列表
    io.to(documentId).emit("updateUserList", roomOccupants[documentId]);
    // --- 结束新增 ---
  });

  // 2. 当用户发送文档内容变更时 (无变化)
  socket.on("documentChange", (data) => {
    const { documentId, delta } = data;
    socket.to(documentId).emit("receiveChange", delta);
  });

  socket.on("documentMetadataChange", (data) => {
    const { documentId, updates } = data;
    if (!documentId || !updates || typeof updates !== "object") {
      return;
    }
    socket.to(documentId).emit("receiveMetadata", updates);
  });

  // 新增：4. 当用户光标位置或选择范围变化时
  socket.on("cursorChange", (data) => {
    const { documentId, range, user } = data;
    // 将光标信息广播给除发送者外的所有其他客户端
    socket.to(documentId).emit("receiveCursor", { range, user });
  });

  // 当客户端断开连接时
  socket.on("disconnect", () => {
    console.log("客户端已断开连接:", socket.id);

    // --- 新增逻辑 ---
    const { documentId, user } = socket;
    if (documentId && user) {
      // 从房间的用户列表中移除该用户
      if (roomOccupants[documentId]) {
        roomOccupants[documentId] = roomOccupants[documentId].filter(
          (u) => u.id !== user.id
        );

        // 如果房间空了，可以从内存中删除这个房间
        if (roomOccupants[documentId].length === 0) {
          delete roomOccupants[documentId];
        } else {
          // 否则，向房间内剩余的人广播更新后的用户列表
          io.to(documentId).emit("updateUserList", roomOccupants[documentId]);
        }
      }
    }
    // --- 结束新增 ---
  });
});
// ---

// --- (修改) 启动服务器 ---
// 我们现在启动的是集成了 Express 的 http 服务器
server.listen(PORT, () => {
  console.log(
    `服务器正在 http://localhost:${PORT} 上运行，并监听 WebSocket 连接`
  );
});
