import React from "react";
import "../styles/components/EditorSkeleton.css";

/**
 * 编辑器骨架屏组件
 */
function EditorSkeleton() {
  return (
    <div className="editor-skeleton">
      <div className="editor-skeleton-header">
        <div className="editor-skeleton-title"></div>
        <div className="editor-skeleton-buttons">
          <div className="editor-skeleton-button"></div>
          <div className="editor-skeleton-button"></div>
          <div className="editor-skeleton-button"></div>
        </div>
      </div>
      <div className="editor-skeleton-meta">
        <div className="editor-skeleton-meta-item"></div>
        <div className="editor-skeleton-meta-item"></div>
      </div>
      <div className="editor-skeleton-toolbar"></div>
      <div className="editor-skeleton-content">
        <div className="editor-skeleton-line"></div>
        <div className="editor-skeleton-line" style={{ width: '90%' }}></div>
        <div className="editor-skeleton-line" style={{ width: '85%' }}></div>
        <div className="editor-skeleton-line" style={{ width: '70%' }}></div>
        <div className="editor-skeleton-line"></div>
        <div className="editor-skeleton-line" style={{ width: '95%' }}></div>
      </div>
    </div>
  );
}

export default EditorSkeleton;
