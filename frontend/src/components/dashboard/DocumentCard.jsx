/**
 * DocumentCard 文档卡片组件
 * 显示单个文档的信息卡片
 * 使用 React.memo 优化性能
 */
import React, { memo } from "react";
import { Link } from "react-router-dom";
import { formatRelativeTime } from "../../utils/timeUtils";
import { toArray } from "../../utils";
import "../../styles/components/dashboard/DocumentCard-modern.css";

// 分类颜色映射（组件外定义，避免重复创建）
const CATEGORY_COLORS = {
  工作: "#3b82f6",
  个人: "#10b981",
  学习: "#f59e0b",
  其他: "#6b7280",
};

function DocumentCard({ doc, isSelected, onSelect, onDelete, onExport }) {
  const tags = toArray(doc.tags);
  const categoryColor = CATEGORY_COLORS[doc.category] || "#6b7280";

  return (
    <div className={`document-card hover-lift ${isSelected ? "selected" : ""}`}>
      <div className="document-card-header">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(doc.id);
          }}
          className="document-checkbox"
        />
        <div className="document-category" style={{ backgroundColor: categoryColor }}>
          {doc.category || "未分类"}
        </div>
      </div>

      <Link to={`/documents/${doc.id}`} className="document-card-link">
        <div className="document-card-header-info">
          <h3 className="document-title">{doc.title || "无标题文档"}</h3>
          <div className="document-badges">
            {doc.content_format === "markdown" && (
              <span className="document-badge badge-markdown">Markdown</span>
            )}
            {doc.is_locked && (
              <span className="document-badge badge-locked">🔒 锁定</span>
            )}
          </div>
        </div>
      </Link>

      {tags.length > 0 && (
        <div className="document-tags">
          {tags.slice(0, 3).map((tag, idx) => (
            <span key={idx} className="document-tag">
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="document-tag-more">+{tags.length - 3}</span>
          )}
        </div>
      )}

      <div className="document-footer">
        <span className="document-time" title={new Date(doc.updated_at).toLocaleString()}>
          {formatRelativeTime(doc.updated_at)}
        </span>
        <div className="document-actions">
          <button
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onExport(doc.id);
            }}
            title="导出"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            className="action-btn delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(doc.id);
            }}
            title="删除"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// 使用 React.memo 优化，避免父组件重渲染时不必要的子组件重渲染
export default memo(DocumentCard);
