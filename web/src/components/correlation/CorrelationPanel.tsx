import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CorrelationScatterPlot } from './CorrelationScatterPlot';
import { CorrelationInsights } from './CorrelationInsights';
import { SectionExplainer } from '../ui/InfoTooltip';
import './CorrelationPanel.css';

interface CorrelationPanelProps {
  facilityId: string;
  periodId: string;
}

interface CorrelationData {
  xKpi: string;
  yKpi: string;
  xLabel: string;
  yLabel: string;
  businessQuestion: string;
  correlation: {
    r: number;
    strength: 'strong' | 'moderate' | 'weak' | 'none';
    direction: 'positive' | 'negative' | 'none';
    dataPoints: number;
  };
  scatterData: { x: number; y: number; period: string }[];
}

interface CorrelationsResponse {
  facility: { facility_id: string; name: string; state: string; setting: string };
  periodRange: { start: string; end: string; startLabel: string; endLabel: string };
  correlations: CorrelationData[];
  insights: Array<{
    id: string;
    type: 'opportunity' | 'warning' | 'pattern' | 'strength';
    title: string;
    description: string;
    relatedKpis: string[];
    priority: 'high' | 'medium' | 'low';
    actionable: boolean;
  }>;
}

async function fetchCorrelations(facilityId: string, periodId: string): Promise<CorrelationsResponse> {
  const res = await fetch(
    `http://localhost:3002/api/performance/correlations/${facilityId}?periodId=${periodId}`
  );
  if (!res.ok) throw new Error('Failed to fetch correlations');
  return res.json();
}

export function CorrelationPanel({ facilityId, periodId }: CorrelationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['correlations', facilityId, periodId],
    queryFn: () => fetchCorrelations(facilityId, periodId),
  });

  if (isLoading) {
    return (
      <div className="correlation-panel loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="correlation-panel error">
        Failed to load correlation analysis
      </div>
    );
  }

  const { correlations, insights, periodRange } = data;
  const strongCorrelations = correlations.filter(c => c.correlation.strength === 'strong' || c.correlation.strength === 'moderate');

  return (
    <div className="correlation-panel">
      <div className="correlation-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="correlation-title">
          <span className="collapse-icon">{isExpanded ? '▼' : '▶'}</span>
          <h3>Performance Correlations</h3>
          <span className="period-range">{periodRange.startLabel} - {periodRange.endLabel}</span>
        </div>
        <div className="correlation-summary">
          <span className="summary-item">
            {strongCorrelations.length} significant relationships found
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="correlation-content">
          <SectionExplainer
            title="Correlation Analysis"
            subtitle="Understanding metric relationships"
            explanation="This analysis shows how different metrics relate to each other for this facility. Strong correlations reveal operational patterns - for example, how skilled mix impacts revenue or how contract labor affects margins."
            tips={[
              "r values near +1 or -1 indicate strong relationships",
              "Negative correlations (red) mean metrics move in opposite directions",
              "Use insights to identify actionable improvement opportunities",
              "Scatter plots show the actual data points behind each correlation"
            ]}
          />

          {/* Insights Section */}
          {insights.length > 0 && (
            <CorrelationInsights insights={insights} />
          )}

          {/* Correlation Cards Grid */}
          <div className="correlations-grid">
            {correlations.map((corr, idx) => (
              <div key={idx} className={`correlation-card ${corr.correlation.strength}`}>
                <div className="correlation-card-header">
                  <span className="correlation-question">{corr.businessQuestion}</span>
                  <span className={`correlation-badge ${corr.correlation.direction}`}>
                    r = {corr.correlation.r.toFixed(2)}
                  </span>
                </div>
                <div className="correlation-card-labels">
                  <span className="x-label">{corr.xLabel}</span>
                  <span className="arrow">→</span>
                  <span className="y-label">{corr.yLabel}</span>
                </div>
                <div className="correlation-strength">
                  <span className={`strength-indicator ${corr.correlation.strength}`}>
                    {corr.correlation.strength} {corr.correlation.direction}
                  </span>
                  <span className="data-points">{corr.correlation.dataPoints} data points</span>
                </div>
                <CorrelationScatterPlot
                  data={corr.scatterData}
                  xLabel={corr.xLabel}
                  yLabel={corr.yLabel}
                  correlation={corr.correlation}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
