/**
 * 文档协作者路由
 * 从 documentRoutes.js 拆分出来
 */
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");
const { validateDocumentId } = require("../middleware/validators");
const { isOwner } = require("../middleware/documentMiddleware");
const logger = require("../utils/logger");

/**
 * 创建文档协作者路由
 * @param {object} io - Socket.IO 实例
 * @returns {Router} Express 路由
 */
const createDocumentCollaboratorRoutes = (io) => {
  const router = express.Router();

  // 获取协作者列表
  router.get("/:id/collaborators", protect, validateDocumentId, isOwner, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      const collaborators = await pool.query(
        `SELECT u.id, u.email, dc.role 
           FROM document_collaborators dc
           JOIN users u ON dc.user_id = u.id
          WHERE dc.document_id = $1`,
        [documentId]
      );
      res.json(collaborators.rows);
    } catch (error) {
      logger.error("获取协作者列表失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 添加/更新协作者
  router.post("/:id/collaborators", protect, validateDocumentId, isOwner, async (req, res) => {
    const documentId = parseInt(req.params.id, 10);
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ message: "需要提供用户邮箱和角色" });
    }

    try {
      // 查找用户 ID
      const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: "找不到该邮箱对应的用户" });
      }
      const userId = userResult.rows[0].id;

      // 检查是否试图将所有者添加为协作者
      const docOwnerResult = await pool.query(
        "SELECT owner_id FROM documents WHERE id = $1",
        [documentId]
      );
      if (docOwnerResult.rows[0].owner_id === userId) {
        return res.status(400).json({ message: "不能将所有者添加为协作者" });
      }

      // 使用 ON CONFLICT 实现 "UPSERT" (更新或插入)
      const newCollaborator = await pool.query(
        `INSERT INTO document_collaborators (document_id, user_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (document_id, user_id) 
             DO UPDATE SET role = EXCLUDED.role
             RETURNING *`,
        [documentId, userId, role]
      );

      await logActivity(req.user.id, "ADD_COLLABORATOR", "document", documentId, {
        targetUserId: userId,
        newRole: role,
      });

      res.status(201).json({ id: userId, email, role });
    } catch (error) {
      logger.error("添加协作者失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 移除协作者
  router.delete("/:id/collaborators/:userId", protect, validateDocumentId, isOwner, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      const userId = parseInt(req.params.userId, 10);

      await pool.query(
        "DELETE FROM document_collaborators WHERE document_id = $1 AND user_id = $2",
        [documentId, userId]
      );

      await logActivity(req.user.id, "REMOVE_COLLABORATOR", "document", documentId, {
        targetUserId: userId,
      });

      res.status(204).send();
    } catch (error) {
      logger.error("移除协作者失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  return router;
};

module.exports = createDocumentCollaboratorRoutes;

