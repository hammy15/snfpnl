import { useQuery } from '@tanstack/react-query';
import { PieChart, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

interface BudgetItem {
  kpiId: string;
  kpiName: string;
  budgetValue: number;
  actualValue: number;
  variance: number;
  variancePct: number;
  status: 'on_budget' | 'over_budget' | 'under_budget';
  unit: string;
  higherIsBetter: boolean;
}

interface BudgetVsActualResponse {
  facilityId: string;
  facilityName: string;
  period: string;
  hasBudget: boolean;
  items: BudgetItem[];
  summary: {
    onBudget: number;
    overBudget: number;
    underBudget: number;
    overallVariancePct: number;
  };
}

interface BudgetVsActualProps {
  facilityId: number;
  periodId: string;
}

export function BudgetVsActual({ facilityId, periodId }: BudgetVsActualProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading, error } = useQuery<BudgetVsActualResponse>({
    queryKey: ['budget-vs-actual', facilityId, periodId],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl-production.up.railway.app/api/budget-vs-actual/${facilityId}/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch budget data');
      return response.json();
    },
  });

  const formatValue = (value: number, unit: string) => {
    if (unit === 'percentage') return `${value.toFixed(1)}%`;
    if (unit === 'currency') return `$${value.toFixed(2)}`;
    if (unit === 'hours') return value.toFixed(2);
    return value.toFixed(2);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      on_budget: 'badge-success',
      over_budget: 'badge-danger',
      under_budget: 'badge-warning',
    };
    return badges[status] || 'badge-info';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      on_budget: 'On Budget',
      over_budget: 'Over Budget',
      under_budget: 'Under Budget',
    };
    return labels[status] || status;
  };

  const getVarianceColor = (variance: number, higherIsBetter: boolean) => {
    const isPositive = variance > 0;
    const isGood = isPositive === higherIsBetter;
    if (Math.abs(variance) < 2) return 'var(--text-muted)';
    return isGood ? 'var(--success)' : 'var(--danger)';
  };

  const getVarianceIcon = (variance: number, higherIsBetter: boolean) => {
    if (Math.abs(variance) < 2) return <Minus size={14} className="text-muted" />;
    const isPositive = variance > 0;
    const isGood = isPositive === higherIsBetter;
    if (isGood) return <TrendingUp size={14} className="text-success" />;
    return <TrendingDown size={14} className="text-danger" />;
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
        <div className="error">Failed to load budget data</div>
      </div>
    );
  }

  if (!data.hasBudget) {
    return (
      <section className="kpi-section">
        <button
          className="section-title"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PieChart size={20} />
            Budget vs Actual
            <span className="badge badge-info" style={{ marginLeft: '8px' }}>
              No budget set
            </span>
          </span>
          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>

        {isExpanded && (
          <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
            <PieChart size={48} className="text-muted" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p className="text-muted mb-2">No budget has been set for this period.</p>
            <p className="text-sm text-muted">Budget data can be configured in the admin settings.</p>
          </div>
        )}
      </section>
    );
  }

  // Prepare chart data
  const chartData = data.items.map(item => ({
    name: item.kpiName.length > 15 ? item.kpiName.substring(0, 15) + '...' : item.kpiName,
    fullName: item.kpiName,
    variance: item.variancePct,
    isGood: (item.variancePct > 0) === item.higherIsBetter || Math.abs(item.variancePct) < 2,
  }));

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <PieChart size={20} />
          Budget vs Actual
          <span className="badge badge-success" style={{ marginLeft: '8px' }}>
            {data.summary.onBudget} on target
          </span>
          {data.summary.overBudget > 0 && (
            <span className="badge badge-danger">
              {data.summary.overBudget} over
            </span>
          )}
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Summary */}
          <div className="card mb-4" style={{ padding: '16px' }}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Overall Budget Performance</h4>
                <p className="text-sm text-muted">Variance from planned targets</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold" style={{
                  color: Math.abs(data.summary.overallVariancePct) < 5 ? 'var(--success)' : 'var(--danger)'
                }}>
                  {data.summary.overallVariancePct >= 0 ? '+' : ''}{data.summary.overallVariancePct.toFixed(1)}%
                </div>
                <div className="text-xs text-muted">avg variance</div>
              </div>
            </div>
          </div>

          {/* Variance chart */}
          <div className="card mb-4" style={{ padding: '16px' }}>
            <h4 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Variance from Budget</h4>
            <div style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 100 }}>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.7)' }}
                    tickFormatter={(val) => `${val}%`}
                    domain={['dataMin - 5', 'dataMax + 5']}
                    axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.7)' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                    width={100}
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
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.fullName}</div>
                            <div style={{ color: item.isGood ? 'var(--success)' : 'var(--danger)', fontSize: '16px', fontWeight: 700 }}>
                              {item.variance >= 0 ? '+' : ''}{item.variance.toFixed(1)}% variance
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine x={0} stroke="rgba(255,255,255,0.4)" />
                  <Bar dataKey="variance" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isGood ? '#00d9a5' : '#ff4757'}
                        fillOpacity={0.9}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed table */}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th style={{ textAlign: 'center' }}>Budget</th>
                    <th style={{ textAlign: 'center' }}>Actual</th>
                    <th style={{ textAlign: 'center' }}>Variance</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.kpiName}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace' }} className="text-muted">
                        {formatValue(item.budgetValue, item.unit)}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                        {formatValue(item.actualValue, item.unit)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="flex items-center justify-center gap-2">
                          {getVarianceIcon(item.variancePct, item.higherIsBetter)}
                          <span style={{ color: getVarianceColor(item.variancePct, item.higherIsBetter), fontFamily: 'monospace' }}>
                            {item.variancePct >= 0 ? '+' : ''}{item.variancePct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${getStatusBadge(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
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
