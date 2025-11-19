import { useState, useCallback } from 'react';
import api from '../../api';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * useVersions Hook
 * 管理文档版本历史功能
 */
export function useVersions(documentId, isEditor) {
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionError, setVersionError] = useState('');
  const [previewVersion, setPreviewVersion] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewMarkdown, setPreviewMarkdown] = useState('');
  
  // 版本对比相关
  const [compareFrom, setCompareFrom] = useState(null);
  const [compareTo, setCompareTo] = useState(null);
  const [diffHtml, setDiffHtml] = useState('');
  const [diffError, setDiffError] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);

  /**
   * 加载版本列表
   */
  const fetchVersions = useCallback(async () => {
    try {
      setVersionsLoading(true);
      setVersionError('');
      const response = await api.get(`/documents/${documentId}/versions`);
      setVersions(response.data || []);
    } catch (error) {
      console.error('加载版本列表失败:', error);
      setVersionError('加载版本列表失败');
    } finally {
      setVersionsLoading(false);
    }
  }, [documentId]);

  /**
   * 保存新版本
   */
  const saveVersion = useCallback(async (summary = '') => {
    if (!isEditor) return;

    try {
      await api.post(`/documents/${documentId}/versions`, {
        summary: summary || '手动保存的版本'
      });
      await fetchVersions();
      return true;
    } catch (error) {
      console.error('保存版本失败:', error);
      alert('保存版本失败');
      return false;
    }
  }, [documentId, isEditor, fetchVersions]);

  /**
   * 预览某个版本
   */
  const previewVersionById = useCallback(async (versionId) => {
    try {
      const response = await api.get(`/documents/${documentId}/versions/${versionId}`);
      const versionData = response.data;
      
      setPreviewVersion(versionData);
      
      // 处理内容
      if (versionData.content_format === 'markdown') {
        setPreviewMarkdown(versionData.markdown_content || '');
        setPreviewContent(null);
      } else {
        try {
          const content = typeof versionData.content === 'string'
            ? JSON.parse(versionData.content)
            : versionData.content;
          setPreviewContent(content);
        } catch (e) {
          console.error('解析版本内容失败:', e);
          setPreviewContent({ ops: [{ insert: '内容解析失败\n' }] });
        }
        setPreviewMarkdown('');
      }
    } catch (error) {
      console.error('预览版本失败:', error);
      alert('预览版本失败');
    }
  }, [documentId]);

  /**
   * 恢复到某个版本
   */
  const restoreVersion = useCallback(async (versionId, onSuccess) => {
    if (!isEditor) return;
    
    if (!window.confirm('确定要恢复到该版本吗？当前内容将被覆盖。')) {
      return;
    }

    try {
      await api.post(`/documents/${documentId}/versions/${versionId}/restore`);
      alert('版本恢复成功！');
      if (onSuccess) {
        onSuccess();
      }
      return true;
    } catch (error) {
      console.error('恢复版本失败:', error);
      alert('恢复版本失败');
      return false;
    }
  }, [documentId, isEditor]);

  /**
   * 对比两个版本
   */
  const compareVersions = useCallback(async () => {
    if (!compareFrom || !compareTo) {
      setDiffError('请先选择对比的两个版本');
      return;
    }

    try {
      setDiffLoading(true);
      setDiffError('');
      
      const response = await api.get(
        `/documents/${documentId}/versions/compare?from=${compareFrom}&to=${compareTo}`
      );
      
      setDiffHtml(response.data.diff || '');
    } catch (error) {
      console.error('对比版本失败:', error);
      setDiffError('对比失败');
    } finally {
      setDiffLoading(false);
    }
  }, [documentId, compareFrom, compareTo]);

  /**
   * 清除预览
   */
  const clearPreview = useCallback(() => {
    setPreviewVersion(null);
    setPreviewContent(null);
    setPreviewMarkdown('');
  }, []);

  /**
   * 清除对比
   */
  const clearCompare = useCallback(() => {
    setCompareFrom(null);
    setCompareTo(null);
    setDiffHtml('');
    setDiffError('');
  }, []);

  /**
   * 获取 Markdown 预览 HTML
   */
  const getPreviewMarkdownHtml = useCallback(() => {
    if (!previewMarkdown) return '';
    try {
      const html = marked.parse(previewMarkdown);
      return DOMPurify.sanitize(html);
    } catch (error) {
      console.error('渲染 Markdown 预览失败:', error);
      return DOMPurify.sanitize(`<pre>${previewMarkdown}</pre>`);
    }
  }, [previewMarkdown]);

  /**
   * 获取 Diff HTML（已净化）
   */
  const getSanitizedDiffHtml = useCallback(() => {
    return DOMPurify.sanitize(diffHtml || '');
  }, [diffHtml]);

  return {
    // 状态
    versions,
    versionsLoading,
    versionError,
    previewVersion,
    previewContent,
    previewMarkdown,
    compareFrom,
    compareTo,
    diffHtml,
    diffError,
    diffLoading,
    
    // 方法
    fetchVersions,
    saveVersion,
    previewVersionById,
    restoreVersion,
    compareVersions,
    clearPreview,
    clearCompare,
    setCompareFrom,
    setCompareTo,
    getPreviewMarkdownHtml,
    getSanitizedDiffHtml,
  };
}
