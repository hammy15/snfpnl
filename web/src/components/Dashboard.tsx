import { memo, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, BarChart3, FileText } from 'lucide-react';
import { SectionExplainer } from './ui/InfoTooltip';
import { TabPanel } from './ui/TabPanel';
import { DashboardSummaryTab, DashboardAnalyticsTab, DashboardExportsTab } from './dashboard/tabs';
import { formatPeriod } from '../utils/dateFormatters';
import { api } from '../api';
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
  return api.dashboard.getDashboard(periodId) as unknown as Promise<DashboardData>;
}

async function fetchFacilities(): Promise<Facility[]> {
  return api.facilities.getFacilities() as unknown as Promise<Facility[]>;
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
  return api.kpis.getAllKPIs(periodId) as unknown as Promise<KPIData[]>;
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
  return api.dashboard.getFinancialSummary(periodId) as unknown as Promise<FinancialSummary>;
}

type DashboardTab = 'summary' | 'analytics' | 'exports';

export const Dashboard = memo(function Dashboard({ periodId, settingFilter, onSettingFilterChange, onFacilitySelect }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('summary');

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
  }, [filteredKPIs, financialSummary]);

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

  const dashboardTabs = [
    { id: 'summary' as const, label: 'Summary', icon: <LayoutDashboard size={18} /> },
    { id: 'analytics' as const, label: 'Analytics', icon: <BarChart3 size={18} /> },
    { id: 'exports' as const, label: 'Exports', icon: <FileText size={18} /> },
  ];

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

      {/* Setting Type Filter Tabs */}
      <div className="setting-tabs mb-6" role="tablist" aria-label="Filter by facility type">
        {(['all', 'SNF', 'ALF', 'ILF'] as const).map((setting) => (
          <button
            key={setting}
            role="tab"
            aria-selected={settingFilter === setting}
            aria-controls="dashboard-content"
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

      {/* View Tabs */}
      <TabPanel
        tabs={dashboardTabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as DashboardTab)}
        variant="primary"
      >
        {activeTab === 'summary' && (
          <DashboardSummaryTab
            settingFilter={settingFilter}
            totalFacilities={totalFacilities}
            totalAnomalies={totalAnomalies}
            filteredNetIncome={filteredNetIncome}
            kpiAverages={kpiAverages}
            currentBenchmark={currentBenchmark}
            settingCounts={settingCounts}
            filteredStateStats={filteredStateStats}
            insights={insights}
          />
        )}
        {activeTab === 'analytics' && (
          <DashboardAnalyticsTab
            periodId={periodId}
            filteredTopPerformers={filteredTopPerformers}
            filteredBottomPerformers={filteredBottomPerformers}
            totalCount={totalCount}
            oneThirdCount={oneThirdCount}
            onFacilitySelect={onFacilitySelect}
          />
        )}
        {activeTab === 'exports' && (
          <DashboardExportsTab periodId={periodId} />
        )}
      </TabPanel>
    </div>
  );
});
