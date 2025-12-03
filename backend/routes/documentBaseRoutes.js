// 文档基础路由 - 提供文档的增删改查功能
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const {
  validateDocumentId,
  validateDocumentCreate,
  validateDocumentUpdate,
} = require("../middleware/validators");
const { normalizeArray, sanitizeTags, prepareDocumentData } = require("../utils/documentUtils");
const logger = require("../utils/logger");
const { logUserActivity, logSystemLog } = require("../services/activityService");
const { markdownToDelta, deltaToSimpleHtml, turndownService } = require("../utils/exportUtils");

const createDocumentBaseRoutes = (io) => {
  const router = express.Router();

  // GET /api/documents - 获取文档列表
  // 支持的查询参数：q(搜索词), category, tag, sort, order, createdFrom/To, updatedFrom/To, owner, locked
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

      // 基础查询语句
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

      // 普通用户只能看到自己创建的或被邀请协作的文档，管理员可以看到所有文档
      if (req.user.role === "admin") {
        query += " WHERE 1=1 ";
      } else {
        values.push(req.user.id);
        const placeholder = `$${values.length}`;
        query += ` WHERE (d.owner_id = ${placeholder} OR d.id IN (SELECT document_id FROM document_collaborators WHERE user_id = ${placeholder}))`;
      }

      // 应用各种过滤条件
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

      // 执行查询
      const documents = await pool.query(query, values);

      // 格式化返回结果
      const normalizedDocuments = documents.rows.map((doc) => ({
        ...doc,
        tags: normalizeArray(doc.tags),
        is_locked: doc.is_locked,
        locked_by: doc.locked_by,
        locked_at: doc.locked_at,
        locked_by_email: doc.locked_by_email,
        locked_by_name: doc.locked_by_name,
      }));

      // 返回结果
      res.json(normalizedDocuments);
    } catch (error) {
      logger.error("获取文档列表失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // POST /api/documents - 创建新文档，支持富文本/Markdown格式，可从模板创建
  router.post("/", protect, validateDocumentCreate, async (req, res) => {
    const { title, category, tags, templateId, content, contentFormat, markdownContent } = req.body;
    const ownerId = req.user.id;

    try {
      let initialContent = typeof content === "object" && content !== null ? content : null;
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

      // 如果提供了模板ID，从模板加载内容和属性
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
        const templateFormat = template.format || "rich";

        if (!documentCategory && template.template_category) {
          documentCategory = template.template_category;
        }
        if (sanitizedTags.length === 0) {
          sanitizedTags = normalizeArray(template.template_tags);
        }
        appliedTemplateId = template.id;

        // 根据模板格式和目标文档格式处理内容
        if (templateFormat === "markdown") {
          // 模板是markdown格式
          if (format === "markdown") {
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

      // 如果没有内容，设置为空白文档
      if (!initialContent) {
        initialContent = { ops: [{ insert: "\n" }] };
      }

      // 保存新文档到数据库
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
          "document_create",
          "document",
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
          stack: err.stack,
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
        "error",
        "error",
        `创建文档失败: ${error.message}`,
        { stack: error.stack, code: error.code, title: req.body.title },
        req.user?.id,
        req
      ).catch((err) => console.error("记录错误日志失败:", err));

      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // GET /api/documents/:id - 获取文档详情，并返回用户权限信息
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
        "error",
        "error",
        `获取文档失败: ${error.message}`,
        { stack: error.stack, code: error.code, documentId: req.params.id },
        req.user?.id,
        req
      ).catch((err) => console.error("记录错误日志失败:", err));

      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // PUT /api/documents/:id - 更新文档，只更新传入的字段
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

      // 准备更新字段
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

      // 构建更新查询
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
          "document_edit",
          "document",
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
          stack: err.stack,
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
        "error",
        "error",
        `更新文档失败: ${error.message}`,
        { stack: error.stack, code: error.code, documentId: req.params.id },
        req.user?.id,
        req
      ).catch((err) => console.error("记录错误日志失败:", err));

      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // DELETE /api/documents/:id - 删除文档，仅所有者或管理员可操作
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
