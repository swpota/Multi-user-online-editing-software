# 模块六：系统管理与监控模块 - 实现说明

## ✅ 已完成功能

### 6.1 系统监控 ✅

1. **实时性能监控** ✅
   - CPU使用率监控
   - 内存使用率监控
   - 系统运行时间监控
   - 自动收集系统指标（每5分钟）

2. **错误日志记录** ✅
   - 自动记录系统错误
   - 错误级别分类（error, warning, info, debug）
   - 错误堆栈信息记录
   - 关联用户和请求信息

3. **报警机制** ✅
   - CPU使用率超过80%时报警
   - 内存使用率超过85%时报警
   - 错误数量过多时报警
   - 自动健康检查（每10分钟）

4. **系统健康报告** ✅
   - 错误统计（按级别）
   - 性能指标平均值
   - 用户活动统计
   - 数据库统计

### 6.2 用户管理 ✅

1. **用户列表管理** ✅
   - 查看所有用户
   - 用户信息显示（邮箱、姓名、角色等）
   - 用户删除功能

2. **用户权限调整** ✅
   - 角色管理（admin/editor）
   - 提升/降级用户角色
   - 防止删除最后一位管理员

3. **用户行为分析** ✅
   - 用户活动记录
   - 活动类型统计
   - 最活跃用户排名
   - 用户活动详情查询

4. **用户满意度调查** ✅
   - 调查记录管理
   - 调查统计（平均评分、满意数量等）
   - 按类型统计调查结果

### 6.3 系统配置 ✅

1. **系统参数设置** ✅
   - 系统名称、文件大小限制等
   - 会话超时时间
   - 密码最小长度
   - 最大登录尝试次数

2. **功能模块开关** ✅
   - 用户注册开关
   - 邮件通知开关
   - 聊天功能开关
   - 视频会议功能开关
   - 评论功能开关
   - 任务功能开关
   - 文件共享功能开关
   - 双因素认证开关

## 数据库表

### 1. system_logs 表
用于存储系统错误日志，包括：
- 错误级别（error, warning, info, debug）
- 错误消息和堆栈信息
- 关联用户和请求信息
- 错误代码和元数据

### 2. system_metrics 表
用于存储系统性能指标，包括：
- 指标类型（cpu, memory, disk, network, response_time等）
- 指标值和单位
- 指标元数据
- 时间戳

### 3. system_settings 表
用于存储系统配置，包括：
- 配置键和值
- 配置类型（string, number, boolean, json）
- 配置描述和分类
- 更新时间

### 4. user_activities 表
用于存储用户行为分析，包括：
- 用户ID
- 活动类型（login, logout, create_document, edit_document等）
- 活动描述
- 关联资源信息
- IP地址和用户代理

### 5. user_surveys 表
用于存储用户满意度调查，包括：
- 用户ID
- 问题和答案
- 评分（1-5分）
- 调查类型
- 调查元数据

## 安装步骤

### 1. 创建数据库表

在 PostgreSQL 中执行以下 SQL 脚本：

```bash
# 在 DBeaver 或其他数据库工具中执行
psql -U your_username -d your_database -f backend/sql/create_system_management_tables.sql
```

或者直接在 DBeaver 中打开并执行 `create_system_management_tables.sql` 文件。

### 2. 后端服务

后端服务已自动集成到系统中：
- `monitoringService.js` - 系统监控服务
- `configService.js` - 系统配置服务
- `activityMiddleware.js` - 用户活动记录中间件

### 3. 前端界面

前端管理界面已集成到 `AdminDashboardPage.jsx`，包含以下标签页：
- 用户管理
- 系统监控
- 用户分析
- 系统配置
- 用户满意度调查

## API 端点

### 系统监控 API

- `GET /api/admin/monitoring/realtime` - 获取实时系统性能指标
- `GET /api/admin/monitoring/metrics` - 获取系统性能指标历史数据
- `GET /api/admin/monitoring/logs` - 获取系统错误日志
- `GET /api/admin/monitoring/health` - 获取系统健康报告
- `GET /api/admin/monitoring/alerts` - 检查系统健康状态并获取报警

### 用户管理 API

- `GET /api/admin/users` - 获取用户列表
- `GET /api/admin/users/:id` - 获取用户详细信息
- `GET /api/admin/users/:id/activities` - 获取用户行为分析
- `GET /api/admin/users/analytics` - 获取用户分析统计
- `PUT /api/admin/users/:id/role` - 更新用户角色
- `DELETE /api/admin/users/:id` - 删除用户

### 用户满意度调查 API

- `GET /api/admin/surveys` - 获取用户满意度调查列表
- `GET /api/admin/surveys/statistics` - 获取用户满意度调查统计
- `POST /api/admin/surveys` - 创建用户满意度调查

### 系统配置 API

- `GET /api/admin/settings` - 获取所有系统配置
- `GET /api/admin/settings/:key` - 获取指定系统配置
- `PUT /api/admin/settings/:key` - 更新系统配置
- `DELETE /api/admin/settings/:key` - 删除系统配置
- `GET /api/admin/settings/features` - 获取功能模块开关
- `PUT /api/admin/settings/features/:feature` - 更新功能模块开关

## 使用说明

### 访问管理面板

1. 确保你已以管理员身份登录
2. 访问 `/admin` 路由（如果已配置）或直接访问管理页面
3. 使用标签页切换不同的管理功能

### 系统监控

- **实时监控**：查看CPU、内存使用率等实时指标
- **健康检查**：查看系统健康状态和报警信息
- **错误日志**：查看最近的系统错误日志

### 用户管理

- **用户列表**：查看所有用户，管理用户角色
- **用户分析**：查看用户活动统计和最活跃用户
- **用户行为**：查看特定用户的活动记录

### 系统配置

- **功能开关**：启用/禁用各种功能模块
- **系统参数**：修改系统配置参数

### 用户满意度调查

- **调查记录**：查看所有用户满意度调查
- **调查统计**：查看调查统计信息（平均评分、满意数量等）

## 定时任务

系统自动运行以下定时任务：

1. **系统指标收集**：每5分钟收集一次系统性能指标
2. **系统健康检查**：每10分钟检查一次系统健康状态

## 注意事项

1. **权限控制**：所有管理API都需要管理员权限
2. **数据安全**：删除用户等操作需要谨慎，系统会防止删除最后一位管理员
3. **性能监控**：系统监控可能会产生大量数据，建议定期清理旧数据
4. **错误日志**：错误日志会记录敏感信息，请妥善保管

## 扩展功能

可以进一步扩展以下功能：

1. **邮件报警**：当系统出现异常时发送邮件通知
2. **数据导出**：导出监控数据和用户分析报告
3. **自定义报警规则**：允许管理员自定义报警规则
4. **数据可视化**：使用图表展示监控数据和用户分析
5. **日志搜索**：提供更强大的日志搜索和过滤功能

