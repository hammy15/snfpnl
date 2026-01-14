/**
 * Types for narrative report and financial packet components
 */

export interface NarrativeReportData {
  facilities?: Array<{ id: string; name: string; metrics?: Record<string, number | null> }>;
  kpis?: Array<{ kpi_id: string; value: number | null }>;
  alerts?: Array<{ type: string; message: string }>;
  [key: string]: unknown;
}

export interface NarrativeReportProps {
  context: 'dashboard' | 'facility' | 'comparison' | 'alerts' | 'ppd' | 'executive' | 'directory' | 'heatmap';
  periodId: string;
  facilityId?: string;
  data?: NarrativeReportData;
  title?: string;
}

export interface NarrativeSection {
  title: string;
  content: string;
  type: 'summary' | 'analysis' | 'trends' | 'recommendations' | 'questions';
}

export interface GeneratedNarrative {
  title: string;
  generatedAt: string;
  sections: NarrativeSection[];
  metadata: {
    periodId: string;
    facilityId?: string;
    context: string;
  };
}

export interface FinancialPacketProps {
  facilityId?: string;
  periodId: string;
}

export type PacketScope = 'facility' | 'state' | 'opco' | 'portfolio';

export interface PacketOptions {
  states: string[];
  opcos: string[];
  facilities: { id: string; name: string; state: string }[];
}

// The financial packet has a highly dynamic structure from the API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FinancialPacket = Record<string, any>;

// Helper types for map callbacks
export interface ChartEntry {
  name: string;
  color: string;
  value?: number;
  pct?: number;
  count?: number;
}

export interface PeerEntry {
  facility_id: string;
  name: string;
  rank: number;
  margin: number;
  isCurrentFacility?: boolean;
}

export interface FacilityEntry {
  name: string;
  state: string;
  margin: number;
  highlight?: string;
  issue?: string;
  recommendation?: string;
  narrative?: string;
  setting?: string;
  status?: string;
  marginChange?: number;
  beds?: number;
}

export interface PredictionEntry {
  metric: string;
  currentValue?: number;
  predictedValue?: number;
  predictedChange?: number;
  confidence: string;
  reasoning?: string;
}

export interface OpportunityEntry {
  title: string;
  description: string;
  type: string;
  priority: string;
  potentialImpact: string;
  relatedMetrics?: string[];
}

export interface PitfallEntry {
  title: string;
  description: string;
  type: string;
  severity: string;
  mitigation: string;
  relatedMetrics?: string[];
}

export interface SummaryMetric {
  value?: number;
  status?: string;
  change?: number;
  portfolioAvg?: number;
}

export interface PacketSummaryMetrics {
  operatingMargin?: SummaryMetric;
  revenuePPD?: SummaryMetric;
  costPPD?: SummaryMetric;
  spread?: SummaryMetric;
  skilledMix?: SummaryMetric;
  contractLabor?: SummaryMetric;
  occupancy?: SummaryMetric;
  nursingHPPD?: SummaryMetric;
}
