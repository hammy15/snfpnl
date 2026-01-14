/**
 * Reports and export API endpoints
 */

import { get, post, put, del, API_BASE } from './client';

export interface ScheduledReport {
  id: string;
  name: string;
  type: string;
  schedule: string;
  recipients: string[];
  facilityId?: string;
  periodId?: string;
  enabled: boolean;
  lastSent?: string;
  [key: string]: unknown;
}

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  facilityId?: string;
  assignee?: string;
  dueDate?: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface ExportParams {
  type: 'excel' | 'pdf' | 'csv';
  facilityIds?: string[];
  periodId?: string;
  kpis?: string[];
  includeCharts?: boolean;
}

/**
 * Get scheduled reports
 */
export function getScheduledReports(): Promise<ScheduledReport[]> {
  return get<ScheduledReport[]>('/scheduled-reports');
}

/**
 * Create scheduled report
 */
export function createScheduledReport(report: Omit<ScheduledReport, 'id'>): Promise<ScheduledReport> {
  return post<ScheduledReport>('/scheduled-reports', report);
}

/**
 * Update scheduled report
 */
export function updateScheduledReport(id: string, report: Partial<ScheduledReport>): Promise<ScheduledReport> {
  return put<ScheduledReport>(`/scheduled-reports/${id}`, report);
}

/**
 * Delete scheduled report
 */
export function deleteScheduledReport(id: string): Promise<void> {
  return del<void>(`/scheduled-reports/${id}`);
}

/**
 * Send scheduled report immediately
 */
export function sendScheduledReport(id: string): Promise<{ success: boolean }> {
  return post<{ success: boolean }>(`/scheduled-reports/${id}/send`, {});
}

/**
 * Create action item
 */
export function createActionItem(item: Omit<ActionItem, 'id' | 'createdAt'>): Promise<ActionItem> {
  return post<ActionItem>('/action-items', item);
}

/**
 * Update action item
 */
export function updateActionItem(id: string, item: Partial<ActionItem>): Promise<ActionItem> {
  return put<ActionItem>(`/action-items/${id}`, item);
}

/**
 * Delete action item
 */
export function deleteActionItem(id: string): Promise<void> {
  return del<void>(`/action-items/${id}`);
}

/**
 * Export data to Excel
 */
export async function exportToExcel(params: ExportParams): Promise<Blob> {
  const searchParams = new URLSearchParams();
  if (params.facilityIds) searchParams.set('facilityIds', params.facilityIds.join(','));
  if (params.periodId) searchParams.set('periodId', params.periodId);
  if (params.kpis) searchParams.set('kpis', params.kpis.join(','));
  if (params.includeCharts) searchParams.set('includeCharts', 'true');

  const response = await fetch(
    `${API_BASE}/export/excel?${searchParams}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  return response.blob();
}
