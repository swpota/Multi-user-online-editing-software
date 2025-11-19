/**
 * FilterBar 筛选栏组件
 * 提供文档的搜索、筛选和排序功能
 */
import React, { useRef, useEffect } from "react";
import "../../styles/components/dashboard/FilterBar.css";

const FilterBar = React.memo(function FilterBar({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  categories = [],
}) {
  const searchInputRef = useRef(null);
  const containerRef = useRef(null);
  const isUserClearingRef = useRef(false);

  // 监听整个搜索容器的 mousedown 事件，防止焦点丢失
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (e) => {
      const input = searchInputRef.current;
      if (input && input.value && e.target !== input && !e.target.closest('.search-clear')) {
        e.preventDefault();
        setTimeout(() => {
          if (input && input.value) {
            input.focus();
            const length = input.value.length;
            input.setSelectionRange(length, length);
          }
        }, 0);
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    return () => container.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // 监听输入框的 blur 事件
  useEffect(() => {
    const input = searchInputRef.current;
    if (!input) return;

    const handleBlur = () => {
      if (!isUserClearingRef.current && input.value) {
        setTimeout(() => {
          if (input && input.value && !isUserClearingRef.current) {
            input.focus();
            const length = input.value.length;
            input.setSelectionRange(length, length);
          }
        }, 50);
      }
    };

    input.addEventListener('blur', handleBlur);
    return () => input.removeEventListener('blur', handleBlur);
  }, []);

  // 轮询检查焦点状态（保证焦点恢复）
  useEffect(() => {
    const input = searchInputRef.current;
    if (!input) return;

    const interval = setInterval(() => {
      if (input.value && document.activeElement !== input && !isUserClearingRef.current) {
        input.focus();
        const length = input.value.length;
        input.setSelectionRange(length, length);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // 处理清除搜索
  const handleClearSearch = () => {
    // 标记用户正在清除
    isUserClearingRef.current = true;
    // 清除搜索内容
    onSearchChange("");
    // 失去焦点
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
    // 重置标记
    setTimeout(() => {
      isUserClearingRef.current = false;
    }, 100);
  };

  // 处理键盘事件
  const handleKeyDown = (e) => {
    // 按 Escape 键清除搜索并失去焦点
    if (e.key === 'Escape') {
      handleClearSearch();
    }
    // Enter 键不做任何事，保持焦点让用户继续输入
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar-left">
        <div className="search-box" ref={containerRef}>
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="搜索文档..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="search-input"
            autoComplete="off"
          />
          {searchQuery && (
            <button 
              className="search-clear" 
              onClick={handleClearSearch}
              title="清除搜索 (Esc)"
            >
              ×
            </button>
          )}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="filter-select"
        >
          <option value="">全部分类</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="filter-select"
        >
          <option value="updated_at_desc">最近更新</option>
          <option value="updated_at_asc">最早更新</option>
          <option value="created_at_desc">最近创建</option>
          <option value="created_at_asc">最早创建</option>
          <option value="title_asc">标题 A-Z</option>
          <option value="title_desc">标题 Z-A</option>
        </select>
      </div>

      <div className="filter-bar-right">
        <div className="view-toggle">
          <button
            className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => onViewModeChange("grid")}
            title="网格视图"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            className={`view-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => onViewModeChange("list")}
            title="列表视图"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

export default FilterBar;
