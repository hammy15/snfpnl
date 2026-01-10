interface Insight {
  id: string;
  type: 'opportunity' | 'warning' | 'pattern' | 'strength';
  title: string;
  description: string;
  relatedKpis: string[];
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}

interface CorrelationInsightsProps {
  insights: Insight[];
}

export function CorrelationInsights({ insights }: CorrelationInsightsProps) {
  if (insights.length === 0) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'strength': return '💪';
      case 'opportunity': return '🎯';
      case 'pattern': return '📊';
      default: return '📌';
    }
  };

  return (
    <div className="correlation-insights">
      <h4>Key Relationship Insights</h4>
      <div className="insights-list">
        {insights.map(insight => (
          <div key={insight.id} className={`insight-item ${insight.type} ${insight.priority}`}>
            <div className="insight-icon">{getTypeIcon(insight.type)}</div>
            <div className="insight-content">
              <div className="insight-header">
                <span className="insight-title">{insight.title}</span>
                {insight.actionable && (
                  <span className="actionable-badge">Actionable</span>
                )}
              </div>
              <p className="insight-description">{insight.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
