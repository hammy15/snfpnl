import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, Send, ChevronDown, ChevronRight, Lightbulb, TrendingUp,
  TrendingDown, AlertTriangle, Target, RefreshCw, ThumbsUp, ThumbsDown,
  Copy, Check, Zap
} from 'lucide-react';

interface Insight {
  id: string;
  type: 'opportunity' | 'warning' | 'trend' | 'recommendation' | 'benchmark';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  relatedKpis: string[];
  actionItems?: string[];
  dataPoints?: Array<{ label: string; value: string; trend?: 'up' | 'down' | 'stable' }>;
}

interface SuggestedQuestion {
  text: string;
  category: 'performance' | 'cost' | 'revenue' | 'operations' | 'comparison';
}

interface AIInsightsAssistantProps {
  facilityId: number;
  periodId: string;
}

const INSIGHT_CONFIG = {
  opportunity: { icon: Lightbulb, color: 'var(--success)', bg: 'rgba(0, 217, 165, 0.1)' },
  warning: { icon: AlertTriangle, color: 'var(--danger)', bg: 'rgba(255, 71, 87, 0.1)' },
  trend: { icon: TrendingUp, color: 'var(--primary)', bg: 'rgba(102, 126, 234, 0.1)' },
  recommendation: { icon: Target, color: 'var(--warning)', bg: 'rgba(255, 193, 7, 0.1)' },
  benchmark: { icon: Zap, color: '#17a2b8', bg: 'rgba(23, 162, 184, 0.1)' }
};

export function AIInsightsAssistant({ facilityId, periodId }: AIInsightsAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [query, setQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [conversation, setConversation] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery<{ insights: Insight[]; suggestions: SuggestedQuestion[] }>({
    queryKey: ['ai-insights', facilityId, periodId],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl.onrender.com/api/ai-insights/${facilityId}/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch AI insights');
      return response.json();
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const askQuestion = async (questionText?: string) => {
    const q = questionText || query;
    if (!q.trim()) return;

    setConversation(prev => [...prev, { role: 'user', content: q }]);
    setQuery('');
    setIsAsking(true);

    try {
      const response = await fetch('https://snfpnl.onrender.com/api/ai-insights/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, facilityId, periodId })
      });

      if (!response.ok) throw new Error('Failed to get AI response');
      const data = await response.json();
      setConversation(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch {
      setConversation(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your question. Please try again.'
      }]);
    } finally {
      setIsAsking(false);
    }
  };

  const copyInsight = (insight: Insight) => {
    const text = `${insight.title}\n\n${insight.description}${insight.actionItems ? '\n\nAction Items:\n' + insight.actionItems.map(a => `• ${a}`).join('\n') : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(insight.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const giveFeedback = (insightId: string, type: 'up' | 'down') => {
    setFeedbackGiven(prev => ({ ...prev, [insightId]: type }));
    // In production, send feedback to API
  };

  const getImpactBadge = (impact: string) => {
    const colors = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--success)' };
    return (
      <span className="badge" style={{ fontSize: '10px', background: `${colors[impact as keyof typeof colors]}22`, color: colors[impact as keyof typeof colors] }}>
        {impact.toUpperCase()} IMPACT
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Analyzing your data...</p>
      </div>
    );
  }

  const insights = data?.insights || [];
  const suggestions = data?.suggestions || [];

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Sparkles size={20} />
          AI Insights Assistant
          <span className="badge badge-primary">{insights.length} insights</span>
          {insights.filter(i => i.impact === 'high').length > 0 && (
            <span className="badge badge-danger">{insights.filter(i => i.impact === 'high').length} high priority</span>
          )}
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 400px', gap: '20px' }}>
          {/* Insights Panel */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                <Lightbulb size={16} style={{ display: 'inline', marginRight: '8px' }} />
                AI-Generated Insights
              </h4>
              <button onClick={() => refetch()} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                <RefreshCw size={12} style={{ marginRight: '4px' }} />
                Refresh
              </button>
            </div>

            <div className="space-y-4">
              {insights.map(insight => {
                const config = INSIGHT_CONFIG[insight.type];
                const Icon = config.icon;

                return (
                  <div
                    key={insight.id}
                    className="card"
                    style={{
                      padding: '16px',
                      borderLeft: `4px solid ${config.color}`
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-3">
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: config.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Icon size={18} style={{ color: config.color }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-bold" style={{ color: 'var(--text-primary)' }}>{insight.title}</h5>
                            {getImpactBadge(insight.impact)}
                          </div>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{insight.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyInsight(insight)}
                          className="btn btn-secondary btn-icon"
                          style={{ width: '28px', height: '28px' }}
                          title="Copy insight"
                        >
                          {copiedId === insight.id ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>

                    {/* Data Points */}
                    {insight.dataPoints && insight.dataPoints.length > 0 && (
                      <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        {insight.dataPoints.map((dp, idx) => (
                          <div key={idx}>
                            <div className="text-xs text-muted">{dp.label}</div>
                            <div className="flex items-center gap-1">
                              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{dp.value}</span>
                              {dp.trend === 'up' && <TrendingUp size={12} className="text-success" />}
                              {dp.trend === 'down' && <TrendingDown size={12} className="text-danger" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Items */}
                    {insight.actionItems && insight.actionItems.length > 0 && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="text-xs font-bold text-muted mb-2">Recommended Actions:</div>
                        <ul className="text-sm space-y-1">
                          {insight.actionItems.map((action, idx) => (
                            <li key={idx} style={{ color: 'var(--text-secondary)' }}>
                              <span style={{ color: config.color, marginRight: '8px' }}>→</span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Feedback */}
                    <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <div className="flex gap-1">
                        {insight.relatedKpis.map((kpi, idx) => (
                          <span key={idx} className="badge badge-secondary" style={{ fontSize: '10px' }}>{kpi}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">{insight.confidence}% confidence</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => giveFeedback(insight.id, 'up')}
                            className="btn btn-secondary btn-icon"
                            style={{
                              width: '24px', height: '24px',
                              background: feedbackGiven[insight.id] === 'up' ? 'rgba(0, 217, 165, 0.2)' : undefined
                            }}
                          >
                            <ThumbsUp size={10} style={{ color: feedbackGiven[insight.id] === 'up' ? 'var(--success)' : undefined }} />
                          </button>
                          <button
                            onClick={() => giveFeedback(insight.id, 'down')}
                            className="btn btn-secondary btn-icon"
                            style={{
                              width: '24px', height: '24px',
                              background: feedbackGiven[insight.id] === 'down' ? 'rgba(255, 71, 87, 0.2)' : undefined
                            }}
                          >
                            <ThumbsDown size={10} style={{ color: feedbackGiven[insight.id] === 'down' ? 'var(--danger)' : undefined }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat Panel */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', maxHeight: '600px' }}>
            <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              <Sparkles size={16} style={{ display: 'inline', marginRight: '8px' }} />
              Ask AI
            </h4>

            {/* Suggested Questions */}
            {conversation.length === 0 && (
              <div className="mb-4">
                <div className="text-xs text-muted mb-2">Suggested questions:</div>
                <div className="space-y-2">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => askQuestion(suggestion.text)}
                      className="btn btn-secondary"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '12px',
                        textAlign: 'left',
                        justifyContent: 'flex-start'
                      }}
                    >
                      <Lightbulb size={12} style={{ marginRight: '8px', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {suggestion.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-4" style={{ minHeight: '200px' }}>
              {conversation.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: msg.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                    marginLeft: msg.role === 'user' ? '40px' : 0,
                    marginRight: msg.role === 'assistant' ? '40px' : 0
                  }}
                >
                  <p className="text-sm" style={{ color: msg.role === 'user' ? '#fff' : 'var(--text-primary)' }}>
                    {msg.content}
                  </p>
                </div>
              ))}
              {isAsking && (
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', marginRight: '40px' }}>
                  <div className="flex items-center gap-2">
                    <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                    <span className="text-sm text-muted">Analyzing...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
                placeholder="Ask about your facility's performance..."
                className="input"
                style={{ flex: 1 }}
                disabled={isAsking}
              />
              <button
                onClick={() => askQuestion()}
                className="btn btn-primary"
                disabled={!query.trim() || isAsking}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
