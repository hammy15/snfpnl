import { useQuery } from '@tanstack/react-query';
import { Bell, AlertTriangle, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface Alert {
  kpiId: string;
  kpiName: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
}

interface AlertsResponse {
  facilityId: string;
  periodId: string;
  alerts: Alert[];
}

interface ThresholdAlertsProps {
  facilityId: number;
  periodId: string;
}

export function ThresholdAlerts({ facilityId, periodId }: ThresholdAlertsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading, error } = useQuery<AlertsResponse>({
    queryKey: ['alerts', facilityId, periodId],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl.onrender.com/api/alerts/${facilityId}/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
  });

  const formatValue = (value: number, kpiId: string) => {
    if (kpiId.includes('pct') || kpiId.includes('mix') || kpiId.includes('margin') || kpiId.includes('occupancy')) {
      return `${value.toFixed(1)}%`;
    }
    if (kpiId.includes('revenue') || kpiId.includes('cost') || kpiId.includes('ppd') || kpiId.includes('psd')) {
      return `$${value.toFixed(2)}`;
    }
    return value.toFixed(2);
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
        <div className="error">Failed to load alerts</div>
      </div>
    );
  }

  const criticalCount = data.alerts.filter(a => a.severity === 'critical').length;
  const warningCount = data.alerts.filter(a => a.severity === 'warning').length;

  if (data.alerts.length === 0) {
    return (
      <section className="kpi-section">
        <button
          className="section-title"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Bell size={20} />
            Threshold Alerts
            <span className="badge badge-success" style={{ marginLeft: '8px' }}>
              All Clear
            </span>
          </span>
          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>

        {isExpanded && (
          <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
            <div className="text-success mb-2" style={{ fontSize: '32px' }}>✓</div>
            <p className="text-muted">All metrics are within acceptable thresholds</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Bell size={20} />
          Threshold Alerts
          {criticalCount > 0 && (
            <span className="badge badge-danger" style={{ marginLeft: '8px' }}>
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="badge badge-warning">
              {warningCount} Warning
            </span>
          )}
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <div className="space-y-3">
          {data.alerts.map((alert, idx) => (
            <div
              key={idx}
              className="card"
              style={{
                padding: '16px',
                borderLeft: `4px solid ${alert.severity === 'critical' ? 'var(--danger)' : 'var(--warning)'}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {alert.severity === 'critical' ? (
                    <AlertCircle size={20} className="text-danger" />
                  ) : (
                    <AlertTriangle size={20} className="text-warning" />
                  )}
                  <div>
                    <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {alert.kpiName}
                    </h4>
                    <p className="text-sm text-muted">
                      {alert.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold" style={{ color: alert.severity === 'critical' ? 'var(--danger)' : 'var(--warning)' }}>
                      {formatValue(alert.value, alert.kpiId)}
                    </div>
                    <div className="text-xs text-muted">
                      Threshold: {formatValue(alert.threshold, alert.kpiId)}
                    </div>
                  </div>

                  {/* Deviation indicator */}
                  <div style={{ width: '80px' }}>
                    <div style={{
                      height: '6px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(Math.abs((alert.value - alert.threshold) / alert.threshold) * 100, 100)}%`,
                        background: alert.severity === 'critical' ? 'var(--danger)' : 'var(--warning)',
                        borderRadius: '3px'
                      }} />
                    </div>
                    <div className="text-xs text-muted mt-1 text-center">
                      {((alert.value - alert.threshold) / alert.threshold * 100).toFixed(0)}% off
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
