import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../styles/components/Login.css";
import logo from "../assets/logo.png";

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
        const statusCode = error.response.status;
        const errorData = error.response.data;
        
        // 处理 429 速率限制错误
        if (statusCode === 429) {
          let retryAfter = error.response.headers['retry-after'] || errorData?.retryAfter;
          
          // 如果 retryAfter 是数字（秒数），转换为友好的格式
          if (typeof retryAfter === 'string' && /^\d+$/.test(retryAfter)) {
            const seconds = parseInt(retryAfter, 10);
            if (seconds >= 60) {
              const minutes = Math.ceil(seconds / 60);
              retryAfter = `${minutes} 分钟`;
            } else {
              retryAfter = `${seconds} 秒`;
            }
          } else if (typeof retryAfter === 'number') {
            if (retryAfter >= 60) {
              const minutes = Math.ceil(retryAfter / 60);
              retryAfter = `${minutes} 分钟`;
            } else {
              retryAfter = `${retryAfter} 秒`;
            }
          } else if (!retryAfter) {
            retryAfter = "15 分钟";
          }
          
          setMessage(`登录请求过于频繁，请稍后再试（建议等待 ${retryAfter}）`);
        }
        // 处理其他错误
        else {
          const errorMessage = errorData?.message || errorData?.error || "登录失败，请检查账号和密码";
          setMessage(`登录失败: ${errorMessage}`);
        }
      } else {
        setMessage("登录失败，请检查网络或联系管理员");
      }
      console.error("登录出错:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* 左侧品牌展示区 */}
      <div className="login-brand-section">
        <div className="login-brand-content">
          <div className="login-brand-logo">
            <img src={logo} alt="MindFlow Logo" />
            <h1>MindFlow</h1>
          </div>
          <h2 className="login-brand-title">
            协作，从未如此简单
          </h2>
          <p className="login-brand-description">
            实时多人在线编辑，让团队创意流动起来。
          </p>
          <div className="login-brand-features">
            <div className="login-brand-feature">
              <ion-icon name="flash-outline"></ion-icon>
              <span>实时协作</span>
            </div>
            <div className="login-brand-feature">
              <ion-icon name="shield-checkmark-outline"></ion-icon>
              <span>数据安全</span>
            </div>
            <div className="login-brand-feature">
              <ion-icon name="people-outline"></ion-icon>
              <span>团队管理</span>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧表单区域 */}
      <div className="login-form-section">
        <div className="login-container">
          <div className="login-header">
            <h2 className="login-title">
              欢迎回来
            </h2>
            <p className="login-subtitle">
              登录以继续使用 MindFlow
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-form-group">
              <label className="login-label">
                <ion-icon name="person-outline"></ion-icon>
                账号 (邮箱或手机号)
              </label>
              <div className="login-input-wrapper">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@example.com 或 13800001234"
                  required
                  className="login-input"
                />
              </div>
            </div>

            <div className="login-form-group-password">
              <label className="login-label">
                <ion-icon name="lock-closed-outline"></ion-icon>
                密码
              </label>
              <div className="login-input-wrapper">
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
                    title={showPassword ? "隐藏密码" : "显示密码"}
                  >
                    <ion-icon name={showPassword ? "eye-off-outline" : "eye-outline"}></ion-icon>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`login-submit-btn ${loading ? 'login-submit-btn-loading' : ''}`}
            >
              {loading ? (
                <>
                  <span className="login-btn-spinner"></span>
                  登录中...
                </>
              ) : (
                <>
                  <span>登录</span>
                  <ion-icon name="arrow-forward-outline"></ion-icon>
                </>
              )}
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
      </div>
    </div>
  );
}

export default Login;
