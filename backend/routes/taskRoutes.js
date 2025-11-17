const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");
const { logUserActivity, logSystemLog } = require("../services/activityService");
const { createNotification } = require("../services/notificationService");
const { validateDocumentId, validateTaskCreate } = require("../middleware/validators");

// 创建任务路由函数，接收 io 实例用于实时通知
const createTaskRoutes = (io) => {
  const router = express.Router();

  // 获取文档的所有任务
  router.get("/documents/:documentId/tasks", protect, validateDocumentId, async (req, res) => {
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
      // 管理员可以查看所有文档的任务
      if (!userRole && req.user.role !== "admin") {
        return res.status(403).json({ message: "无权查看该文档的任务" });
      }

      // 获取所有任务，包括创建者、分配者、完成者信息
      const tasksResult = await pool.query(
        `SELECT 
            t.id,
            t.document_id,
            t.title,
            t.description,
            t.anchor_text,
            t.anchor_index,
            t.anchor_length,
            t.status,
            t.priority,
            t.due_date,
            t.completed_at,
            t.created_at,
            t.updated_at,
            json_build_object(
              'id', creator.id,
              'email', creator.email,
              'phone', creator.phone,
              'full_name', creator.full_name,
              'avatar_url', creator.avatar_url
            ) as created_by,
            CASE 
              WHEN t.assigned_to IS NOT NULL THEN
                json_build_object(
                  'id', assignee.id,
                  'email', assignee.email,
                  'phone', assignee.phone,
                  'full_name', assignee.full_name,
                  'avatar_url', assignee.avatar_url
                )
              ELSE NULL
            END as assigned_to,
            CASE 
              WHEN t.completed_by IS NOT NULL THEN
                json_build_object(
                  'id', completer.id,
                  'email', completer.email,
                  'phone', completer.phone,
                  'full_name', completer.full_name
                )
              ELSE NULL
            END as completed_by
         FROM document_tasks t
         JOIN users creator ON t.created_by = creator.id
         LEFT JOIN users assignee ON t.assigned_to = assignee.id
         LEFT JOIN users completer ON t.completed_by = completer.id
         WHERE t.document_id = $1
         ORDER BY 
           CASE t.status
             WHEN 'pending' THEN 1
             WHEN 'in_progress' THEN 2
             WHEN 'completed' THEN 3
             WHEN 'cancelled' THEN 4
           END,
           CASE t.priority
             WHEN 'urgent' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             WHEN 'low' THEN 4
           END,
           t.due_date ASC NULLS LAST,
           t.created_at DESC`,
        [documentId]
      );

      const tasks = tasksResult.rows.map((row) => ({
        id: row.id,
        documentId: row.document_id,
        title: row.title,
        description: row.description,
        anchorText: row.anchor_text,
        anchorIndex: row.anchor_index,
        anchorLength: row.anchor_length,
        status: row.status,
        priority: row.priority,
        dueDate: row.due_date,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        assignedTo: row.assigned_to,
        completedBy: row.completed_by,
      }));

      res.json(tasks);
    } catch (error) {
      console.error("获取任务失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 创建任务
  router.post("/documents/:documentId/tasks", protect, validateDocumentId, validateTaskCreate, async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "无效的文档 ID" });
      }

      const {
        title,
        description,
        assignedTo,
        anchorText,
        anchorIndex,
        anchorLength,
        priority = "medium",
        dueDate,
      } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ message: "任务标题不能为空" });
      }

      // 检查用户是否有权限在文档中创建任务
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
        return res.status(403).json({ message: "无权在该文档中创建任务" });
      }

      // 如果指定了分配对象，验证用户是否存在且有权访问文档
      if (assignedTo) {
        const assigneeCheck = await pool.query(
          `SELECT u.id
           FROM users u
           WHERE u.id = $1`,
          [assignedTo]
        );

        if (assigneeCheck.rows.length === 0) {
          return res.status(400).json({ message: "被分配的用户不存在" });
        }

        // 检查被分配的用户是否有权限访问文档
        const assigneeAccess = await pool.query(
          `SELECT 
              CASE 
                WHEN d.owner_id = $2 THEN 'owner'
                WHEN EXISTS (
                  SELECT 1 FROM document_collaborators dc 
                  WHERE dc.document_id = d.id AND dc.user_id = $2
                ) THEN 'has_access'
                ELSE NULL
              END as access
           FROM documents d
           WHERE d.id = $1`,
          [documentId, assignedTo]
        );

        if (!assigneeAccess.rows[0]?.access) {
          return res
            .status(403)
            .json({ message: "被分配的用户无权访问该文档" });
        }
      }

      // 创建任务
      const newTaskResult = await pool.query(
        `INSERT INTO document_tasks 
         (document_id, title, description, created_by, assigned_to, anchor_text, anchor_index, anchor_length, priority, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          documentId,
          title.trim(),
          description ? description.trim() : null,
          req.user.id,
          assignedTo || null,
          anchorText || null,
          anchorIndex || null,
          anchorLength || null,
          priority,
          dueDate || null,
        ]
      );

      const newTask = newTaskResult.rows[0];

      // 获取完整的任务信息
      const fullTaskResult = await pool.query(
        `SELECT 
            t.id,
            t.document_id,
            t.title,
            t.description,
            t.anchor_text,
            t.anchor_index,
            t.anchor_length,
            t.status,
            t.priority,
            t.due_date,
            t.completed_at,
            t.created_at,
            t.updated_at,
            json_build_object(
              'id', creator.id,
              'email', creator.email,
              'phone', creator.phone,
              'full_name', creator.full_name,
              'avatar_url', creator.avatar_url
            ) as created_by,
            CASE 
              WHEN t.assigned_to IS NOT NULL THEN
                json_build_object(
                  'id', assignee.id,
                  'email', assignee.email,
                  'phone', assignee.phone,
                  'full_name', assignee.full_name,
                  'avatar_url', assignee.avatar_url
                )
              ELSE NULL
            END as assigned_to
         FROM document_tasks t
         JOIN users creator ON t.created_by = creator.id
         LEFT JOIN users assignee ON t.assigned_to = assignee.id
         WHERE t.id = $1`,
        [newTask.id]
      );

      const fullTask = {
        ...fullTaskResult.rows[0],
        createdBy: fullTaskResult.rows[0].created_by,
        assignedTo: fullTaskResult.rows[0].assigned_to,
        completedBy: null,
      };

      // 记录操作日志
      await logActivity(req.user.id, "CREATE_TASK", "document", documentId, {
        taskId: newTask.id,
        assignedTo: assignedTo || null,
      });

      // 获取文档信息用于通知
      const docInfo = await pool.query(
        "SELECT title FROM documents WHERE id = $1",
        [documentId]
      );
      const docTitle = docInfo.rows[0]?.title || "文档";

      // 创建通知并发送 Socket.IO 实时通知
      if (io) {
        io.to(String(documentId)).emit("newTask", fullTask);

        // 如果分配了任务，通知被分配的用户
        if (assignedTo) {
          // 创建数据库通知
          await createNotification(
            assignedTo,
            "task_assigned",
            `${req.user.full_name || req.user.email} 在 "${docTitle}" 中给您分配了任务`,
            fullTask.title,
            req.user.id,
            "task",
            newTask.id,
            {
              documentId,
              documentTitle: docTitle,
              taskId: newTask.id,
            }
          );

          // 发送 Socket.IO 实时通知
          io.to(`user_${assignedTo}`).emit("taskAssigned", {
            task: fullTask,
            documentId,
            assignedBy: {
              id: req.user.id,
              email: req.user.email,
              full_name: req.user.full_name,
            },
          });

          // 发送新通知事件
          io.to(`user_${assignedTo}`).emit("newNotification", {
            type: "task_assigned",
            title: `${req.user.full_name || req.user.email} 在 "${docTitle}" 中给您分配了任务`,
          });
        }
      }

      // 记录用户活动
      logUserActivity(
        req.user.id,
        'task_create',
        'task',
        newTask.id,
        { documentId, assignedTo: assignedTo || null },
        req
      ).catch(err => {
        console.error("记录任务创建活动失败:", err);
      });

      res.status(201).json(fullTask);
    } catch (error) {
      console.error("创建任务失败:", error);
      
      // 记录系统错误日志
      logSystemLog(
        'error',
        'error',
        `创建任务失败: ${error.message}`,
        { stack: error.stack, code: error.code, documentId: req.params.documentId },
        req.user?.id,
        req
      ).catch(err => console.error("记录错误日志失败:", err));
      
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 更新任务
  router.put("/tasks/:taskId", protect, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId, 10);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "无效的任务 ID" });
      }

      const {
        title,
        description,
        assignedTo,
        status,
        priority,
        dueDate,
      } = req.body;

      // 获取任务信息
      const taskResult = await pool.query(
        `SELECT t.id, t.document_id, t.created_by, t.assigned_to, t.status
         FROM document_tasks t
         WHERE t.id = $1`,
        [taskId]
      );

      if (taskResult.rows.length === 0) {
        return res.status(404).json({ message: "任务不存在" });
      }

      const task = taskResult.rows[0];

      // 检查权限：创建者、被分配者或文档所有者可以更新任务
      const docCheck = await pool.query(
        `SELECT owner_id FROM documents WHERE id = $1`,
        [task.document_id]
      );

      const isOwner = docCheck.rows[0]?.owner_id === req.user.id;
      const isCreator = task.created_by === req.user.id;
      const isAssigned = task.assigned_to === req.user.id;

      if (!isOwner && !isCreator && !isAssigned) {
        return res.status(403).json({ message: "无权更新该任务" });
      }

      // 如果更改了分配对象，验证新用户
      if (assignedTo !== undefined && assignedTo !== task.assigned_to) {
        if (assignedTo) {
          const assigneeCheck = await pool.query(
            `SELECT u.id
             FROM users u
             WHERE u.id = $1`,
            [assignedTo]
          );

          if (assigneeCheck.rows.length === 0) {
            return res.status(400).json({ message: "被分配的用户不存在" });
          }

          // 检查被分配的用户是否有权限访问文档
          const assigneeAccess = await pool.query(
            `SELECT 
                CASE 
                  WHEN d.owner_id = $2 THEN 'owner'
                  WHEN EXISTS (
                    SELECT 1 FROM document_collaborators dc 
                    WHERE dc.document_id = d.id AND dc.user_id = $2
                  ) THEN 'has_access'
                  ELSE NULL
                END as access
             FROM documents d
             WHERE d.id = $1`,
            [task.document_id, assignedTo]
          );

          if (!assigneeAccess.rows[0]?.access) {
            return res
              .status(403)
              .json({ message: "被分配的用户无权访问该文档" });
          }
        }
      }

      // 构建更新字段
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (title !== undefined) {
        if (!title || !title.trim()) {
          return res.status(400).json({ message: "任务标题不能为空" });
        }
        updateFields.push(`title = $${paramIndex++}`);
        updateValues.push(title.trim());
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateValues.push(description ? description.trim() : null);
      }

      if (assignedTo !== undefined) {
        updateFields.push(`assigned_to = $${paramIndex++}`);
        updateValues.push(assignedTo || null);
      }

      if (status !== undefined) {
        if (!["pending", "in_progress", "completed", "cancelled"].includes(status)) {
          return res.status(400).json({ message: "无效的任务状态" });
        }
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(status);

        // 如果状态变为 completed，设置完成时间和完成者
        if (status === "completed" && task.status !== "completed") {
          updateFields.push(`completed_at = NOW()`);
          updateFields.push(`completed_by = $${paramIndex++}`);
          updateValues.push(req.user.id);
        } else if (status !== "completed" && task.status === "completed") {
          updateFields.push(`completed_at = NULL`);
          updateFields.push(`completed_by = NULL`);
        }
      }

      if (priority !== undefined) {
        if (!["low", "medium", "high", "urgent"].includes(priority)) {
          return res.status(400).json({ message: "无效的任务优先级" });
        }
        updateFields.push(`priority = $${paramIndex++}`);
        updateValues.push(priority);
      }

      if (dueDate !== undefined) {
        updateFields.push(`due_date = $${paramIndex++}`);
        updateValues.push(dueDate || null);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ message: "没有要更新的字段" });
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(taskId);

      const updateResult = await pool.query(
        `UPDATE document_tasks 
         SET ${updateFields.join(", ")}
         WHERE id = $${paramIndex}
         RETURNING *`,
        updateValues
      );

      // 获取更新后的完整任务信息
      const fullTaskResult = await pool.query(
        `SELECT 
            t.id,
            t.document_id,
            t.title,
            t.description,
            t.anchor_text,
            t.anchor_index,
            t.anchor_length,
            t.status,
            t.priority,
            t.due_date,
            t.completed_at,
            t.created_at,
            t.updated_at,
            json_build_object(
              'id', creator.id,
              'email', creator.email,
              'phone', creator.phone,
              'full_name', creator.full_name,
              'avatar_url', creator.avatar_url
            ) as created_by,
            CASE 
              WHEN t.assigned_to IS NOT NULL THEN
                json_build_object(
                  'id', assignee.id,
                  'email', assignee.email,
                  'phone', assignee.phone,
                  'full_name', assignee.full_name,
                  'avatar_url', assignee.avatar_url
                )
              ELSE NULL
            END as assigned_to,
            CASE 
              WHEN t.completed_by IS NOT NULL THEN
                json_build_object(
                  'id', completer.id,
                  'email', completer.email,
                  'phone', completer.phone,
                  'full_name', completer.full_name
                )
              ELSE NULL
            END as completed_by
         FROM document_tasks t
         JOIN users creator ON t.created_by = creator.id
         LEFT JOIN users assignee ON t.assigned_to = assignee.id
         LEFT JOIN users completer ON t.completed_by = completer.id
         WHERE t.id = $1`,
        [taskId]
      );

      const fullTask = {
        ...fullTaskResult.rows[0],
        createdBy: fullTaskResult.rows[0].created_by,
        assignedTo: fullTaskResult.rows[0].assigned_to,
        completedBy: fullTaskResult.rows[0].completed_by,
      };

      // 记录操作日志
      if (status === "completed" && task.status !== "completed") {
        await logActivity(
          req.user.id,
          "COMPLETE_TASK",
          "document",
          task.document_id,
          { taskId }
        );
      }

      // 获取文档信息用于通知
      const docInfo = await pool.query(
        "SELECT title FROM documents WHERE id = $1",
        [task.document_id]
      );
      const docTitle = docInfo.rows[0]?.title || "文档";

      // 创建通知并发送 Socket.IO 实时通知
      if (io) {
        io.to(String(task.document_id)).emit("taskUpdated", fullTask);

        // 如果任务被完成，通知创建者和被分配者
        if (status === "completed" && task.status !== "completed") {
          // 通知创建者（如果不是完成者本人）
          if (task.created_by !== req.user.id) {
            // 创建数据库通知
            await createNotification(
              task.created_by,
              "task_completed",
              `${req.user.full_name || req.user.email} 完成了任务 "${fullTask.title}"`,
              `任务 "${fullTask.title}" 在 "${docTitle}" 中已完成`,
              req.user.id,
              "task",
              taskId,
              {
                documentId: task.document_id,
                documentTitle: docTitle,
                taskId: taskId,
              }
            );

            io.to(`user_${task.created_by}`).emit("taskCompleted", {
              task: fullTask,
              documentId: task.document_id,
              completedBy: {
                id: req.user.id,
                email: req.user.email,
                full_name: req.user.full_name,
              },
            });

            // 发送新通知事件
            io.to(`user_${task.created_by}`).emit("newNotification", {
              type: "task_completed",
              title: `${req.user.full_name || req.user.email} 完成了任务 "${fullTask.title}"`,
            });
          }

          // 通知被分配者（如果存在且不是完成者本人）
          if (task.assigned_to && task.assigned_to !== req.user.id) {
            // 创建数据库通知
            await createNotification(
              task.assigned_to,
              "task_completed",
              `任务 "${fullTask.title}" 已完成`,
              `任务 "${fullTask.title}" 在 "${docTitle}" 中已完成`,
              req.user.id,
              "task",
              taskId,
              {
                documentId: task.document_id,
                documentTitle: docTitle,
                taskId: taskId,
              }
            );

            io.to(`user_${task.assigned_to}`).emit("taskCompleted", {
              task: fullTask,
              documentId: task.document_id,
              completedBy: {
                id: req.user.id,
                email: req.user.email,
                full_name: req.user.full_name,
              },
            });

            // 发送新通知事件
            io.to(`user_${task.assigned_to}`).emit("newNotification", {
              type: "task_completed",
              title: `任务 "${fullTask.title}" 已完成`,
            });
          }
        }

        // 如果更改了分配对象，通知新被分配的用户
        if (
          assignedTo !== undefined &&
          assignedTo !== task.assigned_to &&
          assignedTo
        ) {
          // 创建数据库通知
          await createNotification(
            assignedTo,
            "task_assigned",
            `${req.user.full_name || req.user.email} 在 "${docTitle}" 中给您分配了任务`,
            fullTask.title,
            req.user.id,
            "task",
            taskId,
            {
              documentId: task.document_id,
              documentTitle: docTitle,
              taskId: taskId,
            }
          );

          io.to(`user_${assignedTo}`).emit("taskAssigned", {
            task: fullTask,
            documentId: task.document_id,
            assignedBy: {
              id: req.user.id,
              email: req.user.email,
              full_name: req.user.full_name,
            },
          });

          // 发送新通知事件
          io.to(`user_${assignedTo}`).emit("newNotification", {
            type: "task_assigned",
            title: `${req.user.full_name || req.user.email} 在 "${docTitle}" 中给您分配了任务`,
          });
        }
      }

      // 记录用户活动
      // 如果任务状态变为完成，记录完成活动
      if (status === "completed" && task.status !== "completed") {
        logUserActivity(
          req.user.id,
          'task_complete',
          'task',
          taskId,
          { documentId: task.document_id, previousStatus: task.status },
          req
        ).catch(err => {
          console.error("记录任务完成活动失败:", err);
        });
      } else if (updateFields.length > 0) {
        // 其他更新操作记录为 task_update
        logUserActivity(
          req.user.id,
          'task_update',
          'task',
          taskId,
          { documentId: task.document_id, updatedFields: Object.keys(req.body) },
          req
        ).catch(err => {
          console.error("记录任务更新活动失败:", err);
        });
      }

      res.json(fullTask);
    } catch (error) {
      console.error("更新任务失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  // 删除任务
  router.delete("/tasks/:taskId", protect, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId, 10);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "无效的任务 ID" });
      }

      // 获取任务信息
      const taskResult = await pool.query(
        `SELECT t.id, t.document_id, t.created_by
         FROM document_tasks t
         WHERE t.id = $1`,
        [taskId]
      );

      if (taskResult.rows.length === 0) {
        return res.status(404).json({ message: "任务不存在" });
      }

      const task = taskResult.rows[0];

      // 检查权限：只有创建者或文档所有者可以删除任务
      const docCheck = await pool.query(
        `SELECT owner_id FROM documents WHERE id = $1`,
        [task.document_id]
      );

      const isOwner = docCheck.rows[0]?.owner_id === req.user.id;
      const isCreator = task.created_by === req.user.id;

      if (!isOwner && !isCreator) {
        return res.status(403).json({ message: "无权删除该任务" });
      }

      // 删除任务
      await pool.query("DELETE FROM document_tasks WHERE id = $1", [taskId]);

      // 记录操作日志
      await logActivity(
        req.user.id,
        "DELETE_TASK",
        "document",
        task.document_id,
        { taskId }
      );

      // 通过 Socket.IO 实时通知
      if (io) {
        io.to(String(task.document_id)).emit("taskDeleted", {
          taskId,
          documentId: task.document_id,
        });
      }

      res.json({ message: "任务已删除", taskId });
    } catch (error) {
      console.error("删除任务失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  });

  return router;
};

module.exports = createTaskRoutes;

