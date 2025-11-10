import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../styles/pages/ProfilePage.css";

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
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    setLoading(true);

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
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setPasswordError("新密码和确认密码不匹配");
      setLoading(false);
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setPasswordError("新密码长度不能少于6位");
      setLoading(false);
      return;
    }

    if (!currentPassword || !newPassword) {
      setPasswordError("请填写当前密码和新密码");
      setLoading(false);
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
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      setProfileError("请先选择一个文件");
      return;
    }
    setLoading(true);
    setProfileError("");
    setProfileMessage("");
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* 头部 */}
        <div className="profile-header">
          <h2 className="profile-header-title">
            个人资料
          </h2>
          <Link to="/" className="profile-back-link">
            ← 返回仪表盘
          </Link>
        </div>

        <div className="profile-content">
          {/* 头像部分 */}
          <div className="profile-avatar-section">
            <div className="profile-avatar-wrapper">
              <img
                src={avatarPreview || "/default-avatar.png"}
                alt="User Avatar"
                className="profile-avatar-image"
              />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="profile-avatar-input"
              id="avatar-input"
            />
            <label htmlFor="avatar-input" className="profile-avatar-label">
              选择头像
            </label>
            <button
              onClick={handleAvatarUpload}
              disabled={!avatarFile || loading}
              className="profile-avatar-upload-btn"
            >
              {loading ? "上传中..." : "上传头像"}
            </button>
          </div>

          {/* 账户信息 */}
          <div className="profile-section">
            <h3 className="profile-section-title">
              账户信息
            </h3>
            <div className="profile-account-info">
              <div className="profile-account-item">
                <strong className="profile-account-label">邮箱：</strong>
                <span className="profile-account-value">{user.email}</span>
              </div>
              {user.phone && (
                <div className="profile-account-item">
                  <strong className="profile-account-label">手机号：</strong>
                  <span className="profile-account-value">{user.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* 联系方式表单 */}
          <div className="profile-section">
            <h3 className="profile-section-title">
              联系方式
            </h3>
            <form onSubmit={handleProfileSubmit} className="profile-form">
              <div className="profile-form-group">
                <label className="profile-label">
                  姓名
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="填写个人或团队称呼"
                  className="profile-input"
                />
              </div>
              <div className="profile-form-group">
                <label className="profile-label">
                  联系邮箱
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="接收通知的邮箱"
                  className="profile-input"
                />
              </div>
              <div className="profile-form-group-last">
                <label className="profile-label">
                  联系电话
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="接收通知的电话"
                  className="profile-input"
                />
              </div>
              {profileError && (
                <div className="profile-message profile-message-error">
                  {profileError}
                </div>
              )}
              {profileMessage && (
                <div className="profile-message profile-message-success">
                  {profileMessage}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="profile-submit-btn"
              >
                {loading ? "保存中..." : "保存资料"}
              </button>
            </form>
          </div>

          {/* 修改密码 */}
          <div className="profile-password-section">
            <h3 className="profile-section-title">
              修改密码
            </h3>
            <form onSubmit={handlePasswordSubmit} className="profile-form">
              <div className="profile-form-group">
                <label className="profile-label">
                  当前密码
                </label>
                <div className="profile-password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="profile-input profile-input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="profile-password-toggle"
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>
              <div className="profile-form-group">
                <label className="profile-label">
                  新密码
                </label>
                <div className="profile-password-wrapper">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="profile-input profile-input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="profile-password-toggle"
                  >
                    {showNewPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>
              <div className="profile-form-group-last">
                <label className="profile-label">
                  确认新密码
                </label>
                <div className="profile-password-wrapper">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="profile-input profile-input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="profile-password-toggle"
                  >
                    {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="profile-message profile-message-error">
                  {passwordError}
                </div>
              )}
              {passwordMessage && (
                <div className="profile-message profile-message-success">
                  {passwordMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="profile-submit-btn"
              >
                {loading ? "更新中..." : "更新密码"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
