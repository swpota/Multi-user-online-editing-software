import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

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
          欢迎回来
        </h2>
        <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
          登录您的账户以继续
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ width: "100%" }}>
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#333",
            }}
          >
            账号 (邮箱或手机号)
          </label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="name@example.com 或 13800001234"
            required
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: "14px",
              border: "1px solid #d9d9d9",
              borderRadius: "6px",
              transition: "all 0.2s",
              outline: "none",
            }}
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

        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#333",
            }}
          >
            密码
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                paddingRight: "40px",
                fontSize: "14px",
                border: "1px solid #d9d9d9",
                borderRadius: "6px",
                transition: "all 0.2s",
                outline: "none",
              }}
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
          {loading ? "登录中..." : "登录"}
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

      <div style={{ textAlign: "center", marginTop: "24px" }}>
        <Link
          to="/forgot-password"
          style={{
            color: "#1890ff",
            textDecoration: "none",
            fontSize: "14px",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.color = "#40a9ff")}
          onMouseLeave={(e) => (e.target.style.color = "#1890ff")}
        >
          忘记密码？
        </Link>
      </div>
    </div>
  );
}

export default Login;
