import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  width = '100%', 
  height = '1rem' 
}) => {
  return (
    <div 
      className={`skeleton ${className}`}
      style={{ width, height }}
      role="status"
      aria-label="Loading..."
    />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="card">
      <div className="card-header">
        <Skeleton height="1.25rem" width="80%" />
        <Skeleton height="1rem" width="2rem" />
      </div>
      <div className="card-content">
        <Skeleton height="0.875rem" width="100%" className="mb-2" />
        <Skeleton height="0.875rem" width="60%" className="mb-4" />
        <div className="card-meta">
          <Skeleton height="1.5rem" width="3rem" className="rounded-full" />
          <Skeleton height="1rem" width="5rem" />
        </div>
      </div>
    </div>
  );
};

export const ColumnSkeleton: React.FC = () => {
  return (
    <div className="column">
      <div className="column-header">
        <div className="column-title-row">
          <Skeleton height="1rem" width="6rem" />
          <Skeleton height="1.5rem" width="1.5rem" className="rounded-full" />
        </div>
      </div>
      <div className="cards-container">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
};

export const BoardSkeleton: React.FC = () => {
  return (
    <div className="board">
      <div className="board-header">
        <div className="board-info">
          <Skeleton height="2rem" width="12rem" className="mb-2" />
          <Skeleton height="1rem" width="20rem" />
        </div>
        <div className="board-actions">
          <Skeleton height="2.5rem" width="6rem" />
          <Skeleton height="2.5rem" width="6rem" />
        </div>
      </div>
      <div className="columns-container">
        <div className="columns">
          <ColumnSkeleton />
          <ColumnSkeleton />
          <ColumnSkeleton />
          <ColumnSkeleton />
        </div>
      </div>
    </div>
  );
};

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`spinner ${sizeClasses[size]} ${className}`} role="status" aria-label="Loading">
      <span className="sr-only">Loading...</span>
    </div>
  );
};