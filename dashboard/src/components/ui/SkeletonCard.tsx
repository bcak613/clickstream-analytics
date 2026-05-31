import React from 'react';

interface SkeletonCardProps {
  className?: string;
  height?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ 
  className = '', 
  height = 'h-48' 
}) => {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant rounded-xl p-5 w-full animate-shimmer ${height} ${className}`}>
      <div className="h-4 bg-surface-container-high rounded w-1/3 mb-4 animate-shimmer"></div>
      <div className="h-8 bg-surface-container-high rounded w-2/3 mb-2 animate-shimmer"></div>
      <div className="h-2 bg-surface-container-high rounded w-1/2 animate-shimmer"></div>
    </div>
  );
};
