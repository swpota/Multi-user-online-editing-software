import { useEffect, useRef } from 'react';

/**
 * useAutoSave Hook - 文档自动保存管理
 * 
 * 功能概述：
 * 1. 监听文档内容变化，自动触发保存
 * 2. 使用防抖（debounce）策略，避免频繁保存
 * 3. 区分富文本和 Markdown 两种内容格式
 * 4. 组件卸载时确保最后的变更被保存
 * 
 * 实现原理：
 * - 使用 setTimeout 实现防抖：用户停止编辑后等待指定时间才保存
 * - 使用 useRef 存储上次保存的内容，避免不必要的保存
 * - 每次内容变化时，清除旧的定时器，设置新的定时器
 * 
 * 防抖的好处：
 * - 减少网络请求次数，降低服务器压力
 * - 避免频繁的数据库写入操作
 * - 提升用户体验，不会因为保存而卡顿
 * 
 * @param {Function} saveDocument - 保存文档的函数
 * @param {Object} content - 富文本内容（Quill Delta 格式）
 * @param {string} contentFormat - 内容格式：'rich' 或 'markdown'
 * @param {string} markdownValue - Markdown 内容
 * @param {boolean} isEditor - 当前用户是否有编辑权限
 * @param {number} interval - 防抖间隔时间（毫秒），默认 2000ms（2秒）
 */
export function useAutoSave(
  saveDocument,
  content,
  contentFormat,
  markdownValue,
  isEditor,
  interval = 2000
) {
  // 保存定时器的引用，用于清除旧的定时器
  const saveTimeoutRef = useRef(null);

  // 上次保存的内容引用，用于检测内容是否真的发生了变化
  const lastSavedContentRef = useRef(null);

  /**
   * 主要的自动保存逻辑
   * 
   * 触发条件：content、contentFormat、markdownValue 任一变化
   * 
   * 工作流程：
   * 1. 检查用户是否有编辑权限
   * 2. 根据内容格式获取当前内容
   * 3. 与上次保存的内容对比，如果没变化则跳过
   * 4. 清除旧的定时器（如果存在）
   * 5. 设置新的定时器，等待 interval 毫秒后保存
   */
  useEffect(() => {
    // 只有编辑者才能自动保存
    if (!isEditor) return;

    // 根据内容格式获取当前内容的字符串表示
    // 富文本：将 Delta 对象转为 JSON 字符串
    // Markdown：直接使用 markdownValue 字符串
    const currentContent = contentFormat === 'markdown' ? markdownValue : JSON.stringify(content);

    // 首次加载时，记录初始内容，不触发保存
    if (lastSavedContentRef.current === null) {
      lastSavedContentRef.current = currentContent;
      return;
    }

    // 内容没有变化，不需要保存
    if (currentContent === lastSavedContentRef.current) {
      return;
    }

    // 清除之前的定时器（防抖的核心）
    // 这样可以确保只有在用户停止编辑后才会保存
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 设置新的自动保存定时器
    // 用户停止编辑 interval 毫秒后，才会真正执行保存
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(); // 调用保存函数
      lastSavedContentRef.current = currentContent; // 更新上次保存的内容
    }, interval);

    // 清理函数：组件重新渲染或卸载时，清除定时器
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, contentFormat, markdownValue, isEditor, saveDocument, interval]);

  /**
   * 组件卸载时的保存逻辑
   * 
   * 目的：确保用户关闭页面或离开文档时，最后的变更不会丢失
   * 
   * 工作流程：
   * 1. 清除待执行的定时器
   * 2. 立即执行一次保存
   * 
   * 注意：这是一个独立的 useEffect，只在组件卸载时执行
   */
  useEffect(() => {
    return () => {
      if (isEditor && saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current); // 清除定时器
        saveDocument(); // 立即保存
      }
    };
  }, [isEditor, saveDocument]);
}
