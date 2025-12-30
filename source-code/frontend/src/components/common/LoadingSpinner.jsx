/**
 * LoadingSpinner 加载动画组件
 * 提供统一的加载状态显示
 */
import React from "react";
import "../../styles/components/common/LoadingSpinner.css";

function LoadingSpinner({ size = "medium", text = "加载中..." }) {
  return (
    <div className={`loading-spinner-container ${size}`}>
      <div className="loading-spinner" />
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
}

export default LoadingSpinner;
