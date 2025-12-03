// 引入必要的库
const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const jwt = require("jsonwebtoken");

// 引入 http 和 socket.io 库
const http = require("http");
const { Server } = require("socket.io");

// 加载数据库连接
const pool = require("./db");

// 引入配置和工具
const { getConfig } = require("./config/env");
const {
  validateEmail,
  validatePhone,
  validateFullName,
  normalizeEmail,
  normalizePhone,
} = require("./utils/validation");
const logger = require("./utils/logger");
const { apiLimiter, authLimiter, uploadLimiter } = require("./middleware/rateLimiter");
const {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  handleDBError,
} = require("./middleware/errorHandler");
const {
  validateRegister,
  validateLogin,
  validateRequestPasswordReset,
  validateResetPassword,
} = require("./middleware/validators");

const { protect } = require("./middleware/authMiddleware");

// 文档路由（拆分后）
const documentBaseRoutes = require("./routes/documentBaseRoutes");
const documentVersionRoutes = require("./routes/documentVersionRoutes");
const documentTemplateRoutes = require("./routes/documentTemplateRoutes");
const documentCollaboratorRoutes = require("./routes/documentCollaboratorRoutes");
const documentImportExportRoutes = require("./routes/documentImportExportRoutes");
const documentLockRoutes = require("./routes/documentLockRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const commentRoutes = require("./routes/commentRoutes");
const taskRoutes = require("./routes/taskRoutes");
const { createNotificationRoutes } = require("./routes/notificationRoutes");
const chatRoutes = require("./routes/chatRoutes");
const fileRoutes = require("./routes/fileRoutes");
const crypto = require("crypto");
const { logUserActivity, logSystemLog } = require("./services/activityService");

// 获取配置
const config = getConfig();

// 初始化 Express 应用
const app = express();

// --- (新增) 创建 HTTP 服务器并集成 Express ---
const server = http.createServer(app);
// ---

// --- (新增) 初始化 Socket.IO 服务器 ---
const io = new Server(server, {
  cors: {
    origin: config.cors.origins, // 使用配置中的 CORS origins
    methods: ["GET", "POST"],
  },
});
// ---

// 新增：用于追踪每个房间里的用户
const roomOccupants = {};

// 中间件配置
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  })
);
app.use(express.json());

// 应用全局速率限制
app.use("/api", apiLimiter);

// --- API 路由定义 ---

// 1. 用户注册路由（应用认证速率限制和输入验证）
app.post(
  "/api/auth/register",
  authLimiter,
  validateRegister,
  asyncHandler(async (req, res, next) => {
    const { email, phone, password, fullName, contactEmail, contactPhone } = req.body;

    // 检查注册是否启用
    try {
      const registrationSetting = await pool.query(
        "SELECT setting_value FROM system_settings WHERE setting_key = 'enable_registration'"
      );
      const registrationEnabled =
        registrationSetting.rows.length > 0
          ? registrationSetting.rows[0].setting_value === "true"
          : true; // 默认启用

      if (!registrationEnabled) {
        return res.status(403).json({ message: "注册功能已关闭，请联系管理员" });
      }
    } catch (error) {
      logger.error("检查注册设置失败:", error);
      // 如果查询失败，继续执行（向后兼容）
    }

    // 验证必填字段
    if (!email || !email.trim()) {
      return res.status(400).json({ message: "请填写邮箱" });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: "请填写手机号" });
    }

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ message: "请填写姓名" });
    }

    if (!password || !password.trim()) {
      return res.status(400).json({ message: "请填写密码" });
    }

    // 验证邮箱格式
    if (!validateEmail(email)) {
      return res
        .status(400)
        .json({ message: "邮箱格式不正确，请使用有效的邮箱地址（例如：name@example.com）" });
    }

    // 验证手机号格式
    if (!validatePhone(phone)) {
      return res
        .status(400)
        .json({ message: "手机号格式不正确，请输入11位有效的中国大陆手机号（以1开头）" });
    }

    // 验证姓名格式
    if (!validateFullName(fullName)) {
      return res
        .status(400)
        .json({
          message:
            "姓名格式不正确，姓名不能为空、不能全是数字，长度应在2-50个字符之间，且应包含至少一个汉字或英文字母",
        });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    // 从系统设置获取密码最小长度
    let minPasswordLength = 6; // 默认值
    try {
      const passwordLengthSetting = await pool.query(
        "SELECT setting_value FROM system_settings WHERE setting_key = 'password_min_length'"
      );
      if (passwordLengthSetting.rows.length > 0) {
        minPasswordLength = parseInt(passwordLengthSetting.rows[0].setting_value, 10) || 6;
      }
    } catch (error) {
      logger.error("获取密码长度设置失败:", error);
      // 如果查询失败，使用默认值
    }

    if (password.length < minPasswordLength) {
      return res.status(400).json({
        message: `密码长度不能少于 ${minPasswordLength} 位`,
      });
    }

    // 验证联系邮箱（如果提供）
    if (contactEmail && contactEmail.trim() && !validateEmail(contactEmail)) {
      return res.status(400).json({ message: "联系邮箱格式不正确，请使用有效的邮箱地址" });
    }

    // 验证联系手机号（如果提供）
    if (contactPhone && contactPhone.trim() && !validatePhone(contactPhone)) {
      return res
        .status(400)
        .json({ message: "联系手机号格式不正确，请输入11位有效的中国大陆手机号" });
    }

    try {
      // 检查邮箱是否已存在
      const emailExists = await pool.query("SELECT 1 FROM users WHERE email = $1", [
        normalizedEmail,
      ]);
      if (emailExists.rows.length > 0) {
        return res.status(409).json({ message: "该邮箱已被注册" });
      }

      // 检查手机号是否已存在
      const phoneExists = await pool.query("SELECT 1 FROM users WHERE phone = $1", [
        normalizedPhone,
      ]);
      if (phoneExists.rows.length > 0) {
        return res.status(409).json({ message: "该手机号已被注册" });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const preferredContactEmail = contactEmail
        ? contactEmail.trim().toLowerCase()
        : normalizedEmail;
      const preferredContactPhone = contactPhone ? contactPhone.trim() : normalizedPhone;

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
          fullName.trim(),
          preferredContactEmail,
          preferredContactPhone,
        ]
      );

      // 记录注册活动
      logUserActivity(newUser.rows[0].id, "register", null, null, null, req).catch((err) => {
        logger.error("记录注册活动失败:", err);
      });

      res.status(201).json({
        message: "用户注册成功",
        user: newUser.rows[0],
      });
    } catch (error) {
      logger.error("注册过程中发生错误:", error);

      // 记录系统错误日志
      logSystemLog(
        "error",
        "security",
        `用户注册失败: ${error.message}`,
        { stack: error.stack, code: error.code, email: req.body.email },
        null,
        req
      ).catch((err) => console.error("记录错误日志失败:", err));

      // 处理数据库错误
      if (error.code && error.code.startsWith("23")) {
        return next(handleDBError(error));
      }
      next(new AppError("注册失败，请稍后重试", 500));
    }
  })
);

// 2. 用户登录路由（应用认证速率限制和输入验证）
app.post(
  "/api/auth/login",
  authLimiter,
  validateLogin,
  asyncHandler(async (req, res, next) => {
    const { identifier, password } = req.body;

    const normalizedIdentifier = identifier ? identifier.trim() : "";

    if (!normalizedIdentifier || !password) {
      return res.status(400).json({ message: "登录失败：请输入邮箱/手机号和密码" });
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
        return res.status(401).json({ message: "认证失败：账号或密码不正确" });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        return res.status(401).json({ message: "认证失败：账号或密码不正确" });
      }

      const token = jwt.sign(
        {
          id: user.id,
          role: user.role,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      const { password_hash, ...safeUser } = user;

      // 记录登录活动
      logUserActivity(safeUser.id, "login", null, null, null, req).catch((err) => {
        logger.error("记录登录活动失败:", err);
      });

      res.status(200).json({
        message: "登录成功",
        token,
        user: safeUser,
      });
    } catch (error) {
      logger.error("登录过程中发生错误:", error);

      // 记录系统错误日志
      logSystemLog(
        "error",
        "security",
        `用户登录失败: ${error.message}`,
        { stack: error.stack, code: error.code, identifier: normalizedIdentifier },
        null,
        req
      ).catch((err) => console.error("记录错误日志失败:", err));

      next(new AppError("登录失败，请稍后重试", 500));
    }
  })
);

// --- (新增) 3. 请求密码重置路由（应用认证速率限制和输入验证） ---
app.post(
  "/api/auth/request-password-reset",
  authLimiter,
  validateRequestPasswordReset,
  asyncHandler(async (req, res, next) => {
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

      logger.info("--- 模拟发送密码重置邮件 ---");
      logger.info(`收件人: ${recipientEmail}`);
      logger.info(`重置链接: ${resetUrl}`);
      logger.info("--------------------------");

      res.status(200).json({
        message: "如果该账号存在，一封密码重置通知已发送",
      });
    } catch (error) {
      logger.error("请求密码重置时出错:", error);
      next(new AppError("请求密码重置失败，请稍后重试", 500));
    }
  })
);

// --- (新增) 4. 重置密码路由（应用认证速率限制和输入验证） ---
app.post(
  "/api/auth/reset-password",
  authLimiter,
  validateResetPassword,
  asyncHandler(async (req, res, next) => {
    const { token, newPassword } = req.body;

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
      logger.error("重置密码时出错:", error);
      next(new AppError("重置密码失败，请稍后重试", 500));
    }
  })
);

// --- (新增) 用户搜索 API ---
app.get(
  "/api/users/search",
  protect,
  asyncHandler(async (req, res, next) => {
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
      logger.error("搜索用户失败:", error);
      next(new AppError("搜索用户失败，请稍后重试", 500));
    }
  })
);

// --- (新增) 配置静态文件服务 ---
// 这使得可以通过 http://localhost:5000/avatars/filename.png 这样的URL访问图片
app.use(express.static("public"));

app.use("/api/admin", adminRoutes);

// 3. --- 挂载用户路由 ---
app.use("/api/users", userRoutes);
// 4. --- 挂载文档路由（拆分后，传入 io 实例） ---
// 注意：模板路由必须在 /:id 路由之前，否则 /templates 会被 /:id 匹配
app.use("/api/documents", documentTemplateRoutes(io));
app.use("/api/documents", documentBaseRoutes(io));
app.use("/api/documents", documentVersionRoutes(io));
app.use("/api/documents", documentCollaboratorRoutes(io));
app.use("/api/documents", documentImportExportRoutes(io));
app.use("/api/documents", documentLockRoutes(io));

// 5. --- 挂载评论路由（传入 io 实例） ---
app.use("/api", commentRoutes(io));

// 6. --- 挂载任务路由（传入 io 实例） ---
app.use("/api", taskRoutes(io));

// 7. --- 挂载通知路由（传入 io 实例） ---
app.use("/api", createNotificationRoutes(io));

// 8. --- 挂载聊天路由（传入 io 实例） ---
app.use("/api", chatRoutes(io));

// 9. --- 挂载文件路由（传入 io 实例，应用上传速率限制） ---
app.use("/api/files", uploadLimiter);
app.use("/api", fileRoutes(io));

// --- 404 处理（必须在所有路由之后） ---
app.use(notFoundHandler);

// --- 全局错误处理（必须在所有路由之后） ---
app.use(errorHandler);

// --- (修改) WebSocket 实时协作逻辑 ---
io.on("connection", (socket) => {
  // 只在开发环境记录连接日志
  if (config.server.nodeEnv === "development") {
    logger.debug("一个客户端已连接:", socket.id);
  }

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

    // 只在开发环境记录加入房间日志
    if (config.server.nodeEnv === "development") {
      logger.debug(
        `用户 ${user?.email || user?.full_name || "未知"} (${
          socket.id
        }) 加入了文档房间 ${documentId}`
      );
    }

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
    // 只在开发环境记录断开连接日志
    if (config.server.nodeEnv === "development") {
      logger.debug("客户端已断开连接:", socket.id);
    }

    // --- 新增逻辑 ---
    const { documentId, user } = socket;
    if (documentId && user) {
      // 从房间的用户列表中移除该用户
      if (roomOccupants[documentId]) {
        roomOccupants[documentId] = roomOccupants[documentId].filter((u) => u.id !== user.id);

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
server.listen(config.server.port, () => {
  logger.info(`🚀 服务器正在 http://localhost:${config.server.port} 上运行`);
  logger.info(`📡 WebSocket 服务器已启动，监听实时连接`);
  logger.info(`🌍 环境: ${config.server.nodeEnv}`);
  logger.info(`🔒 CORS 允许的源: ${config.cors.origins.join(", ")}`);
});

// 处理未捕获的异常
process.on("uncaughtException", (err) => {
  logger.error("未捕获的异常:", err);
  process.exit(1);
});

// 处理未处理的 Promise 拒绝
process.on("unhandledRejection", (reason, promise) => {
  logger.error("未处理的 Promise 拒绝:", reason);
  process.exit(1);
});
