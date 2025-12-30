/**
 * 文档模板路由
 * 从 documentRoutes.js 拆分出来
 */
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");
const { normalizeArray, sanitizeTags } = require("../utils/documentUtils");
const logger = require("../utils/logger");

/**
 * 创建文档模板路由
 * @param {object} io - Socket.IO 实例
 * @returns {Router} Express 路由
 */
const createDocumentTemplateRoutes = (io) => {
  const router = express.Router();

  // 获取模板列表
  router.get("/templates", protect, async (req, res) => {
    try {
      const templatesResult = await pool.query(
        `SELECT id,
                name,
                description,
                content,
                category,
                tags,
                is_public,
                owner_id,
                format,
                created_at
           FROM document_templates
          WHERE is_public = true OR owner_id = $1
       ORDER BY created_at DESC`,
        [req.user.id]
      );

      const templates = templatesResult.rows.map((template) => ({
        ...template,
        tags: normalizeArray(template.tags),
      }));

      res.json(templates);
    } catch (error) {
      logger.error("获取模板列表失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 创建模板
  router.post("/templates", protect, async (req, res) => {
    const { name, description, content, category, tags, isPublic = true, format } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "模板名称不能为空" });
    }

    // 根据格式处理content
    let templateContent;
    if (format === 'markdown') {
      // Markdown格式：content应该是字符串
      templateContent = typeof content === 'string' ? content : "";
    } else {
      // 富文本格式：content应该是Delta对象
      templateContent = typeof content === "object" && content !== null
        ? content
        : { ops: [{ insert: "\n" }] };
    }

    const sanitizedTags = sanitizeTags(
      Array.isArray(tags) ? tags : typeof tags === "string" ? tags.split(",") : []
    );

    try {
      const newTemplate = await pool.query(
        `INSERT INTO document_templates (name, description, content, category, tags, owner_id, is_public, format)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id,
                name,
                description,
                content,
                category,
                tags,
                owner_id,
                is_public,
                format,
                created_at`,
        [
          name.trim(),
          description ? description.trim() : null,
          JSON.stringify(templateContent),
          category ? category.trim() : null,
          JSON.stringify(sanitizedTags),
          req.user.id,
          !!isPublic,
          format || 'rich',
        ]
      );

      await logActivity(req.user.id, "CREATE_TEMPLATE", "template", newTemplate.rows[0].id, {
        category: newTemplate.rows[0].category,
        isPublic: !!isPublic,
        format: format || 'rich',
      });

      res.status(201).json({
        ...newTemplate.rows[0],
        tags: sanitizedTags,
      });
    } catch (error) {
      logger.error("创建模板失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 删除模板
  router.delete("/templates/:id", protect, async (req, res) => {
    const templateId = parseInt(req.params.id, 10);

    if (isNaN(templateId)) {
      return res.status(400).json({ message: "无效的模板ID" });
    }

    try {
      // 检查模板是否存在且用户是否有权限删除
      const templateResult = await pool.query(
        "SELECT * FROM document_templates WHERE id = $1",
        [templateId]
      );

      if (templateResult.rows.length === 0) {
        return res.status(404).json({ message: "模板不存在" });
      }

      const template = templateResult.rows[0];

      // 只有模板所有者可以删除
      if (template.owner_id !== req.user.id) {
        return res.status(403).json({ message: "无权删除此模板" });
      }

      // 删除模板
      await pool.query("DELETE FROM document_templates WHERE id = $1", [templateId]);

      await logActivity(req.user.id, "DELETE_TEMPLATE", "template", templateId, {
        name: template.name,
      });

      res.json({ message: "模板已删除" });
    } catch (error) {
      logger.error("删除模板失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  return router;
};

module.exports = createDocumentTemplateRoutes;

