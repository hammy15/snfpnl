/**
 * Date formatting utilities for the SNF Financials dashboard
 */

/**
 * Formats a period ID (e.g., "2025-11") into a human-readable string (e.g., "November 2025")
 */
export function formatPeriod(periodId: string): string {
  const [year, month] = periodId.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

/**
 * Formats a period ID into a short format (e.g., "Nov 2025")
 */
export function formatPeriodShort(periodId: string): string {
  const [year, month] = periodId.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}
