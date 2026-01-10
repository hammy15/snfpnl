import type { KPIResult, BenchmarkStats, Benchmark, Facility } from '../types/index.js';

/**
 * Calculate percentile value from sorted array.
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];

  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sortedArr[lower];

  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

/**
 * Calculate standard deviation.
 */
function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;

  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate benchmark statistics for a set of KPI values.
 */
export function calculateBenchmarkStats(values: number[]): BenchmarkStats | null {
  // Filter out null/undefined values
  const validValues = values.filter((v) => v !== null && !isNaN(v) && isFinite(v));

  if (validValues.length === 0) return null;

  // Sort for percentile calculations
  const sorted = [...validValues].sort((a, b) => a - b);

  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;

  return {
    count: sorted.length,
    min: sorted[0],
    p25: percentile(sorted, 25),
    median: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    max: sorted[sorted.length - 1],
    mean,
    std_dev: stdDev(sorted, mean),
  };
}

interface FacilityKPIData {
  facilityId: string;
  state: string;
  region: string | null;
  setting: string;
  kpiResults: KPIResult[];
}

/**
 * Generate benchmarks for all KPIs across different cohorts.
 */
export function generateBenchmarks(
  facilityData: FacilityKPIData[],
  facilities: Facility[],
  periodId: string
): Benchmark[] {
  const benchmarks: Benchmark[] = [];

  // Create facility lookup
  const facilityMap = new Map(facilities.map((f) => [f.facility_id, f]));

  // Get all unique KPI IDs
  const kpiIds = new Set<string>();
  for (const data of facilityData) {
    for (const result of data.kpiResults) {
      kpiIds.add(result.kpi_id);
    }
  }

  // Calculate benchmarks for each KPI
  for (const kpiId of kpiIds) {
    // Collect all values for this KPI
    const allValues: number[] = [];
    const byState: Map<string, number[]> = new Map();
    const byRegion: Map<string, number[]> = new Map();
    const bySetting: Map<string, number[]> = new Map();

    for (const data of facilityData) {
      const facility = facilityMap.get(data.facilityId);
      if (!facility) continue;

      const kpiResult = data.kpiResults.find((r) => r.kpi_id === kpiId);
      if (!kpiResult || kpiResult.value === null) continue;

      const value = kpiResult.value;

      // All facilities
      allValues.push(value);

      // By state
      const state = facility.state;
      if (!byState.has(state)) byState.set(state, []);
      byState.get(state)!.push(value);

      // By region
      const region = facility.region || 'Unknown';
      if (!byRegion.has(region)) byRegion.set(region, []);
      byRegion.get(region)!.push(value);

      // By setting
      const setting = facility.setting;
      if (!bySetting.has(setting)) bySetting.set(setting, []);
      bySetting.get(setting)!.push(value);
    }

    // Create benchmark for all facilities
    const allStats = calculateBenchmarkStats(allValues);
    if (allStats) {
      benchmarks.push({
        kpi_id: kpiId,
        cohort: 'all',
        period_id: periodId,
        stats: allStats,
      });
    }

    // Create benchmarks by state
    for (const [state, values] of byState) {
      const stats = calculateBenchmarkStats(values);
      if (stats && stats.count >= 2) {
        benchmarks.push({
          kpi_id: kpiId,
          cohort: `state:${state}`,
          period_id: periodId,
          stats,
        });
      }
    }

    // Create benchmarks by region
    for (const [region, values] of byRegion) {
      const stats = calculateBenchmarkStats(values);
      if (stats && stats.count >= 2) {
        benchmarks.push({
          kpi_id: kpiId,
          cohort: `region:${region}`,
          period_id: periodId,
          stats,
        });
      }
    }

    // Create benchmarks by setting
    for (const [setting, values] of bySetting) {
      const stats = calculateBenchmarkStats(values);
      if (stats && stats.count >= 2) {
        benchmarks.push({
          kpi_id: kpiId,
          cohort: `setting:${setting}`,
          period_id: periodId,
          stats,
        });
      }
    }
  }

  return benchmarks;
}

/**
 * Get relevant benchmarks for a facility.
 */
export function getBenchmarksForFacility(
  benchmarks: Benchmark[],
  facility: Facility,
  kpiId: string
): Record<string, BenchmarkStats> {
  const result: Record<string, BenchmarkStats> = {};

  for (const benchmark of benchmarks) {
    if (benchmark.kpi_id !== kpiId) continue;

    if (benchmark.cohort === 'all') {
      result.all = benchmark.stats;
    } else if (benchmark.cohort === `state:${facility.state}`) {
      result[`state_${facility.state}`] = benchmark.stats;
    } else if (benchmark.cohort === `region:${facility.region}`) {
      result[`region_${facility.region}`] = benchmark.stats;
    } else if (benchmark.cohort === `setting:${facility.setting}`) {
      result[`setting_${facility.setting}`] = benchmark.stats;
    }
  }

  return result;
}

/**
 * Compare a value against benchmark stats and return percentile rank.
 */
export function getPercentileRank(value: number, stats: BenchmarkStats): number {
  if (stats.count === 0) return 50;

  // Approximate percentile rank based on quartiles
  if (value <= stats.min) return 0;
  if (value >= stats.max) return 100;

  if (value <= stats.p25) {
    // Interpolate between min and p25
    return 25 * ((value - stats.min) / (stats.p25 - stats.min));
  } else if (value <= stats.median) {
    // Interpolate between p25 and median
    return 25 + 25 * ((value - stats.p25) / (stats.median - stats.p25));
  } else if (value <= stats.p75) {
    // Interpolate between median and p75
    return 50 + 25 * ((value - stats.median) / (stats.p75 - stats.median));
  } else {
    // Interpolate between p75 and max
    return 75 + 25 * ((value - stats.p75) / (stats.max - stats.p75));
  }
}

/**
 * Generate performance label based on percentile.
 */
export function getPerformanceLabel(percentileRank: number, higherIsBetter: boolean): string {
  // Adjust if lower is better
  const adjustedRank = higherIsBetter ? percentileRank : 100 - percentileRank;

  if (adjustedRank >= 75) return 'Top Quartile';
  if (adjustedRank >= 50) return 'Above Median';
  if (adjustedRank >= 25) return 'Below Median';
  return 'Bottom Quartile';
}
