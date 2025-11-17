const express = require("express");
const router = express.Router();
// 1. (核心修复) 只导入 protect，不再导入任何 adminProtect
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");
const { validateUserId, validateUserRoleUpdate } = require("../middleware/validators");

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
      "SELECT id, email, role, avatar_url, full_name, created_at FROM users ORDER BY id ASC"
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
router.put("/users/:id/role", protect, isAdmin, validateUserId, validateUserRoleUpdate, async (req, res) => {
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

// @route   GET /api/admin/settings/public
// @desc    获取公共系统设置（不需要管理员权限，用于前端功能开关）
// @access  Public
router.get("/settings/public", async (req, res) => {
  try {
    const settingsResult = await pool.query(
      "SELECT setting_key, setting_value, setting_type FROM system_settings WHERE setting_key IN ('enable_chat', 'enable_comments', 'enable_tasks', 'enable_notifications', 'enable_video_conference', 'enable_registration', 'password_min_length') ORDER BY setting_key"
    );
    
    // 转换为对象格式，方便前端使用
    const settings = {};
    settingsResult.rows.forEach(row => {
      let value = row.setting_value;
      // 根据类型转换值
      if (row.setting_type === 'boolean') {
        value = value === 'true';
      } else if (row.setting_type === 'number') {
        value = parseFloat(value);
      }
      settings[row.setting_key] = value;
    });
    
    // 如果没有找到 password_min_length，设置默认值
    if (!settings.password_min_length) {
      settings.password_min_length = 6;
    }
    
    res.json(settings);
  } catch (error) {
    console.error("获取公共系统设置失败:", error);
    // 如果查询失败，返回默认值（所有功能启用）
    res.json({
      enable_chat: true,
      enable_comments: true,
      enable_tasks: true,
      enable_notifications: true,
      enable_video_conference: true,
      enable_registration: true,
      password_min_length: 6
    });
  }
});

// @route   GET /api/admin/settings
// @desc    获取系统设置
// @access  Private/Admin
router.get("/settings", protect, isAdmin, async (req, res) => {
  try {
    const settingsResult = await pool.query(
      "SELECT setting_key, setting_value, setting_type, description FROM system_settings ORDER BY setting_key"
    );
    
    // 转换为对象格式，方便前端使用
    const settings = {};
    settingsResult.rows.forEach(row => {
      let value = row.setting_value;
      // 根据类型转换值
      if (row.setting_type === 'boolean') {
        value = value === 'true';
      } else if (row.setting_type === 'number') {
        value = parseFloat(value);
      } else if (row.setting_type === 'json') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = value;
        }
      }
      settings[row.setting_key] = {
        value,
        type: row.setting_type,
        description: row.description
      };
    });
    
    res.json(settings);
  } catch (error) {
    console.error("获取系统设置失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// @route   PUT /api/admin/settings
// @desc    更新系统设置
// @access  Private/Admin
router.put("/settings", protect, isAdmin, async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ message: "无效的设置数据" });
    }
    
    const updatedSettings = {};
    const changes = {}; // 记录所有变更
    
    for (const [key, value] of Object.entries(settings)) {
      // 获取当前设置的类型和值
      const settingResult = await pool.query(
        "SELECT setting_type, setting_value FROM system_settings WHERE setting_key = $1",
        [key]
      );
      
      if (settingResult.rows.length === 0) {
        continue; // 跳过不存在的设置
      }
      
      const settingType = settingResult.rows[0].setting_type;
      const oldValue = settingResult.rows[0].setting_value;
      let settingValue = value;
      
      // 根据类型转换值
      if (settingType === 'boolean') {
        settingValue = value ? 'true' : 'false';
      } else if (settingType === 'number') {
        settingValue = String(value);
      } else if (settingType === 'json') {
        settingValue = JSON.stringify(value);
      } else {
        settingValue = String(value);
      }
      
      // 更新设置
      await pool.query(
        "UPDATE system_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = $2",
        [settingValue, key]
      );
      
      // 记录变更
      changes[key] = { old: oldValue, new: settingValue };
      
      // 返回转换后的值
      if (settingType === 'boolean') {
        updatedSettings[key] = value;
      } else if (settingType === 'number') {
        updatedSettings[key] = parseFloat(value);
      } else if (settingType === 'json') {
        updatedSettings[key] = typeof value === 'string' ? JSON.parse(value) : value;
      } else {
        updatedSettings[key] = value;
      }
    }
    
    // 只记录一条日志，包含所有变更
    if (Object.keys(changes).length > 0) {
      await logActivity(
        req.user.id,
        "UPDATE_SYSTEM_SETTINGS",
        "system_settings",
        null,
        { changes, count: Object.keys(changes).length }
      );
    }
    
    res.json({ message: "设置更新成功", settings: updatedSettings });
  } catch (error) {
    console.error("更新系统设置失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// @route   GET /api/admin/analytics
// @desc    获取用户行为分析数据
// @access  Private/Admin
router.get("/analytics", protect, isAdmin, async (req, res) => {
  try {
    const { period = '7d' } = req.query; // 默认7天
    
    // 计算时间范围
    let daysAgo = 7;
    if (period === '1d') daysAgo = 1;
    else if (period === '7d') daysAgo = 7;
    else if (period === '30d') daysAgo = 30;
    else if (period === '90d') daysAgo = 90;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    
    // 1. 用户活跃度统计
    const activeUsersResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count
       FROM user_activities
       WHERE created_at >= $1`,
      [startDate]
    );
    
    // 2. 活动类型统计
    const activityTypesResult = await pool.query(
      `SELECT activity_type, COUNT(*) as count
       FROM user_activities
       WHERE created_at >= $1
       GROUP BY activity_type
       ORDER BY count DESC`,
      [startDate]
    );
    
    // 3. 每日活跃用户数
    const dailyActiveResult = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as count
       FROM user_activities
       WHERE created_at >= $1
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [startDate]
    );
    
    // 4. 最活跃的用户
    const topUsersResult = await pool.query(
      `SELECT u.id, u.email, u.full_name, COUNT(ua.id) as activity_count
       FROM user_activities ua
       JOIN users u ON ua.user_id = u.id
       WHERE ua.created_at >= $1
       GROUP BY u.id, u.email, u.full_name
       ORDER BY activity_count DESC
       LIMIT 10`,
      [startDate]
    );
    
    // 5. 文档操作统计
    const documentStatsResult = await pool.query(
      `SELECT 
         COUNT(CASE WHEN activity_type = 'document_create' THEN 1 END) as documents_created,
         COUNT(CASE WHEN activity_type = 'document_edit' THEN 1 END) as documents_edited,
         COUNT(CASE WHEN activity_type = 'document_view' THEN 1 END) as documents_viewed
       FROM user_activities
       WHERE created_at >= $1 AND resource_type = 'document'`,
      [startDate]
    );
    
    // 6. 评论和任务统计
    const collaborationStatsResult = await pool.query(
      `SELECT 
         COUNT(CASE WHEN activity_type = 'comment_create' THEN 1 END) as comments_created,
         COUNT(CASE WHEN activity_type = 'task_create' THEN 1 END) as tasks_created,
         COUNT(CASE WHEN activity_type = 'task_complete' THEN 1 END) as tasks_completed
       FROM user_activities
       WHERE created_at >= $1`,
      [startDate]
    );
    
    res.json({
      period,
      activeUsers: parseInt(activeUsersResult.rows[0]?.count || 0),
      activityTypes: activityTypesResult.rows,
      dailyActive: dailyActiveResult.rows,
      topUsers: topUsersResult.rows,
      documentStats: documentStatsResult.rows[0] || { documents_created: 0, documents_edited: 0, documents_viewed: 0 },
      collaborationStats: collaborationStatsResult.rows[0] || { comments_created: 0, tasks_created: 0, tasks_completed: 0 }
    });
  } catch (error) {
    console.error("获取用户行为分析失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// @route   GET /api/admin/satisfaction-surveys
// @desc    获取满意度调查数据
// @access  Private/Admin
router.get("/satisfaction-surveys", protect, isAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // 获取满意度调查列表
    const surveysResult = await pool.query(
      `SELECT s.*, u.email, u.full_name
       FROM satisfaction_surveys s
       JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    
    // 统计信息
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_count,
         AVG(rating) as average_rating,
         COUNT(CASE WHEN rating = 5 THEN 1 END) as rating_5,
         COUNT(CASE WHEN rating = 4 THEN 1 END) as rating_4,
         COUNT(CASE WHEN rating = 3 THEN 1 END) as rating_3,
         COUNT(CASE WHEN rating = 2 THEN 1 END) as rating_2,
         COUNT(CASE WHEN rating = 1 THEN 1 END) as rating_1
       FROM satisfaction_surveys`
    );
    
    // 按分类统计
    const categoryStatsResult = await pool.query(
      `SELECT 
         category,
         COUNT(*) as count,
         AVG(rating) as average_rating
       FROM satisfaction_surveys
       WHERE category IS NOT NULL
       GROUP BY category
       ORDER BY count DESC`
    );
    
    res.json({
      surveys: surveysResult.rows,
      stats: statsResult.rows[0] || {
        total_count: 0,
        average_rating: 0,
        rating_5: 0,
        rating_4: 0,
        rating_3: 0,
        rating_2: 0,
        rating_1: 0
      },
      categoryStats: categoryStatsResult.rows
    });
  } catch (error) {
    console.error("获取满意度调查失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// @route   POST /api/admin/satisfaction-surveys
// @desc    提交满意度调查
// @access  Private
router.post("/satisfaction-surveys", protect, async (req, res) => {
  try {
    const { rating, feedback, category } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "评分必须在1-5之间" });
    }
    
    const result = await pool.query(
      `INSERT INTO satisfaction_surveys (user_id, rating, feedback, category)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, rating, feedback || null, category || null]
    );
    
    res.status(201).json({ message: "调查提交成功", survey: result.rows[0] });
  } catch (error) {
    console.error("提交满意度调查失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// @route   GET /api/admin/monitoring
// @desc    获取系统监控数据
// @access  Private/Admin
router.get("/monitoring", protect, isAdmin, async (req, res) => {
  try {
    // 1. 系统健康状态
    const healthStatus = {
      database: 'healthy',
      timestamp: new Date().toISOString()
    };
    
    // 测试数据库连接
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      healthStatus.database = 'unhealthy';
    }
    
    // 2. 错误日志统计（最近24小时）- 添加容错处理
    let errorLogsResult = { rows: [] };
    let recentErrorsResult = { rows: [] };
    let metricsResult = { rows: [] };
    
    try {
      errorLogsResult = await pool.query(
        `SELECT 
           log_level,
           COUNT(*) as count
         FROM system_logs
         WHERE created_at >= NOW() - INTERVAL '24 hours'
         GROUP BY log_level`
      );
    } catch (error) {
      console.error("获取错误日志统计失败，表可能不存在:", error.message);
    }
    
    // 3. 最近的错误日志
    try {
      recentErrorsResult = await pool.query(
        `SELECT *
         FROM system_logs
         WHERE log_level IN ('error', 'critical')
         ORDER BY created_at DESC
         LIMIT 20`
      );
    } catch (error) {
      console.error("获取最近错误日志失败，表可能不存在:", error.message);
    }
    
    // 4. 性能指标（最近1小时）
    try {
      metricsResult = await pool.query(
        `SELECT 
           metric_type,
           AVG(metric_value) as average_value,
           MAX(metric_value) as max_value,
           MIN(metric_value) as min_value
         FROM system_metrics
         WHERE created_at >= NOW() - INTERVAL '1 hour'
         GROUP BY metric_type`
      );
    } catch (error) {
      console.error("获取性能指标失败，表可能不存在:", error.message);
    }
    
    // 5. 系统资源使用情况（模拟，实际应该从系统获取）
    const systemResources = {
      cpu: process.cpuUsage(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      uptime: process.uptime()
    };
    
    // 6. 用户统计
    const userStatsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_users,
         COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
         COUNT(CASE WHEN role = 'editor' THEN 1 END) as editor_count,
         COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_users_7d
       FROM users`
    );
    
    // 7. 文档统计
    const documentStatsResult = await pool.query(
      `SELECT 
         COUNT(*) as total_documents,
         COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_documents_7d
       FROM documents`
    );
    
    res.json({
      health: healthStatus,
      errorLogs: errorLogsResult.rows,
      recentErrors: recentErrorsResult.rows,
      metrics: metricsResult.rows,
      systemResources,
      userStats: userStatsResult.rows[0] || {},
      documentStats: documentStatsResult.rows[0] || {}
    });
  } catch (error) {
    console.error("获取系统监控数据失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// @route   GET /api/admin/logs
// @desc    获取系统日志
// @access  Private/Admin
router.get("/logs", protect, isAdmin, async (req, res) => {
  try {
    const { level, type, limit = 100, offset = 0 } = req.query;
    
    let query = "SELECT * FROM system_logs WHERE 1=1";
    const params = [];
    let paramIndex = 1;
    
    if (level) {
      query += ` AND log_level = $${paramIndex}`;
      params.push(level);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND log_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error("获取系统日志失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

module.exports = router;
