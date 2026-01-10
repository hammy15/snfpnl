import { z } from 'zod';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const SettingType = {
  SNF: 'SNF',
  ALF: 'ALF',
  ILF: 'ILF',
  SeniorLiving: 'SeniorLiving',
} as const;
export type SettingType = (typeof SettingType)[keyof typeof SettingType];

export const TherapyDeliveryModel = {
  IN_HOUSE: 'IN_HOUSE',
  CONTRACT: 'CONTRACT',
  HYBRID: 'HYBRID',
  UNKNOWN: 'UNKNOWN',
} as const;
export type TherapyDeliveryModel = (typeof TherapyDeliveryModel)[keyof typeof TherapyDeliveryModel];

export const TherapyContractType = {
  PASS_THROUGH: 'PASS_THROUGH',
  REVENUE_SHARE: 'REVENUE_SHARE',
  FIXED_FEE: 'FIXED_FEE',
  UNKNOWN: 'UNKNOWN',
} as const;
export type TherapyContractType = (typeof TherapyContractType)[keyof typeof TherapyContractType];

export const AccountingBasis = {
  ACCRUAL: 'accrual',
  CASH: 'cash',
  MIXED: 'mixed',
} as const;
export type AccountingBasis = (typeof AccountingBasis)[keyof typeof AccountingBasis];

// Canonical payer categories
export const PayerCategory = {
  MEDICARE_A: 'MEDICARE_A',
  MEDICARE_ADVANTAGE: 'MEDICARE_ADVANTAGE', // HMO/MA plans
  MANAGED_CARE: 'MANAGED_CARE', // Non-MA managed care
  COMMERCIAL: 'COMMERCIAL',
  VA: 'VA',
  MEDICAID: 'MEDICAID',
  MANAGED_MEDICAID: 'MANAGED_MEDICAID',
  PRIVATE_PAY: 'PRIVATE_PAY',
  HOSPICE: 'HOSPICE',
  ISNP: 'ISNP', // Institutional Special Needs Plan
  OTHER: 'OTHER',
} as const;
export type PayerCategory = (typeof PayerCategory)[keyof typeof PayerCategory];

// Skilled payer list (defines PSD denominator)
export const SKILLED_PAYERS: PayerCategory[] = [
  PayerCategory.MEDICARE_A,
  PayerCategory.MEDICARE_ADVANTAGE,
  PayerCategory.COMMERCIAL,
  PayerCategory.VA,
  PayerCategory.ISNP,
];

export const DenominatorType = {
  RESIDENT_DAYS: 'resident_days', // All patient days (PPD)
  SKILLED_DAYS: 'skilled_days', // Medicare A + MA + Commercial + VA (PSD)
  PAYER_DAYS: 'payer_days', // Specific payer category days
  OCCUPIED_UNITS: 'occupied_units', // For senior living
  VENT_DAYS: 'vent_days',
} as const;
export type DenominatorType = (typeof DenominatorType)[keyof typeof DenominatorType];

export const TimeGranularity = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const;
export type TimeGranularity = (typeof TimeGranularity)[keyof typeof TimeGranularity];

// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface Facility {
  facility_id: string;
  name: string;
  short_name: string;
  dba: string | null;
  legal_name: string | null;
  parent_opco: string | null;
  setting: SettingType;
  state: string;
  city: string | null;
  address: string | null;
  therapy_delivery_model: TherapyDeliveryModel;
  therapy_contract_type: TherapyContractType;
  licensed_beds: number | null;
  operational_beds: number | null;
  is_urban: boolean | null;
  region: string | null; // e.g., 'West_of_Mississippi'
}

export interface Period {
  period_id: string; // yyyy-mm format
  year: number;
  month: number;
  days_in_month: number;
  start_date: string; // ISO date
  end_date: string; // ISO date
}

// ============================================================================
// FINANCIAL FACTS
// ============================================================================

export interface FinanceFact {
  facility_id: string;
  period_id: string;
  account_category: string;
  account_subcategory: string;
  department: string | null;
  payer_category: PayerCategory | null;
  amount: number;
  denominator_type: DenominatorType;
  source_file: string;
}

export interface CensusFact {
  facility_id: string;
  period_id: string;
  payer_category: PayerCategory;
  days: number;
  is_skilled: boolean;
  is_vent: boolean;
  source_file: string;
}

export interface StaffingFact {
  facility_id: string;
  period_id: string;
  department: string;
  staff_type: string; // RN, LPN, CNA, Contract, etc.
  hours: number;
  fte: number | null;
  cost: number;
  is_contract_labor: boolean;
  source_file: string;
}

export interface OccupancyFact {
  facility_id: string;
  period_id: string;
  operational_beds: number;
  licensed_beds: number;
  total_patient_days: number;
  total_unit_days: number;
  second_occupant_days: number;
  operational_occupancy: number; // As decimal (0.895 = 89.5%)
  source_file: string;
}

// ============================================================================
// DENOMINATORS
// ============================================================================

export interface Denominators {
  resident_days: number;
  skilled_days: number;
  vent_days: number;
  occupied_units: number | null;
  payer_days: Record<PayerCategory, number>;
}

// ============================================================================
// KPI DEFINITIONS
// ============================================================================

export interface KPIDefinition {
  kpi_id: string;
  name: string;
  description: string;
  formula: string; // Human-readable formula
  numerator: string;
  denominator_type: DenominatorType;
  payer_scope: PayerCategory[] | 'all' | 'skilled' | 'non_skilled';
  unit: 'currency' | 'percentage' | 'ratio' | 'hours' | 'days';
  settings: SettingType[]; // Which settings this KPI applies to
  higher_is_better: boolean;
}

export interface KPIResult {
  kpi_id: string;
  value: number | null;
  numerator_value: number;
  denominator_value: number;
  denominator_type: DenominatorType;
  payer_scope: string;
  unit: string;
  warnings: string[];
}

// ============================================================================
// BENCHMARKS
// ============================================================================

export interface BenchmarkStats {
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  mean: number;
  std_dev: number;
}

export interface Benchmark {
  kpi_id: string;
  cohort: string; // e.g., 'state:ID', 'region:West', 'all'
  period_id: string;
  stats: BenchmarkStats;
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

export const AnomalyType = {
  RECONCILIATION_MISMATCH: 'reconciliation_mismatch',
  SKILLED_EXCEEDS_TOTAL: 'skilled_exceeds_total',
  PAYER_DAYS_MISMATCH: 'payer_days_mismatch',
  MISSING_DATA: 'missing_data',
  OUTLIER: 'outlier',
  NEGATIVE_VALUE: 'negative_value',
} as const;
export type AnomalyType = (typeof AnomalyType)[keyof typeof AnomalyType];

export interface Anomaly {
  type: AnomalyType;
  severity: 'warning' | 'error';
  message: string;
  field: string;
  expected?: number | string;
  actual?: number | string;
}

// ============================================================================
// OUTPUT BUNDLE
// ============================================================================

export interface FacilityMonthBundle {
  meta: {
    facility_id: string;
    facility_name: string;
    period: string;
    state: string;
    setting: SettingType;
    therapy_delivery_model: TherapyDeliveryModel;
    accounting_basis: AccountingBasis;
    source_files: string[];
    generated_at: string;
  };
  denominators: Denominators;
  kpis: KPIResult[];
  benchmarks: Record<string, BenchmarkStats>;
  anomalies: Anomaly[];
  glossary: GlossaryTerm[];
}

export interface GlossaryTerm {
  term: string;
  abbreviation: string;
  definition: string;
  denominator_type?: DenominatorType;
  payer_scope?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export const AppConfigSchema = z.object({
  facilities: z.array(
    z.object({
      facility_id: z.string(),
      name: z.string(),
      state: z.string(),
      setting: z.enum(['SNF', 'ALF', 'ILF', 'SeniorLiving', 'Both']),
      therapy_delivery_model: z.enum(['IN_HOUSE', 'CONTRACT', 'HYBRID', 'UNKNOWN']),
      therapy_contract_type: z.enum(['PASS_THROUGH', 'REVENUE_SHARE', 'FIXED_FEE', 'UNKNOWN']),
      available_beds: z.number().nullable().optional(),
      licensed_beds: z.number().nullable().optional(),
    })
  ),
  payer_alias_map: z.record(z.string(), z.string()),
  denominator_alias_map: z.record(z.string(), z.string()),
  skilled_payers: z.array(z.string()),
  data_source_path: z.string(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
