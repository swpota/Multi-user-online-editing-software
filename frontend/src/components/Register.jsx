import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/components/Register.css";

function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    if (!email && !phone) {
      setMessage("请至少填写邮箱或手机号");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage("两次输入的密码不一致");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage("密码长度至少为6位");
      setLoading(false);
      return;
    }

    try {
      const response = await api.post("/auth/register", {
        email: email || null,
        phone: phone || null,
        password,
        fullName: fullName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
      });
      setMessage(`注册成功! 用户ID: ${response.data.user.id}，正在跳转到登录页面...`);
      // 清空表单
      setEmail("");
      setPhone("");
      setFullName("");
      setContactEmail("");
      setContactPhone("");
      setPassword("");
      setConfirmPassword("");
      // 延迟跳转到登录页面
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (error) {
      if (error.response) {
        setMessage(`注册失败: ${error.response.data.message}`);
      } else {
        setMessage("注册失败，请检查网络连接或联系管理员");
      }
      console.error("注册出错:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-header">
        <h2 className="register-title">
          创建账户
        </h2>
        <p className="register-subtitle">
          注册新账户以开始使用
        </p>
      </div>

      <form onSubmit={handleSubmit} className="register-form">
        <div className="register-form-group">
          <label className="register-label">
            邮箱 <span className="register-label-optional">(可选)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="register-input"
          />
        </div>

        <div className="register-form-group">
          <label className="register-label">
            手机号 <span className="register-label-optional">(可选)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="例如: 13800001234"
            className="register-input"
          />
        </div>

        <div className="register-form-group">
          <label className="register-label">
            姓名 <span className="register-label-optional">(可选)</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="团队成员姓名"
            className="register-input"
          />
        </div>

        <div className="register-form-group">
          <label className="register-label">
            密码 <span className="register-label-required">*</span>
          </label>
          <div className="register-password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="至少6位字符"
              className="register-input register-input-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="register-password-toggle"
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
        </div>

        <div className="register-form-group-password">
          <label className="register-label">
            确认密码 <span className="register-label-required">*</span>
          </label>
          <div className="register-password-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="再次输入密码"
              className="register-input register-input-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="register-password-toggle"
            >
              {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="register-submit-btn"
        >
          {loading ? "注册中..." : "注册"}
        </button>
      </form>

      {message && (
        <div
          className={`register-message ${
            message.includes("成功") ? "register-message-success" : "register-message-error"
          }`}
        >
          {message}
        </div>
      )}

      <div className="register-tips">
        <div className="register-tips-title">提示：</div>
        <div>• 邮箱和手机号至少填写一个</div>
        <div>• 密码长度至少为6位</div>
        <div>• 其他信息为可选，可稍后完善</div>
      </div>

      <div className="register-back-to-login">
        <Link
          to="/"
          className="register-back-to-login-link"
        >
          返回登录
        </Link>
      </div>
    </div>
  );
}

export default Register;
