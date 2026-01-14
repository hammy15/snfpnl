/**
 * Skeleton loader for FacilityDetail while data is loading
 */

import { Skeleton, SkeletonKPICard, SkeletonChart, SkeletonTable } from '../ui/Skeleton';

export function FacilityDetailSkeleton() {
  return (
    <div className="facility-skeleton animate-fade-in">
      {/* Back button */}
      <div style={{ marginBottom: 24 }}>
        <Skeleton variant="rounded" width={160} height={36} />
      </div>

      {/* Facility Header */}
      <div className="facility-skeleton__header">
        <Skeleton variant="rounded" width={64} height={64} />
        <div className="facility-skeleton__header-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Skeleton variant="text" width={280} height={32} />
            <Skeleton variant="circular" width={32} height={32} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Skeleton variant="rounded" width={80} height={24} />
            <Skeleton variant="rounded" width={60} height={24} />
            <Skeleton variant="text" width={80} height={20} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Skeleton variant="rounded" width={100} height={32} />
          <Skeleton variant="rounded" width={140} height={40} />
          <Skeleton variant="rounded" width={100} height={40} />
        </div>
      </div>

      {/* View Tabs */}
      <div className="facility-skeleton__tabs">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} variant="rounded" width={120} height={48} />
        ))}
      </div>

      {/* Tab Content */}
      <FacilityOverviewSkeleton />
    </div>
  );
}

export function FacilityOverviewSkeleton() {
  return (
    <div className="facility-skeleton__content">
      {/* Net Income Card */}
      <div className="skeleton-card" style={{ padding: 24 }}>
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

      {/* CMS Ratings */}
      <div className="skeleton-card" style={{ padding: 24 }}>
        <Skeleton variant="text" width={180} height={20} className="mb-4" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ textAlign: 'center' }}>
              <Skeleton variant="text" width="80%" height={14} style={{ margin: '0 auto' }} />
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
                {[1, 2, 3, 4, 5].map(j => (
                  <Skeleton key={j} variant="circular" width={20} height={20} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="facility-skeleton__row">
        <SkeletonKPICard />
        <SkeletonKPICard />
        <SkeletonKPICard />
      </div>
    </div>
  );
}

export function FacilityFinancialsSkeleton() {
  return (
    <div className="facility-skeleton__content">
      {/* Revenue & Margins Section */}
      <div className="skeleton-card" style={{ padding: 24, marginBottom: 24 }}>
        <Skeleton variant="text" width={180} height={20} className="mb-4" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i}>
              <Skeleton variant="text" width="60%" height={14} />
              <Skeleton variant="text" width="80%" height={24} />
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="facility-skeleton__row">
        <SkeletonChart height={200} />
        <SkeletonChart height={200} />
      </div>

      {/* KPI Table */}
      <div style={{ marginTop: 24 }}>
        <Skeleton variant="text" width={150} height={20} className="mb-4" />
        <SkeletonTable rows={8} cols={5} />
      </div>
    </div>
  );
}

export function FacilityAnalysisSkeleton() {
  return (
    <div className="facility-skeleton__content">
      {/* T12M Chart */}
      <SkeletonChart height={250} />

      {/* Correlation & Peer Comparison */}
      <div className="facility-skeleton__row" style={{ marginTop: 24 }}>
        <SkeletonChart height={200} />
        <SkeletonChart height={200} />
      </div>

      {/* Goals & Alerts */}
      <div className="facility-skeleton__row" style={{ marginTop: 24 }}>
        <div className="skeleton-card" style={{ padding: 24 }}>
          <Skeleton variant="text" width={120} height={20} className="mb-4" />
          {[1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <Skeleton variant="text" width="40%" height={16} />
              <Skeleton variant="rounded" width="30%" height={20} />
              <Skeleton variant="rounded" width="20%" height={20} />
            </div>
          ))}
        </div>
        <div className="skeleton-card" style={{ padding: 24 }}>
          <Skeleton variant="text" width={100} height={20} className="mb-4" />
          {[1, 2, 3].map(i => (
            <div key={i} style={{ marginBottom: 12 }}>
              <Skeleton variant="text" width="90%" height={14} />
              <Skeleton variant="text" width="60%" height={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FacilityReportsSkeleton() {
  return (
    <div className="facility-skeleton__content">
      {/* Executive Summary */}
      <div className="skeleton-card" style={{ padding: 24, marginBottom: 24 }}>
        <Skeleton variant="text" width={200} height={20} className="mb-4" />
        <Skeleton variant="text" width="100%" height={14} />
        <Skeleton variant="text" width="100%" height={14} />
        <Skeleton variant="text" width="80%" height={14} />
        <Skeleton variant="text" width="90%" height={14} />
      </div>

      {/* Narrative Report */}
      <div className="skeleton-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Skeleton variant="circular" width={48} height={48} />
          <div style={{ flex: 1 }}>
            <Skeleton variant="text" width={180} height={20} />
            <Skeleton variant="text" width={250} height={14} />
          </div>
          <Skeleton variant="rounded" width={140} height={40} />
        </div>
      </div>

      {/* Financial Packet */}
      <div className="skeleton-card" style={{ padding: 24, marginBottom: 24 }}>
        <Skeleton variant="text" width={220} height={24} className="mb-4" />
        <div style={{ display: 'flex', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" width={100} height={40} />
          ))}
        </div>
      </div>

      {/* Annotations */}
      <div className="skeleton-card" style={{ padding: 24 }}>
        <Skeleton variant="text" width={150} height={20} className="mb-4" />
        <Skeleton variant="rounded" height={80} />
      </div>
    </div>
  );
}
