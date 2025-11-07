import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const ForgotPasswordPage = () => {
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      if (!identifier) {
        setError("请输入邮箱或手机号");
        return;
      }

      const response = await api.post("/auth/request-password-reset", {
        identifier,
      });
      setMessage(response.data.message);
      setIdentifier("");
    } catch (err) {
      setError("请求失败，请稍后再试。");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "2rem auto" }}>
      <h2>忘记密码</h2>
      <p>请输入你的邮箱或手机号，我们将向你发送密码重置指引。</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label>账号</label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            style={{ width: "100%", padding: "8px" }}
          />
        </div>
        <button type="submit" style={{ width: "100%", padding: "10px" }}>
          发送重置链接
        </button>
      </form>
      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ marginTop: "1rem" }}>
        <Link to="/">返回登录</Link>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
