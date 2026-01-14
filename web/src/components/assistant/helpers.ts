/**
 * Helper functions for data analysis in the AI Assistant
 */

import type { KPIData, AllKPIData, TrendData, PeerRanking } from './types';

/**
 * Get a specific KPI value from a list of KPIs
 */
export function getKPIValue(kpis: KPIData[], kpiId: string): number | null {
  const kpi = kpis.find(k => k.kpi_id === kpiId);
  return kpi?.value ?? null;
}

/**
 * Format a value for display
 */
export function formatValue(
  value: number | null,
  format: 'percentage' | 'currency' | 'number'
): string {
  if (value === null) return '--';
  if (format === 'currency') return `$${value.toFixed(0)}`;
  if (format === 'percentage') return `${value.toFixed(1)}%`;
  return value.toFixed(2);
}

/**
 * Calculate peer ranking for a facility on a specific KPI
 */
export function calculatePeerRank(
  allKPIs: AllKPIData[],
  facilityId: string,
  kpiId: string,
  setting: string
): PeerRanking {
  const peers = allKPIs
    .filter(k => k.kpi_id === kpiId && k.setting === setting && k.value !== null)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  const idx = peers.findIndex(p => p.facility_id === facilityId);
  return {
    rank: idx >= 0 ? idx + 1 : -1,
    total: peers.length,
    percentile: idx >= 0 ? Math.round((1 - idx / peers.length) * 100) : 0,
  };
}

/**
 * Get trend direction from historical data
 */
export function getTrendDirection(
  trends: TrendData[]
): { direction: 'improving' | 'declining' | 'stable'; change: number } {
  if (trends.length < 3) return { direction: 'stable', change: 0 };
  const recent = trends.slice(-3);
  const older = trends.slice(-6, -3);

  const recentAvg = recent.reduce((sum, t) => sum + (t.value || 0), 0) / recent.length;
  const olderAvg =
    older.length > 0
      ? older.reduce((sum, t) => sum + (t.value || 0), 0) / older.length
      : recentAvg;

  const change = recentAvg - olderAvg;
  return {
    direction: change > 1 ? 'improving' : change < -1 ? 'declining' : 'stable',
    change,
  };
}

/**
 * Get status emoji based on trend direction
 */
export function getTrendEmoji(direction: 'improving' | 'declining' | 'stable'): string {
  switch (direction) {
    case 'improving':
      return '\u{1F4C8}'; // chart with upward trend
    case 'declining':
      return '\u{1F4C9}'; // chart with downward trend
    default:
      return '\u27A1\uFE0F'; // right arrow
  }
}

/**
 * Get margin status classification
 */
export function getMarginStatus(
  margin: number | null
): 'strong' | 'moderate' | 'concerning' | 'unknown' {
  if (margin === null) return 'unknown';
  if (margin >= 8) return 'strong';
  if (margin >= 0) return 'moderate';
  return 'concerning';
}
