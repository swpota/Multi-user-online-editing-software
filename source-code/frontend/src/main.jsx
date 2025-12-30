import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { register as registerSW } from './utils/registerServiceWorker'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 注册 Service Worker（仅在生产环境）
if (import.meta.env.PROD) {
  registerSW().then(() => {
    console.log('[PWA] Service Worker 已注册');
  }).catch((error) => {
    console.error('[PWA] Service Worker 注册失败:', error);
  });
}
