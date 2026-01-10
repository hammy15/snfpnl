import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { SectionExplainer, InfoTooltip } from './ui/InfoTooltip';
import { NarrativeReport } from './NarrativeReport';
import './HeatMap.css';

type SettingFilter = 'all' | 'SNF' | 'ALF' | 'ILF';

interface HeatMapProps {
  periodId: string;
  settingFilter: SettingFilter;
  onFacilitySelect: (facilityId: string) => void;
}

interface FacilityWithKPI {
  facility_id: string;
  name: string;
  state: string;
  setting: string;
  kpi_id: string;
  value: number | null;
}

// Western states with their approximate positions on a simplified map
const STATE_POSITIONS: Record<string, { x: number; y: number; width: number; height: number }> = {
  WA: { x: 80, y: 20, width: 120, height: 80 },
  OR: { x: 80, y: 100, width: 120, height: 100 },
  ID: { x: 200, y: 40, width: 100, height: 160 },
  MT: { x: 300, y: 20, width: 160, height: 100 },
  WY: { x: 320, y: 120, width: 120, height: 80 },
  NV: { x: 100, y: 200, width: 100, height: 140 },
  UT: { x: 200, y: 200, width: 80, height: 120 },
  CO: { x: 280, y: 200, width: 120, height: 90 },
  CA: { x: 20, y: 180, width: 80, height: 200 },
  AZ: { x: 140, y: 340, width: 100, height: 100 },
  NM: { x: 240, y: 320, width: 100, height: 100 },
};

const KPI_OPTIONS = [
  { id: 'snf_operating_margin_pct', label: 'Operating Margin %', format: 'percentage' },
  { id: 'snf_skilled_mix_pct', label: 'Skilled Mix %', format: 'percentage' },
  { id: 'snf_total_revenue_ppd', label: 'Revenue PPD', format: 'currency' },
  { id: 'snf_total_cost_ppd', label: 'Cost PPD', format: 'currency' },
  { id: 'snf_nursing_cost_ppd', label: 'Nursing Cost PPD', format: 'currency' },
  { id: 'snf_contract_labor_pct_nursing', label: 'Contract Labor %', format: 'percentage' },
];

async function fetchAllKPIs(periodId: string): Promise<FacilityWithKPI[]> {
  const res = await fetch(`https://snfpnl-production.up.railway.app/api/kpis/all/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch KPIs');
  return res.json();
}

export function HeatMap({ periodId, settingFilter, onFacilitySelect }: HeatMapProps) {
  const [selectedKPI, setSelectedKPI] = useState('snf_operating_margin_pct');
  const [hoveredFacility, setHoveredFacility] = useState<FacilityWithKPI | null>(null);

  const { data: allKPIs = [], isLoading } = useQuery({
    queryKey: ['allKPIs', periodId],
    queryFn: () => fetchAllKPIs(periodId),
  });

  // Filter and group facilities by state
  const facilitiesByState = allKPIs
    .filter((f) => f.kpi_id === selectedKPI)
    .filter((f) => settingFilter === 'all' || f.setting === settingFilter)
    .reduce((acc, facility) => {
      const state = facility.state;
      if (!acc[state]) acc[state] = [];
      acc[state].push(facility);
      return acc;
    }, {} as Record<string, FacilityWithKPI[]>);

  // Calculate state averages
  const stateAverages = Object.entries(facilitiesByState).reduce((acc, [state, facilities]) => {
    const validFacilities = facilities.filter((f) => f.value !== null);
    if (validFacilities.length > 0) {
      acc[state] = validFacilities.reduce((sum, f) => sum + (f.value || 0), 0) / validFacilities.length;
    }
    return acc;
  }, {} as Record<string, number>);

  const getHeatColor = (value: number | undefined, kpiId: string) => {
    if (value === undefined) return 'rgba(255, 255, 255, 0.1)';

    // For operating margin and skilled mix, higher is better
    // For costs and contract labor, lower is better
    const isHigherBetter = ['snf_operating_margin_pct', 'snf_skilled_mix_pct', 'snf_total_revenue_ppd'].includes(kpiId);

    let normalizedValue: number;
    if (kpiId.includes('margin') || kpiId.includes('mix') || kpiId.includes('pct')) {
      normalizedValue = Math.min(Math.max(value / 30, 0), 1); // 0-30% range
    } else {
      normalizedValue = Math.min(Math.max((value - 200) / 300, 0), 1); // $200-$500 range
    }

    if (!isHigherBetter) normalizedValue = 1 - normalizedValue;

    // Color gradient from red (bad) through yellow to green (good)
    if (normalizedValue < 0.5) {
      const ratio = normalizedValue * 2;
      return `rgba(${255}, ${Math.round(ratio * 200)}, ${50}, 0.8)`;
    } else {
      const ratio = (normalizedValue - 0.5) * 2;
      return `rgba(${Math.round(255 - ratio * 200)}, ${200}, ${Math.round(50 + ratio * 100)}, 0.8)`;
    }
  };

  const selectedKPIOption = KPI_OPTIONS.find((k) => k.id === selectedKPI);

  const formatValue = (value: number | null, format: string) => {
    if (value === null) return '--';
    if (format === 'currency') return `$${value.toFixed(2)}`;
    if (format === 'percentage') return `${value.toFixed(1)}%`;
    return value.toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="heat-map animate-fade-in">
      <SectionExplainer
        title="Performance Heat Map"
        subtitle="Western US Portfolio Overview"
        explanation="This geographic view shows how facilities perform across states. Colors indicate performance levels - green is strong, yellow is moderate, red needs attention. State averages help identify regional patterns."
        tips={[
          "Use the KPI dropdown to switch between metrics (margin, revenue, costs)",
          "Hover over facility dots to see individual building details",
          "Click any dot to navigate to that facility's detail page",
          "State cards below show a ranked breakdown of facilities"
        ]}
        reviewSuggestions={[
          "Compare state averages to identify regional performance gaps",
          "Look for clustering of underperformers in specific states",
          "High contract labor regions may indicate local staffing market challenges"
        ]}
      />
      <div className="heat-map-header">
        <div className="heat-map-controls">
          <span className="control-label">
            Select Metric
            <InfoTooltip
              content="Choose which KPI to visualize. Operating Margin shows overall profitability, Skilled Mix indicates payer composition, Revenue/Cost PPD shows per-patient economics."
              type="info"
            />
          </span>
          <select
            value={selectedKPI}
            onChange={(e) => setSelectedKPI(e.target.value)}
            className="kpi-select"
          >
            {KPI_OPTIONS.map((kpi) => (
              <option key={kpi.id} value={kpi.id}>
                {kpi.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="heat-map-container">
        <svg viewBox="0 0 500 480" className="map-svg">
          {/* State shapes */}
          {Object.entries(STATE_POSITIONS).map(([state, pos]) => (
            <g key={state}>
              <rect
                x={pos.x}
                y={pos.y}
                width={pos.width}
                height={pos.height}
                fill={getHeatColor(stateAverages[state], selectedKPI)}
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="2"
                rx="8"
                className="state-rect"
              />
              <text
                x={pos.x + pos.width / 2}
                y={pos.y + pos.height / 2 - 10}
                textAnchor="middle"
                className="state-label"
              >
                {state}
              </text>
              {stateAverages[state] !== undefined && (
                <text
                  x={pos.x + pos.width / 2}
                  y={pos.y + pos.height / 2 + 12}
                  textAnchor="middle"
                  className="state-value"
                >
                  {formatValue(stateAverages[state], selectedKPIOption?.format || 'number')}
                </text>
              )}
              {facilitiesByState[state] && (
                <text
                  x={pos.x + pos.width / 2}
                  y={pos.y + pos.height / 2 + 28}
                  textAnchor="middle"
                  className="state-count"
                >
                  {facilitiesByState[state].length} facilities
                </text>
              )}
            </g>
          ))}

          {/* Facility dots */}
          {Object.entries(facilitiesByState).map(([state, facilities]) => {
            const pos = STATE_POSITIONS[state];
            if (!pos) return null;

            return facilities.map((facility, idx) => {
              const cols = Math.ceil(Math.sqrt(facilities.length));
              const row = Math.floor(idx / cols);
              const col = idx % cols;
              const dotSize = Math.min(12, pos.width / (cols + 1));
              const x = pos.x + (col + 1) * (pos.width / (cols + 1));
              const y = pos.y + pos.height - 30 - (row + 1) * 14;

              return (
                <circle
                  key={facility.facility_id}
                  cx={x}
                  cy={y}
                  r={dotSize / 2}
                  fill={getHeatColor(facility.value ?? undefined, selectedKPI)}
                  stroke="rgba(255, 255, 255, 0.5)"
                  strokeWidth="1"
                  className="facility-dot"
                  onMouseEnter={() => setHoveredFacility(facility)}
                  onMouseLeave={() => setHoveredFacility(null)}
                  onClick={() => onFacilitySelect(facility.facility_id)}
                />
              );
            });
          })}
        </svg>

        {/* Legend */}
        <div className="heat-map-legend">
          <span className="legend-label">Poor</span>
          <div className="legend-gradient" />
          <span className="legend-label">Excellent</span>
        </div>

        {/* Tooltip */}
        {hoveredFacility && (
          <div className="heat-map-tooltip">
            <div className="tooltip-header">{hoveredFacility.name}</div>
            <div className="tooltip-meta">
              <span className={`badge badge-${hoveredFacility.setting.toLowerCase()}`}>
                {hoveredFacility.setting}
              </span>
              <span>{hoveredFacility.state}</span>
            </div>
            <div className="tooltip-value">
              {selectedKPIOption?.label}:{' '}
              <strong>{formatValue(hoveredFacility.value, selectedKPIOption?.format || 'number')}</strong>
            </div>
          </div>
        )}
      </div>

      {/* State breakdown cards */}
      <div className="state-cards">
        {Object.entries(facilitiesByState)
          .filter(([state]) => STATE_POSITIONS[state])
          .sort((a, b) => (stateAverages[b[0]] || 0) - (stateAverages[a[0]] || 0))
          .map(([state, facilities]) => (
            <div key={state} className="state-card">
              <div className="state-card-header">
                <span className="state-card-name">{state}</span>
                <span className="state-card-avg">
                  {formatValue(stateAverages[state], selectedKPIOption?.format || 'number')}
                </span>
              </div>
              <div className="state-card-facilities">
                {facilities.slice(0, 5).map((f) => (
                  <div
                    key={f.facility_id}
                    className="state-card-facility"
                    onClick={() => onFacilitySelect(f.facility_id)}
                  >
                    <span className="facility-name">{f.name}</span>
                    <span className="facility-value">
                      {formatValue(f.value, selectedKPIOption?.format || 'number')}
                    </span>
                  </div>
                ))}
                {facilities.length > 5 && (
                  <div className="state-card-more">+{facilities.length - 5} more</div>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Narrative Report Section */}
      <NarrativeReport
        context="heatmap"
        periodId={periodId}
        title="Geographic Analysis Narrative"
      />
    </div>
  );
}
