const pool = require("../db");

// 创建通知
const createNotification = async (
  userId,
  type,
  title,
  content,
  senderId,
  resourceType,
  resourceId,
  metadata = {}
) => {
  try {
    // 检查用户的通知设置
    const settingsResult = await pool.query(
      "SELECT * FROM notification_settings WHERE user_id = $1",
      [userId]
    );

    let shouldNotify = true;
    if (settingsResult.rows.length > 0) {
      const settings = settingsResult.rows[0];
      // 根据通知类型检查设置
      switch (type) {
        case "comment":
        case "comment_reply":
          shouldNotify = settings.comment_notifications;
          break;
        case "task":
        case "task_assigned":
        case "task_completed":
          shouldNotify = settings.task_notifications;
          break;
        case "mention":
          shouldNotify = settings.mention_notifications;
          break;
        case "document_shared":
          shouldNotify = settings.document_shared_notifications;
          break;
        case "document_updated":
          shouldNotify = settings.document_updated_notifications;
          break;
      }
    }

    if (!shouldNotify) {
      return null; // 用户已禁用该类通知
    }

    // 创建通知
    const result = await pool.query(
      `INSERT INTO notifications (
        user_id, type, title, content, sender_id, 
        resource_type, resource_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *`,
      [
        userId,
        type,
        title,
        content,
        senderId,
        resourceType,
        resourceId,
        JSON.stringify(metadata),
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error("创建通知失败:", error);
    return null;
  }
};

module.exports = { createNotification };

