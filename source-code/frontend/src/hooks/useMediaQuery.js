/**
 * useMediaQuery Hook
 * 用于响应式设计的媒体查询 Hook
 */
import { useState, useEffect } from 'react';

/**
 * 基础媒体查询 Hook
 * @param {string} query - 媒体查询字符串
 * @returns {boolean} - 是否匹配
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    // 设置初始值
    setMatches(mediaQuery.matches);

    // 监听变化
    const handler = (event) => setMatches(event.matches);
    
    // 兼容不同浏览器
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      // 旧版浏览器
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  return matches;
}

/**
 * 预定义的断点 Hook
 */
export function useBreakpoint() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isLargeDesktop = useMediaQuery('(min-width: 1440px)');

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    // 便捷判断
    isSmallScreen: isMobile,
    isMediumScreen: isTablet,
    isLargeScreen: isDesktop || isLargeDesktop,
  };
}

/**
 * 获取设备类型
 */
export function useDeviceType() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  if (isDesktop) return 'desktop';
  return 'unknown';
}

/**
 * 检测是否是触摸设备
 */
export function useTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0
      );
    };

    checkTouch();
  }, []);

  return isTouch;
}

/**
 * 获取视口尺寸
 */
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
}

/**
 * 检测屏幕方向
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState(
    window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  );

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      );
    };

    window.addEventListener('resize', handleOrientationChange);
    return () => window.removeEventListener('resize', handleOrientationChange);
  }, []);

  return orientation;
}

export default useMediaQuery;
