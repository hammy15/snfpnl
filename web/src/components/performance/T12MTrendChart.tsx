import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';

interface T12MTrendChartProps {
  metric: {
    kpiId: string;
    label: string;
    format: string;
    stats: {
      current: number;
      average: number;
      min: { value: number; periodId: string; index: number };
      max: { value: number; periodId: string; index: number };
      stdDev: number;
      trend: {
        direction: 'improving' | 'declining' | 'stable';
        changePercent: number;
        slope: number;
        volatility: number;
      };
      momChange: number | null;
      yoyChange: number | null;
    };
    sparklineData: { period: string; value: number }[];
  };
  onClose: () => void;
}

function formatValue(value: number, format: string): string {
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

function formatPeriod(periodId: string): string {
  const [year, month] = periodId.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(month) - 1] + ' ' + year.slice(2);
}

export function T12MTrendChart({ metric, onClose }: T12MTrendChartProps) {
  const { label, format, stats, sparklineData } = metric;
  const { average, min, max, stdDev, trend } = stats;

  const chartData = sparklineData.map((d, i) => ({
    ...d,
    periodLabel: formatPeriod(d.period),
    isHigh: i === max.index,
    isLow: i === min.index,
  }));

  const trendColor = trend.direction === 'improving'
    ? '#22c55e'
    : trend.direction === 'declining'
    ? '#ef4444'
    : '#6b7280';

  return (
    <div className="t12m-trend-chart">
      <div className="chart-header">
        <h4>{label} - Trailing 12 Months</h4>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="chart-stats">
        <div className="stat-item">
          <span className="stat-label">Average</span>
          <span className="stat-value">{formatValue(average, format)}</span>
        </div>
        <div className="stat-item high">
          <span className="stat-label">High</span>
          <span className="stat-value">{formatValue(max.value, format)}</span>
          <span className="stat-period">{formatPeriod(max.periodId)}</span>
        </div>
        <div className="stat-item low">
          <span className="stat-label">Low</span>
          <span className="stat-value">{formatValue(min.value, format)}</span>
          <span className="stat-period">{formatPeriod(min.periodId)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Std Dev</span>
          <span className="stat-value">{formatValue(stdDev, format)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Volatility</span>
          <span className="stat-value">{trend.volatility.toFixed(1)}%</span>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis
              dataKey="periodLabel"
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--color-border)' }}
            />
            <YAxis
              tickFormatter={(v) => formatValue(v, format)}
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--color-border)' }}
              width={70}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const data = payload[0].payload;
                return (
                  <div className="chart-tooltip">
                    <div className="tooltip-period">{data.periodLabel}</div>
                    <div className="tooltip-value">{formatValue(data.value, format)}</div>
                    {data.isHigh && <span className="tooltip-badge high">12M High</span>}
                    {data.isLow && <span className="tooltip-badge low">12M Low</span>}
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={average}
              stroke="var(--color-muted)"
              strokeDasharray="5 5"
              label={{ value: 'Avg', position: 'right', fill: 'var(--color-text-secondary)' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={trendColor}
              strokeWidth={2}
              dot={{ fill: trendColor, r: 4 }}
              activeDot={{ r: 6, fill: trendColor }}
            />
            {/* High point marker */}
            <ReferenceDot
              x={chartData[max.index]?.periodLabel}
              y={max.value}
              r={8}
              fill="#22c55e"
              stroke="white"
              strokeWidth={2}
            />
            {/* Low point marker */}
            <ReferenceDot
              x={chartData[min.index]?.periodLabel}
              y={min.value}
              r={8}
              fill="#ef4444"
              stroke="white"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-legend">
        <span className="legend-item">
          <span className="dot high"></span> 12M High
        </span>
        <span className="legend-item">
          <span className="dot low"></span> 12M Low
        </span>
        <span className="legend-item">
          <span className="line avg"></span> Average
        </span>
      </div>
    </div>
  );
}
