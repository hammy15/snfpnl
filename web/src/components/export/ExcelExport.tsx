import { useState } from 'react';
import {
  FileSpreadsheet, Download, Check, Settings, ChevronDown, ChevronRight,
  Building2, TrendingUp, Calendar, Users, Layers
} from 'lucide-react';

interface ExportSheet {
  id: string;
  name: string;
  description: string;
  icon: typeof Building2;
  enabled: boolean;
  columns?: string[];
}

interface ExcelExportProps {
  facilityId?: number;
  periodId?: string;
  onExport?: (config: ExportConfig) => void;
}

interface ExportConfig {
  sheets: string[];
  dateRange: { start: string; end: string };
  format: 'xlsx' | 'csv';
  includeCharts: boolean;
  includeSummary: boolean;
}

const AVAILABLE_SHEETS: ExportSheet[] = [
  {
    id: 'summary',
    name: 'Executive Summary',
    description: 'Key metrics, highlights, and overview',
    icon: FileSpreadsheet,
    enabled: true,
    columns: ['Metric', 'Value', 'Change', 'Trend', 'Benchmark']
  },
  {
    id: 'facilities',
    name: 'Facilities Overview',
    description: 'All facilities with current metrics',
    icon: Building2,
    enabled: true,
    columns: ['Facility', 'State', 'Setting', 'Score', 'Margin', 'Occupancy', 'Skilled Mix']
  },
  {
    id: 'trends',
    name: 'Historical Trends',
    description: 'Month-over-month performance data',
    icon: TrendingUp,
    enabled: true,
    columns: ['Period', 'Facility', 'KPI', 'Value', 'MoM Change', 'YoY Change']
  },
  {
    id: 'kpis',
    name: 'KPI Details',
    description: 'All KPI values by facility and period',
    icon: Layers,
    enabled: true,
    columns: ['Facility', 'Period', 'KPI ID', 'KPI Name', 'Value', 'Unit']
  },
  {
    id: 'peer',
    name: 'Peer Comparison',
    description: 'Percentile rankings against peers',
    icon: Users,
    enabled: false,
    columns: ['Facility', 'KPI', 'Value', 'Peer Avg', 'Percentile', 'Rank']
  },
  {
    id: 'alerts',
    name: 'Alerts & Issues',
    description: 'Active alerts and threshold breaches',
    icon: Calendar,
    enabled: false,
    columns: ['Facility', 'Alert Type', 'Severity', 'KPI', 'Value', 'Threshold', 'Date']
  }
];

export function ExcelExport({ facilityId, periodId, onExport }: ExcelExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sheets, setSheets] = useState<ExportSheet[]>(AVAILABLE_SHEETS);
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: '2024-01-01',
    end: '2025-11-30'
  });
  const [isExporting, setIsExporting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleSheet = (sheetId: string) => {
    setSheets(sheets.map(s =>
      s.id === sheetId ? { ...s, enabled: !s.enabled } : s
    ));
  };

  const selectAll = () => {
    setSheets(sheets.map(s => ({ ...s, enabled: true })));
  };

  const selectNone = () => {
    setSheets(sheets.map(s => ({ ...s, enabled: false })));
  };

  const handleExport = async () => {
    setIsExporting(true);

    const config: ExportConfig = {
      sheets: sheets.filter(s => s.enabled).map(s => s.id),
      dateRange,
      format,
      includeCharts,
      includeSummary
    };

    try {
      // Call API to generate export
      const params = new URLSearchParams({
        sheets: config.sheets.join(','),
        startDate: config.dateRange.start,
        endDate: config.dateRange.end,
        format: config.format,
        includeCharts: String(config.includeCharts),
        includeSummary: String(config.includeSummary)
      });

      if (facilityId) params.append('facilityId', String(facilityId));
      if (periodId) params.append('periodId', periodId);

      const response = await fetch(`http://localhost:3002/api/export/excel?${params}`);

      if (!response.ok) throw new Error('Export failed');

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facility-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onExport?.(config);
      setIsOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
      // Fallback: trigger client-side export simulation
      alert('Export feature requires backend API. Please implement /api/export/excel endpoint.');
    } finally {
      setIsExporting(false);
    }
  };

  const enabledCount = sheets.filter(s => s.enabled).length;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary"
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <FileSpreadsheet size={16} />
        Export
        <ChevronDown size={14} style={{ marginLeft: '4px' }} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Export panel */}
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            width: '420px',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '16px',
            padding: '20px',
            zIndex: 100,
            boxShadow: '0 12px 48px var(--shadow-color)'
          }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(0, 217, 165, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileSpreadsheet size={20} style={{ color: '#00d9a5' }} />
                </div>
                <div>
                  <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>Export Data</h4>
                  <p className="text-xs text-muted">{enabledCount} sheets selected</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={selectAll}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                >
                  All
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={selectNone}
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                >
                  None
                </button>
              </div>
            </div>

            {/* Sheet selection */}
            <div className="space-y-2 mb-4" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {sheets.map(sheet => {
                const Icon = sheet.icon;
                return (
                  <div
                    key={sheet.id}
                    onClick={() => toggleSheet(sheet.id)}
                    style={{
                      padding: '12px',
                      background: sheet.enabled ? 'rgba(0, 217, 165, 0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${sheet.enabled ? 'rgba(0, 217, 165, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        border: `2px solid ${sheet.enabled ? '#00d9a5' : 'rgba(255,255,255,0.3)'}`,
                        background: sheet.enabled ? '#00d9a5' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {sheet.enabled && <Check size={12} color="#0f0f1a" />}
                      </div>
                      <Icon size={16} className="text-muted" />
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                          {sheet.name}
                        </div>
                        <div className="text-xs text-muted">{sheet.description}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Format selection */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm text-muted">Format:</span>
              <div className="flex gap-2">
                <button
                  className={`btn ${format === 'xlsx' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFormat('xlsx')}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Excel (.xlsx)
                </button>
                <button
                  className={`btn ${format === 'csv' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFormat('csv')}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  CSV
                </button>
              </div>
            </div>

            {/* Advanced options */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-muted mb-3"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Settings size={14} />
              Advanced Options
            </button>

            {showAdvanced && (
              <div style={{
                padding: '12px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                {/* Date range */}
                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label className="text-xs text-muted block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">End Date</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCharts}
                      onChange={(e) => setIncludeCharts(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      Include charts (Excel only)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSummary}
                      onChange={(e) => setIncludeSummary(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      Include portfolio summary
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={enabledCount === 0 || isExporting}
              className="btn btn-primary w-full"
              style={{
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isExporting ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                  Generating Export...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Export {enabledCount} Sheet{enabledCount !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Quick export button for single facility
export function QuickExport({ facilityId, periodId }: { facilityId: number; periodId: string }) {
  const [isExporting, setIsExporting] = useState(false);

  const handleQuickExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `http://localhost:3002/api/export/facility/${facilityId}?periodId=${periodId}&format=xlsx`
      );

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facility-${facilityId}-${periodId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Quick export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleQuickExport}
      disabled={isExporting}
      className="btn btn-secondary btn-icon"
      style={{ width: '36px', height: '36px' }}
      title="Quick Export to Excel"
    >
      {isExporting ? (
        <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
      ) : (
        <FileSpreadsheet size={16} />
      )}
    </button>
  );
}
