/**
 * Standardized API error handling utilities
 */

export class ApiError extends Error {
  status: number;
  statusText: string;
  endpoint: string;

  constructor(message: string, status: number, statusText: string, endpoint: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.endpoint = endpoint;
  }
}

/**
 * Parse error response and return user-friendly message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Session expired. Please log in again.';
      case 403:
        return 'You don\'t have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 408:
        return 'Request timed out. Please try again.';
      case 429:
        return 'Too many requests. Please wait a moment.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable. Please try again.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  }

  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return 'Network error. Please check your connection.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}

/**
 * Wrapper for fetch with timeout and standardized error handling
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit & { timeout?: number }
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options || {};

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

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timed out', 408, 'Timeout', url);
    }

    throw error;
  }
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError && error.message === 'Failed to fetch'
  ) || (
    error instanceof ApiError && [502, 503, 504].includes(error.status)
  );
}

/**
 * Check if error should trigger a retry
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return [408, 429, 500, 502, 503, 504].includes(error.status);
  }
  return isNetworkError(error);
}
