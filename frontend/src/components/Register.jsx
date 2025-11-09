import React, { useState } from "react";
import api from "../api";

function Register() {
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
      setMessage(`注册成功! 用户ID: ${response.data.user.id}，请登录`);
      // 清空表单
      setEmail("");
      setPhone("");
      setFullName("");
      setContactEmail("");
      setContactPhone("");
      setPassword("");
      setConfirmPassword("");
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

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    fontSize: "14px",
    border: "1px solid #d9d9d9",
    borderRadius: "6px",
    transition: "all 0.2s",
    outline: "none",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#333",
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ marginBottom: "32px", textAlign: "center" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: 600,
            color: "#333",
            marginBottom: "8px",
          }}
        >
          创建账户
        </h2>
        <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
          注册新账户以开始使用
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ width: "100%" }}>
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>
            邮箱 <span style={{ color: "#999", fontSize: "12px" }}>(可选)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.borderColor = "#1890ff";
              e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#d9d9d9";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>
            手机号 <span style={{ color: "#999", fontSize: "12px" }}>(可选)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="例如: 13800001234"
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.borderColor = "#1890ff";
              e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#d9d9d9";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>
            姓名 <span style={{ color: "#999", fontSize: "12px" }}>(可选)</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="团队成员姓名"
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.borderColor = "#1890ff";
              e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#d9d9d9";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>
            密码 <span style={{ color: "#ff4d4f" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="至少6位字符"
              style={{ ...inputStyle, paddingRight: "40px" }}
              onFocus={(e) => {
                e.target.style.borderColor = "#1890ff";
                e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d9d9d9";
                e.target.style.boxShadow = "none";
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                color: "#666",
                fontSize: "16px",
              }}
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={labelStyle}>
            确认密码 <span style={{ color: "#ff4d4f" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="再次输入密码"
              style={{ ...inputStyle, paddingRight: "40px" }}
              onFocus={(e) => {
                e.target.style.borderColor = "#1890ff";
                e.target.style.boxShadow = "0 0 0 2px rgba(24, 144, 255, 0.2)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#d9d9d9";
                e.target.style.boxShadow = "none";
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                color: "#666",
                fontSize: "16px",
              }}
            >
              {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "16px",
            fontWeight: 500,
            backgroundColor: loading ? "#d9d9d9" : "#1890ff",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            marginBottom: "16px",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.target.style.backgroundColor = "#40a9ff";
              e.target.style.transform = "translateY(-1px)";
              e.target.style.boxShadow = "0 4px 12px rgba(24, 144, 255, 0.3)";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.target.style.backgroundColor = "#1890ff";
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            }
          }}
        >
          {loading ? "注册中..." : "注册"}
        </button>
      </form>

      {message && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "6px",
            fontSize: "14px",
            backgroundColor: message.includes("成功")
              ? "#f6ffed"
              : "#fff2e8",
            color: message.includes("成功") ? "#52c41a" : "#fa8c16",
            border: `1px solid ${message.includes("成功") ? "#b7eb8f" : "#ffd591"}`,
          }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          marginTop: "24px",
          padding: "16px",
          backgroundColor: "#f5f5f5",
          borderRadius: "6px",
          fontSize: "12px",
          color: "#666",
        }}
      >
        <div style={{ marginBottom: "8px", fontWeight: 500 }}>提示：</div>
        <div>• 邮箱和手机号至少填写一个</div>
        <div>• 密码长度至少为6位</div>
        <div>• 其他信息为可选，可稍后完善</div>
      </div>
    </div>
  );
}

export default Register;
