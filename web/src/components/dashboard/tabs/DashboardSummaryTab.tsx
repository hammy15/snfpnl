import { Building, DollarSign, Percent, AlertTriangle, Target, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { KPICard } from '../../KPICard';
import { InfoTooltip } from '../../ui/InfoTooltip';

interface Insight {
  type: 'success' | 'warning' | 'action';
  message: string;
  detail: string;
}

interface BenchmarkConfig {
  operatingMargin: { target: number; kpiId: string };
  metric2: { label: string; target: number; kpiId: string; format: 'percentage' | 'currency'; inverse?: boolean };
  metric3: { label: string; target: number; kpiId: string; format: 'percentage' | 'currency'; inverse?: boolean };
  metric4: { label: string; target: number; kpiId: string; format: 'percentage' | 'currency'; inverse?: boolean };
}

interface DashboardSummaryTabProps {
  settingFilter: 'all' | 'SNF' | 'ALF' | 'ILF';
  totalFacilities: number;
  totalAnomalies: number;
  filteredNetIncome: { total: number; pct: number; revenue: number };
  kpiAverages: { margin: number | null; metric2: number | null; metric3: number | null; metric4: number | null };
  currentBenchmark: BenchmarkConfig;
  settingCounts: Record<string, number>;
  filteredStateStats: { state: string; count: number }[];
  insights: Insight[];
}

export function DashboardSummaryTab({
  settingFilter,
  totalFacilities,
  totalAnomalies,
  filteredNetIncome,
  kpiAverages,
  currentBenchmark,
  settingCounts,
  filteredStateStats,
  insights,
}: DashboardSummaryTabProps) {
  const { margin: avgMargin, metric2: avgMetric2, metric3: avgMetric3, metric4: avgMetric4 } = kpiAverages;

  // Pie chart data for setting distribution
  const settingPieData = [
    { name: 'SNF', value: settingCounts.SNF || 0, fill: '#667eea' },
    { name: 'ALF', value: settingCounts.ALF || 0, fill: '#10b981' },
    { name: 'ILF', value: settingCounts.ILF || 0, fill: '#f59e0b' },
  ].filter(d => d.value > 0);

  return (
    <>
      {/* Portfolio Net Income Summary */}
      <div className="cascadia-summary mb-6">
        <div className="cascadia-card">
          <div className="cascadia-header">
            <h3>
              SNFPNL Portfolio Summary
              <InfoTooltip
                content="Portfolio-wide totals for the selected period. Net Income % is your bottom line profitability after all expenses. Aim for positive and growing month-over-month."
                type="info"
              />
            </h3>
            <span className="cascadia-subtitle">
              {settingFilter === 'all' ? 'All Facilities' : `${settingFilter} Facilities`}
            </span>
          </div>
          <div className="cascadia-metrics">
            <div className="cascadia-metric">
              <span className="metric-label">Total Revenue</span>
              <span className="metric-value">${(filteredNetIncome.revenue / 1000000).toFixed(2)}M</span>
            </div>
            <div className="cascadia-metric highlight">
              <span className="metric-label">Net Income</span>
              <span className={`metric-value ${filteredNetIncome.total >= 0 ? 'positive' : 'negative'}`}>
                ${(filteredNetIncome.total / 1000000).toFixed(2)}M
              </span>
            </div>
            <div className="cascadia-metric">
              <span className="metric-label">Net Income %</span>
              <span className={`metric-value ${filteredNetIncome.pct >= 0 ? 'positive' : 'negative'}`}>
                {filteredNetIncome.pct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 mb-6">
        <KPICard
          title="Total Facilities"
          value={totalFacilities}
          icon={<Building size={20} />}
          format="number"
          subtitle={settingFilter !== 'all' ? `${settingFilter} only` : 'All settings'}
        />
        <KPICard
          title={`Avg ${currentBenchmark.metric3.label}`}
          value={avgMetric3}
          icon={<DollarSign size={20} />}
          format={currentBenchmark.metric3.format === 'currency' ? 'currency' : 'percentage'}
          subtitle={`Target: ${currentBenchmark.metric3.format === 'currency' ? '$' : ''}${currentBenchmark.metric3.target}${currentBenchmark.metric3.format === 'percentage' ? '%' : ''}`}
        />
        <KPICard
          title="Avg EBITDAR Margin"
          value={avgMargin}
          icon={<Percent size={20} />}
          format="percentage"
          variant={getMarginVariant(avgMargin, currentBenchmark.operatingMargin.target)}
          subtitle={`Target: ${currentBenchmark.operatingMargin.target}%`}
        />
        <KPICard
          title="Anomalies"
          value={totalAnomalies}
          icon={<AlertTriangle size={20} />}
          format="number"
          variant={totalAnomalies > 10 ? 'warning' : 'default'}
          subtitle="Data quality alerts"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 mb-6">
        {/* Setting Distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Portfolio Mix</h3>
          </div>
          <div className="chart-container" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={settingPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {settingPieData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 15, 26, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legend-row">
            {settingPieData.map((d) => (
              <div key={d.name} className="legend-item">
                <span className="legend-dot" style={{ background: d.fill }} />
                <span>{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Facilities by State */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              By State
              {settingFilter !== 'all' && <span className="header-count">({settingFilter})</span>}
            </h3>
          </div>
          <div className="chart-container" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredStateStats} layout="vertical">
                <XAxis type="number" stroke="rgba(255,255,255,0.3)" />
                <YAxis type="category" dataKey="state" width={40} stroke="rgba(255,255,255,0.3)" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 15, 26, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                  }}
                />
                <Bar dataKey="count" fill="url(#barGradient)" radius={[0, 4, 4, 0]} />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#667eea" />
                    <stop offset="100%" stopColor="#764ba2" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Benchmark Status */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Target size={18} />
              vs Benchmarks
              {settingFilter !== 'all' && <span className="header-count">({settingFilter})</span>}
            </h3>
          </div>
          <div className="benchmark-list">
            <BenchmarkItem
              label="EBITDAR Margin"
              actual={avgMargin}
              target={currentBenchmark.operatingMargin.target}
              format="percentage"
            />
            <BenchmarkItem
              label={currentBenchmark.metric2.label}
              actual={avgMetric2}
              target={currentBenchmark.metric2.target}
              format={currentBenchmark.metric2.format}
            />
            <BenchmarkItem
              label={currentBenchmark.metric3.label}
              actual={avgMetric3}
              target={currentBenchmark.metric3.target}
              format={currentBenchmark.metric3.format}
            />
            <BenchmarkItem
              label={currentBenchmark.metric4.label}
              actual={avgMetric4}
              target={currentBenchmark.metric4.target}
              format={currentBenchmark.metric4.format}
              inverse={currentBenchmark.metric4.inverse}
            />
          </div>
        </div>
      </div>

      {/* Insights Section */}
      {insights.length > 0 && (
        <div className="insights-section">
          <div className="insights-header">
            <Lightbulb size={20} />
            <h3>Insights & Suggestions</h3>
          </div>
          <div className="insights-grid">
            {insights.map((insight, idx) => (
              <div key={idx} className={`insight-card insight-${insight.type}`}>
                <div className="insight-content">
                  <span className="insight-title">{insight.message}</span>
                  <span className="insight-detail">{insight.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function BenchmarkItem({ label, actual, target, format, inverse = false }: {
  label: string;
  actual: number | null;
  target: number;
  format: 'percentage' | 'currency';
  inverse?: boolean;
}) {
  if (actual === null) return null;

  const diff = actual - target;
  const isGood = inverse ? diff <= 0 : diff >= 0;

  const formatValue = (v: number) => {
    if (format === 'currency') return `$${v.toFixed(0)}`;
    return `${v.toFixed(1)}%`;
  };

  const maxValue = Math.max(Math.abs(actual), target) * 1.5;
  const barWidth = Math.max(0, (actual / maxValue) * 100);
  const targetPosition = (target / maxValue) * 100;

  return (
    <div className="benchmark-item">
      <div className="benchmark-item-header">
        <span className="benchmark-label">{label}</span>
        <span className={`benchmark-diff ${isGood ? 'good' : 'bad'}`}>
          {diff >= 0 ? '+' : ''}{formatValue(diff)}
        </span>
      </div>
      <div className="benchmark-bar">
        <div
          className={`benchmark-fill ${isGood ? 'good' : 'bad'}`}
          style={{ width: `${barWidth}%` }}
        />
        <div className="benchmark-target" style={{ left: `${targetPosition}%` }} />
      </div>
      <div className="benchmark-values">
        <span>Actual: {formatValue(actual)}</span>
        <span>Target: {formatValue(target)}</span>
      </div>
    </div>
  );
}

function getMarginVariant(value: number | null, target: number): 'success' | 'warning' | 'danger' | 'default' {
  if (value === null) return 'default';
  if (value >= target) return 'success';
  if (value >= target * 0.5) return 'warning';
  return 'danger';
}
