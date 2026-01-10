import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useState } from 'react';
import { Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';

interface ForecastDataPoint {
  period: string;
  actual: number | null;
  forecast: number | null;
  upperBound: number | null;
  lowerBound: number | null;
}

interface ForecastResponse {
  facilityId: string;
  kpiId: string;
  kpiName: string;
  unit: string;
  lastActualPeriod: string;
  forecastPeriods: number;
  data: ForecastDataPoint[];
  summary: {
    currentValue: number;
    forecastedValue: number;
    expectedChange: number;
    expectedChangePct: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    confidence: 'high' | 'medium' | 'low';
  };
}

interface PredictiveTrendsProps {
  facilityId: number;
}

const FORECAST_KPIS = [
  { id: 'snf_operating_margin_pct', name: 'Operating Margin' },
  { id: 'snf_occupancy_pct', name: 'Occupancy' },
  { id: 'snf_revenue_ppd', name: 'Revenue PPD' },
  { id: 'snf_skilled_mix_pct', name: 'Skilled Mix' },
];

export function PredictiveTrends({ facilityId }: PredictiveTrendsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedKpi, setSelectedKpi] = useState(FORECAST_KPIS[0].id);

  const { data, isLoading, error } = useQuery<ForecastResponse>({
    queryKey: ['forecast', facilityId, selectedKpi],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl-production.up.railway.app/api/forecast/${facilityId}/${selectedKpi}`);
      if (!response.ok) throw new Error('Failed to fetch forecast');
      return response.json();
    },
  });

  const formatValue = (value: number | null, unit: string) => {
    if (value === null) return null;
    if (unit === 'percentage') return `${value.toFixed(1)}%`;
    if (unit === 'currency') return `$${value.toFixed(2)}`;
    if (unit === 'hours') return value.toFixed(2);
    return value.toFixed(2);
  };

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`;
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'increasing') return <ArrowUpRight size={16} className="text-success" />;
    if (trend === 'decreasing') return <ArrowDownRight size={16} className="text-danger" />;
    return <Minus size={16} className="text-muted" />;
  };

  const getConfidenceBadge = (confidence: string) => {
    const badges: Record<string, string> = {
      high: 'badge-success',
      medium: 'badge-warning',
      low: 'badge-danger',
    };
    return badges[confidence] || 'badge-info';
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
        <div className="error">Failed to load forecast data</div>
      </div>
    );
  }

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TrendingUp size={20} />
          Predictive Trends
          <span className={`badge ${getConfidenceBadge(data.summary.confidence)}`} style={{ marginLeft: '8px' }}>
            {data.summary.confidence} confidence
          </span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* KPI selector */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {FORECAST_KPIS.map(kpi => (
              <button
                key={kpi.id}
                className={`btn ${selectedKpi === kpi.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedKpi(kpi.id)}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                {kpi.name}
              </button>
            ))}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 mb-4">
            <div className="card" style={{ padding: '16px' }}>
              <div className="text-xs text-muted mb-1">Current Value</div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {formatValue(data.summary.currentValue, data.unit)}
              </div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div className="text-xs text-muted mb-1">Forecasted (3mo)</div>
              <div className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
                {formatValue(data.summary.forecastedValue, data.unit)}
              </div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div className="text-xs text-muted mb-1">Expected Change</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold" style={{ color: data.summary.expectedChangePct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {data.summary.expectedChangePct >= 0 ? '+' : ''}{data.summary.expectedChangePct.toFixed(1)}%
                </span>
                {getTrendIcon(data.summary.trend)}
              </div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div className="text-xs text-muted mb-1">Trend</div>
              <div className="flex items-center gap-2">
                {getTrendIcon(data.summary.trend)}
                <span className="text-lg font-medium" style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                  {data.summary.trend}
                </span>
              </div>
            </div>
          </div>

          {/* Forecast chart */}
          <div className="card" style={{ padding: '16px' }}>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {data.kpiName} - 3 Month Forecast
              </h4>
              <span className={`badge ${getConfidenceBadge(data.summary.confidence)}`}>
                {data.summary.confidence} confidence
              </span>
            </div>

            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.data} margin={{ top: 10, right: 30, bottom: 30, left: 40 }}>
                  <defs>
                    <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#667eea" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#667eea" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.7)' }}
                    tickFormatter={formatPeriod}
                    axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.7)' }}
                    tickFormatter={(val) => formatValue(val, data.unit) || ''}
                    axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length > 0) {
                        const point = payload[0].payload;
                        const isActual = point.actual !== null;
                        return (
                          <div style={{
                            background: 'rgba(15, 15, 26, 0.95)',
                            border: '1px solid rgba(255,255,255,0.18)',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            color: '#fff'
                          }}>
                            <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '6px', fontSize: '12px' }}>
                              {formatPeriod(point.period)}
                            </div>
                            {isActual ? (
                              <div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Actual</div>
                                <div style={{ fontSize: '18px', fontWeight: 600 }}>
                                  {formatValue(point.actual, data.unit)}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div style={{ marginBottom: '8px' }}>
                                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Forecast</div>
                                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#667eea' }}>
                                    {formatValue(point.forecast, data.unit)}
                                  </div>
                                </div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                                  Range: {formatValue(point.lowerBound, data.unit)} - {formatValue(point.upperBound, data.unit)}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  {/* Reference line at last actual period */}
                  <ReferenceLine
                    x={data.lastActualPeriod}
                    stroke="rgba(255,255,255,0.3)"
                    strokeDasharray="5 5"
                    label={{
                      value: 'Forecast →',
                      position: 'top',
                      fill: 'rgba(255,255,255,0.5)',
                      fontSize: 11
                    }}
                  />

                  {/* Confidence band */}
                  <Area
                    type="monotone"
                    dataKey="upperBound"
                    stroke="transparent"
                    fill="transparent"
                  />
                  <Area
                    type="monotone"
                    dataKey="lowerBound"
                    stroke="transparent"
                    fill="url(#confidenceGradient)"
                  />

                  {/* Actual line */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#00d9a5"
                    strokeWidth={2}
                    dot={{ fill: '#00d9a5', r: 4 }}
                    connectNulls={false}
                  />

                  {/* Forecast line */}
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#667eea"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: '#667eea', r: 4 }}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <span className="flex items-center gap-2">
                <span style={{ width: '20px', height: '3px', background: '#00d9a5', borderRadius: '2px' }}></span>
                <span className="text-muted">Actual</span>
              </span>
              <span className="flex items-center gap-2">
                <span style={{ width: '20px', height: '3px', background: '#667eea', borderRadius: '2px', borderStyle: 'dashed' }}></span>
                <span className="text-muted">Forecast</span>
              </span>
              <span className="flex items-center gap-2">
                <span style={{ width: '20px', height: '12px', background: 'rgba(102, 126, 234, 0.2)', borderRadius: '2px' }}></span>
                <span className="text-muted">Confidence Range</span>
              </span>
            </div>
          </div>

          {/* Methodology note */}
          <div className="card mt-4" style={{ padding: '12px 16px', background: 'rgba(102, 126, 234, 0.1)' }}>
            <p className="text-sm text-muted">
              <strong>Methodology:</strong> Forecast uses linear regression on trailing 12 months with exponential smoothing.
              Confidence bands represent ±1 standard deviation from historical variance.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
