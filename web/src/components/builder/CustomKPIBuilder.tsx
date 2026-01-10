import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wrench, Plus, X, Play, Save, Trash2, ChevronDown, ChevronRight,
  Calculator, Code, Eye, Copy, Check
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface CustomKPI {
  id: string;
  name: string;
  description: string;
  formula: string;
  unit: 'percentage' | 'currency' | 'number' | 'ratio';
  higherIsBetter: boolean;
  variables: string[];
  createdAt: string;
  isActive: boolean;
}

interface KPIPreview {
  periods: string[];
  values: number[];
  average: number;
  min: number;
  max: number;
}

interface CustomKPIBuilderProps {
  facilityId?: number;
}

const AVAILABLE_METRICS = [
  { id: 'total_revenue', name: 'Total Revenue', category: 'Revenue' },
  { id: 'skilled_revenue', name: 'Skilled Revenue', category: 'Revenue' },
  { id: 'medicaid_revenue', name: 'Medicaid Revenue', category: 'Revenue' },
  { id: 'private_revenue', name: 'Private Revenue', category: 'Revenue' },
  { id: 'total_costs', name: 'Total Costs', category: 'Costs' },
  { id: 'labor_costs', name: 'Labor Costs', category: 'Costs' },
  { id: 'nursing_costs', name: 'Nursing Costs', category: 'Costs' },
  { id: 'therapy_costs', name: 'Therapy Costs', category: 'Costs' },
  { id: 'occupancy_pct', name: 'Occupancy %', category: 'Operations' },
  { id: 'skilled_mix_pct', name: 'Skilled Mix %', category: 'Operations' },
  { id: 'patient_days', name: 'Patient Days', category: 'Operations' },
  { id: 'admissions', name: 'Admissions', category: 'Operations' },
  { id: 'nursing_hprd', name: 'Nursing HPRD', category: 'Staffing' },
  { id: 'rn_hprd', name: 'RN HPRD', category: 'Staffing' },
  { id: 'contract_labor_pct', name: 'Contract Labor %', category: 'Staffing' }
];

const FORMULA_TEMPLATES = [
  { name: 'Ratio', formula: '(A / B) * 100', description: 'Calculate percentage of A relative to B' },
  { name: 'Per Unit', formula: 'A / B', description: 'Calculate A per unit of B' },
  { name: 'Margin', formula: '((A - B) / A) * 100', description: 'Calculate margin percentage' },
  { name: 'Weighted Average', formula: '(A * 0.6) + (B * 0.4)', description: 'Weighted combination of metrics' },
  { name: 'Growth Rate', formula: '((A - B) / B) * 100', description: 'Period-over-period change' }
];

export function CustomKPIBuilder({ facilityId }: CustomKPIBuilderProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [previewData, setPreviewData] = useState<KPIPreview | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [newKPI, setNewKPI] = useState<Partial<CustomKPI>>({
    name: '',
    description: '',
    formula: '',
    unit: 'number',
    higherIsBetter: true,
    variables: []
  });

  const queryClient = useQueryClient();

  const { data: customKPIs = [], isLoading } = useQuery<CustomKPI[]>({
    queryKey: ['custom-kpis'],
    queryFn: async () => {
      const response = await fetch('https://snfpnl-production.up.railway.app/api/custom-kpis');
      if (!response.ok) throw new Error('Failed to fetch custom KPIs');
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (kpi: Partial<CustomKPI>) => {
      const response = await fetch('https://snfpnl-production.up.railway.app/api/custom-kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kpi)
      });
      if (!response.ok) throw new Error('Failed to create custom KPI');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-kpis'] });
      setIsCreating(false);
      setNewKPI({ name: '', description: '', formula: '', unit: 'number', higherIsBetter: true, variables: [] });
      setPreviewData(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`https://snfpnl-production.up.railway.app/api/custom-kpis/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete custom KPI');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-kpis'] })
  });

  const testFormula = async () => {
    if (!newKPI.formula) return;

    try {
      const response = await fetch('https://snfpnl-production.up.railway.app/api/custom-kpis/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formula: newKPI.formula,
          variables: newKPI.variables,
          facilityId
        })
      });

      if (!response.ok) throw new Error('Formula test failed');
      const data = await response.json();
      setPreviewData(data);
    } catch (error) {
      console.error('Formula test error:', error);
    }
  };

  const addVariable = (metricId: string) => {
    if (!newKPI.variables?.includes(metricId)) {
      setNewKPI({
        ...newKPI,
        variables: [...(newKPI.variables || []), metricId]
      });
    }
  };

  const removeVariable = (metricId: string) => {
    setNewKPI({
      ...newKPI,
      variables: newKPI.variables?.filter(v => v !== metricId)
    });
  };

  const applyTemplate = (template: typeof FORMULA_TEMPLATES[0]) => {
    setNewKPI({
      ...newKPI,
      formula: template.formula
    });
  };

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case 'percentage': return `${value.toFixed(1)}%`;
      case 'currency': return `$${value.toFixed(0)}`;
      case 'ratio': return value.toFixed(2);
      default: return value.toFixed(1);
    }
  };

  const copyFormula = (formula: string, id: string) => {
    navigator.clipboard.writeText(formula);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Wrench size={20} />
          Custom KPI Builder
          <span className="badge badge-info">{customKPIs.length} custom KPIs</span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Create Button */}
          {!isCreating && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setIsCreating(true)}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                <Plus size={14} style={{ marginRight: '6px' }} />
                Create Custom KPI
              </button>
            </div>
          )}

          {/* Creation Form */}
          {isCreating && (
            <div className="card mb-4" style={{ padding: '20px', border: '1px solid var(--primary)' }}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  <Calculator size={18} style={{ display: 'inline', marginRight: '8px' }} />
                  Create Custom KPI
                </h4>
                <button onClick={() => setIsCreating(false)} className="btn btn-secondary btn-icon" style={{ width: '28px', height: '28px' }}>
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-muted mb-1 block">KPI Name</label>
                  <input
                    type="text"
                    value={newKPI.name}
                    onChange={(e) => setNewKPI({ ...newKPI, name: e.target.value })}
                    placeholder="e.g., Revenue per FTE"
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted mb-1 block">Unit Type</label>
                    <select
                      value={newKPI.unit}
                      onChange={(e) => setNewKPI({ ...newKPI, unit: e.target.value as CustomKPI['unit'] })}
                      className="select"
                      style={{ width: '100%' }}
                    >
                      <option value="number">Number</option>
                      <option value="percentage">Percentage</option>
                      <option value="currency">Currency</option>
                      <option value="ratio">Ratio</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">Direction</label>
                    <select
                      value={newKPI.higherIsBetter ? 'higher' : 'lower'}
                      onChange={(e) => setNewKPI({ ...newKPI, higherIsBetter: e.target.value === 'higher' })}
                      className="select"
                      style={{ width: '100%' }}
                    >
                      <option value="higher">Higher is Better</option>
                      <option value="lower">Lower is Better</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs text-muted mb-1 block">Description</label>
                <input
                  type="text"
                  value={newKPI.description}
                  onChange={(e) => setNewKPI({ ...newKPI, description: e.target.value })}
                  placeholder="Brief description of what this KPI measures..."
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Formula Templates */}
              <div className="mb-4">
                <label className="text-xs text-muted mb-2 block">Formula Templates</label>
                <div className="flex flex-wrap gap-2">
                  {FORMULA_TEMPLATES.map((template, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyTemplate(template)}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      title={template.description}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Available Metrics */}
              <div className="mb-4">
                <label className="text-xs text-muted mb-2 block">Available Metrics (click to add as variable)</label>
                <div className="grid grid-cols-3 gap-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {Object.entries(
                    AVAILABLE_METRICS.reduce((acc, m) => {
                      acc[m.category] = [...(acc[m.category] || []), m];
                      return acc;
                    }, {} as Record<string, typeof AVAILABLE_METRICS>)
                  ).map(([category, metrics]) => (
                    <div key={category}>
                      <div className="text-xs font-bold text-muted mb-1">{category}</div>
                      {metrics.map(metric => {
                        const isSelected = newKPI.variables?.includes(metric.id);
                        const varIndex = newKPI.variables?.indexOf(metric.id) ?? -1;
                        const varLetter = varIndex >= 0 ? String.fromCharCode(65 + varIndex) : null;

                        return (
                          <button
                            key={metric.id}
                            onClick={() => isSelected ? removeVariable(metric.id) : addVariable(metric.id)}
                            className="btn btn-secondary"
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              fontSize: '11px',
                              marginBottom: '4px',
                              justifyContent: 'flex-start',
                              background: isSelected ? 'rgba(102, 126, 234, 0.2)' : undefined,
                              border: isSelected ? '1px solid var(--primary)' : undefined
                            }}
                          >
                            {varLetter && (
                              <span style={{
                                background: 'var(--primary)',
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '0 4px',
                                marginRight: '6px',
                                fontSize: '10px'
                              }}>
                                {varLetter}
                              </span>
                            )}
                            {metric.name}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Variables */}
              {newKPI.variables && newKPI.variables.length > 0 && (
                <div className="mb-4 p-3" style={{ background: 'rgba(102, 126, 234, 0.1)', borderRadius: '8px' }}>
                  <div className="text-xs text-muted mb-2">Selected Variables</div>
                  <div className="flex flex-wrap gap-2">
                    {newKPI.variables.map((varId, idx) => {
                      const metric = AVAILABLE_METRICS.find(m => m.id === varId);
                      return (
                        <span key={varId} className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontWeight: 700 }}>{String.fromCharCode(65 + idx)}</span> = {metric?.name}
                          <X size={10} style={{ cursor: 'pointer' }} onClick={() => removeVariable(varId)} />
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Formula Input */}
              <div className="mb-4">
                <label className="text-xs text-muted mb-1 block">
                  <Code size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Formula (use A, B, C... for variables)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKPI.formula}
                    onChange={(e) => setNewKPI({ ...newKPI, formula: e.target.value })}
                    placeholder="e.g., (A / B) * 100"
                    className="input"
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                  <button
                    onClick={testFormula}
                    className="btn btn-secondary"
                    disabled={!newKPI.formula || !newKPI.variables?.length}
                  >
                    <Play size={14} style={{ marginRight: '4px' }} />
                    Test
                  </button>
                </div>
              </div>

              {/* Preview */}
              {previewData && (
                <div className="mb-4 p-4" style={{ background: 'rgba(0, 217, 165, 0.1)', borderRadius: '8px' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Eye size={14} style={{ color: 'var(--success)' }} />
                    <span className="text-sm font-bold" style={{ color: 'var(--success)' }}>Formula Preview</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-muted">Average</div>
                      <div className="font-bold">{formatValue(previewData.average, newKPI.unit || 'number')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Min</div>
                      <div className="font-bold">{formatValue(previewData.min, newKPI.unit || 'number')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Max</div>
                      <div className="font-bold">{formatValue(previewData.max, newKPI.unit || 'number')}</div>
                    </div>
                  </div>
                  <div style={{ height: '100px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={previewData.periods.map((p, i) => ({ period: p, value: previewData.values[i] }))}>
                        <XAxis dataKey="period" hide />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{ background: 'rgba(15,15,26,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                          formatter={(v) => [typeof v === 'number' ? formatValue(v, newKPI.unit || 'number') : '', newKPI.name || 'Value']}
                        />
                        <Line type="monotone" dataKey="value" stroke="var(--success)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsCreating(false)} className="btn btn-secondary">Cancel</button>
                <button
                  onClick={() => createMutation.mutate(newKPI)}
                  className="btn btn-primary"
                  disabled={!newKPI.name || !newKPI.formula || !newKPI.variables?.length || createMutation.isPending}
                >
                  <Save size={14} style={{ marginRight: '6px' }} />
                  {createMutation.isPending ? 'Saving...' : 'Save KPI'}
                </button>
              </div>
            </div>
          )}

          {/* Existing Custom KPIs */}
          {isLoading ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
          ) : customKPIs.length === 0 && !isCreating ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <Wrench size={40} style={{ margin: '0 auto', color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p className="text-muted">No custom KPIs created yet. Build your own metrics!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {customKPIs.map(kpi => (
                <div key={kpi.id} className="card" style={{ padding: '16px' }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h5 className="font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.name}</h5>
                      <p className="text-xs text-muted">{kpi.description}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => copyFormula(kpi.formula, kpi.id)}
                        className="btn btn-secondary btn-icon"
                        style={{ width: '28px', height: '28px' }}
                        title="Copy formula"
                      >
                        {copiedId === kpi.id ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(kpi.id)}
                        className="btn btn-secondary btn-icon"
                        style={{ width: '28px', height: '28px' }}
                        title="Delete KPI"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge badge-secondary" style={{ fontSize: '10px' }}>
                      {kpi.unit}
                    </span>
                    <span className={`badge ${kpi.higherIsBetter ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '10px' }}>
                      {kpi.higherIsBetter ? '↑ Higher is Better' : '↓ Lower is Better'}
                    </span>
                  </div>

                  <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: 'var(--primary)'
                  }}>
                    {kpi.formula}
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {kpi.variables.map((varId, idx) => {
                      const metric = AVAILABLE_METRICS.find(m => m.id === varId);
                      return (
                        <span key={varId} className="text-xs text-muted">
                          {String.fromCharCode(65 + idx)}={metric?.name || varId}
                          {idx < kpi.variables.length - 1 && ', '}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
