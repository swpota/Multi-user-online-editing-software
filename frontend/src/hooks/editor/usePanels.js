import { useState, useCallback } from 'react';

/**
 * usePanels Hook
 * 管理所有侧边面板的显示状态
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
