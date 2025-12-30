import { useState, useCallback, useEffect } from 'react';
import api from '../../api';

/**
 * useDocument Hook
 * 管理文档的基本信息和加载保存逻辑
 */
export function useDocument(documentId, user) {
  // 文档基本信息状态
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isEditor, setIsEditor] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('连接中...');
  
  // 内容相关状态
  const [content, setContent] = useState({ ops: [{ insert: '\n' }] });
  const [contentFormat, setContentFormat] = useState('rich');
  const [markdownValue, setMarkdownValue] = useState('');
  
  // 锁定状态
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState(null);

  /**
   * 加载文档数据
   */
  const fetchDocument = useCallback(async () => {
    if (!user) return;
    
    try {
      setDocumentLoading(true);
      const response = await api.get(`/documents/${documentId}`);
      const doc = response.data;
      
      // 设置基本信息
      setTitle(doc.title || '');
      setCategory(doc.category || '');
      setTagsInput(doc.tags?.join(', ') || '');
      
      // 设置权限
      const userRole = doc.owner_id === user.id ? 'owner' :
                      doc.editors?.includes(user.id) ? 'editor' : 'viewer';
      setIsEditor(userRole === 'owner' || userRole === 'editor');
      
      // 设置内容
      let initialContent = { ops: [{ insert: '\n' }] };
      if (doc.content) {
        try {
          initialContent = typeof doc.content === 'string'
            ? JSON.parse(doc.content)
            : doc.content;
        } catch (e) {
          console.error('解析文档内容失败:', e);
        }
      }
      setContent(initialContent);
      
      // 设置内容格式
      const format = doc.content_format || 'rich';
      setContentFormat(format);
      if (format === 'markdown' && doc.markdown_content) {
        setMarkdownValue(doc.markdown_content);
      }
      
      // 设置锁定状态
      setIsLocked(doc.is_locked || false);
      setLockedBy(doc.locked_by || null);
      
      setSaveStatus('已保存');
    } catch (error) {
      console.error('加载文档失败:', error);
      setSaveStatus('加载失败');
      throw error;
    } finally {
      setDocumentLoading(false);
    }
  }, [documentId, user]);

  /**
   * 保存文档
   */
  const saveDocument = useCallback(async () => {
    if (!isEditor) return;
    
    try {
      setSaveStatus('保存中...');
      
      const payload = {
        title,
        category,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        content_format: contentFormat,
      };
      
      if (contentFormat === 'markdown') {
        payload.markdown_content = markdownValue;
      } else {
        payload.content = JSON.stringify(content);
      }
      
      await api.put(`/documents/${documentId}`, payload);
      setSaveStatus('已保存');
    } catch (error) {
      console.error('保存文档失败:', error);
      setSaveStatus('保存失败');
      throw error;
    }
  }, [documentId, isEditor, title, category, tagsInput, content, contentFormat, markdownValue]);

  /**
   * 更新标题
   */
  const updateTitle = useCallback((newTitle) => {
    if (!isEditor) return;
    setTitle(newTitle);
  }, [isEditor]);

  /**
   * 更新分类
   */
  const updateCategory = useCallback((newCategory) => {
    if (!isEditor) return;
    setCategory(newCategory);
  }, [isEditor]);

  /**
   * 更新标签
   */
  const updateTags = useCallback((newTagsInput) => {
    if (!isEditor) return;
    setTagsInput(newTagsInput);
  }, [isEditor]);

  /**
   * 更新内容
   */
  const updateContent = useCallback((newContent) => {
    if (!isEditor) return;
    setContent(newContent);
    setSaveStatus('未保存');
  }, [isEditor]);

  /**
   * 更新 Markdown 内容
   */
  const updateMarkdownValue = useCallback((newValue) => {
    if (!isEditor) return;
    setMarkdownValue(newValue);
    setSaveStatus('未保存');
  }, [isEditor]);

  /**
   * 切换内容格式
   */
  const switchContentFormat = useCallback((newFormat) => {
    if (!isEditor) return;
    setContentFormat(newFormat);
  }, [isEditor]);

  /**
   * 更新锁定状态
   */
  const updateLockState = useCallback((locked, lockedByUser) => {
    setIsLocked(locked);
    setLockedBy(lockedByUser);
  }, []);

  // 初始加载文档
  useEffect(() => {
    if (documentId && user) {
      fetchDocument();
    }
  }, [documentId, user, fetchDocument]);

  return {
    // 状态
    title,
    category,
    tagsInput,
    content,
    contentFormat,
    markdownValue,
    isEditor,
    isLocked,
    lockedBy,
    documentLoading,
    saveStatus,
    
    // 方法
    fetchDocument,
    saveDocument,
    updateTitle,
    updateCategory,
    updateTags,
    updateContent,
    updateMarkdownValue,
    switchContentFormat,
    updateLockState,
  };
}
