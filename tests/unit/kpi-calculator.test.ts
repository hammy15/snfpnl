import { describe, it, expect } from 'vitest';
import { calculateAllKPIs, calculateMVPKPIs } from '../../src/kpi/calculator.js';
import type { FinanceFact, CensusFact } from '../../src/types/index.js';

describe('KPI Calculator', () => {
  // Sample data for testing
  const censusFacts: CensusFact[] = [
    { facility_id: '101', period_id: '2024-11', payer_category: 'MEDICARE_A', days: 100, is_skilled: true, is_vent: false, source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', payer_category: 'MEDICARE_ADVANTAGE', days: 50, is_skilled: true, is_vent: false, source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', payer_category: 'VA', days: 25, is_skilled: true, is_vent: false, source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', payer_category: 'MEDICAID', days: 200, is_skilled: false, is_vent: false, source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', payer_category: 'PRIVATE_PAY', days: 125, is_skilled: false, is_vent: false, source_file: 'test.xlsx' },
  ];

  const financeFacts: FinanceFact[] = [
    // Revenue
    { facility_id: '101', period_id: '2024-11', account_category: 'Revenue', account_subcategory: 'Total', department: null, payer_category: null, amount: 500000, denominator_type: 'resident_days', source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', account_category: 'Revenue', account_subcategory: 'Total Skilled', department: null, payer_category: null, amount: 350000, denominator_type: 'skilled_days', source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', account_category: 'Revenue', account_subcategory: 'Skilled', department: null, payer_category: 'MEDICARE_A', amount: 200000, denominator_type: 'skilled_days', source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', account_category: 'Revenue', account_subcategory: 'Skilled', department: null, payer_category: 'MEDICARE_ADVANTAGE', amount: 100000, denominator_type: 'skilled_days', source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', account_category: 'Revenue', account_subcategory: 'Non-Skilled', department: null, payer_category: 'MEDICAID', amount: 120000, denominator_type: 'resident_days', source_file: 'test.xlsx' },

    // Expenses
    { facility_id: '101', period_id: '2024-11', account_category: 'Expense', account_subcategory: 'Total Operating', department: null, payer_category: null, amount: 400000, denominator_type: 'resident_days', source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', account_category: 'Expense', account_subcategory: 'Total Nursing', department: '711', payer_category: null, amount: 150000, denominator_type: 'resident_days', source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', account_category: 'Expense', account_subcategory: 'Nursing Contract Labor', department: '711', payer_category: null, amount: 30000, denominator_type: 'resident_days', source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', account_category: 'Expense', account_subcategory: 'Total Therapy', department: '683', payer_category: null, amount: 50000, denominator_type: 'skilled_days', source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', account_category: 'Expense', account_subcategory: 'Total Ancillary', department: '700', payer_category: null, amount: 40000, denominator_type: 'skilled_days', source_file: 'test.xlsx' },
    { facility_id: '101', period_id: '2024-11', account_category: 'Expense', account_subcategory: 'Total Dietary', department: '831', payer_category: null, amount: 60000, denominator_type: 'resident_days', source_file: 'test.xlsx' },
  ];

  describe('calculateAllKPIs', () => {
    it('should calculate snf_total_revenue_ppd correctly', () => {
      const { results } = calculateAllKPIs(financeFacts, censusFacts, '101', '2024-11', ['snf_total_revenue_ppd']);

      const kpi = results.find(r => r.kpi_id === 'snf_total_revenue_ppd');

      expect(kpi).toBeDefined();
      expect(kpi?.value).toBeCloseTo(1000, 0); // 500000 / 500 = 1000
      expect(kpi?.denominator_type).toBe('resident_days');
      expect(kpi?.unit).toBe('currency');
    });

    it('should calculate snf_skilled_revenue_psd correctly', () => {
      const { results } = calculateAllKPIs(financeFacts, censusFacts, '101', '2024-11', ['snf_skilled_revenue_psd']);

      const kpi = results.find(r => r.kpi_id === 'snf_skilled_revenue_psd');

      expect(kpi).toBeDefined();
      // Skilled days = 100 + 50 + 25 = 175
      // Skilled revenue = 350000
      // PSD = 350000 / 175 = 2000
      expect(kpi?.value).toBeCloseTo(2000, 0);
      expect(kpi?.denominator_type).toBe('skilled_days');
      expect(kpi?.payer_scope).toBe('skilled');
    });

    it('should calculate snf_skilled_mix_pct correctly', () => {
      const { results } = calculateAllKPIs(financeFacts, censusFacts, '101', '2024-11', ['snf_skilled_mix_pct']);

      const kpi = results.find(r => r.kpi_id === 'snf_skilled_mix_pct');

      expect(kpi).toBeDefined();
      // Skilled = 175, Resident = 500
      // Mix = (175/500) * 100 = 35%
      expect(kpi?.value).toBeCloseTo(35, 1);
      expect(kpi?.unit).toBe('percentage');
    });

    it('should calculate snf_nursing_cost_ppd correctly', () => {
      const { results } = calculateAllKPIs(financeFacts, censusFacts, '101', '2024-11', ['snf_nursing_cost_ppd']);

      const kpi = results.find(r => r.kpi_id === 'snf_nursing_cost_ppd');

      expect(kpi).toBeDefined();
      // Nursing expense = 150000, Resident days = 500
      // PPD = 150000 / 500 = 300
      expect(kpi?.value).toBeCloseTo(300, 0);
    });

    it('should calculate snf_contract_labor_pct_nursing correctly', () => {
      const { results } = calculateAllKPIs(financeFacts, censusFacts, '101', '2024-11', ['snf_contract_labor_pct_nursing']);

      const kpi = results.find(r => r.kpi_id === 'snf_contract_labor_pct_nursing');

      expect(kpi).toBeDefined();
      // Contract = 30000, Total Nursing = 150000
      // Pct = (30000/150000) * 100 = 20%
      expect(kpi?.value).toBeCloseTo(20, 1);
      expect(kpi?.unit).toBe('percentage');
    });

    it('should calculate snf_operating_margin_pct correctly', () => {
      const { results } = calculateAllKPIs(financeFacts, censusFacts, '101', '2024-11', ['snf_operating_margin_pct']);

      const kpi = results.find(r => r.kpi_id === 'snf_operating_margin_pct');

      expect(kpi).toBeDefined();
      // Revenue = 500000, Expenses = 400000
      // Margin = ((500000 - 400000) / 500000) * 100 = 20%
      expect(kpi?.value).toBeCloseTo(20, 1);
      expect(kpi?.unit).toBe('percentage');
    });

    it('should calculate snf_therapy_cost_psd correctly', () => {
      const { results } = calculateAllKPIs(financeFacts, censusFacts, '101', '2024-11', ['snf_therapy_cost_psd']);

      const kpi = results.find(r => r.kpi_id === 'snf_therapy_cost_psd');

      expect(kpi).toBeDefined();
      // Therapy = 50000, Skilled days = 175
      // PSD = 50000 / 175 = 285.71
      expect(kpi?.value).toBeCloseTo(285.71, 0);
      expect(kpi?.denominator_type).toBe('skilled_days');
    });

    it('should handle zero denominator gracefully', () => {
      const emptyCensus: CensusFact[] = [];

      const { results } = calculateAllKPIs(financeFacts, emptyCensus, '101', '2024-11', ['snf_total_revenue_ppd']);

      const kpi = results.find(r => r.kpi_id === 'snf_total_revenue_ppd');

      expect(kpi?.value).toBeNull();
      expect(kpi?.warnings).toContain('Denominator is zero for snf_total_revenue_ppd');
    });

    it('should detect anomalies in census data', () => {
      const { anomalies } = calculateAllKPIs(financeFacts, [], '101', '2024-11');

      expect(anomalies.some(a => a.type === 'missing_data')).toBe(true);
    });
  });

  describe('calculateMVPKPIs', () => {
    it('should calculate all MVP KPIs', () => {
      const { results } = calculateMVPKPIs(financeFacts, censusFacts, '101', '2024-11');

      const mvpIds = [
        'snf_total_revenue_ppd',
        'snf_skilled_revenue_psd',
        'snf_skilled_mix_pct',
        'snf_total_cost_ppd',
        'snf_nursing_cost_ppd',
        'snf_contract_labor_pct_nursing',
        'snf_operating_margin_pct',
      ];

      for (const id of mvpIds) {
        expect(results.some(r => r.kpi_id === id)).toBe(true);
      }
    });
  });

  describe('Payer-specific KPIs', () => {
    it('should calculate Medicare A revenue PSD correctly', () => {
      const { results } = calculateAllKPIs(financeFacts, censusFacts, '101', '2024-11', ['snf_medicare_a_revenue_psd']);

      const kpi = results.find(r => r.kpi_id === 'snf_medicare_a_revenue_psd');

      expect(kpi).toBeDefined();
      // Medicare A revenue = 200000, Medicare A days = 100
      // PSD = 200000 / 100 = 2000
      expect(kpi?.value).toBeCloseTo(2000, 0);
    });

    it('should calculate Medicare Advantage revenue PSD correctly', () => {
      const { results } = calculateAllKPIs(financeFacts, censusFacts, '101', '2024-11', ['snf_ma_revenue_psd']);

      const kpi = results.find(r => r.kpi_id === 'snf_ma_revenue_psd');

      expect(kpi).toBeDefined();
      // MA revenue = 100000, MA days = 50
      // PSD = 100000 / 50 = 2000
      expect(kpi?.value).toBeCloseTo(2000, 0);
    });
  });
});
