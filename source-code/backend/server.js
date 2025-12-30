/**
 * 服务器入口文件
 *
 * 使用Express作为Web框架，Socket.io实现WebSocket实时通信。
 * 两者共用一个HTTP服务器，都监听5000端口。
 *
 * 主要职责：
 * - 处理用户认证（注册、登录、密码重置）
 * - 挂载各功能模块的路由
 * - 管理Socket.io连接和文档协作房间
 */
const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
const pool = require("./db");
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

// 各功能模块的路由
const documentBaseRoutes = require("./routes/documentBaseRoutes"); // 文档CRUD
const documentVersionRoutes = require("./routes/documentVersionRoutes"); // 版本管理
const documentTemplateRoutes = require("./routes/documentTemplateRoutes"); // 模板
const documentCollaboratorRoutes = require("./routes/documentCollaboratorRoutes"); // 协作者
const documentImportExportRoutes = require("./routes/documentImportExportRoutes"); // 导入导出
const documentLockRoutes = require("./routes/documentLockRoutes"); // 文档锁定
const userRoutes = require("./routes/userRoutes"); // 用户管理
const adminRoutes = require("./routes/adminRoutes"); // 管理后台
const commentRoutes = require("./routes/commentRoutes"); // 评论
const taskRoutes = require("./routes/taskRoutes"); // 任务
const { createNotificationRoutes } = require("./routes/notificationRoutes"); // 通知
const chatRoutes = require("./routes/chatRoutes"); // 聊天
const fileRoutes = require("./routes/fileRoutes"); // 文件
const crypto = require("crypto");
const { logUserActivity, logSystemLog } = require("./services/activityService");

const config = getConfig();
const app = express();

// Express和Socket.io共用一个HTTP服务器
const server = http.createServer(app);

// Socket.io初始化，配置跨域
const io = new Server(server, {
  cors: {
    origin: config.cors.origins,
    methods: ["GET", "POST"],
  },
});

// 追踪每个文档房间的在线用户
// key是documentId，value是用户信息数组
const roomOccupants = {};

// 基础中间件配置
app.use(cors({ origin: config.cors.origins, credentials: true }));
app.use(express.json());
app.use("/api", apiLimiter); // 所有API接口都有速率限制

// ============ 用户注册 ============
// 注册时会检查邮箱/手机是否已存在，密码用bcrypt加密存储
app.post(
  "/api/auth/register",
  authLimiter, // 认证接口有更严格的速率限制
  validateRegister,
  asyncHandler(async (req, res, next) => {
    const { email, phone, password, fullName, contactEmail, contactPhone } = req.body;

    // 先检查系统是否允许注册
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
      return res.status(400).json({
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

// ============ 用户登录 ============
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

// ============ 请求密码重置 ============
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

// ============ 重置密码 ============
app.post(
  "/api/auth/reset-password",
  authLimiter,
  validateResetPassword,
  asyncHandler(async (req, res, next) => {
    const { token, newPassword } = req.body;

    try {
      // 从系统设置获取密码最小长度
      let minPasswordLength = 6;
      try {
        const passwordLengthSetting = await pool.query(
          "SELECT setting_value FROM system_settings WHERE setting_key = 'password_min_length'"
        );
        if (passwordLengthSetting.rows.length > 0) {
          minPasswordLength = parseInt(passwordLengthSetting.rows[0].setting_value, 10) || 6;
        }
      } catch (settingError) {
        logger.warn("获取密码长度设置失败，使用默认值:", settingError);
      }

      // 验证密码长度
      if (newPassword.length < minPasswordLength) {
        return res.status(400).json({
          message: `新密码长度不能少于 ${minPasswordLength} 位`,
        });
      }

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

// ============ 用户搜索 ============
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

// 静态文件（头像等）
app.use(express.static("public"));

// ============ 挂载各模块路由 ============
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
// 文档相关路由（模板路由要放在/:id前面，不然会被匹配掉）
app.use("/api/documents", documentTemplateRoutes(io));
app.use("/api/documents", documentBaseRoutes(io));
app.use("/api/documents", documentVersionRoutes(io));
app.use("/api/documents", documentCollaboratorRoutes(io));
app.use("/api/documents", documentImportExportRoutes(io));
app.use("/api/documents", documentLockRoutes(io));
// 其他功能路由
app.use("/api", commentRoutes(io));
app.use("/api", taskRoutes(io));
app.use("/api", createNotificationRoutes(io));
app.use("/api", chatRoutes(io));
app.use("/api/files", uploadLimiter);
app.use("/api", fileRoutes(io));

// 错误处理
app.use(notFoundHandler);
app.use(errorHandler);

// ============ WebSocket实时协作 核心逻辑 ============
io.on("connection", (socket) => {
  if (config.server.nodeEnv === "development") {
    logger.debug("客户端已连接:", socket.id);
  }

  // 用户加入文档房间
  socket.on("joinDocument", (data) => {
    const { documentId, user } = data;

    // 加入文档房间和用户专属房间（用于接收通知）
    socket.join(documentId);
    socket.join(`user_${user.id}`);
    socket.documentId = documentId;
    socket.user = user;

    // 维护房间在线用户列表
    if (!roomOccupants[documentId]) {
      roomOccupants[documentId] = [];
    }
    if (!roomOccupants[documentId].find((u) => u.id === user.id)) {
      roomOccupants[documentId].push(user);
    }

    if (config.server.nodeEnv === "development") {
      logger.debug(`用户 ${user?.email || user?.full_name || "未知"} 加入了文档 ${documentId}`);
    }

    // 广播最新的在线用户列表
    io.to(documentId).emit("updateUserList", roomOccupants[documentId]);
  });

  // 收到用户的编辑内容，转发给同一文档的其他人
  socket.on("documentChange", (data) => {
    const { documentId, delta } = data;
    socket.to(documentId).emit("receiveChange", delta);
  });

  // 收到元数据变更（标题、分类等）
  socket.on("documentMetadataChange", (data) => {
    const { documentId, updates } = data;
    if (!documentId || !updates || typeof updates !== "object") {
      return;
    }
    socket.to(documentId).emit("receiveMetadata", updates);
  });

  // 收到光标位置变化，转发给其他人显示协作光标
  socket.on("cursorChange", (data) => {
    const { documentId, range, user } = data;
    socket.to(documentId).emit("receiveCursor", { range, user });
  });

  // 用户断开连接，从房间列表移除
  socket.on("disconnect", () => {
    if (config.server.nodeEnv === "development") {
      logger.debug("客户端已断开:", socket.id);
    }

    const { documentId, user } = socket;
    if (documentId && user && roomOccupants[documentId]) {
      roomOccupants[documentId] = roomOccupants[documentId].filter((u) => u.id !== user.id);
      if (roomOccupants[documentId].length === 0) {
        delete roomOccupants[documentId];
      } else {
        io.to(documentId).emit("updateUserList", roomOccupants[documentId]);
      }
    }
  });
});

// ============ 启动服务器 ============
server.listen(config.server.port, () => {
  logger.info(`服务器正在 http://localhost:${config.server.port} 上运行`);
  logger.info(`WebSocket 服务器已启动，监听实时连接`);
  logger.info(`环境: ${config.server.nodeEnv}`);
  logger.info(`CORS 允许的源: ${config.cors.origins.join(", ")}`);
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
