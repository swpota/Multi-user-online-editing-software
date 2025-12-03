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
  const [error, setError] = useState("");
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
    setError("");
    setMessage("");
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不匹配");
      setLoading(false);
      return;
    }
    if (newPassword.length < passwordMinLength) {
      setError(`新密码长度不能少于${passwordMinLength}位`);
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
        navigate("/");
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || "重置失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
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
        {/* Logo和标题 */}
        <div className="auth-header">
          <img src={logo} alt="MindFlow" className="auth-logo" />
          <h1 className="auth-brand">
            <span className="auth-brand-m">M</span>ind<span className="auth-brand-f">F</span>low
          </h1>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-title">重置密码</h2>
            <p className="auth-subtitle">
              请输入你的新密码
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-form-group">
              <label className="auth-label">新密码</label>
              <div className="auth-input-group">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder={`至少${passwordMinLength}位字符`}
                  disabled={loading}
                  className="auth-input"
                />
                <ion-icon name="lock-closed-outline" className="auth-input-icon"></ion-icon>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-password-toggle"
                >
                  <ion-icon name={showPassword ? "eye-off-outline" : "eye-outline"}></ion-icon>
                </button>
              </div>
            </div>

            <div className="auth-form-group">
              <label className="auth-label">确认新密码</label>
              <div className="auth-input-group">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="再次输入密码"
                  disabled={loading}
                  className="auth-input"
                />
                <ion-icon name="lock-closed-outline" className="auth-input-icon"></ion-icon>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="auth-password-toggle"
                >
                  <ion-icon name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}></ion-icon>
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-message auth-message-error">
                <ion-icon name="alert-circle-outline"></ion-icon>
                {error}
              </div>
            )}
            {message && (
              <div className="auth-message auth-message-success">
                <ion-icon name="checkmark-circle-outline"></ion-icon>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
            >
              {loading ? (
                <>
                  <span className="auth-btn-spinner"></span>
                  重置中...
                </>
              ) : (
                <>
                  <span>重置密码</span>
                  <ion-icon name="arrow-forward-outline"></ion-icon>
                </>
              )}
            </button>

            <div className="auth-footer">
              <Link to="/login" className="auth-link">
                <ion-icon name="arrow-back-outline"></ion-icon>
                返回登录
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
