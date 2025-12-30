const pool = require("../db");

/**
 * 记录一个操作日志到数据库
 * @param {number} userId - 执行操作的用户 ID
 * @param {string} action - 操作的类型 (e.g., 'UPDATE_USER_ROLE')
 * @param {string} targetType - 操作对象的类型 (e.g., 'user')
 * @param {number} targetId - 操作对象的 ID
 * @param {object} details - (可选) 包含额外信息的 JSON 对象
 */
const logActivity = async (
  userId,
  action,
  targetType = null,
  targetId = null,
  details = null
) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, targetType, targetId, details]
    );
    console.log(`[Audit Log] User ${userId} performed action: ${action}`);
  } catch (error) {
    // 在生产环境中，这里应该有一个更健壮的错误处理机制
    console.error("Failed to write to audit log:", error);
  }
};

module.exports = { logActivity };
