/**
 * Financial Packet Generator - generates comprehensive financial reports
 */

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { formatMarkdownSafe } from '../../utils/sanitize';
import { api } from '../../api';
import { PacketScopeSelector } from './PacketScopeSelector';
import { PacketCharts } from './PacketCharts';
import {
  FacilityMetricsSection,
  PeerAnalysisSection,
  HistoricalSummarySection,
  PortfolioSummarySection,
  GoingWellSection,
  NeedsWorkSection,
  PredictionsSection,
  OpportunitiesSection,
  PitfallsSection,
  FacilitySummariesSection,
  DetailedNarrativeSection,
  RecommendationsSection,
} from './PacketSections';
import type { FinancialPacketProps, PacketScope, PacketOptions, FinancialPacket } from './types';
import { generatePacketHTML } from './generatePacketHTML';

export function FinancialPacketGenerator({ facilityId, periodId }: FinancialPacketProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [packet, setPacket] = useState<FinancialPacket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<PacketScope>(facilityId ? 'facility' : 'portfolio');
  const [selectedFacility, setSelectedFacility] = useState(facilityId || '');
  const [selectedState, setSelectedState] = useState('');
  const [selectedOpco, setSelectedOpco] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'goingWell', 'needsWork', 'predictions', 'opportunities', 'pitfalls', 'facilityMetrics', 'charts', 'peerAnalysis', 'historicalSummary'])
  );
  const [options, setOptions] = useState<PacketOptions | null>(null);

  // Fetch available options on mount
  useEffect(() => {
    api.ai.getPacketOptions()
      .then(data => setOptions(data as unknown as PacketOptions))
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
      const params: { scope: string; periodId: string; facilityId?: string; stateName?: string; opcoName?: string } = {
        scope,
        periodId,
      };

      if (scope === 'facility') params.facilityId = selectedFacility;
      if (scope === 'state') params.stateName = selectedState;
      if (scope === 'opco') params.opcoName = selectedOpco;

      const result = await api.ai.generateFinancialPacket(params);
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

    const htmlContent = generatePacketHTML(packet, scope);
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="financial-packet-generator">
      <PacketScopeSelector
        scope={scope}
        onScopeChange={setScope}
        selectedFacility={selectedFacility}
        onFacilityChange={setSelectedFacility}
        selectedState={selectedState}
        onStateChange={setSelectedState}
        selectedOpco={selectedOpco}
        onOpcoChange={setSelectedOpco}
        options={options}
        isGenerating={isGenerating}
        onGenerate={generatePacket}
      />

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
            <div className="narrative-text" dangerouslySetInnerHTML={{ __html: formatMarkdownSafe(packet.executiveNarrative) }} />
          </div>

          {/* Facility-specific sections */}
          <FacilityMetricsSection packet={packet} scope={scope} expandedSections={expandedSections} toggleSection={toggleSection} />
          <PacketCharts packet={packet} scope={scope} expandedSections={expandedSections} toggleSection={toggleSection} />
          <PeerAnalysisSection packet={packet} scope={scope} expandedSections={expandedSections} toggleSection={toggleSection} />
          <HistoricalSummarySection packet={packet} scope={scope} expandedSections={expandedSections} toggleSection={toggleSection} />

          {/* Portfolio summary */}
          <PortfolioSummarySection packet={packet} scope={scope} expandedSections={expandedSections} toggleSection={toggleSection} />

          {/* Common sections */}
          <GoingWellSection packet={packet} expandedSections={expandedSections} toggleSection={toggleSection} />
          <NeedsWorkSection packet={packet} expandedSections={expandedSections} toggleSection={toggleSection} />
          <PredictionsSection packet={packet} expandedSections={expandedSections} toggleSection={toggleSection} />
          <OpportunitiesSection packet={packet} expandedSections={expandedSections} toggleSection={toggleSection} />
          <PitfallsSection packet={packet} expandedSections={expandedSections} toggleSection={toggleSection} />

          {/* Facility summaries (for non-facility scopes) */}
          <FacilitySummariesSection packet={packet} scope={scope} expandedSections={expandedSections} toggleSection={toggleSection} />

          {/* Detailed analysis and recommendations */}
          <DetailedNarrativeSection packet={packet} expandedSections={expandedSections} toggleSection={toggleSection} />
          <RecommendationsSection packet={packet} expandedSections={expandedSections} toggleSection={toggleSection} />
        </div>
      )}
    </div>
  );
}
