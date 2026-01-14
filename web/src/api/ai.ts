/**
 * AI and narrative generation API endpoints
 */

import { get, post } from './client';

export interface NarrativeSection {
  title: string;
  content: string;
  type: 'summary' | 'analysis' | 'trends' | 'recommendations' | 'questions';
}

export interface GeneratedNarrative {
  title: string;
  generatedAt: string;
  sections: NarrativeSection[];
  [key: string]: unknown;
}

export interface FinancialPacketOptions {
  scopes: string[];
  facilities: Array<{ id: string; name: string }>;
  periods: Array<{ id: string; name: string }>;
}

export interface FinancialPacket {
  id: string;
  scope: string;
  executiveNarrative: string;
  detailedNarrative?: string;
  portfolioSummary?: {
    totalFacilities: number;
    avgMargin: number;
    profitableFacilities: number;
    facilitiesAtRisk: number;
  };
  goingWell?: { narrative: string; bulletPoints?: string[] };
  needsWork?: { narrative: string; bulletPoints?: string[] };
  recommendations?: string[];
  [key: string]: unknown;
}

export interface AIInsights {
  summary: string;
  insights: Array<{ type: string; title: string; description: string }>;
  recommendations: string[];
  [key: string]: unknown;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  response: string;
  context?: Record<string, unknown>;
}

export interface NaturalQueryResult {
  query: string;
  interpretation: string;
  results: unknown[];
  visualizations?: Array<{ type: string; data: unknown }>;
  [key: string]: unknown;
}

/**
 * Generate narrative report
 */
export function generateNarrative(params: {
  context: string;
  periodId: string;
  facilityId?: string;
  data?: unknown;
}): Promise<GeneratedNarrative> {
  return post<GeneratedNarrative>('/narrative/generate', params);
}

/**
 * Get financial packet options
 */
export function getPacketOptions(): Promise<FinancialPacketOptions> {
  return get<FinancialPacketOptions>('/narrative/packet-options');
}

/**
 * Generate financial packet
 */
export function generateFinancialPacket(params: {
  scope: string;
  facilityId?: string;
  periodId: string;
}): Promise<FinancialPacket> {
  return post<FinancialPacket>('/narrative/financial-packet', params);
}

/**
 * Get AI insights for a facility
 */
export function getAIInsights(facilityId: string, periodId: string): Promise<AIInsights> {
  return get<AIInsights>(`/ai-insights/${facilityId}/${periodId}`);
}

/**
 * Ask AI a question
 */
export function askAI(params: {
  question: string;
  facilityId?: string;
  periodId?: string;
  context?: unknown;
}): Promise<{ answer: string }> {
  return post<{ answer: string }>('/ai-insights/ask', params);
}

/**
 * Chat with AI assistant
 */
export function chatWithAI(params: {
  message: string;
  history?: ChatMessage[];
  context?: unknown;
}): Promise<ChatResponse> {
  return post<ChatResponse>('/ai/chat', params);
}

/**
 * Execute natural language query
 */
export function naturalQuery(query: string): Promise<NaturalQueryResult> {
  return post<NaturalQueryResult>('/natural-query', { query });
}
