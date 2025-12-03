import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../api";
import LazyImage from "../components/common/LazyImage";
import "../styles/pages/ProfilePage-modern.css";

const ProfilePage = ({ user, setUser }) => {
  // 系统设置
  const [passwordMinLength, setPasswordMinLength] = useState(6);

  // 个人资料状态
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

  // 同步用户信息到本地状态
  useEffect(() => {
    setFullName(user.full_name || "");
    setContactEmail(user.contact_email || "");
    setContactPhone(user.contact_phone || "");
    setAvatarPreview(user.avatar_url || null);
  }, [user]);

  // 获取系统密码配置
  useEffect(() => {
    const fetchPasswordSettings = async () => {
      try {
        const response = await api.get("/admin/settings/public");
        setPasswordMinLength(response.data.password_min_length || 6);
      } catch (error) {
        console.error("获取密码配置失败:", error);
      }
    };
    fetchPasswordSettings();
  }, []);

  // 提交个人资料更新
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

      toast.success(response.data.message || "资料更新成功");
      setUser(response.data.user);
    } catch (err) {
      toast.error(err.response?.data?.message || "更新资料失败");
    } finally {
      setLoading(false);
    }
  };

  // 提交密码更新
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");
    setLoading(true);

    if (newPassword !== confirmPassword) {
      toast.error("新密码和确认密码不匹配");
      setLoading(false);
      return;
    }
    if (newPassword && newPassword.length < passwordMinLength) {
      toast.error(`新密码长度不能少于${passwordMinLength}位`);
      setLoading(false);
      return;
    }

    if (!currentPassword || !newPassword) {
      toast.error("请填写当前密码和新密码");
      setLoading(false);
      return;
    }

    try {
      const response = await api.put("/users/profile", {
        currentPassword,
        newPassword,
      });
      toast.success(response.data.message || "密码更新成功");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "更新密码失败");
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
        {/* 返回链接 */}
        <Link to="/" className="profile-back-link">
          <ion-icon name="arrow-back-outline"></ion-icon>
          返回仪表盘
        </Link>

        {/* 头部卡片 - 头像和基本信息 */}
        <div className="profile-header-card">
          <div className="profile-header-bg"></div>
          
          <div className="profile-avatar-section">
            <LazyImage
              src={avatarPreview || "/default-avatar.png"}
              alt="User Avatar"
              className="profile-avatar"
              placeholder="/placeholder.svg"
              width="120px"
              height="120px"
            />
            <div className="profile-avatar-upload">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="profile-avatar-input"
                id="avatar-input"
              />
              <label htmlFor="avatar-input" className="profile-avatar-label">
                更换头像
              </label>
              {avatarFile && (
                <button
                  onClick={handleAvatarUpload}
                  disabled={loading}
                  className="profile-avatar-upload-btn"
                >
                  {loading ? "上传中..." : "确认上传"}
                </button>
              )}
            </div>
          </div>

          <h2 className="profile-name">{fullName || user.full_name || "未设置姓名"}</h2>
          <p className="profile-email">{user.email}</p>
          <span className="profile-role-badge">
            {user.role === "admin" ? "管理员" : "普通用户"}
          </span>
        </div>

        <div className="profile-content">
          {/* 账户信息卡片 */}
          <div className="profile-card">
            <h3 className="profile-card-title">账户信息</h3>
            <div className="profile-info-grid">
              <div className="profile-info-item">
                <span className="profile-info-label">邮箱：</span>
                <span className="profile-info-value">{user.email}</span>
              </div>
              {user.phone && (
                <div className="profile-info-item">
                  <span className="profile-info-label">手机号：</span>
                  <span className="profile-info-value">{user.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* 联系方式表单卡片 */}
          <div className="profile-card">
            <h3 className="profile-card-title">联系方式</h3>
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
              <div className="profile-form-group">
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
              <button
                type="submit"
                disabled={loading}
                className="profile-submit-btn shimmer-effect"
              >
                {loading ? "保存中..." : "保存资料"}
              </button>
            </form>
          </div>

          {/* 修改密码卡片 */}
          <div className="profile-card">
            <h3 className="profile-card-title">修改密码</h3>
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
                    style={{paddingLeft: '42px'}}
                  />
                  <ion-icon name="lock-closed-outline"></ion-icon>
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
                    style={{paddingLeft: '42px'}}
                  />
                  <ion-icon name="lock-closed-outline"></ion-icon>
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="profile-password-toggle"
                  >
                    {showNewPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>
              <div className="profile-form-group">
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
                    style={{paddingLeft: '42px'}}
                  />
                  <ion-icon name="lock-closed-outline"></ion-icon>
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="profile-password-toggle"
                  >
                    {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="profile-submit-btn shimmer-effect"
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
