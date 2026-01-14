/**
 * Dashboard and summary API endpoints
 */

import { get } from './client';

export interface DashboardData {
  summary: {
    totalFacilities: number;
    avgMargin: number;
    profitableFacilities: number;
    atRiskFacilities: number;
  };
  trends: Array<{ period: string; margin: number }>;
  [key: string]: unknown;
}

export interface Period {
  period_id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  [key: string]: unknown;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  margin: number;
  facilities: Array<{
    facility_id: string;
    name: string;
    revenue: number;
    expenses: number;
    margin: number;
  }>;
  [key: string]: unknown;
}

export interface ExecutiveSummary {
  overview: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  [key: string]: unknown;
}

export interface LeaderboardData {
  facilities: Array<{
    facility_id: string;
    name: string;
    rank: number;
    margin: number;
    change: number;
  }>;
  [key: string]: unknown;
}

export interface SparklineData {
  facilities: Array<{
    facility_id: string;
    name: string;
    sparkline: number[];
    current: number;
    change: number;
  }>;
  [key: string]: unknown;
}

/**
 * Get dashboard data for a period
 */
export function getDashboard(periodId: string): Promise<DashboardData> {
  return get<DashboardData>(`/dashboard/${periodId}`);
}

/**
 * Get all periods
 */
export function getPeriods(): Promise<Period[]> {
  return get<Period[]>('/periods');
}

/**
 * Get financial summary for a period
 */
export function getFinancialSummary(periodId: string): Promise<FinancialSummary> {
  return get<FinancialSummary>(`/financials/summary/${periodId}`);
}

/**
 * Get executive summary for portfolio
 */
export function getExecutiveSummary(periodId: string): Promise<ExecutiveSummary> {
  return get<ExecutiveSummary>(`/executive-summary/${periodId}`);
}

/**
 * Get executive summary for specific facility
 */
export function getFacilityExecutiveSummary(
  facilityId: string,
  periodId: string
): Promise<ExecutiveSummary> {
  return get<ExecutiveSummary>(`/executive-summary/${facilityId}/${periodId}`);
}

/**
 * Get facility leaderboard
 */
export function getLeaderboard(periodId: string): Promise<LeaderboardData> {
  return get<LeaderboardData>(`/leaderboard/${periodId}`);
}

/**
 * Get sparkline dashboard data
 */
export function getSparklineDashboard(): Promise<SparklineData> {
  return get<SparklineData>('/sparkline-dashboard');
}
