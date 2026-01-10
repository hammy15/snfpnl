import { useState, useEffect } from 'react';
import { FileText, Download, Loader2, RefreshCw, Copy, Check, Building2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Target, Lightbulb, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import './NarrativeReport.css';

interface NarrativeReportProps {
  context: 'dashboard' | 'facility' | 'comparison' | 'alerts' | 'ppd' | 'executive' | 'directory' | 'heatmap';
  periodId: string;
  facilityId?: string;
  data?: any;
  title?: string;
}

interface NarrativeSection {
  title: string;
  content: string;
  type: 'summary' | 'analysis' | 'trends' | 'recommendations' | 'questions';
}

interface GeneratedNarrative {
  title: string;
  generatedAt: string;
  sections: NarrativeSection[];
  metadata: {
    periodId: string;
    facilityId?: string;
    context: string;
  };
}

export function NarrativeReport({ context, periodId, facilityId, data, title }: NarrativeReportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [narrative, setNarrative] = useState<GeneratedNarrative | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const generateNarrative = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3002/api/narrative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          periodId,
          facilityId,
          data,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate narrative');
      }

      const result = await response.json();
      setNarrative(result);
      setIsExpanded(true);
    } catch (err) {
      setError('Failed to generate narrative. Please try again.');
      console.error('Narrative generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToPDF = async () => {
    if (!narrative) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${narrative.title}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            color: #333;
            line-height: 1.6;
          }
          h1 {
            color: #1a1a2e;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
          }
          h2 {
            color: #667eea;
            margin-top: 30px;
          }
          .metadata {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
            font-size: 0.9em;
          }
          .section {
            margin-bottom: 25px;
          }
          .section-summary { border-left: 4px solid #667eea; padding-left: 15px; }
          .section-analysis { border-left: 4px solid #00d9a5; padding-left: 15px; }
          .section-trends { border-left: 4px solid #f093fb; padding-left: 15px; }
          .section-recommendations { border-left: 4px solid #ffc107; padding-left: 15px; }
          .section-questions { border-left: 4px solid #ff4757; padding-left: 15px; }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 0.8em;
            color: #666;
          }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <h1>${narrative.title}</h1>
        <div class="metadata">
          <strong>Generated:</strong> ${new Date(narrative.generatedAt).toLocaleString()}<br>
          <strong>Period:</strong> ${formatPeriod(narrative.metadata.periodId)}<br>
          ${narrative.metadata.facilityId ? `<strong>Facility:</strong> ${narrative.metadata.facilityId}<br>` : ''}
          <strong>Report Type:</strong> ${narrative.metadata.context.charAt(0).toUpperCase() + narrative.metadata.context.slice(1)} Analysis
        </div>
        ${narrative.sections.map(section => `
          <div class="section section-${section.type}">
            <h2>${section.title}</h2>
            <p>${section.content.replace(/\n/g, '</p><p>')}</p>
          </div>
        `).join('')}
        <div class="footer">
          <p>SNFPNL.com | Confidential Report</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const exportToWord = () => {
    if (!narrative) return;

    const content = `
${narrative.title}
${'='.repeat(narrative.title.length)}

Generated: ${new Date(narrative.generatedAt).toLocaleString()}
Period: ${formatPeriod(narrative.metadata.periodId)}
${narrative.metadata.facilityId ? `Facility: ${narrative.metadata.facilityId}` : ''}
Report Type: ${narrative.metadata.context.charAt(0).toUpperCase() + narrative.metadata.context.slice(1)} Analysis

${'-'.repeat(50)}

${narrative.sections.map(section => `
${section.title}
${'-'.repeat(section.title.length)}

${section.content}

`).join('\n')}

---
SNFPNL.com | Confidential Report
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${narrative.title.replace(/\s+/g, '_')}_${periodId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    if (!narrative) return;

    const content = `${narrative.title}\n\n${narrative.sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n')}`;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatPeriod = (periodId: string): string => {
    const [year, month] = periodId.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="narrative-report">
      <div className="narrative-header">
        <div className="narrative-title">
          <FileText size={24} />
          <div>
            <h3>{title || 'Narrative Report'}</h3>
            <p>AI-generated analysis and insights</p>
          </div>
        </div>

        <div className="narrative-actions">
          {narrative && (
            <>
              <button className="action-btn" onClick={copyToClipboard} title="Copy to clipboard">
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
              <button className="action-btn" onClick={exportToWord} title="Export as Text">
                <Download size={18} />
                Text
              </button>
              <button className="action-btn" onClick={exportToPDF} title="Export as PDF">
                <Download size={18} />
                PDF
              </button>
            </>
          )}
          <button
            className={`generate-btn ${isGenerating ? 'generating' : ''}`}
            onClick={generateNarrative}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="spin" />
                Generating...
              </>
            ) : narrative ? (
              <>
                <RefreshCw size={18} />
                Regenerate
              </>
            ) : (
              <>
                <FileText size={18} />
                Generate Narrative
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="narrative-error">
          {error}
        </div>
      )}

      {narrative && isExpanded && (
        <div className="narrative-content">
          <div className="narrative-meta">
            <span>Generated {new Date(narrative.generatedAt).toLocaleString()}</span>
            <span>Period: {formatPeriod(narrative.metadata.periodId)}</span>
            {narrative.metadata.facilityId && (
              <span>Facility: {narrative.metadata.facilityId}</span>
            )}
          </div>

          <div className="narrative-sections">
            {narrative.sections.map((section, index) => (
              <div key={index} className={`narrative-section section-${section.type}`}>
                <h4>{section.title}</h4>
                <div className="section-content">
                  {section.content.split('\n').map((paragraph, pIndex) => (
                    <p key={pIndex}>{paragraph}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {narrative && !isExpanded && (
        <button className="expand-btn" onClick={() => setIsExpanded(true)}>
          Show Generated Narrative
        </button>
      )}
    </div>
  );
}

// Enhanced Financial Packet Generator Component
interface FinancialPacketProps {
  facilityId?: string;
  periodId: string;
}

type PacketScope = 'facility' | 'state' | 'opco' | 'portfolio';

interface PacketOptions {
  states: string[];
  opcos: string[];
  facilities: { id: string; name: string; state: string }[];
}

export function FinancialPacketGenerator({ facilityId, periodId }: FinancialPacketProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [packet, setPacket] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Default to 'facility' scope if facilityId is provided
  const [scope, setScope] = useState<PacketScope>(facilityId ? 'facility' : 'portfolio');
  const [selectedFacility, setSelectedFacility] = useState(facilityId || '');
  const [selectedState, setSelectedState] = useState('');
  const [selectedOpco, setSelectedOpco] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'goingWell', 'needsWork', 'predictions', 'opportunities', 'pitfalls', 'facilityMetrics', 'charts', 'peerAnalysis', 'historicalSummary']));
  const [options, setOptions] = useState<PacketOptions | null>(null);

  // Fetch available options on mount
  useEffect(() => {
    fetch('http://localhost:3002/api/narrative/packet-options')
      .then(res => res.json())
      .then(data => setOptions(data))
      .catch(err => console.error('Failed to fetch packet options:', err));
  }, []);

  // Update selectedFacility when facilityId prop changes
  useEffect(() => {
    if (facilityId) {
      setSelectedFacility(facilityId);
      setScope('facility');
    }
  }, [facilityId]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const generatePacket = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const requestBody: Record<string, string | undefined> = {
        scope,
        periodId,
      };

      if (scope === 'facility') requestBody.facilityId = selectedFacility;
      if (scope === 'state') requestBody.stateName = selectedState;
      if (scope === 'opco') requestBody.opcoName = selectedOpco;

      const response = await fetch('http://localhost:3002/api/narrative/financial-packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to generate financial packet');
      }

      const result = await response.json();
      setPacket(result);
    } catch (err) {
      setError('Failed to generate financial packet. Please try again.');
      console.error('Packet generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportPacket = () => {
    if (!packet) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = generateEnhancedPacketHTML(packet, scope);
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="financial-packet-generator">
      <div className="packet-header">
        <div className="packet-title">
          <Building2 size={24} />
          <div>
            <h3>Financial Packet Generator</h3>
            <p>Comprehensive analysis with narratives, charts, and recommendations</p>
          </div>
        </div>
      </div>

      <div className="packet-options">
        <div className="option-group">
          <label>Scope</label>
          <select value={scope} onChange={(e) => setScope(e.target.value as PacketScope)}>
            <option value="portfolio">Full Portfolio</option>
            <option value="state">By State</option>
            <option value="opco">By Operating Company</option>
            <option value="facility">Single Facility</option>
          </select>
        </div>

        {scope === 'state' && options && (
          <div className="option-group">
            <label>State</label>
            <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
              <option value="">Select a state...</option>
              {options.states.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
        )}

        {scope === 'opco' && options && (
          <div className="option-group">
            <label>Operating Company</label>
            <select value={selectedOpco} onChange={(e) => setSelectedOpco(e.target.value)}>
              <option value="">Select an OpCo...</option>
              {options.opcos.map(opco => (
                <option key={opco} value={opco}>{opco}</option>
              ))}
            </select>
          </div>
        )}

        {scope === 'facility' && options && (
          <div className="option-group">
            <label>Facility</label>
            <select value={selectedFacility} onChange={(e) => setSelectedFacility(e.target.value)}>
              <option value="">Select a facility...</option>
              {options.facilities.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.state})</option>
              ))}
            </select>
          </div>
        )}

        <button
          className="generate-packet-btn"
          onClick={generatePacket}
          disabled={
            isGenerating ||
            (scope === 'facility' && !selectedFacility) ||
            (scope === 'state' && !selectedState) ||
            (scope === 'opco' && !selectedOpco)
          }
        >
          {isGenerating ? (
            <>
              <Loader2 size={18} className="spin" />
              Generating Packet...
            </>
          ) : (
            <>
              <FileText size={18} />
              Generate Financial Packet
            </>
          )}
        </button>
      </div>

      {error && <div className="packet-error">{error}</div>}

      {packet && (
        <div className="packet-content">
          <div className="packet-header-bar">
            <div className="packet-title-section">
              <h2>{packet.title}</h2>
              <p className="packet-subtitle">{packet.subtitle}</p>
            </div>
            <button className="export-btn" onClick={exportPacket}>
              <Download size={18} />
              Export PDF
            </button>
          </div>

          {/* Executive Narrative */}
          <div className="packet-section executive-narrative">
            <div className="narrative-text" dangerouslySetInnerHTML={{ __html: formatMarkdown(packet.executiveNarrative) }} />
          </div>

          {/* Facility Summary Metrics (for facility scope) */}
          {scope === 'facility' && packet.summaryMetrics && (
            <div className="packet-section">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('facilityMetrics')}
              >
                <h3>
                  {expandedSections.has('facilityMetrics') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  Key Performance Metrics
                </h3>
              </div>
              {expandedSections.has('facilityMetrics') && (
                <div className="summary-grid facility-metrics">
                  <div className={`summary-card highlight ${packet.summaryMetrics.operatingMargin?.status}`}>
                    <span className={`summary-value ${packet.summaryMetrics.operatingMargin?.value >= 10 ? 'positive' : packet.summaryMetrics.operatingMargin?.value >= 0 ? 'warning' : 'negative'}`}>
                      {packet.summaryMetrics.operatingMargin?.value?.toFixed(1)}%
                    </span>
                    <span className="summary-label">Operating Margin</span>
                    {packet.summaryMetrics.operatingMargin?.change !== undefined && (
                      <span className={`summary-change ${packet.summaryMetrics.operatingMargin.change >= 0 ? 'positive' : 'negative'}`}>
                        {packet.summaryMetrics.operatingMargin.change >= 0 ? '↑' : '↓'} {Math.abs(packet.summaryMetrics.operatingMargin.change).toFixed(1)} MoM
                      </span>
                    )}
                  </div>
                  <div className="summary-card">
                    <span className="summary-value">${packet.summaryMetrics.revenuePPD?.value?.toFixed(0)}</span>
                    <span className="summary-label">Revenue PPD</span>
                    <span className="summary-benchmark">Avg: ${packet.summaryMetrics.revenuePPD?.portfolioAvg?.toFixed(0)}</span>
                  </div>
                  <div className="summary-card">
                    <span className="summary-value">${packet.summaryMetrics.costPPD?.value?.toFixed(0)}</span>
                    <span className="summary-label">Cost PPD</span>
                    <span className="summary-benchmark">Avg: ${packet.summaryMetrics.costPPD?.portfolioAvg?.toFixed(0)}</span>
                  </div>
                  <div className="summary-card">
                    <span className={`summary-value ${packet.summaryMetrics.spread?.value >= 0 ? 'positive' : 'negative'}`}>
                      ${packet.summaryMetrics.spread?.value?.toFixed(0)}
                    </span>
                    <span className="summary-label">Rev-Cost Spread</span>
                  </div>
                  <div className="summary-card">
                    <span className="summary-value">{packet.summaryMetrics.skilledMix?.value?.toFixed(1)}%</span>
                    <span className="summary-label">Skilled Mix</span>
                    <span className="summary-benchmark">Avg: {packet.summaryMetrics.skilledMix?.portfolioAvg?.toFixed(1)}%</span>
                  </div>
                  <div className={`summary-card ${packet.summaryMetrics.contractLabor?.status === 'elevated' ? 'warning-card' : ''}`}>
                    <span className={`summary-value ${packet.summaryMetrics.contractLabor?.value > 15 ? 'negative' : packet.summaryMetrics.contractLabor?.value > 10 ? 'warning' : ''}`}>
                      {packet.summaryMetrics.contractLabor?.value?.toFixed(1)}%
                    </span>
                    <span className="summary-label">Contract Labor</span>
                    <span className="summary-benchmark">Avg: {packet.summaryMetrics.contractLabor?.portfolioAvg?.toFixed(1)}%</span>
                  </div>
                  <div className="summary-card">
                    <span className="summary-value">{packet.summaryMetrics.occupancy?.value?.toFixed(1)}%</span>
                    <span className="summary-label">Occupancy</span>
                  </div>
                  <div className="summary-card">
                    <span className="summary-value">{packet.summaryMetrics.nursingHPPD?.value?.toFixed(2)}</span>
                    <span className="summary-label">Nursing HPPD</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Charts Section (for facility scope) */}
          {scope === 'facility' && packet.charts && (
            <div className="packet-section">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('charts')}
              >
                <h3>
                  {expandedSections.has('charts') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  Performance Visualizations
                </h3>
              </div>
              {expandedSections.has('charts') && (
                <div className="charts-grid">
                  {/* Margin Trend Chart */}
                  {packet.charts.marginTrend && (
                    <div className="chart-container wide">
                      <h4>{packet.charts.marginTrend.title}</h4>
                      <div className="chart-stats">
                        <span>High: {packet.charts.marginTrend.high?.toFixed(1)}%</span>
                        <span>Low: {packet.charts.marginTrend.low?.toFixed(1)}%</span>
                        <span>Avg: {packet.charts.marginTrend.avg?.toFixed(1)}%</span>
                        <span className={`trend-badge ${packet.charts.marginTrend.direction}`}>
                          {packet.charts.marginTrend.direction === 'up' ? '↑ Improving' : packet.charts.marginTrend.direction === 'down' ? '↓ Declining' : '→ Stable'}
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={packet.charts.marginTrend.data}>
                          <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} tickFormatter={(v) => `${v}%`} />
                          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Margin']} labelFormatter={(label) => `Period: ${label}`} />
                          <Line type="monotone" dataKey="benchmark" stroke="#f59e0b" strokeDasharray="5 5" dot={false} name="Target" />
                          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Margin" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Cost Breakdown Pie Chart */}
                  {packet.charts.costBreakdown && packet.charts.costBreakdown.data.length > 0 && (
                    <div className="chart-container">
                      <h4>{packet.charts.costBreakdown.title}</h4>
                      <p className="chart-total">Total: ${packet.charts.costBreakdown.total?.toFixed(0)}/day</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={packet.charts.costBreakdown.data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            label={({ name, payload }) => `${name}: ${payload?.pct?.toFixed(0) ?? 0}%`}
                          >
                            {packet.charts.costBreakdown.data.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`$${Number(value).toFixed(0)}`, 'Cost PPD']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Payer Mix Pie Chart */}
                  {packet.charts.payerMix && packet.charts.payerMix.data.length > 0 && (
                    <div className="chart-container">
                      <h4>{packet.charts.payerMix.title}</h4>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={packet.charts.payerMix.data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            label={({ name, value }) => `${name}: ${Number(value).toFixed(0)}%`}
                          >
                            {packet.charts.payerMix.data.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Mix']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* KPI vs Benchmark Bar Chart */}
                  {packet.charts.kpiComparison && (
                    <div className="chart-container wide">
                      <h4>{packet.charts.kpiComparison.title}</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={packet.charts.kpiComparison.data} layout="vertical">
                          <XAxis type="number" tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                          <Tooltip />
                          <Bar dataKey="facility" fill="#3b82f6" name="This Facility" />
                          <Bar dataKey="portfolio" fill="#9ca3af" name="Portfolio Avg" />
                          <Bar dataKey="target" fill="#22c55e" name="Target" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Peer Comparison Section (for facility scope) */}
          {scope === 'facility' && packet.peerAnalysis && (
            <div className="packet-section">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('peerAnalysis')}
              >
                <h3>
                  {expandedSections.has('peerAnalysis') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <Building2 size={20} className="section-icon" />
                  {packet.peerAnalysis.title}
                </h3>
              </div>
              {expandedSections.has('peerAnalysis') && (
                <div className="section-content">
                  <div className="peer-summary">
                    <div className="peer-rank-card">
                      <span className="rank-value">#{packet.peerAnalysis.currentRank}</span>
                      <span className="rank-label">of {packet.peerAnalysis.totalPeers} peers</span>
                      <span className="percentile-badge">{packet.peerAnalysis.percentile}th percentile</span>
                    </div>
                    <p className="peer-insight">{packet.peerAnalysis.insight}</p>
                  </div>
                  {packet.peerAnalysis.peers && packet.peerAnalysis.peers.length > 0 && (
                    <div className="peer-list">
                      <table className="peer-table">
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Facility</th>
                            <th>Margin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {packet.peerAnalysis.peers.map((peer: any) => (
                            <tr key={peer.facility_id} className={peer.isCurrentFacility ? 'current-facility' : ''}>
                              <td>#{peer.rank}</td>
                              <td>{peer.name} {peer.isCurrentFacility && <span className="you-badge">← This Facility</span>}</td>
                              <td className={peer.margin >= 10 ? 'positive' : peer.margin >= 0 ? '' : 'negative'}>{peer.margin?.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Historical Summary (for facility scope) */}
          {scope === 'facility' && packet.historicalSummary && (
            <div className="packet-section">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('historicalSummary')}
              >
                <h3>
                  {expandedSections.has('historicalSummary') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <TrendingUp size={20} className="section-icon" />
                  12-Month Historical Summary
                </h3>
              </div>
              {expandedSections.has('historicalSummary') && (
                <div className="historical-stats">
                  <div className="stat-card">
                    <span className="stat-value">{packet.historicalSummary.t12mAvgMargin?.toFixed(1)}%</span>
                    <span className="stat-label">T12M Avg Margin</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value positive">{packet.historicalSummary.t12mHighMargin?.toFixed(1)}%</span>
                    <span className="stat-label">T12M High</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value negative">{packet.historicalSummary.t12mLowMargin?.toFixed(1)}%</span>
                    <span className="stat-label">T12M Low</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{packet.historicalSummary.marginVolatility?.toFixed(0)}%</span>
                    <span className="stat-label">Volatility (CV)</span>
                  </div>
                  <div className="stat-card">
                    <span className={`stat-value ${packet.historicalSummary.trendDirection === 'up' ? 'positive' : packet.historicalSummary.trendDirection === 'down' ? 'negative' : ''}`}>
                      {packet.historicalSummary.trendDirection === 'up' ? '↑ Improving' : packet.historicalSummary.trendDirection === 'down' ? '↓ Declining' : '→ Stable'}
                    </span>
                    <span className="stat-label">Overall Trend</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{packet.historicalSummary.monthsImproving} / {packet.historicalSummary.monthsDeclining}</span>
                    <span className="stat-label">Months Up / Down</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Portfolio Summary or Facility Info */}
          {scope === 'portfolio' && packet.portfolioSummary && (
            <div className="packet-section">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('summary')}
              >
                <h3>
                  {expandedSections.has('summary') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  Portfolio Summary
                </h3>
              </div>
              {expandedSections.has('summary') && (
                <div className="summary-grid">
                  <div className="summary-card">
                    <span className="summary-value">{packet.portfolioSummary.totalFacilities}</span>
                    <span className="summary-label">Total Facilities</span>
                  </div>
                  <div className="summary-card">
                    <span className="summary-value">{packet.portfolioSummary.totalBeds?.toLocaleString()}</span>
                    <span className="summary-label">Total Beds</span>
                  </div>
                  <div className="summary-card highlight">
                    <span className={`summary-value ${packet.portfolioSummary.avgMargin >= 10 ? 'positive' : packet.portfolioSummary.avgMargin >= 0 ? 'warning' : 'negative'}`}>
                      {packet.portfolioSummary.avgMargin?.toFixed(1)}%
                    </span>
                    <span className="summary-label">Avg Operating Margin</span>
                  </div>
                  <div className="summary-card">
                    <span className="summary-value positive">{packet.portfolioSummary.profitableFacilities}</span>
                    <span className="summary-label">Profitable</span>
                  </div>
                  <div className="summary-card">
                    <span className="summary-value negative">{packet.portfolioSummary.facilitiesAtRisk}</span>
                    <span className="summary-label">At Risk</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Going Well Section */}
          {packet.goingWell && (
            <div className="packet-section going-well">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('goingWell')}
              >
                <h3>
                  {expandedSections.has('goingWell') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <CheckCircle size={20} className="section-icon success" />
                  {packet.goingWell.title || "What's Going Well"}
                </h3>
              </div>
              {expandedSections.has('goingWell') && (
                <div className="section-content">
                  <div className="narrative-text">
                    <p>{packet.goingWell.narrative}</p>
                  </div>

                  {packet.goingWell.bulletPoints && (
                    <div className="bullet-points success">
                      {packet.goingWell.bulletPoints.map((point: string, i: number) => (
                        <div key={i} className="bullet-item">
                          <CheckCircle size={16} />
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {packet.goingWell.topPerformers && packet.goingWell.topPerformers.length > 0 && (
                    <div className="performers-list">
                      <h4>Top Performers</h4>
                      <div className="performers-grid">
                        {packet.goingWell.topPerformers.slice(0, 8).map((f: any, i: number) => (
                          <div key={i} className="performer-card success">
                            <span className="performer-name">{f.name}</span>
                            <span className="performer-state">{f.state}</span>
                            <span className="performer-margin">{f.margin?.toFixed(1)}%</span>
                            <span className="performer-badge">{f.highlight}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Needs Work Section */}
          {packet.needsWork && (
            <div className="packet-section needs-work">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('needsWork')}
              >
                <h3>
                  {expandedSections.has('needsWork') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <AlertTriangle size={20} className="section-icon warning" />
                  {packet.needsWork.title || 'Areas Requiring Attention'}
                </h3>
              </div>
              {expandedSections.has('needsWork') && (
                <div className="section-content">
                  <div className="narrative-text">
                    <p>{packet.needsWork.narrative}</p>
                  </div>

                  {packet.needsWork.bulletPoints && (
                    <div className="bullet-points warning">
                      {packet.needsWork.bulletPoints.map((point: string, i: number) => (
                        <div key={i} className="bullet-item">
                          <AlertTriangle size={16} />
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {packet.needsWork.underperformers && packet.needsWork.underperformers.length > 0 && (
                    <div className="performers-list">
                      <h4>Facilities Requiring Attention</h4>
                      <div className="underperformers-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Facility</th>
                              <th>State</th>
                              <th>Margin</th>
                              <th>Issue</th>
                              <th>Recommendation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {packet.needsWork.underperformers.map((f: any, i: number) => (
                              <tr key={i}>
                                <td className="facility-name">{f.name}</td>
                                <td>{f.state}</td>
                                <td className={f.margin < 0 ? 'negative' : 'warning'}>{f.margin?.toFixed(1)}%</td>
                                <td><span className="issue-badge">{f.issue}</span></td>
                                <td className="recommendation">{f.recommendation}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Charts Section (for portfolio/state/opco scopes) */}
          {scope !== 'facility' && packet.charts && (
            <div className="packet-section">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('charts')}
              >
                <h3>
                  {expandedSections.has('charts') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  Performance Charts
                </h3>
              </div>
              {expandedSections.has('charts') && (
                <div className="charts-grid">
                  {packet.charts.marginDistribution && (
                    <div className="chart-card">
                      <h4>Margin Distribution</h4>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={packet.charts.marginDistribution}>
                            <XAxis dataKey="range" stroke="rgba(255,255,255,0.5)" fontSize={11} />
                            <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} />
                            <Tooltip
                              contentStyle={{ background: 'rgba(15,15,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                              {packet.charts.marginDistribution.map((entry: any, index: number) => (
                                <Cell key={index} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {packet.charts.statePerformance && (
                    <div className="chart-card">
                      <h4>Average Margin by State</h4>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={packet.charts.statePerformance} layout="vertical">
                            <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={11} />
                            <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={11} width={30} />
                            <Tooltip
                              contentStyle={{ background: 'rgba(15,15,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                              formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Avg Margin']}
                            />
                            <Bar dataKey="value" fill="#667eea" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {packet.charts.marginTrend && packet.charts.marginTrend.data && packet.charts.marginTrend.data.length > 0 && (
                    <div className="chart-card">
                      <h4>{packet.charts.marginTrend.title}</h4>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={packet.charts.marginTrend.data}>
                            <XAxis dataKey="period" stroke="rgba(255,255,255,0.5)" fontSize={10} tickFormatter={(v) => v.substring(5)} />
                            <YAxis stroke="rgba(255,255,255,0.5)" fontSize={11} />
                            <Tooltip
                              contentStyle={{ background: 'rgba(15,15,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                              formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Margin']}
                            />
                            <Line type="monotone" dataKey="value" stroke="#667eea" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {packet.charts.payerMix && (
                    <div className="chart-card">
                      <h4>Payer Mix</h4>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={packet.charts.payerMix}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={3}
                            >
                              {packet.charts.payerMix.map((entry: any, index: number) => (
                                <Cell key={index} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: 'rgba(15,15,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                              formatter={(value) => [`${(value as number).toFixed(1)}%`, '']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pie-legend">
                          {packet.charts.payerMix.map((entry: any, i: number) => (
                            <div key={i} className="legend-item">
                              <span className="legend-dot" style={{ background: entry.color }} />
                              <span>{entry.name}: {entry.value?.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Individual Facility Summaries */}
          {packet.facilitySummaries && packet.facilitySummaries.length > 0 && (
            <div className="packet-section">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('facilities')}
              >
                <h3>
                  {expandedSections.has('facilities') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  Individual Facility Summaries ({packet.facilitySummaries.length})
                </h3>
              </div>
              {expandedSections.has('facilities') && (
                <div className="facility-summaries">
                  {packet.facilitySummaries.map((f: any, i: number) => (
                    <div key={i} className={`facility-summary-card status-${f.status}`}>
                      <div className="facility-summary-header">
                        <div className="facility-info">
                          <span className="facility-name">{f.name}</span>
                          <span className="facility-meta">{f.state} | {f.setting} | {f.beds} beds</span>
                        </div>
                        <div className="facility-metrics">
                          <span className={`margin-badge ${f.margin >= 10 ? 'positive' : f.margin >= 0 ? 'warning' : 'negative'}`}>
                            {f.margin?.toFixed(1)}%
                            {f.marginChange !== undefined && (
                              <span className={`margin-change ${f.marginChange >= 0 ? 'up' : 'down'}`}>
                                {f.marginChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                {Math.abs(f.marginChange).toFixed(1)}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      <p className="facility-narrative">{f.narrative}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Detailed Narrative for Single Facility */}
          {packet.detailedNarrative && (
            <div className="packet-section">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('detailed')}
              >
                <h3>
                  {expandedSections.has('detailed') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  Detailed Analysis
                </h3>
              </div>
              {expandedSections.has('detailed') && (
                <div className="detailed-narrative" dangerouslySetInnerHTML={{ __html: formatMarkdown(packet.detailedNarrative) }} />
              )}
            </div>
          )}

          {/* Predictions Section (Enhanced Facility Packet) */}
          {packet.predictions && packet.predictions.items && packet.predictions.items.length > 0 && (
            <div className="packet-section predictions">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('predictions')}
              >
                <h3>
                  {expandedSections.has('predictions') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <Target size={20} className="section-icon info" />
                  {packet.predictions.title || '3-Month Outlook'}
                </h3>
              </div>
              {expandedSections.has('predictions') && (
                <div className="section-content">
                  {packet.predictions.summary && (
                    <div className="prediction-summary">
                      <p>{packet.predictions.summary}</p>
                    </div>
                  )}
                  <div className="predictions-grid">
                    {packet.predictions.items.map((pred: any, i: number) => (
                      <div key={i} className={`prediction-card confidence-${pred.confidence}`}>
                        <div className="prediction-header">
                          <span className="prediction-metric">{pred.metric}</span>
                          <span className={`confidence-badge ${pred.confidence}`}>{pred.confidence}</span>
                        </div>
                        <div className="prediction-values">
                          <div className="current-value">
                            <span className="label">Current</span>
                            <span className="value">{pred.currentValue?.toFixed(1)}</span>
                          </div>
                          <div className="arrow">→</div>
                          <div className="predicted-value">
                            <span className="label">Predicted</span>
                            <span className={`value ${pred.predictedChange >= 0 ? 'positive' : 'negative'}`}>
                              {pred.predictedValue?.toFixed(1)}
                              <span className="change">
                                ({pred.predictedChange >= 0 ? '+' : ''}{pred.predictedChange?.toFixed(1)})
                              </span>
                            </span>
                          </div>
                        </div>
                        <p className="prediction-reasoning">{pred.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Opportunities Section (Enhanced Facility Packet) */}
          {packet.opportunities && packet.opportunities.items && packet.opportunities.items.length > 0 && (
            <div className="packet-section opportunities">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('opportunities')}
              >
                <h3>
                  {expandedSections.has('opportunities') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <Lightbulb size={20} className="section-icon opportunity" />
                  {packet.opportunities.title || 'Opportunities'}
                </h3>
              </div>
              {expandedSections.has('opportunities') && (
                <div className="section-content">
                  <p className="section-summary">{packet.opportunities.totalPotential}</p>
                  <div className="opportunities-grid">
                    {packet.opportunities.items.map((opp: any, i: number) => (
                      <div key={i} className={`opportunity-card priority-${opp.priority}`}>
                        <div className="opportunity-header">
                          <span className={`type-badge ${opp.type}`}>{opp.type}</span>
                          <span className={`priority-badge ${opp.priority}`}>{opp.priority}</span>
                        </div>
                        <h4>{opp.title}</h4>
                        <p className="description">{opp.description}</p>
                        <div className="impact">
                          <TrendingUp size={14} />
                          <span>{opp.potentialImpact}</span>
                        </div>
                        {opp.relatedMetrics && opp.relatedMetrics.length > 0 && (
                          <div className="related-metrics">
                            {opp.relatedMetrics.map((m: string, j: number) => (
                              <span key={j} className="metric-tag">{m}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pitfalls Section (Enhanced Facility Packet) */}
          {packet.pitfalls && packet.pitfalls.items && packet.pitfalls.items.length > 0 && (
            <div className="packet-section pitfalls">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('pitfalls')}
              >
                <h3>
                  {expandedSections.has('pitfalls') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <Shield size={20} className="section-icon warning" />
                  {packet.pitfalls.title || 'Risks & Watch Items'}
                </h3>
              </div>
              {expandedSections.has('pitfalls') && (
                <div className="section-content">
                  <div className="pitfalls-grid">
                    {packet.pitfalls.items.map((pit: any, i: number) => (
                      <div key={i} className={`pitfall-card severity-${pit.severity}`}>
                        <div className="pitfall-header">
                          <span className={`type-badge ${pit.type}`}>{pit.type}</span>
                          <span className={`severity-badge ${pit.severity}`}>{pit.severity}</span>
                        </div>
                        <h4>{pit.title}</h4>
                        <p className="description">{pit.description}</p>
                        <div className="mitigation">
                          <strong>Mitigation:</strong> {pit.mitigation}
                        </div>
                        {pit.relatedMetrics && pit.relatedMetrics.length > 0 && (
                          <div className="related-metrics">
                            {pit.relatedMetrics.map((m: string, j: number) => (
                              <span key={j} className="metric-tag">{m}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recommendations */}
          {packet.recommendations && packet.recommendations.length > 0 && (
            <div className="packet-section">
              <div
                className="section-header clickable"
                onClick={() => toggleSection('recommendations')}
              >
                <h3>
                  {expandedSections.has('recommendations') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  Strategic Recommendations
                </h3>
              </div>
              {expandedSections.has('recommendations') && (
                <div className="recommendations-list">
                  {packet.recommendations.map((rec: string, i: number) => (
                    <div key={i} className="recommendation-item">
                      <span className="rec-number">{i + 1}</span>
                      <span className="rec-text">{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/## (.*)/g, '<h3>$1</h3>')
    .replace(/### (.*)/g, '<h4>$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/• (.*)/g, '<li>$1</li>')
    .replace(/\n/g, '<br/>');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateEnhancedPacketHTML(packet: any, _scope: string): string {
  // Build facility summaries table rows if available
  void (packet.facilitySummaries ? packet.facilitySummaries.map((f: any) => `
    <div class="facility-row ${f.status}">
      <td>${f.name}</td>
      <td>${f.state}</td>
      <td>${f.setting}</td>
      <td class="${f.margin >= 10 ? 'positive' : f.margin >= 0 ? 'warning' : 'negative'}">${f.margin?.toFixed(1)}%</td>
      <td>${f.narrative}</td>
    </div>
  `).join('') : '');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${packet.title}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; max-width: 1000px; margin: 0 auto; padding: 40px; color: #333; line-height: 1.6; }
        .cover { text-align: center; padding: 80px 0; page-break-after: always; }
        .cover h1 { font-size: 2.5em; color: #1a1a2e; margin-bottom: 10px; }
        .cover .subtitle { font-size: 1.3em; color: #667eea; }
        h2 { color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-top: 30px; }
        h3 { color: #1a1a2e; margin-top: 25px; }
        .going-well { background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .needs-work { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
        .metric-card { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 1.8em; font-weight: bold; color: #1a1a2e; }
        .metric-label { font-size: 0.85em; color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #667eea; color: white; }
        .positive { color: #10b981; }
        .warning { color: #f59e0b; }
        .negative { color: #ef4444; }
        .bullet { margin: 8px 0; padding-left: 20px; }
        .recommendation { background: #f0f4ff; padding: 12px 20px; margin: 8px 0; border-radius: 6px; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666; }
        @page { margin: 0.75in; }
        @media print { .page-break { page-break-before: always; } }
      </style>
    </head>
    <body>
      <div class="cover">
        <h1>${packet.title}</h1>
        <p class="subtitle">${packet.subtitle || 'Comprehensive Financial Analysis'}</p>
        <p style="margin-top:40px">Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p>SNFPNL.com</p>
      </div>

      <h2>Executive Summary</h2>
      ${packet.executiveNarrative ? `<div>${formatMarkdown(packet.executiveNarrative)}</div>` : ''}

      ${packet.portfolioSummary ? `
        <div class="metric-grid">
          <div class="metric-card"><div class="metric-value">${packet.portfolioSummary.totalFacilities}</div><div class="metric-label">Total Facilities</div></div>
          <div class="metric-card"><div class="metric-value">${packet.portfolioSummary.avgMargin?.toFixed(1)}%</div><div class="metric-label">Avg Margin</div></div>
          <div class="metric-card"><div class="metric-value positive">${packet.portfolioSummary.profitableFacilities}</div><div class="metric-label">Profitable</div></div>
          <div class="metric-card"><div class="metric-value negative">${packet.portfolioSummary.facilitiesAtRisk}</div><div class="metric-label">At Risk</div></div>
        </div>
      ` : ''}

      ${packet.goingWell ? `
        <div class="going-well">
          <h3>What's Going Well</h3>
          <p>${packet.goingWell.narrative}</p>
          ${packet.goingWell.bulletPoints ? packet.goingWell.bulletPoints.map((b: string) => `<div class="bullet">✓ ${b}</div>`).join('') : ''}
        </div>
      ` : ''}

      ${packet.needsWork ? `
        <div class="needs-work">
          <h3>Areas Requiring Attention</h3>
          <p>${packet.needsWork.narrative}</p>
          ${packet.needsWork.bulletPoints ? packet.needsWork.bulletPoints.map((b: string) => `<div class="bullet">⚠ ${b}</div>`).join('') : ''}
        </div>
      ` : ''}

      ${packet.facilitySummaries && packet.facilitySummaries.length > 0 ? `
        <div class="page-break"></div>
        <h2>Individual Facility Summaries</h2>
        <table>
          <thead>
            <tr><th>Facility</th><th>State</th><th>Type</th><th>Margin</th><th>Summary</th></tr>
          </thead>
          <tbody>
            ${packet.facilitySummaries.map((f: any) => `
              <tr>
                <td><strong>${f.name}</strong></td>
                <td>${f.state}</td>
                <td>${f.setting}</td>
                <td class="${f.margin >= 10 ? 'positive' : f.margin >= 0 ? 'warning' : 'negative'}">${f.margin?.toFixed(1)}%</td>
                <td>${f.narrative}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${packet.detailedNarrative ? `
        <div class="page-break"></div>
        <h2>Detailed Analysis</h2>
        <div>${formatMarkdown(packet.detailedNarrative)}</div>
      ` : ''}

      ${packet.recommendations && packet.recommendations.length > 0 ? `
        <h2>Strategic Recommendations</h2>
        ${packet.recommendations.map((r: string, i: number) => `<div class="recommendation"><strong>${i + 1}.</strong> ${r}</div>`).join('')}
      ` : ''}

      <div class="footer">
        <p>SNFPNL.com | SNF Financial Intelligence | Confidential</p>
      </div>
    </body>
    </html>
  `;
}
