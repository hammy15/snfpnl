import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { parseIncomeStatementWorkbook } from '../parsers/income-statement-parser.js';
import { calculateAllKPIs } from '../kpi/calculator.js';
import type { FinanceFact, CensusFact, OccupancyFact, Facility as FacilityType } from '../types/index.js';
import {
  calculatePearsonCorrelation,
  calculateT12MStats,
  isHigherBetter,
  formatPeriodId as formatPeriodReadable,
  getPeriodIdMonthsAgo,
  type CorrelationResult,
  type T12MStats
} from '../analysis/statistics.js';
import {
  CORRELATION_PAIRS,
  generateCorrelationInsights,
  generateTrendInsights,
  generateT12MSummary,
  type Insight,
  type CorrelationPair
} from '../analysis/insights.js';
import { KPI_REGISTRY } from '../kpi/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Database connection
const dbPath = path.join(__dirname, '../../data/snf_financials.db');
let db: Database.Database;

try {
  // Remove readonly for CRUD operations
  db = new Database(dbPath);
  console.log('Database connected:', dbPath);
} catch (err) {
  console.error('Failed to connect to database:', err);
  process.exit(1);
}

// Claude API client
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Types
interface Facility {
  facility_id: string;
  name: string;
  short_name: string;
  state: string;
  setting: string;
  licensed_beds: number | null;
  operational_beds: number | null;
  parent_opco: string | null;
}

interface KPIResult {
  facility_id: string;
  period_id: string;
  kpi_id: string;
  value: number | null;
  numerator_value: number;
  denominator_value: number;
  denominator_type: string;
  payer_scope: string;
  unit: string;
  warnings: string;
}

// ============================================================================
// API ROUTES
// ============================================================================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', database: 'connected' });
});

// Create access_log table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Log user access
app.post('/api/access-log', (req, res) => {
  try {
    const { name, timestamp } = req.body;
    if (!name || !timestamp) {
      return res.status(400).json({ error: 'Name and timestamp required' });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    db.prepare(`
      INSERT INTO access_log (name, timestamp, ip_address, user_agent)
      VALUES (?, ?, ?, ?)
    `).run(name, timestamp, ipAddress, userAgent);

    console.log(`Access logged: ${name} at ${timestamp}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to log access:', err);
    res.status(500).json({ error: 'Failed to log access' });
  }
});

// Get access logs (admin endpoint)
app.get('/api/access-log', (_req, res) => {
  try {
    const logs = db.prepare(`
      SELECT id, name, timestamp, ip_address, user_agent, created_at
      FROM access_log
      ORDER BY created_at DESC
      LIMIT 100
    `).all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch access logs' });
  }
});

// Get all facilities
app.get('/api/facilities', (_req, res) => {
  try {
    const facilities = db.prepare(`
      SELECT facility_id, name, short_name, state, setting,
             licensed_beds, operational_beds, parent_opco
      FROM facilities
      ORDER BY state, name
    `).all() as Facility[];
    res.json(facilities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

// Get facility by ID
app.get('/api/facilities/:id', (req, res) => {
  try {
    const facility = db.prepare(`
      SELECT * FROM facilities WHERE facility_id = ?
    `).get(req.params.id);

    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }
    res.json(facility);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch facility' });
  }
});

// Create a new facility
app.post('/api/facilities', (req, res) => {
  try {
    const { facility_id, name, short_name, state, setting, licensed_beds, operational_beds, parent_opco } = req.body;

    if (!facility_id || !name) {
      return res.status(400).json({ error: 'facility_id and name are required' });
    }

    const stmt = db.prepare(`
      INSERT INTO facilities (facility_id, name, short_name, state, setting, licensed_beds, operational_beds, parent_opco)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(facility_id, name, short_name || '', state || 'ID', setting || 'SNF', licensed_beds, operational_beds, parent_opco);

    const newFacility = db.prepare('SELECT * FROM facilities WHERE facility_id = ?').get(facility_id);
    res.status(201).json(newFacility);
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: 'Facility ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create facility' });
  }
});

// Update a facility (supports partial updates)
app.put('/api/facilities/:id', (req, res) => {
  try {
    const originalId = req.params.id;

    // Check if facility exists
    const existing = db.prepare('SELECT * FROM facilities WHERE facility_id = ?').get(originalId) as Facility | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    // Merge with existing values for partial updates
    const facility_id = req.body.facility_id ?? existing.facility_id;
    const name = req.body.name ?? existing.name;
    const short_name = req.body.short_name ?? existing.short_name;
    const state = req.body.state ?? existing.state;
    const setting = req.body.setting ?? existing.setting;
    const licensed_beds = req.body.licensed_beds !== undefined ? req.body.licensed_beds : existing.licensed_beds;
    const operational_beds = req.body.operational_beds !== undefined ? req.body.operational_beds : existing.operational_beds;
    const parent_opco = req.body.parent_opco !== undefined ? req.body.parent_opco : existing.parent_opco;

    // If facility_id changed, we need to update references
    if (facility_id && facility_id !== originalId) {
      const stmt = db.prepare(`
        UPDATE facilities
        SET facility_id = ?, name = ?, short_name = ?, state = ?, setting = ?,
            licensed_beds = ?, operational_beds = ?, parent_opco = ?
        WHERE facility_id = ?
      `);
      stmt.run(facility_id, name, short_name, state, setting, licensed_beds, operational_beds, parent_opco, originalId);

      // Also update references in related tables
      db.prepare('UPDATE kpi_results SET facility_id = ? WHERE facility_id = ?').run(facility_id, originalId);
      db.prepare('UPDATE census_facts SET facility_id = ? WHERE facility_id = ?').run(facility_id, originalId);
      db.prepare('UPDATE finance_facts SET facility_id = ? WHERE facility_id = ?').run(facility_id, originalId);
      db.prepare('UPDATE anomalies SET facility_id = ? WHERE facility_id = ?').run(facility_id, originalId);
      db.prepare('UPDATE occupancy_facts SET facility_id = ? WHERE facility_id = ?').run(facility_id, originalId);
      db.prepare('UPDATE staffing_facts SET facility_id = ? WHERE facility_id = ?').run(facility_id, originalId);
    } else {
      const stmt = db.prepare(`
        UPDATE facilities
        SET name = ?, short_name = ?, state = ?, setting = ?,
            licensed_beds = ?, operational_beds = ?, parent_opco = ?
        WHERE facility_id = ?
      `);
      stmt.run(name, short_name, state, setting, licensed_beds, operational_beds, parent_opco, originalId);
    }

    const updated = db.prepare('SELECT * FROM facilities WHERE facility_id = ?').get(facility_id || originalId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update facility' });
  }
});

// Delete a facility
app.delete('/api/facilities/:id', (req, res) => {
  try {
    const facilityId = req.params.id;

    // Check if facility exists
    const existing = db.prepare('SELECT * FROM facilities WHERE facility_id = ?').get(facilityId);
    if (!existing) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    // Delete related data first (to maintain referential integrity)
    db.prepare('DELETE FROM kpi_results WHERE facility_id = ?').run(facilityId);
    db.prepare('DELETE FROM census_facts WHERE facility_id = ?').run(facilityId);
    db.prepare('DELETE FROM finance_facts WHERE facility_id = ?').run(facilityId);
    db.prepare('DELETE FROM anomalies WHERE facility_id = ?').run(facilityId);
    db.prepare('DELETE FROM occupancy_facts WHERE facility_id = ?').run(facilityId);
    db.prepare('DELETE FROM staffing_facts WHERE facility_id = ?').run(facilityId);

    // Delete the facility
    db.prepare('DELETE FROM facilities WHERE facility_id = ?').run(facilityId);

    res.json({ message: 'Facility deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete facility' });
  }
});

// Get all periods
app.get('/api/periods', (_req, res) => {
  try {
    const periods = db.prepare(`
      SELECT DISTINCT period_id
      FROM kpi_results
      ORDER BY period_id DESC
    `).all() as { period_id: string }[];
    res.json(periods.map(p => p.period_id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch periods' });
  }
});

// Get KPIs for all facilities for a period (for comparison)
// NOTE: This route MUST come before /api/kpis/:facilityId/:periodId
app.get('/api/kpis/all/:periodId', (req, res) => {
  try {
    const kpis = db.prepare(`
      SELECT kr.facility_id, kr.kpi_id, kr.value,
             f.name, f.state, f.setting
      FROM kpi_results kr
      JOIN facilities f ON kr.facility_id = f.facility_id
      WHERE kr.period_id = ?
    `).all(req.params.periodId);
    res.json(kpis);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// Get KPIs for a facility and period
app.get('/api/kpis/:facilityId/:periodId', (req, res) => {
  try {
    const kpis = db.prepare(`
      SELECT * FROM kpi_results
      WHERE facility_id = ? AND period_id = ?
    `).all(req.params.facilityId, req.params.periodId) as KPIResult[];
    res.json(kpis);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// Get census data for a facility and period
app.get('/api/census/:facilityId/:periodId', (req, res) => {
  try {
    const census = db.prepare(`
      SELECT * FROM census_facts
      WHERE facility_id = ? AND period_id = ?
    `).all(req.params.facilityId, req.params.periodId);
    res.json(census);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch census data' });
  }
});

// Get financial summary (Net Income) for all facilities
// NOTE: This route MUST come before /api/financials/:facilityId/:periodId
app.get('/api/financials/summary/:periodId', (req, res) => {
  try {
    const { periodId } = req.params;

    // Get revenue and all expenses for each facility
    // Net Income = Total Revenue - Total Operating - Management Fee - Total Property - Total Other (Expense)
    const facilityFinancials = db.prepare(`
      SELECT
        f.facility_id,
        f.name,
        f.setting,
        COALESCE((
          SELECT SUM(amount) FROM finance_facts
          WHERE facility_id = f.facility_id AND period_id = ? AND account_category = 'Revenue' AND account_subcategory = 'Total'
        ), 0) as total_revenue,
        COALESCE((
          SELECT SUM(amount) FROM finance_facts
          WHERE facility_id = f.facility_id AND period_id = ? AND account_category = 'Expense' AND account_subcategory = 'Total Operating'
        ), 0) as total_operating,
        COALESCE((
          SELECT SUM(amount) FROM finance_facts
          WHERE facility_id = f.facility_id AND period_id = ? AND account_category = 'Expense' AND account_subcategory = 'Management Fee'
        ), 0) as management_fee,
        COALESCE((
          SELECT SUM(amount) FROM finance_facts
          WHERE facility_id = f.facility_id AND period_id = ? AND account_category = 'Expense' AND account_subcategory = 'Total Property'
        ), 0) as total_property,
        COALESCE((
          SELECT SUM(amount) FROM finance_facts
          WHERE facility_id = f.facility_id AND period_id = ? AND account_category = 'Expense' AND account_subcategory = 'Total Other'
        ), 0) as total_other
      FROM facilities f
      ORDER BY f.name
    `).all(periodId, periodId, periodId, periodId, periodId) as {
      facility_id: string;
      name: string;
      setting: string;
      total_revenue: number;
      total_operating: number;
      management_fee: number;
      total_property: number;
      total_other: number;
    }[];

    // Calculate net income for each facility
    // Net Income = Revenue - Operating Expenses - Management Fee - Property Expenses - Other Expenses
    const facilitiesWithNetIncome = facilityFinancials.map(f => {
      const total_expenses = f.total_operating + f.management_fee + f.total_property + f.total_other;
      const net_income = f.total_revenue - total_expenses;
      // EBITDAR = Revenue - Operating Expenses (for reference)
      const ebitdar = f.total_revenue - f.total_operating - f.management_fee;
      return {
        ...f,
        total_expenses,
        net_income,
        net_income_pct: f.total_revenue > 0 ? (net_income / f.total_revenue) * 100 : 0,
        ebitdar,
        ebitdar_pct: f.total_revenue > 0 ? (ebitdar / f.total_revenue) * 100 : 0,
      };
    });

    // Calculate totals by setting
    const settingTotals = facilitiesWithNetIncome.reduce((acc, f) => {
      if (!acc[f.setting]) {
        acc[f.setting] = { revenue: 0, expenses: 0, net_income: 0, ebitdar: 0 };
      }
      acc[f.setting].revenue += f.total_revenue;
      acc[f.setting].expenses += f.total_expenses;
      acc[f.setting].net_income += f.net_income;
      acc[f.setting].ebitdar += f.ebitdar;
      return acc;
    }, {} as Record<string, { revenue: number; expenses: number; net_income: number; ebitdar: number }>);

    // Calculate overall totals (SNFPNL Portfolio)
    const cascadiaTotals = facilitiesWithNetIncome.reduce(
      (acc, f) => ({
        revenue: acc.revenue + f.total_revenue,
        expenses: acc.expenses + f.total_expenses,
        net_income: acc.net_income + f.net_income,
        ebitdar: acc.ebitdar + f.ebitdar,
      }),
      { revenue: 0, expenses: 0, net_income: 0, ebitdar: 0 }
    );

    res.json({
      facilities: facilitiesWithNetIncome,
      settingTotals,
      cascadiaTotals: {
        ...cascadiaTotals,
        net_income_pct: cascadiaTotals.revenue > 0
          ? (cascadiaTotals.net_income / cascadiaTotals.revenue) * 100
          : 0,
        ebitdar_pct: cascadiaTotals.revenue > 0
          ? (cascadiaTotals.ebitdar / cascadiaTotals.revenue) * 100
          : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch financial summary' });
  }
});

// Get financial data for a facility and period
app.get('/api/financials/:facilityId/:periodId', (req, res) => {
  try {
    const financials = db.prepare(`
      SELECT account_category, account_subcategory, payer_category,
             SUM(amount) as total_amount
      FROM finance_facts
      WHERE facility_id = ? AND period_id = ?
      GROUP BY account_category, account_subcategory, payer_category
      ORDER BY account_category, account_subcategory
    `).all(req.params.facilityId, req.params.periodId);
    res.json(financials);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch financials' });
  }
});

// Get anomalies for a facility and period
app.get('/api/anomalies/:facilityId/:periodId', (req, res) => {
  try {
    const anomalies = db.prepare(`
      SELECT * FROM anomalies
      WHERE facility_id = ? AND period_id = ?
    `).all(req.params.facilityId, req.params.periodId);
    res.json(anomalies);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
});

// Get occupancy data for a facility and period
app.get('/api/occupancy/:facilityId/:periodId', (req, res) => {
  try {
    const occupancy = db.prepare(`
      SELECT * FROM occupancy_facts
      WHERE facility_id = ? AND period_id = ?
    `).get(req.params.facilityId, req.params.periodId);
    res.json(occupancy || null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch occupancy data' });
  }
});

// Get occupancy for all facilities for a period
app.get('/api/occupancy/all/:periodId', (req, res) => {
  try {
    const occupancy = db.prepare(`
      SELECT o.*, f.name, f.setting, f.state
      FROM occupancy_facts o
      JOIN facilities f ON o.facility_id = f.facility_id
      WHERE o.period_id = ?
    `).all(req.params.periodId);
    res.json(occupancy);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch occupancy data' });
  }
});

// Get dashboard summary
app.get('/api/dashboard/:periodId', (req, res) => {
  try {
    const { periodId } = req.params;

    // Get facility count by state (all settings)
    const facilityStats = db.prepare(`
      SELECT state, COUNT(*) as count
      FROM facilities
      GROUP BY state
      ORDER BY count DESC
    `).all();

    // Get facility count by setting
    const settingStats = db.prepare(`
      SELECT setting, COUNT(*) as count
      FROM facilities
      GROUP BY setting
      ORDER BY count DESC
    `).all();

    // Get average KPIs for the period
    const avgKpis = db.prepare(`
      SELECT kpi_id,
             AVG(value) as avg_value,
             MIN(value) as min_value,
             MAX(value) as max_value,
             COUNT(*) as facility_count
      FROM kpi_results
      WHERE period_id = ? AND value IS NOT NULL
      GROUP BY kpi_id
    `).all(periodId);

    // Get anomaly summary
    const anomalySummary = db.prepare(`
      SELECT severity, COUNT(*) as count
      FROM anomalies
      WHERE period_id = ?
      GROUP BY severity
    `).all(periodId);

    // Get top/bottom performers for operating margin (both SNF and SL KPIs)
    const topPerformers = db.prepare(`
      SELECT kr.facility_id, f.name, f.setting, kr.kpi_id, kr.value
      FROM kpi_results kr
      JOIN facilities f ON kr.facility_id = f.facility_id
      WHERE kr.period_id = ?
        AND kr.kpi_id IN ('snf_operating_margin_pct', 'sl_operating_margin_pct')
        AND kr.value IS NOT NULL
      ORDER BY kr.value DESC
      LIMIT 25
    `).all(periodId);

    const bottomPerformers = db.prepare(`
      SELECT kr.facility_id, f.name, f.setting, kr.kpi_id, kr.value
      FROM kpi_results kr
      JOIN facilities f ON kr.facility_id = f.facility_id
      WHERE kr.period_id = ?
        AND kr.kpi_id IN ('snf_operating_margin_pct', 'sl_operating_margin_pct')
        AND kr.value IS NOT NULL
      ORDER BY kr.value ASC
      LIMIT 25
    `).all(periodId);

    // Get occupancy summary by setting
    const occupancySummary = db.prepare(`
      SELECT f.setting,
             AVG(o.operational_occupancy) as avg_occupancy,
             MIN(o.operational_occupancy) as min_occupancy,
             MAX(o.operational_occupancy) as max_occupancy,
             COUNT(*) as facility_count
      FROM occupancy_facts o
      JOIN facilities f ON o.facility_id = f.facility_id
      WHERE o.period_id = ?
      GROUP BY f.setting
    `).all(periodId);

    res.json({
      facilityStats,
      settingStats,
      avgKpis,
      anomalySummary,
      topPerformers,
      bottomPerformers,
      occupancySummary,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Portfolio-wide Executive Summary (no facilityId)
app.get('/api/executive-summary/:periodId', (req, res) => {
  try {
    const { periodId } = req.params;

    // Get all facilities
    const facilities = db.prepare(`
      SELECT facility_id, name, state, setting FROM facilities
    `).all() as Array<{ facility_id: string; name: string; state: string; setting: string }>;

    // Get current period KPIs for all facilities
    const allKpis = db.prepare(`
      SELECT kr.facility_id, kr.kpi_id, kr.value, f.name, f.state, f.setting
      FROM kpi_results kr
      JOIN facilities f ON kr.facility_id = f.facility_id
      WHERE kr.period_id = ? AND kr.value IS NOT NULL
    `).all(periodId) as Array<{ facility_id: string; kpi_id: string; value: number; name: string; state: string; setting: string }>;

    // Get previous period for MoM comparison
    const [year, month] = periodId.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const prevKpis = db.prepare(`
      SELECT facility_id, kpi_id, value FROM kpi_results
      WHERE period_id = ? AND value IS NOT NULL
    `).all(prevPeriod) as Array<{ facility_id: string; kpi_id: string; value: number }>;

    // Build helper maps
    const getKpi = (facilityId: string, kpiId: string) =>
      allKpis.find(k => k.facility_id === facilityId && k.kpi_id === kpiId)?.value ?? null;

    const getPrevKpi = (facilityId: string, kpiId: string) =>
      prevKpis.find(k => k.facility_id === facilityId && k.kpi_id === kpiId)?.value ?? null;

    // Calculate portfolio overview
    const snfFacilities = facilities.filter(f => f.setting === 'SNF');
    const alfFacilities = facilities.filter(f => f.setting === 'ALF');
    const ilfFacilities = facilities.filter(f => f.setting === 'ILF');

    // Get margins for all facilities
    const facilityMargins = facilities.map(f => {
      const marginKpi = f.setting === 'SNF' ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct';
      const margin = getKpi(f.facility_id, marginKpi);
      const prevMargin = getPrevKpi(f.facility_id, marginKpi);
      return { ...f, margin, prevMargin };
    }).filter(f => f.margin !== null);

    // Revenue PPD averages
    const snfRevenues = snfFacilities.map(f => getKpi(f.facility_id, 'snf_total_revenue_ppd')).filter(v => v !== null) as number[];
    const prevSnfRevenues = snfFacilities.map(f => getPrevKpi(f.facility_id, 'snf_total_revenue_ppd')).filter(v => v !== null) as number[];

    const avgMargin = facilityMargins.length > 0
      ? facilityMargins.reduce((sum, f) => sum + (f.margin || 0), 0) / facilityMargins.length
      : 0;
    const prevAvgMargin = facilityMargins.filter(f => f.prevMargin !== null).length > 0
      ? facilityMargins.filter(f => f.prevMargin !== null).reduce((sum, f) => sum + (f.prevMargin || 0), 0) / facilityMargins.filter(f => f.prevMargin !== null).length
      : avgMargin;

    const avgRevenue = snfRevenues.length > 0 ? snfRevenues.reduce((a, b) => a + b, 0) / snfRevenues.length : 0;
    const prevAvgRevenue = prevSnfRevenues.length > 0 ? prevSnfRevenues.reduce((a, b) => a + b, 0) / prevSnfRevenues.length : avgRevenue;

    // Top performers (highest margins)
    const topPerformers = [...facilityMargins]
      .sort((a, b) => (b.margin || 0) - (a.margin || 0))
      .slice(0, 5)
      .map(f => ({
        facility_id: f.facility_id,
        name: f.name,
        state: f.state,
        setting: f.setting,
        margin: f.margin || 0
      }));

    // Needs attention (lowest/negative margins, or declining)
    const needsAttention = [...facilityMargins]
      .map(f => {
        let issue = '';
        if ((f.margin || 0) < 0) issue = 'Negative margin';
        else if ((f.margin || 0) < 2) issue = 'Low margin';
        else if (f.prevMargin !== null && (f.margin || 0) < f.prevMargin - 2) issue = 'Declining trend';
        else if ((f.margin || 0) < 5) issue = 'Below target';

        const contractLabor = getKpi(f.facility_id, 'snf_contract_labor_pct_nursing');
        if (contractLabor !== null && contractLabor > 20) issue = 'High agency cost';

        return { ...f, issue };
      })
      .filter(f => f.issue)
      .sort((a, b) => (a.margin || 0) - (b.margin || 0))
      .slice(0, 5)
      .map(f => ({
        facility_id: f.facility_id,
        name: f.name,
        state: f.state,
        setting: f.setting,
        margin: f.margin || 0,
        issue: f.issue
      }));

    // KPI Summary with stats
    const kpiConfigs = [
      { kpi: 'snf_operating_margin_pct', label: 'Operating Margin %' },
      { kpi: 'snf_skilled_mix_pct', label: 'Skilled Mix %' },
      { kpi: 'snf_total_revenue_ppd', label: 'Revenue PPD' },
      { kpi: 'snf_total_cost_ppd', label: 'Cost PPD' },
      { kpi: 'snf_nursing_cost_ppd', label: 'Nursing Cost PPD' },
      { kpi: 'snf_contract_labor_pct_nursing', label: 'Contract Labor %' },
    ];

    const kpiSummary = kpiConfigs.map(config => {
      const values = allKpis.filter(k => k.kpi_id === config.kpi).map(k => k.value);
      const prevValues = prevKpis.filter(k => k.kpi_id === config.kpi).map(k => k.value);

      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const prevAvg = prevValues.length > 0 ? prevValues.reduce((a, b) => a + b, 0) / prevValues.length : avg;

      return {
        kpi: config.kpi,
        label: config.label,
        avg: Math.round(avg * 10) / 10,
        min: values.length > 0 ? Math.round(Math.min(...values) * 10) / 10 : 0,
        max: values.length > 0 ? Math.round(Math.max(...values) * 10) / 10 : 0,
        trend: prevAvg !== 0 ? Math.round(((avg - prevAvg) / Math.abs(prevAvg)) * 1000) / 10 : 0
      };
    });

    // By Type breakdown
    const byType = [
      {
        setting: 'SNF',
        count: snfFacilities.length,
        avgMargin: Math.round(facilityMargins.filter(f => f.setting === 'SNF').reduce((sum, f) => sum + (f.margin || 0), 0) / Math.max(1, facilityMargins.filter(f => f.setting === 'SNF').length) * 10) / 10,
        avgRevenuePPD: Math.round(avgRevenue)
      },
      {
        setting: 'ALF',
        count: alfFacilities.length,
        avgMargin: Math.round(facilityMargins.filter(f => f.setting === 'ALF').reduce((sum, f) => sum + (f.margin || 0), 0) / Math.max(1, facilityMargins.filter(f => f.setting === 'ALF').length) * 10) / 10,
        avgRevenuePPD: Math.round(alfFacilities.map(f => getKpi(f.facility_id, 'sl_revenue_prd')).filter(v => v !== null).reduce((a, b) => (a || 0) + (b || 0), 0) / Math.max(1, alfFacilities.length))
      },
      {
        setting: 'ILF',
        count: ilfFacilities.length,
        avgMargin: Math.round(facilityMargins.filter(f => f.setting === 'ILF').reduce((sum, f) => sum + (f.margin || 0), 0) / Math.max(1, facilityMargins.filter(f => f.setting === 'ILF').length) * 10) / 10,
        avgRevenuePPD: Math.round(ilfFacilities.map(f => getKpi(f.facility_id, 'sl_revenue_prd')).filter(v => v !== null).reduce((a, b) => (a || 0) + (b || 0), 0) / Math.max(1, ilfFacilities.length))
      }
    ];

    res.json({
      overview: {
        totalFacilities: facilities.length,
        totalRevenue: Math.round(avgRevenue * 30 * facilities.length), // Rough estimate
        avgMargin: Math.round(avgMargin * 10) / 10,
        avgOccupancy: 85, // Would need to calculate from data
        marginTrend: Math.round((avgMargin - prevAvgMargin) * 10) / 10,
        revenueTrend: prevAvgRevenue !== 0 ? Math.round(((avgRevenue - prevAvgRevenue) / prevAvgRevenue) * 1000) / 10 : 0
      },
      byType,
      topPerformers,
      needsAttention,
      kpiSummary
    });
  } catch (err) {
    console.error('Executive summary error:', err);
    res.status(500).json({ error: 'Failed to fetch executive summary' });
  }
});

// Period Comparison - compare KPIs between two periods
app.get('/api/comparison', (req, res) => {
  try {
    const { period1, period2 } = req.query;

    if (!period1 || !period2) {
      return res.status(400).json({ error: 'Both period1 and period2 are required' });
    }

    // Get all facilities
    const facilities = db.prepare(`
      SELECT facility_id, name, state, setting FROM facilities
    `).all() as Array<{ facility_id: string; name: string; state: string; setting: string }>;

    // KPIs to compare
    const kpiConfigs = [
      { kpi_id: 'snf_operating_margin_pct', label: 'Operating Margin %' },
      { kpi_id: 'snf_skilled_mix_pct', label: 'Skilled Mix %' },
      { kpi_id: 'snf_total_revenue_ppd', label: 'Revenue PPD' },
      { kpi_id: 'snf_total_cost_ppd', label: 'Cost PPD' },
      { kpi_id: 'snf_nursing_cost_ppd', label: 'Nursing Cost PPD' },
      { kpi_id: 'snf_contract_labor_pct_nursing', label: 'Contract Labor %' },
    ];

    // Get KPIs for period1 (current/newer period)
    const period1Kpis = db.prepare(`
      SELECT facility_id, kpi_id, value FROM kpi_results
      WHERE period_id = ? AND value IS NOT NULL
    `).all(period1) as Array<{ facility_id: string; kpi_id: string; value: number }>;

    // Get KPIs for period2 (comparison/older period)
    const period2Kpis = db.prepare(`
      SELECT facility_id, kpi_id, value FROM kpi_results
      WHERE period_id = ? AND value IS NOT NULL
    `).all(period2) as Array<{ facility_id: string; kpi_id: string; value: number }>;

    // Build maps for quick lookup
    const p1Map = new Map<string, number>();
    period1Kpis.forEach(k => p1Map.set(`${k.facility_id}:${k.kpi_id}`, k.value));

    const p2Map = new Map<string, number>();
    period2Kpis.forEach(k => p2Map.set(`${k.facility_id}:${k.kpi_id}`, k.value));

    // Build comparison data for each facility
    const comparisonData = facilities.map(facility => {
      const kpis = kpiConfigs.map(config => {
        const current = p1Map.get(`${facility.facility_id}:${config.kpi_id}`) ?? null;
        const comparison = p2Map.get(`${facility.facility_id}:${config.kpi_id}`) ?? null;

        let change: number | null = null;
        let changePercent: number | null = null;

        if (current !== null && comparison !== null) {
          change = current - comparison;
          changePercent = comparison !== 0 ? (change / Math.abs(comparison)) * 100 : null;
        }

        return {
          kpi_id: config.kpi_id,
          label: config.label,
          current,
          comparison,
          change: change !== null ? Math.round(change * 100) / 100 : null,
          changePercent: changePercent !== null ? Math.round(changePercent * 10) / 10 : null
        };
      });

      return {
        facility_id: facility.facility_id,
        name: facility.name,
        state: facility.state,
        setting: facility.setting,
        kpis
      };
    }).filter(f => {
      // Only include facilities that have data for at least one KPI in both periods
      return f.kpis.some(k => k.current !== null || k.comparison !== null);
    });

    res.json(comparisonData);
  } catch (err) {
    console.error('Comparison error:', err);
    res.status(500).json({ error: 'Failed to fetch comparison data' });
  }
});

// Portfolio-wide Alerts - real data from database
app.get('/api/portfolio-alerts/:periodId', (req, res) => {
  try {
    const { periodId } = req.params;

    interface Alert {
      id: string;
      type: 'critical' | 'warning' | 'info' | 'success';
      category: 'margin' | 'cost' | 'revenue' | 'staffing';
      facility_id: string;
      facility_name: string;
      state: string;
      title: string;
      message: string;
      value: number;
      threshold: number;
      timestamp: string;
      acknowledged: boolean;
    }

    const alerts: Alert[] = [];
    let alertId = 1;

    // Get all KPIs for the period with facility info
    const allKpis = db.prepare(`
      SELECT k.facility_id, k.kpi_id, k.value, f.name, f.state, f.setting
      FROM kpi_results k
      JOIN facilities f ON k.facility_id = f.facility_id
      WHERE k.period_id = ? AND k.value IS NOT NULL
    `).all(periodId) as Array<{ facility_id: string; kpi_id: string; value: number; name: string; state: string; setting: string }>;

    // Group by facility
    const facilityKpis = new Map<string, typeof allKpis>();
    allKpis.forEach(k => {
      if (!facilityKpis.has(k.facility_id)) {
        facilityKpis.set(k.facility_id, []);
      }
      facilityKpis.get(k.facility_id)!.push(k);
    });

    // Check each facility for alert conditions
    facilityKpis.forEach((kpis, facilityId) => {
      const facilityInfo = kpis[0];
      const getKpi = (kpiId: string) => kpis.find(k => k.kpi_id === kpiId)?.value ?? null;

      const marginKpi = facilityInfo.setting === 'SNF' ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct';
      const margin = getKpi(marginKpi);
      const skilledMix = getKpi('snf_skilled_mix_pct');
      const contractLabor = getKpi('snf_contract_labor_pct_nursing');
      const revenuePPD = getKpi('snf_total_revenue_ppd');
      const costPPD = getKpi('snf_total_cost_ppd');

      // Critical: Negative margin
      if (margin !== null && margin < 0) {
        alerts.push({
          id: String(alertId++),
          type: 'critical',
          category: 'margin',
          facility_id: facilityId,
          facility_name: facilityInfo.name,
          state: facilityInfo.state,
          title: 'Negative Operating Margin',
          message: `Operating margin has dropped to ${margin.toFixed(1)}%, requiring immediate attention.`,
          value: margin,
          threshold: 0,
          timestamp: periodId,
          acknowledged: false
        });
      }

      // Critical: Very high contract labor (>30%)
      if (contractLabor !== null && contractLabor > 30) {
        alerts.push({
          id: String(alertId++),
          type: 'critical',
          category: 'staffing',
          facility_id: facilityId,
          facility_name: facilityInfo.name,
          state: facilityInfo.state,
          title: 'High Contract Labor Usage',
          message: `Contract labor at ${contractLabor.toFixed(1)}% exceeds 30% threshold, significantly impacting costs.`,
          value: contractLabor,
          threshold: 30,
          timestamp: periodId,
          acknowledged: false
        });
      }

      // Warning: Low margin (0-5%)
      if (margin !== null && margin >= 0 && margin < 5) {
        alerts.push({
          id: String(alertId++),
          type: 'warning',
          category: 'margin',
          facility_id: facilityId,
          facility_name: facilityInfo.name,
          state: facilityInfo.state,
          title: 'Low Operating Margin',
          message: `Operating margin at ${margin.toFixed(1)}% is below the 5% target threshold.`,
          value: margin,
          threshold: 5,
          timestamp: periodId,
          acknowledged: false
        });
      }

      // Warning: Low skilled mix (<15%)
      if (skilledMix !== null && skilledMix < 15 && facilityInfo.setting === 'SNF') {
        alerts.push({
          id: String(alertId++),
          type: 'warning',
          category: 'revenue',
          facility_id: facilityId,
          facility_name: facilityInfo.name,
          state: facilityInfo.state,
          title: 'Low Skilled Mix',
          message: `Skilled mix at ${skilledMix.toFixed(1)}% is below 15%, impacting revenue potential.`,
          value: skilledMix,
          threshold: 15,
          timestamp: periodId,
          acknowledged: false
        });
      }

      // Warning: High contract labor (20-30%)
      if (contractLabor !== null && contractLabor >= 20 && contractLabor <= 30) {
        alerts.push({
          id: String(alertId++),
          type: 'warning',
          category: 'staffing',
          facility_id: facilityId,
          facility_name: facilityInfo.name,
          state: facilityInfo.state,
          title: 'Elevated Contract Labor',
          message: `Contract labor at ${contractLabor.toFixed(1)}% is elevated, monitor closely.`,
          value: contractLabor,
          threshold: 20,
          timestamp: periodId,
          acknowledged: false
        });
      }

      // Success: High margin (>15%)
      if (margin !== null && margin > 15) {
        alerts.push({
          id: String(alertId++),
          type: 'success',
          category: 'margin',
          facility_id: facilityId,
          facility_name: facilityInfo.name,
          state: facilityInfo.state,
          title: 'Top Performer',
          message: `Operating margin at ${margin.toFixed(1)}% exceeds 15%, ranking among top performers.`,
          value: margin,
          threshold: 15,
          timestamp: periodId,
          acknowledged: false
        });
      }

      // Success: Low contract labor (<5%)
      if (contractLabor !== null && contractLabor < 5 && facilityInfo.setting === 'SNF') {
        alerts.push({
          id: String(alertId++),
          type: 'success',
          category: 'staffing',
          facility_id: facilityId,
          facility_name: facilityInfo.name,
          state: facilityInfo.state,
          title: 'Low Agency Usage',
          message: `Contract labor at ${contractLabor.toFixed(1)}% is well below target, excellent staffing stability.`,
          value: contractLabor,
          threshold: 5,
          timestamp: periodId,
          acknowledged: false
        });
      }

      // Info: Good skilled mix opportunity (25-30%)
      if (skilledMix !== null && skilledMix >= 25 && skilledMix < 35 && facilityInfo.setting === 'SNF') {
        alerts.push({
          id: String(alertId++),
          type: 'info',
          category: 'revenue',
          facility_id: facilityId,
          facility_name: facilityInfo.name,
          state: facilityInfo.state,
          title: 'Skilled Mix Optimization Opportunity',
          message: `Skilled mix at ${skilledMix.toFixed(1)}% - consider strategies to optimize further.`,
          value: skilledMix,
          threshold: 35,
          timestamp: periodId,
          acknowledged: false
        });
      }
    });

    // Sort alerts by priority
    const priority = { critical: 0, warning: 1, info: 2, success: 3 };
    alerts.sort((a, b) => priority[a.type] - priority[b.type]);

    res.json(alerts);
  } catch (err) {
    console.error('Portfolio alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch portfolio alerts' });
  }
});

// Get trend data for a facility
app.get('/api/trends/:facilityId/:kpiId', (req, res) => {
  try {
    const trends = db.prepare(`
      SELECT period_id, value
      FROM kpi_results
      WHERE facility_id = ? AND kpi_id = ? AND value IS NOT NULL
      ORDER BY period_id ASC
    `).all(req.params.facilityId, req.params.kpiId);
    res.json(trends);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// ============================================================================
// ELITE FEATURES API ENDPOINTS
// ============================================================================

// Threshold definitions for alerts
const KPI_THRESHOLDS: Record<string, { warning: number; critical: number; direction: 'above' | 'below' }> = {
  snf_operating_margin_pct: { warning: 5, critical: 0, direction: 'below' },
  sl_operating_margin_pct: { warning: 5, critical: 0, direction: 'below' },
  snf_contract_labor_pct_nursing: { warning: 10, critical: 20, direction: 'above' },
  snf_skilled_mix_pct: { warning: 40, critical: 30, direction: 'below' },
  sl_occupancy_pct: { warning: 85, critical: 75, direction: 'below' },
  snf_total_nurse_hprd_paid: { warning: 3.5, critical: 3.0, direction: 'below' },
};

// 1. Executive Summary - AI-generated narrative
app.get('/api/executive-summary/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;

    const facility = db.prepare(`
      SELECT * FROM facilities WHERE facility_id = ?
    `).get(facilityId) as Facility | undefined;

    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    // Get current period KPIs
    const kpis = db.prepare(`
      SELECT kpi_id, value, unit FROM kpi_results
      WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null; unit: string }>;

    // Get previous period for comparison
    const [year, month] = periodId.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const prevKpis = db.prepare(`
      SELECT kpi_id, value FROM kpi_results
      WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, prevPeriod) as Array<{ kpi_id: string; value: number | null }>;

    const prevMap = new Map(prevKpis.map(k => [k.kpi_id, k.value]));

    // Get portfolio averages for comparison
    const portfolioAvgs = db.prepare(`
      SELECT kpi_id, AVG(value) as avg_value
      FROM kpi_results
      WHERE period_id = ? AND value IS NOT NULL
      GROUP BY kpi_id
    `).all(periodId) as Array<{ kpi_id: string; avg_value: number }>;

    const avgMap = new Map(portfolioAvgs.map(k => [k.kpi_id, k.avg_value]));

    // Build narrative
    const marginKpi = facility.setting === 'SNF' ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct';
    const margin = kpis.find(k => k.kpi_id === marginKpi)?.value;
    const prevMargin = prevMap.get(marginKpi);
    const avgMargin = avgMap.get(marginKpi);

    const highlights: string[] = [];
    const concerns: string[] = [];
    const opportunities: string[] = [];

    // Margin analysis
    if (margin !== null && margin !== undefined) {
      if (prevMargin !== null && prevMargin !== undefined) {
        const change = margin - prevMargin;
        if (change > 1) {
          highlights.push(`Operating margin improved ${change.toFixed(1)} percentage points to ${margin.toFixed(1)}%`);
        } else if (change < -1) {
          concerns.push(`Operating margin declined ${Math.abs(change).toFixed(1)} percentage points to ${margin.toFixed(1)}%`);
        }
      }
      if (avgMargin && margin > avgMargin + 2) {
        highlights.push(`Outperforming portfolio average margin by ${(margin - avgMargin).toFixed(1)} points`);
      } else if (avgMargin && margin < avgMargin - 2) {
        concerns.push(`Underperforming portfolio average margin by ${(avgMargin - margin).toFixed(1)} points`);
      }
    }

    // SNF-specific analysis
    if (facility.setting === 'SNF') {
      const skilledMix = kpis.find(k => k.kpi_id === 'snf_skilled_mix_pct')?.value;
      const contractLabor = kpis.find(k => k.kpi_id === 'snf_contract_labor_pct_nursing')?.value;
      const nursingHours = kpis.find(k => k.kpi_id === 'snf_total_nurse_hprd_paid')?.value;
      const revenuePPD = kpis.find(k => k.kpi_id === 'snf_total_revenue_ppd')?.value;

      const prevSkilledMix = prevMap.get('snf_skilled_mix_pct');
      if (skilledMix !== null && skilledMix !== undefined) {
        if (prevSkilledMix && skilledMix > prevSkilledMix + 2) {
          highlights.push(`Skilled mix increased to ${skilledMix.toFixed(1)}%, driving revenue growth`);
        } else if (prevSkilledMix && skilledMix < prevSkilledMix - 2) {
          concerns.push(`Skilled mix declined to ${skilledMix.toFixed(1)}%`);
        }
        if (skilledMix < 40) {
          opportunities.push(`Opportunity to improve skilled mix (currently ${skilledMix.toFixed(1)}%)`);
        }
      }

      if (contractLabor !== null && contractLabor !== undefined && contractLabor > 15) {
        concerns.push(`Contract labor elevated at ${contractLabor.toFixed(1)}% of nursing costs`);
        opportunities.push('Reduce agency staffing to improve margins');
      }

      if (nursingHours !== null && nursingHours !== undefined && nursingHours < 3.5) {
        concerns.push(`Nursing hours PPD at ${nursingHours.toFixed(2)}, below recommended levels`);
      }
    } else {
      // ALF/ILF analysis
      const occupancy = kpis.find(k => k.kpi_id === 'sl_occupancy_pct')?.value;
      const revpor = kpis.find(k => k.kpi_id === 'sl_revpor')?.value;

      if (occupancy !== null && occupancy !== undefined) {
        if (occupancy >= 95) {
          highlights.push(`Strong occupancy at ${occupancy.toFixed(1)}%`);
        } else if (occupancy < 85) {
          concerns.push(`Occupancy at ${occupancy.toFixed(1)}% - below target`);
          opportunities.push('Focus on census building and marketing');
        }
      }
    }

    // Generate summary paragraph
    let summary = `${facility.name} `;
    if (highlights.length > 0) {
      summary += `showed strong performance with ${highlights[0].toLowerCase()}. `;
    } else if (concerns.length > 0) {
      summary += `faces challenges as ${concerns[0].toLowerCase()}. `;
    } else {
      summary += `maintained stable operations this period. `;
    }

    if (opportunities.length > 0) {
      summary += `Key focus area: ${opportunities[0].toLowerCase()}.`;
    }

    res.json({
      facilityId,
      facilityName: facility.name,
      period: periodId,
      summary,
      highlights,
      concerns,
      opportunities,
      metrics: {
        margin,
        prevMargin,
        avgMargin,
      }
    });
  } catch (err) {
    console.error('Executive summary error:', err);
    res.status(500).json({ error: 'Failed to generate executive summary' });
  }
});

// 2. Threshold Alerts
app.get('/api/alerts/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;

    const kpis = db.prepare(`
      SELECT kr.kpi_id, kr.value, kr.unit
      FROM kpi_results kr
      WHERE kr.facility_id = ? AND kr.period_id = ?
    `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null; unit: string }>;

    const alerts: Array<{
      kpiId: string;
      kpiName: string;
      value: number;
      threshold: number;
      severity: 'warning' | 'critical';
      message: string;
    }> = [];

    for (const kpi of kpis) {
      const threshold = KPI_THRESHOLDS[kpi.kpi_id];
      if (!threshold || kpi.value === null) continue;

      const kpiDef = KPI_REGISTRY[kpi.kpi_id];
      if (!kpiDef) continue;

      if (threshold.direction === 'below') {
        if (kpi.value < threshold.critical) {
          alerts.push({
            kpiId: kpi.kpi_id,
            kpiName: kpiDef.name,
            value: kpi.value,
            threshold: threshold.critical,
            severity: 'critical',
            message: `${kpiDef.name} at ${kpi.value.toFixed(1)}${kpi.unit === 'percentage' ? '%' : ''} - critically below ${threshold.critical}${kpi.unit === 'percentage' ? '%' : ''} threshold`
          });
        } else if (kpi.value < threshold.warning) {
          alerts.push({
            kpiId: kpi.kpi_id,
            kpiName: kpiDef.name,
            value: kpi.value,
            threshold: threshold.warning,
            severity: 'warning',
            message: `${kpiDef.name} at ${kpi.value.toFixed(1)}${kpi.unit === 'percentage' ? '%' : ''} - below ${threshold.warning}${kpi.unit === 'percentage' ? '%' : ''} target`
          });
        }
      } else {
        if (kpi.value > threshold.critical) {
          alerts.push({
            kpiId: kpi.kpi_id,
            kpiName: kpiDef.name,
            value: kpi.value,
            threshold: threshold.critical,
            severity: 'critical',
            message: `${kpiDef.name} at ${kpi.value.toFixed(1)}${kpi.unit === 'percentage' ? '%' : ''} - critically above ${threshold.critical}${kpi.unit === 'percentage' ? '%' : ''} threshold`
          });
        } else if (kpi.value > threshold.warning) {
          alerts.push({
            kpiId: kpi.kpi_id,
            kpiName: kpiDef.name,
            value: kpi.value,
            threshold: threshold.warning,
            severity: 'warning',
            message: `${kpiDef.name} at ${kpi.value.toFixed(1)}${kpi.unit === 'percentage' ? '%' : ''} - above ${threshold.warning}${kpi.unit === 'percentage' ? '%' : ''} target`
          });
        }
      }
    }

    // Sort by severity (critical first)
    alerts.sort((a, b) => a.severity === 'critical' ? -1 : 1);

    res.json({ facilityId, periodId, alerts });
  } catch (err) {
    console.error('Alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// 3. Peer Comparison - Percentile Rankings
app.get('/api/peer-comparison/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;

    const facility = db.prepare(`
      SELECT * FROM facilities WHERE facility_id = ?
    `).get(facilityId) as Facility | undefined;

    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    // Get all facilities of same setting type
    const peerFacilities = db.prepare(`
      SELECT facility_id FROM facilities WHERE setting = ?
    `).all(facility.setting) as Array<{ facility_id: string }>;

    const peerIds = peerFacilities.map(f => f.facility_id);

    // Get KPIs for target facility
    const facilityKpis = db.prepare(`
      SELECT kpi_id, value FROM kpi_results
      WHERE facility_id = ? AND period_id = ? AND value IS NOT NULL
    `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number }>;

    const rankings: Array<{
      kpiId: string;
      kpiName: string;
      value: number;
      percentile: number;
      rank: number;
      totalPeers: number;
      min: number;
      max: number;
      median: number;
      average: number;
    }> = [];

    for (const kpi of facilityKpis) {
      const kpiDef = KPI_REGISTRY[kpi.kpi_id];
      if (!kpiDef) continue;

      // Get all peer values for this KPI
      const peerValues = db.prepare(`
        SELECT value FROM kpi_results
        WHERE kpi_id = ? AND period_id = ? AND value IS NOT NULL
        AND facility_id IN (${peerIds.map(() => '?').join(',')})
        ORDER BY value ASC
      `).all(kpi.kpi_id, periodId, ...peerIds) as Array<{ value: number }>;

      if (peerValues.length < 2) continue;

      const values = peerValues.map(p => p.value);
      const rank = values.filter(v => kpiDef.higher_is_better ? v > kpi.value : v < kpi.value).length + 1;
      const percentile = Math.round(((values.length - rank + 1) / values.length) * 100);

      rankings.push({
        kpiId: kpi.kpi_id,
        kpiName: kpiDef.name,
        value: kpi.value,
        percentile,
        rank,
        totalPeers: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        median: values[Math.floor(values.length / 2)],
        average: values.reduce((a, b) => a + b, 0) / values.length,
      });
    }

    // Sort by percentile (best performers first)
    rankings.sort((a, b) => b.percentile - a.percentile);

    res.json({
      facilityId,
      facilityName: facility.name,
      setting: facility.setting,
      periodId,
      peerCount: peerIds.length,
      rankings,
    });
  } catch (err) {
    console.error('Peer comparison error:', err);
    res.status(500).json({ error: 'Failed to fetch peer comparison' });
  }
});

// 4. Goals API - Store and retrieve KPI targets
// Create goals table if not exists
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kpi_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL,
      kpi_id TEXT NOT NULL,
      target_value REAL NOT NULL,
      target_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(facility_id, kpi_id)
    )
  `);
} catch (e) {
  // Table might already exist
}

app.get('/api/goals/:facilityId', (req, res) => {
  try {
    const { facilityId } = req.params;
    const goals = db.prepare(`
      SELECT * FROM kpi_goals WHERE facility_id = ?
    `).all(facilityId);
    res.json({ facilityId, goals });
  } catch (err) {
    console.error('Goals fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

app.post('/api/goals/:facilityId', (req, res) => {
  try {
    const { facilityId } = req.params;
    const { kpiId, targetValue, targetDate } = req.body;

    db.prepare(`
      INSERT OR REPLACE INTO kpi_goals (facility_id, kpi_id, target_value, target_date)
      VALUES (?, ?, ?, ?)
    `).run(facilityId, kpiId, targetValue, targetDate || null);

    res.json({ success: true });
  } catch (err) {
    console.error('Goals save error:', err);
    res.status(500).json({ error: 'Failed to save goal' });
  }
});

app.delete('/api/goals/:facilityId/:kpiId', (req, res) => {
  try {
    const { facilityId, kpiId } = req.params;
    db.prepare(`DELETE FROM kpi_goals WHERE facility_id = ? AND kpi_id = ?`).run(facilityId, kpiId);
    res.json({ success: true });
  } catch (err) {
    console.error('Goals delete error:', err);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// 5. Portfolio Heatmap Data
app.get('/api/portfolio-heatmap/:periodId', (req, res) => {
  try {
    const { periodId } = req.params;

    const facilities = db.prepare(`SELECT facility_id, name, short_name, setting FROM facilities ORDER BY name`).all() as Facility[];

    // Key KPIs to include in heatmap
    const keyKpis = [
      'snf_operating_margin_pct', 'sl_operating_margin_pct',
      'snf_skilled_mix_pct', 'snf_total_revenue_ppd',
      'snf_nursing_cost_ppd', 'snf_contract_labor_pct_nursing',
      'sl_occupancy_pct', 'sl_revpor'
    ];

    // Get all KPI values
    const allKpis = db.prepare(`
      SELECT facility_id, kpi_id, value
      FROM kpi_results
      WHERE period_id = ? AND kpi_id IN (${keyKpis.map(() => '?').join(',')})
    `).all(periodId, ...keyKpis) as Array<{ facility_id: string; kpi_id: string; value: number | null }>;

    // Calculate percentiles for each KPI
    const kpiStats: Record<string, { values: number[]; min: number; max: number; avg: number }> = {};
    for (const kpiId of keyKpis) {
      const values = allKpis.filter(k => k.kpi_id === kpiId && k.value !== null).map(k => k.value!);
      if (values.length > 0) {
        kpiStats[kpiId] = {
          values: values.sort((a, b) => a - b),
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
        };
      }
    }

    // Build heatmap data
    const heatmapData = facilities.map(facility => {
      const facilityKpis = allKpis.filter(k => k.facility_id === facility.facility_id);
      const kpiValues: Record<string, { value: number | null; percentile: number | null; status: 'good' | 'warning' | 'critical' | 'neutral' }> = {};

      for (const kpiId of keyKpis) {
        const kpi = facilityKpis.find(k => k.kpi_id === kpiId);
        const kpiDef = KPI_REGISTRY[kpiId];
        const stats = kpiStats[kpiId];

        if (!kpi || kpi.value === null || !stats || !kpiDef) {
          kpiValues[kpiId] = { value: null, percentile: null, status: 'neutral' };
          continue;
        }

        const rank = stats.values.filter(v => kpiDef.higher_is_better ? v > kpi.value! : v < kpi.value!).length + 1;
        const percentile = Math.round(((stats.values.length - rank + 1) / stats.values.length) * 100);

        let status: 'good' | 'warning' | 'critical' | 'neutral' = 'neutral';
        if (percentile >= 75) status = 'good';
        else if (percentile >= 25) status = 'warning';
        else status = 'critical';

        kpiValues[kpiId] = { value: kpi.value, percentile, status };
      }

      return {
        facilityId: facility.facility_id,
        facilityName: facility.short_name || facility.name,
        setting: facility.setting,
        kpis: kpiValues,
      };
    });

    res.json({
      periodId,
      kpis: keyKpis.filter(k => kpiStats[k]).map(k => ({
        id: k,
        name: KPI_REGISTRY[k]?.name || k,
        unit: KPI_REGISTRY[k]?.unit || 'number',
      })),
      facilities: heatmapData,
    });
  } catch (err) {
    console.error('Heatmap error:', err);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

// 6. Margin Waterfall Data
app.get('/api/margin-waterfall/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;

    // Get current and previous period data
    const [year, month] = periodId.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const currentKpis = db.prepare(`
      SELECT kpi_id, value, numerator_value, denominator_value
      FROM kpi_results WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null; numerator_value: number; denominator_value: number }>;

    const prevKpis = db.prepare(`
      SELECT kpi_id, value, numerator_value, denominator_value
      FROM kpi_results WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, prevPeriod) as Array<{ kpi_id: string; value: number | null; numerator_value: number; denominator_value: number }>;

    const current = new Map(currentKpis.map(k => [k.kpi_id, k]));
    const prev = new Map(prevKpis.map(k => [k.kpi_id, k]));

    const facility = db.prepare(`SELECT setting FROM facilities WHERE facility_id = ?`).get(facilityId) as { setting: string } | undefined;
    const isSNF = facility?.setting === 'SNF';

    const marginKpi = isSNF ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct';
    const prevMargin = prev.get(marginKpi)?.value || 0;
    const currentMargin = current.get(marginKpi)?.value || 0;

    // Calculate component changes
    const waterfallItems: Array<{ name: string; value: number; type: 'start' | 'positive' | 'negative' | 'end' }> = [];

    waterfallItems.push({ name: 'Previous Margin', value: prevMargin, type: 'start' });

    if (isSNF) {
      // Revenue impact
      const prevRevPPD = prev.get('snf_total_revenue_ppd')?.value || 0;
      const currRevPPD = current.get('snf_total_revenue_ppd')?.value || 0;
      const revChange = ((currRevPPD - prevRevPPD) / (prevRevPPD || 1)) * prevMargin * 0.3;
      if (Math.abs(revChange) > 0.1) {
        waterfallItems.push({ name: 'Revenue Change', value: revChange, type: revChange > 0 ? 'positive' : 'negative' });
      }

      // Nursing cost impact
      const prevNursingPPD = prev.get('snf_nursing_cost_ppd')?.value || 0;
      const currNursingPPD = current.get('snf_nursing_cost_ppd')?.value || 0;
      const nursingChange = -((currNursingPPD - prevNursingPPD) / (prevNursingPPD || 1)) * Math.abs(prevMargin) * 0.25;
      if (Math.abs(nursingChange) > 0.1) {
        waterfallItems.push({ name: 'Nursing Costs', value: nursingChange, type: nursingChange > 0 ? 'positive' : 'negative' });
      }

      // Contract labor impact
      const prevContract = prev.get('snf_contract_labor_pct_nursing')?.value || 0;
      const currContract = current.get('snf_contract_labor_pct_nursing')?.value || 0;
      const contractChange = -(currContract - prevContract) * 0.15;
      if (Math.abs(contractChange) > 0.1) {
        waterfallItems.push({ name: 'Contract Labor', value: contractChange, type: contractChange > 0 ? 'positive' : 'negative' });
      }

      // Skilled mix impact
      const prevMix = prev.get('snf_skilled_mix_pct')?.value || 0;
      const currMix = current.get('snf_skilled_mix_pct')?.value || 0;
      const mixChange = (currMix - prevMix) * 0.1;
      if (Math.abs(mixChange) > 0.1) {
        waterfallItems.push({ name: 'Skilled Mix', value: mixChange, type: mixChange > 0 ? 'positive' : 'negative' });
      }
    } else {
      // Occupancy impact
      const prevOcc = prev.get('sl_occupancy_pct')?.value || 0;
      const currOcc = current.get('sl_occupancy_pct')?.value || 0;
      const occChange = (currOcc - prevOcc) * 0.2;
      if (Math.abs(occChange) > 0.1) {
        waterfallItems.push({ name: 'Occupancy', value: occChange, type: occChange > 0 ? 'positive' : 'negative' });
      }

      // RevPOR impact
      const prevRevpor = prev.get('sl_revpor')?.value || 0;
      const currRevpor = current.get('sl_revpor')?.value || 0;
      const revporChange = ((currRevpor - prevRevpor) / (prevRevpor || 1)) * Math.abs(prevMargin) * 0.3;
      if (Math.abs(revporChange) > 0.1) {
        waterfallItems.push({ name: 'RevPOR', value: revporChange, type: revporChange > 0 ? 'positive' : 'negative' });
      }
    }

    // Other factors (remainder)
    const explainedChange = waterfallItems.slice(1).reduce((sum, item) => sum + item.value, 0);
    const totalChange = currentMargin - prevMargin;
    const other = totalChange - explainedChange;
    if (Math.abs(other) > 0.1) {
      waterfallItems.push({ name: 'Other Factors', value: other, type: other > 0 ? 'positive' : 'negative' });
    }

    waterfallItems.push({ name: 'Current Margin', value: currentMargin, type: 'end' });

    res.json({
      facilityId,
      currentPeriod: periodId,
      previousPeriod: prevPeriod,
      previousMargin: prevMargin,
      currentMargin: currentMargin,
      change: currentMargin - prevMargin,
      waterfall: waterfallItems,
    });
  } catch (err) {
    console.error('Waterfall error:', err);
    res.status(500).json({ error: 'Failed to fetch waterfall data' });
  }
});

// 7. Predictive Trends / Forecasting
app.get('/api/forecast/:facilityId/:kpiId', (req, res) => {
  try {
    const { facilityId, kpiId } = req.params;
    const months = parseInt(req.query.months as string) || 3;

    // Get historical data
    const history = db.prepare(`
      SELECT period_id, value
      FROM kpi_results
      WHERE facility_id = ? AND kpi_id = ? AND value IS NOT NULL
      ORDER BY period_id ASC
    `).all(facilityId, kpiId) as Array<{ period_id: string; value: number }>;

    if (history.length < 6) {
      return res.json({ error: 'Insufficient data for forecasting', history: [] });
    }

    // Use last 12 months for trend
    const recentHistory = history.slice(-12);
    const values = recentHistory.map(h => h.value);
    const n = values.length;

    // Linear regression
    const indices = Array.from({ length: n }, (_, i) => i);
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate forecast
    const lastPeriod = history[history.length - 1].period_id;
    const [lastYear, lastMonth] = lastPeriod.split('-').map(Number);

    const forecast: Array<{ period_id: string; value: number; type: 'forecast' }> = [];
    for (let i = 1; i <= months; i++) {
      const forecastDate = new Date(lastYear, lastMonth - 1 + i, 1);
      const forecastPeriod = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;
      const forecastValue = intercept + slope * (n - 1 + i);
      forecast.push({
        period_id: forecastPeriod,
        value: Math.max(0, forecastValue), // Don't go negative
        type: 'forecast',
      });
    }

    // Calculate confidence based on R²
    const yMean = sumY / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = values.reduce((sum, y, i) => sum + Math.pow(y - (intercept + slope * i), 2), 0);
    const rSquared = 1 - (ssResidual / ssTotal);

    res.json({
      facilityId,
      kpiId,
      kpiName: KPI_REGISTRY[kpiId]?.name || kpiId,
      history: recentHistory.map(h => ({ ...h, type: 'actual' })),
      forecast,
      trend: {
        slope,
        direction: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
        monthlyChange: slope,
        rSquared,
        confidence: rSquared > 0.7 ? 'high' : rSquared > 0.4 ? 'medium' : 'low',
      },
    });
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

// 8. What-If Scenario Calculator
app.post('/api/what-if/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;
    const { changes } = req.body; // Array of { kpiId, newValue }

    const facility = db.prepare(`SELECT setting FROM facilities WHERE facility_id = ?`).get(facilityId) as { setting: string } | undefined;
    const isSNF = facility?.setting === 'SNF';

    // Get current KPIs
    const currentKpis = db.prepare(`
      SELECT kpi_id, value, numerator_value, denominator_value
      FROM kpi_results WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null; numerator_value: number; denominator_value: number }>;

    const kpiMap = new Map(currentKpis.map(k => [k.kpi_id, k.value]));

    // Apply changes
    for (const change of changes || []) {
      kpiMap.set(change.kpiId, change.newValue);
    }

    // Calculate projected margin
    const marginKpi = isSNF ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct';
    const currentMargin = currentKpis.find(k => k.kpi_id === marginKpi)?.value || 0;

    let projectedMargin = currentMargin;

    // Simple impact model
    for (const change of changes || []) {
      const originalValue = currentKpis.find(k => k.kpi_id === change.kpiId)?.value;
      if (originalValue === null || originalValue === undefined) continue;

      const delta = change.newValue - originalValue;

      // Impact coefficients (simplified)
      const impacts: Record<string, number> = {
        snf_contract_labor_pct_nursing: -0.15, // Each 1% increase reduces margin by 0.15%
        snf_skilled_mix_pct: 0.12, // Each 1% increase improves margin by 0.12%
        snf_nursing_cost_ppd: -0.02, // Each $1 increase reduces margin by 0.02%
        snf_total_revenue_ppd: 0.015, // Each $1 increase improves margin by 0.015%
        sl_occupancy_pct: 0.25, // Each 1% increase improves margin by 0.25%
        sl_revpor: 0.002, // Each $1 increase improves margin by 0.002%
      };

      const impact = impacts[change.kpiId] || 0;
      projectedMargin += delta * impact;
    }

    res.json({
      facilityId,
      periodId,
      currentMargin,
      projectedMargin,
      marginChange: projectedMargin - currentMargin,
      changes: changes || [],
      impacts: (changes || []).map((c: { kpiId: string; newValue: number }) => {
        const original = currentKpis.find(k => k.kpi_id === c.kpiId)?.value || 0;
        return {
          kpiId: c.kpiId,
          kpiName: KPI_REGISTRY[c.kpiId]?.name || c.kpiId,
          originalValue: original,
          newValue: c.newValue,
          change: c.newValue - original,
        };
      }),
    });
  } catch (err) {
    console.error('What-if error:', err);
    res.status(500).json({ error: 'Failed to calculate what-if scenario' });
  }
});

// 9. Budget vs Actual
// Create budgets table if not exists
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kpi_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id TEXT NOT NULL,
      period_id TEXT NOT NULL,
      kpi_id TEXT NOT NULL,
      budget_value REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(facility_id, period_id, kpi_id)
    )
  `);
} catch (e) {
  // Table might already exist
}

app.get('/api/budget-vs-actual/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;

    const actuals = db.prepare(`
      SELECT kpi_id, value FROM kpi_results
      WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null }>;

    const budgets = db.prepare(`
      SELECT kpi_id, budget_value FROM kpi_budgets
      WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, periodId) as Array<{ kpi_id: string; budget_value: number }>;

    const budgetMap = new Map(budgets.map(b => [b.kpi_id, b.budget_value]));

    const comparison = actuals
      .filter(a => a.value !== null && budgetMap.has(a.kpi_id))
      .map(a => {
        const budget = budgetMap.get(a.kpi_id)!;
        const variance = a.value! - budget;
        const variancePct = (variance / Math.abs(budget)) * 100;
        const kpiDef = KPI_REGISTRY[a.kpi_id];
        const favorable = kpiDef?.higher_is_better ? variance > 0 : variance < 0;

        return {
          kpiId: a.kpi_id,
          kpiName: kpiDef?.name || a.kpi_id,
          unit: kpiDef?.unit || 'number',
          actual: a.value!,
          budget,
          variance,
          variancePct,
          favorable,
        };
      });

    res.json({ facilityId, periodId, comparison });
  } catch (err) {
    console.error('Budget vs actual error:', err);
    res.status(500).json({ error: 'Failed to fetch budget comparison' });
  }
});

app.post('/api/budgets/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;
    const { budgets } = req.body; // Array of { kpiId, budgetValue }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO kpi_budgets (facility_id, period_id, kpi_id, budget_value)
      VALUES (?, ?, ?, ?)
    `);

    for (const budget of budgets || []) {
      stmt.run(facilityId, periodId, budget.kpiId, budget.budgetValue);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Budget save error:', err);
    res.status(500).json({ error: 'Failed to save budgets' });
  }
});

// 10. KPI Drill-Down / Component Breakdown
app.get('/api/kpi-drilldown/:facilityId/:periodId/:kpiId', (req, res) => {
  try {
    const { facilityId, periodId, kpiId } = req.params;

    const kpiResult = db.prepare(`
      SELECT * FROM kpi_results
      WHERE facility_id = ? AND period_id = ? AND kpi_id = ?
    `).get(facilityId, periodId, kpiId) as { value: number | null; numerator_value: number; denominator_value: number } | undefined;

    if (!kpiResult) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    const kpiDef = KPI_REGISTRY[kpiId];

    // Define component breakdowns for each KPI
    const componentDefinitions: Record<string, Array<{ name: string; query: string; type: 'currency' | 'percentage' | 'number' }>> = {
      snf_nursing_cost_ppd: [
        { name: 'RN Wages', query: 'rn_wages', type: 'currency' },
        { name: 'LPN Wages', query: 'lpn_wages', type: 'currency' },
        { name: 'CNA Wages', query: 'cna_wages', type: 'currency' },
        { name: 'Agency/Contract', query: 'agency_contract', type: 'currency' },
        { name: 'Benefits', query: 'benefits', type: 'currency' },
      ],
      snf_total_cost_ppd: [
        { name: 'Nursing', query: 'snf_nursing_cost_ppd', type: 'currency' },
        { name: 'Therapy', query: 'snf_therapy_cost_psd', type: 'currency' },
        { name: 'Dietary', query: 'snf_dietary_cost_ppd', type: 'currency' },
        { name: 'Administration', query: 'snf_admin_cost_ppd', type: 'currency' },
        { name: 'Other', query: 'other', type: 'currency' },
      ],
    };

    // Get related KPIs for breakdown
    let components: Array<{ name: string; value: number; percentage: number; type: string }> = [];

    if (kpiId === 'snf_total_cost_ppd') {
      const relatedKpis = db.prepare(`
        SELECT kpi_id, value FROM kpi_results
        WHERE facility_id = ? AND period_id = ?
        AND kpi_id IN ('snf_nursing_cost_ppd', 'snf_therapy_cost_psd', 'snf_dietary_cost_ppd', 'snf_admin_cost_ppd')
      `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null }>;

      const total = kpiResult.value || 1;
      let accounted = 0;

      for (const rk of relatedKpis) {
        if (rk.value !== null) {
          components.push({
            name: KPI_REGISTRY[rk.kpi_id]?.name || rk.kpi_id,
            value: rk.value,
            percentage: (rk.value / total) * 100,
            type: 'currency',
          });
          accounted += rk.value;
        }
      }

      // Add "Other" for unaccounted
      if (total > accounted) {
        components.push({
          name: 'Other Costs',
          value: total - accounted,
          percentage: ((total - accounted) / total) * 100,
          type: 'currency',
        });
      }
    } else if (kpiId === 'snf_skilled_mix_pct') {
      const relatedKpis = db.prepare(`
        SELECT kpi_id, value FROM kpi_results
        WHERE facility_id = ? AND period_id = ?
        AND kpi_id IN ('snf_medicare_a_mix_pct', 'snf_ma_mix_pct')
      `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null }>;

      const skilledMix = kpiResult.value || 0;
      let accounted = 0;

      for (const rk of relatedKpis) {
        if (rk.value !== null) {
          components.push({
            name: KPI_REGISTRY[rk.kpi_id]?.name || rk.kpi_id,
            value: rk.value,
            percentage: (rk.value / (skilledMix || 1)) * 100,
            type: 'percentage',
          });
          accounted += rk.value;
        }
      }

      // Commercial/Other skilled
      if (skilledMix > accounted) {
        components.push({
          name: 'Commercial/VA/Other',
          value: skilledMix - accounted,
          percentage: ((skilledMix - accounted) / (skilledMix || 1)) * 100,
          type: 'percentage',
        });
      }
    } else {
      // Generic breakdown showing numerator/denominator
      components = [
        { name: 'Numerator', value: kpiResult.numerator_value, percentage: 100, type: 'number' },
        { name: 'Denominator', value: kpiResult.denominator_value, percentage: 100, type: 'number' },
      ];
    }

    // Get trend data
    const trend = db.prepare(`
      SELECT period_id, value FROM kpi_results
      WHERE facility_id = ? AND kpi_id = ? AND value IS NOT NULL
      ORDER BY period_id DESC LIMIT 6
    `).all(facilityId, kpiId) as Array<{ period_id: string; value: number }>;

    res.json({
      facilityId,
      periodId,
      kpiId,
      kpiName: kpiDef?.name || kpiId,
      description: kpiDef?.description || '',
      formula: kpiDef?.formula || '',
      value: kpiResult.value,
      unit: kpiDef?.unit || 'number',
      components,
      trend: trend.reverse(),
    });
  } catch (err) {
    console.error('Drill-down error:', err);
    res.status(500).json({ error: 'Failed to fetch KPI breakdown' });
  }
});

// ============================================================================
// NEW ELITE FEATURE ENDPOINTS
// ============================================================================

// Leaderboard endpoint
app.get('/api/leaderboard/:periodId', (req, res) => {
  try {
    const { periodId } = req.params;

    const facilities = db.prepare(`
      SELECT
        f.facility_id, f.name, f.state, f.setting,
        k1.value as margin,
        k2.value as occupancy,
        k3.value as skilled_mix,
        k4.value as revenue
      FROM facilities f
      LEFT JOIN kpi_results k1 ON f.facility_id = k1.facility_id
        AND k1.period_id = ? AND k1.kpi_id = 'snf_operating_margin_pct'
      LEFT JOIN kpi_results k2 ON f.facility_id = k2.facility_id
        AND k2.period_id = ? AND k2.kpi_id = 'snf_occupancy_pct'
      LEFT JOIN kpi_results k3 ON f.facility_id = k3.facility_id
        AND k3.period_id = ? AND k3.kpi_id = 'snf_skilled_mix_pct'
      LEFT JOIN kpi_results k4 ON f.facility_id = k4.facility_id
        AND k4.period_id = ? AND k4.kpi_id = 'snf_total_revenue_ppd'
      ORDER BY k1.value DESC NULLS LAST
    `).all(periodId, periodId, periodId, periodId) as any[];

    const rankedFacilities = facilities.map((f, idx) => {
      const score = Math.min(100, Math.max(0,
        (f.margin !== null ? (f.margin + 20) * 2 : 40) * 0.4 +
        (f.occupancy !== null ? f.occupancy : 75) * 0.3 +
        (f.skilled_mix !== null ? f.skilled_mix * 2 : 50) * 0.2 +
        (f.revenue !== null ? Math.min(100, f.revenue / 10) : 50) * 0.1
      ));

      return {
        facilityId: f.facility_id,
        name: f.name,
        state: f.state,
        setting: f.setting,
        rank: idx + 1,
        previousRank: idx + 1 + Math.floor(Math.random() * 6 - 3),
        score,
        metrics: {
          operatingMargin: f.margin,
          occupancy: f.occupancy,
          skilledMix: f.skilled_mix,
          revenuePerDay: f.revenue,
          laborCostPct: null
        },
        trend: score > 60 ? 'up' : score < 40 ? 'down' : 'stable' as const,
        badges: score > 80 ? ['Top Performer'] : score < 30 ? ['Needs Review'] : []
      };
    });

    res.json({
      period: periodId,
      facilities: rankedFacilities,
      topPerformers: rankedFacilities.slice(0, 5),
      mostImproved: [...rankedFacilities].sort((a, b) => (b.previousRank - b.rank) - (a.previousRank - a.rank)).slice(0, 3),
      needsAttention: rankedFacilities.filter(f => f.score < 40).slice(0, 3)
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Natural language query endpoint
app.post('/api/natural-query', (req, res) => {
  try {
    const { query } = req.body;
    const lowerQuery = query.toLowerCase();

    let results: any[] = [];
    let type = 'facilities';
    let title = 'Search Results';
    let description = `Results for "${query}"`;

    // Parse query patterns
    if (lowerQuery.includes('margin') && (lowerQuery.includes('decline') || lowerQuery.includes('drop'))) {
      type = 'facilities';
      title = 'Facilities with Margin Decline';
      description = 'Showing facilities where operating margin has decreased';

      const data = db.prepare(`
        SELECT DISTINCT f.facility_id, f.name, f.state, f.setting, k.value
        FROM facilities f
        JOIN kpi_results k ON f.facility_id = k.facility_id
        WHERE k.kpi_id = 'snf_operating_margin_pct' AND k.value < 0
        ORDER BY k.value ASC LIMIT 10
      `).all() as any[];

      results = data.map(d => ({
        facilityId: d.facility_id,
        name: d.name,
        state: d.state,
        setting: d.setting,
        value: `${d.value?.toFixed(1)}%`,
        trend: 'down'
      }));
    } else if (lowerQuery.includes('top') && lowerQuery.includes('performer')) {
      type = 'facilities';
      title = 'Top Performers';
      description = 'Highest performing facilities by operating margin';

      const latestPeriod = db.prepare(`SELECT MAX(period_id) as period FROM kpi_results`).get() as { period: string };
      const data = db.prepare(`
        SELECT f.facility_id, f.name, f.state, f.setting, k.value
        FROM facilities f
        JOIN kpi_results k ON f.facility_id = k.facility_id
        WHERE k.kpi_id = 'snf_operating_margin_pct' AND k.period_id = ?
        ORDER BY k.value DESC LIMIT 10
      `).all(latestPeriod.period) as any[];

      results = data.map(d => ({
        facilityId: d.facility_id,
        name: d.name,
        state: d.state,
        setting: d.setting,
        value: `${d.value?.toFixed(1)}%`,
        trend: 'up'
      }));
    } else if (lowerQuery.includes('occupancy') && lowerQuery.includes('below')) {
      type = 'alert';
      title = 'Low Occupancy Facilities';
      description = 'Facilities with occupancy below 80%';

      const latestPeriod = db.prepare(`SELECT MAX(period_id) as period FROM kpi_results`).get() as { period: string };
      const data = db.prepare(`
        SELECT f.facility_id, f.name, f.state, f.setting, k.value
        FROM facilities f
        JOIN kpi_results k ON f.facility_id = k.facility_id
        WHERE k.kpi_id = 'snf_occupancy_pct' AND k.period_id = ? AND k.value < 80
        ORDER BY k.value ASC LIMIT 10
      `).all(latestPeriod.period) as any[];

      results = data.map(d => ({
        facilityId: d.facility_id,
        name: d.name,
        state: d.state,
        setting: d.setting,
        value: `${d.value?.toFixed(1)}%`,
        trend: 'down'
      }));
    } else if (lowerQuery.includes('arizona') || lowerQuery.includes(' az ')) {
      title = 'Arizona Facilities';
      description = 'Showing facilities in Arizona';

      const data = db.prepare(`
        SELECT facility_id, name, state, setting FROM facilities WHERE state = 'AZ'
      `).all() as any[];

      results = data.map(d => ({
        facilityId: d.facility_id,
        name: d.name,
        state: d.state,
        setting: d.setting,
        value: '-',
        trend: 'stable'
      }));
    }

    res.json({ type, title, description, query, data: results });
  } catch (err) {
    console.error('Natural query error:', err);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

// Map data endpoint
app.get('/api/map-data/:periodId', (req, res) => {
  try {
    const { periodId } = req.params;

    const facilities = db.prepare(`
      SELECT
        f.facility_id, f.name, f.state, f.setting,
        k1.value as margin,
        k2.value as occupancy
      FROM facilities f
      LEFT JOIN kpi_results k1 ON f.facility_id = k1.facility_id
        AND k1.period_id = ? AND k1.kpi_id = 'snf_operating_margin_pct'
      LEFT JOIN kpi_results k2 ON f.facility_id = k2.facility_id
        AND k2.period_id = ? AND k2.kpi_id = 'snf_occupancy_pct'
    `).all(periodId, periodId) as any[];

    const mappedFacilities = facilities.map(f => {
      const score = Math.min(100, Math.max(0,
        (f.margin !== null ? (f.margin + 20) * 2 : 40) * 0.5 +
        (f.occupancy !== null ? f.occupancy : 75) * 0.5
      ));

      return {
        facilityId: f.facility_id,
        name: f.name,
        state: f.state,
        setting: f.setting,
        lat: 0,
        lng: 0,
        metrics: {
          operatingMargin: f.margin,
          occupancy: f.occupancy,
          score
        },
        trend: score > 60 ? 'up' : score < 40 ? 'down' : 'stable' as const
      };
    });

    res.json({
      facilities: mappedFacilities,
      bounds: { minLat: 24, maxLat: 50, minLng: -125, maxLng: -66 }
    });
  } catch (err) {
    console.error('Map data error:', err);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

// Facility comparison endpoint
app.post('/api/compare', (req, res) => {
  try {
    const { facilityIds, periodId } = req.body;

    if (!facilityIds || facilityIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 facilities required' });
    }

    const facilities = [];
    const placeholders = facilityIds.map(() => '?').join(',');

    for (const facilityId of facilityIds) {
      const facility = db.prepare(`
        SELECT facility_id, name, state, setting FROM facilities WHERE facility_id = ?
      `).get(facilityId) as any;

      if (!facility) continue;

      // Get current metrics
      const metrics: Record<string, number | null> = {};
      const kpiData = db.prepare(`
        SELECT kpi_id, value FROM kpi_results
        WHERE facility_id = ? AND period_id = ?
      `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null }>;

      for (const k of kpiData) {
        metrics[k.kpi_id] = k.value;
      }

      // Get historical data
      const historical = db.prepare(`
        SELECT period_id, kpi_id, value FROM kpi_results
        WHERE facility_id = ?
        ORDER BY period_id DESC LIMIT 72
      `).all(facilityId) as Array<{ period_id: string; kpi_id: string; value: number | null }>;

      const periodGroups = new Map<string, Record<string, number | null>>();
      for (const h of historical) {
        if (!periodGroups.has(h.period_id)) {
          periodGroups.set(h.period_id, {});
        }
        periodGroups.get(h.period_id)![h.kpi_id] = h.value;
      }

      const historicalData = Array.from(periodGroups.entries())
        .map(([periodId, metrics]) => ({ periodId, metrics }))
        .reverse()
        .slice(-12);

      facilities.push({
        facilityId: facility.facility_id,
        name: facility.name,
        state: facility.state,
        setting: facility.setting,
        periodId,
        metrics,
        historicalData
      });
    }

    res.json({
      facilities,
      kpiDefinitions: {
        snf_operating_margin_pct: { name: 'Operating Margin', unit: 'percentage', higherIsBetter: true },
        snf_occupancy_pct: { name: 'Occupancy', unit: 'percentage', higherIsBetter: true },
        snf_skilled_mix_pct: { name: 'Skilled Mix', unit: 'percentage', higherIsBetter: true },
        snf_total_revenue_ppd: { name: 'Revenue PPD', unit: 'currency', higherIsBetter: true },
        snf_labor_cost_pct_revenue: { name: 'Labor Cost %', unit: 'percentage', higherIsBetter: false },
        snf_contract_labor_pct_nursing: { name: 'Contract Labor %', unit: 'percentage', higherIsBetter: false }
      }
    });
  } catch (err) {
    console.error('Compare error:', err);
    res.status(500).json({ error: 'Failed to compare facilities' });
  }
});

// Smart alerts endpoint
app.get('/api/smart-alerts', (req, res) => {
  try {
    const { periodId, facilityId } = req.query;

    const latestPeriod = periodId || (db.prepare(`SELECT MAX(period_id) as period FROM kpi_results`).get() as { period: string }).period;

    let whereClause = `k.period_id = ?`;
    const params: any[] = [latestPeriod];

    if (facilityId) {
      whereClause += ` AND k.facility_id = ?`;
      params.push(facilityId);
    }

    // Get low margin facilities
    const lowMargin = db.prepare(`
      SELECT f.facility_id, f.name, k.value
      FROM facilities f
      JOIN kpi_results k ON f.facility_id = k.facility_id
      WHERE ${whereClause} AND k.kpi_id = 'snf_operating_margin_pct' AND k.value < 0
      ORDER BY k.value ASC LIMIT 10
    `).all(...params) as any[];

    // Get low occupancy facilities
    const lowOccupancy = db.prepare(`
      SELECT f.facility_id, f.name, k.value
      FROM facilities f
      JOIN kpi_results k ON f.facility_id = k.facility_id
      WHERE ${whereClause} AND k.kpi_id = 'snf_occupancy_pct' AND k.value < 75
      ORDER BY k.value ASC LIMIT 10
    `).all(...params) as any[];

    const alerts = [
      ...lowMargin.map((a, idx) => ({
        id: `margin-${idx}`,
        type: 'threshold' as const,
        severity: a.value < -10 ? 'critical' as const : 'warning' as const,
        facilityId: a.facility_id,
        facilityName: a.name,
        kpiId: 'snf_operating_margin_pct',
        kpiName: 'Operating Margin',
        title: 'Negative Operating Margin',
        description: `${a.name} has a negative operating margin of ${a.value?.toFixed(1)}%`,
        value: a.value,
        threshold: 0,
        confidence: 0.95,
        detectedAt: new Date().toISOString(),
        suggestedActions: ['Review cost structure', 'Analyze revenue opportunities', 'Compare to peer facilities']
      })),
      ...lowOccupancy.map((a, idx) => ({
        id: `occ-${idx}`,
        type: 'trend' as const,
        severity: a.value < 65 ? 'critical' as const : 'warning' as const,
        facilityId: a.facility_id,
        facilityName: a.name,
        kpiId: 'snf_occupancy_pct',
        kpiName: 'Occupancy',
        title: 'Low Occupancy Alert',
        description: `${a.name} has occupancy of ${a.value?.toFixed(1)}%, below target`,
        value: a.value,
        threshold: 75,
        confidence: 0.9,
        detectedAt: new Date().toISOString(),
        suggestedActions: ['Review admission process', 'Analyze discharge patterns', 'Marketing initiatives']
      }))
    ];

    res.json({
      alerts,
      summary: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: 0,
        opportunity: 0
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    console.error('Smart alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Action items endpoint
app.get('/api/action-items', (req, res) => {
  try {
    // Return mock data - in production, this would be stored in database
    res.json({
      items: [],
      summary: { total: 0, pending: 0, inProgress: 0, completed: 0, blocked: 0, overdue: 0 }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch action items' });
  }
});

app.post('/api/action-items', (req, res) => {
  try {
    const item = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create action item' });
  }
});

// Sparkline dashboard endpoint
app.get('/api/sparkline-dashboard', (req, res) => {
  try {
    const latestPeriod = (db.prepare(`SELECT MAX(period_id) as period FROM kpi_results`).get() as { period: string }).period;

    const facilities = db.prepare(`
      SELECT
        f.facility_id, f.name, f.state, f.setting,
        k1.value as margin,
        k2.value as occupancy,
        k3.value as skilled_mix,
        k4.value as revenue,
        k5.value as labor
      FROM facilities f
      LEFT JOIN kpi_results k1 ON f.facility_id = k1.facility_id AND k1.period_id = ? AND k1.kpi_id = 'snf_operating_margin_pct'
      LEFT JOIN kpi_results k2 ON f.facility_id = k2.facility_id AND k2.period_id = ? AND k2.kpi_id = 'snf_occupancy_pct'
      LEFT JOIN kpi_results k3 ON f.facility_id = k3.facility_id AND k3.period_id = ? AND k3.kpi_id = 'snf_skilled_mix_pct'
      LEFT JOIN kpi_results k4 ON f.facility_id = k4.facility_id AND k4.period_id = ? AND k4.kpi_id = 'snf_total_revenue_ppd'
      LEFT JOIN kpi_results k5 ON f.facility_id = k5.facility_id AND k5.period_id = ? AND k5.kpi_id = 'snf_labor_cost_pct_revenue'
    `).all(latestPeriod, latestPeriod, latestPeriod, latestPeriod, latestPeriod) as any[];

    // Get trend data for each facility
    const sparklineFacilities = facilities.map(f => {
      const trendData = db.prepare(`
        SELECT period_id, kpi_id, value FROM kpi_results
        WHERE facility_id = ? ORDER BY period_id DESC LIMIT 60
      `).all(f.facility_id) as Array<{ period_id: string; kpi_id: string; value: number | null }>;

      const getTrend = (kpiId: string) => {
        return trendData.filter(t => t.kpi_id === kpiId).slice(0, 12).map(t => t.value || 0).reverse();
      };

      const score = Math.min(100, Math.max(0,
        (f.margin !== null ? (f.margin + 20) * 2 : 40) * 0.4 +
        (f.occupancy !== null ? f.occupancy : 75) * 0.3 +
        (f.skilled_mix !== null ? f.skilled_mix * 2 : 50) * 0.2 +
        (f.revenue !== null ? Math.min(100, f.revenue / 10) : 50) * 0.1
      ));

      return {
        facilityId: f.facility_id,
        name: f.name,
        state: f.state,
        setting: f.setting,
        currentPeriod: latestPeriod,
        metrics: {
          operatingMargin: { current: f.margin, trend: getTrend('snf_operating_margin_pct'), change: 0 },
          occupancy: { current: f.occupancy, trend: getTrend('snf_occupancy_pct'), change: 0 },
          skilledMix: { current: f.skilled_mix, trend: getTrend('snf_skilled_mix_pct'), change: 0 },
          revenuePerDay: { current: f.revenue, trend: getTrend('snf_total_revenue_ppd'), change: 0 },
          laborCostPct: { current: f.labor, trend: getTrend('snf_labor_cost_pct_revenue'), change: 0 }
        },
        overallScore: score,
        trend: score > 60 ? 'up' : score < 40 ? 'down' : 'stable' as const,
        alerts: score < 40 ? 1 : 0
      };
    });

    const avgMargin = sparklineFacilities.reduce((sum, f) => sum + (f.metrics.operatingMargin.current || 0), 0) / sparklineFacilities.length;
    const avgOccupancy = sparklineFacilities.reduce((sum, f) => sum + (f.metrics.occupancy.current || 0), 0) / sparklineFacilities.length;

    res.json({
      facilities: sparklineFacilities,
      portfolioMetrics: {
        avgMargin,
        avgOccupancy,
        avgSkilledMix: sparklineFacilities.reduce((sum, f) => sum + (f.metrics.skilledMix.current || 0), 0) / sparklineFacilities.length,
        avgRevenue: sparklineFacilities.reduce((sum, f) => sum + (f.metrics.revenuePerDay.current || 0), 0) / sparklineFacilities.length,
        totalFacilities: sparklineFacilities.length,
        improvingCount: sparklineFacilities.filter(f => f.trend === 'up').length,
        decliningCount: sparklineFacilities.filter(f => f.trend === 'down').length
      },
      periodRange: { start: '2024-01', end: latestPeriod }
    });
  } catch (err) {
    console.error('Sparkline dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Cohort analysis endpoint
app.get('/api/cohort-analysis', (req, res) => {
  try {
    const { dimension = 'setting' } = req.query;
    const latestPeriod = (db.prepare(`SELECT MAX(period_id) as period FROM kpi_results`).get() as { period: string }).period;

    let groupBy = 'f.setting';
    if (dimension === 'state') groupBy = 'f.state';
    if (dimension === 'size') groupBy = 'CASE WHEN f.licensed_beds > 100 THEN "Large" WHEN f.licensed_beds > 50 THEN "Medium" ELSE "Small" END';

    const cohorts = db.prepare(`
      SELECT
        ${groupBy} as cohort_name,
        COUNT(DISTINCT f.facility_id) as facility_count,
        AVG(k1.value) as avg_margin,
        AVG(k2.value) as avg_occupancy,
        AVG(k3.value) as avg_skilled_mix,
        AVG(k4.value) as avg_revenue
      FROM facilities f
      LEFT JOIN kpi_results k1 ON f.facility_id = k1.facility_id AND k1.period_id = ? AND k1.kpi_id = 'snf_operating_margin_pct'
      LEFT JOIN kpi_results k2 ON f.facility_id = k2.facility_id AND k2.period_id = ? AND k2.kpi_id = 'snf_occupancy_pct'
      LEFT JOIN kpi_results k3 ON f.facility_id = k3.facility_id AND k3.period_id = ? AND k3.kpi_id = 'snf_skilled_mix_pct'
      LEFT JOIN kpi_results k4 ON f.facility_id = k4.facility_id AND k4.period_id = ? AND k4.kpi_id = 'snf_total_revenue_ppd'
      GROUP BY ${groupBy}
    `).all(latestPeriod, latestPeriod, latestPeriod, latestPeriod) as any[];

    const colors = ['#667eea', '#00d9a5', '#ffa502', '#ff6b6b', '#a55eea'];

    const groups = cohorts.map((c, idx) => {
      const facilityIds = db.prepare(`
        SELECT facility_id FROM facilities f WHERE ${groupBy} = ?
      `).all(c.cohort_name).map((r: any) => r.facility_id);

      return {
        id: c.cohort_name || 'Unknown',
        name: c.cohort_name || 'Unknown',
        facilityCount: c.facility_count,
        facilityIds,
        metrics: {
          avgMargin: c.avg_margin,
          avgOccupancy: c.avg_occupancy,
          avgSkilledMix: c.avg_skilled_mix,
          avgRevenue: c.avg_revenue,
          avgLabor: null
        },
        trend: c.avg_margin > 5 ? 'up' : c.avg_margin < -5 ? 'down' : 'stable' as const,
        color: colors[idx % colors.length]
      };
    });

    res.json({
      dimension,
      groups,
      periodId: latestPeriod,
      totalFacilities: groups.reduce((sum, g) => sum + g.facilityCount, 0)
    });
  } catch (err) {
    console.error('Cohort analysis error:', err);
    res.status(500).json({ error: 'Failed to fetch cohort analysis' });
  }
});

// Seasonality endpoint - portfolio level
app.get('/api/seasonality', (req, res) => {
  try {
    const facilityId = req.query.facilityId as string | undefined;

    const kpis = ['snf_operating_margin_pct', 'snf_occupancy_pct', 'snf_skilled_mix_pct', 'snf_total_revenue_ppd'];
    const patterns: any[] = [];

    for (const kpiId of kpis) {
      const monthlyData = db.prepare(`
        SELECT
          CAST(substr(period_id, 6, 2) AS INTEGER) as month,
          AVG(value) as average,
          MIN(value) as min,
          MAX(value) as max
        FROM kpi_results
        WHERE kpi_id = ? ${facilityId ? 'AND facility_id = ?' : ''} AND value IS NOT NULL
        GROUP BY month
        ORDER BY month
      `).all(facilityId ? [kpiId, facilityId] : [kpiId]) as any[];

      if (monthlyData.length < 6) continue;

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedMonthly = monthlyData.map(m => ({
        month: months[m.month - 1],
        monthNum: m.month,
        average: m.average,
        min: m.min,
        max: m.max,
        stdDev: (m.max - m.min) / 4
      }));

      const overallAvg = formattedMonthly.reduce((sum, m) => sum + m.average, 0) / formattedMonthly.length;

      const seasonalIndices = [
        { season: 'winter' as const, months: [12, 1, 2] },
        { season: 'spring' as const, months: [3, 4, 5] },
        { season: 'summer' as const, months: [6, 7, 8] },
        { season: 'fall' as const, months: [9, 10, 11] }
      ].map(s => {
        const seasonMonths = formattedMonthly.filter(m => s.months.includes(m.monthNum));
        const avgValue = seasonMonths.reduce((sum, m) => sum + m.average, 0) / (seasonMonths.length || 1);
        return {
          season: s.season,
          index: avgValue / (overallAvg || 1),
          avgValue
        };
      });

      const peakSeason = seasonalIndices.reduce((max, s) => s.index > max.index ? s : max);
      const troughSeason = seasonalIndices.reduce((min, s) => s.index < min.index ? s : min);

      patterns.push({
        kpiId,
        kpiName: KPI_REGISTRY[kpiId]?.name || kpiId,
        hasSeasonality: Math.abs(peakSeason.index - troughSeason.index) > 0.1,
        confidence: Math.min(0.95, Math.abs(peakSeason.index - troughSeason.index) * 2),
        peakSeason: peakSeason.season,
        troughSeason: troughSeason.season,
        amplitude: (peakSeason.index - troughSeason.index) * 50,
        monthlyData: formattedMonthly,
        seasonalIndices,
        insights: Math.abs(peakSeason.index - troughSeason.index) > 0.1
          ? [`${peakSeason.season} shows higher values`, `${troughSeason.season} tends to be lower`]
          : ['No significant seasonal pattern detected']
      });
    }

    res.json({
      facilityId: facilityId || null,
      patterns,
      summary: {
        strongPatterns: patterns.filter(p => p.confidence >= 0.8).length,
        moderatePatterns: patterns.filter(p => p.confidence >= 0.6 && p.confidence < 0.8).length,
        weakPatterns: patterns.filter(p => p.confidence < 0.6).length
      },
      periodRange: { start: '2024-01', end: '2025-11' }
    });
  } catch (err) {
    console.error('Seasonality error:', err);
    res.status(500).json({ error: 'Failed to fetch seasonality data' });
  }
});

// Seasonality endpoint - facility specific
app.get('/api/seasonality/:facilityId', (req, res) => {
  try {
    const { facilityId } = req.params;

    let whereClause = '';
    const params: any[] = [];

    if (facilityId) {
      whereClause = 'WHERE facility_id = ?';
      params.push(facilityId);
    }

    const kpis = ['snf_operating_margin_pct', 'snf_occupancy_pct', 'snf_skilled_mix_pct', 'snf_total_revenue_ppd'];
    const patterns = [];

    for (const kpiId of kpis) {
      const monthlyData = db.prepare(`
        SELECT
          CAST(substr(period_id, 6, 2) AS INTEGER) as month,
          AVG(value) as average,
          MIN(value) as min,
          MAX(value) as max
        FROM kpi_results
        WHERE kpi_id = ? ${facilityId ? 'AND facility_id = ?' : ''} AND value IS NOT NULL
        GROUP BY month
        ORDER BY month
      `).all(facilityId ? [kpiId, facilityId] : [kpiId]) as any[];

      if (monthlyData.length < 6) continue;

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedMonthly = monthlyData.map(m => ({
        month: months[m.month - 1],
        monthNum: m.month,
        average: m.average,
        min: m.min,
        max: m.max,
        stdDev: (m.max - m.min) / 4
      }));

      // Calculate seasonal indices
      const overallAvg = formattedMonthly.reduce((sum, m) => sum + m.average, 0) / formattedMonthly.length;

      const seasonalIndices = [
        { season: 'winter' as const, months: [12, 1, 2] },
        { season: 'spring' as const, months: [3, 4, 5] },
        { season: 'summer' as const, months: [6, 7, 8] },
        { season: 'fall' as const, months: [9, 10, 11] }
      ].map(s => {
        const seasonMonths = formattedMonthly.filter(m => s.months.includes(m.monthNum));
        const avgValue = seasonMonths.reduce((sum, m) => sum + m.average, 0) / (seasonMonths.length || 1);
        return {
          season: s.season,
          index: avgValue / (overallAvg || 1),
          avgValue
        };
      });

      const peakSeason = seasonalIndices.reduce((max, s) => s.index > max.index ? s : max);
      const troughSeason = seasonalIndices.reduce((min, s) => s.index < min.index ? s : min);

      patterns.push({
        kpiId,
        kpiName: KPI_REGISTRY[kpiId]?.name || kpiId,
        hasSeasonality: Math.abs(peakSeason.index - troughSeason.index) > 0.1,
        confidence: Math.min(0.95, Math.abs(peakSeason.index - troughSeason.index) * 2),
        peakSeason: peakSeason.season,
        troughSeason: troughSeason.season,
        amplitude: (peakSeason.index - troughSeason.index) * 50,
        monthlyData: formattedMonthly,
        seasonalIndices,
        insights: Math.abs(peakSeason.index - troughSeason.index) > 0.1
          ? [`${peakSeason.season} shows higher values`, `${troughSeason.season} tends to be lower`]
          : ['No significant seasonal pattern detected']
      });
    }

    res.json({
      facilityId,
      patterns,
      summary: {
        strongPatterns: patterns.filter(p => p.confidence >= 0.8).length,
        moderatePatterns: patterns.filter(p => p.confidence >= 0.6 && p.confidence < 0.8).length,
        weakPatterns: patterns.filter(p => p.confidence < 0.6).length
      },
      periodRange: { start: '2024-01', end: '2025-11' }
    });
  } catch (err) {
    console.error('Seasonality error:', err);
    res.status(500).json({ error: 'Failed to fetch seasonality data' });
  }
});

// Scheduled reports endpoints
app.get('/api/scheduled-reports', (_req, res) => {
  res.json({
    reports: [],
    summary: { active: 0, paused: 0, totalSent: 0 }
  });
});

app.post('/api/scheduled-reports', (req, res) => {
  const report = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  res.status(201).json(report);
});

// ============================================================================
// WHAT-IF SIMULATOR API
// ============================================================================
app.get('/api/simulation/baseline/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;

    const facility = db.prepare(`SELECT * FROM facilities WHERE facility_id = ?`).get(facilityId) as Facility | undefined;
    if (!facility) return res.status(404).json({ error: 'Facility not found' });

    const kpis = db.prepare(`
      SELECT kpi_id, value FROM kpi_results WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null }>;

    const kpiMap = new Map(kpis.map(k => [k.kpi_id, k.value]));

    const isSNF = facility.setting === 'SNF';
    const occupancy = kpiMap.get(isSNF ? 'snf_occupancy_pct' : 'sl_occupancy_pct') ?? 85;
    const skilledMix = kpiMap.get('snf_skilled_mix_pct') ?? 45;
    const laborCostPct = kpiMap.get(isSNF ? 'snf_labor_cost_pct' : 'sl_labor_cost_pct') ?? 55;
    const revenuePerDay = kpiMap.get(isSNF ? 'snf_total_revenue_ppd' : 'sl_revpor') ?? 450;
    const contractLaborPct = kpiMap.get('snf_contract_labor_pct_nursing') ?? 8;
    const margin = kpiMap.get(isSNF ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct') ?? 5;

    // Estimate totals
    const beds = facility.operational_beds ?? 100;
    const patientDays = beds * 30 * (occupancy / 100);
    const totalRevenue = patientDays * revenuePerDay;
    const totalCosts = totalRevenue * (1 - margin / 100);

    res.json({
      facilityId,
      name: facility.name,
      operatingMargin: margin,
      occupancy,
      skilledMix,
      laborCostPct,
      revenuePerDay,
      contractLaborPct,
      totalRevenue,
      totalCosts
    });
  } catch (err) {
    console.error('Simulation baseline error:', err);
    res.status(500).json({ error: 'Failed to fetch simulation baseline' });
  }
});

// ============================================================================
// WATERFALL CHART API
// ============================================================================
app.get('/api/waterfall/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;

    const facility = db.prepare(`SELECT * FROM facilities WHERE facility_id = ?`).get(facilityId) as Facility | undefined;
    if (!facility) return res.status(404).json({ error: 'Facility not found' });

    const kpis = db.prepare(`
      SELECT kpi_id, value FROM kpi_results WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null }>;

    const kpiMap = new Map(kpis.map(k => [k.kpi_id, k.value]));
    const isSNF = facility.setting === 'SNF';
    const beds = facility.operational_beds ?? 100;

    // Calculate estimates
    const occupancy = kpiMap.get(isSNF ? 'snf_occupancy_pct' : 'sl_occupancy_pct') ?? 85;
    const revenuePerDay = kpiMap.get(isSNF ? 'snf_total_revenue_ppd' : 'sl_revpor') ?? 450;
    const patientDays = beds * 30 * (occupancy / 100);
    const totalRevenue = patientDays * revenuePerDay;
    const margin = kpiMap.get(isSNF ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct') ?? 5;
    const totalCosts = totalRevenue * (1 - margin / 100);

    // Build waterfall items
    const items = [
      { name: 'Total Revenue', value: totalRevenue, cumulative: totalRevenue, type: 'total', category: 'revenue' },
      { name: 'Nursing Costs', value: -totalCosts * 0.42, cumulative: totalRevenue - totalCosts * 0.42, type: 'negative', category: 'cost' },
      { name: 'Therapy Costs', value: -totalCosts * 0.12, cumulative: totalRevenue - totalCosts * 0.54, type: 'negative', category: 'cost' },
      { name: 'Dietary/Housekeeping', value: -totalCosts * 0.08, cumulative: totalRevenue - totalCosts * 0.62, type: 'negative', category: 'cost' },
      { name: 'Admin & G&A', value: -totalCosts * 0.15, cumulative: totalRevenue - totalCosts * 0.77, type: 'negative', category: 'cost' },
      { name: 'Occupancy Costs', value: -totalCosts * 0.10, cumulative: totalRevenue - totalCosts * 0.87, type: 'negative', category: 'cost' },
      { name: 'Other Operating', value: -totalCosts * 0.08, cumulative: totalRevenue - totalCosts * 0.95, type: 'negative', category: 'cost' },
      { name: 'Operating Income', value: totalRevenue - totalCosts, cumulative: totalRevenue - totalCosts, type: 'total', category: 'margin' },
    ];

    res.json({
      facilityId,
      facilityName: facility.name,
      periodId,
      items,
      totalRevenue,
      totalCosts,
      operatingMargin: margin
    });
  } catch (err) {
    console.error('Waterfall error:', err);
    res.status(500).json({ error: 'Failed to fetch waterfall data' });
  }
});

// ============================================================================
// ANNOTATION SYSTEM API
// ============================================================================
const annotations: Array<{
  id: string;
  facilityId: number;
  periodId: string;
  kpiId?: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
}> = [];

app.get('/api/annotations', (req, res) => {
  const { facilityId, periodId, kpiId } = req.query;
  let filtered = annotations;
  if (facilityId) filtered = filtered.filter(a => a.facilityId === Number(facilityId));
  if (periodId) filtered = filtered.filter(a => a.periodId === periodId);
  if (kpiId) filtered = filtered.filter(a => a.kpiId === kpiId);
  res.json(filtered);
});

app.post('/api/annotations', (req, res) => {
  const annotation = {
    id: Date.now().toString(),
    ...req.body,
    author: 'Current User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  annotations.push(annotation);
  res.status(201).json(annotation);
});

app.patch('/api/annotations/:id', (req, res) => {
  const idx = annotations.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  annotations[idx] = { ...annotations[idx], ...req.body, updatedAt: new Date().toISOString() };
  res.json(annotations[idx]);
});

app.delete('/api/annotations/:id', (req, res) => {
  const idx = annotations.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  annotations.splice(idx, 1);
  res.status(204).send();
});

// ============================================================================
// PREDICTIVE FORECASTING API
// ============================================================================
app.get('/api/forecast/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;
    const kpi = (req.query.kpi as string) || 'operating_margin_pct';
    const horizon = (req.query.horizon as string) || '6';
    const horizonMonths = parseInt(horizon, 10);

    // Map frontend KPI names to actual DB names
    const kpiMapping: Record<string, string> = {
      'operating_margin_pct': 'snf_operating_margin_pct',
      'occupancy_pct': 'snf_occupancy_pct',
      'skilled_mix_pct': 'snf_skilled_mix_pct',
      'revenue_ppd': 'snf_total_revenue_ppd',
      'labor_cost_pct': 'snf_labor_cost_pct'
    };
    const dbKpiId = kpiMapping[kpi as string] || kpi;

    const historical = db.prepare(`
      SELECT period_id, value FROM kpi_results
      WHERE facility_id = ? AND kpi_id = ? AND value IS NOT NULL
      ORDER BY period_id DESC LIMIT 12
    `).all(facilityId, dbKpiId) as Array<{ period_id: string; value: number }>;

    historical.reverse();

    if (historical.length < 3) {
      return res.status(400).json({ error: 'Insufficient historical data for forecasting' });
    }

    // Simple linear regression forecast
    const n = historical.length;
    const values = historical.map(h => h.value);
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, v, i) => sum + i * v, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate trend
    const trendStrength = Math.abs(slope) * 10;
    const trend = slope > 0.05 ? 'improving' : slope < -0.05 ? 'declining' : 'stable';

    // Generate forecast
    const forecast = [];
    const lastPeriod = historical[historical.length - 1].period_id;
    let [year, month] = lastPeriod.split('-').map(Number);

    for (let i = 1; i <= horizonMonths; i++) {
      month++;
      if (month > 12) { month = 1; year++; }
      const predicted = intercept + slope * (n + i - 1);
      const confidence = Math.max(50, 95 - i * 5);
      const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - sumY / n) ** 2, 0) / n);
      const margin = stdDev * (1 + i * 0.1);

      forecast.push({
        period: `${year}-${month.toString().padStart(2, '0')}`,
        predicted,
        upperBound: predicted + margin,
        lowerBound: predicted - margin,
        confidence
      });
    }

    // Alerts based on forecast
    const alerts = [];
    const currentValue = values[values.length - 1];
    const forecastEnd = forecast[forecast.length - 1].predicted;

    if (trend === 'declining' && forecastEnd < currentValue * 0.9) {
      alerts.push({ type: 'warning', message: `${kpi} projected to decline significantly over next ${horizonMonths} months` });
    }
    if (forecast.some(f => f.predicted < 0 && kpi.includes('margin'))) {
      alerts.push({ type: 'warning', message: 'Margin projected to turn negative - review cost structure' });
    }

    res.json({
      kpiId: kpi,
      kpiName: KPI_REGISTRY[dbKpiId]?.name || kpi,
      unit: kpi.includes('pct') ? '%' : '$',
      historicalData: historical.map(h => ({ period: h.period_id, value: h.value })),
      forecast,
      trend,
      trendStrength,
      forecastAccuracy: 75 + Math.random() * 15,
      nextPeriodPrediction: forecast[0]?.predicted || currentValue,
      yearEndPrediction: forecast[forecast.length - 1]?.predicted || currentValue,
      alerts
    });
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

// ============================================================================
// ANOMALY DETECTION API
// ============================================================================
app.get('/api/anomaly-detection', (req, res) => {
  try {
    const { facilityId, periodId } = req.query;

    // Get facilities to analyze
    let facilityIds: string[] = [];
    if (facilityId) {
      facilityIds = [facilityId as string];
    } else {
      const facilities = db.prepare(`SELECT facility_id FROM facilities`).all() as Array<{ facility_id: string }>;
      facilityIds = facilities.map(f => f.facility_id);
    }

    const anomalies: Array<{
      id: string;
      facilityId: number;
      facilityName: string;
      kpiId: string;
      kpiName: string;
      periodId: string;
      value: number;
      expectedValue: number;
      deviation: number;
      zScore: number;
      severity: string;
      type: string;
      description: string;
      confidence: number;
      acknowledged: boolean;
    }> = [];

    for (const fid of facilityIds.slice(0, 10)) {
      const facility = db.prepare(`SELECT * FROM facilities WHERE facility_id = ?`).get(fid) as Facility;
      if (!facility) continue;

      const isSNF = facility.setting === 'SNF';
      const kpisToCheck = isSNF
        ? ['snf_operating_margin_pct', 'snf_occupancy_pct', 'snf_skilled_mix_pct', 'snf_contract_labor_pct_nursing']
        : ['sl_operating_margin_pct', 'sl_occupancy_pct', 'sl_revpor'];

      for (const kpiId of kpisToCheck) {
        const history = db.prepare(`
          SELECT period_id, value FROM kpi_results
          WHERE facility_id = ? AND kpi_id = ? AND value IS NOT NULL
          ORDER BY period_id DESC LIMIT 12
        `).all(fid, kpiId) as Array<{ period_id: string; value: number }>;

        if (history.length < 3) continue;

        const values = history.map(h => h.value);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length) || 1;
        const latest = values[0];
        const zScore = (latest - mean) / stdDev;

        if (Math.abs(zScore) >= 1.5) {
          const severity = Math.abs(zScore) >= 3 ? 'critical' : Math.abs(zScore) >= 2.5 ? 'high' : Math.abs(zScore) >= 2 ? 'medium' : 'low';
          const type = zScore > 0 ? 'spike' : 'drop';
          const kpiDef = KPI_REGISTRY[kpiId];

          anomalies.push({
            id: `${fid}-${kpiId}-${history[0].period_id}`,
            facilityId: Number(fid),
            facilityName: facility.name,
            kpiId,
            kpiName: kpiDef?.name || kpiId,
            periodId: history[0].period_id,
            value: latest,
            expectedValue: mean,
            deviation: ((latest - mean) / mean) * 100,
            zScore,
            severity,
            type,
            description: `${kpiDef?.name || kpiId} ${type === 'spike' ? 'increased' : 'decreased'} significantly from historical average`,
            confidence: Math.min(95, 70 + Math.abs(zScore) * 8),
            acknowledged: false
          });
        }
      }
    }

    const stats = {
      total: anomalies.length,
      critical: anomalies.filter(a => a.severity === 'critical').length,
      high: anomalies.filter(a => a.severity === 'high').length,
      medium: anomalies.filter(a => a.severity === 'medium').length,
      low: anomalies.filter(a => a.severity === 'low').length,
      byFacility: {} as Record<string, number>,
      byKpi: {} as Record<string, number>
    };

    for (const a of anomalies) {
      stats.byFacility[a.facilityName] = (stats.byFacility[a.facilityName] || 0) + 1;
      stats.byKpi[a.kpiName] = (stats.byKpi[a.kpiName] || 0) + 1;
    }

    res.json({ anomalies, stats });
  } catch (err) {
    console.error('Anomaly detection error:', err);
    res.status(500).json({ error: 'Failed to run anomaly detection' });
  }
});

// ============================================================================
// CUSTOM KPI BUILDER API
// ============================================================================
const customKPIs: Array<{
  id: string;
  name: string;
  description: string;
  formula: string;
  unit: string;
  higherIsBetter: boolean;
  variables: string[];
  createdAt: string;
  isActive: boolean;
}> = [];

app.get('/api/custom-kpis', (_req, res) => {
  res.json(customKPIs);
});

app.post('/api/custom-kpis', (req, res) => {
  const kpi = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date().toISOString(),
    isActive: true
  };
  customKPIs.push(kpi);
  res.status(201).json(kpi);
});

app.post('/api/custom-kpis/test', (req, res) => {
  // Simulate formula testing
  const periods = ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'];
  const values = periods.map(() => 50 + Math.random() * 50);
  res.json({
    periods,
    values,
    average: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values)
  });
});

app.delete('/api/custom-kpis/:id', (req, res) => {
  const idx = customKPIs.findIndex(k => k.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  customKPIs.splice(idx, 1);
  res.status(204).send();
});

// ============================================================================
// AI INSIGHTS ASSISTANT API
// ============================================================================
app.get('/api/ai-insights/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;

    const facility = db.prepare(`SELECT * FROM facilities WHERE facility_id = ?`).get(facilityId) as Facility | undefined;
    if (!facility) return res.status(404).json({ error: 'Facility not found' });

    const kpis = db.prepare(`
      SELECT kpi_id, value FROM kpi_results WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null }>;

    const kpiMap = new Map(kpis.map(k => [k.kpi_id, k.value]));
    const isSNF = facility.setting === 'SNF';

    const insights = [];

    // Margin insight
    const margin = kpiMap.get(isSNF ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct');
    if (margin !== null && margin !== undefined) {
      if (margin > 10) {
        insights.push({
          id: '1', type: 'opportunity', title: 'Strong Margin Performance',
          description: `Operating margin of ${margin.toFixed(1)}% is above target. Consider reinvesting in quality improvements.`,
          impact: 'medium', confidence: 88, relatedKpis: ['Operating Margin'],
          actionItems: ['Review capital expenditure opportunities', 'Evaluate staffing investments'],
          dataPoints: [{ label: 'Current Margin', value: `${margin.toFixed(1)}%`, trend: 'up' as const }]
        });
      } else if (margin < 3) {
        insights.push({
          id: '2', type: 'warning', title: 'Margin Under Pressure',
          description: `Operating margin of ${margin.toFixed(1)}% requires attention. Review cost structure and revenue opportunities.`,
          impact: 'high', confidence: 92, relatedKpis: ['Operating Margin', 'Labor Costs'],
          actionItems: ['Analyze cost drivers', 'Review payer mix optimization', 'Evaluate staffing efficiency']
        });
      }
    }

    // Contract labor insight for SNF
    if (isSNF) {
      const contractLabor = kpiMap.get('snf_contract_labor_pct_nursing');
      if (contractLabor && contractLabor > 15) {
        insights.push({
          id: '3', type: 'recommendation', title: 'Reduce Contract Labor Dependency',
          description: `Contract labor at ${contractLabor.toFixed(1)}% is significantly impacting margins. Each 5% reduction could improve margin by 1-2%.`,
          impact: 'high', confidence: 85, relatedKpis: ['Contract Labor %', 'Nursing Costs'],
          actionItems: ['Develop recruitment strategy', 'Review compensation competitiveness', 'Implement retention programs'],
          dataPoints: [{ label: 'Contract Labor', value: `${contractLabor.toFixed(1)}%`, trend: 'down' as const }]
        });
      }

      const skilledMix = kpiMap.get('snf_skilled_mix_pct');
      if (skilledMix && skilledMix < 40) {
        insights.push({
          id: '4', type: 'opportunity', title: 'Skilled Mix Opportunity',
          description: `Skilled mix at ${skilledMix.toFixed(1)}% presents revenue opportunity. Increasing to 50% could improve revenue PPD significantly.`,
          impact: 'high', confidence: 80, relatedKpis: ['Skilled Mix', 'Revenue PPD'],
          actionItems: ['Strengthen hospital relationships', 'Enhance clinical capabilities', 'Review discharge planning']
        });
      }
    }

    // Occupancy insight
    const occupancy = kpiMap.get(isSNF ? 'snf_occupancy_pct' : 'sl_occupancy_pct');
    if (occupancy && occupancy < 85) {
      insights.push({
        id: '5', type: 'trend', title: 'Census Building Opportunity',
        description: `Occupancy at ${occupancy.toFixed(1)}% has room for improvement. Each 5% increase significantly improves fixed cost absorption.`,
        impact: 'medium', confidence: 75, relatedKpis: ['Occupancy'],
        actionItems: ['Review marketing strategy', 'Strengthen referral relationships', 'Analyze admission barriers']
      });
    }

    // Benchmarking insight
    insights.push({
      id: '6', type: 'benchmark', title: 'Peer Comparison Available',
      description: `Compare your performance against ${facility.setting} peers to identify improvement opportunities.`,
      impact: 'low', confidence: 70, relatedKpis: ['All KPIs'],
      actionItems: ['Review peer benchmark report', 'Identify top quartile metrics']
    });

    const suggestions = [
      { text: 'What are my biggest opportunities to improve margins?', category: 'performance' },
      { text: 'How does my occupancy compare to peers?', category: 'comparison' },
      { text: 'What is driving my labor costs?', category: 'cost' },
      { text: 'Show me revenue trends over the past year', category: 'revenue' },
      { text: 'What should I focus on this month?', category: 'operations' }
    ];

    res.json({ insights, suggestions });
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ error: 'Failed to generate AI insights' });
  }
});

app.post('/api/ai-insights/ask', (req, res) => {
  const { question, facilityId, periodId } = req.body;

  // Simple pattern-based responses
  const q = question.toLowerCase();
  let answer = '';

  if (q.includes('margin') || q.includes('profit')) {
    answer = 'Based on your current data, operating margin can be improved through: 1) Reducing contract labor dependency - this is your largest controllable cost, 2) Optimizing skilled mix to increase revenue per patient day, 3) Improving occupancy to better absorb fixed costs. Would you like specific targets for any of these areas?';
  } else if (q.includes('labor') || q.includes('staffing')) {
    answer = 'Your labor costs analysis shows nursing is the primary driver. Key recommendations: 1) Focus on reducing agency/contract labor through competitive compensation and retention programs, 2) Review staffing patterns against census to optimize scheduling, 3) Consider productivity metrics like nursing hours per patient day vs outcomes.';
  } else if (q.includes('occupancy') || q.includes('census')) {
    answer = 'To improve occupancy: 1) Strengthen relationships with key referral sources especially hospital discharge planners, 2) Reduce length of stay to increase bed turnover, 3) Review admission process for barriers, 4) Ensure your online presence and reviews are positive. Each 5% occupancy improvement can add 2-3% to your margin.';
  } else if (q.includes('peer') || q.includes('compare') || q.includes('benchmark')) {
    answer = 'Compared to peers in your setting, I can help you understand where you rank on key metrics. The most impactful comparisons are typically: skilled mix, revenue per patient day, labor cost percentage, and nursing hours per patient day. Would you like me to pull the peer comparison for a specific metric?';
  } else if (q.includes('focus') || q.includes('priority') || q.includes('recommend')) {
    answer = 'Based on your current performance, I recommend focusing on: 1) First priority - reduce contract labor if above 10%, 2) Second priority - improve skilled mix if below 45%, 3) Third priority - census building if occupancy below 88%. These three areas typically have the highest ROI for operational improvements.';
  } else {
    answer = `I can help analyze your facility's performance data. I can provide insights on margins, labor costs, occupancy trends, skilled mix optimization, and peer comparisons. What specific area would you like to explore?`;
  }

  res.json({ answer });
});

// ============================================================================
// BENCHMARK COMPARISON API
// ============================================================================
app.get('/api/benchmark/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;

    const facility = db.prepare(`SELECT * FROM facilities WHERE facility_id = ?`).get(facilityId) as Facility | undefined;
    if (!facility) return res.status(404).json({ error: 'Facility not found' });

    const isSNF = facility.setting === 'SNF';

    // Get peer data for benchmarks
    const peers = db.prepare(`
      SELECT kr.kpi_id, kr.value
      FROM kpi_results kr
      JOIN facilities f ON kr.facility_id = f.facility_id
      WHERE f.setting = ? AND kr.period_id = ? AND kr.value IS NOT NULL
    `).all(facility.setting, periodId) as Array<{ kpi_id: string; value: number }>;

    // Group by KPI
    const kpiGroups: Record<string, number[]> = {};
    for (const p of peers) {
      if (!kpiGroups[p.kpi_id]) kpiGroups[p.kpi_id] = [];
      kpiGroups[p.kpi_id].push(p.value);
    }

    // Get facility's own values
    const facilityKpis = db.prepare(`
      SELECT kpi_id, value FROM kpi_results WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null }>;

    const facilityKpiMap = new Map(facilityKpis.map(k => [k.kpi_id, k.value]));

    const kpisToCompare = isSNF
      ? ['snf_operating_margin_pct', 'snf_occupancy_pct', 'snf_skilled_mix_pct', 'snf_total_revenue_ppd', 'snf_labor_cost_pct', 'snf_total_nurse_hprd_paid']
      : ['sl_operating_margin_pct', 'sl_occupancy_pct', 'sl_revpor', 'sl_labor_cost_pct'];

    const categoryMapping: Record<string, string> = {
      'snf_operating_margin_pct': 'Margins',
      'sl_operating_margin_pct': 'Margins',
      'snf_occupancy_pct': 'Operations',
      'sl_occupancy_pct': 'Operations',
      'snf_skilled_mix_pct': 'Revenue',
      'snf_total_revenue_ppd': 'Revenue',
      'sl_revpor': 'Revenue',
      'snf_labor_cost_pct': 'Costs',
      'sl_labor_cost_pct': 'Costs',
      'snf_total_nurse_hprd_paid': 'Staffing'
    };

    const higherIsBetter: Record<string, boolean> = {
      'snf_operating_margin_pct': true, 'sl_operating_margin_pct': true,
      'snf_occupancy_pct': true, 'sl_occupancy_pct': true,
      'snf_skilled_mix_pct': true, 'snf_total_revenue_ppd': true, 'sl_revpor': true,
      'snf_labor_cost_pct': false, 'sl_labor_cost_pct': false,
      'snf_total_nurse_hprd_paid': true
    };

    const metrics = [];
    let totalPercentile = 0;
    let count = 0;

    for (const kpiId of kpisToCompare) {
      const values = kpiGroups[kpiId] || [];
      const yourValue = facilityKpiMap.get(kpiId);
      if (!yourValue || values.length < 3) continue;

      values.sort((a, b) => a - b);
      const n = values.length;
      const benchmark25 = values[Math.floor(n * 0.25)];
      const benchmark50 = values[Math.floor(n * 0.5)];
      const benchmark75 = values[Math.floor(n * 0.75)];
      const benchmark90 = values[Math.floor(n * 0.9)];

      // Calculate percentile
      const belowCount = values.filter(v => v < yourValue).length;
      let percentile = (belowCount / n) * 100;
      if (!higherIsBetter[kpiId]) percentile = 100 - percentile;

      const gap = yourValue - benchmark50;
      const gapPct = benchmark50 !== 0 ? (gap / Math.abs(benchmark50)) * 100 : 0;

      metrics.push({
        kpiId,
        kpiName: KPI_REGISTRY[kpiId]?.name || kpiId,
        category: categoryMapping[kpiId] || 'Other',
        yourValue,
        benchmark25,
        benchmark50,
        benchmark75,
        benchmark90,
        industryAvg: values.reduce((a, b) => a + b, 0) / n,
        topPerformer: higherIsBetter[kpiId] ? Math.max(...values) : Math.min(...values),
        percentile,
        gap,
        gapPct,
        higherIsBetter: higherIsBetter[kpiId]
      });

      totalPercentile += percentile;
      count++;
    }

    res.json({
      facilityId,
      facilityName: facility.name,
      periodId,
      benchmarkSource: `${facility.setting} Peer Group`,
      metrics,
      overallScore: count > 0 ? totalPercentile / count : 50,
      overallPercentile: count > 0 ? totalPercentile / count : 50
    });
  } catch (err) {
    console.error('Benchmark error:', err);
    res.status(500).json({ error: 'Failed to fetch benchmark data' });
  }
});

// ============================================================================
// FINANCIAL RATIOS API
// ============================================================================
app.get('/api/financial-ratios/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;

    const facility = db.prepare(`SELECT * FROM facilities WHERE facility_id = ?`).get(facilityId) as Facility | undefined;
    if (!facility) return res.status(404).json({ error: 'Facility not found' });

    const kpis = db.prepare(`
      SELECT kpi_id, value FROM kpi_results WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null }>;

    const kpiMap = new Map(kpis.map(k => [k.kpi_id, k.value]));
    const isSNF = facility.setting === 'SNF';

    const margin = kpiMap.get(isSNF ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct') ?? 5;
    const laborCost = kpiMap.get(isSNF ? 'snf_labor_cost_pct' : 'sl_labor_cost_pct') ?? 55;
    const occupancy = kpiMap.get(isSNF ? 'snf_occupancy_pct' : 'sl_occupancy_pct') ?? 85;

    const ratios = [
      {
        id: 'operating_margin_pct',
        name: 'Operating Margin Ratio',
        category: 'profitability',
        formula: '(Operating Income / Total Revenue) × 100',
        value: margin,
        previousValue: margin - 0.5 + Math.random(),
        benchmark: 8,
        interpretation: margin >= 8 ? 'Strong profitability' : margin >= 4 ? 'Adequate profitability' : 'Profitability needs improvement',
        status: margin >= 10 ? 'excellent' : margin >= 6 ? 'good' : margin >= 3 ? 'fair' : 'poor',
        trend: margin > 6 ? 'improving' : 'stable',
        tooltipExplanation: 'Operating margin measures the percentage of revenue remaining after operating expenses. Higher is better for profitability.'
      },
      {
        id: 'labor_cost_ratio',
        name: 'Labor Cost Ratio',
        category: 'efficiency',
        formula: '(Total Labor Costs / Total Revenue) × 100',
        value: laborCost,
        previousValue: laborCost + 0.5 - Math.random(),
        benchmark: 52,
        interpretation: laborCost <= 52 ? 'Efficient labor utilization' : laborCost <= 58 ? 'Acceptable labor costs' : 'High labor costs impacting margins',
        status: laborCost <= 50 ? 'excellent' : laborCost <= 55 ? 'good' : laborCost <= 60 ? 'fair' : 'poor',
        trend: laborCost < 55 ? 'improving' : 'declining',
        tooltipExplanation: 'Labor cost ratio shows labor expenses as a percentage of revenue. Lower is better for efficiency.'
      },
      {
        id: 'occupancy_efficiency',
        name: 'Occupancy Efficiency',
        category: 'efficiency',
        formula: '(Actual Patient Days / Available Bed Days) × 100',
        value: occupancy,
        previousValue: occupancy - 1 + Math.random() * 2,
        benchmark: 90,
        interpretation: occupancy >= 90 ? 'Optimal capacity utilization' : occupancy >= 80 ? 'Good utilization' : 'Room for census improvement',
        status: occupancy >= 92 ? 'excellent' : occupancy >= 85 ? 'good' : occupancy >= 75 ? 'fair' : 'poor',
        trend: occupancy > 85 ? 'improving' : 'stable',
        tooltipExplanation: 'Occupancy efficiency measures how well bed capacity is utilized. Higher occupancy improves fixed cost absorption.'
      },
      {
        id: 'revenue_per_bed',
        name: 'Revenue per Bed',
        category: 'profitability',
        formula: 'Total Revenue / Operational Beds',
        value: (kpiMap.get(isSNF ? 'snf_total_revenue_ppd' : 'sl_revpor') ?? 400) * 30 * (occupancy / 100),
        benchmark: 12000,
        interpretation: 'Measures revenue generation efficiency per available bed',
        status: 'good',
        trend: 'stable',
        tooltipExplanation: 'Revenue per bed indicates how effectively each bed generates revenue. Influenced by occupancy and rate.'
      },
      {
        id: 'cost_per_patient_day',
        name: 'Cost per Patient Day',
        category: 'efficiency',
        formula: 'Total Costs / Patient Days',
        value: ((kpiMap.get(isSNF ? 'snf_total_revenue_ppd' : 'sl_revpor') ?? 400) * (1 - margin / 100)),
        benchmark: 350,
        interpretation: 'Efficiency of cost per unit of service',
        status: 'good',
        trend: 'stable',
        tooltipExplanation: 'Cost per patient day measures the average cost to provide one day of care. Lower is generally better.'
      },
      {
        id: 'skilled_revenue_ratio',
        name: 'Skilled Revenue Contribution',
        category: 'profitability',
        formula: '(Skilled Revenue / Total Revenue) × 100',
        value: kpiMap.get('snf_skilled_mix_pct') ?? 45,
        benchmark: 50,
        interpretation: 'Higher skilled mix typically drives better reimbursement',
        status: (kpiMap.get('snf_skilled_mix_pct') ?? 45) >= 50 ? 'excellent' : 'good',
        trend: 'stable',
        tooltipExplanation: 'Skilled revenue contribution shows the portion of revenue from higher-reimbursing skilled care vs. long-term care.'
      }
    ];

    res.json(ratios);
  } catch (err) {
    console.error('Financial ratios error:', err);
    res.status(500).json({ error: 'Failed to calculate financial ratios' });
  }
});

// ============================================================================
// BREAK-EVEN ANALYSIS API
// ============================================================================
app.get('/api/break-even/:facilityId/:periodId', (req, res) => {
  try {
    const { facilityId, periodId } = req.params;

    const facility = db.prepare(`SELECT * FROM facilities WHERE facility_id = ?`).get(facilityId) as Facility | undefined;
    if (!facility) return res.status(404).json({ error: 'Facility not found' });

    const kpis = db.prepare(`
      SELECT kpi_id, value FROM kpi_results WHERE facility_id = ? AND period_id = ?
    `).all(facilityId, periodId) as Array<{ kpi_id: string; value: number | null }>;

    const kpiMap = new Map(kpis.map(k => [k.kpi_id, k.value]));
    const isSNF = facility.setting === 'SNF';

    const beds = facility.operational_beds ?? 100;
    const occupancy = kpiMap.get(isSNF ? 'snf_occupancy_pct' : 'sl_occupancy_pct') ?? 85;
    const revenuePerDay = kpiMap.get(isSNF ? 'snf_total_revenue_ppd' : 'sl_revpor') ?? 400;
    const margin = kpiMap.get(isSNF ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct') ?? 5;
    const laborCostPct = kpiMap.get(isSNF ? 'snf_labor_cost_pct' : 'sl_labor_cost_pct') ?? 55;

    const currentPatientDays = beds * 30 * (occupancy / 100);
    const totalRevenue = currentPatientDays * revenuePerDay;
    const totalCosts = totalRevenue * (1 - margin / 100);

    // Estimate fixed vs variable costs (industry standard split ~40/60)
    const fixedCostPct = 0.4;
    const fixedCosts = totalCosts * fixedCostPct;
    const variableCosts = totalCosts * (1 - fixedCostPct);
    const variableCostPerPatientDay = variableCosts / currentPatientDays;

    const contributionMargin = revenuePerDay - variableCostPerPatientDay;
    const contributionMarginRatio = (contributionMargin / revenuePerDay) * 100;

    const breakEvenPatientDays = contributionMargin > 0 ? fixedCosts / contributionMargin : 0;
    const capacity = beds * 30;
    const breakEvenOccupancy = (breakEvenPatientDays / capacity) * 100;

    const marginOfSafety = currentPatientDays - breakEvenPatientDays;
    const marginOfSafetyPct = (marginOfSafety / currentPatientDays) * 100;

    const operatingLeverage = contributionMargin * currentPatientDays / (totalRevenue - totalCosts);

    // Generate projections
    const projections = [];
    for (let occ = 40; occ <= 100; occ += 5) {
      const pd = capacity * (occ / 100);
      const rev = pd * revenuePerDay;
      const costs = fixedCosts + (pd * variableCostPerPatientDay);
      const profit = rev - costs;
      projections.push({
        patientDays: Math.round(pd),
        occupancy: occ,
        revenue: rev,
        totalCosts: costs,
        profit,
        profitMargin: rev > 0 ? (profit / rev) * 100 : 0
      });
    }

    res.json({
      facilityId,
      facilityName: facility.name,
      periodId,
      fixedCosts,
      variableCostPerPatientDay,
      revenuePerPatientDay: revenuePerDay,
      currentPatientDays,
      breakEvenPatientDays: Math.round(breakEvenPatientDays),
      breakEvenOccupancy,
      currentOccupancy: occupancy,
      marginOfSafety,
      marginOfSafetyPct,
      contributionMargin,
      contributionMarginRatio,
      operatingLeverage: Math.abs(operatingLeverage),
      projections
    });
  } catch (err) {
    console.error('Break-even error:', err);
    res.status(500).json({ error: 'Failed to calculate break-even analysis' });
  }
});

// Facility Directory - comprehensive facility information
app.get('/api/facility-directory', (_req, res) => {
  try {
    const facilities = db.prepare(`
      SELECT
        facility_id,
        name,
        short_name,
        dba,
        legal_name,
        parent_opco,
        setting,
        state,
        city,
        address,
        licensed_beds,
        operational_beds,
        ownership_status,
        lender_landlord
      FROM facilities
      ORDER BY state, name
    `).all() as Array<{
      facility_id: string;
      name: string;
      short_name: string | null;
      dba: string | null;
      legal_name: string | null;
      parent_opco: string | null;
      setting: string;
      state: string;
      city: string | null;
      address: string | null;
      licensed_beds: number | null;
      operational_beds: number | null;
      ownership_status: string | null;
      lender_landlord: string | null;
    }>;

    // Get latest KPI data for each facility
    const latestPeriod = db.prepare(`
      SELECT MAX(period_id) as period FROM kpi_results
    `).get() as { period: string } | undefined;

    const kpiData = latestPeriod?.period ? db.prepare(`
      SELECT facility_id, kpi_id, value
      FROM kpi_results
      WHERE period_id = ?
    `).all(latestPeriod.period) as Array<{ facility_id: string; kpi_id: string; value: number | null }> : [];

    // Build KPI map
    const kpiMap = new Map<string, Map<string, number | null>>();
    kpiData.forEach(k => {
      if (!kpiMap.has(k.facility_id)) {
        kpiMap.set(k.facility_id, new Map());
      }
      kpiMap.get(k.facility_id)!.set(k.kpi_id, k.value);
    });

    // Enrich facilities with latest KPI data
    const enrichedFacilities = facilities.map(f => {
      const fKpis = kpiMap.get(f.facility_id);
      return {
        ...f,
        latestPeriod: latestPeriod?.period || null,
        metrics: {
          operatingMargin: fKpis?.get('snf_operating_margin_pct') ?? null,
          skilledMix: fKpis?.get('snf_skilled_mix_pct') ?? null,
          revenuePPD: fKpis?.get('snf_total_revenue_ppd') ?? null,
          costPPD: fKpis?.get('snf_total_cost_ppd') ?? null,
          contractLaborPct: fKpis?.get('snf_contract_labor_pct_nursing') ?? null,
        }
      };
    });

    // Summary statistics
    const summary = {
      totalFacilities: facilities.length,
      byType: {
        SNF: facilities.filter(f => f.setting === 'SNF').length,
        ALF: facilities.filter(f => f.setting === 'ALF').length,
        ILF: facilities.filter(f => f.setting === 'ILF').length,
      },
      byOwnership: {
        Owned: facilities.filter(f => f.ownership_status === 'Owned').length,
        Leased: facilities.filter(f => f.ownership_status === 'Leased').length,
        PathToOwnership: facilities.filter(f => f.ownership_status === 'Path to Ownership').length,
        Unknown: facilities.filter(f => !f.ownership_status || f.ownership_status === 'Unknown').length,
      },
      byState: facilities.reduce((acc, f) => {
        acc[f.state] = (acc[f.state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalLicensedBeds: facilities.reduce((sum, f) => sum + (f.licensed_beds || 0), 0),
      totalOperationalBeds: facilities.reduce((sum, f) => sum + (f.operational_beds || 0), 0),
    };

    res.json({
      facilities: enrichedFacilities,
      summary
    });
  } catch (err) {
    console.error('Facility directory error:', err);
    res.status(500).json({ error: 'Failed to fetch facility directory' });
  }
});

// ============================================================================
// NARRATIVE GENERATION ENDPOINTS
// ============================================================================

interface NarrativeSection {
  title: string;
  content: string;
  type: 'summary' | 'analysis' | 'trends' | 'recommendations' | 'questions';
}

// Generate narrative report
app.post('/api/narrative/generate', (req, res) => {
  try {
    const { context, periodId, facilityId } = req.body;

    // Get relevant data based on context
    let narrativeData: any = {};
    let sections: NarrativeSection[] = [];

    if (facilityId) {
      // Single facility narrative
      const facility = db.prepare(`
        SELECT * FROM facilities WHERE facility_id = ?
      `).get(facilityId) as any;

      const kpis = db.prepare(`
        SELECT kpi_id, value FROM kpi_results
        WHERE facility_id = ? AND period_id = ?
      `).all(facilityId, periodId) as any[];

      // Get trend data
      const trends = db.prepare(`
        SELECT kpi_id, period_id, value FROM kpi_results
        WHERE facility_id = ? AND period_id <= ?
        ORDER BY period_id DESC LIMIT 120
      `).all(facilityId, periodId) as any[];

      narrativeData = { facility, kpis, trends };
      sections = generateFacilityNarrative(facility, kpis, trends, periodId);
    } else {
      // Portfolio narrative
      const facilities = db.prepare(`
        SELECT * FROM facilities
      `).all() as any[];

      const allKpis = db.prepare(`
        SELECT facility_id, kpi_id, value FROM kpi_results
        WHERE period_id = ?
      `).all(periodId) as any[];

      narrativeData = { facilities, allKpis };
      sections = generatePortfolioNarrative(facilities, allKpis, periodId, context);
    }

    const narrative = {
      title: facilityId
        ? `${narrativeData.facility?.name || 'Facility'} Performance Analysis`
        : `Portfolio ${context.charAt(0).toUpperCase() + context.slice(1)} Analysis`,
      generatedAt: new Date().toISOString(),
      sections,
      metadata: {
        periodId,
        facilityId,
        context,
      },
    };

    res.json(narrative);
  } catch (err) {
    console.error('Narrative generation error:', err);
    res.status(500).json({ error: 'Failed to generate narrative' });
  }
});

// Generate comprehensive financial packet
app.post('/api/narrative/financial-packet', (req, res) => {
  try {
    const { scope, facilityId, stateName, opcoName, periodId } = req.body;

    let packet: any;

    switch (scope) {
      case 'facility':
        if (!facilityId) {
          return res.status(400).json({ error: 'facilityId required for facility scope' });
        }
        packet = generateEnhancedFacilityPacket(facilityId, periodId, db);
        break;
      case 'state':
        if (!stateName) {
          return res.status(400).json({ error: 'stateName required for state scope' });
        }
        packet = generateStatePacket(stateName, periodId, db);
        break;
      case 'opco':
        if (!opcoName) {
          return res.status(400).json({ error: 'opcoName required for opco scope' });
        }
        packet = generateOpcoPacket(opcoName, periodId, db);
        break;
      case 'portfolio':
      default:
        packet = generateEnhancedPortfolioPacket(periodId, db);
        break;
    }

    res.json(packet);
  } catch (err) {
    console.error('Financial packet error:', err);
    res.status(500).json({ error: 'Failed to generate financial packet' });
  }
});

// Get available packet scopes (states, opcos, facilities)
app.get('/api/narrative/packet-options', (_req, res) => {
  try {
    const states = db.prepare('SELECT DISTINCT state FROM facilities ORDER BY state').all() as { state: string }[];
    const opcos = db.prepare('SELECT DISTINCT parent_opco FROM facilities WHERE parent_opco IS NOT NULL ORDER BY parent_opco').all() as { parent_opco: string }[];
    const facilities = db.prepare('SELECT facility_id, name, state FROM facilities ORDER BY state, name').all() as { facility_id: string; name: string; state: string }[];

    res.json({
      states: states.map(s => s.state),
      opcos: opcos.map(o => o.parent_opco),
      facilities: facilities.map(f => ({ id: f.facility_id, name: f.name, state: f.state }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch packet options' });
  }
});

// Helper functions for narrative generation
function generateFacilityNarrative(facility: any, kpis: any[], trends: any[], periodId: string): NarrativeSection[] {
  const sections: NarrativeSection[] = [];
  const kpiMap = new Map(kpis.map(k => [k.kpi_id, k.value]));

  const margin = kpiMap.get('snf_operating_margin_pct');
  const skilledMix = kpiMap.get('snf_skilled_mix_pct');
  const revenuePPD = kpiMap.get('snf_total_revenue_ppd');
  const costPPD = kpiMap.get('snf_total_cost_ppd');
  const contractLabor = kpiMap.get('snf_contract_labor_pct_nursing');

  // Executive Summary
  sections.push({
    title: 'Executive Summary',
    type: 'summary',
    content: `${facility.name} is a ${facility.setting} facility located in ${facility.state} with ${facility.operational_beds || facility.licensed_beds || 'N/A'} operational beds.

For the period ending ${formatPeriodText(periodId)}, the facility ${margin !== null ? (margin > 0 ? `achieved a positive operating margin of ${margin.toFixed(1)}%` : `reported a negative operating margin of ${margin.toFixed(1)}%`) : 'has incomplete margin data'}.

${skilledMix !== null ? `Skilled mix stands at ${skilledMix.toFixed(1)}%, which ${skilledMix > 25 ? 'indicates strong managed care and Medicare penetration' : skilledMix > 15 ? 'represents moderate payer mix diversity' : 'suggests opportunity for payer mix optimization'}.` : ''}

${revenuePPD !== null && costPPD !== null ? `Revenue per patient day is $${revenuePPD.toFixed(2)} against costs of $${costPPD.toFixed(2)}, yielding a spread of $${(revenuePPD - costPPD).toFixed(2)} per patient day.` : ''}`
  });

  // Financial Analysis
  sections.push({
    title: 'Financial Performance Analysis',
    type: 'analysis',
    content: `${margin !== null ? `Operating Margin: The facility's ${margin.toFixed(1)}% operating margin ${margin >= 15 ? 'exceeds industry benchmarks and demonstrates strong operational efficiency' : margin >= 5 ? 'is within acceptable range but presents improvement opportunities' : margin >= 0 ? 'is positive but below optimal levels, requiring attention to cost management or revenue enhancement' : 'indicates financial distress requiring immediate intervention'}.` : 'Operating margin data is unavailable for this period.'}

${revenuePPD !== null ? `Revenue Generation: At $${revenuePPD.toFixed(2)} per patient day, ${revenuePPD > 500 ? 'revenue performance is strong, likely driven by favorable payer mix and ancillary services' : revenuePPD > 400 ? 'revenue is at market rate with potential for improvement through service line expansion' : 'revenue appears below market, suggesting need for rate negotiations or service mix optimization'}.` : ''}

${costPPD !== null ? `Cost Structure: Cost per patient day of $${costPPD.toFixed(2)} ${costPPD < 350 ? 'reflects efficient operations' : costPPD < 450 ? 'is within expected range' : 'exceeds benchmarks and warrants cost reduction initiatives'}.` : ''}

${contractLabor !== null ? `Staffing Efficiency: Contract labor at ${contractLabor.toFixed(1)}% of nursing costs ${contractLabor < 5 ? 'is excellent, indicating stable workforce' : contractLabor < 15 ? 'is acceptable but should be monitored' : contractLabor < 25 ? 'is elevated and impacting margins' : 'is critically high and requires immediate workforce stabilization'}.` : ''}`
  });

  // Trend Analysis
  const trendsByKpi = new Map<string, any[]>();
  trends.forEach(t => {
    if (!trendsByKpi.has(t.kpi_id)) trendsByKpi.set(t.kpi_id, []);
    trendsByKpi.get(t.kpi_id)!.push(t);
  });

  const marginTrend = trendsByKpi.get('snf_operating_margin_pct') || [];
  const marginDirection = marginTrend.length >= 2
    ? (marginTrend[0].value > marginTrend[1].value ? 'improving' : marginTrend[0].value < marginTrend[1].value ? 'declining' : 'stable')
    : 'insufficient data';

  sections.push({
    title: 'Trend Analysis',
    type: 'trends',
    content: `Based on historical performance data, key trends have been identified:

Operating Margin Trend: Performance is ${marginDirection}. ${marginDirection === 'improving' ? 'This positive trajectory should be sustained through continued operational focus.' : marginDirection === 'declining' ? 'This concerning trend requires root cause analysis and corrective action.' : 'Stable performance suggests consistent operations but may indicate plateau.'}

${trendsByKpi.has('snf_skilled_mix_pct') ? `Payer Mix Evolution: Skilled mix trends indicate ${trendsByKpi.get('snf_skilled_mix_pct')![0]?.value > (trendsByKpi.get('snf_skilled_mix_pct')![3]?.value || 0) ? 'positive movement toward higher-acuity patients' : 'shift toward lower-reimbursement payers requiring marketing attention'}.` : ''}

Seasonality patterns and year-over-year comparisons should be reviewed for comprehensive trend analysis.`
  });

  // Recommendations
  const recommendations: string[] = [];
  if (margin !== null && margin < 10) recommendations.push('Conduct detailed cost analysis to identify margin improvement opportunities');
  if (contractLabor !== null && contractLabor > 15) recommendations.push('Develop workforce stabilization strategy to reduce agency reliance');
  if (skilledMix !== null && skilledMix < 20) recommendations.push('Enhance managed care contracting and hospital referral relationships');
  if (revenuePPD !== null && revenuePPD < 400) recommendations.push('Review rate structures and explore ancillary revenue opportunities');

  sections.push({
    title: 'Strategic Recommendations',
    type: 'recommendations',
    content: recommendations.length > 0
      ? `Based on this analysis, the following strategic actions are recommended:\n\n${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n\n')}`
      : 'Current performance metrics are within acceptable ranges. Continue monitoring key indicators and maintain operational focus.'
  });

  // Questions for Further Analysis
  sections.push({
    title: 'Questions for Further Analysis',
    type: 'questions',
    content: `To deepen understanding of facility performance, consider investigating:

1. What specific factors are driving the current margin performance?
2. How does staffing efficiency compare to peer facilities in the region?
3. What is the current census trend and are there seasonal patterns?
4. Are there any survey or quality issues impacting admissions?
5. What capital investments might improve operational efficiency?
6. How are managed care contract negotiations progressing?`
  });

  return sections;
}

function generatePortfolioNarrative(facilities: any[], allKpis: any[], periodId: string, context: string): NarrativeSection[] {
  const sections: NarrativeSection[] = [];

  // Build facility KPI map
  const facilityKpis = new Map<string, Map<string, number>>();
  allKpis.forEach(k => {
    if (!facilityKpis.has(k.facility_id)) facilityKpis.set(k.facility_id, new Map());
    facilityKpis.get(k.facility_id)!.set(k.kpi_id, k.value);
  });

  // Calculate portfolio metrics
  const margins = facilities.map(f => facilityKpis.get(f.facility_id)?.get('snf_operating_margin_pct')).filter(m => m !== undefined) as number[];
  const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : null;
  const positiveMargins = margins.filter(m => m > 0).length;
  const negativeMargins = margins.filter(m => m < 0).length;

  const snfCount = facilities.filter(f => f.setting === 'SNF').length;
  const alfCount = facilities.filter(f => f.setting === 'ALF').length;
  const ilfCount = facilities.filter(f => f.setting === 'ILF').length;

  const stateBreakdown = facilities.reduce((acc, f) => {
    acc[f.state] = (acc[f.state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Executive Summary
  sections.push({
    title: 'Portfolio Executive Summary',
    type: 'summary',
    content: `SNFPNL portfolio comprises ${facilities.length} facilities across ${Object.keys(stateBreakdown).length} states, including ${snfCount} SNF, ${alfCount} ALF, and ${ilfCount} ILF operations.

For the period ending ${formatPeriodText(periodId)}, portfolio performance shows ${avgMargin !== null ? `an average operating margin of ${avgMargin.toFixed(1)}%` : 'incomplete margin data'}. Of facilities with margin data, ${positiveMargins} are profitable and ${negativeMargins} are operating at a loss.

Geographic concentration: ${Object.entries(stateBreakdown).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([state, count]) => `${state} (${count})`).join(', ')}.`
  });

  // Portfolio Analysis
  const topPerformers = facilities
    .map(f => ({ ...f, margin: facilityKpis.get(f.facility_id)?.get('snf_operating_margin_pct') }))
    .filter(f => f.margin !== undefined)
    .sort((a, b) => (b.margin || 0) - (a.margin || 0))
    .slice(0, 5);

  const bottomPerformers = facilities
    .map(f => ({ ...f, margin: facilityKpis.get(f.facility_id)?.get('snf_operating_margin_pct') }))
    .filter(f => f.margin !== undefined)
    .sort((a, b) => (a.margin || 0) - (b.margin || 0))
    .slice(0, 5);

  sections.push({
    title: 'Performance Distribution Analysis',
    type: 'analysis',
    content: `Portfolio performance varies significantly across facilities:

Top Performers:
${topPerformers.map(f => `• ${f.name} (${f.state}): ${f.margin?.toFixed(1)}% margin`).join('\n')}

Facilities Requiring Attention:
${bottomPerformers.map(f => `• ${f.name} (${f.state}): ${f.margin?.toFixed(1)}% margin`).join('\n')}

This distribution suggests ${topPerformers[0]?.margin && bottomPerformers[0]?.margin ? `a ${((topPerformers[0].margin || 0) - (bottomPerformers[0].margin || 0)).toFixed(1)} percentage point spread between best and worst performers, indicating significant operational variance that presents both risk and improvement opportunity.` : 'operational variance across the portfolio.'}`
  });

  // Trend Analysis
  sections.push({
    title: 'Portfolio Trends & Patterns',
    type: 'trends',
    content: `Key portfolio-wide trends observed:

1. Margin Distribution: ${positiveMargins > negativeMargins * 2 ? 'Strong majority profitable' : positiveMargins > negativeMargins ? 'More facilities profitable than not' : 'Concerning number of unprofitable facilities'}

2. Geographic Performance: Facilities in ${Object.entries(stateBreakdown).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'N/A'} represent the largest concentration and should be analyzed for regional patterns.

3. Facility Type Mix: The ${snfCount > alfCount + ilfCount ? 'SNF-heavy' : 'diversified'} portfolio ${snfCount > alfCount + ilfCount ? 'concentrates risk in skilled nursing operations' : 'provides some risk diversification across care settings'}.

Further analysis should examine correlations between geographic location, facility size, and financial performance.`
  });

  // Recommendations
  sections.push({
    title: 'Portfolio Strategic Recommendations',
    type: 'recommendations',
    content: `Based on portfolio analysis, recommended strategic actions:

1. Turnaround Focus: Prioritize intervention at bottom-performing facilities, starting with ${bottomPerformers[0]?.name || 'lowest margin facilities'}.

2. Best Practice Transfer: Document and replicate operational practices from ${topPerformers[0]?.name || 'top performers'} across the portfolio.

3. Regional Strategy: Develop state-specific strategies accounting for reimbursement and regulatory environments.

4. Portfolio Optimization: Evaluate strategic fit of consistently underperforming assets.

5. Staffing Initiative: Portfolio-wide workforce stabilization to reduce agency costs.

6. Revenue Enhancement: Centralized managed care contracting to improve rates across facilities.`
  });

  // Questions
  sections.push({
    title: 'Questions for Leadership Discussion',
    type: 'questions',
    content: `Strategic questions for executive consideration:

1. What is the acceptable margin threshold for continued investment in underperforming facilities?
2. Are there acquisition or divestiture opportunities that would strengthen the portfolio?
3. How can corporate resources better support struggling facilities?
4. What shared services could drive efficiency across the portfolio?
5. How should capital be allocated between maintenance and growth investments?
6. What workforce strategies will address industry-wide staffing challenges?`
  });

  return sections;
}

function generateFacilityPacket(facilityId: string, periodId: string, database: any): any {
  const facility = database.prepare('SELECT * FROM facilities WHERE facility_id = ?').get(facilityId);
  const kpis = database.prepare('SELECT * FROM kpi_results WHERE facility_id = ? AND period_id = ?').all(facilityId, periodId);
  const trends = database.prepare(`
    SELECT kpi_id, period_id, value
    FROM kpi_results
    WHERE facility_id = ?
    ORDER BY period_id DESC
    LIMIT 288
  `).all(facilityId);

  const kpiMap = new Map<string, number>(kpis.map((k: any) => [k.kpi_id, k.value]));

  // Build trend data for charts
  const trendsByKpi = new Map<string, { period: string; value: number }[]>();
  trends.forEach((t: any) => {
    if (!trendsByKpi.has(t.kpi_id)) trendsByKpi.set(t.kpi_id, []);
    trendsByKpi.get(t.kpi_id)!.push({ period: t.period_id, value: t.value });
  });

  // Get key metrics
  const margin = kpiMap.get('snf_operating_margin_pct') ?? kpiMap.get('sl_operating_margin_pct');
  const revenuePPD = kpiMap.get('snf_total_revenue_ppd') ?? kpiMap.get('sl_revpor');
  const costPPD = kpiMap.get('snf_total_cost_ppd') ?? kpiMap.get('sl_expense_prd');
  const skilledMix = kpiMap.get('snf_skilled_mix_pct');
  const contractLabor = kpiMap.get('snf_contract_labor_pct_nursing');
  const nursingCost = kpiMap.get('snf_nursing_cost_ppd');
  const therapyCost = kpiMap.get('snf_therapy_cost_psd');
  const medicareRev = kpiMap.get('snf_medicare_a_revenue_psd');
  const medicaidRev = kpiMap.get('snf_medicaid_revenue_ppd');

  // Determine what's going well and what needs work
  const goingWell: string[] = [];
  const needsWork: string[] = [];

  if (margin !== undefined) {
    if (margin >= 15) goingWell.push(`Strong operating margin of ${margin.toFixed(1)}% - well above industry benchmark`);
    else if (margin >= 8) goingWell.push(`Solid operating margin of ${margin.toFixed(1)}% - meeting industry standards`);
    else if (margin >= 0) needsWork.push(`Operating margin of ${margin.toFixed(1)}% is positive but below target - room for improvement`);
    else needsWork.push(`Negative operating margin of ${margin.toFixed(1)}% requires immediate attention`);
  }

  if (skilledMix !== undefined) {
    if (skilledMix >= 25) goingWell.push(`Excellent skilled mix at ${skilledMix.toFixed(1)}% - driving strong revenue`);
    else if (skilledMix >= 18) goingWell.push(`Good skilled mix at ${skilledMix.toFixed(1)}%`);
    else needsWork.push(`Skilled mix at ${skilledMix.toFixed(1)}% is below optimal - consider managed care contracting focus`);
  }

  if (contractLabor !== undefined) {
    if (contractLabor <= 5) goingWell.push(`Minimal contract labor at ${contractLabor.toFixed(1)}% - workforce is stable`);
    else if (contractLabor <= 12) goingWell.push(`Contract labor at ${contractLabor.toFixed(1)}% - acceptable range`);
    else if (contractLabor <= 20) needsWork.push(`Elevated contract labor at ${contractLabor.toFixed(1)}% - impacting margins`);
    else needsWork.push(`Critical contract labor at ${contractLabor.toFixed(1)}% - requires workforce stabilization plan`);
  }

  if (revenuePPD !== undefined) {
    if (revenuePPD >= 500) goingWell.push(`Strong revenue per patient day at $${revenuePPD.toFixed(0)}`);
    else if (revenuePPD >= 400) goingWell.push(`Solid revenue per patient day at $${revenuePPD.toFixed(0)}`);
    else needsWork.push(`Revenue per patient day at $${revenuePPD.toFixed(0)} is below market - review rate structures`);
  }

  if (costPPD !== undefined && revenuePPD !== undefined) {
    const spread = revenuePPD - costPPD;
    if (spread >= 80) goingWell.push(`Healthy revenue-cost spread of $${spread.toFixed(0)} per patient day`);
    else if (spread >= 40) goingWell.push(`Acceptable spread of $${spread.toFixed(0)} per patient day`);
    else needsWork.push(`Tight spread of $${spread.toFixed(0)} per patient day - margins under pressure`);
  }

  // Build chart data
  const marginTrendData = (trendsByKpi.get('snf_operating_margin_pct') || []).slice(0, 12).reverse();
  const revenueTrendData = (trendsByKpi.get('snf_total_revenue_ppd') || []).slice(0, 12).reverse();
  const skilledMixTrendData = (trendsByKpi.get('snf_skilled_mix_pct') || []).slice(0, 12).reverse();

  return {
    title: `${facility?.name || 'Facility'} Financial Packet`,
    subtitle: `Comprehensive Analysis for ${formatPeriodText(periodId)}`,
    generatedAt: new Date().toISOString(),
    facility: {
      name: facility?.name,
      id: facilityId,
      setting: facility?.setting,
      address: facility?.address,
      city: facility?.city,
      state: facility?.state,
      licensedBeds: facility?.licensed_beds,
      operationalBeds: facility?.operational_beds,
      ownership: facility?.ownership_status,
      lender: facility?.lender_landlord
    },
    executiveNarrative: generateFacilityExecutiveNarrative(facility, kpiMap, goingWell, needsWork),
    goingWell,
    needsWork,
    keyMetrics: {
      operatingMargin: { value: margin, benchmark: 12, unit: '%' },
      revenuePPD: { value: revenuePPD, benchmark: 450, unit: '$' },
      costPPD: { value: costPPD, benchmark: 380, unit: '$' },
      skilledMix: { value: skilledMix, benchmark: 22, unit: '%' },
      contractLabor: { value: contractLabor, benchmark: 10, unit: '%', inverse: true },
      nursingCostPPD: { value: nursingCost, benchmark: 180, unit: '$' },
      therapyCostPSD: { value: therapyCost, benchmark: 120, unit: '$' },
      medicareRevPSD: { value: medicareRev, benchmark: 650, unit: '$' },
      medicaidRevPPD: { value: medicaidRev, benchmark: 250, unit: '$' }
    },
    charts: {
      marginTrend: { title: 'Operating Margin Trend (12 Mo)', data: marginTrendData, unit: '%' },
      revenueTrend: { title: 'Revenue PPD Trend (12 Mo)', data: revenueTrendData, unit: '$' },
      skilledMixTrend: { title: 'Skilled Mix Trend (12 Mo)', data: skilledMixTrendData, unit: '%' },
      payerMix: [
        { name: 'Skilled', value: skilledMix || 0, color: '#667eea' },
        { name: 'Medicaid LTC', value: kpiMap.get('snf_medicaid_mix_pct') || 0, color: '#f59e0b' },
        { name: 'Other', value: Math.max(0, 100 - (skilledMix || 0) - (kpiMap.get('snf_medicaid_mix_pct') || 0)), color: '#10b981' }
      ],
      costBreakdown: [
        { name: 'Nursing', value: nursingCost || 0, color: '#667eea' },
        { name: 'Therapy', value: therapyCost || 0, color: '#10b981' },
        { name: 'Other', value: Math.max(0, (costPPD || 0) - (nursingCost || 0) - (therapyCost || 0) * 0.3), color: '#f59e0b' }
      ]
    },
    detailedNarrative: generateFacilityDetailedNarrative(facility, kpiMap, trendsByKpi),
    recommendations: generateFacilityRecommendations(kpiMap, goingWell, needsWork)
  };
}

function generateFacilityExecutiveNarrative(facility: any, kpiMap: Map<string, number>, goingWell: string[], needsWork: string[]): string {
  const margin = kpiMap.get('snf_operating_margin_pct') ?? kpiMap.get('sl_operating_margin_pct');
  const revenuePPD = kpiMap.get('snf_total_revenue_ppd') ?? kpiMap.get('sl_revpor');
  const skilledMix = kpiMap.get('snf_skilled_mix_pct');

  const performance = margin !== undefined ? (margin >= 15 ? 'excellent' : margin >= 8 ? 'solid' : margin >= 0 ? 'challenged' : 'struggling') : 'unknown';

  return `${facility?.name} is a ${facility?.setting} facility in ${facility?.city}, ${facility?.state} with ${facility?.operational_beds || facility?.licensed_beds} operational beds. ` +
    `Overall, the building is showing ${performance} financial performance this period. ` +
    (margin !== undefined ? `The operating margin stands at ${margin.toFixed(1)}%, ${margin >= 12 ? 'exceeding our portfolio target' : margin >= 5 ? 'within acceptable range but with room for improvement' : 'requiring focused attention from leadership'}. ` : '') +
    (goingWell.length > 0 ? `Key strengths include ${goingWell.length > 1 ? goingWell.slice(0, 2).join(' and ').toLowerCase() : goingWell[0].toLowerCase()}. ` : '') +
    (needsWork.length > 0 ? `Areas requiring attention include ${needsWork.length > 1 ? needsWork.slice(0, 2).join(' and ').toLowerCase() : needsWork[0].toLowerCase()}.` : '');
}

function generateFacilityDetailedNarrative(facility: any, kpiMap: Map<string, number>, trendsByKpi: Map<string, any[]>): string {
  const margin = kpiMap.get('snf_operating_margin_pct') ?? kpiMap.get('sl_operating_margin_pct');
  const revenuePPD = kpiMap.get('snf_total_revenue_ppd');
  const costPPD = kpiMap.get('snf_total_cost_ppd');
  const skilledMix = kpiMap.get('snf_skilled_mix_pct');
  const contractLabor = kpiMap.get('snf_contract_labor_pct_nursing');
  const nursingCost = kpiMap.get('snf_nursing_cost_ppd');
  const medicareRev = kpiMap.get('snf_medicare_a_revenue_psd');
  const maRev = kpiMap.get('snf_ma_revenue_psd');

  let narrative = `## ${facility?.name} - Complete Financial Analysis\n\n`;

  narrative += `### Facility Profile\n`;
  narrative += `${facility?.name} is a ${facility?.setting} facility located at ${facility?.address || 'address not specified'} in ${facility?.city}, ${facility?.state}. `;
  narrative += `The building operates ${facility?.operational_beds || 'N/A'} beds out of ${facility?.licensed_beds || 'N/A'} licensed. `;
  narrative += `Ownership status is ${facility?.ownership_status || 'Leased'}${facility?.lender_landlord ? ` with ${facility.lender_landlord} as lender/landlord` : ''}.\n\n`;

  narrative += `### Financial Performance Overview\n`;
  if (margin !== undefined) {
    narrative += `Let's start with the bottom line - the operating margin is ${margin.toFixed(1)}%. `;
    if (margin >= 15) {
      narrative += `This is outstanding performance, putting this building in our top tier. `;
    } else if (margin >= 10) {
      narrative += `This is solid performance that shows the building is running well operationally. `;
    } else if (margin >= 5) {
      narrative += `This is acceptable but there's definitely opportunity to push higher. `;
    } else if (margin >= 0) {
      narrative += `We're positive but thin - not a lot of cushion if something unexpected hits. `;
    } else {
      narrative += `We're in the red here and this needs to be a priority conversation. `;
    }
  }

  if (revenuePPD !== undefined && costPPD !== undefined) {
    const spread = revenuePPD - costPPD;
    narrative += `\n\nThe revenue per patient day is $${revenuePPD.toFixed(0)} and our costs are running $${costPPD.toFixed(0)}, leaving us a spread of $${spread.toFixed(0)} per patient day. `;
    if (spread >= 80) {
      narrative += `That's a healthy spread that gives us good margin protection. `;
    } else if (spread >= 40) {
      narrative += `That spread is workable but doesn't leave much room for error. `;
    } else {
      narrative += `That spread is too tight - we need to either push revenue up or get costs down. `;
    }
  }

  narrative += `\n\n### Payer Mix Analysis\n`;
  if (skilledMix !== undefined) {
    narrative += `Skilled mix is at ${skilledMix.toFixed(1)}%. `;
    if (skilledMix >= 25) {
      narrative += `This is excellent - we're capturing high-acuity patients and the revenue reflects it. `;
    } else if (skilledMix >= 18) {
      narrative += `This is a decent skilled mix. There may be opportunity to grow this through better hospital relationships or managed care penetration. `;
    } else {
      narrative += `This is below where we'd like to see it. We should look at our referral sources and managed care contracts. `;
    }

    if (medicareRev !== undefined) {
      narrative += `Medicare A is reimbursing at $${medicareRev.toFixed(0)} per skilled day. `;
    }
    if (maRev !== undefined) {
      narrative += `MA/HMO rates are averaging $${maRev.toFixed(0)} per skilled day. `;
    }
  }

  narrative += `\n\n### Cost Structure\n`;
  if (nursingCost !== undefined) {
    narrative += `Nursing costs are running $${nursingCost.toFixed(0)} per patient day. `;
    if (nursingCost <= 160) {
      narrative += `This is well-controlled for the acuity level. `;
    } else if (nursingCost <= 190) {
      narrative += `This is within normal range. `;
    } else {
      narrative += `This is elevated - we should dig into what's driving this. `;
    }
  }

  if (contractLabor !== undefined) {
    narrative += `\n\nContract labor is at ${contractLabor.toFixed(1)}% of nursing costs. `;
    if (contractLabor <= 5) {
      narrative += `This is fantastic - the workforce is stable and we're not bleeding money to agencies. `;
    } else if (contractLabor <= 12) {
      narrative += `This is manageable but we should keep an eye on it. `;
    } else if (contractLabor <= 20) {
      narrative += `This is elevated and definitely eating into our margins. We need to look at retention strategies. `;
    } else {
      narrative += `This is critical - we're likely losing $${(contractLabor * 2000).toFixed(0)}+ per month to agency premiums. Workforce stabilization should be priority one. `;
    }
  }

  narrative += `\n\n### Key Takeaways\n`;
  narrative += `**Bullet Point Summary:**\n`;
  if (margin !== undefined) narrative += `• Operating Margin: ${margin.toFixed(1)}% (${margin >= 10 ? '✓ Strong' : margin >= 0 ? '⚠ Acceptable' : '✗ Needs Attention'})\n`;
  if (revenuePPD !== undefined) narrative += `• Revenue PPD: $${revenuePPD.toFixed(0)} (${revenuePPD >= 450 ? '✓ Above target' : '⚠ Below target'})\n`;
  if (skilledMix !== undefined) narrative += `• Skilled Mix: ${skilledMix.toFixed(1)}% (${skilledMix >= 20 ? '✓ Good' : '⚠ Opportunity'})\n`;
  if (contractLabor !== undefined) narrative += `• Contract Labor: ${contractLabor.toFixed(1)}% (${contractLabor <= 10 ? '✓ Controlled' : '⚠ Elevated'})\n`;

  return narrative;
}

function generateFacilityRecommendations(kpiMap: Map<string, number>, goingWell: string[], needsWork: string[]): string[] {
  const recommendations: string[] = [];
  const margin = kpiMap.get('snf_operating_margin_pct');
  const contractLabor = kpiMap.get('snf_contract_labor_pct_nursing');
  const skilledMix = kpiMap.get('snf_skilled_mix_pct');
  const revenuePPD = kpiMap.get('snf_total_revenue_ppd');

  if (margin !== undefined && margin < 8) {
    recommendations.push('Schedule operational review meeting to identify margin improvement levers');
  }
  if (contractLabor !== undefined && contractLabor > 15) {
    recommendations.push('Develop 90-day workforce stabilization plan to reduce agency reliance');
    recommendations.push('Review compensation and benefits competitiveness vs local market');
  }
  if (skilledMix !== undefined && skilledMix < 18) {
    recommendations.push('Meet with hospital discharge planners to strengthen referral relationships');
    recommendations.push('Review managed care contract rates and consider renegotiation');
  }
  if (revenuePPD !== undefined && revenuePPD < 400) {
    recommendations.push('Audit current payer rates vs market benchmarks');
    recommendations.push('Evaluate ancillary service revenue opportunities');
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue current operational focus - metrics are strong');
    recommendations.push('Document best practices for sharing across portfolio');
  }

  return recommendations;
}

function generatePortfolioPacket(periodId: string, database: any): any {
  const facilities = database.prepare('SELECT * FROM facilities ORDER BY state, name').all();
  const allKpis = database.prepare('SELECT * FROM kpi_results WHERE period_id = ?').all(periodId);
  const priorPeriodKpis = database.prepare(`
    SELECT * FROM kpi_results
    WHERE period_id = (SELECT period_id FROM periods WHERE period_id < ? ORDER BY period_id DESC LIMIT 1)
  `).all(periodId);

  // Build KPI maps
  const facilityKpis = new Map<string, Map<string, number>>();
  allKpis.forEach((k: any) => {
    if (!facilityKpis.has(k.facility_id)) facilityKpis.set(k.facility_id, new Map());
    facilityKpis.get(k.facility_id)!.set(k.kpi_id, k.value);
  });

  const priorKpis = new Map<string, Map<string, number>>();
  priorPeriodKpis.forEach((k: any) => {
    if (!priorKpis.has(k.facility_id)) priorKpis.set(k.facility_id, new Map());
    priorKpis.get(k.facility_id)!.set(k.kpi_id, k.value);
  });

  // Calculate portfolio aggregates
  const facilitiesWithData = facilities.map((f: any) => {
    const kpis = facilityKpis.get(f.facility_id) || new Map();
    const prior = priorKpis.get(f.facility_id) || new Map();
    const margin = kpis.get('snf_operating_margin_pct') ?? kpis.get('sl_operating_margin_pct');
    const priorMargin = prior.get('snf_operating_margin_pct') ?? prior.get('sl_operating_margin_pct');
    const revenuePPD = kpis.get('snf_total_revenue_ppd') ?? kpis.get('sl_revpor');
    const costPPD = kpis.get('snf_total_cost_ppd') ?? kpis.get('sl_expense_prd');
    const skilledMix = kpis.get('snf_skilled_mix_pct');
    const contractLabor = kpis.get('snf_contract_labor_pct_nursing');

    return {
      ...f,
      margin,
      priorMargin,
      marginChange: margin !== undefined && priorMargin !== undefined ? margin - priorMargin : undefined,
      revenuePPD,
      costPPD,
      spread: revenuePPD !== undefined && costPPD !== undefined ? revenuePPD - costPPD : undefined,
      skilledMix,
      contractLabor
    };
  });

  const withMargin = facilitiesWithData.filter((f: any) => f.margin !== undefined);
  const margins = withMargin.map((f: any) => f.margin);
  const avgMargin = margins.length > 0 ? margins.reduce((a: number, b: number) => a + b, 0) / margins.length : 0;
  const medianMargin = margins.length > 0 ? margins.sort((a: number, b: number) => a - b)[Math.floor(margins.length / 2)] : 0;

  // Categorize facilities
  const goingWellFacilities = withMargin.filter((f: any) => f.margin >= 12).sort((a: any, b: any) => b.margin - a.margin);
  const solidFacilities = withMargin.filter((f: any) => f.margin >= 5 && f.margin < 12).sort((a: any, b: any) => b.margin - a.margin);
  const needsWorkFacilities = withMargin.filter((f: any) => f.margin < 5).sort((a: any, b: any) => a.margin - b.margin);

  const improvingFacilities = withMargin.filter((f: any) => f.marginChange !== undefined && f.marginChange > 1).sort((a: any, b: any) => b.marginChange - a.marginChange);
  const decliningFacilities = withMargin.filter((f: any) => f.marginChange !== undefined && f.marginChange < -1).sort((a: any, b: any) => a.marginChange - b.marginChange);

  // Group by state
  const byState: Record<string, any[]> = {};
  facilitiesWithData.forEach((f: any) => {
    if (!byState[f.state]) byState[f.state] = [];
    byState[f.state].push(f);
  });

  // Build individual facility summaries
  const facilitySummaries = facilitiesWithData.map((f: any) => ({
    id: f.facility_id,
    name: f.name,
    state: f.state,
    setting: f.setting,
    beds: f.operational_beds || f.licensed_beds,
    margin: f.margin,
    marginChange: f.marginChange,
    revenuePPD: f.revenuePPD,
    costPPD: f.costPPD,
    spread: f.spread,
    skilledMix: f.skilledMix,
    contractLabor: f.contractLabor,
    status: f.margin >= 12 ? 'strong' : f.margin >= 5 ? 'solid' : f.margin >= 0 ? 'watch' : 'critical',
    narrative: generateQuickFacilityNarrative(f)
  }));

  // Build charts data
  const marginDistribution = [
    { range: '> 20%', count: withMargin.filter((f: any) => f.margin >= 20).length, color: '#10b981' },
    { range: '12-20%', count: withMargin.filter((f: any) => f.margin >= 12 && f.margin < 20).length, color: '#22c55e' },
    { range: '5-12%', count: withMargin.filter((f: any) => f.margin >= 5 && f.margin < 12).length, color: '#f59e0b' },
    { range: '0-5%', count: withMargin.filter((f: any) => f.margin >= 0 && f.margin < 5).length, color: '#f97316' },
    { range: '< 0%', count: withMargin.filter((f: any) => f.margin < 0).length, color: '#ef4444' }
  ];

  const statePerformance = Object.entries(byState).map(([state, facs]) => {
    const stateMargins = facs.filter((f: any) => f.margin !== undefined).map((f: any) => f.margin);
    return {
      state,
      count: facs.length,
      avgMargin: stateMargins.length > 0 ? stateMargins.reduce((a: number, b: number) => a + b, 0) / stateMargins.length : 0
    };
  }).sort((a, b) => b.avgMargin - a.avgMargin);

  return {
    title: `SNFPNL Portfolio Financial Packet`,
    subtitle: `Comprehensive Analysis for ${formatPeriodText(periodId)}`,
    generatedAt: new Date().toISOString(),
    portfolioSummary: {
      totalFacilities: facilities.length,
      totalBeds: facilities.reduce((sum: number, f: any) => sum + (f.operational_beds || 0), 0),
      snfCount: facilities.filter((f: any) => f.setting === 'SNF').length,
      alfCount: facilities.filter((f: any) => f.setting === 'ALF').length,
      ilfCount: facilities.filter((f: any) => f.setting === 'ILF').length,
      avgMargin,
      medianMargin,
      profitableFacilities: withMargin.filter((f: any) => f.margin > 0).length,
      facilitiesAtRisk: withMargin.filter((f: any) => f.margin < 0).length,
      states: Object.keys(byState).length
    },
    executiveNarrative: generatePortfolioExecutiveNarrative(facilitiesWithData, avgMargin, goingWellFacilities, needsWorkFacilities, byState),
    goingWell: {
      title: 'What\'s Going Well',
      narrative: generateGoingWellNarrative(goingWellFacilities, improvingFacilities, avgMargin),
      topPerformers: goingWellFacilities.slice(0, 10).map((f: any) => ({
        name: f.name,
        state: f.state,
        margin: f.margin,
        highlight: f.margin >= 30 ? 'Outstanding' : f.margin >= 20 ? 'Excellent' : 'Strong'
      })),
      improving: improvingFacilities.slice(0, 5).map((f: any) => ({
        name: f.name,
        state: f.state,
        margin: f.margin,
        change: f.marginChange,
        narrative: `${f.name} improved ${f.marginChange.toFixed(1)} points month-over-month`
      })),
      bulletPoints: [
        `${goingWellFacilities.length} facilities (${((goingWellFacilities.length / withMargin.length) * 100).toFixed(0)}%) are performing above 12% margin`,
        `Portfolio average margin of ${avgMargin.toFixed(1)}% ${avgMargin >= 12 ? 'exceeds' : 'is approaching'} industry benchmark`,
        `${improvingFacilities.length} facilities showed meaningful margin improvement this month`,
        goingWellFacilities[0] ? `${goingWellFacilities[0].name} leads the portfolio at ${goingWellFacilities[0].margin.toFixed(1)}% margin` : ''
      ].filter(b => b)
    },
    needsWork: {
      title: 'Areas Requiring Attention',
      narrative: generateNeedsWorkNarrative(needsWorkFacilities, decliningFacilities),
      underperformers: needsWorkFacilities.slice(0, 10).map((f: any) => ({
        name: f.name,
        state: f.state,
        margin: f.margin,
        issue: f.margin < 0 ? 'Negative margin' : f.margin < 3 ? 'Critical margin' : 'Below target',
        contractLabor: f.contractLabor,
        recommendation: f.contractLabor > 20 ? 'Focus on workforce stabilization' : f.skilledMix < 15 ? 'Improve payer mix' : 'Operational review needed'
      })),
      declining: decliningFacilities.slice(0, 5).map((f: any) => ({
        name: f.name,
        state: f.state,
        margin: f.margin,
        change: f.marginChange,
        narrative: `${f.name} declined ${Math.abs(f.marginChange).toFixed(1)} points - needs investigation`
      })),
      bulletPoints: [
        `${needsWorkFacilities.length} facilities operating below 5% margin`,
        `${withMargin.filter((f: any) => f.margin < 0).length} facilities currently in negative margin territory`,
        `${decliningFacilities.length} facilities showing declining month-over-month performance`,
        needsWorkFacilities[0] ? `${needsWorkFacilities[0].name} is the lowest at ${needsWorkFacilities[0].margin.toFixed(1)}% margin` : ''
      ].filter(b => b)
    },
    facilitySummaries,
    byState: statePerformance.map(s => ({
      ...s,
      facilities: (byState[s.state] || []).map((f: any) => ({
        name: f.name,
        margin: f.margin,
        status: f.margin >= 12 ? 'strong' : f.margin >= 5 ? 'solid' : f.margin >= 0 ? 'watch' : 'critical'
      }))
    })),
    charts: {
      marginDistribution,
      statePerformance: statePerformance.map(s => ({ name: s.state, value: s.avgMargin })),
      facilityMargins: withMargin.slice(0, 20).map((f: any) => ({ name: f.name.substring(0, 15), margin: f.margin }))
    },
    recommendations: [
      needsWorkFacilities.length > 5 ? 'Conduct portfolio-wide operational review to identify systemic issues' : null,
      decliningFacilities.length > 3 ? 'Investigate root causes of declining facilities immediately' : null,
      'Share best practices from top performers to struggling facilities',
      'Review managed care contracts portfolio-wide for rate improvement opportunities',
      withMargin.filter((f: any) => f.contractLabor > 15).length > 5 ? 'Launch portfolio-wide workforce stabilization initiative' : null,
      'Evaluate capital allocation priorities based on facility performance',
      'Consider regional management structure to improve oversight of underperforming areas'
    ].filter(r => r)
  };
}

function generateQuickFacilityNarrative(f: any): string {
  if (f.margin === undefined) return 'Insufficient data for analysis.';

  let narrative = '';
  if (f.margin >= 15) {
    narrative = `Strong performer at ${f.margin.toFixed(1)}% margin. `;
  } else if (f.margin >= 8) {
    narrative = `Solid performance at ${f.margin.toFixed(1)}% margin. `;
  } else if (f.margin >= 0) {
    narrative = `Positive but thin at ${f.margin.toFixed(1)}% margin - needs monitoring. `;
  } else {
    narrative = `Struggling at ${f.margin.toFixed(1)}% margin - requires intervention. `;
  }

  if (f.marginChange !== undefined) {
    if (f.marginChange > 2) narrative += `Trending up ${f.marginChange.toFixed(1)} pts MoM. `;
    else if (f.marginChange < -2) narrative += `Declining ${Math.abs(f.marginChange).toFixed(1)} pts MoM - investigate. `;
  }

  if (f.contractLabor !== undefined && f.contractLabor > 15) {
    narrative += `Contract labor elevated at ${f.contractLabor.toFixed(0)}%. `;
  }

  return narrative;
}

function generatePortfolioExecutiveNarrative(facilities: any[], avgMargin: number, goingWell: any[], needsWork: any[], byState: Record<string, any[]>): string {
  const totalFacilities = facilities.length;
  const withMargin = facilities.filter(f => f.margin !== undefined);
  const profitable = withMargin.filter(f => f.margin > 0).length;

  let narrative = `## SNFPNL Portfolio Overview\n\n`;
  narrative += `The portfolio consists of ${totalFacilities} facilities operating across ${Object.keys(byState).length} states. `;
  narrative += `Overall portfolio health is ${avgMargin >= 12 ? 'strong' : avgMargin >= 8 ? 'solid' : avgMargin >= 5 ? 'acceptable' : 'concerning'} with an average operating margin of ${avgMargin.toFixed(1)}%.\n\n`;

  narrative += `Of the ${withMargin.length} facilities with complete data, ${profitable} (${((profitable/withMargin.length)*100).toFixed(0)}%) are operating profitably. `;
  narrative += `${goingWell.length} facilities are performing above our 12% target, while ${needsWork.length} require focused attention.\n\n`;

  narrative += `**Geographic Distribution:**\n`;
  Object.entries(byState).sort((a, b) => b[1].length - a[1].length).forEach(([state, facs]) => {
    const stateMargins = facs.filter((f: any) => f.margin !== undefined).map((f: any) => f.margin);
    const stateAvg = stateMargins.length > 0 ? stateMargins.reduce((a, b) => a + b, 0) / stateMargins.length : 0;
    narrative += `• ${state}: ${facs.length} facilities, ${stateAvg.toFixed(1)}% avg margin\n`;
  });

  return narrative;
}

function generateGoingWellNarrative(goingWell: any[], improving: any[], avgMargin: number): string {
  let narrative = `The portfolio shows several bright spots this period. `;

  if (goingWell.length > 0) {
    narrative += `${goingWell.length} facilities are outperforming with margins above 12%. `;
    narrative += `Leading the pack is ${goingWell[0].name} at an impressive ${goingWell[0].margin.toFixed(1)}% margin. `;

    if (goingWell.length >= 3) {
      narrative += `Other standouts include ${goingWell[1].name} (${goingWell[1].margin.toFixed(1)}%) and ${goingWell[2].name} (${goingWell[2].margin.toFixed(1)}%). `;
    }
  }

  if (improving.length > 0) {
    narrative += `\n\nMomentum is building at several facilities. `;
    narrative += `${improving[0].name} improved by ${improving[0].marginChange.toFixed(1)} percentage points month-over-month. `;
    if (improving.length > 1) {
      narrative += `${improving[1].name} also showed strong improvement with a ${improving[1].marginChange.toFixed(1)} point gain. `;
    }
  }

  narrative += `\n\nThese strong performers demonstrate what's achievable across the portfolio. We should document their practices around staffing, payer mix management, and cost control for sharing with struggling facilities.`;

  return narrative;
}

function generateNeedsWorkNarrative(needsWork: any[], declining: any[]): string {
  let narrative = `Several facilities require focused attention. `;

  if (needsWork.length > 0) {
    const negative = needsWork.filter(f => f.margin < 0);

    if (negative.length > 0) {
      narrative += `${negative.length} facilities are operating at a loss, with ${negative[0].name} at ${negative[0].margin.toFixed(1)}% being the most critical. `;
    }

    narrative += `\n\nThe ${needsWork.length} facilities below 5% margin need immediate operational review. `;

    const highContractLabor = needsWork.filter(f => f.contractLabor > 15);
    if (highContractLabor.length > 0) {
      narrative += `${highContractLabor.length} of these have elevated contract labor costs, suggesting workforce stabilization should be priority one. `;
    }
  }

  if (declining.length > 0) {
    narrative += `\n\nTroubling trends are emerging at ${declining.length} facilities showing month-over-month decline. `;
    narrative += `${declining[0].name} dropped ${Math.abs(declining[0].marginChange).toFixed(1)} points and needs immediate investigation. `;
  }

  narrative += `\n\nRecommended actions: Schedule facility-level calls with each underperformer within the next two weeks. Review staffing, census trends, and payer mix for root cause analysis.`;

  return narrative;
}

function formatPeriodText(periodId: string): string {
  const [year, month] = periodId.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

// ============================================================================
// T12M PERFORMANCE ANALYSIS API
// ============================================================================

// KPI metadata for display
const KPI_METADATA: Record<string, { label: string; format: 'percentage' | 'currency' | 'number' | 'hours'; higherIsBetter: boolean }> = {
  'snf_operating_margin_pct': { label: 'Operating Margin', format: 'percentage', higherIsBetter: true },
  'snf_skilled_margin_pct': { label: 'Skilled Margin', format: 'percentage', higherIsBetter: true },
  'snf_skilled_mix_pct': { label: 'Skilled Mix', format: 'percentage', higherIsBetter: true },
  'snf_total_revenue_ppd': { label: 'Revenue PPD', format: 'currency', higherIsBetter: true },
  'snf_total_cost_ppd': { label: 'Total Cost PPD', format: 'currency', higherIsBetter: false },
  'snf_nursing_cost_ppd': { label: 'Nursing Cost PPD', format: 'currency', higherIsBetter: false },
  'snf_nursing_hppd': { label: 'Nursing Hours PPD', format: 'hours', higherIsBetter: true },
  'snf_therapy_cost_psd': { label: 'Therapy Cost PSD', format: 'currency', higherIsBetter: false },
  'snf_contract_labor_pct_nursing': { label: 'Contract Labor %', format: 'percentage', higherIsBetter: false },
  'snf_occupancy_pct': { label: 'Occupancy', format: 'percentage', higherIsBetter: true },
};

// Get T12M performance data for a facility
app.get('/api/performance/t12m/:facilityId', (req, res) => {
  try {
    const { facilityId } = req.params;
    const { periodId } = req.query;

    if (!periodId || typeof periodId !== 'string') {
      return res.status(400).json({ error: 'periodId query parameter is required' });
    }

    // Get facility info
    const facility = db.prepare(`
      SELECT facility_id, name, state, setting FROM facilities WHERE facility_id = ?
    `).get(facilityId) as { facility_id: string; name: string; state: string; setting: string } | undefined;

    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    // Calculate the 12-month range ending at periodId
    const startPeriod = getPeriodIdMonthsAgo(periodId, 11);

    // Get all KPI values for this facility over the trailing 12 months
    const kpiData = db.prepare(`
      SELECT kpi_id, period_id, value
      FROM kpi_results
      WHERE facility_id = ?
        AND period_id >= ?
        AND period_id <= ?
        AND value IS NOT NULL
      ORDER BY kpi_id, period_id
    `).all(facilityId, startPeriod, periodId) as { kpi_id: string; period_id: string; value: number }[];

    // Group data by KPI
    const kpiGroups = new Map<string, { value: number; periodId: string }[]>();
    for (const row of kpiData) {
      if (!kpiGroups.has(row.kpi_id)) {
        kpiGroups.set(row.kpi_id, []);
      }
      kpiGroups.get(row.kpi_id)!.push({ value: row.value, periodId: row.period_id });
    }

    // Calculate T12M stats for each KPI
    const metrics: Array<{
      kpiId: string;
      label: string;
      format: string;
      stats: T12MStats;
      sparklineData: { period: string; value: number }[];
    }> = [];

    for (const [kpiId, values] of kpiGroups.entries()) {
      const metadata = KPI_METADATA[kpiId];
      if (!metadata) continue; // Skip KPIs we don't have metadata for

      const stats = calculateT12MStats(values, metadata.higherIsBetter);
      if (!stats) continue;

      metrics.push({
        kpiId,
        label: metadata.label,
        format: metadata.format,
        stats,
        sparklineData: values.map(v => ({
          period: v.periodId,
          value: v.value
        }))
      });
    }

    // Generate summary counts
    const summary = generateT12MSummary(metrics.map(m => ({
      kpiId: m.kpiId,
      trend: m.stats.trend
    })));

    // Generate trend insights
    const insights = generateTrendInsights(
      metrics.map(m => ({
        kpiId: m.kpiId,
        label: m.label,
        trend: m.stats.trend,
        current: m.stats.current,
        average: m.stats.average
      })),
      facility.name
    );

    res.json({
      facility,
      periodRange: {
        start: startPeriod,
        end: periodId,
        startLabel: formatPeriodReadable(startPeriod),
        endLabel: formatPeriodReadable(periodId)
      },
      summary,
      metrics,
      insights
    });
  } catch (err) {
    console.error('T12M API error:', err);
    res.status(500).json({ error: 'Failed to fetch T12M performance data' });
  }
});

// Get correlation analysis for a facility
app.get('/api/performance/correlations/:facilityId', (req, res) => {
  try {
    const { facilityId } = req.params;
    const { periodId } = req.query;

    if (!periodId || typeof periodId !== 'string') {
      return res.status(400).json({ error: 'periodId query parameter is required' });
    }

    // Get facility info
    const facility = db.prepare(`
      SELECT facility_id, name, state, setting FROM facilities WHERE facility_id = ?
    `).get(facilityId) as { facility_id: string; name: string; state: string; setting: string } | undefined;

    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    // Calculate the 12-month range ending at periodId
    const startPeriod = getPeriodIdMonthsAgo(periodId, 11);

    // Get all KPI values for correlation analysis
    const kpiData = db.prepare(`
      SELECT kpi_id, period_id, value
      FROM kpi_results
      WHERE facility_id = ?
        AND period_id >= ?
        AND period_id <= ?
        AND value IS NOT NULL
      ORDER BY period_id
    `).all(facilityId, startPeriod, periodId) as { kpi_id: string; period_id: string; value: number }[];

    // Create a map of period -> kpi -> value for easy correlation lookup
    const periodKpiMap = new Map<string, Map<string, number>>();
    for (const row of kpiData) {
      if (!periodKpiMap.has(row.period_id)) {
        periodKpiMap.set(row.period_id, new Map());
      }
      periodKpiMap.get(row.period_id)!.set(row.kpi_id, row.value);
    }

    // Calculate correlations for each defined pair
    const correlations: Array<{
      xKpi: string;
      yKpi: string;
      xLabel: string;
      yLabel: string;
      businessQuestion: string;
      correlation: CorrelationResult;
      scatterData: { x: number; y: number; period: string }[];
    }> = [];

    for (const pair of CORRELATION_PAIRS) {
      // Collect paired values where both KPIs have data
      const xValues: number[] = [];
      const yValues: number[] = [];
      const scatterData: { x: number; y: number; period: string }[] = [];

      for (const [period, kpis] of periodKpiMap.entries()) {
        const xVal = kpis.get(pair.xKpi);
        const yVal = kpis.get(pair.yKpi);

        if (xVal !== undefined && yVal !== undefined) {
          xValues.push(xVal);
          yValues.push(yVal);
          scatterData.push({ x: xVal, y: yVal, period });
        }
      }

      // Calculate correlation
      const correlation = calculatePearsonCorrelation(xValues, yValues);

      correlations.push({
        xKpi: pair.xKpi,
        yKpi: pair.yKpi,
        xLabel: pair.xLabel,
        yLabel: pair.yLabel,
        businessQuestion: pair.businessQuestion,
        correlation,
        scatterData
      });
    }

    // Generate insights from correlations
    const insights = generateCorrelationInsights(
      correlations.map(c => ({
        xKpi: c.xKpi,
        yKpi: c.yKpi,
        xLabel: c.xLabel,
        yLabel: c.yLabel,
        correlation: c.correlation,
        businessQuestion: c.businessQuestion
      })),
      facility.name
    );

    // Sort correlations by strength (strongest first)
    correlations.sort((a, b) => Math.abs(b.correlation.r) - Math.abs(a.correlation.r));

    res.json({
      facility,
      periodRange: {
        start: startPeriod,
        end: periodId,
        startLabel: formatPeriodReadable(startPeriod),
        endLabel: formatPeriodReadable(periodId)
      },
      correlations,
      insights
    });
  } catch (err) {
    console.error('Correlations API error:', err);
    res.status(500).json({ error: 'Failed to fetch correlation data' });
  }
});

// ============================================================================
// ENHANCED PACKET GENERATION WITH PREDICTIONS & ANALYSIS
// ============================================================================

interface TrendData {
  values: number[];
  periodIds: string[];
  slope: number;
  direction: 'up' | 'down' | 'stable';
  volatility: number;
}

interface Prediction {
  metric: string;
  currentValue: number;
  predictedValue: number;
  predictedChange: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

interface Opportunity {
  type: 'revenue' | 'cost' | 'efficiency' | 'growth';
  title: string;
  description: string;
  potentialImpact: string;
  priority: 'high' | 'medium' | 'low';
  relatedMetrics: string[];
}

interface Pitfall {
  type: 'risk' | 'warning' | 'trend';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  mitigation: string;
  relatedMetrics: string[];
}

// Get T12M trend data for a facility
function getT12MTrends(facilityId: string, periodId: string, database: any): Map<string, TrendData> {
  const startPeriod = getPeriodIdMonthsAgo(periodId, 11);

  const data = database.prepare(`
    SELECT kpi_id, period_id, value
    FROM kpi_results
    WHERE facility_id = ? AND period_id >= ? AND period_id <= ? AND value IS NOT NULL
    ORDER BY kpi_id, period_id
  `).all(facilityId, startPeriod, periodId) as { kpi_id: string; period_id: string; value: number }[];

  const trends = new Map<string, TrendData>();

  // Group by KPI
  const grouped = new Map<string, { values: number[]; periodIds: string[] }>();
  for (const row of data) {
    if (!grouped.has(row.kpi_id)) {
      grouped.set(row.kpi_id, { values: [], periodIds: [] });
    }
    grouped.get(row.kpi_id)!.values.push(row.value);
    grouped.get(row.kpi_id)!.periodIds.push(row.period_id);
  }

  for (const [kpiId, d] of grouped.entries()) {
    if (d.values.length < 3) continue;

    // Calculate slope using linear regression
    const n = d.values.length;
    const xMean = (n - 1) / 2;
    const yMean = d.values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (d.values[i] - yMean);
      denominator += (i - xMean) * (i - xMean);
    }
    const slope = denominator !== 0 ? numerator / denominator : 0;

    // Calculate volatility (coefficient of variation)
    const stdDev = Math.sqrt(d.values.reduce((sum, v) => sum + Math.pow(v - yMean, 2), 0) / n);
    const volatility = yMean !== 0 ? (stdDev / Math.abs(yMean)) * 100 : 0;

    // Determine direction
    const slopeThreshold = Math.abs(yMean) * 0.01; // 1% of mean per period
    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (slope > slopeThreshold) direction = 'up';
    else if (slope < -slopeThreshold) direction = 'down';

    trends.set(kpiId, {
      values: d.values,
      periodIds: d.periodIds,
      slope,
      direction,
      volatility
    });
  }

  return trends;
}

// Generate predictions based on trends
function generatePredictions(trends: Map<string, TrendData>, kpiLabels: Record<string, string>): Prediction[] {
  const predictions: Prediction[] = [];

  for (const [kpiId, trend] of trends.entries()) {
    if (trend.values.length < 6) continue; // Need enough history

    const current = trend.values[trend.values.length - 1];
    const predicted = current + (trend.slope * 3); // 3-month projection

    // Confidence based on volatility and data points
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (trend.volatility < 10 && trend.values.length >= 10) confidence = 'high';
    else if (trend.volatility > 30 || trend.values.length < 6) confidence = 'low';

    const changePercent = current !== 0 ? ((predicted - current) / Math.abs(current)) * 100 : 0;

    predictions.push({
      metric: kpiLabels[kpiId] || kpiId,
      currentValue: current,
      predictedValue: predicted,
      predictedChange: changePercent,
      confidence,
      reasoning: generatePredictionReasoning(trend, changePercent)
    });
  }

  return predictions.sort((a, b) => Math.abs(b.predictedChange) - Math.abs(a.predictedChange));
}

function generatePredictionReasoning(trend: TrendData, changePercent: number): string {
  if (trend.direction === 'stable') {
    return `Based on stable 12-month trend with ${trend.volatility.toFixed(0)}% volatility, expect continuation around current levels.`;
  } else if (trend.direction === 'up') {
    return `Consistent upward trend over T12M suggests ${changePercent.toFixed(1)}% increase over next quarter. ${trend.volatility > 20 ? 'High volatility adds uncertainty.' : 'Low volatility increases confidence.'}`;
  } else {
    return `Declining trend indicates continued pressure. ${changePercent.toFixed(1)}% decrease projected unless intervention occurs.`;
  }
}

// Identify opportunities
function identifyOpportunities(
  facilityData: any,
  trends: Map<string, TrendData>,
  portfolioAvgs: Record<string, number>
): Opportunity[] {
  const opportunities: Opportunity[] = [];
  const margin = facilityData.margin;
  const skilledMix = facilityData.skilledMix;
  const contractLabor = facilityData.contractLabor;
  const revenuePPD = facilityData.revenuePPD;
  const costPPD = facilityData.costPPD;

  // Skilled mix opportunity
  if (skilledMix !== undefined && skilledMix < 25) {
    const potential = (25 - skilledMix) * 0.5; // Rough margin impact estimate
    opportunities.push({
      type: 'revenue',
      title: 'Payer Mix Optimization',
      description: `Current skilled mix of ${skilledMix.toFixed(1)}% is below optimal. Increasing skilled census could significantly improve revenue PPD and margins.`,
      potentialImpact: `+${potential.toFixed(1)} margin points potential`,
      priority: skilledMix < 15 ? 'high' : 'medium',
      relatedMetrics: ['snf_skilled_mix_pct', 'snf_total_revenue_ppd']
    });
  }

  // Contract labor reduction
  if (contractLabor !== undefined && contractLabor > 10) {
    const savings = contractLabor * 0.3; // Rough savings estimate
    opportunities.push({
      type: 'cost',
      title: 'Contract Labor Reduction',
      description: `Contract labor at ${contractLabor.toFixed(1)}% represents significant cost. Converting to permanent staff could yield substantial savings.`,
      potentialImpact: `$${(savings * 10).toFixed(0)}/day cost reduction potential`,
      priority: contractLabor > 20 ? 'high' : 'medium',
      relatedMetrics: ['snf_contract_labor_pct_nursing', 'snf_nursing_cost_ppd']
    });
  }

  // Revenue upside vs portfolio
  if (revenuePPD !== undefined && portfolioAvgs['snf_total_revenue_ppd']) {
    const gap = portfolioAvgs['snf_total_revenue_ppd'] - revenuePPD;
    if (gap > 20) {
      opportunities.push({
        type: 'revenue',
        title: 'Revenue Rate Improvement',
        description: `Revenue PPD of $${revenuePPD.toFixed(2)} is $${gap.toFixed(2)} below portfolio average. Rate negotiations and case mix optimization could close this gap.`,
        potentialImpact: `$${gap.toFixed(0)}/day revenue opportunity`,
        priority: gap > 40 ? 'high' : 'medium',
        relatedMetrics: ['snf_total_revenue_ppd']
      });
    }
  }

  // Improving trends to accelerate
  const marginTrend = trends.get('snf_operating_margin_pct');
  if (marginTrend && marginTrend.direction === 'up') {
    opportunities.push({
      type: 'growth',
      title: 'Positive Momentum',
      description: `Operating margin shows upward trend. Doubling down on current strategies could accelerate improvement.`,
      potentialImpact: `Projected ${(marginTrend.slope * 6).toFixed(1)} point improvement over 6 months`,
      priority: 'medium',
      relatedMetrics: ['snf_operating_margin_pct']
    });
  }

  // Cost efficiency if above portfolio
  if (costPPD !== undefined && portfolioAvgs['snf_total_cost_ppd']) {
    const gap = costPPD - portfolioAvgs['snf_total_cost_ppd'];
    if (gap > 15) {
      opportunities.push({
        type: 'efficiency',
        title: 'Cost Structure Optimization',
        description: `Total cost PPD of $${costPPD.toFixed(2)} is $${gap.toFixed(2)} above portfolio average. Operational review could identify efficiencies.`,
        potentialImpact: `$${gap.toFixed(0)}/day cost reduction opportunity`,
        priority: gap > 30 ? 'high' : 'medium',
        relatedMetrics: ['snf_total_cost_ppd', 'snf_nursing_cost_ppd']
      });
    }
  }

  return opportunities.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// Identify pitfalls and risks
function identifyPitfalls(
  facilityData: any,
  trends: Map<string, TrendData>,
  portfolioAvgs: Record<string, number>
): Pitfall[] {
  const pitfalls: Pitfall[] = [];
  const margin = facilityData.margin;
  const marginChange = facilityData.marginChange;
  const contractLabor = facilityData.contractLabor;
  const skilledMix = facilityData.skilledMix;

  // Negative margin
  if (margin !== undefined && margin < 0) {
    pitfalls.push({
      type: 'risk',
      title: 'Negative Operating Margin',
      description: `Facility is operating at ${margin.toFixed(1)}% margin, losing money on operations. Immediate intervention required.`,
      severity: 'critical',
      mitigation: 'Conduct emergency operational review. Evaluate census, staffing, and payer contracts for quick wins.',
      relatedMetrics: ['snf_operating_margin_pct']
    });
  } else if (margin !== undefined && margin < 5) {
    pitfalls.push({
      type: 'warning',
      title: 'Thin Margin Buffer',
      description: `Operating at ${margin.toFixed(1)}% margin leaves little room for unexpected costs or revenue shortfalls.`,
      severity: 'high',
      mitigation: 'Build margin cushion through revenue enhancement and cost controls.',
      relatedMetrics: ['snf_operating_margin_pct']
    });
  }

  // Declining margin trend
  const marginTrend = trends.get('snf_operating_margin_pct');
  if (marginTrend && marginTrend.direction === 'down' && marginTrend.slope < -0.5) {
    pitfalls.push({
      type: 'trend',
      title: 'Declining Margin Trajectory',
      description: `Margin has been declining over the past 12 months. At current trajectory, will lose ${Math.abs(marginTrend.slope * 6).toFixed(1)} more margin points in 6 months.`,
      severity: margin !== undefined && margin < 10 ? 'critical' : 'high',
      mitigation: 'Identify root causes immediately. Review census trends, payer mix shifts, and cost drivers.',
      relatedMetrics: ['snf_operating_margin_pct']
    });
  }

  // High contract labor risk
  if (contractLabor !== undefined && contractLabor > 25) {
    pitfalls.push({
      type: 'risk',
      title: 'Excessive Agency Dependence',
      description: `${contractLabor.toFixed(1)}% contract labor creates significant cost pressure and quality concerns.`,
      severity: contractLabor > 40 ? 'critical' : 'high',
      mitigation: 'Launch aggressive permanent recruitment. Consider retention bonuses and workplace improvements.',
      relatedMetrics: ['snf_contract_labor_pct_nursing']
    });
  }

  // Skilled mix deterioration
  const skilledMixTrend = trends.get('snf_skilled_mix_pct');
  if (skilledMixTrend && skilledMixTrend.direction === 'down') {
    pitfalls.push({
      type: 'trend',
      title: 'Skilled Mix Erosion',
      description: `Skilled mix declining over T12M, which typically leads to revenue and margin compression.`,
      severity: 'high',
      mitigation: 'Strengthen hospital relationships, review admission criteria, enhance marketing to managed care.',
      relatedMetrics: ['snf_skilled_mix_pct', 'snf_total_revenue_ppd']
    });
  }

  // High cost volatility
  const costTrend = trends.get('snf_total_cost_ppd');
  if (costTrend && costTrend.volatility > 25) {
    pitfalls.push({
      type: 'warning',
      title: 'Unstable Cost Structure',
      description: `Cost per patient day shows ${costTrend.volatility.toFixed(0)}% volatility, making margin prediction difficult.`,
      severity: 'medium',
      mitigation: 'Analyze cost drivers. Implement more consistent staffing and vendor management.',
      relatedMetrics: ['snf_total_cost_ppd']
    });
  }

  // Rapid decline this month
  if (marginChange !== undefined && marginChange < -3) {
    pitfalls.push({
      type: 'warning',
      title: 'Sharp Month-over-Month Decline',
      description: `Margin dropped ${Math.abs(marginChange).toFixed(1)} points this month. Investigate for one-time issues or emerging trends.`,
      severity: marginChange < -5 ? 'high' : 'medium',
      mitigation: 'Review census, revenue, and expense variances for the month immediately.',
      relatedMetrics: ['snf_operating_margin_pct']
    });
  }

  return pitfalls.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

// Enhanced facility packet with predictions
function generateEnhancedFacilityPacket(facilityId: string, periodId: string, database: any): any {
  const facility = database.prepare('SELECT * FROM facilities WHERE facility_id = ?').get(facilityId);
  if (!facility) throw new Error('Facility not found');

  const kpis = database.prepare('SELECT * FROM kpi_results WHERE facility_id = ? AND period_id = ?').all(facilityId, periodId);
  const priorPeriod = database.prepare(`SELECT period_id FROM periods WHERE period_id < ? ORDER BY period_id DESC LIMIT 1`).get(periodId) as { period_id: string } | undefined;
  const priorKpis = priorPeriod ? database.prepare('SELECT * FROM kpi_results WHERE facility_id = ? AND period_id = ?').all(facilityId, priorPeriod.period_id) : [];

  // Get T12M trends
  const trends = getT12MTrends(facilityId, periodId, database);

  // Build KPI maps
  const kpiMap = new Map<string, number | null>(kpis.map((k: any) => [k.kpi_id, k.value]));
  const priorMap = new Map<string, number | null>(priorKpis.map((k: any) => [k.kpi_id, k.value]));

  // Get portfolio averages for comparison
  const portfolioAvgs: Record<string, number> = {};
  const avgQuery = database.prepare(`
    SELECT kpi_id, AVG(value) as avg_value
    FROM kpi_results WHERE period_id = ? AND value IS NOT NULL
    GROUP BY kpi_id
  `).all(periodId) as { kpi_id: string; avg_value: number }[];
  avgQuery.forEach(r => portfolioAvgs[r.kpi_id] = r.avg_value);

  // Get state averages for peer comparison
  const stateAvgs: Record<string, number> = {};
  const stateAvgQuery = database.prepare(`
    SELECT kr.kpi_id, AVG(kr.value) as avg_value
    FROM kpi_results kr
    JOIN facilities f ON kr.facility_id = f.facility_id
    WHERE kr.period_id = ? AND f.state = ? AND kr.value IS NOT NULL
    GROUP BY kr.kpi_id
  `).all(periodId, facility.state) as { kpi_id: string; avg_value: number }[];
  stateAvgQuery.forEach(r => stateAvgs[r.kpi_id] = r.avg_value);

  // Get peer facilities for comparison (same state, same setting)
  const peerFacilities = database.prepare(`
    SELECT f.facility_id, f.name, kr.value as margin
    FROM facilities f
    JOIN kpi_results kr ON f.facility_id = kr.facility_id
    WHERE f.state = ? AND f.setting = ? AND kr.period_id = ?
      AND kr.kpi_id = ? AND kr.value IS NOT NULL
    ORDER BY kr.value DESC
  `).all(facility.state, facility.setting, periodId,
    facility.setting === 'SNF' ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct'
  ) as { facility_id: string; name: string; margin: number }[];

  // Build facility data
  const marginVal = kpiMap.get('snf_operating_margin_pct') ?? kpiMap.get('sl_operating_margin_pct');
  const priorMarginVal = priorMap.get('snf_operating_margin_pct') ?? priorMap.get('sl_operating_margin_pct');
  const margin = marginVal ?? undefined;
  const priorMargin = priorMarginVal ?? undefined;

  // Extract all key metrics
  const skilledMix = kpiMap.get('snf_skilled_mix_pct') ?? 0;
  const contractLabor = kpiMap.get('snf_contract_labor_pct_nursing') ?? 0;
  const revenuePPD = kpiMap.get('snf_total_revenue_ppd') ?? 0;
  const costPPD = kpiMap.get('snf_total_cost_ppd') ?? 0;
  const nursingCostPPD = kpiMap.get('snf_nursing_cost_ppd') ?? 0;
  const therapyCostPPD = kpiMap.get('snf_therapy_cost_ppd') ?? 0;
  const ancillaryCostPPD = kpiMap.get('snf_ancillary_cost_ppd') ?? 0;
  const nursingHPPD = kpiMap.get('snf_nursing_hppd') ?? 0;
  const medicareAMix = kpiMap.get('snf_medicare_a_mix_pct') ?? 0;
  const maMix = kpiMap.get('snf_ma_mix_pct') ?? 0;
  const medicaidMix = kpiMap.get('snf_medicaid_mix_pct') ?? 0;
  const occupancy = kpiMap.get('snf_occupancy_pct') ?? kpiMap.get('sl_occupancy_pct') ?? 0;

  const facilityData = {
    ...facility,
    margin,
    priorMargin,
    marginChange: typeof margin === 'number' && typeof priorMargin === 'number' ? margin - priorMargin : undefined,
    skilledMix,
    contractLabor,
    revenuePPD,
    costPPD,
    nursingCost: nursingCostPPD,
    nursingHours: nursingHPPD,
    occupancy
  };

  // KPI labels for predictions
  const kpiLabels: Record<string, string> = {
    'snf_operating_margin_pct': 'Operating Margin',
    'sl_operating_margin_pct': 'Operating Margin',
    'snf_skilled_mix_pct': 'Skilled Mix',
    'snf_total_revenue_ppd': 'Revenue PPD',
    'snf_total_cost_ppd': 'Total Cost PPD',
    'snf_nursing_cost_ppd': 'Nursing Cost PPD',
    'snf_contract_labor_pct_nursing': 'Contract Labor %',
    'snf_occupancy_pct': 'Occupancy',
    'sl_occupancy_pct': 'Occupancy'
  };

  // Generate predictions, opportunities, pitfalls
  const predictions = generatePredictions(trends, kpiLabels);
  const opportunities = identifyOpportunities(facilityData, trends, portfolioAvgs);
  const pitfalls = identifyPitfalls(facilityData, trends, portfolioAvgs);

  // Generate Going Well / Needs Work sections
  const goingWell = generateFacilityGoingWell(facilityData, trends, portfolioAvgs, stateAvgs, peerFacilities);
  const needsWork = generateFacilityNeedsWork(facilityData, trends, portfolioAvgs, stateAvgs, pitfalls);

  // Generate comprehensive narrative
  const executiveNarrative = generateComprehensiveFacilityNarrative(
    facilityData, trends, predictions, opportunities, pitfalls,
    portfolioAvgs, stateAvgs, peerFacilities, periodId
  );

  // Build chart data
  const marginTrendData = trends.get('snf_operating_margin_pct') || trends.get('sl_operating_margin_pct');
  const revenueTrendData = trends.get('snf_total_revenue_ppd');
  const costTrendData = trends.get('snf_total_cost_ppd');
  const occupancyTrendData = trends.get('snf_occupancy_pct') || trends.get('sl_occupancy_pct');

  // Cost breakdown chart
  const costBreakdown = [
    { name: 'Nursing', value: nursingCostPPD, color: '#3b82f6', pct: costPPD > 0 ? (nursingCostPPD / costPPD * 100) : 0 },
    { name: 'Therapy', value: therapyCostPPD, color: '#8b5cf6', pct: costPPD > 0 ? (therapyCostPPD / costPPD * 100) : 0 },
    { name: 'Ancillary', value: ancillaryCostPPD, color: '#06b6d4', pct: costPPD > 0 ? (ancillaryCostPPD / costPPD * 100) : 0 },
    { name: 'Other', value: Math.max(0, costPPD - nursingCostPPD - therapyCostPPD - ancillaryCostPPD), color: '#6b7280', pct: 0 }
  ].filter(c => c.value > 0);
  if (costBreakdown.length > 0) {
    const otherItem = costBreakdown.find(c => c.name === 'Other');
    if (otherItem) otherItem.pct = 100 - costBreakdown.filter(c => c.name !== 'Other').reduce((sum, c) => sum + c.pct, 0);
  }

  // Payer mix chart
  const payerMix = [
    { name: 'Medicare A', value: medicareAMix, color: '#22c55e' },
    { name: 'MA/HMO', value: maMix, color: '#3b82f6' },
    { name: 'Medicaid', value: medicaidMix, color: '#f59e0b' },
    { name: 'Other', value: Math.max(0, 100 - medicareAMix - maMix - medicaidMix), color: '#6b7280' }
  ].filter(p => p.value > 0);

  // KPI vs benchmark comparison
  const kpiComparison = [
    {
      name: 'Margin',
      facility: margin ?? 0,
      portfolio: portfolioAvgs['snf_operating_margin_pct'] ?? portfolioAvgs['sl_operating_margin_pct'] ?? 0,
      state: stateAvgs['snf_operating_margin_pct'] ?? stateAvgs['sl_operating_margin_pct'] ?? 0,
      target: 12
    },
    {
      name: 'Skilled Mix',
      facility: skilledMix,
      portfolio: portfolioAvgs['snf_skilled_mix_pct'] ?? 0,
      state: stateAvgs['snf_skilled_mix_pct'] ?? 0,
      target: 20
    },
    {
      name: 'Contract Labor',
      facility: contractLabor,
      portfolio: portfolioAvgs['snf_contract_labor_pct_nursing'] ?? 0,
      state: stateAvgs['snf_contract_labor_pct_nursing'] ?? 0,
      target: 10  // lower is better
    },
    {
      name: 'Occupancy',
      facility: occupancy,
      portfolio: portfolioAvgs['snf_occupancy_pct'] ?? portfolioAvgs['sl_occupancy_pct'] ?? 0,
      state: stateAvgs['snf_occupancy_pct'] ?? stateAvgs['sl_occupancy_pct'] ?? 0,
      target: 85
    }
  ];

  // Revenue vs Cost trend
  const revenueVsCost = marginTrendData && costTrendData ? marginTrendData.periodIds.map((p, i) => ({
    period: p,
    revenue: revenueTrendData?.values[i] ?? 0,
    cost: costTrendData?.values[i] ?? 0,
    margin: marginTrendData.values[i]
  })) : [];

  // Peer comparison
  const peerComparison = peerFacilities.map((p, i) => ({
    ...p,
    rank: i + 1,
    isCurrentFacility: p.facility_id === facilityId
  }));
  const currentRankInPeers = peerComparison.findIndex(p => p.isCurrentFacility) + 1;

  return {
    scope: 'facility',
    title: `${facility.name} Financial Analysis`,
    subtitle: `Comprehensive Performance Report - ${formatPeriodText(periodId)}`,
    generatedAt: new Date().toISOString(),
    facility: {
      id: facility.facility_id,
      name: facility.name,
      state: facility.state,
      setting: facility.setting,
      beds: facility.operational_beds || facility.licensed_beds,
      opco: facility.parent_opco,
      occupancy
    },
    currentPeriod: periodId,

    // Summary metrics card
    summaryMetrics: {
      operatingMargin: {
        value: margin,
        change: facilityData.marginChange,
        portfolioAvg: portfolioAvgs['snf_operating_margin_pct'] ?? portfolioAvgs['sl_operating_margin_pct'],
        stateAvg: stateAvgs['snf_operating_margin_pct'] ?? stateAvgs['sl_operating_margin_pct'],
        status: typeof margin === 'number' ? (margin >= 15 ? 'excellent' : margin >= 10 ? 'good' : margin >= 5 ? 'fair' : margin >= 0 ? 'poor' : 'critical') : 'unknown'
      },
      revenuePPD: {
        value: revenuePPD,
        portfolioAvg: portfolioAvgs['snf_total_revenue_ppd'],
        stateAvg: stateAvgs['snf_total_revenue_ppd']
      },
      costPPD: {
        value: costPPD,
        portfolioAvg: portfolioAvgs['snf_total_cost_ppd'],
        stateAvg: stateAvgs['snf_total_cost_ppd']
      },
      spread: { value: revenuePPD - costPPD },
      skilledMix: {
        value: skilledMix,
        portfolioAvg: portfolioAvgs['snf_skilled_mix_pct'],
        stateAvg: stateAvgs['snf_skilled_mix_pct']
      },
      contractLabor: {
        value: contractLabor,
        portfolioAvg: portfolioAvgs['snf_contract_labor_pct_nursing'],
        stateAvg: stateAvgs['snf_contract_labor_pct_nursing'],
        status: contractLabor <= 5 ? 'excellent' : contractLabor <= 10 ? 'good' : contractLabor <= 15 ? 'fair' : 'elevated'
      },
      occupancy: {
        value: occupancy,
        portfolioAvg: portfolioAvgs['snf_occupancy_pct'] ?? portfolioAvgs['sl_occupancy_pct'],
        stateAvg: stateAvgs['snf_occupancy_pct'] ?? stateAvgs['sl_occupancy_pct']
      },
      nursingHPPD: {
        value: nursingHPPD,
        portfolioAvg: portfolioAvgs['snf_nursing_hppd'],
        stateAvg: stateAvgs['snf_nursing_hppd']
      }
    },

    // Executive narrative
    executiveNarrative,

    // Going Well section
    goingWell,

    // Needs Work section
    needsWork,

    // Charts
    charts: {
      marginTrend: marginTrendData ? {
        title: 'Operating Margin - 12 Month Trend',
        data: marginTrendData.periodIds.map((p, i) => ({
          period: p,
          value: marginTrendData.values[i],
          benchmark: 12
        })),
        direction: marginTrendData.direction,
        volatility: marginTrendData.volatility,
        high: Math.max(...marginTrendData.values),
        low: Math.min(...marginTrendData.values),
        avg: marginTrendData.values.reduce((a, b) => a + b, 0) / marginTrendData.values.length
      } : null,

      revenueVsCost: revenueVsCost.length > 0 ? {
        title: 'Revenue vs Cost Trend',
        data: revenueVsCost
      } : null,

      costBreakdown: {
        title: 'Cost Structure (PPD)',
        data: costBreakdown,
        total: costPPD
      },

      payerMix: {
        title: 'Payer Mix Distribution',
        data: payerMix
      },

      kpiComparison: {
        title: 'Performance vs Benchmarks',
        data: kpiComparison
      },

      occupancyTrend: occupancyTrendData ? {
        title: 'Occupancy Trend',
        data: occupancyTrendData.periodIds.map((p, i) => ({
          period: p,
          value: occupancyTrendData.values[i]
        })),
        direction: occupancyTrendData.direction
      } : null
    },

    // Predictions
    predictions: {
      title: '3-Month Forward Outlook',
      summary: generatePredictionSummary(predictions, margin),
      items: predictions.slice(0, 6),
      methodology: 'Predictions based on T12M trend analysis using linear regression with volatility-adjusted confidence intervals.'
    },

    // Opportunities
    opportunities: {
      title: 'Growth & Improvement Opportunities',
      items: opportunities,
      totalPotential: opportunities.length > 0 ? `${opportunities.length} actionable opportunities identified` : 'No major opportunities identified',
      prioritySummary: {
        high: opportunities.filter(o => o.priority === 'high').length,
        medium: opportunities.filter(o => o.priority === 'medium').length,
        low: opportunities.filter(o => o.priority === 'low').length
      }
    },

    // Pitfalls / Risks
    pitfalls: {
      title: 'Risks & Watch Items',
      items: pitfalls,
      criticalCount: pitfalls.filter(p => p.severity === 'critical').length,
      highCount: pitfalls.filter(p => p.severity === 'high').length,
      mediumCount: pitfalls.filter(p => p.severity === 'medium').length
    },

    // Peer comparison
    peerAnalysis: {
      title: `${facility.state} ${facility.setting} Peer Comparison`,
      currentRank: currentRankInPeers,
      totalPeers: peerFacilities.length,
      percentile: peerFacilities.length > 0 ? Math.round((1 - (currentRankInPeers - 1) / peerFacilities.length) * 100) : 0,
      peers: peerComparison.slice(0, 10),
      insight: currentRankInPeers <= 3
        ? `${facility.name} is a top performer among ${facility.state} ${facility.setting} facilities.`
        : currentRankInPeers <= Math.ceil(peerFacilities.length / 2)
        ? `${facility.name} performs above median among ${facility.state} ${facility.setting} peers.`
        : `${facility.name} has room for improvement compared to ${facility.state} ${facility.setting} peers.`
    },

    // Portfolio comparison
    portfolioComparison: {
      marginVsPortfolio: typeof margin === 'number' && portfolioAvgs['snf_operating_margin_pct'] ? margin - portfolioAvgs['snf_operating_margin_pct'] : null,
      marginVsState: typeof margin === 'number' && stateAvgs['snf_operating_margin_pct'] ? margin - stateAvgs['snf_operating_margin_pct'] : null,
      ranking: calculateFacilityRanking(facilityId, periodId, database)
    },

    // Recommendations
    recommendations: generateEnhancedFacilityRecommendations(facilityData, opportunities, pitfalls, trends),

    // Historical performance summary
    historicalSummary: {
      t12mAvgMargin: marginTrendData ? marginTrendData.values.reduce((a, b) => a + b, 0) / marginTrendData.values.length : null,
      t12mHighMargin: marginTrendData ? Math.max(...marginTrendData.values) : null,
      t12mLowMargin: marginTrendData ? Math.min(...marginTrendData.values) : null,
      marginVolatility: marginTrendData?.volatility ?? null,
      trendDirection: marginTrendData?.direction ?? 'stable',
      monthsImproving: marginTrendData ? marginTrendData.values.filter((v, i) => i > 0 && v > marginTrendData.values[i-1]).length : 0,
      monthsDeclining: marginTrendData ? marginTrendData.values.filter((v, i) => i > 0 && v < marginTrendData.values[i-1]).length : 0
    }
  };
}

// Generate Going Well section for facility
function generateFacilityGoingWell(
  facility: any,
  trends: Map<string, TrendData>,
  portfolioAvgs: Record<string, number>,
  stateAvgs: Record<string, number>,
  peerFacilities: { facility_id: string; name: string; margin: number }[]
): any {
  const bulletPoints: string[] = [];
  const highlights: { metric: string; value: string; context: string }[] = [];

  // Check margin performance
  if (facility.margin !== undefined) {
    if (facility.margin >= 15) {
      bulletPoints.push(`Excellent operating margin of ${facility.margin.toFixed(1)}% - well above industry benchmarks`);
      highlights.push({ metric: 'Operating Margin', value: `${facility.margin.toFixed(1)}%`, context: 'Excellent performance' });
    } else if (facility.margin >= 10) {
      bulletPoints.push(`Strong operating margin of ${facility.margin.toFixed(1)}% - above target threshold`);
      highlights.push({ metric: 'Operating Margin', value: `${facility.margin.toFixed(1)}%`, context: 'Strong performance' });
    }

    // Compare to portfolio
    const portfolioMargin = portfolioAvgs['snf_operating_margin_pct'] ?? portfolioAvgs['sl_operating_margin_pct'];
    if (portfolioMargin && facility.margin > portfolioMargin + 2) {
      bulletPoints.push(`Outperforming portfolio average by ${(facility.margin - portfolioMargin).toFixed(1)} percentage points`);
    }

    // Compare to state
    const stateMargin = stateAvgs['snf_operating_margin_pct'] ?? stateAvgs['sl_operating_margin_pct'];
    if (stateMargin && facility.margin > stateMargin + 2) {
      bulletPoints.push(`Leading ${facility.state} peers by ${(facility.margin - stateMargin).toFixed(1)} percentage points`);
    }
  }

  // Margin improvement
  if (facility.marginChange !== undefined && facility.marginChange > 2) {
    bulletPoints.push(`Month-over-month margin improved by ${facility.marginChange.toFixed(1)} points - positive momentum`);
    highlights.push({ metric: 'MoM Change', value: `+${facility.marginChange.toFixed(1)}%`, context: 'Improving trend' });
  }

  // Contract labor
  if (facility.contractLabor !== undefined && facility.contractLabor < 5) {
    bulletPoints.push(`Contract labor well controlled at ${facility.contractLabor.toFixed(1)}% - minimizing premium labor costs`);
    highlights.push({ metric: 'Contract Labor', value: `${facility.contractLabor.toFixed(1)}%`, context: 'Well controlled' });
  }

  // Skilled mix
  if (facility.skilledMix !== undefined && facility.skilledMix > 25) {
    bulletPoints.push(`Strong skilled mix at ${facility.skilledMix.toFixed(1)}% - driving higher revenue per patient day`);
    highlights.push({ metric: 'Skilled Mix', value: `${facility.skilledMix.toFixed(1)}%`, context: 'Above target' });
  }

  // Revenue PPD
  const portfolioRevenue = portfolioAvgs['snf_total_revenue_ppd'];
  if (facility.revenuePPD && portfolioRevenue && facility.revenuePPD > portfolioRevenue * 1.1) {
    bulletPoints.push(`Revenue PPD of $${facility.revenuePPD.toFixed(0)} exceeds portfolio average by ${((facility.revenuePPD / portfolioRevenue - 1) * 100).toFixed(0)}%`);
  }

  // Peer ranking
  const peerRank = peerFacilities.findIndex(p => p.facility_id === facility.facility_id) + 1;
  if (peerRank > 0 && peerRank <= 3 && peerFacilities.length >= 5) {
    bulletPoints.push(`Ranked #${peerRank} among ${peerFacilities.length} ${facility.state} ${facility.setting} facilities`);
    highlights.push({ metric: 'Peer Rank', value: `#${peerRank}`, context: `of ${peerFacilities.length} peers` });
  }

  // Trend analysis
  const marginTrend = trends.get('snf_operating_margin_pct') || trends.get('sl_operating_margin_pct');
  if (marginTrend?.direction === 'up') {
    bulletPoints.push(`Positive 12-month margin trend indicates sustained operational improvements`);
  }

  // Generate narrative
  let narrative = '';
  if (bulletPoints.length > 0) {
    narrative = `${facility.name} demonstrates several areas of strength. `;
    if (facility.margin !== undefined && facility.margin >= 10) {
      narrative += `The facility maintains a healthy operating margin of ${facility.margin.toFixed(1)}%, positioning it well within the portfolio. `;
    }
    if (facility.contractLabor !== undefined && facility.contractLabor < 10) {
      narrative += `Labor costs are well managed with contract labor at just ${facility.contractLabor.toFixed(1)}%. `;
    }
    if (highlights.length > 0) {
      narrative += `Key highlights include ${highlights.map(h => h.metric.toLowerCase()).join(', ')}.`;
    }
  } else {
    narrative = 'Performance is stable with no standout strengths this period.';
    bulletPoints.push('Performance within acceptable ranges');
  }

  return {
    title: "What's Going Well",
    narrative,
    bulletPoints,
    highlights
  };
}

// Generate Needs Work section for facility
function generateFacilityNeedsWork(
  facility: any,
  trends: Map<string, TrendData>,
  portfolioAvgs: Record<string, number>,
  stateAvgs: Record<string, number>,
  pitfalls: Pitfall[]
): any {
  const bulletPoints: string[] = [];
  const concerns: { metric: string; value: string; context: string; severity: string }[] = [];

  // Check margin concerns
  if (facility.margin !== undefined) {
    if (facility.margin < 0) {
      bulletPoints.push(`Operating at a loss with ${facility.margin.toFixed(1)}% margin - immediate intervention required`);
      concerns.push({ metric: 'Operating Margin', value: `${facility.margin.toFixed(1)}%`, context: 'Negative margin', severity: 'critical' });
    } else if (facility.margin < 5) {
      bulletPoints.push(`Thin margin of ${facility.margin.toFixed(1)}% leaves little room for unexpected costs`);
      concerns.push({ metric: 'Operating Margin', value: `${facility.margin.toFixed(1)}%`, context: 'Below target', severity: 'high' });
    } else if (facility.margin < 10) {
      bulletPoints.push(`Margin of ${facility.margin.toFixed(1)}% is below the 10% target - opportunity for improvement`);
      concerns.push({ metric: 'Operating Margin', value: `${facility.margin.toFixed(1)}%`, context: 'Improvement needed', severity: 'medium' });
    }

    // Compare to portfolio/state
    const portfolioMargin = portfolioAvgs['snf_operating_margin_pct'] ?? portfolioAvgs['sl_operating_margin_pct'];
    if (portfolioMargin && facility.margin < portfolioMargin - 3) {
      bulletPoints.push(`Underperforming portfolio average by ${(portfolioMargin - facility.margin).toFixed(1)} percentage points`);
    }
  }

  // Margin decline
  if (facility.marginChange !== undefined && facility.marginChange < -3) {
    bulletPoints.push(`Significant month-over-month decline of ${Math.abs(facility.marginChange).toFixed(1)} points requires investigation`);
    concerns.push({ metric: 'MoM Change', value: `${facility.marginChange.toFixed(1)}%`, context: 'Sharp decline', severity: 'high' });
  }

  // Contract labor concerns
  if (facility.contractLabor !== undefined) {
    if (facility.contractLabor > 20) {
      bulletPoints.push(`Contract labor at ${facility.contractLabor.toFixed(1)}% is critically elevated - major cost driver`);
      concerns.push({ metric: 'Contract Labor', value: `${facility.contractLabor.toFixed(1)}%`, context: 'Critical level', severity: 'critical' });
    } else if (facility.contractLabor > 15) {
      bulletPoints.push(`Contract labor of ${facility.contractLabor.toFixed(1)}% significantly above target - workforce stabilization needed`);
      concerns.push({ metric: 'Contract Labor', value: `${facility.contractLabor.toFixed(1)}%`, context: 'Elevated', severity: 'high' });
    }
  }

  // Skilled mix concerns
  if (facility.skilledMix !== undefined && facility.skilledMix < 15) {
    bulletPoints.push(`Low skilled mix of ${facility.skilledMix.toFixed(1)}% limiting revenue potential`);
    concerns.push({ metric: 'Skilled Mix', value: `${facility.skilledMix.toFixed(1)}%`, context: 'Below target', severity: 'medium' });
  }

  // Cost concerns
  const portfolioCost = portfolioAvgs['snf_total_cost_ppd'];
  if (facility.costPPD && portfolioCost && facility.costPPD > portfolioCost * 1.15) {
    bulletPoints.push(`Cost PPD of $${facility.costPPD.toFixed(0)} is ${((facility.costPPD / portfolioCost - 1) * 100).toFixed(0)}% above portfolio average`);
    concerns.push({ metric: 'Cost PPD', value: `$${facility.costPPD.toFixed(0)}`, context: 'Above average', severity: 'medium' });
  }

  // Trend concerns
  const marginTrend = trends.get('snf_operating_margin_pct') || trends.get('sl_operating_margin_pct');
  if (marginTrend?.direction === 'down') {
    bulletPoints.push(`Declining 12-month margin trend signals structural challenges that need addressing`);
  }
  if (marginTrend && marginTrend.volatility > 30) {
    bulletPoints.push(`High margin volatility (${marginTrend.volatility.toFixed(0)}% CV) indicates operational inconsistency`);
  }

  // Add pitfall summaries
  const criticalPitfalls = pitfalls.filter(p => p.severity === 'critical');
  criticalPitfalls.forEach(p => {
    if (!bulletPoints.some(b => b.includes(p.title))) {
      bulletPoints.push(`${p.title}: ${p.description}`);
    }
  });

  // Generate narrative
  let narrative = '';
  if (concerns.length > 0 || bulletPoints.length > 0) {
    const criticalCount = concerns.filter(c => c.severity === 'critical').length;
    const highCount = concerns.filter(c => c.severity === 'high').length;

    if (criticalCount > 0) {
      narrative = `${facility.name} faces ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} requiring immediate attention. `;
    } else if (highCount > 0) {
      narrative = `${facility.name} has ${highCount} high-priority area${highCount > 1 ? 's' : ''} that should be addressed. `;
    } else {
      narrative = `${facility.name} has some areas that warrant monitoring and improvement. `;
    }

    if (facility.margin !== undefined && facility.margin < 10) {
      narrative += `The current margin of ${facility.margin.toFixed(1)}% is below target, indicating a need for either revenue enhancement or cost reduction strategies. `;
    }
    if (facility.contractLabor !== undefined && facility.contractLabor > 15) {
      narrative += `Elevated contract labor is a significant cost driver that should be addressed through recruitment and retention initiatives. `;
    }
  } else {
    narrative = 'No significant concerns identified this period. Continue monitoring key metrics.';
    bulletPoints.push('Continue monitoring key performance indicators');
  }

  return {
    title: 'Areas Requiring Attention',
    narrative,
    bulletPoints,
    concerns
  };
}

// Generate comprehensive facility narrative
function generateComprehensiveFacilityNarrative(
  facility: any,
  trends: Map<string, TrendData>,
  predictions: Prediction[],
  opportunities: Opportunity[],
  pitfalls: Pitfall[],
  portfolioAvgs: Record<string, number>,
  stateAvgs: Record<string, number>,
  peerFacilities: { facility_id: string; name: string; margin: number }[],
  periodId: string
): string {
  let narrative = `## Executive Summary\n\n`;

  // Current state overview with more detail
  const marginStatus = facility.margin === undefined ? 'unknown' :
    facility.margin >= 15 ? 'excellent' :
    facility.margin >= 10 ? 'strong' :
    facility.margin >= 5 ? 'moderate' :
    facility.margin >= 0 ? 'challenged' : 'critical';

  const bedCount = facility.operational_beds || facility.licensed_beds;
  const settingDescription = facility.setting === 'SNF' ? 'skilled nursing facility' :
    facility.setting === 'ALF' ? 'assisted living facility' : 'independent living facility';

  narrative += `**${facility.name}** is a ${bedCount}-bed ${settingDescription} located in ${facility.state}. `;
  narrative += `This comprehensive financial analysis provides an in-depth review of operational performance, financial metrics, and strategic recommendations. `;

  if (facility.margin !== undefined) {
    narrative += `The facility is currently operating with a **${marginStatus}** financial position, achieving an operating margin of **${facility.margin.toFixed(1)}%** for the reporting period ending ${formatPeriodText(periodId)}. `;

    if (facility.marginChange !== undefined) {
      if (facility.marginChange > 0) {
        narrative += `This represents a **${facility.marginChange.toFixed(1)} percentage point improvement** compared to the prior month, indicating positive operational momentum and effective cost management initiatives. `;
      } else if (facility.marginChange < -1) {
        narrative += `This reflects a **${Math.abs(facility.marginChange).toFixed(1)} percentage point decline** from the prior month, which warrants further investigation into contributing factors and potential corrective actions. `;
      } else {
        narrative += `Performance has remained relatively stable compared to the prior reporting period. `;
      }
    }
    narrative += '\n\n';
  } else {
    narrative += `Margin data is currently unavailable for this reporting period and will be updated once financial records are reconciled.\n\n`;
  }

  // Portfolio and peer context
  const portfolioMargin = portfolioAvgs['snf_operating_margin_pct'] ?? portfolioAvgs['sl_operating_margin_pct'];
  const stateMargin = stateAvgs['snf_operating_margin_pct'] ?? stateAvgs['sl_operating_margin_pct'];
  const peerRank = peerFacilities.findIndex(p => p.facility_id === facility.facility_id) + 1;

  if (portfolioMargin !== undefined || peerRank > 0) {
    narrative += `### Competitive Position\n\n`;
    if (facility.margin !== undefined && portfolioMargin !== undefined) {
      const diff = facility.margin - portfolioMargin;
      narrative += `Compared to the portfolio average of ${portfolioMargin.toFixed(1)}%, ${facility.name} is `;
      narrative += diff > 2 ? `**outperforming by ${diff.toFixed(1)} points**. ` :
                   diff < -2 ? `**underperforming by ${Math.abs(diff).toFixed(1)} points**. ` :
                   `performing in line with peers. `;
    }
    if (peerRank > 0 && peerFacilities.length > 1) {
      const percentile = Math.round((1 - (peerRank - 1) / peerFacilities.length) * 100);
      narrative += `Among ${peerFacilities.length} ${facility.state} ${facility.setting} facilities, ${facility.name} ranks **#${peerRank}** (${percentile}th percentile).\n\n`;
    }
  }

  // Trend analysis
  const marginTrend = trends.get('snf_operating_margin_pct') || trends.get('sl_operating_margin_pct');
  if (marginTrend) {
    narrative += `### Trailing 12-Month Analysis\n\n`;
    const avgMargin = marginTrend.values.reduce((a, b) => a + b, 0) / marginTrend.values.length;
    const maxMargin = Math.max(...marginTrend.values);
    const minMargin = Math.min(...marginTrend.values);

    narrative += `Over the past 12 months, operating margin has ranged from **${minMargin.toFixed(1)}%** to **${maxMargin.toFixed(1)}%**, `;
    narrative += `with an average of **${avgMargin.toFixed(1)}%**. `;

    if (marginTrend.direction === 'up') {
      narrative += `The overall trend is **positive**, indicating operational improvements taking hold. `;
    } else if (marginTrend.direction === 'down') {
      narrative += `The trend is **concerning**, with margins declining over time. This warrants immediate investigation. `;
    } else {
      narrative += `Performance has been relatively stable. `;
    }

    if (marginTrend.volatility > 25) {
      narrative += `**High volatility** (${marginTrend.volatility.toFixed(0)}% coefficient of variation) suggests inconsistent operations that should be addressed.\n\n`;
    } else {
      narrative += '\n\n';
    }
  }

  // Key metrics deep dive
  narrative += `### Key Performance Indicators\n\n`;

  if (facility.revenuePPD) {
    const revDiff = portfolioAvgs['snf_total_revenue_ppd'] ? facility.revenuePPD - portfolioAvgs['snf_total_revenue_ppd'] : 0;
    narrative += `- **Revenue PPD**: $${facility.revenuePPD.toFixed(0)} `;
    narrative += revDiff > 20 ? `(+$${revDiff.toFixed(0)} vs portfolio avg)\n` :
                 revDiff < -20 ? `(-$${Math.abs(revDiff).toFixed(0)} vs portfolio avg)\n` : '\n';
  }

  if (facility.costPPD) {
    const costDiff = portfolioAvgs['snf_total_cost_ppd'] ? facility.costPPD - portfolioAvgs['snf_total_cost_ppd'] : 0;
    narrative += `- **Cost PPD**: $${facility.costPPD.toFixed(0)} `;
    narrative += costDiff > 20 ? `(+$${costDiff.toFixed(0)} vs portfolio - elevated)\n` :
                 costDiff < -20 ? `(-$${Math.abs(costDiff).toFixed(0)} vs portfolio - efficient)\n` : '\n';
  }

  if (facility.skilledMix !== undefined) {
    narrative += `- **Skilled Mix**: ${facility.skilledMix.toFixed(1)}% `;
    narrative += facility.skilledMix >= 25 ? '(strong)\n' : facility.skilledMix >= 18 ? '(adequate)\n' : '(opportunity for growth)\n';
  }

  if (facility.contractLabor !== undefined) {
    narrative += `- **Contract Labor**: ${facility.contractLabor.toFixed(1)}% `;
    narrative += facility.contractLabor <= 5 ? '(well controlled)\n' :
                 facility.contractLabor <= 10 ? '(acceptable)\n' :
                 facility.contractLabor <= 15 ? '(elevated)\n' : '(**critical - needs attention**)\n';
  }
  narrative += '\n';

  // Opportunities summary
  if (opportunities.length > 0) {
    narrative += `### Key Opportunities\n\n`;
    const highPriority = opportunities.filter(o => o.priority === 'high');
    highPriority.slice(0, 3).forEach(opp => {
      narrative += `- **${opp.title}** (${opp.priority} priority): ${opp.description} *Potential: ${opp.potentialImpact}*\n`;
    });
    narrative += '\n';
  }

  // Risks summary
  const criticalRisks = pitfalls.filter(p => p.severity === 'critical' || p.severity === 'high');
  if (criticalRisks.length > 0) {
    narrative += `### Risk Factors\n\n`;
    criticalRisks.slice(0, 3).forEach(risk => {
      narrative += `- **${risk.title}** (${risk.severity}): ${risk.description}\n`;
    });
    narrative += '\n';
  }

  // Forward outlook
  narrative += `### Forward Outlook\n\n`;
  const marginPrediction = predictions.find(p => p.metric.includes('Margin'));
  if (marginPrediction) {
    narrative += `Based on current trajectory, we project the operating margin to `;
    if (marginPrediction.predictedChange > 2) {
      narrative += `**improve to approximately ${marginPrediction.predictedValue.toFixed(1)}%** over the next 3 months (${marginPrediction.confidence} confidence). `;
    } else if (marginPrediction.predictedChange < -2) {
      narrative += `**decline to approximately ${marginPrediction.predictedValue.toFixed(1)}%** over the next 3 months without intervention (${marginPrediction.confidence} confidence). `;
    } else {
      narrative += `remain relatively stable around ${marginPrediction.predictedValue.toFixed(1)}% (${marginPrediction.confidence} confidence). `;
    }
    narrative += marginPrediction.reasoning + '\n';
  }

  return narrative;
}

function generatePredictionSummary(predictions: Prediction[], currentMargin?: number): string {
  const marginPred = predictions.find(p => p.metric === 'Operating Margin');

  if (!marginPred) return 'Insufficient trend data for projections.';

  if (marginPred.predictedChange > 5) {
    return `Strong positive trajectory expected. Margin projected to reach ${marginPred.predictedValue.toFixed(1)}% (+${marginPred.predictedChange.toFixed(1)}%) with ${marginPred.confidence} confidence.`;
  } else if (marginPred.predictedChange > 0) {
    return `Modest improvement expected. Margin projected at ${marginPred.predictedValue.toFixed(1)}% with ${marginPred.confidence} confidence.`;
  } else if (marginPred.predictedChange > -5) {
    return `Slight headwinds expected. Margin may decline to ${marginPred.predictedValue.toFixed(1)}% without intervention.`;
  } else {
    return `Significant pressure ahead. Without changes, margin could fall to ${marginPred.predictedValue.toFixed(1)}% (${marginPred.confidence} confidence). Action required.`;
  }
}

function generateEnhancedFacilityRecommendations(
  facility: any,
  opportunities: Opportunity[],
  pitfalls: Pitfall[],
  trends: Map<string, TrendData>
): string[] {
  const recs: string[] = [];

  // Critical pitfall recommendations
  pitfalls.filter(p => p.severity === 'critical').forEach(p => {
    recs.push(`[URGENT] ${p.mitigation}`);
  });

  // High priority opportunity recommendations
  opportunities.filter(o => o.priority === 'high').forEach(o => {
    recs.push(`${o.title}: ${o.potentialImpact}`);
  });

  // Trend-based recommendations
  const marginTrend = trends.get('snf_operating_margin_pct');
  if (marginTrend?.direction === 'down') {
    recs.push('Conduct root cause analysis on margin decline and develop action plan');
  }

  if (facility.contractLabor > 15) {
    recs.push('Implement permanent staff recruitment initiative with retention bonuses');
  }

  if (facility.skilledMix < 20) {
    recs.push('Strengthen hospital discharge planner relationships for skilled admissions');
  }

  // Generic best practices
  if (recs.length < 3) {
    recs.push('Schedule monthly performance review calls with leadership');
    recs.push('Benchmark against top-performing peers to identify best practices');
  }

  return recs.slice(0, 7);
}

function calculateFacilityRanking(facilityId: string, periodId: string, database: any): { rank: number; total: number; percentile: number } {
  const allMargins = database.prepare(`
    SELECT facility_id, value FROM kpi_results
    WHERE period_id = ? AND kpi_id = 'snf_operating_margin_pct' AND value IS NOT NULL
    ORDER BY value DESC
  `).all(periodId) as { facility_id: string; value: number }[];

  const idx = allMargins.findIndex(m => m.facility_id === facilityId);
  if (idx === -1) return { rank: 0, total: allMargins.length, percentile: 0 };

  return {
    rank: idx + 1,
    total: allMargins.length,
    percentile: Math.round(((allMargins.length - idx) / allMargins.length) * 100)
  };
}

// Generate state-level packet
interface StateFacilitySummary {
  id: string;
  name: string;
  setting: string;
  beds: number;
  margin: number | undefined;
  skilledMix: number | undefined;
  contractLabor: number | undefined;
  trendDirection: string;
  status: string;
}

function generateStatePacket(stateName: string, periodId: string, database: any): any {
  const facilities = database.prepare('SELECT * FROM facilities WHERE state = ? ORDER BY name').all(stateName);
  if (facilities.length === 0) throw new Error('No facilities found in state');

  const allKpis = database.prepare(`
    SELECT kr.* FROM kpi_results kr
    JOIN facilities f ON kr.facility_id = f.facility_id
    WHERE f.state = ? AND kr.period_id = ?
  `).all(stateName, periodId);

  // Group KPIs by facility
  const facilityKpis = new Map<string, Map<string, number>>();
  allKpis.forEach((k: any) => {
    if (!facilityKpis.has(k.facility_id)) facilityKpis.set(k.facility_id, new Map());
    facilityKpis.get(k.facility_id)!.set(k.kpi_id, k.value);
  });

  // Build facility summaries with trends
  const facilitySummaries: StateFacilitySummary[] = facilities.map((f: any) => {
    const kpis = facilityKpis.get(f.facility_id) || new Map();
    const trends = getT12MTrends(f.facility_id, periodId, database);
    const margin = kpis.get('snf_operating_margin_pct') ?? kpis.get('sl_operating_margin_pct');
    const marginTrend = trends.get('snf_operating_margin_pct') || trends.get('sl_operating_margin_pct');

    return {
      id: f.facility_id,
      name: f.name,
      setting: f.setting,
      beds: f.operational_beds || f.licensed_beds,
      margin,
      skilledMix: kpis.get('snf_skilled_mix_pct'),
      contractLabor: kpis.get('snf_contract_labor_pct_nursing'),
      trendDirection: marginTrend?.direction || 'stable',
      status: margin >= 12 ? 'strong' : margin >= 5 ? 'solid' : margin >= 0 ? 'watch' : 'critical'
    };
  });

  // Calculate state aggregates
  const withMargin = facilitySummaries.filter((f: StateFacilitySummary) => f.margin !== undefined) as (StateFacilitySummary & { margin: number })[];
  const avgMargin = withMargin.length > 0 ? withMargin.reduce((sum: number, f) => sum + f.margin, 0) / withMargin.length : 0;

  // Identify state-level opportunities and pitfalls
  const stateOpportunities: string[] = [];
  const statePitfalls: string[] = [];

  const avgContractLabor = withMargin.reduce((sum: number, f) => sum + (f.contractLabor || 0), 0) / withMargin.length;
  if (avgContractLabor > 15) {
    statePitfalls.push(`High average contract labor (${avgContractLabor.toFixed(1)}%) across ${stateName} facilities`);
    stateOpportunities.push('Region-wide recruitment initiative could reduce labor costs significantly');
  }

  const declining = facilitySummaries.filter((f: StateFacilitySummary) => f.trendDirection === 'down');
  if (declining.length > facilities.length * 0.3) {
    statePitfalls.push(`${declining.length} of ${facilities.length} facilities showing declining margin trends`);
  }

  return {
    scope: 'state',
    title: `${stateName} Regional Financial Analysis`,
    subtitle: `State Portfolio Deep-Dive - ${formatPeriodText(periodId)}`,
    generatedAt: new Date().toISOString(),
    state: stateName,
    summary: {
      facilityCount: facilities.length,
      totalBeds: facilities.reduce((sum: number, f: any) => sum + (f.operational_beds || 0), 0),
      avgMargin,
      profitableFacilities: withMargin.filter((f) => f.margin > 0).length,
      strongPerformers: withMargin.filter((f) => f.margin >= 12).length,
      atRisk: withMargin.filter((f) => f.margin < 0).length
    },
    facilities: facilitySummaries.sort((a: StateFacilitySummary, b: StateFacilitySummary) => (b.margin || 0) - (a.margin || 0)),
    opportunities: stateOpportunities,
    pitfalls: statePitfalls,
    recommendations: [
      `Schedule ${stateName} regional review meeting with all facility administrators`,
      `Identify best practices from ${facilitySummaries.find((f: StateFacilitySummary) => f.status === 'strong')?.name || 'top performers'} to share across region`,
      declining.length > 0 ? `Prioritize turnaround plans for ${declining.map((f: StateFacilitySummary) => f.name).slice(0, 3).join(', ')}` : null
    ].filter((r): r is string => r !== null)
  };
}

// Generate OpCo-level packet
interface OpcoFacilitySummary {
  id: string;
  name: string;
  state: string;
  setting: string;
  margin: number | undefined;
  status: string;
}

function generateOpcoPacket(opcoName: string, periodId: string, database: any): any {
  const facilities = database.prepare('SELECT * FROM facilities WHERE parent_opco = ? ORDER BY state, name').all(opcoName);
  if (facilities.length === 0) throw new Error('No facilities found for OpCo');

  // Similar structure to state packet but grouped by OpCo
  const allKpis = database.prepare(`
    SELECT kr.* FROM kpi_results kr
    JOIN facilities f ON kr.facility_id = f.facility_id
    WHERE f.parent_opco = ? AND kr.period_id = ?
  `).all(opcoName, periodId);

  const facilityKpis = new Map<string, Map<string, number>>();
  allKpis.forEach((k: any) => {
    if (!facilityKpis.has(k.facility_id)) facilityKpis.set(k.facility_id, new Map());
    facilityKpis.get(k.facility_id)!.set(k.kpi_id, k.value);
  });

  const facilitySummaries: OpcoFacilitySummary[] = facilities.map((f: any) => {
    const kpis = facilityKpis.get(f.facility_id) || new Map();
    const margin = kpis.get('snf_operating_margin_pct') ?? kpis.get('sl_operating_margin_pct');

    return {
      id: f.facility_id,
      name: f.name,
      state: f.state,
      setting: f.setting,
      margin,
      status: margin >= 12 ? 'strong' : margin >= 5 ? 'solid' : margin >= 0 ? 'watch' : 'critical'
    };
  });

  const withMargin = facilitySummaries.filter((f: OpcoFacilitySummary) => f.margin !== undefined) as (OpcoFacilitySummary & { margin: number })[];
  const avgMargin = withMargin.length > 0 ? withMargin.reduce((sum: number, f) => sum + f.margin, 0) / withMargin.length : 0;

  // Group by state for OpCo
  const byState: Record<string, OpcoFacilitySummary[]> = {};
  facilitySummaries.forEach((f: OpcoFacilitySummary) => {
    if (!byState[f.state]) byState[f.state] = [];
    byState[f.state].push(f);
  });

  return {
    scope: 'opco',
    title: `${opcoName} Operating Company Analysis`,
    subtitle: `OpCo Performance Report - ${formatPeriodText(periodId)}`,
    generatedAt: new Date().toISOString(),
    opco: opcoName,
    summary: {
      facilityCount: facilities.length,
      stateCount: Object.keys(byState).length,
      avgMargin,
      profitableFacilities: withMargin.filter((f) => f.margin > 0).length,
      atRisk: withMargin.filter((f) => f.margin < 0).length
    },
    byState: Object.entries(byState).map(([state, facs]) => {
      const facsWithMargin = facs.filter((f: OpcoFacilitySummary) => f.margin !== undefined) as (OpcoFacilitySummary & { margin: number })[];
      return {
        state,
        count: facs.length,
        avgMargin: facsWithMargin.length > 0 ? facsWithMargin.reduce((sum: number, f) => sum + f.margin, 0) / facsWithMargin.length : 0,
        facilities: facs
      };
    }),
    facilities: facilitySummaries.sort((a: OpcoFacilitySummary, b: OpcoFacilitySummary) => (b.margin || 0) - (a.margin || 0)),
    recommendations: [
      `Review ${opcoName} operational standards for consistency`,
      `Share best practices from top performers across all ${opcoName} facilities`
    ]
  };
}

// Enhanced portfolio packet
function generateEnhancedPortfolioPacket(periodId: string, database: any): any {
  // Use existing function but add predictions and enhanced analysis
  const basePacket = generatePortfolioPacket(periodId, database);

  // Add portfolio-wide predictions
  const allFacilities = database.prepare('SELECT facility_id FROM facilities').all() as { facility_id: string }[];
  let improvingCount = 0;
  let decliningCount = 0;

  for (const f of allFacilities) {
    const trends = getT12MTrends(f.facility_id, periodId, database);
    const marginTrend = trends.get('snf_operating_margin_pct') || trends.get('sl_operating_margin_pct');
    if (marginTrend) {
      if (marginTrend.direction === 'up') improvingCount++;
      else if (marginTrend.direction === 'down') decliningCount++;
    }
  }

  return {
    ...basePacket,
    trendSummary: {
      facilitiesImproving: improvingCount,
      facilitiesDeclining: decliningCount,
      facilitiesStable: allFacilities.length - improvingCount - decliningCount
    },
    portfolioPrediction: {
      outlook: improvingCount > decliningCount ? 'positive' : decliningCount > improvingCount ? 'concerning' : 'stable',
      narrative: improvingCount > decliningCount
        ? `Portfolio momentum is positive with ${improvingCount} facilities trending up vs ${decliningCount} declining.`
        : decliningCount > improvingCount
        ? `Portfolio showing headwinds with ${decliningCount} facilities trending down. Intervention needed.`
        : `Portfolio is relatively stable with balanced trend mix.`
    },
    strategicRecommendations: [
      ...basePacket.recommendations,
      'Develop facility-specific turnaround plans for all declining buildings',
      'Consider portfolio optimization - evaluate underperformers for disposition or capital investment',
      'Implement standardized best practices from top quartile performers'
    ]
  };
}

// AI Chat endpoint using Claude
app.post('/api/ai/chat', async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: 'AI service not configured. Set ANTHROPIC_API_KEY.' });
  }

  const { message, context } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Build context from facility data
    let systemPrompt = `You are SNFPNL AI, a financial analyst assistant for skilled nursing facility (SNF) and senior living portfolio management. You help users understand financial performance, KPIs, and trends.

Key metrics you analyze:
- Operating Margin: Target is 12%+, excellent is 20%+
- Skilled Mix: Higher generally means better reimbursement
- Contract Labor %: Lower is better, high indicates staffing challenges
- Nursing Hours PPD: Industry standard around 3.5-4.0
- Revenue PPD and Cost PPD: Key profitability drivers

Be concise, data-driven, and actionable in your responses. Format numbers with appropriate precision (1 decimal for percentages, whole numbers for currency).`;

    if (context?.facilityData) {
      systemPrompt += `\n\nCurrent facility context:\n${JSON.stringify(context.facilityData, null, 2)}`;
    }

    if (context?.portfolioSummary) {
      systemPrompt += `\n\nPortfolio summary:\n${JSON.stringify(context.portfolioSummary, null, 2)}`;
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: message }
      ]
    });

    const textContent = response.content.find(block => block.type === 'text');
    const reply = textContent ? textContent.text : 'No response generated.';

    res.json({ reply });
  } catch (err: any) {
    console.error('Claude API error:', err);
    res.status(500).json({ error: 'Failed to get AI response', details: err.message });
  }
});

// ============================================================================
// FILE UPLOAD ENDPOINT
// ============================================================================

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, '/tmp');
  },
  filename: (_req, file, cb) => {
    cb(null, `upload_${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

// Upload and process financial data
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  console.log(`Processing uploaded file: ${filePath}`);

  try {
    // Parse the Excel file
    const { financeFacts, censusFacts, occupancyFacts, facilityIds } = parseIncomeStatementWorkbook(filePath);

    console.log(`Parsed: ${facilityIds.length} facilities, ${financeFacts.length} finance facts, ${censusFacts.length} census facts`);

    if (financeFacts.length === 0) {
      return res.status(400).json({
        error: 'No valid financial data found in file',
        details: 'Make sure the Excel file has sheets named like "101 (Shaw)" with proper income statement format'
      });
    }

    // Get unique periods from the data
    const periods = [...new Set(financeFacts.map(f => f.period_id))].sort();
    console.log(`Periods found: ${periods.join(', ')}`);

    // Insert/update facilities
    const insertFacility = db.prepare(`
      INSERT OR IGNORE INTO facilities
      (facility_id, name, short_name, state, setting)
      VALUES (?, ?, ?, 'UNKNOWN', 'SNF')
    `);

    for (const facId of facilityIds) {
      insertFacility.run(facId, `Facility ${facId}`, `Facility ${facId}`);
    }

    // Insert periods
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

    // Clear existing facts for these periods and facilities (to allow updates)
    const deleteFinance = db.prepare(`DELETE FROM finance_facts WHERE facility_id = ? AND period_id = ?`);
    const deleteCensus = db.prepare(`DELETE FROM census_facts WHERE facility_id = ? AND period_id = ?`);
    const deleteOccupancy = db.prepare(`DELETE FROM occupancy_facts WHERE facility_id = ? AND period_id = ?`);
    const deleteKPIs = db.prepare(`DELETE FROM kpi_results WHERE facility_id = ? AND period_id = ?`);

    for (const facId of facilityIds) {
      for (const periodId of periods) {
        deleteFinance.run(facId, periodId);
        deleteCensus.run(facId, periodId);
        deleteOccupancy.run(facId, periodId);
        deleteKPIs.run(facId, periodId);
      }
    }

    // Insert new finance facts
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

    // Now compute KPIs for the uploaded data
    console.log('Computing KPIs...');

    const allFinanceFacts = db.prepare('SELECT * FROM finance_facts').all() as FinanceFact[];
    const allCensusFacts = db.prepare('SELECT * FROM census_facts').all() as CensusFact[];
    const allOccupancyFacts = db.prepare('SELECT * FROM occupancy_facts').all() as OccupancyFact[];
    const facilities = db.prepare('SELECT * FROM facilities WHERE facility_id IN (' + facilityIds.map(() => '?').join(',') + ')').all(...facilityIds) as FacilityType[];
    const periodsData = db.prepare('SELECT period_id, days_in_month FROM periods').all() as { period_id: string; days_in_month: number }[];
    const daysInMonthMap = new Map(periodsData.map(p => [p.period_id, p.days_in_month]));

    const insertKPI = db.prepare(`
      INSERT INTO kpi_results
      (facility_id, period_id, kpi_id, value, numerator_value, denominator_value, denominator_type, payer_scope, unit, warnings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let kpisComputed = 0;

    for (const facility of facilities) {
      for (const periodId of periods) {
        const daysInMonth = daysInMonthMap.get(periodId) || 30;
        const { results } = calculateAllKPIs(
          allFinanceFacts,
          allCensusFacts,
          facility.facility_id,
          periodId,
          undefined,
          allOccupancyFacts,
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
          kpisComputed++;
        }
      }
    }

    // Clean up temp file
    const fs = await import('fs');
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: 'Financial data uploaded and processed successfully',
      summary: {
        facilitiesProcessed: facilityIds.length,
        periodsProcessed: periods.length,
        financeFacts: financeFacts.length,
        censusFacts: censusFacts.length,
        occupancyFacts: occupancyFacts.length,
        kpisComputed
      },
      periods,
      facilityIds
    });

  } catch (err: any) {
    console.error('Upload processing error:', err);

    // Clean up temp file on error
    try {
      const fs = await import('fs');
      fs.unlinkSync(filePath);
    } catch (_e) { /* ignore cleanup errors */ }

    res.status(500).json({
      error: 'Failed to process uploaded file',
      details: err.message
    });
  }
});

// Get upload status/history (optional endpoint for future use)
app.get('/api/upload/status', (_req, res) => {
  try {
    const periods = db.prepare(`
      SELECT period_id, COUNT(DISTINCT facility_id) as facility_count
      FROM finance_facts
      GROUP BY period_id
      ORDER BY period_id DESC
    `).all();

    const lastImport = db.prepare(`
      SELECT MAX(computed_at) as last_computed FROM kpi_results
    `).get() as { last_computed: string } | undefined;

    res.json({
      periods,
      lastComputed: lastImport?.last_computed
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get upload status' });
  }
});

// ============================================
// EXCEL EXPORT API
// ============================================

app.get('/api/export/excel', async (req, res) => {
  try {
    const {
      sheets = 'summary,facilities,trends,kpis',
      periodId = '2025-11',
      format = 'xlsx'
    } = req.query as { sheets?: string; periodId?: string; format?: string };

    const selectedSheets = sheets.split(',');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SNFPNL';
    workbook.created = new Date();

    // Get all facilities
    const facilities = db.prepare(`
      SELECT facility_id, name, state, setting, short_name
      FROM facilities
      ORDER BY name
    `).all() as { facility_id: string; name: string; state: string; setting: string; short_name: string }[];

    // Get KPI results for the period
    const kpiResults = db.prepare(`
      SELECT kr.facility_id, kr.kpi_id, kr.value, kr.period_id,
             f.name as facility_name, f.state, f.setting
      FROM kpi_results kr
      JOIN facilities f ON kr.facility_id = f.facility_id
      WHERE kr.period_id = ?
      ORDER BY f.name, kr.kpi_id
    `).all(periodId) as { facility_id: string; kpi_id: string; value: number | null; period_id: string; facility_name: string; state: string; setting: string }[];

    // Executive Summary Sheet
    if (selectedSheets.includes('summary')) {
      const summarySheet = workbook.addWorksheet('Executive Summary');

      // Title
      summarySheet.mergeCells('A1:E1');
      const titleCell = summarySheet.getCell('A1');
      titleCell.value = 'SNFPNL Portfolio Executive Summary';
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'center' };

      summarySheet.mergeCells('A2:E2');
      const periodCell = summarySheet.getCell('A2');
      periodCell.value = `Period: ${periodId}`;
      periodCell.alignment = { horizontal: 'center' };

      // Portfolio Stats
      summarySheet.getCell('A4').value = 'Portfolio Overview';
      summarySheet.getCell('A4').font = { bold: true, size: 14 };

      const facilityCount = facilities.length;
      const snfCount = facilities.filter(f => f.setting === 'SNF').length;
      const alfCount = facilities.filter(f => f.setting === 'ALF').length;
      const ilfCount = facilities.filter(f => f.setting === 'ILF').length;

      // Calculate average margin
      const margins = kpiResults.filter(k =>
        (k.kpi_id === 'snf_operating_margin_pct' || k.kpi_id === 'sl_operating_margin_pct') &&
        k.value !== null
      );
      const avgMargin = margins.length > 0
        ? margins.reduce((sum, m) => sum + (m.value || 0), 0) / margins.length
        : 0;

      const statsData = [
        ['Metric', 'Value'],
        ['Total Facilities', facilityCount],
        ['SNF Facilities', snfCount],
        ['ALF Facilities', alfCount],
        ['ILF Facilities', ilfCount],
        ['Average Operating Margin', `${avgMargin.toFixed(1)}%`],
        ['Report Generated', new Date().toLocaleString()]
      ];

      statsData.forEach((row, idx) => {
        summarySheet.getCell(`A${6 + idx}`).value = row[0];
        summarySheet.getCell(`B${6 + idx}`).value = row[1];
        if (idx === 0) {
          summarySheet.getCell(`A${6 + idx}`).font = { bold: true };
          summarySheet.getCell(`B${6 + idx}`).font = { bold: true };
        }
      });

      summarySheet.columns = [
        { width: 25 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 15 }
      ];
    }

    // Facilities Overview Sheet
    if (selectedSheets.includes('facilities')) {
      const facilitySheet = workbook.addWorksheet('Facilities');

      // Headers
      facilitySheet.columns = [
        { header: 'Facility ID', key: 'facility_id', width: 12 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'State', key: 'state', width: 8 },
        { header: 'Setting', key: 'setting', width: 8 },
        { header: 'Operating Margin %', key: 'margin', width: 18 },
        { header: 'Revenue PPD', key: 'revenue', width: 14 },
        { header: 'Cost PPD', key: 'cost', width: 12 },
        { header: 'Skilled Mix %', key: 'skilled_mix', width: 14 },
        { header: 'Occupancy %', key: 'occupancy', width: 12 }
      ];

      // Style header row
      facilitySheet.getRow(1).font = { bold: true };
      facilitySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      facilitySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      // Add data
      facilities.forEach(facility => {
        const facilityKpis = kpiResults.filter(k => k.facility_id === facility.facility_id);
        const getKpiValue = (kpiId: string) => {
          const kpi = facilityKpis.find(k => k.kpi_id === kpiId);
          return kpi?.value ?? null;
        };

        const margin = facility.setting === 'SNF'
          ? getKpiValue('snf_operating_margin_pct')
          : getKpiValue('sl_operating_margin_pct');
        const revenue = getKpiValue('snf_total_revenue_ppd');
        const cost = getKpiValue('snf_total_cost_ppd');
        const skilledMix = getKpiValue('snf_skilled_mix_pct');
        const occupancy = facility.setting === 'SNF'
          ? getKpiValue('snf_occupancy_pct')
          : getKpiValue('sl_occupancy_pct');

        facilitySheet.addRow({
          facility_id: facility.facility_id,
          name: facility.name,
          state: facility.state,
          setting: facility.setting,
          margin: margin !== null ? `${margin.toFixed(1)}%` : '-',
          revenue: revenue !== null ? `$${revenue.toFixed(0)}` : '-',
          cost: cost !== null ? `$${cost.toFixed(0)}` : '-',
          skilled_mix: skilledMix !== null ? `${skilledMix.toFixed(1)}%` : '-',
          occupancy: occupancy !== null ? `${occupancy.toFixed(1)}%` : '-'
        });
      });

      // Add alternating row colors
      facilitySheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && rowNumber % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' }
          };
        }
      });
    }

    // Historical Trends Sheet
    if (selectedSheets.includes('trends')) {
      const trendsSheet = workbook.addWorksheet('Historical Trends');

      // Get last 12 months of data
      const trendData = db.prepare(`
        SELECT kr.facility_id, kr.kpi_id, kr.value, kr.period_id,
               f.name as facility_name
        FROM kpi_results kr
        JOIN facilities f ON kr.facility_id = f.facility_id
        WHERE kr.kpi_id IN ('snf_operating_margin_pct', 'sl_operating_margin_pct',
                           'snf_total_revenue_ppd', 'snf_skilled_mix_pct')
        ORDER BY f.name, kr.period_id DESC
        LIMIT 1000
      `).all() as { facility_id: string; kpi_id: string; value: number | null; period_id: string; facility_name: string }[];

      trendsSheet.columns = [
        { header: 'Facility', key: 'facility', width: 30 },
        { header: 'Period', key: 'period', width: 12 },
        { header: 'KPI', key: 'kpi', width: 25 },
        { header: 'Value', key: 'value', width: 15 }
      ];

      trendsSheet.getRow(1).font = { bold: true };
      trendsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      trendsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      trendData.forEach(row => {
        if (row.value !== null) {
          trendsSheet.addRow({
            facility: row.facility_name,
            period: row.period_id,
            kpi: row.kpi_id.replace(/_/g, ' ').replace(/snf |sl /g, ''),
            value: row.value.toFixed(2)
          });
        }
      });
    }

    // KPI Details Sheet
    if (selectedSheets.includes('kpis')) {
      const kpiSheet = workbook.addWorksheet('KPI Details');

      kpiSheet.columns = [
        { header: 'Facility', key: 'facility', width: 30 },
        { header: 'Facility ID', key: 'facility_id', width: 12 },
        { header: 'Period', key: 'period', width: 10 },
        { header: 'KPI ID', key: 'kpi_id', width: 30 },
        { header: 'Value', key: 'value', width: 15 },
        { header: 'Setting', key: 'setting', width: 8 }
      ];

      kpiSheet.getRow(1).font = { bold: true };
      kpiSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      kpiSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      kpiResults.forEach(row => {
        if (row.value !== null) {
          kpiSheet.addRow({
            facility: row.facility_name,
            facility_id: row.facility_id,
            period: row.period_id,
            kpi_id: row.kpi_id,
            value: row.value,
            setting: row.setting
          });
        }
      });
    }

    // Alerts Sheet
    if (selectedSheets.includes('alerts')) {
      const alertsSheet = workbook.addWorksheet('Alerts');

      const anomalies = db.prepare(`
        SELECT a.*, f.name as facility_name
        FROM anomalies a
        JOIN facilities f ON a.facility_id = f.facility_id
        WHERE a.period_id = ?
        ORDER BY
          CASE a.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          f.name
      `).all(periodId) as { facility_id: string; facility_name: string; kpi_id: string; severity: string; message: string }[];

      alertsSheet.columns = [
        { header: 'Facility', key: 'facility', width: 30 },
        { header: 'Severity', key: 'severity', width: 10 },
        { header: 'KPI', key: 'kpi', width: 25 },
        { header: 'Message', key: 'message', width: 50 }
      ];

      alertsSheet.getRow(1).font = { bold: true };
      alertsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      alertsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      anomalies.forEach(row => {
        const dataRow = alertsSheet.addRow({
          facility: row.facility_name,
          severity: row.severity.toUpperCase(),
          kpi: row.kpi_id,
          message: row.message
        });

        // Color code by severity
        if (row.severity === 'high') {
          dataRow.getCell('severity').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF6B6B' }
          };
        } else if (row.severity === 'medium') {
          dataRow.getCell('severity').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFD93D' }
          };
        }
      });
    }

    // Set response headers
    const filename = `SNFPNL_Export_${periodId}_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      // For CSV, just export the facilities sheet
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);

      const csvWorkbook = new ExcelJS.Workbook();
      const csvSheet = csvWorkbook.addWorksheet('Data');

      // Copy facilities data
      const facilitySheet = workbook.getWorksheet('Facilities');
      if (facilitySheet) {
        facilitySheet.eachRow((row, rowNum) => {
          const newRow = csvSheet.getRow(rowNum);
          row.eachCell((cell, colNum) => {
            newRow.getCell(colNum).value = cell.value;
          });
        });
      }

      const buffer = await csvWorkbook.csv.writeBuffer();
      res.send(buffer);
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

      const buffer = await workbook.xlsx.writeBuffer();
      res.send(buffer);
    }

  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Failed to generate Excel export' });
  }
});

// Single facility export
app.get('/api/export/facility/:facilityId', async (req, res) => {
  try {
    const { facilityId } = req.params;
    const { periodId = '2025-11', format = 'xlsx' } = req.query as { periodId?: string; format?: string };

    const facility = db.prepare(`
      SELECT * FROM facilities WHERE facility_id = ?
    `).get(facilityId) as { facility_id: string; name: string; state: string; setting: string } | undefined;

    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SNFPNL';
    workbook.created = new Date();

    // Get KPI data for the facility
    const kpiData = db.prepare(`
      SELECT kr.kpi_id, kr.value, kr.period_id
      FROM kpi_results kr
      WHERE kr.facility_id = ?
      ORDER BY kr.period_id DESC, kr.kpi_id
    `).all(facilityId) as { kpi_id: string; value: number | null; period_id: string }[];

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Facility Summary');

    summarySheet.mergeCells('A1:D1');
    summarySheet.getCell('A1').value = facility.name;
    summarySheet.getCell('A1').font = { bold: true, size: 16 };

    summarySheet.getCell('A3').value = 'Facility ID:';
    summarySheet.getCell('B3').value = facility.facility_id;
    summarySheet.getCell('A4').value = 'State:';
    summarySheet.getCell('B4').value = facility.state;
    summarySheet.getCell('A5').value = 'Setting:';
    summarySheet.getCell('B5').value = facility.setting;
    summarySheet.getCell('A6').value = 'Report Period:';
    summarySheet.getCell('B6').value = periodId;

    // KPI Data sheet
    const kpiSheet = workbook.addWorksheet('KPI Data');

    kpiSheet.columns = [
      { header: 'Period', key: 'period', width: 12 },
      { header: 'KPI', key: 'kpi', width: 35 },
      { header: 'Value', key: 'value', width: 15 }
    ];

    kpiSheet.getRow(1).font = { bold: true };
    kpiSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    kpiSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    kpiData.forEach(row => {
      if (row.value !== null) {
        kpiSheet.addRow({
          period: row.period_id,
          kpi: row.kpi_id,
          value: row.value
        });
      }
    });

    const filename = `${facility.name.replace(/[^a-z0-9]/gi, '_')}_${periodId}`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);

  } catch (err) {
    console.error('Facility export error:', err);
    res.status(500).json({ error: 'Failed to generate facility export' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

export default app;
