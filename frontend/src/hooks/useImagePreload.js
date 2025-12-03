/**
 * useImagePreload Hook
 * 用于预加载关键图片，提升用户体验
 */
import { useEffect, useState } from 'react';

/**
 * 预加载单张图片
 * @param {string} src - 图片URL
 * @returns {object} - { loaded, error }
 */
export function useImagePreload(src) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!src) return;

    const img = new Image();
    
    img.onload = () => {
      setLoaded(true);
      setError(null);
    };

    img.onerror = (err) => {
      setError(err);
      setLoaded(false);
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { loaded, error };
}

/**
 * 预加载多张图片
 * @param {string[]} sources - 图片URL数组
 * @returns {object} - { loaded, progress, errors }
 */
export function useMultipleImagePreload(sources = []) {
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!sources || sources.length === 0) {
      setLoaded(true);
      return;
    }

    let loadedCount = 0;
    const errorList = [];

    const promises = sources.map((src, index) => {
      return new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
          loadedCount++;
          setProgress((loadedCount / sources.length) * 100);
          resolve({ success: true, index });
        };

        img.onerror = (err) => {
          loadedCount++;
          errorList.push({ src, error: err, index });
          setProgress((loadedCount / sources.length) * 100);
          resolve({ success: false, index });
        };

        img.src = src;
      });
    });

    Promise.all(promises).then(() => {
      setLoaded(true);
      setErrors(errorList);
    });
  }, [sources.join(',')]);

  return { loaded, progress, errors };
}

/**
 * 预加载关键资源（首屏图片）
 * @param {string[]} criticalImages - 关键图片URL数组
 */
export function useCriticalImagePreload(criticalImages = []) {
  useEffect(() => {
    if (!criticalImages || criticalImages.length === 0) return;

    // 使用 link rel="preload" 预加载关键图片
    const links = criticalImages.map((src) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
      return link;
    });

    return () => {
      // 清理
      links.forEach((link) => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [criticalImages.join(',')]);
}

export default useImagePreload;
