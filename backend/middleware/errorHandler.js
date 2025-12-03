/**
 * 统一错误处理中间件模块
 * 功能：提供自定义错误类和全局错误处理中间件
 * 使用：在Express应用中作为最后的错误处理中间件
 */

/**
 * AppError - 自定义应用错误类
 * 继承自JavaScript内置的Error类，添加了HTTP状态码和操作标识
 * 
 * 使用示例：
 *   throw new AppError("文档不存在", 404);
 *   next(new AppError("权限不足", 403));
 */
class AppError extends Error {
  /**
   * 构造函数
   * @param {string} message - 错误消息
   * @param {number} statusCode - HTTP状态码（默认500）
   * @param {boolean} isOperational - 是否为可预期的操作错误（默认true）
   */
  constructor(message, statusCode = 500, isOperational = true) {
    // 调用父类Error的构造函数，设置错误消息
    super(message);
    
    // HTTP状态码，如404、500等
    this.statusCode = statusCode;
    
    // 是否为可预期的操作错误
    // true: 可预期的错误（如输入验证失败），可以向客户端返回详细信息
    // false: 编程错误或未知错误，不应向客户端泄露详细信息
    this.isOperational = isOperational;
    
    // 状态字符串：4xx为"fail"（客户端错误），5xx为"error"（服务器错误）
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";

    // 捕获堆栈跟踪，用于调试
    // 排除构造函数本身，使堆栈更清晰
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * errorHandler - 全局错误处理中间件
 * Express错误处理中间件，必须有4个参数（err, req, res, next）
 * 
 * 功能：
 * 1. 根据环境（开发/生产）返回不同详细程度的错误信息
 * 2. 区分操作错误和编程错误
 * 3. 防止在生产环境泄露敏感信息
 * 
 * 使用：在所有路由之后添加
 *   app.use(errorHandler);
 */
const errorHandler = (err, req, res, next) => {
  // 获取环境配置，判断当前是开发环境还是生产环境
  const config = require("../config/env").getConfig();
  const isDevelopment = config.server.nodeEnv === "development";

  // 设置默认错误信息（如果错误对象没有这些属性）
  // 默认状态码为500（服务器内部错误）
  err.statusCode = err.statusCode || 500;
  // 默认状态为"error"
  err.status = err.status || "error";

  // 开发环境：返回详细的错误信息，包括堆栈跟踪
  // 这有助于开发人员快速定位和修复问题
  if (isDevelopment) {
    return res.status(err.statusCode).json({
      status: err.status,          // 状态："fail"或"error"
      error: err,                   // 完整的错误对象
      message: err.message,         // 错误消息
      stack: err.stack,             // 堆栈跟踪（仅开发环境）
    });
  }

  // 生产环境：只返回安全的错误信息，不泄露系统内部细节
  
  // 情况1：操作错误（可预期的错误，如输入验证失败、资源不存在等）
  // 这类错误可以安全地向客户端返回详细消息
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,          // 状态
      message: err.message,         // 错误消息（客户端友好的）
    });
  }

  // 情况2：编程错误或未知错误（如bug、未捕获的异常等）
  // 这类错误不应向客户端泄露详细信息，只记录到服务器日志
  console.error("ERROR 💥", err);

  // 返回通用的错误消息，不包含任何敏感信息
  return res.status(500).json({
    status: "error",
    message: "服务器内部错误",      // 模糊的错误消息
  });
};

/**
 * asyncHandler - 异步路由处理器包装函数
 * 
 * 功能：捕获异步函数中的错误，自动传递给错误处理中间件
 * 原理：将异步函数包装在Promise中，如果Promise被reject，则调用next(err)
 * 
 * 为什么需要这个函数？
 * Express默认不能捕获async函数中抛出的错误，需要手动try-catch
 * 使用asyncHandler可以避免在每个async路由中重复写try-catch
 * 
 * 使用示例：
 *   不使用asyncHandler（需要手动try-catch）：
 *     app.get("/api/users", async (req, res, next) => {
 *       try {
 *         const users = await getUsers();
 *         res.json(users);
 *       } catch (err) {
 *         next(err);
 *       }
 *     });
 * 
 *   使用asyncHandler（自动捕获错误）：
 *     app.get("/api/users", asyncHandler(async (req, res) => {
 *       const users = await getUsers();
 *       res.json(users);
 *     }));
 * 
 * @param {Function} fn - 异步路由处理函数
 * @returns {Function} - 包装后的函数，可以自动捕获异步错误
 */
const asyncHandler = (fn) => {
  // 返回一个新函数，这个函数会被Express调用
  return (req, res, next) => {
    // 将fn的返回值（Promise）包装在Promise.resolve中
    // 如果fn成功执行，Promise正常完成
    // 如果fn中有错误（throw或Promise reject），catch会捕获它
    // 然后调用next(err)，将错误传递给错误处理中间件
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * notFoundHandler - 404错误处理中间件
 * 
 * 功能：处理所有未匹配到任何路由的请求
 * 必须放在所有路由定义之后，错误处理中间件之前
 * 
 * 使用示例：
 *   app.use("/api/users", userRoutes);
 *   app.use("/api/documents", documentRoutes);
 *   app.use(notFoundHandler);  // 放在所有路由之后
 *   app.use(errorHandler);      // 放在404处理器之后
 * 
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - Express next函数
 */
const notFoundHandler = (req, res, next) => {
  // 创建一个AppError实例，状态码为404
  // req.originalUrl 包含完整的请求路径（包括查询参数）
  const err = new AppError(`找不到 ${req.originalUrl} 路径`, 404);
  
  // 将错误传递给下一个错误处理中间件
  next(err);
};

/**
 * handleJWTError - JWT格式错误处理函数
 * 
 * 功能：当JWT token格式无效或签名验证失败时，返回友好的错误消息
 * 使用场景：在authMiddleware中捕获JsonWebTokenError时调用
 * 
 * @returns {AppError} - 返回401状态码的AppError实例
 */
const handleJWTError = () => {
  // 返回401未授权错误，提示用户重新登录
  return new AppError("无效的 token，请重新登录", 401);
};

/**
 * handleJWTExpiredError - JWT过期错误处理函数
 * 
 * 功能：当JWT token已过期时，返回友好的错误消息
 * 使用场景：在authMiddleware中捕获TokenExpiredError时调用
 * 
 * Token过期原因：
 * 1. 超过了expiresIn设置的时间（默认7天）
 * 2. 服务器重启导致密钥变化（如果密钥存储不当）
 * 
 * @returns {AppError} - 返回401状态码的AppError实例
 */
const handleJWTExpiredError = () => {
  // 返回401未授权错误，提示用户重新登录
  return new AppError("Token 已过期，请重新登录", 401);
};

/**
 * handleDBError - 数据库错误处理函数
 * 
 * 功能：将PostgreSQL的错误代码转换为用户友好的错误消息
 * 
 * PostgreSQL错误代码说明：
 * - 23xxx: 完整性约束违反
 * - 23505: unique_violation（唯一约束）
 * - 23503: foreign_key_violation（外键约束）
 * - 23502: not_null_violation（非空约束）
 * 
 * 使用示例：
 *   try {
 *     await pool.query("INSERT INTO users...");
 *   } catch (error) {
 *     if (error.code && error.code.startsWith("23")) {
 *       throw handleDBError(error);
 *     }
 *   }
 * 
 * @param {Error} err - 数据库错误对象
 * @returns {AppError} - 转换后的AppError实例
 */
const handleDBError = (err) => {
  // 情况1: 唯一约束违反（23505）
  // 例如：插入重复的邮箱、手机号等
  if (err.code === "23505") {
    // 从错误详情中提取字段名
    // err.detail格式示例："Key (email)=(test@example.com) already exists."
    const field = err.detail.match(/\(([^)]+)\)/);
    // 返回409冲突错误，包含具体的字段名
    return new AppError(`${field ? field[1] : "字段"} 已存在`, 409);
  }

  // 情况2: 外键约束违反（23503）
  // 例如：引用不存在的用户ID、文档ID等
  if (err.code === "23503") {
    // 返回404未找到错误
    return new AppError("关联的资源不存在", 404);
  }

  // 情况3: 非空约束违反（23502）
  // 例如：插入数据时缺少必填字段
  if (err.code === "23502") {
    // 返回400错误请求
    return new AppError("缺少必需的字段", 400);
  }

  // 情况4: 其他数据库错误
  // 返回通用的500服务器错误
  return new AppError("数据库操作失败", 500);
};

// 导出所有错误处理相关的函数和类
// 使用方式：
//   const { AppError, errorHandler, asyncHandler } = require("./errorHandler");
module.exports = {
  AppError,              // 自定义错误类
  errorHandler,          // 全局错误处理中间件
  asyncHandler,          // 异步错误包装函数
  notFoundHandler,       // 404错误处理中间件
  handleJWTError,        // JWT格式错误处理
  handleJWTExpiredError, // JWT过期错误处理
  handleDBError,         // 数据库错误处理
};

