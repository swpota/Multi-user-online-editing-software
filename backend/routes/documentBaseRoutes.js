/**
 * 文档基础路由模块（CRUD操作）
 * 
 * 功能：提供文档的完整CRUD操作
 * 特性：
 * 1. 获取文档列表（支持多条件筛选、排序、分页）
 * 2. 获取单个文档详情（包含权限信息）
 * 3. 创建文档（支持富文本/Markdown格式）
 * 4. 更新文档（元数据和内容）
 * 5. 删除文档（软删除或硬删除）
 * 6. 权限控制（owner/collaborator）
 * 7. 实时通知（Socket.IO）
 * 
 * 说明：从原documentRoutes.js拆分出来，专注于基础CRUD操作
 */

// 引入Express框架
const express = require("express");
// 引入JWT认证中间件
const { protect } = require("../middleware/authMiddleware");
// 引入数据库连接池
const pool = require("../db");
// 引入验证中间件
const { validateDocumentId, validateDocumentCreate, validateDocumentUpdate } = require("../middleware/validators");
// 引入文档工具函数
const { normalizeArray, sanitizeTags, prepareDocumentData } = require("../utils/documentUtils");
// 引入日志工具
const logger = require("../utils/logger");
// 引入活动日志服务
const { logUserActivity, logSystemLog } = require("../services/activityService");

// 引入文档格式转换工具（Markdown ↔ Delta ↔ HTML）
const { markdownToDelta, deltaToSimpleHtml, turndownService } = require("../utils/exportUtils");

/**
 * createDocumentBaseRoutes - 创建文档基础路由
 * 
 * @param {object} io - Socket.IO实例，用于实时推送文档更新
 * @returns {Router} - Express路由器
 */
const createDocumentBaseRoutes = (io) => {
  // 创建Express路由器实例
  const router = express.Router();

  /**
   * GET /api/documents
   * 获取文档列表
   * 
   * 功能：获取当前用户可访问的所有文档，支持多条件筛选和排序
   * 权限：需要登录
   * 
   * 查询参数：
   * - q (可选): 搜索关键词（标题、分类、标签、作者）
   * - category (可选): 分类筛选
   * - tag (可选): 标签筛选
   * - sort (可选): 排序字段（updated_at/created_at/title，默认updated_at）
   * - order (可选): 排序方向（asc/desc，默认desc）
   * - createdFrom/createdTo (可选): 创建时间范围
   * - updatedFrom/updatedTo (可选): 更新时间范围
   * - owner (可选): 所有者筛选（管理员专用）
   * - locked (可选): 锁定状态筛选（true/false）
   * 
   * 响应：文档数组，包含文档基本信息和所有者/锁定者信息
   * 
   * 权限逻辑：
   * - 管理员：可查看所有文档
   * - 普通用户：只能查看自己拥有的文档或被邀请协作的文档
   */
  router.get("/", protect, async (req, res) => {
    try {
      const {
        q,
        category,
        tag,
        sort = "updated_at",
        order = "desc",
        createdFrom,
        createdTo,
        updatedFrom,
        updatedTo,
        owner,
        locked,
      } = req.query;

      const allowedSorts = new Set(["updated_at", "created_at", "title"]);
      const sortColumn = allowedSorts.has(sort) ? sort : "updated_at";
      const sortOrder = order && order.toLowerCase() === "asc" ? "ASC" : "DESC";

      const filters = [];
      const values = [];

      let query = `
        SELECT d.id,
               d.title,
               d.owner_id,
               d.updated_at,
               d.created_at,
               d.category,
               d.tags,
               d.template_id,
               d.is_locked,
               d.locked_by,
               d.locked_at,
               d.content_format,
               u.email AS owner_email,
               u.full_name AS owner_name,
               lu.email AS locked_by_email,
               lu.full_name AS locked_by_name
          FROM documents d
          JOIN users u ON d.owner_id = u.id
     LEFT JOIN users lu ON d.locked_by = lu.id
      `;

      if (req.user.role === "admin") {
        query += " WHERE 1=1 ";
      } else {
        values.push(req.user.id);
        const placeholder = `$${values.length}`;
        query += ` WHERE (d.owner_id = ${placeholder} OR d.id IN (SELECT document_id FROM document_collaborators WHERE user_id = ${placeholder}))`;
      }

      if (q) {
        values.push(`%${q.toLowerCase()}%`);
        const placeholder = `$${values.length}`;
        filters.push(
          `(LOWER(d.title) LIKE ${placeholder}
            OR LOWER(COALESCE(u.email, '')) LIKE ${placeholder}
            OR LOWER(COALESCE(u.full_name, '')) LIKE ${placeholder}
            OR LOWER(COALESCE(d.category, '')) LIKE ${placeholder}
            OR LOWER(d.tags::text) LIKE ${placeholder})`
        );
      }

      if (category) {
        values.push(category);
        filters.push(`d.category = $${values.length}`);
      }

      if (tag) {
        values.push(JSON.stringify([tag]));
        filters.push(`d.tags @> $${values.length}::jsonb`);
      }

      if (createdFrom) {
        values.push(new Date(createdFrom));
        filters.push(`d.created_at >= $${values.length}`);
      }

      if (createdTo) {
        values.push(new Date(createdTo));
        filters.push(`d.created_at <= $${values.length}`);
      }

      if (updatedFrom) {
        values.push(new Date(updatedFrom));
        filters.push(`d.updated_at >= $${values.length}`);
      }

      if (updatedTo) {
        values.push(new Date(updatedTo));
        filters.push(`d.updated_at <= $${values.length}`);
      }

      if (owner && req.user.role === "admin") {
        values.push(owner);
        filters.push(`d.owner_id = $${values.length}`);
      }

      if (locked === "true") {
        filters.push("d.is_locked = true");
      } else if (locked === "false") {
        filters.push("d.is_locked = false");
      }

      if (filters.length > 0) {
        query += ` AND ${filters.join(" AND ")}`;
      }

      query += ` ORDER BY d.${sortColumn} ${sortOrder}`;

      const documents = await pool.query(query, values);

      const normalizedDocuments = documents.rows.map((doc) => ({
        ...doc,
        tags: normalizeArray(doc.tags),
        is_locked: doc.is_locked,
        locked_by: doc.locked_by,
        locked_at: doc.locked_at,
        locked_by_email: doc.locked_by_email,
        locked_by_name: doc.locked_by_name,
      }));

      res.json(normalizedDocuments);
    } catch (error) {
      logger.error("获取文档列表失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  /**
   * POST /api/documents
   * 创建新文档
   * 
   * 功能：创建新文档，支持富文本和Markdown格式，支持从模板创建
   * 权限：需要登录
   * 
   * 请求参数：
   * - title (必填): 文档标题
   * - category (可选): 文档分类
   * - tags (可选): 标签数组
   * - templateId (可选): 模板ID，从模板创建文档
   * - content (可选): 文档内容（富文本Delta格式或Markdown字符串）
   * - contentFormat (可选): 内容格式（rich/markdown，默认rich）
   * - markdownContent (可选): Markdown内容（当contentFormat为markdown时）
   * 
   * 响应：创建的文档对象
   * 
   * 格式转换逻辑：
   * - 富文本→Markdown：Delta转HTML再转Markdown
   * - Markdown→富文本：Markdown转Delta
   * - 模板格式自动适配目标文档格式
   * 
   * 模板应用：
   * - 如果指定templateId，会从模板复制内容、分类、标签
   * - 只能使用公开模板或自己创建的私有模板
   */
  router.post("/", protect, validateDocumentCreate, async (req, res) => {
    const {
      title,
      category,
      tags,
      templateId,
      content,
      contentFormat,
      markdownContent,
    } = req.body;
    const ownerId = req.user.id;

    try {
      let initialContent =
        typeof content === "object" && content !== null
          ? content
          : null;
      let appliedTemplateId = null;
      let sanitizedTags = sanitizeTags(tags);
      let documentCategory = category ? category.trim() : null;
      const format = contentFormat === "markdown" ? "markdown" : "rich";
      let markdownToSave =
        format === "markdown"
          ? (markdownContent !== undefined ? markdownContent : content) || ""
          : null;

      if (format === "markdown" && !markdownToSave) {
        markdownToSave = "";
      }

      if (templateId) {
        const templateResult = await pool.query(
          `SELECT id, content, category AS template_category, tags AS template_tags, format
             FROM document_templates
            WHERE id = $1 AND (is_public = true OR owner_id = $2)`,
          [templateId, ownerId]
        );

        if (templateResult.rows.length === 0) {
          return res.status(404).json({ message: "模板不存在或无权使用" });
        }

        const template = templateResult.rows[0];
        const templateFormat = template.format || 'rich';
        
        if (!documentCategory && template.template_category) {
          documentCategory = template.template_category;
        }
        if (sanitizedTags.length === 0) {
          sanitizedTags = normalizeArray(template.template_tags);
        }
        appliedTemplateId = template.id;

        // 根据模板格式和目标文档格式处理内容
        if (templateFormat === 'markdown') {
          // 模板是markdown格式
          if (format === 'markdown') {
            // 目标也是markdown：直接使用
            markdownToSave = template.content || "";
          } else {
            // 目标是富文本：markdown转Delta
            const deltaFromMarkdown = markdownToDelta(template.content || "");
            initialContent = deltaFromMarkdown;
          }
        } else {
          // 模板是富文本格式（Delta）
          initialContent = template.content || initialContent;
          if (format === "markdown" && !markdownToSave) {
            // 目标是markdown：Delta转markdown
            const htmlFromTemplate = deltaToSimpleHtml(template.content);
            markdownToSave = turndownService.turndown(htmlFromTemplate);
          }
        }
      }

      if (!initialContent) {
        initialContent = { ops: [{ insert: "\n" }] };
      }

      if (format === "markdown") {
        const deltaFromMarkdown = markdownToDelta(markdownToSave || "");
        initialContent = deltaFromMarkdown;
      }

      const newDocument = await pool.query(
        `INSERT INTO documents (title, owner_id, content, category, tags, template_id, content_format, markdown_content)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id,
                title,
                owner_id,
                content,
                category,
                tags,
                template_id,
                content_format,
                markdown_content,
                created_at,
                updated_at`,
        [
          title.trim(),
          ownerId,
          JSON.stringify(initialContent),
          documentCategory,
          JSON.stringify(sanitizedTags),
          appliedTemplateId,
          format,
          markdownToSave,
        ]
      );

      const createdDoc = newDocument.rows[0];
      
      // 记录创建文档活动
      console.log("开始记录文档创建活动 - 文档ID:", createdDoc.id, "用户ID:", ownerId);
      try {
        await logUserActivity(
          ownerId,
          'document_create',
          'document',
          createdDoc.id,
          { title: createdDoc.title, category: documentCategory },
          req
        );
        console.log("文档创建活动记录成功 - 文档ID:", createdDoc.id);
      } catch (err) {
        console.error("记录文档创建活动失败:", err);
        console.error("失败详情:", {
          ownerId,
          documentId: createdDoc.id,
          error: err.message,
          stack: err.stack
        });
      }

      res.status(201).json({
        ...createdDoc,
        tags: sanitizedTags,
      });
    } catch (error) {
      logger.error("创建文档失败:", error);
      
      // 记录系统错误日志
      logSystemLog(
        'error',
        'error',
        `创建文档失败: ${error.message}`,
        { stack: error.stack, code: error.code, title: req.body.title },
        req.user?.id,
        req
      ).catch(err => console.error("记录错误日志失败:", err));
      
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  /**
   * GET /api/documents/:id
   * 获取单个文档详情
   * 
   * 功能：获取指定文档的详细信息，包括内容、权限、锁定状态
   * 权限：需要登录，且是文档所有者、协作者或管理员
   * 
   * 请求参数：
   * - id (路径参数): 文档ID
   * 
   * 响应：文档详情对象，包含以下额外字段：
   * - role: 用户在该文档中的角色（owner/editor/viewer）
   * - canEdit: 是否可编辑（布尔值）
   * - lockedBy: 锁定者信息（如果文档被锁定）
   * 
   * 权限逻辑：
   * - 文档所有者：完全访问
   * - 协作者：根据角色（editor/viewer）决定是否可编辑
   * - 管理员：完全访问
   * - 其他用户：无权访问
   */
  router.get("/:id", protect, validateDocumentId, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "无效的文档 ID" });
      }

      const { getDocumentAccess } = require("../utils/documentUtils");
      const access = await getDocumentAccess(id, req.user);

      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }

      if (!access.canView) {
        return res.status(403).json({ message: "无权访问此文档" });
      }

      // 获取锁定用户信息（如果有）
      let lockedBy = null;
      if (access.document.locked_by) {
        const lockUserResult = await pool.query(
          "SELECT id, email, full_name, avatar_url FROM users WHERE id = $1",
          [access.document.locked_by]
        );
        if (lockUserResult.rows.length > 0) {
          lockedBy = {
            id: lockUserResult.rows[0].id,
            email: lockUserResult.rows[0].email,
            full_name: lockUserResult.rows[0].full_name,
            avatar_url: lockUserResult.rows[0].avatar_url,
          };
        }
      }

      res.json({
        ...access.document,
        role: access.role,
        canEdit: access.canEdit,
        lockedBy: lockedBy,
      });
    } catch (error) {
      logger.error("获取文档失败:", error);
      
      // 记录系统错误日志
      logSystemLog(
        'error',
        'error',
        `获取文档失败: ${error.message}`,
        { stack: error.stack, code: error.code, documentId: req.params.id },
        req.user?.id,
        req
      ).catch(err => console.error("记录错误日志失败:", err));
      
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  /**
   * PUT /api/documents/:id
   * 更新文档
   * 
   * 功能：更新文档的内容和元数据，支持部分更新
   * 权限：需要登录，且有编辑权限（owner/editor）
   * 
   * 请求参数：
   * - id (路径参数): 文档ID
   * - title (可选): 新标题
   * - category (可选): 新分类
   * - tags (可选): 新标签数组
   * - content (可选): 新内容（富文本Delta格式）
   * - markdownContent (可选): 新Markdown内容
   * 
   * 响应：更新后的文档对象
   * 
   * 特点：
   * - 动态SQL构建：只更新提供的字段
   * - 格式同步：更新富文本时自动更新Markdown，反之亦然
   * - 锁定检查：如果文档被其他用户锁定，禁止更新
   * - 实时通知：通过Socket.IO通知其他在线用户
   */
  router.put("/:id", protect, validateDocumentId, validateDocumentUpdate, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "无效的文档 ID" });
      }

      const { getDocumentAccess } = require("../utils/documentUtils");
      const access = await getDocumentAccess(id, req.user);

      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }

      if (!access.canEdit) {
        return res.status(403).json({ message: "无权编辑此文档" });
      }

      const { title, category, tags, content, contentFormat, markdownContent } = req.body;

      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (title !== undefined) {
        updateFields.push(`title = $${paramIndex++}`);
        updateValues.push(title.trim());
      }

      if (category !== undefined) {
        updateFields.push(`category = $${paramIndex++}`);
        updateValues.push(category ? category.trim() : null);
      }

      if (tags !== undefined) {
        updateFields.push(`tags = $${paramIndex++}`);
        updateValues.push(JSON.stringify(sanitizeTags(tags)));
      }

      if (content !== undefined) {
        updateFields.push(`content = $${paramIndex++}`);
        updateValues.push(JSON.stringify(content));
      }

      if (contentFormat !== undefined) {
        updateFields.push(`content_format = $${paramIndex++}`);
        updateValues.push(contentFormat);
      }

      if (markdownContent !== undefined) {
        updateFields.push(`markdown_content = $${paramIndex++}`);
        updateValues.push(markdownContent);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ message: "没有要更新的字段" });
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id);

      const updateQuery = `
        UPDATE documents
           SET ${updateFields.join(", ")}
         WHERE id = $${paramIndex}
      RETURNING id,
                title,
                owner_id,
                content,
                category,
                tags,
                content_format,
                markdown_content,
                created_at,
                updated_at
      `;

      const result = await pool.query(updateQuery, updateValues);

      // 记录编辑文档活动
      console.log("开始记录文档编辑活动 - 文档ID:", id, "用户ID:", req.user.id);
      try {
        await logUserActivity(
          req.user.id,
          'document_edit',
          'document',
          id,
          { title: result.rows[0].title },
          req
        );
        console.log("文档编辑活动记录成功 - 文档ID:", id);
      } catch (err) {
        console.error("记录文档编辑活动失败:", err);
        console.error("失败详情:", {
          userId: req.user.id,
          documentId: id,
          error: err.message,
          stack: err.stack
        });
      }

      res.json({
        ...result.rows[0],
        tags: normalizeArray(result.rows[0].tags),
      });
    } catch (error) {
      logger.error("更新文档失败:", error);
      
      // 记录系统错误日志
      logSystemLog(
        'error',
        'error',
        `更新文档失败: ${error.message}`,
        { stack: error.stack, code: error.code, documentId: req.params.id },
        req.user?.id,
        req
      ).catch(err => console.error("记录错误日志失败:", err));
      
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  /**
   * DELETE /api/documents/:id
   * 删除文档
   * 
   * 功能：删除指定文档
   * 权限：只有文档所有者或管理员可以删除
   * 
   * 请求参数：
   * - id (路径参数): 文档ID
   * 
   * 响应：删除成功消息
   * 
   * 注意：
   * - 这是硬删除，会永久删除文档及其所有关联数据
   * - 级联删除包括：协作者记录、评论、任务、版本历史等
   * - 协作者（editor/viewer）不能删除文档
   * - 删除操作不可恢复，请谨慎操作
   */
  router.delete("/:id", protect, validateDocumentId, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "无效的文档 ID" });
      }

      const { getDocumentAccess } = require("../utils/documentUtils");
      const access = await getDocumentAccess(id, req.user);

      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }

      if (access.role !== "owner" && req.user.role !== "admin") {
        return res.status(403).json({ message: "只有文档所有者才能删除文档" });
      }

      await pool.query("DELETE FROM documents WHERE id = $1", [id]);

      res.status(200).json({ message: "文档已删除" });
    } catch (error) {
      logger.error("删除文档失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  return router;
};

module.exports = createDocumentBaseRoutes;

