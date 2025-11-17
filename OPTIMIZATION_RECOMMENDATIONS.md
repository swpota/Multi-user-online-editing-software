# 项目优化建议

本文档列出了项目中可以优化的地方，按照优先级和类别组织。

## 🔴 高优先级 - 安全性问题

### 1. 环境变量验证
**问题**：缺少环境变量验证，可能导致运行时错误
**位置**：`backend/server.js`, `backend/db.js`
**建议**：
- 创建 `backend/config/env.js` 验证必需的环境变量
- 在应用启动时检查 `JWT_SECRET`, `DATABASE_URL` 是否存在
- 提供清晰的错误信息

### 2. CORS 配置硬编码
**问题**：CORS origin 硬编码为 `http://localhost:5173`
**位置**：`backend/server.js:36`
**建议**：
- 使用环境变量 `CORS_ORIGIN`
- 支持多个 origin（开发/生产环境）
- 添加 `.env.example` 文件

### 3. 验证函数重复
**问题**：邮箱、手机号、姓名验证函数在前后端重复
**位置**：`backend/server.js:54-80`, `frontend/src/components/Register.jsx:43-68`
**建议**：
- 创建 `backend/utils/validation.js` 统一验证函数
- 前端可以使用相同的验证逻辑或调用后端 API 验证

### 4. 错误信息可能泄露敏感信息
**问题**：某些错误信息可能泄露系统内部信息
**位置**：所有路由文件
**建议**：
- 生产环境隐藏详细错误堆栈
- 使用统一的错误处理中间件
- 区分开发和生产环境的错误响应

### 5. 缺少请求速率限制
**问题**：没有防止暴力破解和 DDoS 攻击的机制
**位置**：所有路由
**建议**：
- 安装 `express-rate-limit`
- 为登录、注册、密码重置添加速率限制
- 为 API 路由添加全局速率限制

### 6. JWT Token 过期时间
**问题**：Token 过期时间固定为 1 小时，没有刷新机制
**位置**：`backend/server.js:301`
**建议**：
- 实现 refresh token 机制
- 提供 token 刷新 API
- 前端自动刷新即将过期的 token

## 🟡 中优先级 - 代码质量

### 7. 文件过大
**问题**：`documentRoutes.js` 有 3087 行，难以维护
**位置**：`backend/routes/documentRoutes.js`
**建议**：
- 拆分为多个文件：
  - `documentRoutes.js` - 基本 CRUD
  - `documentExportRoutes.js` - 导出功能
  - `documentCollaborationRoutes.js` - 协作功能
  - `documentVersionRoutes.js` - 版本管理
- 提取公共函数到 `utils/` 目录

### 8. 日志管理
**问题**：大量使用 `console.log` 和 `console.error`
**位置**：所有后端文件
**建议**：
- 使用专业的日志库（如 `winston` 或 `pino`）
- 实现日志级别（info, warn, error, debug）
- 添加日志轮转和文件输出
- 生产环境禁用 console.log

### 9. 错误处理不统一
**问题**：每个路由都有不同的错误处理方式
**位置**：所有路由文件
**建议**：
- 创建统一的错误处理中间件
- 使用自定义错误类
- 标准化错误响应格式

### 10. 数据库连接池配置
**问题**：数据库连接池使用默认配置
**位置**：`backend/db.js`
**建议**：
- 配置连接池大小
- 添加连接超时设置
- 实现连接健康检查
- 添加连接池监控

### 11. 输入验证和清理
**问题**：某些地方缺少输入验证
**位置**：所有路由文件
**建议**：
- 使用 `joi` 或 `express-validator` 进行输入验证
- 对所有用户输入进行清理和验证
- 防止 XSS 攻击（前端已使用 DOMPurify，但后端也需要验证）

### 12. SQL 查询优化
**问题**：某些查询可能性能不佳
**位置**：所有路由文件
**建议**：
- 添加数据库索引（检查是否已有）
- 使用查询分析工具
- 避免 N+1 查询问题
- 添加查询缓存（如 Redis）

## 🟢 低优先级 - 性能优化

### 13. 前端 API 调用优化
**问题**：某些 API 调用可能过于频繁
**位置**：`frontend/src/pages/EditorPage.jsx`
**建议**：
- 使用防抖（debounce）和节流（throttle）
- 实现请求缓存
- 使用 React Query 或 SWR 进行数据获取和缓存

### 14. Socket.IO 房间管理优化
**问题**：房间占用信息存储在内存中，服务器重启会丢失
**位置**：`backend/server.js:43`
**建议**：
- 使用 Redis 适配器存储房间信息
- 实现房间状态的持久化
- 添加房间清理机制

### 15. 文件上传优化
**问题**：文件上传没有大小限制和类型验证
**位置**：`backend/routes/fileRoutes.js`
**建议**：
- 添加文件大小限制（使用系统设置）
- 验证文件类型（白名单）
- 实现文件压缩
- 添加病毒扫描（可选）

### 16. 数据库查询缓存
**问题**：频繁查询系统设置等静态数据
**位置**：`backend/server.js`, `backend/routes/adminRoutes.js`
**建议**：
- 使用 Redis 缓存系统设置
- 实现缓存失效机制
- 缓存用户权限信息

### 17. 前端代码分割
**问题**：所有组件打包在一个文件中
**位置**：`frontend/src`
**建议**：
- 使用 React.lazy 进行代码分割
- 实现路由级别的代码分割
- 优化打包大小

## 📋 代码组织改进

### 18. 常量提取
**问题**：魔法数字和字符串分散在代码中
**位置**：所有文件
**建议**：
- 创建 `backend/constants/` 目录
- 提取所有常量（角色、状态、错误消息等）
- 创建 `frontend/src/constants/` 目录

### 19. 类型定义（TypeScript）
**问题**：JavaScript 缺少类型检查
**建议**：
- 考虑迁移到 TypeScript
- 或者使用 JSDoc 添加类型注释
- 添加 PropTypes 或使用 TypeScript

### 20. 配置文件组织
**问题**：配置分散在多个地方
**建议**：
- 创建 `backend/config/` 目录
- 统一管理所有配置
- 区分开发、测试、生产环境配置

### 21. 测试覆盖
**问题**：没有测试文件
**建议**：
- 添加单元测试（Jest）
- 添加集成测试
- 添加 E2E 测试（Playwright 或 Cypress）
- 设置 CI/CD 流水线

### 22. API 文档
**问题**：缺少 API 文档
**建议**：
- 使用 Swagger/OpenAPI 生成 API 文档
- 添加 API 版本控制
- 提供 API 使用示例

## 🔧 开发体验改进

### 23. 环境变量示例文件
**问题**：缺少 `.env.example`
**建议**：
- 创建 `.env.example` 文件
- 列出所有必需的环境变量
- 提供默认值和说明

### 24. 启动脚本优化
**问题**：后端 package.json 缺少启动脚本
**位置**：`backend/package.json`
**建议**：
- 添加 `start`, `dev`, `test` 脚本
- 使用 `nodemon` 进行开发
- 添加数据库迁移脚本

### 25. 代码格式化
**问题**：代码格式不统一
**建议**：
- 使用 Prettier 进行代码格式化
- 使用 ESLint 进行代码检查
- 添加 pre-commit hooks（husky）

### 26. 数据库迁移
**问题**：SQL 文件分散，没有迁移机制
**位置**：`backend/sql/`
**建议**：
- 使用数据库迁移工具（如 `node-pg-migrate`）
- 版本控制数据库 schema
- 提供回滚机制

## 📊 监控和 observability

### 27. 应用监控
**问题**：缺少应用性能监控
**建议**：
- 集成 APM 工具（如 New Relic 或 Datadog）
- 添加健康检查端点
- 监控数据库查询性能
- 监控 API 响应时间

### 28. 错误追踪
**问题**：错误只记录在控制台
**建议**：
- 集成错误追踪服务（如 Sentry）
- 实现错误通知机制
- 添加错误分析和报告

## 🎯 实施建议

### 第一阶段（立即实施）
1. 环境变量验证 (#1)
2. CORS 配置 (#2)
3. 验证函数提取 (#3)
4. 请求速率限制 (#5)
5. 创建 `.env.example` (#23)

### 第二阶段（短期）
6. 错误处理统一 (#9)
7. 日志管理 (#8)
8. 数据库连接池配置 (#10)
9. 输入验证 (#11)
10. 代码分割 (#17)

### 第三阶段（中期）
11. 文件拆分 (#7)
12. 数据库查询优化 (#12)
13. 缓存机制 (#16)
14. 测试覆盖 (#21)
15. API 文档 (#22)

### 第四阶段（长期）
16. TypeScript 迁移 (#19)
17. 监控和 observability (#27, #28)
18. 性能优化 (#13, #14, #15)
19. 数据库迁移 (#26)

## 📝 注意事项

- 在实施任何更改之前，请先备份数据库和代码
- 在开发环境中测试所有更改
- 逐步实施，不要一次性更改太多
- 保持代码审查和测试
- 更新文档以反映更改

## 🔗 相关资源

- [Express.js 最佳实践](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js 安全最佳实践](https://nodejs.org/en/docs/guides/security/)
- [PostgreSQL 性能优化](https://www.postgresql.org/docs/current/performance-tips.html)
- [React 性能优化](https://react.dev/learn/render-and-commit)

