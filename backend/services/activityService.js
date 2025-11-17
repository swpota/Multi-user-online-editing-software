const pool = require("../db");

/**
 * 记录用户活动
 * @param {number} userId - 用户ID
 * @param {string} activityType - 活动类型 (login, logout, document_create, document_edit, etc.)
 * @param {string} resourceType - 资源类型 (document, comment, task, etc.)
 * @param {number} resourceId - 资源ID
 * @param {object} details - 额外信息
 * @param {object} req - Express请求对象（可选，用于获取IP和User-Agent）
 */
const logUserActivity = async (
  userId,
  activityType,
  resourceType = null,
  resourceId = null,
  details = null,
  req = null
) => {
  try {
    let ipAddress = null;
    let userAgent = null;
    
    if (req) {
      ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
      userAgent = req.headers['user-agent'];
    }
    
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, resource_type, resource_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, activityType, resourceType, resourceId, details ? JSON.stringify(details) : null, ipAddress, userAgent]
    );
  } catch (error) {
    console.error("记录用户活动失败:", error);
    // 不抛出错误，避免影响主流程
  }
};

/**
 * 记录系统日志
 * @param {string} logLevel - 日志级别 (info, warning, error, critical)
 * @param {string} logType - 日志类型 (error, performance, security, system)
 * @param {string} message - 日志消息
 * @param {object} details - 额外信息
 * @param {number} userId - 用户ID（可选）
 * @param {object} req - Express请求对象（可选）
 */
const logSystemLog = async (
  logLevel,
  logType,
  message,
  details = null,
  userId = null,
  req = null
) => {
  try {
    let ipAddress = null;
    let userAgent = null;
    
    if (req) {
      ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
      userAgent = req.headers['user-agent'];
    }
    
    await pool.query(
      `INSERT INTO system_logs (log_level, log_type, message, details, user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [logLevel, logType, message, details ? JSON.stringify(details) : null, userId, ipAddress, userAgent]
    );
  } catch (error) {
    console.error("记录系统日志失败:", error);
    // 不抛出错误，避免影响主流程
  }
};

/**
 * 记录系统性能指标
 * @param {string} metricType - 指标类型 (cpu, memory, disk, network, response_time, etc.)
 * @param {number} metricValue - 指标值
 * @param {string} metricUnit - 指标单位 (%, MB, ms, etc.)
 * @param {object} details - 额外信息
 */
const logSystemMetric = async (
  metricType,
  metricValue,
  metricUnit = null,
  details = null
) => {
  try {
    await pool.query(
      `INSERT INTO system_metrics (metric_type, metric_value, metric_unit, details)
       VALUES ($1, $2, $3, $4)`,
      [metricType, metricValue, metricUnit, details ? JSON.stringify(details) : null]
    );
  } catch (error) {
    console.error("记录系统性能指标失败:", error);
    // 不抛出错误，避免影响主流程
  }
};

module.exports = {
  logUserActivity,
  logSystemLog,
  logSystemMetric
};

