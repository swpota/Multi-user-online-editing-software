import React, { useState } from 'react';
import axios from 'axios';

function Register() {
  // 使用 useState 来管理表单输入的值
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // 用于向用户显示消息
  const [message, setMessage] = useState('');

  // 处理表单提交的函数
  const handleSubmit = async (e) => {
    e.preventDefault(); // 阻止表单默认的刷新页面的行为
    setMessage(''); // 清空上一条消息

    try {
      // 向后端API发送POST请求
      const response = await axios.post('http://localhost:5000/api/auth/register', {
        email: email,
        password: password,
      });

      // 根据后端的响应设置成功消息
      setMessage(`注册成功! 用户ID: ${response.data.user.id}`);
      // 可以在这里做一些跳转页面的操作

    } catch (error) {
      // 如果请求失败，显示错误信息
      if (error.response) {
        // 后端返回了具体的错误信息 (例如: '该邮箱已被注册')
        setMessage(`注册失败: ${error.response.data.message}`);
      } else {
        // 网络错误等其他问题
        setMessage('注册失败，请检查网络连接或联系管理员');
      }
      console.error('注册出错:', error);
    }
  };

  return (
    <div>
      <h2>用户注册</h2>
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
        <button type="submit">注册</button>
      </form>
      {/* 显示来自后端的消息 */}
      {message && <p>{message}</p>}
    </div>
  );
}

export default Register;