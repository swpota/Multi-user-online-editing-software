import { useState, useCallback } from 'react';
import api from '../../api';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * useVersions Hook - 文档版本控制管理
 * 
 * 功能概述：
 * 实现完整的文档版本控制系统，类似 Git 的版本管理功能
 * 
 * 核心功能：
 * 1. 版本保存 - 创建文档快照，记录特定时刻的文档状态
 * 2. 版本列表 - 查看文档的所有历史版本
 * 3. 版本预览 - 查看某个历史版本的内容
 * 4. 版本恢复 - 将文档回滚到某个历史版本
 * 5. 版本对比 - 对比两个版本之间的差异(Diff)
 * 
 * 使用场景：
 * - 误删内容后恢复到之前的版本
 * - 查看文档的演变历史
 * - 对比不同时期的内容变化
 * - 团队协作时追踪谁做了什么修改
 * 
 * 技术实现：
 * - 版本内容存储在数据库的 document_versions 表中
 * - 支持富文本(Quill Delta)和 Markdown 两种格式
 * - 使用 diff 算法生成版本对比的 HTML
 * - 使用 DOMPurify 净化 HTML，防止 XSS 攻击
 * - 使用 marked 库渲染 Markdown 预览
 * 
 * @param {string} documentId - 文档ID
 * @param {boolean} isEditor - 当前用户是否有编辑权限
 */
export function useVersions(documentId, isEditor) {
  // ========== 版本列表相关状态 ==========

  // 版本列表数据：存储所有历史版本的数组
  const [versions, setVersions] = useState([]);
  // 版本列表加载状态：true表示正在加载
  const [versionsLoading, setVersionsLoading] = useState(false);
  // 版本列表错误信息：加载失败时的错误提示
  const [versionError, setVersionError] = useState('');

  // ========== 版本预览相关状态 ==========

  // 当前预览的版本对象：包含版本号、创建时间、摘要等完整信息
  const [previewVersion, setPreviewVersion] = useState(null);
  // 预览内容(富文本格式)：Quill Delta 对象
  const [previewContent, setPreviewContent] = useState(null);
  // 预览内容(Markdown格式)：纯文本字符串
  const [previewMarkdown, setPreviewMarkdown] = useState('');

  // ========== 版本对比相关状态 ==========

  // 对比的起始版本ID：用户选择的第一个版本
  const [compareFrom, setCompareFrom] = useState(null);
  // 对比的目标版本ID：用户选择的第二个版本
  const [compareTo, setCompareTo] = useState(null);
  // 对比结果的HTML：包含高亮差异的HTML字符串
  const [diffHtml, setDiffHtml] = useState('');
  // 对比错误信息：对比失败时的错误提示
  const [diffError, setDiffError] = useState('');
  // 对比加载状态：true表示正在生成对比结果
  const [diffLoading, setDiffLoading] = useState(false);

  /**
   * 加载版本列表
   * 
   * 功能：从服务器获取文档的所有历史版本
   * 
   * 返回数据格式：
   * [
   *   {
   *     id: 版本ID,
   *     version_number: 版本号,
   *     summary: 版本摘要,
   *     created_at: 创建时间,
   *     created_by: 创建者ID
   *   },
   *   ...
   * ]
   * 
   * 版本按创建时间倒序排列，最新的版本在最前面
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
   * 
   * 功能：创建当前文档状态的快照，保存为新版本
   * 
   * @param {string} summary - 版本摘要，描述这个版本的主要变更
   * @returns {boolean} 是否保存成功
   * 
   * 工作流程：
   * 1. 调用 API 创建版本快照
   * 2. 服务器会自动保存当前文档的所有内容和元数据
   * 3. 版本号自动递增
   * 4. 刷新版本列表，显示新创建的版本
   * 
   * 权限检查：只有编辑者才能保存版本
   * 
   * 使用示例：
   * await saveVersion('完成第一章内容')
   * await saveVersion('修复拼写错误')
   */
  const saveVersion = useCallback(async (summary = '') => {
    if (!isEditor) return;

    try {
      await api.post(`/documents/${documentId}/versions`, {
        summary: summary || '手动保存的版本'
      });
      await fetchVersions(); // 刷新版本列表
      return true;
    } catch (error) {
      console.error('保存版本失败:', error);
      alert('保存版本失败');
      return false;
    }
  }, [documentId, isEditor, fetchVersions]);

  /**
   * 预览某个历史版本
   * 
   * 功能：查看某个历史版本的完整内容，但不修改当前文档
   * 
   * @param {number} versionId - 要预览的版本ID
   * 
   * 工作流程：
   * 1. 从服务器获取指定版本的完整数据
   * 2. 根据内容格式(富文本/Markdown)设置对应的预览状态
   * 3. 富文本：解析 JSON 格式的 Delta 对象
   * 4. Markdown：直接使用 markdown_content 字符串
   * 
   * 错误处理：
   * - 如果内容解析失败，显示错误提示
   * - 网络错误时，通过 alert 提示用户
   */
  const previewVersionById = useCallback(async (versionId) => {
    try {
      const response = await api.get(`/documents/${documentId}/versions/${versionId}`);
      const versionData = response.data;

      setPreviewVersion(versionData);

      // 根据内容格式处理预览内容
      if (versionData.content_format === 'markdown') {
        // Markdown 格式：直接使用 markdown_content
        setPreviewMarkdown(versionData.markdown_content || '');
        setPreviewContent(null);
      } else {
        // 富文本格式：解析 JSON 为 Delta 对象
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
   * 恢复到某个历史版本
   * 
   * 功能：将文档内容回滚到指定的历史版本
   * 
   * @param {number} versionId - 要恢复的版本ID
   * @param {Function} onSuccess - 恢复成功后的回调函数
   * @returns {boolean} 是否恢复成功
   * 
   * 工作流程：
   * 1. 弹出确认对话框，防止误操作
   * 2. 调用 API 执行版本恢复
   * 3. 服务器会用历史版本的内容覆盖当前文档
   * 4. 恢复成功后，调用 onSuccess 回调(通常用于刷新页面)
   * 
   * 注意事项：
   * - 这是一个破坏性操作，会覆盖当前内容
   * - 建议在恢复前先保存当前版本
   * - 恢复操作本身也会创建一个新版本
   * 
   * 权限检查：只有编辑者才能恢复版本
   */
  const restoreVersion = useCallback(async (versionId, onSuccess) => {
    if (!isEditor) return;

    // 二次确认，防止误操作
    if (!window.confirm('确定要恢复到该版本吗？当前内容将被覆盖。')) {
      return;
    }

    try {
      await api.post(`/documents/${documentId}/versions/${versionId}/restore`);
      alert('版本恢复成功！');
      if (onSuccess) {
        onSuccess(); // 执行成功回调，通常用于刷新页面
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
   * 
   * 功能：生成两个版本之间的差异对比(Diff)
   * 
   * 工作流程：
   * 1. 检查是否已选择两个版本
   * 2. 调用 API，服务器使用 diff 算法计算差异
   * 3. 返回带有高亮标记的 HTML
   *    - 绿色背景：新增的内容
   *    - 红色背景：删除的内容
   *    - 黄色背景：修改的内容
   * 4. 将 HTML 存储到 diffHtml 状态中
   * 
   * 使用场景：
   * - 查看两个版本之间的具体变化
   * - 审查团队成员的修改内容
   * - 追踪文档的演变过程
   * 
   * 注意：diff HTML 会经过 DOMPurify 净化，确保安全
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
   * 清除预览状态
   * 
   * 功能：关闭版本预览，清空所有预览相关的状态
   * 
   * 使用场景：
   * - 用户关闭预览模态框
   * - 切换到其他版本预览
   * - 退出版本管理界面
   */
  const clearPreview = useCallback(() => {
    setPreviewVersion(null);
    setPreviewContent(null);
    setPreviewMarkdown('');
  }, []);

  /**
   * 清除对比状态
   * 
   * 功能：清空版本对比的所有状态，重置对比界面
   * 
   * 使用场景：
   * - 用户关闭对比界面
   * - 重新选择要对比的版本
   * - 退出版本管理界面
   */
  const clearCompare = useCallback(() => {
    setCompareFrom(null);
    setCompareTo(null);
    setDiffHtml('');
    setDiffError('');
  }, []);

  /**
   * 获取 Markdown 预览的 HTML
   * 
   * 功能：将 Markdown 文本转换为 HTML，用于在预览界面显示
   * 
   * @returns {string} 净化后的 HTML 字符串
   * 
   * 处理流程：
   * 1. 使用 marked 库将 Markdown 转换为 HTML
   * 2. 使用 DOMPurify 净化 HTML，防止 XSS 攻击
   * 3. 如果转换失败，返回纯文本的 <pre> 标签
   * 
   * 安全性：
   * - DOMPurify 会移除所有潜在的恶意脚本
   * - 确保用户无法通过 Markdown 注入恶意代码
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
   * 获取净化后的 Diff HTML
   * 
   * 功能：返回经过 XSS 防护处理的版本对比 HTML
   * 
   * @returns {string} 净化后的 Diff HTML
   * 
   * 安全性：
   * - 虽然 Diff HTML 来自服务器，但仍需要净化
   * - 防止服务器被攻击后返回恶意脚本
   * - 多层防护，确保应用安全
   */
  const getSanitizedDiffHtml = useCallback(() => {
    return DOMPurify.sanitize(diffHtml || '');
  }, [diffHtml]);

  // ========== 返回值 ==========
  return {
    // ===== 状态 =====

    // 版本列表相关
    versions,              // 版本列表数组
    versionsLoading,       // 版本列表加载状态
    versionError,          // 版本列表错误信息

    // 版本预览相关
    previewVersion,        // 当前预览的版本对象
    previewContent,        // 预览内容(富文本格式)
    previewMarkdown,       // 预览内容(Markdown格式)

    // 版本对比相关
    compareFrom,           // 对比起始版本ID
    compareTo,             // 对比目标版本ID
    diffHtml,              // 对比结果HTML
    diffError,             // 对比错误信息
    diffLoading,           // 对比加载状态

    // ===== 方法 =====

    // 版本管理操作
    fetchVersions,         // 加载版本列表
    saveVersion,           // 保存新版本
    previewVersionById,    // 预览指定版本
    restoreVersion,        // 恢复到指定版本

    // 版本对比操作
    compareVersions,       // 执行版本对比
    setCompareFrom,        // 设置对比起始版本
    setCompareTo,          // 设置对比目标版本

    // 清除操作
    clearPreview,          // 清除预览状态
    clearCompare,          // 清除对比状态

    // 渲染辅助函数
    getPreviewMarkdownHtml,  // 获取Markdown预览HTML
    getSanitizedDiffHtml,    // 获取净化后的Diff HTML
  };
}
