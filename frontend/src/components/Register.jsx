import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/components/Register.css";
import logo from "../assets/logo.png";

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
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [passwordMinLength, setPasswordMinLength] = useState(6);
  const [settingsLoading, setSettingsLoading] = useState(true);
  
  // 字段级错误状态
  const [errors, setErrors] = useState({
    email: "",
    phone: "",
    fullName: "",
    password: "",
    confirmPassword: "",
    contactEmail: "",
    contactPhone: "",
  });

  // 获取系统设置
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get("/admin/settings/public");
        setRegistrationEnabled(response.data.enable_registration !== false);
        setPasswordMinLength(response.data.password_min_length || 6);
      } catch (error) {
        console.error("获取系统设置失败:", error);
        // 如果获取失败，使用默认值
        setRegistrationEnabled(true);
        setPasswordMinLength(6);
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // 验证函数
  const validateEmail = (email) => {
    if (!email) return false;
    // 改进的邮箱验证：要求顶级域名至少2个字符
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  };

  const validatePhone = (phone) => {
    if (!phone) return false;
    // 手机号验证：11位数字，以1开头（中国大陆手机号）
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone.trim());
  };

  const validateFullName = (name) => {
    if (!name) return false;
    const trimmedName = name.trim();
    // 姓名不能为空
    if (trimmedName.length === 0) return false;
    // 姓名不能全是数字
    if (/^\d+$/.test(trimmedName)) return false;
    // 姓名长度应该在2-50个字符之间
    if (trimmedName.length < 2 || trimmedName.length > 50) return false;
    // 姓名应该包含至少一个非数字字符（允许中文、英文、空格等）
    if (!/[\u4e00-\u9fa5a-zA-Z\s]/.test(trimmedName)) return false;
    return true;
  };

  // 实时验证函数
  const validateField = (fieldName, value) => {
    let error = "";
    
    switch (fieldName) {
      case "email":
        if (!value || !value.trim()) {
          error = "请填写邮箱";
        } else if (!validateEmail(value)) {
          error = "邮箱格式不正确";
        }
        break;
      
      case "phone":
        if (!value || !value.trim()) {
          error = "请填写手机号";
        } else if (!validatePhone(value)) {
          error = "手机号格式不正确（以13-19开头的11位数字）";
        }
        break;
      
      case "fullName":
        if (!value || !value.trim()) {
          error = "请填写姓名";
        } else if (!validateFullName(value)) {
          error = "姓名格式不正确（2-50个字符，不能全是数字）";
        }
        break;
      
      case "password":
        if (!value || !value.trim()) {
          error = "请填写密码";
        } else if (value.length < passwordMinLength) {
          error = `密码长度至少为${passwordMinLength}位`;
        }
        break;
      
      case "confirmPassword":
        if (!value || !value.trim()) {
          error = "请确认密码";
        } else if (value !== password) {
          error = "两次输入的密码不一致";
        }
        break;
      
      case "contactEmail":
        if (value && value.trim() && !validateEmail(value)) {
          error = "联系邮箱格式不正确";
        }
        break;
      
      case "contactPhone":
        if (value && value.trim() && !validatePhone(value)) {
          error = "联系手机号格式不正确";
        }
        break;
      
      default:
        break;
    }
    
    setErrors(prev => ({ ...prev, [fieldName]: error }));
    return error === "";
  };

  // 处理输入框失焦事件
  const handleBlur = (fieldName, value) => {
    validateField(fieldName, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    // 一次性验证所有字段
    const emailValid = validateField("email", email);
    const phoneValid = validateField("phone", phone);
    const fullNameValid = validateField("fullName", fullName);
    const passwordValid = validateField("password", password);
    const confirmPasswordValid = validateField("confirmPassword", confirmPassword);
    const contactEmailValid = validateField("contactEmail", contactEmail);
    const contactPhoneValid = validateField("contactPhone", contactPhone);

    // 如果有任何字段验证失败，不提交
    if (!emailValid || !phoneValid || !fullNameValid || !passwordValid || !confirmPasswordValid || !contactEmailValid || !contactPhoneValid) {
      setMessage("请修正表单中的错误后重试");
      setLoading(false);
      return;
    }

    try {
      // 构建请求数据，只包含非空字段
      const requestData = {
        email: email.trim(),
        phone: phone.trim(),
        password,
        fullName: fullName.trim(),
      };
      
      // 只有当联系邮箱和联系手机号不为空时才添加到请求中
      if (contactEmail && contactEmail.trim()) {
        requestData.contactEmail = contactEmail.trim();
      }
      if (contactPhone && contactPhone.trim()) {
        requestData.contactPhone = contactPhone.trim();
      }
      
      const response = await api.post("/auth/register", requestData);
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
          
          setMessage(`注册请求过于频繁，请稍后再试（建议等待 ${retryAfter}）`);
        }
        // 处理 400 验证错误
        else if (statusCode === 400) {
          // 如果有详细的验证错误信息，显示所有错误
          if (errorData.errors && errorData.errors.length > 0) {
            // 将所有错误信息合并显示
            const errorMessages = errorData.errors.map(err => err.msg || err.message).filter(Boolean);
            if (errorMessages.length > 0) {
              setMessage(`注册失败: ${errorMessages.join("; ")}`);
            } else {
              setMessage(`注册失败: ${errorData.message || errorData.error || "输入验证失败"}`);
            }
          } else {
            setMessage(`注册失败: ${errorData.message || errorData.error || "输入验证失败"}`);
          }
        }
        // 处理其他错误
        else {
          setMessage(`注册失败: ${errorData.message || errorData.error || "服务器错误，请稍后重试"}`);
        }
      } else {
        setMessage("注册失败，请检查网络连接或联系管理员");
      }
      console.error("注册出错:", error);
      // 在控制台输出完整的错误信息，方便调试
      if (error.response?.data?.errors) {
        console.error("验证错误详情:", error.response.data.errors);
      }
    } finally {
      setLoading(false);
    }
  };

  // 如果注册功能被禁用，显示提示信息
  if (settingsLoading) {
    return (
      <div className="register-container">
        <div className="register-loading">
          <div className="register-loading-spinner" />
          正在加载...
        </div>
      </div>
    );
  }

  if (!registrationEnabled) {
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
        <div className="register-disabled-message">
          <div className="register-disabled-icon">🚫</div>
          <h3>注册功能已关闭</h3>
          <p>系统管理员已关闭用户注册功能。如需创建账户，请联系管理员。</p>
        </div>
        <div className="register-back-to-login">
          <Link
            to="/login"
            className="register-back-to-login-link"
          >
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="register-page">
      {/* 左侧品牌展示区 */}
      <div className="register-brand-section">
        <div className="register-brand-content">
          <div className="register-brand-logo">
            <img src={logo} alt="MindFlow Logo" />
            <h1>MindFlow</h1>
          </div>
          <h2 className="register-brand-title">
            加入 MindFlow，开启协作之旅
          </h2>
          <p className="register-brand-description">
            与你的团队一起，实时协作，高效创作。
          </p>
          <div className="register-brand-features">
            <div className="register-brand-feature">
              <ion-icon name="rocket-outline"></ion-icon>
              <span>快速上手</span>
            </div>
            <div className="register-brand-feature">
              <ion-icon name="cloud-outline"></ion-icon>
              <span>云端同步</span>
            </div>
            <div className="register-brand-feature">
              <ion-icon name="lock-closed-outline"></ion-icon>
              <span>安全加密</span>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧表单区域 */}
      <div className="register-form-section">
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
                <ion-icon name="mail-outline"></ion-icon>
                邮箱 <span className="register-label-required">*</span>
              </label>
              <div className="register-input-wrapper">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={(e) => handleBlur("email", e.target.value)}
                  placeholder="name@example.com"
                  className={`register-input ${errors.email ? 'register-input-error' : ''}`}
                  required
                />
                {errors.email && (
                  <div className="register-field-error">
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {errors.email}
                  </div>
                )}
              </div>
            </div>

            <div className="register-form-group">
              <label className="register-label">
                <ion-icon name="call-outline"></ion-icon>
                手机号 <span className="register-label-required">*</span>
              </label>
              <div className="register-input-wrapper">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={(e) => handleBlur("phone", e.target.value)}
                  placeholder="例如: 13800001234"
                  className={`register-input ${errors.phone ? 'register-input-error' : ''}`}
                  required
                  maxLength={11}
                />
                {errors.phone && (
                  <div className="register-field-error">
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {errors.phone}
                  </div>
                )}
              </div>
            </div>

            <div className="register-form-group">
              <label className="register-label">
                <ion-icon name="person-outline"></ion-icon>
                姓名 <span className="register-label-required">*</span>
              </label>
              <div className="register-input-wrapper">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={(e) => handleBlur("fullName", e.target.value)}
                  placeholder="团队成员姓名"
                  className={`register-input ${errors.fullName ? 'register-input-error' : ''}`}
                  required
                  minLength={2}
                  maxLength={50}
                />
                {errors.fullName && (
                  <div className="register-field-error">
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {errors.fullName}
                  </div>
                )}
              </div>
            </div>

            <div className="register-form-group">
              <label className="register-label">
                <ion-icon name="lock-closed-outline"></ion-icon>
                密码 <span className="register-label-required">*</span>
              </label>
              <div className="register-input-wrapper">
                <div className="register-password-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={(e) => handleBlur("password", e.target.value)}
                    required
                    minLength={passwordMinLength}
                    placeholder={`至少${passwordMinLength}位字符`}
                    className={`register-input register-input-password ${errors.password ? 'register-input-error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="register-password-toggle"
                    title={showPassword ? "隐藏密码" : "显示密码"}
                  >
                    <ion-icon name={showPassword ? "eye-off-outline" : "eye-outline"}></ion-icon>
                  </button>
                </div>
                {errors.password && (
                  <div className="register-field-error">
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {errors.password}
                  </div>
                )}
              </div>
            </div>

            <div className="register-form-group-password">
              <label className="register-label">
                <ion-icon name="lock-closed-outline"></ion-icon>
                确认密码 <span className="register-label-required">*</span>
              </label>
              <div className="register-input-wrapper">
                <div className="register-password-wrapper">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={(e) => handleBlur("confirmPassword", e.target.value)}
                    required
                    minLength={passwordMinLength}
                    placeholder="再次输入密码"
                    className={`register-input register-input-password ${errors.confirmPassword ? 'register-input-error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="register-password-toggle"
                    title={showConfirmPassword ? "隐藏密码" : "显示密码"}
                  >
                    <ion-icon name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}></ion-icon>
                  </button>
                </div>
                {errors.confirmPassword && (
                  <div className="register-field-error">
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {errors.confirmPassword}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`register-submit-btn ${loading ? 'register-submit-btn-loading' : ''}`}
            >
              {loading ? (
                <>
                  <span className="register-btn-spinner"></span>
                  注册中...
                </>
              ) : (
                <>
                  <span>注册</span>
                  <ion-icon name="arrow-forward-outline"></ion-icon>
                </>
              )}
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

          <div className="register-back-to-login">
            <Link to="/login" className="register-back-to-login-link">
              已有账户？立即登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
