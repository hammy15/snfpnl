import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Calendar, Snowflake, Sun, Leaf, Flower2, Info
} from 'lucide-react';
import {
  Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, ReferenceArea
} from 'recharts';

type Season = 'winter' | 'spring' | 'summer' | 'fall';

interface SeasonalPattern {
  kpiId: string;
  kpiName: string;
  hasSeasonality: boolean;
  confidence: number;
  peakSeason: Season;
  troughSeason: Season;
  amplitude: number; // % variation from mean
  monthlyData: Array<{
    month: string;
    monthNum: number;
    average: number;
    min: number;
    max: number;
    stdDev: number;
  }>;
  seasonalIndices: Array<{
    season: Season;
    index: number; // 1.0 = average, >1 = above average, <1 = below average
    avgValue: number;
  }>;
  insights: string[];
}

interface SeasonalityResponse {
  facilityId?: string;
  facilityName?: string;
  patterns: SeasonalPattern[];
  summary: {
    strongPatterns: number;
    moderatePatterns: number;
    weakPatterns: number;
  };
  periodRange: { start: string; end: string };
}

interface SeasonalityDetectionProps {
  facilityId?: number;
}

const SEASON_CONFIG: Record<Season, { icon: typeof Sun; color: string; label: string; months: number[] }> = {
  winter: { icon: Snowflake, color: '#45aaf2', label: 'Winter', months: [12, 1, 2] },
  spring: { icon: Flower2, color: '#26de81', label: 'Spring', months: [3, 4, 5] },
  summer: { icon: Sun, color: '#ffa502', label: 'Summer', months: [6, 7, 8] },
  fall: { icon: Leaf, color: '#ff6b6b', label: 'Fall', months: [9, 10, 11] }
};


export function SeasonalityDetection({ facilityId }: SeasonalityDetectionProps) {
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_expandedPattern, _setExpandedPattern] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<SeasonalityResponse>({
    queryKey: ['seasonality', facilityId],
    queryFn: async () => {
      const url = facilityId
        ? `https://snfpnl.onrender.com/api/seasonality/${facilityId}`
        : 'https://snfpnl.onrender.com/api/seasonality';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch seasonality data');
      return response.json();
    },
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'var(--success)';
    if (confidence >= 0.6) return 'var(--primary)';
    if (confidence >= 0.4) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'Strong';
    if (confidence >= 0.6) return 'Moderate';
    if (confidence >= 0.4) return 'Weak';
    return 'None';
  };

  const formatValue = (value: number, kpiId: string) => {
    if (kpiId.includes('pct') || kpiId.includes('margin') || kpiId.includes('mix') || kpiId.includes('occupancy')) {
      return `${value.toFixed(1)}%`;
    }
    if (kpiId.includes('revenue') || kpiId.includes('cost') || kpiId.includes('ppd')) {
      return `$${value.toFixed(0)}`;
    }
    return value.toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Analyzing seasonal patterns...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <Calendar size={48} className="text-muted" style={{ margin: '0 auto 16px' }} />
        <p className="text-danger">Failed to load seasonality data</p>
      </div>
    );
  }

  const selectedPattern = selectedKpi
    ? data.patterns.find(p => p.kpiId === selectedKpi)
    : data.patterns[0];

  return (
    <div className="seasonality-detection">
      {/* Header */}
      <div className="card mb-4" style={{ padding: '20px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar size={24} className="text-primary" />
            <div>
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                Seasonality Detection
              </h3>
              <p className="text-sm text-muted">
                Analyzing {data.patterns.length} metrics for seasonal patterns
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-success">{data.summary.strongPatterns}</div>
              <div className="text-xs text-muted">Strong</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-primary">{data.summary.moderatePatterns}</div>
              <div className="text-xs text-muted">Moderate</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-warning">{data.summary.weakPatterns}</div>
              <div className="text-xs text-muted">Weak</div>
            </div>
          </div>
        </div>
      </div>

      {/* Season overview */}
      <div className="grid grid-cols-4 mb-4">
        {(Object.entries(SEASON_CONFIG) as [Season, typeof SEASON_CONFIG[Season]][]).map(([season, config]) => {
          const Icon = config.icon;
          const avgIndex = selectedPattern?.seasonalIndices.find(s => s.season === season)?.index ?? 1;

          return (
            <div key={season} className="card" style={{ padding: '16px' }}>
              <div className="flex items-center gap-3">
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: `${config.color}22`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon size={20} style={{ color: config.color }} />
                </div>
                <div>
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{config.label}</div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm" style={{
                      color: avgIndex >= 1 ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {avgIndex >= 1 ? '+' : ''}{((avgIndex - 1) * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted">vs avg</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <div className="grid" style={{ gridTemplateColumns: '300px 1fr', gap: '16px' }}>
        {/* KPI selector */}
        <div className="card" style={{ padding: '16px' }}>
          <h4 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Metrics</h4>
          <div className="space-y-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {data.patterns.map(pattern => (
              <button
                key={pattern.kpiId}
                onClick={() => setSelectedKpi(pattern.kpiId)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: selectedKpi === pattern.kpiId ? 'rgba(102, 126, 234, 0.2)' : 'rgba(255,255,255,0.03)',
                  border: selectedKpi === pattern.kpiId ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium" style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                    {pattern.kpiName}
                  </span>
                  {pattern.hasSeasonality && (
                    <span className="badge" style={{
                      background: `${getConfidenceColor(pattern.confidence)}22`,
                      color: getConfidenceColor(pattern.confidence),
                      fontSize: '9px'
                    }}>
                      {getConfidenceLabel(pattern.confidence)}
                    </span>
                  )}
                </div>
                {pattern.hasSeasonality && (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>Peak: {SEASON_CONFIG[pattern.peakSeason].label}</span>
                    <span>•</span>
                    <span>±{pattern.amplitude.toFixed(1)}% swing</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chart area */}
        <div className="card" style={{ padding: '24px' }}>
          {selectedPattern ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    {selectedPattern.kpiName}
                  </h4>
                  <p className="text-sm text-muted">
                    {selectedPattern.hasSeasonality
                      ? `${getConfidenceLabel(selectedPattern.confidence)} seasonality detected`
                      : 'No significant seasonality detected'}
                  </p>
                </div>
                {selectedPattern.hasSeasonality && (
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-xs text-muted">Peak</div>
                      <div className="flex items-center gap-1">
                        {(() => {
                          const SeasonIcon = SEASON_CONFIG[selectedPattern.peakSeason].icon;
                          return <SeasonIcon size={14} style={{ color: SEASON_CONFIG[selectedPattern.peakSeason].color }} />;
                        })()}
                        <span className="font-bold" style={{ color: 'var(--success)' }}>
                          {SEASON_CONFIG[selectedPattern.peakSeason].label}
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted">Trough</div>
                      <div className="flex items-center gap-1">
                        {(() => {
                          const SeasonIcon = SEASON_CONFIG[selectedPattern.troughSeason].icon;
                          return <SeasonIcon size={14} style={{ color: SEASON_CONFIG[selectedPattern.troughSeason].color }} />;
                        })()}
                        <span className="font-bold" style={{ color: 'var(--danger)' }}>
                          {SEASON_CONFIG[selectedPattern.troughSeason].label}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Monthly chart */}
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedPattern.monthlyData}>
                    <defs>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#667eea" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    {/* Season reference areas */}
                    <ReferenceArea x1="Dec" x2="Feb" fill="#45aaf2" fillOpacity={0.1} />
                    <ReferenceArea x1="Mar" x2="May" fill="#26de81" fillOpacity={0.1} />
                    <ReferenceArea x1="Jun" x2="Aug" fill="#ffa502" fillOpacity={0.1} />
                    <ReferenceArea x1="Sep" x2="Nov" fill="#ff6b6b" fillOpacity={0.1} />

                    <XAxis
                      dataKey="month"
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                      tickFormatter={(value) => formatValue(value, selectedPattern.kpiId)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(15,15,26,0.95)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px'
                      }}
                      formatter={(value, name) => [
                        typeof value === 'number' ? formatValue(value, selectedPattern.kpiId) : '',
                        name === 'average' ? 'Average' : name === 'max' ? 'Maximum' : 'Minimum'
                      ]}
                      labelStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Legend />

                    {/* Min-Max range */}
                    <Area
                      type="monotone"
                      dataKey="max"
                      stroke="transparent"
                      fill="rgba(102, 126, 234, 0.1)"
                    />
                    <Area
                      type="monotone"
                      dataKey="min"
                      stroke="transparent"
                      fill="var(--bg-secondary)"
                    />

                    {/* Average line */}
                    <Line
                      type="monotone"
                      dataKey="average"
                      stroke="#667eea"
                      strokeWidth={3}
                      dot={{ fill: '#667eea', strokeWidth: 0, r: 5 }}
                      activeDot={{ r: 7, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Insights */}
              {selectedPattern.insights.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <h5 className="font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Info size={16} className="text-primary" />
                    Key Insights
                  </h5>
                  <ul style={{ paddingLeft: '20px' }}>
                    {selectedPattern.insights.map((insight, idx) => (
                      <li key={idx} className="text-sm text-muted mb-1">{insight}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Seasonal indices table */}
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <h5 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Seasonal Indices</h5>
                <div className="grid grid-cols-4 gap-3">
                  {selectedPattern.seasonalIndices.map(({ season, index, avgValue }) => {
                    const config = SEASON_CONFIG[season];
                    const Icon = config.icon;

                    return (
                      <div
                        key={season}
                        style={{
                          padding: '12px',
                          background: `${config.color}11`,
                          border: `1px solid ${config.color}33`,
                          borderRadius: '8px'
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon size={16} style={{ color: config.color }} />
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {config.label}
                          </span>
                        </div>
                        <div className="text-lg font-bold" style={{
                          color: index >= 1 ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {index >= 1 ? '+' : ''}{((index - 1) * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted">
                          Avg: {formatValue(avgValue, selectedPattern.kpiId)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <Calendar size={48} className="text-muted" style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p className="text-muted">Select a metric to view seasonal patterns</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
