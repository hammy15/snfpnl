import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { GitCompare, Plus, X, ArrowRight, Search, Building2, Check } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface FacilityMetrics {
  facilityId: string;
  name: string;
  state: string;
  setting: string;
  periodId: string;
  metrics: Record<string, number | null>;
  historicalData: Array<{
    periodId: string;
    metrics: Record<string, number | null>;
  }>;
}

interface ComparisonData {
  facilities: FacilityMetrics[];
  kpiDefinitions: Record<string, { name: string; unit: string; higherIsBetter: boolean }>;
}

interface FacilityOption {
  facilityId: string;
  name: string;
  state: string;
  setting: string;
}

const METRIC_COLORS = ['#667eea', '#00d9a5', '#ff6b6b', '#ffa502', '#a55eea', '#26de81'];

const DEFAULT_COMPARISON_KPIS = [
  'snf_operating_margin_pct',
  'snf_occupancy_pct',
  'snf_skilled_mix_pct',
  'snf_total_revenue_ppd',
  'snf_labor_cost_pct_revenue',
  'snf_contract_labor_pct_nursing'
];

export function FacilityCompare({ periodId }: { periodId: string }) {
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSelector, setShowSelector] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'chart' | 'radar'>('table');
  const [selectedKpi, setSelectedKpi] = useState('snf_operating_margin_pct');

  // Fetch all facilities for selector
  const { data: facilitiesData } = useQuery<FacilityOption[]>({
    queryKey: ['facilities-list'],
    queryFn: async () => {
      const response = await fetch('https://snfpnl-production.up.railway.app/api/facilities');
      if (!response.ok) throw new Error('Failed to fetch facilities');
      return response.json();
    },
  });

  // Fetch comparison data for selected facilities
  const { data: comparisonData, isLoading } = useQuery<ComparisonData>({
    queryKey: ['facility-compare', selectedFacilities, periodId],
    queryFn: async () => {
      const response = await fetch('https://snfpnl-production.up.railway.app/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityIds: selectedFacilities, periodId }),
      });
      if (!response.ok) throw new Error('Failed to fetch comparison data');
      return response.json();
    },
    enabled: selectedFacilities.length >= 2,
  });

  const filteredFacilities = useMemo(() => {
    if (!facilitiesData) return [];
    return facilitiesData.filter(f =>
      !selectedFacilities.includes(f.facilityId) &&
      (f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       f.state.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [facilitiesData, selectedFacilities, searchQuery]);

  const addFacility = (facilityId: string) => {
    if (selectedFacilities.length < 6) {
      setSelectedFacilities([...selectedFacilities, facilityId]);
      setSearchQuery('');
      setShowSelector(false);
    }
  };

  const removeFacility = (facilityId: string) => {
    setSelectedFacilities(selectedFacilities.filter(id => id !== facilityId));
  };

  const formatValue = (value: number | null, unit: string) => {
    if (value === null) return 'N/A';
    if (unit === 'percentage') return `${value.toFixed(1)}%`;
    if (unit === 'currency') return `$${value.toFixed(0)}`;
    if (unit === 'hours') return value.toFixed(2);
    return value.toFixed(1);
  };

  const getComparisonIndicator = (values: (number | null)[], idx: number, higherIsBetter: boolean) => {
    const validValues = values.filter(v => v !== null) as number[];
    if (validValues.length < 2 || values[idx] === null) return null;

    const value = values[idx]!;
    const max = Math.max(...validValues);
    const min = Math.min(...validValues);

    if (value === max) return higherIsBetter ? 'best' : 'worst';
    if (value === min) return higherIsBetter ? 'worst' : 'best';
    return 'middle';
  };

  const prepareChartData = () => {
    if (!comparisonData) return [];

    // Get all unique periods across all facilities
    const allPeriods = new Set<string>();
    comparisonData.facilities.forEach(f => {
      f.historicalData.forEach(h => allPeriods.add(h.periodId));
    });

    const sortedPeriods = Array.from(allPeriods).sort();

    return sortedPeriods.map(period => {
      const dataPoint: Record<string, any> = { period: period.replace('_', ' ') };
      comparisonData.facilities.forEach(f => {
        const periodData = f.historicalData.find(h => h.periodId === period);
        dataPoint[f.name] = periodData?.metrics[selectedKpi] ?? null;
      });
      return dataPoint;
    });
  };

  const prepareRadarData = () => {
    if (!comparisonData) return [];

    return DEFAULT_COMPARISON_KPIS.map(kpiId => {
      const kpiDef = comparisonData.kpiDefinitions[kpiId];
      const dataPoint: Record<string, any> = {
        kpi: kpiDef?.name || kpiId,
        fullMark: 100
      };

      comparisonData.facilities.forEach(f => {
        const value = f.metrics[kpiId];
        // Normalize to 0-100 scale for radar
        if (value !== null) {
          // Simple normalization - you'd want to adjust based on actual ranges
          if (kpiId.includes('margin') || kpiId.includes('pct') || kpiId.includes('mix') || kpiId.includes('occupancy')) {
            dataPoint[f.name] = Math.min(100, Math.max(0, value + 20)); // Shift for visibility
          } else {
            dataPoint[f.name] = Math.min(100, value / 10); // Scale down large values
          }
        } else {
          dataPoint[f.name] = 0;
        }
      });

      return dataPoint;
    });
  };

  const selectedFacilityDetails = useMemo(() => {
    if (!facilitiesData) return [];
    return selectedFacilities.map(id => facilitiesData.find(f => f.facilityId === id)).filter(Boolean) as FacilityOption[];
  }, [facilitiesData, selectedFacilities]);

  return (
    <div className="facility-compare">
      {/* Facility Selector */}
      <div className="card mb-4" style={{ padding: '20px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <GitCompare size={24} className="text-primary" />
            <div>
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Facility Comparison</h3>
              <p className="text-sm text-muted">Select 2-6 facilities to compare side by side</p>
            </div>
          </div>
          {selectedFacilities.length >= 2 && (
            <div className="flex gap-2">
              <button
                className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('table')}
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                Table
              </button>
              <button
                className={`btn ${viewMode === 'chart' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('chart')}
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                Trend
              </button>
              <button
                className={`btn ${viewMode === 'radar' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('radar')}
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                Radar
              </button>
            </div>
          )}
        </div>

        {/* Selected facilities chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedFacilityDetails.map((facility, idx) => (
            <div
              key={facility.facilityId}
              className="flex items-center gap-2"
              style={{
                background: `${METRIC_COLORS[idx]}22`,
                border: `1px solid ${METRIC_COLORS[idx]}`,
                borderRadius: '20px',
                padding: '6px 12px'
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: METRIC_COLORS[idx]
                }}
              />
              <span className="font-medium" style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                {facility.name}
              </span>
              <span className="text-muted text-xs">{facility.state}</span>
              <button
                onClick={() => removeFacility(facility.facilityId)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
              >
                <X size={14} className="text-muted" />
              </button>
            </div>
          ))}

          {selectedFacilities.length < 6 && (
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowSelector(!showSelector)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px'
                }}
              >
                <Plus size={14} />
                Add Facility
              </button>

              {showSelector && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '8px',
                  width: '300px',
                  background: 'rgba(15,15,26,0.98)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  padding: '12px',
                  zIndex: 100,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                }}>
                  <div className="flex items-center gap-2 mb-3" style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}>
                    <Search size={16} className="text-muted" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search facilities..."
                      autoFocus
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        width: '100%',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {filteredFacilities.slice(0, 10).map(facility => (
                      <button
                        key={facility.facilityId}
                        onClick={() => addFacility(facility.facilityId)}
                        className="flex items-center gap-2 w-full"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '10px 8px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderRadius: '6px',
                          color: 'var(--text-primary)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <Building2 size={16} className="text-muted" />
                        <div className="flex-1">
                          <div className="font-medium">{facility.name}</div>
                          <div className="text-xs text-muted">{facility.state} • {facility.setting}</div>
                        </div>
                        <ArrowRight size={14} className="text-muted" />
                      </button>
                    ))}
                    {filteredFacilities.length === 0 && (
                      <div className="text-center text-muted py-4">No facilities found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedFacilities.length < 2 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            border: '2px dashed rgba(255,255,255,0.1)'
          }}>
            <GitCompare size={48} className="text-muted" style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p className="text-muted">Select at least 2 facilities to compare</p>
          </div>
        )}
      </div>

      {/* Comparison View */}
      {selectedFacilities.length >= 2 && comparisonData && (
        <>
          {viewMode === 'table' && (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, background: 'rgba(15,15,26,0.98)', zIndex: 1 }}>
                        Metric
                      </th>
                      {comparisonData.facilities.map((facility, idx) => (
                        <th key={facility.facilityId} style={{ textAlign: 'center', minWidth: '140px' }}>
                          <div className="flex items-center justify-center gap-2">
                            <div style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: METRIC_COLORS[idx]
                            }} />
                            <div>
                              <div style={{ color: 'var(--text-primary)' }}>{facility.name}</div>
                              <div className="text-xs text-muted">{facility.state}</div>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DEFAULT_COMPARISON_KPIS.map(kpiId => {
                      const kpiDef = comparisonData.kpiDefinitions[kpiId];
                      const values = comparisonData.facilities.map(f => f.metrics[kpiId]);

                      return (
                        <tr key={kpiId}>
                          <td style={{
                            position: 'sticky',
                            left: 0,
                            background: 'rgba(15,15,26,0.98)',
                            fontWeight: 500
                          }}>
                            {kpiDef?.name || kpiId}
                          </td>
                          {comparisonData.facilities.map((facility, idx) => {
                            const value = facility.metrics[kpiId];
                            const comparison = getComparisonIndicator(values, idx, kpiDef?.higherIsBetter ?? true);

                            return (
                              <td
                                key={facility.facilityId}
                                style={{
                                  textAlign: 'center',
                                  fontFamily: 'monospace',
                                  position: 'relative'
                                }}
                              >
                                <div className="flex items-center justify-center gap-2">
                                  <span style={{
                                    color: comparison === 'best' ? 'var(--success)' :
                                           comparison === 'worst' ? 'var(--danger)' :
                                           'var(--text-primary)',
                                    fontWeight: comparison === 'best' ? 600 : 400
                                  }}>
                                    {formatValue(value, kpiDef?.unit || 'number')}
                                  </span>
                                  {comparison === 'best' && (
                                    <Check size={14} className="text-success" />
                                  )}
                                </div>
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

          {viewMode === 'chart' && (
            <div className="card" style={{ padding: '24px' }}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Trend Comparison</h4>
                <select
                  value={selectedKpi}
                  onChange={(e) => setSelectedKpi(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                >
                  {DEFAULT_COMPARISON_KPIS.map(kpiId => (
                    <option key={kpiId} value={kpiId}>
                      {comparisonData.kpiDefinitions[kpiId]?.name || kpiId}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={prepareChartData()}>
                    <XAxis
                      dataKey="period"
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(15,15,26,0.95)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Legend />
                    {comparisonData.facilities.map((facility, idx) => (
                      <Line
                        key={facility.facilityId}
                        type="monotone"
                        dataKey={facility.name}
                        stroke={METRIC_COLORS[idx]}
                        strokeWidth={2}
                        dot={{ fill: METRIC_COLORS[idx], strokeWidth: 0, r: 4 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {viewMode === 'radar' && (
            <div className="card" style={{ padding: '24px' }}>
              <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Performance Radar
              </h4>
              <div style={{ height: '450px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={prepareRadarData()}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis
                      dataKey="kpi"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                      domain={[0, 100]}
                    />
                    {comparisonData.facilities.map((facility, idx) => (
                      <Radar
                        key={facility.facilityId}
                        name={facility.name}
                        dataKey={facility.name}
                        stroke={METRIC_COLORS[idx]}
                        fill={METRIC_COLORS[idx]}
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(15,15,26,0.95)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px'
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Summary insights */}
          <div className="grid grid-cols-3 mt-4">
            {comparisonData.facilities.map((facility, idx) => {
              const marginValue = facility.metrics['snf_operating_margin_pct'];
              const occupancyValue = facility.metrics['snf_occupancy_pct'];

              return (
                <div key={facility.facilityId} className="card" style={{ padding: '16px' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: METRIC_COLORS[idx]
                    }} />
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {facility.name}
                    </span>
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div className="text-xs text-muted">Margin</div>
                      <div className="font-bold" style={{
                        color: marginValue !== null && marginValue >= 0 ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {marginValue !== null ? `${marginValue.toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Occupancy</div>
                      <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        {occupancyValue !== null ? `${occupancyValue.toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {isLoading && selectedFacilities.length >= 2 && (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p className="text-muted mt-4">Loading comparison data...</p>
        </div>
      )}
    </div>
  );
}
