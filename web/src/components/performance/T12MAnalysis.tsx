import { useQuery } from '@tanstack/react-query';
import { useState, useRef, useMemo } from 'react';
import { Download, Loader2, Calendar, ChevronDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { T12MMetricCard } from './T12MMetricCard';
import { T12MTrendChart } from './T12MTrendChart';
import { SectionExplainer } from '../ui/InfoTooltip';
import './T12MAnalysis.css';

type DateRangePreset = 'T12M' | 'T6M' | 'T3M' | 'YTD' | 'custom';

interface T12MAnalysisProps {
  facilityId: string;
  periodId: string;
}

interface T12MMetric {
  kpiId: string;
  label: string;
  format: string;
  stats: {
    current: number;
    average: number;
    min: { value: number; periodId: string; index: number };
    max: { value: number; periodId: string; index: number };
    stdDev: number;
    trend: {
      direction: 'improving' | 'declining' | 'stable';
      changePercent: number;
      slope: number;
      volatility: number;
    };
    momChange: number | null;
    yoyChange: number | null;
  };
  sparklineData: { period: string; value: number }[];
}

interface T12MData {
  facility: { facility_id: string; name: string; state: string; setting: string };
  periodRange: { start: string; end: string; startLabel: string; endLabel: string };
  summary: { improving: number; declining: number; stable: number; highVolatility: number };
  metrics: T12MMetric[];
  insights: Array<{
    id: string;
    type: 'opportunity' | 'warning' | 'pattern' | 'strength';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

async function fetchT12MData(facilityId: string, periodId: string, months?: number): Promise<T12MData> {
  const url = new URL(`https://snfpnl.onrender.com/api/performance/t12m/${facilityId}`);
  url.searchParams.set('periodId', periodId);
  if (months) url.searchParams.set('months', String(months));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch T12M data');
  return res.json();
}

function getPresetMonths(preset: DateRangePreset, currentPeriod: string): number {
  switch (preset) {
    case 'T12M': return 12;
    case 'T6M': return 6;
    case 'T3M': return 3;
    case 'YTD':
      const month = parseInt(currentPeriod.split('-')[1]);
      return month; // Current month number = months from start of year
    default: return 12;
  }
}

function getPresetLabel(preset: DateRangePreset): string {
  switch (preset) {
    case 'T12M': return 'Last 12 Months';
    case 'T6M': return 'Last 6 Months';
    case 'T3M': return 'Last 3 Months';
    case 'YTD': return 'Year to Date';
    case 'custom': return 'Custom Range';
  }
}

export function T12MAnalysis({ facilityId, periodId }: T12MAnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<T12MMetric | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('T12M');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const months = useMemo(() => getPresetMonths(dateRangePreset, periodId), [dateRangePreset, periodId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['t12m', facilityId, periodId, months],
    queryFn: () => fetchT12MData(facilityId, periodId, months),
  });

  const handleExportPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!contentRef.current || !data) return;

    setIsExporting(true);
    try {
      const element = contentRef.current;

      // Capture the content
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#1a1a2e',
      });

      // Create PDF
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');

      // Title page
      pdf.setFillColor(26, 26, 46);
      pdf.rect(0, 0, 210, 297, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text('Trailing 12-Month Performance', 105, 80, { align: 'center' });

      pdf.setFontSize(18);
      pdf.setTextColor(102, 126, 234);
      pdf.text(data.facility.name, 105, 100, { align: 'center' });

      pdf.setFontSize(14);
      pdf.setTextColor(180, 180, 200);
      pdf.text(`${data.periodRange.startLabel} - ${data.periodRange.endLabel}`, 105, 115, { align: 'center' });

      // Summary stats
      pdf.setFontSize(12);
      pdf.setTextColor(150, 150, 170);
      pdf.text(`${data.summary.improving} Improving | ${data.summary.stable} Stable | ${data.summary.declining} Declining`, 105, 140, { align: 'center' });

      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 120);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 105, 275, { align: 'center' });
      pdf.text('SNFPNL - SNF Financial Intelligence', 105, 282, { align: 'center' });

      // Content pages
      const imgData = canvas.toDataURL('image/png');
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Save
      const fileName = `T12M_${data.facility.name.replace(/[^a-z0-9]/gi, '_')}_${periodId}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="t12m-analysis loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="t12m-analysis error">
        Failed to load T12M analysis
      </div>
    );
  }

  const { summary, metrics, insights, periodRange } = data;

  return (
    <div className="t12m-analysis">
      <div className="t12m-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="t12m-title">
          <span className="collapse-icon">{isExpanded ? '▼' : '▶'}</span>
          <h3>Performance Analysis</h3>
          <span className="period-range">{periodRange.startLabel} - {periodRange.endLabel}</span>
        </div>
        <div className="t12m-header-right">
          {/* Date Range Selector */}
          <div className="date-range-selector" onClick={(e) => e.stopPropagation()}>
            <button
              className="date-range-btn"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <Calendar size={14} />
              <span>{getPresetLabel(dateRangePreset)}</span>
              <ChevronDown size={14} />
            </button>
            {showDatePicker && (
              <>
                <div className="date-picker-backdrop" onClick={() => setShowDatePicker(false)} />
                <div className="date-range-dropdown">
                  <div className="date-range-presets">
                    {(['T12M', 'T6M', 'T3M', 'YTD'] as DateRangePreset[]).map(preset => (
                      <button
                        key={preset}
                        className={`preset-btn ${dateRangePreset === preset ? 'active' : ''}`}
                        onClick={() => {
                          setDateRangePreset(preset);
                          setShowDatePicker(false);
                        }}
                      >
                        {getPresetLabel(preset)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="t12m-summary-badges">
            <span className="badge improving" title="Metrics improving">
              ↑ {summary.improving}
            </span>
            <span className="badge stable" title="Metrics stable">
              → {summary.stable}
            </span>
            <span className="badge declining" title="Metrics declining">
              ↓ {summary.declining}
            </span>
            {summary.highVolatility > 0 && (
              <span className="badge volatility" title="High volatility metrics">
                ⚡ {summary.highVolatility}
              </span>
            )}
          </div>
          <button
            className="t12m-export-btn"
            onClick={handleExportPDF}
            disabled={isExporting}
            title="Export analysis to PDF"
          >
            {isExporting ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Download size={16} />
            )}
            {isExporting ? 'Exporting...' : 'PDF'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="t12m-content" ref={contentRef}>
          <SectionExplainer
            title="T12M Trend Analysis"
            subtitle="Performance patterns over the trailing year"
            explanation="This view shows how each key metric has performed over the past 12 months. Sparklines reveal trends at a glance - click any metric card to see the full trend chart with high/low points marked."
            tips={[
              "Green arrows indicate improving trends, red indicates decline",
              "Click any metric card to expand the detailed trend chart",
              "High volatility (⚡) metrics may need closer monitoring",
              "MoM shows month-over-month change, YoY shows year-over-year"
            ]}
          />

          {/* Insights Section */}
          {insights.length > 0 && (
            <div className="t12m-insights">
              <h4>Key Insights</h4>
              <div className="insights-grid">
                {insights.slice(0, 4).map(insight => (
                  <div key={insight.id} className={`insight-card ${insight.type} ${insight.priority}`}>
                    <div className="insight-header">
                      <span className={`insight-type ${insight.type}`}>
                        {insight.type === 'warning' && '⚠️'}
                        {insight.type === 'strength' && '💪'}
                        {insight.type === 'opportunity' && '🎯'}
                        {insight.type === 'pattern' && '📊'}
                      </span>
                      <span className="insight-title">{insight.title}</span>
                    </div>
                    <p className="insight-description">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="t12m-metrics-grid">
            {metrics.map(metric => (
              <T12MMetricCard
                key={metric.kpiId}
                metric={metric}
                isSelected={selectedMetric?.kpiId === metric.kpiId}
                onClick={() => setSelectedMetric(
                  selectedMetric?.kpiId === metric.kpiId ? null : metric
                )}
              />
            ))}
          </div>

          {/* Expanded Trend Chart */}
          {selectedMetric && (
            <T12MTrendChart
              metric={selectedMetric}
              onClose={() => setSelectedMetric(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
