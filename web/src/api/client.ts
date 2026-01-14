/**
 * Centralized API client for SNFPNL
 * All API calls should go through this module
 */

import { ApiError } from '../utils/apiError';

// Base URL - can be overridden via environment variable
export const API_BASE = import.meta.env.VITE_API_BASE || 'https://snfpnl.onrender.com/api';

/**
 * Core fetch wrapper with error handling and timeout
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit & { timeout?: number }
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options || {};
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        response.statusText,
        url
      );
    }

    // Handle empty responses
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timed out', 408, 'Timeout', url);
    }

    throw error;
  }
}

/**
 * GET request helper
 */
export function get<T>(endpoint: string, options?: { timeout?: number }): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'GET', ...options });
}

/**
 * POST request helper
 */
export function post<T>(
  endpoint: string,
  data?: unknown,
  options?: { timeout?: number }
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

/**
 * PUT request helper
 */
export function put<T>(
  endpoint: string,
  data?: unknown,
  options?: { timeout?: number }
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

/**
 * DELETE request helper
 */
export function del<T>(endpoint: string, options?: { timeout?: number }): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'DELETE', ...options });
}

/**
 * POST with FormData (for file uploads)
 */
export function postForm<T>(
  endpoint: string,
  formData: FormData,
  options?: { timeout?: number }
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: formData,
    ...options,
  });
}
