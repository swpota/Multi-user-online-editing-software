/**
 * EditorSidebar 编辑器侧边栏组件
 * 提供评论、任务、聊天、文件、通知、视频会议的切换面板
 */
import React from "react";
import CommentsPanel from "../CommentsPanel";
import TasksPanel from "../TasksPanel";
import ChatPanel from "../ChatPanel";
import FilePanel from "../FilePanel";
import NotificationsPanel from "../NotificationsPanel";
import VideoConferencePanel from "../VideoConferencePanel";
import "../../styles/components/editor/EditorSidebar.css";

function EditorSidebar({
  activePanel,
  onPanelChange,
  documentId,
  user,
  isEditor,
  featureSettings = {},
}) {
  const panels = [
    {
      id: "comments",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      label: "评论",
      enabled: featureSettings.enable_comments,
      component: CommentsPanel,
    },
    {
      id: "tasks",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
      label: "任务",
      enabled: featureSettings.enable_tasks,
      component: TasksPanel,
    },
    {
      id: "chat",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
      label: "聊天",
      enabled: featureSettings.enable_chat,
      component: ChatPanel,
    },
    {
      id: "files",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
      ),
      label: "文件",
      enabled: true,
      component: FilePanel,
    },
    {
      id: "notifications",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      label: "通知",
      enabled: featureSettings.enable_notifications,
      component: NotificationsPanel,
    },
    {
      id: "video",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      ),
      label: "视频",
      enabled: featureSettings.enable_video_conference,
      component: VideoConferencePanel,
    },
  ];

  const enabledPanels = panels.filter((p) => p.enabled !== false);
  const currentPanel = panels.find((p) => p.id === activePanel);

  return (
    <div className={`editor-sidebar ${activePanel ? "open" : ""}`}>
      {/* 侧边栏切换按钮 */}
      <div className="sidebar-tabs">
        {enabledPanels.map((panel) => (
          <button
            key={panel.id}
            className={`sidebar-tab ${activePanel === panel.id ? "active" : ""}`}
            onClick={() => onPanelChange(activePanel === panel.id ? null : panel.id)}
            title={panel.label}
          >
            {panel.icon}
            <span className="sidebar-tab-label">{panel.label}</span>
          </button>
        ))}
      </div>

      {/* 侧边栏内容 */}
      {activePanel && currentPanel && (
        <div className="sidebar-content">
          <div className="sidebar-header">
            <h3>{currentPanel.label}</h3>
            <button
              className="sidebar-close"
              onClick={() => onPanelChange(null)}
              aria-label="关闭"
            >
              ×
            </button>
          </div>
          <div className="sidebar-body">
            <currentPanel.component
              documentId={documentId}
              user={user}
              isEditor={isEditor}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default EditorSidebar;
