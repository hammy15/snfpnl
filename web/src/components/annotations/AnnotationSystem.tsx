import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Plus, X, Edit2, Trash2, ChevronDown, ChevronRight,
  Tag, Calendar, User, Pin, AlertCircle, TrendingUp, TrendingDown
} from 'lucide-react';

interface Annotation {
  id: string;
  facilityId: number;
  periodId: string;
  kpiId?: string;
  type: 'note' | 'insight' | 'action' | 'warning' | 'milestone';
  title: string;
  content: string;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
}

interface AnnotationSystemProps {
  facilityId: number;
  periodId: string;
  kpiId?: string;
}

const TYPE_CONFIG = {
  note: { icon: MessageSquare, color: 'var(--text-muted)', label: 'Note' },
  insight: { icon: TrendingUp, color: 'var(--primary)', label: 'Insight' },
  action: { icon: AlertCircle, color: 'var(--warning)', label: 'Action Required' },
  warning: { icon: TrendingDown, color: 'var(--danger)', label: 'Warning' },
  milestone: { icon: Pin, color: 'var(--success)', label: 'Milestone' }
};

export function AnnotationSystem({ facilityId, periodId, kpiId }: AnnotationSystemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_editingId, _setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [newAnnotation, setNewAnnotation] = useState({
    type: 'note' as Annotation['type'],
    title: '',
    content: '',
    tags: [] as string[],
    isPinned: false
  });
  const [tagInput, setTagInput] = useState('');
  const queryClient = useQueryClient();

  const { data: annotations = [], isLoading } = useQuery<Annotation[]>({
    queryKey: ['annotations', facilityId, periodId, kpiId],
    queryFn: async () => {
      const params = new URLSearchParams({
        facilityId: facilityId.toString(),
        periodId
      });
      if (kpiId) params.append('kpiId', kpiId);

      const response = await fetch(`https://snfpnl.onrender.com/api/annotations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch annotations');
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (annotation: Partial<Annotation>) => {
      const response = await fetch('https://snfpnl.onrender.com/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...annotation, facilityId, periodId, kpiId })
      });
      if (!response.ok) throw new Error('Failed to create annotation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations'] });
      setIsAdding(false);
      setNewAnnotation({ type: 'note', title: '', content: '', tags: [], isPinned: false });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`https://snfpnl.onrender.com/api/annotations/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete annotation');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['annotations'] })
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
      const response = await fetch(`https://snfpnl.onrender.com/api/annotations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned })
      });
      if (!response.ok) throw new Error('Failed to update annotation');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['annotations'] })
  });

  const addTag = () => {
    if (tagInput.trim() && !newAnnotation.tags.includes(tagInput.trim())) {
      setNewAnnotation({
        ...newAnnotation,
        tags: [...newAnnotation.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setNewAnnotation({
      ...newAnnotation,
      tags: newAnnotation.tags.filter(t => t !== tag)
    });
  };

  const filteredAnnotations = annotations
    .filter(a => filterType === 'all' || a.type === filterType)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MessageSquare size={20} />
          Annotations & Notes
          {annotations.length > 0 && (
            <span className="badge badge-info">{annotations.length} annotations</span>
          )}
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="select"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                <option value="all">All Types</option>
                <option value="note">Notes</option>
                <option value="insight">Insights</option>
                <option value="action">Actions</option>
                <option value="warning">Warnings</option>
                <option value="milestone">Milestones</option>
              </select>
            </div>
            <button
              onClick={() => setIsAdding(true)}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              <Plus size={14} style={{ marginRight: '6px' }} />
              Add Annotation
            </button>
          </div>

          {/* Add Form */}
          {isAdding && (
            <div className="card mb-4" style={{ padding: '20px', border: '1px solid var(--primary)' }}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>New Annotation</h4>
                <button onClick={() => setIsAdding(false)} className="btn btn-secondary btn-icon" style={{ width: '28px', height: '28px' }}>
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-muted mb-1 block">Type</label>
                  <select
                    value={newAnnotation.type}
                    onChange={(e) => setNewAnnotation({ ...newAnnotation, type: e.target.value as Annotation['type'] })}
                    className="select"
                    style={{ width: '100%' }}
                  >
                    {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Title</label>
                  <input
                    type="text"
                    value={newAnnotation.title}
                    onChange={(e) => setNewAnnotation({ ...newAnnotation, title: e.target.value })}
                    placeholder="Brief title..."
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs text-muted mb-1 block">Content</label>
                <textarea
                  value={newAnnotation.content}
                  onChange={(e) => setNewAnnotation({ ...newAnnotation, content: e.target.value })}
                  placeholder="Add your notes, insights, or action items..."
                  className="input"
                  style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
                />
              </div>

              <div className="mb-4">
                <label className="text-xs text-muted mb-1 block">Tags</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {newAnnotation.tags.map(tag => (
                    <span
                      key={tag}
                      className="badge badge-info"
                      style={{ cursor: 'pointer' }}
                      onClick={() => removeTag(tag)}
                    >
                      {tag} <X size={10} style={{ marginLeft: '4px' }} />
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add tag..."
                    className="input"
                    style={{ flex: 1 }}
                  />
                  <button onClick={addTag} className="btn btn-secondary">Add</button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAnnotation.isPinned}
                    onChange={(e) => setNewAnnotation({ ...newAnnotation, isPinned: e.target.checked })}
                  />
                  <Pin size={14} />
                  <span className="text-sm">Pin to top</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setIsAdding(false)} className="btn btn-secondary">Cancel</button>
                  <button
                    onClick={() => createMutation.mutate(newAnnotation)}
                    className="btn btn-primary"
                    disabled={!newAnnotation.title.trim() || createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Saving...' : 'Save Annotation'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Annotations List */}
          {isLoading ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
          ) : filteredAnnotations.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <MessageSquare size={40} style={{ margin: '0 auto', color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p className="text-muted">No annotations yet. Add notes to track insights and actions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnnotations.map(annotation => {
                const TypeIcon = TYPE_CONFIG[annotation.type].icon;
                const typeColor = TYPE_CONFIG[annotation.type].color;

                return (
                  <div
                    key={annotation.id}
                    className="card"
                    style={{
                      padding: '16px',
                      borderLeft: `3px solid ${typeColor}`,
                      background: annotation.isPinned ? 'rgba(102, 126, 234, 0.05)' : undefined
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: `${typeColor}22`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: typeColor,
                          flexShrink: 0
                        }}>
                          <TypeIcon size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                              {annotation.title}
                            </h5>
                            {annotation.isPinned && (
                              <Pin size={12} style={{ color: 'var(--primary)' }} />
                            )}
                            <span className="badge" style={{
                              background: `${typeColor}22`,
                              color: typeColor,
                              fontSize: '10px'
                            }}>
                              {TYPE_CONFIG[annotation.type].label}
                            </span>
                          </div>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            {annotation.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted">
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {formatDate(annotation.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User size={10} />
                              {annotation.author}
                            </span>
                            {annotation.tags.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Tag size={10} />
                                {annotation.tags.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => togglePinMutation.mutate({ id: annotation.id, isPinned: !annotation.isPinned })}
                          className="btn btn-secondary btn-icon"
                          style={{ width: '28px', height: '28px' }}
                          title={annotation.isPinned ? 'Unpin' : 'Pin'}
                        >
                          <Pin size={12} style={{ color: annotation.isPinned ? 'var(--primary)' : undefined }} />
                        </button>
                        <button
                          onClick={() => _setEditingId(annotation.id)}
                          className="btn btn-secondary btn-icon"
                          style={{ width: '28px', height: '28px' }}
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this annotation?')) {
                              deleteMutation.mutate(annotation.id);
                            }
                          }}
                          className="btn btn-secondary btn-icon"
                          style={{ width: '28px', height: '28px' }}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
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
