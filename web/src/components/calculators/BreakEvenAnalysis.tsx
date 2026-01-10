import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Target, ChevronDown, ChevronRight,
  DollarSign, Info, AlertTriangle
} from 'lucide-react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Legend
} from 'recharts';

interface BreakEvenData {
  facilityId: string;
  facilityName: string;
  periodId: string;
  fixedCosts: number;
  variableCostPerPatientDay: number;
  revenuePerPatientDay: number;
  currentPatientDays: number;
  breakEvenPatientDays: number;
  breakEvenOccupancy: number;
  currentOccupancy: number;
  marginOfSafety: number;
  marginOfSafetyPct: number;
  contributionMargin: number;
  contributionMarginRatio: number;
  operatingLeverage: number;
  projections: Array<{
    patientDays: number;
    occupancy: number;
    revenue: number;
    totalCosts: number;
    profit: number;
    profitMargin: number;
  }>;
}

interface BreakEvenAnalysisProps {
  facilityId: number;
  periodId: string;
}

export function BreakEvenAnalysis({ facilityId, periodId }: BreakEvenAnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [simulationMode, setSimulationMode] = useState(false);
  const [simFixedCosts, setSimFixedCosts] = useState<number | null>(null);
  const [simVariableCost, setSimVariableCost] = useState<number | null>(null);
  const [simRevenuePerDay, setSimRevenuePerDay] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<BreakEvenData>({
    queryKey: ['break-even', facilityId, periodId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3002/api/break-even/${facilityId}/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch break-even data');
      return response.json();
    },
  });

  const simulatedData = useMemo(() => {
    if (!data || !simulationMode) return data;

    const fixedCosts = simFixedCosts ?? data.fixedCosts;
    const variableCost = simVariableCost ?? data.variableCostPerPatientDay;
    const revenuePerDay = simRevenuePerDay ?? data.revenuePerPatientDay;

    const contributionMargin = revenuePerDay - variableCost;
    const breakEvenPatientDays = contributionMargin > 0 ? fixedCosts / contributionMargin : 0;
    const capacity = data.currentPatientDays / (data.currentOccupancy / 100);
    const breakEvenOccupancy = (breakEvenPatientDays / capacity) * 100;
    const marginOfSafety = data.currentPatientDays - breakEvenPatientDays;
    const marginOfSafetyPct = (marginOfSafety / data.currentPatientDays) * 100;

    // Generate projections
    const projections = [];
    for (let occupancy = 40; occupancy <= 100; occupancy += 5) {
      const patientDays = capacity * (occupancy / 100);
      const revenue = patientDays * revenuePerDay;
      const totalCosts = fixedCosts + (patientDays * variableCost);
      const profit = revenue - totalCosts;
      projections.push({
        patientDays: Math.round(patientDays),
        occupancy,
        revenue,
        totalCosts,
        profit,
        profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0
      });
    }

    return {
      ...data,
      fixedCosts,
      variableCostPerPatientDay: variableCost,
      revenuePerPatientDay: revenuePerDay,
      breakEvenPatientDays,
      breakEvenOccupancy,
      marginOfSafety,
      marginOfSafetyPct,
      contributionMargin,
      contributionMarginRatio: revenuePerDay > 0 ? (contributionMargin / revenuePerDay) * 100 : 0,
      projections
    };
  }, [data, simulationMode, simFixedCosts, simVariableCost, simRevenuePerDay]);

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Calculating break-even analysis...</p>
      </div>
    );
  }

  if (error || !simulatedData) {
    return (
      <div className="card" style={{ padding: '20px' }}>
        <div className="text-danger">Failed to load break-even data</div>
      </div>
    );
  }

  const aboveBreakEven = simulatedData.currentPatientDays > simulatedData.breakEvenPatientDays;

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Target size={20} />
          Break-Even Analysis
          <span className={`badge ${aboveBreakEven ? 'badge-success' : 'badge-danger'}`}>
            {aboveBreakEven ? 'Above Break-Even' : 'Below Break-Even'}
          </span>
          <span className="badge badge-info">
            {simulatedData.marginOfSafetyPct.toFixed(1)}% margin of safety
          </span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-5 mb-4">
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="text-xs text-muted mb-1">Break-Even Point</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                {simulatedData.breakEvenPatientDays.toLocaleString()}
              </div>
              <div className="text-xs text-muted">patient days</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="text-xs text-muted mb-1">Break-Even Occupancy</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                {simulatedData.breakEvenOccupancy.toFixed(1)}%
              </div>
              <div className="text-xs text-muted">required</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="text-xs text-muted mb-1">Current Occupancy</div>
              <div className="text-2xl font-bold" style={{ color: aboveBreakEven ? 'var(--success)' : 'var(--danger)' }}>
                {simulatedData.currentOccupancy.toFixed(1)}%
              </div>
              <div className="text-xs text-muted">{simulatedData.currentPatientDays.toLocaleString()} days</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="text-xs text-muted mb-1">Margin of Safety</div>
              <div className="text-2xl font-bold" style={{ color: simulatedData.marginOfSafetyPct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {simulatedData.marginOfSafetyPct >= 0 ? '+' : ''}{simulatedData.marginOfSafetyPct.toFixed(1)}%
              </div>
              <div className="text-xs text-muted">{Math.abs(simulatedData.marginOfSafety).toLocaleString()} days</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="text-xs text-muted mb-1">Contribution Margin</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                {formatCurrency(simulatedData.contributionMargin)}
              </div>
              <div className="text-xs text-muted">{simulatedData.contributionMarginRatio.toFixed(1)}% ratio</div>
            </div>
          </div>

          {/* Warning if below break-even */}
          {!aboveBreakEven && (
            <div className="mb-4 flex items-center gap-3" style={{
              padding: '12px 16px',
              background: 'rgba(255, 71, 87, 0.1)',
              border: '1px solid rgba(255, 71, 87, 0.3)',
              borderRadius: '8px'
            }}>
              <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
              <div>
                <div className="font-bold" style={{ color: 'var(--danger)' }}>Below Break-Even</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Need {Math.abs(simulatedData.marginOfSafety).toLocaleString()} additional patient days to reach break-even
                </div>
              </div>
            </div>
          )}

          {/* Simulation Controls */}
          <div className="card mb-4" style={{ padding: '16px' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simulationMode}
                    onChange={(e) => {
                      setSimulationMode(e.target.checked);
                      if (!e.target.checked) {
                        setSimFixedCosts(null);
                        setSimVariableCost(null);
                        setSimRevenuePerDay(null);
                      }
                    }}
                  />
                  <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Simulation Mode</span>
                </label>
                <span title="Adjust parameters to see how they affect break-even"><Info size={14} className="text-muted" /></span>
              </div>
            </div>

            {simulationMode && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted mb-1 block">Fixed Costs</label>
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-muted" />
                    <input
                      type="number"
                      value={simFixedCosts ?? data?.fixedCosts ?? 0}
                      onChange={(e) => setSimFixedCosts(Number(e.target.value))}
                      className="input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Variable Cost per Patient Day</label>
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-muted" />
                    <input
                      type="number"
                      value={simVariableCost ?? data?.variableCostPerPatientDay ?? 0}
                      onChange={(e) => setSimVariableCost(Number(e.target.value))}
                      className="input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Revenue per Patient Day</label>
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-muted" />
                    <input
                      type="number"
                      value={simRevenuePerDay ?? data?.revenuePerPatientDay ?? 0}
                      onChange={(e) => setSimRevenuePerDay(Number(e.target.value))}
                      className="input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Break-Even Chart */}
          <div className="card" style={{ padding: '20px' }}>
            <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Revenue, Costs & Profit by Occupancy
            </h4>
            <div style={{ height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={simulatedData.projections}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="occupancy"
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                    label={{ value: 'Occupancy %', position: 'bottom', fill: 'rgba(255,255,255,0.5)', offset: -5 }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip
                    contentStyle={{ background: 'rgba(15,15,26,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                    formatter={(value, name) => [typeof value === 'number' ? formatCurrency(value) : '', String(name)]}
                    labelFormatter={(label) => `${label}% Occupancy`}
                  />
                  <Legend />

                  {/* Break-even reference line */}
                  <ReferenceLine
                    x={simulatedData.breakEvenOccupancy}
                    stroke="rgba(255,255,255,0.5)"
                    strokeDasharray="5 5"
                    label={{
                      value: 'Break-Even',
                      fill: 'rgba(255,255,255,0.7)',
                      fontSize: 11,
                      position: 'top'
                    }}
                  />

                  {/* Current occupancy reference line */}
                  <ReferenceLine
                    x={simulatedData.currentOccupancy}
                    stroke="var(--primary)"
                    strokeWidth={2}
                    label={{
                      value: 'Current',
                      fill: 'var(--primary)',
                      fontSize: 11,
                      position: 'top'
                    }}
                  />

                  {/* Zero profit line */}
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" />

                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="var(--success)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalCosts"
                    name="Total Costs"
                    stroke="var(--danger)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Profit/Loss"
                    fill="rgba(102, 126, 234, 0.2)"
                    stroke="var(--primary)"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost Structure */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="card" style={{ padding: '16px' }}>
              <h5 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Cost Structure</h5>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Fixed Costs</span>
                  <span className="font-bold">{formatCurrency(simulatedData.fixedCosts)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Variable Cost per Day</span>
                  <span className="font-bold">{formatCurrency(simulatedData.variableCostPerPatientDay)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Revenue per Day</span>
                  <span className="font-bold">{formatCurrency(simulatedData.revenuePerPatientDay)}</span>
                </div>
                <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <span className="text-muted">Contribution Margin per Day</span>
                  <span className="font-bold" style={{ color: 'var(--success)' }}>
                    {formatCurrency(simulatedData.contributionMargin)}
                  </span>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <h5 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Key Insights</h5>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    marginTop: '6px'
                  }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Each 1% increase in occupancy generates approximately{' '}
                    <span className="font-bold text-success">
                      {formatCurrency((simulatedData.projections[1]?.profit || 0) - (simulatedData.projections[0]?.profit || 0))}
                    </span>{' '}
                    in additional profit
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--warning)',
                    marginTop: '6px'
                  }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Operating leverage of{' '}
                    <span className="font-bold">{simulatedData.operatingLeverage.toFixed(1)}x</span>{' '}
                    means profit changes {simulatedData.operatingLeverage.toFixed(1)}x faster than revenue
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: aboveBreakEven ? 'var(--success)' : 'var(--danger)',
                    marginTop: '6px'
                  }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {aboveBreakEven
                      ? `Operating ${Math.abs(simulatedData.marginOfSafetyPct).toFixed(1)}% above break-even provides cushion against volume declines`
                      : `Need to increase occupancy by ${(simulatedData.breakEvenOccupancy - simulatedData.currentOccupancy).toFixed(1)}% to reach break-even`
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
