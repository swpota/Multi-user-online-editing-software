const express = require("express");
const { Pool } = require("pg");
const { protect } = require("../middleware/authMiddleware"); // 引入我们的“保安”

const router = express.Router();

// 数据库连接池配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- API 路由定义 ---

/**
 * @route   GET /api/documents
 * @desc    获取当前登录用户的所有文档
 * @access  Private (需要认证)
 */
router.get("/", protect, async (req, res) => {
  try {
    // req.user.id 来自于 protect 中间件
    const userId = req.user.id;

    // 查询该用户拥有的所有文档，按最后更新时间降序排序
    const documents = await pool.query(
      "SELECT id, title, updated_at FROM documents ORDER BY updated_at DESC"
    );

    res.status(200).json(documents.rows);
  } catch (error) {
    console.error("获取文档列表时出错:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

/**
 * @route   POST /api/documents
 * @desc    为当前登录用户创建一个新文档
 * @access  Private (需要认证)
 */
router.post("/", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    // 从请求体中获取标题，如果未提供，则使用默认标题
    const title = req.body.title || "无标题文档";

    // 在数据库中创建新文档记录
    const newDocument = await pool.query(
      "INSERT INTO documents (title, content, owner_id) VALUES ($1, $2, $3) RETURNING id, title, created_at, updated_at",
      [title, "", userId] // 初始内容为空字符串
    );

    res.status(201).json(newDocument.rows[0]);
  } catch (error) {
    console.error("创建新文档时出错:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

/**
 * @route   GET /api/documents/:id
 * @desc    获取单个文档的详细内容
 * @access  Private
 */
router.get("/:id", protect, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    const docResult = await pool.query(
      "SELECT * FROM documents WHERE id = $1",
      [documentId]
    );

    if (docResult.rows.length === 0) {
      // 如果文档不存在，或不属于该用户，返回 404
      return res.status(404).json({ message: "文档未找到或无权访问" });
    }

    res.status(200).json(docResult.rows[0]);
  } catch (error) {
    console.error("获取单个文档时出错:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

/**
 * @route   DELETE /api/documents/:id
 * @desc    删除一个文档
 * @access  Private
 */
router.delete("/:id", protect, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    // 在删除前，先验证该文档是否存在且属于该用户，确保用户不会删掉别人的文档
    const docResult = await pool.query(
      "DELETE FROM documents WHERE id = $1 RETURNING id",
      [documentId]
    );

    // 如果 docResult.rows.length 为 0，说明没有文档被删除
    // 这可能是因为文档ID不存在，或者该文档不属于当前登录的用户
    if (docResult.rows.length === 0) {
      return res.status(404).json({ message: "文档未找到或无权删除" });
    }

    // 成功删除，返回 200 OK 和一个成功消息
    res.status(200).json({ message: "文档已成功删除" });
  } catch (error) {
    console.error("删除文档时出错:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

/**
 * @route   PUT /api/documents/:id
 * @desc    更新一个文档（例如，更新标题）
 * @access  Private
 */
router.put("/:id", protect, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;
    const { title } = req.body; // 从请求体中获取新的标题

    // 检查新的标题是否存在
    if (typeof title === "undefined") {
      return res.status(400).json({ message: "请求体中缺少标题" });
    }

    const updateResult = await pool.query(
      "UPDATE documents SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING id, title, updated_at",
      [title, documentId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ message: "文档未找到或无权更新" });
    }

    // 成功更新，返回更新后的文档信息
    res.status(200).json(updateResult.rows[0]);
  } catch (error) {
    console.error("更新文档时出错:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

module.exports = router;
