# MindFlow - 多人在线协作编辑平台

<div align="center">

![MindFlow Logo](frontend/public/logo.png)

**让团队的思想自由流动**

[![GitHub](https://img.shields.io/badge/GitHub-swpota-orange?style=flat&logo=github)](https://github.com/swpota)
[![License](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Latest-336791?logo=postgresql)](https://www.postgresql.org/)

[功能特性](#功能特性) • [快速开始](#快速开始) • [技术栈](#技术栈) • [项目结构](#项目结构) • [贡献指南](#贡献指南)

</div>

---

## 📖 项目简介

MindFlow 是一个现代化的多人在线协作文档编辑平台，专为团队协作而设计。支持实时协作编辑、富文本/Markdown双模式、视频会议、任务管理等功能，让团队协作更加高效流畅。

### ✨ 核心亮点

- 🚀 **实时协作** - 多人同时编辑，实时同步，零延迟
- 📝 **双模式编辑** - 支持富文本（Quill）和 Markdown 自由切换
- 🎥 **视频会议** - 集成 Jitsi 视频会议，边编辑边讨论
- 📋 **任务管理** - 内置任务面板，协作更有条理
- 💬 **实时评论** - 文档级别的评论和讨论功能
- 📁 **文件管理** - 支持文件上传、下载、在线预览
- 📊 **版本管理** - 完整的文档版本历史和回滚
- 🎨 **现代UI** - 橙色品牌主题，简洁美观的用户界面
- 🔐 **权限管理** - 细粒度的访问权限控制
- 📤 **多格式导出** - 支持导出为 PDF、Word、Markdown、JSON

---

## 🎯 功能特性

### 文档编辑
- ✅ 富文本编辑器（基于 Quill）
- ✅ Markdown 编辑器（支持实时预览）
- ✅ 实时协作编辑（基于 Socket.io）
- ✅ 文档模板系统
- ✅ 文档分类和标签
- ✅ 全文搜索和筛选

### 协作功能
- ✅ 多人实时在线编辑
- ✅ 实时光标显示
- ✅ 文档评论系统
- ✅ 协作者权限管理（编辑者/查看者）
- ✅ 实时通知推送
- ✅ 活动日志记录

### 通讯工具
- ✅ Jitsi 视频会议集成
- ✅ 任务管理面板
- ✅ 文件共享和管理
- ✅ 实时评论和讨论

### 管理功能
- ✅ 用户管理（注册、登录、权限）
- ✅ 管理员仪表盘
- ✅ 系统监控和分析
- ✅ 满意度调查系统
- ✅ 用户活动统计

---

## 🚀 快速开始

### 前置要求

- Node.js 18+
- PostgreSQL 12+
- npm 或 yarn

### 安装步骤

#### 1. 克隆项目
```bash
git clone https://github.com/swpota/Multi-user-online-editing-software.git
cd Multi-user-online-editing-software
```

#### 2. 配置数据库
```bash
# 创建 PostgreSQL 数据库
createdb mindflow

# 运行数据库迁移脚本（按顺序执行 backend/sql/ 目录下的SQL文件）
psql -d mindflow -f backend/sql/create_admin_tables.sql
# ... 其他SQL文件
```

#### 3. 配置后端
```bash
cd backend

# 安装依赖
npm install

# 创建 .env 文件
cp .env.example .env

# 编辑 .env 配置数据库连接信息
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=mindflow
# DB_USER=your_username
# DB_PASSWORD=your_password
# JWT_SECRET=your_jwt_secret
# PORT=5000

# 启动后端服务
npm run dev
```

#### 4. 配置前端
```bash
cd ../frontend

# 安装依赖
npm install

# 启动前端开发服务器
npm run dev
```

#### 5. 访问应用
打开浏览器访问：`http://localhost:5173`

---

## 🛠 技术栈

### 前端
- **框架**: React 18
- **构建工具**: Vite
- **路由**: React Router v7
- **编辑器**: 
  - React Quill（富文本）
  - Marked（Markdown渲染）
- **实时通信**: Socket.io Client
- **视频会议**: Jitsi React SDK
- **HTTP客户端**: Axios
- **样式**: 原生CSS + CSS变量主题系统

### 后端
- **框架**: Express 5
- **数据库**: PostgreSQL
- **ORM**: 原生 pg 驱动
- **实时通信**: Socket.io
- **身份验证**: JWT + bcryptjs
- **文件处理**: 
  - Multer（文件上传）
  - Archiver（压缩）
  - PDFKit（PDF生成）
  - Docx（Word文档）
- **日志**: Winston
- **安全**: 
  - Express Rate Limit
  - Express Validator
  - CORS

### 工具库
- **差异同步**: diff-match-patch
- **Markdown转换**: Turndown
- **XSS防护**: DOMPurify

---

## 📁 项目结构

```
Multi-user-online-editing-software/
├── backend/                    # 后端服务
│   ├── config/                # 配置文件
│   ├── middleware/            # 中间件
│   ├── routes/                # 路由
│   ├── services/              # 业务逻辑
│   ├── utils/                 # 工具函数
│   ├── sql/                   # 数据库脚本
│   └── server.js              # 服务器入口
│
├── frontend/                   # 前端应用
│   ├── public/                # 静态资源
│   │   └── logo.png          # Logo
│   ├── src/
│   │   ├── assets/           # 图片、SVG等资源
│   │   │   └── images/       # 插图和图标
│   │   ├── components/       # React组件
│   │   │   ├── DashBoard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Skeleton.jsx
│   │   │   └── ...
│   │   ├── pages/            # 页面组件
│   │   │   ├── LandingPage.jsx
│   │   │   ├── EditorPage.jsx
│   │   │   ├── AdminDashboardPage.jsx
│   │   │   └── ...
│   │   ├── styles/           # 样式文件
│   │   │   ├── components/  # 组件样式
│   │   │   ├── pages/       # 页面样式
│   │   │   ├── theme/       # 主题配置
│   │   │   └── App.css
│   │   ├── utils/            # 工具函数
│   │   ├── api.js            # API接口
│   │   ├── App.jsx           # 应用入口
│   │   └── main.jsx          # React挂载
│   └── package.json
│
├── .gitignore
├── README.md
└── package.json
```

---

## 🎨 UI 预览

### 着陆页
现代化的产品介绍页面，包含功能展示、价格方案、关于我们等模块。

### 仪表盘
- 文档列表（列表/看板视图切换）
- 快速搜索和筛选
- 批量操作
- 文档模板

### 编辑器
- 富文本/Markdown双模式
- 实时协作光标
- 评论面板
- 任务管理
- 视频会议

### 管理后台
- 用户管理
- 文档统计
- 系统监控
- 满意度调查

---

## 🔒 环境变量配置

### 后端 `.env`
```env
# 服务器配置
PORT=5000
NODE_ENV=development

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mindflow
DB_USER=your_username
DB_PASSWORD=your_password

# JWT配置
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# CORS配置
FRONTEND_URL=http://localhost:5173

# 文件上传配置
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

---

## 📝 API 文档

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `POST /api/auth/forgot-password` - 忘记密码
- `POST /api/auth/reset-password` - 重置密码

### 文档接口
- `GET /api/documents` - 获取文档列表
- `POST /api/documents` - 创建文档
- `GET /api/documents/:id` - 获取文档详情
- `PUT /api/documents/:id` - 更新文档
- `DELETE /api/documents/:id` - 删除文档
- `POST /api/documents/:id/export` - 导出文档

### 协作接口
- `POST /api/documents/:id/collaborators` - 添加协作者
- `DELETE /api/documents/:id/collaborators/:userId` - 移除协作者
- `PUT /api/documents/:id/collaborators/:userId` - 更新协作者权限

### 评论接口
- `GET /api/documents/:id/comments` - 获取评论
- `POST /api/documents/:id/comments` - 添加评论
- `DELETE /api/comments/:id` - 删除评论

### WebSocket 事件
- `document:join` - 加入文档编辑
- `document:leave` - 离开文档编辑
- `document:update` - 文档内容更新
- `cursor:update` - 光标位置更新
- `comment:add` - 新增评论
- `user:online` - 用户上线

---

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范
- 使用 ESLint 进行代码检查
- 遵循 React 最佳实践
- 保持代码简洁和可读性
- 添加必要的注释

---

## 📧 联系方式

- **Email**: 
  - QQ邮箱: 1452682204@qq.com
  - Gmail: 1452682204se@gmail.com
- **GitHub**: [@swpota](https://github.com/swpota)

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 🙏 致谢

- React 团队提供的优秀框架
- Quill 编辑器
- Jitsi 视频会议方案
- 所有开源贡献者

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐ Star！**

Made with ❤️ by [swpota](https://github.com/swpota)

</div>