/**
 * DocumentListItem 文档列表项组件
 * 列表视图下的文档显示
 * 使用 React.memo 优化性能
 */
import React, { memo, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatRelativeTime } from "../../utils/timeUtils";
import { toArray } from "../../utils";
import "../../styles/components/dashboard/DocumentListItem-modern.css";

const EXPORT_FORMAT_OPTIONS = [
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown" },
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word" },
];

function DocumentListItem({ doc, isSelected, onSelect, onDelete, onExport }) {
  const tags = toArray(doc.tags);
  const lockedLabel =
    doc.locked_by_name || doc.locked_by_email || (doc.locked_by ? `用户${doc.locked_by}` : null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportMenu]);

  return (
    <li className={`document-list-item ${isSelected ? "selected" : ""}`}>
      <div className="document-list-item-content">
        <button
          type="button"
          className={`document-list-select-toggle ${isSelected ? "selected" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(doc.id);
          }}
          role="checkbox"
          aria-checked={isSelected}
        >
          {isSelected ? "已选" : "选择"}
        </button>

        <Link to={`/documents/${doc.id}`} className="document-list-link">
          <div className="document-list-main">
            <div className="document-list-title-row">
              <h3 className="document-list-title">{doc.title || "无标题文档"}</h3>
              {doc.content_format === "markdown" && (
                <span className="document-badge badge-markdown">Markdown</span>
              )}
              {doc.is_locked && <span className="document-badge badge-locked">🔒 锁定</span>}
            </div>
            <div className="document-list-meta">
              <span className="document-list-category">{doc.category || "未分类"}</span>
              <span
                className="document-list-time"
                title={new Date(doc.updated_at).toLocaleString()}
              >
                {formatRelativeTime(doc.updated_at)}
              </span>
              {lockedLabel && (
                <span className="document-list-locked" title="文档已被锁定">
                  🔒 {lockedLabel}
                </span>
              )}
            </div>
          </div>

          {tags.length > 0 && (
            <div className="document-list-tags">
              {tags.slice(0, 5).map((tag, idx) => (
                <span key={idx} className="document-list-tag">
                  {tag}
                </span>
              ))}
              {tags.length > 5 && (
                <span className="document-list-tag-more">+{tags.length - 5}</span>
              )}
            </div>
          )}
        </Link>

        <div className="document-list-actions">
          <div className="export-dropdown" ref={exportMenuRef}>
            <button
              className="list-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowExportMenu(!showExportMenu);
              }}
              title="导出"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {showExportMenu && (
              <div className="export-menu" onClick={(e) => e.stopPropagation()}>
                {EXPORT_FORMAT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className="export-menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExport(doc.id, option.value);
                      setShowExportMenu(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="list-action-btn delete"
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
    </li>
  );
}

// 使用 React.memo 优化，避免父组件重渲染时不必要的子组件重渲染
export default memo(DocumentListItem);
