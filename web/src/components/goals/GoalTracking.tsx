import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, Trash2, Edit2, X, Check, Calendar, TrendingUp, TrendingDown, Award } from 'lucide-react';
import './GoalTracking.css';

interface KpiGoal {
  id: number;
  facility_id: string;
  kpi_id: string;
  target_value: number;
  deadline: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ServerKpiGoal extends Omit<KpiGoal, 'deadline'> {
  target_date: string | null;
}

interface GoalTrackingProps {
  facilityId: string;
  currentKpiValues?: Record<string, number>;
}

const KPI_OPTIONS = [
  { value: 'snf_occupancy_pct', label: 'Occupancy %', unit: '%', higherIsBetter: true },
  { value: 'snf_skilled_mix_pct', label: 'Skilled Mix %', unit: '%', higherIsBetter: true },
  { value: 'snf_operating_margin_pct', label: 'Operating Margin %', unit: '%', higherIsBetter: true },
  { value: 'snf_revenue_ppd', label: 'Revenue PPD', unit: '$', higherIsBetter: true },
  { value: 'snf_nursing_hppd', label: 'Nursing HPPD', unit: 'hrs', higherIsBetter: true },
  { value: 'snf_nursing_cost_ppd', label: 'Nursing Cost PPD', unit: '$', higherIsBetter: false },
  { value: 'snf_contract_labor_pct', label: 'Contract Labor %', unit: '%', higherIsBetter: false },
  { value: 'snf_total_expense_ppd', label: 'Total Expense PPD', unit: '$', higherIsBetter: false },
];

async function fetchGoals(facilityId: string): Promise<KpiGoal[]> {
  const res = await fetch(`https://snfpnl.onrender.com/api/kpi-goals/${facilityId}`);
  if (!res.ok) throw new Error('Failed to fetch goals');
  const data: ServerKpiGoal[] = await res.json();
  // Map server fields to frontend fields
  return data.map((g) => ({
    ...g,
    deadline: g.target_date,
  }));
}

export function GoalTracking({ facilityId, currentKpiValues = {} }: GoalTrackingProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newGoal, setNewGoal] = useState({
    kpiId: 'snf_occupancy_pct',
    targetValue: '',
    deadline: '',
    notes: ''
  });
  const [editGoal, setEditGoal] = useState({
    targetValue: '',
    deadline: '',
    notes: '',
    status: ''
  });
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['kpi-goals', facilityId],
    queryFn: () => fetchGoals(facilityId),
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newGoal) => {
      const userName = JSON.parse(localStorage.getItem('snfpnl_auth') || '{}').name || 'Unknown';
      const res = await fetch('https://snfpnl.onrender.com/api/kpi-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId,
          kpiId: data.kpiId,
          targetValue: parseFloat(data.targetValue),
          targetDate: data.deadline || null,
          notes: data.notes || null,
          createdBy: userName,
        }),
      });
      if (!res.ok) throw new Error('Failed to create goal');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-goals', facilityId] });
      setNewGoal({ kpiId: 'snf_occupancy_pct', targetValue: '', deadline: '', notes: '' });
      setIsAdding(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ kpiId, data }: { kpiId: string; data: typeof editGoal }) => {
      // Server uses POST to update (upsert pattern)
      const userName = JSON.parse(localStorage.getItem('snfpnl_auth') || '{}').name || 'Unknown';
      const res = await fetch('https://snfpnl.onrender.com/api/kpi-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId,
          kpiId,
          targetValue: parseFloat(data.targetValue),
          targetDate: data.deadline || null,
          notes: data.notes || null,
          createdBy: userName,
        }),
      });
      if (!res.ok) throw new Error('Failed to update goal');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-goals', facilityId] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      const res = await fetch(`https://snfpnl.onrender.com/api/kpi-goals/${facilityId}/${kpiId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete goal');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-goals', facilityId] });
    },
  });

  const handleCreate = () => {
    if (!newGoal.targetValue) return;
    createMutation.mutate(newGoal);
  };

  const handleUpdate = (kpiId: string) => {
    if (!editGoal.targetValue) return;
    updateMutation.mutate({ kpiId, data: editGoal });
  };

  const startEdit = (goal: KpiGoal) => {
    setEditingId(goal.id);
    setEditGoal({
      targetValue: goal.target_value.toString(),
      deadline: goal.deadline || '',
      notes: goal.notes || '',
      status: goal.status
    });
  };

  const getKpiConfig = (kpiId: string) => {
    return KPI_OPTIONS.find(k => k.value === kpiId) || { label: kpiId, unit: '', higherIsBetter: true };
  };

  const calculateProgress = (goal: KpiGoal): { progress: number; status: string } => {
    const currentValue = currentKpiValues[goal.kpi_id];
    if (currentValue === undefined) {
      return { progress: 0, status: goal.status };
    }

    const config = getKpiConfig(goal.kpi_id);
    const target = goal.target_value;

    let progress: number;
    if (config.higherIsBetter) {
      progress = (currentValue / target) * 100;
    } else {
      progress = target > 0 ? ((2 * target - currentValue) / target) * 100 : 0;
    }
    progress = Math.max(0, Math.min(100, progress));

    let status = goal.status;
    if (progress >= 100) {
      status = 'achieved';
    } else if (progress >= 80) {
      status = 'on_track';
    } else if (progress >= 50) {
      status = 'at_risk';
    } else {
      status = 'behind';
    }

    return { progress, status };
  };

  const formatValue = (value: number, kpiId: string) => {
    const config = getKpiConfig(kpiId);
    if (config.unit === '%') {
      return `${value.toFixed(1)}%`;
    } else if (config.unit === '$') {
      return `$${value.toFixed(2)}`;
    }
    return value.toFixed(2);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'achieved': return <Award size={12} />;
      case 'on_track': return <TrendingUp size={12} />;
      case 'at_risk': return <TrendingDown size={12} />;
      case 'behind': return <TrendingDown size={12} />;
      default: return <Target size={12} />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'achieved': return 'Achieved';
      case 'on_track': return 'On Track';
      case 'at_risk': return 'At Risk';
      case 'behind': return 'Behind';
      default: return 'Pending';
    }
  };

  return (
    <div className="goal-tracking-panel">
      <div className="goal-header">
        <div className="goal-title">
          <Target size={20} />
          <h3>Performance Goals</h3>
        </div>
        {!isAdding && (
          <button className="add-goal-btn" onClick={() => setIsAdding(true)}>
            <Plus size={16} />
            Set Goal
          </button>
        )}
      </div>

      {isAdding && (
        <div className="goal-form">
          <div className="goal-form-row">
            <div className="goal-form-group">
              <label>KPI Metric</label>
              <select
                value={newGoal.kpiId}
                onChange={(e) => setNewGoal(prev => ({ ...prev, kpiId: e.target.value }))}
              >
                {KPI_OPTIONS.map(kpi => (
                  <option key={kpi.value} value={kpi.value}>{kpi.label}</option>
                ))}
              </select>
            </div>
            <div className="goal-form-group">
              <label>Target Value</label>
              <input
                type="number"
                step="0.01"
                value={newGoal.targetValue}
                onChange={(e) => setNewGoal(prev => ({ ...prev, targetValue: e.target.value }))}
                placeholder={`e.g., ${getKpiConfig(newGoal.kpiId).unit === '%' ? '85' : '150'}`}
              />
            </div>
          </div>
          <div className="goal-form-row">
            <div className="goal-form-group">
              <label>Target Date (Optional)</label>
              <input
                type="date"
                value={newGoal.deadline}
                onChange={(e) => setNewGoal(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>
            <div className="goal-form-group">
              <label>Notes (Optional)</label>
              <input
                type="text"
                value={newGoal.notes}
                onChange={(e) => setNewGoal(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add context..."
              />
            </div>
          </div>
          <div className="goal-form-actions">
            <button className="goal-cancel-btn" onClick={() => setIsAdding(false)}>
              Cancel
            </button>
            <button
              className="goal-save-btn"
              onClick={handleCreate}
              disabled={!newGoal.targetValue || createMutation.isPending}
            >
              {createMutation.isPending ? 'Saving...' : 'Create Goal'}
            </button>
          </div>
        </div>
      )}

      <div className="goals-list">
        {isLoading ? (
          <div className="goals-loading">Loading goals...</div>
        ) : goals.length === 0 ? (
          <div className="goals-empty">
            <Target size={32} strokeWidth={1.5} />
            <p>No goals set</p>
            <span>Set performance targets to track progress over time</span>
          </div>
        ) : (
          goals.map(goal => {
            const kpiConfig = getKpiConfig(goal.kpi_id);
            const { progress, status } = calculateProgress(goal);
            const currentValue = currentKpiValues[goal.kpi_id];
            const isEditing = editingId === goal.id;
            const statusClass = status.replace('_', '-');

            if (isEditing) {
              return (
                <div key={goal.id} className={`goal-item ${statusClass}`}>
                  <div className="goal-edit-form">
                    <div className="goal-edit-row">
                      <div className="goal-edit-group">
                        <label>Target Value</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editGoal.targetValue}
                          onChange={(e) => setEditGoal(prev => ({ ...prev, targetValue: e.target.value }))}
                        />
                      </div>
                      <div className="goal-edit-group">
                        <label>Status</label>
                        <select
                          value={editGoal.status}
                          onChange={(e) => setEditGoal(prev => ({ ...prev, status: e.target.value }))}
                        >
                          <option value="pending">Pending</option>
                          <option value="on_track">On Track</option>
                          <option value="at_risk">At Risk</option>
                          <option value="behind">Behind</option>
                          <option value="achieved">Achieved</option>
                        </select>
                      </div>
                    </div>
                    <div className="goal-edit-row">
                      <div className="goal-edit-group">
                        <label>Target Date</label>
                        <input
                          type="date"
                          value={editGoal.deadline}
                          onChange={(e) => setEditGoal(prev => ({ ...prev, deadline: e.target.value }))}
                        />
                      </div>
                      <div className="goal-edit-group">
                        <label>Notes</label>
                        <input
                          type="text"
                          value={editGoal.notes}
                          onChange={(e) => setEditGoal(prev => ({ ...prev, notes: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="goal-edit-actions">
                      <button className="cancel" onClick={() => setEditingId(null)}>
                        <X size={14} /> Cancel
                      </button>
                      <button
                        className="save"
                        onClick={() => handleUpdate(goal.kpi_id)}
                        disabled={updateMutation.isPending}
                      >
                        <Check size={14} /> Save
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={goal.id} className={`goal-item ${statusClass}`}>
                <div className="goal-item-header">
                  <span className="goal-kpi-name">{kpiConfig.label}</span>
                  <span className={`goal-status-badge ${statusClass}`}>
                    {getStatusIcon(status)}
                    {getStatusLabel(status)}
                  </span>
                </div>
                <div className="goal-progress-section">
                  <div className="goal-values">
                    <span className="goal-current">
                      Current: <strong>{currentValue !== undefined ? formatValue(currentValue, goal.kpi_id) : 'N/A'}</strong>
                    </span>
                    <span className="goal-target">
                      Target: {formatValue(goal.target_value, goal.kpi_id)}
                    </span>
                  </div>
                  <div className="goal-progress-bar">
                    <div
                      className="goal-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <div className="goal-meta">
                  {goal.deadline && (
                    <span className="goal-deadline">
                      <Calendar size={12} />
                      {new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                  {goal.notes && (
                    <span className="goal-notes">{goal.notes}</span>
                  )}
                  <div className="goal-actions">
                    <button onClick={() => startEdit(goal)} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this goal?')) {
                          deleteMutation.mutate(goal.kpi_id);
                        }
                      }}
                      title="Delete"
                      className="delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
