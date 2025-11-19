import { useEffect, useRef } from 'react';

/**
 * useAutoSave Hook
 * 管理文档自动保存功能
 */
export function useAutoSave(
  saveDocument,
  content,
  contentFormat,
  markdownValue,
  isEditor,
  interval = 2000
) {
  const saveTimeoutRef = useRef(null);
  const lastSavedContentRef = useRef(null);

  useEffect(() => {
    if (!isEditor) return;

    // 检查内容是否有变化
    const currentContent = contentFormat === 'markdown' ? markdownValue : JSON.stringify(content);
    
    if (lastSavedContentRef.current === null) {
      lastSavedContentRef.current = currentContent;
      return;
    }

    if (currentContent === lastSavedContentRef.current) {
      return;
    }

    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 设置新的自动保存定时器
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument();
      lastSavedContentRef.current = currentContent;
    }, interval);

    // 清理函数
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, contentFormat, markdownValue, isEditor, saveDocument, interval]);

  // 组件卸载时保存
  useEffect(() => {
    return () => {
      if (isEditor && saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveDocument();
      }
    };
  }, [isEditor, saveDocument]);
}
