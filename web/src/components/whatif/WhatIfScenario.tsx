import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Calculator, ChevronDown, ChevronRight, Play, RotateCcw } from 'lucide-react';

interface ScenarioResult {
  projectedMargin: number;
  projectedMarginPct: number;
  baselineMargin: number;
  baselineMarginPct: number;
  marginChange: number;
  marginChangePct: number;
  revenueImpact: number;
  costImpact: number;
}

interface WhatIfScenarioProps {
  facilityId: number;
  periodId: string;
}

interface ScenarioInputs {
  occupancyChange: number;
  skilledMixChange: number;
  rateChange: number;
  laborCostChange: number;
  contractLaborChange: number;
}

export function WhatIfScenario({ facilityId, periodId }: WhatIfScenarioProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [inputs, setInputs] = useState<ScenarioInputs>({
    occupancyChange: 0,
    skilledMixChange: 0,
    rateChange: 0,
    laborCostChange: 0,
    contractLaborChange: 0,
  });

  const scenarioMutation = useMutation<ScenarioResult, Error, ScenarioInputs>({
    mutationFn: async (scenarioInputs) => {
      const response = await fetch(`https://snfpnl.onrender.com/api/what-if/${facilityId}/${periodId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenarioInputs),
      });
      if (!response.ok) throw new Error('Failed to calculate scenario');
      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const sign = value >= 0 ? '+' : '-';
    if (absValue >= 1000000) {
      return `${sign}$${(absValue / 1000000).toFixed(2)}M`;
    }
    if (absValue >= 1000) {
      return `${sign}$${(absValue / 1000).toFixed(0)}K`;
    }
    return `${sign}$${absValue.toFixed(0)}`;
  };

  const handleReset = () => {
    setInputs({
      occupancyChange: 0,
      skilledMixChange: 0,
      rateChange: 0,
      laborCostChange: 0,
      contractLaborChange: 0,
    });
    scenarioMutation.reset();
  };

  const handleCalculate = () => {
    scenarioMutation.mutate(inputs);
  };

  const SliderInput = ({
    label,
    value,
    onChange,
    min,
    max,
    unit,
    description,
  }: {
    label: string;
    value: number;
    onChange: (val: number) => void;
    min: number;
    max: number;
    unit: string;
    description: string;
  }) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <div>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
          <p className="text-xs text-muted">{description}</p>
        </div>
        <span className={`text-lg font-bold ${value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-muted'}`}>
          {value > 0 ? '+' : ''}{value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{
          width: '100%',
          height: '8px',
          borderRadius: '4px',
          background: `linear-gradient(to right,
            var(--danger) 0%,
            var(--danger) ${((0 - min) / (max - min)) * 100}%,
            rgba(255,255,255,0.2) ${((0 - min) / (max - min)) * 100}%,
            rgba(255,255,255,0.2) ${((value - min) / (max - min)) * 100}%,
            var(--success) ${((value - min) / (max - min)) * 100}%,
            var(--success) 100%)`,
          cursor: 'pointer',
          appearance: 'none',
          outline: 'none',
        }}
      />
      <div className="flex justify-between text-xs text-muted mt-1">
        <span>{min}{unit}</span>
        <span>0{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Calculator size={20} />
          What-If Scenario Calculator
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <div className="grid grid-cols-2" style={{ gap: '24px' }}>
          {/* Input panel */}
          <div className="card" style={{ padding: '20px' }}>
            <h4 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
              Adjust Parameters
            </h4>

            <SliderInput
              label="Occupancy Change"
              value={inputs.occupancyChange}
              onChange={(val) => setInputs({ ...inputs, occupancyChange: val })}
              min={-20}
              max={20}
              unit="%"
              description="Change in facility occupancy rate"
            />

            <SliderInput
              label="Skilled Mix Change"
              value={inputs.skilledMixChange}
              onChange={(val) => setInputs({ ...inputs, skilledMixChange: val })}
              min={-15}
              max={15}
              unit="%"
              description="Change in skilled/Medicare patient mix"
            />

            <SliderInput
              label="Rate Change"
              value={inputs.rateChange}
              onChange={(val) => setInputs({ ...inputs, rateChange: val })}
              min={-10}
              max={10}
              unit="%"
              description="Change in average daily rate"
            />

            <SliderInput
              label="Labor Cost Change"
              value={inputs.laborCostChange}
              onChange={(val) => setInputs({ ...inputs, laborCostChange: val })}
              min={-15}
              max={15}
              unit="%"
              description="Change in labor costs"
            />

            <SliderInput
              label="Contract Labor Change"
              value={inputs.contractLaborChange}
              onChange={(val) => setInputs({ ...inputs, contractLaborChange: val })}
              min={-10}
              max={10}
              unit="%"
              description="Change in contract/agency labor usage"
            />

            {/* Action buttons */}
            <div className="flex gap-3 mt-6">
              <button
                className="btn btn-primary flex-1"
                onClick={handleCalculate}
                disabled={scenarioMutation.isPending}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Play size={16} />
                {scenarioMutation.isPending ? 'Calculating...' : 'Calculate Impact'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleReset}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
          </div>

          {/* Results panel */}
          <div className="card" style={{ padding: '20px' }}>
            <h4 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
              Projected Impact
            </h4>

            {!scenarioMutation.data && !scenarioMutation.isPending && (
              <div className="text-center py-8">
                <Calculator size={48} className="text-muted" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p className="text-muted">Adjust parameters and click Calculate to see the projected impact</p>
              </div>
            )}

            {scenarioMutation.isPending && (
              <div className="loading">
                <div className="spinner"></div>
              </div>
            )}

            {scenarioMutation.error && (
              <div className="text-danger text-center py-8">
                Failed to calculate scenario. Please try again.
              </div>
            )}

            {scenarioMutation.data && (
              <>
                {/* Main impact */}
                <div className="card mb-4" style={{
                  padding: '20px',
                  textAlign: 'center',
                  background: scenarioMutation.data.marginChange >= 0
                    ? 'linear-gradient(135deg, rgba(0, 217, 165, 0.15), rgba(0, 217, 165, 0.05))'
                    : 'linear-gradient(135deg, rgba(255, 71, 87, 0.15), rgba(255, 71, 87, 0.05))',
                  borderColor: scenarioMutation.data.marginChange >= 0 ? 'var(--success)' : 'var(--danger)'
                }}>
                  <div className="text-sm text-muted mb-1">Margin Impact</div>
                  <div className="text-4xl font-bold" style={{
                    color: scenarioMutation.data.marginChange >= 0 ? 'var(--success)' : 'var(--danger)'
                  }}>
                    {scenarioMutation.data.marginChangePct >= 0 ? '+' : ''}
                    {scenarioMutation.data.marginChangePct.toFixed(1)}%
                  </div>
                  <div className="text-lg text-muted mt-1">
                    {formatCurrency(scenarioMutation.data.marginChange)}
                  </div>
                </div>

                {/* Before/After comparison */}
                <div className="grid grid-cols-2 mb-4" style={{ gap: '12px' }}>
                  <div className="card" style={{ padding: '12px', textAlign: 'center' }}>
                    <div className="text-xs text-muted mb-1">Current Margin</div>
                    <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {scenarioMutation.data.baselineMarginPct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="card" style={{ padding: '12px', textAlign: 'center' }}>
                    <div className="text-xs text-muted mb-1">Projected Margin</div>
                    <div className="text-xl font-bold" style={{
                      color: scenarioMutation.data.projectedMarginPct >= scenarioMutation.data.baselineMarginPct
                        ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {scenarioMutation.data.projectedMarginPct.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Revenue and Cost impact */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Revenue Impact</span>
                    <span className={`font-bold ${scenarioMutation.data.revenueImpact >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatCurrency(scenarioMutation.data.revenueImpact)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Cost Impact</span>
                    <span className={`font-bold ${scenarioMutation.data.costImpact <= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatCurrency(scenarioMutation.data.costImpact)}
                    </span>
                  </div>
                </div>

                {/* Insight */}
                <div className="mt-4 p-3" style={{
                  background: 'rgba(102, 126, 234, 0.1)',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}>
                  {scenarioMutation.data.marginChange >= 0 ? (
                    <span className="text-muted">
                      This scenario would <strong className="text-success">improve</strong> operating margin by{' '}
                      <strong>{Math.abs(scenarioMutation.data.marginChangePct).toFixed(1)} percentage points</strong>.
                    </span>
                  ) : (
                    <span className="text-muted">
                      This scenario would <strong className="text-danger">reduce</strong> operating margin by{' '}
                      <strong>{Math.abs(scenarioMutation.data.marginChangePct).toFixed(1)} percentage points</strong>.
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
