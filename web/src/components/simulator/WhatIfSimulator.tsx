import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sliders, RotateCcw, TrendingUp, DollarSign,
  Users, Percent, AlertTriangle, Save, Download, ChevronDown, ChevronRight
} from 'lucide-react';
import {
  Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Area, ComposedChart
} from 'recharts';

interface SimulationParams {
  occupancyChange: number;
  skilledMixChange: number;
  laborCostChange: number;
  revenuePerDayChange: number;
  contractLaborChange: number;
}

interface SimulationResult {
  metric: string;
  baseline: number;
  projected: number;
  change: number;
  changePct: number;
  impact: 'positive' | 'negative' | 'neutral';
}

interface FacilityBaseline {
  facilityId: string;
  name: string;
  operatingMargin: number;
  occupancy: number;
  skilledMix: number;
  laborCostPct: number;
  revenuePerDay: number;
  contractLaborPct: number;
  totalRevenue: number;
  totalCosts: number;
}

interface WhatIfSimulatorProps {
  facilityId: number;
  periodId: string;
}

const PRESETS = [
  { name: 'Optimistic Growth', occupancy: 5, skilledMix: 3, labor: -2, revenue: 5, contract: -5 },
  { name: 'Cost Reduction', occupancy: 0, skilledMix: 0, labor: -5, revenue: 0, contract: -10 },
  { name: 'Volume Increase', occupancy: 10, skilledMix: 0, labor: 3, revenue: 0, contract: 2 },
  { name: 'Payer Mix Shift', occupancy: -2, skilledMix: 8, labor: 0, revenue: 10, contract: 0 },
  { name: 'Worst Case', occupancy: -10, skilledMix: -5, labor: 5, revenue: -5, contract: 15 },
];

export function WhatIfSimulator({ facilityId, periodId }: WhatIfSimulatorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [params, setParams] = useState<SimulationParams>({
    occupancyChange: 0,
    skilledMixChange: 0,
    laborCostChange: 0,
    revenuePerDayChange: 0,
    contractLaborChange: 0,
  });
  const [savedScenarios, setSavedScenarios] = useState<Array<{ name: string; params: SimulationParams }>>([]);

  const { data: baseline, isLoading } = useQuery<FacilityBaseline>({
    queryKey: ['facility-baseline', facilityId, periodId],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl.onrender.com/api/simulation/baseline/${facilityId}/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch baseline');
      return response.json();
    },
  });

  const simulationResults = useMemo(() => {
    if (!baseline) return null;

    // Calculate projected values
    const projectedOccupancy = Math.max(0, Math.min(100, baseline.occupancy * (1 + params.occupancyChange / 100)));
    const projectedSkilledMix = Math.max(0, Math.min(100, baseline.skilledMix * (1 + params.skilledMixChange / 100)));
    const projectedLaborCost = Math.max(0, baseline.laborCostPct * (1 + params.laborCostChange / 100));
    const projectedRevenue = baseline.revenuePerDay * (1 + params.revenuePerDayChange / 100);
    const projectedContractLabor = Math.max(0, baseline.contractLaborPct * (1 + params.contractLaborChange / 100));

    // Revenue impact from occupancy and revenue per day changes
    const revenueMultiplier = (projectedOccupancy / baseline.occupancy) * (projectedRevenue / baseline.revenuePerDay);
    const projectedTotalRevenue = baseline.totalRevenue * revenueMultiplier;

    // Cost impact from labor changes
    const laborCostImpact = (projectedLaborCost - baseline.laborCostPct) / 100 * baseline.totalRevenue;
    const contractLaborImpact = (projectedContractLabor - baseline.contractLaborPct) / 100 * baseline.totalRevenue * 0.5;
    const projectedTotalCosts = baseline.totalCosts + laborCostImpact + contractLaborImpact;

    // Skilled mix revenue boost (higher skilled = higher reimbursement)
    const skilledMixBoost = (projectedSkilledMix - baseline.skilledMix) / 100 * baseline.totalRevenue * 0.15;
    const finalRevenue = projectedTotalRevenue + skilledMixBoost;

    // Calculate new margin
    const projectedMargin = ((finalRevenue - projectedTotalCosts) / finalRevenue) * 100;
    const marginChange = projectedMargin - baseline.operatingMargin;

    const results: SimulationResult[] = [
      {
        metric: 'Operating Margin',
        baseline: baseline.operatingMargin,
        projected: projectedMargin,
        change: marginChange,
        changePct: (marginChange / Math.abs(baseline.operatingMargin || 1)) * 100,
        impact: marginChange > 0.5 ? 'positive' : marginChange < -0.5 ? 'negative' : 'neutral'
      },
      {
        metric: 'Occupancy',
        baseline: baseline.occupancy,
        projected: projectedOccupancy,
        change: projectedOccupancy - baseline.occupancy,
        changePct: params.occupancyChange,
        impact: params.occupancyChange > 0 ? 'positive' : params.occupancyChange < 0 ? 'negative' : 'neutral'
      },
      {
        metric: 'Skilled Mix',
        baseline: baseline.skilledMix,
        projected: projectedSkilledMix,
        change: projectedSkilledMix - baseline.skilledMix,
        changePct: params.skilledMixChange,
        impact: params.skilledMixChange > 0 ? 'positive' : params.skilledMixChange < 0 ? 'negative' : 'neutral'
      },
      {
        metric: 'Total Revenue',
        baseline: baseline.totalRevenue,
        projected: finalRevenue,
        change: finalRevenue - baseline.totalRevenue,
        changePct: ((finalRevenue - baseline.totalRevenue) / baseline.totalRevenue) * 100,
        impact: finalRevenue > baseline.totalRevenue ? 'positive' : finalRevenue < baseline.totalRevenue ? 'negative' : 'neutral'
      },
      {
        metric: 'Total Costs',
        baseline: baseline.totalCosts,
        projected: projectedTotalCosts,
        change: projectedTotalCosts - baseline.totalCosts,
        changePct: ((projectedTotalCosts - baseline.totalCosts) / baseline.totalCosts) * 100,
        impact: projectedTotalCosts < baseline.totalCosts ? 'positive' : projectedTotalCosts > baseline.totalCosts ? 'negative' : 'neutral'
      }
    ];

    // Generate 12-month projection
    const monthlyProjection = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const rampUp = Math.min(1, month / 6); // Gradual implementation over 6 months
      const projMargin = baseline.operatingMargin + (marginChange * rampUp);
      return {
        month: `M${month}`,
        baseline: baseline.operatingMargin,
        projected: projMargin,
        best: projMargin + Math.abs(marginChange) * 0.2,
        worst: projMargin - Math.abs(marginChange) * 0.2
      };
    });

    return { results, monthlyProjection, projectedMargin, marginChange };
  }, [baseline, params]);

  const resetParams = () => {
    setParams({
      occupancyChange: 0,
      skilledMixChange: 0,
      laborCostChange: 0,
      revenuePerDayChange: 0,
      contractLaborChange: 0,
    });
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setParams({
      occupancyChange: preset.occupancy,
      skilledMixChange: preset.skilledMix,
      laborCostChange: preset.labor,
      revenuePerDayChange: preset.revenue,
      contractLaborChange: preset.contract,
    });
  };

  const saveScenario = () => {
    const name = prompt('Enter scenario name:');
    if (name) {
      setSavedScenarios([...savedScenarios, { name, params: { ...params } }]);
    }
  };

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Loading simulation data...</p>
      </div>
    );
  }

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Sliders size={20} />
          What-If Scenario Simulator
          {simulationResults && simulationResults.marginChange !== 0 && (
            <span className={`badge ${simulationResults.marginChange > 0 ? 'badge-success' : 'badge-danger'}`}>
              {simulationResults.marginChange > 0 ? '+' : ''}{simulationResults.marginChange.toFixed(1)}% margin impact
            </span>
          )}
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && baseline && (
        <div className="grid" style={{ gridTemplateColumns: '350px 1fr', gap: '20px' }}>
          {/* Controls Panel */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Adjust Parameters</h4>
              <button onClick={resetParams} className="btn btn-secondary btn-icon" style={{ width: '32px', height: '32px' }}>
                <RotateCcw size={14} />
              </button>
            </div>

            {/* Presets */}
            <div className="mb-4">
              <div className="text-xs text-muted mb-2">Quick Presets</div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyPreset(preset)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-4">
              {/* Occupancy */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm flex items-center gap-2">
                    <Users size={14} /> Occupancy
                  </span>
                  <span className={`text-sm font-bold ${params.occupancyChange >= 0 ? 'text-success' : 'text-danger'}`}>
                    {params.occupancyChange >= 0 ? '+' : ''}{params.occupancyChange}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={params.occupancyChange}
                  onChange={(e) => setParams({ ...params, occupancyChange: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Skilled Mix */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm flex items-center gap-2">
                    <Percent size={14} /> Skilled Mix
                  </span>
                  <span className={`text-sm font-bold ${params.skilledMixChange >= 0 ? 'text-success' : 'text-danger'}`}>
                    {params.skilledMixChange >= 0 ? '+' : ''}{params.skilledMixChange}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  value={params.skilledMixChange}
                  onChange={(e) => setParams({ ...params, skilledMixChange: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Labor Cost */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm flex items-center gap-2">
                    <DollarSign size={14} /> Labor Cost
                  </span>
                  <span className={`text-sm font-bold ${params.laborCostChange <= 0 ? 'text-success' : 'text-danger'}`}>
                    {params.laborCostChange >= 0 ? '+' : ''}{params.laborCostChange}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  value={params.laborCostChange}
                  onChange={(e) => setParams({ ...params, laborCostChange: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Revenue Per Day */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm flex items-center gap-2">
                    <TrendingUp size={14} /> Revenue/Day
                  </span>
                  <span className={`text-sm font-bold ${params.revenuePerDayChange >= 0 ? 'text-success' : 'text-danger'}`}>
                    {params.revenuePerDayChange >= 0 ? '+' : ''}{params.revenuePerDayChange}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  value={params.revenuePerDayChange}
                  onChange={(e) => setParams({ ...params, revenuePerDayChange: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Contract Labor */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm flex items-center gap-2">
                    <AlertTriangle size={14} /> Contract Labor
                  </span>
                  <span className={`text-sm font-bold ${params.contractLaborChange <= 0 ? 'text-success' : 'text-danger'}`}>
                    {params.contractLaborChange >= 0 ? '+' : ''}{params.contractLaborChange}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="30"
                  value={params.contractLaborChange}
                  onChange={(e) => setParams({ ...params, contractLaborChange: Number(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={saveScenario} className="btn btn-secondary flex-1" style={{ fontSize: '12px' }}>
                <Save size={14} style={{ marginRight: '6px' }} /> Save
              </button>
              <button className="btn btn-secondary flex-1" style={{ fontSize: '12px' }}>
                <Download size={14} style={{ marginRight: '6px' }} /> Export
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div>
            {/* Impact Summary */}
            {simulationResults && (
              <>
                <div className="card mb-4" style={{
                  padding: '20px',
                  background: simulationResults.marginChange > 0
                    ? 'linear-gradient(135deg, rgba(0, 217, 165, 0.2), rgba(0, 217, 165, 0.05))'
                    : simulationResults.marginChange < 0
                    ? 'linear-gradient(135deg, rgba(255, 71, 87, 0.2), rgba(255, 71, 87, 0.05))'
                    : undefined
                }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted">Projected Operating Margin</div>
                      <div className="text-4xl font-bold" style={{
                        color: simulationResults.marginChange > 0 ? 'var(--success)' : simulationResults.marginChange < 0 ? 'var(--danger)' : 'var(--text-primary)'
                      }}>
                        {simulationResults.projectedMargin.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted">Change from Baseline</div>
                      <div className="text-2xl font-bold" style={{
                        color: simulationResults.marginChange > 0 ? 'var(--success)' : simulationResults.marginChange < 0 ? 'var(--danger)' : 'var(--text-muted)'
                      }}>
                        {simulationResults.marginChange > 0 ? '+' : ''}{simulationResults.marginChange.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Results Grid */}
                <div className="grid grid-cols-5 mb-4">
                  {simulationResults.results.map((result, idx) => (
                    <div key={idx} className="card" style={{ padding: '12px' }}>
                      <div className="text-xs text-muted mb-1">{result.metric}</div>
                      <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        {result.metric.includes('Revenue') || result.metric.includes('Cost')
                          ? formatCurrency(result.projected)
                          : `${result.projected.toFixed(1)}%`}
                      </div>
                      <div className="text-xs" style={{
                        color: result.impact === 'positive' ? 'var(--success)' : result.impact === 'negative' ? 'var(--danger)' : 'var(--text-muted)'
                      }}>
                        {result.change > 0 ? '+' : ''}
                        {result.metric.includes('Revenue') || result.metric.includes('Cost')
                          ? formatCurrency(result.change)
                          : `${result.change.toFixed(1)}%`}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Projection Chart */}
                <div className="card" style={{ padding: '20px' }}>
                  <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>12-Month Projection</h4>
                  <div style={{ height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={simulationResults.monthlyProjection}>
                        <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                        <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: 'rgba(15,15,26,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                          formatter={(value) => [typeof value === 'number' ? `${value.toFixed(1)}%` : '', '']}
                        />
                        <Area type="monotone" dataKey="best" fill="rgba(0, 217, 165, 0.1)" stroke="transparent" />
                        <Area type="monotone" dataKey="worst" fill="rgba(255, 71, 87, 0.1)" stroke="transparent" />
                        <ReferenceLine y={baseline.operatingMargin} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="baseline" stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="projected" stroke="#667eea" strokeWidth={3} dot={{ fill: '#667eea', r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
