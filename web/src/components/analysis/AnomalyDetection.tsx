import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertOctagon, ChevronDown, ChevronRight, Activity, Zap,
  TrendingUp, TrendingDown, Eye, EyeOff, Calendar
} from 'lucide-react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ZAxis, Cell, ReferenceLine
} from 'recharts';

interface Anomaly {
  id: string;
  facilityId: number;
  facilityName: string;
  kpiId: string;
  kpiName: string;
  periodId: string;
  value: number;
  expectedValue: number;
  deviation: number;
  zScore: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'spike' | 'drop' | 'trend_break' | 'outlier' | 'pattern_violation';
  description: string;
  confidence: number;
  acknowledged: boolean;
}

interface AnomalyStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byFacility: Record<string, number>;
  byKpi: Record<string, number>;
}

interface AnomalyDetectionProps {
  facilityId?: number;
  periodId: string;
}

const SEVERITY_CONFIG = {
  critical: { color: '#ff4757', bg: 'rgba(255, 71, 87, 0.15)', label: 'Critical' },
  high: { color: '#ff6b35', bg: 'rgba(255, 107, 53, 0.15)', label: 'High' },
  medium: { color: '#ffc107', bg: 'rgba(255, 193, 7, 0.15)', label: 'Medium' },
  low: { color: '#17a2b8', bg: 'rgba(23, 162, 184, 0.15)', label: 'Low' }
};

const TYPE_LABELS: Record<string, string> = {
  spike: 'Unexpected Spike',
  drop: 'Unexpected Drop',
  trend_break: 'Trend Break',
  outlier: 'Statistical Outlier',
  pattern_violation: 'Pattern Violation'
};

export function AnomalyDetection({ facilityId, periodId }: AnomalyDetectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

  const { data, isLoading, error } = useQuery<{ anomalies: Anomaly[]; stats: AnomalyStats }>({
    queryKey: ['anomaly-detection', facilityId, periodId],
    queryFn: async () => {
      const params = new URLSearchParams({ periodId });
      if (facilityId) params.append('facilityId', facilityId.toString());

      const response = await fetch(`https://snfpnl.onrender.com/api/anomaly-detection?${params}`);
      if (!response.ok) throw new Error('Failed to fetch anomalies');
      return response.json();
    },
  });

  const filteredAnomalies = (data?.anomalies || [])
    .filter(a => filterSeverity === 'all' || a.severity === filterSeverity)
    .filter(a => filterType === 'all' || a.type === filterType)
    .filter(a => showAcknowledged || !a.acknowledged)
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

  const formatValue = (value: number, kpiId: string) => {
    if (kpiId.includes('pct') || kpiId.includes('margin') || kpiId.includes('mix')) {
      return `${value.toFixed(1)}%`;
    }
    if (kpiId.includes('revenue') || kpiId.includes('cost') || kpiId.includes('ppd')) {
      return `$${value.toFixed(0)}`;
    }
    return value.toFixed(1);
  };

  const getDeviationColor = (deviation: number) => {
    if (Math.abs(deviation) >= 50) return 'var(--danger)';
    if (Math.abs(deviation) >= 25) return 'var(--warning)';
    return 'var(--primary)';
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Running anomaly detection...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '20px' }}>
        <div className="text-danger">Failed to load anomaly detection</div>
      </div>
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
          <AlertOctagon size={20} />
          Anomaly Detection Engine
          {data.stats.critical > 0 && (
            <span className="badge badge-danger">{data.stats.critical} critical</span>
          )}
          {data.stats.high > 0 && (
            <span className="badge badge-warning">{data.stats.high} high</span>
          )}
          <span className="badge badge-info">{data.stats.total} total</span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-5 mb-4">
            {(['critical', 'high', 'medium', 'low'] as const).map(severity => (
              <div
                key={severity}
                className="card"
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: filterSeverity === severity ? `2px solid ${SEVERITY_CONFIG[severity].color}` : undefined
                }}
                onClick={() => setFilterSeverity(filterSeverity === severity ? 'all' : severity)}
              >
                <div className="text-xs text-muted mb-1">{SEVERITY_CONFIG[severity].label}</div>
                <div className="text-2xl font-bold" style={{ color: SEVERITY_CONFIG[severity].color }}>
                  {data.stats[severity]}
                </div>
              </div>
            ))}
            <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="text-xs text-muted mb-1">Total Anomalies</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.stats.total}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="select"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="select"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                <option value="all">All Types</option>
                <option value="spike">Spikes</option>
                <option value="drop">Drops</option>
                <option value="trend_break">Trend Breaks</option>
                <option value="outlier">Outliers</option>
                <option value="pattern_violation">Pattern Violations</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAcknowledged}
                onChange={(e) => setShowAcknowledged(e.target.checked)}
              />
              {showAcknowledged ? <Eye size={14} /> : <EyeOff size={14} />}
              <span className="text-sm">Show acknowledged</span>
            </label>
          </div>

          {/* Scatter Plot Visualization */}
          <div className="card mb-4" style={{ padding: '20px' }}>
            <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Anomaly Distribution
            </h4>
            <div style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <XAxis
                    type="number"
                    dataKey="deviation"
                    name="Deviation %"
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                    label={{ value: 'Deviation %', position: 'bottom', fill: 'rgba(255,255,255,0.5)' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="confidence"
                    name="Confidence"
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                    label={{ value: 'Confidence %', angle: -90, position: 'left', fill: 'rgba(255,255,255,0.5)' }}
                  />
                  <ZAxis type="number" dataKey="zScore" range={[50, 400]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const anomaly = payload[0].payload as Anomaly;
                      return (
                        <div style={{
                          background: 'rgba(15, 15, 26, 0.98)',
                          border: `1px solid ${SEVERITY_CONFIG[anomaly.severity].color}`,
                          borderRadius: '8px',
                          padding: '12px',
                          maxWidth: '250px'
                        }}>
                          <div className="font-bold mb-1" style={{ color: SEVERITY_CONFIG[anomaly.severity].color }}>
                            {anomaly.facilityName}
                          </div>
                          <div className="text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
                            {anomaly.kpiName}
                          </div>
                          <div className="text-xs text-muted">{anomaly.description}</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />
                  <Scatter
                    data={filteredAnomalies}
                    onClick={(data) => setSelectedAnomaly(data as unknown as Anomaly)}
                    style={{ cursor: 'pointer' }}
                  >
                    {filteredAnomalies.map((anomaly, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={SEVERITY_CONFIG[anomaly.severity].color}
                        opacity={selectedAnomaly?.id === anomaly.id ? 1 : 0.7}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Anomalies List */}
          {filteredAnomalies.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <Activity size={40} style={{ margin: '0 auto', color: 'var(--success)', marginBottom: '12px' }} />
              <p className="text-muted">No anomalies detected matching your filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnomalies.map(anomaly => (
                <div
                  key={anomaly.id}
                  className="card"
                  style={{
                    padding: '16px',
                    borderLeft: `4px solid ${SEVERITY_CONFIG[anomaly.severity].color}`,
                    background: selectedAnomaly?.id === anomaly.id ? 'rgba(102, 126, 234, 0.1)' : undefined,
                    cursor: 'pointer',
                    opacity: anomaly.acknowledged ? 0.6 : 1
                  }}
                  onClick={() => setSelectedAnomaly(anomaly)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: SEVERITY_CONFIG[anomaly.severity].bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {anomaly.type === 'spike' && <TrendingUp size={20} style={{ color: SEVERITY_CONFIG[anomaly.severity].color }} />}
                        {anomaly.type === 'drop' && <TrendingDown size={20} style={{ color: SEVERITY_CONFIG[anomaly.severity].color }} />}
                        {(anomaly.type === 'trend_break' || anomaly.type === 'outlier' || anomaly.type === 'pattern_violation') && (
                          <Zap size={20} style={{ color: SEVERITY_CONFIG[anomaly.severity].color }} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                            {anomaly.facilityName}
                          </span>
                          <span className="badge" style={{
                            background: SEVERITY_CONFIG[anomaly.severity].bg,
                            color: SEVERITY_CONFIG[anomaly.severity].color,
                            fontSize: '10px'
                          }}>
                            {SEVERITY_CONFIG[anomaly.severity].label}
                          </span>
                          <span className="badge badge-secondary" style={{ fontSize: '10px' }}>
                            {TYPE_LABELS[anomaly.type]}
                          </span>
                        </div>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {anomaly.kpiName}: {formatValue(anomaly.value, anomaly.kpiId)}
                          <span className="text-muted"> (expected {formatValue(anomaly.expectedValue, anomaly.kpiId)})</span>
                        </div>
                        <p className="text-xs text-muted mt-1">{anomaly.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold" style={{ color: getDeviationColor(anomaly.deviation) }}>
                        {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted">deviation</div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted">
                        <Calendar size={10} />
                        {anomaly.periodId}
                      </div>
                    </div>
                  </div>

                  {/* Confidence meter */}
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted">Detection Confidence</span>
                      <span style={{ color: 'var(--primary)' }}>{anomaly.confidence.toFixed(0)}%</span>
                    </div>
                    <div style={{
                      height: '4px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${anomaly.confidence}%`,
                        background: 'var(--primary)',
                        borderRadius: '2px'
                      }} />
                    </div>
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
