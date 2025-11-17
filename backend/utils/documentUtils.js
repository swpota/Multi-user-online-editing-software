/**
 * 文档工具函数
 * 提取自 documentRoutes.js，用于文档相关的通用操作
 */
const pool = require("../db");

/**
 * 清理和规范化标签数组
 */
const sanitizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }
  const cleaned = tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(cleaned));
};

/**
 * 规范化数组值（支持字符串、数组、JSON字符串）
 */
const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  if (typeof value === "object") {
    return Array.isArray(value) ? value : [];
  }
  return [];
};

/**
 * 获取文档访问权限
 * @param {number} documentId - 文档ID
 * @param {object} user - 用户对象
 * @returns {Promise<object>} 包含文档信息、角色和权限的对象
 */
const getDocumentAccess = async (documentId, user) => {
  const docResult = await pool.query("SELECT * FROM documents WHERE id = $1", [
    documentId,
  ]);

  if (docResult.rows.length === 0) {
    return { notFound: true };
  }

  const document = docResult.rows[0];
  document.tags = normalizeArray(document.tags);
  document.content_format = document.content_format || "rich";
  if (document.content_format !== "markdown") {
    document.markdown_content = null;
  }
  let role = "none";

  if (document.owner_id === user.id || user.role === "admin") {
    role = "owner";
  } else {
    const collaboratorResult = await pool.query(
      "SELECT role FROM document_collaborators WHERE document_id = $1 AND user_id = $2",
      [documentId, user.id]
    );

    if (collaboratorResult.rows.length > 0) {
      role = collaboratorResult.rows[0].role;
    }
  }

  const canView = role !== "none";
  let canEdit = role === "owner" || role === "editor" || user.role === "admin";

  if (
    document.is_locked &&
    document.locked_by &&
    document.locked_by !== user.id &&
    user.role !== "admin"
  ) {
    canEdit = false;
  }

  return {
    document,
    role,
    canView,
    canEdit,
    notFound: false,
  };
};

/**
 * 确保内容为 Delta 格式
 */
const ensureDelta = (rawContent) => {
  if (!rawContent) {
    return { ops: [{ insert: "\n" }] };
  }
  if (typeof rawContent === "string") {
    try {
      const parsed = JSON.parse(rawContent);
      if (parsed && Array.isArray(parsed.ops)) {
        return parsed;
      }
      return { ops: [{ insert: parsed.toString() }, { insert: "\n" }] };
    } catch (error) {
      return { ops: [{ insert: rawContent }, { insert: "\n" }] };
    }
  }
  if (typeof rawContent === "object" && Array.isArray(rawContent.ops)) {
    return rawContent;
  }
  return { ops: [{ insert: rawContent?.toString() || "" }, { insert: "\n" }] };
};

/**
 * 准备文档数据（清理和验证）
 */
const prepareDocumentData = (reqBody) => {
  const { title, category, tags, content, markdownContent, contentFormat } =
    reqBody;

  if (!title || !title.trim()) {
    throw new Error("文档标题不能为空");
  }

  const sanitizedTags = sanitizeTags(tags);
  const contentFormatValue = contentFormat || "rich";

  let preparedContent = content;
  let markdownContentValue = markdownContent;

  if (contentFormatValue === "markdown") {
    if (!markdownContent || !markdownContent.trim()) {
      throw new Error("Markdown 内容不能为空");
    }
    markdownContentValue = markdownContent.trim();
    preparedContent = null;
  } else {
    if (!content) {
      throw new Error("文档内容不能为空");
    }

    let parsedContent = content;
    if (typeof content === "string") {
      try {
        parsedContent = JSON.parse(content);
      } catch (error) {
        throw new Error("内容必须是有效的 JSON");
      }
    }
    if (typeof parsedContent !== "object") {
      throw new Error("文档内容格式不正确");
    }
    preparedContent = ensureDelta(parsedContent);
  }

  const deltaContent = ensureDelta(preparedContent);

  return {
    title: title.trim(),
    category: category ? category.trim() : null,
    tags: sanitizedTags,
    content: deltaContent,
    contentFormat: contentFormatValue,
    markdownContent: markdownContentValue,
  };
};

module.exports = {
  sanitizeTags,
  normalizeArray,
  getDocumentAccess,
  ensureDelta,
  prepareDocumentData,
};

