import { useState, useCallback } from 'react';
import api from '../../api';

/**
 * useLock Hook
 * 管理文档锁定功能
 */
export function useLock(documentId, isEditor) {
  const [lockProcessing, setLockProcessing] = useState(false);

  /**
   * 切换文档锁定状态
   */
  const toggleLock = useCallback(async (isLocked, updateLockState) => {
    if (!isEditor || lockProcessing) return;

    try {
      setLockProcessing(true);
      
      if (isLocked) {
        // 解锁文档
        await api.post(`/documents/${documentId}/unlock`);
        updateLockState(false, null);
      } else {
        // 锁定文档
        const response = await api.post(`/documents/${documentId}/lock`);
        updateLockState(true, response.data.locked_by);
      }
    } catch (error) {
      console.error('切换锁定状态失败:', error);
      alert(error.response?.data?.error || '操作失败');
    } finally {
      setLockProcessing(false);
    }
  }, [documentId, isEditor, lockProcessing]);

  return {
    lockProcessing,
    toggleLock,
  };
}
