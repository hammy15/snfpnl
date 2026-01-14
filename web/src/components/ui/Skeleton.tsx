/**
 * Skeleton loading component for content placeholders
 */

import './Skeleton.css';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
  style?: React.CSSProperties;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
  animation = 'pulse',
  style: customStyle,
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...customStyle,
  };

  return (
    <div
      className={`skeleton skeleton--${variant} skeleton--${animation} ${className}`}
      style={style}
    />
  );
}

// Preset skeleton components for common patterns
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`skeleton-text ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton-card ${className}`}>
      <Skeleton variant="rectangular" height={120} />
      <div className="skeleton-card__content">
        <Skeleton variant="text" width="70%" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
  );
}

export function SkeletonKPICard({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton-kpi-card ${className}`}>
      <div className="skeleton-kpi-card__header">
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton variant="text" width="60%" height={16} />
      </div>
      <Skeleton variant="text" width="80%" height={32} className="skeleton-kpi-card__value" />
      <Skeleton variant="text" width="50%" height={14} />
    </div>
  );
}

export function SkeletonChart({ height = 200, className = '' }: { height?: number; className?: string }) {
  return (
    <div className={`skeleton-chart ${className}`}>
      <Skeleton variant="text" width="40%" height={20} className="skeleton-chart__title" />
      <Skeleton variant="rounded" height={height} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className = '' }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={`skeleton-table ${className}`}>
      <div className="skeleton-table__header">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="text" height={16} />
        ))}
      </div>
      <div className="skeleton-table__body">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="skeleton-table__row">
            {Array.from({ length: cols }).map((_, colIdx) => (
              <Skeleton
                key={colIdx}
                variant="text"
                width={colIdx === 0 ? '80%' : '60%'}
                height={14}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonAvatar({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <Skeleton variant="circular" width={size} height={size} className={className} />;
}

export function SkeletonBadge({ width = 60, className = '' }: { width?: number; className?: string }) {
  return <Skeleton variant="rounded" width={width} height={24} className={className} />;
}
