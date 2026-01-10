/**
 * Auto-generate insights from correlation and trend data
 */

import { CorrelationResult, TrendResult } from './statistics.js';

export interface Insight {
  id: string;
  type: 'opportunity' | 'warning' | 'pattern' | 'strength';
  title: string;
  description: string;
  relatedKpis: string[];
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}

export interface CorrelationPair {
  xKpi: string;
  yKpi: string;
  xLabel: string;
  yLabel: string;
  correlation: CorrelationResult;
  businessQuestion: string;
}

// Define the key correlation pairs to analyze
export const CORRELATION_PAIRS: Array<{
  xKpi: string;
  yKpi: string;
  xLabel: string;
  yLabel: string;
  businessQuestion: string;
  insightTemplate: {
    positive: string;
    negative: string;
  };
}> = [
  {
    xKpi: 'snf_skilled_mix_pct',
    yKpi: 'snf_total_revenue_ppd',
    xLabel: 'Skilled Mix %',
    yLabel: 'Revenue PPD',
    businessQuestion: 'Does higher skilled mix drive revenue?',
    insightTemplate: {
      positive: 'Higher skilled mix is associated with increased revenue per patient day',
      negative: 'Skilled mix changes show inverse relationship with revenue - investigate payer contracts'
    }
  },
  {
    xKpi: 'snf_skilled_mix_pct',
    yKpi: 'snf_operating_margin_pct',
    xLabel: 'Skilled Mix %',
    yLabel: 'Operating Margin',
    businessQuestion: 'Does payer mix impact profitability?',
    insightTemplate: {
      positive: 'Skilled payer mix positively impacts operating margins',
      negative: 'Higher skilled mix correlates with lower margins - review skilled care cost structure'
    }
  },
  {
    xKpi: 'snf_nursing_hppd',
    yKpi: 'snf_nursing_cost_ppd',
    xLabel: 'Nursing Hours PPD',
    yLabel: 'Nursing Cost PPD',
    businessQuestion: 'Hours to cost relationship efficiency',
    insightTemplate: {
      positive: 'Nursing hours directly track with costs as expected',
      negative: 'Unusual disconnect between nursing hours and costs - check wage rates or coding'
    }
  },
  {
    xKpi: 'snf_contract_labor_pct_nursing',
    yKpi: 'snf_operating_margin_pct',
    xLabel: 'Contract Labor %',
    yLabel: 'Operating Margin',
    businessQuestion: 'Agency labor impact on margins',
    insightTemplate: {
      positive: 'Contract labor usage shows unexpected positive margin relationship',
      negative: 'Contract labor negatively impacts operating margins - prioritize permanent staffing'
    }
  },
  {
    xKpi: 'snf_therapy_cost_psd',
    yKpi: 'snf_skilled_margin_pct',
    xLabel: 'Therapy Cost PSD',
    yLabel: 'Skilled Margin',
    businessQuestion: 'Therapy efficiency impact',
    insightTemplate: {
      positive: 'Higher therapy costs associated with better skilled margins - value-driven care',
      negative: 'Therapy costs drag on skilled margins - review therapy efficiency and contracts'
    }
  },
  {
    xKpi: 'snf_occupancy_pct',
    yKpi: 'snf_operating_margin_pct',
    xLabel: 'Occupancy %',
    yLabel: 'Operating Margin',
    businessQuestion: 'Volume impact on profitability',
    insightTemplate: {
      positive: 'Higher occupancy drives better margins - focus on census growth',
      negative: 'Occupancy not translating to margin improvement - review cost structure'
    }
  }
];

/**
 * Generate insights from correlation analysis results
 */
export function generateCorrelationInsights(
  correlations: CorrelationPair[],
  facilityName: string
): Insight[] {
  const insights: Insight[] = [];
  let insightCounter = 0;

  for (const corr of correlations) {
    const pairConfig = CORRELATION_PAIRS.find(
      p => p.xKpi === corr.xKpi && p.yKpi === corr.yKpi
    );

    if (!pairConfig) continue;

    const { r, strength, direction } = corr.correlation;

    if (strength === 'none') continue;

    const isPositive = direction === 'positive';
    const template = isPositive ? pairConfig.insightTemplate.positive : pairConfig.insightTemplate.negative;

    let type: Insight['type'];
    let priority: Insight['priority'];

    if (strength === 'strong') {
      priority = 'high';
      if (corr.yKpi.includes('margin') && !isPositive) {
        type = 'warning';
      } else if (corr.yKpi.includes('margin') && isPositive) {
        type = 'strength';
      } else {
        type = 'pattern';
      }
    } else if (strength === 'moderate') {
      priority = 'medium';
      type = 'pattern';
    } else {
      priority = 'low';
      type = 'pattern';
    }

    const actionable = (
      (corr.xKpi.includes('contract_labor') && !isPositive) ||
      (corr.xKpi.includes('skilled_mix') && isPositive) ||
      (corr.xKpi.includes('occupancy') && isPositive)
    );

    if (actionable && strength !== 'weak') {
      type = 'opportunity';
    }

    insights.push({
      id: `insight-${++insightCounter}`,
      type,
      title: generateInsightTitle(corr, strength, isPositive),
      description: `${template} (r=${r.toFixed(2)}, ${strength} correlation)`,
      relatedKpis: [corr.xKpi, corr.yKpi],
      priority,
      actionable
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return insights;
}

function generateInsightTitle(
  corr: CorrelationPair,
  strength: string,
  isPositive: boolean
): string {
  const strengthLabel = strength.charAt(0).toUpperCase() + strength.slice(1);
  const directionLabel = isPositive ? 'Positive' : 'Negative';

  const shortLabels: Record<string, string> = {
    'snf_skilled_mix_pct': 'Skilled Mix',
    'snf_total_revenue_ppd': 'Revenue',
    'snf_operating_margin_pct': 'Margin',
    'snf_nursing_hppd': 'Nursing Hours',
    'snf_nursing_cost_ppd': 'Nursing Cost',
    'snf_contract_labor_pct_nursing': 'Contract Labor',
    'snf_therapy_cost_psd': 'Therapy Cost',
    'snf_skilled_margin_pct': 'Skilled Margin',
    'snf_occupancy_pct': 'Occupancy'
  };

  const xShort = shortLabels[corr.xKpi] || corr.xLabel;
  const yShort = shortLabels[corr.yKpi] || corr.yLabel;

  return `${strengthLabel} ${directionLabel}: ${xShort} -> ${yShort}`;
}

export function generateTrendInsights(
  metrics: Array<{
    kpiId: string;
    label: string;
    trend: TrendResult;
    current: number;
    average: number;
  }>,
  facilityName: string
): Insight[] {
  const insights: Insight[] = [];
  let insightCounter = 0;

  const improving = metrics.filter(m => m.trend.direction === 'improving');
  const declining = metrics.filter(m => m.trend.direction === 'declining');

  if (improving.length > declining.length * 2) {
    insights.push({
      id: `trend-${++insightCounter}`,
      type: 'strength',
      title: 'Strong Overall Performance Trajectory',
      description: `${improving.length} of ${metrics.length} key metrics are improving over the trailing 12 months`,
      relatedKpis: improving.map(m => m.kpiId),
      priority: 'high',
      actionable: false
    });
  } else if (declining.length > improving.length * 2) {
    insights.push({
      id: `trend-${++insightCounter}`,
      type: 'warning',
      title: 'Multiple Metrics Trending Down',
      description: `${declining.length} of ${metrics.length} key metrics are declining - review operational drivers`,
      relatedKpis: declining.map(m => m.kpiId),
      priority: 'high',
      actionable: true
    });
  }

  const highVolatility = metrics.filter(m => m.trend.volatility > 25);
  if (highVolatility.length > 0) {
    insights.push({
      id: `trend-${++insightCounter}`,
      type: 'warning',
      title: 'High Metric Volatility Detected',
      description: `${highVolatility.map(m => m.label).join(', ')} show high month-to-month variation (>25%)`,
      relatedKpis: highVolatility.map(m => m.kpiId),
      priority: 'medium',
      actionable: true
    });
  }

  for (const metric of metrics) {
    if (metric.trend.direction === 'stable') continue;

    const isImproving = metric.trend.direction === 'improving';
    const changeAbs = Math.abs(metric.trend.changePercent);

    if (changeAbs < 10) continue;

    insights.push({
      id: `trend-${++insightCounter}`,
      type: isImproving ? 'strength' : 'warning',
      title: `${metric.label} ${isImproving ? 'Improving' : 'Declining'}`,
      description: `${isImproving ? 'Up' : 'Down'} ${changeAbs.toFixed(1)}% over trailing 12 months (current: ${metric.current.toFixed(1)}, avg: ${metric.average.toFixed(1)})`,
      relatedKpis: [metric.kpiId],
      priority: changeAbs > 20 ? 'high' : 'medium',
      actionable: !isImproving
    });
  }

  return insights;
}

export function generateT12MSummary(
  metrics: Array<{
    kpiId: string;
    trend: TrendResult;
  }>
): {
  improving: number;
  declining: number;
  stable: number;
  highVolatility: number;
} {
  return {
    improving: metrics.filter(m => m.trend.direction === 'improving').length,
    declining: metrics.filter(m => m.trend.direction === 'declining').length,
    stable: metrics.filter(m => m.trend.direction === 'stable').length,
    highVolatility: metrics.filter(m => m.trend.volatility > 25).length
  };
}
