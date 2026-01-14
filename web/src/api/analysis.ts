/**
 * Analysis and comparison API endpoints
 */

import { get, post } from './client';

export interface ComparisonResult {
  period1: { id: string; metrics: Record<string, number> };
  period2: { id: string; metrics: Record<string, number> };
  changes: Record<string, { value: number; percent: number }>;
  [key: string]: unknown;
}

export interface PeerComparisonData {
  facility: { id: string; name: string; metrics: Record<string, number> };
  peers: Array<{ id: string; name: string; metrics: Record<string, number> }>;
  rankings: Record<string, number>;
  [key: string]: unknown;
}

export interface BenchmarkData {
  facility: Record<string, number>;
  benchmark: Record<string, number>;
  percentiles: Record<string, number>;
  [key: string]: unknown;
}

export interface WaterfallData {
  components: Array<{ name: string; value: number; cumulative: number }>;
  [key: string]: unknown;
}

export interface MarginWaterfallData {
  startValue: number;
  endValue: number;
  components: Array<{ name: string; value: number; type: 'positive' | 'negative' }>;
  [key: string]: unknown;
}

export interface BudgetVsActualData {
  categories: Array<{
    name: string;
    budget: number;
    actual: number;
    variance: number;
    variancePercent: number;
  }>;
  [key: string]: unknown;
}

export interface ForecastData {
  historical: Array<{ period: string; value: number }>;
  forecast: Array<{ period: string; value: number; confidence: { low: number; high: number } }>;
  [key: string]: unknown;
}

export interface BreakEvenData {
  fixedCosts: number;
  variableCostPerUnit: number;
  revenuePerUnit: number;
  breakEvenUnits: number;
  currentUnits: number;
  margin: number;
  [key: string]: unknown;
}

export interface FinancialRatios {
  liquidity: Record<string, number>;
  profitability: Record<string, number>;
  efficiency: Record<string, number>;
  [key: string]: unknown;
}

export interface CohortData {
  cohorts: Array<{
    name: string;
    count: number;
    avgMargin: number;
    avgRevenue: number;
  }>;
  [key: string]: unknown;
}

export interface HeatmapData {
  facilities: Array<{
    facility_id: string;
    name: string;
    metrics: Record<string, number>;
    status: 'good' | 'warning' | 'critical';
  }>;
  [key: string]: unknown;
}

export interface WhatIfResult {
  baseline: Record<string, number>;
  projected: Record<string, number>;
  impact: Record<string, { value: number; percent: number }>;
  [key: string]: unknown;
}

export interface SimulationBaseline {
  metrics: Record<string, number>;
  assumptions: Record<string, number>;
  [key: string]: unknown;
}

/**
 * Compare two periods
 */
export function comparePeriods(period1: string, period2: string): Promise<ComparisonResult> {
  return get<ComparisonResult>(`/comparison?period1=${period1}&period2=${period2}`);
}

/**
 * Compare multiple facilities
 */
export function compareFacilities(facilityIds: string[]): Promise<{ facilities: Record<string, Record<string, number>> }> {
  return post<{ facilities: Record<string, Record<string, number>> }>('/compare', { facilityIds });
}

/**
 * Get peer comparison for a facility
 */
export function getPeerComparison(facilityId: string, periodId: string): Promise<PeerComparisonData> {
  return get<PeerComparisonData>(`/peer-comparison/${facilityId}/${periodId}`);
}

/**
 * Get benchmark comparison
 */
export function getBenchmark(facilityId: string, periodId: string): Promise<BenchmarkData> {
  return get<BenchmarkData>(`/benchmark/${facilityId}/${periodId}`);
}

/**
 * Get waterfall chart data
 */
export function getWaterfall(facilityId: string, periodId: string): Promise<WaterfallData> {
  return get<WaterfallData>(`/waterfall/${facilityId}/${periodId}`);
}

/**
 * Get margin waterfall data
 */
export function getMarginWaterfall(facilityId: string, periodId: string): Promise<MarginWaterfallData> {
  return get<MarginWaterfallData>(`/margin-waterfall/${facilityId}/${periodId}`);
}

/**
 * Get budget vs actual data
 */
export function getBudgetVsActual(facilityId: string, periodId: string): Promise<BudgetVsActualData> {
  return get<BudgetVsActualData>(`/budget-vs-actual/${facilityId}/${periodId}`);
}

/**
 * Get forecast data for a KPI
 */
export function getForecast(facilityId: string, kpiId: string): Promise<ForecastData> {
  return get<ForecastData>(`/forecast/${facilityId}/${kpiId}`);
}

/**
 * Get break-even analysis
 */
export function getBreakEven(facilityId: string, periodId: string): Promise<BreakEvenData> {
  return get<BreakEvenData>(`/break-even/${facilityId}/${periodId}`);
}

/**
 * Get financial ratios
 */
export function getFinancialRatios(facilityId: string, periodId: string): Promise<FinancialRatios> {
  return get<FinancialRatios>(`/financial-ratios/${facilityId}/${periodId}`);
}

/**
 * Get cohort analysis
 */
export function getCohortAnalysis(dimension: string): Promise<CohortData> {
  return get<CohortData>(`/cohort-analysis?dimension=${dimension}`);
}

/**
 * Get portfolio heatmap
 */
export function getPortfolioHeatmap(periodId: string): Promise<HeatmapData> {
  return get<HeatmapData>(`/portfolio-heatmap/${periodId}`);
}

/**
 * Run what-if scenario
 */
export function runWhatIf(
  facilityId: string,
  periodId: string,
  scenarios: Record<string, number>
): Promise<WhatIfResult> {
  return post<WhatIfResult>(`/what-if/${facilityId}/${periodId}`, { scenarios });
}

/**
 * Get simulation baseline
 */
export function getSimulationBaseline(facilityId: string, periodId: string): Promise<SimulationBaseline> {
  return get<SimulationBaseline>(`/simulation/baseline/${facilityId}/${periodId}`);
}
