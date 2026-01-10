import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import {
  Layers, TrendingUp, TrendingDown,
  BarChart3, PieChart
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line
} from 'recharts';

type CohortDimension = 'setting' | 'state' | 'size' | 'performance' | 'region' | 'custom';

interface CohortGroup {
  id: string;
  name: string;
  facilityCount: number;
  facilityIds: string[];
  metrics: {
    avgMargin: number | null;
    avgOccupancy: number | null;
    avgSkilledMix: number | null;
    avgRevenue: number | null;
    avgLabor: number | null;
  };
  trend: 'up' | 'down' | 'stable';
  color: string;
}

interface CohortAnalysisResponse {
  dimension: CohortDimension;
  groups: CohortGroup[];
  periodId: string;
  totalFacilities: number;
}

const COLORS = ['#667eea', '#00d9a5', '#ffa502', '#ff6b6b', '#a55eea', '#26de81', '#fd79a8', '#45aaf2'];

const DIMENSION_CONFIG: Record<CohortDimension, { label: string; description: string }> = {
  setting: { label: 'Facility Type', description: 'Group by SNF, ALF, ILF' },
  state: { label: 'State', description: 'Group by geographic state' },
  size: { label: 'Size', description: 'Group by bed count' },
  performance: { label: 'Performance', description: 'Group by score quartile' },
  region: { label: 'Region', description: 'Group by geographic region' },
  custom: { label: 'Custom', description: 'Create custom groupings' }
};

interface CohortAnalysisProps {
  onFacilityClick?: (facilityId: string) => void;
}

export function CohortAnalysis({ onFacilityClick }: CohortAnalysisProps) {
  const [dimension, setDimension] = useState<CohortDimension>('setting');
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'bar' | 'pie' | 'line'>('bar');
  const [selectedMetric, setSelectedMetric] = useState<'avgMargin' | 'avgOccupancy' | 'avgSkilledMix' | 'avgRevenue'>('avgMargin');

  const { data, isLoading, error } = useQuery<CohortAnalysisResponse>({
    queryKey: ['cohort-analysis', dimension],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl-production.up.railway.app/api/cohort-analysis?dimension=${dimension}`);
      if (!response.ok) throw new Error('Failed to fetch cohort analysis');
      return response.json();
    },
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.groups.map(group => ({
      name: group.name,
      count: group.facilityCount,
      margin: group.metrics.avgMargin,
      occupancy: group.metrics.avgOccupancy,
      skilledMix: group.metrics.avgSkilledMix,
      revenue: group.metrics.avgRevenue,
      color: group.color
    }));
  }, [data]);

  const pieData = useMemo(() => {
    if (!data) return [];
    return data.groups.map((group, idx) => ({
      name: group.name,
      value: group.facilityCount,
      color: COLORS[idx % COLORS.length]
    }));
  }, [data]);

  const formatMetricValue = (value: number | null, metric: string) => {
    if (value === null) return 'N/A';
    if (metric.includes('revenue') || metric.includes('Revenue')) return `$${value.toFixed(0)}`;
    return `${value.toFixed(1)}%`;
  };


  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Analyzing cohorts...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <Layers size={48} className="text-muted" style={{ margin: '0 auto 16px' }} />
        <p className="text-danger">Failed to load cohort analysis</p>
      </div>
    );
  }

  return (
    <div className="cohort-analysis">
      {/* Header */}
      <div className="card mb-4" style={{ padding: '20px' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Layers size={24} className="text-primary" />
            <div>
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Cohort Analysis</h3>
              <p className="text-sm text-muted">Compare performance across facility groups</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Dimension selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Group by:</span>
              <select
                value={dimension}
                onChange={(e) => setDimension(e.target.value as CohortDimension)}
                style={{
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '14px'
                }}
              >
                {Object.entries(DIMENSION_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* View mode */}
            <div className="flex gap-1">
              <button
                className={`btn ${viewMode === 'bar' ? 'btn-primary' : 'btn-secondary'} btn-icon`}
                onClick={() => setViewMode('bar')}
                style={{ width: '36px', height: '36px' }}
              >
                <BarChart3 size={16} />
              </button>
              <button
                className={`btn ${viewMode === 'pie' ? 'btn-primary' : 'btn-secondary'} btn-icon`}
                onClick={() => setViewMode('pie')}
                style={{ width: '36px', height: '36px' }}
              >
                <PieChart size={16} />
              </button>
              <button
                className={`btn ${viewMode === 'line' ? 'btn-primary' : 'btn-secondary'} btn-icon`}
                onClick={() => setViewMode('line')}
                style={{ width: '36px', height: '36px' }}
              >
                <TrendingUp size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 mb-4">
        {data.groups.slice(0, 4).map((group, idx) => (
          <div
            key={group.id}
            className="card"
            style={{
              padding: '16px',
              cursor: 'pointer',
              border: selectedCohort === group.id ? `2px solid ${COLORS[idx]}` : undefined,
              background: selectedCohort === group.id ? `${COLORS[idx]}11` : undefined
            }}
            onClick={() => setSelectedCohort(selectedCohort === group.id ? null : group.id)}
          >
            <div className="flex items-center gap-3">
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: COLORS[idx]
              }} />
              <div className="flex-1">
                <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{group.name}</div>
                <div className="text-xs text-muted">{group.facilityCount} facilities</div>
              </div>
              <div className="text-right">
                <div className="font-bold" style={{
                  color: (group.metrics.avgMargin ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)'
                }}>
                  {formatMetricValue(group.metrics.avgMargin, 'margin')}
                </div>
                <div className="text-xs text-muted">avg margin</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Main chart */}
        <div className="card" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {viewMode === 'pie' ? 'Distribution' : 'Comparison'}
            </h4>
            {viewMode !== 'pie' && (
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as any)}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              >
                <option value="avgMargin">Operating Margin</option>
                <option value="avgOccupancy">Occupancy</option>
                <option value="avgSkilledMix">Skilled Mix</option>
                <option value="avgRevenue">Revenue/Day</option>
              </select>
            )}
          </div>

          <div style={{ height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              {viewMode === 'bar' ? (
                <BarChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15,15,26,0.95)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => typeof value === 'number' ? formatMetricValue(value, selectedMetric) : ''}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Bar
                    dataKey={selectedMetric.replace('avg', '').toLowerCase()}
                    fill="#667eea"
                    radius={[4, 4, 0, 0]}
                  >
                    {chartData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : viewMode === 'pie' ? (
                <RechartsPie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: 'rgba(255,255,255,0.3)' }}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15,15,26,0.95)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [typeof value === 'number' ? `${value} facilities` : '', 'Count']}
                  />
                </RechartsPie>
              ) : (
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15,15,26,0.95)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => typeof value === 'number' ? formatMetricValue(value, selectedMetric) : ''}
                  />
                  <Line
                    type="monotone"
                    dataKey={selectedMetric.replace('avg', '').toLowerCase()}
                    stroke="#667eea"
                    strokeWidth={3}
                    dot={{ fill: '#667eea', strokeWidth: 0, r: 6 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cohort details */}
        <div className="card" style={{ padding: '24px' }}>
          <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Cohort Details</h4>

          <div className="space-y-3" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {data.groups.map((group, idx) => {
              const isSelected = selectedCohort === group.id;

              return (
                <div
                  key={group.id}
                  onClick={() => setSelectedCohort(isSelected ? null : group.id)}
                  style={{
                    padding: '12px',
                    background: isSelected ? `${COLORS[idx]}22` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSelected ? COLORS[idx] : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: COLORS[idx]
                    }} />
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {group.name}
                    </span>
                    <span className="text-xs text-muted ml-auto">
                      {group.facilityCount} facilities
                    </span>
                    {group.trend === 'up' && <TrendingUp size={14} className="text-success" />}
                    {group.trend === 'down' && <TrendingDown size={14} className="text-danger" />}
                  </div>

                  {isSelected && (
                    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                      <div>
                        <div className="text-xs text-muted">Margin</div>
                        <div className="font-bold" style={{ fontSize: '14px' }}>
                          {formatMetricValue(group.metrics.avgMargin, 'margin')}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">Occupancy</div>
                        <div className="font-bold" style={{ fontSize: '14px' }}>
                          {formatMetricValue(group.metrics.avgOccupancy, 'pct')}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">Skilled Mix</div>
                        <div className="font-bold" style={{ fontSize: '14px' }}>
                          {formatMetricValue(group.metrics.avgSkilledMix, 'pct')}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">Revenue/Day</div>
                        <div className="font-bold" style={{ fontSize: '14px' }}>
                          {formatMetricValue(group.metrics.avgRevenue, 'revenue')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Facilities in selected cohort */}
      {selectedCohort && (
        <div className="card mt-4" style={{ padding: '20px' }}>
          <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Facilities in {data.groups.find(g => g.id === selectedCohort)?.name}
          </h4>
          <div className="flex flex-wrap gap-2">
            {data.groups
              .find(g => g.id === selectedCohort)
              ?.facilityIds.slice(0, 20)
              .map(facilityId => (
                <button
                  key={facilityId}
                  onClick={() => onFacilityClick?.(facilityId)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  {facilityId}
                </button>
              ))}
            {(data.groups.find(g => g.id === selectedCohort)?.facilityIds.length ?? 0) > 20 && (
              <span className="text-sm text-muted" style={{ padding: '6px 12px' }}>
                +{(data.groups.find(g => g.id === selectedCohort)?.facilityIds.length ?? 0) - 20} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
