/**
 * Collapsible sections for financial packet display
 */

import { ChevronDown, ChevronRight, Building2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Target, Lightbulb, Shield } from 'lucide-react';
import { formatMarkdownSafe } from '../../utils/sanitize';
import type { FinancialPacket, PacketScope, PeerEntry, FacilityEntry, PredictionEntry, OpportunityEntry, PitfallEntry } from './types';

interface SectionProps {
  packet: FinancialPacket;
  scope: PacketScope;
  expandedSections: Set<string>;
  toggleSection: (section: string) => void;
}

export function FacilityMetricsSection({ packet, scope, expandedSections, toggleSection }: SectionProps) {
  if (scope !== 'facility' || !packet.summaryMetrics) return null;

  return (
    <div className="packet-section">
      <div className="section-header clickable" onClick={() => toggleSection('facilityMetrics')}>
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
  );
}

export function PeerAnalysisSection({ packet, scope, expandedSections, toggleSection }: SectionProps) {
  if (scope !== 'facility' || !packet.peerAnalysis) return null;

  return (
    <div className="packet-section">
      <div className="section-header clickable" onClick={() => toggleSection('peerAnalysis')}>
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
          {packet.peerAnalysis.peers?.length > 0 && (
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
                  {packet.peerAnalysis.peers.map((peer: PeerEntry) => (
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
  );
}

export function HistoricalSummarySection({ packet, scope, expandedSections, toggleSection }: SectionProps) {
  if (scope !== 'facility' || !packet.historicalSummary) return null;

  return (
    <div className="packet-section">
      <div className="section-header clickable" onClick={() => toggleSection('historicalSummary')}>
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
  );
}

export function PortfolioSummarySection({ packet, scope, expandedSections, toggleSection }: SectionProps) {
  if (scope !== 'portfolio' || !packet.portfolioSummary) return null;

  return (
    <div className="packet-section">
      <div className="section-header clickable" onClick={() => toggleSection('summary')}>
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
  );
}

export function GoingWellSection({ packet, expandedSections, toggleSection }: Omit<SectionProps, 'scope'>) {
  if (!packet.goingWell) return null;

  return (
    <div className="packet-section going-well">
      <div className="section-header clickable" onClick={() => toggleSection('goingWell')}>
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
          {packet.goingWell.bulletPoints?.length > 0 && (
            <ul className="bullet-list success">
              {packet.goingWell.bulletPoints.map((point: string, i: number) => (
                <li key={i}><CheckCircle size={16} /> {point}</li>
              ))}
            </ul>
          )}
          {packet.goingWell.topPerformers?.length > 0 && (
            <div className="performers-list">
              <h4>Top Performers</h4>
              {packet.goingWell.topPerformers.map((f: FacilityEntry, i: number) => (
                <div key={i} className="performer-item positive">
                  <span className="performer-name">{f.name}</span>
                  <span className="performer-state">{f.state}</span>
                  <span className="performer-margin positive">{f.margin?.toFixed(1)}%</span>
                  {f.highlight && <span className="performer-highlight">{f.highlight}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NeedsWorkSection({ packet, expandedSections, toggleSection }: Omit<SectionProps, 'scope'>) {
  if (!packet.needsWork) return null;

  return (
    <div className="packet-section needs-work">
      <div className="section-header clickable" onClick={() => toggleSection('needsWork')}>
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
          {packet.needsWork.bulletPoints?.length > 0 && (
            <ul className="bullet-list warning">
              {packet.needsWork.bulletPoints.map((point: string, i: number) => (
                <li key={i}><AlertTriangle size={16} /> {point}</li>
              ))}
            </ul>
          )}
          {packet.needsWork.facilitiesAtRisk?.length > 0 && (
            <div className="performers-list">
              <h4>Facilities Requiring Attention</h4>
              {packet.needsWork.facilitiesAtRisk.map((f: FacilityEntry, i: number) => (
                <div key={i} className="performer-item negative">
                  <span className="performer-name">{f.name}</span>
                  <span className="performer-state">{f.state}</span>
                  <span className="performer-margin negative">{f.margin?.toFixed(1)}%</span>
                  {f.issue && <span className="performer-issue">{f.issue}</span>}
                  {f.recommendation && <span className="performer-recommendation">{f.recommendation}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PredictionsSection({ packet, expandedSections, toggleSection }: Omit<SectionProps, 'scope'>) {
  if (!packet.predictions?.length) return null;

  return (
    <div className="packet-section predictions">
      <div className="section-header clickable" onClick={() => toggleSection('predictions')}>
        <h3>
          {expandedSections.has('predictions') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <Target size={20} className="section-icon" />
          Predictive Insights
        </h3>
      </div>
      {expandedSections.has('predictions') && (
        <div className="predictions-grid">
          {packet.predictions.map((pred: PredictionEntry, i: number) => (
            <div key={i} className={`prediction-card ${pred.predictedChange && pred.predictedChange >= 0 ? 'positive' : 'negative'}`}>
              <div className="prediction-header">
                <span className="prediction-metric">{pred.metric}</span>
                <span className={`prediction-confidence ${pred.confidence.toLowerCase()}`}>{pred.confidence}</span>
              </div>
              <div className="prediction-values">
                <div className="current">
                  <span className="label">Current</span>
                  <span className="value">{pred.currentValue?.toFixed(1)}%</span>
                </div>
                <span className="arrow">{pred.predictedChange && pred.predictedChange >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}</span>
                <div className="predicted">
                  <span className="label">Predicted</span>
                  <span className="value">{pred.predictedValue?.toFixed(1)}%</span>
                </div>
              </div>
              {pred.reasoning && <p className="prediction-reasoning">{pred.reasoning}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OpportunitiesSection({ packet, expandedSections, toggleSection }: Omit<SectionProps, 'scope'>) {
  if (!packet.opportunities?.length) return null;

  return (
    <div className="packet-section opportunities">
      <div className="section-header clickable" onClick={() => toggleSection('opportunities')}>
        <h3>
          {expandedSections.has('opportunities') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <Lightbulb size={20} className="section-icon" />
          Opportunities
        </h3>
      </div>
      {expandedSections.has('opportunities') && (
        <div className="opportunities-list">
          {packet.opportunities.map((opp: OpportunityEntry, i: number) => (
            <div key={i} className={`opportunity-card priority-${opp.priority.toLowerCase()}`}>
              <div className="opportunity-header">
                <span className="opportunity-title">{opp.title}</span>
                <span className={`priority-badge ${opp.priority.toLowerCase()}`}>{opp.priority}</span>
              </div>
              <p className="opportunity-description">{opp.description}</p>
              <div className="opportunity-footer">
                <span className="opportunity-type">{opp.type}</span>
                <span className="opportunity-impact">Impact: {opp.potentialImpact}</span>
              </div>
              {opp.relatedMetrics && opp.relatedMetrics.length > 0 && (
                <div className="related-metrics">
                  {opp.relatedMetrics.map((m, j) => <span key={j} className="metric-tag">{m}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PitfallsSection({ packet, expandedSections, toggleSection }: Omit<SectionProps, 'scope'>) {
  if (!packet.pitfalls?.length) return null;

  return (
    <div className="packet-section pitfalls">
      <div className="section-header clickable" onClick={() => toggleSection('pitfalls')}>
        <h3>
          {expandedSections.has('pitfalls') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <Shield size={20} className="section-icon" />
          Potential Pitfalls
        </h3>
      </div>
      {expandedSections.has('pitfalls') && (
        <div className="pitfalls-list">
          {packet.pitfalls.map((pit: PitfallEntry, i: number) => (
            <div key={i} className={`pitfall-card severity-${pit.severity.toLowerCase()}`}>
              <div className="pitfall-header">
                <span className="pitfall-title">{pit.title}</span>
                <span className={`severity-badge ${pit.severity.toLowerCase()}`}>{pit.severity}</span>
              </div>
              <p className="pitfall-description">{pit.description}</p>
              <div className="pitfall-mitigation">
                <strong>Mitigation:</strong> {pit.mitigation}
              </div>
              {pit.relatedMetrics && pit.relatedMetrics.length > 0 && (
                <div className="related-metrics">
                  {pit.relatedMetrics.map((m, j) => <span key={j} className="metric-tag">{m}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FacilitySummariesSection({ packet, scope, expandedSections, toggleSection }: SectionProps) {
  if (scope === 'facility' || !packet.facilitySummaries?.length) return null;

  return (
    <div className="packet-section facility-summaries">
      <div className="section-header clickable" onClick={() => toggleSection('facilitySummaries')}>
        <h3>
          {expandedSections.has('facilitySummaries') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <Building2 size={20} className="section-icon" />
          Individual Facility Summaries
        </h3>
      </div>
      {expandedSections.has('facilitySummaries') && (
        <div className="facility-cards">
          {packet.facilitySummaries.map((f: FacilityEntry, i: number) => (
            <div key={i} className={`facility-card ${f.status || ''}`}>
              <div className="facility-header">
                <div className="facility-info">
                  <span className="facility-name">{f.name}</span>
                  <span className="facility-meta">{f.state} • {f.setting} • {f.beds} beds</span>
                </div>
                <div className="facility-margin">
                  <span className={`margin-value ${f.margin >= 10 ? 'positive' : f.margin >= 0 ? 'warning' : 'negative'}`}>
                    {f.margin?.toFixed(1)}%
                  </span>
                  {f.marginChange !== undefined && (
                    <span className={`margin-change ${f.marginChange >= 0 ? 'up' : 'down'}`}>
                      {f.marginChange >= 0 ? '↑' : '↓'} {Math.abs(f.marginChange).toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              {f.narrative && <p className="facility-narrative">{f.narrative}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DetailedNarrativeSection({ packet, expandedSections, toggleSection }: Omit<SectionProps, 'scope'>) {
  if (!packet.detailedNarrative) return null;

  return (
    <div className="packet-section detailed">
      <div className="section-header clickable" onClick={() => toggleSection('detailed')}>
        <h3>
          {expandedSections.has('detailed') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          Detailed Analysis
        </h3>
      </div>
      {expandedSections.has('detailed') && (
        <div className="detailed-narrative" dangerouslySetInnerHTML={{ __html: formatMarkdownSafe(packet.detailedNarrative) }} />
      )}
    </div>
  );
}

export function RecommendationsSection({ packet, expandedSections, toggleSection }: Omit<SectionProps, 'scope'>) {
  if (!packet.recommendations?.length) return null;

  return (
    <div className="packet-section recommendations">
      <div className="section-header clickable" onClick={() => toggleSection('recommendations')}>
        <h3>
          {expandedSections.has('recommendations') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <Target size={20} className="section-icon" />
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
  );
}
