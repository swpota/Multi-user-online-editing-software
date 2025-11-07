import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const ProfilePage = ({ user, setUser }) => {
  const [fullName, setFullName] = useState(user.full_name || "");
  const [contactEmail, setContactEmail] = useState(user.contact_email || "");
  const [contactPhone, setContactPhone] = useState(user.contact_phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user.avatar_url || null);

  useEffect(() => {
    setFullName(user.full_name || "");
    setContactEmail(user.contact_email || "");
    setContactPhone(user.contact_phone || "");
    setAvatarPreview(user.avatar_url || null);
  }, [user]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMessage("");
    setProfileError("");

    try {
      const response = await api.put("/users/profile", {
        fullName: fullName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
      });

      setProfileMessage(response.data.message || "资料更新成功");
      setUser(response.data.user);
    } catch (err) {
      setProfileError(err.response?.data?.message || "更新资料失败");
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("新密码和确认密码不匹配");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setPasswordError("新密码长度不能少于6位");
      return;
    }

    if (!currentPassword || !newPassword) {
      setPasswordError("请填写当前密码和新密码");
      return;
    }

    try {
      const response = await api.put("/users/profile", {
        currentPassword,
        newPassword,
      });
      setPasswordMessage(response.data.message || "密码更新成功");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err.response?.data?.message || "更新密码失败");
    }
  };

  // --- (新增) 处理文件选择 ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      // 创建一个临时的 URL 用于本地预览
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  // --- (核心修复) 处理头像上传 ---
  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      setProfileError("请先选择一个文件");
      return;
    }
    const formData = new FormData();
    formData.append("avatar", avatarFile);
    try {
      const response = await api.post("/users/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setProfileMessage("头像更新成功");
      setUser(response.data.user);
      setAvatarFile(null);
    } catch (err) {
      setProfileError(err.response?.data?.message || "上传失败");
    }
  };

  return (
    <div
      style={{
        maxWidth: "500px",
        margin: "2rem auto",
        padding: "2rem",
        border: "1px solid #ccc",
        borderRadius: "8px",
      }}
    >
      <Link to="/" className="button-like">
        &larr; 返回仪表盘
      </Link>
      <h2 style={{ textAlign: "center" }}>个人资料</h2>
      {/* --- (新增) 头像部分 --- */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <img
          src={avatarPreview || "default-avatar.png"} // 你可以在 public 目录放一个默认头像
          alt="User Avatar"
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            objectFit: "cover",
            border: "2px solid #ccc",
          }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "block", margin: "1rem auto" }}
        />
        <button
          onClick={handleAvatarUpload}
          disabled={!avatarFile}
          style={styles.button}
        >
          上传新头像
        </button>
      </div>
      <p>
        <strong>邮箱:</strong> {user.email}
      </p>
      {user.phone && (
        <p>
          <strong>手机号:</strong> {user.phone}
        </p>
      )}

      {profileError && <p style={{ color: "red" }}>{profileError}</p>}
      {profileMessage && <p style={{ color: "green" }}>{profileMessage}</p>}

      <hr style={{ margin: "2rem 0" }} />

      <h4>联系方式</h4>
      <form onSubmit={handleProfileSubmit}>
        <div style={styles.formGroup}>
          <label>姓名</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={styles.input}
            placeholder="填写个人或团队称呼"
          />
        </div>
        <div style={styles.formGroup}>
          <label>联系邮箱</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            style={styles.input}
            placeholder="接收通知的邮箱"
          />
        </div>
        <div style={styles.formGroup}>
          <label>联系电话</label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            style={styles.input}
            placeholder="接收通知的电话"
          />
        </div>
        <button type="submit" style={styles.button}>
          保存资料
        </button>
      </form>

      <hr style={{ margin: "2rem 0" }} />

      <h4>修改密码</h4>
      <form onSubmit={handlePasswordSubmit}>
        <div style={styles.formGroup}>
          <label>当前密码</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            style={styles.input}
          />
        </div>
        <div style={styles.formGroup}>
          <label>新密码</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            style={styles.input}
          />
        </div>
        <div style={styles.formGroup}>
          <label>确认新密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={styles.input}
          />
        </div>

        {passwordError && <p style={{ color: "red" }}>{passwordError}</p>}
        {passwordMessage && <p style={{ color: "green" }}>{passwordMessage}</p>}

        <button type="submit" style={styles.button}>
          更新密码
        </button>
      </form>
    </div>
  );
};

const styles = {
  formGroup: { marginBottom: "1rem" },
  input: {
    width: "100%",
    padding: "8px",
    boxSizing: "border-box",
    marginTop: "4px",
  },
  button: {
    width: "100%",
    padding: "10px",
    background: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "1em",
  },
};

export default ProfilePage;
