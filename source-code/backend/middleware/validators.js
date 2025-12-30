// 输入验证中间件 - 使用 express-validator 进行请求参数校验
const { body, param, query, validationResult } = require("express-validator");
const { VALIDATION_LIMITS } = require("../constants/index");

// 统一处理验证错误
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: "fail",
      message: "输入验证失败",
      errors: errors.array(),
    });
  }
  next();
};

// 用户注册验证
const validateRegister = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("邮箱不能为空")
    .isEmail()
    .withMessage("邮箱格式不正确")
    .normalizeEmail(),
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("手机号不能为空")
    .matches(/^1[3-9]\d{9}$/)
    .withMessage("手机号格式不正确，请输入11位有效的中国大陆手机号"),
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("姓名不能为空")
    .isLength({
      min: VALIDATION_LIMITS.FULL_NAME_MIN_LENGTH,
      max: VALIDATION_LIMITS.FULL_NAME_MAX_LENGTH,
    })
    .withMessage(
      `姓名长度应在${VALIDATION_LIMITS.FULL_NAME_MIN_LENGTH}-${VALIDATION_LIMITS.FULL_NAME_MAX_LENGTH}个字符之间`
    )
    .custom((value) => {
      // 不能全是数字
      if (/^\d+$/.test(value)) {
        throw new Error("姓名不能全是数字");
      }
      // 应该包含至少一个汉字或英文字母
      if (!/[\u4e00-\u9fa5a-zA-Z\s]/.test(value)) {
        throw new Error("姓名应包含至少一个汉字或英文字母");
      }
      return true;
    }),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("密码不能为空")
    .isLength({
      min: VALIDATION_LIMITS.PASSWORD_MIN_LENGTH,
      max: VALIDATION_LIMITS.PASSWORD_MAX_LENGTH,
    })
    .withMessage(
      `密码长度应在${VALIDATION_LIMITS.PASSWORD_MIN_LENGTH}-${VALIDATION_LIMITS.PASSWORD_MAX_LENGTH}个字符之间`
    ),
  body("contactEmail")
    .optional({ checkFalsy: true }) // 跳过 null、undefined、空字符串
    .trim()
    .isEmail()
    .withMessage("联系邮箱格式不正确")
    .normalizeEmail(),
  body("contactPhone")
    .optional({ checkFalsy: true }) // 跳过 null、undefined、空字符串
    .trim()
    .matches(/^1[3-9]\d{9}$/)
    .withMessage("联系手机号格式不正确"),
  handleValidationErrors,
];

// 用户登录验证
const validateLogin = [
  body("identifier").trim().notEmpty().withMessage("请输入邮箱或手机号"),
  body("password").trim().notEmpty().withMessage("请输入密码"),
  handleValidationErrors,
];

// 密码重置请求验证
const validateRequestPasswordReset = [
  body("identifier").trim().notEmpty().withMessage("请输入邮箱或手机号"),
  handleValidationErrors,
];

// 密码重置验证，实际密码长度在路由中根据系统设置动态验证
const validateResetPassword = [
  body("token").trim().notEmpty().withMessage("重置令牌不能为空"),
  body("newPassword")
    .trim()
    .notEmpty()
    .withMessage("新密码不能为空")
    .isLength({ min: VALIDATION_LIMITS.PASSWORD_MIN_LENGTH })
    .withMessage(`密码长度不能少于${VALIDATION_LIMITS.PASSWORD_MIN_LENGTH}位`),
  handleValidationErrors,
];

// 文档ID参数验证（支持 documentId 和 id 两种参数名）
const validateDocumentId = [
  // 验证 documentId（如果存在）
  param("documentId").optional().isInt({ min: 1 }).withMessage("文档ID必须是正整数"),
  // 验证 id（如果存在）
  param("id").optional().isInt({ min: 1 }).withMessage("文档ID必须是正整数"),
  // 确保至少有一个ID参数
  (req, res, next) => {
    const documentId = req.params.documentId || req.params.id;
    if (!documentId) {
      return res.status(400).json({
        status: "fail",
        message: "文档ID不能为空",
      });
    }
    // 统一使用 id 参数
    if (req.params.documentId && !req.params.id) {
      req.params.id = req.params.documentId;
    }
    next();
  },
  handleValidationErrors,
];

// 用户ID参数验证
const validateUserId = [
  param("id").isInt({ min: 1 }).withMessage("用户ID必须是正整数"),
  handleValidationErrors,
];

// 分页参数验证
const validatePagination = [
  query("page").optional().isInt({ min: 1 }).withMessage("页码必须是正整数"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("每页数量必须在1-100之间"),
  handleValidationErrors,
];

// 文档创建验证
const validateDocumentCreate = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("文档标题不能为空")
    .isLength({ min: 1, max: 200 })
    .withMessage("文档标题长度应在1-200个字符之间"),
  body("category").optional().trim().isLength({ max: 50 }).withMessage("分类名称不能超过50个字符"),
  body("tags")
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) {
        if (value.length > 10) {
          throw new Error("标签数量不能超过10个");
        }
        value.forEach((tag) => {
          if (typeof tag !== "string" || tag.trim().length === 0) {
            throw new Error("标签必须是非空字符串");
          }
          if (tag.length > 20) {
            throw new Error("单个标签长度不能超过20个字符");
          }
        });
      } else if (typeof value === "string") {
        // 允许字符串格式，稍后会被处理
      } else if (value !== null && value !== undefined) {
        throw new Error("标签必须是数组或字符串");
      }
      return true;
    }),
  handleValidationErrors,
];

// 文档更新验证
const validateDocumentUpdate = [
  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("文档标题不能为空")
    .isLength({ min: 1, max: 200 })
    .withMessage("文档标题长度应在1-200个字符之间"),
  body("category").optional().trim().isLength({ max: 50 }).withMessage("分类名称不能超过50个字符"),
  body("tags")
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) {
        if (value.length > 10) {
          throw new Error("标签数量不能超过10个");
        }
        value.forEach((tag) => {
          if (typeof tag !== "string" || tag.trim().length === 0) {
            throw new Error("标签必须是非空字符串");
          }
          if (tag.length > 20) {
            throw new Error("单个标签长度不能超过20个字符");
          }
        });
      } else if (typeof value === "string") {
        // 允许字符串格式
      } else if (value !== null && value !== undefined) {
        throw new Error("标签必须是数组或字符串");
      }
      return true;
    }),
  handleValidationErrors,
];

// 评论创建验证
const validateCommentCreate = [
  body("content")
    .trim()
    .notEmpty()
    .withMessage("评论内容不能为空")
    .isLength({ min: 1, max: 5000 })
    .withMessage("评论内容长度应在1-5000个字符之间"),
  body("parentId").optional().isInt({ min: 1 }).withMessage("父评论ID必须是正整数"),
  body("mentionedUserIds").optional().isArray().withMessage("提及用户ID必须是数组"),
  body("mentionedUserIds.*").optional().isInt({ min: 1 }).withMessage("用户ID必须是正整数"),
  handleValidationErrors,
];

// 任务创建验证
const validateTaskCreate = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("任务标题不能为空")
    .isLength({ min: 1, max: 200 })
    .withMessage("任务标题长度应在1-200个字符之间"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("任务描述不能超过2000个字符"),
  body("assignedTo").optional().isInt({ min: 1 }).withMessage("分配用户ID必须是正整数"),
  body("priority")
    .optional()
    .isIn(["low", "medium", "high"])
    .withMessage("优先级必须是 low、medium 或 high"),
  body("dueDate").optional().isISO8601().withMessage("截止日期格式不正确"),
  handleValidationErrors,
];

// 用户角色更新验证
const validateUserRoleUpdate = [
  body("role")
    .notEmpty()
    .withMessage("角色不能为空")
    .isIn(["admin", "editor"])
    .withMessage("角色必须是 admin 或 editor"),
  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateRequestPasswordReset,
  validateResetPassword,
  validateDocumentId,
  validateUserId,
  validatePagination,
  validateDocumentCreate,
  validateDocumentUpdate,
  validateCommentCreate,
  validateTaskCreate,
  validateUserRoleUpdate,
  handleValidationErrors,
};
