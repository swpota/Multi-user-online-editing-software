// 引入必要的库
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cors = require('cors');

// 初始化 Express 应用
const app = express();
const PORT = process.env.PORT || 5000;

// --- 中间件配置 ---

// 1. 简单的 CORS 配置，适用于本地开发
app.use(cors()); 

// 2. 解析 JSON 格式的请求体
app.use(express.json());

// --- 数据库连接池配置 ---
// Pool 会管理多个数据库连接，效率更高
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 如果你的数据库需要SSL连接，可以取消下面的注释
  // ssl: {
  //   rejectUnauthorized: false
  // }
});

// --- API 路由定义 ---

// 1. 测试路由，确认服务器是否正常运行
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// 2. 用户注册路由
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  // 基本的输入验证
  if (!email || !password) {
    return res.status(400).json({ message: '邮箱和密码不能为空' });
  }

  try {
    // 检查邮箱是否已经被注册
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: '该邮箱已被注册' });
    }

    // 对密码进行加密
    const salt = await bcrypt.genSalt(10); // 生成 "盐"
    const passwordHash = await bcrypt.hash(password, salt); // 生成哈希

    // 将新用户信息插入数据库
    const newUser = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );
    
    // 返回成功响应，不包含密码哈希
    res.status(201).json({
      message: '用户注册成功',
      user: newUser.rows[0],
    });

  } catch (error) {
    console.error('注册过程中发生错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
});


// --- 启动服务器 ---
app.listen(PORT, () => {
  console.log(`服务器正在 http://localhost:${PORT} 上运行`);
});