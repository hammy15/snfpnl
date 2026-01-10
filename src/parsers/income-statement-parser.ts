import XLSX from 'xlsx';
import type { FinanceFact, CensusFact, OccupancyFact, PayerCategory, DenominatorType } from '../types/index.js';

// Account category classifications
const REVENUE_CATEGORIES: Record<string, { category: string; subcategory: string; payer?: PayerCategory }> = {
  'Medicaid Revenue': { category: 'Revenue', subcategory: 'Non-Skilled', payer: 'MEDICAID' },
  'Managed Medicaid Revenue': { category: 'Revenue', subcategory: 'Non-Skilled', payer: 'MANAGED_MEDICAID' },
  'Private Revenue': { category: 'Revenue', subcategory: 'Non-Skilled', payer: 'PRIVATE_PAY' },
  'Veterans Revenue': { category: 'Revenue', subcategory: 'Non-Skilled', payer: 'VA' },
  'Hospice Revenue': { category: 'Revenue', subcategory: 'Non-Skilled', payer: 'HOSPICE' },
  'Total Non-Skilled Revenue': { category: 'Revenue', subcategory: 'Total Non-Skilled' },

  'Managed Medicaid Revenue - Skilled': { category: 'Revenue', subcategory: 'Skilled', payer: 'MANAGED_MEDICAID' },
  'Medicaid Complex Revenue': { category: 'Revenue', subcategory: 'Skilled', payer: 'MEDICAID' },
  'Medicaid Bariatric Revenue': { category: 'Revenue', subcategory: 'Skilled', payer: 'MEDICAID' },
  'Medicare Revenue': { category: 'Revenue', subcategory: 'Skilled', payer: 'MEDICARE_A' },
  'Veterans Revenue - Skilled': { category: 'Revenue', subcategory: 'Skilled', payer: 'VA' },
  'HMO Revenue': { category: 'Revenue', subcategory: 'Skilled', payer: 'MEDICARE_ADVANTAGE' },
  'ISNP Revenue': { category: 'Revenue', subcategory: 'Skilled', payer: 'ISNP' },
  'Total Skilled Revenue': { category: 'Revenue', subcategory: 'Total Skilled' },

  'Total Vent Revenue': { category: 'Revenue', subcategory: 'Vent' },
  'Med B': { category: 'Revenue', subcategory: 'Other' },
  'Revenue - Other': { category: 'Revenue', subcategory: 'Other' },
  'Total Other Revenue': { category: 'Revenue', subcategory: 'Total Other' },
  'Total Revenue': { category: 'Revenue', subcategory: 'Total' },
};

const EXPENSE_CATEGORIES: Record<string, { category: string; subcategory: string }> = {
  'Therapy Wages': { category: 'Expense', subcategory: 'Therapy' },
  'Therapy Benefits': { category: 'Expense', subcategory: 'Therapy' },
  'Therapy Other': { category: 'Expense', subcategory: 'Therapy' },
  'Total Therapy Expenses': { category: 'Expense', subcategory: 'Total Therapy' },

  'Pharmacy': { category: 'Expense', subcategory: 'Ancillary' },
  'Lab': { category: 'Expense', subcategory: 'Ancillary' },
  'Radiology': { category: 'Expense', subcategory: 'Ancillary' },
  'Non-Therapy Other': { category: 'Expense', subcategory: 'Ancillary' },
  'Total Non-Therapy Expenses': { category: 'Expense', subcategory: 'Total Ancillary Non-Therapy' },
  'Total Ancillary Expenses': { category: 'Expense', subcategory: 'Total Ancillary' },

  'Nursing Wages': { category: 'Expense', subcategory: 'Nursing' },
  'Nursing Benefits': { category: 'Expense', subcategory: 'Nursing' },
  'Nursing Agency/Contract': { category: 'Expense', subcategory: 'Nursing Contract Labor' },
  'Nursing Purchased Services/Consulting': { category: 'Expense', subcategory: 'Nursing' },
  'Nursing Patient Supplies': { category: 'Expense', subcategory: 'Nursing' },
  'Nursing Resource Fee': { category: 'Expense', subcategory: 'Nursing' },
  'Nursing Other': { category: 'Expense', subcategory: 'Nursing' },
  'Total Nursing Expenses': { category: 'Expense', subcategory: 'Total Nursing' },

  'Total Vent Expenses': { category: 'Expense', subcategory: 'Total Vent' },

  'Plant Wages': { category: 'Expense', subcategory: 'Plant' },
  'Plant Benefits': { category: 'Expense', subcategory: 'Plant' },
  'Plant Utilities': { category: 'Expense', subcategory: 'Plant' },
  'Plant Minor Equip/R&M': { category: 'Expense', subcategory: 'Plant' },
  'Plant Other': { category: 'Expense', subcategory: 'Plant' },
  'Total Plant Expenses': { category: 'Expense', subcategory: 'Total Plant' },

  'Housekeeping Wages': { category: 'Expense', subcategory: 'Housekeeping' },
  'Housekeeping Benefits': { category: 'Expense', subcategory: 'Housekeeping' },
  'Housekeeping Other': { category: 'Expense', subcategory: 'Housekeeping' },
  'Total Housekeeping Expenses': { category: 'Expense', subcategory: 'Total Housekeeping' },

  'Laundry Wages': { category: 'Expense', subcategory: 'Laundry' },
  'Laundry Benefits': { category: 'Expense', subcategory: 'Laundry' },
  'Laundry Other': { category: 'Expense', subcategory: 'Laundry' },
  'Total Laundry Expenses': { category: 'Expense', subcategory: 'Total Laundry' },

  'Dietary Wages': { category: 'Expense', subcategory: 'Dietary' },
  'Dietary Benefits': { category: 'Expense', subcategory: 'Dietary' },
  'Dietary Purchased Services/Consulting': { category: 'Expense', subcategory: 'Dietary' },
  'Dietary Food & Supplements': { category: 'Expense', subcategory: 'Dietary' },
  'Dietary Other': { category: 'Expense', subcategory: 'Dietary' },
  'Total Dietary Expenses': { category: 'Expense', subcategory: 'Total Dietary' },

  'Social Services Wages': { category: 'Expense', subcategory: 'Social Services' },
  'Social Services Benefits': { category: 'Expense', subcategory: 'Social Services' },
  'Social Services Other': { category: 'Expense', subcategory: 'Social Services' },
  'Total Social Services Expenses': { category: 'Expense', subcategory: 'Total Social Services' },

  'Activities Wages': { category: 'Expense', subcategory: 'Activities' },
  'Activities Benefits': { category: 'Expense', subcategory: 'Activities' },
  'Activities Other': { category: 'Expense', subcategory: 'Activities' },
  'Total Activities Expenses': { category: 'Expense', subcategory: 'Total Activities' },

  'Medical Records Wages': { category: 'Expense', subcategory: 'Medical Records' },
  'Medical Records Benefits': { category: 'Expense', subcategory: 'Medical Records' },
  'Medical Records Other': { category: 'Expense', subcategory: 'Medical Records' },
  'Total Medical Records Expenses': { category: 'Expense', subcategory: 'Total Medical Records' },

  'Administration Wages': { category: 'Expense', subcategory: 'Administration' },
  'Administration Benefits': { category: 'Expense', subcategory: 'Administration' },
  'Administration Purchased Services/Consulting': { category: 'Expense', subcategory: 'Administration' },
  'Administration Minor Equip/R&M': { category: 'Expense', subcategory: 'Administration' },
  'Administration IT': { category: 'Expense', subcategory: 'Administration' },
  'Administration Insurance': { category: 'Expense', subcategory: 'Administration' },
  'Administration Telecom': { category: 'Expense', subcategory: 'Administration' },
  'Administration Travel': { category: 'Expense', subcategory: 'Administration' },
  'Administration Legal Fees': { category: 'Expense', subcategory: 'Administration' },
  'Administration Recruitment': { category: 'Expense', subcategory: 'Administration' },
  'Administration Resource Fee': { category: 'Expense', subcategory: 'Administration' },
  'Administration Other': { category: 'Expense', subcategory: 'Administration' },
  'Total Administration Expenses': { category: 'Expense', subcategory: 'Total Administration' },

  'Bad Debt': { category: 'Expense', subcategory: 'Other' },
  'Bed Tax': { category: 'Expense', subcategory: 'Other' },
  'Total Operating Expenses': { category: 'Expense', subcategory: 'Total Operating' },

  // Below-the-line expenses (for Net Income calculation)
  'Management Fee': { category: 'Expense', subcategory: 'Management Fee' },

  // Property Expenses
  'Rent/Lease Expense': { category: 'Expense', subcategory: 'Property' },
  'Property Taxes': { category: 'Expense', subcategory: 'Property' },
  'Total Property Expenses': { category: 'Expense', subcategory: 'Total Property' },

  // Other Expenses
  'Depreciation & Amortization': { category: 'Expense', subcategory: 'Depreciation' },
  'Other Misc (Income)/Expense': { category: 'Expense', subcategory: 'Other Non-Operating' },
  '(Gain)/Loss on Assets': { category: 'Expense', subcategory: 'Other Non-Operating' },
  'Interest': { category: 'Expense', subcategory: 'Interest' },
  'Total Other Expenses': { category: 'Expense', subcategory: 'Total Other' },
};

// Census days mapping - matches labels in the census section (rows 197+)
const CENSUS_DAYS_TO_PAYER: Record<string, { payer: PayerCategory; isSkilled: boolean; isVent: boolean }> = {
  'Medicaid Days': { payer: 'MEDICAID', isSkilled: false, isVent: false },
  'Managed Medicaid Days': { payer: 'MANAGED_MEDICAID', isSkilled: false, isVent: false },
  'Private Days': { payer: 'PRIVATE_PAY', isSkilled: false, isVent: false },
  'Veterans Days': { payer: 'VA', isSkilled: true, isVent: false }, // Per user: VA is skilled
  'Hospice Days': { payer: 'HOSPICE', isSkilled: false, isVent: false },
  'Medicare Days': { payer: 'MEDICARE_A', isSkilled: true, isVent: false },
  'Managed Medicaid Skilled Days': { payer: 'MANAGED_MEDICAID', isSkilled: true, isVent: false },
  'Medicaid Complex Days': { payer: 'MEDICAID', isSkilled: true, isVent: false },
  'Medicaid Bariatric Days': { payer: 'MEDICAID', isSkilled: true, isVent: false },
  'Veterans Skilled Days': { payer: 'VA', isSkilled: true, isVent: false },
  'HMO Days': { payer: 'MEDICARE_ADVANTAGE', isSkilled: true, isVent: false },
  'ISNP Days': { payer: 'ISNP', isSkilled: true, isVent: false },
  // Vent days
  'Medicaid Days - Vent': { payer: 'MEDICAID', isSkilled: false, isVent: true },
  'Managed Medicaid Days - Vent': { payer: 'MANAGED_MEDICAID', isSkilled: false, isVent: true },
  'Private Days - Vent': { payer: 'PRIVATE_PAY', isSkilled: false, isVent: true },
  'Veterans Days - Vent': { payer: 'VA', isSkilled: true, isVent: true }, // Per user: VA is skilled
  'Hospice Days - Vent': { payer: 'HOSPICE', isSkilled: false, isVent: true },
  'Medicare Days - Vent': { payer: 'MEDICARE_A', isSkilled: true, isVent: true },
  'HMO Days - Vent': { payer: 'MEDICARE_ADVANTAGE', isSkilled: true, isVent: true },
};

function extractFacilityIdFromSheetName(sheetName: string): { id: string; name: string } | null {
  // Pattern: "405 (Alderwood)" or "102 (Clearwater)"
  const match = sheetName.match(/^(\d+)\s*\((.+)\)$/);
  if (match) {
    return {
      id: match[1].padStart(3, '0'),
      name: match[2].trim(),
    };
  }
  return null;
}

function parsePeriodFromDate(dateVal: unknown): string | null {
  if (dateVal instanceof Date) {
    const year = dateVal.getFullYear();
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
  if (typeof dateVal === 'string') {
    // Handle "2024-01-01 00:00:00" format
    const match = dateVal.match(/^(\d{4})-(\d{2})-\d{2}/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
  }
  if (typeof dateVal === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(dateVal);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}`;
    }
  }
  return null;
}

function getDenominatorType(ppdLookup: string | null): DenominatorType {
  if (!ppdLookup) return 'resident_days';
  const lookup = ppdLookup.toLowerCase();
  if (lookup.includes('skilled')) return 'skilled_days';
  if (lookup.includes('vent')) return 'vent_days';
  return 'resident_days';
}

interface ParsedSheet {
  facilityId: string;
  facilityName: string;
  financeFacts: FinanceFact[];
  censusFacts: CensusFact[];
  occupancyFacts: OccupancyFact[];
  periods: string[];
}

export function parseIncomeStatementSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  sourceFile: string
): ParsedSheet | null {
  const facilityInfo = extractFacilityIdFromSheetName(sheetName);
  if (!facilityInfo) return null;

  const data = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 }) as unknown[][];

  if (data.length < 35) return null;

  // Find the header row with dates (row 26 is index 25)
  const dateRowIndex = 26;
  const dateRow = data[dateRowIndex] as unknown[];

  if (!dateRow) return null;

  // Extract period columns (columns 7-30 are actual data, column 31+ are PPD calculations)
  const periods: string[] = [];
  const periodColIndices: number[] = [];

  for (let col = 7; col <= 30; col++) {
    const period = parsePeriodFromDate(dateRow[col]);
    if (period) {
      periods.push(period);
      periodColIndices.push(col);
    }
  }

  if (periods.length === 0) return null;

  const financeFacts: FinanceFact[] = [];
  const censusFacts: CensusFact[] = [];

  // Parse financial data rows (rows 31-196 approximately)
  for (let rowIdx = 30; rowIdx < Math.min(197, data.length); rowIdx++) {
    const row = data[rowIdx] as unknown[];
    if (!row || row.length < 8) continue;

    const ppdLookup = row[1] as string | null;
    const department = row[2] as string | null;
    const label = row[5] as string | null;

    if (!label || label === '#hiderow') continue;
    if (typeof label !== 'string') continue;

    const labelStr = String(label).trim();

    // Check if this is a revenue row
    const revenueMapping = REVENUE_CATEGORIES[labelStr];
    if (revenueMapping) {
      const denomType = getDenominatorType(ppdLookup);

      for (let i = 0; i < periodColIndices.length; i++) {
        const colIdx = periodColIndices[i];
        const value = row[colIdx];
        const amount = typeof value === 'number' ? value : parseFloat(String(value)) || 0;

        if (amount !== 0) {
          financeFacts.push({
            facility_id: facilityInfo.id,
            period_id: periods[i],
            account_category: revenueMapping.category,
            account_subcategory: revenueMapping.subcategory,
            department: department || null,
            payer_category: revenueMapping.payer || null,
            amount,
            denominator_type: denomType,
            source_file: sourceFile,
          });
        }
      }
      continue;
    }

    // Check if this is an expense row
    const expenseMapping = EXPENSE_CATEGORIES[labelStr];
    if (expenseMapping) {
      const denomType = getDenominatorType(ppdLookup);

      for (let i = 0; i < periodColIndices.length; i++) {
        const colIdx = periodColIndices[i];
        const value = row[colIdx];
        const amount = typeof value === 'number' ? value : parseFloat(String(value)) || 0;

        if (amount !== 0) {
          financeFacts.push({
            facility_id: facilityInfo.id,
            period_id: periods[i],
            account_category: expenseMapping.category,
            account_subcategory: expenseMapping.subcategory,
            department: department || null,
            payer_category: null,
            amount,
            denominator_type: denomType,
            source_file: sourceFile,
          });
        }
      }
    }
  }

  // Parse CENSUS data section (starts around row 197)
  // Look for "Patient Days" header to find start of census section
  let censusStartRow = -1;
  for (let rowIdx = 190; rowIdx < Math.min(210, data.length); rowIdx++) {
    const row = data[rowIdx] as unknown[];
    if (!row) continue;
    const firstNonEmpty = row.find(cell => cell && String(cell).trim() !== '');
    if (firstNonEmpty && String(firstNonEmpty).trim() === 'Patient Days') {
      censusStartRow = rowIdx;
      break;
    }
  }

  // Track occupancy data per period
  const occupancyByPeriod: Record<string, {
    operationalBeds: number;
    licensedBeds: number;
    totalPatientDays: number;
    totalUnitDays: number;
    secondOccupantDays: number;
    operationalOccupancy: number;
  }> = {};

  // Initialize occupancy data for each period
  for (const period of periods) {
    occupancyByPeriod[period] = {
      operationalBeds: 0,
      licensedBeds: 0,
      totalPatientDays: 0,
      totalUnitDays: 0,
      secondOccupantDays: 0,
      operationalOccupancy: 0,
    };
  }

  if (censusStartRow > 0) {
    // Parse census rows (from censusStartRow+2 to about censusStartRow+45)
    for (let rowIdx = censusStartRow + 1; rowIdx < Math.min(censusStartRow + 45, data.length); rowIdx++) {
      const row = data[rowIdx] as unknown[];
      if (!row || row.length < 8) continue;

      // Census row structure: col 3=days label (for payer days), col 5=label (for totals/occupancy)
      const daysLabel = row[3] as string | null;
      const label5 = row[5] as string | null;

      // Check for payer days in column 3
      if (daysLabel) {
        const labelStr = String(daysLabel).trim();
        const censusMapping = CENSUS_DAYS_TO_PAYER[labelStr];

        if (censusMapping) {
          for (let i = 0; i < periodColIndices.length; i++) {
            const colIdx = periodColIndices[i];
            const value = row[colIdx];
            const days = typeof value === 'number' ? value : parseFloat(String(value)) || 0;

            // Only add non-zero days
            if (days > 0) {
              censusFacts.push({
                facility_id: facilityInfo.id,
                period_id: periods[i],
                payer_category: censusMapping.payer,
                days,
                is_skilled: censusMapping.isSkilled,
                is_vent: censusMapping.isVent,
                source_file: sourceFile,
              });
            }
          }
        }

        // Check for Second Occupant Days
        if (labelStr === 'Total Second Occupant Days') {
          for (let i = 0; i < periodColIndices.length; i++) {
            const colIdx = periodColIndices[i];
            const value = row[colIdx];
            const days = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
            if (occupancyByPeriod[periods[i]]) {
              occupancyByPeriod[periods[i]].secondOccupantDays = days;
            }
          }
        }
      }

      // Check for occupancy-related labels in column 5
      if (label5) {
        const labelStr5 = String(label5).trim();

        if (labelStr5 === 'Total Patient Days') {
          for (let i = 0; i < periodColIndices.length; i++) {
            const colIdx = periodColIndices[i];
            const value = row[colIdx];
            const days = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
            if (occupancyByPeriod[periods[i]]) {
              occupancyByPeriod[periods[i]].totalPatientDays = days;
            }
          }
        } else if (labelStr5 === 'Total Unit Days') {
          for (let i = 0; i < periodColIndices.length; i++) {
            const colIdx = periodColIndices[i];
            const value = row[colIdx];
            const days = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
            if (occupancyByPeriod[periods[i]]) {
              occupancyByPeriod[periods[i]].totalUnitDays = days;
            }
          }
        } else if (labelStr5 === 'Operational Beds/Units') {
          for (let i = 0; i < periodColIndices.length; i++) {
            const colIdx = periodColIndices[i];
            const value = row[colIdx];
            const beds = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
            if (occupancyByPeriod[periods[i]]) {
              occupancyByPeriod[periods[i]].operationalBeds = beds;
            }
          }
        } else if (labelStr5 === 'License Beds/Units') {
          for (let i = 0; i < periodColIndices.length; i++) {
            const colIdx = periodColIndices[i];
            const value = row[colIdx];
            const beds = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
            if (occupancyByPeriod[periods[i]]) {
              occupancyByPeriod[periods[i]].licensedBeds = beds;
            }
          }
        } else if (labelStr5 === 'Operational Occupancy') {
          for (let i = 0; i < periodColIndices.length; i++) {
            const colIdx = periodColIndices[i];
            const value = row[colIdx];
            const occ = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
            if (occupancyByPeriod[periods[i]]) {
              occupancyByPeriod[periods[i]].operationalOccupancy = occ;
            }
          }
        }
      }
    }
  }

  // Create occupancy facts
  const occupancyFacts: OccupancyFact[] = [];
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const occData = occupancyByPeriod[period];
    if (occData && (occData.operationalBeds > 0 || occData.totalPatientDays > 0)) {
      occupancyFacts.push({
        facility_id: facilityInfo.id,
        period_id: period,
        operational_beds: occData.operationalBeds,
        licensed_beds: occData.licensedBeds,
        total_patient_days: occData.totalPatientDays,
        total_unit_days: occData.totalUnitDays,
        second_occupant_days: occData.secondOccupantDays,
        operational_occupancy: occData.operationalOccupancy,
        source_file: sourceFile,
      });
    }
  }

  return {
    facilityId: facilityInfo.id,
    facilityName: facilityInfo.name,
    financeFacts,
    censusFacts,
    occupancyFacts,
    periods,
  };
}

export function parseIncomeStatementWorkbook(
  filePath: string
): { financeFacts: FinanceFact[]; censusFacts: CensusFact[]; occupancyFacts: OccupancyFact[]; facilityIds: string[] } {
  const workbook = XLSX.readFile(filePath);
  const allFinanceFacts: FinanceFact[] = [];
  const allCensusFacts: CensusFact[] = [];
  const allOccupancyFacts: OccupancyFact[] = [];
  const facilityIds: string[] = [];

  const sourceFile = filePath.split('/').pop() || filePath;

  for (const sheetName of workbook.SheetNames) {
    // Skip system sheets
    if (
      sheetName.startsWith('vena') ||
      sheetName.startsWith('_vena') ||
      sheetName === 'List' ||
      sheetName === 'Name' ||
      sheetName.includes('Company') ||
      sheetName.includes('Healthcare') ||
      sheetName.includes('Services') ||
      sheetName.includes('Total')
    ) {
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    const parsed = parseIncomeStatementSheet(worksheet, sheetName, sourceFile);

    if (parsed) {
      allFinanceFacts.push(...parsed.financeFacts);
      allCensusFacts.push(...parsed.censusFacts);
      allOccupancyFacts.push(...parsed.occupancyFacts);
      if (!facilityIds.includes(parsed.facilityId)) {
        facilityIds.push(parsed.facilityId);
      }
    }
  }

  return {
    financeFacts: allFinanceFacts,
    censusFacts: allCensusFacts,
    occupancyFacts: allOccupancyFacts,
    facilityIds,
  };
}
