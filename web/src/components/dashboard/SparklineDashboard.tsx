import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Activity, Building2, Filter,
  ChevronRight, Zap, DollarSign, Users, Percent
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface FacilitySparkline {
  facilityId: string;
  name: string;
  state: string;
  setting: string;
  currentPeriod: string;
  metrics: {
    operatingMargin: { current: number | null; trend: number[]; change: number };
    occupancy: { current: number | null; trend: number[]; change: number };
    skilledMix: { current: number | null; trend: number[]; change: number };
    revenuePerDay: { current: number | null; trend: number[]; change: number };
    laborCostPct: { current: number | null; trend: number[]; change: number };
  };
  overallScore: number;
  trend: 'up' | 'down' | 'stable';
  alerts: number;
}

interface SparklineDashboardResponse {
  facilities: FacilitySparkline[];
  portfolioMetrics: {
    avgMargin: number;
    avgOccupancy: number;
    avgSkilledMix: number;
    avgRevenue: number;
    totalFacilities: number;
    improvingCount: number;
    decliningCount: number;
  };
  periodRange: { start: string; end: string };
}

interface SparklineDashboardProps {
  onFacilityClick?: (facilityId: string) => void;
}

const METRIC_CONFIG = {
  operatingMargin: {
    label: 'Operating Margin',
    icon: Percent,
    color: '#667eea',
    format: (v: number) => `${v.toFixed(1)}%`,
    higherIsBetter: true
  },
  occupancy: {
    label: 'Occupancy',
    icon: Users,
    color: '#00d9a5',
    format: (v: number) => `${v.toFixed(1)}%`,
    higherIsBetter: true
  },
  skilledMix: {
    label: 'Skilled Mix',
    icon: Activity,
    color: '#ffa502',
    format: (v: number) => `${v.toFixed(1)}%`,
    higherIsBetter: true
  },
  revenuePerDay: {
    label: 'Revenue/Day',
    icon: DollarSign,
    color: '#a55eea',
    format: (v: number) => `$${v.toFixed(0)}`,
    higherIsBetter: true
  },
  laborCostPct: {
    label: 'Labor Cost %',
    icon: DollarSign,
    color: '#ff6b6b',
    format: (v: number) => `${v.toFixed(1)}%`,
    higherIsBetter: false
  }
};

type MetricKey = keyof typeof METRIC_CONFIG;

function MiniSparkline({
  data,
  color,
  width = 80,
  height = 30
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const chartData = data.map((value, idx) => ({ value, idx }));

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#gradient-${color.replace('#', '')})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SparklineDashboard({ onFacilityClick }: SparklineDashboardProps) {
  const [filterSetting, setFilterSetting] = useState<string>('all');
  const [filterTrend, setFilterTrend] = useState<'all' | 'up' | 'down' | 'stable'>('all');
  const [sortBy, setSortBy] = useState<'score' | MetricKey>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');

  const { data, isLoading, error } = useQuery<SparklineDashboardResponse>({
    queryKey: ['sparkline-dashboard'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3002/api/sparkline-dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
  });

  const filteredFacilities = useMemo(() => {
    if (!data) return [];

    let facilities = [...data.facilities];

    if (filterSetting !== 'all') {
      facilities = facilities.filter(f => f.setting === filterSetting);
    }

    if (filterTrend !== 'all') {
      facilities = facilities.filter(f => f.trend === filterTrend);
    }

    facilities.sort((a, b) => {
      let aVal: number, bVal: number;

      if (sortBy === 'score') {
        aVal = a.overallScore;
        bVal = b.overallScore;
      } else {
        aVal = a.metrics[sortBy].current ?? -999;
        bVal = b.metrics[sortBy].current ?? -999;
      }

      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return facilities;
  }, [data, filterSetting, filterTrend, sortBy, sortDirection]);

  const getChangeIndicator = (change: number, higherIsBetter: boolean) => {
    const isPositive = higherIsBetter ? change > 0 : change < 0;

    if (Math.abs(change) < 0.1) {
      return { icon: null, color: 'var(--text-muted)', text: '—' };
    }

    if (isPositive) {
      return {
        icon: <TrendingUp size={12} />,
        color: 'var(--success)',
        text: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
      };
    }

    return {
      icon: <TrendingDown size={12} />,
      color: 'var(--danger)',
      text: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
    };
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#00d9a5';
    if (score >= 50) return '#667eea';
    if (score >= 30) return '#ffa502';
    return '#ff4757';
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Loading dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <Activity size={48} className="text-muted" style={{ margin: '0 auto 16px' }} />
        <p className="text-danger">Failed to load dashboard</p>
      </div>
    );
  }

  return (
    <div className="sparkline-dashboard">
      {/* Portfolio Summary */}
      <div className="grid grid-cols-5 mb-6">
        <div className="card" style={{ padding: '20px' }}>
          <div className="flex items-center gap-3">
            <Building2 size={24} className="text-primary" />
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.portfolioMetrics.totalFacilities}
              </div>
              <div className="text-xs text-muted">Total Facilities</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div className="flex items-center gap-3">
            <Percent size={24} style={{ color: '#667eea' }} />
            <div>
              <div className="text-2xl font-bold" style={{ color: '#667eea' }}>
                {data.portfolioMetrics.avgMargin.toFixed(1)}%
              </div>
              <div className="text-xs text-muted">Avg Margin</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div className="flex items-center gap-3">
            <Users size={24} style={{ color: '#00d9a5' }} />
            <div>
              <div className="text-2xl font-bold" style={{ color: '#00d9a5' }}>
                {data.portfolioMetrics.avgOccupancy.toFixed(1)}%
              </div>
              <div className="text-xs text-muted">Avg Occupancy</div>
            </div>
          </div>
        </div>

        <div className="card" style={{
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(0, 217, 165, 0.2), rgba(0, 217, 165, 0.05))'
        }}>
          <div className="flex items-center gap-3">
            <TrendingUp size={24} className="text-success" />
            <div>
              <div className="text-2xl font-bold text-success">{data.portfolioMetrics.improvingCount}</div>
              <div className="text-xs text-muted">Improving</div>
            </div>
          </div>
        </div>

        <div className="card" style={{
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(255, 71, 87, 0.2), rgba(255, 71, 87, 0.05))'
        }}>
          <div className="flex items-center gap-3">
            <TrendingDown size={24} className="text-danger" />
            <div>
              <div className="text-2xl font-bold text-danger">{data.portfolioMetrics.decliningCount}</div>
              <div className="text-xs text-muted">Declining</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4" style={{ padding: '16px' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-muted" />
              <select
                value={filterSetting}
                onChange={(e) => setFilterSetting(e.target.value)}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              >
                <option value="all">All Settings</option>
                <option value="SNF">SNF</option>
                <option value="ALF">ALF</option>
                <option value="ILF">ILF</option>
              </select>

              <select
                value={filterTrend}
                onChange={(e) => setFilterTrend(e.target.value as any)}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              >
                <option value="all">All Trends</option>
                <option value="up">Improving</option>
                <option value="down">Declining</option>
                <option value="stable">Stable</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              >
                <option value="score">Overall Score</option>
                <option value="operatingMargin">Operating Margin</option>
                <option value="occupancy">Occupancy</option>
                <option value="skilledMix">Skilled Mix</option>
                <option value="revenuePerDay">Revenue/Day</option>
              </select>

              <button
                className="btn btn-secondary btn-icon"
                onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
                style={{ width: '32px', height: '32px' }}
              >
                {sortDirection === 'desc' ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('grid')}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              Grid
            </button>
            <button
              className={`btn ${viewMode === 'compact' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('compact')}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              Compact
            </button>
          </div>
        </div>
      </div>

      {/* Facilities Grid */}
      {viewMode === 'grid' ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredFacilities.map(facility => (
            <div
              key={facility.facilityId}
              className="card"
              onClick={() => onFacilityClick?.(facility.facilityId)}
              style={{
                padding: '16px',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '';
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>{facility.name}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>{facility.state}</span>
                    <span>•</span>
                    <span className="badge badge-info" style={{ fontSize: '10px' }}>{facility.setting}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: `conic-gradient(${getScoreColor(facility.overallScore)} ${facility.overallScore * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: getScoreColor(facility.overallScore)
                    }}>
                      {facility.overallScore.toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {(Object.entries(METRIC_CONFIG) as [MetricKey, typeof METRIC_CONFIG[MetricKey]][])
                  .slice(0, 4)
                  .map(([key, config]) => {
                    const metric = facility.metrics[key];
                    const changeIndicator = getChangeIndicator(metric.change, config.higherIsBetter);

                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted">{config.label}</span>
                          <span className="flex items-center gap-1" style={{ color: changeIndicator.color, fontSize: '10px' }}>
                            {changeIndicator.icon}
                            {changeIndicator.text}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                            {metric.current !== null ? config.format(metric.current) : 'N/A'}
                          </span>
                          <MiniSparkline data={metric.trend} color={config.color} width={60} height={20} />
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-center gap-2">
                  {facility.trend === 'up' && (
                    <span className="badge badge-success" style={{ fontSize: '10px' }}>
                      <TrendingUp size={10} style={{ marginRight: '4px' }} />
                      Improving
                    </span>
                  )}
                  {facility.trend === 'down' && (
                    <span className="badge badge-danger" style={{ fontSize: '10px' }}>
                      <TrendingDown size={10} style={{ marginRight: '4px' }} />
                      Declining
                    </span>
                  )}
                  {facility.trend === 'stable' && (
                    <span className="badge badge-info" style={{ fontSize: '10px' }}>Stable</span>
                  )}
                  {facility.alerts > 0 && (
                    <span className="badge badge-warning" style={{ fontSize: '10px' }}>
                      <Zap size={10} style={{ marginRight: '4px' }} />
                      {facility.alerts} alert{facility.alerts > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <ChevronRight size={16} className="text-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Compact table view */
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Facility</th>
                  <th style={{ textAlign: 'center' }}>Score</th>
                  {(Object.entries(METRIC_CONFIG) as [MetricKey, typeof METRIC_CONFIG[MetricKey]][]).map(([key, config]) => (
                    <th key={key} style={{ textAlign: 'center' }}>{config.label}</th>
                  ))}
                  <th style={{ textAlign: 'center' }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {filteredFacilities.map(facility => (
                  <tr
                    key={facility.facilityId}
                    onClick={() => onFacilityClick?.(facility.facilityId)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{facility.name}</div>
                      <div className="text-xs text-muted">{facility.state} • {facility.setting}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="font-bold" style={{ color: getScoreColor(facility.overallScore) }}>
                        {facility.overallScore.toFixed(0)}
                      </span>
                    </td>
                    {(Object.entries(METRIC_CONFIG) as [MetricKey, typeof METRIC_CONFIG[MetricKey]][]).map(([key, config]) => {
                      const metric = facility.metrics[key];
                      const changeIndicator = getChangeIndicator(metric.change, config.higherIsBetter);

                      return (
                        <td key={key} style={{ textAlign: 'center' }}>
                          <div className="flex items-center justify-center gap-2">
                            <MiniSparkline data={metric.trend} color={config.color} width={40} height={16} />
                            <div>
                              <div className="font-medium" style={{ fontSize: '12px' }}>
                                {metric.current !== null ? config.format(metric.current) : 'N/A'}
                              </div>
                              <div style={{ color: changeIndicator.color, fontSize: '10px' }}>
                                {changeIndicator.text}
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center' }}>
                      {facility.trend === 'up' && <TrendingUp size={16} className="text-success" />}
                      {facility.trend === 'down' && <TrendingDown size={16} className="text-danger" />}
                      {facility.trend === 'stable' && <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
