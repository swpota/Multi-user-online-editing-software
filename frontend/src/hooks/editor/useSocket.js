import { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';

/**
 * useSocket Hook - WebSocket 实时协作管理
 * 
 * 功能概述：
 * 1. 建立和管理与服务器的 Socket.io 连接
 * 2. 实现多人实时协作编辑功能
 * 3. 同步在线用户列表
 * 4. 同步文档内容变更（基于 Operational Transformation）
 * 5. 同步文档元数据变更（标题、分类、标签等）
 * 6. 同步用户光标位置，实现协作光标显示
 * 
 * @param {string} documentId - 文档ID，用于加入特定的文档房间
 * @param {Object} user - 当前用户对象，包含 id 和 username
 * @param {boolean} isEditor - 当前用户是否有编辑权限
 * 
 * 实现原理：
 * - 使用 Socket.io 的房间机制，每个文档对应一个房间
 * - 用户加入房间后，可以接收该房间内的所有广播消息
 * - 使用 ref 存储 socket 实例，避免闭包问题
 * - 通过回调函数机制，将 socket 事件与外部组件（如 Quill 编辑器）连接
 */
export function useSocket(documentId, user, isEditor) {
  // ========== 状态管理 ==========

  // Socket 实例状态（用于 React 组件渲染）
  const [socket, setSocket] = useState(null);

  // 在线用户列表：存储当前文档房间内的所有在线用户
  const [onlineUsers, setOnlineUsers] = useState([]);

  // 远程用户光标位置映射表：Map<userId, {username, range, color}>
  // 用于在编辑器中显示其他用户的光标位置
  const [remoteCursors, setRemoteCursors] = useState(new Map());

  // Socket 实例引用（用于在回调中访问最新的 socket，避免闭包陷阱）
  const socketRef = useRef(null);

  /**
   * 初始化 Socket 连接
   * 
   * 连接流程：
   * 1. 创建 Socket.io 客户端实例，连接到后端服务器
   * 2. 连接成功后，发送 'joinDocument' 事件加入文档房间
   * 3. 注册各种事件监听器，接收服务器广播的实时更新
   * 
   * 事件监听器包括：
   * - onlineUsersUpdate: 在线用户列表更新
   * - documentContentChange: 文档内容变更（其他用户的编辑）
   * - documentMetadataChange: 文档元数据变更（标题、分类等）
   * - cursorPositionChange: 光标位置变更（协作光标）
   * - userLeft: 用户离开文档
   */
  const connectSocket = useCallback(() => {
    if (!user || !documentId) return null;

    // 创建 Socket.io 连接，从环境变量读取服务器地址
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: { token: localStorage.getItem('token') } // 携带认证 token
    });

    // 监听连接成功事件
    newSocket.on('connect', () => {
      console.log('Socket 已连接');

      // 加入文档房间，告诉服务器当前用户正在编辑哪个文档
      newSocket.emit('joinDocument', {
        documentId,
        userId: user.id,
        username: user.username
      });
    });

    // ========== 事件监听器注册 ==========

    /**
     * 监听在线用户列表更新
     * 当有用户加入或离开文档时，服务器会广播最新的在线用户列表
     */
    newSocket.on('onlineUsersUpdate', (users) => {
      setOnlineUsers(users || []);
    });

    /**
     * 监听文档内容变更（实时协作核心）
     * 
     * 工作原理：
     * 1. 当其他用户编辑文档时，服务器会广播 delta（变更增量）
     * 2. delta 是 Quill 编辑器的数据格式，描述了文档的具体变更
     * 3. 过滤掉自己发送的变更（通过 userId 判断）
     * 4. 将远程变更应用到本地 Quill 编辑器
     * 
     * 注意：这里使用回调函数模式，因为 Quill 实例在外部组件中
     */
    newSocket.on('documentContentChange', ({ delta, userId }) => {
      if (userId !== user.id) {
        // 调用外部注册的回调函数，将 delta 应用到 Quill 编辑器
        if (socketRef.current?.onRemoteContentChange) {
          socketRef.current.onRemoteContentChange(delta);
        }
      }
    });

    /**
     * 监听文档元数据变更
     * 
     * 元数据包括：
     * - title: 文档标题
     * - category: 文档分类
     * - tags: 文档标签
     * 
     * 当其他用户修改这些信息时，本地需要同步更新
     */
    newSocket.on('documentMetadataChange', ({ updates, userId }) => {
      if (userId !== user.id) {
        // 调用外部注册的回调函数，更新元数据
        if (socketRef.current?.onRemoteMetadataChange) {
          socketRef.current.onRemoteMetadataChange(updates);
        }
      }
    });

    /**
     * 监听光标位置变更（协作光标功能）
     * 
     * 功能说明：
     * - 在多人协作时，可以看到其他用户的光标位置
     * - 每个用户的光标有不同的颜色，便于区分
     * - range 包含光标的起始和结束位置（支持选区）
     * 
     * 数据结构：
     * - userId: 用户ID
     * - username: 用户名（用于显示标签）
     * - range: {index, length} 光标位置和选区长度
     * - color: 光标颜色（每个用户唯一）
     */
    newSocket.on('cursorPositionChange', ({ userId, username, range, color }) => {
      if (userId !== user.id) {
        setRemoteCursors(prev => {
          const newCursors = new Map(prev);
          if (range) {
            // 更新或添加该用户的光标信息
            newCursors.set(userId, { username, range, color });
          } else {
            // range 为 null 表示用户失去焦点，移除光标
            newCursors.delete(userId);
          }
          return newCursors;
        });
      }
    });

    /**
     * 监听用户离开事件
     * 当用户关闭文档或断开连接时，移除其光标显示
     */
    newSocket.on('userLeft', ({ userId }) => {
      setRemoteCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.delete(userId);
        return newCursors;
      });
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return newSocket;
  }, [documentId, user]);

  /**
   * 断开 Socket 连接
   * 
   * 调用时机：组件卸载或用户离开文档时
   * 
   * 清理步骤：
   * 1. 发送 'leaveDocument' 事件通知服务器
   * 2. 断开 Socket 连接
   * 3. 清理本地状态
   */
  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('leaveDocument', { documentId });
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
  }, [documentId]);

  /**
   * 发送内容变更到服务器
   * 
   * 调用时机：当本地用户编辑文档时
   * 
   * @param {Object} delta - Quill 编辑器的变更增量对象
   * 
   * 工作流程：
   * 1. 用户在 Quill 编辑器中输入内容
   * 2. Quill 触发 'text-change' 事件，生成 delta
   * 3. 调用此函数，通过 Socket 发送 delta 到服务器
   * 4. 服务器广播给同一文档房间的其他用户
   * 5. 其他用户接收 delta 并应用到本地编辑器
   * 
   * 权限检查：只有编辑者才能发送内容变更
   */
  const emitContentChange = useCallback((delta) => {
    if (!socketRef.current || !isEditor) return;

    socketRef.current.emit('documentContentChange', {
      documentId,
      delta,
      userId: user.id // 携带用户ID，用于过滤自己的变更
    });
  }, [documentId, user, isEditor]);

  /**
   * 发送元数据变更到服务器
   * 
   * 调用时机：当用户修改文档标题、分类或标签时
   * 
   * @param {Object} updates - 元数据更新对象，可能包含 title、category、tags
   * 
   * 示例：
   * emitMetadataChange({ title: '新标题' })
   * emitMetadataChange({ category: '技术文档', tags: ['React', 'Hooks'] })
   */
  const emitMetadataChange = useCallback((updates) => {
    if (!socketRef.current || !updates || typeof updates !== 'object') return;

    socketRef.current.emit('documentMetadataChange', {
      documentId,
      updates,
      userId: user.id
    });
  }, [documentId, user]);

  /**
   * 发送光标位置到服务器
   * 
   * 调用时机：当用户移动光标或选择文本时
   * 
   * @param {Object|null} range - 光标位置对象 {index, length}，null 表示失去焦点
   * @param {string} color - 光标颜色（每个用户分配唯一颜色）
   * 
   * 实现细节：
   * - 使用节流（throttle）避免频繁发送，减少网络开销
   * - 当用户失去焦点时，传入 null 移除光标显示
   * - 光标颜色在用户加入时由服务器分配
   */
  const emitCursorPosition = useCallback((range, color) => {
    if (!socketRef.current || !isEditor) return;

    socketRef.current.emit('cursorPositionChange', {
      documentId,
      userId: user.id,
      username: user.username,
      range,
      color
    });
  }, [documentId, user, isEditor]);

  /**
   * 注册远程内容变更回调
   * 
   * 用途：将外部组件（如 EditorPage）的处理函数注册到 socket 实例上
   * 这样当接收到远程内容变更时，可以直接调用该函数更新 Quill 编辑器
   * 
   * @param {Function} callback - 处理远程内容变更的回调函数
   */
  const registerContentChangeCallback = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.onRemoteContentChange = callback;
    }
  }, []);

  /**
   * 注册远程元数据变更回调
   * 
   * 用途：将外部组件的元数据更新函数注册到 socket 实例上
   * 
   * @param {Function} callback - 处理远程元数据变更的回调函数
   */
  const registerMetadataChangeCallback = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.onRemoteMetadataChange = callback;
    }
  }, []);

  /**
   * 生命周期管理：连接和断开连接
   * 
   * 当用户和文档ID都存在时，自动建立连接
   * 当组件卸载时，自动断开连接并清理资源
   */
  useEffect(() => {
    if (user && documentId) {
      connectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [user, documentId, connectSocket, disconnectSocket]);

  // ========== 返回值 ==========
  return {
    // 状态
    socket,                              // Socket 实例
    onlineUsers,                         // 在线用户列表
    remoteCursors,                       // 远程用户光标映射表

    // 方法
    connectSocket,                       // 建立连接
    disconnectSocket,                    // 断开连接
    emitContentChange,                   // 发送内容变更
    emitMetadataChange,                  // 发送元数据变更
    emitCursorPosition,                  // 发送光标位置
    registerContentChangeCallback,       // 注册内容变更回调
    registerMetadataChangeCallback,      // 注册元数据变更回调
  };
}
