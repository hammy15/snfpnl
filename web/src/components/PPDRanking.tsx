import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Edit2, Save, RotateCcw, DollarSign, Users, Activity, Building2, Percent, Target, BarChart3, Table2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';
import { SectionExplainer, InfoTooltip } from './ui/InfoTooltip';
import { NarrativeReport } from './NarrativeReport';
import { formatPeriod } from '../utils/dateFormatters';
import './PPDRanking.css';

const BENCHMARKS_STORAGE_KEY = 'ppd-ranking-benchmarks';

type SettingFilter = 'SNF' | 'ALF' | 'ILF';

interface PPDRankingProps {
  periodId: string;
  onFacilitySelect: (facilityId: string) => void;
}

interface KPIData {
  facility_id: string;
  kpi_id: string;
  value: number | null;
  name: string;
  state: string;
  setting: string;
}

interface MetricConfig {
  id: string;
  label: string;
  kpiId: string;
  format: 'currency' | 'number' | 'hours' | 'percentage';
  defaultBenchmark: number;
  inverse: boolean; // true = lower is better
  description: string;
}

// Industry standard PPD/PSD metrics by setting type
const METRICS_BY_SETTING: Record<SettingFilter, MetricConfig[]> = {
  SNF: [
    // Revenue & Cost PPD Metrics
    { id: 'revenue_ppd', label: 'Revenue PPD', kpiId: 'snf_total_revenue_ppd', format: 'currency', defaultBenchmark: 400, inverse: false, description: 'Total revenue per patient day' },
    { id: 'expense_ppd', label: 'Expense PPD', kpiId: 'snf_total_cost_ppd', format: 'currency', defaultBenchmark: 350, inverse: true, description: 'Total operating expense per patient day' },
    { id: 'nursing_ppd', label: 'Nursing Cost PPD', kpiId: 'snf_nursing_cost_ppd', format: 'currency', defaultBenchmark: 180, inverse: true, description: 'Nursing labor cost per patient day' },
    { id: 'therapy_psd', label: 'Therapy Cost PSD', kpiId: 'snf_therapy_cost_psd', format: 'currency', defaultBenchmark: 60, inverse: true, description: 'Therapy expense per skilled day' },
    { id: 'dietary_ppd', label: 'Dietary PPD', kpiId: 'snf_dietary_cost_ppd', format: 'currency', defaultBenchmark: 25, inverse: true, description: 'Dietary expense per patient day' },
    { id: 'ancillary_psd', label: 'Ancillary Cost PSD', kpiId: 'snf_ancillary_cost_psd', format: 'currency', defaultBenchmark: 35, inverse: true, description: 'Ancillary expense (pharmacy, lab, radiology) per skilled day' },
    { id: 'admin_ppd', label: 'Admin & G&A PPD', kpiId: 'snf_admin_cost_ppd', format: 'currency', defaultBenchmark: 45, inverse: true, description: 'Administrative and G&A per patient day' },
    { id: 'nursing_hours_ppd', label: 'Nursing Hours PPD', kpiId: 'snf_total_nurse_hprd_paid', format: 'hours', defaultBenchmark: 4.0, inverse: false, description: 'Nursing hours per patient day' },
    // Payer Mix Metrics (MCR vs MCD)
    { id: 'skilled_mix', label: 'Skilled Mix % (MCR)', kpiId: 'snf_skilled_mix_pct', format: 'percentage', defaultBenchmark: 25, inverse: false, description: 'Medicare A + MA/HMO patient days as % of total - higher means more high-paying patients' },
    { id: 'medicare_a_mix', label: 'Medicare A Mix %', kpiId: 'snf_medicare_a_mix_pct', format: 'percentage', defaultBenchmark: 12, inverse: false, description: 'Traditional Medicare Part A patients - highest reimbursement (~$700/day)' },
    { id: 'ma_mix', label: 'MA/HMO Mix %', kpiId: 'snf_ma_mix_pct', format: 'percentage', defaultBenchmark: 10, inverse: false, description: 'Medicare Advantage managed care patients (~$500/day)' },
    { id: 'medicaid_mix', label: 'Medicaid Mix % (MCD)', kpiId: 'snf_medicaid_mix_pct', format: 'percentage', defaultBenchmark: 75, inverse: true, description: 'Long-term care Medicaid patients - lower is better for revenue (~$250/day)' },
  ],
  ALF: [
    { id: 'revpor', label: 'RevPOR (Monthly)', kpiId: 'sl_revpor', format: 'currency', defaultBenchmark: 5000, inverse: false, description: 'Revenue per occupied room per month' },
    { id: 'revenue_ppd', label: 'Revenue PPD', kpiId: 'sl_revenue_prd', format: 'currency', defaultBenchmark: 140, inverse: false, description: 'Total revenue per patient day' },
    { id: 'expense_ppd', label: 'Expense PPD', kpiId: 'sl_expense_prd', format: 'currency', defaultBenchmark: 120, inverse: true, description: 'Total expense per patient day' },
    { id: 'nursing_ppd', label: 'Nursing Cost PPD', kpiId: 'sl_nursing_prd', format: 'currency', defaultBenchmark: 50, inverse: true, description: 'Nursing cost per patient day' },
    { id: 'dietary_ppd', label: 'Dietary Cost PPD', kpiId: 'sl_dietary_prd', format: 'currency', defaultBenchmark: 18, inverse: true, description: 'Dietary expense per patient day' },
    { id: 'admin_ppd', label: 'Admin Cost PPD', kpiId: 'sl_admin_prd', format: 'currency', defaultBenchmark: 25, inverse: true, description: 'Administration expense per patient day' },
  ],
  ILF: [
    { id: 'revpor', label: 'RevPOR (Monthly)', kpiId: 'sl_revpor', format: 'currency', defaultBenchmark: 4000, inverse: false, description: 'Revenue per occupied room per month' },
    { id: 'revenue_ppd', label: 'Revenue PPD', kpiId: 'sl_revenue_prd', format: 'currency', defaultBenchmark: 80, inverse: false, description: 'Total revenue per patient day' },
    { id: 'expense_ppd', label: 'Expense PPD', kpiId: 'sl_expense_prd', format: 'currency', defaultBenchmark: 70, inverse: true, description: 'Total expense per patient day' },
    { id: 'nursing_ppd', label: 'Nursing Cost PPD', kpiId: 'sl_nursing_prd', format: 'currency', defaultBenchmark: 20, inverse: true, description: 'Nursing cost per patient day' },
    { id: 'dietary_ppd', label: 'Dietary Cost PPD', kpiId: 'sl_dietary_prd', format: 'currency', defaultBenchmark: 15, inverse: true, description: 'Dietary expense per patient day' },
    { id: 'admin_ppd', label: 'Admin Cost PPD', kpiId: 'sl_admin_prd', format: 'currency', defaultBenchmark: 15, inverse: true, description: 'Administration expense per patient day' },
  ],
};

async function fetchAllKPIs(periodId: string): Promise<KPIData[]> {
  const res = await fetch(`https://snfpnl.onrender.com/api/kpis/all/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch KPIs');
  return res.json();
}

interface HoveredFacility {
  facility_id: string;
  name: string;
  state: string;
  x: number;
  y: number;
}

type ViewMode = 'table' | 'chart';

export function PPDRanking({ periodId, onFacilitySelect }: PPDRankingProps) {
  const [settingFilter, setSettingFilter] = useState<SettingFilter>('SNF');
  const [selectedMetricId, setSelectedMetricId] = useState<string>('revenue_ppd');
  const [editingBenchmarks, setEditingBenchmarks] = useState(false);
  const [hoveredFacility, setHoveredFacility] = useState<HoveredFacility | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const tableRef = useRef<HTMLDivElement>(null);

  // Initialize benchmarks from localStorage
  const [customBenchmarks, setCustomBenchmarks] = useState<Record<string, Record<string, number>>>(() => {
    try {
      const saved = localStorage.getItem(BENCHMARKS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist benchmarks to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(BENCHMARKS_STORAGE_KEY, JSON.stringify(customBenchmarks));
    } catch {
      console.warn('Failed to save benchmarks to localStorage');
    }
  }, [customBenchmarks]);

  const { data: allKPIs = [], isLoading } = useQuery({
    queryKey: ['allKPIs', periodId],
    queryFn: () => fetchAllKPIs(periodId),
  });

  // Get metrics for current setting
  const availableMetrics = METRICS_BY_SETTING[settingFilter];

  // Ensure selected metric is valid for current setting
  const selectedMetric = useMemo(() => {
    const metric = availableMetrics.find(m => m.id === selectedMetricId);
    return metric || availableMetrics[0];
  }, [availableMetrics, selectedMetricId]);

  // Get current benchmark (custom or default)
  const getCurrentBenchmark = (metricId: string): number => {
    const metric = availableMetrics.find(m => m.id === metricId);
    if (!metric) return 0;
    return customBenchmarks[settingFilter]?.[metricId] ?? metric.defaultBenchmark;
  };

  // Update benchmark
  const updateBenchmark = (metricId: string, value: number) => {
    setCustomBenchmarks(prev => ({
      ...prev,
      [settingFilter]: {
        ...prev[settingFilter],
        [metricId]: value,
      },
    }));
  };

  // Reset benchmarks to defaults
  const resetBenchmarks = () => {
    setCustomBenchmarks(prev => {
      const newBenchmarks = { ...prev };
      delete newBenchmarks[settingFilter];
      return newBenchmarks;
    });
  };

  // Filter and rank facilities
  const rankedFacilities = useMemo(() => {
    const filtered = allKPIs
      .filter(k => k.kpi_id === selectedMetric.kpiId && k.setting === settingFilter && k.value !== null)
      .map(k => ({
        facility_id: k.facility_id,
        name: k.name,
        state: k.state,
        value: k.value as number,
      }));

    // Sort based on whether lower is better
    if (selectedMetric.inverse) {
      filtered.sort((a, b) => a.value - b.value); // Lower is better
    } else {
      filtered.sort((a, b) => b.value - a.value); // Higher is better
    }

    return filtered;
  }, [allKPIs, selectedMetric, settingFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (rankedFacilities.length === 0) return null;
    const values = rankedFacilities.map(f => f.value);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const benchmark = customBenchmarks[settingFilter]?.[selectedMetric.id] ?? selectedMetric.defaultBenchmark;
    const meetingBenchmark = selectedMetric.inverse
      ? values.filter(v => v <= benchmark).length
      : values.filter(v => v >= benchmark).length;

    return { avg, min, max, benchmark, meetingBenchmark, total: values.length };
  }, [rankedFacilities, selectedMetric, customBenchmarks, settingFilter]);

  // Get performance status
  const getPerformanceStatus = (value: number, benchmark: number, inverse: boolean): 'excellent' | 'good' | 'warning' | 'poor' => {
    if (inverse) {
      // Lower is better
      if (value <= benchmark * 0.85) return 'excellent';
      if (value <= benchmark) return 'good';
      if (value <= benchmark * 1.15) return 'warning';
      return 'poor';
    } else {
      // Higher is better
      if (value >= benchmark * 1.15) return 'excellent';
      if (value >= benchmark) return 'good';
      if (value >= benchmark * 0.85) return 'warning';
      return 'poor';
    }
  };

  // Format value based on type
  const formatValue = (value: number, format: 'currency' | 'number' | 'hours' | 'percentage'): string => {
    if (format === 'currency') return `$${value.toFixed(0)}`;
    if (format === 'hours') return `${value.toFixed(2)} hrs`;
    if (format === 'percentage') return `${value.toFixed(1)}%`;
    return `${value.toFixed(1)}%`; // Default to percentage for payer mix metrics
  };

  // Get percentile
  const getPercentile = (rank: number, total: number): number => {
    return Math.round((1 - (rank - 1) / total) * 100);
  };

  // Get all KPIs for the hovered facility
  const getHoveredFacilityStats = (facilityId: string) => {
    const facilityKPIs = allKPIs.filter(k => k.facility_id === facilityId);
    const getVal = (kpiId: string) => facilityKPIs.find(k => k.kpi_id === kpiId)?.value ?? null;

    if (settingFilter === 'SNF') {
      return {
        margin: getVal('snf_operating_margin_pct'),
        skilledMix: getVal('snf_skilled_mix_pct'),
        medicaidMix: getVal('snf_medicaid_mix_pct'),
        revenuePPD: getVal('snf_total_revenue_ppd'),
        costPPD: getVal('snf_total_cost_ppd'),
        nursingPPD: getVal('snf_nursing_cost_ppd'),
        contractLabor: getVal('snf_contract_labor_pct_nursing'),
        medicareARev: getVal('snf_medicare_a_revenue_psd'),
      };
    } else {
      return {
        margin: getVal('sl_operating_margin_pct'),
        revenuePPD: getVal('sl_revenue_prd'),
        costPPD: getVal('sl_expense_prd'),
        nursingPPD: getVal('sl_nursing_prd'),
        occupancy: getVal('sl_occupancy_pct'),
        revpor: getVal('sl_revpor'),
      };
    }
  };

  // Handle row hover - use viewport coordinates for fixed positioning
  const handleRowHover = (facility: { facility_id: string; name: string; state: string }, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // Use viewport coordinates directly for fixed positioning
    setHoveredFacility({
      ...facility,
      x: rect.right + 10,
      y: rect.top + rect.height / 2
    });
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="ppd-ranking animate-fade-in">
      <SectionExplainer
        title="PPD Rankings"
        subtitle="Per Patient Day & Per Skilled Day Metrics"
        explanation="PPD (Per Patient Day) and PSD (Per Skilled Day) metrics normalize costs and revenue to enable fair comparisons across facilities of different sizes. This tool ranks all facilities by the selected metric against customizable benchmarks."
        tips={[
          "Revenue PPD minus Cost PPD equals your margin spread - bigger is better",
          "Nursing is typically your largest cost - watch for facilities above benchmark",
          "Use the benchmark editor to set your own targets based on your strategic goals",
          "Arrows indicate if higher (↑) or lower (↓) values are desirable"
        ]}
        reviewSuggestions={[
          "Focus on facilities in the 'Poor' status column for immediate attention",
          "Compare top performers vs bottom to identify best practice differences",
          "If contract labor is high, nursing PPD will be inflated - address staffing first",
          "Therapy cost PSD impacts skilled margin - ensure therapy is productive"
        ]}
      />
      <div className="ppd-header">
        <div className="ppd-header-right">
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <Table2 size={18} />
            </button>
            <button
              className={`view-btn ${viewMode === 'chart' ? 'active' : ''}`}
              onClick={() => setViewMode('chart')}
              title="Chart View"
            >
              <BarChart3 size={18} />
            </button>
          </div>
          <span className="period-badge">{formatPeriod(periodId)}</span>
        </div>
      </div>

      {/* Setting Type Tabs */}
      <div className="setting-tabs mb-6">
        {(['SNF', 'ALF', 'ILF'] as const).map((setting) => (
          <button
            key={setting}
            className={`setting-tab ${settingFilter === setting ? 'active' : ''}`}
            onClick={() => {
              setSettingFilter(setting);
              setSelectedMetricId(METRICS_BY_SETTING[setting][0].id);
            }}
          >
            {setting}
          </button>
        ))}
      </div>

      <div className="ppd-content">
        {/* Sidebar - Metric Selection & Benchmarks */}
        <div className="ppd-sidebar">
          <div className="sidebar-section">
            <div className="section-header">
              <h4>Select Metric</h4>
            </div>
            <div className="metric-list">
              {availableMetrics.map((metric) => (
                <button
                  key={metric.id}
                  className={`metric-btn ${selectedMetricId === metric.id ? 'active' : ''}`}
                  onClick={() => setSelectedMetricId(metric.id)}
                >
                  <div className="metric-btn-content">
                    <span className="metric-label">{metric.label}</span>
                    <span className="metric-benchmark">
                      Target: {formatValue(getCurrentBenchmark(metric.id), metric.format)}
                    </span>
                  </div>
                  {metric.inverse ? (
                    <TrendingDown size={14} className="text-muted" />
                  ) : (
                    <TrendingUp size={14} className="text-muted" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-header">
              <h4>
                Benchmark Settings
                <InfoTooltip
                  content="Customize target benchmarks based on your organization's goals. Click the edit icon to modify, reset icon to restore defaults. Your settings are saved locally."
                  type="tip"
                />
              </h4>
              <div className="benchmark-actions">
                {editingBenchmarks ? (
                  <button className="icon-btn" onClick={() => setEditingBenchmarks(false)} title="Save">
                    <Save size={16} />
                  </button>
                ) : (
                  <button className="icon-btn" onClick={() => setEditingBenchmarks(true)} title="Edit">
                    <Edit2 size={16} />
                  </button>
                )}
                <button className="icon-btn" onClick={resetBenchmarks} title="Reset to defaults">
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
            <div className="benchmark-list">
              {availableMetrics.map((metric) => (
                <div key={metric.id} className="benchmark-input-row">
                  <label>{metric.label}</label>
                  {editingBenchmarks ? (
                    <input
                      type="number"
                      value={getCurrentBenchmark(metric.id)}
                      onChange={(e) => updateBenchmark(metric.id, parseFloat(e.target.value) || 0)}
                      step={metric.format === 'hours' ? 0.1 : 1}
                    />
                  ) : (
                    <span className="benchmark-value">
                      {formatValue(getCurrentBenchmark(metric.id), metric.format)}
                    </span>
                  )}
                  <span className="benchmark-direction">
                    {metric.inverse ? '↓ lower' : '↑ higher'}
                  </span>
                </div>
              ))}
            </div>
            <p className="benchmark-note">
              {selectedMetric.inverse ? 'Lower values are better' : 'Higher values are better'}
            </p>
          </div>
        </div>

        {/* Main Content - Rankings */}
        <div className="ppd-main">
          {/* Stats Summary */}
          {stats && (
            <div className="stats-bar">
              <div className="stat-item">
                <DollarSign size={16} />
                <span className="stat-label">Avg</span>
                <span className="stat-value">{formatValue(stats.avg, selectedMetric.format)}</span>
              </div>
              <div className="stat-item">
                <TrendingDown size={16} />
                <span className="stat-label">Min</span>
                <span className="stat-value">{formatValue(stats.min, selectedMetric.format)}</span>
              </div>
              <div className="stat-item">
                <TrendingUp size={16} />
                <span className="stat-label">Max</span>
                <span className="stat-value">{formatValue(stats.max, selectedMetric.format)}</span>
              </div>
              <div className="stat-item">
                <Activity size={16} />
                <span className="stat-label">Meeting Target</span>
                <span className="stat-value">{stats.meetingBenchmark} / {stats.total}</span>
              </div>
              <div className="stat-item benchmark-indicator">
                <Users size={16} />
                <span className="stat-label">Benchmark</span>
                <span className="stat-value">{formatValue(stats.benchmark, selectedMetric.format)}</span>
              </div>
            </div>
          )}

          {/* Metric Info */}
          <div className="metric-info">
            <h3>{selectedMetric.label}</h3>
            <p>{selectedMetric.description}</p>
          </div>

          {/* Chart View */}
          {viewMode === 'chart' && (
            <div className="rankings-chart-container">
              <div className="chart-wrapper" style={{ height: Math.max(400, rankedFacilities.length * 32) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rankedFacilities.map((f, idx) => ({
                      ...f,
                      rank: idx + 1,
                      displayName: `${f.name} (${f.state})`,
                      status: getPerformanceStatus(f.value, getCurrentBenchmark(selectedMetric.id), selectedMetric.inverse)
                    }))}
                    layout="vertical"
                    margin={{ top: 20, right: 80, left: 140, bottom: 20 }}
                  >
                    <XAxis
                      type="number"
                      domain={[0, 'dataMax']}
                      tickFormatter={(v) => formatValue(v, selectedMetric.format)}
                      stroke="var(--text-muted)"
                      fontSize={11}
                    />
                    <YAxis
                      type="category"
                      dataKey="displayName"
                      width={130}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(102, 126, 234, 0.1)' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const data = payload[0].payload;
                        const benchmark = getCurrentBenchmark(selectedMetric.id);
                        const variance = data.value - benchmark;
                        return (
                          <div style={{
                            background: 'rgba(15, 15, 26, 0.98)',
                            border: '1px solid rgba(102, 126, 234, 0.6)',
                            borderRadius: '8px',
                            padding: '12px',
                            minWidth: '200px'
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                              #{data.rank} {data.name}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              <div style={{ marginBottom: '4px' }}>
                                <strong>Value:</strong> {formatValue(data.value, selectedMetric.format)}
                              </div>
                              <div style={{ marginBottom: '4px' }}>
                                <strong>Benchmark:</strong> {formatValue(benchmark, selectedMetric.format)}
                              </div>
                              <div style={{ color: (selectedMetric.inverse ? variance <= 0 : variance >= 0) ? 'var(--success)' : 'var(--danger)' }}>
                                <strong>Variance:</strong> {variance >= 0 ? '+' : ''}{formatValue(variance, selectedMetric.format)}
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine
                      x={getCurrentBenchmark(selectedMetric.id)}
                      stroke="var(--warning)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{
                        value: `Target: ${formatValue(getCurrentBenchmark(selectedMetric.id), selectedMetric.format)}`,
                        position: 'top',
                        fill: 'var(--warning)',
                        fontSize: 11
                      }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 4, 4, 0]}
                      onClick={(data) => {
                        const facilityData = data as unknown as { facility_id: string };
                        onFacilitySelect(facilityData.facility_id);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {rankedFacilities.map((facility, index) => {
                        const status = getPerformanceStatus(facility.value, getCurrentBenchmark(selectedMetric.id), selectedMetric.inverse);
                        const colors = {
                          excellent: '#10b981',
                          good: '#3b82f6',
                          warning: '#f59e0b',
                          poor: '#ef4444'
                        };
                        return <Cell key={index} fill={colors[status]} />;
                      })}
                      <LabelList
                        dataKey="value"
                        position="right"
                        formatter={(v) => formatValue(Number(v), selectedMetric.format)}
                        style={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend */}
              <div className="ranking-legend" style={{ marginTop: '16px' }}>
                <div className="legend-item">
                  <span className="legend-dot excellent" />
                  <span>Excellent</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot good" />
                  <span>Good</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot warning" />
                  <span>Warning</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot poor" />
                  <span>Poor</span>
                </div>
                <div className="legend-item" style={{ marginLeft: 'auto' }}>
                  <span style={{ width: '20px', height: '2px', background: 'var(--warning)', display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} />
                  <span>Benchmark Target</span>
                </div>
              </div>
            </div>
          )}

          {/* Table View - Rankings Table */}
          {viewMode === 'table' && (
            <>
          <div className="rankings-table-container" ref={tableRef} style={{ position: 'relative' }}>
            {/* Facility Stats Hover Tooltip */}
            {hoveredFacility && (() => {
              const stats = getHoveredFacilityStats(hoveredFacility.facility_id);
              const isNegativeMargin = stats.margin !== null && stats.margin < 0;

              return (
                <div style={{
                  position: 'fixed',
                  left: hoveredFacility.x,
                  top: hoveredFacility.y,
                  transform: 'translateY(-50%)',
                  background: 'rgba(15, 15, 26, 0.98)',
                  border: '1px solid rgba(102, 126, 234, 0.6)',
                  borderRadius: '12px',
                  padding: '16px',
                  minWidth: '280px',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
                  zIndex: 9999,
                  backdropFilter: 'blur(12px)',
                  pointerEvents: 'none'
                }}>
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <Building2 size={18} style={{ color: 'var(--primary)' }} />
                    <div>
                      <div className="font-bold" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                        {hoveredFacility.name}
                      </div>
                      <div className="text-xs text-muted">{hoveredFacility.state} • {settingFilter}</div>
                    </div>
                  </div>

                  {/* Key Stats Grid */}
                  {settingFilter === 'SNF' ? (
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      <div style={{ padding: '10px', background: isNegativeMargin ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 217, 165, 0.15)', borderRadius: '8px' }}>
                        <div className="flex items-center gap-1 text-xs text-muted mb-1">
                          <Percent size={12} /> Operating Margin
                        </div>
                        <div className="font-bold" style={{ color: isNegativeMargin ? 'var(--danger)' : 'var(--success)', fontSize: '16px' }}>
                          {stats.margin !== null ? `${stats.margin.toFixed(1)}%` : '--'}
                        </div>
                      </div>
                      <div style={{ padding: '10px', background: 'rgba(102, 126, 234, 0.15)', borderRadius: '8px' }}>
                        <div className="flex items-center gap-1 text-xs text-muted mb-1">
                          <Users size={12} /> Skilled Mix (MCR)
                        </div>
                        <div className="font-bold" style={{ color: 'var(--primary)', fontSize: '16px' }}>
                          {stats.skilledMix != null ? `${stats.skilledMix.toFixed(1)}%` : '--'}
                        </div>
                      </div>
                      <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '8px' }}>
                        <div className="flex items-center gap-1 text-xs text-muted mb-1">
                          <Users size={12} /> Medicaid Mix (MCD)
                        </div>
                        <div className="font-bold" style={{ color: 'var(--warning)', fontSize: '16px' }}>
                          {stats.medicaidMix != null ? `${stats.medicaidMix.toFixed(1)}%` : '--'}
                        </div>
                      </div>
                      <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <div className="flex items-center gap-1 text-xs text-muted mb-1">
                          <Activity size={12} /> Contract Labor
                        </div>
                        <div className="font-bold" style={{ color: stats.contractLabor != null && stats.contractLabor > 15 ? 'var(--danger)' : 'var(--text-primary)', fontSize: '16px' }}>
                          {stats.contractLabor != null ? `${stats.contractLabor.toFixed(1)}%` : '--'}
                        </div>
                      </div>
                      <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <div className="flex items-center gap-1 text-xs text-muted mb-1">
                          <DollarSign size={12} /> Revenue PPD
                        </div>
                        <div className="font-bold" style={{ color: 'var(--text-primary)', fontSize: '16px' }}>
                          {stats.revenuePPD !== null ? `$${stats.revenuePPD.toFixed(0)}` : '--'}
                        </div>
                      </div>
                      <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <div className="flex items-center gap-1 text-xs text-muted mb-1">
                          <DollarSign size={12} /> Cost PPD
                        </div>
                        <div className="font-bold" style={{ color: 'var(--text-primary)', fontSize: '16px' }}>
                          {stats.costPPD !== null ? `$${stats.costPPD.toFixed(0)}` : '--'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      <div style={{ padding: '10px', background: isNegativeMargin ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 217, 165, 0.15)', borderRadius: '8px' }}>
                        <div className="flex items-center gap-1 text-xs text-muted mb-1">
                          <Percent size={12} /> Operating Margin
                        </div>
                        <div className="font-bold" style={{ color: isNegativeMargin ? 'var(--danger)' : 'var(--success)', fontSize: '16px' }}>
                          {stats.margin !== null ? `${stats.margin.toFixed(1)}%` : '--'}
                        </div>
                      </div>
                      <div style={{ padding: '10px', background: 'rgba(102, 126, 234, 0.15)', borderRadius: '8px' }}>
                        <div className="flex items-center gap-1 text-xs text-muted mb-1">
                          <Target size={12} /> Occupancy
                        </div>
                        <div className="font-bold" style={{ color: 'var(--primary)', fontSize: '16px' }}>
                          {stats.occupancy != null ? `${stats.occupancy.toFixed(1)}%` : '--'}
                        </div>
                      </div>
                      <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <div className="flex items-center gap-1 text-xs text-muted mb-1">
                          <DollarSign size={12} /> RevPOR
                        </div>
                        <div className="font-bold" style={{ color: 'var(--text-primary)', fontSize: '16px' }}>
                          {stats.revpor != null ? `$${stats.revpor.toFixed(0)}` : '--'}
                        </div>
                      </div>
                      <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <div className="flex items-center gap-1 text-xs text-muted mb-1">
                          <DollarSign size={12} /> Cost PPD
                        </div>
                        <div className="font-bold" style={{ color: 'var(--text-primary)', fontSize: '16px' }}>
                          {stats.costPPD !== null ? `$${stats.costPPD.toFixed(0)}` : '--'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Click hint */}
                  <div className="text-center mt-3 text-xs text-muted">
                    Click to view full details →
                  </div>
                </div>
              );
            })()}

            <table className="rankings-table">
              <thead>
                <tr>
                  <th className="rank-col">Rank</th>
                  <th>Facility</th>
                  <th>State</th>
                  <th className="value-col">{selectedMetric.label}</th>
                  <th className="variance-col">vs Benchmark</th>
                  <th className="percentile-col">Percentile</th>
                  <th className="status-col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rankedFacilities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      No data available for this metric
                    </td>
                  </tr>
                ) : (
                  rankedFacilities.map((facility, index) => {
                    const benchmark = getCurrentBenchmark(selectedMetric.id);
                    const variance = facility.value - benchmark;
                    const variancePercent = (variance / benchmark) * 100;
                    const status = getPerformanceStatus(facility.value, benchmark, selectedMetric.inverse);
                    const percentile = getPercentile(index + 1, rankedFacilities.length);

                    return (
                      <tr
                        key={facility.facility_id}
                        className={`rank-row status-${status}`}
                        onClick={() => onFacilitySelect(facility.facility_id)}
                        onMouseEnter={(e) => handleRowHover(facility, e)}
                        onMouseLeave={() => setHoveredFacility(null)}
                        style={{
                          cursor: 'pointer',
                          background: hoveredFacility?.facility_id === facility.facility_id ? 'rgba(102, 126, 234, 0.1)' : undefined
                        }}
                      >
                        <td className="rank-col">
                          <span className={`rank-badge ${index < 3 ? 'top-3' : index < rankedFacilities.length / 3 ? 'top-third' : index >= rankedFacilities.length * 2 / 3 ? 'bottom-third' : ''}`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="facility-name">{facility.name}</td>
                        <td>{facility.state}</td>
                        <td className="value-col">
                          <span className="value-display">
                            {formatValue(facility.value, selectedMetric.format)}
                          </span>
                        </td>
                        <td className={`variance-col ${(selectedMetric.inverse ? variance <= 0 : variance >= 0) ? 'positive' : 'negative'}`}>
                          {variance >= 0 ? '+' : ''}{formatValue(variance, selectedMetric.format)}
                          <span className="variance-percent">
                            ({variancePercent >= 0 ? '+' : ''}{variancePercent.toFixed(1)}%)
                          </span>
                        </td>
                        <td className="percentile-col">
                          <div className="percentile-bar">
                            <div className="percentile-fill" style={{ width: `${percentile}%` }} />
                            <span className="percentile-text">{percentile}%</span>
                          </div>
                        </td>
                        <td className="status-col">
                          <span className={`status-badge status-${status}`}>
                            {status === 'excellent' ? 'Excellent' :
                             status === 'good' ? 'Good' :
                             status === 'warning' ? 'Warning' : 'Poor'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="ranking-legend">
            <div className="legend-item">
              <span className="legend-dot excellent" />
              <span>Excellent ({selectedMetric.inverse ? '≤85%' : '≥115%'} of target)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot good" />
              <span>Good (Meeting target)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot warning" />
              <span>Warning (Near target)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot poor" />
              <span>Poor ({selectedMetric.inverse ? '≥115%' : '≤85%'} of target)</span>
            </div>
          </div>
            </>
          )}
        </div>
      </div>

      {/* Narrative Report Section */}
      <NarrativeReport
        context="ppd"
        periodId={periodId}
        title="PPD Analysis Narrative"
      />
    </div>
  );
}
