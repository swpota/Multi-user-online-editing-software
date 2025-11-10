import React, { useState, useEffect } from "react";
import api from "../api";
import "../styles/components/CommentsPanel.css";

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
    <div className="comments-panel">
      {/* 头部 */}
      <div className="comments-panel-header">
        <h3 className="comments-panel-title">
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
          className="comments-panel-close-btn"
          title="关闭评论面板"
        >
          ×
        </button>
      </div>

      {/* 创建评论区域 */}
      {selectedText && selectedText.text && selectedText.text.trim() && (
        <div className="comments-panel-create-section">
          <div className="comments-panel-selected-text">
            选中文本: "{selectedText.text.substring(0, 50)}
            {selectedText.text.length > 50 ? "..." : ""}"
          </div>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="添加评论..."
            className="comments-panel-textarea"
          />
          <div className="comments-panel-create-actions">
            <button
              onClick={handleCreateComment}
              disabled={creating || !newComment.trim()}
              className="comments-panel-create-btn"
            >
              {creating ? "创建中..." : "添加评论"}
            </button>
            <button
              onClick={() => {
                setNewComment("");
                onSelectText(null);
              }}
              className="comments-panel-cancel-btn"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 评论列表 */}
      <div className="comments-panel-body">
        {comments.length === 0 ? (
          <div className="comments-panel-empty">
            暂无评论
            <br />
            <span className="comments-panel-empty-hint">
              选中文本后可以添加评论
            </span>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`comments-panel-item ${comment.isResolved ? "comments-panel-item-resolved" : ""}`}
            >
              {/* 评论头部 */}
              <div className="comments-panel-item-header">
                <div>
                  <div className="comments-panel-item-author">
                    {getUserDisplayName(comment.author)}
                  </div>
                  <div className="comments-panel-item-time">
                    {formatDate(comment.createdAt)}
                  </div>
                </div>
                <div className="comments-panel-item-actions">
                  {comment.author?.id === user?.id && (
                    <button
                      onClick={() => handleDelete(comment.id, false)}
                      className="comments-panel-item-delete-btn"
                    >
                      删除
                    </button>
                  )}
                  <button
                    onClick={() =>
                      handleResolve(comment.id, !comment.isResolved)
                    }
                    disabled={creating}
                    className={`comments-panel-item-resolve-btn ${comment.isResolved ? "comments-panel-item-resolve-btn-resolved" : "comments-panel-item-resolve-btn-unresolved"}`}
                  >
                    {creating ? "处理中..." : comment.isResolved ? "已解决" : "解决"}
                  </button>
                </div>
              </div>

              {/* 评论内容 */}
              <div className="comments-panel-item-content">
                {comment.content}
              </div>

              {/* 锚点文本 */}
              {comment.anchorText && (
                <div className="comments-panel-item-anchor">
                  "{comment.anchorText}"
                </div>
              )}

              {/* 回复按钮 */}
              <button
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="comments-panel-item-reply-btn"
              >
                {replyingTo === comment.id ? "取消回复" : "回复"}
              </button>

              {/* 回复输入框 */}
              {replyingTo === comment.id && (
                <div className="comments-panel-reply-section">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="输入回复..."
                    className="comments-panel-reply-textarea"
                  />
                  <div className="comments-panel-reply-actions">
                    <button
                      onClick={() => handleReply(comment.id)}
                      disabled={creating || !replyContent.trim()}
                      className="comments-panel-reply-send-btn"
                    >
                      发送
                    </button>
                    <button
                      onClick={() => {
                        setReplyContent("");
                        setReplyingTo(null);
                      }}
                      className="comments-panel-reply-cancel-btn"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* 回复列表 */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="comments-panel-replies">
                  {comment.replies
                    .filter((reply, index, self) => 
                      // 过滤重复的回复：只保留第一个出现的
                      self.findIndex(r => r.id === reply.id) === index
                    )
                    .map((reply, index) => (
                      <div
                        key={`reply-${comment.id}-${reply.id}-${index}`}
                        className="comments-panel-reply-item"
                      >
                      <div className="comments-panel-reply-item-header">
                        <div>
                          <span className="comments-panel-reply-item-author">
                            {getUserDisplayName(reply.author)}
                          </span>
                          <span className="comments-panel-reply-item-time">
                            {formatDate(reply.createdAt)}
                          </span>
                        </div>
                        {reply.author?.id === user?.id && (
                          <button
                            onClick={() => handleDelete(reply.id, true)}
                            className="comments-panel-reply-item-delete-btn"
                          >
                            删除
                          </button>
                        )}
                      </div>
                      <div className="comments-panel-reply-item-content">
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

