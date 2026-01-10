import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, ChevronDown, ChevronRight, Calendar,
  AlertTriangle, Zap, Info
} from 'lucide-react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface ForecastPoint {
  period: string;
  actual?: number;
  predicted: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
}

interface ForecastResult {
  kpiId: string;
  kpiName: string;
  unit: string;
  historicalData: Array<{ period: string; value: number }>;
  forecast: ForecastPoint[];
  trend: 'improving' | 'declining' | 'stable';
  trendStrength: number;
  forecastAccuracy: number;
  nextPeriodPrediction: number;
  yearEndPrediction: number;
  alerts: Array<{ type: string; message: string }>;
}

interface PredictiveForecastingProps {
  facilityId: number;
  periodId: string;
}

const FORECAST_KPIS = [
  { id: 'operating_margin_pct', name: 'Operating Margin', higherIsBetter: true },
  { id: 'occupancy_pct', name: 'Occupancy Rate', higherIsBetter: true },
  { id: 'skilled_mix_pct', name: 'Skilled Mix', higherIsBetter: true },
  { id: 'revenue_ppd', name: 'Revenue PPD', higherIsBetter: true },
  { id: 'labor_cost_pct', name: 'Labor Cost %', higherIsBetter: false }
];

export function PredictiveForecasting({ facilityId, periodId }: PredictiveForecastingProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedKpi, setSelectedKpi] = useState(FORECAST_KPIS[0].id);
  const [forecastHorizon, setForecastHorizon] = useState(6);

  const { data, isLoading, error } = useQuery<ForecastResult>({
    queryKey: ['forecast', facilityId, periodId, selectedKpi, forecastHorizon],
    queryFn: async () => {
      const response = await fetch(
        `https://snfpnl-production.up.railway.app/api/forecast/${facilityId}/${periodId}?kpi=${selectedKpi}&horizon=${forecastHorizon}`
      );
      if (!response.ok) throw new Error('Failed to fetch forecast');
      return response.json();
    },
  });

  const formatValue = (value: number) => {
    if (selectedKpi.includes('pct') || selectedKpi.includes('margin') || selectedKpi.includes('mix') || selectedKpi.includes('occupancy')) {
      return `${value.toFixed(1)}%`;
    }
    if (selectedKpi.includes('revenue') || selectedKpi.includes('cost') || selectedKpi.includes('ppd')) {
      return `$${value.toFixed(0)}`;
    }
    return value.toFixed(1);
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp size={16} className="text-success" />;
    if (trend === 'declining') return <TrendingDown size={16} className="text-danger" />;
    return <div style={{ width: 16, height: 2, background: 'var(--text-muted)' }} />;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'var(--success)';
    if (confidence >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Generating forecast...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '20px' }}>
        <div className="text-danger">Failed to load forecast</div>
      </div>
    );
  }

  // Combine historical and forecast data for chart
  const chartData = [
    ...data.historicalData.map(d => ({
      period: d.period,
      actual: d.value,
      predicted: null,
      upperBound: null,
      lowerBound: null
    })),
    ...data.forecast.map(d => ({
      period: d.period,
      actual: d.actual || null,
      predicted: d.predicted,
      upperBound: d.upperBound,
      lowerBound: d.lowerBound
    }))
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const actual = payload.find((p: any) => p.dataKey === 'actual');
    const predicted = payload.find((p: any) => p.dataKey === 'predicted');
    const upper = payload.find((p: any) => p.dataKey === 'upperBound');
    const lower = payload.find((p: any) => p.dataKey === 'lowerBound');

    return (
      <div style={{
        background: 'rgba(15, 15, 26, 0.98)',
        border: '1px solid rgba(102, 126, 234, 0.5)',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '180px'
      }}>
        <div className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {label}
        </div>
        {actual?.value != null && (
          <div className="flex justify-between mb-1">
            <span className="text-muted">Actual:</span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
              {formatValue(actual.value)}
            </span>
          </div>
        )}
        {predicted?.value != null && (
          <>
            <div className="flex justify-between mb-1">
              <span className="text-muted">Predicted:</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                {formatValue(predicted.value)}
              </span>
            </div>
            {upper?.value != null && lower?.value != null && (
              <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>Range:</span>
                <span>{formatValue(lower.value)} - {formatValue(upper.value)}</span>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Zap size={20} />
          Predictive Forecasting
          <span className="badge badge-info">
            {data.forecastAccuracy.toFixed(0)}% accuracy
          </span>
          <span className={`badge ${data.trend === 'improving' ? 'badge-success' : data.trend === 'declining' ? 'badge-danger' : 'badge-secondary'}`}>
            {data.trend} trend
          </span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <select
                value={selectedKpi}
                onChange={(e) => setSelectedKpi(e.target.value)}
                className="select"
                style={{ padding: '8px 12px' }}
              >
                {FORECAST_KPIS.map(kpi => (
                  <option key={kpi.id} value={kpi.id}>{kpi.name}</option>
                ))}
              </select>
              <select
                value={forecastHorizon}
                onChange={(e) => setForecastHorizon(Number(e.target.value))}
                className="select"
                style={{ padding: '8px 12px' }}
              >
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Info size={14} />
              Based on {data.historicalData.length} months of data
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 mb-4">
            <div className="card" style={{ padding: '16px' }}>
              <div className="text-xs text-muted mb-1">Current Value</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {formatValue(data.historicalData[data.historicalData.length - 1]?.value || 0)}
              </div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div className="text-xs text-muted mb-1">Next Period Forecast</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                {formatValue(data.nextPeriodPrediction)}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {getTrendIcon(data.trend)}
                <span className={`text-xs ${data.trend === 'improving' ? 'text-success' : data.trend === 'declining' ? 'text-danger' : 'text-muted'}`}>
                  {data.trendStrength.toFixed(1)}% {data.trend}
                </span>
              </div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div className="text-xs text-muted mb-1">Year-End Projection</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                {formatValue(data.yearEndPrediction)}
              </div>
            </div>
            <div className="card" style={{ padding: '16px' }}>
              <div className="text-xs text-muted mb-1">Model Confidence</div>
              <div className="text-2xl font-bold" style={{ color: getConfidenceColor(data.forecastAccuracy) }}>
                {data.forecastAccuracy.toFixed(0)}%
              </div>
              <div className="text-xs text-muted mt-1">forecast accuracy</div>
            </div>
          </div>

          {/* Alerts */}
          {data.alerts.length > 0 && (
            <div className="mb-4 space-y-2">
              {data.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3"
                  style={{
                    padding: '12px 16px',
                    background: alert.type === 'warning' ? 'rgba(255, 193, 7, 0.1)' : 'rgba(102, 126, 234, 0.1)',
                    borderRadius: '8px',
                    border: `1px solid ${alert.type === 'warning' ? 'rgba(255, 193, 7, 0.3)' : 'rgba(102, 126, 234, 0.3)'}`
                  }}
                >
                  <AlertTriangle size={16} style={{ color: alert.type === 'warning' ? 'var(--warning)' : 'var(--primary)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{alert.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Forecast Chart */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.kpiName} Forecast
              </h4>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-2">
                  <div style={{ width: '20px', height: '3px', background: 'var(--success)' }} />
                  Historical
                </span>
                <span className="flex items-center gap-2">
                  <div style={{ width: '20px', height: '3px', background: 'var(--primary)', borderStyle: 'dashed' }} />
                  Forecast
                </span>
                <span className="flex items-center gap-2">
                  <div style={{ width: '20px', height: '8px', background: 'rgba(102, 126, 234, 0.2)', borderRadius: '2px' }} />
                  Confidence Interval
                </span>
              </div>
            </div>
            <div style={{ height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <XAxis
                    dataKey="period"
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                    tickFormatter={(v) => formatValue(v)}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<CustomTooltip />} />

                  {/* Confidence interval band */}
                  <Area
                    type="monotone"
                    dataKey="upperBound"
                    stroke="transparent"
                    fill="rgba(102, 126, 234, 0.15)"
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="lowerBound"
                    stroke="transparent"
                    fill="rgba(15, 15, 26, 1)"
                    connectNulls={false}
                  />

                  {/* Actual line */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="var(--success)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--success)', r: 4 }}
                    connectNulls={false}
                  />

                  {/* Predicted line */}
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: 'var(--primary)', r: 4 }}
                    connectNulls={false}
                  />

                  {/* Current period marker */}
                  <ReferenceLine
                    x={data.historicalData[data.historicalData.length - 1]?.period}
                    stroke="rgba(255,255,255,0.3)"
                    strokeDasharray="3 3"
                    label={{ value: 'Now', fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Forecast Details Table */}
          <div className="card mt-4" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th style={{ textAlign: 'center' }}>Predicted Value</th>
                    <th style={{ textAlign: 'center' }}>Lower Bound</th>
                    <th style={{ textAlign: 'center' }}>Upper Bound</th>
                    <th style={{ textAlign: 'center' }}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {data.forecast.map((point, idx) => (
                    <tr key={idx}>
                      <td style={{ color: 'var(--text-primary)' }}>
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-muted" />
                          {point.period}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>
                        {formatValue(point.predicted)}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {formatValue(point.lowerBound)}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {formatValue(point.upperBound)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="flex items-center justify-center gap-2">
                          <div style={{
                            width: '40px',
                            height: '6px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${point.confidence}%`,
                              background: getConfidenceColor(point.confidence),
                              borderRadius: '3px'
                            }} />
                          </div>
                          <span className="text-sm" style={{ color: getConfidenceColor(point.confidence) }}>
                            {point.confidence.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
