/**
 * useThrottle Hook
 * 节流 Hook，用于限制函数执行频率
 * 适用场景：滚动事件、窗口resize等高频事件
 */
import { useState, useEffect, useRef } from 'react';

/**
 * @param {any} value - 需要节流的值
 * @param {number} limit - 限制时间间隔（毫秒）
 * @returns {any} 节流后的值
 */
export function useThrottle(value, limit = 500) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}

/**
 * useThrottleCallback - 节流回调函数
 * @param {Function} callback - 需要节流的回调函数
 * @param {number} limit - 限制时间间隔（毫秒）
 * @returns {Function} 节流后的回调函数
 */
export function useThrottleCallback(callback, limit = 500) {
  const lastRan = useRef(Date.now());
  const timeoutRef = useRef(null);

  return (...args) => {
    const now = Date.now();
    
    if (now - lastRan.current >= limit) {
      callback(...args);
      lastRan.current = now;
    } else {
      // 清除之前的定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // 设置新的定时器
      timeoutRef.current = setTimeout(() => {
        callback(...args);
        lastRan.current = Date.now();
      }, limit - (now - lastRan.current));
    }
  };
}

export default useThrottle;
