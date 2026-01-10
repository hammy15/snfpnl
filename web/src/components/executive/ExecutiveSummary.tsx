import { useQuery } from '@tanstack/react-query';
import { FileText, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import { useState } from 'react';

interface ExecutiveSummaryResponse {
  facilityId: string;
  facilityName: string;
  period: string;
  summary: string;
  highlights: string[];
  concerns: string[];
  opportunities: string[];
  metrics: {
    margin: number | null;
    prevMargin: number | null;
    avgMargin: number | null;
  };
}

interface ExecutiveSummaryProps {
  facilityId: number;
  periodId: string;
}

export function ExecutiveSummary({ facilityId, periodId }: ExecutiveSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading, error } = useQuery<ExecutiveSummaryResponse>({
    queryKey: ['executive-summary', facilityId, periodId],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl.onrender.com/api/executive-summary/${facilityId}/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch executive summary');
      return response.json();
    },
  });

  const getHealthStatus = (margin: number | null) => {
    if (margin === null) return 'unknown';
    if (margin >= 15) return 'excellent';
    if (margin >= 10) return 'good';
    if (margin >= 5) return 'fair';
    if (margin >= 0) return 'poor';
    return 'critical';
  };

  const getHealthBadge = (health: string) => {
    const badges: Record<string, string> = {
      excellent: 'badge-success',
      good: 'badge-success',
      fair: 'badge-warning',
      poor: 'badge-danger',
      critical: 'badge-danger',
      unknown: 'badge-info',
    };
    return badges[health] || 'badge-info';
  };

  const getHealthColor = (health: string) => {
    const colors: Record<string, string> = {
      excellent: '#00d9a5',
      good: '#00d9a5',
      fair: '#f1c40f',
      poor: '#ff4757',
      critical: '#ff4757',
      unknown: '#667eea',
    };
    return colors[health] || '#667eea';
  };

  const formatPeriod = (periodId: string) => {
    const [year, month] = periodId.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
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
        <div className="error">Failed to load executive summary</div>
      </div>
    );
  }

  const health = getHealthStatus(data.metrics.margin);

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileText size={20} />
          Executive Summary
          <span className={`badge ${getHealthBadge(health)}`} style={{ marginLeft: '8px', textTransform: 'capitalize' }}>
            {health}
          </span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Headline */}
          <div className="card mb-4" style={{
            padding: '20px',
            borderLeft: `4px solid ${getHealthColor(health)}`,
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(0, 217, 165, 0.05))'
          }}>
            <p className="text-lg font-medium" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {data.summary}
            </p>
            <p className="text-sm text-muted mt-2">{formatPeriod(data.period)}</p>
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-3 mb-4">
            <div className="card" style={{ padding: '16px' }}>
              <div className="text-xs text-muted mb-1">Operating Margin</div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.metrics.margin !== null ? `${data.metrics.margin.toFixed(1)}%` : 'N/A'}
              </div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div className="text-xs text-muted mb-1">Previous Month</div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-secondary)' }}>
                {data.metrics.prevMargin !== null ? `${data.metrics.prevMargin.toFixed(1)}%` : 'N/A'}
              </div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div className="text-xs text-muted mb-1">Portfolio Average</div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-secondary)' }}>
                {data.metrics.avgMargin !== null ? `${data.metrics.avgMargin.toFixed(1)}%` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Highlights, Concerns, Opportunities */}
          <div className="grid grid-cols-3 mb-4">
            {/* Highlights */}
            <div className="card" style={{ padding: '16px' }}>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={18} className="text-success" />
                <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Highlights</h4>
              </div>
              {data.highlights.length > 0 ? (
                <ul className="space-y-2">
                  {data.highlights.map((highlight, idx) => (
                    <li key={idx} className="text-sm text-muted flex items-start gap-2">
                      <span style={{ color: 'var(--success)', marginTop: '4px' }}>•</span>
                      {highlight}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No highlights this period</p>
              )}
            </div>

            {/* Concerns */}
            <div className="card" style={{ padding: '16px' }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-warning" />
                <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Concerns</h4>
              </div>
              {data.concerns.length > 0 ? (
                <ul className="space-y-2">
                  {data.concerns.map((concern, idx) => (
                    <li key={idx} className="text-sm text-muted flex items-start gap-2">
                      <span style={{ color: 'var(--warning)', marginTop: '4px' }}>•</span>
                      {concern}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No concerns this period</p>
              )}
            </div>

            {/* Opportunities */}
            <div className="card" style={{ padding: '16px' }}>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={18} className="text-info" />
                <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Opportunities</h4>
              </div>
              {data.opportunities.length > 0 ? (
                <ul className="space-y-2">
                  {data.opportunities.map((opp, idx) => (
                    <li key={idx} className="text-sm text-muted flex items-start gap-2">
                      <span style={{ color: 'var(--primary)', marginTop: '4px' }}>•</span>
                      {opp}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No specific opportunities identified</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
