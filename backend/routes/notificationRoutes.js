const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { createNotification } = require("../services/notificationService");

const createNotificationRoutes = (io) => {
  const router = express.Router();

  // 获取用户的所有通知
  router.get("/notifications", protect, async (req, res) => {
    try {
      const userId = req.user.id;
      const { type, isRead, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT 
          n.*,
          json_build_object(
            'id', u.id,
            'email', u.email,
            'full_name', u.full_name,
            'avatar_url', u.avatar_url
          ) as sender
        FROM notifications n
        LEFT JOIN users u ON n.sender_id = u.id
        WHERE n.user_id = $1
      `;
      const params = [userId];
      let paramIndex = 2;

      // 添加类型过滤
      if (type) {
        query += ` AND n.type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      // 添加已读/未读过滤
      if (isRead !== undefined) {
        query += ` AND n.is_read = $${paramIndex}`;
        params.push(isRead === "true");
        paramIndex++;
      }

      // 排序和分页
      query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await pool.query(query, params);

      // 获取总数
      let countQuery = `SELECT COUNT(*) FROM notifications WHERE user_id = $1`;
      const countParams = [userId];
      if (type) {
        countQuery += ` AND type = $2`;
        countParams.push(type);
      }
      if (isRead !== undefined) {
        countQuery += ` AND is_read = $${countParams.length + 1}`;
        countParams.push(isRead === "true");
      }
      const countResult = await pool.query(countQuery, countParams);

      res.json({
        notifications: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
    } catch (error) {
      console.error("获取通知失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 获取未读通知数量
  router.get("/notifications/unread-count", protect, async (req, res) => {
    try {
      const userId = req.user.id;
      const result = await pool.query(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false",
        [userId]
      );
      res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
      console.error("获取未读通知数量失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 标记通知为已读
  router.put("/notifications/:notificationId/read", protect, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.notificationId, 10);
      const userId = req.user.id;

      // 验证通知属于当前用户
      const checkResult = await pool.query(
        "SELECT id FROM notifications WHERE id = $1 AND user_id = $2",
        [notificationId, userId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: "通知不存在" });
      }

      // 更新通知为已读
      const result = await pool.query(
        "UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *",
        [notificationId, userId]
      );

      // 通过 Socket.IO 通知客户端更新
      if (io) {
        io.to(`user_${userId}`).emit("notificationRead", {
          notificationId,
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("标记通知为已读失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 标记所有通知为已读
  router.put("/notifications/read-all", protect, async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        "UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false RETURNING id",
        [userId]
      );

      // 通过 Socket.IO 通知客户端更新
      if (io) {
        io.to(`user_${userId}`).emit("allNotificationsRead", {
          count: result.rows.length,
        });
      }

      res.json({ message: "所有通知已标记为已读", count: result.rows.length });
    } catch (error) {
      console.error("标记所有通知为已读失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 删除通知
  router.delete("/notifications/:notificationId", protect, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.notificationId, 10);
      const userId = req.user.id;

      // 验证通知属于当前用户
      const checkResult = await pool.query(
        "SELECT id FROM notifications WHERE id = $1 AND user_id = $2",
        [notificationId, userId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: "通知不存在" });
      }

      await pool.query("DELETE FROM notifications WHERE id = $1", [
        notificationId,
      ]);

      // 通过 Socket.IO 通知客户端更新
      if (io) {
        io.to(`user_${userId}`).emit("notificationDeleted", {
          notificationId,
        });
      }

      res.json({ message: "通知已删除" });
    } catch (error) {
      console.error("删除通知失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 获取通知设置
  router.get("/notification-settings", protect, async (req, res) => {
    try {
      const userId = req.user.id;

      let result = await pool.query(
        "SELECT * FROM notification_settings WHERE user_id = $1",
        [userId]
      );

      // 如果用户没有设置，创建默认设置
      if (result.rows.length === 0) {
        const insertResult = await pool.query(
          `INSERT INTO notification_settings (user_id) 
           VALUES ($1) 
           RETURNING *`,
          [userId]
        );
        result = insertResult;
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("获取通知设置失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 更新通知设置
  router.put("/notification-settings", protect, async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        email_enabled,
        push_enabled,
        comment_notifications,
        task_notifications,
        mention_notifications,
        document_shared_notifications,
        document_updated_notifications,
      } = req.body;

      // 检查设置是否存在
      let result = await pool.query(
        "SELECT * FROM notification_settings WHERE user_id = $1",
        [userId]
      );

      if (result.rows.length === 0) {
        // 创建新设置
        result = await pool.query(
          `INSERT INTO notification_settings (
            user_id, email_enabled, push_enabled, 
            comment_notifications, task_notifications, mention_notifications,
            document_shared_notifications, document_updated_notifications
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
          RETURNING *`,
          [
            userId,
            email_enabled !== undefined ? email_enabled : true,
            push_enabled !== undefined ? push_enabled : true,
            comment_notifications !== undefined ? comment_notifications : true,
            task_notifications !== undefined ? task_notifications : true,
            mention_notifications !== undefined
              ? mention_notifications
              : true,
            document_shared_notifications !== undefined
              ? document_shared_notifications
              : true,
            document_updated_notifications !== undefined
              ? document_updated_notifications
              : true,
          ]
        );
      } else {
        // 更新现有设置
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        if (email_enabled !== undefined) {
          updateFields.push(`email_enabled = $${paramIndex}`);
          updateValues.push(email_enabled);
          paramIndex++;
        }
        if (push_enabled !== undefined) {
          updateFields.push(`push_enabled = $${paramIndex}`);
          updateValues.push(push_enabled);
          paramIndex++;
        }
        if (comment_notifications !== undefined) {
          updateFields.push(`comment_notifications = $${paramIndex}`);
          updateValues.push(comment_notifications);
          paramIndex++;
        }
        if (task_notifications !== undefined) {
          updateFields.push(`task_notifications = $${paramIndex}`);
          updateValues.push(task_notifications);
          paramIndex++;
        }
        if (mention_notifications !== undefined) {
          updateFields.push(`mention_notifications = $${paramIndex}`);
          updateValues.push(mention_notifications);
          paramIndex++;
        }
        if (document_shared_notifications !== undefined) {
          updateFields.push(`document_shared_notifications = $${paramIndex}`);
          updateValues.push(document_shared_notifications);
          paramIndex++;
        }
        if (document_updated_notifications !== undefined) {
          updateFields.push(`document_updated_notifications = $${paramIndex}`);
          updateValues.push(document_updated_notifications);
          paramIndex++;
        }

        if (updateFields.length > 0) {
          updateValues.push(userId);
          result = await pool.query(
            `UPDATE notification_settings 
             SET ${updateFields.join(", ")}, updated_at = NOW() 
             WHERE user_id = $${paramIndex} 
             RETURNING *`,
            updateValues
          );
        }
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("更新通知设置失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  return router;
};

module.exports = { createNotificationRoutes };

