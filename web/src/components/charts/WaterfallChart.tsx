import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';

interface WaterfallItem {
  name: string;
  value: number;
  cumulative: number;
  type: 'positive' | 'negative' | 'total';
  category: 'revenue' | 'cost' | 'margin';
}

interface WaterfallData {
  facilityId: string;
  facilityName: string;
  periodId: string;
  items: WaterfallItem[];
  totalRevenue: number;
  totalCosts: number;
  operatingMargin: number;
}

interface WaterfallChartProps {
  facilityId: number;
  periodId: string;
}

export function WaterfallChart({ facilityId, periodId }: WaterfallChartProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showPercentages, setShowPercentages] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<WaterfallData>({
    queryKey: ['waterfall', facilityId, periodId],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl.onrender.com/api/waterfall/${facilityId}/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch waterfall data');
      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getBarColor = (item: WaterfallItem) => {
    if (item.type === 'total') return 'var(--primary)';
    if (item.category === 'revenue') return 'var(--success)';
    if (item.category === 'cost') return 'var(--danger)';
    return item.value >= 0 ? 'var(--success)' : 'var(--danger)';
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Loading waterfall data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '20px' }}>
        <div className="text-danger">Failed to load waterfall chart</div>
      </div>
    );
  }

  // Transform data for waterfall visualization
  const chartData = data.items.map((item, idx) => {
    const prevCumulative = idx === 0 ? 0 : data.items[idx - 1].cumulative;
    return {
      name: item.name,
      value: item.value,
      start: item.type === 'total' ? 0 : prevCumulative,
      end: item.cumulative,
      type: item.type,
      category: item.category,
      fill: getBarColor(item)
    };
  });

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: WaterfallItem & { start: number; end: number; fill: string } }> }) => {
    if (!active || !payload?.[0]) return null;
    const item = payload[0].payload;

    return (
      <div style={{
        background: 'rgba(15, 15, 26, 0.98)',
        border: '1px solid rgba(102, 126, 234, 0.5)',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '180px'
      }}>
        <div className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {item.name}
        </div>
        <div className="flex justify-between mb-1">
          <span className="text-muted">Amount:</span>
          <span style={{ color: item.value >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
            {item.value >= 0 ? '+' : ''}{formatCurrency(item.value)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Running Total:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {formatCurrency(item.end)}
          </span>
        </div>
        {showPercentages && data.totalRevenue > 0 && (
          <div className="flex justify-between mt-1 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="text-muted">% of Revenue:</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {((item.value / data.totalRevenue) * 100).toFixed(1)}%
            </span>
          </div>
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
          <BarChart2 size={20} />
          Margin Waterfall Analysis
          <span className={`badge ${data.operatingMargin >= 0 ? 'badge-success' : 'badge-danger'}`}>
            {data.operatingMargin.toFixed(1)}% margin
          </span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 mb-4">
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="text-xs text-muted mb-1">Total Revenue</div>
              <div className="text-2xl font-bold text-success">{formatCurrency(data.totalRevenue)}</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="text-xs text-muted mb-1">Total Costs</div>
              <div className="text-2xl font-bold text-danger">{formatCurrency(data.totalCosts)}</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="text-xs text-muted mb-1">Operating Margin</div>
              <div className={`text-2xl font-bold ${data.operatingMargin >= 0 ? 'text-success' : 'text-danger'}`}>
                {data.operatingMargin.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Info size={14} className="text-muted" />
              <span className="text-sm text-muted">Hover over bars for details</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPercentages}
                onChange={(e) => setShowPercentages(e.target.checked)}
              />
              <span className="text-sm">Show as % of Revenue</span>
            </label>
          </div>

          {/* Waterfall Chart */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <XAxis
                    type="number"
                    tickFormatter={formatCurrency}
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />

                  {/* Invisible bar for starting position */}
                  <Bar dataKey="start" stackId="waterfall" fill="transparent" />

                  {/* Actual value bar */}
                  <Bar
                    dataKey="value"
                    stackId="waterfall"
                    radius={[0, 4, 4, 0]}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                        opacity={hoveredBar === null || hoveredBar === entry.name ? 1 : 0.4}
                        onMouseEnter={() => setHoveredBar(entry.name)}
                        onMouseLeave={() => setHoveredBar(null)}
                        style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-2">
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--success)' }} />
                <span className="text-sm text-muted">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--danger)' }} />
                <span className="text-sm text-muted">Costs</span>
              </div>
              <div className="flex items-center gap-2">
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--primary)' }} />
                <span className="text-sm text-muted">Total/Subtotal</span>
              </div>
            </div>
          </div>

          {/* Detailed Breakdown Table */}
          <div className="card mt-4" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right' }}>% of Revenue</th>
                    <th style={{ textAlign: 'right' }}>Running Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        background: item.type === 'total' ? 'rgba(102, 126, 234, 0.1)' : undefined,
                        fontWeight: item.type === 'total' ? 600 : 400
                      }}
                    >
                      <td style={{ color: 'var(--text-primary)' }}>
                        {item.name}
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        color: item.category === 'revenue' ? 'var(--success)'
                          : item.category === 'cost' ? 'var(--danger)'
                          : 'var(--primary)'
                      }}>
                        {item.value >= 0 ? '+' : ''}{formatCurrency(item.value)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {data.totalRevenue > 0 ? `${((item.value / data.totalRevenue) * 100).toFixed(1)}%` : '-'}
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        color: 'var(--text-primary)'
                      }}>
                        {formatCurrency(item.cumulative)}
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
