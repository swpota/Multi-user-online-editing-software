import { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';

/**
 * useSocket - 管理WebSocket连接的Hook
 * 这个Hook负责实时协作的核心功能：多人同时编辑时同步内容、显示其他人的光标
 */
export function useSocket(documentId, user, isEditor) {
  // socket实例
  const [socket, setSocket] = useState(null);
  // 当前在线的用户列表
  const [onlineUsers, setOnlineUsers] = useState([]);
  // 其他用户的光标位置，用Map存储，key是用户id
  const [remoteCursors, setRemoteCursors] = useState(new Map());
  // 用ref存socket，避免闭包问题
  const socketRef = useRef(null);

  /**
   * 建立socket连接
   * 连上后会加入对应文档的"房间"，这样就只会收到这个文档的消息
   */
  const connectSocket = useCallback(() => {
    if (!user || !documentId) return null;

    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: { token: localStorage.getItem('token') }
    });

    // 连接成功后加入文档房间
    newSocket.on('connect', () => {
      console.log('Socket 已连接');
      newSocket.emit('joinDocument', {
        documentId,
        userId: user.id,
        username: user.username
      });
    });

    // 收到在线用户列表更新
    newSocket.on('onlineUsersUpdate', (users) => {
      setOnlineUsers(users || []);
    });

    // 收到其他人的编辑内容
    // delta是Quill编辑器的格式，描述了文档的变化
    newSocket.on('documentContentChange', ({ delta, userId }) => {
      if (userId !== user.id) {
        // 不是自己发的，就应用到编辑器
        if (socketRef.current?.onRemoteContentChange) {
          socketRef.current.onRemoteContentChange(delta);
        }
      }
    });

    // 收到其他人改了标题/分类/标签
    newSocket.on('documentMetadataChange', ({ updates, userId }) => {
      if (userId !== user.id) {
        if (socketRef.current?.onRemoteMetadataChange) {
          socketRef.current.onRemoteMetadataChange(updates);
        }
      }
    });

    // 收到其他人的光标位置，用来显示协作光标
    newSocket.on('cursorPositionChange', ({ userId, username, range, color }) => {
      if (userId !== user.id) {
        setRemoteCursors(prev => {
          const newCursors = new Map(prev);
          if (range) {
            newCursors.set(userId, { username, range, color });
          } else {
            // range为null说明那个人失去焦点了，移除光标
            newCursors.delete(userId);
          }
          return newCursors;
        });
      }
    });

    // 有人离开了，移除他的光标
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
   * 断开连接，组件卸载时调用
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
   * 发送内容变更，自己编辑时调用，把变化同步给其他人
   */
  const emitContentChange = useCallback((delta) => {
    if (!socketRef.current || !isEditor) return;
    socketRef.current.emit('documentContentChange', {
      documentId,
      delta,
      userId: user.id
    });
  }, [documentId, user, isEditor]);

  /**
   * 发送元数据变更，改标题、分类、标签时调用
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
   * 发送光标位置，移动光标或选中文字时调用
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

  // 注册回调函数，用于把远程变更应用到Quill编辑器
  const registerContentChangeCallback = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.onRemoteContentChange = callback;
    }
  }, []);

  const registerMetadataChangeCallback = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.onRemoteMetadataChange = callback;
    }
  }, []);

  // 自动连接和断开
  useEffect(() => {
    if (user && documentId) {
      connectSocket();
    }
    return () => {
      disconnectSocket();
    };
  }, [user, documentId, connectSocket, disconnectSocket]);

  return {
    socket,
    onlineUsers,
    remoteCursors,
    connectSocket,
    disconnectSocket,
    emitContentChange,
    emitMetadataChange,
    emitCursorPosition,
    registerContentChangeCallback,
    registerMetadataChangeCallback,
  };
}
