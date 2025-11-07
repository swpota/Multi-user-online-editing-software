const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db"); // 假设你将数据库连接池导出
const { logActivity } = require("../services/logService");

// 中间件：检查用户是否为文档所有者
const isOwner = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    const docResult = await pool.query(
      "SELECT owner_id FROM documents WHERE id = $1",
      [documentId]
    );
    if (docResult.rows.length === 0) {
      return res.status(404).json({ message: "文档不存在" });
    }

    if (docResult.rows[0].owner_id !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "只有文档所有者才能执行此操作" });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "服务器内部错误" });
  }
};

// 1. 获取文档列表 (【最终修正版】，区分管理员和普通用户)
router.get("/", protect, async (req, res) => {
  try {
    let query;
    let values;

    // --- (核心修复) 检查用户角色 ---
    if (req.user.role === "admin") {
      // 如果是管理员，则无视所有者和协作者规则，直接查询所有文档
      query = `
        SELECT d.id, d.title, d.updated_at, u.email as owner_email
        FROM documents d
        JOIN users u ON d.owner_id = u.id
        ORDER BY d.updated_at DESC
      `;
      values = []; // 管理员查询不需要任何参数
    } else {
      // 如果是普通用户，则使用之前的逻辑，只查询自己的和分享给自己的文档
      query = `
        SELECT d.id, d.title, d.updated_at, u.email as owner_email
        FROM documents d
        JOIN users u ON d.owner_id = u.id
        WHERE d.owner_id = $1 
        OR d.id IN (SELECT document_id FROM document_collaborators WHERE user_id = $1)
        ORDER BY d.updated_at DESC
      `;
      values = [req.user.id];
    }

    const documents = await pool.query(query, values);
    res.json(documents.rows);
  } catch (error) {
    console.error("获取文档列表失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 2. 创建一个新文档
router.post("/", protect, async (req, res) => {
  const { title } = req.body;
  const owner_id = req.user.id;

  if (!title) {
    return res.status(400).json({ message: "文档标题不能为空" });
  }

  try {
    const newDocument = await pool.query(
      "INSERT INTO documents (title, owner_id, content) VALUES ($1, $2, $3) RETURNING *",
      [title, owner_id, { ops: [{ insert: "\n" }] }] // 初始内容为一个空的 Delta
    );
    res.status(201).json(newDocument.rows[0]);
  } catch (error) {
    console.error("创建文档失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 3. 获取单个文档 (【最终终极修正版】)
router.get("/:id", protect, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "无效的文档 ID" });
    }

    const documentResult = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [id]
    );
    if (documentResult.rows.length === 0) {
      return res.status(404).json({ message: "文档不存在" });
    }
    const document = documentResult.rows[0];

    // --- 【最终的、统一的权限检查逻辑】 ---
    let userRoleForDoc = "none"; // 默认无权限

    // 检查是否为所有者或全局管理员
    if (document.owner_id === req.user.id || req.user.role === "admin") {
      userRoleForDoc = "owner"; // 'owner' 拥有最高权限
    } else {
      // 如果不是，再检查是否为协作者
      const collaboratorResult = await pool.query(
        "SELECT role FROM document_collaborators WHERE document_id = $1 AND user_id = $2",
        [id, req.user.id]
      );
      if (collaboratorResult.rows.length > 0) {
        userRoleForDoc = collaboratorResult.rows[0].role; // 'editor' or 'viewer'
      }
    }

    // 如果最终没有任何权限，则拒绝访问
    if (userRoleForDoc === "none") {
      return res.status(403).json({ message: "无权访问此文档" });
    }

    // --- (核心修复) 无论如何，都返回一个结构一致的对象 ---
    // 我们将用户在此文档中的【具体角色】作为一个新字段返回
    res.json({ ...document, userRoleForDoc });
  } catch (error) {
    console.error("获取文档失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 4. 更新文档 (【最终终极绝对修正版】)
router.put("/:id", protect, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "无效的文档 ID" });
    }

    // --- (核心修复 1) 首先，获取完整的文档信息用于权限判断 ---
    const documentResult = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [id]
    );
    if (documentResult.rows.length === 0) {
      return res.status(404).json({ message: "文档不存在" });
    }
    const document = documentResult.rows[0];

    // --- (核心修复 2) 植入完整的、正确的编辑权限检查逻辑 ---
    let canEdit = false;
    const isOwner = document.owner_id === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (isOwner || isAdmin) {
      canEdit = true;
    } else {
      const collaboratorResult = await pool.query(
        "SELECT role FROM document_collaborators WHERE document_id = $1 AND user_id = $2",
        [id, req.user.id]
      );
      if (
        collaboratorResult.rows.length > 0 &&
        collaboratorResult.rows[0].role === "editor"
      ) {
        canEdit = true;
      }
    }

    if (!canEdit) {
      return res.status(403).json({ message: "你没有权限编辑此文档" });
    }

    // --- (核心修复 3) 确保更新逻辑正确无误 ---
    const { title, content } = req.body;
    const fields = [];
    const values = [];

    if (title !== undefined) {
      fields.push(`title = $${fields.length + 1}`);
      values.push(title);
    }
    if (content !== undefined) {
      fields.push(`content = $${fields.length + 1}`);
      // --- (核心修复) 增加一个检查，确保我们只 stringify 对象 ---
      const contentToSave =
        typeof content === "object" && content !== null
          ? JSON.stringify(content)
          : content; // 如果不是对象(虽然不应该发生)，则按原样存
      values.push(contentToSave);
    }

    if (fields.length === 0) {
      return res.json(document);
    }

    values.push(id);
    const query = `UPDATE documents SET ${fields.join(
      ", "
    )}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`;
    const updatedDocument = await pool.query(query, values);

    // 为了与 GET 请求保持一致，我们也返回 userRoleForDoc
    res.json({
      ...updatedDocument.rows[0],
      userRoleForDoc: canEdit ? "editor" : "viewer",
    });
  } catch (error) {
    console.error("更新文档失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 5. 获取文档的协作者列表
router.get("/:id/collaborators", protect, isOwner, async (req, res) => {
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
    console.error("获取协作者列表失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 6. 添加/更新协作者
router.post("/:id/collaborators", protect, isOwner, async (req, res) => {
  const documentId = parseInt(req.params.id, 10);
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ message: "需要提供用户邮箱和角色" });
  }

  try {
    // 查找用户 ID
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
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

    // --- (核心集成) 记录日志 ---
    await logActivity(
      req.user.id, // 操作者：文档所有者
      "ADD_COLLABORATOR", // 动作
      "document", // 对象类型
      documentId, // 对象ID
      { targetUserId: userId, newRole: role } // 详情
    );

    res.status(201).json({ id: userId, email, role });
  } catch (error) {
    console.error("添加协作者失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 7. 移除协作者
router.delete(
  "/:id/collaborators/:userId",
  protect,
  isOwner,
  async (req, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      const userId = parseInt(req.params.userId, 10);

      await pool.query(
        "DELETE FROM document_collaborators WHERE document_id = $1 AND user_id = $2",
        [documentId, userId]
      );

      // --- (核心集成) 记录日志 ---
      await logActivity(
        req.user.id, // 操作者
        "REMOVE_COLLABORATOR", // 动作
        "document", // 对象类型
        documentId, // 对象ID
        { targetUserId: userId } // 详情
      );

      res.status(204).send(); // 204 No Content 表示成功删除
    } catch (error) {
      console.error("移除协作者失败:", error);
      res.status(500).json({ message: "服务器内部错误" });
    }
  }
);

// --- (新增) 8. 删除一个文档 ---
router.delete("/:id", protect, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = req.user.id;

    // 权限检查：必须是所有者或管理员
    const docResult = await pool.query(
      "SELECT owner_id FROM documents WHERE id = $1",
      [id]
    );
    if (docResult.rows.length === 0) {
      return res.status(404).json({ message: "文档不存在" });
    }

    const isOwner = docResult.rows[0].owner_id === userId;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "无权删除此文档" });
    }

    // 执行删除
    await pool.query("DELETE FROM documents WHERE id = $1", [id]);

    // --- 2. (核心集成) 记录日志 ---
    await logActivity(
      userId, // 操作者
      "DELETE_DOCUMENT", // 动作
      "document", // 对象类型
      id // 对象ID
    );

    res.status(204).send();
  } catch (error) {
    console.error("删除文档失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

module.exports = router;
