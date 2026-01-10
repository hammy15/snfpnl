import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  AlertTriangle, TrendingDown, Clock, Zap,
  ChevronDown, ChevronRight, Bell, BellOff, Filter, RefreshCw,
  ArrowRight, Brain, Activity, ShieldAlert, Lightbulb
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

type AlertType = 'anomaly' | 'trend' | 'forecast' | 'threshold' | 'correlation' | 'opportunity';
type AlertSeverity = 'critical' | 'warning' | 'info' | 'opportunity';

interface SmartAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  facilityId: string;
  facilityName: string;
  kpiId: string;
  kpiName: string;
  title: string;
  description: string;
  value: number;
  expectedValue?: number;
  threshold?: number;
  confidence: number;
  detectedAt: string;
  historicalData?: Array<{ period: string; value: number; predicted?: number }>;
  relatedKpis?: string[];
  suggestedActions?: string[];
  isAcknowledged?: boolean;
}

interface SmartAlertsResponse {
  alerts: SmartAlert[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    opportunity: number;
  };
  lastUpdated: string;
}

interface SmartAlertsProps {
  periodId?: string;
  facilityId?: string;
  onFacilityClick?: (facilityId: string) => void;
}

const ALERT_CONFIG: Record<AlertType, { icon: typeof AlertTriangle; color: string; label: string }> = {
  anomaly: { icon: Zap, color: '#ff4757', label: 'Anomaly Detected' },
  trend: { icon: TrendingDown, color: '#ffa502', label: 'Trend Alert' },
  forecast: { icon: Brain, color: '#a55eea', label: 'Forecast Warning' },
  threshold: { icon: ShieldAlert, color: '#ff6b6b', label: 'Threshold Breach' },
  correlation: { icon: Activity, color: '#667eea', label: 'Correlation Found' },
  opportunity: { icon: Lightbulb, color: '#00d9a5', label: 'Opportunity' }
};

const SEVERITY_CONFIG: Record<AlertSeverity, { bg: string; border: string; text: string }> = {
  critical: { bg: 'rgba(255, 71, 87, 0.15)', border: 'rgba(255, 71, 87, 0.5)', text: '#ff4757' },
  warning: { bg: 'rgba(255, 165, 2, 0.15)', border: 'rgba(255, 165, 2, 0.5)', text: '#ffa502' },
  info: { bg: 'rgba(102, 126, 234, 0.15)', border: 'rgba(102, 126, 234, 0.5)', text: '#667eea' },
  opportunity: { bg: 'rgba(0, 217, 165, 0.15)', border: 'rgba(0, 217, 165, 0.5)', text: '#00d9a5' }
};

export function SmartAlerts({ periodId, facilityId, onFacilityClick }: SmartAlertsProps) {
  const [filterType, setFilterType] = useState<AlertType | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'all'>('all');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());

  const { data, isLoading, error, refetch } = useQuery<SmartAlertsResponse>({
    queryKey: ['smart-alerts', periodId, facilityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (periodId) params.append('periodId', periodId);
      if (facilityId) params.append('facilityId', facilityId);

      const response = await fetch(`https://snfpnl-production.up.railway.app/api/smart-alerts?${params}`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const toggleAcknowledge = (alertId: string) => {
    setAcknowledgedAlerts(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  const filteredAlerts = data?.alerts.filter(alert => {
    if (filterType !== 'all' && alert.type !== filterType) return false;
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (!showAcknowledged && acknowledgedAlerts.has(alert.id)) return false;
    return true;
  }) || [];

  const formatValue = (value: number, kpiId: string) => {
    if (kpiId.includes('pct') || kpiId.includes('margin') || kpiId.includes('mix') || kpiId.includes('occupancy')) {
      return `${value.toFixed(1)}%`;
    }
    if (kpiId.includes('revenue') || kpiId.includes('cost') || kpiId.includes('ppd')) {
      return `$${value.toFixed(0)}`;
    }
    return value.toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Analyzing patterns and detecting anomalies...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <AlertTriangle size={48} className="text-danger" style={{ margin: '0 auto 16px' }} />
        <p className="text-danger">Failed to load smart alerts</p>
      </div>
    );
  }

  return (
    <div className="smart-alerts">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 mb-4">
        <div
          className="card"
          style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(255, 71, 87, 0.2), rgba(255, 71, 87, 0.05))',
            cursor: filterSeverity === 'critical' ? 'default' : 'pointer',
            border: filterSeverity === 'critical' ? '2px solid rgba(255, 71, 87, 0.5)' : undefined
          }}
          onClick={() => setFilterSeverity(filterSeverity === 'critical' ? 'all' : 'critical')}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} style={{ color: '#ff4757' }} />
            <div>
              <div className="text-2xl font-bold" style={{ color: '#ff4757' }}>{data.summary.critical}</div>
              <div className="text-xs text-muted">Critical Alerts</div>
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(255, 165, 2, 0.2), rgba(255, 165, 2, 0.05))',
            cursor: filterSeverity === 'warning' ? 'default' : 'pointer',
            border: filterSeverity === 'warning' ? '2px solid rgba(255, 165, 2, 0.5)' : undefined
          }}
          onClick={() => setFilterSeverity(filterSeverity === 'warning' ? 'all' : 'warning')}
        >
          <div className="flex items-center gap-3">
            <Clock size={24} style={{ color: '#ffa502' }} />
            <div>
              <div className="text-2xl font-bold" style={{ color: '#ffa502' }}>{data.summary.warning}</div>
              <div className="text-xs text-muted">Warnings</div>
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(102, 126, 234, 0.05))',
            cursor: filterSeverity === 'info' ? 'default' : 'pointer',
            border: filterSeverity === 'info' ? '2px solid rgba(102, 126, 234, 0.5)' : undefined
          }}
          onClick={() => setFilterSeverity(filterSeverity === 'info' ? 'all' : 'info')}
        >
          <div className="flex items-center gap-3">
            <Brain size={24} style={{ color: '#667eea' }} />
            <div>
              <div className="text-2xl font-bold" style={{ color: '#667eea' }}>{data.summary.info}</div>
              <div className="text-xs text-muted">Insights</div>
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(0, 217, 165, 0.2), rgba(0, 217, 165, 0.05))',
            cursor: filterSeverity === 'opportunity' ? 'default' : 'pointer',
            border: filterSeverity === 'opportunity' ? '2px solid rgba(0, 217, 165, 0.5)' : undefined
          }}
          onClick={() => setFilterSeverity(filterSeverity === 'opportunity' ? 'all' : 'opportunity')}
        >
          <div className="flex items-center gap-3">
            <Lightbulb size={24} style={{ color: '#00d9a5' }} />
            <div>
              <div className="text-2xl font-bold" style={{ color: '#00d9a5' }}>{data.summary.opportunity}</div>
              <div className="text-xs text-muted">Opportunities</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4" style={{ padding: '16px' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-muted" />
              <span className="text-sm text-muted">Type:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as AlertType | 'all')}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              >
                <option value="all">All Types</option>
                <option value="anomaly">Anomalies</option>
                <option value="trend">Trends</option>
                <option value="forecast">Forecasts</option>
                <option value="threshold">Thresholds</option>
                <option value="correlation">Correlations</option>
                <option value="opportunity">Opportunities</option>
              </select>
            </div>

            <button
              className={`btn ${showAcknowledged ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowAcknowledged(!showAcknowledged)}
              style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {showAcknowledged ? <Bell size={14} /> : <BellOff size={14} />}
              {showAcknowledged ? 'Showing All' : 'Hide Acknowledged'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">
              {filteredAlerts.length} alerts • Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
            </span>
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => refetch()}
              style={{ width: '32px', height: '32px' }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <Bell size={48} className="text-muted" style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p className="text-muted">No alerts matching your filters</p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const alertConfig = ALERT_CONFIG[alert.type];
            const severityConfig = SEVERITY_CONFIG[alert.severity];
            const isExpanded = expandedAlert === alert.id;
            const isAcknowledged = acknowledgedAlerts.has(alert.id);
            const Icon = alertConfig.icon;

            return (
              <div
                key={alert.id}
                className="card"
                style={{
                  padding: 0,
                  background: severityConfig.bg,
                  border: `1px solid ${severityConfig.border}`,
                  opacity: isAcknowledged ? 0.6 : 1
                }}
              >
                {/* Alert Header */}
                <div
                  style={{ padding: '16px', cursor: 'pointer' }}
                  onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                >
                  <div className="flex items-start gap-4">
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: `${alertConfig.color}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon size={20} style={{ color: alertConfig.color }} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge" style={{
                          background: `${alertConfig.color}22`,
                          color: alertConfig.color,
                          fontSize: '10px'
                        }}>
                          {alertConfig.label}
                        </span>
                        <span className="badge" style={{
                          background: 'rgba(255,255,255,0.1)',
                          fontSize: '10px'
                        }}>
                          {(alert.confidence * 100).toFixed(0)}% confidence
                        </span>
                        {isAcknowledged && (
                          <span className="badge badge-info" style={{ fontSize: '10px' }}>
                            Acknowledged
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold" style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {alert.title}
                      </h4>

                      <p className="text-sm text-muted">{alert.description}</p>

                      <div className="flex items-center gap-4 mt-2">
                        <button
                          className="text-sm flex items-center gap-1"
                          style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onFacilityClick?.(alert.facilityId);
                          }}
                        >
                          {alert.facilityName}
                          <ArrowRight size={12} />
                        </button>
                        <span className="text-xs text-muted">
                          {new Date(alert.detectedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs text-muted">{alert.kpiName}</div>
                        <div className="font-bold" style={{ color: severityConfig.text, fontSize: '18px' }}>
                          {formatValue(alert.value, alert.kpiId)}
                        </div>
                        {alert.expectedValue !== undefined && (
                          <div className="text-xs text-muted">
                            Expected: {formatValue(alert.expectedValue, alert.kpiId)}
                          </div>
                        )}
                      </div>
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{
                    padding: '16px',
                    borderTop: `1px solid ${severityConfig.border}`,
                    background: 'rgba(0,0,0,0.2)'
                  }}>
                    {/* Chart */}
                    {alert.historicalData && alert.historicalData.length > 0 && (
                      <div style={{ height: '200px', marginBottom: '16px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={alert.historicalData}>
                            <XAxis
                              dataKey="period"
                              stroke="rgba(255,255,255,0.5)"
                              tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10 }}
                            />
                            <YAxis
                              stroke="rgba(255,255,255,0.5)"
                              tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10 }}
                            />
                            <Tooltip
                              contentStyle={{
                                background: 'rgba(15,15,26,0.95)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '8px'
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke={alertConfig.color}
                              strokeWidth={2}
                              dot={{ fill: alertConfig.color, strokeWidth: 0, r: 3 }}
                            />
                            {alert.historicalData.some(d => d.predicted !== undefined) && (
                              <Line
                                type="monotone"
                                dataKey="predicted"
                                stroke={alertConfig.color}
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                              />
                            )}
                            {alert.threshold !== undefined && (
                              <ReferenceLine
                                y={alert.threshold}
                                stroke="#ff4757"
                                strokeDasharray="3 3"
                                label={{ value: 'Threshold', fill: '#ff4757', fontSize: 10 }}
                              />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Suggested Actions */}
                    {alert.suggestedActions && alert.suggestedActions.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                          Suggested Actions
                        </h5>
                        <ul style={{ paddingLeft: '20px' }}>
                          {alert.suggestedActions.map((action, idx) => (
                            <li key={idx} className="text-sm text-muted mb-1">
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Related KPIs */}
                    {alert.relatedKpis && alert.relatedKpis.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                          Related Metrics
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {alert.relatedKpis.map((kpi, idx) => (
                            <span key={idx} className="badge badge-info">{kpi}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        className={`btn ${isAcknowledged ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => toggleAcknowledge(alert.id)}
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                      >
                        {isAcknowledged ? 'Unacknowledge' : 'Acknowledge'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => onFacilityClick?.(alert.facilityId)}
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                      >
                        View Facility
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
