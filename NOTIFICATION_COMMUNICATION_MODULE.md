# 通知与通讯模块实现说明

## 已完成功能

### 4.1 通知系统 ✅
- ✅ **实时通知（编辑、评论、任务等）**：已实现，通过 Socket.IO 实时推送通知
- ✅ **通知分类与过滤**：已实现，支持按类型、已读/未读状态筛选
- ✅ **通知设置**：已实现，支持用户自定义通知偏好
- ✅ **通知历史记录**：已实现，通知存储在数据库中，支持查看历史

### 4.2 实时通讯 ✅
- ✅ **内置聊天功能**：已实现，支持文档级别的实时聊天
- ✅ **文件共享**：已实现，支持文件上传、下载、共享
- ⚠️ **视频会议集成**：暂未实现（需要第三方服务集成，如 Zoom、WebRTC）
- ⚠️ **屏幕共享**：暂未实现（需要 WebRTC 支持）

## 数据库表

### 1. notifications 表
用于存储通知信息，包括：
- 通知类型、标题、内容
- 关联的资源信息（文档、评论、任务等）
- 发送者信息
- 通知状态（已读/未读）
- 通知元数据（JSON格式）

### 2. notification_settings 表
用于存储用户通知设置，包括：
- 各类通知的开关（评论、任务、提及、文档共享、文档更新）
- 邮件和推送通知开关

### 3. chat_messages 表
用于存储聊天消息，包括：
- 消息内容、类型
- 文件信息（如果是文件消息）
- 回复的消息ID（用于回复功能）

### 4. document_files 表
用于存储文档共享的文件，包括：
- 文件名称、路径、大小、类型
- 上传者信息
- 文件描述

## 安装步骤

### 1. 创建数据库表

在 PostgreSQL 中执行以下 SQL 脚本：

```bash
# 在 DBeaver 或其他数据库工具中执行
psql -U your_username -d your_database -f backend/sql/create_notifications_table.sql
psql -U your_username -d your_database -f backend/sql/create_chat_messages_table.sql
psql -U your_username -d your_database -f backend/sql/create_document_files_table.sql
```

或者直接在 DBeaver 中打开并执行这三个 SQL 文件。

### 2. 安装依赖（如果需要）

后端依赖应该已经安装（multer 已包含），如果缺少，请运行：

```bash
# 后端
cd backend
npm install
```

### 3. 创建上传目录

```bash
# 在 backend 目录下创建 uploads 目录
mkdir -p backend/uploads
```

### 4. 启动服务

```bash
# 启动后端（端口 5000）
cd backend
npm start

# 启动前端（端口 5173）
cd frontend
npm run dev
```

## API 端点

### 通知 API

- `GET /api/notifications` - 获取用户的所有通知（支持筛选和分页）
- `GET /api/notifications/unread-count` - 获取未读通知数量
- `PUT /api/notifications/:notificationId/read` - 标记通知为已读
- `PUT /api/notifications/read-all` - 标记所有通知为已读
- `DELETE /api/notifications/:notificationId` - 删除通知
- `GET /api/notification-settings` - 获取通知设置
- `PUT /api/notification-settings` - 更新通知设置

### 聊天 API

- `GET /api/documents/:documentId/chat-messages` - 获取文档的聊天消息
- `POST /api/documents/:documentId/chat-messages` - 发送聊天消息
- `POST /api/documents/:documentId/chat-messages/file` - 上传文件消息
- `DELETE /api/chat-messages/:messageId` - 删除聊天消息

### 文件 API

- `GET /api/documents/:documentId/files` - 获取文档的文件列表
- `POST /api/documents/:documentId/files` - 上传文件
- `GET /api/files/:fileId/download` - 下载文件
- `DELETE /api/files/:fileId` - 删除文件

## Socket.IO 事件

### 通知事件

- `newNotification` - 新通知创建（发送到用户个人房间）
- `notificationRead` - 通知已读
- `allNotificationsRead` - 所有通知已读
- `notificationDeleted` - 通知删除

### 聊天事件

- `newChatMessage` - 新聊天消息（发送到文档房间）
- `chatMessageDeleted` - 聊天消息删除

### 文件事件

- `newFileUploaded` - 新文件上传（发送到文档房间）
- `fileDeleted` - 文件删除

## 通知类型

- `comment` - 评论通知
- `comment_reply` - 评论回复通知
- `mention` - 提及通知
- `task` - 任务通知
- `task_assigned` - 任务分配通知
- `task_completed` - 任务完成通知
- `document_shared` - 文档共享通知
- `document_updated` - 文档更新通知

## 前端组件

### NotificationsPanel 组件
- 显示通知列表
- 支持筛选和搜索
- 支持标记为已读/删除
- 支持通知设置

### 待实现组件
- ChatPanel 组件（聊天面板）
- FilePanel 组件（文件共享面板）

## 使用说明

### 通知功能

1. **查看通知**：
   - 点击通知图标打开通知面板
   - 查看所有通知或按类型筛选
   - 点击通知可以跳转到相关文档

2. **管理通知**：
   - 点击通知可以标记为已读
   - 点击"全部标记为已读"可以批量标记
   - 点击删除按钮可以删除通知

3. **通知设置**：
   - 点击设置图标打开通知设置
   - 可以开启/关闭各类通知
   - 设置会立即生效

### 聊天功能

1. **发送消息**：
   - 在文档页面打开聊天面板
   - 输入消息内容并发送
   - 支持回复其他用户的消息

2. **发送文件**：
   - 点击文件上传按钮
   - 选择要上传的文件
   - 文件会自动发送到聊天中

### 文件共享功能

1. **上传文件**：
   - 在文档页面打开文件面板
   - 点击上传按钮选择文件
   - 可以添加文件描述

2. **下载文件**：
   - 在文件列表中点击下载按钮
   - 文件会自动下载

3. **删除文件**：
   - 只有文件上传者、文档所有者或管理员可以删除
   - 点击删除按钮确认删除

## 集成说明

### 通知集成

通知已经集成到以下功能中：
- 评论创建和回复
- 任务创建、分配和完成
- 文档共享（待实现）
- 文档更新（待实现）

### Socket.IO 集成

所有实时功能都通过 Socket.IO 实现：
- 用户加入文档房间时会收到实时更新
- 用户加入个人房间（`user_${userId}`）时会收到个人通知

## 注意事项

1. **文件上传限制**：
   - 单个文件最大 50MB
   - 聊天文件消息最大 10MB
   - 上传的文件存储在 `backend/uploads` 目录

2. **通知设置**：
   - 用户可以在通知设置中关闭特定类型的通知
   - 关闭的通知不会创建数据库记录
   - Socket.IO 实时通知仍然会发送，但不会持久化

3. **权限控制**：
   - 只有有权限访问文档的用户才能查看和发送聊天消息
   - 只有有权限访问文档的用户才能上传和下载文件
   - 只有文件上传者、文档所有者或管理员可以删除文件

4. **性能优化**：
   - 通知列表支持分页加载
   - 聊天消息支持分页加载
   - 文件列表按创建时间倒序排列

## 待实现功能

1. **视频会议集成**：
   - 可以集成 Zoom、WebRTC 等第三方服务
   - 需要添加视频会议按钮和界面

2. **屏幕共享**：
   - 可以使用 WebRTC 实现屏幕共享
   - 需要添加屏幕共享按钮和界面

3. **通知推送**：
   - 可以集成浏览器推送通知（Web Push API）
   - 可以集成邮件通知（SMTP）

4. **文件预览**：
   - 支持图片、PDF 等文件类型的在线预览
   - 需要添加文件预览组件

5. **聊天功能增强**：
   - 支持 @提及用户
   - 支持表情符号
   - 支持消息搜索

## 测试建议

1. **通知测试**：
   - 创建评论和任务，验证通知是否正确创建
   - 测试通知筛选和搜索功能
   - 测试通知设置功能

2. **聊天测试**：
   - 在多个浏览器窗口中测试实时聊天
   - 测试文件上传和下载
   - 测试消息删除功能

3. **文件共享测试**：
   - 测试文件上传和下载
   - 测试文件权限控制
   - 测试文件删除功能

4. **性能测试**：
   - 测试大量通知和消息的加载性能
   - 测试文件上传和下载的性能

