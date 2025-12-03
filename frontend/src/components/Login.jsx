/**
 * 登录组件
 * 功能：用户登录界面
 * 特性：
 * 1. 支持邮箱或手机号登录
 * 2. 密码显示/隐藏切换
 * 3. 速率限制错误处理（429）
 * 4. 友好的错误提示
 * 5. 加载状态显示
 * 6. 现代化UI设计
 */

// 引入React和useState钩子，用于管理组件状态
import React, { useState } from "react";
// 引入Link组件，用于页面导航（注册、忘记密码）
import { Link } from "react-router-dom";
// 引入封装的axios实例，用于API请求
import api from "../api";
// 引入认证页面的现代化样式
import "../styles/components/Auth-modern.css";
// 引入MindFlow logo图片
import logo from "../assets/logo.svg";

/**
 * Login组件
 * @param {function} onLoginSuccess - 登录成功的回调函数，用于更新父组件的用户状态
 */
function Login({ onLoginSuccess }) {
  // ==================== 状态管理 ====================
  
  // 用户标识符（邮箱或手机号）
  const [identifier, setIdentifier] = useState("");
  
  // 用户密码
  const [password, setPassword] = useState("");
  
  // 消息提示（成功或失败信息）
  const [message, setMessage] = useState("");
  
  // 加载状态（登录请求进行中）
  const [loading, setLoading] = useState(false);
  
  // 密码显示/隐藏状态
  const [showPassword, setShowPassword] = useState(false);

  /**
   * handleSubmit - 处理登录表单提交
   * 
   * 功能：
   * 1. 验证输入字段
   * 2. 发送登录请求
   * 3. 保存JWT Token到localStorage
   * 4. 调用登录成功回调
   * 5. 处理各种错误情况（速率限制、网络错误等）
   * 
   * @param {Event} e - 表单提交事件
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      // 第一步：验证用户输入
      if (!identifier) {
        setMessage("请输入邮箱或手机号");
        setLoading(false);
        return;
      }

      // 第二步：发送登录请求到后端API
      // POST /api/auth/login
      const response = await api.post("/auth/login", {
        identifier,  // 邮箱或手机号
        password,    // 密码
      });

      // 第三步：处理登录成功响应
      const { token, user } = response.data;
      
      // 保存JWT Token到浏览器localStorage
      // 后续请求会在api.js的拦截器中自动添加此Token
      localStorage.setItem("authToken", token);
      
      // 调用父组件传入的回调函数，更新全局用户状态
      onLoginSuccess(user);

      // 第四步：显示欢迎消息
      const displayName = user.full_name || user.email || user.phone || "用户";
      setMessage(`登录成功! 欢迎回来, ${displayName}`);
      
      // 延迟1秒后跳转到首页
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (error) {
      // 登录失败：清除可能存在的旧Token
      localStorage.removeItem("authToken");
      
      // 如果有HTTP响应（非网络错误）
      if (error.response) {
        const statusCode = error.response.status;
        const errorData = error.response.data;

        // 特殊处理：429速率限制错误
        // 后端使用express-rate-limit中间件限制登录频率
        if (statusCode === 429) {
          // 获取建议的重试时间（从响应头或响应体）
          let retryAfter = error.response.headers['retry-after'] || errorData?.retryAfter;

          // 将retryAfter转换为用户友好的格式
          // 后端可能返回秒数（字符串或数字），需要转换为"X分钟"或"X秒"
          
          // 情况1：字符串类型的数字（如"90"）
          if (typeof retryAfter === 'string' && /^\d+$/.test(retryAfter)) {
            const seconds = parseInt(retryAfter, 10);
            if (seconds >= 60) {
              const minutes = Math.ceil(seconds / 60);  // 向上取整
              retryAfter = `${minutes} 分钟`;
            } else {
              retryAfter = `${seconds} 秒`;
            }
          } 
          // 情况2：数字类型（如90）
          else if (typeof retryAfter === 'number') {
            if (retryAfter >= 60) {
              const minutes = Math.ceil(retryAfter / 60);
              retryAfter = `${minutes} 分钟`;
            } else {
              retryAfter = `${retryAfter} 秒`;
            }
          } 
          // 情况3：没有提供retryAfter，使用默认值
          else if (!retryAfter) {
            retryAfter = "15 分钟";
          }

          // 显示速率限制友好提示
          setMessage(`登录请求过于频繁，请稍后再试（建议等待 ${retryAfter}）`);
        }
        // 处理其他HTTP错误（400, 401, 500等）
        else {
          // 尝试从响应中提取错误消息
          const errorMessage = errorData?.message || errorData?.error || "登录失败，请检查账号和密码";
          setMessage(`登录失败: ${errorMessage}`);
        }
      } 
      // 处理网络错误（无法连接到服务器）
      else {
        setMessage("登录失败，请检查网络或联系管理员");
      }
      
      // 在控制台记录详细错误信息（开发调试用）
      console.error("登录出错:", error);
    } finally {
      // 无论成功或失败，都要重置加载状态
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
