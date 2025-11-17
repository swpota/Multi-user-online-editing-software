/**
 * 文档导入导出路由
 * 从 documentRoutes.js 拆分出来
 */
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");
const { validateDocumentId } = require("../middleware/validators");
const { getDocumentAccess, normalizeArray } = require("../utils/documentUtils");
const {
  generateExportPayload,
  prepareDocumentPayload,
  encodeFileName,
} = require("../utils/exportUtils");
const logger = require("../utils/logger");
const archiver = require("archiver");

/**
 * 创建文档导入导出路由
 * @param {object} io - Socket.IO 实例
 * @returns {Router} Express 路由
 */
const createDocumentImportExportRoutes = (io) => {
  const router = express.Router();

  // 导出文档
  router.get("/:id/export", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "无效的文档 ID" });
      }

      const { format = "json" } = req.query;
      const exportFormat = String(format).toLowerCase();

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canView) {
        return res.status(403).json({ message: "无权导出该文档" });
      }

      const { document } = access;
      
      try {
        const payload = await generateExportPayload(document, exportFormat, document.title);

        if (!payload || !payload.buffer) {
          return res.status(500).json({ 
            message: `导出${exportFormat.toUpperCase()}失败：生成的内容无效`,
          });
        }

        res.setHeader("Content-Type", payload.contentType || "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; ${encodeFileName(payload.fileName, documentId)}`);

        return res.send(payload.buffer);
      } catch (exportError) {
        logger.error("导出失败:", exportError);
        throw exportError;
      }
    } catch (error) {
      logger.error("导出文档失败:", error);
      res.status(500).json({ 
        message: `导出失败: ${error.message || "服务器内部错误"}`,
      });
    }
  });

  // 导入文档
  router.post("/import", protect, async (req, res) => {
    try {
      const prepared = prepareDocumentPayload(req.body);

      const newDocument = await pool.query(
        `INSERT INTO documents (title, owner_id, content, category, tags, content_format, markdown_content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id,
                title,
                owner_id,
                content,
                category,
                tags,
                content_format,
                markdown_content,
                created_at,
                updated_at`,
        [
          prepared.title,
          req.user.id,
          JSON.stringify(prepared.content),
          prepared.category,
          JSON.stringify(prepared.tags),
          prepared.contentFormat,
          prepared.markdownContent,
        ]
      );

      await logActivity(req.user.id, "IMPORT_DOCUMENT", "document", newDocument.rows[0].id, {
        category: newDocument.rows[0].category,
        tags: prepared.tags,
        contentFormat: prepared.contentFormat,
      });

      res.status(201).json({
        ...newDocument.rows[0],
        tags: prepared.tags,
      });
    } catch (error) {
      logger.error("导入文档失败:", error);
      const message = error.message || "导入失败：无法解析数据";
      if (message.startsWith("缺少") || message.includes("内容必须") || message.includes("格式不正确")) {
        return res.status(400).json({ message });
      }
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 批量导入
  router.post("/import/bulk", protect, async (req, res) => {
    try {
      const { documents } = req.body;
      if (!Array.isArray(documents) || documents.length === 0) {
        return res.status(400).json({ message: "请提供待导入的文档数组" });
      }

      const results = [];
      for (const payload of documents) {
        try {
          const prepared = prepareDocumentPayload(payload);
          const inserted = await pool.query(
            `INSERT INTO documents (title, owner_id, content, category, tags, content_format, markdown_content)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, title, category, tags, content_format`,
            [
              prepared.title,
              req.user.id,
              JSON.stringify(prepared.content),
              prepared.category,
              JSON.stringify(prepared.tags),
              prepared.contentFormat,
              prepared.markdownContent,
            ]
          );

          await logActivity(req.user.id, "IMPORT_DOCUMENT", "document", inserted.rows[0].id, {
            category: inserted.rows[0].category,
            tags: prepared.tags,
            contentFormat: prepared.contentFormat,
          });

          results.push({
            status: "success",
            id: inserted.rows[0].id,
            title: prepared.title,
          });
        } catch (error) {
          results.push({
            status: "failed",
            title: payload?.title,
            message: error.message || "解析失败",
          });
        }
      }

      const importedCount = results.filter((r) => r.status === "success").length;

      res.status(207).json({
        imported: importedCount,
        total: documents.length,
        results,
      });
    } catch (error) {
      logger.error("批量导入文档失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 批量导出（简化版，只支持 JSON 格式）
  router.post("/export/bulk", protect, async (req, res) => {
    try {
      const { ids, format = "json" } = req.body;
      
      if (!ids) {
        return res.status(400).json({ message: "请提供要导出的文档 ID 列表" });
      }
      
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "文档 ID 列表必须是数组格式" });
      }
      
      if (ids.length === 0) {
        return res.status(400).json({ message: "请至少选择一个文档进行导出" });
      }

      const documentIds = ids
        .map((id) => {
          if (typeof id === "number") return id;
          if (typeof id === "string") {
            const parsed = parseInt(id, 10);
            return isNaN(parsed) ? null : parsed;
          }
          return null;
        })
        .filter((id) => id !== null && id > 0);

      if (documentIds.length === 0) {
        return res.status(400).json({ message: "没有有效的文档 ID" });
      }

      // 检查用户权限并获取文档
      const documentsResult = await pool.query(
        `SELECT d.* FROM documents d
          WHERE d.id = ANY($1::int[])
            AND (d.owner_id = $2 OR d.id IN (
              SELECT document_id FROM document_collaborators WHERE user_id = $2
            ) OR $3 = 'admin')`,
        [documentIds, req.user.id, req.user.role]
      );

      if (documentsResult.rows.length === 0) {
        return res.status(403).json({ message: "无权访问任何文档" });
      }

      // 设置响应头
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=documents-export.zip"
      );

      const archive = archiver("zip", { zlib: { level: 9 } });
      
      // 处理归档错误
      archive.on("error", (err) => {
        logger.error("归档错误:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "创建压缩包失败" });
        }
      });

      archive.pipe(res);

      // 添加文档到归档
      let addedCount = 0;
      for (const doc of documentsResult.rows) {
        try {
          const payload = await generateExportPayload(
            doc,
            String(format).toLowerCase(),
            doc.title
          );

          archive.append(payload.buffer, { name: payload.fileName });
          addedCount++;
        } catch (error) {
          logger.error(`添加文档 ${doc.id} 到归档失败:`, error);
          // 继续处理其他文档
        }
      }

      if (addedCount === 0) {
        archive.abort();
        if (!res.headersSent) {
          return res.status(403).json({ message: "无法导出任何文档，请检查权限" });
        }
      }

      await archive.finalize();
    } catch (error) {
      logger.error("批量导出文档失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  return router;
};

module.exports = createDocumentImportExportRoutes;

