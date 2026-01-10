import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bell, AlertTriangle, AlertCircle, Info, CheckCircle,
  TrendingUp, DollarSign, Users, Activity,
  X, Filter, ChevronRight
} from 'lucide-react';
import { SectionExplainer } from './ui/InfoTooltip';
import { NarrativeReport } from './NarrativeReport';
import './AlertsDashboard.css';

interface AlertsDashboardProps {
  periodId: string;
  onFacilitySelect: (facilityId: string) => void;
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  category: 'margin' | 'cost' | 'revenue' | 'quality' | 'staffing';
  facility_id: string;
  facility_name: string;
  state: string;
  title: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
}

// Fetch alerts from real API
async function fetchAlerts(periodId: string): Promise<Alert[]> {
  const res = await fetch(`https://snfpnl-production.up.railway.app/api/portfolio-alerts/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

const CATEGORY_ICONS = {
  margin: Activity,
  cost: DollarSign,
  revenue: TrendingUp,
  quality: CheckCircle,
  staffing: Users,
};

const TYPE_CONFIG = {
  critical: { icon: AlertCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  info: { icon: Info, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  success: { icon: CheckCircle, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
};

export function AlertsDashboard({ periodId, onFacilitySelect }: AlertsDashboardProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['portfolio-alerts', periodId],
    queryFn: () => fetchAlerts(periodId),
  });

  const filteredAlerts = alerts
    .filter(a => filterType === 'all' || a.type === filterType)
    .filter(a => filterCategory === 'all' || a.category === filterCategory)
    .filter(a => showAcknowledged || !a.acknowledged && !acknowledgedIds.has(a.id))
    .sort((a, b) => {
      const priority = { critical: 0, warning: 1, info: 2, success: 3 };
      return priority[a.type] - priority[b.type];
    });

  const alertCounts = {
    critical: alerts.filter(a => a.type === 'critical' && !a.acknowledged).length,
    warning: alerts.filter(a => a.type === 'warning' && !a.acknowledged).length,
    info: alerts.filter(a => a.type === 'info' && !a.acknowledged).length,
    success: alerts.filter(a => a.type === 'success' && !a.acknowledged).length,
  };

  const handleAcknowledge = (alertId: string) => {
    setAcknowledgedIds(prev => new Set([...prev, alertId]));
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="alerts-dashboard animate-fade-in">
      <SectionExplainer
        title="Alerts Dashboard"
        subtitle="Threshold-based monitoring and notifications"
        explanation="Monitor your portfolio against predefined thresholds. Critical alerts require immediate action (negative margins, extreme values). Warning alerts indicate approaching thresholds. Success alerts celebrate wins."
        tips={[
          "Red/Critical = immediate action needed, typically margin or severe cost issues",
          "Yellow/Warning = approaching threshold, investigate and plan interventions",
          "Use filters to focus on specific categories (margin, staffing, cost, revenue)",
          "Click any alert to navigate directly to that facility's detail page"
        ]}
        reviewSuggestions={[
          "Address critical alerts first - they're usually costing money daily",
          "Look for patterns in warnings (same facility, same category repeatedly)",
          "Acknowledge alerts after creating action plans to clear your view",
          "Celebrate success alerts - share wins with the team"
        ]}
      />
      <div className="alerts-header">
        <div className="header-title">
          <Bell size={24} />
          <div>
            <h2>Alerts & Notifications</h2>
            <p className="text-muted">Monitor critical thresholds and performance issues</p>
          </div>
        </div>

        <div className="alerts-controls">
          <div className="filter-group">
            <Filter size={16} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="margin">Margin</option>
              <option value="cost">Cost</option>
              <option value="revenue">Revenue</option>
              <option value="staffing">Staffing</option>
            </select>
          </div>
          <label className="show-acknowledged">
            <input
              type="checkbox"
              checked={showAcknowledged}
              onChange={(e) => setShowAcknowledged(e.target.checked)}
            />
            Show acknowledged
          </label>
        </div>
      </div>

      {/* Alert Summary */}
      <div className="alert-summary">
        {Object.entries(alertCounts).map(([type, count]) => {
          const config = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
          return (
            <div
              key={type}
              className={`summary-badge ${filterType === type ? 'active' : ''}`}
              style={{ '--badge-color': config.color, '--badge-bg': config.bg } as React.CSSProperties}
              onClick={() => setFilterType(filterType === type ? 'all' : type)}
            >
              <config.icon size={16} />
              <span className="count">{count}</span>
              <span className="label">{type}</span>
            </div>
          );
        })}
      </div>

      {/* Alerts List */}
      <div className="alerts-list">
        {filteredAlerts.length === 0 ? (
          <div className="empty-alerts">
            <CheckCircle size={48} />
            <h3>No alerts to show</h3>
            <p>All facilities are performing within normal thresholds</p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const typeConfig = TYPE_CONFIG[alert.type];
            const CategoryIcon = CATEGORY_ICONS[alert.category];
            const TypeIcon = typeConfig.icon;

            return (
              <div
                key={alert.id}
                className={`alert-card ${alert.type}`}
                style={{ '--alert-color': typeConfig.color, '--alert-bg': typeConfig.bg } as React.CSSProperties}
              >
                <div className="alert-icon">
                  <TypeIcon size={20} />
                </div>

                <div className="alert-content">
                  <div className="alert-header">
                    <div className="alert-title">
                      <span className="title">{alert.title}</span>
                      <span className="facility" onClick={() => onFacilitySelect(alert.facility_id)}>
                        {alert.facility_name} <ChevronRight size={14} />
                      </span>
                    </div>
                    <div className="alert-meta">
                      <span className="category">
                        <CategoryIcon size={12} />
                        {alert.category}
                      </span>
                      <span className="state">{alert.state}</span>
                    </div>
                  </div>

                  <p className="alert-message">{alert.message}</p>

                  <div className="alert-footer">
                    <div className="alert-values">
                      <span className="current">
                        Current: <strong style={{ color: typeConfig.color }}>
                          {alert.value.toFixed(1)}{alert.category === 'margin' || alert.category === 'staffing' ? '%' : ''}
                        </strong>
                      </span>
                      <span className="threshold">
                        Threshold: {alert.threshold}{alert.category === 'margin' || alert.category === 'staffing' ? '%' : ''}
                      </span>
                    </div>
                    {!alert.acknowledged && !acknowledgedIds.has(alert.id) && (
                      <button
                        className="acknowledge-btn"
                        onClick={() => handleAcknowledge(alert.id)}
                      >
                        <X size={14} />
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Narrative Report Section */}
      <NarrativeReport
        context="alerts"
        periodId={periodId}
        title="Alerts Analysis Narrative"
      />
    </div>
  );
}
