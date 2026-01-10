import * as fs from 'fs';
import * as path from 'path';
import type {
  Facility,
  FacilityMonthBundle,
  KPIResult,
  Anomaly,
  Denominators,
  BenchmarkStats,
  GlossaryTerm,
  AccountingBasis,
} from '../types/index.js';
import { DENOMINATOR_GLOSSARY } from '../core/denominator/resolver.js';
import { getKPIGlossary, KPI_REGISTRY } from '../kpi/registry.js';

/**
 * Generate a complete LLM-ready bundle for a facility/month.
 */
export function generateFacilityMonthBundle(
  facility: Facility,
  periodId: string,
  denominators: Denominators,
  kpiResults: KPIResult[],
  anomalies: Anomaly[],
  benchmarks: Record<string, Record<string, BenchmarkStats>>,
  sourceFiles: string[]
): FacilityMonthBundle {
  // Build glossary from KPIs used
  const glossary: GlossaryTerm[] = [];

  // Add denominator glossary entries
  for (const term of DENOMINATOR_GLOSSARY) {
    glossary.push({
      term: term.term,
      abbreviation: term.abbreviation,
      definition: term.definition,
      denominator_type: term.denominator_type as any,
      payer_scope: term.payer_scope,
    });
  }

  // Add KPI-specific glossary entries for KPIs that have values
  for (const result of kpiResults) {
    if (result.value !== null) {
      const kpiDef = KPI_REGISTRY[result.kpi_id];
      if (kpiDef) {
        glossary.push({
          term: kpiDef.name,
          abbreviation: kpiDef.kpi_id,
          definition: `${kpiDef.description}. Formula: ${kpiDef.formula}`,
          denominator_type: kpiDef.denominator_type,
          payer_scope: Array.isArray(kpiDef.payer_scope)
            ? kpiDef.payer_scope.join(', ')
            : kpiDef.payer_scope,
        });
      }
    }
  }

  // Build benchmarks object
  const bundleBenchmarks: Record<string, BenchmarkStats> = {};
  for (const [kpiId, cohortBenchmarks] of Object.entries(benchmarks)) {
    // Use state benchmark if available, otherwise all
    const stateBenchmark = cohortBenchmarks[`state_${facility.state}`];
    const allBenchmark = cohortBenchmarks.all;
    if (stateBenchmark) {
      bundleBenchmarks[kpiId] = stateBenchmark;
    } else if (allBenchmark) {
      bundleBenchmarks[kpiId] = allBenchmark;
    }
  }

  return {
    meta: {
      facility_id: facility.facility_id,
      facility_name: facility.name,
      period: periodId,
      state: facility.state,
      setting: facility.setting,
      therapy_delivery_model: facility.therapy_delivery_model,
      accounting_basis: 'accrual' as AccountingBasis, // Default, could be configurable
      source_files: sourceFiles,
      generated_at: new Date().toISOString(),
    },
    denominators,
    kpis: kpiResults,
    benchmarks: bundleBenchmarks,
    anomalies,
    glossary,
  };
}

/**
 * Write bundle to JSON file.
 */
export function writeBundleToFile(
  bundle: FacilityMonthBundle,
  basePath: string
): string {
  const dirPath = path.join(
    basePath,
    bundle.meta.facility_id,
    bundle.meta.period.replace('-', '_')
  );

  fs.mkdirSync(dirPath, { recursive: true });

  const filePath = path.join(dirPath, 'bundle.json');
  fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2));

  return filePath;
}

/**
 * Write combined KPI table for all facilities.
 */
export function writeCombinedKPITable(
  bundles: FacilityMonthBundle[],
  basePath: string
): string {
  const combined = {
    generated_at: new Date().toISOString(),
    periods: [...new Set(bundles.map((b) => b.meta.period))].sort(),
    facilities: [...new Set(bundles.map((b) => b.meta.facility_id))].sort(),
    data: bundles.map((bundle) => ({
      facility_id: bundle.meta.facility_id,
      facility_name: bundle.meta.facility_name,
      period: bundle.meta.period,
      state: bundle.meta.state,
      setting: bundle.meta.setting,
      kpis: bundle.kpis.reduce(
        (acc, kpi) => {
          acc[kpi.kpi_id] = kpi.value;
          return acc;
        },
        {} as Record<string, number | null>
      ),
      anomaly_count: bundle.anomalies.length,
    })),
  };

  fs.mkdirSync(basePath, { recursive: true });
  const filePath = path.join(basePath, 'kpis_all.json');
  fs.writeFileSync(filePath, JSON.stringify(combined, null, 2));

  return filePath;
}

/**
 * Generate an LLM prompt pack for a facility/month.
 */
export function generatePromptPack(bundle: FacilityMonthBundle): string {
  const { meta, denominators, kpis, anomalies, benchmarks } = bundle;

  // Format KPIs for readability
  const kpiSummary = kpis
    .filter((k) => k.value !== null)
    .map((k) => {
      const kpiDef = KPI_REGISTRY[k.kpi_id];
      const unitLabel =
        k.unit === 'currency'
          ? '$'
          : k.unit === 'percentage'
            ? '%'
            : k.unit === 'hours'
              ? ' hrs'
              : '';
      const value =
        k.unit === 'currency' ? k.value!.toFixed(2) : k.value!.toFixed(1);

      let benchmarkNote = '';
      const bench = benchmarks[k.kpi_id];
      if (bench) {
        benchmarkNote = ` (Median: ${k.unit === 'currency' ? '$' : ''}${bench.median.toFixed(1)}${k.unit === 'percentage' ? '%' : ''})`;
      }

      return `- ${kpiDef?.name || k.kpi_id}: ${k.unit === 'currency' ? '$' : ''}${value}${k.unit === 'percentage' ? '%' : k.unit === 'hours' ? ' hrs' : ''}${benchmarkNote}`;
    })
    .join('\n');

  // Format anomalies
  const anomalySummary =
    anomalies.length > 0
      ? anomalies.map((a) => `- [${a.severity.toUpperCase()}] ${a.message}`).join('\n')
      : 'No anomalies detected.';

  const prompt = `# Financial Analysis Context for ${meta.facility_name}

## Facility Information
- **Facility ID:** ${meta.facility_id}
- **Name:** ${meta.facility_name}
- **State:** ${meta.state}
- **Setting:** ${meta.setting}
- **Period:** ${meta.period}
- **Therapy Model:** ${meta.therapy_delivery_model}

## Census Data (Denominators)
- **Total Resident Days:** ${denominators.resident_days.toLocaleString()}
- **Skilled Days:** ${denominators.skilled_days.toLocaleString()} (${((denominators.skilled_days / denominators.resident_days) * 100).toFixed(1)}% skilled mix)
- **Medicare A Days:** ${denominators.payer_days.MEDICARE_A?.toLocaleString() || 0}
- **Medicare Advantage Days:** ${denominators.payer_days.MEDICARE_ADVANTAGE?.toLocaleString() || 0}
- **Medicaid Days:** ${denominators.payer_days.MEDICAID?.toLocaleString() || 0}
- **Private Pay Days:** ${denominators.payer_days.PRIVATE_PAY?.toLocaleString() || 0}

## Key Performance Indicators
${kpiSummary}

## Data Quality Notes
${anomalySummary}

---

**Instructions for Analysis:**
Using the data above, analyze this facility's financial performance for ${meta.period}. Focus on:
1. Revenue performance relative to benchmarks
2. Cost management effectiveness
3. Payer mix optimization opportunities
4. Key risks or concerns based on anomalies

Note: PSD = Per Skilled Day (Medicare A + MA + Commercial + VA + ISNP). PPD = Per Patient Day (all payers).
`;

  return prompt;
}

/**
 * Write prompt pack to file.
 */
export function writePromptPack(
  bundle: FacilityMonthBundle,
  basePath: string
): string {
  const prompt = generatePromptPack(bundle);

  const dirPath = path.join(
    basePath,
    bundle.meta.facility_id,
    bundle.meta.period.replace('-', '_')
  );

  fs.mkdirSync(dirPath, { recursive: true });

  const filePath = path.join(dirPath, 'analysis_prompt.md');
  fs.writeFileSync(filePath, prompt);

  return filePath;
}
