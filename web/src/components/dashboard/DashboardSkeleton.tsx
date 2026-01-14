/**
 * Skeleton loader for Dashboard while data is loading
 */

import { Skeleton, SkeletonKPICard, SkeletonChart, SkeletonTable } from '../ui/Skeleton';

export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton animate-fade-in">
      {/* Header with period badge */}
      <div className="dashboard-skeleton__header">
        <Skeleton variant="text" width={200} height={24} />
        <Skeleton variant="rounded" width={120} height={32} />
      </div>

      {/* Setting tabs */}
      <div className="dashboard-skeleton__tabs">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} variant="rounded" width={100} height={40} />
        ))}
      </div>

      {/* View tabs */}
      <div className="dashboard-skeleton__tabs" style={{ marginBottom: 24 }}>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} variant="rounded" width={120} height={48} />
        ))}
      </div>

      {/* Portfolio Summary Card */}
      <div className="cascadia-summary mb-6">
        <div className="cascadia-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <Skeleton variant="text" width={200} height={20} />
            <Skeleton variant="rounded" width={100} height={24} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton variant="text" width="60%" height={14} />
                <Skeleton variant="text" width="80%" height={28} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-skeleton__kpis">
        {[1, 2, 3, 4].map(i => (
          <SkeletonKPICard key={i} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="dashboard-skeleton__charts">
        <SkeletonChart height={200} />
        <SkeletonChart height={200} />
        <SkeletonChart height={200} />
      </div>

      {/* Insights Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Skeleton variant="circular" width={24} height={24} />
          <Skeleton variant="text" width={180} height={20} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton-card" style={{ padding: 16 }}>
              <Skeleton variant="text" width="80%" height={16} />
              <Skeleton variant="text" width="100%" height={14} />
              <Skeleton variant="text" width="60%" height={14} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardAnalyticsSkeleton() {
  return (
    <div className="dashboard-skeleton">
      {/* Performance Tables */}
      <div className="dashboard-skeleton__tables">
        <div>
          <Skeleton variant="text" width={200} height={20} className="mb-4" />
          <SkeletonTable rows={6} cols={4} />
        </div>
        <div>
          <Skeleton variant="text" width={200} height={20} className="mb-4" />
          <SkeletonTable rows={6} cols={4} />
        </div>
      </div>

      {/* T12M Section */}
      <div style={{ marginTop: 24 }}>
        <Skeleton variant="text" width={250} height={24} className="mb-4" />
        <SkeletonChart height={300} />
      </div>
    </div>
  );
}

export function DashboardExportsSkeleton() {
  return (
    <div className="dashboard-skeleton">
      {/* Narrative Report Section */}
      <div className="skeleton-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <Skeleton variant="circular" width={48} height={48} />
          <div style={{ flex: 1 }}>
            <Skeleton variant="text" width={200} height={20} />
            <Skeleton variant="text" width={300} height={14} />
          </div>
          <Skeleton variant="rounded" width={140} height={40} />
        </div>
      </div>

      {/* Financial Packet Section */}
      <div className="skeleton-card" style={{ padding: 24 }}>
        <Skeleton variant="text" width={250} height={24} className="mb-4" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" height={44} />
          ))}
        </div>
        <Skeleton variant="rounded" width={160} height={44} />
      </div>
    </div>
  );
}
