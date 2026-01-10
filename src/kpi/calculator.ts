import type {
  FinanceFact,
  CensusFact,
  OccupancyFact,
  Denominators,
  KPIResult,
  KPIDefinition,
  Anomaly,
} from '../types/index.js';
import { KPI_REGISTRY } from './registry.js';
import { resolveDenominators, getDenominatorValue } from '../core/denominator/resolver.js';
import { SKILLED_PAYERS } from '../types/index.js';

interface OccupancyData {
  operationalBeds: number;
  licensedBeds: number;
  totalPatientDays: number;
  totalUnitDays: number;
  secondOccupantDays: number;
  operationalOccupancy: number;
  daysInMonth: number;
}

interface FinancialTotals {
  total_revenue: number;
  skilled_revenue: number;
  non_skilled_revenue: number;
  medicare_a_revenue: number;
  ma_revenue: number;
  medicaid_revenue: number;
  private_revenue: number;
  hospice_revenue: number;
  va_revenue: number;
  other_revenue: number;

  total_operating_expenses: number;
  total_nursing_expenses: number;
  nursing_wages: number;
  nursing_agency_contract: number;
  total_nursing_hours: number;
  total_therapy_expenses: number;
  total_ancillary_expenses: number;
  total_dietary_expenses: number;
  total_administration_expenses: number;
  total_plant_expenses: number;
  total_housekeeping_expenses: number;
  total_laundry_expenses: number;
  total_social_services_expenses: number;
  total_activities_expenses: number;
  total_medical_records_expenses: number;
  bad_debt: number;
  bed_tax: number;
}

/**
 * Aggregate financial facts into totals for KPI calculation.
 */
function aggregateFinancials(
  facts: FinanceFact[],
  facilityId: string,
  periodId: string
): FinancialTotals {
  const filtered = facts.filter(
    (f) => f.facility_id === facilityId && f.period_id === periodId
  );

  const totals: FinancialTotals = {
    total_revenue: 0,
    skilled_revenue: 0,
    non_skilled_revenue: 0,
    medicare_a_revenue: 0,
    ma_revenue: 0,
    medicaid_revenue: 0,
    private_revenue: 0,
    hospice_revenue: 0,
    va_revenue: 0,
    other_revenue: 0,

    total_operating_expenses: 0,
    total_nursing_expenses: 0,
    nursing_wages: 0,
    nursing_agency_contract: 0,
    total_nursing_hours: 0,
    total_therapy_expenses: 0,
    total_ancillary_expenses: 0,
    total_dietary_expenses: 0,
    total_administration_expenses: 0,
    total_plant_expenses: 0,
    total_housekeeping_expenses: 0,
    total_laundry_expenses: 0,
    total_social_services_expenses: 0,
    total_activities_expenses: 0,
    total_medical_records_expenses: 0,
    bad_debt: 0,
    bed_tax: 0,
  };

  for (const fact of filtered) {
    const { account_category, account_subcategory, payer_category, amount } = fact;

    if (account_category === 'Revenue') {
      // Revenue aggregation
      if (account_subcategory === 'Total') {
        totals.total_revenue += amount;
      } else if (account_subcategory === 'Total Skilled') {
        totals.skilled_revenue += amount;
      } else if (account_subcategory === 'Total Non-Skilled') {
        totals.non_skilled_revenue += amount;
      } else if (account_subcategory === 'Skilled' && payer_category) {
        // Individual skilled revenue by payer
        if (payer_category === 'MEDICARE_A') totals.medicare_a_revenue += amount;
        if (payer_category === 'MEDICARE_ADVANTAGE') totals.ma_revenue += amount;
        if (payer_category === 'VA') totals.va_revenue += amount;
      } else if (account_subcategory === 'Non-Skilled' && payer_category) {
        // Individual non-skilled revenue by payer
        if (payer_category === 'MEDICAID') totals.medicaid_revenue += amount;
        if (payer_category === 'PRIVATE_PAY') totals.private_revenue += amount;
        if (payer_category === 'HOSPICE') totals.hospice_revenue += amount;
      } else if (account_subcategory === 'Total Other') {
        totals.other_revenue += amount;
      }
    } else if (account_category === 'Expense') {
      // Expense aggregation
      if (account_subcategory === 'Total Operating') {
        totals.total_operating_expenses += amount;
      } else if (account_subcategory === 'Total Nursing') {
        totals.total_nursing_expenses += amount;
      } else if (account_subcategory === 'Nursing') {
        // Accumulate nursing wages (exclude benefits, contract labor, etc.)
        // Check department or use account name to identify wages
        if (fact.department === 'Nursing Wages' ||
            (fact.department && fact.department.includes('Wages'))) {
          totals.nursing_wages += amount;
        }
      } else if (account_subcategory === 'Nursing Contract Labor') {
        totals.nursing_agency_contract += amount;
      } else if (account_subcategory === 'Total Therapy') {
        totals.total_therapy_expenses += amount;
      } else if (account_subcategory === 'Total Ancillary') {
        totals.total_ancillary_expenses += amount;
      } else if (account_subcategory === 'Total Dietary') {
        totals.total_dietary_expenses += amount;
      } else if (account_subcategory === 'Total Administration') {
        totals.total_administration_expenses += amount;
      } else if (account_subcategory === 'Total Plant') {
        totals.total_plant_expenses += amount;
      } else if (account_subcategory === 'Total Housekeeping') {
        totals.total_housekeeping_expenses += amount;
      } else if (account_subcategory === 'Total Laundry') {
        totals.total_laundry_expenses += amount;
      } else if (account_subcategory === 'Total Social Services') {
        totals.total_social_services_expenses += amount;
      } else if (account_subcategory === 'Total Activities') {
        totals.total_activities_expenses += amount;
      } else if (account_subcategory === 'Total Medical Records') {
        totals.total_medical_records_expenses += amount;
      } else if (account_subcategory === 'Other') {
        if (fact.account_subcategory?.includes('Bad Debt')) totals.bad_debt += amount;
        if (fact.account_subcategory?.includes('Bed Tax')) totals.bed_tax += amount;
      }
    }
  }

  // If we don't have total revenue from a "Total" line, calculate it
  if (totals.total_revenue === 0) {
    totals.total_revenue =
      totals.skilled_revenue + totals.non_skilled_revenue + totals.other_revenue;
  }

  // Calculate total operating if not provided
  if (totals.total_operating_expenses === 0) {
    totals.total_operating_expenses =
      totals.total_nursing_expenses +
      totals.total_therapy_expenses +
      totals.total_ancillary_expenses +
      totals.total_dietary_expenses +
      totals.total_administration_expenses +
      totals.total_plant_expenses +
      totals.total_housekeeping_expenses +
      totals.total_laundry_expenses +
      totals.total_social_services_expenses +
      totals.total_activities_expenses +
      totals.total_medical_records_expenses +
      totals.bad_debt +
      totals.bed_tax;
  }

  return totals;
}

/**
 * Calculate a single KPI value.
 */
function calculateKPI(
  kpiDef: KPIDefinition,
  totals: FinancialTotals,
  denominators: Denominators,
  occupancy?: OccupancyData
): KPIResult {
  const warnings: string[] = [];
  let numeratorValue = 0;
  let denominatorValue = 0;

  // Get numerator value based on KPI
  switch (kpiDef.kpi_id) {
    case 'snf_total_revenue_ppd':
      numeratorValue = totals.total_revenue;
      denominatorValue = denominators.resident_days;
      break;

    case 'snf_skilled_revenue_psd':
      numeratorValue = totals.skilled_revenue;
      denominatorValue = denominators.skilled_days;
      break;

    case 'snf_medicare_a_revenue_psd':
      numeratorValue = totals.medicare_a_revenue;
      denominatorValue = denominators.payer_days.MEDICARE_A || 0;
      break;

    case 'snf_ma_revenue_psd':
      numeratorValue = totals.ma_revenue;
      denominatorValue = denominators.payer_days.MEDICARE_ADVANTAGE || 0;
      break;

    case 'snf_medicaid_revenue_ppd':
      numeratorValue = totals.medicaid_revenue;
      denominatorValue = denominators.payer_days.MEDICAID || 0;
      break;

    case 'snf_skilled_mix_pct':
      numeratorValue = denominators.skilled_days;
      denominatorValue = denominators.resident_days;
      break;

    case 'snf_medicare_a_mix_pct':
      numeratorValue = denominators.payer_days.MEDICARE_A || 0;
      denominatorValue = denominators.resident_days;
      break;

    case 'snf_ma_mix_pct':
      numeratorValue = denominators.payer_days.MEDICARE_ADVANTAGE || 0;
      denominatorValue = denominators.resident_days;
      break;

    case 'snf_total_cost_ppd':
      numeratorValue = totals.total_operating_expenses;
      denominatorValue = denominators.resident_days;
      break;

    case 'snf_nursing_cost_ppd':
      numeratorValue = totals.total_nursing_expenses;
      denominatorValue = denominators.resident_days;
      break;

    case 'snf_therapy_cost_psd':
      numeratorValue = totals.total_therapy_expenses;
      denominatorValue = denominators.skilled_days;
      break;

    case 'snf_ancillary_cost_psd':
      numeratorValue = totals.total_ancillary_expenses;
      denominatorValue = denominators.skilled_days;
      break;

    case 'snf_dietary_cost_ppd':
      numeratorValue = totals.total_dietary_expenses;
      denominatorValue = denominators.resident_days;
      break;

    case 'snf_admin_cost_ppd':
      numeratorValue = totals.total_administration_expenses;
      denominatorValue = denominators.resident_days;
      break;

    case 'snf_contract_labor_pct_nursing':
      numeratorValue = totals.nursing_agency_contract;
      denominatorValue = totals.total_nursing_expenses;
      break;

    case 'snf_total_nurse_hprd_paid':
      // Calculate nursing hours from staffing data or estimate from expenses
      // If we have total_nursing_hours from staffing_facts, use that
      // Otherwise, estimate from total nursing expenses:
      //   - Wages are typically ~70% of total nursing expenses
      //   - Average blended hourly rate (RN/LPN/CNA mix) is ~$35/hr
      if (totals.total_nursing_hours && totals.total_nursing_hours > 0) {
        numeratorValue = totals.total_nursing_hours;
      } else if (totals.total_nursing_expenses > 0) {
        // Estimate: (Total Nursing Expenses * 0.70) / $35 hourly rate
        const wagesPercent = 0.70;
        const estimatedHourlyRate = 35;
        const estimatedWages = totals.total_nursing_expenses * wagesPercent;
        numeratorValue = estimatedWages / estimatedHourlyRate;
        warnings.push('Nursing hours estimated from expenses (no staffing data)');
      }
      denominatorValue = denominators.resident_days;
      break;

    case 'snf_operating_margin_pct':
      numeratorValue = totals.total_revenue - totals.total_operating_expenses;
      denominatorValue = totals.total_revenue;
      break;

    case 'snf_skilled_margin_pct':
      numeratorValue =
        totals.skilled_revenue -
        totals.total_therapy_expenses -
        totals.total_ancillary_expenses;
      denominatorValue = totals.skilled_revenue;
      break;

    // ALF/ILF KPIs
    case 'sl_occupancy_pct':
      if (occupancy) {
        // operationalOccupancy is already a decimal (e.g., 0.8954)
        // Set numerator/denominator so the division gives us the decimal
        // The percentage conversion happens later via the unit='percentage' flag
        numeratorValue = occupancy.operationalOccupancy;
        denominatorValue = 1;
      } else {
        warnings.push('No occupancy data available');
      }
      break;

    case 'sl_revpor':
      if (occupancy && occupancy.totalUnitDays > 0) {
        // RevPOR = Total Revenue / (Total Unit Days / Days in Month)
        // This gives monthly revenue per occupied unit
        const avgOccupiedUnits = occupancy.totalUnitDays / occupancy.daysInMonth;
        numeratorValue = totals.total_revenue;
        denominatorValue = avgOccupiedUnits;
      } else {
        warnings.push('No occupancy data available for RevPOR calculation');
      }
      break;

    case 'sl_revenue_prd':
      if (occupancy && occupancy.totalPatientDays > 0) {
        numeratorValue = totals.total_revenue;
        denominatorValue = occupancy.totalPatientDays;
      } else {
        // Fall back to census-based resident days
        numeratorValue = totals.total_revenue;
        denominatorValue = denominators.resident_days;
      }
      break;

    case 'sl_expense_prd':
      if (occupancy && occupancy.totalPatientDays > 0) {
        numeratorValue = totals.total_operating_expenses;
        denominatorValue = occupancy.totalPatientDays;
      } else {
        numeratorValue = totals.total_operating_expenses;
        denominatorValue = denominators.resident_days;
      }
      break;

    case 'sl_private_pay_pct':
      numeratorValue = denominators.payer_days.PRIVATE_PAY || 0;
      if (occupancy && occupancy.totalPatientDays > 0) {
        denominatorValue = occupancy.totalPatientDays;
      } else {
        denominatorValue = denominators.resident_days;
      }
      break;

    case 'sl_operating_margin_pct':
      numeratorValue = totals.total_revenue - totals.total_operating_expenses;
      denominatorValue = totals.total_revenue;
      break;

    case 'sl_nursing_prd':
      if (occupancy && occupancy.totalPatientDays > 0) {
        numeratorValue = totals.total_nursing_expenses;
        denominatorValue = occupancy.totalPatientDays;
      } else {
        numeratorValue = totals.total_nursing_expenses;
        denominatorValue = denominators.resident_days;
      }
      break;

    case 'sl_dietary_prd':
      if (occupancy && occupancy.totalPatientDays > 0) {
        numeratorValue = totals.total_dietary_expenses;
        denominatorValue = occupancy.totalPatientDays;
      } else {
        numeratorValue = totals.total_dietary_expenses;
        denominatorValue = denominators.resident_days;
      }
      break;

    case 'sl_admin_prd':
      if (occupancy && occupancy.totalPatientDays > 0) {
        numeratorValue = totals.total_administration_expenses;
        denominatorValue = occupancy.totalPatientDays;
      } else {
        numeratorValue = totals.total_administration_expenses;
        denominatorValue = denominators.resident_days;
      }
      break;

    default:
      warnings.push(`Unknown KPI: ${kpiDef.kpi_id}`);
  }

  // Calculate value
  let value: number | null = null;
  if (denominatorValue !== 0) {
    value = numeratorValue / denominatorValue;

    // Convert to percentage if needed
    if (kpiDef.unit === 'percentage') {
      value = value * 100;
    }
  } else {
    warnings.push(`Denominator is zero for ${kpiDef.kpi_id}`);
  }

  // Add warnings for missing data
  if (numeratorValue === 0) {
    warnings.push(`No data for numerator: ${kpiDef.numerator}`);
  }

  return {
    kpi_id: kpiDef.kpi_id,
    value,
    numerator_value: numeratorValue,
    denominator_value: denominatorValue,
    denominator_type: kpiDef.denominator_type,
    payer_scope: Array.isArray(kpiDef.payer_scope)
      ? kpiDef.payer_scope.join(',')
      : kpiDef.payer_scope,
    unit: kpiDef.unit,
    warnings,
  };
}

/**
 * Calculate all KPIs for a facility and period.
 */
export function calculateAllKPIs(
  financeFacts: FinanceFact[],
  censusFacts: CensusFact[],
  facilityId: string,
  periodId: string,
  kpiIds?: string[],
  occupancyFacts?: OccupancyFact[],
  daysInMonth?: number
): { results: KPIResult[]; anomalies: Anomaly[] } {
  // Resolve denominators
  const { denominators, anomalies } = resolveDenominators(
    censusFacts,
    facilityId,
    periodId
  );

  // Aggregate financial data
  const totals = aggregateFinancials(financeFacts, facilityId, periodId);

  // Get occupancy data for this facility/period
  let occupancy: OccupancyData | undefined;
  if (occupancyFacts) {
    const occFact = occupancyFacts.find(
      (o) => o.facility_id === facilityId && o.period_id === periodId
    );
    if (occFact) {
      occupancy = {
        operationalBeds: occFact.operational_beds,
        licensedBeds: occFact.licensed_beds,
        totalPatientDays: occFact.total_patient_days,
        totalUnitDays: occFact.total_unit_days,
        secondOccupantDays: occFact.second_occupant_days,
        operationalOccupancy: occFact.operational_occupancy,
        daysInMonth: daysInMonth || 30, // Default to 30 if not provided
      };
    }
  }

  // Get KPIs to calculate
  const kpisToCalculate = kpiIds
    ? kpiIds.map((id) => KPI_REGISTRY[id]).filter(Boolean)
    : Object.values(KPI_REGISTRY);

  // Calculate each KPI
  const results: KPIResult[] = [];
  for (const kpiDef of kpisToCalculate) {
    const result = calculateKPI(kpiDef, totals, denominators, occupancy);
    results.push(result);
  }

  return { results, anomalies };
}

/**
 * Calculate MVP KPIs only.
 */
export function calculateMVPKPIs(
  financeFacts: FinanceFact[],
  censusFacts: CensusFact[],
  facilityId: string,
  periodId: string
): { results: KPIResult[]; anomalies: Anomaly[] } {
  const mvpIds = [
    'snf_total_revenue_ppd',
    'snf_skilled_revenue_psd',
    'snf_skilled_mix_pct',
    'snf_total_cost_ppd',
    'snf_nursing_cost_ppd',
    'snf_contract_labor_pct_nursing',
    'snf_operating_margin_pct',
  ];

  return calculateAllKPIs(financeFacts, censusFacts, facilityId, periodId, mvpIds);
}
