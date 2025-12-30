/**
 * LazyImage 懒加载图片组件
 * 
 * 功能：
 * - 图片懒加载（Intersection Observer）
 * - 占位符显示
 * - 模糊加载效果
 * - 响应式图片支持
 * - 错误处理
 */
import React, { useState, useEffect, useRef } from 'react';
import '../../styles/components/common/LazyImage.css';

const LazyImage = ({
  src,
  alt = '',
  placeholder = '/placeholder.png', // 占位图
  className = '',
  width,
  height,
  srcSet, // 响应式图片
  sizes, // 响应式尺寸
  blurHash, // 模糊哈希（可选）
  onLoad,
  onError,
  style = {},
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  // Intersection Observer 实现懒加载
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // 提前50px开始加载
        threshold: 0.01,
      }
    );

    observer.observe(imgRef.current);

    return () => {
      if (observer) observer.disconnect();
    };
  }, []);

  // 处理图片加载成功
  const handleLoad = (e) => {
    setIsLoaded(true);
    setHasError(false);
    if (onLoad) onLoad(e);
  };

  // 处理图片加载失败
  const handleError = (e) => {
    setHasError(true);
    setIsLoaded(false);
    if (onError) onError(e);
  };

  // 生成响应式图片属性
  const imgProps = {
    ref: imgRef,
    alt,
    className: `lazy-image ${isLoaded ? 'loaded' : ''} ${hasError ? 'error' : ''} ${className}`,
    onLoad: handleLoad,
    onError: handleError,
    style: {
      width: width || '100%',
      height: height || 'auto',
      ...style,
    },
    ...props,
  };

  // 如果需要响应式图片
  if (srcSet) {
    imgProps.srcSet = isInView ? srcSet : undefined;
    imgProps.sizes = sizes;
  }

  return (
    <div className="lazy-image-wrapper" style={{ width, height }}>
      {/* 占位符或模糊背景 */}
      {!isLoaded && !hasError && (
        <div 
          className="lazy-image-placeholder"
          style={{
            backgroundColor: blurHash || '#f0f0f0',
            width: width || '100%',
            height: height || '100%',
          }}
        >
          <div className="lazy-image-spinner">
            <svg className="spinner" viewBox="0 0 50 50">
              <circle
                className="path"
                cx="25"
                cy="25"
                r="20"
                fill="none"
                strokeWidth="4"
              />
            </svg>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {hasError && (
        <div className="lazy-image-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p>图片加载失败</p>
        </div>
      )}

      {/* 实际图片 */}
      <img
        {...imgProps}
        src={isInView ? src : placeholder}
        loading="lazy" // 浏览器原生懒加载（额外保障）
      />
    </div>
  );
};

export default React.memo(LazyImage);
