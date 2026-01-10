import { useQuery } from '@tanstack/react-query';
import { BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

interface WaterfallItem {
  category: string;
  label: string;
  value: number;
  cumulative: number;
  type: 'revenue' | 'cost' | 'margin';
}

interface WaterfallResponse {
  facilityId: string;
  facilityName: string;
  period: string;
  items: WaterfallItem[];
  totalRevenue: number;
  totalCosts: number;
  operatingMargin: number;
  operatingMarginPct: number;
}

interface MarginWaterfallProps {
  facilityId: number;
  periodId: string;
}

export function MarginWaterfall({ facilityId, periodId }: MarginWaterfallProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading, error } = useQuery<WaterfallResponse>({
    queryKey: ['margin-waterfall', facilityId, periodId],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl.onrender.com/api/margin-waterfall/${facilityId}/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch waterfall data');
      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
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
        <div className="error">Failed to load waterfall data</div>
      </div>
    );
  }

  // Prepare chart data for waterfall effect
  const chartData = data.items.map((item, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === data.items.length - 1;

    if (isFirst || isLast) {
      // First (total revenue) and last (margin) bars start from 0
      return {
        ...item,
        start: 0,
        end: item.value,
        display: item.value,
      };
    }

    // Cost items are negative and stack from the previous cumulative
    const prevCumulative = data.items[idx - 1].cumulative;
    return {
      ...item,
      start: prevCumulative,
      end: item.cumulative,
      display: item.value,
    };
  });

  const getBarColor = (type: string, value: number) => {
    if (type === 'revenue') return '#667eea';
    if (type === 'margin') return value >= 0 ? '#00d9a5' : '#ff4757';
    return '#ff4757'; // costs are red
  };

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BarChart3 size={20} />
          Margin Waterfall
          <span className={`badge ${data.operatingMarginPct >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ marginLeft: '8px' }}>
            {data.operatingMarginPct >= 0 ? '+' : ''}{data.operatingMarginPct.toFixed(1)}% margin
          </span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 mb-4">
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="text-xs text-muted mb-1">Total Revenue</div>
              <div className="text-xl font-bold" style={{ color: '#667eea' }}>
                {formatCurrency(data.totalRevenue)}
              </div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="text-xs text-muted mb-1">Total Costs</div>
              <div className="text-xl font-bold text-danger">
                {formatCurrency(data.totalCosts)}
              </div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="text-xs text-muted mb-1">Operating Margin</div>
              <div className="text-xl font-bold" style={{ color: data.operatingMargin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatCurrency(data.operatingMargin)}
              </div>
            </div>
          </div>

          {/* Waterfall chart */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.7)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.7)' }}
                    tickFormatter={formatCurrency}
                    axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length > 0) {
                        const item = payload[0].payload;
                        return (
                          <div style={{
                            background: 'rgba(15, 15, 26, 0.95)',
                            border: '1px solid rgba(255,255,255,0.18)',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            color: '#fff'
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: '6px' }}>{item.label}</div>
                            <div style={{ color: getBarColor(item.type, item.value), fontSize: '18px', fontWeight: 700 }}>
                              {item.type === 'cost' ? '-' : ''}{formatCurrency(Math.abs(item.value))}
                            </div>
                            {item.type !== 'revenue' && item.type !== 'margin' && (
                              <div className="text-muted text-xs mt-2">
                                Running total: {formatCurrency(item.cumulative)}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" />

                  {/* Floating bars for waterfall effect */}
                  <Bar dataKey="display" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getBarColor(entry.type, entry.value)}
                        fillOpacity={0.9}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <span className="flex items-center gap-2">
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#667eea' }}></span>
                <span className="text-muted">Revenue</span>
              </span>
              <span className="flex items-center gap-2">
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#ff4757' }}></span>
                <span className="text-muted">Costs</span>
              </span>
              <span className="flex items-center gap-2">
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#00d9a5' }}></span>
                <span className="text-muted">Margin</span>
              </span>
            </div>
          </div>

          {/* Cost breakdown table */}
          <div className="card mt-4" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right' }}>% of Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.filter(i => i.type !== 'margin').map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <span style={{ color: getBarColor(item.type, item.value) }}>●</span>
                        <span className="ml-2">{item.label}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {item.type === 'cost' ? '-' : ''}{formatCurrency(Math.abs(item.value))}
                      </td>
                      <td style={{ textAlign: 'right' }} className="text-muted">
                        {((Math.abs(item.value) / data.totalRevenue) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid rgba(255,255,255,0.2)' }}>
                    <td className="font-bold">Operating Margin</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }} className="font-bold">
                      <span style={{ color: data.operatingMargin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {formatCurrency(data.operatingMargin)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} className="font-bold">
                      <span style={{ color: data.operatingMarginPct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {data.operatingMarginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
