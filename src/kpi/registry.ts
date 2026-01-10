import type { KPIDefinition, SettingType, DenominatorType } from '../types/index.js';

/**
 * KPI Registry - Defines all available KPIs with their formulas and metadata.
 *
 * Each KPI includes:
 * - Unique identifier
 * - Human-readable name and description
 * - Formula explanation
 * - Numerator data source
 * - Denominator type (resident_days, skilled_days, payer_days, etc.)
 * - Payer scope (which payers are relevant)
 * - Unit of measurement
 * - Applicable settings (SNF, ALF, ILF, SeniorLiving)
 * - Direction indicator (higher_is_better)
 */
export const KPI_REGISTRY: Record<string, KPIDefinition> = {
  // ============================================================================
  // REVENUE KPIs
  // ============================================================================
  snf_total_revenue_ppd: {
    kpi_id: 'snf_total_revenue_ppd',
    name: 'Total Revenue PPD',
    description: 'Total revenue per patient day across all payers',
    formula: 'Total Revenue / Resident Days',
    numerator: 'total_revenue',
    denominator_type: 'resident_days',
    payer_scope: 'all',
    unit: 'currency',
    settings: ['SNF'],
    higher_is_better: true,
  },

  snf_skilled_revenue_psd: {
    kpi_id: 'snf_skilled_revenue_psd',
    name: 'Skilled Revenue PSD',
    description:
      'Revenue from skilled payers per skilled day. Skilled = Medicare A + MA + Commercial + VA + ISNP.',
    formula: 'Skilled Revenue / Skilled Days',
    numerator: 'skilled_revenue',
    denominator_type: 'skilled_days',
    payer_scope: 'skilled',
    unit: 'currency',
    settings: ['SNF'],
    higher_is_better: true,
  },

  snf_medicare_a_revenue_psd: {
    kpi_id: 'snf_medicare_a_revenue_psd',
    name: 'Medicare A Revenue PSD',
    description: 'Medicare Part A revenue per Medicare A day',
    formula: 'Medicare A Revenue / Medicare A Days',
    numerator: 'medicare_a_revenue',
    denominator_type: 'payer_days',
    payer_scope: ['MEDICARE_A'],
    unit: 'currency',
    settings: ['SNF'],
    higher_is_better: true,
  },

  snf_ma_revenue_psd: {
    kpi_id: 'snf_ma_revenue_psd',
    name: 'Medicare Advantage Revenue PSD',
    description: 'Medicare Advantage (HMO) revenue per MA day',
    formula: 'MA Revenue / MA Days',
    numerator: 'ma_revenue',
    denominator_type: 'payer_days',
    payer_scope: ['MEDICARE_ADVANTAGE'],
    unit: 'currency',
    settings: ['SNF'],
    higher_is_better: true,
  },

  snf_medicaid_revenue_ppd: {
    kpi_id: 'snf_medicaid_revenue_ppd',
    name: 'Medicaid Revenue PPD',
    description: 'Medicaid revenue per Medicaid day',
    formula: 'Medicaid Revenue / Medicaid Days',
    numerator: 'medicaid_revenue',
    denominator_type: 'payer_days',
    payer_scope: ['MEDICAID'],
    unit: 'currency',
    settings: ['SNF'],
    higher_is_better: true,
  },

  // ============================================================================
  // MIX KPIs
  // ============================================================================
  snf_skilled_mix_pct: {
    kpi_id: 'snf_skilled_mix_pct',
    name: 'Skilled Mix %',
    description: 'Percentage of total patient days that are skilled days',
    formula: '(Skilled Days / Resident Days) × 100',
    numerator: 'skilled_days',
    denominator_type: 'resident_days',
    payer_scope: 'skilled',
    unit: 'percentage',
    settings: ['SNF'],
    higher_is_better: true,
  },

  snf_medicare_a_mix_pct: {
    kpi_id: 'snf_medicare_a_mix_pct',
    name: 'Medicare A Mix %',
    description: 'Percentage of total patient days that are Medicare A days',
    formula: '(Medicare A Days / Resident Days) × 100',
    numerator: 'medicare_a_days',
    denominator_type: 'resident_days',
    payer_scope: ['MEDICARE_A'],
    unit: 'percentage',
    settings: ['SNF'],
    higher_is_better: true,
  },

  snf_ma_mix_pct: {
    kpi_id: 'snf_ma_mix_pct',
    name: 'Medicare Advantage Mix %',
    description: 'Percentage of total patient days that are MA/HMO days',
    formula: '(MA Days / Resident Days) × 100',
    numerator: 'ma_days',
    denominator_type: 'resident_days',
    payer_scope: ['MEDICARE_ADVANTAGE'],
    unit: 'percentage',
    settings: ['SNF'],
    higher_is_better: true,
  },

  // ============================================================================
  // EXPENSE KPIs
  // ============================================================================
  snf_total_cost_ppd: {
    kpi_id: 'snf_total_cost_ppd',
    name: 'Total Operating Cost PPD',
    description: 'Total operating expenses per patient day',
    formula: 'Total Operating Expenses / Resident Days',
    numerator: 'total_operating_expenses',
    denominator_type: 'resident_days',
    payer_scope: 'all',
    unit: 'currency',
    settings: ['SNF'],
    higher_is_better: false,
  },

  snf_nursing_cost_ppd: {
    kpi_id: 'snf_nursing_cost_ppd',
    name: 'Nursing Cost PPD',
    description: 'Total nursing department expenses per patient day',
    formula: 'Total Nursing Expenses / Resident Days',
    numerator: 'total_nursing_expenses',
    denominator_type: 'resident_days',
    payer_scope: 'all',
    unit: 'currency',
    settings: ['SNF'],
    higher_is_better: false,
  },

  snf_therapy_cost_psd: {
    kpi_id: 'snf_therapy_cost_psd',
    name: 'Therapy Cost PSD',
    description: 'Therapy expenses per skilled day',
    formula: 'Total Therapy Expenses / Skilled Days',
    numerator: 'total_therapy_expenses',
    denominator_type: 'skilled_days',
    payer_scope: 'skilled',
    unit: 'currency',
    settings: ['SNF'],
    higher_is_better: false,
  },

  snf_ancillary_cost_psd: {
    kpi_id: 'snf_ancillary_cost_psd',
    name: 'Ancillary Cost PSD',
    description: 'Ancillary expenses (pharmacy, lab, radiology) per skilled day',
    formula: 'Total Ancillary Expenses / Skilled Days',
    numerator: 'total_ancillary_expenses',
    denominator_type: 'skilled_days',
    payer_scope: 'skilled',
    unit: 'currency',
    settings: ['SNF'],
    higher_is_better: false,
  },

  snf_dietary_cost_ppd: {
    kpi_id: 'snf_dietary_cost_ppd',
    name: 'Dietary Cost PPD',
    description: 'Dietary expenses per patient day',
    formula: 'Total Dietary Expenses / Resident Days',
    numerator: 'total_dietary_expenses',
    denominator_type: 'resident_days',
    payer_scope: 'all',
    unit: 'currency',
    settings: ['SNF'],
    higher_is_better: false,
  },

  snf_admin_cost_ppd: {
    kpi_id: 'snf_admin_cost_ppd',
    name: 'Administration Cost PPD',
    description: 'Administration expenses per patient day',
    formula: 'Total Administration Expenses / Resident Days',
    numerator: 'total_administration_expenses',
    denominator_type: 'resident_days',
    payer_scope: 'all',
    unit: 'currency',
    settings: ['SNF'],
    higher_is_better: false,
  },

  // ============================================================================
  // LABOR KPIs
  // ============================================================================
  snf_contract_labor_pct_nursing: {
    kpi_id: 'snf_contract_labor_pct_nursing',
    name: 'Contract Labor % (Nursing)',
    description: 'Percentage of nursing labor costs from agency/contract staff',
    formula: '(Nursing Agency/Contract Cost / Total Nursing Expenses) × 100',
    numerator: 'nursing_agency_contract',
    denominator_type: 'resident_days', // Not really used, it's a ratio
    payer_scope: 'all',
    unit: 'percentage',
    settings: ['SNF'],
    higher_is_better: false,
  },

  snf_total_nurse_hprd_paid: {
    kpi_id: 'snf_total_nurse_hprd_paid',
    name: 'Nursing Hours PPD',
    description: 'Total nursing hours per patient day (paid hours)',
    formula: 'Total Nursing Hours / Patient Days',
    numerator: 'total_nursing_hours',
    denominator_type: 'resident_days',
    payer_scope: 'all',
    unit: 'hours',
    settings: ['SNF'],
    higher_is_better: true,
  },

  // ============================================================================
  // MARGIN KPIs
  // ============================================================================
  snf_operating_margin_pct: {
    kpi_id: 'snf_operating_margin_pct',
    name: 'Operating Margin %',
    description: 'Operating income as percentage of total revenue',
    formula: '((Total Revenue - Total Operating Expenses) / Total Revenue) × 100',
    numerator: 'operating_income',
    denominator_type: 'resident_days', // Not really used
    payer_scope: 'all',
    unit: 'percentage',
    settings: ['SNF'],
    higher_is_better: true,
  },

  snf_skilled_margin_pct: {
    kpi_id: 'snf_skilled_margin_pct',
    name: 'Skilled Margin %',
    description: 'Margin on skilled payer revenue after therapy and ancillary costs',
    formula: '((Skilled Revenue - Therapy Cost - Ancillary Cost) / Skilled Revenue) × 100',
    numerator: 'skilled_margin',
    denominator_type: 'skilled_days',
    payer_scope: 'skilled',
    unit: 'percentage',
    settings: ['SNF'],
    higher_is_better: true,
  },

  // ============================================================================
  // SENIOR LIVING / ALF / ILF KPIs
  // ============================================================================
  sl_occupancy_pct: {
    kpi_id: 'sl_occupancy_pct',
    name: 'Occupancy %',
    description: 'Operational occupancy percentage',
    formula: 'Total Unit Days / (Operational Beds × Days in Month) × 100',
    numerator: 'total_unit_days',
    denominator_type: 'occupied_units',
    payer_scope: 'all',
    unit: 'percentage',
    settings: ['SeniorLiving', 'ALF', 'ILF'],
    higher_is_better: true,
  },

  sl_revpor: {
    kpi_id: 'sl_revpor',
    name: 'RevPOR (Monthly)',
    description: 'Revenue per occupied room per month',
    formula: 'Total Revenue / (Total Unit Days / Days in Month)',
    numerator: 'total_revenue',
    denominator_type: 'occupied_units',
    payer_scope: 'all',
    unit: 'currency',
    settings: ['SeniorLiving', 'ALF', 'ILF'],
    higher_is_better: true,
  },

  sl_revenue_prd: {
    kpi_id: 'sl_revenue_prd',
    name: 'Revenue PPD',
    description: 'Total revenue per patient day',
    formula: 'Total Revenue / Total Patient Days',
    numerator: 'total_revenue',
    denominator_type: 'resident_days',
    payer_scope: 'all',
    unit: 'currency',
    settings: ['SeniorLiving', 'ALF', 'ILF'],
    higher_is_better: true,
  },

  sl_expense_prd: {
    kpi_id: 'sl_expense_prd',
    name: 'Expense PPD',
    description: 'Total operating expense per patient day',
    formula: 'Total Operating Expenses / Total Patient Days',
    numerator: 'total_operating_expenses',
    denominator_type: 'resident_days',
    payer_scope: 'all',
    unit: 'currency',
    settings: ['SeniorLiving', 'ALF', 'ILF'],
    higher_is_better: false,
  },

  sl_private_pay_pct: {
    kpi_id: 'sl_private_pay_pct',
    name: 'Private Pay %',
    description: 'Percentage of revenue from private pay residents',
    formula: '(Private Pay Days / Total Patient Days) × 100',
    numerator: 'private_pay_days',
    denominator_type: 'resident_days',
    payer_scope: ['PRIVATE_PAY'],
    unit: 'percentage',
    settings: ['SeniorLiving', 'ALF', 'ILF'],
    higher_is_better: true,
  },

  sl_operating_margin_pct: {
    kpi_id: 'sl_operating_margin_pct',
    name: 'Operating Margin %',
    description: 'Operating income as percentage of total revenue',
    formula: '((Total Revenue - Total Operating Expenses) / Total Revenue) × 100',
    numerator: 'operating_income',
    denominator_type: 'resident_days',
    payer_scope: 'all',
    unit: 'percentage',
    settings: ['SeniorLiving', 'ALF', 'ILF'],
    higher_is_better: true,
  },

  sl_nursing_prd: {
    kpi_id: 'sl_nursing_prd',
    name: 'Nursing Cost PPD',
    description: 'Nursing expenses per patient day',
    formula: 'Total Nursing Expenses / Total Patient Days',
    numerator: 'total_nursing_expenses',
    denominator_type: 'resident_days',
    payer_scope: 'all',
    unit: 'currency',
    settings: ['SeniorLiving', 'ALF', 'ILF'],
    higher_is_better: false,
  },

  sl_dietary_prd: {
    kpi_id: 'sl_dietary_prd',
    name: 'Dietary Cost PPD',
    description: 'Dietary expenses per patient day',
    formula: 'Total Dietary Expenses / Total Patient Days',
    numerator: 'total_dietary_expenses',
    denominator_type: 'resident_days',
    payer_scope: 'all',
    unit: 'currency',
    settings: ['SeniorLiving', 'ALF', 'ILF'],
    higher_is_better: false,
  },

  sl_admin_prd: {
    kpi_id: 'sl_admin_prd',
    name: 'Admin Cost PPD',
    description: 'Administration expenses per patient day',
    formula: 'Total Administration Expenses / Total Patient Days',
    numerator: 'total_administration_expenses',
    denominator_type: 'resident_days',
    payer_scope: 'all',
    unit: 'currency',
    settings: ['SeniorLiving', 'ALF', 'ILF'],
    higher_is_better: false,
  },
};

/**
 * Get KPIs applicable to a specific setting.
 */
export function getKPIsForSetting(setting: SettingType): KPIDefinition[] {
  return Object.values(KPI_REGISTRY).filter((kpi) => kpi.settings.includes(setting));
}

/**
 * Get MVP KPIs as defined in the spec.
 */
export function getMVPKPIs(): KPIDefinition[] {
  const mvpIds = [
    'snf_total_revenue_ppd',
    'snf_skilled_revenue_psd',
    'snf_skilled_mix_pct',
    'snf_total_cost_ppd',
    'snf_nursing_cost_ppd',
    'snf_contract_labor_pct_nursing',
    'snf_total_nurse_hprd_paid',
    'snf_operating_margin_pct',
    'sl_occupancy_pct_units',
    'sl_revpor',
  ];

  return mvpIds.map((id) => KPI_REGISTRY[id]).filter(Boolean);
}

/**
 * Get KPI glossary terms.
 */
export function getKPIGlossary(): Array<{
  term: string;
  abbreviation: string;
  definition: string;
  denominator_type?: DenominatorType;
  payer_scope?: string;
}> {
  return Object.values(KPI_REGISTRY).map((kpi) => ({
    term: kpi.name,
    abbreviation: kpi.kpi_id,
    definition: `${kpi.description}. Formula: ${kpi.formula}`,
    denominator_type: kpi.denominator_type,
    payer_scope: Array.isArray(kpi.payer_scope) ? kpi.payer_scope.join(', ') : kpi.payer_scope,
  }));
}
