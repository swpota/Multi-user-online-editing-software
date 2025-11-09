import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api";

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
            重置密码
          </h2>
          <p
            style={{
              margin: 0,
              color: "#666",
              fontSize: "14px",
            }}
          >
            请输入你的新密码
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
              新密码
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="至少6位字符"
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
              确认新密码
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="再次输入密码"
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
            {loading ? "重置中..." : "重置密码"}
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

export default ResetPasswordPage;
