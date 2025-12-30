/**
 * Service Worker 注册工具
 * 提供 PWA 离线支持
 */

/**
 * 注册 Service Worker
 */
export async function register() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      console.log('[PWA] Service Worker 注册成功:', registration.scope);

      // 监听更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[PWA] 发现新版本 Service Worker');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新 Service Worker 已安装，但旧的仍在运行
            console.log('[PWA] 新版本可用，等待激活');
            showUpdateNotification(registration);
          }
        });
      });

      // 检查更新
      if (registration.waiting) {
        showUpdateNotification(registration);
      }

      // 定期检查更新（每小时）
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);

      return registration;
    } catch (error) {
      console.error('[PWA] Service Worker 注册失败:', error);
    }
  } else {
    console.warn('[PWA] 当前浏览器不支持 Service Worker');
  }
}

/**
 * 注销 Service Worker
 */
export async function unregister() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.unregister();
      console.log('[PWA] Service Worker 已注销');
    } catch (error) {
      console.error('[PWA] Service Worker 注销失败:', error);
    }
  }
}

/**
 * 显示更新通知
 */
function showUpdateNotification(registration) {
  const shouldUpdate = window.confirm(
    'MindFlow 有新版本可用！\n点击确定立即更新，点击取消稍后更新。'
  );

  if (shouldUpdate) {
    // 告诉 Service Worker 跳过等待
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // 刷新页面
    window.location.reload();
  }
}

/**
 * 清除所有缓存
 */
export async function clearCache() {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({ type: 'CLEAR_CACHE' });
      console.log('[PWA] 缓存清除指令已发送');
    }
  }
}

/**
 * 检查是否在PWA模式下运行
 */
export function isPWA() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone ||
    document.referrer.includes('android-app://')
  );
}

/**
 * 请求通知权限
 */
export async function requestNotificationPermission() {
  if ('Notification' in window && 'serviceWorker' in navigator) {
    const permission = await Notification.requestPermission();
    console.log('[PWA] 通知权限:', permission);
    return permission === 'granted';
  }
  return false;
}

/**
 * 订阅推送通知
 */
export async function subscribeToPush() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          // 这里需要替换为实际的 VAPID public key
          'YOUR_VAPID_PUBLIC_KEY'
        ),
      });
      
      console.log('[PWA] 推送订阅成功:', subscription);
      return subscription;
    } catch (error) {
      console.error('[PWA] 推送订阅失败:', error);
    }
  }
  return null;
}

/**
 * 工具函数：将 Base64 转换为 Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default {
  register,
  unregister,
  clearCache,
  isPWA,
  requestNotificationPermission,
  subscribeToPush,
};
