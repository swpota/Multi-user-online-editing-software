import React, { useEffect } from "react";
import "../styles/components/Toast.css";

/**
 * Toast 提示组件
 * @param {string} message - 提示消息
 * @param {string} type - 类型：success, error, warning, info
 * @param {number} duration - 显示时长（毫秒）
 * @param {function} onClose - 关闭回调
 */
function Toast({ message, type = "info", duration = 3000, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ"
  };

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-icon">{icons[type]}</div>
      <div className="toast-message">{message}</div>
      <button className="toast-close" onClick={onClose}>✕</button>
    </div>
  );
}

export default Toast;
