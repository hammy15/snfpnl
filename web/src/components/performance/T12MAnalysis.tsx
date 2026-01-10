import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { T12MMetricCard } from './T12MMetricCard';
import { T12MTrendChart } from './T12MTrendChart';
import { SectionExplainer } from '../ui/InfoTooltip';
import './T12MAnalysis.css';

interface T12MAnalysisProps {
  facilityId: string;
  periodId: string;
}

interface T12MMetric {
  kpiId: string;
  label: string;
  format: string;
  stats: {
    current: number;
    average: number;
    min: { value: number; periodId: string; index: number };
    max: { value: number; periodId: string; index: number };
    stdDev: number;
    trend: {
      direction: 'improving' | 'declining' | 'stable';
      changePercent: number;
      slope: number;
      volatility: number;
    };
    momChange: number | null;
    yoyChange: number | null;
  };
  sparklineData: { period: string; value: number }[];
}

interface T12MData {
  facility: { facility_id: string; name: string; state: string; setting: string };
  periodRange: { start: string; end: string; startLabel: string; endLabel: string };
  summary: { improving: number; declining: number; stable: number; highVolatility: number };
  metrics: T12MMetric[];
  insights: Array<{
    id: string;
    type: 'opportunity' | 'warning' | 'pattern' | 'strength';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

async function fetchT12MData(facilityId: string, periodId: string): Promise<T12MData> {
  const res = await fetch(
    `https://snfpnl.onrender.com/api/performance/t12m/${facilityId}?periodId=${periodId}`
  );
  if (!res.ok) throw new Error('Failed to fetch T12M data');
  return res.json();
}

export function T12MAnalysis({ facilityId, periodId }: T12MAnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<T12MMetric | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['t12m', facilityId, periodId],
    queryFn: () => fetchT12MData(facilityId, periodId),
  });

  if (isLoading) {
    return (
      <div className="t12m-analysis loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="t12m-analysis error">
        Failed to load T12M analysis
      </div>
    );
  }

  const { summary, metrics, insights, periodRange } = data;

  return (
    <div className="t12m-analysis">
      <div className="t12m-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="t12m-title">
          <span className="collapse-icon">{isExpanded ? '▼' : '▶'}</span>
          <h3>Trailing 12-Month Performance</h3>
          <span className="period-range">{periodRange.startLabel} - {periodRange.endLabel}</span>
        </div>
        <div className="t12m-summary-badges">
          <span className="badge improving" title="Metrics improving">
            ↑ {summary.improving}
          </span>
          <span className="badge stable" title="Metrics stable">
            → {summary.stable}
          </span>
          <span className="badge declining" title="Metrics declining">
            ↓ {summary.declining}
          </span>
          {summary.highVolatility > 0 && (
            <span className="badge volatility" title="High volatility metrics">
              ⚡ {summary.highVolatility}
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="t12m-content">
          <SectionExplainer
            title="T12M Trend Analysis"
            subtitle="Performance patterns over the trailing year"
            explanation="This view shows how each key metric has performed over the past 12 months. Sparklines reveal trends at a glance - click any metric card to see the full trend chart with high/low points marked."
            tips={[
              "Green arrows indicate improving trends, red indicates decline",
              "Click any metric card to expand the detailed trend chart",
              "High volatility (⚡) metrics may need closer monitoring",
              "MoM shows month-over-month change, YoY shows year-over-year"
            ]}
          />

          {/* Insights Section */}
          {insights.length > 0 && (
            <div className="t12m-insights">
              <h4>Key Insights</h4>
              <div className="insights-grid">
                {insights.slice(0, 4).map(insight => (
                  <div key={insight.id} className={`insight-card ${insight.type} ${insight.priority}`}>
                    <div className="insight-header">
                      <span className={`insight-type ${insight.type}`}>
                        {insight.type === 'warning' && '⚠️'}
                        {insight.type === 'strength' && '💪'}
                        {insight.type === 'opportunity' && '🎯'}
                        {insight.type === 'pattern' && '📊'}
                      </span>
                      <span className="insight-title">{insight.title}</span>
                    </div>
                    <p className="insight-description">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="t12m-metrics-grid">
            {metrics.map(metric => (
              <T12MMetricCard
                key={metric.kpiId}
                metric={metric}
                isSelected={selectedMetric?.kpiId === metric.kpiId}
                onClick={() => setSelectedMetric(
                  selectedMetric?.kpiId === metric.kpiId ? null : metric
                )}
              />
            ))}
          </div>

          {/* Expanded Trend Chart */}
          {selectedMetric && (
            <T12MTrendChart
              metric={selectedMetric}
              onClose={() => setSelectedMetric(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
