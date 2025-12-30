/**
 * 任务面板组件
 * 
 * 管理文档相关的任务，支持创建、编辑、删除和完成任务。
 * 任务可以分配给协作者，设置优先级和截止日期。
 * 任务通过Socket.io实时同步。
 * 
 * 功能特点：
 * - 可关联选中的文本创建任务
 * - 支持四种优先级：低、中、高、紧急
 * - 支持三种状态：待处理、进行中、已完成
 * - 可分配给文档协作者
 */
import React, { useState } from "react";
import api from "../api";
import "../styles/components/TasksPanel.css";

/**
 * @param {string} documentId - 文档ID
 * @param {object} user - 当前登录用户
 * @param {array} tasks - 任务列表
 * @param {function} onTaskCreated - 任务创建回调
 * @param {function} onTaskUpdated - 任务更新回调
 * @param {function} onTaskDeleted - 任务删除回调
 * @param {object} selectedText - 选中的文本信息
 * @param {function} onSelectText - 设置选中文本
 * @param {array} onlineUsers - 在线用户列表（用于分配任务）
 * @param {function} onClose - 关闭面板回调
 */
const TasksPanel = ({
  documentId,
  user,
  tasks,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
  selectedText,
  onSelectText,
  onlineUsers = [],
  onClose,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "medium",
    dueDate: "",
  });
  const [creating, setCreating] = useState(false);
  const [selectedTextState, setSelectedTextState] = useState(selectedText);

  const handleCreateTask = async () => {
    // 验证任务标题
    if (!newTask.title || !newTask.title.trim()) {
      alert("请填写任务标题");
      return;
    }
    
    // 验证任务标题长度
    if (newTask.title.trim().length < 1) {
      alert("任务标题不能为空");
      return;
    }
    
    // 验证任务标题长度（可选，防止过长）
    if (newTask.title.trim().length > 200) {
      alert("任务标题不能超过200个字符");
      return;
    }

    setCreating(true);
    try {
      const response = await api.post(`/documents/${documentId}/tasks`, {
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        assignedTo: newTask.assignedTo || null,
        anchorText: (selectedText || selectedTextState)?.text || null,
        anchorIndex: (selectedText || selectedTextState)?.index || null,
        anchorLength: (selectedText || selectedTextState)?.length || null,
        priority: newTask.priority,
        dueDate: newTask.dueDate || null,
      });

      setNewTask({
        title: "",
        description: "",
        assignedTo: "",
        priority: "medium",
        dueDate: "",
      });
      setShowCreateForm(false);
      setSelectedTextState(null);
      if (onSelectText) {
        onSelectText(null);
      }
      // 不调用 onTaskCreated，因为 Socket.IO 的 newTask 事件会实时更新
      // 如果同时调用回调，会导致任务重复显示
    } catch (error) {
      console.error("创建任务失败", error);
      alert(error.response?.data?.message || "创建任务失败");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      const response = await api.put(`/tasks/${taskId}`, updates);
      if (onTaskUpdated) {
        onTaskUpdated(response.data);
      }
    } catch (error) {
      console.error("更新任务失败", error);
      alert(error.response?.data?.message || "更新任务失败");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("确定要删除这个任务吗？")) {
      return;
    }

    try {
      await api.delete(`/tasks/${taskId}`);
      if (onTaskDeleted) {
        onTaskDeleted(taskId);
      }
    } catch (error) {
      console.error("删除任务失败", error);
      alert(error.response?.data?.message || "删除失败");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getUserDisplayName = (userObj) => {
    return userObj?.full_name || userObj?.email || userObj?.phone || `用户${userObj?.id}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "#faad14";
      case "in_progress":
        return "#1890ff";
      case "completed":
        return "#52c41a";
      case "cancelled":
        return "#999";
      default:
        return "#666";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "pending":
        return "待处理";
      case "in_progress":
        return "进行中";
      case "completed":
        return "已完成";
      case "cancelled":
        return "已取消";
      default:
        return status;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "urgent":
        return "#ff4d4f";
      case "high":
        return "#ff7a45";
      case "medium":
        return "#faad14";
      case "low":
        return "#52c41a";
      default:
        return "#666";
    }
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case "urgent":
        return "紧急";
      case "high":
        return "高";
      case "medium":
        return "中";
      case "low":
        return "低";
      default:
        return priority;
    }
  };

  // 按状态分组任务
  const tasksByStatus = {
    pending: tasks.filter((t) => t.status === "pending"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    completed: tasks.filter((t) => t.status === "completed"),
    cancelled: tasks.filter((t) => t.status === "cancelled"),
  };

  return (
    <div className="tasks-panel">
      {/* 头部 */}
      <div className="tasks-panel-header">
        <h3 className="tasks-panel-title">
          ✅ 任务 ({tasks.length})
        </h3>
        <div className="tasks-panel-header-actions">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="tasks-panel-create-btn"
          >
            {showCreateForm ? "取消" : "+ 新建任务"}
          </button>
          <button
            onClick={() => {
              if (onSelectText) {
                onSelectText(null);
              }
              if (onClose) {
                onClose();
              }
            }}
            className="tasks-panel-close-btn"
            title="关闭任务面板"
          >
            ×
          </button>
        </div>
      </div>

      {/* 创建任务表单 */}
      {showCreateForm && (
        <div className="tasks-panel-create-form">
          {(selectedText || selectedTextState) && (
            <div className="tasks-panel-selected-text">
              关联文本: "{(selectedText || selectedTextState).text.substring(0, 50)}
              {(selectedText || selectedTextState).text.length > 50 ? "..." : ""}"
            </div>
          )}
          <input
            type="text"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder="任务标题 *（必填）"
            required
            className={`tasks-panel-input ${(!newTask.title || !newTask.title.trim()) ? "tasks-panel-input-error" : ""}`}
          />
          {(!newTask.title || !newTask.title.trim()) && (
            <div className="tasks-panel-input-error-message">
              请填写任务标题
            </div>
          )}
          <textarea
            value={newTask.description}
            onChange={(e) =>
              setNewTask({ ...newTask, description: e.target.value })
            }
            placeholder="任务描述（可选）"
            className="tasks-panel-textarea"
          />
          <div className="tasks-panel-form-row">
            <select
              value={newTask.assignedTo}
              onChange={(e) =>
                setNewTask({ ...newTask, assignedTo: e.target.value })
              }
              className="tasks-panel-select"
            >
              <option value="">未分配</option>
              {onlineUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {getUserDisplayName(u)}
                </option>
              ))}
            </select>
            <select
              value={newTask.priority}
              onChange={(e) =>
                setNewTask({ ...newTask, priority: e.target.value })
              }
              className="tasks-panel-select"
            >
              <option value="low">低优先级</option>
              <option value="medium">中优先级</option>
              <option value="high">高优先级</option>
              <option value="urgent">紧急</option>
            </select>
          </div>
          <input
            type="datetime-local"
            value={newTask.dueDate}
            onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
            placeholder="截止日期（可选）"
            className="tasks-panel-date-input"
          />
          <button
            onClick={handleCreateTask}
            disabled={creating || !newTask.title || !newTask.title.trim()}
            className="tasks-panel-submit-btn"
            title={!newTask.title || !newTask.title.trim() ? "请填写任务标题" : ""}
          >
            {creating ? "创建中..." : "创建任务"}
          </button>
        </div>
      )}

      {/* 任务列表 */}
      <div className="tasks-panel-body">
        {tasks.length === 0 ? (
          <div className="tasks-panel-empty">
            暂无任务
            <br />
            <span className="tasks-panel-empty-hint">点击"新建任务"创建任务</span>
          </div>
        ) : (
          <div>
            {/* 待处理 */}
            {tasksByStatus.pending.length > 0 && (
              <div className="tasks-panel-section">
                <h4 className="tasks-panel-section-title tasks-panel-section-title-pending">
                  待处理 ({tasksByStatus.pending.length})
                </h4>
                {tasksByStatus.pending.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    user={user}
                    onlineUsers={onlineUsers}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    getUserDisplayName={getUserDisplayName}
                    getStatusColor={getStatusColor}
                    getStatusText={getStatusText}
                    getPriorityColor={getPriorityColor}
                    getPriorityText={getPriorityText}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            )}

            {/* 进行中 */}
            {tasksByStatus.in_progress.length > 0 && (
              <div className="tasks-panel-section">
                <h4 className="tasks-panel-section-title tasks-panel-section-title-in-progress">
                  进行中 ({tasksByStatus.in_progress.length})
                </h4>
                {tasksByStatus.in_progress.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    user={user}
                    onlineUsers={onlineUsers}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    getUserDisplayName={getUserDisplayName}
                    getStatusColor={getStatusColor}
                    getStatusText={getStatusText}
                    getPriorityColor={getPriorityColor}
                    getPriorityText={getPriorityText}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            )}

            {/* 已完成 */}
            {tasksByStatus.completed.length > 0 && (
              <div className="tasks-panel-section">
                <h4 className="tasks-panel-section-title tasks-panel-section-title-completed">
                  已完成 ({tasksByStatus.completed.length})
                </h4>
                {tasksByStatus.completed.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    user={user}
                    onlineUsers={onlineUsers}
                    onUpdate={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    getUserDisplayName={getUserDisplayName}
                    getStatusColor={getStatusColor}
                    getStatusText={getStatusText}
                    getPriorityColor={getPriorityColor}
                    getPriorityText={getPriorityText}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// 任务项组件
const TaskItem = ({
  task,
  user,
  onlineUsers,
  onUpdate,
  onDelete,
  getUserDisplayName,
  getStatusColor,
  getStatusText,
  getPriorityColor,
  getPriorityText,
  formatDate,
}) => {
  const canEdit =
    task.createdBy?.id === user?.id ||
    task.assignedTo?.id === user?.id ||
    user?.role === "admin";

  return (
    <div className={`tasks-panel-item ${task.status === "completed" ? "tasks-panel-item-completed" : ""}`}>
      <div className="tasks-panel-item-header">
        <div className="tasks-panel-item-main">
          <div className="tasks-panel-item-title">
            {task.title}
          </div>
          {task.description && (
            <div className="tasks-panel-item-description">
              {task.description}
            </div>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => onDelete(task.id)}
            className="tasks-panel-item-delete-btn"
          >
            删除
          </button>
        )}
      </div>

      <div className="tasks-panel-item-tags">
        <span
          className="tasks-panel-status-badge"
          style={{ backgroundColor: getStatusColor(task.status) }}
        >
          {getStatusText(task.status)}
        </span>
        <span
          className="tasks-panel-priority-badge"
          style={{ backgroundColor: getPriorityColor(task.priority) }}
        >
          {getPriorityText(task.priority)}
        </span>
        {task.assignedTo && (
          <span className="tasks-panel-item-meta">
            分配给: {getUserDisplayName(task.assignedTo)}
          </span>
        )}
        {task.dueDate && (
          <span className="tasks-panel-item-meta">
            截止: {formatDate(task.dueDate)}
          </span>
        )}
      </div>

      {canEdit && task.status !== "completed" && (
        <div className="tasks-panel-item-actions">
          <select
            value={task.status}
            onChange={(e) => onUpdate(task.id, { status: e.target.value })}
            className="tasks-panel-item-select"
          >
            <option value="pending">待处理</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
          {task.assignedTo && (
            <select
              value={task.assignedTo.id}
              onChange={(e) => onUpdate(task.id, { assignedTo: e.target.value || null })}
              className="tasks-panel-item-select"
            >
              <option value="">未分配</option>
              {onlineUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {getUserDisplayName(u)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {task.status === "completed" && task.completedBy && (
        <div className="tasks-panel-item-completed-info">
          完成于: {formatDate(task.completedAt)} by {getUserDisplayName(task.completedBy)}
        </div>
      )}
    </div>
  );
};

export default TasksPanel;

