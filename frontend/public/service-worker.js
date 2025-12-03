/**
 * MindFlow Service Worker
 * 提供离线支持和资源缓存
 */

const CACHE_VERSION = 'mindflow-v1.0.0';
const CACHE_NAME = `${CACHE_VERSION}`;

// 需要缓存的静态资源
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/assets/logo.png',
  '/placeholder.svg',
];

// API 缓存配置
const API_CACHE_NAME = `${CACHE_VERSION}-api`;
const API_CACHE_URLS = [
  '/api/users/profile',
  '/api/documents',
];

// 图片缓存配置
const IMAGE_CACHE_NAME = `${CACHE_VERSION}-images`;

// 字体缓存配置
const FONT_CACHE_NAME = `${CACHE_VERSION}-fonts`;

// 最大缓存数量
const MAX_CACHE_SIZE = {
  images: 50,
  api: 30,
};

/**
 * 安装事件 - 预缓存静态资源
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 安装中...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 缓存静态资源');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('[Service Worker] 安装完成');
        return self.skipWaiting(); // 立即激活
      })
      .catch((error) => {
        console.error('[Service Worker] 安装失败:', error);
      })
  );
});

/**
 * 激活事件 - 清理旧缓存
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 激活中...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // 删除旧版本缓存
            if (cacheName.startsWith('mindflow-') && cacheName !== CACHE_NAME) {
              console.log('[Service Worker] 删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] 激活完成');
        return self.clients.claim(); // 立即控制所有页面
      })
  );
});

/**
 * Fetch 事件 - 网络请求拦截
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求
  if (request.method !== 'GET') {
    return;
  }

  // 跳过 Chrome 扩展请求
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // 根据资源类型选择缓存策略
  if (request.destination === 'image') {
    // 图片：缓存优先策略
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE_NAME));
  } else if (request.destination === 'font') {
    // 字体：缓存优先策略
    event.respondWith(cacheFirstStrategy(request, FONT_CACHE_NAME));
  } else if (url.pathname.startsWith('/api/')) {
    // API：网络优先策略
    event.respondWith(networkFirstStrategy(request, API_CACHE_NAME));
  } else if (request.destination === 'document') {
    // HTML：网络优先，离线时返回离线页面
    event.respondWith(networkFirstWithOffline(request));
  } else {
    // 其他资源：缓存优先策略
    event.respondWith(cacheFirstStrategy(request, CACHE_NAME));
  }
});

/**
 * 缓存优先策略
 * 先查缓存，未命中再请求网络
 */
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log('[Service Worker] 缓存命中:', request.url);
      return cachedResponse;
    }

    console.log('[Service Worker] 缓存未命中，请求网络:', request.url);
    const networkResponse = await fetch(request);

    // 只缓存成功的响应
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
      
      // 限制缓存大小
      limitCacheSize(cacheName, MAX_CACHE_SIZE.images || 50);
    }

    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] 请求失败:', error);
    
    // 返回离线页面或占位图
    if (request.destination === 'image') {
      return caches.match('/placeholder.svg');
    }
    
    return new Response('Network error', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * 网络优先策略
 * 先请求网络，失败时返回缓存
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    // 缓存成功的响应
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      
      // 限制缓存大小
      limitCacheSize(cacheName, MAX_CACHE_SIZE.api || 30);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] 网络请求失败，返回缓存:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 网络优先策略 + 离线页面
 */
async function networkFirstWithOffline(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] 网络不可用，返回离线页面');
    const cachedResponse = await caches.match('/offline.html');
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

/**
 * 限制缓存大小
 */
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    // 删除最早的缓存项
    const deleteCount = keys.length - maxSize;
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
    console.log(`[Service Worker] 清理 ${deleteCount} 个缓存项`);
  }
}

/**
 * 消息事件 - 与页面通信
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

/**
 * 后台同步事件
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-documents') {
    event.waitUntil(syncDocuments());
  }
});

/**
 * 同步文档数据
 */
async function syncDocuments() {
  try {
    console.log('[Service Worker] 后台同步文档');
    // 这里可以实现离线编辑的数据同步逻辑
    return Promise.resolve();
  } catch (error) {
    console.error('[Service Worker] 同步失败:', error);
    return Promise.reject(error);
  }
}

/**
 * 推送通知事件
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || '您有新的消息',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
    },
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'MindFlow', options)
  );
});

/**
 * 通知点击事件
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
