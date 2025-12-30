/**
 * EditorStatusBar 编辑器状态栏组件
 * 显示字数统计、在线用户、编辑模式等信息
 */
import React from "react";
import { stringToColor } from "../../utils";
import "../../styles/components/editor/EditorStatusBar.css";

function EditorStatusBar({
  wordCount,
  onlineUsers = [],
  contentFormat,
  onFormatChange,
  isEditor,
  category,
  tags = [],
}) {
  return (
    <div className="editor-status-bar">
      <div className="status-bar-left">
        <div className="status-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>{wordCount} 字</span>
        </div>

        {category && (
          <div className="status-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>{category}</span>
          </div>
        )}

        {tags.length > 0 && (
          <div className="status-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            <span>{tags.join(", ")}</span>
          </div>
        )}
      </div>

      <div className="status-bar-right">
        {onlineUsers.length > 0 && (
          <div className="status-item online-users">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <div className="online-user-avatars">
              {onlineUsers.slice(0, 5).map((u) => (
                <div
                  key={u.userId}
                  className="user-avatar"
                  style={{ backgroundColor: stringToColor(u.userName) }}
                  title={u.userName || u.userEmail}
                >
                  {(u.userName || u.userEmail || "?")[0].toUpperCase()}
                </div>
              ))}
              {onlineUsers.length > 5 && (
                <div className="user-avatar-more">+{onlineUsers.length - 5}</div>
              )}
            </div>
          </div>
        )}

        {isEditor && (
          <div className="status-item editor-format-switch">
            <button
              className={`format-btn ${contentFormat === "rich" ? "active" : ""}`}
              onClick={() => onFormatChange("rich")}
              title="富文本编辑器"
            >
              富文本
            </button>
            <button
              className={`format-btn ${contentFormat === "markdown" ? "active" : ""}`}
              onClick={() => onFormatChange("markdown")}
              title="Markdown编辑器"
            >
              Markdown
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditorStatusBar;
