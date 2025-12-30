/**
 * 文档协作者管理路由模块
 * 
 * 功能：提供文档协作者的完整管理功能
 * 特性：
 * 1. 获取协作者列表（包含角色信息）
 * 2. 添加或更新协作者（支持UPSERT操作）
 * 3. 移除协作者
 * 4. 角色管理（editor/viewer）
 * 5. 权限控制（仅文档所有者可管理协作者）
 * 
 * 说明：从原documentRoutes.js拆分出来，专注于协作者管理操作
 */
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");
const { validateDocumentId } = require("../middleware/validators");
const { isOwner } = require("../middleware/documentMiddleware");
const logger = require("../utils/logger");

/**
 * createDocumentCollaboratorRoutes - 创建文档协作者管理路由
 * 
 * @param {object} io - Socket.IO实例，用于实时推送协作者变更
 * @returns {Router} - Express路由器
 */
const createDocumentCollaboratorRoutes = (io) => {
  const router = express.Router();

  /**
   * GET /api/documents/:id/collaborators
   * 获取文档的协作者列表
   * 
   * 功能：查询指定文档的所有协作者及其角色
   * 权限：需要登录，且必须是文档所有者
   * 
   * 请求参数：
   * - id (路径参数): 文档ID
   * 
   * 响应：协作者数组，每个协作者包含：
   * - id: 用户ID
   * - email: 用户邮箱
   * - role: 协作角色（editor/viewer）
   * 
   * 注意：
   * - 只有文档所有者可以查看协作者列表
   * - 协作者本人无法查看其他协作者
   */
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

  /**
   * POST /api/documents/:id/collaborators
   * 添加或更新协作者
   * 
   * 功能：为文档添加新的协作者，或更新现有协作者的角色
   * 权限：需要登录，且必须是文档所有者
   * 
   * 请求参数：
   * - id (路径参数): 文档ID
   * - email (必填): 协作者的邮箱地址
   * - role (必填): 协作角色（editor/viewer）
   *   - editor: 可以编辑文档内容
   *   - viewer: 只能查看，不能编辑
   * 
   * 响应：添加/更新的协作者信息
   * 
   * UPSERT逻辑：
   * - 如果协作者已存在：更新其角色
   * - 如果协作者不存在：添加新协作者
   * - 使用PostgreSQL的ON CONFLICT实现原子性操作
   * 
   * 业务规则：
   * - 不能将文档所有者添加为协作者
   * - 被添加的用户必须已注册
   * - 添加操作会被记录到活动日志
   */
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

  /**
   * DELETE /api/documents/:id/collaborators/:userId
   * 移除协作者
   * 
   * 功能：从文档中移除指定的协作者
   * 权限：需要登录，且必须是文档所有者
   * 
   * 请求参数：
   * - id (路径参数): 文档ID
   * - userId (路径参数): 要移除的协作者的用户ID
   * 
   * 响应：204 No Content（成功移除）
   * 
   * 效果：
   * - 协作者将立即失去对该文档的访问权限
   * - 如果协作者正在编辑文档，会被强制退出
   * - 移除操作会被记录到活动日志
   * 
   * 注意：
   * - 不能移除文档所有者（所有者不是协作者）
   * - 如果指定的用户不是协作者，操作仍会成功（幂等性）
   */
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

