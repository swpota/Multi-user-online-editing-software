/**
 * 文档锁定路由
 * 从 documentRoutes.js 拆分出来
 */
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");
const { validateDocumentId } = require("../middleware/validators");
const { getDocumentAccess } = require("../utils/documentUtils");
const logger = require("../utils/logger");

/**
 * 创建文档锁定路由
 * @param {object} io - Socket.IO 实例
 * @returns {Router} Express 路由
 */
const createDocumentLockRoutes = (io) => {
  const router = express.Router();

  // 锁定文档
  router.post("/:id/lock", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "无效的文档 ID" });
      }

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canEdit) {
        return res.status(403).json({ message: "无权锁定该文档" });
      }

      const doc = access.document;
      if (
        doc.is_locked &&
        doc.locked_by &&
        doc.locked_by !== req.user.id &&
        req.user.role !== "admin"
      ) {
        return res.status(423).json({ message: "文档已被其他用户锁定" });
      }

      const updated = await pool.query(
        `UPDATE documents
            SET is_locked = true,
                locked_by = $1,
                locked_at = NOW()
          WHERE id = $2
      RETURNING id, title, is_locked, locked_by, locked_at`,
        [req.user.id, documentId]
      );

      await logActivity(req.user.id, "LOCK_DOCUMENT", "document", documentId);

      res.json(updated.rows[0]);
    } catch (error) {
      logger.error("锁定文档失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 解锁文档
  router.post("/:id/unlock", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "无效的文档 ID" });
      }

      const access = await getDocumentAccess(documentId, req.user);
      if (access.notFound) {
        return res.status(404).json({ message: "文档不存在" });
      }
      if (!access.canEdit) {
        return res.status(403).json({ message: "无权解锁该文档" });
      }

      const doc = access.document;
      if (
        doc.is_locked &&
        doc.locked_by &&
        doc.locked_by !== req.user.id &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({ message: "无权解锁该文档" });
      }

      const updated = await pool.query(
        `UPDATE documents
            SET is_locked = false,
                locked_by = NULL,
                locked_at = NULL
          WHERE id = $1
      RETURNING id, title, is_locked, locked_by, locked_at`,
        [documentId]
      );

      await logActivity(req.user.id, "UNLOCK_DOCUMENT", "document", documentId);

      res.json(updated.rows[0]);
    } catch (error) {
      logger.error("解锁文档失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  return router;
};

module.exports = createDocumentLockRoutes;

