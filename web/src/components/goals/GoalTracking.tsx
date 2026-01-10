import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, ChevronDown, ChevronRight, Plus, Trash2, Check, X } from 'lucide-react';
import { useState } from 'react';

interface Goal {
  id: number;
  facility_id: string;
  kpi_id: string;
  target_value: number;
  target_date: string | null;
}

interface GoalsResponse {
  facilityId: string;
  goals: Goal[];
}

interface GoalTrackingProps {
  facilityId: number;
}

const AVAILABLE_KPIS = [
  { id: 'snf_operating_margin_pct', name: 'Operating Margin', unit: 'percentage' },
  { id: 'snf_occupancy_pct', name: 'Occupancy', unit: 'percentage' },
  { id: 'snf_skilled_mix_pct', name: 'Skilled Mix', unit: 'percentage' },
  { id: 'snf_total_revenue_ppd', name: 'Revenue PPD', unit: 'currency' },
  { id: 'snf_labor_cost_pct_revenue', name: 'Labor Cost %', unit: 'percentage' },
  { id: 'snf_contract_labor_pct_nursing', name: 'Contract Labor %', unit: 'percentage' },
  { id: 'snf_total_nurse_hprd_paid', name: 'Nursing HPPD', unit: 'hours' },
];

export function GoalTracking({ facilityId }: GoalTrackingProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({ kpiId: '', targetValue: '' });
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<GoalsResponse>({
    queryKey: ['goals', facilityId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3002/api/goals/${facilityId}`);
      if (!response.ok) throw new Error('Failed to fetch goals');
      return response.json();
    },
  });

  const addGoalMutation = useMutation({
    mutationFn: async (goal: { kpiId: string; targetValue: number }) => {
      const response = await fetch(`http://localhost:3002/api/goals/${facilityId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goal),
      });
      if (!response.ok) throw new Error('Failed to add goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', facilityId] });
      setShowAddGoal(false);
      setNewGoal({ kpiId: '', targetValue: '' });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      const response = await fetch(`http://localhost:3002/api/goals/${facilityId}/${kpiId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', facilityId] });
    },
  });

  const formatValue = (value: number, unit: string) => {
    if (unit === 'percentage') return `${value.toFixed(1)}%`;
    if (unit === 'currency') return `$${value.toFixed(2)}`;
    if (unit === 'hours') return value.toFixed(2);
    return value.toFixed(2);
  };

  const getKpiInfo = (kpiId: string) => {
    return AVAILABLE_KPIS.find(k => k.id === kpiId) || { id: kpiId, name: kpiId, unit: 'number' };
  };

  const handleAddGoal = () => {
    if (newGoal.kpiId && newGoal.targetValue) {
      addGoalMutation.mutate({
        kpiId: newGoal.kpiId,
        targetValue: parseFloat(newGoal.targetValue),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card">
        <div className="error">Failed to load goals</div>
      </div>
    );
  }

  const existingKpiIds = data.goals.map(g => g.kpi_id);
  const availableKpisForAdd = AVAILABLE_KPIS.filter(kpi => !existingKpiIds.includes(kpi.id));

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Target size={20} />
          Goal Tracking
          <span className="badge badge-info" style={{ marginLeft: '8px' }}>
            {data.goals.length} goal{data.goals.length !== 1 ? 's' : ''} set
          </span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Add goal button/form */}
          {!showAddGoal ? (
            <button
              className="btn btn-secondary mb-4"
              onClick={() => setShowAddGoal(true)}
              disabled={availableKpisForAdd.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={16} />
              Add Goal
            </button>
          ) : (
            <div className="card mb-4" style={{ padding: '16px' }}>
              <div className="flex items-center gap-3">
                <select
                  value={newGoal.kpiId}
                  onChange={(e) => setNewGoal({ ...newGoal, kpiId: e.target.value })}
                  style={{
                    flex: 2,
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="">Select metric...</option>
                  {availableKpisForAdd.map(kpi => (
                    <option key={kpi.id} value={kpi.id}>{kpi.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Target value"
                  value={newGoal.targetValue}
                  onChange={(e) => setNewGoal({ ...newGoal, targetValue: e.target.value })}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                />
                <button
                  className="btn btn-primary btn-icon"
                  onClick={handleAddGoal}
                  disabled={addGoalMutation.isPending}
                  style={{ width: '36px', height: '36px' }}
                >
                  <Check size={16} />
                </button>
                <button
                  className="btn btn-secondary btn-icon"
                  onClick={() => { setShowAddGoal(false); setNewGoal({ kpiId: '', targetValue: '' }); }}
                  style={{ width: '36px', height: '36px' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Goals list */}
          {data.goals.length === 0 ? (
            <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
              <Target size={32} className="text-muted" style={{ margin: '0 auto 12px' }} />
              <p className="text-muted">No goals set yet. Add a goal to start tracking.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3">
              {data.goals.map((goal) => {
                const kpiInfo = getKpiInfo(goal.kpi_id);
                return (
                  <div key={goal.id} className="card" style={{ padding: '16px' }}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {kpiInfo.name}
                        </h4>
                      </div>
                      <button
                        className="btn btn-secondary btn-icon"
                        onClick={() => deleteGoalMutation.mutate(goal.kpi_id)}
                        style={{ width: '28px', height: '28px', opacity: 0.7 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="text-center">
                      <div className="text-xs text-muted mb-1">Target</div>
                      <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                        {formatValue(goal.target_value, kpiInfo.unit)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
