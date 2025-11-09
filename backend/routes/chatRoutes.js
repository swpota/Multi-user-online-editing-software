const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 配置文件上传
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // 允许所有文件类型
    cb(null, true);
  },
});

const createChatRoutes = (io) => {
  const router = express.Router();

  // 获取文档的聊天消息
  router.get(
    "/documents/:documentId/chat-messages",
    protect,
    async (req, res) => {
      try {
        const documentId = parseInt(req.params.documentId, 10);
        const { limit = 50, offset = 0 } = req.query;

        // 检查用户是否有权限查看文档
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

        const userRole = docCheck.rows[0].user_role;
        if (!userRole) {
          return res.status(403).json({ message: "无权查看该文档的聊天消息" });
        }

        // 获取聊天消息
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

  // 发送聊天消息
  router.post(
    "/documents/:documentId/chat-messages",
    protect,
    async (req, res) => {
      try {
        const documentId = parseInt(req.params.documentId, 10);
        const { message, replyTo } = req.body;

        if (!message || !message.trim()) {
          return res.status(400).json({ message: "消息内容不能为空" });
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
          [documentId, req.user.id]
        );

        if (docCheck.rows.length === 0) {
          return res.status(404).json({ message: "文档不存在" });
        }

        const userRole = docCheck.rows[0].user_role;
        if (!userRole) {
          return res.status(403).json({ message: "无权在该文档中发送消息" });
        }

        // 如果有回复，验证回复的消息是否存在
        if (replyTo) {
          const replyCheck = await pool.query(
            "SELECT id FROM chat_messages WHERE id = $1 AND document_id = $2",
            [replyTo, documentId]
          );
          if (replyCheck.rows.length === 0) {
            return res.status(404).json({ message: "回复的消息不存在" });
          }
        }

        // 创建聊天消息
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

        // 获取完整的消息信息（包括用户信息）
        const fullMessageResult = await pool.query(
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
          WHERE cm.id = $1`,
          [result.rows[0].id]
        );

        const fullMessage = fullMessageResult.rows[0];

        // 通过 Socket.IO 实时通知
        if (io) {
          io.to(String(documentId)).emit("newChatMessage", fullMessage);
        }

        res.status(201).json(fullMessage);
      } catch (error) {
        console.error("发送聊天消息失败:", error);
        res.status(500).json({ message: "服务器内部错误" });
      }
    }
  );

  // 上传文件消息
  router.post(
    "/documents/:documentId/chat-messages/file",
    protect,
    upload.single("file"),
    async (req, res) => {
      try {
        const documentId = parseInt(req.params.documentId, 10);

        if (!req.file) {
          return res.status(400).json({ message: "没有上传文件" });
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
          [documentId, req.user.id]
        );

        if (docCheck.rows.length === 0) {
          // 删除上传的文件
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ message: "文档不存在" });
        }

        const userRole = docCheck.rows[0].user_role;
        if (!userRole) {
          // 删除上传的文件
          fs.unlinkSync(req.file.path);
          return res.status(403).json({ message: "无权在该文档中发送文件" });
        }

        // 创建文件消息
        const result = await pool.query(
          `INSERT INTO chat_messages (
            document_id, user_id, message, message_type,
            file_name, file_path, file_size, file_type
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
          RETURNING *`,
          [
            documentId,
            req.user.id,
            req.file.originalname,
            "file",
            req.file.originalname,
            req.file.path,
            req.file.size,
            req.file.mimetype,
          ]
        );

        // 获取完整的消息信息
        const fullMessageResult = await pool.query(
          `SELECT 
            cm.*,
            json_build_object(
              'id', u.id,
              'email', u.email,
              'full_name', u.full_name,
              'avatar_url', u.avatar_url
            ) as user
          FROM chat_messages cm
          JOIN users u ON cm.user_id = u.id
          WHERE cm.id = $1`,
          [result.rows[0].id]
        );

        const fullMessage = fullMessageResult.rows[0];

        // 通过 Socket.IO 实时通知
        if (io) {
          io.to(String(documentId)).emit("newChatMessage", fullMessage);
        }

        res.status(201).json(fullMessage);
      } catch (error) {
        console.error("上传文件消息失败:", error);
        // 删除上传的文件
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: "服务器内部错误" });
      }
    }
  );

  // 下载聊天文件消息
  router.get("/chat-messages/:messageId/download", protect, async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId, 10);

      // 获取消息信息
      const messageResult = await pool.query(
        `SELECT cm.*, d.id as document_id
         FROM chat_messages cm
         JOIN documents d ON cm.document_id = d.id
         WHERE cm.id = $1`,
        [messageId]
      );

      if (messageResult.rows.length === 0) {
        return res.status(404).json({ message: "消息不存在" });
      }

      const message = messageResult.rows[0];

      // 检查是否是文件消息
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

      const userRole = docCheck.rows[0].user_role;
      if (!userRole) {
        return res.status(403).json({ message: "无权下载该文件" });
      }

      // 检查文件是否存在
      if (!fs.existsSync(message.file_path)) {
        return res.status(404).json({ message: "文件不存在" });
      }

      // 发送文件
      res.download(message.file_path, message.file_name || "file", (err) => {
        if (err) {
          console.error("下载文件失败:", err);
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

  // 删除聊天消息
  router.delete("/chat-messages/:messageId", protect, async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId, 10);

      // 检查消息是否存在且属于当前用户
      const messageCheck = await pool.query(
        "SELECT * FROM chat_messages WHERE id = $1 AND user_id = $2",
        [messageId, req.user.id]
      );

      if (messageCheck.rows.length === 0) {
        return res.status(404).json({ message: "消息不存在或无权限删除" });
      }

      const message = messageCheck.rows[0];

      // 如果是文件消息，删除文件
      if (message.message_type === "file" && message.file_path) {
        try {
          fs.unlinkSync(message.file_path);
        } catch (error) {
          console.error("删除文件失败:", error);
        }
      }

      // 删除消息
      await pool.query("DELETE FROM chat_messages WHERE id = $1", [messageId]);

      // 通过 Socket.IO 实时通知
      if (io) {
        io.to(String(message.document_id)).emit("chatMessageDeleted", {
          messageId,
        });
      }

      res.json({ message: "消息已删除" });
    } catch (error) {
      console.error("删除聊天消息失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  return router;
};

module.exports = createChatRoutes;

