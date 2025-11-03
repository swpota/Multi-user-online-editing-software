// 引入必要的库
require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const jwt = require("jsonwebtoken");

// --- (新增) 引入 http 和 socket.io ---
const http = require("http");
const { Server } = require("socket.io");
// ---

const { protect } = require("./middleware/authMiddleware");
const documentRoutes = require("./routes/documentRoutes");

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

// 数据库连接池配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- API 路由定义 ---

// 1. 用户注册路由
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "邮箱和密码不能为空" });
  }

  try {
    const userExists = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: "该邮箱已被注册" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
      [email, passwordHash]
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
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "邮箱和密码不能为空" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "认证失败：无效的邮箱或密码" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: "认证失败：无效的邮箱或密码" });
    }

    const payload = {
      userId: user.id,
      email: user.email,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({
      message: "登录成功",
      token: token,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("登录过程中发生错误:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 3. 受保护的用户信息路由
app.get("/api/users/profile", protect, (req, res) => {
  res.status(200).json({
    message: "成功获取用户个人信息",
    user: req.user,
  });
});

// 4. --- 挂载文档路由 ---
app.use("/api/documents", documentRoutes);

// --- (修改) WebSocket 实时协作逻辑 ---
io.on("connection", (socket) => {
  console.log("一个客户端已连接:", socket.id);

  // 1. 当用户加入一个文档房间时
  socket.on("joinDocument", (data) => {
    const { documentId, user } = data;

    // --- 新增逻辑 ---
    socket.join(documentId);
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

  // 3. 当一个文档被保存时 (无变化)
  socket.on("saveDocument", async (data) => {
    try {
      const { documentId, content } = data;
      await pool.query(
        "UPDATE documents SET content = $1, updated_at = NOW() WHERE id = $2",
        [content, documentId]
      );
      socket.emit("documentSaved", "已保存");
    } catch (error) {
      console.error("保存文档时出错:", error);
      socket.emit("saveError", "保存失败");
    }
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
