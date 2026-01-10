import { LineChart, Line, ResponsiveContainer, ReferenceDot } from 'recharts';

interface T12MMetricCardProps {
  metric: {
    kpiId: string;
    label: string;
    format: string;
    stats: {
      current: number;
      average: number;
      min: { value: number; periodId: string; index: number };
      max: { value: number; periodId: string; index: number };
      trend: {
        direction: 'improving' | 'declining' | 'stable';
        changePercent: number;
        volatility: number;
      };
      momChange: number | null;
      yoyChange: number | null;
    };
    sparklineData: { period: string; value: number }[];
  };
  isSelected: boolean;
  onClick: () => void;
}

function formatValue(value: number | null, format: string): string {
  if (value === null) return '--';
  switch (format) {
    case 'percentage':
      return value.toFixed(1) + '%';
    case 'currency':
      return '$' + value.toFixed(2);
    case 'hours':
      return value.toFixed(2) + 'h';
    default:
      return value.toFixed(2);
  }
}

function formatChange(value: number | null, format: string): string {
  if (value === null) return '--';
  const sign = value >= 0 ? '+' : '';
  switch (format) {
    case 'percentage':
      return sign + value.toFixed(1) + 'pp';
    case 'currency':
      return sign + '$' + value.toFixed(2);
    default:
      return sign + value.toFixed(2);
  }
}

export function T12MMetricCard({ metric, isSelected, onClick }: T12MMetricCardProps) {
  const { label, format, stats, sparklineData } = metric;
  const { current, trend, momChange, yoyChange, min, max } = stats;

  const trendColor = trend.direction === 'improving'
    ? 'var(--color-success)'
    : trend.direction === 'declining'
    ? 'var(--color-danger)'
    : 'var(--color-muted)';

  const trendArrow = trend.direction === 'improving'
    ? '↑'
    : trend.direction === 'declining'
    ? '↓'
    : '→';

  const chartData = sparklineData.map((d, i) => ({
    ...d,
    isHigh: i === max.index,
    isLow: i === min.index,
  }));

  return (
    <div
      className={`t12m-metric-card ${isSelected ? 'selected' : ''} ${trend.direction}`}
      onClick={onClick}
    >
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        {trend.volatility > 25 && (
          <span className="volatility-badge" title="High volatility">⚡</span>
        )}
      </div>

      <div className="metric-value">
        <span className="current-value">{formatValue(current, format)}</span>
        <span className="trend-indicator" style={{ color: trendColor }}>
          {trendArrow} {Math.abs(trend.changePercent).toFixed(1)}%
        </span>
      </div>

      <div className="metric-sparkline">
        <ResponsiveContainer width="100%" height={40}>
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={trendColor}
              strokeWidth={2}
              dot={false}
            />
            <ReferenceDot
              x={sparklineData[max.index]?.period}
              y={max.value}
              r={4}
              fill="#22c55e"
              stroke="white"
              strokeWidth={1}
            />
            <ReferenceDot
              x={sparklineData[min.index]?.period}
              y={min.value}
              r={4}
              fill="#ef4444"
              stroke="white"
              strokeWidth={1}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="metric-changes">
        <div className="change-item">
          <span className="change-label">MoM</span>
          <span className={`change-value ${momChange && momChange >= 0 ? 'positive' : 'negative'}`}>
            {formatChange(momChange, format)}
          </span>
        </div>
        <div className="change-item">
          <span className="change-label">YoY</span>
          <span className={`change-value ${yoyChange && yoyChange >= 0 ? 'positive' : 'negative'}`}>
            {formatChange(yoyChange, format)}
          </span>
        </div>
      </div>

      <div className="metric-footer">
        <span className="click-hint">Click for details</span>
      </div>
    </div>
  );
}
