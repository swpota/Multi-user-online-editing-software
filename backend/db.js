const { Pool } = require("pg");
const { getConfig } = require("./config/env");
const logger = require("./utils/logger");

const config = getConfig();

const pool = new Pool({
  connectionString: config.database.url,
  // 连接池配置
  min: config.database.pool.min,
  max: config.database.pool.max,
  idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
  // 连接超时（增加到 30 秒）
  connectionTimeoutMillis: 30000,
  // 查询超时
  query_timeout: 30000,
});

// 连接池错误处理
pool.on("error", (err, client) => {
  logger.error("Unexpected error on idle client", err);
  
  // 记录数据库错误到系统日志
  logSystemLog(
    'critical',
    'system',
    `数据库连接池错误: ${err.message}`,
    { stack: err.stack, code: err.code }
  ).catch(e => console.error("记录数据库错误日志失败:", e));
  
  process.exit(-1);
});

// 测试数据库连接（异步，不阻塞服务器启动）
(async () => {
  try {
    logger.info("正在测试数据库连接...");
    logger.info(`数据库 URL: ${config.database.url ? config.database.url.replace(/:[^:@]+@/, ':****@') : '未配置'}`);
    const result = await pool.query("SELECT NOW()");
    logger.info("✅ 数据库连接成功");
  } catch (err) {
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
