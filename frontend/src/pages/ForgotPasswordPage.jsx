import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../styles/pages/ForgotPasswordPage.css";
import logo from "../assets/logo.png";

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
    <div className="forgot-password-page">
      {/* 左侧品牌展示区 */}
      <div className="forgot-password-brand-section">
        <div className="forgot-password-brand-content">
          <div className="forgot-password-brand-logo">
            <img src={logo} alt="MindFlow Logo" />
            <h1>MindFlow</h1>
          </div>
          <h2 className="forgot-password-brand-title">
            忘记密码？别担心
          </h2>
          <p className="forgot-password-brand-description">
            我们会帮你快速重置密码，让你继续使用 MindFlow。
          </p>
          <div className="forgot-password-brand-features">
            <div className="forgot-password-brand-feature">
              <ion-icon name="mail-outline"></ion-icon>
              <span>邮箱重置</span>
            </div>
            <div className="forgot-password-brand-feature">
              <ion-icon name="shield-checkmark-outline"></ion-icon>
              <span>安全验证</span>
            </div>
            <div className="forgot-password-brand-feature">
              <ion-icon name="time-outline"></ion-icon>
              <span>快速恢复</span>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧表单区域 */}
      <div className="forgot-password-form-section">
        <div className="forgot-password-container">
          <div className="forgot-password-header">
            <h2 className="forgot-password-title">
              忘记密码
            </h2>
            <p className="forgot-password-subtitle">
              请输入你的邮箱或手机号，我们将向你发送密码重置指引。
            </p>
          </div>

        <form onSubmit={handleSubmit} className="forgot-password-form">
          <div className="forgot-password-form-group">
            <label className="forgot-password-label">
              <ion-icon name="person-outline"></ion-icon>
              账号 (邮箱或手机号)
            </label>
            <div className="forgot-password-input-wrapper">
              <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              placeholder="name@example.com 或 13800001234"
                className="forgot-password-input"
              />
            </div>
          </div>

          {error && (
            <div className="forgot-password-message forgot-password-message-error">
              {error}
            </div>
          )}
          {message && (
            <div className="forgot-password-message forgot-password-message-success">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`forgot-password-submit-btn ${loading ? 'forgot-password-submit-btn-loading' : ''}`}
          >
            {loading ? (
              <>
                <span className="forgot-password-btn-spinner"></span>
                发送中...
              </>
            ) : (
              <>
                <span>发送重置链接</span>
                <ion-icon name="arrow-forward-outline"></ion-icon>
              </>
            )}
          </button>
        </form>

          <div className="forgot-password-back-link">
            <Link to="/login">
              <ion-icon name="arrow-back-outline"></ion-icon>
              返回登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
