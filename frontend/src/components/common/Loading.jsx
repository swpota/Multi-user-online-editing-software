import React from 'react';
import '../styles/components/common/Loading.css';

/**
 * Loading 组件
 * 用于 Suspense fallback 和其他加载场景
 */
function Loading({ 
  size = 'medium', 
  text = '加载中...',
  fullScreen = false 
}) {
  return (
    <div className={`loading-container ${fullScreen ? 'fullscreen' : ''}`}>
      <div className={`loading-spinner ${size}`}>
        <div className="spinner"></div>
      </div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
}

export default Loading;
