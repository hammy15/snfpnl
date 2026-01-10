/**
 * Statistical analysis utilities for T12M performance and correlation analysis
 */

export interface CorrelationResult {
  r: number;
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  direction: 'positive' | 'negative' | 'none';
  dataPoints: number;
}

export interface TrendResult {
  direction: 'improving' | 'declining' | 'stable';
  changePercent: number;
  slope: number;
  volatility: number;
}

export interface HighLowPoint {
  value: number;
  periodId: string;
  index: number;
}

export interface T12MStats {
  current: number;
  average: number;
  min: HighLowPoint;
  max: HighLowPoint;
  stdDev: number;
  trend: TrendResult;
  momChange: number | null;
  yoyChange: number | null;
}

/**
 * Calculate Pearson correlation coefficient between two arrays of values
 */
export function calculatePearsonCorrelation(xValues: number[], yValues: number[]): CorrelationResult {
  if (xValues.length !== yValues.length || xValues.length < 3) {
    return { r: 0, strength: 'none', direction: 'none', dataPoints: 0 };
  }

  const n = xValues.length;
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((acc, x, i) => acc + x * yValues[i], 0);
  const sumX2 = xValues.reduce((acc, x) => acc + x * x, 0);
  const sumY2 = yValues.reduce((acc, y) => acc + y * y, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) {
    return { r: 0, strength: 'none', direction: 'none', dataPoints: n };
  }

  const r = numerator / denominator;

  return {
    r: Math.round(r * 1000) / 1000,
    strength: classifyCorrelationStrength(r),
    direction: r > 0.1 ? 'positive' : r < -0.1 ? 'negative' : 'none',
    dataPoints: n
  };
}

/**
 * Classify correlation strength based on absolute value of r
 */
export function classifyCorrelationStrength(r: number): 'strong' | 'moderate' | 'weak' | 'none' {
  const absR = Math.abs(r);
  if (absR >= 0.7) return 'strong';
  if (absR >= 0.4) return 'moderate';
  if (absR >= 0.2) return 'weak';
  return 'none';
}

/**
 * Calculate standard deviation of an array of values
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate linear regression slope
 */
export function calculateSlope(values: number[]): number {
  if (values.length < 2) return 0;

  const n = values.length;
  const xValues = Array.from({ length: n }, (_, i) => i);
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((acc, x, i) => acc + x * values[i], 0);
  const sumX2 = xValues.reduce((acc, x) => acc + x * x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Detect trend direction based on values over time
 */
export function detectTrend(values: number[], higherIsBetter: boolean = true): TrendResult {
  if (values.length < 2) {
    return { direction: 'stable', changePercent: 0, slope: 0, volatility: 0 };
  }

  const slope = calculateSlope(values);
  const stdDev = calculateStandardDeviation(values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const volatility = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

  const first = values[0];
  const last = values[values.length - 1];
  const changePercent = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;

  const slopeThreshold = Math.abs(mean) * 0.02;

  let direction: 'improving' | 'declining' | 'stable';
  if (Math.abs(slope) < slopeThreshold) {
    direction = 'stable';
  } else if (higherIsBetter) {
    direction = slope > 0 ? 'improving' : 'declining';
  } else {
    direction = slope < 0 ? 'improving' : 'declining';
  }

  return {
    direction,
    changePercent: Math.round(changePercent * 10) / 10,
    slope: Math.round(slope * 1000) / 1000,
    volatility: Math.round(volatility * 10) / 10
  };
}

/**
 * Calculate comprehensive T12M statistics for a metric
 */
export function calculateT12MStats(
  values: { value: number; periodId: string }[],
  higherIsBetter: boolean = true
): T12MStats | null {
  if (values.length === 0) return null;

  const numericValues = values.map(v => v.value);
  const current = numericValues[numericValues.length - 1];
  const average = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;

  let minIdx = 0, maxIdx = 0;
  for (let i = 1; i < numericValues.length; i++) {
    if (numericValues[i] < numericValues[minIdx]) minIdx = i;
    if (numericValues[i] > numericValues[maxIdx]) maxIdx = i;
  }

  const min: HighLowPoint = {
    value: numericValues[minIdx],
    periodId: values[minIdx].periodId,
    index: minIdx
  };

  const max: HighLowPoint = {
    value: numericValues[maxIdx],
    periodId: values[maxIdx].periodId,
    index: maxIdx
  };

  const momChange = numericValues.length >= 2
    ? numericValues[numericValues.length - 1] - numericValues[numericValues.length - 2]
    : null;

  const yoyChange = numericValues.length >= 12
    ? numericValues[numericValues.length - 1] - numericValues[numericValues.length - 12]
    : null;

  return {
    current,
    average,
    min,
    max,
    stdDev: calculateStandardDeviation(numericValues),
    trend: detectTrend(numericValues, higherIsBetter),
    momChange,
    yoyChange
  };
}

/**
 * Determine if higher values are better for a given KPI
 */
export function isHigherBetter(kpiId: string): boolean {
  const lowerIsBetter = [
    'snf_total_cost_ppd',
    'snf_nursing_cost_ppd',
    'snf_therapy_cost_psd',
    'snf_dietary_cost_ppd',
    'snf_admin_cost_ppd',
    'snf_contract_labor_pct_nursing',
    'snf_contract_labor_pct_therapy'
  ];

  return !lowerIsBetter.includes(kpiId);
}

/**
 * Format period ID (YYYY-MM) to readable format
 */
export function formatPeriodId(periodId: string): string {
  const parts = periodId.split('-');
  const year = parts[0];
  const monthNum = parseInt(parts[1]);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return monthNames[monthNum - 1] + ' ' + year;
}

/**
 * Get the period ID from N months ago
 */
export function getPeriodIdMonthsAgo(currentPeriodId: string, monthsAgo: number): string {
  const parts = currentPeriodId.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const date = new Date(year, month - 1 - monthsAgo, 1);
  const newMonth = date.getMonth() + 1;
  return date.getFullYear() + '-' + String(newMonth).padStart(2, '0');
}
