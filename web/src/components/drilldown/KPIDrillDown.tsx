import { useQuery } from '@tanstack/react-query';
import { Layers, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

interface DrillDownComponent {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface DrillDownResponse {
  facilityId: string;
  period: string;
  kpiId: string;
  kpiName: string;
  kpiValue: number;
  unit: string;
  components: DrillDownComponent[];
  calculation: string;
}

interface KPIDrillDownProps {
  facilityId: number;
  periodId: string;
}

const DRILLDOWN_KPIS = [
  { id: 'snf_operating_margin_pct', name: 'Operating Margin' },
  { id: 'snf_total_revenue_ppd', name: 'Total Revenue PPD' },
  { id: 'snf_total_cost_ppd', name: 'Total Cost PPD' },
  { id: 'snf_labor_cost_pct_revenue', name: 'Labor Cost %' },
];

const COLORS = ['#667eea', '#00d9a5', '#ff4757', '#f1c40f', '#9b59b6', '#3498db', '#e67e22', '#1abc9c'];

export function KPIDrillDown({ facilityId, periodId }: KPIDrillDownProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<DrillDownResponse>({
    queryKey: ['kpi-drilldown', facilityId, periodId, selectedKpi],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl.onrender.com/api/kpi-drilldown/${facilityId}/${periodId}/${selectedKpi}`);
      if (!response.ok) throw new Error('Failed to fetch drill-down data');
      return response.json();
    },
    enabled: !!selectedKpi,
  });

  const formatValue = (value: number, unit: string) => {
    if (unit === 'percentage') return `${value.toFixed(1)}%`;
    if (unit === 'currency') return `$${value.toFixed(2)}`;
    if (unit === 'hours') return value.toFixed(2);
    return value.toFixed(2);
  };

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Layers size={20} />
          KPI Component Breakdown
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* KPI selector buttons */}
          <div className="grid grid-cols-4 mb-4">
            {DRILLDOWN_KPIS.map(kpi => (
              <button
                key={kpi.id}
                className={`card ${selectedKpi === kpi.id ? 'active' : ''}`}
                onClick={() => setSelectedKpi(selectedKpi === kpi.id ? null : kpi.id)}
                style={{
                  padding: '16px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  border: selectedKpi === kpi.id ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.18)',
                  background: selectedKpi === kpi.id ? 'rgba(102, 126, 234, 0.15)' : undefined,
                }}
              >
                <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{kpi.name}</div>
                <div className="text-xs text-muted mt-1">Click to drill down</div>
              </button>
            ))}
          </div>

          {/* Drill-down content */}
          {selectedKpi && (
            <div className="card" style={{ padding: '20px' }}>
              {isLoading && (
                <div className="loading">
                  <div className="spinner"></div>
                </div>
              )}

              {error && (
                <div className="text-danger text-center py-8">
                  Failed to load drill-down data
                </div>
              )}

              {data && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {data.kpiName} Breakdown
                      </h4>
                      <p className="text-sm text-muted">{data.calculation}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                          {formatValue(data.kpiValue, data.unit)}
                        </div>
                        <div className="text-xs text-muted">Current value</div>
                      </div>
                      <button
                        className="btn btn-secondary btn-icon"
                        onClick={() => setSelectedKpi(null)}
                        style={{ width: '32px', height: '32px' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2" style={{ gap: '24px' }}>
                    {/* Pie chart */}
                    <div style={{ height: '280px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.components as unknown as Array<{[key: string]: unknown}>}
                            dataKey="percentage"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                          >
                            {data.components.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                                stroke="transparent"
                              />
                            ))}
                          </Pie>
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
                                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.name}</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: COLORS[data.components.indexOf(item) % COLORS.length] }}>
                                      {formatValue(item.value, data.unit)}
                                    </div>
                                    <div className="text-muted text-sm">
                                      {item.percentage.toFixed(1)}% of total
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Bar chart */}
                    <div style={{ height: '280px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.components}
                          layout="vertical"
                          margin={{ top: 5, right: 30, bottom: 5, left: 80 }}
                        >
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.7)' }}
                            tickFormatter={(val) => formatValue(val, data.unit)}
                            axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.7)' }}
                            axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                            width={80}
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
                                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.name}</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700 }}>
                                      {formatValue(item.value, data.unit)}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {data.components.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                                fillOpacity={0.9}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Component table */}
                  <div className="table-container mt-4">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '20px' }}></th>
                          <th>Component</th>
                          <th style={{ textAlign: 'right' }}>Value</th>
                          <th style={{ textAlign: 'right' }}>% of Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.components.map((component, idx) => (
                          <tr key={idx}>
                            <td>
                              <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '3px',
                                background: COLORS[idx % COLORS.length]
                              }} />
                            </td>
                            <td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {component.name}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                              {formatValue(component.value, data.unit)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="flex items-center justify-end gap-2">
                                <div style={{
                                  width: '60px',
                                  height: '6px',
                                  background: 'rgba(255,255,255,0.1)',
                                  borderRadius: '3px',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${component.percentage}%`,
                                    background: COLORS[idx % COLORS.length],
                                    borderRadius: '3px'
                                  }} />
                                </div>
                                <span className="text-muted" style={{ minWidth: '45px', textAlign: 'right' }}>
                                  {component.percentage.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {!selectedKpi && (
            <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
              <Layers size={48} className="text-muted" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p className="text-muted">Select a KPI above to see its component breakdown</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
