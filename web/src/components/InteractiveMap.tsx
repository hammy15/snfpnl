import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Building2, Filter, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './InteractiveMap.css';

type SettingFilter = 'all' | 'SNF' | 'ALF' | 'ILF';

interface InteractiveMapProps {
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

// Approximate coordinates for facilities in Western US states
// In production, these would come from a database
const STATE_CENTERS: Record<string, { lat: number; lng: number }> = {
  WA: { lat: 47.4, lng: -120.5 },
  OR: { lat: 43.8, lng: -120.5 },
  CA: { lat: 36.7, lng: -119.4 },
  NV: { lat: 38.8, lng: -116.4 },
  ID: { lat: 44.0, lng: -114.7 },
  MT: { lat: 46.8, lng: -110.3 },
  WY: { lat: 43.0, lng: -107.5 },
  UT: { lat: 39.3, lng: -111.6 },
  CO: { lat: 39.0, lng: -105.5 },
  AZ: { lat: 34.0, lng: -111.0 },
  NM: { lat: 34.5, lng: -106.0 },
};

// Generate pseudo-random but consistent positions for facilities within their state
function getFacilityCoords(facility: FacilityWithKPI): [number, number] {
  const center = STATE_CENTERS[facility.state] || { lat: 40, lng: -115 };

  // Use facility_id to generate consistent offsets
  const hash = facility.facility_id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = 0.5 + (hash % 100) / 100;

  return [
    center.lat + Math.sin(angle) * radius,
    center.lng + Math.cos(angle) * radius * 1.5
  ];
}

const KPI_OPTIONS = [
  { id: 'snf_operating_margin_pct', label: 'Operating Margin %', format: 'percentage', higherIsBetter: true },
  { id: 'snf_skilled_mix_pct', label: 'Skilled Mix %', format: 'percentage', higherIsBetter: true },
  { id: 'snf_total_revenue_ppd', label: 'Revenue PPD', format: 'currency', higherIsBetter: true },
  { id: 'snf_total_cost_ppd', label: 'Cost PPD', format: 'currency', higherIsBetter: false },
  { id: 'snf_nursing_cost_ppd', label: 'Nursing Cost PPD', format: 'currency', higherIsBetter: false },
  { id: 'snf_contract_labor_pct_nursing', label: 'Contract Labor %', format: 'percentage', higherIsBetter: false },
];

async function fetchAllKPIs(periodId: string): Promise<FacilityWithKPI[]> {
  const res = await fetch(`https://snfpnl-production.up.railway.app/api/kpis/all/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch KPIs');
  return res.json();
}

// Create custom marker icons
function createMarkerIcon(color: string, isSelected: boolean = false): L.DivIcon {
  const size = isSelected ? 32 : 24;
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      transform: translate(-50%, -50%);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
}

function getPerformanceColor(value: number | null, kpiId: string, higherIsBetter: boolean): string {
  if (value === null) return '#6b7280';

  let normalizedValue: number;
  if (kpiId.includes('margin') || kpiId.includes('mix') || kpiId.includes('pct')) {
    normalizedValue = Math.min(Math.max(value / 25, 0), 1);
  } else {
    normalizedValue = Math.min(Math.max((value - 200) / 300, 0), 1);
  }

  if (!higherIsBetter) normalizedValue = 1 - normalizedValue;

  // Color gradient: red -> yellow -> green
  if (normalizedValue < 0.4) return '#ef4444';
  if (normalizedValue < 0.6) return '#f59e0b';
  return '#10b981';
}

function formatValue(value: number | null, format: string): string {
  if (value === null) return '--';
  if (format === 'currency') return `$${value.toFixed(2)}`;
  if (format === 'percentage') return `${value.toFixed(1)}%`;
  return value.toFixed(2);
}

// Component to handle map view updates
function MapController({ selectedFacility }: { selectedFacility: string | null }) {
  const map = useMap();

  // Center on Western US
  useMemo(() => {
    if (!selectedFacility) {
      map.setView([42, -115], 5);
    }
  }, [map, selectedFacility]);

  return null;
}

export function InteractiveMap({ periodId, settingFilter, onFacilitySelect }: InteractiveMapProps) {
  const [selectedKPI, setSelectedKPI] = useState('snf_operating_margin_pct');
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [listView, setListView] = useState<'map' | 'list'>('map');

  const { data: allKPIs = [], isLoading } = useQuery({
    queryKey: ['allKPIs', periodId],
    queryFn: () => fetchAllKPIs(periodId),
  });

  const selectedKPIOption = KPI_OPTIONS.find(k => k.id === selectedKPI)!;

  // Filter and process facilities
  const facilities = useMemo(() => {
    return allKPIs
      .filter((f) => f.kpi_id === selectedKPI)
      .filter((f) => settingFilter === 'all' || f.setting === settingFilter);
  }, [allKPIs, selectedKPI, settingFilter]);

  // Group by state for summary
  const stateStats = useMemo(() => {
    const stats: Record<string, { count: number; avg: number | null; facilities: FacilityWithKPI[] }> = {};

    facilities.forEach(f => {
      if (!stats[f.state]) {
        stats[f.state] = { count: 0, avg: null, facilities: [] };
      }
      stats[f.state].count++;
      stats[f.state].facilities.push(f);
    });

    Object.values(stats).forEach(s => {
      const validValues = s.facilities.filter(f => f.value !== null).map(f => f.value as number);
      s.avg = validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : null;
    });

    return stats;
  }, [facilities]);

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="interactive-map animate-fade-in">
      {/* Header */}
      <div className="map-header">
        <div className="map-title-section">
          <h2>Facility Performance Map</h2>
          <p className="text-muted">{facilities.length} facilities across {Object.keys(stateStats).length} states</p>
        </div>

        <div className="map-controls">
          <div className="view-toggle">
            <button
              className={listView === 'map' ? 'active' : ''}
              onClick={() => setListView('map')}
            >
              Map
            </button>
            <button
              className={listView === 'list' ? 'active' : ''}
              onClick={() => setListView('list')}
            >
              List
            </button>
          </div>

          <select
            value={selectedKPI}
            onChange={(e) => setSelectedKPI(e.target.value)}
            className="kpi-select"
          >
            {KPI_OPTIONS.map((kpi) => (
              <option key={kpi.id} value={kpi.id}>{kpi.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="map-content">
        {listView === 'map' ? (
          <div className="map-wrapper">
            <MapContainer
              center={[42, -115]}
              zoom={5}
              className="leaflet-map"
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <MapController selectedFacility={selectedFacility} />

              {facilities.map((facility) => {
                const coords = getFacilityCoords(facility);
                const color = getPerformanceColor(facility.value, selectedKPI, selectedKPIOption.higherIsBetter);
                const isSelected = selectedFacility === facility.facility_id;

                return (
                  <Marker
                    key={facility.facility_id}
                    position={coords}
                    icon={createMarkerIcon(color, isSelected)}
                    eventHandlers={{
                      click: () => setSelectedFacility(facility.facility_id),
                    }}
                  >
                    <Popup>
                      <div className="marker-popup">
                        <div className="popup-header">
                          <strong>{facility.name}</strong>
                          <span className={`popup-badge ${facility.setting.toLowerCase()}`}>
                            {facility.setting}
                          </span>
                        </div>
                        <div className="popup-location">{facility.state}</div>
                        <div className="popup-kpi">
                          <span>{selectedKPIOption.label}:</span>
                          <strong style={{ color }}>
                            {formatValue(facility.value, selectedKPIOption.format)}
                          </strong>
                        </div>
                        <button
                          className="popup-btn"
                          onClick={() => onFacilitySelect(facility.facility_id)}
                        >
                          View Details
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* Legend */}
            <div className="map-legend">
              <div className="legend-title">{selectedKPIOption.label}</div>
              <div className="legend-items">
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#ef4444' }} />
                  <span>Poor</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#f59e0b' }} />
                  <span>Average</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#10b981' }} />
                  <span>Good</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="facility-list-view">
            {Object.entries(stateStats)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([state, stats]) => (
                <div key={state} className="state-section">
                  <div className="state-header">
                    <div className="state-info">
                      <h3>{state}</h3>
                      <span className="state-count">{stats.count} facilities</span>
                    </div>
                    <div className="state-avg">
                      <span className="avg-label">Avg:</span>
                      <span
                        className="avg-value"
                        style={{ color: getPerformanceColor(stats.avg, selectedKPI, selectedKPIOption.higherIsBetter) }}
                      >
                        {formatValue(stats.avg, selectedKPIOption.format)}
                      </span>
                    </div>
                  </div>
                  <div className="state-facilities">
                    {stats.facilities
                      .sort((a, b) => (b.value || 0) - (a.value || 0))
                      .map(facility => {
                        const color = getPerformanceColor(facility.value, selectedKPI, selectedKPIOption.higherIsBetter);
                        return (
                          <div
                            key={facility.facility_id}
                            className="facility-card"
                            onClick={() => onFacilitySelect(facility.facility_id)}
                          >
                            <div className="facility-main">
                              <Building2 size={16} />
                              <span className="facility-name">{facility.name}</span>
                              <span className={`facility-badge ${facility.setting.toLowerCase()}`}>
                                {facility.setting}
                              </span>
                            </div>
                            <div className="facility-metric" style={{ color }}>
                              {color === '#10b981' && <TrendingUp size={14} />}
                              {color === '#ef4444' && <TrendingDown size={14} />}
                              {color === '#f59e0b' && <Minus size={14} />}
                              {formatValue(facility.value, selectedKPIOption.format)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* State Summary Sidebar */}
        <div className="state-sidebar">
          <h3>
            <Filter size={16} />
            States Overview
          </h3>
          <div className="state-cards">
            {Object.entries(stateStats)
              .sort((a, b) => (b[1].avg || 0) - (a[1].avg || 0))
              .map(([state, stats]) => {
                const color = getPerformanceColor(stats.avg, selectedKPI, selectedKPIOption.higherIsBetter);
                return (
                  <div key={state} className="state-card">
                    <div className="card-header">
                      <span className="card-state">{state}</span>
                      <span className="card-count">{stats.count}</span>
                    </div>
                    <div className="card-value" style={{ color }}>
                      {formatValue(stats.avg, selectedKPIOption.format)}
                    </div>
                    <div className="card-bar">
                      <div
                        className="card-bar-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, ((stats.avg || 0) / 20) * 100))}%`,
                          background: color
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
