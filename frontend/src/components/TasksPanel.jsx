import React, { useState } from "react";
import api from "../api";

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
          ✅ 任务 ({tasks.length})
        </h3>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: "6px 16px",
              backgroundColor: "#1890ff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#40a9ff";
              e.target.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#1890ff";
              e.target.style.transform = "translateY(0)";
            }}
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
            title="关闭任务面板"
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
      </div>

      {/* 创建任务表单 */}
      {showCreateForm && (
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid #e8e8e8",
            backgroundColor: "#f0f7ff",
          }}
        >
          {(selectedText || selectedTextState) && (
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
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
            style={{
              width: "100%",
              padding: "8px",
              border: (!newTask.title || !newTask.title.trim()) ? "1px solid #ff4d4f" : "1px solid #d9d9d9",
              borderRadius: "4px",
              fontSize: "14px",
              marginBottom: "4px",
            }}
          />
          {(!newTask.title || !newTask.title.trim()) && (
            <div style={{ 
              fontSize: "12px", 
              color: "#ff4d4f", 
              marginBottom: "8px" 
            }}>
              请填写任务标题
            </div>
          )}
          <textarea
            value={newTask.description}
            onChange={(e) =>
              setNewTask({ ...newTask, description: e.target.value })
            }
            placeholder="任务描述（可选）"
            style={{
              width: "100%",
              minHeight: "60px",
              padding: "8px",
              border: "1px solid #d9d9d9",
              borderRadius: "4px",
              fontSize: "14px",
              resize: "vertical",
              marginBottom: "8px",
            }}
          />
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <select
              value={newTask.assignedTo}
              onChange={(e) =>
                setNewTask({ ...newTask, assignedTo: e.target.value })
              }
              style={{
                flex: 1,
                padding: "6px",
                border: "1px solid #d9d9d9",
                borderRadius: "4px",
                fontSize: "13px",
              }}
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
              style={{
                flex: 1,
                padding: "6px",
                border: "1px solid #d9d9d9",
                borderRadius: "4px",
                fontSize: "13px",
              }}
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
            style={{
              width: "100%",
              padding: "6px",
              border: "1px solid #d9d9d9",
              borderRadius: "4px",
              fontSize: "13px",
              marginBottom: "8px",
            }}
          />
          <button
            onClick={handleCreateTask}
            disabled={creating || !newTask.title || !newTask.title.trim()}
            style={{
              width: "100%",
              padding: "8px",
              backgroundColor: (creating || !newTask.title || !newTask.title.trim()) ? "#ccc" : "#1890ff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: (creating || !newTask.title || !newTask.title.trim()) ? "not-allowed" : "pointer",
              fontSize: "14px",
            }}
            title={!newTask.title || !newTask.title.trim() ? "请填写任务标题" : ""}
          >
            {creating ? "创建中..." : "创建任务"}
          </button>
        </div>
      )}

      {/* 任务列表 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
        }}
      >
        {tasks.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#999",
              padding: "40px 20px",
            }}
          >
            暂无任务
            <br />
            <span style={{ fontSize: "12px" }}>点击"新建任务"创建任务</span>
          </div>
        ) : (
          <div>
            {/* 待处理 */}
            {tasksByStatus.pending.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px", color: "#faad14" }}>
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
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px", color: "#1890ff" }}>
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
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px", color: "#52c41a" }}>
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
    <div
      style={{
        marginBottom: "12px",
        padding: "12px",
        backgroundColor: task.status === "completed" ? "#f5f5f5" : "#fff",
        border: "1px solid #e8e8e8",
        borderRadius: "6px",
        opacity: task.status === "completed" ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "600", fontSize: "14px", marginBottom: "4px" }}>
            {task.title}
          </div>
          {task.description && (
            <div style={{ fontSize: "13px", color: "#666", marginBottom: "4px" }}>
              {task.description}
            </div>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => onDelete(task.id)}
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
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
        <span
          style={{
            padding: "2px 8px",
            fontSize: "12px",
            backgroundColor: getStatusColor(task.status),
            color: "white",
            borderRadius: "12px",
          }}
        >
          {getStatusText(task.status)}
        </span>
        <span
          style={{
            padding: "2px 8px",
            fontSize: "12px",
            backgroundColor: getPriorityColor(task.priority),
            color: "white",
            borderRadius: "12px",
          }}
        >
          {getPriorityText(task.priority)}
        </span>
        {task.assignedTo && (
          <span style={{ fontSize: "12px", color: "#666" }}>
            分配给: {getUserDisplayName(task.assignedTo)}
          </span>
        )}
        {task.dueDate && (
          <span style={{ fontSize: "12px", color: "#666" }}>
            截止: {formatDate(task.dueDate)}
          </span>
        )}
      </div>

      {canEdit && task.status !== "completed" && (
        <div style={{ display: "flex", gap: "8px" }}>
          <select
            value={task.status}
            onChange={(e) => onUpdate(task.id, { status: e.target.value })}
            style={{
              flex: 1,
              padding: "4px",
              border: "1px solid #d9d9d9",
              borderRadius: "4px",
              fontSize: "12px",
            }}
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
              style={{
                flex: 1,
                padding: "4px",
                border: "1px solid #d9d9d9",
                borderRadius: "4px",
                fontSize: "12px",
              }}
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
        <div style={{ fontSize: "12px", color: "#999", marginTop: "8px" }}>
          完成于: {formatDate(task.completedAt)} by {getUserDisplayName(task.completedBy)}
        </div>
      )}
    </div>
  );
};

export default TasksPanel;

