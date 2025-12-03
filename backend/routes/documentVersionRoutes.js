// 文档版本管理路由
// 功能：版本列表、创建快照、对比、恢复
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");
const { validateDocumentId } = require("../middleware/validators");
const { getDocumentAccess, ensureDelta, normalizeArray } = require("../utils/documentUtils");
const { deltaToSimpleHtml } = require("../utils/exportUtils");
const logger = require("../utils/logger");
const { diff_match_patch } = require("diff-match-patch");

const dmp = new diff_match_patch();

const createDocumentVersionRoutes = (io) => {
  const router = express.Router();

  // GET /api/documents/:id/versions/compare - 对比两个版本
  router.get("/:id/versions/compare", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      const fromId = parseInt(req.query.from, 10);
      const toId = parseInt(req.query.to, 10);

      if (isNaN(documentId) || isNaN(fromId) || isNaN(toId)) {
        return res.status(400).json({ message: "无效的版本参数" });
      }

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canView) {
        return res.status(403).json({ message: "无权查看该文档" });
      }

      // 如果对比同一个版本，只查询一次
      const versionsResult = await pool.query(
        `SELECT id, title, content, category, tags, summary, created_at, content_format, markdown_content
           FROM document_versions
          WHERE document_id = $1 AND id IN ($2, $3)`,
        [documentId, fromId, toId]
      );

      // 允许对比同一个版本（fromId === toId时只会返回1个结果）
      if (versionsResult.rows.length === 0) {
        return res.status(404).json({ message: "版本不存在" });
      }

      const fromVersion = versionsResult.rows.find((v) => v.id === fromId);

      if (!fromVersion) {
        return res.status(404).json({ message: "源版本不存在" });
      }

      const toVersion = versionsResult.rows.find((v) => v.id === toId) || fromVersion;

      const fromFormat = fromVersion.content_format || "rich";
      const toFormat = toVersion.content_format || "rich";
      const compareFormat =
        fromFormat === "markdown" && toFormat === "markdown" ? "markdown" : "rich";

      let fromText, toText;

      // 根据内容格式提取文本进行对比，如果是富文本则转换成简单HTML，否则用Markdown文本
      if (compareFormat === "markdown") {
        fromText = fromVersion.markdown_content || "";
        toText = toVersion.markdown_content || "";
      } else {
        fromText = deltaToSimpleHtml(ensureDelta(fromVersion.content));
        toText = deltaToSimpleHtml(ensureDelta(toVersion.content));
      }

      // 使用diff-match-patch计算差异
      const diffs = dmp.diff_main(fromText, toText);
      dmp.diff_cleanupSemantic(diffs);

      res.json({
        from: {
          id: fromVersion.id,
          title: fromVersion.title,
          created_at: fromVersion.created_at,
        },
        to: {
          id: toVersion.id,
          title: toVersion.title,
          created_at: toVersion.created_at,
        },
        diffs,
        format: compareFormat,
      });
    } catch (error) {
      logger.error("比较版本失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // GET /api/documents/:id/versions - 获取文档的所有版本列表，按创建时间倒序排列
  router.get("/:id/versions", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "无效的文档 ID" });
      }

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canView) {
        return res.status(403).json({ message: "无权查看该文档" });
      }

      const versionsResult = await pool.query(
        `SELECT dv.id,
                dv.title,
                dv.category,
                dv.tags,
                dv.summary,
                dv.created_at,
                dv.created_by,
                dv.content_format,
                dv.markdown_content,
                u.email AS created_by_email,
                u.full_name AS created_by_name
           FROM document_versions dv
      LEFT JOIN users u ON dv.created_by = u.id
          WHERE dv.document_id = $1
       ORDER BY dv.created_at DESC`,
        [documentId]
      );

      const versions = versionsResult.rows.map((version) => ({
        ...version,
        tags: normalizeArray(version.tags),
      }));

      res.json(versions);
    } catch (error) {
      logger.error("获取版本列表失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // POST /api/documents/:id/versions - 创建版本快照，保存当前文档的完整状态
  router.post("/:id/versions", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "无效的文档 ID" });
      }

      const { summary } = req.body;

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canEdit) {
        return res.status(403).json({ message: "无权保存版本" });
      }

      const { document } = access;
      const deltaContent = ensureDelta(document.content);
      const storedContent = JSON.stringify(deltaContent);
      const storedTags = normalizeArray(document.tags);
      const storedFormat = document.content_format || "rich";
      const storedMarkdown = document.markdown_content || null;

      const newVersionResult = await pool.query(
        `INSERT INTO document_versions (document_id, title, content, category, tags, created_by, summary, content_format, markdown_content)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id,
                title,
                category,
                tags,
                summary,
                created_at,
                created_by,
                content_format,
                markdown_content`,
        [
          documentId,
          document.title,
          storedContent,
          document.category,
          JSON.stringify(storedTags),
          req.user.id,
          summary || null,
          storedFormat,
          storedMarkdown,
        ]
      );

      await logActivity(req.user.id, "SAVE_DOCUMENT_VERSION", "document", documentId, {
        versionId: newVersionResult.rows[0].id,
      });

      res.status(201).json({
        ...newVersionResult.rows[0],
        tags: storedTags,
      });
    } catch (error) {
      logger.error("保存文档版本失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // GET /api/documents/:id/versions/:versionId - 获取指定版本的详细内容
  router.get("/:id/versions/:versionId", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      const versionId = parseInt(req.params.versionId, 10);

      if (isNaN(documentId) || isNaN(versionId)) {
        return res.status(400).json({ message: "无效的版本请求" });
      }

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canView) {
        return res.status(403).json({ message: "无权查看该文档" });
      }

      const versionResult = await pool.query(
        `SELECT dv.id,
                dv.title,
                dv.content,
                dv.category,
                dv.tags,
                dv.summary,
                dv.created_at,
                dv.created_by,
                u.email AS created_by_email,
                u.full_name AS created_by_name
           FROM document_versions dv
      LEFT JOIN users u ON dv.created_by = u.id
          WHERE dv.document_id = $1 AND dv.id = $2`,
        [documentId, versionId]
      );

      if (versionResult.rows.length === 0) {
        return res.status(404).json({ message: "版本不存在" });
      }

      const version = versionResult.rows[0];
      res.json({
        ...version,
        tags: normalizeArray(version.tags),
      });
    } catch (error) {
      logger.error("获取版本失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // POST /api/documents/:id/versions/:versionId/restore - 恢复到指定历史版本
  router.post("/:id/versions/:versionId/restore", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      const versionId = parseInt(req.params.versionId, 10);

      if (isNaN(documentId) || isNaN(versionId)) {
        return res.status(400).json({ message: "无效的版本请求" });
      }

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canEdit) {
        return res.status(403).json({ message: "无权恢复版本" });
      }

      const versionResult = await pool.query(
        `SELECT * FROM document_versions WHERE document_id = $1 AND id = $2`,
        [documentId, versionId]
      );

      if (versionResult.rows.length === 0) {
        return res.status(404).json({ message: "版本不存在" });
      }

      const version = versionResult.rows[0];

      await pool.query(
        `UPDATE documents
            SET content = $1,
                category = $2,
                tags = $3,
                content_format = $4,
                markdown_content = $5,
                updated_at = NOW()
          WHERE id = $6`,
        [
          version.content,
          version.category,
          version.tags,
          version.content_format || "rich",
          version.markdown_content,
          documentId,
        ]
      );

      await logActivity(req.user.id, "RESTORE_DOCUMENT_VERSION", "document", documentId, {
        versionId: version.id,
      });

      res.json({ message: "版本已恢复" });
    } catch (error) {
      logger.error("恢复版本失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  return router;
};

module.exports = createDocumentVersionRoutes;
