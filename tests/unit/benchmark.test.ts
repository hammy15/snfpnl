import { describe, it, expect } from 'vitest';
import {
  calculateBenchmarkStats,
  getPercentileRank,
  getPerformanceLabel,
} from '../../src/benchmark/engine.js';

describe('Benchmark Engine', () => {
  describe('calculateBenchmarkStats', () => {
    it('should calculate correct statistics for a dataset', () => {
      const values = [100, 200, 300, 400, 500];

      const stats = calculateBenchmarkStats(values);

      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(5);
      expect(stats?.min).toBe(100);
      expect(stats?.max).toBe(500);
      expect(stats?.median).toBe(300);
      expect(stats?.mean).toBe(300);
    });

    it('should calculate correct percentiles', () => {
      // 10 values from 100 to 1000
      const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

      const stats = calculateBenchmarkStats(values);

      expect(stats?.p25).toBeCloseTo(325, 0);
      expect(stats?.median).toBe(550);
      expect(stats?.p75).toBeCloseTo(775, 0);
    });

    it('should handle single value', () => {
      const values = [500];

      const stats = calculateBenchmarkStats(values);

      expect(stats?.count).toBe(1);
      expect(stats?.min).toBe(500);
      expect(stats?.max).toBe(500);
      expect(stats?.median).toBe(500);
      expect(stats?.mean).toBe(500);
    });

    it('should return null for empty array', () => {
      const stats = calculateBenchmarkStats([]);

      expect(stats).toBeNull();
    });

    it('should filter out invalid values', () => {
      const values = [100, NaN, 200, Infinity, 300, -Infinity];

      const stats = calculateBenchmarkStats(values);

      expect(stats?.count).toBe(3);
      expect(stats?.min).toBe(100);
      expect(stats?.max).toBe(300);
    });

    it('should calculate standard deviation', () => {
      // Values with known std dev
      const values = [10, 20, 30, 40, 50];

      const stats = calculateBenchmarkStats(values);

      // Mean = 30, variance = ((20^2 + 10^2 + 0 + 10^2 + 20^2) / 5) = 200
      // Std dev = sqrt(200) ≈ 14.14
      expect(stats?.std_dev).toBeCloseTo(14.14, 1);
    });
  });

  describe('getPercentileRank', () => {
    const stats = {
      count: 100,
      min: 0,
      p25: 250,
      median: 500,
      p75: 750,
      max: 1000,
      mean: 500,
      std_dev: 250,
    };

    it('should return 0 for value at or below min', () => {
      expect(getPercentileRank(0, stats)).toBe(0);
      expect(getPercentileRank(-10, stats)).toBe(0);
    });

    it('should return 100 for value at or above max', () => {
      expect(getPercentileRank(1000, stats)).toBe(100);
      expect(getPercentileRank(1500, stats)).toBe(100);
    });

    it('should return ~25 for value at p25', () => {
      expect(getPercentileRank(250, stats)).toBeCloseTo(25, 0);
    });

    it('should return ~50 for value at median', () => {
      expect(getPercentileRank(500, stats)).toBeCloseTo(50, 0);
    });

    it('should return ~75 for value at p75', () => {
      expect(getPercentileRank(750, stats)).toBeCloseTo(75, 0);
    });

    it('should interpolate between quartiles', () => {
      // Value halfway between p25 and median
      const rank = getPercentileRank(375, stats);
      expect(rank).toBeCloseTo(37.5, 0);
    });
  });

  describe('getPerformanceLabel', () => {
    it('should return "Top Quartile" for high performers when higher is better', () => {
      expect(getPerformanceLabel(80, true)).toBe('Top Quartile');
      expect(getPerformanceLabel(90, true)).toBe('Top Quartile');
    });

    it('should return "Above Median" for good performers when higher is better', () => {
      expect(getPerformanceLabel(60, true)).toBe('Above Median');
      expect(getPerformanceLabel(70, true)).toBe('Above Median');
    });

    it('should return "Below Median" for below average when higher is better', () => {
      expect(getPerformanceLabel(40, true)).toBe('Below Median');
      expect(getPerformanceLabel(30, true)).toBe('Below Median');
    });

    it('should return "Bottom Quartile" for poor performers when higher is better', () => {
      expect(getPerformanceLabel(20, true)).toBe('Bottom Quartile');
      expect(getPerformanceLabel(10, true)).toBe('Bottom Quartile');
    });

    it('should invert labels when lower is better', () => {
      // For cost KPIs where lower is better
      expect(getPerformanceLabel(10, false)).toBe('Top Quartile'); // Low cost = good
      expect(getPerformanceLabel(90, false)).toBe('Bottom Quartile'); // High cost = bad
    });
  });
});
