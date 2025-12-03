/**
 * 聊天消息路由模块
 * 功能：提供文档内的实时聊天功能
 * 特性：
 * 1. 文本消息发送和接收
 * 2. 文件消息上传和下载
 * 3. 消息回复功能
 * 4. 实时消息推送（Socket.IO）
 * 5. 消息删除
 */

// 引入Express框架，用于创建路由
const express = require("express");
// 引入JWT认证中间件，确保只有登录用户才能访问聊天功能
const { protect } = require("../middleware/authMiddleware");
// 引入数据库连接池，用于查询和存储聊天消息
const pool = require("../db");
// 引入multer库，用于处理文件上传
const multer = require("multer");
// 引入path模块，用于处理文件路径
const path = require("path");
// 引入fs模块，用于文件系统操作（删除、检查文件是否存在）
const fs = require("fs");

/**
 * 配置multer文件上传中间件
 * 用于处理聊天中的文件分享功能
 */
const upload = multer({
  // 上传文件的临时存储目录
  dest: "uploads/",
  
  // 文件大小限制
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB = 10 * 1024 * 1024 字节
  },
  
  // 文件过滤器：决定哪些文件类型可以上传
  fileFilter: (req, file, cb) => {
    // 当前允许所有文件类型
    // 可以在这里添加文件类型限制，例如：
    // if (!file.mimetype.startsWith('image/')) {
    //   return cb(new Error('只允许上传图片'));
    // }
    cb(null, true);  // null表示没有错误，true表示接受文件
  },
});

/**
 * createChatRoutes - 创建聊天路由
 * 
 * @param {object} io - Socket.IO实例，用于实时消息推送
 * @returns {Router} - Express路由器
 */
const createChatRoutes = (io) => {
  // 创建Express路由器实例
  const router = express.Router();

  /**
   * GET /api/documents/:documentId/chat-messages
   * 获取文档的聊天消息列表
   * 
   * 功能：分页获取指定文档的聊天消息，包括用户信息和回复关系
   * 权限：需要登录，且对文档有访问权限（owner或collaborator）
   * 
   * 请求参数：
   * - documentId (路径参数): 文档ID
   * - limit (查询参数): 每页消息数，默认50
   * - offset (查询参数): 偏移量，默认0
   * 
   * 响应：
   * - messages: 消息数组（倒序，最新的在最后）
   * - total: 总消息数
   * - limit: 每页数量
   * - offset: 当前偏移
   */
  router.get(
    "/documents/:documentId/chat-messages",
    protect,  // 应用JWT认证中间件
    async (req, res) => {
      try {
        // 从URL路径中提取文档ID，转换为整数
        const documentId = parseInt(req.params.documentId, 10);
        // 从查询参数中获取分页参数，设置默认值
        const { limit = 50, offset = 0 } = req.query;

        // 第一步：检查用户是否有权限查看文档
        // 使用CASE语句判断用户角色：owner、editor、viewer或无权限
        const docCheck = await pool.query(
          `SELECT d.id, d.owner_id,
                  CASE 
                    WHEN d.owner_id = $2 THEN 'owner'
                    WHEN EXISTS (
                      SELECT 1 FROM document_collaborators dc 
                      WHERE dc.document_id = d.id AND dc.user_id = $2
                    ) THEN (
                      SELECT dc.role FROM document_collaborators dc 
                      WHERE dc.document_id = d.id AND dc.user_id = $2
                    )
                    ELSE NULL
                  END as user_role
           FROM documents d
           WHERE d.id = $1`,
          [documentId, req.user.id]
        );

        // 如果文档不存在，返回404错误
        if (docCheck.rows.length === 0) {
          return res.status(404).json({ message: "文档不存在" });
        }

        // 提取用户角色
        const userRole = docCheck.rows[0].user_role;
        // 如果user_role为NULL，说明用户既不是owner也不是collaborator
        if (!userRole) {
          return res.status(403).json({ message: "无权查看该文档的聊天消息" });
        }

        // 第二步：查询聊天消息
        // 使用LEFT JOIN获取消息、发送者信息和被回复消息的信息
        // json_build_object用于在SQL中构建JSON对象
        const result = await pool.query(
          `SELECT 
            cm.*,
            json_build_object(
              'id', u.id,
              'email', u.email,
              'full_name', u.full_name,
              'avatar_url', u.avatar_url
            ) as user,
            json_build_object(
              'id', reply_msg.id,
              'message', reply_msg.message,
              'user', json_build_object(
                'id', reply_user.id,
                'full_name', reply_user.full_name
              )
            ) as reply_to_message
          FROM chat_messages cm
          JOIN users u ON cm.user_id = u.id
          LEFT JOIN chat_messages reply_msg ON cm.reply_to = reply_msg.id
          LEFT JOIN users reply_user ON reply_msg.user_id = reply_user.id
          WHERE cm.document_id = $1
          ORDER BY cm.created_at DESC
          LIMIT $2 OFFSET $3`,
          [documentId, parseInt(limit), parseInt(offset)]
        );

        // 获取总数
        const countResult = await pool.query(
          "SELECT COUNT(*) FROM chat_messages WHERE document_id = $1",
          [documentId]
        );

        res.json({
          messages: result.rows.reverse(), // 反转顺序，最新的在最后
          total: parseInt(countResult.rows[0].count),
          limit: parseInt(limit),
          offset: parseInt(offset),
        });
      } catch (error) {
        console.error("获取聊天消息失败:", error);
        res.status(500).json({ message: "服务器内部错误" });
      }
    }
  );

  /**
   * POST /api/documents/:documentId/chat-messages
   * 发送文本聊天消息
   * 
   * 功能：在指定文档中发送文本消息，支持回复功能
   * 权限：需要登录，且对文档有访问权限
   * 
   * 请求体：
   * - message (必填): 消息内容
   * - replyTo (可选): 回复的消息ID
   * 
   * 响应：返回完整的消息对象（包含用户信息）
   * 
   * 实时推送：通过Socket.IO向文档房间内的所有用户推送新消息
   */
  router.post(
    "/documents/:documentId/chat-messages",
    protect,  // 应用JWT认证中间件
    async (req, res) => {
      try {
        // 从URL路径中提取文档ID
        const documentId = parseInt(req.params.documentId, 10);
        // 从请求体中提取消息内容和回复目标
        const { message, replyTo } = req.body;

        // 验证消息内容不为空
        if (!message || !message.trim()) {
          return res.status(400).json({ message: "消息内容不能为空" });
        }

        // 第一步：检查用户是否有权限访问文档
        // 使用与获取消息相同的权限检查逻辑
        const docCheck = await pool.query(
          `SELECT d.id, d.owner_id,
                  CASE 
                    WHEN d.owner_id = $2 THEN 'owner'
                    WHEN EXISTS (
                      SELECT 1 FROM document_collaborators dc 
                      WHERE dc.document_id = d.id AND dc.user_id = $2
                    ) THEN (
                      SELECT dc.role FROM document_collaborators dc 
                      WHERE dc.document_id = d.id AND dc.user_id = $2
                    )
                    ELSE NULL
                  END as user_role
           FROM documents d
           WHERE d.id = $1`,
          [documentId, req.user.id]
        );

        if (docCheck.rows.length === 0) {
          return res.status(404).json({ message: "文档不存在" });
        }

        // 提取用户角色
        const userRole = docCheck.rows[0].user_role;
        // 如果没有权限，拒绝发送消息
        if (!userRole) {
          return res.status(403).json({ message: "无权在该文档中发送消息" });
        }

        // 第二步：如果是回复消息，验证被回复的消息是否存在
        if (replyTo) {
          const replyCheck = await pool.query(
            "SELECT id FROM chat_messages WHERE id = $1 AND document_id = $2",
            [replyTo, documentId]
          );
          // 如果被回复的消息不存在或不属于该文档，返回404
          if (replyCheck.rows.length === 0) {
            return res.status(404).json({ message: "回复的消息不存在" });
          }
        }

        // 第三步：创建聊天消息
        // 插入消息到chat_messages表，并使用RETURNING返回新建的记录
        const result = await pool.query(
          `INSERT INTO chat_messages (
            document_id, user_id, message, message_type, reply_to
          ) VALUES ($1, $2, $3, $4, $5) 
          RETURNING *`,
          [
            documentId,
            req.user.id,
            message.trim(),
            "text",
            replyTo || null,
          ]
        );

        // 第四步：获取完整的消息信息（包括用户信息和被回复消息）
        // 重新查询是为了获取关联的用户信息，返回给前端的数据更完整
        const fullMessageResult = await pool.query(
          `SELECT 
            cm.*,                          -- 消息的所有字段
            json_build_object(             -- 构建发送者用户信息JSON对象
              'id', u.id,
              'email', u.email,
              'full_name', u.full_name,
              'avatar_url', u.avatar_url
            ) as user,
            json_build_object(             -- 构建被回复消息的JSON对象
              'id', reply_msg.id,
              'message', reply_msg.message,
              'user', json_build_object(   -- 被回复消息的发送者信息
                'id', reply_user.id,
                'full_name', reply_user.full_name
              )
            ) as reply_to_message
          FROM chat_messages cm
          JOIN users u ON cm.user_id = u.id                      -- 关联发送者
          LEFT JOIN chat_messages reply_msg ON cm.reply_to = reply_msg.id  -- 关联被回复消息
          LEFT JOIN users reply_user ON reply_msg.user_id = reply_user.id  -- 关联被回复消息的发送者
          WHERE cm.id = $1`,
          [result.rows[0].id]  // 使用刚插入的消息ID
        );

        const fullMessage = fullMessageResult.rows[0];

        // 第五步：通过Socket.IO实时推送新消息
        // 向该文档的所有在线用户推送新消息，实现实时聊天功能
        if (io) {
          io.to(String(documentId)).emit("newChatMessage", fullMessage);
        }

        // 返回201状态码和完整的消息对象
        res.status(201).json(fullMessage);
      } catch (error) {
        console.error("发送聊天消息失败:", error);
        res.status(500).json({ message: "服务器内部错误" });
      }
    }
  );

  /**
   * POST /api/documents/:documentId/chat-messages/file
   * 上传文件到聊天
   * 
   * 功能：在文档聊天中上传文件（图片、文档等）
   * 权限：需要登录，且对文档有访问权限
   * 
   * 请求：multipart/form-data格式，包含file字段
   * 文件限制：最大10MB
   * 
   * 响应：返回文件消息对象
   * 
   * 特殊处理：
   * - 中文文件名编码转换
   * - 失败时自动删除临时文件
   * - 实时推送
   */
  router.post(
    "/documents/:documentId/chat-messages/file",
    protect,                    // JWT认证中间件
    upload.single("file"),      // multer文件上传中间件，字段名为"file"
    async (req, res) => {
      try {
        // 从URL路径中提取文档ID
        const documentId = parseInt(req.params.documentId, 10);

        // 验证文件是否上传成功
        if (!req.file) {
          return res.status(400).json({ message: "没有上传文件" });
        }

        // 第一步：检查用户是否有权限访问文档
        const docCheck = await pool.query(
          `SELECT d.id, d.owner_id,
                  CASE 
                    WHEN d.owner_id = $2 THEN 'owner'
                    WHEN EXISTS (
                      SELECT 1 FROM document_collaborators dc 
                      WHERE dc.document_id = d.id AND dc.user_id = $2
                    ) THEN (
                      SELECT dc.role FROM document_collaborators dc 
                      WHERE dc.document_id = d.id AND dc.user_id = $2
                    )
                    ELSE NULL
                  END as user_role
           FROM documents d
           WHERE d.id = $1`,
          [documentId, req.user.id]
        );

        // 如果文档不存在
        if (docCheck.rows.length === 0) {
          // 删除已上传的临时文件，避免垃圾文件积累
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ message: "文档不存在" });
        }

        // 提取用户角色
        const userRole = docCheck.rows[0].user_role;
        // 如果没有权限
        if (!userRole) {
          // 删除已上传的临时文件
          fs.unlinkSync(req.file.path);
          return res.status(403).json({ message: "无权在该文档中发送文件" });
        }

        // 第二步：处理文件名编码（支持中文等特殊字符）
        // multer在处理文件名时可能出现编码问题
        let originalName = req.file.originalname;
        try {
          // multer可能错误地将UTF-8字节解释为Latin1
          // 这里通过Buffer重新编码来修复中文文件名乱码问题
          // 例如："测试.txt" 可能被错误编码，需要从latin1转回utf8
          originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        } catch (e) {
          // 如果编码转换失败（例如文件名本身就是ASCII），使用原始文件名
          console.warn('文件名编码转换失败，使用原始文件名:', e);
        }

        // 第三步：创建文件类型的聊天消息
        const result = await pool.query(
          `INSERT INTO chat_messages (
            document_id, user_id, message, message_type,
            file_name, file_path, file_size, file_type
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
          RETURNING *`,
          [
            documentId,              // $1 文档ID
            req.user.id,             // $2 用户ID
            originalName,            // $3 消息内容（显示文件名）
            "file",                  // $4 消息类型为"file"
            originalName,            // $5 文件名
            req.file.path,           // $6 文件路径（multer保存的路径）
            req.file.size,           // $7 文件大小（字节）
            req.file.mimetype,       // $8 文件MIME类型（如image/png）
          ]
        );

        // 第四步：获取完整的消息信息（包括用户信息）
        const fullMessageResult = await pool.query(
          `SELECT 
            cm.*,                          -- 消息的所有字段
            json_build_object(             -- 构建发送者用户信息JSON对象
              'id', u.id,
              'email', u.email,
              'full_name', u.full_name,
              'avatar_url', u.avatar_url
            ) as user
          FROM chat_messages cm
          JOIN users u ON cm.user_id = u.id  -- 关联用户表获取发送者信息
          WHERE cm.id = $1`,
          [result.rows[0].id]  // 使用刚插入的消息ID
        );

        const fullMessage = fullMessageResult.rows[0];

        // 第五步：通过Socket.IO实时推送文件消息
        // 向文档房间内的所有在线用户推送新的文件消息
        if (io) {
          io.to(String(documentId)).emit("newChatMessage", fullMessage);
        }

        // 返回201状态码和完整的文件消息对象
        res.status(201).json(fullMessage);
      } catch (error) {
        // 捕获错误并记录
        console.error("上传文件消息失败:", error);
        // 重要：如果出错，删除已上传的临时文件，避免文件泄漏
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: "服务器内部错误" });
      }
    }
  );

  /**
   * GET /api/chat-messages/:messageId/download
   * 下载聊天中的文件
   * 
   * 功能：下载聊天消息中上传的文件
   * 权限：需要登录，且对文件所属文档有访问权限
   * 
   * 请求参数：
   * - messageId (路径参数): 消息ID
   * 
   * 响应：文件流（浏览器将提示下载）
   * 
   * 特殊处理：
   * - 支持中文文件名（UTF-8编码）
   * - Content-Disposition头设置
   * - 文件不存在时返回404
   */
  router.get("/chat-messages/:messageId/download", protect, async (req, res) => {
    try {
      // 从URL路径中提取消息ID
      const messageId = parseInt(req.params.messageId, 10);

      // 第一步：获取消息信息及其所属文档
      const messageResult = await pool.query(
        `SELECT cm.*, d.id as document_id
         FROM chat_messages cm
         JOIN documents d ON cm.document_id = d.id  -- 关联文档表
         WHERE cm.id = $1`,
        [messageId]
      );

      // 如果消息不存在
      if (messageResult.rows.length === 0) {
        return res.status(404).json({ message: "消息不存在" });
      }

      const message = messageResult.rows[0];

      // 第二步：验证消息类型必须是文件
      if (message.message_type !== "file") {
        return res.status(400).json({ message: "该消息不是文件消息" });
      }

      // 检查用户是否有权限访问文档
      const docCheck = await pool.query(
        `SELECT d.id, d.owner_id,
                CASE 
                  WHEN d.owner_id = $2 THEN 'owner'
                  WHEN EXISTS (
                    SELECT 1 FROM document_collaborators dc 
                    WHERE dc.document_id = d.id AND dc.user_id = $2
                  ) THEN (
                    SELECT dc.role FROM document_collaborators dc 
                    WHERE dc.document_id = d.id AND dc.user_id = $2
                  )
                  ELSE NULL
                END as user_role
         FROM documents d
         WHERE d.id = $1`,
        [message.document_id, req.user.id]
      );

      if (docCheck.rows.length === 0) {
        return res.status(404).json({ message: "文档不存在" });
      }

      // 提取用户角色
      const userRole = docCheck.rows[0].user_role;
      // 如果没有权限
      if (!userRole) {
        return res.status(403).json({ message: "无权下载该文件" });
      }

      // 第四步：检查文件是否在文件系统中存在
      if (!fs.existsSync(message.file_path)) {
        return res.status(404).json({ message: "文件不存在" });
      }

      // 第五步：设置HTTP响应头以支持文件下载
      const fileName = message.file_name || "file";
      // 编码文件名以支持中文等特殊字符
      // 使用RFC 5987标准的filename*参数格式
      const encodedFileName = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');
      // 设置Content-Disposition为attachment，浏览器将提示下载而不是直接打开
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
      // 设置Content-Type为二进制流
      res.setHeader('Content-Type', 'application/octet-stream');
      
      // 第六步：发送文件到客户端
      // 将相对路径转换为绝对路径（Express的sendFile需要绝对路径）
      const absolutePath = path.isAbsolute(message.file_path) ? message.file_path : path.resolve(message.file_path);
      res.sendFile(absolutePath, (err) => {
        if (err) {
          // 如果发送失败，记录错误
          console.error("下载文件失败:", err);
          console.error("文件路径:", absolutePath);
          // 如果响应头还没发送，返回错误响应
          if (!res.headersSent) {
            res.status(500).json({ message: "下载文件失败" });
          }
        }
      });
    } catch (error) {
      console.error("下载聊天文件失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  /**
   * DELETE /api/chat-messages/:messageId
   * 删除聊天消息
   * 
   * 功能：删除自己发送的聊天消息（文本或文件）
   * 权限：需要登录，且只能删除自己发送的消息
   * 
   * 请求参数：
   * - messageId (路径参数): 消息ID
   * 
   * 响应：{ message: "消息已删除" }
   * 
   * 特殊处理：
   * - 文件消息会同时删除文件系统中的文件
   * - 实时通知其他用户消息被删除
   */
  router.delete("/chat-messages/:messageId", protect, async (req, res) => {
    try {
      // 从URL路径中提取消息ID
      const messageId = parseInt(req.params.messageId, 10);

      // 第一步：检查消息是否存在且属于当前用户
      // 只有消息的发送者才能删除消息（安全性要求）
      const messageCheck = await pool.query(
        "SELECT * FROM chat_messages WHERE id = $1 AND user_id = $2",
        [messageId, req.user.id]  // $2使用req.user.id确保只能删除自己的消息
      );

      // 如果消息不存在或不属于当前用户
      if (messageCheck.rows.length === 0) {
        return res.status(404).json({ message: "消息不存在或无权限删除" });
      }

      const message = messageCheck.rows[0];

      // 第二步：如果是文件消息，同时删除文件系统中的文件
      if (message.message_type === "file" && message.file_path) {
        try {
          // 使用fs.unlinkSync同步删除文件
          fs.unlinkSync(message.file_path);
        } catch (error) {
          // 如果文件删除失败（例如文件已不存在），记录错误但继续删除数据库记录
          console.error("删除文件失败:", error);
        }
      }

      // 第三步：从数据库中删除消息记录
      await pool.query("DELETE FROM chat_messages WHERE id = $1", [messageId]);

      // 第四步：通过Socket.IO实时通知文档房间内的其他用户
      // 让所有在线用户的聊天界面同步移除该消息
      if (io) {
        io.to(String(message.document_id)).emit("chatMessageDeleted", {
          messageId,  // 发送被删除的消息ID
        });
      }

      // 返回成功响应
      res.json({ message: "消息已删除" });
    } catch (error) {
      console.error("删除聊天消息失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 返回配置好的路由器
  return router;
};

// 导出createChatRoutes函数
// 使用方式：
//   const createChatRoutes = require('./routes/chatRoutes');
//   const chatRoutes = createChatRoutes(io);  // 传入Socket.IO实例
//   app.use('/api', chatRoutes);
module.exports = createChatRoutes;

