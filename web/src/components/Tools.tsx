import { useQuery, useQueries } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { TrendingUp, Users, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import './Tools.css';

type SettingFilter = 'all' | 'SNF' | 'ALF' | 'ILF';

interface ToolsProps {
  periodId: string;
  settingFilter: SettingFilter;
}

interface Facility {
  facility_id: string;
  name: string;
  state: string;
  setting: string;
}

interface TrendData {
  period_id: string;
  value: number;
}

interface KPIData {
  facility_id: string;
  kpi_id: string;
  value: number | null;
  name: string;
  state: string;
  setting: string;
}

// Industry benchmarks by setting type
const BENCHMARKS: Record<string, Record<string, { target: number; good: number; warning: number; higherIsBetter: boolean }>> = {
  SNF: {
    snf_operating_margin_pct: { target: 8, good: 5, warning: 0, higherIsBetter: true },
    snf_skilled_mix_pct: { target: 25, good: 18, warning: 12, higherIsBetter: true },
    snf_total_revenue_ppd: { target: 420, good: 380, warning: 340, higherIsBetter: true },
    snf_total_cost_ppd: { target: 320, good: 360, warning: 400, higherIsBetter: false },
    snf_nursing_cost_ppd: { target: 140, good: 160, warning: 190, higherIsBetter: false },
    snf_contract_labor_pct_nursing: { target: 5, good: 10, warning: 18, higherIsBetter: false },
  },
  ALF: {
    sl_occupancy_pct_units: { target: 92, good: 85, warning: 75, higherIsBetter: true },
    sl_revpor: { target: 5500, good: 4500, warning: 3500, higherIsBetter: true },
  },
  ILF: {
    sl_occupancy_pct_units: { target: 95, good: 90, warning: 80, higherIsBetter: true },
    sl_revpor: { target: 4000, good: 3500, warning: 3000, higherIsBetter: true },
  },
};

const KPI_OPTIONS = [
  { id: 'snf_operating_margin_pct', label: 'EBITDAR Margin %', format: 'percentage', setting: 'SNF' },
  { id: 'snf_skilled_mix_pct', label: 'Skilled Mix %', format: 'percentage', setting: 'SNF' },
  { id: 'snf_total_revenue_ppd', label: 'Total Revenue PPD', format: 'currency', setting: 'SNF' },
  { id: 'snf_total_cost_ppd', label: 'Total Expense PPD', format: 'currency', setting: 'SNF' },
  { id: 'snf_nursing_cost_ppd', label: 'Nursing Expense PPD', format: 'currency', setting: 'SNF' },
  { id: 'snf_contract_labor_pct_nursing', label: 'Contract Labor %', format: 'percentage', setting: 'SNF' },
  { id: 'snf_medicare_a_mix_pct', label: 'Medicare A Mix %', format: 'percentage', setting: 'SNF' },
  { id: 'snf_ma_mix_pct', label: 'Medicare Advantage Mix %', format: 'percentage', setting: 'SNF' },
  { id: 'sl_occupancy_pct_units', label: 'Occupancy %', format: 'percentage', setting: 'ALF' },
  { id: 'sl_revpor', label: 'RevPOR', format: 'currency', setting: 'ALF' },
];

const CHART_COLORS = ['#667eea', '#f093fb', '#00d9a5', '#ffc107'];

async function fetchFacilities(): Promise<Facility[]> {
  const res = await fetch('https://snfpnl.onrender.com/api/facilities');
  if (!res.ok) throw new Error('Failed to fetch facilities');
  return res.json();
}

async function fetchTrends(facilityId: string, kpiId: string): Promise<TrendData[]> {
  const res = await fetch(`https://snfpnl.onrender.com/api/trends/${facilityId}/${kpiId}`);
  if (!res.ok) throw new Error('Failed to fetch trends');
  return res.json();
}

async function fetchAllKPIs(periodId: string): Promise<KPIData[]> {
  const res = await fetch(`https://snfpnl.onrender.com/api/kpis/all/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch KPIs');
  return res.json();
}

async function fetchFacilityKPIs(facilityId: string, periodId: string): Promise<KPIData[]> {
  const res = await fetch(`https://snfpnl.onrender.com/api/kpis/${facilityId}/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch facility KPIs');
  return res.json();
}

export function Tools({ periodId, settingFilter }: ToolsProps) {
  const [selectedTool, setSelectedTool] = useState<'trends' | 'peer' | 'compare' | 'variance'>('trends');
  const [selectedKPI, setSelectedKPI] = useState('snf_operating_margin_pct');
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: fetchFacilities,
  });

  const { data: allKPIs = [] } = useQuery({
    queryKey: ['allKPIs', periodId],
    queryFn: () => fetchAllKPIs(periodId),
  });

  // Fetch trends for all selected facilities
  const trendQueries = useQueries({
    queries: selectedFacilities.map((facilityId) => ({
      queryKey: ['trends', facilityId, selectedKPI],
      queryFn: () => fetchTrends(facilityId, selectedKPI),
      enabled: selectedFacilities.length > 0,
    })),
  });

  // Fetch all KPIs for selected facilities (for comparison view)
  const facilityKPIQueries = useQueries({
    queries: selectedFacilities.map((facilityId) => ({
      queryKey: ['facilityKPIs', facilityId, periodId],
      queryFn: () => fetchFacilityKPIs(facilityId, periodId),
      enabled: selectedTool === 'compare' && selectedFacilities.length > 0,
    })),
  });

  const filteredFacilities = facilities.filter(
    (f) => settingFilter === 'all' || f.setting === settingFilter
  );

  const selectedKPIOption = KPI_OPTIONS.find((k) => k.id === selectedKPI);

  const formatValue = (value: number | null | undefined, format: string) => {
    if (value === null || value === undefined) return '--';
    if (format === 'currency') return `$${value.toFixed(0)}`;
    if (format === 'percentage') return `${value.toFixed(1)}%`;
    return value.toFixed(2);
  };

  // Combine trend data for multi-facility chart
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const combinedTrendData = useMemo(() => {
    if (trendQueries.some(q => q.isLoading) || trendQueries.length === 0) return [];

    const allPeriods = new Set<string>();
    trendQueries.forEach(q => {
      (q.data || []).forEach(d => allPeriods.add(d.period_id));
    });

    const sortedPeriods = Array.from(allPeriods).sort();

    return sortedPeriods.map(period => {
      const dataPoint: Record<string, string | number | null> = { period_id: period };
      selectedFacilities.forEach((facilityId, idx) => {
        const facilityData = trendQueries[idx]?.data || [];
        const match = facilityData.find(d => d.period_id === period);
        const facility = facilities.find(f => f.facility_id === facilityId);
        dataPoint[facility?.name || facilityId] = match?.value ?? null;
      });
      return dataPoint;
    });
  }, [trendQueries, selectedFacilities, facilities]); // eslint-disable-line react-hooks/preserve-manual-memoization

  // Get KPI data for peer comparison
  const peerData = useMemo(() => {
    return allKPIs
      .filter((k) => k.kpi_id === selectedKPI)
      .filter((k) => settingFilter === 'all' || k.setting === settingFilter)
      .filter((k) => k.value !== null)
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .map((k, idx) => ({
        ...k,
        rank: idx + 1,
      }));
  }, [allKPIs, selectedKPI, settingFilter]);

  // Calculate statistics
  const values = peerData.map((p) => p.value).filter((v): v is number => v !== null);
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const p25 = values[Math.floor(values.length * 0.75)] || 0;
  const p75 = values[Math.floor(values.length * 0.25)] || 0;

  const benchmark = BENCHMARKS[settingFilter === 'all' ? 'SNF' : settingFilter]?.[selectedKPI];

  // Build comparison data for selected facilities
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const comparisonData = useMemo(() => {
    if (selectedTool !== 'compare' || selectedFacilities.length === 0) return [];

    const kpiList = ['snf_operating_margin_pct', 'snf_skilled_mix_pct', 'snf_total_revenue_ppd', 'snf_nursing_cost_ppd', 'snf_contract_labor_pct_nursing'];

    return kpiList.map(kpiId => {
      const kpiOption = KPI_OPTIONS.find(k => k.id === kpiId);
      const row: Record<string, string | number | null> = {
        kpi: kpiOption?.label || kpiId,
        kpi_id: kpiId,
      };

      selectedFacilities.forEach((facilityId, idx) => {
        const facilityKPIs = facilityKPIQueries[idx]?.data || [];
        const kpiData = facilityKPIs.find((k) => k.kpi_id === kpiId);
        const facility = facilities.find(f => f.facility_id === facilityId);
        row[facility?.name || `Facility ${idx + 1}`] = kpiData?.value ?? null;
      });

      return row;
    });
  }, [selectedTool, selectedFacilities, facilityKPIQueries, facilities]); // eslint-disable-line react-hooks/preserve-manual-memoization

  // Radar chart data for comparison
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const radarData = useMemo(() => {
    if (selectedFacilities.length === 0) return [];

    const metrics = [
      { id: 'snf_operating_margin_pct', label: 'EBITDAR Margin', max: 20 },
      { id: 'snf_skilled_mix_pct', label: 'Skilled Mix', max: 40 },
      { id: 'snf_contract_labor_pct_nursing', label: 'Contract Labor', max: 30, inverse: true },
    ];

    return metrics.map(metric => {
      const point: Record<string, string | number> = { metric: metric.label };

      selectedFacilities.forEach((facilityId) => {
        const kpiData = allKPIs.find(
          k => k.facility_id === facilityId && k.kpi_id === metric.id
        );
        const facility = facilities.find(f => f.facility_id === facilityId);
        let value = kpiData?.value ?? 0;
        if (metric.inverse) value = metric.max - value;
        point[facility?.name || facilityId] = Math.max(0, Math.min(100, (value / metric.max) * 100));
      });

      return point;
    });
  }, [selectedFacilities, allKPIs, facilities]); // eslint-disable-line react-hooks/preserve-manual-memoization

  const toggleFacility = (id: string) => {
    setSelectedFacilities((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id].slice(-4)
    );
  };

  const isLoading = trendQueries.some(q => q.isLoading);

  return (
    <div className="tools animate-fade-in">
      <div className="tools-header">
        <div>
          <h2>Analytics Tools</h2>
          <p className="text-muted">Deep dive into portfolio performance</p>
        </div>
      </div>

      {/* Tool selector */}
      <div className="tool-tabs mb-6">
        <button
          className={`tool-tab ${selectedTool === 'trends' ? 'active' : ''}`}
          onClick={() => setSelectedTool('trends')}
        >
          <TrendingUp size={18} />
          Trend Analysis
        </button>
        <button
          className={`tool-tab ${selectedTool === 'compare' ? 'active' : ''}`}
          onClick={() => setSelectedTool('compare')}
        >
          <Users size={18} />
          Compare Buildings
        </button>
        <button
          className={`tool-tab ${selectedTool === 'peer' ? 'active' : ''}`}
          onClick={() => setSelectedTool('peer')}
        >
          <BarChart3 size={18} />
          Peer Ranking
        </button>
        <button
          className={`tool-tab ${selectedTool === 'variance' ? 'active' : ''}`}
          onClick={() => setSelectedTool('variance')}
        >
          <BarChart3 size={18} />
          Benchmark Analysis
        </button>
      </div>

      <div className="tools-content">
        {/* Sidebar */}
        <div className="tools-sidebar">
          {(selectedTool === 'trends' || selectedTool === 'peer' || selectedTool === 'variance') && (
            <>
              <h3>Select KPI</h3>
              <div className="kpi-list">
                {KPI_OPTIONS.filter(
                  (k) => settingFilter === 'all' || k.setting === settingFilter || k.setting === 'SNF'
                ).map((kpi) => (
                  <button
                    key={kpi.id}
                    className={`kpi-item ${selectedKPI === kpi.id ? 'active' : ''}`}
                    onClick={() => setSelectedKPI(kpi.id)}
                  >
                    {kpi.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {(selectedTool === 'trends' || selectedTool === 'compare') && (
            <>
              <h3 className="mt-4">Select Buildings (max 4)</h3>
              <div className="selected-count">
                {selectedFacilities.length} of 4 selected
              </div>
              <div className="facility-list">
                {filteredFacilities.map((f) => (
                  <button
                    key={f.facility_id}
                    className={`facility-item ${selectedFacilities.includes(f.facility_id) ? 'active' : ''}`}
                    onClick={() => toggleFacility(f.facility_id)}
                  >
                    <span className="facility-name">{f.name}</span>
                    <span className={`badge badge-${f.setting.toLowerCase()}`}>{f.setting}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Main content area */}
        <div className="tools-main">
          {selectedTool === 'trends' && (
            <div className="tool-panel">
              <div className="panel-header">
                <h3>{selectedKPIOption?.label} - 24 Month Trend</h3>
                {selectedFacilities.length > 0 && (
                  <div className="legend-chips">
                    {selectedFacilities.map((id, idx) => {
                      const fac = facilities.find(f => f.facility_id === id);
                      return (
                        <span key={id} className="legend-chip" style={{ borderColor: CHART_COLORS[idx] }}>
                          <span className="legend-dot" style={{ background: CHART_COLORS[idx] }} />
                          {fac?.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedFacilities.length === 0 ? (
                <div className="empty-state">
                  Select up to 4 buildings from the sidebar to compare trends
                </div>
              ) : isLoading ? (
                <div className="loading"><div className="spinner" /></div>
              ) : (
                <div className="chart-container-large">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={combinedTrendData}>
                      <XAxis
                        dataKey="period_id"
                        tickFormatter={(p) => {
                          const [y, m] = p.split('-');
                          return `${m}/${y.slice(2)}`;
                        }}
                        stroke="rgba(255,255,255,0.5)"
                      />
                      <YAxis
                        tickFormatter={(v) =>
                          selectedKPIOption?.format === 'percentage' ? `${v}%` : `$${v}`
                        }
                        stroke="rgba(255,255,255,0.5)"
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 15, 26, 0.95)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                        }}
                        formatter={(value: number | undefined) => [
                          formatValue(value ?? null, selectedKPIOption?.format || 'number'),
                        ]}
                      />
                      <Legend />
                      {selectedFacilities.map((facilityId, idx) => {
                        const facility = facilities.find(f => f.facility_id === facilityId);
                        return (
                          <Line
                            key={facilityId}
                            type="monotone"
                            dataKey={facility?.name || facilityId}
                            stroke={CHART_COLORS[idx]}
                            strokeWidth={2}
                            dot={{ fill: CHART_COLORS[idx], r: 3 }}
                            activeDot={{ r: 6 }}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {selectedTool === 'compare' && (
            <div className="tool-panel">
              <div className="panel-header">
                <h3>Building Comparison - {periodId}</h3>
              </div>
              {selectedFacilities.length === 0 ? (
                <div className="empty-state">
                  Select up to 4 buildings from the sidebar to compare
                </div>
              ) : (
                <div className="comparison-content">
                  {/* Summary Cards */}
                  <div className="comparison-cards">
                    {selectedFacilities.map((facilityId, idx) => {
                      const facility = facilities.find(f => f.facility_id === facilityId);
                      const facilityKPIs = facilityKPIQueries[idx]?.data || [];
                      const margin = facilityKPIs.find((k) => k.kpi_id === 'snf_operating_margin_pct')?.value;
                      const skilled = facilityKPIs.find((k) => k.kpi_id === 'snf_skilled_mix_pct')?.value;
                      const revenue = facilityKPIs.find((k) => k.kpi_id === 'snf_total_revenue_ppd')?.value;
                      const contract = facilityKPIs.find((k) => k.kpi_id === 'snf_contract_labor_pct_nursing')?.value;

                      return (
                        <div key={facilityId} className="comparison-card" style={{ borderTopColor: CHART_COLORS[idx] }}>
                          <div className="comparison-card-header">
                            <h4>{facility?.name}</h4>
                            <span className={`badge badge-${facility?.setting.toLowerCase()}`}>{facility?.setting}</span>
                          </div>
                          <div className="comparison-card-stats">
                            <div className="comp-stat">
                              <span className="comp-label">EBITDAR Margin</span>
                              <span className={`comp-value ${(margin ?? 0) >= 8 ? 'text-success' : (margin ?? 0) >= 0 ? 'text-warning' : 'text-danger'}`}>
                                {formatValue(margin, 'percentage')}
                              </span>
                            </div>
                            <div className="comp-stat">
                              <span className="comp-label">Skilled Mix</span>
                              <span className="comp-value">{formatValue(skilled, 'percentage')}</span>
                            </div>
                            <div className="comp-stat">
                              <span className="comp-label">Revenue PPD</span>
                              <span className="comp-value">{formatValue(revenue, 'currency')}</span>
                            </div>
                            <div className="comp-stat">
                              <span className="comp-label">Contract Labor</span>
                              <span className={`comp-value ${(contract ?? 0) <= 10 ? 'text-success' : (contract ?? 0) <= 18 ? 'text-warning' : 'text-danger'}`}>
                                {formatValue(contract, 'percentage')}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Radar Chart */}
                  {radarData.length > 0 && (
                    <div className="comparison-chart">
                      <h4>Performance Radar</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="rgba(255,255,255,0.2)" />
                          <PolarAngleAxis dataKey="metric" stroke="rgba(255,255,255,0.7)" />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(255,255,255,0.3)" />
                          {selectedFacilities.map((facilityId, idx) => {
                            const facility = facilities.find(f => f.facility_id === facilityId);
                            return (
                              <Radar
                                key={facilityId}
                                name={facility?.name || facilityId}
                                dataKey={facility?.name || facilityId}
                                stroke={CHART_COLORS[idx]}
                                fill={CHART_COLORS[idx]}
                                fillOpacity={0.2}
                              />
                            );
                          })}
                          <Legend />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Comparison Table */}
                  <div className="comparison-table">
                    <table>
                      <thead>
                        <tr>
                          <th>KPI</th>
                          {selectedFacilities.map((facilityId, idx) => {
                            const facility = facilities.find(f => f.facility_id === facilityId);
                            return (
                              <th key={facilityId} style={{ borderBottom: `3px solid ${CHART_COLORS[idx]}` }}>
                                {facility?.name}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonData.map((row) => {
                          const kpiOption = KPI_OPTIONS.find(k => k.id === row.kpi_id);
                          return (
                            <tr key={row.kpi_id}>
                              <td>{row.kpi}</td>
                              {selectedFacilities.map((facilityId) => {
                                const facility = facilities.find(f => f.facility_id === facilityId);
                                const value = row[facility?.name || ''];
                                const numValue = typeof value === 'number' ? value : null;
                                return (
                                  <td key={facilityId} className="font-semibold">
                                    {formatValue(numValue, kpiOption?.format || 'number')}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedTool === 'peer' && (
            <div className="tool-panel">
              <div className="panel-header">
                <h3>{selectedKPIOption?.label} - Peer Ranking</h3>
                <div className="panel-stats">
                  <div className="stat">
                    <span className="stat-label">Average</span>
                    <span className="stat-value">{formatValue(avg, selectedKPIOption?.format || 'number')}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Top 25%</span>
                    <span className="stat-value text-success">{formatValue(p75, selectedKPIOption?.format || 'number')}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Bottom 25%</span>
                    <span className="stat-value text-danger">{formatValue(p25, selectedKPIOption?.format || 'number')}</span>
                  </div>
                </div>
              </div>
              {peerData.length === 0 ? (
                <div className="empty-state">No data available for the selected KPI and period</div>
              ) : (
                <div className="chart-container-large">
                  <ResponsiveContainer width="100%" height={Math.max(400, peerData.length * 28)}>
                    <BarChart data={peerData.slice(0, 30)} layout="vertical">
                      <XAxis type="number" stroke="rgba(255,255,255,0.5)" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 15, 26, 0.95)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                        }}
                        formatter={(value: number | undefined) => [
                          formatValue(value ?? null, selectedKPIOption?.format || 'number'),
                          selectedKPIOption?.label,
                        ]}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {peerData.slice(0, 30).map((entry, index) => (
                          <Cell
                            key={index}
                            fill={(entry.value ?? 0) >= p75 ? '#00d9a5' : (entry.value ?? 0) >= avg ? '#667eea' : (entry.value ?? 0) >= p25 ? '#ffc107' : '#ff4757'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {selectedTool === 'variance' && (
            <div className="tool-panel">
              <div className="panel-header">
                <h3>{selectedKPIOption?.label} - Benchmark Analysis</h3>
              </div>
              {benchmark ? (
                <div className="benchmark-content">
                  <div className="benchmark-targets">
                    <div className="benchmark-card success">
                      <span className="benchmark-label">Target</span>
                      <span className="benchmark-value">{formatValue(benchmark.target, selectedKPIOption?.format || 'number')}</span>
                    </div>
                    <div className="benchmark-card warning">
                      <span className="benchmark-label">Acceptable</span>
                      <span className="benchmark-value">{formatValue(benchmark.good, selectedKPIOption?.format || 'number')}</span>
                    </div>
                    <div className="benchmark-card danger">
                      <span className="benchmark-label">Warning</span>
                      <span className="benchmark-value">{formatValue(benchmark.warning, selectedKPIOption?.format || 'number')}</span>
                    </div>
                  </div>

                  <div className="variance-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Facility</th>
                          <th>State</th>
                          <th>Actual</th>
                          <th>vs Target</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {peerData.slice(0, 25).map((facility, idx) => {
                          const variance = (facility.value || 0) - benchmark.target;
                          const isHigherBetter = benchmark.higherIsBetter;
                          const status = isHigherBetter
                            ? (facility.value || 0) >= benchmark.target
                              ? 'success'
                              : (facility.value || 0) >= benchmark.good
                              ? 'warning'
                              : 'danger'
                            : (facility.value || 0) <= benchmark.target
                              ? 'success'
                              : (facility.value || 0) <= benchmark.good
                              ? 'warning'
                              : 'danger';
                          const varianceGood = isHigherBetter ? variance >= 0 : variance <= 0;

                          return (
                            <tr key={facility.facility_id}>
                              <td className="text-muted">{idx + 1}</td>
                              <td className="font-semibold">{facility.name}</td>
                              <td>{facility.state}</td>
                              <td className="font-semibold">
                                {formatValue(facility.value, selectedKPIOption?.format || 'number')}
                              </td>
                              <td className={varianceGood ? 'text-success' : 'text-danger'}>
                                <span className="variance-cell">
                                  {varianceGood ? (
                                    <ArrowUpRight size={16} />
                                  ) : (
                                    <ArrowDownRight size={16} />
                                  )}
                                  {formatValue(Math.abs(variance), selectedKPIOption?.format || 'number')}
                                </span>
                              </td>
                              <td>
                                <span className={`badge badge-${status}`}>
                                  {status === 'success' ? 'On Target' : status === 'warning' ? 'Monitor' : 'Action Needed'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  No benchmarks configured for this KPI and setting combination
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
