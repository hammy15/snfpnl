import { useQuery } from '@tanstack/react-query';
import { Users, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Building2, Target, BarChart3 } from 'lucide-react';
import { useState, useRef } from 'react';

interface PeerRanking {
  kpiId: string;
  kpiName: string;
  value: number;
  percentile: number;
  rank: number;
  totalPeers: number;
  min: number;
  max: number;
  median: number;
  average: number;
}

interface PeerComparisonResponse {
  facilityId: string;
  facilityName: string;
  setting: string;
  periodId: string;
  peerCount: number;
  rankings: PeerRanking[];
}

interface PeerComparisonProps {
  facilityId: number;
  periodId: string;
}

interface BarTooltipState {
  ranking: PeerRanking;
  x: number;
  y: number;
}

export function PeerComparison({ facilityId, periodId }: PeerComparisonProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredRanking, setHoveredRanking] = useState<PeerRanking | null>(null);
  const [barTooltip, setBarTooltip] = useState<BarTooltipState | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery<PeerComparisonResponse>({
    queryKey: ['peer-comparison', facilityId, periodId],
    queryFn: async () => {
      const response = await fetch(`https://snfpnl.onrender.com/api/peer-comparison/${facilityId}/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch peer comparison');
      return response.json();
    },
  });

  const formatValue = (value: number, kpiId: string) => {
    if (kpiId.includes('pct') || kpiId.includes('mix') || kpiId.includes('margin') || kpiId.includes('occupancy')) {
      return `${value.toFixed(1)}%`;
    }
    if (kpiId.includes('revenue') || kpiId.includes('cost') || kpiId.includes('ppd') || kpiId.includes('psd') || kpiId.includes('revpor')) {
      return `$${value.toFixed(0)}`;
    }
    if (kpiId.includes('hprd') || kpiId.includes('hours')) {
      return value.toFixed(2);
    }
    return value.toFixed(1);
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 75) return 'var(--success)';
    if (percentile >= 50) return 'var(--primary)';
    if (percentile >= 25) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getComparisonIcon = (value: number, average: number) => {
    const diff = value - average;
    if (Math.abs(diff) < 0.01) return <Minus size={14} className="text-muted" />;
    if (diff > 0) return <TrendingUp size={14} className="text-success" />;
    return <TrendingDown size={14} className="text-danger" />;
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card">
        <div className="error">Failed to load peer comparison</div>
      </div>
    );
  }

  // Calculate overall percentile from rankings
  const avgPercentile = data.rankings.length > 0
    ? data.rankings.reduce((sum, r) => sum + r.percentile, 0) / data.rankings.length
    : 50;

  // Get top rankings (sorted by percentile desc)
  const topRankings = [...data.rankings].sort((a, b) => b.percentile - a.percentile).slice(0, 10);

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Users size={20} />
          Peer Comparison
          <span className="badge badge-info" style={{ marginLeft: '8px' }}>
            {data.peerCount} {data.setting} peers
          </span>
          <span className={`badge ${avgPercentile >= 50 ? 'badge-success' : 'badge-warning'}`}>
            {avgPercentile.toFixed(0)}th percentile avg
          </span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Overall performance indicator */}
          <div className="card mb-4" style={{ padding: '20px' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Overall Peer Performance</h4>
                <p className="text-sm text-muted">Compared to {data.peerCount} {data.setting} facilities</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold" style={{ color: getPercentileColor(avgPercentile) }}>
                  {avgPercentile.toFixed(0)}<span className="text-lg">th</span>
                </div>
                <div className="text-xs text-muted">Avg Percentile</div>
              </div>
            </div>

            {/* Percentile bar */}
            <div style={{ position: 'relative', height: '32px', background: 'rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden' }}>
              {/* Quartile markers */}
              <div style={{ position: 'absolute', left: '25%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.3)' }} />
              <div style={{ position: 'absolute', left: '75%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.2)' }} />

              {/* Position indicator */}
              <div style={{
                position: 'absolute',
                left: `calc(${avgPercentile}% - 16px)`,
                top: '4px',
                width: '32px',
                height: '24px',
                background: getPercentileColor(avgPercentile),
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 600,
                color: '#0f0f1a',
                transition: 'left 0.3s ease'
              }}>
                You
              </div>
            </div>

            {/* Quartile labels */}
            <div className="flex justify-between mt-2 text-xs text-muted">
              <span>Bottom 25%</span>
              <span>Median</span>
              <span>Top 25%</span>
            </div>
          </div>

          {/* Rankings table */}
          <div className="card" style={{ padding: 0, position: 'relative' }} ref={tableRef}>
            {/* Bar hover tooltip - shows facility info on bar hover */}
            {barTooltip && (
              <div style={{
                position: 'absolute',
                left: barTooltip.x,
                top: barTooltip.y,
                transform: 'translate(-50%, -100%)',
                background: 'rgba(15, 15, 26, 0.98)',
                border: '1px solid rgba(102, 126, 234, 0.6)',
                borderRadius: '12px',
                padding: '14px 16px',
                minWidth: '260px',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
                zIndex: 100,
                backdropFilter: 'blur(12px)',
                pointerEvents: 'none'
              }}>
                {/* Arrow pointer */}
                <div style={{
                  position: 'absolute',
                  bottom: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '8px solid rgba(102, 126, 234, 0.6)'
                }} />

                {/* Facility Header */}
                <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <Building2 size={16} style={{ color: 'var(--primary)' }} />
                  <span className="font-bold" style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                    {data?.facilityName}
                  </span>
                  <span className="badge badge-info" style={{ fontSize: '9px', marginLeft: 'auto' }}>
                    {data?.setting}
                  </span>
                </div>

                {/* Metric Name */}
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={14} style={{ color: getPercentileColor(barTooltip.ranking.percentile) }} />
                  <span className="font-bold" style={{ color: getPercentileColor(barTooltip.ranking.percentile), fontSize: '14px' }}>
                    {barTooltip.ranking.kpiName}
                  </span>
                </div>

                {/* Stats Grid */}
                <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div className="text-xs text-muted">Your Value</div>
                    <div className="font-bold" style={{ color: getPercentileColor(barTooltip.ranking.percentile), fontSize: '15px' }}>
                      {formatValue(barTooltip.ranking.value, barTooltip.ranking.kpiId)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div className="text-xs text-muted">Peer Avg</div>
                    <div className="font-bold" style={{ color: 'var(--text-primary)', fontSize: '15px' }}>
                      {formatValue(barTooltip.ranking.average, barTooltip.ranking.kpiId)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div className="text-xs text-muted">Median</div>
                    <div className="font-bold" style={{ color: 'var(--text-primary)', fontSize: '15px' }}>
                      {formatValue(barTooltip.ranking.median, barTooltip.ranking.kpiId)}
                    </div>
                  </div>
                </div>

                {/* Range Bar */}
                <div style={{ marginBottom: '10px' }}>
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>Min: {formatValue(barTooltip.ranking.min, barTooltip.ranking.kpiId)}</span>
                    <span>Max: {formatValue(barTooltip.ranking.max, barTooltip.ranking.kpiId)}</span>
                  </div>
                  <div style={{
                    position: 'relative',
                    height: '10px',
                    background: 'linear-gradient(90deg, var(--danger), var(--warning), var(--success))',
                    borderRadius: '5px'
                  }}>
                    {/* Your position */}
                    <div style={{
                      position: 'absolute',
                      left: `${Math.max(0, Math.min(100, ((barTooltip.ranking.value - barTooltip.ranking.min) / (barTooltip.ranking.max - barTooltip.ranking.min)) * 100))}%`,
                      top: '-3px',
                      transform: 'translateX(-50%)',
                      width: '16px',
                      height: '16px',
                      background: '#fff',
                      borderRadius: '50%',
                      border: '3px solid var(--primary)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                    }} />
                  </div>
                </div>

                {/* Percentile Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target size={12} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs text-muted">Rank #{barTooltip.ranking.rank} of {barTooltip.ranking.totalPeers}</span>
                  </div>
                  <span className="badge" style={{
                    background: `${getPercentileColor(barTooltip.ranking.percentile)}22`,
                    color: getPercentileColor(barTooltip.ranking.percentile),
                    fontWeight: 700
                  }}>
                    {barTooltip.ranking.percentile}th Percentile
                  </span>
                </div>
              </div>
            )}

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th style={{ textAlign: 'center' }}>Your Value</th>
                    <th style={{ textAlign: 'center' }}>Peer Avg</th>
                    <th style={{ textAlign: 'center' }}>vs Peers</th>
                    <th style={{ textAlign: 'center' }}>Percentile</th>
                    <th style={{ textAlign: 'center' }}>Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {topRankings.map((ranking, idx) => (
                    <tr
                      key={idx}
                      onMouseEnter={() => setHoveredRanking(ranking)}
                      onMouseLeave={() => setHoveredRanking(null)}
                      style={{
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        background: hoveredRanking?.kpiId === ranking.kpiId ? 'rgba(102, 126, 234, 0.1)' : undefined
                      }}
                    >
                      <td>
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{ranking.kpiName}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                        {formatValue(ranking.value, ranking.kpiId)}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace' }} className="text-muted">
                        {formatValue(ranking.average, ranking.kpiId)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {getComparisonIcon(ranking.value, ranking.average)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="flex items-center justify-center gap-2">
                          <div
                            style={{
                              width: '80px',
                              height: '14px',
                              background: 'rgba(255,255,255,0.1)',
                              borderRadius: '7px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              position: 'relative',
                              transition: 'transform 0.2s, box-shadow 0.2s',
                              boxShadow: barTooltip?.ranking.kpiId === ranking.kpiId ? '0 0 12px rgba(102, 126, 234, 0.5)' : 'none',
                              transform: barTooltip?.ranking.kpiId === ranking.kpiId ? 'scale(1.1)' : 'scale(1)'
                            }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const tableRect = tableRef.current?.getBoundingClientRect();
                              setBarTooltip({
                                ranking,
                                x: rect.left - (tableRect?.left || 0) + rect.width / 2,
                                y: rect.top - (tableRect?.top || 0) - 10
                              });
                            }}
                            onMouseLeave={() => setBarTooltip(null)}
                          >
                            {/* Background gradient showing range */}
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'linear-gradient(90deg, rgba(255,71,87,0.3), rgba(255,193,7,0.3), rgba(0,217,165,0.3))',
                              opacity: 0.5
                            }} />
                            {/* Filled portion */}
                            <div style={{
                              height: '100%',
                              width: `${ranking.percentile}%`,
                              background: `linear-gradient(90deg, ${getPercentileColor(ranking.percentile)}aa, ${getPercentileColor(ranking.percentile)})`,
                              borderRadius: '7px',
                              position: 'relative',
                              transition: 'width 0.3s ease'
                            }}>
                              {/* Animated shine effect */}
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '50%',
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.3), transparent)',
                                borderRadius: '7px 7px 0 0'
                              }} />
                            </div>
                            {/* Median marker */}
                            <div style={{
                              position: 'absolute',
                              left: '50%',
                              top: 0,
                              bottom: 0,
                              width: '2px',
                              background: 'rgba(255,255,255,0.5)',
                              transform: 'translateX(-50%)'
                            }} />
                          </div>
                          <span className="text-sm font-bold" style={{ color: getPercentileColor(ranking.percentile), minWidth: '40px' }}>
                            {ranking.percentile}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }} className="text-muted text-sm">
                        #{ranking.rank} of {ranking.totalPeers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hover tooltip with detailed peer data */}
            {hoveredRanking && (
              <div style={{
                position: 'absolute',
                top: '50%',
                right: '20px',
                transform: 'translateY(-50%)',
                background: 'rgba(15, 15, 26, 0.98)',
                border: '1px solid rgba(102, 126, 234, 0.5)',
                borderRadius: '12px',
                padding: '16px',
                minWidth: '220px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                zIndex: 10,
                backdropFilter: 'blur(10px)'
              }}>
                <div className="font-bold mb-3" style={{ color: 'var(--primary)', fontSize: '14px' }}>
                  {hoveredRanking.kpiName}
                </div>

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div className="text-xs text-muted">Your Value</div>
                    <div className="font-bold" style={{ color: getPercentileColor(hoveredRanking.percentile) }}>
                      {formatValue(hoveredRanking.value, hoveredRanking.kpiId)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Peer Average</div>
                    <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {formatValue(hoveredRanking.average, hoveredRanking.kpiId)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Peer Median</div>
                    <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {formatValue(hoveredRanking.median, hoveredRanking.kpiId)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Percentile</div>
                    <div className="font-bold" style={{ color: getPercentileColor(hoveredRanking.percentile) }}>
                      {hoveredRanking.percentile}th
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Peer Min</div>
                    <div className="font-bold text-danger">
                      {formatValue(hoveredRanking.min, hoveredRanking.kpiId)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Peer Max</div>
                    <div className="font-bold text-success">
                      {formatValue(hoveredRanking.max, hoveredRanking.kpiId)}
                    </div>
                  </div>
                </div>

                {/* Visual range indicator */}
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="text-xs text-muted mb-2">Position in Peer Range</div>
                  <div style={{
                    position: 'relative',
                    height: '8px',
                    background: 'linear-gradient(90deg, var(--danger), var(--warning), var(--success))',
                    borderRadius: '4px'
                  }}>
                    {/* Your position marker */}
                    <div style={{
                      position: 'absolute',
                      left: `${Math.max(0, Math.min(100, ((hoveredRanking.value - hoveredRanking.min) / (hoveredRanking.max - hoveredRanking.min)) * 100))}%`,
                      top: '-4px',
                      transform: 'translateX(-50%)',
                      width: '16px',
                      height: '16px',
                      background: '#fff',
                      borderRadius: '50%',
                      border: '3px solid var(--primary)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }} />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-muted">
                    <span>Min</span>
                    <span>Max</span>
                  </div>
                </div>

                <div className="text-center mt-3">
                  <span className="badge" style={{
                    background: `${getPercentileColor(hoveredRanking.percentile)}22`,
                    color: getPercentileColor(hoveredRanking.percentile)
                  }}>
                    Rank #{hoveredRanking.rank} of {hoveredRanking.totalPeers}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
