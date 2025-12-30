import { useEffect, useRef } from 'react';

/**
 * useAutoSave - 自动保存Hook
 * 用户停止编辑2秒后自动保存，避免频繁请求
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

  // 监听内容变化，停止编辑后interval毫秒保存
  useEffect(() => {
    if (!isEditor) return;

    // 根据格式获取当前内容
    const currentContent = contentFormat === 'markdown' ? markdownValue : JSON.stringify(content);

    // 首次加载记录初始内容
    if (lastSavedContentRef.current === null) {
      lastSavedContentRef.current = currentContent;
      return;
    }

    // 内容没变就不保存
    if (currentContent === lastSavedContentRef.current) {
      return;
    }

    // 清除之前的定时器（防抖核心）
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 用户停止编辑后才保存
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument();
      lastSavedContentRef.current = currentContent;
    }, interval);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, contentFormat, markdownValue, isEditor, saveDocument, interval]);

  // 组件卸载时立即保存，防止内容丢失
  useEffect(() => {
    return () => {
      if (isEditor && saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveDocument();
      }
    };
  }, [isEditor, saveDocument]);
}
