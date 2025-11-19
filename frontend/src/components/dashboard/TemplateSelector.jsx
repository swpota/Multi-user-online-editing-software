/**
 * TemplateSelector 模板选择器组件
 * 提供文档模板的选择功能
 */
import React from "react";
import { toArray } from "../../utils";
import "../../styles/components/dashboard/TemplateSelector.css";

function TemplateSelector({ templates, loading, error, onSelect, onClose }) {
  if (error) {
    return (
      <div className="template-error">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p>{error}</p>
        <button onClick={onClose}>关闭</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="template-loading">
        <div className="template-spinner" />
        <p>加载模板中...</p>
      </div>
    );
  }

  return (
    <div className="template-selector">
      <div className="template-grid">
        {templates.map((template) => {
          const tags = toArray(template.tags);
          return (
            <div
              key={template.id}
              className="template-card"
              onClick={() => onSelect(template)}
            >
              <div className="template-card-header">
                <div className="template-category">{template.category || "未分类"}</div>
              </div>
              <h4 className="template-title">{template.name || template.title || "无标题模板"}</h4>
              <p className="template-description">
                {template.description || "暂无描述"}
              </p>
              {tags.length > 0 && (
                <div className="template-tags">
                  {tags.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="template-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {templates.length === 0 && (
        <div className="template-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <p>暂无可用模板</p>
        </div>
      )}
    </div>
  );
}

export default TemplateSelector;
