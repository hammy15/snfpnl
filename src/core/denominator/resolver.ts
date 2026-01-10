import type { CensusFact, Denominators, PayerCategory, Anomaly, AnomalyType } from '../../types/index.js';
import { SKILLED_PAYERS } from '../../types/index.js';

/**
 * Resolves denominators from census facts for a given facility and period.
 *
 * Key business rules:
 * - resident_days = total of all patient days (all payers)
 * - skilled_days = Medicare A + Medicare Advantage (HMO) + Commercial + VA + ISNP
 * - Per user requirement: VA is included in skilled
 * - Denied days remain in skilled_days but reduce skilled net revenue
 */
export function resolveDenominators(
  censusFacts: CensusFact[],
  facilityId: string,
  periodId: string
): { denominators: Denominators; anomalies: Anomaly[] } {
  const anomalies: Anomaly[] = [];

  // Filter facts for this facility/period
  const facts = censusFacts.filter(
    (f) => f.facility_id === facilityId && f.period_id === periodId
  );

  // Initialize payer days
  const payerDays: Record<PayerCategory, number> = {
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
  };

  let ventDays = 0;

  // Aggregate days by payer
  for (const fact of facts) {
    if (fact.payer_category && payerDays[fact.payer_category] !== undefined) {
      payerDays[fact.payer_category] += fact.days;
    }
    if (fact.is_vent) {
      ventDays += fact.days;
    }
  }

  // Calculate resident_days (all patient days)
  const residentDays = Object.values(payerDays).reduce((sum, days) => sum + days, 0);

  // Calculate skilled_days per business definition
  // Skilled = Medicare A + Medicare Advantage + Commercial + VA + ISNP
  const skilledDays = SKILLED_PAYERS.reduce((sum, payer) => sum + (payerDays[payer] || 0), 0);

  // Validate: skilled_days should not exceed resident_days
  if (skilledDays > residentDays && residentDays > 0) {
    anomalies.push({
      type: 'skilled_exceeds_total' as AnomalyType,
      severity: 'error',
      message: `Skilled days (${skilledDays}) exceed total resident days (${residentDays})`,
      field: 'skilled_days',
      expected: `<= ${residentDays}`,
      actual: String(skilledDays),
    });
  }

  // Validate: sum of payer days should approximate total resident days
  const calculatedTotal = Object.values(payerDays).reduce((sum, d) => sum + d, 0);
  if (Math.abs(calculatedTotal - residentDays) > 1) {
    anomalies.push({
      type: 'payer_days_mismatch' as AnomalyType,
      severity: 'warning',
      message: `Sum of payer days (${calculatedTotal}) does not match total resident days (${residentDays})`,
      field: 'payer_days',
      expected: String(residentDays),
      actual: String(calculatedTotal),
    });
  }

  // Check for missing data
  if (residentDays === 0 && facts.length === 0) {
    anomalies.push({
      type: 'missing_data' as AnomalyType,
      severity: 'warning',
      message: `No census data found for facility ${facilityId} period ${periodId}`,
      field: 'census_facts',
    });
  }

  return {
    denominators: {
      resident_days: residentDays,
      skilled_days: skilledDays,
      vent_days: ventDays,
      occupied_units: null, // Senior living metric, calculated separately
      payer_days: payerDays,
    },
    anomalies,
  };
}

/**
 * Validates that skilled_days equals sum of skilled payer days.
 * This is a reconciliation check per the spec.
 */
export function validateSkilledDaysReconciliation(
  denominators: Denominators
): Anomaly | null {
  const { skilled_days, payer_days } = denominators;

  const calculatedSkilled = SKILLED_PAYERS.reduce(
    (sum, payer) => sum + (payer_days[payer] || 0),
    0
  );

  if (Math.abs(skilled_days - calculatedSkilled) > 0.01) {
    return {
      type: 'reconciliation_mismatch' as AnomalyType,
      severity: 'error',
      message: `Skilled days (${skilled_days}) does not equal sum of skilled payer days (${calculatedSkilled})`,
      field: 'skilled_days',
      expected: String(calculatedSkilled),
      actual: String(skilled_days),
    };
  }

  return null;
}

/**
 * Computes skilled mix percentage.
 */
export function computeSkilledMix(denominators: Denominators): number | null {
  const { resident_days, skilled_days } = denominators;

  if (resident_days === 0) return null;

  return (skilled_days / resident_days) * 100;
}

/**
 * Returns the appropriate denominator value for a given type.
 */
export function getDenominatorValue(
  denominators: Denominators,
  type: string,
  payerCategory?: PayerCategory
): number {
  switch (type) {
    case 'resident_days':
      return denominators.resident_days;
    case 'skilled_days':
      return denominators.skilled_days;
    case 'vent_days':
      return denominators.vent_days;
    case 'occupied_units':
      return denominators.occupied_units || 0;
    case 'payer_days':
      if (payerCategory) {
        return denominators.payer_days[payerCategory] || 0;
      }
      return 0;
    default:
      return 0;
  }
}

/**
 * Glossary entries for denominator terms.
 */
export const DENOMINATOR_GLOSSARY = [
  {
    term: 'Per Patient Day',
    abbreviation: 'PPD',
    definition:
      'Metric calculated using total resident/patient days as the denominator. Includes all payers.',
    denominator_type: 'resident_days',
  },
  {
    term: 'Per Skilled Day',
    abbreviation: 'PSD',
    definition:
      'Metric calculated using skilled days as the denominator. Skilled days = Medicare A + Medicare Advantage (HMO) + Commercial + VA + ISNP days.',
    denominator_type: 'skilled_days',
  },
  {
    term: 'Per Vent Day',
    abbreviation: 'PVD',
    definition: 'Metric calculated using ventilator patient days as the denominator.',
    denominator_type: 'vent_days',
  },
  {
    term: 'Skilled Days',
    abbreviation: 'SD',
    definition:
      'Total days for patients covered by skilled payers: Medicare Part A, Medicare Advantage (MA/HMO), Commercial skilled, VA skilled, and ISNP.',
    denominator_type: 'skilled_days',
  },
  {
    term: 'Resident Days',
    abbreviation: 'RD',
    definition: 'Total patient days across all payer types for the period.',
    denominator_type: 'resident_days',
  },
  {
    term: 'Skilled Mix',
    abbreviation: 'SM%',
    definition:
      'Percentage of total resident days that are skilled days. Formula: (Skilled Days / Resident Days) × 100.',
    denominator_type: 'skilled_days',
    payer_scope: 'skilled',
  },
];
