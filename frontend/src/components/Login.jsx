import React, { useState } from "react";
import axios from "axios";

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      // 向后端登录API发送请求
      const response = await axios.post(
        "http://localhost:5000/api/auth/login",
        {
          email: email,
          password: password,
        }
      );

      // --- 关键部分：处理成功的响应 ---

      // 1. 从后端响应中获取令牌
      const token = response.data.token;

      // 2. 将令牌存储到 localStorage
      localStorage.setItem("authToken", token);

      // 3. 更新axios的默认请求头，之后的所有请求都会自动带上这个token
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // 4. 登录成功后，调用这个函数，将用户信息传递给 App 组件
      onLoginSuccess(response.data.user);

      // 5. 显示成功消息
      setMessage(`登录成功! 欢迎回来, ${response.data.user.email}`);
    } catch (error) {
      // 登录失败，清除可能存在的旧token
      localStorage.removeItem("authToken");
      delete axios.defaults.headers.common["Authorization"];

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
          <label>邮箱:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
    </div>
  );
}

export default Login;
