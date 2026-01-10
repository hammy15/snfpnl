import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, TrendingUp, TrendingDown, Minus, GitCompare } from 'lucide-react';
import { SectionExplainer } from './ui/InfoTooltip';
import { NarrativeReport } from './NarrativeReport';
import './PeriodComparison.css';

interface ComparisonProps {
  currentPeriod: string;
  onFacilitySelect: (facilityId: string) => void;
}

interface ComparisonData {
  facility_id: string;
  name: string;
  state: string;
  setting: string;
  kpis: {
    kpi_id: string;
    label: string;
    current: number | null;
    comparison: number | null;
    change: number | null;
    changePercent: number | null;
  }[];
}

const KPI_LABELS: Record<string, string> = {
  snf_operating_margin_pct: 'Operating Margin %',
  snf_skilled_mix_pct: 'Skilled Mix %',
  snf_total_revenue_ppd: 'Revenue PPD',
  snf_total_cost_ppd: 'Cost PPD',
  snf_nursing_cost_ppd: 'Nursing Cost PPD',
  snf_contract_labor_pct_nursing: 'Contract Labor %',
};

async function fetchPeriods(): Promise<string[]> {
  const res = await fetch('https://snfpnl.onrender.com/api/periods');
  if (!res.ok) throw new Error('Failed to fetch periods');
  return res.json();
}

async function fetchComparison(period1: string, period2: string): Promise<ComparisonData[]> {
  const res = await fetch(`https://snfpnl.onrender.com/api/comparison?period1=${period1}&period2=${period2}`);
  if (!res.ok) throw new Error('Failed to fetch comparison');
  return res.json();
}

export function PeriodComparison({ currentPeriod, onFacilitySelect }: ComparisonProps) {
  const [comparisonPeriod, setComparisonPeriod] = useState<string>('');
  const [selectedKPI, setSelectedKPI] = useState('snf_operating_margin_pct');

  const { data: periods = [] } = useQuery({
    queryKey: ['periods'],
    queryFn: fetchPeriods,
  });

  // Set default comparison period to previous month
  useState(() => {
    if (periods.length > 1) {
      const currentIndex = periods.indexOf(currentPeriod);
      if (currentIndex < periods.length - 1) {
        setComparisonPeriod(periods[currentIndex + 1]);
      }
    }
  });

  const { data: comparison = [], isLoading } = useQuery({
    queryKey: ['comparison', currentPeriod, comparisonPeriod],
    queryFn: () => fetchComparison(currentPeriod, comparisonPeriod),
    enabled: !!comparisonPeriod,
  });

  const formatValue = (value: number | null, kpiId: string) => {
    if (value === null) return '--';
    if (kpiId.includes('ppd') || kpiId.includes('revenue') || kpiId.includes('cost')) {
      return `$${value.toFixed(2)}`;
    }
    return `${value.toFixed(1)}%`;
  };

  const formatChange = (change: number | null, kpiId: string) => {
    if (change === null) return '--';
    const prefix = change > 0 ? '+' : '';
    if (kpiId.includes('ppd') || kpiId.includes('revenue') || kpiId.includes('cost')) {
      return `${prefix}$${change.toFixed(2)}`;
    }
    return `${prefix}${change.toFixed(1)}%`;
  };

  const getChangeColor = (change: number | null, kpiId: string) => {
    if (change === null || change === 0) return 'neutral';
    // For costs and contract labor, lower is better
    const lowerIsBetter = kpiId.includes('cost') || kpiId.includes('contract_labor');
    if (lowerIsBetter) {
      return change < 0 ? 'positive' : 'negative';
    }
    return change > 0 ? 'positive' : 'negative';
  };

  const formatPeriod = (periodId: string): string => {
    const [year, month] = periodId.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const displayData = comparison;

  return (
    <div className="period-comparison animate-fade-in">
      <SectionExplainer
        title="Period Comparison"
        subtitle="Compare performance across time periods"
        explanation="Compare any two periods side-by-side to identify improvements, declines, and trends. This is essential for tracking the impact of operational changes and understanding seasonal patterns."
        tips={[
          "Compare month-over-month (MoM) for recent trends, year-over-year (YoY) for seasonal patterns",
          "Green = improved performance (higher margin/revenue, lower costs)",
          "Red = declined performance - investigate the root cause",
          "Use the KPI selector to focus on specific metrics"
        ]}
        reviewSuggestions={[
          "After operational changes, compare pre/post periods to measure impact",
          "Compare same month last year to account for seasonality",
          "Look for facilities that improved - understand what they did differently",
          "Track facilities that declined multiple periods in a row - they need intervention"
        ]}
      />
      <div className="comparison-header">
        <div className="header-title">
          <GitCompare size={24} />
        </div>

        <div className="comparison-controls">
          <div className="period-selector">
            <select
              value={currentPeriod}
              disabled
              className="period-select"
            >
              <option value={currentPeriod}>{formatPeriod(currentPeriod)}</option>
            </select>
            <ArrowRight size={20} className="arrow" />
            <select
              value={comparisonPeriod}
              onChange={(e) => setComparisonPeriod(e.target.value)}
              className="period-select"
            >
              <option value="">Select period...</option>
              {periods.filter(p => p !== currentPeriod).map(period => (
                <option key={period} value={period}>{formatPeriod(period)}</option>
              ))}
            </select>
          </div>

          <select
            value={selectedKPI}
            onChange={(e) => setSelectedKPI(e.target.value)}
            className="kpi-select"
          >
            {Object.entries(KPI_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {!comparisonPeriod ? (
        <div className="empty-state">
          <GitCompare size={48} />
          <h3>Select a comparison period</h3>
          <p>Choose a period to compare against {formatPeriod(currentPeriod)}</p>
        </div>
      ) : isLoading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : (
        <div className="comparison-content">
          <div className="comparison-summary">
            <div className="summary-card improved">
              <TrendingUp size={20} />
              <div>
                <span className="count">{displayData.filter(f => {
                  const kpi = f.kpis.find(k => k.kpi_id === selectedKPI);
                  return kpi && kpi.change && getChangeColor(kpi.change, selectedKPI) === 'positive';
                }).length}</span>
                <span className="label">Improved</span>
              </div>
            </div>
            <div className="summary-card declined">
              <TrendingDown size={20} />
              <div>
                <span className="count">{displayData.filter(f => {
                  const kpi = f.kpis.find(k => k.kpi_id === selectedKPI);
                  return kpi && kpi.change && getChangeColor(kpi.change, selectedKPI) === 'negative';
                }).length}</span>
                <span className="label">Declined</span>
              </div>
            </div>
            <div className="summary-card unchanged">
              <Minus size={20} />
              <div>
                <span className="count">{displayData.filter(f => {
                  const kpi = f.kpis.find(k => k.kpi_id === selectedKPI);
                  return !kpi || kpi.change === null || kpi.change === 0;
                }).length}</span>
                <span className="label">Unchanged</span>
              </div>
            </div>
          </div>

          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>{formatPeriod(comparisonPeriod)}</th>
                  <th>{formatPeriod(currentPeriod)}</th>
                  <th>Change</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {displayData
                  .map(facility => {
                    const kpi = facility.kpis.find(k => k.kpi_id === selectedKPI);
                    return { ...facility, kpi };
                  })
                  .sort((a, b) => {
                    const aChange = a.kpi?.change || 0;
                    const bChange = b.kpi?.change || 0;
                    return bChange - aChange;
                  })
                  .map(facility => {
                    const changeColor = getChangeColor(facility.kpi?.change || null, selectedKPI);
                    return (
                      <tr
                        key={facility.facility_id}
                        onClick={() => onFacilitySelect(facility.facility_id)}
                      >
                        <td>
                          <div className="facility-cell">
                            <span className="facility-name">{facility.name}</span>
                            <span className="facility-meta">{facility.state} • {facility.setting}</span>
                          </div>
                        </td>
                        <td className="value-cell">
                          {formatValue(facility.kpi?.comparison || null, selectedKPI)}
                        </td>
                        <td className="value-cell current">
                          {formatValue(facility.kpi?.current || null, selectedKPI)}
                        </td>
                        <td className={`change-cell ${changeColor}`}>
                          {formatChange(facility.kpi?.change || null, selectedKPI)}
                        </td>
                        <td className="trend-cell">
                          <div className={`trend-indicator ${changeColor}`}>
                            {changeColor === 'positive' && <TrendingUp size={16} />}
                            {changeColor === 'negative' && <TrendingDown size={16} />}
                            {changeColor === 'neutral' && <Minus size={16} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Narrative Report Section */}
      <NarrativeReport
        context="comparison"
        periodId={currentPeriod}
        title="Period Comparison Narrative"
      />
    </div>
  );
}
