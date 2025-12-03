/**
 * 活动和日志服务模块
 * 功能：记录用户活动、系统日志和性能指标
 * 用途：
 * 1. 用户行为追踪（登录、编辑、创建等）
 * 2. 系统错误日志记录
 * 3. 性能监控指标收集
 * 4. 安全审计和问题排查
 */

// 引入数据库连接池，用于写入日志到数据库
const pool = require("../db");

/**
 * logUserActivity - 记录用户活动日志
 * 
 * 功能：将用户的操作行为记录到user_activities表
 * 应用场景：
 * - 用户登录/登出
 * - 创建/编辑/删除文档
 * - 发表评论
 * - 创建任务
 * - 分享文档等
 * 
 * 使用示例：
 *   // 记录登录活动
 *   await logUserActivity(userId, 'login', null, null, null, req);
 * 
 *   // 记录文档编辑
 *   await logUserActivity(userId, 'document_edit', 'document', documentId, { changes: 'title' }, req);
 * 
 * @param {number} userId - 用户ID
 * @param {string} activityType - 活动类型 (login/logout/document_create/document_edit等)
 * @param {string} resourceType - 资源类型 (document/comment/task等，可为null)
 * @param {number} resourceId - 资源ID（可为null）
 * @param {object} details - 额外信息（可为null）
 * @param {object} req - Express请求对象（可选，用于获取IP和User-Agent）
 * @returns {Promise<void>} - 无返回值，错误会被捕获但不抛出
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
    // 初始化IP地址和User-Agent变量
    let ipAddress = null;
    let userAgent = null;
    
    // 如果提供了请求对象，提取客户端信息
    if (req) {
      // 获取客户端IP地址，支持代理服务器场景
      // req.ip: Express提供的IP
      // req.connection.remoteAddress: 直接连接的IP
      // x-forwarded-for: 代理服务器传递的原始IP（取第一个）
      ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
      
      // 获取用户的浏览器信息（User-Agent）
      userAgent = req.headers['user-agent'];
    }
    
    // 插入用户活动记录到数据库
    await pool.query(
      `INSERT INTO user_activities (user_id, activity_type, resource_type, resource_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,  // 参数化查询防止SQL注入
      [
        userId,                                          // $1 用户ID
        activityType,                                    // $2 活动类型
        resourceType,                                    // $3 资源类型
        resourceId,                                      // $4 资源ID
        details ? JSON.stringify(details) : null,        // $5 详情（转为JSON字符串）
        ipAddress,                                       // $6 IP地址
        userAgent                                        // $7 User-Agent
      ]
    );
  } catch (error) {
    // 捕获并记录错误，但不抛出
    // 原因：活动日志失败不应影响主业务流程（如登录、创建文档等）
    console.error("记录用户活动失败:", error);
  }
};

/**
 * logSystemLog - 记录系统日志
 * 
 * 功能：记录系统运行中的各类日志到system_logs表
 * 应用场景：
 * - 错误日志：数据库连接失败、第三方API调用失败
 * - 性能日志：慢查询、高CPU使用率警告
 * - 安全日志：登录失败、权限拒绝
 * - 系统日志：服务启动、配置变更
 * 
 * 使用示例：
 *   // 记录错误日志
 *   await logSystemLog('error', 'database', '数据库连接失败', { error: err.message });
 * 
 *   // 记录安全日志
 *   await logSystemLog('warning', 'security', '登录失败', { attempts: 3 }, userId, req);
 * 
 * @param {string} logLevel - 日志级别 (info/warning/error/critical)
 * @param {string} logType - 日志类型 (error/performance/security/system)
 * @param {string} message - 日志消息
 * @param {object} details - 额外信息（可为null）
 * @param {number} userId - 相关用户ID（可为null）
 * @param {object} req - Express请求对象（可选）
 * @returns {Promise<void>} - 无返回值，错误会被捕获但不抛出
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
    // 初始化客户端信息变量
    let ipAddress = null;
    let userAgent = null;
    
    // 如果提供了请求对象，提取客户端信息
    if (req) {
      // 获取IP地址（支持代理）
      ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
      // 获取User-Agent
      userAgent = req.headers['user-agent'];
    }
    
    // 插入系统日志到数据库
    await pool.query(
      `INSERT INTO system_logs (log_level, log_type, message, details, user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,  // 参数化查询
      [
        logLevel,                                    // $1 日志级别
        logType,                                     // $2 日志类型
        message,                                     // $3 日志消息
        details ? JSON.stringify(details) : null,    // $4 详情（JSON）
        userId,                                      // $5 用户ID
        ipAddress,                                   // $6 IP地址
        userAgent                                    // $7 User-Agent
      ]
    );
  } catch (error) {
    // 记录失败只打印到控制台，不影响主流程
    console.error("记录系统日志失败:", error);
  }
};

/**
 * logSystemMetric - 记录系统性能指标
 * 
 * 功能：记录系统性能监控数据到system_metrics表
 * 应用场景：
 * - CPU使用率监控
 * - 内存使用监控
 * - 磁盘IO监控
 * - API响应时间监控
 * - 并发用户数监控
 * 
 * 使用示例：
 *   // 记录CPU使用率
 *   await logSystemMetric('cpu', 75.5, '%', { core: 0 });
 * 
 *   // 记录API响应时间
 *   await logSystemMetric('response_time', 1250, 'ms', { endpoint: '/api/documents' });
 * 
 * @param {string} metricType - 指标类型 (cpu/memory/disk/network/response_time等)
 * @param {number} metricValue - 指标数值
 * @param {string} metricUnit - 指标单位 (%/MB/ms等，可为null)
 * @param {object} details - 额外信息（可为null）
 * @returns {Promise<void>} - 无返回值，错误会被捕获但不抛出
 */
const logSystemMetric = async (
  metricType,
  metricValue,
  metricUnit = null,
  details = null
) => {
  try {
    // 插入性能指标到数据库
    await pool.query(
      `INSERT INTO system_metrics (metric_type, metric_value, metric_unit, details)
       VALUES ($1, $2, $3, $4)`,  // 参数化查询
      [
        metricType,                                  // $1 指标类型
        metricValue,                                 // $2 指标值
        metricUnit,                                  // $3 单位
        details ? JSON.stringify(details) : null     // $4 详情（JSON）
      ]
    );
  } catch (error) {
    // 记录失败只打印到控制台，不影响主流程
    console.error("记录系统性能指标失败:", error);
  }
};

// 导出所有日志记录函数
// 使用方式：
//   const { logUserActivity, logSystemLog, logSystemMetric } = require('./services/activityService');
module.exports = {
  logUserActivity,    // 用户活动日志
  logSystemLog,       // 系统日志
  logSystemMetric     // 性能指标
};

