/**
 * KPI-related API endpoints
 */

import { get, post, del } from './client';

export interface KPI {
  kpi_id: string;
  name?: string;
  value: number | null;
  category?: string;
  [key: string]: unknown;
}

export interface KPITrend {
  period: string;
  value: number;
  [key: string]: unknown;
}

export interface KPIDrilldown {
  kpi_id: string;
  components: Array<{ name: string; value: number }>;
  [key: string]: unknown;
}

export interface CustomKPI {
  id: string;
  name: string;
  formula: string;
  [key: string]: unknown;
}

export interface KPIGoal {
  facility_id: string;
  kpi_id: string;
  target: number;
  [key: string]: unknown;
}

/**
 * Get KPIs for a facility and period
 */
export function getKPIs(facilityId: string, periodId: string): Promise<KPI[]> {
  return get<KPI[]>(`/kpis/${facilityId}/${periodId}`);
}

/**
 * Get all KPIs across facilities for a period
 */
export function getAllKPIs(periodId: string): Promise<KPI[]> {
  return get<KPI[]>(`/kpis/all/${periodId}`);
}

/**
 * Get KPI trends over time
 */
export function getKPITrends(facilityId: string, kpiId: string): Promise<KPITrend[]> {
  return get<KPITrend[]>(`/trends/${facilityId}/${kpiId}`);
}

/**
 * Get KPI drilldown details
 */
export function getKPIDrilldown(
  facilityId: string,
  periodId: string,
  kpiId: string
): Promise<KPIDrilldown> {
  return get<KPIDrilldown>(`/kpi-drilldown/${facilityId}/${periodId}/${kpiId}`);
}

/**
 * Get KPI goals for a facility
 */
export function getKPIGoals(facilityId: string): Promise<KPIGoal[]> {
  return get<KPIGoal[]>(`/kpi-goals/${facilityId}`);
}

/**
 * Create or update KPI goal
 */
export function saveKPIGoal(goal: KPIGoal): Promise<KPIGoal> {
  return post<KPIGoal>('/kpi-goals', goal);
}

/**
 * Delete KPI goal
 */
export function deleteKPIGoal(facilityId: string, kpiId: string): Promise<void> {
  return del<void>(`/kpi-goals/${facilityId}/${kpiId}`);
}

/**
 * Get custom KPIs
 */
export function getCustomKPIs(): Promise<CustomKPI[]> {
  return get<CustomKPI[]>('/custom-kpis');
}

/**
 * Create custom KPI
 */
export function createCustomKPI(kpi: Omit<CustomKPI, 'id'>): Promise<CustomKPI> {
  return post<CustomKPI>('/custom-kpis', kpi);
}

/**
 * Delete custom KPI
 */
export function deleteCustomKPI(id: string): Promise<void> {
  return del<void>(`/custom-kpis/${id}`);
}

/**
 * Test custom KPI formula
 */
export function testCustomKPI(formula: string): Promise<{ result: number; valid: boolean }> {
  return post<{ result: number; valid: boolean }>('/custom-kpis/test', { formula });
}
