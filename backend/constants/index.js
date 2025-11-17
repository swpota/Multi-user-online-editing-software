/**
 * 常量定义
 * 统一管理所有常量
 */

// 用户角色
const USER_ROLES = {
  ADMIN: "admin",
  EDITOR: "editor",
};

// 任务优先级
const TASK_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

// 任务状态
const TASK_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

// 通知类型
const NOTIFICATION_TYPES = {
  COMMENT: "comment",
  MENTION: "mention",
  TASK_ASSIGNED: "task_assigned",
  TASK_UPDATED: "task_updated",
  DOCUMENT_SHARED: "document_shared",
  DOCUMENT_UPDATED: "document_updated",
};

// 文档格式
const DOCUMENT_FORMATS = {
  RICH: "rich",
  MARKDOWN: "markdown",
};

// 导出格式
const EXPORT_FORMATS = {
  PDF: "pdf",
  DOCX: "docx",
  MARKDOWN: "markdown",
  HTML: "html",
};

// 文件上传限制
const FILE_UPLOAD_LIMITS = {
  MAX_SIZE_MB: 10,
  ALLOWED_MIME_TYPES: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

// 分页默认值
const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
};

// 验证限制
const VALIDATION_LIMITS = {
  EMAIL_MAX_LENGTH: 255,
  PHONE_LENGTH: 11,
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 128,
  FULL_NAME_MIN_LENGTH: 2,
  FULL_NAME_MAX_LENGTH: 50,
  DOCUMENT_TITLE_MIN_LENGTH: 1,
  DOCUMENT_TITLE_MAX_LENGTH: 200,
  DOCUMENT_CATEGORY_MAX_LENGTH: 50,
  TAG_MAX_LENGTH: 20,
  TAG_MAX_COUNT: 10,
  COMMENT_MIN_LENGTH: 1,
  COMMENT_MAX_LENGTH: 5000,
  TASK_TITLE_MIN_LENGTH: 1,
  TASK_TITLE_MAX_LENGTH: 200,
  TASK_DESCRIPTION_MAX_LENGTH: 2000,
};

// HTTP 状态码
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

// 错误消息
const ERROR_MESSAGES = {
  UNAUTHORIZED: "认证失败，请先登录",
  FORBIDDEN: "无权访问此资源",
  NOT_FOUND: "资源不存在",
  VALIDATION_FAILED: "输入验证失败",
  INTERNAL_ERROR: "服务器内部错误",
  DATABASE_ERROR: "数据库操作失败",
  FILE_TOO_LARGE: "文件大小超过限制",
  INVALID_FILE_TYPE: "不支持的文件类型",
};

// 成功消息
const SUCCESS_MESSAGES = {
  CREATED: "创建成功",
  UPDATED: "更新成功",
  DELETED: "删除成功",
  LOGIN: "登录成功",
  REGISTER: "注册成功",
  LOGOUT: "登出成功",
};

module.exports = {
  USER_ROLES,
  TASK_PRIORITY,
  TASK_STATUS,
  NOTIFICATION_TYPES,
  DOCUMENT_FORMATS,
  EXPORT_FORMATS,
  FILE_UPLOAD_LIMITS,
  PAGINATION_DEFAULTS,
  VALIDATION_LIMITS,
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
};

