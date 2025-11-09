import React, { useState, useEffect, useRef } from "react";
import api from "../api";

const ChatPanel = ({ documentId, user, socket, onlineUsers = [], onClose }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        width: "400px",
        height: "500px",
        backgroundColor: "white",
        border: "1px solid #ddd",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 头部 */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#fafafa",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
              color: "#333",
            }}
          >
            💬 聊天
          </h3>
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginTop: "4px",
            }}
          >
            {onlineUsers.length} 人在线
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: "6px 12px",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
            fontSize: "20px",
            color: "#666",
            borderRadius: "4px",
            transition: "all 0.2s",
            lineHeight: "1",
            fontWeight: "bold",
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "#f5f5f5";
            e.target.style.color = "#ff4d4f";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "transparent";
            e.target.style.color = "#666";
          }}
        >
          ×
        </button>
      </div>

      {/* 消息列表 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px",
          backgroundColor: "#f9f9f9",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", color: "#999", padding: "20px" }}>
            加载中...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#999", padding: "20px" }}>
            暂无消息
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              style={{
                marginBottom: "12px",
                display: "flex",
                flexDirection: "column",
                alignItems: message.user.id === user.id ? "flex-end" : "flex-start",
              }}
            >
              {/* 回复的消息预览 */}
              {message.reply_to_message && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#999",
                    padding: "4px 8px",
                    backgroundColor: "#f0f0f0",
                    borderRadius: "4px",
                    marginBottom: "4px",
                    maxWidth: "80%",
                  }}
                >
                  回复 {getUserDisplayName(message.reply_to_message.user)}:{" "}
                  {message.reply_to_message.message?.substring(0, 50)}
                  {message.reply_to_message.message?.length > 50 ? "..." : ""}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  maxWidth: "80%",
                  flexDirection: message.user.id === user.id ? "row-reverse" : "row",
                }}
              >
                {/* 用户头像 */}
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: getUserColor(message.user.id),
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: "bold",
                    flexShrink: 0,
                  }}
                >
                  {getUserDisplayName(message.user)
                    .substring(0, 1)
                    .toUpperCase()}
                </div>

                {/* 消息内容 */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: message.user.id === user.id ? "flex-end" : "flex-start",
                  }}
                >
                  {/* 用户名称和时间 */}
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#999",
                      marginBottom: "4px",
                    }}
                  >
                    {message.user.id === user.id
                      ? "我"
                      : getUserDisplayName(message.user)}{" "}
                    · {formatTime(message.created_at)}
                  </div>

                  {/* 消息内容 */}
                  <div
                    style={{
                      padding: "8px 12px",
                      backgroundColor:
                        message.user.id === user.id ? "#1890ff" : "white",
                      color: message.user.id === user.id ? "white" : "#333",
                      borderRadius: "12px",
                      border:
                        message.user.id === user.id
                          ? "none"
                          : "1px solid #eee",
                      wordBreak: "break-word",
                    }}
                  >
                    {message.message_type === "file" ? (
                      <div>
                        <div style={{ marginBottom: "4px" }}>📎 {message.file_name || message.message}</div>
                        <div style={{ fontSize: "12px", opacity: 0.8 }}>
                          {formatFileSize(message.file_size)}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/api/chat-messages/${message.id}/download`, "_blank");
                          }}
                          style={{
                            color: message.user.id === user.id ? "white" : "#1890ff",
                            textDecoration: "underline",
                            fontSize: "12px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            marginTop: "4px",
                          }}
                        >
                          下载文件
                        </button>
                      </div>
                    ) : (
                      <div style={{ whiteSpace: "pre-wrap" }}>{message.message}</div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  {message.user.id === user.id && (
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginTop: "4px",
                        fontSize: "12px",
                      }}
                    >
                      <button
                        onClick={() => deleteMessage(message.id)}
                        style={{
                          padding: "2px 6px",
                          border: "none",
                          backgroundColor: "transparent",
                          cursor: "pointer",
                          color: "#ff4d4f",
                          fontSize: "12px",
                        }}
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 回复提示 */}
      {replyingTo && (
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "#e6f7ff",
            borderTop: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "12px", color: "#666" }}>
            回复 {getUserDisplayName(replyingTo.user)}:{" "}
            {replyingTo.message?.substring(0, 30)}
            {replyingTo.message?.length > 30 ? "..." : ""}
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            style={{
              padding: "2px 6px",
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* 输入区域 */}
      <div
        style={{
          padding: "12px",
          borderTop: "1px solid #eee",
          backgroundColor: "white",
        }}
      >
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "6px 12px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              backgroundColor: "white",
              cursor: "pointer",
              fontSize: "14px",
            }}
            disabled={sending}
          >
            📎 文件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            disabled={sending}
            style={{
              flex: 1,
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              resize: "none",
              minHeight: "60px",
              maxHeight: "120px",
              fontSize: "14px",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              backgroundColor:
                !newMessage.trim() || sending ? "#d9d9d9" : "#1890ff",
              color: "white",
              cursor: !newMessage.trim() || sending ? "not-allowed" : "pointer",
              fontSize: "14px",
            }}
          >
            {sending ? "发送中..." : "发送"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;

