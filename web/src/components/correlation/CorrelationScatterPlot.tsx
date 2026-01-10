import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface CorrelationScatterPlotProps {
  data: { x: number; y: number; period: string }[];
  xLabel: string;
  yLabel: string;
  correlation: {
    r: number;
    strength: 'strong' | 'moderate' | 'weak' | 'none';
    direction: 'positive' | 'negative' | 'none';
  };
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatPeriod(periodId: string): string {
  const [year, month] = periodId.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(month) - 1] + " '" + year.slice(2);
}

export function CorrelationScatterPlot({ data, xLabel, yLabel, correlation }: CorrelationScatterPlotProps) {
  const dotColor = correlation.direction === 'positive' ? '#22c55e' : 
                   correlation.direction === 'negative' ? '#ef4444' : '#6b7280';

  // Calculate regression line
  const xMean = data.reduce((sum, d) => sum + d.x, 0) / data.length;
  const yMean = data.reduce((sum, d) => sum + d.y, 0) / data.length;

  const xMin = Math.min(...data.map(d => d.x));
  const xMax = Math.max(...data.map(d => d.x));

  // Simple linear regression
  let numerator = 0;
  let denominator = 0;
  for (const d of data) {
    numerator += (d.x - xMean) * (d.y - yMean);
    denominator += (d.x - xMean) * (d.x - xMean);
  }
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // Calculate regression line endpoints as a tuple
  const lineData: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: xMin, y: slope * xMin + intercept },
    { x: xMax, y: slope * xMax + intercept },
  ];

  return (
    <div className="scatter-plot-container">
      <ResponsiveContainer width="100%" height={150}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
            tickFormatter={(v) => formatValue(v)}
            axisLine={{ stroke: 'var(--color-border)' }}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
            tickFormatter={(v) => formatValue(v)}
            axisLine={{ stroke: 'var(--color-border)' }}
            width={45}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || !payload[0]) return null;
              const point = payload[0].payload;
              return (
                <div className="scatter-tooltip">
                  <div className="tooltip-period">{formatPeriod(point.period)}</div>
                  <div className="tooltip-values">
                    <span>{xLabel}: {formatValue(point.x)}</span>
                    <span>{yLabel}: {formatValue(point.y)}</span>
                  </div>
                </div>
              );
            }}
          />
          {/* Regression line */}
          <ReferenceLine
            segment={lineData}
            stroke={dotColor}
            strokeWidth={2}
            strokeDasharray="5 5"
            opacity={0.6}
          />
          <Scatter
            data={data}
            fill={dotColor}
            fillOpacity={0.7}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
