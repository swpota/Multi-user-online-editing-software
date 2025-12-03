const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const { protect } = require("../middleware/authMiddleware");
const pool = require("../db");
const { logActivity } = require("../services/logService");

// --- Multer 配置：用于处理文件上传 ---
const storage = multer.diskStorage({
  // 定义文件存储的位置
  destination: function (req, file, cb) {
    // 将文件存储在 backend/public/avatars 目录下
    // '..' 表示上级目录，因为此文件在 routes 文件夹内
    cb(null, path.join(__dirname, "..", "public", "avatars"));
  },
  // 定义存储的文件名
  filename: function (req, file, cb) {
    // 使用 'user-id-' + '时间戳' + '.原文件扩展名' 的格式，确保文件名唯一
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, `user-${req.user.id}-${uniqueSuffix}`);
  },
});

const upload = multer({ storage: storage });

// GET /api/users/profile - 获取当前用户信息
router.get("/profile", protect, (req, res) => {
  res.status(200).json({
    message: "成功获取用户个人信息",
    user: req.user,
  });
});

// PUT /api/users/profile - 更新当前用户信息
router.put("/profile", protect, async (req, res) => {
  const {
    currentPassword,
    newPassword,
    fullName,
    contactEmail,
    contactPhone,
  } = req.body;
  const userId = req.user.id;

  if (!currentPassword && newPassword) {
    return res.status(400).json({ message: "请提供当前密码以更新新密码" });
  }

  const updates = [];
  const values = [];
  let passwordChanged = false;

  try {
    // 从系统设置获取密码最小长度
    let minPasswordLength = 6;
    try {
      const passwordLengthSetting = await pool.query(
        "SELECT setting_value FROM system_settings WHERE setting_key = 'password_min_length'"
      );
      if (passwordLengthSetting.rows.length > 0) {
        minPasswordLength = parseInt(passwordLengthSetting.rows[0].setting_value, 10) || 6;
      }
    } catch (settingError) {
      console.error("获取密码长度设置失败，使用默认值:", settingError);
    }

    if (currentPassword && newPassword) {
      if (newPassword.length < minPasswordLength) {
        return res.status(400).json({ message: `新密码长度不能少于 ${minPasswordLength} 位` });
      }

      const userResult = await pool.query(
        "SELECT password_hash FROM users WHERE id = $1",
        [userId]
      );
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: "用户不存在" });
      }

      const { password_hash } = userResult.rows[0];
      const isMatch = await bcrypt.compare(currentPassword, password_hash);
      if (!isMatch) {
        return res.status(401).json({ message: "当前密码不正确" });
      }

      const salt = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(newPassword, salt);
      updates.push(`password_hash = $${updates.length + 1}`);
      values.push(newPasswordHash);
      passwordChanged = true;
    }

    if (fullName !== undefined) {
      updates.push(`full_name = $${updates.length + 1}`);
      values.push(fullName ? fullName.trim() : null);
    }

    if (contactEmail !== undefined) {
      updates.push(`contact_email = $${updates.length + 1}`);
      values.push(contactEmail ? contactEmail.trim().toLowerCase() : null);
    }

    if (contactPhone !== undefined) {
      updates.push(`contact_phone = $${updates.length + 1}`);
      values.push(contactPhone ? contactPhone.trim() : null);
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ message: "请提供要更新的个人资料信息" });
    }

    values.push(userId);

    const updatedUserResult = await pool.query(
      `UPDATE users
          SET ${updates.join(", ")}, updated_at = NOW()
        WHERE id = $${values.length}
    RETURNING id,
              email,
              phone,
              role,
              avatar_url,
              full_name,
              contact_email,
              contact_phone,
              created_at`,
      values
    );

    const updatedUser = updatedUserResult.rows[0];

    await logActivity(
      userId,
      passwordChanged ? "USER_UPDATE_PASSWORD" : "USER_UPDATE_PROFILE",
      "user",
      userId,
      {
        passwordChanged,
        fullName: updatedUser.full_name,
        contactEmail: updatedUser.contact_email,
        contactPhone: updatedUser.contact_phone,
      }
    );

    res.status(200).json({
      message: passwordChanged ? "密码更新成功" : "资料更新成功",
      user: updatedUser,
    });
  } catch (error) {
    console.error("更新个人资料时发生错误:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// --- (核心修复) POST /api/users/avatar - 上传头像 ---
router.post("/avatar", protect, upload.single("avatar"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "没有提供任何文件" });
  }

  try {
    const avatarUrl = `${req.protocol}://${req.get("host")}/avatars/${
      req.file.filename
    }`;

    await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [
      avatarUrl,
      req.user.id,
    ]);

    const updatedUserResult = await pool.query(
      `SELECT id,
              email,
              phone,
              role,
              avatar_url,
              full_name,
              contact_email,
              contact_phone,
              created_at
         FROM users WHERE id = $1`,
      [req.user.id]
    );

    await logActivity(
      req.user.id,
      "USER_UPDATE_AVATAR",
      "user",
      req.user.id
    );

    res.status(200).json({
      message: "头像上传成功",
      user: updatedUserResult.rows[0],
    });
  } catch (error) {
    console.error("上传头像失败:", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

module.exports = router;
