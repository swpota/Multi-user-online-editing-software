/**
 * ErrorMessage 错误提示组件
 * 提供统一的错误信息显示
 */
import React from "react";
import "../../styles/components/common/ErrorMessage.css";

function ErrorMessage({ message, onRetry, onDismiss }) {
  return (
    <div className="error-message">
      <div className="error-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="error-content">
        <p className="error-text">{message}</p>
        <div className="error-actions">
          {onRetry && (
            <button className="error-btn error-btn-retry" onClick={onRetry}>
              重试
            </button>
          )}
          {onDismiss && (
            <button className="error-btn error-btn-dismiss" onClick={onDismiss}>
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorMessage;
