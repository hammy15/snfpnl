/**
 * Facility-related API endpoints
 */

import { get, put, del } from './client';

export interface Facility {
  facility_id: string;
  name: string;
  state?: string;
  city?: string;
  beds?: number;
  setting?: string;
  [key: string]: unknown;
}

export interface FacilityDirectory {
  facilities: Facility[];
  total: number;
}

/**
 * Get all facilities
 */
export function getFacilities(): Promise<Facility[]> {
  return get<Facility[]>('/facilities');
}

/**
 * Get single facility by ID
 */
export function getFacility(id: string): Promise<Facility> {
  return get<Facility>(`/facilities/${id}`);
}

/**
 * Update facility
 */
export function updateFacility(id: string, data: Partial<Facility>): Promise<Facility> {
  return put<Facility>(`/facilities/${id}`, data);
}

/**
 * Delete facility
 */
export function deleteFacility(id: string): Promise<void> {
  return del<void>(`/facilities/${id}`);
}

/**
 * Get facility directory with enhanced data
 */
export function getFacilityDirectory(): Promise<FacilityDirectory> {
  return get<FacilityDirectory>('/facility-directory');
}
