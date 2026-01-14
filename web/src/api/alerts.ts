/**
 * Alerts and anomaly detection API endpoints
 */

import { get } from './client';

export interface Alert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  facility_id?: string;
  facility_name?: string;
  kpi_id?: string;
  message: string;
  value?: number;
  threshold?: number;
  created_at?: string;
  [key: string]: unknown;
}

export interface Anomaly {
  id: string;
  facility_id: string;
  kpi_id: string;
  value: number;
  expected: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
  [key: string]: unknown;
}

export interface SmartAlert {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  facility_id?: string;
  recommendations?: string[];
  [key: string]: unknown;
}

export interface PortfolioAlerts {
  critical: Alert[];
  warnings: Alert[];
  info: Alert[];
  total: number;
  [key: string]: unknown;
}

/**
 * Get threshold alerts for a facility
 */
export function getThresholdAlerts(facilityId: string, periodId: string): Promise<Alert[]> {
  return get<Alert[]>(`/alerts/${facilityId}/${periodId}`);
}

/**
 * Get anomalies for a facility
 */
export function getAnomalies(facilityId: string, periodId: string): Promise<Anomaly[]> {
  return get<Anomaly[]>(`/anomalies/${facilityId}/${periodId}`);
}

/**
 * Get portfolio-wide alerts
 */
export function getPortfolioAlerts(periodId: string): Promise<PortfolioAlerts> {
  return get<PortfolioAlerts>(`/portfolio-alerts/${periodId}`);
}

/**
 * Get smart alerts with AI analysis
 */
export function getSmartAlerts(params: {
  facilityId?: string;
  periodId?: string;
  severity?: string;
}): Promise<SmartAlert[]> {
  const searchParams = new URLSearchParams();
  if (params.facilityId) searchParams.set('facilityId', params.facilityId);
  if (params.periodId) searchParams.set('periodId', params.periodId);
  if (params.severity) searchParams.set('severity', params.severity);
  return get<SmartAlert[]>(`/smart-alerts?${searchParams}`);
}

/**
 * Get anomaly detection results
 */
export function detectAnomalies(params: {
  facilityId?: string;
  periodId?: string;
  threshold?: number;
}): Promise<Anomaly[]> {
  const searchParams = new URLSearchParams();
  if (params.facilityId) searchParams.set('facilityId', params.facilityId);
  if (params.periodId) searchParams.set('periodId', params.periodId);
  if (params.threshold) searchParams.set('threshold', params.threshold.toString());
  return get<Anomaly[]>(`/anomaly-detection?${searchParams}`);
}
