import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import type { Facility, SettingType, TherapyDeliveryModel, TherapyContractType } from '../types/index.js';

interface RawFacilityRow {
  'Legal Name'?: string;
  'Parent OpCo'?: string;
  'Facility Code'?: string | number;
  'Short Name'?: string;
  Type?: string;
  Location?: string;
  'Licensed Beds'?: number | string;
  'Operational Beds'?: number | string;
  DBA?: string;
  [key: string]: unknown;
}

function parseSettingType(type: string | undefined): SettingType {
  if (!type) return 'SNF';
  const normalized = type.toUpperCase().trim();
  if (normalized === 'SNF') return 'SNF';
  if (normalized === 'ALF') return 'ALF';
  if (normalized === 'ILF') return 'ILF';
  if (normalized.includes('SENIOR') || normalized.includes('RETIREMENT')) return 'SeniorLiving';
  return 'SNF';
}

function extractState(location: string | undefined): string {
  if (!location) return 'UNKNOWN';
  // Extract state from address like "1204 Shriver, Orofino, ID 83544"
  const stateMatch = location.match(/,\s*([A-Z]{2})\s*\d{5}/);
  if (stateMatch) return stateMatch[1];

  // Try extracting 2-letter state code before zip
  const altMatch = location.match(/([A-Z]{2})\s*\d{5}/);
  if (altMatch) return altMatch[1];

  // Common state abbreviations
  if (location.includes('Idaho')) return 'ID';
  if (location.includes('Montana')) return 'MT';
  if (location.includes('Oregon')) return 'OR';
  if (location.includes('Washington')) return 'WA';
  if (location.includes('Arizona')) return 'AZ';

  return 'UNKNOWN';
}

function extractCity(location: string | undefined): string | null {
  if (!location) return null;
  // Extract city from address
  const parts = location.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 2].trim();
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function parseFacilityMasterCSV(filePath: string): Facility[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  if (lines.length < 2) return [];

  // Parse header
  const headers = lines[0].split(',').map((h) => h.replace(/[""]/g, '').trim());

  const facilities: Facility[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handle quoted values with commas)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    // Create row object
    const row: RawFacilityRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });

    // Skip non-facility rows (headers, totals, etc.)
    const facilityCode = row['Facility Code'];
    if (!facilityCode || facilityCode === 'Facility Code') continue;

    const facilityId = String(facilityCode).padStart(3, '0');
    const setting = parseSettingType(row['Type']);
    const state = extractState(row['Location']);

    // Skip if we can't identify the facility
    if (facilityId === '000' || facilityId === 'NaN') continue;

    facilities.push({
      facility_id: facilityId,
      name: row['Short Name'] || row['Legal Name'] || `Facility ${facilityId}`,
      short_name: row['Short Name'] || '',
      dba: row['DBA'] || null,
      legal_name: row['Legal Name'] || null,
      parent_opco: row['Parent OpCo'] || null,
      setting,
      state,
      city: extractCity(row['Location']),
      address: row['Location'] || null,
      therapy_delivery_model: 'UNKNOWN' as TherapyDeliveryModel,
      therapy_contract_type: 'UNKNOWN' as TherapyContractType,
      licensed_beds: parseNumber(row['Licensed Beds']),
      operational_beds: parseNumber(row['Operational Beds']),
      is_urban: null,
      region: determineRegion(state),
    });
  }

  return facilities;
}

export function parseFacilityMasterExcel(filePath: string): Facility[] {
  const workbook = XLSX.readFile(filePath);
  const firstSheet = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheet];
  const data = XLSX.utils.sheet_to_json<RawFacilityRow>(worksheet);

  const facilities: Facility[] = [];

  for (const row of data) {
    const facilityCode = row['Facility Code'];
    if (!facilityCode) continue;

    const facilityId = String(facilityCode).padStart(3, '0');
    const setting = parseSettingType(row['Type']);
    const state = extractState(row['Location']);

    if (facilityId === '000' || facilityId === 'NaN') continue;

    facilities.push({
      facility_id: facilityId,
      name: row['Short Name'] || row['Legal Name'] || `Facility ${facilityId}`,
      short_name: row['Short Name'] || '',
      dba: row['DBA'] || null,
      legal_name: row['Legal Name'] || null,
      parent_opco: row['Parent OpCo'] || null,
      setting,
      state,
      city: extractCity(row['Location']),
      address: row['Location'] || null,
      therapy_delivery_model: 'UNKNOWN' as TherapyDeliveryModel,
      therapy_contract_type: 'UNKNOWN' as TherapyContractType,
      licensed_beds: parseNumber(row['Licensed Beds']),
      operational_beds: parseNumber(row['Operational Beds']),
      is_urban: null,
      region: determineRegion(state),
    });
  }

  return facilities;
}

function determineRegion(state: string): string {
  const westOfMississippi = [
    'AK',
    'AZ',
    'CA',
    'CO',
    'HI',
    'ID',
    'KS',
    'MT',
    'NE',
    'NV',
    'NM',
    'ND',
    'OK',
    'OR',
    'SD',
    'TX',
    'UT',
    'WA',
    'WY',
  ];

  if (westOfMississippi.includes(state)) {
    return 'West_of_Mississippi';
  }
  return 'East_of_Mississippi';
}

export function loadFacilities(dataPath: string): Facility[] {
  const csvPath = path.join(dataPath, 'CHCMASTERINFO.csv');
  const excelPath = path.join(dataPath, 'Entity List.xlsx');

  let facilities: Facility[] = [];

  if (fs.existsSync(csvPath)) {
    facilities = parseFacilityMasterCSV(csvPath);
  } else if (fs.existsSync(excelPath)) {
    facilities = parseFacilityMasterExcel(excelPath);
  }

  return facilities;
}
