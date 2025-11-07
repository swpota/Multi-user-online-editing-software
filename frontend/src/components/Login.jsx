import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api"; // <-- 1. (核心修复) 导入我们统一的 api 实例，而不是原始的 axios

function Login({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      if (!identifier) {
        setMessage("请输入邮箱或手机号");
        return;
      }

      const response = await api.post("/auth/login", {
        identifier,
        password,
      });

      const { token, user } = response.data;

      // --- 3. (核心修复) 只负责存储 token，不再手动操作任何 headers ---
      localStorage.setItem("authToken", token);

      // 4. 通知 App 组件登录成功
      onLoginSuccess(user);

      const displayName = user.full_name || user.email || user.phone || "用户";
      setMessage(`登录成功! 欢迎回来, ${displayName}`);
    } catch (error) {
      localStorage.removeItem("authToken");
      if (error.response) {
        setMessage(`登录失败: ${error.response.data.message}`);
      } else {
        setMessage("登录失败，请检查网络或联系管理员");
      }
      console.error("登录出错:", error);
    }
  };

  return (
    <div>
      <h2>用户登录</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>账号 (邮箱或手机号):</label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="name@example.com 或 13800001234"
            required
          />
        </div>
        <div>
          <label>密码:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">登录</button>
      </form>
      {message && <p>{message}</p>}
      {/* --- (新增) 添加忘记密码链接 --- */}
      <div style={{ marginTop: "1rem" }}>
        <Link to="/forgot-password">忘记密码？</Link>
      </div>
    </div>
  );
}

export default Login;
