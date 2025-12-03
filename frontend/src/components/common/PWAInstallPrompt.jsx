/**
 * PWA 安装提示组件
 * 提示用户将应用添加到主屏幕
 */
import React, { useState, useEffect } from 'react';
import '../../styles/components/common/PWAInstallPrompt.css';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 检测 iOS 设备
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // 监听 beforeinstallprompt 事件（Android/Chrome）
    const handleBeforeInstallPrompt = (e) => {
      // 阻止默认的安装提示
      e.preventDefault();
      // 保存事件以便稍后触发
      setDeferredPrompt(e);
      
      // 检查用户是否已经安装
      if (!isAppInstalled()) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS 设备显示手动安装提示
    if (iOS && !isAppInstalled()) {
      // 延迟显示，避免打扰用户
      setTimeout(() => setShowPrompt(true), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // 检查应用是否已安装
  const isAppInstalled = () => {
    // 检查是否在 PWA 模式下运行
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    // 检查 localStorage
    return localStorage.getItem('pwa-dismissed') === 'true';
  };

  // 处理安装点击（Android/Chrome）
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // 显示安装提示
    deferredPrompt.prompt();

    // 等待用户选择
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('[PWA] 用户接受了安装');
    } else {
      console.log('[PWA] 用户拒绝了安装');
    }

    // 清除保存的事件
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  // 关闭提示
  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="pwa-install-prompt">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        
        <div className="pwa-install-text">
          <h3 className="pwa-install-title">安装 MindFlow 应用</h3>
          <p className="pwa-install-description">
            {isIOS 
              ? '点击分享按钮，然后选择"添加到主屏幕"'
              : '将 MindFlow 添加到主屏幕，获得更快的访问速度和离线支持'
            }
          </p>
        </div>

        <div className="pwa-install-actions">
          {!isIOS && deferredPrompt && (
            <button 
              className="pwa-install-button pwa-install-button-primary"
              onClick={handleInstallClick}
            >
              立即安装
            </button>
          )}
          <button 
            className="pwa-install-button pwa-install-button-secondary"
            onClick={handleDismiss}
          >
            {isIOS ? '知道了' : '稍后再说'}
          </button>
        </div>
      </div>

      {/* iOS 安装指引 */}
      {isIOS && (
        <div className="pwa-ios-guide">
          <p className="pwa-ios-guide-title">📱 安装步骤：</p>
          <ol className="pwa-ios-guide-steps">
            <li>点击底部的 <strong>分享</strong> 按钮</li>
            <li>选择 <strong>添加到主屏幕</strong></li>
            <li>点击右上角的 <strong>添加</strong></li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default PWAInstallPrompt;
