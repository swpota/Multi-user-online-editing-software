import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api";
import "../styles/pages/ResetPasswordPage.css";

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
    if (newPassword.length < 6) {
      setError("新密码长度不能少于6位");
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
    <div className="reset-password-page">
      <div className="reset-password-container">
        <div className="reset-password-header">
          <h2 className="reset-password-title">
            重置密码
          </h2>
          <p className="reset-password-subtitle">
            请输入你的新密码
          </p>
        </div>

        <form onSubmit={handleSubmit} className="reset-password-form">
          <div className="reset-password-form-group">
            <label className="reset-password-label">
              新密码
            </label>
            <div className="reset-password-password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="至少6位字符"
                className="reset-password-input reset-password-input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="reset-password-password-toggle"
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>
          <div className="reset-password-form-group">
            <label className="reset-password-label">
              确认新密码
            </label>
            <div className="reset-password-password-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="再次输入密码"
                className="reset-password-input reset-password-input-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="reset-password-password-toggle"
              >
                {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          {error && (
            <div className="reset-password-message reset-password-message-error">
              {error}
            </div>
          )}
          {message && (
            <div className="reset-password-message reset-password-message-success">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="reset-password-submit-btn"
          >
            {loading ? "重置中..." : "重置密码"}
          </button>
        </form>

        <div className="reset-password-back-link">
          <Link to="/login">
            ← 返回登录
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
