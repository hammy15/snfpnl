/**
 * Data upload, sync, and map API endpoints
 */

import { get, post, postForm } from './client';

export interface UploadStatus {
  lastUpload?: string;
  filesProcessed?: number;
  status: 'idle' | 'processing' | 'complete' | 'error';
  error?: string;
  [key: string]: unknown;
}

export interface UploadResult {
  success: boolean;
  filesProcessed: number;
  errors?: string[];
  [key: string]: unknown;
}

export interface SyncStatus {
  lastSync?: string;
  status: 'idle' | 'syncing' | 'complete' | 'error';
  error?: string;
  [key: string]: unknown;
}

export interface MapData {
  facilities: Array<{
    facility_id: string;
    name: string;
    lat: number;
    lng: number;
    state: string;
    metrics: Record<string, number>;
    status: 'good' | 'warning' | 'critical';
  }>;
  [key: string]: unknown;
}

/**
 * Get upload status
 */
export function getUploadStatus(): Promise<UploadStatus> {
  return get<UploadStatus>('/upload/status');
}

/**
 * Upload files
 */
export function uploadFiles(files: FormData): Promise<UploadResult> {
  return postForm<UploadResult>('/upload', files);
}

/**
 * Get sync status
 */
export function getSyncStatus(): Promise<SyncStatus> {
  return get<SyncStatus>('/sync-status');
}

/**
 * Trigger sync
 */
export function triggerSync(): Promise<{ success: boolean }> {
  return post<{ success: boolean }>('/sync-all', {});
}

/**
 * Get map data for a period
 */
export function getMapData(periodId: string): Promise<MapData> {
  return get<MapData>(`/map-data/${periodId}`);
}

/**
 * Log access (for login tracking)
 */
export function logAccess(name: string): Promise<void> {
  return post<void>('/access-log', {
    name,
    timestamp: new Date().toISOString(),
  });
}
