import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../styles/components/Login.css";

function Login({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (!identifier) {
        setMessage("请输入邮箱或手机号");
        setLoading(false);
        return;
      }

      const response = await api.post("/auth/login", {
        identifier,
        password,
      });

      const { token, user } = response.data;
      localStorage.setItem("authToken", token);
      onLoginSuccess(user);

      const displayName = user.full_name || user.email || user.phone || "用户";
      setMessage(`登录成功! 欢迎回来, ${displayName}`);
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (error) {
      localStorage.removeItem("authToken");
      if (error.response) {
        setMessage(`登录失败: ${error.response.data.message}`);
      } else {
        setMessage("登录失败，请检查网络或联系管理员");
      }
      console.error("登录出错:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <h2 className="login-title">
          欢迎回来
        </h2>
        <p className="login-subtitle">
          登录您的账户以继续
        </p>
      </div>

      <form onSubmit={handleSubmit} className="login-form">
        <div className="login-form-group">
          <label className="login-label">
            账号 (邮箱或手机号)
          </label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="name@example.com 或 13800001234"
            required
            className="login-input"
          />
        </div>

        <div className="login-form-group-password">
          <label className="login-label">
            密码
          </label>
          <div className="login-password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="login-input login-input-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="login-password-toggle"
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="login-submit-btn"
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </form>

      {message && (
        <div
          className={`login-message ${
            message.includes("成功") ? "login-message-success" : "login-message-error"
          }`}
        >
          {message}
        </div>
      )}

      <div className="login-forgot-password">
        <Link
          to="/forgot-password"
          className="login-forgot-password-link"
        >
          忘记密码？
        </Link>
        <span className="login-link-separator">|</span>
        <Link
          to="/register"
          className="login-forgot-password-link"
        >
          注册账户
        </Link>
      </div>
    </div>
  );
}

export default Login;
