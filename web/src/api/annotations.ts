/**
 * Annotations API endpoints
 */

import { get, post, put, del } from './client';

export interface Annotation {
  id: string;
  facility_id?: string;
  kpi_id?: string;
  period_id?: string;
  text: string;
  author?: string;
  created_at: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface AnnotationParams {
  facilityId?: string;
  kpiId?: string;
  periodId?: string;
}

/**
 * Get annotations
 */
export function getAnnotations(params: AnnotationParams): Promise<Annotation[]> {
  const searchParams = new URLSearchParams();
  if (params.facilityId) searchParams.set('facilityId', params.facilityId);
  if (params.kpiId) searchParams.set('kpiId', params.kpiId);
  if (params.periodId) searchParams.set('periodId', params.periodId);
  return get<Annotation[]>(`/annotations?${searchParams}`);
}

/**
 * Create annotation
 */
export function createAnnotation(annotation: Omit<Annotation, 'id' | 'created_at'>): Promise<Annotation> {
  return post<Annotation>('/annotations', annotation);
}

/**
 * Update annotation
 */
export function updateAnnotation(id: string, annotation: Partial<Annotation>): Promise<Annotation> {
  return put<Annotation>(`/annotations/${id}`, annotation);
}

/**
 * Delete annotation
 */
export function deleteAnnotation(id: string): Promise<void> {
  return del<void>(`/annotations/${id}`);
}
