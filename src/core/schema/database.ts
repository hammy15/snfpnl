import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'snf_financials.db');

export function getDatabase(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

export function initializeDatabase(db: Database.Database): void {
  // Facilities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS facilities (
      facility_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT,
      dba TEXT,
      legal_name TEXT,
      parent_opco TEXT,
      setting TEXT NOT NULL CHECK(setting IN ('SNF', 'ALF', 'ILF', 'SeniorLiving')),
      state TEXT NOT NULL,
      city TEXT,
      address TEXT,
      therapy_delivery_model TEXT CHECK(therapy_delivery_model IN ('IN_HOUSE', 'CONTRACT', 'HYBRID', 'UNKNOWN')),
      therapy_contract_type TEXT CHECK(therapy_contract_type IN ('PASS_THROUGH', 'REVENUE_SHARE', 'FIXED_FEE', 'UNKNOWN')),
      licensed_beds INTEGER,
      operational_beds INTEGER,
      is_urban INTEGER,
      region TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Periods table
  db.exec(`
    CREATE TABLE IF NOT EXISTS periods (
      period_id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      days_in_month INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    )
  `);

  // Finance facts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL,
      period_id TEXT NOT NULL,
      account_category TEXT NOT NULL,
      account_subcategory TEXT,
      department TEXT,
      payer_category TEXT,
      amount REAL NOT NULL,
      denominator_type TEXT NOT NULL,
      source_file TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (facility_id) REFERENCES facilities(facility_id),
      FOREIGN KEY (period_id) REFERENCES periods(period_id)
    )
  `);

  // Census facts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS census_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL,
      period_id TEXT NOT NULL,
      payer_category TEXT NOT NULL,
      days REAL NOT NULL,
      is_skilled INTEGER NOT NULL DEFAULT 0,
      is_vent INTEGER NOT NULL DEFAULT 0,
      source_file TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (facility_id) REFERENCES facilities(facility_id),
      FOREIGN KEY (period_id) REFERENCES periods(period_id)
    )
  `);

  // Staffing facts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS staffing_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL,
      period_id TEXT NOT NULL,
      department TEXT NOT NULL,
      staff_type TEXT NOT NULL,
      hours REAL NOT NULL,
      fte REAL,
      cost REAL NOT NULL,
      is_contract_labor INTEGER NOT NULL DEFAULT 0,
      source_file TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (facility_id) REFERENCES facilities(facility_id),
      FOREIGN KEY (period_id) REFERENCES periods(period_id)
    )
  `);

  // Occupancy facts table (for ALF/ILF metrics)
  db.exec(`
    CREATE TABLE IF NOT EXISTS occupancy_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL,
      period_id TEXT NOT NULL,
      operational_beds INTEGER NOT NULL DEFAULT 0,
      licensed_beds INTEGER NOT NULL DEFAULT 0,
      total_patient_days REAL NOT NULL DEFAULT 0,
      total_unit_days REAL NOT NULL DEFAULT 0,
      second_occupant_days REAL NOT NULL DEFAULT 0,
      operational_occupancy REAL,
      source_file TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (facility_id) REFERENCES facilities(facility_id),
      FOREIGN KEY (period_id) REFERENCES periods(period_id),
      UNIQUE(facility_id, period_id)
    )
  `);

  // KPI results cache table
  db.exec(`
    CREATE TABLE IF NOT EXISTS kpi_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL,
      period_id TEXT NOT NULL,
      kpi_id TEXT NOT NULL,
      value REAL,
      numerator_value REAL,
      denominator_value REAL,
      denominator_type TEXT,
      payer_scope TEXT,
      unit TEXT,
      warnings TEXT,
      computed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (facility_id) REFERENCES facilities(facility_id),
      FOREIGN KEY (period_id) REFERENCES periods(period_id),
      UNIQUE(facility_id, period_id, kpi_id)
    )
  `);

  // Benchmarks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS benchmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kpi_id TEXT NOT NULL,
      cohort TEXT NOT NULL,
      period_id TEXT NOT NULL,
      count INTEGER NOT NULL,
      min_val REAL,
      p25 REAL,
      median REAL,
      p75 REAL,
      max_val REAL,
      mean REAL,
      std_dev REAL,
      computed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(kpi_id, cohort, period_id)
    )
  `);

  // Anomalies table
  db.exec(`
    CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL,
      period_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('warning', 'error')),
      message TEXT NOT NULL,
      field TEXT,
      expected TEXT,
      actual TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (facility_id) REFERENCES facilities(facility_id),
      FOREIGN KEY (period_id) REFERENCES periods(period_id)
    )
  `);

  // Import log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT NOT NULL,
      file_type TEXT NOT NULL,
      records_imported INTEGER NOT NULL,
      errors INTEGER NOT NULL DEFAULT 0,
      warnings INTEGER NOT NULL DEFAULT 0,
      imported_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_finance_facts_facility_period
    ON finance_facts(facility_id, period_id);

    CREATE INDEX IF NOT EXISTS idx_census_facts_facility_period
    ON census_facts(facility_id, period_id);

    CREATE INDEX IF NOT EXISTS idx_staffing_facts_facility_period
    ON staffing_facts(facility_id, period_id);

    CREATE INDEX IF NOT EXISTS idx_occupancy_facts_facility_period
    ON occupancy_facts(facility_id, period_id);

    CREATE INDEX IF NOT EXISTS idx_kpi_results_facility_period
    ON kpi_results(facility_id, period_id);

    CREATE INDEX IF NOT EXISTS idx_anomalies_facility_period
    ON anomalies(facility_id, period_id);
  `);
}

export function clearAllData(db: Database.Database): void {
  db.exec(`
    DELETE FROM anomalies;
    DELETE FROM kpi_results;
    DELETE FROM benchmarks;
    DELETE FROM occupancy_facts;
    DELETE FROM staffing_facts;
    DELETE FROM census_facts;
    DELETE FROM finance_facts;
    DELETE FROM import_log;
    DELETE FROM periods;
    DELETE FROM facilities;
  `);
}

export function getDatabaseStats(db: Database.Database): Record<string, number> {
  const tables = [
    'facilities',
    'periods',
    'finance_facts',
    'census_facts',
    'occupancy_facts',
    'staffing_facts',
    'kpi_results',
    'benchmarks',
    'anomalies',
  ];

  const stats: Record<string, number> = {};
  for (const table of tables) {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
    stats[table] = result.count;
  }
  return stats;
}
