/**
 * 登录页面组件
 * 
 * 用户通过邮箱或手机号登录系统，登录成功后会保存JWT token到localStorage，
 * 后续请求会在api.js的拦截器中自动带上这个token。
 * 
 * 特殊处理：
 * - 429错误：后端有登录频率限制，超过限制会返回429，这里会显示友好的等待提示
 * - 登录成功后1秒自动跳转到首页
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../styles/components/Auth-modern.css";
import logo from "../assets/logo.svg";

function Login({ onLoginSuccess }) {
  // 表单字段
  const [identifier, setIdentifier] = useState("");  // 账号，可以是邮箱或手机号
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");        // 登录结果提示信息
  const [loading, setLoading] = useState(false);     // 防止重复提交
  const [showPassword, setShowPassword] = useState(false);

  // 提交登录表单
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

      // 调用后端登录接口，成功返回token和用户信息
      const response = await api.post("/auth/login", { identifier, password });
      const { token, user } = response.data;
      
      // token存到localStorage，api.js的请求拦截器会自动读取并添加到请求头
      localStorage.setItem("authToken", token);
      // 通知父组件（App.jsx）更新用户状态
      onLoginSuccess(user);

      const displayName = user.full_name || user.email || user.phone || "用户";
      setMessage(`登录成功! 欢迎回来, ${displayName}`);
      
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (error) {
      // 登录失败时清除可能残留的旧token
      localStorage.removeItem("authToken");
      
      if (error.response) {
        const statusCode = error.response.status;
        const errorData = error.response.data;

        // 429是速率限制错误，后端用express-rate-limit限制登录频率
        // 需要把秒数转成"X分钟"或"X秒"的友好格式
        if (statusCode === 429) {
          let retryAfter = error.response.headers['retry-after'] || errorData?.retryAfter;

          // 转成易读格式
          if (typeof retryAfter === 'string' && /^\d+$/.test(retryAfter)) {
            const seconds = parseInt(retryAfter, 10);
            retryAfter = seconds >= 60 ? `${Math.ceil(seconds / 60)} 分钟` : `${seconds} 秒`;
          } else if (typeof retryAfter === 'number') {
            retryAfter = retryAfter >= 60 ? `${Math.ceil(retryAfter / 60)} 分钟` : `${retryAfter} 秒`;
          } else if (!retryAfter) {
            retryAfter = "15 分钟";
          }

          setMessage(`登录请求过于频繁，请稍后再试（建议等待 ${retryAfter}）`);
        } else {
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
          <h2 className="auth-title">欢迎回来</h2>
          <p className="auth-subtitle">登录以继续使用 MindFlow</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* 消息提示 */}
          {message && (
            <div className={`auth-message ${message.includes("成功") ? "success" : "error"}`}>
              {message}
            </div>
          )}

          {/* 账号输入 */}
          <div className="auth-form-group">
            <label className="auth-label">账号</label>
            <div className="auth-input-wrapper">
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="邮箱或手机号"
                required
                disabled={loading}
                className="auth-input"
              />
              <ion-icon name="person-outline" className="auth-input-icon"></ion-icon>
            </div>
          </div>

          {/* 密码输入 */}
          <div className="auth-form-group">
            <label className="auth-label">密码</label>
            <div className="auth-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
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

          {/* 忘记密码链接 */}
          <div className="auth-link-group">
            <div></div>
            <Link to="/forgot-password" className="auth-link">
              忘记密码？
            </Link>
          </div>

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={loading}
            className={`auth-button ${loading ? 'loading' : ''}`}
          >
            {loading ? (
              <>
                <div className="auth-spinner"></div>
                <span>登录中...</span>
              </>
            ) : (
              <>
                <span>登录</span>
                <ion-icon name="arrow-forward-outline"></ion-icon>
              </>
            )}
          </button>
        </form>

        {/* 页脚链接 */}
        <div className="auth-footer">
          还没有账户？{' '}
          <Link to="/register" className="auth-footer-link">
            立即注册
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
