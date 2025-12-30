/**
 * 文档相关中间件
 */
const pool = require("../db");

/**
 * 检查用户是否为文档所有者
 */
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

module.exports = {
  isOwner,
};

