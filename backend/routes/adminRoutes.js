const express = require("express");
const router = express.Router();
// 1. (核心修复) 只导入 protect，不再导入任何 adminProtect
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");

// 2. (核心修复) 创建一个简单的、内联的 admin 检查中间件
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "无权访问：需要管理员权限" });
  }
};

// @route   GET /api/admin/users
router.get("/users", protect, isAdmin, async (req, res) => {
  // 3. (核心修复) 按顺序使用 protect 和 isAdmin
  try {
    const usersResult = await pool.query(
      "SELECT id, email, role, avatar_url, created_at FROM users ORDER BY id ASC"
    );
    res.json(usersResult.rows);
  } catch (error) {
    console.error("获取用户列表失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    更新指定用户的角色 (【最终修正版】)
// @access  Private/Admin
router.put("/users/:id/role", protect, isAdmin, async (req, res) => {
  const { role } = req.body;
  const userIdToChange = parseInt(req.params.id, 10);
  const adminUserId = req.user.id;

  // 安全检查 1: 管理员不能修改自己的角色
  if (userIdToChange === adminUserId) {
    return res
      .status(400)
      .json({ message: "操作无效：管理员不能修改自己的角色" });
  }

  if (!role || (role !== "admin" && role !== "editor")) {
    return res.status(400).json({ message: "无效的角色" });
  }

  try {
    const targetUserResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [userIdToChange]
    );

    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }

    const previousRole = targetUserResult.rows[0].role;

    // --- (新增) 安全检查 2: 防止将最后一位管理员降级 ---
    if (role === "editor") {
      const adminCountResult = await pool.query(
        "SELECT COUNT(*) FROM users WHERE role = 'admin'"
      );
      const adminCount = parseInt(adminCountResult.rows[0].count, 10);

      // 如果系统中只有1个管理员，并且目标用户就是那个管理员，则禁止降级
      if (
        adminCount <= 1 &&
        previousRole === "admin"
      ) {
        return res
          .status(400)
          .json({ message: "操作无效：不能降级系统中最后一位管理员" });
      }
    }

    // --- (核心 Bug 修复) 使用正确的变量名 'userIdToChange' ---
    const updatedUser = await pool.query(
      "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role, avatar_url, created_at",
      [role, userIdToChange]
    );

    if (updatedUser.rows.length === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }

    // --- 2. (核心集成) 在成功更新后，记录日志 ---
    await logActivity(
      adminUserId, // 操作者：当前管理员
      "UPDATE_USER_ROLE", // 动作：更新角色
      "user", // 对象类型：用户
      userIdToChange, // 对象ID：被修改的用户
      {
        oldRole: previousRole, // (可选) 记录旧角色
        newRole: role, // (可选) 记录新角色
      }
    );

    res.json(updatedUser.rows[0]);
  } catch (error) {
    console.error("更新用户角色失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

module.exports = router;
