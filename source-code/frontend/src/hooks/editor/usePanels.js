import { useState, useCallback } from 'react';

/**
 * usePanels Hook - 侧边面板状态管理
 * 
 * 功能概述：
 * 统一管理编辑器页面中所有侧边面板和模态框的显示/隐藏状态
 * 
 * 管理的面板包括：
 * 1. 评论面板 (Comments) - 显示文档评论和讨论
 * 2. 任务面板 (Tasks) - 显示与文档相关的任务列表
 * 3. 聊天面板 (Chat) - 实时聊天功能
 * 4. 文件面板 (Files) - 文档附件和共享文件
 * 5. 通知面板 (Notifications) - 系统通知和提醒
 * 6. 视频会议面板 (Video Conference) - Jitsi 视频会议
 * 7. 分享模态框 (Share Modal) - 文档分享和权限设置
 * 8. 版本历史模态框 (Version Modal) - 文档版本管理
 * 
 * 设计理念：
 * - 集中管理：所有面板状态在一个 Hook 中统一管理
 * - 独立控制：每个面板都有独立的 toggle 函数
 * - 批量操作：提供 closeAllPanels 函数一次性关闭所有面板
 * - 灵活性：提供通用的 togglePanel 函数，支持动态切换
 * 
 * 使用场景：
 * - 用户点击工具栏按钮时，切换对应面板
 * - 切换到其他页面时，关闭所有面板
 * - 响应快捷键，快速打开/关闭面板
 */
export function usePanels() {
  const [showComments, setShowComments] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showVideoConference, setShowVideoConference] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);

  /**
   * 切换评论面板
   */
  const toggleComments = useCallback(() => {
    setShowComments(prev => !prev);
  }, []);

  /**
   * 切换任务面板
   */
  const toggleTasks = useCallback(() => {
    setShowTasks(prev => !prev);
  }, []);

  /**
   * 切换聊天面板
   */
  const toggleChat = useCallback(() => {
    setShowChat(prev => !prev);
  }, []);

  /**
   * 切换文件面板
   */
  const toggleFiles = useCallback(() => {
    setShowFiles(prev => !prev);
  }, []);

  /**
   * 切换通知面板
   */
  const toggleNotifications = useCallback(() => {
    setShowNotifications(prev => !prev);
  }, []);

  /**
   * 切换视频会议面板
   */
  const toggleVideoConference = useCallback(() => {
    setShowVideoConference(prev => !prev);
  }, []);

  /**
   * 切换分享模态框
   */
  const toggleShareModal = useCallback(() => {
    setShowShareModal(prev => !prev);
  }, []);

  /**
   * 切换版本历史模态框
   */
  const toggleVersionModal = useCallback(() => {
    setShowVersionModal(prev => !prev);
  }, []);

  /**
   * 关闭所有面板
   */
  const closeAllPanels = useCallback(() => {
    setShowComments(false);
    setShowTasks(false);
    setShowChat(false);
    setShowFiles(false);
    setShowNotifications(false);
    setShowVideoConference(false);
    setShowShareModal(false);
    setShowVersionModal(false);
  }, []);

  /**
   * 通用面板切换
   */
  const togglePanel = useCallback((panelName) => {
    const toggleMap = {
      comments: toggleComments,
      tasks: toggleTasks,
      chat: toggleChat,
      files: toggleFiles,
      notifications: toggleNotifications,
      videoConference: toggleVideoConference,
      share: toggleShareModal,
      version: toggleVersionModal,
    };

    const toggle = toggleMap[panelName];
    if (toggle) {
      toggle();
    }
  }, [
    toggleComments,
    toggleTasks,
    toggleChat,
    toggleFiles,
    toggleNotifications,
    toggleVideoConference,
    toggleShareModal,
    toggleVersionModal,
  ]);

  return {
    // 状态
    showComments,
    showTasks,
    showChat,
    showFiles,
    showNotifications,
    showVideoConference,
    showShareModal,
    showVersionModal,

    // 方法
    toggleComments,
    toggleTasks,
    toggleChat,
    toggleFiles,
    toggleNotifications,
    toggleVideoConference,
    toggleShareModal,
    toggleVersionModal,
    togglePanel,
    closeAllPanels,

    // Setters（用于外部直接设置）
    setShowComments,
    setShowTasks,
    setShowChat,
    setShowFiles,
    setShowNotifications,
    setShowVideoConference,
    setShowShareModal,
    setShowVersionModal,
  };
}
