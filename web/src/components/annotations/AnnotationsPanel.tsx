import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Trash2, Edit2, X, Check, StickyNote, AlertCircle, Lightbulb } from 'lucide-react';
import './AnnotationsPanel.css';

interface Annotation {
  id: number;
  facility_id: string;
  period_id: string | null;
  kpi_id: string | null;
  note: string;
  author: string;
  annotation_type: string;
  created_at: string;
  updated_at: string;
}

interface AnnotationsPanelProps {
  facilityId: string;
  periodId?: string;
  kpiId?: string;
}

const ANNOTATION_TYPES = [
  { value: 'note', label: 'Note', icon: StickyNote, color: '#3b82f6' },
  { value: 'alert', label: 'Alert', icon: AlertCircle, color: '#ef4444' },
  { value: 'insight', label: 'Insight', icon: Lightbulb, color: '#f59e0b' },
];

async function fetchAnnotations(facilityId: string, periodId?: string, kpiId?: string): Promise<Annotation[]> {
  const params = new URLSearchParams({ facilityId });
  if (periodId) params.append('periodId', periodId);
  if (kpiId) params.append('kpiId', kpiId);

  const res = await fetch(`https://snfpnl.onrender.com/api/annotations?${params}`);
  if (!res.ok) throw new Error('Failed to fetch annotations');
  return res.json();
}

export function AnnotationsPanel({ facilityId, periodId, kpiId }: AnnotationsPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newNote, setNewNote] = useState('');
  const [newType, setNewType] = useState('note');
  const [editNote, setEditNote] = useState('');
  const [editType, setEditType] = useState('note');
  const queryClient = useQueryClient();

  const { data: annotations = [], isLoading } = useQuery({
    queryKey: ['annotations', facilityId, periodId, kpiId],
    queryFn: () => fetchAnnotations(facilityId, periodId, kpiId),
  });

  const createMutation = useMutation({
    mutationFn: async (data: { note: string; annotationType: string }) => {
      const userName = JSON.parse(localStorage.getItem('snfpnl_auth') || '{}').name || 'Unknown';
      const res = await fetch('https://snfpnl.onrender.com/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId,
          periodId,
          kpiId,
          note: data.note,
          author: userName,
          annotationType: data.annotationType,
        }),
      });
      if (!res.ok) throw new Error('Failed to create annotation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', facilityId] });
      setNewNote('');
      setNewType('note');
      setIsAdding(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, note, annotationType }: { id: number; note: string; annotationType: string }) => {
      const res = await fetch(`https://snfpnl.onrender.com/api/annotations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, annotationType }),
      });
      if (!res.ok) throw new Error('Failed to update annotation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', facilityId] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`https://snfpnl.onrender.com/api/annotations/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete annotation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', facilityId] });
    },
  });

  const handleCreate = () => {
    if (!newNote.trim()) return;
    createMutation.mutate({ note: newNote, annotationType: newType });
  };

  const handleUpdate = (id: number) => {
    if (!editNote.trim()) return;
    updateMutation.mutate({ id, note: editNote, annotationType: editType });
  };

  const startEdit = (annotation: Annotation) => {
    setEditingId(annotation.id);
    setEditNote(annotation.note);
    setEditType(annotation.annotation_type);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeConfig = (type: string) => {
    return ANNOTATION_TYPES.find(t => t.value === type) || ANNOTATION_TYPES[0];
  };

  return (
    <div className="annotations-panel">
      <div className="annotations-header">
        <div className="annotations-title">
          <MessageSquare size={20} />
          <h3>Notes & Annotations</h3>
        </div>
        {!isAdding && (
          <button className="add-annotation-btn" onClick={() => setIsAdding(true)}>
            <Plus size={16} />
            Add Note
          </button>
        )}
      </div>

      {isAdding && (
        <div className="annotation-form">
          <div className="annotation-type-selector">
            {ANNOTATION_TYPES.map(type => (
              <button
                key={type.value}
                className={`type-btn ${newType === type.value ? 'active' : ''}`}
                onClick={() => setNewType(type.value)}
                style={{ '--type-color': type.color } as React.CSSProperties}
              >
                <type.icon size={14} />
                {type.label}
              </button>
            ))}
          </div>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note about this data..."
            rows={3}
            autoFocus
          />
          <div className="annotation-form-actions">
            <button className="cancel-btn" onClick={() => setIsAdding(false)}>
              Cancel
            </button>
            <button
              className="save-btn"
              onClick={handleCreate}
              disabled={!newNote.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      <div className="annotations-list">
        {isLoading ? (
          <div className="annotations-loading">Loading notes...</div>
        ) : annotations.length === 0 ? (
          <div className="annotations-empty">
            <StickyNote size={32} strokeWidth={1.5} />
            <p>No notes yet</p>
            <span>Add notes to track important context about this data</span>
          </div>
        ) : (
          annotations.map(annotation => {
            const typeConfig = getTypeConfig(annotation.annotation_type);
            const TypeIcon = typeConfig.icon;
            const isEditing = editingId === annotation.id;

            return (
              <div
                key={annotation.id}
                className={`annotation-item ${annotation.annotation_type}`}
                style={{ '--type-color': typeConfig.color } as React.CSSProperties}
              >
                <div className="annotation-icon">
                  <TypeIcon size={16} />
                </div>
                <div className="annotation-content">
                  {isEditing ? (
                    <>
                      <div className="annotation-type-selector small">
                        {ANNOTATION_TYPES.map(type => (
                          <button
                            key={type.value}
                            className={`type-btn ${editType === type.value ? 'active' : ''}`}
                            onClick={() => setEditType(type.value)}
                            style={{ '--type-color': type.color } as React.CSSProperties}
                          >
                            <type.icon size={12} />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        rows={2}
                        autoFocus
                      />
                      <div className="edit-actions">
                        <button onClick={() => setEditingId(null)}>
                          <X size={14} />
                        </button>
                        <button
                          className="confirm"
                          onClick={() => handleUpdate(annotation.id)}
                          disabled={updateMutation.isPending}
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="annotation-text">{annotation.note}</p>
                      <div className="annotation-meta">
                        <span className="annotation-author">{annotation.author}</span>
                        <span className="annotation-date">{formatDate(annotation.created_at)}</span>
                        {annotation.kpi_id && (
                          <span className="annotation-kpi">{annotation.kpi_id.replace('snf_', '').replace(/_/g, ' ')}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="annotation-actions">
                    <button onClick={() => startEdit(annotation)} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this note?')) {
                          deleteMutation.mutate(annotation.id);
                        }
                      }}
                      title="Delete"
                      className="delete"
                    >
                      <Trash2 size={14} />
                    </button>
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
