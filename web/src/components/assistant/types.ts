/**
 * Type definitions for the AI Assistant component
 */

export interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  selectedFacility?: string | null;
  facilities?: Facility[];
}

export interface Facility {
  facility_id: string;
  name: string;
  state: string;
  setting: string;
}

export interface KPIData {
  kpi_id: string;
  value: number | null;
  period_id: string;
}

export interface AllKPIData extends KPIData {
  facility_id: string;
  setting: string;
  name: string;
  state: string;
}

export interface TrendData {
  period_id: string;
  value: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface BotSettings {
  personality: 'professional' | 'friendly' | 'concise' | 'detailed';
  focusAreas: string[];
  alertThresholds: AlertThresholds;
}

export interface AlertThresholds {
  operatingMargin: number;
  contractLabor: number;
  skilledMix: number;
  occupancy: number;
  revenuePPD: number;
  expensePPD: number;
  nursingHPRD: number;
  agencyNursing: number;
}

export interface AIContext {
  periodId: string;
  personality: string;
  facilityData?: {
    name: string;
    state: string;
    setting: string;
    margin?: number | null;
    skilledMix?: number | null;
    revenuePPD?: number | null;
    expensePPD?: number | null;
    contractLabor?: number | null;
    trend?: string;
    metrics?: Record<string, number | string | null>;
  };
  facility?: {
    name: string;
    state: string;
    setting: string;
    metrics: Record<string, number | string | null>;
  };
  trendSummary?: string;
  peerRankings?: Record<string, PeerRanking>;
  portfolioSummary?: PortfolioSummary;
}

export interface PeerRanking {
  rank: number;
  total: number;
  percentile: number;
}

export interface PortfolioSummary {
  totalFacilities: number;
  snfCount: number;
  states: string[];
  avgMargin: string;
  avgSkilledMix: string;
  avgContractLabor: string;
  topPerformers: PerformerEntry[];
  bottomPerformers: PerformerEntry[];
  facilitiesNeedingAttention: number;
  topPerformer?: string;
  bottomPerformer?: string;
}

export interface PerformerEntry {
  name: string;
  margin: number | null;
  state: string;
}

export interface QuickAction {
  icon: React.ReactNode;
  label: string;
  prompt: string;
}
