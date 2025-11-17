import React from "react";
import "../styles/components/Skeleton.css";

/**
 * 骨架屏组件
 */
export function SkeletonLine({ width = "100%" }) {
  return <div className="skeleton-line" style={{ width }} />;
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <SkeletonLine width="60%" />
        <SkeletonLine width="30%" />
      </div>
      <div className="skeleton-card-body">
        <SkeletonLine width="90%" />
        <SkeletonLine width="70%" />
        <SkeletonLine width="50%" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
