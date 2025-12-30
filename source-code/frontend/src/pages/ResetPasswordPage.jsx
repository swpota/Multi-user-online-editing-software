import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api";
import "../styles/components/Auth-modern.css";
import logo from "../assets/logo.svg";

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMinLength, setPasswordMinLength] = useState(6);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setMessage("两次输入的密码不匹配");
      setLoading(false);
      return;
    }
    if (newPassword.length < passwordMinLength) {
      setMessage(`新密码长度不能少于${passwordMinLength}位`);
      setLoading(false);
      return;
    }

    try {
      const response = await api.post("/auth/reset-password", {
        token,
        newPassword,
      });
      setMessage(response.data.message + " 即将跳转到登录页...");
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || "重置失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* 背景装饰 */}
      <div className="auth-background"></div>
      <div className="auth-grid-pattern"></div>
      <div className="auth-sparkles">
        <div className="auth-sparkle"></div>
        <div className="auth-sparkle"></div>
        <div className="auth-sparkle"></div>
        <div className="auth-sparkle"></div>
        <div className="auth-sparkle"></div>
      </div>

      <div className="auth-container">
        <div className="auth-card">
          {/* Logo 和头部 */}
          <div className="auth-header">
            <Link to="/" className="auth-logo">
              <img src={logo} alt="MindFlow" />
              <span className="auth-logo-text">
                <span className="auth-logo-text-m">M</span>ind
                <span className="auth-logo-text-f">F</span>low
              </span>
            </Link>
            <h2 className="auth-title">重置密码</h2>
            <p className="auth-subtitle">请输入你的新密码</p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="auth-form">
            {/* 消息提示 */}
            {message && (
              <div className={`auth-message ${message.includes("成功") ? "success" : "error"}`}>
                {message}
              </div>
            )}

            {/* 新密码输入 */}
            <div className="auth-form-group">
              <label className="auth-label">新密码</label>
              <div className="auth-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={`至少${passwordMinLength}位字符`}
                  required
                  disabled={loading}
                  className="auth-input"
                />
                <ion-icon name="lock-closed-outline" className="auth-input-icon"></ion-icon>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-password-toggle"
                  title={showPassword ? "隐藏密码" : "显示密码"}
                >
                  <ion-icon name={showPassword ? "eye-off-outline" : "eye-outline"}></ion-icon>
                </button>
              </div>
            </div>

            {/* 确认密码输入 */}
            <div className="auth-form-group">
              <label className="auth-label">确认新密码</label>
              <div className="auth-input-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  required
                  disabled={loading}
                  className="auth-input"
                />
                <ion-icon name="lock-closed-outline" className="auth-input-icon"></ion-icon>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="auth-password-toggle"
                  title={showConfirmPassword ? "隐藏密码" : "显示密码"}
                >
                  <ion-icon
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                  ></ion-icon>
                </button>
              </div>
            </div>

            {/* 重置按钮 */}
            <button
              type="submit"
              disabled={loading}
              className={`auth-button ${loading ? "loading" : ""}`}
            >
              {loading ? (
                <>
                  <div className="auth-spinner"></div>
                  <span>重置中...</span>
                </>
              ) : (
                <>
                  <span>重置密码</span>
                  <ion-icon name="arrow-forward-outline"></ion-icon>
                </>
              )}
            </button>
          </form>

          {/* 页脚链接 */}
          <div className="auth-footer">
            <Link to="/login" className="auth-footer-link">
              ← 返回登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
