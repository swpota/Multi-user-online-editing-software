import React, { useState, useEffect } from "react";
import api from "../api";
import "../styles/components/NotificationsPanel.css";

const NotificationsPanel = ({ user, onClose, socket }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState("all"); // all, unread, comment, task, mention
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);

  // 获取通知列表
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = { limit: 50 };
      if (filter !== "all") {
        if (filter === "unread") {
          params.isRead = false;
        } else {
          params.type = filter;
        }
      }
      const response = await api.get("/notifications", { params });
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error("获取通知失败", error);
    } finally {
      setLoading(false);
    }
  };

  // 获取未读通知数量
  const fetchUnreadCount = async () => {
    try {
      const response = await api.get("/notifications/unread-count");
      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error("获取未读通知数量失败", error);
    }
  };

  // 获取通知设置
  const fetchSettings = async () => {
    try {
      const response = await api.get("/notification-settings");
      setSettings(response.data);
    } catch (error) {
      console.error("获取通知设置失败", error);
    }
  };

  // 标记通知为已读
  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("标记通知为已读失败", error);
    }
  };

  // 标记所有通知为已读
  const markAllAsRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("标记所有通知为已读失败", error);
    }
  };

  // 删除通知
  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      // 如果删除的是未读通知，更新未读数量
      const notification = notifications.find((n) => n.id === notificationId);
      if (notification && !notification.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("删除通知失败", error);
    }
  };

  // 更新通知设置
  const updateSettings = async (updates) => {
    try {
      const response = await api.put("/notification-settings", updates);
      setSettings(response.data);
    } catch (error) {
      console.error("更新通知设置失败", error);
    }
  };

  // 获取通知类型图标
  const getNotificationIcon = (type) => {
    switch (type) {
      case "comment":
      case "comment_reply":
        return "💬";
      case "task":
      case "task_assigned":
      case "task_completed":
        return "📋";
      case "mention":
        return "@";
      case "document_shared":
        return "🔗";
      case "document_updated":
        return "✏️";
      default:
        return "🔔";
    }
  };

  // 格式化时间
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  // 处理通知点击
  const handleNotificationClick = async (notification) => {
    // 标记为已读
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // 根据通知类型跳转
    if (notification.resource_type === "document" && notification.resource_id) {
      window.location.href = `/documents/${notification.resource_id}`;
    } else if (notification.resource_type === "comment" && notification.metadata?.documentId) {
      window.location.href = `/documents/${notification.metadata.documentId}`;
    } else if (notification.resource_type === "task" && notification.metadata?.documentId) {
      window.location.href = `/documents/${notification.metadata.documentId}`;
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    fetchSettings();

    // 监听 Socket.IO 事件
    if (socket) {
      const handleNewNotification = (data) => {
        fetchNotifications();
        fetchUnreadCount();
      };

      const handleNotificationRead = (data) => {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === data.notificationId
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      };

      const handleAllNotificationsRead = () => {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
      };

      const handleNotificationDeleted = (data) => {
        setNotifications((prev) => prev.filter((n) => n.id !== data.notificationId));
      };

      socket.on("newNotification", handleNewNotification);
      socket.on("notificationRead", handleNotificationRead);
      socket.on("allNotificationsRead", handleAllNotificationsRead);
      socket.on("notificationDeleted", handleNotificationDeleted);

      return () => {
        socket.off("newNotification", handleNewNotification);
        socket.off("notificationRead", handleNotificationRead);
        socket.off("allNotificationsRead", handleAllNotificationsRead);
        socket.off("notificationDeleted", handleNotificationDeleted);
      };
    }
  }, [socket, filter]);

  // 当筛选条件改变时重新获取通知
  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  return (
    <div className="notifications-panel">
      {/* 头部 */}
      <div className="notifications-panel-header">
        <div className="notifications-panel-header-left">
          <h3 className="notifications-panel-title">
            🔔 通知
          </h3>
          {unreadCount > 0 && (
            <span className="notifications-panel-badge">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="notifications-panel-header-actions">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`notifications-panel-settings-btn ${showSettings ? "notifications-panel-settings-btn-active" : ""}`}
            title="通知设置"
          >
            ⚙️
          </button>
          <button
            onClick={onClose}
            className="notifications-panel-close-btn"
          >
            ×
          </button>
        </div>
      </div>

      {/* 通知设置 */}
      {showSettings && settings && (
        <div className="notifications-panel-settings">
          <h4 className="notifications-panel-settings-title">通知设置</h4>
          <div className="notifications-panel-settings-list">
            <label className="notifications-panel-settings-item">
              <input
                type="checkbox"
                checked={settings.comment_notifications}
                onChange={(e) =>
                  updateSettings({ comment_notifications: e.target.checked })
                }
              />
              评论通知
            </label>
            <label className="notifications-panel-settings-item">
              <input
                type="checkbox"
                checked={settings.task_notifications}
                onChange={(e) =>
                  updateSettings({ task_notifications: e.target.checked })
                }
              />
              任务通知
            </label>
            <label className="notifications-panel-settings-item">
              <input
                type="checkbox"
                checked={settings.mention_notifications}
                onChange={(e) =>
                  updateSettings({ mention_notifications: e.target.checked })
                }
              />
              提及通知
            </label>
            <label className="notifications-panel-settings-item">
              <input
                type="checkbox"
                checked={settings.document_shared_notifications}
                onChange={(e) =>
                  updateSettings({ document_shared_notifications: e.target.checked })
                }
              />
              文档共享通知
            </label>
            <label className="notifications-panel-settings-item">
              <input
                type="checkbox"
                checked={settings.document_updated_notifications}
                onChange={(e) =>
                  updateSettings({ document_updated_notifications: e.target.checked })
                }
              />
              文档更新通知
            </label>
          </div>
        </div>
      )}

      {/* 筛选和操作 */}
      <div className="notifications-panel-filters">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="notifications-panel-filter-select"
        >
          <option value="all">全部</option>
          <option value="unread">未读</option>
          <option value="comment">评论</option>
          <option value="task">任务</option>
          <option value="mention">提及</option>
        </select>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="notifications-panel-mark-all-read-btn"
          >
            全部标记为已读
          </button>
        )}
      </div>

      {/* 通知列表 */}
      <div className="notifications-panel-body">
        {loading ? (
          <div className="notifications-panel-loading">
            加载中...
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-panel-empty">
            暂无通知
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`notifications-panel-item ${!notification.is_read ? "notifications-panel-item-unread" : ""}`}
            >
              <div className="notifications-panel-item-content">
                <div className="notifications-panel-item-main">
                  <div className="notifications-panel-item-header">
                    <span className="notifications-panel-item-icon">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <span
                      className={`notifications-panel-item-title ${!notification.is_read ? "notifications-panel-item-title-unread" : ""}`}
                    >
                      {notification.title}
                    </span>
                  </div>
                  {notification.content && (
                    <div className="notifications-panel-item-content-text">
                      {notification.content}
                    </div>
                  )}
                  <div className="notifications-panel-item-time">
                    {formatTime(notification.created_at)}
                  </div>
                </div>
                <div className="notifications-panel-item-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    className="notifications-panel-item-delete-btn"
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;

