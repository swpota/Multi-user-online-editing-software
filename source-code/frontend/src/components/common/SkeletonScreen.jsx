/**
 * SkeletonScreen 骨架屏组件
 * 用于在内容加载时提供更好的视觉体验
 */
import React from "react";
import "../../styles/components/common/SkeletonScreen.css";

// 基础骨架元素
export const SkeletonLine = ({ width = "100%", height = "16px", className = "" }) => (
  <div 
    className={`skeleton-line ${className}`}
    style={{ width, height }}
  />
);

export const SkeletonCircle = ({ size = "40px", className = "" }) => (
  <div 
    className={`skeleton-circle ${className}`}
    style={{ width: size, height: size }}
  />
);

export const SkeletonRectangle = ({ width = "100%", height = "100px", className = "" }) => (
  <div 
    className={`skeleton-rectangle ${className}`}
    style={{ width, height }}
  />
);

// 文档卡片骨架屏
export const DocumentCardSkeleton = () => (
  <div className="skeleton-document-card">
    <div className="skeleton-document-header">
      <SkeletonCircle size="24px" />
      <SkeletonLine width="80px" height="20px" />
    </div>
    <div className="skeleton-document-body">
      <SkeletonLine width="90%" height="20px" />
      <SkeletonLine width="70%" height="14px" />
      <SkeletonLine width="60%" height="14px" />
    </div>
    <div className="skeleton-document-footer">
      <SkeletonLine width="100px" height="14px" />
      <div className="skeleton-actions">
        <SkeletonCircle size="28px" />
        <SkeletonCircle size="28px" />
      </div>
    </div>
  </div>
);

// 文档列表骨架屏
export const DocumentListSkeleton = ({ count = 5 }) => (
  <div className="skeleton-document-list">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="skeleton-document-list-item">
        <SkeletonCircle size="18px" />
        <div className="skeleton-list-content">
          <SkeletonLine width="60%" height="18px" />
          <SkeletonLine width="40%" height="14px" />
        </div>
        <div className="skeleton-list-actions">
          <SkeletonCircle size="24px" />
          <SkeletonCircle size="24px" />
        </div>
      </div>
    ))}
  </div>
);

// Dashboard 骨架屏
export const DashboardSkeleton = () => (
  <div className="skeleton-dashboard">
    <div className="skeleton-dashboard-header">
      <SkeletonLine width="200px" height="32px" />
      <div className="skeleton-header-actions">
        <SkeletonRectangle width="120px" height="40px" />
        <SkeletonRectangle width="120px" height="40px" />
      </div>
    </div>
    
    <div className="skeleton-dashboard-filters">
      <SkeletonRectangle width="100%" height="48px" />
    </div>
    
    <div className="skeleton-dashboard-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <DocumentCardSkeleton key={index} />
      ))}
    </div>
  </div>
);

// 编辑器骨架屏
export const EditorSkeleton = () => (
  <div className="skeleton-editor">
    <div className="skeleton-editor-toolbar">
      {Array.from({ length: 8 }).map((_, index) => (
        <SkeletonCircle key={index} size="32px" />
      ))}
    </div>
    <div className="skeleton-editor-content">
      <SkeletonLine width="40%" height="32px" />
      <SkeletonLine width="100%" height="16px" />
      <SkeletonLine width="95%" height="16px" />
      <SkeletonLine width="100%" height="16px" />
      <SkeletonLine width="88%" height="16px" />
      <SkeletonLine width="100%" height="16px" />
      <SkeletonLine width="92%" height="16px" />
    </div>
  </div>
);

// 表格骨架屏
export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <div className="skeleton-table">
    <div className="skeleton-table-header">
      {Array.from({ length: columns }).map((_, index) => (
        <SkeletonLine key={index} width="100px" height="20px" />
      ))}
    </div>
    <div className="skeleton-table-body">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonLine key={colIndex} width="90%" height="16px" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// 通用页面骨架屏
const SkeletonScreen = ({ type = "page", count = 1, ...props }) => {
  switch (type) {
    case "document-card":
      return Array.from({ length: count }).map((_, index) => (
        <DocumentCardSkeleton key={index} />
      ));
    case "document-list":
      return <DocumentListSkeleton count={count} />;
    case "dashboard":
      return <DashboardSkeleton />;
    case "editor":
      return <EditorSkeleton />;
    case "table":
      return <TableSkeleton rows={props.rows} columns={props.columns} />;
    case "line":
      return <SkeletonLine {...props} />;
    case "circle":
      return <SkeletonCircle {...props} />;
    case "rectangle":
      return <SkeletonRectangle {...props} />;
    default:
      return (
        <div className="skeleton-page">
          <SkeletonLine width="40%" height="32px" />
          <SkeletonLine width="100%" height="200px" />
        </div>
      );
  }
};

export default SkeletonScreen;
