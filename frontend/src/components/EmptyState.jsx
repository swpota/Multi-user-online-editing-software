import React from "react";
import "../styles/components/EmptyState.css";

/**
 * 空状态组件
 * @param {string} icon - 图标（emoji或图标）
 * @param {string} title - 标题
 * @param {string} description - 描述
 * @param {object} action - 操作按钮 { text, onClick }
 */
function EmptyState({ icon = "📝", title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {description && (
        <p className="empty-state-description">{description}</p>
      )}
      {action && (
        <button
          className="empty-state-button"
          onClick={action.onClick}
        >
          {action.text}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
