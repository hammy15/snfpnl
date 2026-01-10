import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Target, ChevronDown, ChevronRight, TrendingUp, TrendingDown,
  Minus, BarChart2
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  ReferenceLine
} from 'recharts';

interface BenchmarkMetric {
  kpiId: string;
  kpiName: string;
  category: string;
  yourValue: number;
  benchmark25: number;
  benchmark50: number;
  benchmark75: number;
  benchmark90: number;
  industryAvg: number;
  topPerformer: number;
  percentile: number;
  gap: number;
  gapPct: number;
  higherIsBetter: boolean;
}

interface BenchmarkData {
  facilityId: string;
  facilityName: string;
  periodId: string;
  benchmarkSource: string;
  metrics: BenchmarkMetric[];
  overallScore: number;
  overallPercentile: number;
}

interface BenchmarkComparisonProps {
  facilityId: number;
  periodId: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Revenue': '#667eea',
  'Costs': '#ff6b6b',
  'Margins': '#00d9a5',
  'Operations': '#ffc107',
  'Staffing': '#17a2b8',
  'Quality': '#9b59b6'
};

export function BenchmarkComparison({ facilityId, periodId }: BenchmarkComparisonProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'radar' | 'gap'>('table');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [benchmarkTarget, setBenchmarkTarget] = useState<'50' | '75' | '90'>('75');

  const { data, isLoading, error } = useQuery<BenchmarkData>({
    queryKey: ['benchmark', facilityId, periodId],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl-production.up.railway.app/api/benchmark/${facilityId}/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch benchmark data');
      return response.json();
    },
  });

  const formatValue = (value: number, kpiId: string) => {
    if (kpiId.includes('pct') || kpiId.includes('margin') || kpiId.includes('mix') || kpiId.includes('occupancy')) {
      return `${value.toFixed(1)}%`;
    }
    if (kpiId.includes('revenue') || kpiId.includes('cost') || kpiId.includes('ppd')) {
      return `$${value.toFixed(0)}`;
    }
    return value.toFixed(1);
  };

  const getPerformanceColor = (percentile: number) => {
    if (percentile >= 75) return 'var(--success)';
    if (percentile >= 50) return 'var(--primary)';
    if (percentile >= 25) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getPerformanceIcon = (metric: BenchmarkMetric) => {
    if (metric.percentile >= 75) return <TrendingUp size={14} className="text-success" />;
    if (metric.percentile < 25) return <TrendingDown size={14} className="text-danger" />;
    return <Minus size={14} className="text-muted" />;
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Loading benchmark data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '20px' }}>
        <div className="text-danger">Failed to load benchmark data</div>
      </div>
    );
  }

  const filteredMetrics = data.metrics.filter(m =>
    filterCategory === 'all' || m.category === filterCategory
  );

  const categories = [...new Set(data.metrics.map(m => m.category))];

  // Prepare radar chart data
  const radarData = categories.map(category => {
    const categoryMetrics = data.metrics.filter(m => m.category === category);
    const avgPercentile = categoryMetrics.reduce((sum, m) => sum + m.percentile, 0) / categoryMetrics.length;
    return {
      category,
      percentile: avgPercentile,
      fullMark: 100
    };
  });

  // Prepare gap analysis data
  const gapData = filteredMetrics
    .map(m => {
      const target = benchmarkTarget === '50' ? m.benchmark50
        : benchmarkTarget === '75' ? m.benchmark75
        : m.benchmark90;
      const gap = m.higherIsBetter
        ? target - m.yourValue
        : m.yourValue - target;
      return {
        ...m,
        target,
        gapToTarget: gap,
        gapPctToTarget: (gap / target) * 100,
        meetsTarget: m.higherIsBetter ? m.yourValue >= target : m.yourValue <= target
      };
    })
    .sort((a, b) => Math.abs(b.gapPctToTarget) - Math.abs(a.gapPctToTarget));

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Target size={20} />
          Benchmark Comparison
          <span className={`badge ${data.overallPercentile >= 50 ? 'badge-success' : 'badge-warning'}`}>
            {data.overallPercentile.toFixed(0)}th percentile
          </span>
          <span className="badge badge-secondary">{data.benchmarkSource}</span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Overall Score */}
          <div className="card mb-4" style={{ padding: '20px' }}>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <div className="text-xs text-muted mb-1">Overall Score</div>
                <div className="text-4xl font-bold" style={{ color: getPerformanceColor(data.overallPercentile) }}>
                  {data.overallScore.toFixed(0)}
                </div>
                <div className="text-sm text-muted">out of 100</div>
              </div>
              <div className="col-span-3">
                <div className="text-xs text-muted mb-2">Percentile Position</div>
                <div style={{ position: 'relative', height: '40px', background: 'rgba(255,255,255,0.1)', borderRadius: '20px' }}>
                  {/* Quartile markers */}
                  <div style={{ position: 'absolute', left: '25%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.2)' }} />
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.3)' }} />
                  <div style={{ position: 'absolute', left: '75%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.2)' }} />

                  {/* Position indicator */}
                  <div style={{
                    position: 'absolute',
                    left: `calc(${data.overallPercentile}% - 20px)`,
                    top: '5px',
                    width: '40px',
                    height: '30px',
                    background: getPerformanceColor(data.overallPercentile),
                    borderRadius: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0f0f1a',
                    transition: 'left 0.3s ease'
                  }}>
                    {data.overallPercentile.toFixed(0)}th
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted">
                  <span>Bottom 25%</span>
                  <span>Below Median</span>
                  <span>Above Median</span>
                  <span>Top 25%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('table')}
                className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('radar')}
                className={`btn ${viewMode === 'radar' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Radar
              </button>
              <button
                onClick={() => setViewMode('gap')}
                className={`btn ${viewMode === 'gap' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Gap Analysis
              </button>
            </div>
            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="select"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {viewMode === 'gap' && (
                <select
                  value={benchmarkTarget}
                  onChange={(e) => setBenchmarkTarget(e.target.value as '50' | '75' | '90')}
                  className="select"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <option value="50">Target: 50th Percentile</option>
                  <option value="75">Target: 75th Percentile</option>
                  <option value="90">Target: 90th Percentile</option>
                </select>
              )}
            </div>
          </div>

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th style={{ textAlign: 'center' }}>Your Value</th>
                      <th style={{ textAlign: 'center' }}>25th</th>
                      <th style={{ textAlign: 'center' }}>Median</th>
                      <th style={{ textAlign: 'center' }}>75th</th>
                      <th style={{ textAlign: 'center' }}>Top 10%</th>
                      <th style={{ textAlign: 'center' }}>Percentile</th>
                      <th style={{ textAlign: 'center' }}>Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMetrics.map((metric, idx) => (
                      <tr key={idx}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: CATEGORY_COLORS[metric.category] || 'var(--primary)'
                            }} />
                            <div>
                              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                {metric.kpiName}
                              </div>
                              <div className="text-xs text-muted">{metric.category}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: getPerformanceColor(metric.percentile) }}>
                          {formatValue(metric.yourValue, metric.kpiId)}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {formatValue(metric.benchmark25, metric.kpiId)}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {formatValue(metric.benchmark50, metric.kpiId)}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {formatValue(metric.benchmark75, metric.kpiId)}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {formatValue(metric.benchmark90, metric.kpiId)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="flex items-center justify-center gap-2">
                            {getPerformanceIcon(metric)}
                            <span style={{ color: getPerformanceColor(metric.percentile) }}>
                              {metric.percentile.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td style={{
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          color: metric.gap >= 0 ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {metric.gap >= 0 ? '+' : ''}{metric.gapPct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Radar View */}
          {viewMode === 'radar' && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.2)" />
                    <PolarAngleAxis
                      dataKey="category"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                    />
                    <Radar
                      name="Your Performance"
                      dataKey="percentile"
                      stroke="var(--primary)"
                      fill="var(--primary)"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {categories.map(cat => (
                  <div key={cat} className="flex items-center gap-2 text-sm">
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: CATEGORY_COLORS[cat] || 'var(--primary)'
                    }} />
                    <span className="text-muted">{cat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gap Analysis View */}
          {viewMode === 'gap' && (
            <div className="card" style={{ padding: '20px' }}>
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} className="text-muted" />
                <span className="text-sm text-muted">
                  Gap to {benchmarkTarget}th percentile benchmark (sorted by largest gap)
                </span>
              </div>
              <div style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gapData.slice(0, 12)} layout="vertical">
                    <XAxis
                      type="number"
                      stroke="rgba(255,255,255,0.3)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                      tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="kpiName"
                      width={150}
                      stroke="rgba(255,255,255,0.3)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{ background: 'rgba(15,15,26,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                      formatter={(value, _name, props: any) => {
                        if (typeof value !== 'number') return ['', ''];
                        const metric = props.payload;
                        return [
                          <div key="tooltip">
                            <div>Your Value: {formatValue(metric.yourValue, metric.kpiId)}</div>
                            <div>Target: {formatValue(metric.target, metric.kpiId)}</div>
                            <div>Gap: {value > 0 ? '+' : ''}{value.toFixed(1)}%</div>
                          </div>,
                          ''
                        ];
                      }}
                    />
                    <ReferenceLine x={0} stroke="rgba(255,255,255,0.3)" />
                    <Bar dataKey="gapPctToTarget" radius={[0, 4, 4, 0]}>
                      {gapData.slice(0, 12).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.meetsTarget ? 'var(--success)' : 'var(--danger)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <span className="flex items-center gap-2">
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--success)' }} />
                  Meets/Exceeds Target
                </span>
                <span className="flex items-center gap-2">
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--danger)' }} />
                  Below Target
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
