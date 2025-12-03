import { useState, useCallback } from 'react';
import api from '../../api';

/**
 * useLock Hook - 文档锁定管理
 * 
 * 功能概述：
 * 文档锁定功能允许用户临时"锁定"文档，防止其他用户同时编辑，避免编辑冲突
 * 
 * 使用场景：
 * 1. 用户需要进行重要的编辑，不希望被其他人的修改干扰
 * 2. 进行大规模的文档重构或格式调整
 * 3. 需要确保文档在特定时间段内保持稳定状态
 * 
 * 锁定机制：
 * - 锁定后，只有锁定者可以编辑文档
 * - 其他用户可以查看文档，但无法修改
 * - 锁定者可以随时解锁文档
 * - 服务器端会设置锁定超时，防止用户忘记解锁
 * 
 * 注意事项：
 * - 锁定是临时的，不是永久的权限变更
 * - 管理员可能有权限强制解锁
 * - 锁定状态会通过 WebSocket 实时同步给所有在线用户
 * 
 * @param {string} documentId - 文档ID
 * @param {boolean} isEditor - 当前用户是否有编辑权限
 */
export function useLock(documentId, isEditor) {
  // 锁定操作进行中的状态，防止重复点击
  const [lockProcessing, setLockProcessing] = useState(false);

  /**
   * 切换文档锁定状态
   * 
   * 功能：锁定 ↔ 解锁 的切换
   * 
   * @param {boolean} isLocked - 当前文档是否已锁定
   * @param {Function} updateLockState - 更新锁定状态的回调函数
   * 
   * 工作流程：
   * 1. 检查用户权限和操作状态
   * 2. 根据当前锁定状态，调用对应的 API
   *    - 已锁定 → 调用解锁 API
   *    - 未锁定 → 调用锁定 API
   * 3. API 成功后，更新本地锁定状态
   * 4. 处理错误情况，显示友好的错误提示
   * 
   * 错误处理：
   * - 如果文档已被其他用户锁定，会提示无法锁定
   * - 如果网络错误，会提示操作失败
   * - 所有错误都会通过 alert 显示给用户
   */
  const toggleLock = useCallback(async (isLocked, updateLockState) => {
    // 权限检查：只有编辑者才能锁定/解锁文档
    if (!isEditor || lockProcessing) return;

    try {
      setLockProcessing(true); // 设置处理中状态，防止重复点击

      if (isLocked) {
        // 解锁文档
        await api.post(`/documents/${documentId}/unlock`);
        updateLockState(false, null); // 更新状态：未锁定，无锁定者
      } else {
        // 锁定文档
        const response = await api.post(`/documents/${documentId}/lock`);
        // 更新状态：已锁定，锁定者为当前用户
        updateLockState(true, response.data.locked_by);
      }
    } catch (error) {
      console.error('切换锁定状态失败:', error);

      // 显示友好的错误提示
      // 优先使用服务器返回的错误信息，否则使用默认提示
      alert(error.response?.data?.error || '操作失败');
    } finally {
      setLockProcessing(false); // 无论成功失败，都要重置处理状态
    }
  }, [documentId, isEditor, lockProcessing]);

  return {
    lockProcessing,  // 锁定操作是否正在进行中
    toggleLock,      // 切换锁定状态的函数
  };
}
