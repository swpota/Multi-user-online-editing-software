import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

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
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        backgroundColor: "#f5f5f5",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          backgroundColor: "#fff",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          padding: "40px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 600,
              color: "#333",
              marginBottom: "8px",
            }}
          >
            忘记密码
          </h2>
          <p
            style={{
              margin: 0,
              color: "#666",
              fontSize: "14px",
            }}
          >
            请输入你的邮箱或手机号，我们将向你发送密码重置指引。
          </p>
        </div>

        <form onSubmit={handleSubmit}>
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
              required
              placeholder="name@example.com 或 13800001234"
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

          {error && (
            <div
              style={{
                padding: "12px 16px",
                marginBottom: "16px",
                backgroundColor: "#fff2e8",
                color: "#fa8c16",
                borderRadius: "6px",
                fontSize: "14px",
                border: "1px solid #ffd591",
              }}
            >
              {error}
            </div>
          )}
          {message && (
            <div
              style={{
                padding: "12px 16px",
                marginBottom: "16px",
                backgroundColor: "#f6ffed",
                color: "#52c41a",
                borderRadius: "6px",
                fontSize: "14px",
                border: "1px solid #b7eb8f",
              }}
            >
              {message}
            </div>
          )}

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
            {loading ? "发送中..." : "发送重置链接"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <Link
            to="/"
            style={{
              color: "#1890ff",
              textDecoration: "none",
              fontSize: "14px",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.color = "#40a9ff")}
            onMouseLeave={(e) => (e.target.style.color = "#1890ff")}
          >
            ← 返回登录
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
