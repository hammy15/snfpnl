import { useState } from 'react';
import { Database, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import './DataQualityIndicator.css';

interface DataQualityProps {
  facilityId?: string;
  periodId: string;
  compact?: boolean;
}

interface QualityMetric {
  kpi: string;
  label: string;
  hasData: boolean;
  value: number | null;
  lastUpdated: string;
}

// Mock data quality information
const getQualityMetrics = (periodId: string): QualityMetric[] => [
  { kpi: 'snf_total_revenue_ppd', label: 'Revenue PPD', hasData: true, value: 425.50, lastUpdated: periodId },
  { kpi: 'snf_total_cost_ppd', label: 'Cost PPD', hasData: true, value: 392.30, lastUpdated: periodId },
  { kpi: 'snf_operating_margin_pct', label: 'Operating Margin', hasData: true, value: 8.2, lastUpdated: periodId },
  { kpi: 'snf_skilled_mix_pct', label: 'Skilled Mix', hasData: true, value: 24.5, lastUpdated: periodId },
  { kpi: 'snf_nursing_cost_ppd', label: 'Nursing Cost PPD', hasData: true, value: 185.20, lastUpdated: periodId },
  { kpi: 'snf_contract_labor_pct_nursing', label: 'Contract Labor %', hasData: true, value: 12.5, lastUpdated: periodId },
  { kpi: 'snf_occupancy_pct', label: 'Occupancy', hasData: false, value: null, lastUpdated: '' },
  { kpi: 'snf_therapy_cost_ppd', label: 'Therapy Cost PPD', hasData: false, value: null, lastUpdated: '' },
];

export function DataQualityIndicator({ periodId, compact = false }: DataQualityProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const metrics = getQualityMetrics(periodId);
  const totalMetrics = metrics.length;
  const availableMetrics = metrics.filter(m => m.hasData).length;
  const completeness = Math.round((availableMetrics / totalMetrics) * 100);

  const getStatusColor = () => {
    if (completeness >= 90) return 'var(--success)';
    if (completeness >= 70) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getStatusIcon = () => {
    if (completeness >= 90) return <CheckCircle size={14} />;
    if (completeness >= 70) return <AlertTriangle size={14} />;
    return <XCircle size={14} />;
  };

  if (compact) {
    return (
      <div className="data-quality-compact" title={`Data completeness: ${completeness}%`}>
        <Database size={14} />
        <span style={{ color: getStatusColor() }}>{completeness}%</span>
      </div>
    );
  }

  return (
    <div className="data-quality-indicator">
      <button
        className="quality-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="quality-summary">
          <Database size={16} />
          <span className="quality-label">Data Quality</span>
          <span className="quality-badge" style={{ background: getStatusColor() }}>
            {getStatusIcon()}
            {completeness}%
          </span>
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="quality-details">
          <div className="quality-stats">
            <div className="stat">
              <span className="stat-value">{availableMetrics}</span>
              <span className="stat-label">Available</span>
            </div>
            <div className="stat">
              <span className="stat-value">{totalMetrics - availableMetrics}</span>
              <span className="stat-label">Missing</span>
            </div>
            <div className="stat">
              <span className="stat-value">{totalMetrics}</span>
              <span className="stat-label">Total KPIs</span>
            </div>
          </div>

          <div className="quality-bar">
            <div
              className="quality-fill"
              style={{
                width: `${completeness}%`,
                background: getStatusColor()
              }}
            />
          </div>

          <div className="metrics-list">
            {metrics.map(metric => (
              <div
                key={metric.kpi}
                className={`metric-item ${metric.hasData ? 'available' : 'missing'}`}
              >
                <span className="metric-status">
                  {metric.hasData ? (
                    <CheckCircle size={12} style={{ color: 'var(--success)' }} />
                  ) : (
                    <XCircle size={12} style={{ color: 'var(--danger)' }} />
                  )}
                </span>
                <span className="metric-name">{metric.label}</span>
                {metric.hasData && (
                  <span className="metric-value">
                    {typeof metric.value === 'number'
                      ? metric.kpi.includes('pct') || metric.kpi.includes('margin') || metric.kpi.includes('mix')
                        ? `${metric.value.toFixed(1)}%`
                        : `$${metric.value.toFixed(0)}`
                      : '--'}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="quality-note">
            <Info size={12} />
            <span>Data as of {formatPeriod(periodId)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatPeriod(periodId: string): string {
  const [year, month] = periodId.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}
