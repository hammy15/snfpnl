import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/snf_financials.db');
const csvPath = '/Users/hammy/Downloads/CHCMASTERINFO.csv';

interface FacilityData {
  facility_code: string;
  legal_name: string;
  parent_opco: string;
  short_name: string;
  type: string;
  address: string;
  licensed_beds: number | null;
  operational_beds: number | null;
  dba: string;
  ownership_status: string;
  lender_landlord: string;
}

// Leased facility codes - these facilities have lenders like CTRE, Omega, Western Care
const LEASED_FACILITY_CODES = new Set([
  '101', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113',
  '116', '117', '118', '119', '124', '125', '126', '202', '301', '402', '403', '404', '406'
]);

// Path to Ownership facility codes
const PTO_FACILITY_CODES = new Set(['501', '502']);

function parseCSV(content: string): FacilityData[] {
  const lines = content.split('\n');
  const facilities: FacilityData[] = [];

  for (const line of lines) {
    // Skip header and empty lines
    if (!line.trim() || line.includes('Legal Name,Parent OpCo')) continue;
    if (line.includes('Total EBITDAR') || line.includes('Total EBITA') || line.includes('Annualized')) continue;
    if (line.includes('**Owned') || line.startsWith('Leased,')) continue;

    // Parse CSV line (handle quoted fields with commas)
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    // Extract relevant fields
    // Fields: 0=ownership_marker, 1=legal_name, 2=parent_opco, 3=facility_code, 4=short_name, 5=type, 6=location
    // 9=licensed_beds, 10=operational_beds, 13=dba, 28=lender_landlord

    const ownershipMarker = fields[0]?.replace(/"/g, '').trim();
    const facilityCode = fields[3]?.replace(/"/g, '').trim();

    // Skip if no facility code
    if (!facilityCode || facilityCode === '' || facilityCode === 'Facility Code') continue;
    // Skip malformed rows
    if (facilityCode.includes(' ') && facilityCode.length > 10) continue;

    // Determine ownership status based on facility code
    let ownership = 'Owned';
    if (ownershipMarker === 'PO' || PTO_FACILITY_CODES.has(facilityCode)) {
      ownership = 'Path to Ownership';
    } else if (LEASED_FACILITY_CODES.has(facilityCode)) {
      ownership = 'Leased';
    }

    // Get lender from column 29 (0-indexed, header shows column 30)
    const lender = fields[29]?.replace(/"/g, '').trim() || '';

    const facility: FacilityData = {
      facility_code: facilityCode,
      legal_name: fields[1]?.replace(/"/g, '').trim() || '',
      parent_opco: fields[2]?.replace(/"/g, '').trim() || 'Cascadia',
      short_name: fields[4]?.replace(/"/g, '').trim() || '',
      type: fields[5]?.replace(/"/g, '').trim() || 'SNF',
      address: fields[6]?.replace(/"/g, '').trim() || '',
      licensed_beds: parseInt(fields[9]?.replace(/"/g, '').trim()) || null,
      operational_beds: parseInt(fields[10]?.replace(/"/g, '').trim()) || null,
      dba: fields[13]?.replace(/"/g, '').trim() || '',
      ownership_status: ownership,
      lender_landlord: lender,
    };

    if (facility.facility_code) {
      facilities.push(facility);
    }
  }

  return facilities;
}

function extractCity(address: string): string {
  // Extract city from address like "1204 Shriver, Orofino, ID 83544"
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 2].trim();
  }
  return '';
}

function extractState(address: string): string {
  // Extract state from address
  const stateMatch = address.match(/\b(ID|WA|OR|MT|AZ)\b/);
  return stateMatch ? stateMatch[1] : '';
}

async function main() {
  console.log('Reading CSV file...');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  console.log('Parsing facility data...');
  const facilities = parseCSV(csvContent);
  console.log(`Found ${facilities.length} facilities in CSV`);

  console.log('Connecting to database...');
  const db = new Database(dbPath);

  // Add new columns if they don't exist
  console.log('Updating database schema...');
  try {
    db.exec(`ALTER TABLE facilities ADD COLUMN ownership_status TEXT DEFAULT 'Unknown'`);
    console.log('Added ownership_status column');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
    console.log('ownership_status column already exists');
  }

  try {
    db.exec(`ALTER TABLE facilities ADD COLUMN lender_landlord TEXT`);
    console.log('Added lender_landlord column');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) throw e;
    console.log('lender_landlord column already exists');
  }

  // Update facilities
  console.log('Updating facility data...');
  const updateStmt = db.prepare(`
    UPDATE facilities
    SET
      legal_name = ?,
      dba = ?,
      address = ?,
      city = ?,
      licensed_beds = ?,
      operational_beds = ?,
      parent_opco = ?,
      ownership_status = ?,
      lender_landlord = ?
    WHERE facility_id = ?
  `);

  let updated = 0;
  let notFound = 0;

  for (const facility of facilities) {
    const city = extractCity(facility.address);
    const state = extractState(facility.address);

    const result = updateStmt.run(
      facility.legal_name,
      facility.dba,
      facility.address,
      city,
      facility.licensed_beds,
      facility.operational_beds,
      facility.parent_opco,
      facility.ownership_status,
      facility.lender_landlord,
      facility.facility_code
    );

    if (result.changes > 0) {
      updated++;
      console.log(`  Updated: ${facility.facility_code} - ${facility.short_name} (${facility.ownership_status})`);
    } else {
      notFound++;
      console.log(`  Not found in DB: ${facility.facility_code} - ${facility.short_name}`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Updated: ${updated} facilities`);
  console.log(`  Not found: ${notFound} facilities`);

  // Verify the update
  console.log('\nVerifying update...');
  const sample = db.prepare(`
    SELECT facility_id, name, dba, ownership_status, lender_landlord, address
    FROM facilities
    LIMIT 5
  `).all();
  console.log('Sample data:');
  console.table(sample);

  db.close();
  console.log('\nDone!');
}

main().catch(console.error);
