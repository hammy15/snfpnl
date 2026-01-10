import { useQuery } from '@tanstack/react-query';
import { Grid3X3, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface HeatmapCell {
  facilityId: number;
  facilityName: string;
  value: number;
  percentile: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

interface HeatmapKpi {
  kpiId: string;
  kpiName: string;
  unit: string;
  higherIsBetter: boolean;
  facilities: HeatmapCell[];
  average: number;
  median: number;
}

interface HeatmapResponse {
  period: string;
  periodLabel: string;
  kpis: HeatmapKpi[];
  facilities: Array<{ id: number; name: string }>;
}

interface PortfolioHeatmapProps {
  periodId: string;
  onFacilityClick?: (facilityId: number) => void;
}

export function PortfolioHeatmap({ periodId, onFacilityClick }: PortfolioHeatmapProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<HeatmapResponse>({
    queryKey: ['portfolio-heatmap', periodId],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl-production.up.railway.app/api/portfolio-heatmap/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch heatmap data');
      return response.json();
    },
  });

  const getStatusBg = (status: string) => {
    const colors: Record<string, string> = {
      excellent: 'rgba(0, 217, 165, 0.9)',
      good: 'rgba(61, 214, 165, 0.7)',
      fair: 'rgba(241, 196, 15, 0.6)',
      poor: 'rgba(255, 127, 80, 0.7)',
      critical: 'rgba(255, 71, 87, 0.9)',
    };
    return colors[status] || 'rgba(102, 126, 234, 0.5)';
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'percentage') return `${value.toFixed(1)}%`;
    if (unit === 'currency') return `$${value.toFixed(0)}`;
    if (unit === 'hours') return value.toFixed(2);
    return value.toFixed(1);
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card">
        <div className="error">Failed to load heatmap data</div>
      </div>
    );
  }

  const displayKpis = selectedKpi
    ? data.kpis.filter(k => k.kpiId === selectedKpi)
    : data.kpis.slice(0, 4); // Show top 4 by default

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Grid3X3 size={20} />
          Portfolio Heatmap
          <span className="badge badge-info" style={{ marginLeft: '8px' }}>
            {data.facilities.length} facilities
          </span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          <p className="text-sm text-muted mb-4">{data.periodLabel}</p>

          {/* KPI filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              className={`btn ${selectedKpi === null ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedKpi(null)}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Top 4 Metrics
            </button>
            {data.kpis.map(kpi => (
              <button
                key={kpi.kpiId}
                className={`btn ${selectedKpi === kpi.kpiId ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedKpi(kpi.kpiId)}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                {kpi.kpiName}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <span className="text-muted">Performance:</span>
            {['excellent', 'good', 'fair', 'poor', 'critical'].map(status => (
              <span key={status} className="flex items-center gap-1">
                <span style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  background: getStatusBg(status)
                }} />
                <span className="text-muted" style={{ textTransform: 'capitalize' }}>{status}</span>
              </span>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="card" style={{ padding: '16px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '2px' }}>
              <thead>
                <tr>
                  <th style={{
                    textAlign: 'left',
                    padding: '8px',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    fontSize: '12px',
                    minWidth: '150px'
                  }}>
                    Facility
                  </th>
                  {displayKpis.map(kpi => (
                    <th key={kpi.kpiId} style={{
                      textAlign: 'center',
                      padding: '8px',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                      fontSize: '11px',
                      minWidth: '100px'
                    }}>
                      {kpi.kpiName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.facilities.map(facility => (
                  <tr key={facility.id}>
                    <td style={{
                      padding: '8px',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      cursor: onFacilityClick ? 'pointer' : 'default'
                    }} onClick={() => onFacilityClick?.(facility.id)}>
                      <span style={{
                        borderBottom: onFacilityClick ? '1px dashed rgba(255,255,255,0.3)' : 'none'
                      }}>
                        {facility.name.length > 25 ? facility.name.substring(0, 25) + '...' : facility.name}
                      </span>
                    </td>
                    {displayKpis.map(kpi => {
                      const cell = kpi.facilities.find(f => f.facilityId === facility.id);
                      if (!cell) {
                        return (
                          <td key={kpi.kpiId} style={{
                            padding: '4px',
                            textAlign: 'center'
                          }}>
                            <div style={{
                              padding: '8px 4px',
                              borderRadius: '6px',
                              background: 'rgba(255,255,255,0.05)',
                              color: 'var(--text-muted)',
                              fontSize: '12px'
                            }}>
                              N/A
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={kpi.kpiId} style={{
                          padding: '4px',
                          textAlign: 'center'
                        }}>
                          <div
                            style={{
                              padding: '8px 4px',
                              borderRadius: '6px',
                              background: getStatusBg(cell.status),
                              color: ['excellent', 'good', 'critical'].includes(cell.status) ? '#0f0f1a' : '#fff',
                              fontWeight: 600,
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'transform 0.1s ease'
                            }}
                            title={`${cell.facilityName}: ${formatValue(cell.value, kpi.unit)} (${cell.percentile.toFixed(0)}th percentile)`}
                            onClick={() => onFacilityClick?.(facility.id)}
                          >
                            {formatValue(cell.value, kpi.unit)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary statistics */}
          <div className="grid grid-cols-4 mt-4">
            {displayKpis.map(kpi => (
              <div key={kpi.kpiId} className="card" style={{ padding: '12px' }}>
                <div className="text-xs text-muted mb-1">{kpi.kpiName}</div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs text-muted">Average</div>
                    <div className="font-bold">{formatValue(kpi.average, kpi.unit)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">Median</div>
                    <div className="font-bold">{formatValue(kpi.median, kpi.unit)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
