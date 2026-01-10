import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Mail, Plus, Clock, Calendar, Trash2, X,
  Send, Users, FileText, AlertCircle, ChevronDown, ChevronRight,
  Pause, Play, Settings
} from 'lucide-react';

type ReportFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type ReportType = 'executive' | 'operational' | 'financial' | 'alerts' | 'custom';

interface ScheduledReport {
  id: string;
  name: string;
  type: ReportType;
  frequency: ReportFrequency;
  recipients: string[];
  facilityIds: string[] | 'all';
  metrics: string[];
  includeAlerts: boolean;
  includeCharts: boolean;
  scheduledTime: string; // HH:mm
  scheduledDay?: number; // 0-6 for weekly, 1-31 for monthly
  lastSent?: string;
  nextScheduled?: string;
  isActive: boolean;
  createdAt: string;
}

interface ReportsResponse {
  reports: ScheduledReport[];
  summary: {
    active: number;
    paused: number;
    totalSent: number;
  };
}

const FREQUENCY_CONFIG: Record<ReportFrequency, { label: string; description: string }> = {
  daily: { label: 'Daily', description: 'Every day at scheduled time' },
  weekly: { label: 'Weekly', description: 'Once per week' },
  monthly: { label: 'Monthly', description: 'Once per month' },
  quarterly: { label: 'Quarterly', description: 'Every 3 months' }
};

const REPORT_TYPE_CONFIG: Record<ReportType, { label: string; description: string; icon: typeof FileText }> = {
  executive: { label: 'Executive Summary', description: 'High-level KPIs and trends', icon: FileText },
  operational: { label: 'Operational Report', description: 'Detailed operational metrics', icon: Settings },
  financial: { label: 'Financial Report', description: 'Revenue, costs, and margins', icon: FileText },
  alerts: { label: 'Alerts Digest', description: 'Summary of alerts and issues', icon: AlertCircle },
  custom: { label: 'Custom Report', description: 'Select specific metrics', icon: FileText }
};

export function AutomatedReports() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [_editingReport, _setEditingReport] = useState<ScheduledReport | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [newReport, setNewReport] = useState<Partial<ScheduledReport>>({
    name: '',
    type: 'executive',
    frequency: 'weekly',
    recipients: [''],
    facilityIds: 'all',
    metrics: [],
    includeAlerts: true,
    includeCharts: true,
    scheduledTime: '08:00',
    isActive: true
  });

  const { data, isLoading, error } = useQuery<ReportsResponse>({
    queryKey: ['scheduled-reports'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3002/api/scheduled-reports');
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
  });

  const createReportMutation = useMutation({
    mutationFn: async (report: Partial<ScheduledReport>) => {
      const response = await fetch('http://localhost:3002/api/scheduled-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (!response.ok) throw new Error('Failed to create report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      setShowCreateForm(false);
      setNewReport({
        name: '',
        type: 'executive',
        frequency: 'weekly',
        recipients: [''],
        facilityIds: 'all',
        metrics: [],
        includeAlerts: true,
        includeCharts: true,
        scheduledTime: '08:00',
        isActive: true
      });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ScheduledReport> }) => {
      const response = await fetch(`http://localhost:3002/api/scheduled-reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`http://localhost:3002/api/scheduled-reports/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`http://localhost:3002/api/scheduled-reports/${id}/send`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
  });

  const addRecipient = () => {
    setNewReport({
      ...newReport,
      recipients: [...(newReport.recipients || []), '']
    });
  };

  const updateRecipient = (index: number, value: string) => {
    const recipients = [...(newReport.recipients || [])];
    recipients[index] = value;
    setNewReport({ ...newReport, recipients });
  };

  const removeRecipient = (index: number) => {
    const recipients = (newReport.recipients || []).filter((_, i) => i !== index);
    setNewReport({ ...newReport, recipients });
  };

  const formatNextScheduled = (dateStr?: string) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `in ${days}d ${hours}h`;
    if (hours > 0) return `in ${hours}h`;
    return 'Soon';
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Loading scheduled reports...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <Mail size={48} className="text-muted" style={{ margin: '0 auto 16px' }} />
        <p className="text-danger">Failed to load scheduled reports</p>
      </div>
    );
  }

  return (
    <div className="automated-reports">
      {/* Header */}
      <div className="card mb-4" style={{ padding: '20px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(102, 126, 234, 0.05))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Mail size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Automated Reports</h3>
              <p className="text-sm text-muted">Schedule and manage automated email reports</p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            New Report
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 mb-4">
        <div className="card" style={{ padding: '16px' }}>
          <div className="flex items-center gap-3">
            <Play size={24} className="text-success" />
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.summary.active}
              </div>
              <div className="text-xs text-muted">Active Reports</div>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div className="flex items-center gap-3">
            <Pause size={24} className="text-warning" />
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.summary.paused}
              </div>
              <div className="text-xs text-muted">Paused</div>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div className="flex items-center gap-3">
            <Send size={24} className="text-primary" />
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.summary.totalSent}
              </div>
              <div className="text-xs text-muted">Reports Sent</div>
            </div>
          </div>
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="card mb-4" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Create New Report</h4>
            <button
              onClick={() => setShowCreateForm(false)}
              className="btn btn-secondary btn-icon"
              style={{ width: '32px', height: '32px' }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Report name */}
            <div style={{ gridColumn: 'span 2' }}>
              <label className="text-xs text-muted block mb-1">Report Name</label>
              <input
                type="text"
                value={newReport.name}
                onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
                placeholder="e.g., Weekly Executive Summary"
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

            {/* Report type */}
            <div>
              <label className="text-xs text-muted block mb-1">Report Type</label>
              <select
                value={newReport.type}
                onChange={(e) => setNewReport({ ...newReport, type: e.target.value as ReportType })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              >
                {Object.entries(REPORT_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Frequency */}
            <div>
              <label className="text-xs text-muted block mb-1">Frequency</label>
              <select
                value={newReport.frequency}
                onChange={(e) => setNewReport({ ...newReport, frequency: e.target.value as ReportFrequency })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              >
                {Object.entries(FREQUENCY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Time */}
            <div>
              <label className="text-xs text-muted block mb-1">Send Time</label>
              <input
                type="time"
                value={newReport.scheduledTime}
                onChange={(e) => setNewReport({ ...newReport, scheduledTime: e.target.value })}
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

            {/* Facilities */}
            <div>
              <label className="text-xs text-muted block mb-1">Facilities</label>
              <select
                value={newReport.facilityIds === 'all' ? 'all' : 'selected'}
                onChange={(e) => setNewReport({
                  ...newReport,
                  facilityIds: e.target.value === 'all' ? 'all' : []
                })}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="all">All Facilities</option>
                <option value="selected">Select Specific</option>
              </select>
            </div>

            {/* Recipients */}
            <div style={{ gridColumn: 'span 2' }}>
              <label className="text-xs text-muted block mb-1">Recipients</label>
              <div className="space-y-2">
                {(newReport.recipients || []).map((email, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateRecipient(idx, e.target.value)}
                      placeholder="email@example.com"
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }}
                    />
                    {(newReport.recipients || []).length > 1 && (
                      <button
                        onClick={() => removeRecipient(idx)}
                        className="btn btn-secondary btn-icon"
                        style={{ width: '40px', height: '40px' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addRecipient}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <Plus size={12} style={{ marginRight: '4px' }} />
                  Add Recipient
                </button>
              </div>
            </div>

            {/* Options */}
            <div style={{ gridColumn: 'span 2' }}>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newReport.includeAlerts}
                    onChange={(e) => setNewReport({ ...newReport, includeAlerts: e.target.checked })}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Include alerts</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newReport.includeCharts}
                    onChange={(e) => setNewReport({ ...newReport, includeCharts: e.target.checked })}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Include charts</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => createReportMutation.mutate(newReport)}
              disabled={!newReport.name || createReportMutation.isPending}
              className="btn btn-primary"
            >
              {createReportMutation.isPending ? 'Creating...' : 'Create Report'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reports list */}
      {data.reports.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <Mail size={48} className="text-muted" style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p className="text-muted">No scheduled reports yet</p>
          <p className="text-sm text-muted mt-2">Create a report to start receiving automated updates</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.reports.map(report => {
            const typeConfig = REPORT_TYPE_CONFIG[report.type];
            const freqConfig = FREQUENCY_CONFIG[report.frequency];
            const isExpanded = expandedReport === report.id;
            const TypeIcon = typeConfig.icon;

            return (
              <div
                key={report.id}
                className="card"
                style={{
                  padding: 0,
                  opacity: report.isActive ? 1 : 0.7,
                  border: report.isActive ? undefined : '1px solid rgba(255, 165, 2, 0.3)'
                }}
              >
                <div
                  style={{ padding: '16px', cursor: 'pointer' }}
                  onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                >
                  <div className="flex items-center gap-4">
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: report.isActive
                        ? 'rgba(102, 126, 234, 0.2)'
                        : 'rgba(255, 165, 2, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <TypeIcon size={20} style={{
                        color: report.isActive ? '#667eea' : '#ffa502'
                      }} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                          {report.name}
                        </span>
                        <span className="badge badge-info" style={{ fontSize: '10px' }}>
                          {freqConfig.label}
                        </span>
                        {!report.isActive && (
                          <span className="badge badge-warning" style={{ fontSize: '10px' }}>
                            Paused
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {report.scheduledTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          Next: {formatNextScheduled(report.nextScheduled)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sendNowMutation.mutate(report.id);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        disabled={sendNowMutation.isPending}
                      >
                        <Send size={12} style={{ marginRight: '4px' }} />
                        Send Now
                      </button>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{
                    padding: '16px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.2)'
                  }}>
                    {/* Recipients */}
                    <div className="mb-4">
                      <h5 className="text-xs text-muted mb-2">Recipients</h5>
                      <div className="flex flex-wrap gap-2">
                        {report.recipients.map((email, idx) => (
                          <span key={idx} className="badge badge-info">{email}</span>
                        ))}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-muted">Type</div>
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {typeConfig.label}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">Facilities</div>
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {report.facilityIds === 'all' ? 'All' : `${report.facilityIds.length} selected`}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">Last Sent</div>
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {report.lastSent
                            ? new Date(report.lastSent).toLocaleDateString()
                            : 'Never'}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateReportMutation.mutate({
                          id: report.id,
                          updates: { isActive: !report.isActive }
                        })}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        {report.isActive ? (
                          <>
                            <Pause size={12} style={{ marginRight: '4px' }} />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play size={12} style={{ marginRight: '4px' }} />
                            Resume
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => deleteReportMutation.mutate(report.id)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px', color: '#ff4757' }}
                      >
                        <Trash2 size={12} style={{ marginRight: '4px' }} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
