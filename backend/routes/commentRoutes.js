const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");
const { createNotification } = require("../services/notificationService");

// 创建评论路由函数，接收 io 实例用于实时通知
const createCommentRoutes = (io) => {
  const router = express.Router();

  // 获取文档的所有评论（包括回复）
  router.get("/documents/:documentId/comments", protect, async (req, res) => {
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
      if (!userRole) {
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

  // 创建评论
  router.post("/documents/:documentId/comments", protect, async (req, res) => {
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

      // 检查用户是否有权限在文档中评论
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

      // 如果 parentId 存在，验证父评论是否存在且属于同一文档
      if (parentId) {
        const parentCheck = await pool.query(
          "SELECT id, document_id FROM document_comments WHERE id = $1",
          [parentId]
        );
        if (
          parentCheck.rows.length === 0 ||
          parentCheck.rows[0].document_id !== documentId
        ) {
          return res.status(400).json({ message: "无效的父评论 ID" });
        }
      }

      // 验证提及的用户是否存在
      if (mentionedUserIds && mentionedUserIds.length > 0) {
        const mentionedUsers = await pool.query(
          `SELECT id FROM users WHERE id = ANY($1::INTEGER[])`,
          [mentionedUserIds]
        );
        if (mentionedUsers.rows.length !== mentionedUserIds.length) {
          return res.status(400).json({ message: "部分提及的用户不存在" });
        }
      }

      // 创建评论
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

      // 获取完整的评论信息（包括作者信息）
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
        if (typeof timestamp === 'string') {
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
      
      // 记录操作日志
      await logActivity(req.user.id, "CREATE_COMMENT", "document", documentId, {
        commentId: newComment.id,
        parentId: parentId || null,
      });

      // 获取文档信息用于通知
      const docInfo = await pool.query(
        "SELECT title FROM documents WHERE id = $1",
        [documentId]
      );
      const docTitle = docInfo.rows[0]?.title || "文档";

      // 创建通知并发送 Socket.IO 实时通知
      if (io) {
        io.to(String(documentId)).emit("newComment", fullComment);

        // 如果有提及的用户，发送通知
        if (mentionedUserIds && mentionedUserIds.length > 0) {
          for (const userId of mentionedUserIds) {
            // 创建数据库通知
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

            // 发送 Socket.IO 实时通知
            io.to(`user_${userId}`).emit("commentMention", {
              comment: fullComment,
              documentId,
              mentionedBy: {
                id: req.user.id,
                email: req.user.email,
                full_name: req.user.full_name,
              },
            });

            // 发送新通知事件
            io.to(`user_${userId}`).emit("newNotification", {
              type: "mention",
              title: `${req.user.full_name || req.user.email} 在 "${docTitle}" 中提到了您`,
            });
          }
        }

        // 如果是回复，通知父评论的作者
        if (parentId) {
          const parentComment = await pool.query(
            "SELECT author_id FROM document_comments WHERE id = $1",
            [parentId]
          );
          if (
            parentComment.rows.length > 0 &&
            parentComment.rows[0].author_id !== req.user.id
          ) {
            const parentAuthorId = parentComment.rows[0].author_id;

            // 创建数据库通知
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

            // 发送 Socket.IO 实时通知
            io.to(`user_${parentAuthorId}`).emit("commentReply", {
              comment: fullComment,
              documentId,
              repliedBy: {
                id: req.user.id,
                email: req.user.email,
                full_name: req.user.full_name,
              },
            });

            // 发送新通知事件
            io.to(`user_${parentAuthorId}`).emit("newNotification", {
              type: "comment_reply",
              title: `${req.user.full_name || req.user.email} 回复了您的评论`,
            });
          }
        }
      }

      res.status(201).json(fullComment);
    } catch (error) {
      console.error("创建评论失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 更新评论
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

      // 检查权限：只有作者可以编辑自己的评论
      if (comment.author_id !== req.user.id) {
        return res.status(403).json({ message: "无权编辑该评论" });
      }

      // 更新评论
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (content !== undefined) {
        if (!content || !content.trim()) {
          return res.status(400).json({ message: "评论内容不能为空" });
        }
        updateFields.push(`content = $${paramIndex++}`);
        updateValues.push(content.trim());
      }

      if (mentionedUserIds !== undefined) {
        updateFields.push(`mentioned_user_ids = $${paramIndex++}`);
        updateValues.push(
          Array.isArray(mentionedUserIds) ? mentionedUserIds : []
        );
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ message: "没有要更新的字段" });
      }

      updateValues.push(commentId);

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

  // 删除评论
  router.delete("/comments/:commentId", protect, async (req, res) => {
    try {
      const commentId = parseInt(req.params.commentId, 10);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "无效的评论 ID" });
      }

      // 获取评论信息
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

      // 检查权限：只有作者可以删除自己的评论
      if (comment.author_id !== req.user.id) {
        return res.status(403).json({ message: "无权删除该评论" });
      }

      // 删除评论（级联删除会同时删除所有回复）
      await pool.query("DELETE FROM document_comments WHERE id = $1", [
        commentId,
      ]);

      // 记录操作日志
      await logActivity(
        req.user.id,
        "DELETE_COMMENT",
        "document",
        comment.document_id,
        { commentId }
      );

      // 通过 Socket.IO 实时通知
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

  // 解决/取消解决评论
  router.post("/comments/:commentId/resolve", protect, async (req, res) => {
    try {
      const commentId = parseInt(req.params.commentId, 10);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "无效的评论 ID" });
      }

      const { resolved } = req.body; // true = 解决, false = 取消解决

      // 获取评论信息
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

      // 检查权限：作者或文档所有者可以解决/取消解决评论
      const docCheck = await pool.query(
        `SELECT owner_id FROM documents WHERE id = $1`,
        [comment.document_id]
      );

      const isOwner = docCheck.rows[0]?.owner_id === req.user.id;
      const isAuthor = comment.author_id === req.user.id;

      if (!isOwner && !isAuthor) {
        return res.status(403).json({ message: "无权解决/取消解决该评论" });
      }

      // 更新解决状态
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

