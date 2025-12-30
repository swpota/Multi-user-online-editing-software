/**
 * 评论路由模块
 *
 * 提供文档评论的增删改查功能，支持树形评论（回复）和@提及通知。
 * 所有评论操作会通过Socket.IO实时推送给其他在线用户。
 */
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");
const { logUserActivity, logSystemLog } = require("../services/activityService");
const { createNotification } = require("../services/notificationService");
const { validateDocumentId, validateCommentCreate } = require("../middleware/validators");

/**
 * 创建评论路由
 * @param {object} io - Socket.IO实例
 */
const createCommentRoutes = (io) => {
  const router = express.Router();

  /**
   * 获取文档的所有评论
   * GET /api/documents/:documentId/comments
   *
   * 返回树形结构：父评论包含replies数组存放回复
   */
  router.get("/documents/:documentId/comments", protect, validateDocumentId, async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "无效的文档 ID" });
      }

      // 检查用户是否有权限查看文档
      const docCheck = await pool.query(
        `SELECT d.id, d.owner_id,
                CASE 
                  WHEN d.owner_id = $2 THEN 'owner'
                  WHEN EXISTS (
                    SELECT 1 FROM document_collaborators dc 
                    WHERE dc.document_id = d.id AND dc.user_id = $2
                  ) THEN (
                    SELECT dc.role FROM document_collaborators dc 
                    WHERE dc.document_id = d.id AND dc.user_id = $2
                  )
                  ELSE NULL
                END as user_role
         FROM documents d
         WHERE d.id = $1`,
        [documentId, req.user.id]
      );

      if (docCheck.rows.length === 0) {
        return res.status(404).json({ message: "文档不存在" });
      }

      const userRole = docCheck.rows[0].user_role;
      // 管理员可以查看所有文档的评论
      if (!userRole && req.user.role !== "admin") {
        return res.status(403).json({ message: "无权查看该文档的评论" });
      }

      // 获取所有评论，包括作者信息
      const commentsResult = await pool.query(
        `SELECT 
            c.id,
            c.document_id,
            c.parent_id,
            c.content,
            c.anchor_text,
            c.anchor_index,
            c.anchor_length,
            c.selection_range,
            c.mentioned_user_ids,
            c.is_resolved,
            c.resolved_by,
            c.resolved_at,
            c.created_at,
            c.updated_at,
            json_build_object(
              'id', u.id,
              'email', u.email,
              'phone', u.phone,
              'full_name', u.full_name,
              'avatar_url', u.avatar_url
            ) as author,
            CASE 
              WHEN c.resolved_by IS NOT NULL THEN
                json_build_object(
                  'id', ru.id,
                  'email', ru.email,
                  'phone', ru.phone,
                  'full_name', ru.full_name
                )
              ELSE NULL
            END as resolver
         FROM document_comments c
         JOIN users u ON c.author_id = u.id
         LEFT JOIN users ru ON c.resolved_by = ru.id
         WHERE c.document_id = $1
         ORDER BY c.created_at ASC`,
        [documentId]
      );

      // 构建评论树结构（父评论和回复）
      const comments = commentsResult.rows.map((row) => ({
        id: row.id,
        documentId: row.document_id,
        parentId: row.parent_id,
        content: row.content,
        anchorText: row.anchor_text,
        anchorIndex: row.anchor_index,
        anchorLength: row.anchor_length,
        selectionRange: row.selection_range,
        mentionedUserIds: row.mentioned_user_ids || [],
        isResolved: row.is_resolved,
        resolvedBy: row.resolver,
        resolvedAt: row.resolved_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: row.author,
        replies: [], // 将在下面填充
      }));

      // 构建树结构
      const commentMap = new Map();
      const rootComments = [];

      comments.forEach((comment) => {
        commentMap.set(comment.id, comment);
      });

      comments.forEach((comment) => {
        if (comment.parentId) {
          const parent = commentMap.get(comment.parentId);
          if (parent) {
            parent.replies.push(comment);
          }
        } else {
          rootComments.push(comment);
        }
      });

      res.json(rootComments);
    } catch (error) {
      console.error("获取评论失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  /**
   * POST /api/documents/:documentId/comments
   * 创建新评论或回复
   *
   * 功能：在指定文档中创建评论，支持@提及用户和回复其他评论
   * 权限：需要登录，且对文档有访问权限（owner/collaborator）
   *
   * 请求参数：
   * - documentId (路径参数): 文档ID
   * - content (必填): 评论内容
   * - parentId (可选): 父评论ID，用于创建回复
   * - anchorText (可选): 锚点文本，评论针对的文档片段
   * - anchorIndex (可选): 锚点位置索引
   * - anchorLength (可选): 锚点文本长度
   * - selectionRange (可选): 选中文本的范围对象
   * - mentionedUserIds (可选): 被@提及的用户ID数组
   *
   * 响应：创建的评论对象，包含作者信息
   *
   * 实时通知：
   * - 通过Socket.IO向文档房间推送新评论
   * - 向被@提及的用户发送通知
   * - 如果是回复，向父评论作者发送通知
   */
  router.post(
    "/documents/:documentId/comments",
    protect,
    validateDocumentId,
    validateCommentCreate,
    async (req, res) => {
      try {
        const documentId = parseInt(req.params.documentId, 10);
        if (isNaN(documentId)) {
          return res.status(400).json({ message: "无效的文档 ID" });
        }

        const {
          content,
          parentId,
          anchorText,
          anchorIndex,
          anchorLength,
          selectionRange,
          mentionedUserIds = [],
        } = req.body;

        if (!content || !content.trim()) {
          return res.status(400).json({ message: "评论内容不能为空" });
        }

        // 步骤1：检查用户是否有权限在文档中评论
        // 查询用户在该文档中的角色（owner/editor/viewer）
        // 只有owner或collaborator才能添加评论
        const docCheck = await pool.query(
          `SELECT d.id, d.owner_id,
                CASE 
                  WHEN d.owner_id = $2 THEN 'owner'
                  WHEN EXISTS (
                    SELECT 1 FROM document_collaborators dc 
                    WHERE dc.document_id = d.id AND dc.user_id = $2
                  ) THEN (
                    SELECT dc.role FROM document_collaborators dc 
                    WHERE dc.document_id = d.id AND dc.user_id = $2
                  )
                  ELSE NULL
                END as user_role
         FROM documents d
         WHERE d.id = $1`,
          [documentId, req.user.id]
        );

        if (docCheck.rows.length === 0) {
          return res.status(404).json({ message: "文档不存在" });
        }

        const userRole = docCheck.rows[0].user_role;
        if (!userRole) {
          return res.status(403).json({ message: "无权在该文档中评论" });
        }

        // 步骤2：如果是回复（parentId存在），验证父评论的有效性
        // 防止回复不存在的评论，或跨文档回复
        if (parentId) {
          const parentCheck = await pool.query(
            "SELECT id, document_id FROM document_comments WHERE id = $1",
            [parentId]
          );
          if (parentCheck.rows.length === 0 || parentCheck.rows[0].document_id !== documentId) {
            return res.status(400).json({ message: "无效的父评论 ID" });
          }
        }

        // 步骤3：验证所有被@提及的用户是否存在
        // 防止@不存在的用户，确保通知能正确发送
        if (mentionedUserIds && mentionedUserIds.length > 0) {
          const mentionedUsers = await pool.query(
            `SELECT id FROM users WHERE id = ANY($1::INTEGER[])`,
            [mentionedUserIds]
          );
          if (mentionedUsers.rows.length !== mentionedUserIds.length) {
            return res.status(400).json({ message: "部分提及的用户不存在" });
          }
        }

        // 步骤4：插入评论到数据库
        // 包含所有字段：内容、锚点信息、提及用户等
        const newCommentResult = await pool.query(
          `INSERT INTO document_comments 
         (document_id, parent_id, content, author_id, anchor_text, anchor_index, anchor_length, selection_range, mentioned_user_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING 
            id,
            document_id,
            parent_id,
            content,
            anchor_text,
            anchor_index,
            anchor_length,
            selection_range,
            mentioned_user_ids,
            is_resolved,
            created_at,
            updated_at`,
          [
            documentId,
            parentId || null,
            content.trim(),
            req.user.id,
            anchorText || null,
            anchorIndex || null,
            anchorLength || null,
            selectionRange ? JSON.stringify(selectionRange) : null,
            mentionedUserIds.length > 0 ? mentionedUserIds : [],
          ]
        );

        const newComment = newCommentResult.rows[0];

        // 步骤5：查询完整的评论信息
        // JOIN用户表获取作者的详细信息（姓名、头像等）
        // 这些信息用于前端显示和实时推送
        const fullCommentResult = await pool.query(
          `SELECT 
            c.id,
            c.document_id,
            c.parent_id,
            c.content,
            c.anchor_text,
            c.anchor_index,
            c.anchor_length,
            c.selection_range,
            c.mentioned_user_ids,
            c.is_resolved,
            c.resolved_by,
            c.resolved_at,
            c.created_at,
            c.updated_at,
            json_build_object(
              'id', u.id,
              'email', u.email,
              'phone', u.phone,
              'full_name', u.full_name,
              'avatar_url', u.avatar_url
            ) as author
         FROM document_comments c
         JOIN users u ON c.author_id = u.id
         WHERE c.id = $1`,
          [newComment.id]
        );

        const row = fullCommentResult.rows[0];

        // 处理时间字段：PostgreSQL 返回的 TIMESTAMPTZ 可能是 Date 对象或字符串
        const formatTimestamp = (timestamp) => {
          if (!timestamp) return null;
          if (timestamp instanceof Date) {
            return timestamp.toISOString();
          }
          if (typeof timestamp === "string") {
            // 如果已经是字符串，检查是否是有效的 ISO 格式
            try {
              const date = new Date(timestamp);
              if (!isNaN(date.getTime())) {
                return date.toISOString();
              }
            } catch (e) {
              console.warn("Invalid timestamp format:", timestamp);
            }
            return timestamp; // 如果已经是字符串，直接返回
          }
          return null;
        };

        const fullComment = {
          id: row.id,
          documentId: row.document_id,
          parentId: row.parent_id, // 确保使用 camelCase
          content: row.content,
          anchorText: row.anchor_text,
          anchorIndex: row.anchor_index,
          anchorLength: row.anchor_length,
          selectionRange: row.selection_range,
          mentionedUserIds: row.mentioned_user_ids || [],
          isResolved: row.is_resolved,
          resolvedBy: row.resolved_by,
          resolvedAt: formatTimestamp(row.resolved_at),
          createdAt: formatTimestamp(row.created_at), // 转换为 ISO 字符串格式
          updatedAt: formatTimestamp(row.updated_at), // 转换为 ISO 字符串格式
          author: row.author,
          replies: [], // 回复列表为空，因为这是新创建的评论
        };

        // 步骤6：记录用户操作日志
        // 用于审计和活动追踪
        await logActivity(req.user.id, "CREATE_COMMENT", "document", documentId, {
          commentId: newComment.id,
          parentId: parentId || null,
        });

        // 步骤7：获取文档标题，用于通知消息
        const docInfo = await pool.query("SELECT title FROM documents WHERE id = $1", [documentId]);
        const docTitle = docInfo.rows[0]?.title || "文档";

        // 步骤8：发送实时通知
        // 通知系统采用双重机制：
        // 1. Socket.IO实时推送（在线用户立即收到）
        // 2. 数据库通知记录（离线用户登录后可查看）
        if (io) {
          // 向文档房间的所有在线用户广播新评论
          io.to(String(documentId)).emit("newComment", fullComment);

          // 步骤8.1：处理@提及通知
          // 遍历所有被@的用户，为每个用户创建通知
          if (mentionedUserIds && mentionedUserIds.length > 0) {
            for (const userId of mentionedUserIds) {
              // 在数据库中创建持久化通知记录
              await createNotification(
                userId,
                "mention",
                `${req.user.full_name || req.user.email} 在 "${docTitle}" 中提到了您`,
                fullComment.content.substring(0, 100),
                req.user.id,
                "comment",
                newComment.id,
                {
                  documentId,
                  documentTitle: docTitle,
                  commentId: newComment.id,
                }
              );

              // 通过Socket.IO向被@用户的个人房间发送实时通知
              io.to(`user_${userId}`).emit("commentMention", {
                comment: fullComment,
                documentId,
                mentionedBy: {
                  id: req.user.id,
                  email: req.user.email,
                  full_name: req.user.full_name,
                },
              });

              // 触发通知铃铛的红点提示
              io.to(`user_${userId}`).emit("newNotification", {
                type: "mention",
                title: `${req.user.full_name || req.user.email} 在 "${docTitle}" 中提到了您`,
              });
            }
          }

          // 步骤8.2：处理回复通知
          // 如果这是一个回复，通知父评论的作者（但不通知自己回复自己）
          if (parentId) {
            const parentComment = await pool.query(
              "SELECT author_id FROM document_comments WHERE id = $1",
              [parentId]
            );
            if (parentComment.rows.length > 0 && parentComment.rows[0].author_id !== req.user.id) {
              const parentAuthorId = parentComment.rows[0].author_id;

              // 在数据库中创建回复通知记录
              await createNotification(
                parentAuthorId,
                "comment_reply",
                `${req.user.full_name || req.user.email} 回复了您的评论`,
                fullComment.content.substring(0, 100),
                req.user.id,
                "comment",
                newComment.id,
                {
                  documentId,
                  documentTitle: docTitle,
                  commentId: newComment.id,
                  parentCommentId: parentId,
                }
              );

              // 通过Socket.IO向父评论作者的个人房间发送实时通知
              io.to(`user_${parentAuthorId}`).emit("commentReply", {
                comment: fullComment,
                documentId,
                repliedBy: {
                  id: req.user.id,
                  email: req.user.email,
                  full_name: req.user.full_name,
                },
              });

              // 触发通知铃铛的红点提示
              io.to(`user_${parentAuthorId}`).emit("newNotification", {
                type: "comment_reply",
                title: `${req.user.full_name || req.user.email} 回复了您的评论`,
              });
            }
          }
        }

        // 记录用户活动
        logUserActivity(
          req.user.id,
          "comment_create",
          "comment",
          newComment.id,
          { documentId, parentId: parentId || null },
          req
        ).catch((err) => {
          console.error("记录评论创建活动失败:", err);
        });

        res.status(201).json(fullComment);
      } catch (error) {
        console.error("创建评论失败:", error);

        // 记录系统错误日志
        logSystemLog(
          "error",
          "error",
          `创建评论失败: ${error.message}`,
          { stack: error.stack, code: error.code, documentId: req.params.documentId },
          req.user?.id,
          req
        ).catch((err) => console.error("记录错误日志失败:", err));

        res.status(500).json({ message: "服务器内部错误" });
      }
    }
  );

  /**
   * PUT /api/comments/:commentId
   * 更新评论
   *
   * 功能：更新现有评论的内容或提及用户列表
   * 权限：需要登录，且只有评论作者本人可以更新
   *
   * 请求参数：
   * - commentId (路径参数): 评论ID
   * - content (可选): 新的评论内容
   * - mentionedUserIds (可选): 新的被@提及用户ID数组
   *
   * 响应：更新后的完整评论对象
   *
   * 特点：
   * - 动态SQL构建：只更新提供的字段
   * - 权限验证：只有作者可以编辑
   * - 实时推送：通过Socket.IO通知其他用户
   */
  router.put("/comments/:commentId", protect, async (req, res) => {
    try {
      const commentId = parseInt(req.params.commentId, 10);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "无效的评论 ID" });
      }

      const { content, mentionedUserIds } = req.body;

      // 获取评论信息
      const commentResult = await pool.query(
        `SELECT c.id, c.document_id, c.author_id, c.parent_id
         FROM document_comments c
         WHERE c.id = $1`,
        [commentId]
      );

      if (commentResult.rows.length === 0) {
        return res.status(404).json({ message: "评论不存在" });
      }

      const comment = commentResult.rows[0];

      // 步骤2：权限验证
      // 只有评论的原作者才能编辑，其他人（包括管理员）不能修改
      if (comment.author_id !== req.user.id) {
        return res.status(403).json({ message: "无权编辑该评论" });
      }

      // 步骤3：构建动态SQL更新语句
      // 只更新请求中提供的字段，避免覆盖其他数据
      const updateFields = []; // 存储 "field = $1" 格式的字段名
      const updateValues = []; // 存储对应的值
      let paramIndex = 1; // 参数索引计数器

      // 如果提供了content字段，添加到更新列表
      if (content !== undefined) {
        if (!content || !content.trim()) {
          return res.status(400).json({ message: "评论内容不能为空" });
        }
        updateFields.push(`content = $${paramIndex++}`);
        updateValues.push(content.trim());
      }

      // 如果提供了mentionedUserIds字段，添加到更新列表
      if (mentionedUserIds !== undefined) {
        updateFields.push(`mentioned_user_ids = $${paramIndex++}`);
        updateValues.push(Array.isArray(mentionedUserIds) ? mentionedUserIds : []);
      }

      // 验证至少有一个字段需要更新
      if (updateFields.length === 0) {
        return res.status(400).json({ message: "没有要更新的字段" });
      }

      // 添加WHERE条件参数（commentId）
      updateValues.push(commentId);

      // 执行动态构建的UPDATE语句
      // 例如：UPDATE document_comments SET content = $1, updated_at = NOW() WHERE id = $2
      const updateResult = await pool.query(
        `UPDATE document_comments 
         SET ${updateFields.join(", ")}, updated_at = NOW()
         WHERE id = $${paramIndex}
         RETURNING *`,
        updateValues
      );

      // 获取更新后的完整评论信息
      const fullCommentResult = await pool.query(
        `SELECT 
            c.id,
            c.document_id,
            c.parent_id,
            c.content,
            c.anchor_text,
            c.anchor_index,
            c.anchor_length,
            c.selection_range,
            c.mentioned_user_ids,
            c.is_resolved,
            c.resolved_by,
            c.resolved_at,
            c.created_at,
            c.updated_at,
            json_build_object(
              'id', u.id,
              'email', u.email,
              'phone', u.phone,
              'full_name', u.full_name,
              'avatar_url', u.avatar_url
            ) as author
         FROM document_comments c
         JOIN users u ON c.author_id = u.id
         WHERE c.id = $1`,
        [commentId]
      );

      const updateRow = fullCommentResult.rows[0];
      const fullComment = {
        id: updateRow.id,
        documentId: updateRow.document_id,
        parentId: updateRow.parent_id,
        content: updateRow.content,
        anchorText: updateRow.anchor_text,
        anchorIndex: updateRow.anchor_index,
        anchorLength: updateRow.anchor_length,
        selectionRange: updateRow.selection_range,
        mentionedUserIds: updateRow.mentioned_user_ids || [],
        isResolved: updateRow.is_resolved,
        resolvedBy: updateRow.resolved_by,
        resolvedAt: updateRow.resolved_at ? new Date(updateRow.resolved_at).toISOString() : null,
        createdAt: updateRow.created_at ? new Date(updateRow.created_at).toISOString() : null,
        updatedAt: updateRow.updated_at ? new Date(updateRow.updated_at).toISOString() : null,
        author: updateRow.author,
      };

      // 通过 Socket.IO 实时通知
      if (io) {
        io.to(String(comment.document_id)).emit("commentUpdated", fullComment);
      }

      res.json(fullComment);
    } catch (error) {
      console.error("更新评论失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  /**
   * DELETE /api/comments/:commentId
   * 删除评论
   *
   * 功能：删除指定评论，会级联删除所有回复
   * 权限：需要登录，且只有评论作者本人可以删除
   *
   * 请求参数：
   * - commentId (路径参数): 评论ID
   *
   * 响应：删除成功消息
   *
   * 注意：
   * - 删除父评论时，所有回复也会被级联删除（数据库外键约束）
   * - 通过Socket.IO实时通知文档房间的其他用户
   */
  router.delete("/comments/:commentId", protect, async (req, res) => {
    try {
      const commentId = parseInt(req.params.commentId, 10);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "无效的评论 ID" });
      }

      // 步骤1：查询评论信息，验证评论是否存在
      const commentResult = await pool.query(
        `SELECT c.id, c.document_id, c.author_id
         FROM document_comments c
         WHERE c.id = $1`,
        [commentId]
      );

      if (commentResult.rows.length === 0) {
        return res.status(404).json({ message: "评论不存在" });
      }

      const comment = commentResult.rows[0];

      // 步骤2：权限验证 - 只有评论作者本人可以删除
      if (comment.author_id !== req.user.id) {
        return res.status(403).json({ message: "无权删除该评论" });
      }

      // 步骤3：删除评论
      // 数据库外键配置了ON DELETE CASCADE，会自动级联删除所有子回复
      await pool.query("DELETE FROM document_comments WHERE id = $1", [commentId]);

      // 步骤4：记录删除操作日志
      await logActivity(req.user.id, "DELETE_COMMENT", "document", comment.document_id, {
        commentId,
      });

      // 步骤5：通过Socket.IO实时通知文档房间的所有在线用户
      // 前端收到通知后会从界面移除该评论及其所有回复
      if (io) {
        io.to(String(comment.document_id)).emit("commentDeleted", {
          commentId,
          documentId: comment.document_id,
        });
      }

      res.json({ message: "评论已删除", commentId });
    } catch (error) {
      console.error("删除评论失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  /**
   * POST /api/comments/:commentId/resolve
   * 解决或取消解决评论
   *
   * 功能：将评论标记为已解决或取消已解决状态
   * 权限：评论作者或文档所有者可以操作
   *
   * 请求参数：
   * - commentId (路径参数): 评论ID
   * - resolved (布尔值): true=标记为已解决，false=取消已解决
   *
   * 响应：更新后的评论对象
   *
   * 应用场景：
   * - 代码审查：标记已修复的问题
   * - 文档协作：标记已处理的建议
   */
  router.post("/comments/:commentId/resolve", protect, async (req, res) => {
    try {
      const commentId = parseInt(req.params.commentId, 10);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "无效的评论 ID" });
      }

      const { resolved } = req.body; // true = 解决, false = 取消解决

      // 步骤1：获取评论信息和当前解决状态
      const commentResult = await pool.query(
        `SELECT c.id, c.document_id, c.author_id, c.is_resolved
         FROM document_comments c
         WHERE c.id = $1`,
        [commentId]
      );

      if (commentResult.rows.length === 0) {
        return res.status(404).json({ message: "评论不存在" });
      }

      const comment = commentResult.rows[0];

      // 步骤2：权限检查 - 分两种情况
      // 1. 评论作者：可以解决自己的评论
      // 2. 文档所有者：可以解决任何人的评论
      const docCheck = await pool.query(`SELECT owner_id FROM documents WHERE id = $1`, [
        comment.document_id,
      ]);

      const isOwner = docCheck.rows[0]?.owner_id === req.user.id;
      const isAuthor = comment.author_id === req.user.id;

      if (!isOwner && !isAuthor) {
        return res.status(403).json({ message: "无权解决/取消解决该评论" });
      }

      // 步骤3：更新解决状态
      // 如果resolved=true：设置resolved_by为当前用户，记录resolved_at时间
      // 如果resolved=false：清空resolved_by和resolved_at
      const updateResult = await pool.query(
        `UPDATE document_comments 
         SET is_resolved = $1,
             resolved_by = $2,
             resolved_at = $3
         WHERE id = $4
         RETURNING *`,
        [
          resolved === true,
          resolved === true ? req.user.id : null,
          resolved === true ? new Date() : null,
          commentId,
        ]
      );

      // 获取更新后的完整评论信息
      const fullCommentResult = await pool.query(
        `SELECT 
            c.id,
            c.document_id,
            c.parent_id,
            c.content,
            c.anchor_text,
            c.anchor_index,
            c.anchor_length,
            c.selection_range,
            c.mentioned_user_ids,
            c.is_resolved,
            c.resolved_by,
            c.resolved_at,
            c.created_at,
            c.updated_at,
            json_build_object(
              'id', u.id,
              'email', u.email,
              'phone', u.phone,
              'full_name', u.full_name,
              'avatar_url', u.avatar_url
            ) as author,
            CASE 
              WHEN c.resolved_by IS NOT NULL THEN
                json_build_object(
                  'id', ru.id,
                  'email', ru.email,
                  'phone', ru.phone,
                  'full_name', ru.full_name
                )
              ELSE NULL
            END as resolver
         FROM document_comments c
         JOIN users u ON c.author_id = u.id
         LEFT JOIN users ru ON c.resolved_by = ru.id
         WHERE c.id = $1`,
        [commentId]
      );

      const resolveRow = fullCommentResult.rows[0];
      const fullComment = {
        id: resolveRow.id,
        documentId: resolveRow.document_id,
        parentId: resolveRow.parent_id,
        content: resolveRow.content,
        anchorText: resolveRow.anchor_text,
        anchorIndex: resolveRow.anchor_index,
        anchorLength: resolveRow.anchor_length,
        selectionRange: resolveRow.selection_range,
        mentionedUserIds: resolveRow.mentioned_user_ids || [],
        isResolved: resolveRow.is_resolved,
        resolvedBy: resolveRow.resolved_by,
        resolvedAt: resolveRow.resolved_at ? new Date(resolveRow.resolved_at).toISOString() : null,
        createdAt: resolveRow.created_at ? new Date(resolveRow.created_at).toISOString() : null,
        updatedAt: resolveRow.updated_at ? new Date(resolveRow.updated_at).toISOString() : null,
        author: resolveRow.author,
        resolver: resolveRow.resolver,
      };

      // 通过 Socket.IO 实时通知
      if (io) {
        io.to(String(comment.document_id)).emit("commentResolved", fullComment);
      }

      res.json(fullComment);
    } catch (error) {
      console.error("解决/取消解决评论失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  return router;
};

module.exports = createCommentRoutes;
