import { describe, it, expect } from 'vitest';
import {
  resolveDenominators,
  validateSkilledDaysReconciliation,
  computeSkilledMix,
  getDenominatorValue,
} from '../../src/core/denominator/resolver.js';
import type { CensusFact, Denominators } from '../../src/types/index.js';

describe('Denominator Resolver', () => {
  describe('resolveDenominators', () => {
    it('should calculate resident_days as sum of all payer days', () => {
      const censusFacts: CensusFact[] = [
        { facility_id: '101', period_id: '2024-11', payer_category: 'MEDICARE_A', days: 100, is_skilled: true, is_vent: false, source_file: 'test.xlsx' },
        { facility_id: '101', period_id: '2024-11', payer_category: 'MEDICAID', days: 200, is_skilled: false, is_vent: false, source_file: 'test.xlsx' },
        { facility_id: '101', period_id: '2024-11', payer_category: 'PRIVATE_PAY', days: 50, is_skilled: false, is_vent: false, source_file: 'test.xlsx' },
      ];

      const { denominators } = resolveDenominators(censusFacts, '101', '2024-11');

      expect(denominators.resident_days).toBe(350);
    });

    it('should calculate skilled_days as sum of skilled payer days (Medicare A + MA + Commercial + VA + ISNP)', () => {
      const censusFacts: CensusFact[] = [
        { facility_id: '101', period_id: '2024-11', payer_category: 'MEDICARE_A', days: 100, is_skilled: true, is_vent: false, source_file: 'test.xlsx' },
        { facility_id: '101', period_id: '2024-11', payer_category: 'MEDICARE_ADVANTAGE', days: 50, is_skilled: true, is_vent: false, source_file: 'test.xlsx' },
        { facility_id: '101', period_id: '2024-11', payer_category: 'VA', days: 25, is_skilled: true, is_vent: false, source_file: 'test.xlsx' },
        { facility_id: '101', period_id: '2024-11', payer_category: 'MEDICAID', days: 200, is_skilled: false, is_vent: false, source_file: 'test.xlsx' },
      ];

      const { denominators } = resolveDenominators(censusFacts, '101', '2024-11');

      // Skilled = Medicare A (100) + MA (50) + VA (25) = 175
      expect(denominators.skilled_days).toBe(175);
    });

    it('should include VA in skilled days per business requirement', () => {
      const censusFacts: CensusFact[] = [
        { facility_id: '101', period_id: '2024-11', payer_category: 'VA', days: 30, is_skilled: true, is_vent: false, source_file: 'test.xlsx' },
      ];

      const { denominators } = resolveDenominators(censusFacts, '101', '2024-11');

      expect(denominators.skilled_days).toBe(30);
      expect(denominators.payer_days.VA).toBe(30);
    });

    it('should flag anomaly when skilled_days exceeds resident_days', () => {
      // This shouldn't happen in practice, but we should catch it
      const censusFacts: CensusFact[] = [
        { facility_id: '101', period_id: '2024-11', payer_category: 'MEDICARE_A', days: 200, is_skilled: true, is_vent: false, source_file: 'test.xlsx' },
        { facility_id: '101', period_id: '2024-11', payer_category: 'MEDICAID', days: -50, is_skilled: false, is_vent: false, source_file: 'test.xlsx' }, // Simulating bad data
      ];

      const { denominators, anomalies } = resolveDenominators(censusFacts, '101', '2024-11');

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some(a => a.type === 'skilled_exceeds_total')).toBe(true);
    });

    it('should track vent_days separately', () => {
      const censusFacts: CensusFact[] = [
        { facility_id: '101', period_id: '2024-11', payer_category: 'MEDICARE_A', days: 100, is_skilled: true, is_vent: false, source_file: 'test.xlsx' },
        { facility_id: '101', period_id: '2024-11', payer_category: 'MEDICARE_A', days: 20, is_skilled: true, is_vent: true, source_file: 'test.xlsx' },
      ];

      const { denominators } = resolveDenominators(censusFacts, '101', '2024-11');

      expect(denominators.vent_days).toBe(20);
    });

    it('should warn on missing census data', () => {
      const censusFacts: CensusFact[] = [];

      const { anomalies } = resolveDenominators(censusFacts, '101', '2024-11');

      expect(anomalies.some(a => a.type === 'missing_data')).toBe(true);
    });
  });

  describe('validateSkilledDaysReconciliation', () => {
    it('should return null when skilled_days matches sum of skilled payer days', () => {
      const denominators: Denominators = {
        resident_days: 500,
        skilled_days: 175,
        vent_days: 0,
        occupied_units: null,
        payer_days: {
          MEDICARE_A: 100,
          MEDICARE_ADVANTAGE: 50,
          MANAGED_CARE: 0,
          COMMERCIAL: 0,
          VA: 25,
          MEDICAID: 200,
          MANAGED_MEDICAID: 0,
          PRIVATE_PAY: 125,
          HOSPICE: 0,
          ISNP: 0,
          OTHER: 0,
        },
      };

      const anomaly = validateSkilledDaysReconciliation(denominators);

      expect(anomaly).toBeNull();
    });

    it('should return anomaly when skilled_days does not match', () => {
      const denominators: Denominators = {
        resident_days: 500,
        skilled_days: 200, // Mismatch!
        vent_days: 0,
        occupied_units: null,
        payer_days: {
          MEDICARE_A: 100,
          MEDICARE_ADVANTAGE: 50,
          MANAGED_CARE: 0,
          COMMERCIAL: 0,
          VA: 25,
          MEDICAID: 200,
          MANAGED_MEDICAID: 0,
          PRIVATE_PAY: 125,
          HOSPICE: 0,
          ISNP: 0,
          OTHER: 0,
        },
      };

      const anomaly = validateSkilledDaysReconciliation(denominators);

      expect(anomaly).not.toBeNull();
      expect(anomaly?.type).toBe('reconciliation_mismatch');
    });
  });

  describe('computeSkilledMix', () => {
    it('should calculate correct skilled mix percentage', () => {
      const denominators: Denominators = {
        resident_days: 500,
        skilled_days: 175,
        vent_days: 0,
        occupied_units: null,
        payer_days: {
          MEDICARE_A: 100,
          MEDICARE_ADVANTAGE: 50,
          MANAGED_CARE: 0,
          COMMERCIAL: 0,
          VA: 25,
          MEDICAID: 200,
          MANAGED_MEDICAID: 0,
          PRIVATE_PAY: 125,
          HOSPICE: 0,
          ISNP: 0,
          OTHER: 0,
        },
      };

      const mix = computeSkilledMix(denominators);

      expect(mix).toBeCloseTo(35, 1); // 175/500 = 35%
    });

    it('should return null when resident_days is zero', () => {
      const denominators: Denominators = {
        resident_days: 0,
        skilled_days: 0,
        vent_days: 0,
        occupied_units: null,
        payer_days: {
          MEDICARE_A: 0,
          MEDICARE_ADVANTAGE: 0,
          MANAGED_CARE: 0,
          COMMERCIAL: 0,
          VA: 0,
          MEDICAID: 0,
          MANAGED_MEDICAID: 0,
          PRIVATE_PAY: 0,
          HOSPICE: 0,
          ISNP: 0,
          OTHER: 0,
        },
      };

      const mix = computeSkilledMix(denominators);

      expect(mix).toBeNull();
    });
  });

  describe('getDenominatorValue', () => {
    const denominators: Denominators = {
      resident_days: 500,
      skilled_days: 175,
      vent_days: 20,
      occupied_units: 50,
      payer_days: {
        MEDICARE_A: 100,
        MEDICARE_ADVANTAGE: 50,
        MANAGED_CARE: 0,
        COMMERCIAL: 0,
        VA: 25,
        MEDICAID: 200,
        MANAGED_MEDICAID: 0,
        PRIVATE_PAY: 125,
        HOSPICE: 0,
        ISNP: 0,
        OTHER: 0,
      },
    };

    it('should return resident_days for resident_days type', () => {
      expect(getDenominatorValue(denominators, 'resident_days')).toBe(500);
    });

    it('should return skilled_days for skilled_days type', () => {
      expect(getDenominatorValue(denominators, 'skilled_days')).toBe(175);
    });

    it('should return vent_days for vent_days type', () => {
      expect(getDenominatorValue(denominators, 'vent_days')).toBe(20);
    });

    it('should return payer-specific days when payer category provided', () => {
      expect(getDenominatorValue(denominators, 'payer_days', 'MEDICARE_A')).toBe(100);
      expect(getDenominatorValue(denominators, 'payer_days', 'MEDICAID')).toBe(200);
    });
  });
});
