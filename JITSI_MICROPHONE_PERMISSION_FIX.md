# Jitsi Meet 麦克风权限问题解决方案

## 问题说明

即使 `localhost:5173` 已经在浏览器的麦克风允许列表中，Jitsi Meet 仍然提示"Your mic is muted by your system settings"。

**原因**：Jitsi Meet 使用的是外部域名 `meet.jit.si`，而不是 `localhost:5173`。浏览器对每个域名都有独立的权限设置。

## 解决方案

### 方案一：在浏览器设置中添加 meet.jit.si（推荐）

#### Edge/Chrome

1. **打开麦克风设置页面**：
   - Edge: 在地址栏输入 `edge://settings/content/microphone`
   - Chrome: 在地址栏输入 `chrome://settings/content/microphone`

2. **添加 meet.jit.si 到允许列表**：
   - 向下滚动到"**Allowed to use microphone**"（允许使用麦克风）部分
   - 点击"**添加**"按钮（Add）
   - 输入：`https://meet.jit.si`
   - 点击"**添加**"确认

3. **验证设置**：
   - 确认 `https://meet.jit.si` 出现在"Allowed to use microphone"列表中
   - 如果出现在"Blocked from using microphone"列表中，点击垃圾桶图标删除

4. **刷新页面**：
   - 返回视频会议页面
   - 按 `F5` 刷新页面
   - 重新授权麦克风权限

#### Firefox

1. **打开权限设置**：
   - 在地址栏输入 `about:preferences#privacy`
   - 滚动到"权限"部分

2. **添加 meet.jit.si**：
   - 点击"麦克风"旁边的"设置"按钮
   - 点击"允许"按钮
   - 输入：`https://meet.jit.si`
   - 点击"允许"确认

### 方案二：在视频会议页面直接授权

1. **打开视频会议**：
   - 在视频会议页面，等待Jitsi Meet加载

2. **检查地址栏**：
   - 注意地址栏中会显示 `meet.jit.si` 的iframe
   - 点击地址栏左侧的锁图标或信息图标

3. **授权权限**：
   - 点击"网站设置"或"权限"
   - 找到"麦克风"选项
   - 确保设置为"允许"
   - 如果显示"阻止"，点击"重置权限"

4. **刷新页面**：
   - 按 `F5` 刷新页面
   - 浏览器会弹出权限请求
   - 点击"允许"

### 方案三：清除网站数据后重新授权

1. **清除 meet.jit.si 的网站数据**：
   - 按 `F12` 打开开发者工具
   - 切换到"应用"标签（Chrome/Edge）或"存储"标签（Firefox）
   - 在左侧找到 `https://meet.jit.si`
   - 右键点击 → 清除站点数据

2. **刷新页面**：
   - 按 `F5` 刷新页面
   - 浏览器会弹出权限请求
   - 点击"允许"

## 为什么需要单独授权？

### 浏览器权限模型

浏览器对每个域名都有独立的权限设置：

- ✅ `http://localhost:5173` - 你的前端应用域名
- ✅ `https://meet.jit.si` - Jitsi Meet 服务器域名（需要单独授权）

即使你的应用（localhost:5173）有麦克风权限，Jitsi Meet（meet.jit.si）仍然需要单独的权限。

### 跨域权限

当你的应用使用 iframe 嵌入 Jitsi Meet 时：
- 你的应用域名：`localhost:5173`（已有权限）
- Jitsi Meet 域名：`meet.jit.si`（需要单独授权）

浏览器会分别检查两个域名的权限。

## 验证权限是否生效

### 方法一：检查浏览器设置

1. 打开 `edge://settings/content/microphone` (Edge)
2. 或 `chrome://settings/content/microphone` (Chrome)
3. 在"Allowed to use microphone"列表中，确认有：
   - `http://localhost:5173`
   - `https://meet.jit.si`

### 方法二：使用浏览器控制台

1. 按 `F12` 打开开发者工具
2. 切换到"控制台"标签
3. 输入以下代码：
   ```javascript
   navigator.permissions.query({name: 'microphone'}).then(result => {
     console.log('麦克风权限状态:', result.state);
   });
   ```
4. 如果显示 "granted"，说明权限已授予

### 方法三：测试麦克风

1. 访问 https://www.onlinemictest.com/
2. 点击"测试我的麦克风"
3. 如果能够检测到声音，说明麦克风权限正常

## 常见问题

### Q1: 已经添加了 meet.jit.si，但还是提示静音？

**A:** 尝试：
1. 完全关闭浏览器，重新打开
2. 清除 meet.jit.si 的网站数据
3. 刷新页面，重新授权
4. 检查是否有浏览器扩展阻止权限

### Q2: 如何确认 meet.jit.si 已添加到允许列表？

**A:** 
1. 打开 `edge://settings/content/microphone`
2. 向下滚动到"Allowed to use microphone"部分
3. 确认列表中包含 `https://meet.jit.si`

### Q3: 可以一次性授权所有网站吗？

**A:** 可以，但不推荐：
1. 在麦克风设置页面
2. 将"Default behavior"设置为"Allow sites to use your microphone"
3. 这样所有网站都可以访问麦克风（安全性较低）

### Q4: 为什么不能只授权 localhost:5173？

**A:** 因为：
- Jitsi Meet 运行在 `meet.jit.si` 域名上
- 浏览器对每个域名都有独立的权限
- 即使你的应用有权限，Jitsi Meet 仍然需要单独的权限

## 最佳实践

### 推荐设置

1. **保持"Ask before accessing"开启**：
   - 这样浏览器会在首次访问时询问权限
   - 你可以选择允许或拒绝

2. **只授权需要的网站**：
   - 只将 `localhost:5173` 和 `meet.jit.si` 添加到允许列表
   - 不要授权所有网站

3. **定期检查权限**：
   - 定期检查允许列表
   - 移除不再需要的网站

## 总结

解决 Jitsi Meet 麦克风权限问题的关键步骤：

1. ✅ 打开 `edge://settings/content/microphone`
2. ✅ 在"Allowed to use microphone"部分，添加 `https://meet.jit.si`
3. ✅ 刷新视频会议页面
4. ✅ 重新授权麦克风权限

**记住**：`localhost:5173` 和 `meet.jit.si` 是两个不同的域名，需要分别授权！

