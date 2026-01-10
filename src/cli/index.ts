#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { getDatabase, initializeDatabase, getDatabaseStats } from '../core/schema/database.js';
import { loadFacilities } from '../parsers/facility-master-parser.js';
import { parseIncomeStatementWorkbook } from '../parsers/income-statement-parser.js';
import { calculateAllKPIs } from '../kpi/calculator.js';
import { resolveDenominators } from '../core/denominator/resolver.js';
import { generateBenchmarks, getBenchmarksForFacility } from '../benchmark/engine.js';
import {
  generateFacilityMonthBundle,
  writeBundleToFile,
  writeCombinedKPITable,
  writePromptPack,
} from '../output/bundle-generator.js';
import type { AppConfig, Facility, FinanceFact, CensusFact, OccupancyFact } from '../types/index.js';

const program = new Command();

program
  .name('snf-financials')
  .description('SNF & Senior Living Financial Data Normalizer and KPI Calculator')
  .version('1.0.0');

// ============================================================================
// IMPORT COMMAND
// ============================================================================
program
  .command('import')
  .description('Import financial data from Excel/CSV files')
  .option('-p, --path <path>', 'Path to data directory', '/Users/hammy/Desktop/CHC Financial Review')
  .option('-c, --clear', 'Clear existing data before import')
  .action(async (options) => {
    console.log(chalk.blue('\n=== SNF Financials Data Import ===\n'));

    const dataPath = options.path;

    if (!fs.existsSync(dataPath)) {
      console.error(chalk.red(`Error: Data path does not exist: ${dataPath}`));
      process.exit(1);
    }

    const db = getDatabase();
    initializeDatabase(db);

    if (options.clear) {
      console.log(chalk.yellow('Clearing existing data...'));
      // Delete child tables first, then parent tables
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

    // Load facilities
    console.log(chalk.cyan('Loading facility master data...'));
    const facilities = loadFacilities(dataPath);
    console.log(chalk.green(`  Found ${facilities.length} facilities`));

    // Insert facilities into database
    const insertFacility = db.prepare(`
      INSERT OR REPLACE INTO facilities
      (facility_id, name, short_name, dba, legal_name, parent_opco, setting, state, city, address,
       therapy_delivery_model, therapy_contract_type, licensed_beds, operational_beds, is_urban, region)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const f of facilities) {
      insertFacility.run(
        f.facility_id,
        f.name,
        f.short_name,
        f.dba,
        f.legal_name,
        f.parent_opco,
        f.setting,
        f.state,
        f.city,
        f.address,
        f.therapy_delivery_model,
        f.therapy_contract_type,
        f.licensed_beds,
        f.operational_beds,
        f.is_urban ? 1 : 0,
        f.region
      );
    }

    // Find income statement files
    const files = fs.readdirSync(dataPath).filter(
      (f) => f.includes('Income Statements') && f.endsWith('.xlsx')
    );

    let totalFinanceFacts = 0;
    let totalCensusFacts = 0;
    let totalOccupancyFacts = 0;

    for (const file of files) {
      const filePath = path.join(dataPath, file);
      console.log(chalk.cyan(`\nParsing: ${file}`));

      try {
        const { financeFacts, censusFacts, occupancyFacts, facilityIds } = parseIncomeStatementWorkbook(filePath);

        console.log(chalk.green(`  Parsed ${facilityIds.length} facilities`));
        console.log(chalk.green(`  ${financeFacts.length} financial records`));
        console.log(chalk.green(`  ${censusFacts.length} census records`));
        console.log(chalk.green(`  ${occupancyFacts.length} occupancy records`));

        // Insert missing facilities found in income statements
        const existingFacilities = new Set(
          (db.prepare('SELECT facility_id FROM facilities').all() as { facility_id: string }[])
            .map(r => r.facility_id)
        );

        for (const facId of facilityIds) {
          if (!existingFacilities.has(facId)) {
            console.log(chalk.yellow(`  Adding missing facility: ${facId}`));
            insertFacility.run(
              facId,
              `Facility ${facId}`,
              `Facility ${facId}`,
              null, null, null,
              'SNF', // Default
              'UNKNOWN',
              null, null,
              'UNKNOWN', 'UNKNOWN',
              null, null, 0, null
            );
            existingFacilities.add(facId);
          }
        }

        // Insert periods
        const periods = new Set(financeFacts.map((f) => f.period_id));
        const insertPeriod = db.prepare(`
          INSERT OR IGNORE INTO periods (period_id, year, month, days_in_month, start_date, end_date)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const periodId of periods) {
          const [year, month] = periodId.split('-').map(Number);
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0);
          const daysInMonth = endDate.getDate();

          insertPeriod.run(
            periodId,
            year,
            month,
            daysInMonth,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
          );
        }

        // Insert finance facts
        const insertFinance = db.prepare(`
          INSERT INTO finance_facts
          (facility_id, period_id, account_category, account_subcategory, department, payer_category, amount, denominator_type, source_file)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const fact of financeFacts) {
          insertFinance.run(
            fact.facility_id,
            fact.period_id,
            fact.account_category,
            fact.account_subcategory,
            fact.department,
            fact.payer_category,
            fact.amount,
            fact.denominator_type,
            fact.source_file
          );
        }

        // Insert census facts
        const insertCensus = db.prepare(`
          INSERT INTO census_facts
          (facility_id, period_id, payer_category, days, is_skilled, is_vent, source_file)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const fact of censusFacts) {
          insertCensus.run(
            fact.facility_id,
            fact.period_id,
            fact.payer_category,
            fact.days,
            fact.is_skilled ? 1 : 0,
            fact.is_vent ? 1 : 0,
            fact.source_file
          );
        }

        // Insert occupancy facts
        const insertOccupancy = db.prepare(`
          INSERT OR REPLACE INTO occupancy_facts
          (facility_id, period_id, operational_beds, licensed_beds, total_patient_days, total_unit_days, second_occupant_days, operational_occupancy, source_file)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const fact of occupancyFacts) {
          insertOccupancy.run(
            fact.facility_id,
            fact.period_id,
            fact.operational_beds,
            fact.licensed_beds,
            fact.total_patient_days,
            fact.total_unit_days,
            fact.second_occupant_days,
            fact.operational_occupancy,
            fact.source_file
          );
        }

        totalFinanceFacts += financeFacts.length;
        totalCensusFacts += censusFacts.length;
        totalOccupancyFacts += occupancyFacts.length;
      } catch (err) {
        console.error(chalk.red(`  Error parsing ${file}: ${err}`));
      }
    }

    console.log(chalk.blue('\n=== Import Summary ==='));
    console.log(chalk.green(`Facilities: ${facilities.length}`));
    console.log(chalk.green(`Finance Facts: ${totalFinanceFacts}`));
    console.log(chalk.green(`Census Facts: ${totalCensusFacts}`));
    console.log(chalk.green(`Occupancy Facts: ${totalOccupancyFacts}`));

    const stats = getDatabaseStats(db);
    console.log(chalk.cyan('\nDatabase Statistics:'));
    for (const [table, count] of Object.entries(stats)) {
      console.log(`  ${table}: ${count}`);
    }

    db.close();
    console.log(chalk.green('\nImport complete!\n'));
  });

// ============================================================================
// COMPUTE COMMAND
// ============================================================================
program
  .command('compute')
  .description('Compute KPIs and benchmarks for imported data')
  .option('-f, --facility <id>', 'Compute for specific facility only')
  .option('-p, --period <yyyy-mm>', 'Compute for specific period only')
  .action(async (options) => {
    console.log(chalk.blue('\n=== Computing KPIs and Benchmarks ===\n'));

    const db = getDatabase();

    // Get facilities
    let facilityQuery = 'SELECT * FROM facilities';
    if (options.facility) {
      facilityQuery += ` WHERE facility_id = '${options.facility}'`;
    }
    const facilities = db.prepare(facilityQuery).all() as Facility[];

    // Get periods
    let periodQuery = 'SELECT DISTINCT period_id FROM finance_facts';
    if (options.period) {
      periodQuery += ` WHERE period_id = '${options.period}'`;
    }
    periodQuery += ' ORDER BY period_id DESC';
    const periods = (db.prepare(periodQuery).all() as { period_id: string }[]).map(
      (r) => r.period_id
    );

    console.log(chalk.cyan(`Computing for ${facilities.length} facilities, ${periods.length} periods`));

    // Get all facts
    const financeFacts = db.prepare('SELECT * FROM finance_facts').all() as FinanceFact[];
    const censusFacts = db.prepare('SELECT * FROM census_facts').all() as CensusFact[];
    const occupancyFacts = db.prepare('SELECT * FROM occupancy_facts').all() as OccupancyFact[];

    // Get periods for days in month lookup
    const periodsData = db.prepare('SELECT period_id, days_in_month FROM periods').all() as { period_id: string; days_in_month: number }[];
    const daysInMonthMap = new Map(periodsData.map(p => [p.period_id, p.days_in_month]));

    // Clear existing KPI results
    db.exec('DELETE FROM kpi_results');
    db.exec('DELETE FROM anomalies');

    const insertKPI = db.prepare(`
      INSERT INTO kpi_results
      (facility_id, period_id, kpi_id, value, numerator_value, denominator_value, denominator_type, payer_scope, unit, warnings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAnomaly = db.prepare(`
      INSERT INTO anomalies
      (facility_id, period_id, type, severity, message, field, expected, actual)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let computed = 0;
    let anomalyCount = 0;

    for (const facility of facilities) {
      for (const periodId of periods) {
        const daysInMonth = daysInMonthMap.get(periodId) || 30;
        const { results, anomalies } = calculateAllKPIs(
          financeFacts,
          censusFacts,
          facility.facility_id,
          periodId,
          undefined, // all KPIs
          occupancyFacts,
          daysInMonth
        );

        for (const result of results) {
          insertKPI.run(
            facility.facility_id,
            periodId,
            result.kpi_id,
            result.value,
            result.numerator_value,
            result.denominator_value,
            result.denominator_type,
            result.payer_scope,
            result.unit,
            JSON.stringify(result.warnings)
          );
          computed++;
        }

        for (const anomaly of anomalies) {
          insertAnomaly.run(
            facility.facility_id,
            periodId,
            anomaly.type,
            anomaly.severity,
            anomaly.message,
            anomaly.field,
            anomaly.expected,
            anomaly.actual
          );
          anomalyCount++;
        }
      }
    }

    console.log(chalk.green(`Computed ${computed} KPI values`));
    console.log(chalk.yellow(`Detected ${anomalyCount} anomalies`));

    db.close();
    console.log(chalk.green('\nComputation complete!\n'));
  });

// ============================================================================
// EXPORT COMMAND
// ============================================================================
program
  .command('export')
  .description('Export LLM-ready JSON bundles')
  .option('-o, --output <path>', 'Output directory', './exports')
  .option('-f, --facility <id>', 'Export specific facility only')
  .option('-p, --period <yyyy-mm>', 'Export specific period only')
  .option('--prompts', 'Generate LLM prompt packs')
  .action(async (options) => {
    console.log(chalk.blue('\n=== Exporting LLM-Ready Bundles ===\n'));

    const db = getDatabase();

    // Get facilities
    let facilityQuery = 'SELECT * FROM facilities';
    if (options.facility) {
      facilityQuery += ` WHERE facility_id = '${options.facility}'`;
    }
    const facilities = db.prepare(facilityQuery).all() as Facility[];

    // Get periods
    let periodQuery = 'SELECT DISTINCT period_id FROM kpi_results';
    if (options.period) {
      periodQuery += ` WHERE period_id = '${options.period}'`;
    }
    periodQuery += ' ORDER BY period_id DESC LIMIT 1'; // Most recent
    const periods = (db.prepare(periodQuery).all() as { period_id: string }[]).map(
      (r) => r.period_id
    );

    if (periods.length === 0) {
      console.error(chalk.red('No KPI results found. Run "compute" first.'));
      process.exit(1);
    }

    const outputPath = options.output;
    fs.mkdirSync(outputPath, { recursive: true });

    // Get all data
    const censusFacts = db.prepare('SELECT * FROM census_facts').all() as CensusFact[];

    const bundles = [];

    for (const facility of facilities) {
      for (const periodId of periods) {
        // Get KPI results
        const kpiResults = db
          .prepare(
            `SELECT * FROM kpi_results WHERE facility_id = ? AND period_id = ?`
          )
          .all(facility.facility_id, periodId) as any[];

        if (kpiResults.length === 0) continue;

        // Get anomalies
        const anomalies = db
          .prepare(
            `SELECT * FROM anomalies WHERE facility_id = ? AND period_id = ?`
          )
          .all(facility.facility_id, periodId) as any[];

        // Get denominators
        const { denominators } = resolveDenominators(
          censusFacts,
          facility.facility_id,
          periodId
        );

        // Format KPI results
        const formattedKPIs = kpiResults.map((r) => ({
          kpi_id: r.kpi_id,
          value: r.value,
          numerator_value: r.numerator_value,
          denominator_value: r.denominator_value,
          denominator_type: r.denominator_type,
          payer_scope: r.payer_scope,
          unit: r.unit,
          warnings: JSON.parse(r.warnings || '[]'),
        }));

        // Format anomalies
        const formattedAnomalies = anomalies.map((a) => ({
          type: a.type,
          severity: a.severity,
          message: a.message,
          field: a.field,
          expected: a.expected,
          actual: a.actual,
        }));

        // Generate bundle
        const bundle = generateFacilityMonthBundle(
          facility,
          periodId,
          denominators,
          formattedKPIs,
          formattedAnomalies,
          {}, // Benchmarks would come from benchmark engine
          ['11.2025 CHC & Olympus T24M Income Statements.xlsx']
        );

        bundles.push(bundle);

        // Write bundle
        const bundlePath = writeBundleToFile(bundle, outputPath);
        console.log(chalk.green(`  ${facility.facility_id}/${periodId}: ${bundlePath}`));

        // Write prompt pack if requested
        if (options.prompts) {
          const promptPath = writePromptPack(bundle, outputPath);
          console.log(chalk.cyan(`    + prompt: ${promptPath}`));
        }
      }
    }

    // Write combined table
    if (bundles.length > 0) {
      const combinedPath = writeCombinedKPITable(bundles, outputPath);
      console.log(chalk.blue(`\nCombined KPI table: ${combinedPath}`));
    }

    db.close();
    console.log(chalk.green(`\nExported ${bundles.length} bundles to ${outputPath}\n`));
  });

// ============================================================================
// STATUS COMMAND
// ============================================================================
program
  .command('status')
  .description('Show database status and statistics')
  .action(() => {
    console.log(chalk.blue('\n=== Database Status ===\n'));

    const db = getDatabase();
    const stats = getDatabaseStats(db);

    for (const [table, count] of Object.entries(stats)) {
      console.log(`${table}: ${count}`);
    }

    // Show recent periods
    const periods = db
      .prepare('SELECT DISTINCT period_id FROM finance_facts ORDER BY period_id DESC LIMIT 5')
      .all() as { period_id: string }[];

    if (periods.length > 0) {
      console.log(chalk.cyan('\nRecent periods:'));
      for (const p of periods) {
        console.log(`  ${p.period_id}`);
      }
    }

    // Show facility count by state
    const byState = db
      .prepare('SELECT state, COUNT(*) as count FROM facilities GROUP BY state ORDER BY count DESC')
      .all() as { state: string; count: number }[];

    if (byState.length > 0) {
      console.log(chalk.cyan('\nFacilities by state:'));
      for (const s of byState) {
        console.log(`  ${s.state}: ${s.count}`);
      }
    }

    db.close();
    console.log('');
  });

program.parse();
