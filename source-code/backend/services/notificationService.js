/**
 * 通知服务模块
 * 功能：提供创建和管理系统通知的功能
 * 使用场景：
 * 1. 用户被@提及
 * 2. 评论被回复
 * 3. 任务被分配
 * 4. 文档被分享
 * 5. 文档被更新
 */

// 引入数据库连接池，用于查询和插入通知数据
const pool = require("../db");

/**
 * createNotification - 创建系统通知
 * 
 * 功能：
 * 1. 检查用户的通知设置，尊重用户的偏好
 * 2. 如果用户允许该类通知，则创建通知记录
 * 3. 支持各种类型的通知（评论、任务、@提及等）
 * 
 * 使用示例：
 *   // 创建一个评论通知
 *   await createNotification(
 *     userId,              // 接收通知的用户ID
 *     'comment',           // 通知类型
 *     '新评论',           // 通知标题
 *     '某人评论了你的文档', // 通知内容
 *     senderId,            // 发送者ID
 *     'document',          // 资源类型
 *     documentId,          // 资源ID
 *     { commentId: 123 }   // 额外元数据
 *   );
 * 
 * @param {number} userId - 接收通知的用户ID
 * @param {string} type - 通知类型（comment/task/mention等）
 * @param {string} title - 通知标题
 * @param {string} content - 通知内容
 * @param {number} senderId - 发送者用户ID
 * @param {string} resourceType - 资源类型（document/task/comment等）
 * @param {number} resourceId - 资源ID
 * @param {object} metadata - 额外元数据（默认{}）
 * @returns {Promise<object|null>} - 返回创建的通知对象，或null（用户禁用了该类通知）
 */
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
    // 第一步：查询用户的通知设置
    // 每个用户可以在设置页面自定义哪些类型的通知需要接收
    const settingsResult = await pool.query(
      "SELECT * FROM notification_settings WHERE user_id = $1",  // 查询用户的通知设置
      [userId]  // 参数化查询，防止SQL注入
    );

    // 第二步：判断是否应该发送通知
    // 默认允许发送通知（如果用户没有设置过）
    let shouldNotify = true;
    
    // 如果用户有自定义设置
    if (settingsResult.rows.length > 0) {
      // 获取用户的通知设置
      const settings = settingsResult.rows[0];
      
      // 根据通知类型检查对应的设置开关
      // notification_settings表中有多个布尔字段，每个对应一种通知类型
      switch (type) {
        // 评论相关通知
        case "comment":         // 新评论
        case "comment_reply":   // 评论回复
          shouldNotify = settings.comment_notifications;  // 检查评论通知开关
          break;
        
        // 任务相关通知
        case "task":            // 任务通知
        case "task_assigned":   // 任务被分配
        case "task_completed":  // 任务完成
          shouldNotify = settings.task_notifications;     // 检查任务通知开关
          break;
        
        // @提及通知
        case "mention":
          shouldNotify = settings.mention_notifications;  // 检查@通知开关
          break;
        
        // 文档分享通知
        case "document_shared":
          shouldNotify = settings.document_shared_notifications;  // 检查文档分享通知开关
          break;
        
        // 文档更新通知
        case "document_updated":
          shouldNotify = settings.document_updated_notifications; // 检查文档更新通知开关
          break;
      }
    }

    // 第三步：如果用户禁用了该类通知，直接返回null，不创建通知
    if (!shouldNotify) {
      return null;  // 返回null表示用户不希望接收该通知
    }

    // 第四步：创建通知记录
    // 使用RETURNING *返回刚创建的通知对象（包含id、created_at等字段）
    const result = await pool.query(
      `INSERT INTO notifications (
        user_id,        -- 接收通知的用户ID
        type,           -- 通知类型
        title,          -- 通知标题
        content,        -- 通知内容
        sender_id,      -- 发送者ID
        resource_type,  -- 相关资源类型（document/task等）
        resource_id,    -- 相关资源ID
        metadata        -- 额外元数据（JSONB类型）
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *`,  // 返回刚插入的完整记录
      [
        userId,                      // $1
        type,                        // $2
        title,                       // $3
        content,                     // $4
        senderId,                    // $5
        resourceType,                // $6
        resourceId,                  // $7
        JSON.stringify(metadata),    // $8 - 将JavaScript对象转为JSON字符串
      ]
    );

    // 返回创建的通知对象（第一行）
    return result.rows[0];
  } catch (error) {
    // 捕获并记录错误
    // 注意：这里不抛出错误，而是返回null
    // 原因：通知创建失败不应影响主业务逻辑（如创建评论、分配任务等）
    console.error("创建通知失败:", error);
    return null;  // 返回null表示通知创建失败
  }
};

// 导出 createNotification 函数，供其他模块使用
// 使用方式：
//   const { createNotification } = require("./services/notificationService");
module.exports = { createNotification };

