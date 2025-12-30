/**
 * BulkActions 批量操作工具栏
 * 显示选中数量和批量操作按钮
 * 使用 React.memo 优化性能
 */
import React, { memo } from "react";
import "../../styles/components/dashboard/BulkActions.css";

function BulkActions({
  selectedCount,
  onExport,
  onDelete,
  onDeselectAll,
  exportFormat,
  onFormatChange,
  exporting = false,
  exportOptions = [],
  statusMessage,
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="bulk-actions">
      <div className="bulk-actions-info">
        已选择 <strong>{selectedCount}</strong> 个文档
        {statusMessage && <span className="bulk-actions-status">{statusMessage}</span>}
      </div>
      <div className="bulk-actions-controls">
        <div className="bulk-actions-format">
          <label htmlFor="bulk-format-select">导出格式</label>
          <select
            id="bulk-format-select"
            value={exportFormat}
            onChange={(e) => onFormatChange?.(e.target.value)}
            disabled={exporting}
          >
            {(exportOptions.length ? exportOptions : [{ value: "json", label: "JSON" }]).map(
              (option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              )
            )}
          </select>
        </div>
        <div className="bulk-actions-buttons">
          <button className="bulk-btn bulk-btn-export" onClick={onExport} disabled={exporting}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? "批量导出中..." : "批量导出"}
          </button>
          <button className="bulk-btn bulk-btn-delete" onClick={onDelete} disabled={exporting}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            批量删除
          </button>
          <button className="bulk-btn bulk-btn-cancel" onClick={onDeselectAll} disabled={exporting}>
            取消选择
          </button>
        </div>
      </div>
    </div>
  );
}

// 使用 React.memo 优化，仅在 props 变化时重渲染
export default memo(BulkActions);
