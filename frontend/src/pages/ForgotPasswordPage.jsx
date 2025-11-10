import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../styles/pages/ForgotPasswordPage.css";

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
              账号 (邮箱或手机号)
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              placeholder="name@example.com 或 13800001234"
              className="forgot-password-input"
            />
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
            className="forgot-password-submit-btn"
          >
            {loading ? "发送中..." : "发送重置链接"}
          </button>
        </form>

        <div className="forgot-password-back-link">
          <Link to="/">
            ← 返回登录
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
