import React from "react";
import "../styles/components/EmptyState.css";

/**
 * 空状态组件（增强版）
 * @param {string} icon - 图标（emoji）
 * @param {string} image - 图片 URL（优先级高于 icon）
 * @param {string} title - 标题
 * @param {string} description - 描述
 * @param {object|array} action - 操作按钮（单个对象或按钮数组）
 * @param {boolean} animated - 是否显示动画
 * @param {string} size - 大小（small, medium, large）
 */
function EmptyState({ 
  icon = "📝", 
  image,
  title, 
  description, 
  action, 
  actionText, 
  onAction,
  animated = true,
  size = "medium",
  className = ""
}) {
  // 兼容旧的 API
  let actions = [];
  if (action) {
    actions = Array.isArray(action) ? action : [action];
  } else if (actionText && onAction) {
    actions = [{ text: actionText, onClick: onAction }];
  }
  
  return (
    <div className={`empty-state empty-state-${size} ${animated ? 'empty-state-animated' : ''} ${className}`}>
      {/* 图片或图标 */}
      {image ? (
        <div className="empty-state-image">
          <img src={image} alt={title} />
        </div>
      ) : (
        <div className="empty-state-icon">{icon}</div>
      )}
      
      {/* 文本内容 */}
      <div className="empty-state-content">
        <h3 className="empty-state-title">{title}</h3>
        {description && (
          <p className="empty-state-description">{description}</p>
        )}
      </div>
      
      {/* 操作按钮 */}
      {actions.length > 0 && (
        <div className="empty-state-actions">
          {actions.map((act, index) => (
            <button
              key={index}
              className={`empty-state-button ${act.variant === 'secondary' ? 'empty-state-button-secondary' : ''} ${act.className || ''}`}
              onClick={act.onClick}
              disabled={act.disabled}
            >
              {act.icon && <span className="button-icon">{act.icon}</span>}
              {act.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
