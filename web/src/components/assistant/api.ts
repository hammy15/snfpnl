/**
 * API functions for the AI Assistant component
 */

import { api } from '../../api';
import type { KPIData, AllKPIData, TrendData, AIContext } from './types';

/**
 * Fetch KPIs for a specific facility and period
 */
export async function fetchFacilityKPIs(facilityId: string, periodId: string): Promise<KPIData[]> {
  const data = await api.kpis.getKPIs(facilityId, periodId);
  return data.map(kpi => ({
    kpi_id: kpi.kpi_id,
    value: kpi.value,
    period_id: periodId,
  }));
}

/**
 * Fetch all KPIs across facilities for a period
 */
export async function fetchAllKPIs(periodId: string): Promise<AllKPIData[]> {
  const data = await api.kpis.getAllKPIs(periodId);
  return data as unknown as AllKPIData[];
}

/**
 * Fetch trend data for a specific facility and KPI
 */
export async function fetchTrends(facilityId: string, kpiId: string): Promise<TrendData[]> {
  const data = await api.kpis.getKPITrends(facilityId, kpiId);
  return data.map(trend => ({
    period_id: trend.period,
    value: trend.value,
  }));
}

/**
 * Send a chat message to the AI
 */
export async function sendChatMessage(
  message: string,
  context: AIContext
): Promise<string> {
  const result = await api.ai.chatWithAI({ message, context });
  return result.response;
}
