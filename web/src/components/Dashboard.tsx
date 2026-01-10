import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, AlertTriangle, Building, DollarSign, Percent, Target, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { KPICard } from './KPICard';
import { SectionExplainer, InfoTooltip } from './ui/InfoTooltip';
import { NarrativeReport, FinancialPacketGenerator } from './NarrativeReport';
import './Dashboard.css';

type SettingFilter = 'all' | 'SNF' | 'ALF' | 'ILF';

interface DashboardProps {
  periodId: string;
  settingFilter: SettingFilter;
  onSettingFilterChange: (filter: SettingFilter) => void;
  onFacilitySelect: (facilityId: string) => void;
}

interface DashboardData {
  facilityStats: { state: string; count: number }[];
  avgKpis: { kpi_id: string; avg_value: number; min_value: number; max_value: number; facility_count: number }[];
  anomalySummary: { severity: string; count: number }[];
  topPerformers: { facility_id: string; name: string; kpi_id: string; value: number }[];
  bottomPerformers: { facility_id: string; name: string; kpi_id: string; value: number }[];
}

interface Facility {
  facility_id: string;
  name: string;
  state: string;
  setting: string;
}

// Industry benchmarks with KPI mappings
const BENCHMARKS: Record<string, {
  operatingMargin: { target: number; kpiId: string };
  metric2: { label: string; target: number; kpiId: string; format: 'percentage' | 'currency'; inverse?: boolean };
  metric3: { label: string; target: number; kpiId: string; format: 'percentage' | 'currency'; inverse?: boolean };
  metric4: { label: string; target: number; kpiId: string; format: 'percentage' | 'currency'; inverse?: boolean };
}> = {
  SNF: {
    operatingMargin: { target: 8, kpiId: 'snf_operating_margin_pct' },
    metric2: { label: 'Skilled Mix', target: 20, kpiId: 'snf_skilled_mix_pct', format: 'percentage' },
    metric3: { label: 'Revenue PPD', target: 400, kpiId: 'snf_total_revenue_ppd', format: 'currency' },
    metric4: { label: 'Contract Labor', target: 10, kpiId: 'snf_contract_labor_pct_nursing', format: 'percentage', inverse: true },
  },
  ALF: {
    operatingMargin: { target: 12, kpiId: 'sl_operating_margin_pct' },
    metric2: { label: 'Occupancy', target: 90, kpiId: 'sl_occupancy_pct', format: 'percentage' },
    metric3: { label: 'RevPOR', target: 5000, kpiId: 'sl_revpor', format: 'currency' },
    metric4: { label: 'Expense PPD', target: 120, kpiId: 'sl_expense_prd', format: 'currency', inverse: true },
  },
  ILF: {
    operatingMargin: { target: 15, kpiId: 'sl_operating_margin_pct' },
    metric2: { label: 'Occupancy', target: 95, kpiId: 'sl_occupancy_pct', format: 'percentage' },
    metric3: { label: 'RevPOR', target: 4000, kpiId: 'sl_revpor', format: 'currency' },
    metric4: { label: 'Expense PPD', target: 100, kpiId: 'sl_expense_prd', format: 'currency', inverse: true },
  },
};

async function fetchDashboard(periodId: string): Promise<DashboardData> {
  const res = await fetch(`http://localhost:3002/api/dashboard/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

async function fetchFacilities(): Promise<Facility[]> {
  const res = await fetch('http://localhost:3002/api/facilities');
  if (!res.ok) throw new Error('Failed to fetch facilities');
  return res.json();
}

interface KPIData {
  facility_id: string;
  kpi_id: string;
  value: number | null;
  name: string;
  state: string;
  setting: string;
}

async function fetchAllKPIs(periodId: string): Promise<KPIData[]> {
  const res = await fetch(`http://localhost:3002/api/kpis/all/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch KPIs');
  return res.json();
}

interface FinancialSummary {
  facilities: {
    facility_id: string;
    name: string;
    setting: string;
    total_revenue: number;
    total_expenses: number;
    net_income: number;
    net_income_pct: number;
  }[];
  settingTotals: Record<string, { revenue: number; expenses: number; net_income: number }>;
  cascadiaTotals: {
    revenue: number;
    expenses: number;
    net_income: number;
    net_income_pct: number;
  };
}

async function fetchFinancialSummary(periodId: string): Promise<FinancialSummary> {
  const res = await fetch(`http://localhost:3002/api/financials/summary/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch financial summary');
  return res.json();
}

export function Dashboard({ periodId, settingFilter, onSettingFilterChange, onFacilitySelect }: DashboardProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', periodId],
    queryFn: () => fetchDashboard(periodId),
  });

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: fetchFacilities,
  });

  const { data: allKPIs = [] } = useQuery({
    queryKey: ['allKPIs', periodId],
    queryFn: () => fetchAllKPIs(periodId),
  });

  const { data: financialSummary } = useQuery({
    queryKey: ['financialSummary', periodId],
    queryFn: () => fetchFinancialSummary(periodId),
  });

  // Filter facilities by setting - must be before useMemo hooks
  const filteredFacilities = useMemo(() =>
    facilities.filter((f) => settingFilter === 'all' || f.setting === settingFilter),
    [facilities, settingFilter]
  );

  // Filter KPIs by setting
  const filteredKPIs = useMemo(() =>
    allKPIs.filter((k) => settingFilter === 'all' || k.setting === settingFilter),
    [allKPIs, settingFilter]
  );

  // Count by setting
  const settingCounts = useMemo(() =>
    facilities.reduce((acc, f) => {
      acc[f.setting] = (acc[f.setting] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    [facilities]
  );

  // Get state counts filtered by setting
  const filteredStateStats = useMemo(() => {
    const stateCounts = filteredFacilities.reduce((acc, f) => {
      acc[f.state] = (acc[f.state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(stateCounts)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredFacilities]);

  // Get the appropriate benchmarks for the current filter
  const currentBenchmark = BENCHMARKS[settingFilter === 'all' ? 'SNF' : settingFilter];

  // Calculate filtered Net Income totals
  const filteredNetIncome = useMemo(() => {
    if (!financialSummary) return { total: 0, pct: 0, revenue: 0 };

    const filtered = financialSummary.facilities.filter(
      f => settingFilter === 'all' || f.setting === settingFilter
    );

    const totalRevenue = filtered.reduce((sum, f) => sum + f.total_revenue, 0);
    const totalNetIncome = filtered.reduce((sum, f) => sum + f.net_income, 0);

    return {
      total: totalNetIncome,
      pct: totalRevenue > 0 ? (totalNetIncome / totalRevenue) * 100 : 0,
      revenue: totalRevenue,
    };
  }, [financialSummary, settingFilter]);

  // Calculate filtered averages from the KPI data
  const kpiAverages = useMemo(() => {
    // Helper to get correct margin KPI based on setting
    const getMarginKpiForSetting = (setting: string) =>
      setting === 'SNF' ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct';

    const getAvg = (kpiId: string): number | null => {
      const values = filteredKPIs
        .filter(k => k.kpi_id === kpiId && k.value !== null)
        .map(k => k.value as number);
      if (values.length === 0) return null;
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    };

    // For margin, use the appropriate KPI for each facility's setting to avoid double-counting
    const getMarginAvg = (): number | null => {
      const values = filteredKPIs
        .filter(k => {
          const expectedKpi = getMarginKpiForSetting(k.setting);
          return k.kpi_id === expectedKpi && k.value !== null;
        })
        .map(k => k.value as number);
      if (values.length === 0) return null;
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    };

    return {
      margin: getMarginAvg(),
      metric2: getAvg(currentBenchmark.metric2.kpiId),
      metric3: getAvg(currentBenchmark.metric3.kpiId),
      metric4: getAvg(currentBenchmark.metric4.kpiId),
    };
  }, [filteredKPIs, currentBenchmark]);

  // Calculate top 1/3 and bottom 1/3 performers from filtered KPIs
  const { filteredTopPerformers, filteredBottomPerformers, totalCount, oneThirdCount } = useMemo(() => {
    // Use the appropriate margin KPI based on each facility's setting
    // SNF uses snf_operating_margin_pct, ALF/ILF use sl_operating_margin_pct
    const getMarginKpiForSetting = (setting: string) =>
      setting === 'SNF' ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct';

    // Filter to only include the correct margin KPI for each facility's setting
    // This prevents duplicates when viewing "All Types"
    const marginKPIs = filteredKPIs
      .filter(k => {
        const expectedKpi = getMarginKpiForSetting(k.setting);
        return k.kpi_id === expectedKpi && k.value !== null;
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const count = marginKPIs.length;
    const thirdCount = Math.max(1, Math.ceil(count / 3));

    // Get Net Income data for each facility
    const getNetIncome = (facilityId: string) => {
      const facility = financialSummary?.facilities.find(f => f.facility_id === facilityId);
      return facility ? { net_income: facility.net_income, net_income_pct: facility.net_income_pct } : { net_income: 0, net_income_pct: 0 };
    };

    const top = marginKPIs.slice(0, thirdCount).map(k => ({
      facility_id: k.facility_id,
      name: k.name,
      kpi_id: k.kpi_id,
      value: k.value || 0,
      setting: k.setting,
      ...getNetIncome(k.facility_id),
    }));

    const bottom = marginKPIs.slice(-thirdCount).reverse().map(k => ({
      facility_id: k.facility_id,
      name: k.name,
      kpi_id: k.kpi_id,
      value: k.value || 0,
      setting: k.setting,
      ...getNetIncome(k.facility_id),
    }));

    return { filteredTopPerformers: top, filteredBottomPerformers: bottom, totalCount: count, oneThirdCount: thirdCount };
  }, [filteredKPIs, currentBenchmark, settingFilter, financialSummary]);

  // Generate insights based on filtered data
  const insights = useMemo(() => {
    const suggestions: { type: 'success' | 'warning' | 'action'; message: string; detail: string }[] = [];
    const avgMargin = kpiAverages.margin;
    const avgMetric2 = kpiAverages.metric2;
    const avgMetric4 = kpiAverages.metric4;

    // Margin insights
    if (avgMargin !== null) {
      if (avgMargin >= currentBenchmark.operatingMargin.target) {
        suggestions.push({
          type: 'success',
          message: 'EBITDAR Margin exceeds target',
          detail: `Portfolio averaging ${avgMargin.toFixed(1)}% vs ${currentBenchmark.operatingMargin.target}% target. Keep up the strong performance!`
        });
      } else if (avgMargin < currentBenchmark.operatingMargin.target * 0.5) {
        suggestions.push({
          type: 'action',
          message: 'Margin needs immediate attention',
          detail: `Currently at ${avgMargin.toFixed(1)}%, significantly below ${currentBenchmark.operatingMargin.target}% target. Focus on revenue enhancement and cost control.`
        });
      } else {
        suggestions.push({
          type: 'warning',
          message: 'Margin improvement opportunity',
          detail: `At ${avgMargin.toFixed(1)}%, there's room to reach the ${currentBenchmark.operatingMargin.target}% benchmark.`
        });
      }
    }

    // Bottom performers insight
    if (filteredBottomPerformers.length > 0) {
      const negativeMarginCount = filteredBottomPerformers.filter(f => f.value < 0).length;
      if (negativeMarginCount > 0) {
        suggestions.push({
          type: 'action',
          message: `${negativeMarginCount} facilities with negative margins`,
          detail: `Priority attention needed for buildings operating at a loss. Consider operational reviews.`
        });
      }
    }

    // Metric-specific insights
    if (avgMetric2 !== null && settingFilter !== 'all') {
      const target = currentBenchmark.metric2.target;
      const gap = target - avgMetric2;
      if (gap > 5) {
        suggestions.push({
          type: 'warning',
          message: `${currentBenchmark.metric2.label} below target`,
          detail: `Currently ${avgMetric2.toFixed(1)}${currentBenchmark.metric2.format === 'percentage' ? '%' : ''}, ${gap.toFixed(1)} points below ${target}${currentBenchmark.metric2.format === 'percentage' ? '%' : ''} target.`
        });
      }
    }

    // Contract labor / expense insight
    if (avgMetric4 !== null && currentBenchmark.metric4.inverse) {
      const target = currentBenchmark.metric4.target;
      if (avgMetric4 > target * 1.5) {
        suggestions.push({
          type: 'action',
          message: `High ${currentBenchmark.metric4.label}`,
          detail: `At ${avgMetric4.toFixed(1)}${currentBenchmark.metric4.format === 'percentage' ? '%' : ''}, well above the ${target}${currentBenchmark.metric4.format === 'percentage' ? '%' : ''} target. This is significantly impacting margins.`
        });
      }
    }

    // Top performer recognition
    if (filteredTopPerformers.length > 0 && filteredTopPerformers[0].value > 12) {
      suggestions.push({
        type: 'success',
        message: `${filteredTopPerformers[0].name} leading at ${filteredTopPerformers[0].value.toFixed(1)}%`,
        detail: 'Consider sharing their best practices with underperforming buildings.'
      });
    }

    return suggestions.slice(0, 4); // Limit to 4 insights
  }, [kpiAverages, filteredTopPerformers, filteredBottomPerformers, currentBenchmark, settingFilter]);

  // Early returns AFTER all hooks
  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return <div className="error">Failed to load dashboard data</div>;
  }

  if (!data) return null;

  const totalFacilities = filteredFacilities.length;
  const totalAnomalies = data.anomalySummary.reduce((sum, s) => sum + s.count, 0);

  // Pie chart data for setting distribution
  const settingPieData = [
    { name: 'SNF', value: settingCounts.SNF || 0, fill: '#667eea' },
    { name: 'ALF', value: settingCounts.ALF || 0, fill: '#10b981' },
    { name: 'ILF', value: settingCounts.ILF || 0, fill: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Extract averages for render
  const avgMargin = kpiAverages.margin;
  const avgMetric2 = kpiAverages.metric2;
  const avgMetric3 = kpiAverages.metric3;
  const avgMetric4 = kpiAverages.metric4;

  return (
    <div className="dashboard animate-fade-in">
      <SectionExplainer
        title="SNFPNL Dashboard"
        subtitle="Financial performance overview"
        explanation="This dashboard provides a high-level view of your entire portfolio's financial health. Use the setting tabs to filter by facility type (SNF, ALF, ILF) and quickly identify which buildings are performing well vs. those needing attention."
        tips={[
          "Green metrics indicate performance at or above target; yellow/red signal areas needing review",
          "Click on any facility row to drill down into detailed financials",
          "The top/bottom thirds are based on EBITDAR margin - the key profitability indicator"
        ]}
        reviewSuggestions={[
          "Check the 'Needs Attention' table for buildings with negative margins",
          "Compare your portfolio average vs industry benchmarks in the 'vs Benchmarks' card",
          "Review the Insights section for AI-generated suggestions specific to your data"
        ]}
      />
      <div className="dashboard-header-period">
        <span className="period-badge">{formatPeriod(periodId)}</span>
      </div>

      {/* Setting Type Tabs */}
      <div className="setting-tabs mb-6">
        {(['all', 'SNF', 'ALF', 'ILF'] as const).map((setting) => (
          <button
            key={setting}
            className={`setting-tab ${settingFilter === setting ? 'active' : ''}`}
            onClick={() => onSettingFilterChange(setting)}
          >
            {setting === 'all' ? 'All Types' : setting}
            <span className="tab-count">
              {setting === 'all' ? facilities.length : settingCounts[setting] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Portfolio Net Income Summary */}
      {financialSummary && (
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
      )}

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
        <div className="insights-section mb-6">
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

      {/* Performance Tables */}
      <div className="grid grid-cols-2">
        {/* Top Performers */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <TrendingUp size={18} className="text-success" />
              Top Performers
              <InfoTooltip
                content="The top third of facilities ranked by EBITDAR margin. These are your strongest performers - study their practices for best practice sharing opportunities."
                type="tip"
              />
              <span className="header-count">({filteredTopPerformers.length} of {totalCount})</span>
            </h3>
          </div>
          <div className="table-container scrollable">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Facility</th>
                  <th>Type</th>
                  <th>EBITDAR %</th>
                  <th>Net Income</th>
                  <th>Net %</th>
                </tr>
              </thead>
              <tbody>
                {filteredTopPerformers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>
                      No data for selected filter
                    </td>
                  </tr>
                ) : (
                  filteredTopPerformers.map((facility, index) => (
                    <tr
                      key={facility.facility_id}
                      onClick={() => onFacilitySelect(facility.facility_id)}
                      className="clickable-row"
                    >
                      <td className="text-muted">{index + 1}</td>
                      <td>{facility.name}</td>
                      <td>
                        <span className={`badge badge-${facility.setting.toLowerCase()}`}>
                          {facility.setting}
                        </span>
                      </td>
                      <td className="text-success font-semibold">
                        {facility.value.toFixed(1)}%
                      </td>
                      <td className={facility.net_income >= 0 ? 'text-success' : 'text-danger'}>
                        ${(facility.net_income / 1000).toFixed(0)}K
                      </td>
                      <td className={facility.net_income_pct >= 0 ? 'text-success' : 'text-danger'}>
                        {facility.net_income_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Performers */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <TrendingDown size={18} className="text-danger" />
              Needs Attention
              <InfoTooltip
                content="The bottom third of facilities by EBITDAR margin. Prioritize operational reviews for any with negative margins. Click a row to see detailed breakdown and identify improvement opportunities."
                type="warning"
              />
              <span className="header-count">({filteredBottomPerformers.length} of {totalCount})</span>
            </h3>
          </div>
          <div className="table-container scrollable">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Facility</th>
                  <th>Type</th>
                  <th>EBITDAR %</th>
                  <th>Net Income</th>
                  <th>Net %</th>
                </tr>
              </thead>
              <tbody>
                {filteredBottomPerformers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>
                      No data for selected filter
                    </td>
                  </tr>
                ) : (
                  filteredBottomPerformers.map((facility, index) => (
                    <tr
                      key={facility.facility_id}
                      onClick={() => onFacilitySelect(facility.facility_id)}
                      className="clickable-row"
                    >
                      <td className="text-muted">{totalCount - oneThirdCount + index + 1}</td>
                      <td>{facility.name}</td>
                      <td>
                        <span className={`badge badge-${facility.setting.toLowerCase()}`}>
                          {facility.setting}
                        </span>
                      </td>
                      <td className={facility.value < 0 ? 'text-danger font-semibold' : 'text-warning font-semibold'}>
                        {facility.value.toFixed(1)}%
                      </td>
                      <td className={facility.net_income >= 0 ? 'text-success' : 'text-danger'}>
                        ${(facility.net_income / 1000).toFixed(0)}K
                      </td>
                      <td className={facility.net_income_pct >= 0 ? 'text-success' : 'text-danger'}>
                        {facility.net_income_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Narrative Report Section */}
      <NarrativeReport
        context="dashboard"
        periodId={periodId}
        title="Dashboard Narrative Report"
      />

      {/* Financial Packet Generator */}
      <FinancialPacketGenerator periodId={periodId} />
    </div>
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

  // Calculate bar width - handle negative values and scale properly
  // Use a scale where target is at 66% position, allowing room for above/below
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

function formatPeriod(periodId: string): string {
  const [year, month] = periodId.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function getMarginVariant(value: number | null, target: number): 'success' | 'warning' | 'danger' | 'default' {
  if (value === null) return 'default';
  if (value >= target) return 'success';
  if (value >= target * 0.5) return 'warning';
  return 'danger';
}
