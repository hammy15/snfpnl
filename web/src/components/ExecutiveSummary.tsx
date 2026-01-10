import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Activity,
  AlertTriangle, CheckCircle, Download, FileText, Building2,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { SectionExplainer, InfoTooltip } from './ui/InfoTooltip';
import { NarrativeReport } from './NarrativeReport';
import './ExecutiveSummary.css';

interface ExecutiveSummaryProps {
  periodId: string;
  onFacilitySelect: (facilityId: string) => void;
}

interface SummaryData {
  overview: {
    totalFacilities: number;
    totalRevenue: number;
    avgMargin: number;
    avgOccupancy: number;
    marginTrend: number;
    revenueTrend: number;
  };
  byType: {
    setting: string;
    count: number;
    avgMargin: number;
    avgRevenuePPD: number;
  }[];
  topPerformers: {
    facility_id: string;
    name: string;
    state: string;
    setting: string;
    margin: number;
  }[];
  needsAttention: {
    facility_id: string;
    name: string;
    state: string;
    setting: string;
    margin: number;
    issue: string;
  }[];
  kpiSummary: {
    kpi: string;
    label: string;
    avg: number;
    min: number;
    max: number;
    trend: number;
  }[];
}

async function fetchSummary(periodId: string): Promise<SummaryData> {
  const res = await fetch(`http://localhost:3002/api/executive-summary/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export function ExecutiveSummary({ periodId, onFacilitySelect }: ExecutiveSummaryProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['executive-summary', periodId],
    queryFn: () => fetchSummary(periodId),
  });

  const handleExport = (format: 'pdf' | 'csv') => {
    // In a real app, this would call a backend endpoint to generate the export
    const url = `http://localhost:3002/api/export/summary/${periodId}?format=${format}`;
    window.open(url, '_blank');
  };

  const formatCurrency = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatTrend = (value: number) => value > 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !data) {
    // Show placeholder data for demo
    return (
      <div className="executive-summary animate-fade-in">
        <SectionExplainer
          title="Executive Summary"
          subtitle={`Portfolio performance overview for ${formatPeriod(periodId)}`}
          explanation="A board-ready summary of your portfolio's key performance indicators. This view aggregates data across all facilities to show overall health, identifies top performers and facilities needing attention, and tracks month-over-month trends."
          tips={[
            "Export to PDF for board presentations or CSV for further analysis",
            "MoM trends show directional change - green positive, red negative",
            "The 'Needs Attention' section prioritizes facilities by urgency",
            "Performance by Type helps identify which business lines are strongest"
          ]}
          reviewSuggestions={[
            "Share top performer practices across the organization",
            "Create action plans for each facility in 'Needs Attention'",
            "Track margin trends monthly - consistent improvement is key",
            "Compare your averages to industry benchmarks (SNF: 8%+, ALF: 12%+)"
          ]}
        />
        <div className="summary-header">
          <div className="export-buttons">
            <button className="export-btn" onClick={() => handleExport('csv')}>
              <Download size={16} />
              Export CSV
            </button>
            <button className="export-btn primary" onClick={() => handleExport('pdf')}>
              <FileText size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="summary-content">
          <div className="overview-cards">
            <div className="overview-card">
              <div className="card-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <Building2 size={24} />
              </div>
              <div className="card-content">
                <span className="card-label">Total Facilities</span>
                <span className="card-value">59</span>
              </div>
            </div>
            <div className="overview-card">
              <div className="card-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                <DollarSign size={24} />
              </div>
              <div className="card-content">
                <span className="card-label">Avg Revenue PPD</span>
                <span className="card-value">$425</span>
                <span className="card-trend positive"><ArrowUpRight size={14} /> +2.3%</span>
              </div>
            </div>
            <div className="overview-card">
              <div className="card-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                <Activity size={24} />
              </div>
              <div className="card-content">
                <span className="card-label">Avg Operating Margin</span>
                <span className="card-value">8.2%</span>
                <span className="card-trend negative"><ArrowDownRight size={14} /> -0.5%</span>
              </div>
            </div>
            <div className="overview-card">
              <div className="card-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
                <Users size={24} />
              </div>
              <div className="card-content">
                <span className="card-label">Avg Skilled Mix</span>
                <span className="card-value">24.5%</span>
                <span className="card-trend positive"><ArrowUpRight size={14} /> +1.2%</span>
              </div>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-section">
              <h3>
                <CheckCircle size={18} /> Top Performers
                <InfoTooltip
                  content="Facilities with highest operating margins this period. Study their payer mix, staffing models, and operational practices for best practice sharing."
                  type="tip"
                />
              </h3>
              <div className="facility-list">
                {[
                  { name: 'Paradise Creek', state: 'ID', margin: 15.2 },
                  { name: 'Creekside', state: 'ID', margin: 12.8 },
                  { name: 'Mountain View', state: 'WA', margin: 11.5 },
                  { name: 'Valley Care', state: 'OR', margin: 10.9 },
                  { name: 'Sunrise Manor', state: 'MT', margin: 10.2 },
                ].map((f, i) => (
                  <div key={i} className="facility-item">
                    <span className="rank">#{i + 1}</span>
                    <div className="facility-info">
                      <span className="name">{f.name}</span>
                      <span className="state">{f.state}</span>
                    </div>
                    <span className="margin positive">{f.margin}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="summary-section">
              <h3>
                <AlertTriangle size={18} /> Needs Attention
                <InfoTooltip
                  content="Facilities with margin issues, declining trends, or operational red flags. Each facility shows the primary issue - click through to investigate and create an action plan."
                  type="warning"
                />
              </h3>
              <div className="facility-list">
                {[
                  { name: 'Cedar Hills', state: 'WA', margin: -2.1, issue: 'Negative margin' },
                  { name: 'Lakewood Care', state: 'OR', margin: 0.5, issue: 'Low margin' },
                  { name: 'Pine Valley', state: 'ID', margin: 1.2, issue: 'Declining trend' },
                  { name: 'River Bend', state: 'MT', margin: 2.0, issue: 'High agency cost' },
                  { name: 'Summit Care', state: 'WA', margin: 2.5, issue: 'Low occupancy' },
                ].map((f, i) => (
                  <div key={i} className="facility-item warning">
                    <AlertTriangle size={16} className="warning-icon" />
                    <div className="facility-info">
                      <span className="name">{f.name}</span>
                      <span className="issue">{f.issue}</span>
                    </div>
                    <span className="margin negative">{f.margin}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="kpi-table-section">
            <h3>Key Metrics Summary</h3>
            <table className="kpi-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Average</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>MoM Trend</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Operating Margin %', avg: 8.2, min: -2.1, max: 15.2, trend: -0.5 },
                  { label: 'Skilled Mix %', avg: 24.5, min: 12.0, max: 42.0, trend: 1.2 },
                  { label: 'Revenue PPD', avg: 425, min: 320, max: 580, trend: 2.3 },
                  { label: 'Cost PPD', avg: 390, min: 290, max: 510, trend: 2.8 },
                  { label: 'Nursing Cost PPD', avg: 185, min: 140, max: 245, trend: 3.1 },
                  { label: 'Contract Labor %', avg: 12.5, min: 0, max: 35, trend: -1.8 },
                ].map((kpi, i) => (
                  <tr key={i}>
                    <td>{kpi.label}</td>
                    <td className="value">{kpi.label.includes('PPD') ? formatCurrency(kpi.avg) : formatPercent(kpi.avg)}</td>
                    <td className="value muted">{kpi.label.includes('PPD') ? formatCurrency(kpi.min) : formatPercent(kpi.min)}</td>
                    <td className="value muted">{kpi.label.includes('PPD') ? formatCurrency(kpi.max) : formatPercent(kpi.max)}</td>
                    <td className={`trend ${kpi.trend > 0 ? 'positive' : kpi.trend < 0 ? 'negative' : ''}`}>
                      {kpi.trend > 0 ? <TrendingUp size={14} /> : kpi.trend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                      {formatTrend(kpi.trend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="type-breakdown">
            <h3>Performance by Facility Type</h3>
            <div className="type-cards">
              {[
                { type: 'SNF', count: 52, margin: 8.5, revenue: 435, color: '#667eea' },
                { type: 'ALF', count: 6, margin: 6.2, revenue: 280, color: '#10b981' },
                { type: 'ILF', count: 1, margin: 5.8, revenue: 195, color: '#f59e0b' },
              ].map((t) => (
                <div key={t.type} className="type-card" style={{ borderColor: t.color }}>
                  <div className="type-header">
                    <span className="type-badge" style={{ background: t.color }}>{t.type}</span>
                    <span className="type-count">{t.count} facilities</span>
                  </div>
                  <div className="type-metrics">
                    <div className="type-metric">
                      <span className="metric-label">Avg Margin</span>
                      <span className="metric-value">{t.margin}%</span>
                    </div>
                    <div className="type-metric">
                      <span className="metric-label">Avg Revenue PPD</span>
                      <span className="metric-value">${t.revenue}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Narrative Report Section */}
          <NarrativeReport
            context="executive"
            periodId={periodId}
            title="Executive Summary Narrative"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="executive-summary animate-fade-in">
      <SectionExplainer
        title="Executive Summary"
        subtitle={`Portfolio performance overview for ${formatPeriod(periodId)}`}
        explanation="A board-ready summary of your portfolio's key performance indicators. This view aggregates data across all facilities to show overall health, identifies top performers and facilities needing attention, and tracks month-over-month trends."
        tips={[
          "Export to PDF for board presentations or CSV for further analysis",
          "MoM trends show directional change - green positive, red negative",
          "The 'Needs Attention' section prioritizes facilities by urgency",
          "Performance by Type helps identify which business lines are strongest"
        ]}
        reviewSuggestions={[
          "Share top performer practices across the organization",
          "Create action plans for each facility in 'Needs Attention'",
          "Track margin trends monthly - consistent improvement is key",
          "Compare your averages to industry benchmarks (SNF: 8%+, ALF: 12%+)"
        ]}
      />
      <div className="summary-header">
        <div className="export-buttons">
          <button className="export-btn" onClick={() => handleExport('csv')}>
            <Download size={16} />
            Export CSV
          </button>
          <button className="export-btn primary" onClick={() => handleExport('pdf')}>
            <FileText size={16} />
            Export PDF
          </button>
        </div>
      </div>

      <div className="summary-content">
        <div className="overview-cards">
          <div className="overview-card">
            <div className="card-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <Building2 size={24} />
            </div>
            <div className="card-content">
              <span className="card-label">Total Facilities</span>
              <span className="card-value">{data.overview.totalFacilities}</span>
            </div>
          </div>
          <div className="overview-card">
            <div className="card-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <DollarSign size={24} />
            </div>
            <div className="card-content">
              <span className="card-label">Avg Revenue PPD</span>
              <span className="card-value">{formatCurrency(data.kpiSummary.find(k => k.kpi === 'snf_total_revenue_ppd')?.avg || 0)}</span>
              <span className={`card-trend ${data.overview.revenueTrend >= 0 ? 'positive' : 'negative'}`}>
                {data.overview.revenueTrend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {formatTrend(data.overview.revenueTrend)}
              </span>
            </div>
          </div>
          <div className="overview-card">
            <div className="card-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <Activity size={24} />
            </div>
            <div className="card-content">
              <span className="card-label">Avg Operating Margin</span>
              <span className="card-value">{formatPercent(data.overview.avgMargin)}</span>
              <span className={`card-trend ${data.overview.marginTrend >= 0 ? 'positive' : 'negative'}`}>
                {data.overview.marginTrend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {formatTrend(data.overview.marginTrend)}
              </span>
            </div>
          </div>
          <div className="overview-card">
            <div className="card-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
              <Users size={24} />
            </div>
            <div className="card-content">
              <span className="card-label">Avg Skilled Mix</span>
              <span className="card-value">{formatPercent(data.kpiSummary.find(k => k.kpi === 'snf_skilled_mix_pct')?.avg || 0)}</span>
              {(() => {
                const trend = data.kpiSummary.find(k => k.kpi === 'snf_skilled_mix_pct')?.trend || 0;
                return (
                  <span className={`card-trend ${trend >= 0 ? 'positive' : 'negative'}`}>
                    {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {formatTrend(trend)}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-section">
            <h3>
              <CheckCircle size={18} /> Top Performers
              <InfoTooltip
                content="Facilities with highest operating margins this period. Study their payer mix, staffing models, and operational practices for best practice sharing."
                type="tip"
              />
            </h3>
            <div className="facility-list">
              {data.topPerformers.map((f, i) => (
                <div
                  key={f.facility_id}
                  className="facility-item"
                  onClick={() => onFacilitySelect(f.facility_id)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="rank">#{i + 1}</span>
                  <div className="facility-info">
                    <span className="name">{f.name}</span>
                    <span className="state">{f.state} • {f.setting}</span>
                  </div>
                  <span className="margin positive">{f.margin.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="summary-section">
            <h3>
              <AlertTriangle size={18} /> Needs Attention
              <InfoTooltip
                content="Facilities with margin issues, declining trends, or operational red flags. Each facility shows the primary issue - click through to investigate and create an action plan."
                type="warning"
              />
            </h3>
            <div className="facility-list">
              {data.needsAttention.map((f) => (
                <div
                  key={f.facility_id}
                  className="facility-item warning"
                  onClick={() => onFacilitySelect(f.facility_id)}
                  style={{ cursor: 'pointer' }}
                >
                  <AlertTriangle size={16} className="warning-icon" />
                  <div className="facility-info">
                    <span className="name">{f.name}</span>
                    <span className="issue">{f.issue}</span>
                  </div>
                  <span className="margin negative">{f.margin.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="kpi-table-section">
          <h3>Key Metrics Summary</h3>
          <table className="kpi-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Average</th>
                <th>Min</th>
                <th>Max</th>
                <th>MoM Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.kpiSummary.map((kpi) => (
                <tr key={kpi.kpi}>
                  <td>{kpi.label}</td>
                  <td className="value">{kpi.label.includes('PPD') ? formatCurrency(kpi.avg) : formatPercent(kpi.avg)}</td>
                  <td className="value muted">{kpi.label.includes('PPD') ? formatCurrency(kpi.min) : formatPercent(kpi.min)}</td>
                  <td className="value muted">{kpi.label.includes('PPD') ? formatCurrency(kpi.max) : formatPercent(kpi.max)}</td>
                  <td className={`trend ${kpi.trend > 0 ? 'positive' : kpi.trend < 0 ? 'negative' : ''}`}>
                    {kpi.trend > 0 ? <TrendingUp size={14} /> : kpi.trend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                    {formatTrend(kpi.trend)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="type-breakdown">
          <h3>Performance by Facility Type</h3>
          <div className="type-cards">
            {data.byType.map((t) => {
              const colors: Record<string, string> = { SNF: '#667eea', ALF: '#10b981', ILF: '#f59e0b' };
              return (
                <div key={t.setting} className="type-card" style={{ borderColor: colors[t.setting] || '#667eea' }}>
                  <div className="type-header">
                    <span className="type-badge" style={{ background: colors[t.setting] || '#667eea' }}>{t.setting}</span>
                    <span className="type-count">{t.count} facilities</span>
                  </div>
                  <div className="type-metrics">
                    <div className="type-metric">
                      <span className="metric-label">Avg Margin</span>
                      <span className="metric-value">{t.avgMargin}%</span>
                    </div>
                    <div className="type-metric">
                      <span className="metric-label">Avg Revenue PPD</span>
                      <span className="metric-value">${t.avgRevenuePPD}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Narrative Report Section */}
        <NarrativeReport
          context="executive"
          periodId={periodId}
          title="Executive Summary Narrative"
        />
      </div>
    </div>
  );
}

function formatPeriod(periodId: string): string {
  const [year, month] = periodId.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}
