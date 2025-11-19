import { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';

/**
 * useSocket Hook
 * 管理 Socket.io 连接和实时同步功能
 */
export function useSocket(documentId, user, isEditor) {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState(new Map());
  const socketRef = useRef(null);

  /**
   * 初始化 Socket 连接
   */
  const connectSocket = useCallback(() => {
    if (!user || !documentId) return null;

    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: { token: localStorage.getItem('token') }
    });

    newSocket.on('connect', () => {
      console.log('Socket 已连接');
      newSocket.emit('joinDocument', {
        documentId,
        userId: user.id,
        username: user.username
      });
    });

    // 监听在线用户更新
    newSocket.on('onlineUsersUpdate', (users) => {
      setOnlineUsers(users || []);
    });

    // 监听内容变更
    newSocket.on('documentContentChange', ({ delta, userId }) => {
      if (userId !== user.id) {
        // 这个回调需要在外部处理，因为需要访问 Quill 实例
        if (socketRef.current?.onRemoteContentChange) {
          socketRef.current.onRemoteContentChange(delta);
        }
      }
    });

    // 监听元数据变更
    newSocket.on('documentMetadataChange', ({ updates, userId }) => {
      if (userId !== user.id) {
        // 这个回调需要在外部处理
        if (socketRef.current?.onRemoteMetadataChange) {
          socketRef.current.onRemoteMetadataChange(updates);
        }
      }
    });

    // 监听光标位置变更
    newSocket.on('cursorPositionChange', ({ userId, username, range, color }) => {
      if (userId !== user.id) {
        setRemoteCursors(prev => {
          const newCursors = new Map(prev);
          if (range) {
            newCursors.set(userId, { username, range, color });
          } else {
            newCursors.delete(userId);
          }
          return newCursors;
        });
      }
    });

    // 监听用户离开
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
   * 发送内容变更
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
   * 发送元数据变更
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
   * 发送光标位置
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
   */
  const registerContentChangeCallback = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.onRemoteContentChange = callback;
    }
  }, []);

  /**
   * 注册远程元数据变更回调
   */
  const registerMetadataChangeCallback = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.onRemoteMetadataChange = callback;
    }
  }, []);

  // 连接和断开连接
  useEffect(() => {
    if (user && documentId) {
      connectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [user, documentId, connectSocket, disconnectSocket]);

  return {
    // 状态
    socket,
    onlineUsers,
    remoteCursors,
    
    // 方法
    connectSocket,
    disconnectSocket,
    emitContentChange,
    emitMetadataChange,
    emitCursorPosition,
    registerContentChangeCallback,
    registerMetadataChangeCallback,
  };
}
