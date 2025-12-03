/**
 * 数据库连接池配置模块
 * 功能：创建和配置PostgreSQL数据库连接池
 * 使用：在其他模块中引入此模块来执行数据库查询
 */

// 引入PostgreSQL的连接池类
const { Pool } = require("pg");
// 引入配置获取函数，用于读取环境变量中的数据库配置
const { getConfig } = require("./config/env");
// 引入日志工具，用于记录数据库连接状态和错误
const logger = require("./utils/logger");

// 获取系统配置（包含数据库URL、连接池参数等）
const config = getConfig();

/**
 * 创建PostgreSQL连接池
 * 连接池的优点：
 * 1. 复用数据库连接，避免频繁建立和断开连接的开销
 * 2. 控制并发连接数，防止数据库连接数过多
 * 3. 自动管理空闲连接，提高资源利用率
 */
const pool = new Pool({
  // 数据库连接字符串，格式：postgresql://用户名:密码@主机:端口/数据库名
  connectionString: config.database.url,
  
  // 连接池配置
  // 连接池最小连接数：即使没有请求，也保持这么多连接
  min: config.database.pool.min,
  // 连接池最大连接数：最多允许这么多并发连接
  max: config.database.pool.max,
  // 空闲连接超时时间（毫秒）：连接空闲超过此时间将被释放
  idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
  
  // 连接超时时间：30秒，如果30秒内无法建立连接则超时
  connectionTimeoutMillis: 30000,
  // 查询超时时间：30秒，如果单个查询执行超过30秒则超时
  query_timeout: 30000,
});

/**
 * 连接池错误处理器
 * 监听连接池中空闲客户端的意外错误
 * 这通常发生在：
 * 1. 数据库服务器意外关闭
 * 2. 网络连接中断
 * 3. 数据库连接被强制断开
 */
pool.on("error", (err, client) => {
  // 记录错误日志，包含错误信息和堆栈
  logger.error("数据库连接池中的空闲客户端发生意外错误", err);
  
  // 尝试将错误记录到系统日志表（如果数据库仍可用）
  // 使用catch避免记录日志失败导致程序崩溃
  logSystemLog(
    'critical',  // 日志级别：严重
    'system',    // 日志类别：系统
    `数据库连接池错误: ${err.message}`,  // 错误消息
    { stack: err.stack, code: err.code }  // 附加错误详情
  ).catch(e => console.error("记录数据库错误日志失败:", e));
  
  // 退出进程（-1表示异常退出），因为数据库连接池错误通常是不可恢复的
  process.exit(-1);
});

/**
 * 异步测试数据库连接
 * 立即执行的异步函数（IIFE），在模块加载时自动运行
 * 不阻塞服务器启动，连接失败只记录日志，不终止进程
 */
(async () => {
  try {
    // 记录开始测试连接的信息
    logger.info("正在测试数据库连接...");
    // 记录数据库URL（隐藏密码部分，将密码替换为****）
    logger.info(`数据库 URL: ${config.database.url ? config.database.url.replace(/:[^:@]+@/, ':****@') : '未配置'}`);
    // 执行一个简单的查询（SELECT NOW()）来测试连接
    const result = await pool.query("SELECT NOW()");
    // 连接成功，记录成功日志
    logger.info("✅ 数据库连接成功");
  } catch (err) {
    // 捕获连接错误
    logger.error("❌ 数据库连接失败:", err.message);
    logger.error("错误详情:", err.code || err.name);
    
    // 记录数据库连接失败到系统日志
    logSystemLog(
      'critical',
      'system',
      `数据库初始连接失败: ${err.message}`,
      { stack: err.stack, code: err.code, name: err.name }
    ).catch(e => console.error("记录数据库错误日志失败:", e));
    if (err.message.includes("timeout")) {
      logger.error("连接超时，请检查：");
      logger.error("1. 数据库服务器是否正在运行");
      logger.error("2. DATABASE_URL 是否正确（格式：postgresql://user:password@host:port/database）");
      logger.error("3. 防火墙是否允许连接到数据库端口");
      logger.error("4. 数据库服务器是否允许远程连接");
    } else if (err.message.includes("password") || err.message.includes("authentication")) {
      logger.error("认证失败，请检查：");
      logger.error("1. 数据库用户名和密码是否正确");
      logger.error("2. DATABASE_URL 中的密码是否包含特殊字符（需要 URL 编码）");
    } else if (err.message.includes("does not exist") || err.message.includes("database")) {
      logger.error("数据库不存在，请检查：");
      logger.error("1. DATABASE_URL 中的数据库名称是否正确");
      logger.error("2. 数据库是否已创建");
    }
    logger.error(`当前 DATABASE_URL 格式: ${config.database.url ? '已配置' : '未配置'}`);
    // 不退出进程，让服务器继续启动，但会在第一次使用数据库时失败
  }
})();

module.exports = pool;
