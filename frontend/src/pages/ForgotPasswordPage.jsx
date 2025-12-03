import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../styles/components/Auth-modern.css";
import logo from "../assets/logo.svg";

const ForgotPasswordPage = () => {
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      if (!identifier) {
        setError("请输入邮箱或手机号");
        setLoading(false);
        return;
      }

      const response = await api.post("/auth/request-password-reset", {
        identifier,
      });
      setMessage(response.data.message);
      setIdentifier("");
    } catch (err) {
      setError(err.response?.data?.message || "请求失败，请稍后再试。");
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
          <h2 className="auth-title">忘记密码</h2>
            <p className="auth-subtitle">
              请输入你的邮箱或手机号，我们将向你发送密码重置指引。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-form-group">
              <label className="auth-label">账号（邮箱或手机号）</label>
              <div className="auth-input-wrapper">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  placeholder="name@example.com 或 13800001234"
                  disabled={loading}
                  className="auth-input"
                />
                <ion-icon name="person-outline" className="auth-input-icon"></ion-icon>
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
                  发送中...
                </>
              ) : (
                <>
                  <span>发送重置链接</span>
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

export default ForgotPasswordPage;
