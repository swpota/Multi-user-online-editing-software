# 视频会议和屏幕共享功能实现指南

## 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install @jitsi/react-sdk
```

### 2. 组件已创建

- ✅ `frontend/src/components/VideoConferencePanel.jsx` - 视频会议组件
- ✅ 已集成到 `EditorPage.jsx`

### 3. 使用说明

1. 在文档编辑页面，点击"📹 视频会议"按钮
2. 自动创建或加入基于文档ID的会议房间
3. 支持视频、音频和屏幕共享
4. 所有有权限访问文档的用户都会进入同一个会议房间

## 功能特性

### ✅ 已实现功能

1. **视频会议**
   - 多人视频通话
   - 音频通话
   - 屏幕共享（Jitsi内置）
   - 聊天功能（会议内）
   - 录制功能（可选）

2. **房间管理**
   - 基于文档ID自动生成房间名称
   - 同一文档的用户自动进入同一房间
   - 离开文档时自动离开会议

3. **用户信息**
   - 自动使用用户姓名或邮箱作为显示名称
   - 显示用户邮箱信息

### ⚙️ 配置选项

#### 使用公共服务器（默认）

当前配置使用 Jitsi 的公共服务器 `meet.jit.si`，无需额外配置即可使用。

#### 使用自己的服务器（可选）

如果需要使用自己的 Jitsi 服务器：

1. 部署 Jitsi Meet 服务器
2. 修改 `VideoConferencePanel.jsx` 中的 `domain` 属性：

```javascript
<JitsiMeeting
  domain="your-jitsi-server.com" // 改为你的服务器地址
  // ... 其他配置
/>
```

## 屏幕共享

屏幕共享功能已内置在 Jitsi Meet 中，用户可以通过工具栏中的"桌面"按钮启动屏幕共享。

### 使用方法

1. 加入视频会议
2. 点击工具栏中的"桌面"图标
3. 选择要共享的屏幕或窗口
4. 点击"共享"

## 权限要求

### 浏览器权限

用户需要授权以下权限：
- **摄像头**：用于视频通话
- **麦克风**：用于音频通话
- **屏幕共享**：用于屏幕共享功能

### 浏览器兼容性

- ✅ Chrome/Edge（推荐）
- ✅ Firefox
- ✅ Safari（部分功能可能受限）

## 安全考虑

### 当前实现

- 会议房间ID基于文档ID生成
- 只有有权限访问文档的用户才能知道房间ID
- 使用 Jitsi 的公共服务器（有隐私限制）

### 增强安全性（可选）

1. **添加密码保护**：
   ```javascript
   configOverwrite: {
     // ... 其他配置
     roomPassword: "your-password", // 添加房间密码
   }
   ```

2. **使用自己的服务器**：
   - 完全控制数据
   - 可以添加额外的安全措施

3. **限制访问**：
   - 在加入会议前验证用户权限
   - 可以添加白名单功能

## 性能优化

### 带宽管理

- Jitsi 会自动调整视频质量
- 可以限制同时在线人数
- 可以禁用视频，仅使用音频

### 配置建议

对于大量用户的会议，可以：

1. **默认关闭视频**：
   ```javascript
   configOverwrite: {
     startWithVideoMuted: true, // 默认关闭视频
   }
   ```

2. **限制视频质量**：
   ```javascript
   configOverwrite: {
     videoQuality: {
       maxBitrate: 500, // 限制最大比特率
     }
   }
   ```

## 故障排除

### 常见问题

1. **无法访问摄像头/麦克风**
   - 检查浏览器权限设置
   - 确保使用 HTTPS（生产环境）

2. **无法加入会议**
   - 检查网络连接
   - 检查防火墙设置
   - 尝试使用不同的浏览器

3. **屏幕共享不工作**
   - 确保浏览器支持屏幕共享
   - Chrome/Edge 支持最好
   - 检查浏览器权限

### 调试

打开浏览器控制台查看日志：
- `Jitsi API 已就绪` - API加载成功
- `已加入视频会议` - 成功加入会议
- `参与者加入/离开` - 参与者状态变化

## 高级功能

### 自定义界面

可以修改 `interfaceConfigOverwrite` 来自定义界面：

```javascript
interfaceConfigOverwrite: {
  TOOLBAR_BUTTONS: [
    "microphone",
    "camera",
    "desktop", // 屏幕共享
    "hangup",
    // ... 其他按钮
  ],
  // 隐藏某些功能
  HIDE_INVITE_MORE_HEADER: true,
}
```

### 事件监听

组件中已实现基本的事件监听，可以扩展：

```javascript
api.addEventListener("videoConferenceJoined", () => {
  // 会议加入成功
});

api.addEventListener("participantJoined", (participant) => {
  // 新参与者加入
});

api.addEventListener("screenSharingStatusChanged", (status) => {
  // 屏幕共享状态变化
});
```

## 部署注意事项

### 生产环境

1. **使用 HTTPS**：
   - 浏览器要求 HTTPS 才能访问摄像头/麦克风
   - 确保前端和后端都使用 HTTPS

2. **CORS 配置**：
   - 如果使用自己的 Jitsi 服务器，需要配置 CORS

3. **性能监控**：
   - 监控服务器负载
   - 监控带宽使用

## 总结

视频会议和屏幕共享功能已完全集成到系统中：

- ✅ 视频会议组件已创建
- ✅ 已集成到编辑器页面
- ✅ 支持多人视频通话
- ✅ 支持屏幕共享
- ✅ 自动房间管理
- ✅ 用户信息自动填充

只需安装依赖即可使用！

