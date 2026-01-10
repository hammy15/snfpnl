import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Send, Settings, Sparkles, AlertCircle, TrendingUp, Trash2, Mail, FileText, Target, Building2, BarChart3, History, Lightbulb } from 'lucide-react';
import './AIAssistant.css';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  selectedFacility?: string | null;
  facilities?: Facility[];
}

interface Facility {
  facility_id: string;
  name: string;
  state: string;
  setting: string;
}

interface KPIData {
  kpi_id: string;
  value: number | null;
  period_id: string;
}

interface TrendData {
  period_id: string;
  value: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface BotSettings {
  personality: 'professional' | 'friendly' | 'concise' | 'detailed';
  focusAreas: string[];
  alertThresholds: {
    operatingMargin: number;
    contractLabor: number;
    skilledMix: number;
    occupancy: number;
    revenuePPD: number;
    expensePPD: number;
    nursingHPRD: number;
    agencyNursing: number;
  };
}

// Personality prompts for future Claude API integration
const _PERSONALITY_PROMPTS: Record<string, string> = {
  professional: 'You are a professional financial analyst. Be formal, precise, and data-driven.',
  friendly: 'You are a helpful financial advisor. Be warm, approachable, and explain concepts clearly.',
  concise: 'You are an executive briefing assistant. Be extremely concise and focus only on key points.',
  detailed: 'You are a thorough financial consultant. Provide comprehensive analysis with context.',
};
void _PERSONALITY_PROMPTS; // Silence unused warning

const DEFAULT_SETTINGS: BotSettings = {
  personality: 'friendly',
  focusAreas: ['margins', 'labor', 'revenue'],
  alertThresholds: {
    operatingMargin: 5,
    contractLabor: 15,
    skilledMix: 15,
    occupancy: 85,
    revenuePPD: 380,
    expensePPD: 400,
    nursingHPRD: 3.5,
    agencyNursing: 20,
  },
};

// API fetchers
async function fetchFacilityKPIs(facilityId: string, periodId: string): Promise<KPIData[]> {
  const res = await fetch(`http://localhost:3002/api/kpis/${facilityId}/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch KPIs');
  return res.json();
}

async function fetchAllKPIs(periodId: string): Promise<any[]> {
  const res = await fetch(`http://localhost:3002/api/kpis/all/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch all KPIs');
  return res.json();
}

async function fetchTrends(facilityId: string, kpiId: string): Promise<TrendData[]> {
  const res = await fetch(`http://localhost:3002/api/trends/${facilityId}/${kpiId}`);
  if (!res.ok) throw new Error('Failed to fetch trends');
  return res.json();
}

export function AIAssistant({ isOpen, onClose, periodId, selectedFacility, facilities = [] }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your SNFPNL Financial Intelligence assistant. I can help you analyze your SNF portfolio, identify trends, and spot opportunities for improvement. What would you like to explore?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_SETTINGS);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch facility-specific data when a facility is selected
  const { data: facilityKPIs } = useQuery({
    queryKey: ['facilityKPIs', selectedFacility, periodId],
    queryFn: () => fetchFacilityKPIs(selectedFacility!, periodId),
    enabled: !!selectedFacility && isOpen,
  });

  // Fetch all KPIs for comparison
  const { data: allKPIs = [] } = useQuery({
    queryKey: ['allKPIs', periodId],
    queryFn: () => fetchAllKPIs(periodId),
    enabled: isOpen,
  });

  // Fetch trend data for selected facility
  const { data: marginTrends } = useQuery({
    queryKey: ['marginTrends', selectedFacility],
    queryFn: () => fetchTrends(selectedFacility!, 'snf_operating_margin_pct'),
    enabled: !!selectedFacility && isOpen,
  });

  const selectedFacilityInfo = facilities.find(f => f.facility_id === selectedFacility);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response (in production, this would call the Claude API)
    try {
      const response = await generateAIResponse(
        input,
        settings,
        periodId,
        selectedFacilityInfo || null,
        facilityKPIs || [],
        allKPIs,
        marginTrends || [],
        facilities
      );
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearHistory = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Chat history cleared. How can I help you analyze your portfolio?",
        timestamp: new Date(),
      },
    ]);
  };

  // Dynamic quick actions based on whether a facility is selected
  const quickActions = selectedFacilityInfo
    ? [
        { icon: <BarChart3 size={16} />, label: 'Full Review', prompt: `Give me a complete performance review of ${selectedFacilityInfo.name}` },
        { icon: <History size={16} />, label: 'Trends', prompt: `Show me the performance trends for ${selectedFacilityInfo.name} over the past 6 months` },
        { icon: <Building2 size={16} />, label: 'Peer Compare', prompt: `Compare ${selectedFacilityInfo.name} to other ${selectedFacilityInfo.setting} buildings` },
        { icon: <Lightbulb size={16} />, label: 'Suggestions', prompt: `What improvements would you suggest for ${selectedFacilityInfo.name}?` },
        { icon: <Mail size={16} />, label: 'Draft Email', prompt: `Draft an email to the leader of ${selectedFacilityInfo.name} with feedback and suggestions` },
        { icon: <Target size={16} />, label: 'Benchmarks', prompt: `How does ${selectedFacilityInfo.name} compare to industry benchmarks?` },
      ]
    : [
        { icon: <Mail size={16} />, label: 'Draft Email', prompt: 'Draft an email report for the portfolio to send to leadership' },
        { icon: <AlertCircle size={16} />, label: 'Alerts', prompt: 'What facilities need immediate attention based on their KPIs?' },
        { icon: <TrendingUp size={16} />, label: 'Top Performers', prompt: 'Which facilities are performing best this month and why?' },
        { icon: <Target size={16} />, label: 'Benchmarks', prompt: 'How does our portfolio compare to industry benchmarks?' },
        { icon: <Building2 size={16} />, label: 'Peer Compare', prompt: 'Compare our worst performing facilities to our best performers and suggest improvements' },
        { icon: <FileText size={16} />, label: 'Analysis', prompt: `Give me a comprehensive analysis of trends and opportunities for ${periodId}` },
      ];

  if (!isOpen) return null;

  return (
    <div className="ai-assistant">
      <div className="ai-header">
        <div className="ai-header-left">
          <div className="ai-avatar">
            <Sparkles size={20} />
          </div>
          <div>
            <h3>AI Assistant</h3>
            <span className="ai-status">
              <span className="status-dot" />
              {selectedFacilityInfo
                ? `Reviewing: ${selectedFacilityInfo.name}`
                : 'Portfolio Mode'}
            </span>
          </div>
        </div>
        <div className="ai-header-actions">
          <button
            className="ai-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <button
            className="ai-btn"
            onClick={clearHistory}
            title="Clear History"
          >
            <Trash2 size={18} />
          </button>
          <button className="ai-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      {showSettings ? (
        <div className="ai-settings">
          <h4>Bot Personality</h4>
          <div className="personality-options">
            {(['professional', 'friendly', 'concise', 'detailed'] as const).map((p) => (
              <button
                key={p}
                className={`personality-btn ${settings.personality === p ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, personality: p }))}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          <h4>Focus Areas</h4>
          <div className="focus-options">
            {['margins', 'labor', 'revenue', 'census', 'payer mix', 'costs'].map((area) => (
              <button
                key={area}
                className={`focus-btn ${settings.focusAreas.includes(area) ? 'active' : ''}`}
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    focusAreas: s.focusAreas.includes(area)
                      ? s.focusAreas.filter((a) => a !== area)
                      : [...s.focusAreas, area],
                  }))
                }
              >
                {area}
              </button>
            ))}
          </div>

          <h4>Alert Thresholds</h4>
          <div className="threshold-options">
            <div className="threshold-item">
              <label>Operating Margin Below</label>
              <input
                type="number"
                value={settings.alertThresholds.operatingMargin}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    alertThresholds: { ...s.alertThresholds, operatingMargin: Number(e.target.value) },
                  }))
                }
              />
              <span>%</span>
            </div>
            <div className="threshold-item">
              <label>Occupancy Below</label>
              <input
                type="number"
                value={settings.alertThresholds.occupancy}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    alertThresholds: { ...s.alertThresholds, occupancy: Number(e.target.value) },
                  }))
                }
              />
              <span>%</span>
            </div>
            <div className="threshold-item">
              <label>Skilled Mix Below</label>
              <input
                type="number"
                value={settings.alertThresholds.skilledMix}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    alertThresholds: { ...s.alertThresholds, skilledMix: Number(e.target.value) },
                  }))
                }
              />
              <span>%</span>
            </div>
            <div className="threshold-item">
              <label>Revenue PPD Below</label>
              <input
                type="number"
                value={settings.alertThresholds.revenuePPD}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    alertThresholds: { ...s.alertThresholds, revenuePPD: Number(e.target.value) },
                  }))
                }
              />
              <span>$</span>
            </div>
            <div className="threshold-item">
              <label>Expense PPD Above</label>
              <input
                type="number"
                value={settings.alertThresholds.expensePPD}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    alertThresholds: { ...s.alertThresholds, expensePPD: Number(e.target.value) },
                  }))
                }
              />
              <span>$</span>
            </div>
            <div className="threshold-item">
              <label>Contract Labor Above</label>
              <input
                type="number"
                value={settings.alertThresholds.contractLabor}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    alertThresholds: { ...s.alertThresholds, contractLabor: Number(e.target.value) },
                  }))
                }
              />
              <span>%</span>
            </div>
            <div className="threshold-item">
              <label>Agency Nursing Above</label>
              <input
                type="number"
                value={settings.alertThresholds.agencyNursing}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    alertThresholds: { ...s.alertThresholds, agencyNursing: Number(e.target.value) },
                  }))
                }
              />
              <span>%</span>
            </div>
            <div className="threshold-item">
              <label>Nursing Hours PPD Below</label>
              <input
                type="number"
                step="0.1"
                value={settings.alertThresholds.nursingHPRD}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    alertThresholds: { ...s.alertThresholds, nursingHPRD: Number(e.target.value) },
                  }))
                }
              />
              <span>hrs</span>
            </div>
          </div>

          <button className="save-settings-btn" onClick={() => setShowSettings(false)}>
            Save Settings
          </button>
        </div>
      ) : (
        <>
          <div className="ai-messages">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                {message.role === 'assistant' && (
                  <div className="message-avatar">
                    <Sparkles size={14} />
                  </div>
                )}
                <div className="message-content">
                  <p>{message.content}</p>
                  <span className="message-time">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-avatar">
                  <Sparkles size={14} />
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="quick-actions">
            {quickActions.map((action) => (
              <button
                key={action.label}
                className="quick-action-btn"
                onClick={() => {
                  setInput(action.prompt);
                }}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>

          <div className="ai-input-container">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your portfolio..."
              rows={1}
              className="ai-input"
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Send size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Helper functions for data analysis
function getKPIValue(kpis: KPIData[], kpiId: string): number | null {
  const kpi = kpis.find(k => k.kpi_id === kpiId);
  return kpi?.value ?? null;
}

function formatValue(value: number | null, format: 'percentage' | 'currency' | 'number'): string {
  if (value === null) return '--';
  if (format === 'currency') return `$${value.toFixed(0)}`;
  if (format === 'percentage') return `${value.toFixed(1)}%`;
  return value.toFixed(2);
}

function calculatePeerRank(allKPIs: any[], facilityId: string, kpiId: string, setting: string): { rank: number; total: number; percentile: number } {
  const peers = allKPIs
    .filter(k => k.kpi_id === kpiId && k.setting === setting && k.value !== null)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  const idx = peers.findIndex(p => p.facility_id === facilityId);
  return {
    rank: idx >= 0 ? idx + 1 : -1,
    total: peers.length,
    percentile: idx >= 0 ? Math.round((1 - idx / peers.length) * 100) : 0
  };
}

function getTrendDirection(trends: TrendData[]): { direction: 'improving' | 'declining' | 'stable'; change: number } {
  if (trends.length < 3) return { direction: 'stable', change: 0 };
  const recent = trends.slice(-3);
  const older = trends.slice(-6, -3);

  const recentAvg = recent.reduce((sum, t) => sum + (t.value || 0), 0) / recent.length;
  const olderAvg = older.length > 0 ? older.reduce((sum, t) => sum + (t.value || 0), 0) / older.length : recentAvg;

  const change = recentAvg - olderAvg;
  return {
    direction: change > 1 ? 'improving' : change < -1 ? 'declining' : 'stable',
    change
  };
}

// Simulated AI response generator (replace with actual Claude API call)
async function generateAIResponse(
  userInput: string,
  settings: BotSettings,
  periodId: string,
  selectedFacility: Facility | null,
  facilityKPIs: KPIData[],
  allKPIs: any[],
  marginTrends: TrendData[],
  facilities: Facility[]
): Promise<string> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const input = userInput.toLowerCase();

  // Get facility-specific data if available
  const margin = getKPIValue(facilityKPIs, 'snf_operating_margin_pct');
  const skilledMix = getKPIValue(facilityKPIs, 'snf_skilled_mix_pct');
  const revenuePPD = getKPIValue(facilityKPIs, 'snf_total_revenue_ppd');
  const expensePPD = getKPIValue(facilityKPIs, 'snf_total_cost_ppd');
  const contractLabor = getKPIValue(facilityKPIs, 'snf_contract_labor_pct_nursing');

  // Calculate peer rankings if facility is selected
  const marginRank = selectedFacility ? calculatePeerRank(allKPIs, selectedFacility.facility_id, 'snf_operating_margin_pct', selectedFacility.setting) : null;
  const trendInfo = getTrendDirection(marginTrends);

  // Keep facilities param for future use
  void facilities;

  // Facility-specific full review
  if (selectedFacility && (input.includes('review') || input.includes('full') || input.includes('complete'))) {
    const marginStatus = margin !== null ? (margin >= 8 ? 'strong' : margin >= 0 ? 'moderate' : 'concerning') : 'unknown';
    const trendEmoji = trendInfo.direction === 'improving' ? '📈' : trendInfo.direction === 'declining' ? '📉' : '➡️';

    // Find top performers for comparison
    const topPerformers = allKPIs
      .filter(k => k.kpi_id === 'snf_operating_margin_pct' && k.setting === selectedFacility.setting && k.value !== null)
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 3);

    return `**Full Performance Review: ${selectedFacility.name}**

**Location:** ${selectedFacility.state} | **Setting:** ${selectedFacility.setting}

---

**CURRENT PERFORMANCE (${periodId}):**

| Metric | Value | Status |
|--------|-------|--------|
| EBITDAR Margin | ${formatValue(margin, 'percentage')} | ${marginStatus === 'strong' ? '✅ Strong' : marginStatus === 'moderate' ? '⚠️ Monitor' : '🔴 Needs Attention'} |
| Skilled Mix | ${formatValue(skilledMix, 'percentage')} | ${skilledMix !== null && skilledMix >= 18 ? '✅ Good' : '⚠️ Below Target'} |
| Revenue PPD | ${formatValue(revenuePPD, 'currency')} | ${revenuePPD !== null && revenuePPD >= 400 ? '✅ Above Benchmark' : '⚠️ Below Benchmark'} |
| Expense PPD | ${formatValue(expensePPD, 'currency')} | ${expensePPD !== null && expensePPD <= 350 ? '✅ Well Controlled' : '⚠️ Review Needed'} |
| Contract Labor | ${formatValue(contractLabor, 'percentage')} | ${contractLabor !== null && contractLabor <= 10 ? '✅ Low' : '🔴 High'} |

**PEER RANKING:**
${marginRank ? `Ranked #${marginRank.rank} of ${marginRank.total} ${selectedFacility.setting} buildings (${marginRank.percentile}th percentile)` : 'Insufficient data for ranking'}

**TREND ANALYSIS:** ${trendEmoji}
${marginTrends.length > 0 ? `Over the past ${marginTrends.length} months, margin is **${trendInfo.direction}** (${trendInfo.change >= 0 ? '+' : ''}${trendInfo.change.toFixed(1)}% change)` : 'Not enough historical data for trend analysis'}

${marginTrends.length >= 3 ? `Recent history:
${marginTrends.slice(-6).map(t => `- ${t.period_id}: ${formatValue(t.value, 'percentage')}`).join('\n')}` : ''}

**TOP ${selectedFacility.setting} PERFORMERS FOR COMPARISON:**
${topPerformers.map((p, i) => `${i + 1}. ${p.name}: ${formatValue(p.value, 'percentage')} margin`).join('\n')}

**KEY OBSERVATIONS:**
${margin !== null && margin < 5 ? `• Margin at ${formatValue(margin, 'percentage')} needs immediate attention\n` : ''}${skilledMix !== null && skilledMix < 18 ? `• Skilled mix at ${formatValue(skilledMix, 'percentage')} is below the 18% target - opportunity for revenue growth\n` : ''}${contractLabor !== null && contractLabor > 12 ? `• Contract labor at ${formatValue(contractLabor, 'percentage')} is eating into margin\n` : ''}${margin !== null && margin >= 10 ? `• Great work! This building is outperforming most peers\n` : ''}

Would you like me to draft an email to the leader, suggest improvements, or compare to specific buildings?`;
  }

  // Facility trend analysis
  if (selectedFacility && (input.includes('trend') || input.includes('history') || input.includes('past'))) {
    if (marginTrends.length === 0) {
      return `I don't have enough historical data for ${selectedFacility.name} yet. This might be a new building in the system or data is still being loaded.`;
    }

    const trendEmoji = trendInfo.direction === 'improving' ? '📈' : trendInfo.direction === 'declining' ? '📉' : '➡️';
    const monthsOfData = marginTrends.length;
    const highPoint = Math.max(...marginTrends.map(t => t.value));
    const lowPoint = Math.min(...marginTrends.map(t => t.value));
    const recent = marginTrends.slice(-1)[0];
    const oldest = marginTrends[0];

    return `**Performance Trends: ${selectedFacility.name}** ${trendEmoji}

Looking at the past ${monthsOfData} months of data for this building:

**MARGIN TREND:**
${marginTrends.slice(-12).map(t => `${t.period_id}: ${formatValue(t.value, 'percentage')}`).join('\n')}

**KEY STATS:**
- Current: ${formatValue(recent?.value, 'percentage')}
- High point: ${formatValue(highPoint, 'percentage')}
- Low point: ${formatValue(lowPoint, 'percentage')}
- Net change: ${formatValue(recent?.value - oldest?.value, 'percentage')}

**WHAT I'M SEEING:**
${trendInfo.direction === 'improving' ? `This building is on an upward trajectory! The margin has improved by ${formatValue(trendInfo.change, 'percentage')} over the past few months. Whatever they're doing is working.` :
  trendInfo.direction === 'declining' ? `There's a concerning downward trend here. Margin has dropped ${formatValue(Math.abs(trendInfo.change), 'percentage')} recently. Worth digging into what's changed - is it census? payer mix? labor costs?` :
  `The margin has been relatively stable. Not necessarily bad, but might indicate opportunity to push for improvement.`}

**QUESTIONS TO EXPLORE:**
- Any staffing changes that correlate with the trend?
- Hospital relationship changes affecting referrals?
- Payer contract renewals impacting rates?
- Seasonal patterns we should account for?

Want me to compare this trend to peer buildings or suggest some focus areas?`;
  }

  // Facility peer comparison
  if (selectedFacility && (input.includes('peer') || input.includes('compare'))) {
    const peers = allKPIs
      .filter(k => k.kpi_id === 'snf_operating_margin_pct' && k.setting === selectedFacility.setting && k.value !== null)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const facilityIndex = peers.findIndex(p => p.facility_id === selectedFacility.facility_id);
    const topPerformers = peers.slice(0, 5);
    const bottomPerformers = peers.slice(-5).reverse();

    // Find peers with similar characteristics
    const statePeers = peers.filter(p => p.state === selectedFacility.state);

    return `**Peer Comparison: ${selectedFacility.name}**

**Current Performance:**
- EBITDAR Margin: ${formatValue(margin, 'percentage')}
- Ranking: #${facilityIndex + 1} of ${peers.length} ${selectedFacility.setting} buildings

**TOP 5 ${selectedFacility.setting} PERFORMERS:**
${topPerformers.map((p, i) => `${i + 1}. ${p.name} (${p.state}): ${formatValue(p.value, 'percentage')}${p.facility_id === selectedFacility.facility_id ? ' ⬅️ YOU' : ''}`).join('\n')}

**BOTTOM 5 ${selectedFacility.setting} BUILDINGS:**
${bottomPerformers.map((p, i) => `${peers.length - 4 + i}. ${p.name} (${p.state}): ${formatValue(p.value, 'percentage')}${p.facility_id === selectedFacility.facility_id ? ' ⬅️ YOU' : ''}`).join('\n')}

**${selectedFacility.state} PEERS:**
${statePeers.length > 0 ? statePeers.slice(0, 5).map((p, i) => `${i + 1}. ${p.name}: ${formatValue(p.value, 'percentage')}${p.facility_id === selectedFacility.facility_id ? ' ⬅️ YOU' : ''}`).join('\n') : 'No other buildings in this state'}

**GAP ANALYSIS:**
${facilityIndex >= 0 && margin !== null ? (() => {
  const topAvg = topPerformers.slice(0, 3).reduce((sum, p) => sum + (p.value || 0), 0) / 3;
  const gap = topAvg - margin;
  return `The top 3 performers average ${formatValue(topAvg, 'percentage')}. That's a ${formatValue(gap, 'percentage')} gap from where you are now.

What would closing half that gap mean?
- At your current census, improving margin by ${formatValue(gap / 2, 'percentage')} could add significant dollars to the bottom line
- The top performers all share some common traits: skilled mix over 20%, contract labor under 8%, and strong hospital relationships`;
})() : 'Insufficient data for gap analysis'}

Want me to dig into what specifically the top performers are doing differently?`;
  }

  // Facility suggestions
  if (selectedFacility && (input.includes('suggest') || input.includes('improve') || input.includes('recommend'))) {
    const suggestions: string[] = [];
    const priorities: string[] = [];

    if (margin !== null && margin < 5) {
      priorities.push('**EBITDAR Margin** - This is critical. Every point of margin improvement matters significantly at this level.');
    }

    if (skilledMix !== null && skilledMix < 18) {
      suggestions.push(`**Skilled Mix Opportunity:** Currently at ${formatValue(skilledMix, 'percentage')}, below the 18% target. Consider:
   - Reviewing hospital liaison activities - are you visible at the key discharge planning meetings?
   - Auditing intake processes - how quickly are you responding to referrals?
   - Clinical capabilities - any specialty programs that could attract skilled patients?
   - Top performers in your setting average 22%+ skilled mix`);
    }

    if (contractLabor !== null && contractLabor > 10) {
      suggestions.push(`**Contract Labor Reduction:** At ${formatValue(contractLabor, 'percentage')}, this is eating into margin. Ideas:
   - What's driving turnover? Exit interviews revealing anything?
   - Competitive wage analysis - are you paying market rate?
   - Retention bonuses or incentive programs?
   - The best buildings in the portfolio run under 5%`);
    }

    if (revenuePPD !== null && revenuePPD < 400) {
      suggestions.push(`**Revenue Enhancement:** Revenue PPD at ${formatValue(revenuePPD, 'currency')} is below benchmark. Consider:
   - Payer mix optimization - MA contracts may need renegotiation
   - Ancillary services - therapy intensity appropriate?
   - Rate analysis vs competitors in your market`);
    }

    if (expensePPD !== null && expensePPD > 360) {
      suggestions.push(`**Expense Management:** Expense PPD at ${formatValue(expensePPD, 'currency')} is high. Look at:
   - Supply chain - any group purchasing opportunities?
   - Overtime patterns - is there a scheduling issue?
   - Vendor contracts due for renegotiation?`);
    }

    if (suggestions.length === 0) {
      suggestions.push(`This building is performing well on most metrics. Focus areas for continued excellence:
   - Maintaining current staffing levels and culture
   - Documenting what's working to share with other buildings
   - Looking for incremental improvements in skilled mix or MA penetration`);
    }

    return `**Improvement Suggestions: ${selectedFacility.name}**

${priorities.length > 0 ? `**TOP PRIORITY:**\n${priorities.join('\n')}\n\n` : ''}**SPECIFIC RECOMMENDATIONS:**

${suggestions.join('\n\n')}

**PEER LEARNING OPPORTUNITIES:**
${(() => {
  const top = allKPIs
    .filter(k => k.kpi_id === 'snf_operating_margin_pct' && k.setting === selectedFacility.setting && k.value !== null)
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 2);
  return top.length > 0
    ? `Consider connecting with:\n${top.map(t => `- ${t.name} (${formatValue(t.value, 'percentage')} margin) - what's their secret?`).join('\n')}`
    : 'No clear peer learning targets identified';
})()}

**QUICK WINS TO CONSIDER:**
1. Weekly intake call reviews to improve conversion
2. Monthly labor cost variance reviews
3. Quarterly payer contract assessments

Want me to draft an email to the leader with these suggestions?`;
  }

  // Email drafting response
  if (input.includes('email') || input.includes('draft')) {
    // If we have a selected facility with data, use real data
    if (selectedFacility && margin !== null) {
      const marginStatus = margin >= 8 ? 'solid' : margin >= 0 ? 'okay but has room to grow' : 'concerning and needs attention';
      const trendNote = trendInfo.direction === 'improving' ? "which is great to see" : trendInfo.direction === 'declining' ? "which we should discuss" : "";

      // Find top peer for comparison
      const topPeer = allKPIs
        .filter(k => k.kpi_id === 'snf_operating_margin_pct' && k.setting === selectedFacility.setting && k.value !== null && k.facility_id !== selectedFacility.facility_id)
        .sort((a, b) => (b.value || 0) - (a.value || 0))[0];

      return `**Draft Email for ${selectedFacility.name} Leader**

---

Subject: Checking in on ${periodId} results + a few thoughts

Hey [Name],

Hope you're doing well! Wanted to reach out after looking at this month's numbers. Got a few minutes to chat sometime this week?

Looking at ${periodId}, I see the building is running at ${formatValue(margin, 'percentage')} EBITDAR margin, which is ${marginStatus}${trendNote ? ` - the trend lately has been ${trendInfo.direction}, ${trendNote}` : ''}.

A few things caught my eye:

${skilledMix !== null ? `**Skilled Mix:** You're at ${formatValue(skilledMix, 'percentage')}. ${skilledMix >= 18 ? "That's solid - whatever you're doing with referral sources seems to be working." : `Our target is 18%+, and ${topPeer ? `${topPeer.name} is hitting ${formatValue(topPeer.value, 'percentage')} margin with a higher skilled mix. Have you connected with their team?` : "there might be opportunity here."}`}` : ''}

${contractLabor !== null ? `**Contract Labor:** Currently at ${formatValue(contractLabor, 'percentage')}. ${contractLabor <= 8 ? "Great job keeping this low - that's a real competitive advantage." : `I know the market is tough, but this is higher than we'd like. What's the biggest barrier to permanent hires right now?`}` : ''}

${revenuePPD !== null ? `**Revenue PPD:** ${formatValue(revenuePPD, 'currency')} - ${revenuePPD >= 420 ? "above benchmark, nice work!" : "a bit below where we'd like to see it. Any MA contracts up for renewal we should strategize on?"}` : ''}

${marginTrends.length >= 3 ? `Looking back at the past few months:
${marginTrends.slice(-4).map(t => `- ${t.period_id}: ${formatValue(t.value, 'percentage')}`).join('\n')}

${trendInfo.direction === 'improving' ? "Love seeing this upward movement. What's clicking?" : trendInfo.direction === 'declining' ? "The trend here is something I'd like to understand better. What's changed?" : "Pretty steady. Any opportunities you see to push things higher?"}` : ''}

Not trying to pile on - genuinely want to help and understand what's happening on the ground. Sometimes the numbers don't tell the whole story.

${topPeer ? `Quick thought - ${topPeer.name} is doing really well right now (${formatValue(topPeer.value, 'percentage')} margin). Might be worth a quick call with their ED to compare notes?` : ''}

Let me know when works for a quick chat.

[Your name]

P.S. - ${margin >= 10 ? "Seriously, great job this month. Make sure you're recognizing the team." : "Happy to pull together more data or connect you with other EDs who've navigated similar situations."}

---

*Adjust names and specific numbers as needed before sending*`;
    }

    // Portfolio email (no specific facility)
    // Find real top and bottom performers from data
    const marginData = allKPIs
      .filter(k => k.kpi_id === 'snf_operating_margin_pct' && k.value !== null)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const topPerfs = marginData.slice(0, 3);
    const bottomPerfs = marginData.slice(-3).reverse();
    const avgMargin = marginData.length > 0 ? marginData.reduce((sum, k) => sum + (k.value || 0), 0) / marginData.length : 0;

    return `**Draft Email for Leadership**

---

Subject: Quick ${periodId} update + a few thoughts

Hey team,

Hope everyone's week is going well. Wanted to share some observations from this month's numbers while they're fresh.

**Portfolio snapshot:** ${marginData.length} buildings, averaging ${formatValue(avgMargin, 'percentage')} EBITDAR margin.

**Shoutouts:**
${topPerfs.map((p, i) => `- ${p.name} (${p.state}): ${formatValue(p.value, 'percentage')} - ${i === 0 ? "leading the portfolio!" : "strong performer"}`).join('\n')}

${topPerfs.length > 0 ? `I'd love to understand what ${topPerfs[0].name} is doing differently. Have we talked to their ED recently about what's working?` : ''}

**Needs attention:**
${bottomPerfs.map(p => `- ${p.name} (${p.state}): ${formatValue(p.value, 'percentage')}`).join('\n')}

${bottomPerfs.length > 0 && bottomPerfs[0].value < 0 ? `${bottomPerfs[0].name} being negative is concerning. Do we know what's driving that? Staffing? Census? Rate issues?` : ''}

**Questions on my mind:**
- What would it take to get our bottom 3 to portfolio average?
- Are there peer learning opportunities between our top and struggling buildings?
- Any regional patterns we should be concerned about?

Happy to dig into any of this further. Let me know what would be most helpful.

Talk soon,
[Your name]

---

*Feel free to adjust tone/detail as needed*`;
  }

  // Benchmark comparison
  if (input.includes('benchmark') || input.includes('industry')) {
    // If facility is selected, show facility-specific benchmarks
    if (selectedFacility && margin !== null) {
      return `**${selectedFacility.name} vs Industry Benchmarks (${periodId}):**

| Metric | Your Value | Benchmark | Status |
|--------|-----------|-----------|--------|
| EBITDAR Margin | ${formatValue(margin, 'percentage')} | 8.0% | ${margin >= 8 ? '✅ Above' : margin >= 5 ? '⚠️ Near' : '🔴 Below'} |
| Skilled Mix | ${formatValue(skilledMix, 'percentage')} | 20.0% | ${skilledMix !== null && skilledMix >= 20 ? '✅ Above' : skilledMix !== null && skilledMix >= 15 ? '⚠️ Near' : '🔴 Below'} |
| Revenue PPD | ${formatValue(revenuePPD, 'currency')} | $400 | ${revenuePPD !== null && revenuePPD >= 400 ? '✅ Above' : revenuePPD !== null && revenuePPD >= 360 ? '⚠️ Near' : '🔴 Below'} |
| Expense PPD | ${formatValue(expensePPD, 'currency')} | $350 | ${expensePPD !== null && expensePPD <= 350 ? '✅ Below (Good)' : expensePPD !== null && expensePPD <= 380 ? '⚠️ Near' : '🔴 Above'} |
| Contract Labor | ${formatValue(contractLabor, 'percentage')} | 10.0% | ${contractLabor !== null && contractLabor <= 10 ? '✅ Below (Good)' : contractLabor !== null && contractLabor <= 15 ? '⚠️ Near' : '🔴 Above'} |

**BIGGEST GAPS:**
${(() => {
  const gaps: string[] = [];
  if (margin !== null && margin < 8) gaps.push(`- Margin: ${formatValue(8 - margin, 'percentage')} below target`);
  if (skilledMix !== null && skilledMix < 20) gaps.push(`- Skilled Mix: ${formatValue(20 - skilledMix, 'percentage')} below target`);
  if (contractLabor !== null && contractLabor > 10) gaps.push(`- Contract Labor: ${formatValue(contractLabor - 10, 'percentage')} above target`);
  return gaps.length > 0 ? gaps.join('\n') : '- Looking good across the board!';
})()}

**PEER CONTEXT:**
${marginRank ? `You're ranked #${marginRank.rank} of ${marginRank.total} ${selectedFacility.setting} buildings (${marginRank.percentile}th percentile)` : ''}

Want me to suggest specific improvements to close these gaps?`;
    }

    // Portfolio-level benchmarks using real data
    const marginData = allKPIs.filter(k => k.kpi_id === 'snf_operating_margin_pct' && k.value !== null);
    const skilledData = allKPIs.filter(k => k.kpi_id === 'snf_skilled_mix_pct' && k.value !== null);
    const revenueData = allKPIs.filter(k => k.kpi_id === 'snf_total_revenue_ppd' && k.value !== null);
    const expenseData = allKPIs.filter(k => k.kpi_id === 'snf_total_cost_ppd' && k.value !== null);
    const contractData = allKPIs.filter(k => k.kpi_id === 'snf_contract_labor_pct_nursing' && k.value !== null);

    const avgMargin = marginData.length > 0 ? marginData.reduce((sum, k) => sum + k.value, 0) / marginData.length : 0;
    const avgSkilled = skilledData.length > 0 ? skilledData.reduce((sum, k) => sum + k.value, 0) / skilledData.length : 0;
    const avgRevenue = revenueData.length > 0 ? revenueData.reduce((sum, k) => sum + k.value, 0) / revenueData.length : 0;
    const avgExpense = expenseData.length > 0 ? expenseData.reduce((sum, k) => sum + k.value, 0) / expenseData.length : 0;
    const avgContract = contractData.length > 0 ? contractData.reduce((sum, k) => sum + k.value, 0) / contractData.length : 0;

    return `**Portfolio vs Industry Benchmarks for ${periodId}:**

**Operating Margin**
- Portfolio Average: ${formatValue(avgMargin, 'percentage')}
- Industry Benchmark (SNF): 8.0%
- Status: ${avgMargin >= 8 ? '✅ Meeting benchmark' : '⚠️ Below benchmark'}
- Top Quartile Target: 12%+

**Skilled Mix**
- Portfolio Average: ${formatValue(avgSkilled, 'percentage')}
- Industry Benchmark: 20%
- Status: ${avgSkilled >= 20 ? '✅ Meeting benchmark' : `⚠️ ${formatValue(20 - avgSkilled, 'percentage')} below benchmark`}
- Best in Class: 25%+

**Revenue Per Patient Day**
- Portfolio Average: ${formatValue(avgRevenue, 'currency')}
- Industry Benchmark: $400
- Status: ${avgRevenue >= 400 ? '✅ ABOVE benchmark' : '⚠️ Below benchmark'}
- Top Performers: $480+

**Expense Per Patient Day**
- Portfolio Average: ${formatValue(avgExpense, 'currency')}
- Industry Benchmark: $350
- Status: ${avgExpense <= 350 ? '✅ BELOW benchmark (good!)' : '⚠️ Above benchmark'}
- Best in Class: <$320

**Contract Labor % of Nursing**
- Portfolio Average: ${formatValue(avgContract, 'percentage')}
- Industry Benchmark: 10%
- Status: ${avgContract <= 10 ? '✅ BELOW benchmark (good!)' : '⚠️ Above benchmark'}
- Target: <5%

**Summary:** ${avgMargin >= 8 && avgSkilled >= 20 ? 'Portfolio is performing well across key metrics!' : avgSkilled < 18 ? 'Focus on skilled mix optimization to close the gap.' : 'Opportunity to improve margin through cost management.'}`;
  }

  // Peer comparison
  if (input.includes('peer') || input.includes('compare') || (input.includes('worst') && input.includes('best'))) {
    return `OK here's an honest look at the gap between our best and struggling buildings:

**The struggling ones:**
- Creekside (OR): -2.3% margin, 11% skilled mix, 18% contract labor
- Payette (ID): 1.8% margin, 14% skilled mix, 15% contract labor
- Colfax (WA): 3.2% margin, 12% skilled mix, 22% contract labor

**The ones crushing it:**
- Shaw (ID): 18.0% margin, 24% skilled mix, 3% contract labor
- Boise (ID): 15.2% margin, 21% skilled mix, 4% contract labor
- Canyon West (ID): 14.8% margin, 19% skilled mix, 6% contract labor

**What jumps out:**
The skilled mix gap is massive. Top buildings are at 21% average, bottom ones at 12%. That's roughly $50/day in revenue difference. Why aren't the bottom buildings getting skilled referrals? Are they not calling on hospitals? Is it a clinical capability issue? Reputation?

Contract labor tells a story too. Top performers average 4%, bottom ones 18%. That's probably $400K+ in annual savings just sitting there. What would it take to close that gap?

**My two cents on each:**

*Creekside* - This is the one I'd prioritize. They're in the same market as Shaw. Same hospitals, same referral sources. So why is Shaw at 24% skilled mix and Creekside at 11%? I'd get Mark (Creekside ED) on the phone with Sarah (Shaw ED). Sometimes it's literally just how they're answering intake calls or following up with case managers.

*Payette* - They're only 30 miles from Boise. Same market dynamics. Yet Boise runs 4% contract labor and Payette is at 15%. There's a playbook here. Can we get their DONs talking?

*Colfax* - That 22% contract labor is killing them. I wonder if there's a regional recruiting issue or if it's specific to the building. Have we looked at what's driving turnover there?

Want me to set up some intro emails between these teams? Sometimes just getting people talking unlocks things.`;
  }

  // Trend analysis
  if (input.includes('trend') || input.includes('analysis') || input.includes('opportunit')) {
    return `**Comprehensive Trend Analysis for ${periodId}:**

**6-MONTH TRENDS:**

**Operating Margin Trend:**
- 6 months ago: 6.8%
- 3 months ago: 7.2%
- Current: 7.8%
- Direction: Improving (+1.0% over 6 months)

**Skilled Mix Trend:**
- 6 months ago: 14%
- 3 months ago: 16%
- Current: 17%
- Direction: Strong improvement (+3 points)

**Contract Labor Trend:**
- 6 months ago: 14%
- 3 months ago: 12%
- Current: 9%
- Direction: Improving (-5 points)

**SEASONAL PATTERNS:**
- Q4 typically sees 2-3% margin compression (flu season, holidays)
- Skilled mix peaks in Jan-Feb (post-hospital surge)
- Contract labor increases Nov-Dec (holiday coverage)

**EMERGING OPPORTUNITIES:**

1. **Managed Care Growth:** MA enrollment growing 8% annually in our markets. Current penetration at 18%, top performers at 25%.

2. **Expense Reduction:** Supply chain consolidation could save $15-20/PPD across portfolio.

3. **Revenue Enhancement:** Clinical programming in cardiac recovery showing strong results at pilot facilities.

**RISK FACTORS:**

1. Labor market remains tight in OR and WA
2. State Medicaid rate freeze in ID for next fiscal year
3. Increased survey scrutiny in MT region

**STRATEGIC RECOMMENDATIONS:**

1. Accelerate MA contract negotiations before Q4
2. Expand cardiac program to 5 additional facilities
3. Implement centralized agency management to reduce costs

Would you like me to dive deeper into any of these trends or prepare specific action plans?`;
  }

  // Alert responses
  if (input.includes('attention') || input.includes('alert') || input.includes('concern')) {
    return `Here's what's popping up based on your thresholds for ${periodId}:

**Margin Issues** (below ${settings.alertThresholds.operatingMargin}%):
- Creekside (OR): -2.3% - this one's been struggling for a few months now
- Payette (ID): 1.8% - down from 4% last month, worth a check-in
- Colfax (WA): 3.2% - slowly improving actually, was at 1% two months ago

**Staffing Red Flags** (contract labor above ${settings.alertThresholds.contractLabor}%):
- Hudson Bay (WA): 22% - seems stuck here, what's going on with recruiting?
- Brookfield (WA): 18% - market's tough but this is high

**Low Skilled Mix** (below ${settings.alertThresholds.skilledMix}%):
- Weiser (ID): 11% - have they lost a referral source?
- Mountain View (MT): 13% - was at 18% six months ago, trending wrong way

**Occupancy Concerns** (below ${settings.alertThresholds.occupancy}%):
- Riverside (OR): 78% - census has been soft all quarter
- Valley View (WA): 82% - down from 89% last month

**High Expenses** (PPD above $${settings.alertThresholds.expensePPD}):
- Meadowbrook (ID): $425 PPD - what's driving this? Supply costs?
- Sunnydale (MT): $410 PPD - nursing overtime maybe?

My take: Creekside needs attention first - negative margin plus low skilled mix is a tough combo. But honestly, the occupancy drops at Riverside and Valley View worry me too. Census problems usually snowball.

Quick questions to think about:
- Has anything changed in Creekside's market? New competitor?
- What's the story with Weiser's skilled mix drop?
- Are the occupancy issues seasonal or something bigger?

Want me to draft some check-in emails? Or pull together a peer comparison for any of these?`;
  }

  if (input.includes('top') || input.includes('best') || input.includes('performer')) {
    return `Here are your rockstars for ${periodId}:

**Shaw (ID) - 18.0% margin**
These guys are on fire. Up from 16.2% last month. Sarah's team has figured out the skilled mix game - they're at 24%, which is driving a ton of that performance. Their expense PPD is also crazy low at $310. I'd love to know what they're doing on the staffing side.

**Boise (ID) - 15.2% margin**
Consistent as always. What's wild is their contract labor is only 4%. In this market! How are they doing it? Their MA relationships are really strong too. This is a building worth studying.

**Canyon West (ID) - 14.8% margin**
The turnaround story. They were at 12% last month, 10% the month before. Something clicked. Pretty sure it's the new MA/HMO contracts they negotiated. Worth asking their ED what changed.

What these buildings have in common:
- Skilled mix over 20% (most buildings are at 15-17%)
- Minimal agency staff
- Really good hospital relationships
- They're proactive on census - never seem to get caught off guard

Random thought: Have we ever done a "lunch and learn" where these EDs share what's working? Sometimes the simple stuff - like how they handle intake calls or follow up with case managers - makes the biggest difference.

Shaw especially deserves some recognition. Maybe a shoutout in the next company call?`;
  }

  if (input.includes('summary') || input.includes('overview')) {
    return `Quick snapshot for ${periodId}:

**The big picture:**
59 buildings, 5 states. Portfolio margin is sitting at 7.8%, which is decent but we've been higher. Total revenue came in at $52.4M.

**By setting type:**
- SNF (42 buildings): 8.2% margin - carrying the portfolio
- ALF (4 buildings): 6.1% margin - these are a bit soft
- ILF (5 buildings): 9.4% margin - actually doing well

**What's moving in the right direction:**
- Skilled mix ticked up 2 points from last month. Finally! That's been a focus area and it's nice to see it pay off.
- Contract labor dropped from 12% to 9%. Still not where we want to be, but progress.
- Medicare A rates holding steady around $755/day

**What I'm watching:**
- 6 buildings are underwater (negative margin). That's too many.
- Oregon is struggling across the board. What's going on over there?
- We're still spending too much on agency. The best buildings are under 5%.

**Honest take:**
Overall it's a solid month. Not great, not bad. The skilled mix trend is encouraging. But those 6 negative margin buildings are going to drag down the average until we address them.

Want me to pull up details on the struggling buildings? Or draft something for leadership?`;
  }

  if (input.includes('margin') || input.includes('profitability')) {
    return `**Margin Analysis for ${periodId}:**

The portfolio average operating margin is 7.8%, which is ${settings.alertThresholds.operatingMargin <= 7.8 ? 'above' : 'below'} your target threshold of ${settings.alertThresholds.operatingMargin}%.

**Margin Distribution:**
- Above 10%: 18 facilities (30%)
- 5-10%: 24 facilities (41%)
- 0-5%: 11 facilities (19%)
- Below 0%: 6 facilities (10%)

**Margin Drivers:**
1. Revenue PPD: $421 average (top quartile: $480+)
2. Expense PPD: $345 average (best performers: <$320)
3. Skilled Mix: 17% average (target: 20%+)

Would you like me to drill into any specific facility or cost category?`;
  }

  // Default response
  return `Hmm, let me think about "${userInput}"...

I don't have a specific answer for that, but here's what I can help with:

**Quick things:**
- Draft an email to leadership or a facility leader
- Pull up which buildings need attention right now
- Show you who's performing best (and what they're doing right)
- Compare your struggling buildings to your top performers

**Deeper analysis:**
- How you're trending over time
- How you stack up against industry benchmarks
- Detailed breakdown by state, setting, or specific metrics

Just ask in plain English - "who's struggling?", "draft an email about Creekside", "what's driving Shaw's performance", etc.

Or try one of the quick buttons above to get started.

Currently watching: ${settings.focusAreas.join(', ')}`;
}
