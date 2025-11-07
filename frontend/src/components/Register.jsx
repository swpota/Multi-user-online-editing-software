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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!email && !phone) {
      setMessage("请至少填写邮箱或手机号");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("两次输入的密码不一致");
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
      setMessage(`注册成功! 用户ID: ${response.data.user.id}`);
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
    }
  };

  return (
    <div>
      <h2>用户注册</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>邮箱 (可选):</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </div>
        <div>
          <label>手机号 (可选):</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="例如: 13800001234"
          />
        </div>
        <div>
          <label>姓名 (可选):</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="团队成员姓名"
          />
        </div>
        <div>
          <label>联系邮箱 (可选):</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="接收通知的邮箱"
          />
        </div>
        <div>
          <label>联系电话 (可选):</label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="接收通知的电话"
          />
        </div>
        <div>
          <label>密码:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div>
          <label>确认密码:</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <button type="submit">注册</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}

export default Register;
