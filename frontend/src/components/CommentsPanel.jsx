import React, { useState, useEffect } from "react";
import api from "../api";

const CommentsPanel = ({
  documentId,
  user,
  comments,
  onCommentCreated,
  onCommentUpdated,
  onCommentDeleted,
  onCommentResolved,
  selectedText,
  onSelectText,
  onClose,
}) => {
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateComment = async () => {
    if (!newComment.trim() || !selectedText) {
      alert("请先选择要评论的文本");
      return;
    }

    setCreating(true);
    try {
      const response = await api.post(`/documents/${documentId}/comments`, {
        content: newComment.trim(),
        anchorText: selectedText.text,
        anchorIndex: selectedText.index,
        anchorLength: selectedText.length,
        selectionRange: {
          index: selectedText.index,
          length: selectedText.length,
        },
      });

      setNewComment("");
      if (onSelectText) {
        onSelectText(null);
      }
      // 不调用 onCommentCreated，因为 Socket.IO 的 newComment 事件会实时更新
      // 如果同时调用回调，会导致评论重复显示
    } catch (error) {
      console.error("创建评论失败", error);
      alert(error.response?.data?.message || "创建评论失败");
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async (parentId) => {
    if (!replyContent.trim()) {
      return;
    }

    setCreating(true);
    try {
      const response = await api.post(`/documents/${documentId}/comments`, {
        content: replyContent.trim(),
        parentId,
      });

      setReplyContent("");
      setReplyingTo(null);
      // 不调用 onCommentCreated，因为 Socket.IO 的 newComment 事件会实时更新
      // 如果同时调用回调，会导致回复重复显示
    } catch (error) {
      console.error("回复评论失败", error);
      alert(error.response?.data?.message || "回复失败");
    } finally {
      setCreating(false);
    }
  };

  const handleResolve = async (commentId, resolved) => {
    try {
      setCreating(true); // 使用 creating 状态来防止重复点击
      const response = await api.post(
        `/comments/${commentId}/resolve`,
        { resolved }
      );
      if (onCommentResolved) {
        onCommentResolved(response.data);
      }
    } catch (error) {
      console.error("解决/取消解决评论失败", error);
      alert(error.response?.data?.message || "操作失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (commentId, isReply = false) => {
    const message = isReply ? "确定要删除这条回复吗？" : "确定要删除这条评论吗？";
    if (!window.confirm(message)) {
      return;
    }

    try {
      await api.delete(`/comments/${commentId}`);
      if (onCommentDeleted) {
        onCommentDeleted(commentId);
      }
    } catch (error) {
      console.error("删除评论失败", error);
      alert(error.response?.data?.message || "删除失败");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      console.warn("formatDate: dateString is empty", dateString);
      return "未知时间";
    }
    try {
      // 处理多种可能的日期格式
      let date;
      if (dateString instanceof Date) {
        date = dateString;
      } else if (typeof dateString === 'string') {
        date = new Date(dateString);
      } else if (dateString && typeof dateString === 'object' && dateString.toISOString) {
        // 如果已经是 Date 对象
        date = dateString;
      } else {
        console.warn("formatDate: unexpected date format", typeof dateString, dateString);
        return "未知时间";
      }
      
      if (isNaN(date.getTime())) {
        console.warn("formatDate: invalid date", dateString);
        return "未知时间";
      }
      
      return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("formatDate error:", error, dateString);
      return "未知时间";
    }
  };

  const getUserDisplayName = (author) => {
    return author?.full_name || author?.email || author?.phone || `用户${author?.id}`;
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        width: "400px",
        height: "100vh",
        backgroundColor: "#fff",
        borderLeft: "1px solid #e8e8e8",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        boxShadow: "-2px 0 8px rgba(0,0,0,0.1)",
      }}
    >
      {/* 头部 */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #e8e8e8",
          backgroundColor: "#fafafa",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 600,
            color: "#333",
          }}
        >
          💬 评论 ({comments.length})
        </h3>
        <button
          onClick={() => {
            if (onSelectText) {
              onSelectText(null);
            }
            if (onClose) {
              onClose();
            }
          }}
          style={{
            padding: "6px 12px",
            fontSize: "20px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#666",
            borderRadius: "4px",
            transition: "all 0.2s",
            lineHeight: "1",
            fontWeight: "bold",
          }}
          title="关闭评论面板"
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

      {/* 创建评论区域 */}
      {selectedText && selectedText.text && selectedText.text.trim() && (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e8e8e8",
            backgroundColor: "#f0f7ff",
          }}
        >
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
            选中文本: "{selectedText.text.substring(0, 50)}
            {selectedText.text.length > 50 ? "..." : ""}"
          </div>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="添加评论..."
            style={{
              width: "100%",
              minHeight: "60px",
              padding: "8px",
              border: "1px solid #d9d9d9",
              borderRadius: "4px",
              fontSize: "14px",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button
              onClick={handleCreateComment}
              disabled={creating || !newComment.trim()}
              style={{
                padding: "6px 16px",
                backgroundColor: "#1890ff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: creating ? "not-allowed" : "pointer",
                fontSize: "13px",
              }}
            >
              {creating ? "创建中..." : "添加评论"}
            </button>
            <button
              onClick={() => {
                setNewComment("");
                onSelectText(null);
              }}
              style={{
                padding: "6px 16px",
                backgroundColor: "#fff",
                color: "#666",
                border: "1px solid #d9d9d9",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 评论列表 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
        }}
      >
        {comments.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#999",
              padding: "40px 20px",
            }}
          >
            暂无评论
            <br />
            <span style={{ fontSize: "12px" }}>
              选中文本后可以添加评论
            </span>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              style={{
                marginBottom: "16px",
                padding: "12px",
                backgroundColor: comment.isResolved ? "#f5f5f5" : "#fff",
                border: "1px solid #e8e8e8",
                borderRadius: "6px",
                opacity: comment.isResolved ? 0.7 : 1,
              }}
            >
              {/* 评论头部 */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "8px",
                }}
              >
                <div>
                  <div style={{ fontWeight: "600", fontSize: "14px" }}>
                    {getUserDisplayName(comment.author)}
                  </div>
                  <div style={{ fontSize: "12px", color: "#999" }}>
                    {formatDate(comment.createdAt)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {comment.author?.id === user?.id && (
                    <button
                      onClick={() => handleDelete(comment.id, false)}
                      style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        backgroundColor: "transparent",
                        border: "none",
                        color: "#ff4d4f",
                        cursor: "pointer",
                      }}
                    >
                      删除
                    </button>
                  )}
                  <button
                    onClick={() =>
                      handleResolve(comment.id, !comment.isResolved)
                    }
                    disabled={creating}
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      backgroundColor: "transparent",
                      border: "none",
                      color: comment.isResolved ? "#52c41a" : "#1890ff",
                      cursor: creating ? "not-allowed" : "pointer",
                      opacity: creating ? 0.6 : 1,
                    }}
                  >
                    {creating ? "处理中..." : comment.isResolved ? "已解决" : "解决"}
                  </button>
                </div>
              </div>

              {/* 评论内容 */}
              <div
                style={{
                  fontSize: "14px",
                  lineHeight: "1.6",
                  marginBottom: "8px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {comment.content}
              </div>

              {/* 锚点文本 */}
              {comment.anchorText && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    padding: "8px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "4px",
                    marginBottom: "8px",
                    fontStyle: "italic",
                  }}
                >
                  "{comment.anchorText}"
                </div>
              )}

              {/* 回复按钮 */}
              <button
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                style={{
                  padding: "4px 8px",
                  fontSize: "12px",
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#1890ff",
                  cursor: "pointer",
                }}
              >
                {replyingTo === comment.id ? "取消回复" : "回复"}
              </button>

              {/* 回复输入框 */}
              {replyingTo === comment.id && (
                <div style={{ marginTop: "8px" }}>
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="输入回复..."
                    style={{
                      width: "100%",
                      minHeight: "50px",
                      padding: "6px",
                      border: "1px solid #d9d9d9",
                      borderRadius: "4px",
                      fontSize: "13px",
                      resize: "vertical",
                    }}
                  />
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                    <button
                      onClick={() => handleReply(comment.id)}
                      disabled={creating || !replyContent.trim()}
                      style={{
                        padding: "4px 12px",
                        backgroundColor: "#1890ff",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: creating ? "not-allowed" : "pointer",
                        fontSize: "12px",
                      }}
                    >
                      发送
                    </button>
                    <button
                      onClick={() => {
                        setReplyContent("");
                        setReplyingTo(null);
                      }}
                      style={{
                        padding: "4px 12px",
                        backgroundColor: "#fff",
                        color: "#666",
                        border: "1px solid #d9d9d9",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* 回复列表 */}
              {comment.replies && comment.replies.length > 0 && (
                <div style={{ marginTop: "12px", paddingLeft: "16px", borderLeft: "2px solid #e8e8e8" }}>
                  {comment.replies
                    .filter((reply, index, self) => 
                      // 过滤重复的回复：只保留第一个出现的
                      self.findIndex(r => r.id === reply.id) === index
                    )
                    .map((reply, index) => (
                      <div
                        key={`reply-${comment.id}-${reply.id}-${index}`}
                        style={{
                          marginBottom: "8px",
                          padding: "8px",
                          backgroundColor: "#fafafa",
                          borderRadius: "4px",
                        }}
                      >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <div>
                          <span style={{ fontWeight: "600", fontSize: "13px" }}>
                            {getUserDisplayName(reply.author)}
                          </span>
                          <span style={{ fontSize: "11px", color: "#999", marginLeft: "8px" }}>
                            {formatDate(reply.createdAt)}
                          </span>
                        </div>
                        {reply.author?.id === user?.id && (
                          <button
                            onClick={() => handleDelete(reply.id, true)}
                            style={{
                              padding: "2px 6px",
                              fontSize: "11px",
                              backgroundColor: "transparent",
                              border: "none",
                              color: "#ff4d4f",
                              cursor: "pointer",
                            }}
                          >
                            删除
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: "13px", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                        {reply.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CommentsPanel;

