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
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        backgroundColor: "#f5f5f5",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          backgroundColor: "#fff",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {/* 头部 */}
        <div
          style={{
            padding: "24px",
            borderBottom: "1px solid #e8e8e8",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 600,
              color: "#333",
            }}
          >
            个人资料
          </h2>
          <Link
            to="/"
            style={{
              padding: "8px 16px",
              backgroundColor: "#fff",
              border: "1px solid #d9d9d9",
              borderRadius: "6px",
              textDecoration: "none",
              color: "#333",
              fontSize: "14px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = "#1890ff";
              e.target.style.color = "#1890ff";
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = "#d9d9d9";
              e.target.style.color = "#333";
            }}
          >
            ← 返回仪表盘
          </Link>
        </div>

        <div style={{ padding: "24px" }}>
          {/* 头像部分 */}
          <div
            style={{
              textAlign: "center",
              marginBottom: "32px",
              paddingBottom: "32px",
              borderBottom: "1px solid #e8e8e8",
            }}
          >
            <div
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                margin: "0 auto 16px",
                border: "4px solid #e8e8e8",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <img
                src={avatarPreview || "/default-avatar.png"}
                alt="User Avatar"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
              id="avatar-input"
            />
            <label
              htmlFor="avatar-input"
              style={{
                display: "inline-block",
                padding: "8px 16px",
                backgroundColor: "#1890ff",
                color: "#fff",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
                transition: "all 0.2s",
                marginRight: "8px",
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#40a9ff";
                e.target.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "#1890ff";
                e.target.style.transform = "translateY(0)";
              }}
            >
              选择头像
            </label>
            <button
              onClick={handleAvatarUpload}
              disabled={!avatarFile || loading}
              style={{
                padding: "8px 16px",
                backgroundColor: avatarFile && !loading ? "#52c41a" : "#d9d9d9",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: avatarFile && !loading ? "pointer" : "not-allowed",
                fontSize: "14px",
                fontWeight: 500,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (avatarFile && !loading) {
                  e.target.style.backgroundColor = "#73d13d";
                  e.target.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (avatarFile && !loading) {
                  e.target.style.backgroundColor = "#52c41a";
                  e.target.style.transform = "translateY(0)";
                }
              }}
            >
              {loading ? "上传中..." : "上传头像"}
            </button>
          </div>

          {/* 账户信息 */}
          <div style={{ marginBottom: "32px" }}>
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "18px",
                fontWeight: 600,
                color: "#333",
              }}
            >
              账户信息
            </h3>
            <div
              style={{
                padding: "16px",
                backgroundColor: "#f5f5f5",
                borderRadius: "6px",
                marginBottom: "16px",
              }}
            >
              <div style={{ marginBottom: "8px" }}>
                <strong style={{ color: "#666", fontSize: "14px" }}>邮箱：</strong>
                <span style={{ color: "#333", fontSize: "14px" }}>{user.email}</span>
              </div>
              {user.phone && (
                <div>
                  <strong style={{ color: "#666", fontSize: "14px" }}>手机号：</strong>
                  <span style={{ color: "#333", fontSize: "14px" }}>{user.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* 联系方式表单 */}
          <div style={{ marginBottom: "32px" }}>
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "18px",
                fontWeight: 600,
                color: "#333",
              }}
            >
              联系方式
            </h3>
            <form onSubmit={handleProfileSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#333",
                  }}
                >
                  姓名
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="填写个人或团队称呼"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "14px",
                    border: "1px solid #d9d9d9",
                    borderRadius: "6px",
                    transition: "all 0.2s",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#1890ff";
                    e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#d9d9d9";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#333",
                  }}
                >
                  联系邮箱
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="接收通知的邮箱"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "14px",
                    border: "1px solid #d9d9d9",
                    borderRadius: "6px",
                    transition: "all 0.2s",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#1890ff";
                    e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#d9d9d9";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#333",
                  }}
                >
                  联系电话
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="接收通知的电话"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    fontSize: "14px",
                    border: "1px solid #d9d9d9",
                    borderRadius: "6px",
                    transition: "all 0.2s",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#1890ff";
                    e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#d9d9d9";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              {profileError && (
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "16px",
                    backgroundColor: "#fff2e8",
                    color: "#fa8c16",
                    borderRadius: "6px",
                    fontSize: "14px",
                    border: "1px solid #ffd591",
                  }}
                >
                  {profileError}
                </div>
              )}
              {profileMessage && (
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "16px",
                    backgroundColor: "#f6ffed",
                    color: "#52c41a",
                    borderRadius: "6px",
                    fontSize: "14px",
                    border: "1px solid #b7eb8f",
                  }}
                >
                  {profileMessage}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: loading ? "#d9d9d9" : "#1890ff",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "16px",
                  fontWeight: 500,
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.backgroundColor = "#40a9ff";
                    e.target.style.transform = "translateY(-1px)";
                    e.target.style.boxShadow = "0 4px 12px rgba(24, 144, 255, 0.3)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.backgroundColor = "#1890ff";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "none";
                  }
                }}
              >
                {loading ? "保存中..." : "保存资料"}
              </button>
            </form>
          </div>

          {/* 修改密码 */}
          <div
            style={{
              paddingTop: "32px",
              borderTop: "1px solid #e8e8e8",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "18px",
                fontWeight: 600,
                color: "#333",
              }}
            >
              修改密码
            </h3>
            <form onSubmit={handlePasswordSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#333",
                  }}
                >
                  当前密码
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      paddingRight: "40px",
                      fontSize: "14px",
                      border: "1px solid #d9d9d9",
                      borderRadius: "6px",
                      transition: "all 0.2s",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#1890ff";
                      e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#d9d9d9";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      color: "#666",
                      fontSize: "16px",
                    }}
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#333",
                  }}
                >
                  新密码
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      paddingRight: "40px",
                      fontSize: "14px",
                      border: "1px solid #d9d9d9",
                      borderRadius: "6px",
                      transition: "all 0.2s",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#1890ff";
                      e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#d9d9d9";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      color: "#666",
                      fontSize: "16px",
                    }}
                  >
                    {showNewPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#333",
                  }}
                >
                  确认新密码
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      paddingRight: "40px",
                      fontSize: "14px",
                      border: "1px solid #d9d9d9",
                      borderRadius: "6px",
                      transition: "all 0.2s",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#1890ff";
                      e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#d9d9d9";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      color: "#666",
                      fontSize: "16px",
                    }}
                  >
                    {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "16px",
                    backgroundColor: "#fff2e8",
                    color: "#fa8c16",
                    borderRadius: "6px",
                    fontSize: "14px",
                    border: "1px solid #ffd591",
                  }}
                >
                  {passwordError}
                </div>
              )}
              {passwordMessage && (
                <div
                  style={{
                    padding: "12px 16px",
                    marginBottom: "16px",
                    backgroundColor: "#f6ffed",
                    color: "#52c41a",
                    borderRadius: "6px",
                    fontSize: "14px",
                    border: "1px solid #b7eb8f",
                  }}
                >
                  {passwordMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: loading ? "#d9d9d9" : "#1890ff",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "16px",
                  fontWeight: 500,
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.backgroundColor = "#40a9ff";
                    e.target.style.transform = "translateY(-1px)";
                    e.target.style.boxShadow = "0 4px 12px rgba(24, 144, 255, 0.3)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.backgroundColor = "#1890ff";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "none";
                  }
                }}
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
