import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  CheckSquare, Plus, Calendar, User, Tag, AlertTriangle,
  ChevronDown, ChevronRight, Filter, Search,
  Check, Trash2, Flag, Building2, ArrowUp, ArrowDown
} from 'lucide-react';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
type TaskCategory = 'operational' | 'financial' | 'staffing' | 'compliance' | 'strategic';

interface ActionItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  facilityId?: string;
  facilityName?: string;
  assignee?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  relatedKpi?: string;
  notes?: string[];
  tags?: string[];
}

interface ActionItemsResponse {
  items: ActionItem[];
  summary: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    blocked: number;
    overdue: number;
  };
}

interface ActionItemsProps {
  facilityId?: string;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#667eea', bg: 'rgba(102, 126, 234, 0.15)' },
  in_progress: { label: 'In Progress', color: '#ffa502', bg: 'rgba(255, 165, 2, 0.15)' },
  completed: { label: 'Completed', color: '#00d9a5', bg: 'rgba(0, 217, 165, 0.15)' },
  blocked: { label: 'Blocked', color: '#ff4757', bg: 'rgba(255, 71, 87, 0.15)' }
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; icon: typeof Flag }> = {
  urgent: { label: 'Urgent', color: '#ff4757', icon: Flag },
  high: { label: 'High', color: '#ffa502', icon: ArrowUp },
  medium: { label: 'Medium', color: '#667eea', icon: Flag },
  low: { label: 'Low', color: '#00d9a5', icon: ArrowDown }
};

const CATEGORY_CONFIG: Record<TaskCategory, { label: string; color: string }> = {
  operational: { label: 'Operational', color: '#667eea' },
  financial: { label: 'Financial', color: '#00d9a5' },
  staffing: { label: 'Staffing', color: '#ffa502' },
  compliance: { label: 'Compliance', color: '#ff4757' },
  strategic: { label: 'Strategic', color: '#a55eea' }
};

export function ActionItems({ facilityId }: ActionItemsProps) {
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<TaskCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState<Partial<ActionItem>>({
    title: '',
    priority: 'medium',
    category: 'operational',
    status: 'pending'
  });
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<ActionItemsResponse>({
    queryKey: ['action-items', facilityId],
    queryFn: async () => {
      const url = facilityId
        ? `https://snfpnl.onrender.com/api/action-items?facilityId=${facilityId}`
        : 'https://snfpnl.onrender.com/api/action-items';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch action items');
      return response.json();
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: async (task: Partial<ActionItem>) => {
      const response = await fetch('https://snfpnl.onrender.com/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, facilityId }),
      });
      if (!response.ok) throw new Error('Failed to add task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
      setShowAddForm(false);
      setNewTask({ title: '', priority: 'medium', category: 'operational', status: 'pending' });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ActionItem> }) => {
      const response = await fetch(`https://snfpnl.onrender.com/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`https://snfpnl.onrender.com/api/action-items/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
    },
  });

  const filteredItems = data?.items.filter(item => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    // Sort by priority first, then by due date
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return 0;
  }) || [];

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Loading action items...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <CheckSquare size={48} className="text-muted" style={{ margin: '0 auto 16px' }} />
        <p className="text-danger">Failed to load action items</p>
      </div>
    );
  }

  return (
    <div className="action-items">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 mb-4">
        <div
          className="card"
          style={{ padding: '16px', cursor: 'pointer' }}
          onClick={() => setFilterStatus('all')}
        >
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {data.summary.total}
            </div>
            <div className="text-xs text-muted">Total Tasks</div>
          </div>
        </div>

        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <div
            key={status}
            className="card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              background: filterStatus === status ? config.bg : undefined,
              border: filterStatus === status ? `1px solid ${config.color}` : undefined
            }}
            onClick={() => setFilterStatus(filterStatus === status ? 'all' : status as TaskStatus)}
          >
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: config.color }}>
                {data.summary[status === 'in_progress' ? 'inProgress' : status as keyof typeof data.summary]}
              </div>
              <div className="text-xs text-muted">{config.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Overdue warning */}
      {data.summary.overdue > 0 && (
        <div className="card mb-4" style={{
          padding: '12px 16px',
          background: 'rgba(255, 71, 87, 0.15)',
          border: '1px solid rgba(255, 71, 87, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertTriangle size={20} style={{ color: '#ff4757' }} />
          <span style={{ color: '#ff4757', fontWeight: 500 }}>
            {data.summary.overdue} task{data.summary.overdue > 1 ? 's are' : ' is'} overdue
          </span>
        </div>
      )}

      {/* Filters and Search */}
      <div className="card mb-4" style={{ padding: '16px' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2" style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '8px 12px'
            }}>
              <Search size={16} className="text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  width: '200px',
                  outline: 'none'
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter size={14} className="text-muted" />
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as TaskPriority | 'all')}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as TaskCategory | 'all')}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            Add Task
          </button>
        </div>
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <div className="card mb-4" style={{ padding: '20px' }}>
          <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>New Action Item</h4>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title..."
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <textarea
                value={newTask.description || ''}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Description (optional)..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  resize: 'vertical'
                }}
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Priority</label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as TaskPriority })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              >
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Category</label>
              <select
                value={newTask.category}
                onChange={(e) => setNewTask({ ...newTask, category: e.target.value as TaskCategory })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              >
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Assignee</label>
              <input
                type="text"
                value={newTask.assignee || ''}
                onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                placeholder="Assignee name..."
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Due Date</label>
              <input
                type="date"
                value={newTask.dueDate || ''}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              className="btn btn-primary"
              onClick={() => addTaskMutation.mutate(newTask)}
              disabled={!newTask.title || addTaskMutation.isPending}
            >
              {addTaskMutation.isPending ? 'Adding...' : 'Add Task'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowAddForm(false);
                setNewTask({ title: '', priority: 'medium', category: 'operational', status: 'pending' });
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <CheckSquare size={48} className="text-muted" style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p className="text-muted">No action items found</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const statusConfig = STATUS_CONFIG[item.status];
            const priorityConfig = PRIORITY_CONFIG[item.priority];
            const categoryConfig = CATEGORY_CONFIG[item.category];
            const isExpanded = expandedItem === item.id;
            const overdue = isOverdue(item.dueDate) && item.status !== 'completed';
            const PriorityIcon = priorityConfig.icon;

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: 0,
                  border: overdue ? '1px solid rgba(255, 71, 87, 0.5)' : undefined,
                  background: overdue ? 'rgba(255, 71, 87, 0.05)' : undefined
                }}
              >
                <div
                  style={{ padding: '16px', cursor: 'pointer' }}
                  onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                >
                  <div className="flex items-center gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTaskMutation.mutate({
                          id: item.id,
                          updates: { status: item.status === 'completed' ? 'pending' : 'completed' }
                        });
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        border: `2px solid ${item.status === 'completed' ? '#00d9a5' : 'rgba(255,255,255,0.3)'}`,
                        background: item.status === 'completed' ? '#00d9a5' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      {item.status === 'completed' && <Check size={14} color="#0f0f1a" />}
                    </button>

                    {/* Priority indicator */}
                    <div style={{ color: priorityConfig.color, flexShrink: 0 }}>
                      <PriorityIcon size={16} />
                    </div>

                    {/* Task info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="font-medium"
                          style={{
                            color: 'var(--text-primary)',
                            textDecoration: item.status === 'completed' ? 'line-through' : 'none',
                            opacity: item.status === 'completed' ? 0.6 : 1
                          }}
                        >
                          {item.title}
                        </span>
                        <span className="badge" style={{
                          background: categoryConfig.color + '22',
                          color: categoryConfig.color,
                          fontSize: '10px'
                        }}>
                          {categoryConfig.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted">
                        {item.facilityName && (
                          <span className="flex items-center gap-1">
                            <Building2 size={12} />
                            {item.facilityName}
                          </span>
                        )}
                        {item.assignee && (
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {item.assignee}
                          </span>
                        )}
                        {item.dueDate && (
                          <span className="flex items-center gap-1" style={{ color: overdue ? '#ff4757' : undefined }}>
                            <Calendar size={12} />
                            {formatDate(item.dueDate)}
                            {overdue && ' (Overdue)'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <span className="badge" style={{
                      background: statusConfig.bg,
                      color: statusConfig.color,
                      fontSize: '11px'
                    }}>
                      {statusConfig.label}
                    </span>

                    {/* Expand arrow */}
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{
                    padding: '16px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.2)'
                  }}>
                    {item.description && (
                      <p className="text-sm text-muted mb-4">{item.description}</p>
                    )}

                    {/* Status buttons */}
                    <div className="mb-4">
                      <label className="text-xs text-muted mb-2 block">Update Status</label>
                      <div className="flex gap-2">
                        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                          <button
                            key={status}
                            className={`btn ${item.status === status ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => updateTaskMutation.mutate({
                              id: item.id,
                              updates: { status: status as TaskStatus }
                            })}
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            {config.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="mb-4">
                        <label className="text-xs text-muted mb-2 block">Tags</label>
                        <div className="flex gap-2">
                          {item.tags.map((tag, idx) => (
                            <span key={idx} className="badge badge-info" style={{ fontSize: '11px' }}>
                              <Tag size={10} style={{ marginRight: '4px' }} />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        className="btn btn-secondary"
                        onClick={() => deleteTaskMutation.mutate(item.id)}
                        style={{ padding: '6px 12px', fontSize: '12px', color: '#ff4757' }}
                      >
                        <Trash2 size={14} style={{ marginRight: '6px' }} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
