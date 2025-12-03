/**
 * EditorToolbar 编辑器工具栏组件
 * 提供保存、分享、导出、版本管理等功能
 */
import React from "react";
import "../../styles/components/editor/EditorToolbar.css";

function EditorToolbar({
  title,
  onTitleChange,
  saveStatus,
  isEditor,
  isLocked,
  lockedBy,
  onSave,
  onShare,
  onExport,
  onVersion,
  onTemplate,
  onLock,
  onBack,
  templateSaving,
  lockProcessing,
}) {
  return (
    <div className="editor-toolbar">
      <div className="editor-toolbar-left">
        <button className="toolbar-btn-back" onClick={onBack} title="返回文档列表">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        
        <input
          type="text"
          className="editor-title-input"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="无标题文档"
          disabled={!isEditor || isLocked}
        />

        <span className="editor-save-status">{saveStatus}</span>
      </div>

      <div className="editor-toolbar-right">
        {isLocked && lockedBy && (
          <span 
            className="editor-locked-badge"
            title={`已锁定 - ${lockedBy.name || lockedBy.email || "未知用户"}`}
          >
            🔒 已锁定
          </span>
        )}

        {isEditor && (
          <>
            <button
              className="toolbar-btn"
              onClick={onLock}
              disabled={lockProcessing}
              title={isLocked ? "解锁文档" : "锁定文档"}
            >
              {isLocked ? "🔓 解锁" : "🔒 锁定"}
            </button>

            <button className="toolbar-btn" onClick={onSave} title="手动保存">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              保存
            </button>

            <button
              className="toolbar-btn"
              onClick={onTemplate}
              disabled={templateSaving}
              title="保存为模板"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {templateSaving ? "中..." : "模板"}
            </button>
          </>
        )}

        <button className="toolbar-btn" onClick={onVersion} title="版本历史">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          版本
        </button>

        <button className="toolbar-btn" onClick={onExport} title="导出文档">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          导出
        </button>

        <button className="toolbar-btn-primary" onClick={onShare} title="分享文档">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          分享
        </button>
      </div>
    </div>
  );
}

export default EditorToolbar;
