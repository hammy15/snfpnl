import { useQuery } from '@tanstack/react-query';
import { MapPin, ZoomIn, ZoomOut, Maximize2, Filter, TrendingUp, TrendingDown, Building2 } from 'lucide-react';
import { useState, useMemo } from 'react';

interface FacilityLocation {
  facilityId: string;
  name: string;
  state: string;
  setting: string;
  lat: number;
  lng: number;
  metrics: {
    operatingMargin: number | null;
    occupancy: number | null;
    score: number;
  };
  trend: 'up' | 'down' | 'stable';
}

interface MapDataResponse {
  facilities: FacilityLocation[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

interface GeographicMapProps {
  periodId: string;
  onFacilityClick?: (facilityId: string) => void;
}

// US State coordinates for plotting facilities
const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  'AZ': { lat: 34.0489, lng: -111.0937 },
  'CA': { lat: 36.7783, lng: -119.4179 },
  'CO': { lat: 39.5501, lng: -105.7821 },
  'FL': { lat: 27.6648, lng: -81.5158 },
  'GA': { lat: 32.1656, lng: -83.7433 },
  'ID': { lat: 44.0682, lng: -114.7420 },
  'IL': { lat: 40.6331, lng: -89.3985 },
  'IN': { lat: 40.2672, lng: -86.1349 },
  'KS': { lat: 39.0119, lng: -98.4842 },
  'KY': { lat: 37.8393, lng: -84.2700 },
  'MD': { lat: 39.0458, lng: -76.6413 },
  'MI': { lat: 44.3148, lng: -85.6024 },
  'MN': { lat: 46.7296, lng: -94.6859 },
  'MO': { lat: 37.9643, lng: -91.8318 },
  'MT': { lat: 46.8797, lng: -110.3626 },
  'NC': { lat: 35.7596, lng: -79.0193 },
  'ND': { lat: 47.5515, lng: -101.0020 },
  'NE': { lat: 41.4925, lng: -99.9018 },
  'NV': { lat: 38.8026, lng: -116.4194 },
  'NY': { lat: 43.2994, lng: -74.2179 },
  'OH': { lat: 40.4173, lng: -82.9071 },
  'OK': { lat: 35.4676, lng: -97.5164 },
  'OR': { lat: 43.8041, lng: -120.5542 },
  'PA': { lat: 41.2033, lng: -77.1945 },
  'SC': { lat: 33.8361, lng: -81.1637 },
  'SD': { lat: 43.9695, lng: -99.9018 },
  'TN': { lat: 35.5175, lng: -86.5804 },
  'TX': { lat: 31.9686, lng: -99.9018 },
  'UT': { lat: 39.3200, lng: -111.0937 },
  'VA': { lat: 37.4316, lng: -78.6569 },
  'WA': { lat: 47.7511, lng: -120.7401 },
  'WI': { lat: 43.7844, lng: -88.7879 },
  'WV': { lat: 38.5976, lng: -80.4549 },
  'WY': { lat: 43.0759, lng: -107.2903 },
};

export function GeographicMap({ periodId, onFacilityClick }: GeographicMapProps) {
  const [zoom, setZoom] = useState(1);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [filterSetting, setFilterSetting] = useState<string>('all');
  const [filterPerformance, setFilterPerformance] = useState<string>('all');
  const [hoveredFacility, setHoveredFacility] = useState<FacilityLocation | null>(null);

  const { data, isLoading, error } = useQuery<MapDataResponse>({
    queryKey: ['map-data', periodId],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl.onrender.com/api/map-data/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch map data');
      return response.json();
    },
  });

  const filteredFacilities = useMemo(() => {
    if (!data) return [];
    return data.facilities.filter(f => {
      if (filterSetting !== 'all' && f.setting !== filterSetting) return false;
      if (selectedState && f.state !== selectedState) return false;
      if (filterPerformance === 'high' && f.metrics.score < 70) return false;
      if (filterPerformance === 'medium' && (f.metrics.score < 40 || f.metrics.score >= 70)) return false;
      if (filterPerformance === 'low' && f.metrics.score >= 40) return false;
      return true;
    });
  }, [data, filterSetting, selectedState, filterPerformance]);

  const stateStats = useMemo(() => {
    if (!data) return {};
    const stats: Record<string, { count: number; avgScore: number; avgMargin: number }> = {};
    data.facilities.forEach(f => {
      if (!stats[f.state]) {
        stats[f.state] = { count: 0, avgScore: 0, avgMargin: 0 };
      }
      stats[f.state].count++;
      stats[f.state].avgScore += f.metrics.score;
      if (f.metrics.operatingMargin !== null) {
        stats[f.state].avgMargin += f.metrics.operatingMargin;
      }
    });
    Object.keys(stats).forEach(state => {
      stats[state].avgScore /= stats[state].count;
      stats[state].avgMargin /= stats[state].count;
    });
    return stats;
  }, [data]);

  const getMarkerColor = (score: number) => {
    if (score >= 70) return '#00d9a5';
    if (score >= 50) return '#667eea';
    if (score >= 30) return '#ffa502';
    return '#ff4757';
  };

  const getMarkerSize = (score: number) => {
    const base = 12 * zoom;
    if (score >= 70) return base * 1.3;
    if (score >= 50) return base * 1.1;
    return base;
  };

  // Convert lat/lng to SVG coordinates
  const toSVG = (lat: number, lng: number) => {
    const minLat = 24;
    const maxLat = 50;
    const minLng = -125;
    const maxLng = -66;

    const x = ((lng - minLng) / (maxLng - minLng)) * 800;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 500;

    return { x, y };
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Loading geographic data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <MapPin size={48} className="text-muted" style={{ margin: '0 auto 16px' }} />
        <p className="text-danger">Failed to load map data</p>
      </div>
    );
  }

  return (
    <div className="geographic-map">
      {/* Controls */}
      <div className="card mb-4" style={{ padding: '16px' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-muted" />
              <select
                value={filterSetting}
                onChange={(e) => setFilterSetting(e.target.value)}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              >
                <option value="all">All Settings</option>
                <option value="SNF">SNF Only</option>
                <option value="ALF">ALF Only</option>
                <option value="ILF">ILF Only</option>
              </select>
            </div>

            <select
              value={filterPerformance}
              onChange={(e) => setFilterPerformance(e.target.value)}
              style={{
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '13px'
              }}
            >
              <option value="all">All Performance</option>
              <option value="high">High Performers (70+)</option>
              <option value="medium">Medium (40-70)</option>
              <option value="low">Low Performers (&lt;40)</option>
            </select>

            {selectedState && (
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedState(null)}
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                Clear State Filter: {selectedState}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              disabled={zoom <= 0.5}
              style={{ width: '32px', height: '32px' }}
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-sm text-muted" style={{ minWidth: '50px', textAlign: 'center' }}>
              {(zoom * 100).toFixed(0)}%
            </span>
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              disabled={zoom >= 2}
              style={{ width: '32px', height: '32px' }}
            >
              <ZoomIn size={16} />
            </button>
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => setZoom(1)}
              style={{ width: '32px', height: '32px' }}
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="card" style={{ padding: '24px', position: 'relative' }}>
        <div style={{
          position: 'relative',
          width: '100%',
          height: '500px',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(15,15,26,0.8), rgba(30,30,50,0.6))',
          borderRadius: '12px'
        }}>
          <svg
            viewBox="0 0 800 500"
            style={{
              width: '100%',
              height: '100%',
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              transition: 'transform 0.3s ease'
            }}
          >
            {/* US Outline (simplified) */}
            <path
              d="M50,150 L150,100 L300,80 L450,90 L600,100 L700,120 L750,180 L720,280 L680,350 L600,400 L500,420 L350,410 L200,380 L100,320 L60,250 Z"
              fill="rgba(255,255,255,0.03)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />

            {/* State markers */}
            {Object.entries(stateStats).map(([state, stats]) => {
              const coords = STATE_COORDS[state];
              if (!coords) return null;
              const { x, y } = toSVG(coords.lat, coords.lng);
              const isSelected = selectedState === state;

              return (
                <g key={state} onClick={() => setSelectedState(isSelected ? null : state)} style={{ cursor: 'pointer' }}>
                  {/* State background circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 35 : 25}
                    fill={isSelected ? 'rgba(102, 126, 234, 0.3)' : 'rgba(255,255,255,0.05)'}
                    stroke={isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  {/* State label */}
                  <text
                    x={x}
                    y={y - 5}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {state}
                  </text>
                  <text
                    x={x}
                    y={y + 8}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize="8"
                  >
                    {stats.count} facilities
                  </text>
                </g>
              );
            })}

            {/* Facility markers */}
            {filteredFacilities.map((facility) => {
              const coords = STATE_COORDS[facility.state];
              if (!coords) return null;

              // Offset facilities within same state
              const stateCount = filteredFacilities.filter(f => f.state === facility.state).length;
              const stateIdx = filteredFacilities.filter(f => f.state === facility.state).indexOf(facility);
              const angle = (stateIdx / stateCount) * Math.PI * 2;
              const offsetRadius = stateCount > 1 ? 20 + (stateIdx % 3) * 8 : 0;

              const { x: baseX, y: baseY } = toSVG(coords.lat, coords.lng);
              const x = baseX + Math.cos(angle) * offsetRadius;
              const y = baseY + Math.sin(angle) * offsetRadius;
              const size = getMarkerSize(facility.metrics.score);
              const color = getMarkerColor(facility.metrics.score);

              return (
                <g
                  key={facility.facilityId}
                  onClick={() => onFacilityClick?.(facility.facilityId)}
                  onMouseEnter={() => setHoveredFacility(facility)}
                  onMouseLeave={() => setHoveredFacility(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Glow effect */}
                  <circle
                    cx={x}
                    cy={y}
                    r={size + 4}
                    fill={color}
                    opacity={0.3}
                  />
                  {/* Main marker */}
                  <circle
                    cx={x}
                    cy={y}
                    r={size}
                    fill={color}
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth={1}
                  />
                  {/* Inner dot */}
                  <circle
                    cx={x}
                    cy={y}
                    r={size * 0.4}
                    fill="rgba(255,255,255,0.8)"
                  />
                </g>
              );
            })}
          </svg>

          {/* Hover tooltip */}
          {hoveredFacility && (
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(15,15,26,0.95)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px',
              padding: '16px',
              minWidth: '220px',
              backdropFilter: 'blur(10px)',
              zIndex: 10
            }}>
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={16} className="text-primary" />
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  {hoveredFacility.name}
                </span>
              </div>
              <div className="text-sm text-muted mb-3">
                {hoveredFacility.state} • {hoveredFacility.setting}
              </div>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div className="text-xs text-muted">Score</div>
                  <div className="font-bold" style={{ color: getMarkerColor(hoveredFacility.metrics.score) }}>
                    {hoveredFacility.metrics.score.toFixed(0)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Margin</div>
                  <div className="font-bold" style={{
                    color: (hoveredFacility.metrics.operatingMargin || 0) >= 0 ? 'var(--success)' : 'var(--danger)'
                  }}>
                    {hoveredFacility.metrics.operatingMargin?.toFixed(1) || 'N/A'}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Occupancy</div>
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    {hoveredFacility.metrics.occupancy?.toFixed(1) || 'N/A'}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Trend</div>
                  <div className="flex items-center gap-1">
                    {hoveredFacility.trend === 'up' && <TrendingUp size={14} className="text-success" />}
                    {hoveredFacility.trend === 'down' && <TrendingDown size={14} className="text-danger" />}
                    <span className={hoveredFacility.trend === 'up' ? 'text-success' : hoveredFacility.trend === 'down' ? 'text-danger' : 'text-muted'}>
                      {hoveredFacility.trend === 'up' ? 'Improving' : hoveredFacility.trend === 'down' ? 'Declining' : 'Stable'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            background: 'rgba(15,15,26,0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '12px 16px'
          }}>
            <div className="text-xs text-muted mb-2">Performance Score</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#00d9a5' }} />
                <span className="text-xs">70+</span>
              </div>
              <div className="flex items-center gap-2">
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#667eea' }} />
                <span className="text-xs">50-70</span>
              </div>
              <div className="flex items-center gap-2">
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffa502' }} />
                <span className="text-xs">30-50</span>
              </div>
              <div className="flex items-center gap-2">
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff4757' }} />
                <span className="text-xs">&lt;30</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            background: 'rgba(15,15,26,0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '12px 16px'
          }}>
            <div className="text-xs text-muted mb-1">Showing</div>
            <div className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
              {filteredFacilities.length}
            </div>
            <div className="text-xs text-muted">of {data.facilities.length} facilities</div>
          </div>
        </div>
      </div>

      {/* State breakdown table */}
      {selectedState && stateStats[selectedState] && (
        <div className="card mt-4" style={{ padding: '20px' }}>
          <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {selectedState} Facilities ({stateStats[selectedState].count})
          </h4>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Setting</th>
                  <th style={{ textAlign: 'right' }}>Score</th>
                  <th style={{ textAlign: 'right' }}>Margin</th>
                  <th style={{ textAlign: 'right' }}>Occupancy</th>
                  <th style={{ textAlign: 'center' }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {filteredFacilities
                  .filter(f => f.state === selectedState)
                  .sort((a, b) => b.metrics.score - a.metrics.score)
                  .map(facility => (
                    <tr
                      key={facility.facilityId}
                      onClick={() => onFacilityClick?.(facility.facilityId)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {facility.name}
                      </td>
                      <td><span className="badge badge-info">{facility.setting}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ color: getMarkerColor(facility.metrics.score), fontWeight: 600 }}>
                          {facility.metrics.score.toFixed(0)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {facility.metrics.operatingMargin?.toFixed(1) || 'N/A'}%
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {facility.metrics.occupancy?.toFixed(1) || 'N/A'}%
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {facility.trend === 'up' && <TrendingUp size={16} className="text-success" />}
                        {facility.trend === 'down' && <TrendingDown size={16} className="text-danger" />}
                        {facility.trend === 'stable' && <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
