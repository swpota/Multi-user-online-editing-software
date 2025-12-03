import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import "../styles/components/ChatPanel.css";

const ChatPanel = ({ documentId, user, socket, onlineUsers = [], onClose }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // 拖动相关状态
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  const panelRef = useRef(null);

  // 初始化位置为右下角
  useEffect(() => {
    if (!initialized && panelRef.current) {
      const panelWidth = panelRef.current.offsetWidth;
      const panelHeight = panelRef.current.offsetHeight;
      setPosition({
        x: window.innerWidth - panelWidth - 20,
        y: window.innerHeight - panelHeight - 20
      });
      setInitialized(true);
    }
  }, [initialized]);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 获取聊天消息
  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/documents/${documentId}/chat-messages`, {
        params: { limit: 100, offset: 0 },
      });
      setMessages(response.data.messages || []);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("获取聊天消息失败", error);
    } finally {
      setLoading(false);
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const response = await api.post(`/documents/${documentId}/chat-messages`, {
        message: newMessage.trim(),
        replyTo: replyingTo?.id || null,
      });
      setNewMessage("");
      setReplyingTo(null);
      // 消息会通过 Socket.IO 实时更新，不需要手动添加到列表
    } catch (error) {
      console.error("发送消息失败", error);
      alert(error.response?.data?.message || "发送消息失败");
    } finally {
      setSending(false);
    }
  };

  // 上传文件
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setSending(true);
      const formData = new FormData();
      formData.append("file", file);

      await api.post(`/documents/${documentId}/chat-messages/file`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      // 文件消息会通过 Socket.IO 实时更新
    } catch (error) {
      console.error("上传文件失败", error);
      alert(error.response?.data?.message || "上传文件失败");
    } finally {
      setSending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 删除消息
  const deleteMessage = async (messageId) => {
    if (!window.confirm("确定要删除这条消息吗？")) return;

    try {
      await api.delete(`/chat-messages/${messageId}`);
      // 消息删除会通过 Socket.IO 实时更新
    } catch (error) {
      console.error("删除消息失败", error);
      alert(error.response?.data?.message || "删除消息失败");
    }
  };

  // 下载聊天文件
  const downloadChatFile = async (messageId, fileName) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/chat-messages/${messageId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('下载失败');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'file';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载文件失败', error);
      alert('下载文件失败');
    }
  };

  // 格式化时间
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  // 获取用户显示名称
  const getUserDisplayName = (userObj) => {
    return userObj?.full_name || userObj?.email || `用户${userObj?.id}`;
  };

  // 获取用户颜色
  const getUserColor = (userId) => {
    const colors = [
      "#1890ff",
      "#52c41a",
      "#faad14",
      "#f5222d",
      "#722ed1",
      "#13c2c2",
      "#eb2f96",
      "#fa8c16",
    ];
    return colors[userId % colors.length];
  };

  useEffect(() => {
    fetchMessages();

    // 监听 Socket.IO 事件
    if (socket) {
      const handleNewMessage = (message) => {
        setMessages((prev) => {
          // 检查消息是否已存在
          if (prev.some((m) => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
        setTimeout(scrollToBottom, 100);
      };

      const handleMessageDeleted = (data) => {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      };

      socket.on("newChatMessage", handleNewMessage);
      socket.on("chatMessageDeleted", handleMessageDeleted);

      return () => {
        socket.off("newChatMessage", handleNewMessage);
        socket.off("chatMessageDeleted", handleMessageDeleted);
      };
    }
  }, [socket, documentId]);

  // 当消息更新时滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 处理回车键发送
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 拖动开始
  const handleMouseDown = (e) => {
    // 只在头部区域才能拖动
    if (!e.target.closest('.chat-panel-header')) return;
    if (e.target.closest('.chat-panel-close-btn')) return; // 不在关闭按钮上拖动
    
    setDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // 拖动中
  const handleMouseMove = (e) => {
    if (!dragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // 限制拖动范围 - 允许在全屏幕范围内拖动
    const panelWidth = panelRef.current?.offsetWidth || 420;
    const panelHeight = panelRef.current?.offsetHeight || 550;
    const maxX = window.innerWidth - panelWidth;
    const maxY = window.innerHeight - panelHeight;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  // 拖动结束
  const handleMouseUp = () => {
    setDragging(false);
  };

  // 添加全局事件监听
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, dragStart, position]);

  return (
    <div 
      ref={panelRef}
      className={`chat-panel ${dragging ? 'dragging' : ''}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: dragging ? 'none' : 'transform 0.2s'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* 头部 */}
      <div className="chat-panel-header">
        <div className="chat-panel-header-info">
          <h3 className="chat-panel-title">
            💬 聊天
          </h3>
          <div className="chat-panel-online-count">
            {onlineUsers.length} 人在线
          </div>
        </div>
        <button
          onClick={onClose}
          className="chat-panel-close-btn"
        >
          ×
        </button>
      </div>

      {/* 消息列表 */}
      <div className="chat-panel-messages">
        {loading ? (
          <div className="chat-panel-loading">
            加载中...
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-panel-empty">
            暂无消息
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.user.id === user.id;
            return (
              <div
                key={message.id}
                className={`chat-panel-message ${isOwn ? "chat-panel-message-own" : "chat-panel-message-other"}`}
              >
                {/* 回复的消息预览 */}
                {message.reply_to_message && message.reply_to_message.user && (
                  <div className="chat-panel-message-reply">
                    回复 {getUserDisplayName(message.reply_to_message.user)}:{" "}
                    {message.reply_to_message.message?.substring(0, 50)}
                    {message.reply_to_message.message?.length > 50 ? "..." : ""}
                  </div>
                )}

                <div
                  className={`chat-panel-message-content-wrapper ${isOwn ? "chat-panel-message-content-wrapper-own" : "chat-panel-message-content-wrapper-other"}`}
                >
                  {/* 用户头像 */}
                  <div className="chat-panel-message-avatar">
                    {message.user.avatar ? (
                      <img src={message.user.avatar} alt="" className="chat-panel-avatar-img" />
                    ) : (
                      <div
                        className="chat-panel-avatar-placeholder"
                        style={{ backgroundColor: getUserColor(message.user.id) }}
                      >
                        {getUserDisplayName(message.user)
                          .substring(0, 1)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* 消息内容 */}
                  <div
                    className={`chat-panel-message-body ${isOwn ? "chat-panel-message-body-own" : "chat-panel-message-body-other"}`}
                  >
                    {/* 用户名称和时间 */}
                    <div className="chat-panel-message-meta">
                      {isOwn ? "我" : getUserDisplayName(message.user)} · {formatTime(message.created_at)}
                    </div>

                    {/* 消息内容 */}
                    <div
                      className={`chat-panel-message-bubble ${isOwn ? "chat-panel-message-bubble-own" : "chat-panel-message-bubble-other"}`}
                    >
                      {message.message_type === "file" ? (
                        <div>
                          <div className="chat-panel-message-file">📎 {message.file_name || message.message}</div>
                          <div className="chat-panel-message-file-size">
                            {formatFileSize(message.file_size)}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadChatFile(message.id, message.file_name);
                            }}
                            className="chat-panel-message-download-btn"
                          >
                            下载文件
                          </button>
                        </div>
                      ) : (
                        <div className="chat-panel-message-text">{message.message}</div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    {isOwn && (
                      <div className="chat-panel-message-actions">
                        <button
                          onClick={() => deleteMessage(message.id)}
                          className="chat-panel-message-delete-btn"
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 回复提示 */}
      {replyingTo && (
        <div className="chat-panel-reply-preview">
          <div className="chat-panel-reply-preview-text">
            回复 {getUserDisplayName(replyingTo.user)}:{" "}
            {replyingTo.message?.substring(0, 30)}
            {replyingTo.message?.length > 30 ? "..." : ""}
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="chat-panel-reply-preview-close"
          >
            ×
          </button>
        </div>
      )}

      {/* 输入区域 */}
      <div className="chat-panel-input">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="chat-panel-input-form">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息... (Shift+Enter换行)"
            disabled={sending}
            className="chat-panel-textarea"
            rows={1}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="chat-panel-send-btn"
          >
            {sending ? "..." : "发送"}
          </button>
        </form>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
      </div>
    </div>
  );
};

export default ChatPanel;

