import { useQuery } from '@tanstack/react-query';
import { Trophy, TrendingUp, TrendingDown, Medal, Crown, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface FacilityRanking {
  facilityId: string;
  name: string;
  state: string;
  setting: string;
  rank: number;
  previousRank: number;
  score: number;
  metrics: {
    operatingMargin: number | null;
    occupancy: number | null;
    skilledMix: number | null;
    revenuePerDay: number | null;
    laborCostPct: number | null;
  };
  trend: 'up' | 'down' | 'stable';
  badges: string[];
}

interface LeaderboardResponse {
  period: string;
  facilities: FacilityRanking[];
  topPerformers: FacilityRanking[];
  mostImproved: FacilityRanking[];
  needsAttention: FacilityRanking[];
}

interface FacilityLeaderboardProps {
  periodId: string;
  onFacilityClick?: (facilityId: string) => void;
}

type SortField = 'rank' | 'name' | 'operatingMargin' | 'occupancy' | 'skilledMix' | 'revenuePerDay' | 'score';
type SortDirection = 'asc' | 'desc';

export function FacilityLeaderboard({ periodId, onFacilityClick }: FacilityLeaderboardProps) {
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterSetting, setFilterSetting] = useState<string>('all');

  const { data, isLoading, error } = useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', periodId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3002/api/leaderboard/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return response.json();
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'rank' ? 'asc' : 'desc');
    }
  };

  const getRankChange = (current: number, previous: number) => {
    const change = previous - current;
    if (change > 0) return { icon: <ChevronUp size={14} className="text-success" />, text: `+${change}`, class: 'text-success' };
    if (change < 0) return { icon: <ChevronDown size={14} className="text-danger" />, text: `${change}`, class: 'text-danger' };
    return { icon: null, text: '-', class: 'text-muted' };
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Crown size={20} style={{ color: '#FFD700' }} />;
    if (rank === 2) return <Medal size={18} style={{ color: '#C0C0C0' }} />;
    if (rank === 3) return <Medal size={18} style={{ color: '#CD7F32' }} />;
    return <span className="text-muted">#{rank}</span>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--primary)';
    if (score >= 40) return 'var(--warning)';
    return 'var(--danger)';
  };

  const formatValue = (value: number | null, type: string) => {
    if (value === null) return 'N/A';
    if (type === 'percentage') return `${value.toFixed(1)}%`;
    if (type === 'currency') return `$${value.toFixed(0)}`;
    return value.toFixed(1);
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Loading leaderboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <p className="text-danger">Failed to load leaderboard</p>
      </div>
    );
  }

  // Filter and sort facilities
  let facilities = [...data.facilities];
  if (filterSetting !== 'all') {
    facilities = facilities.filter(f => f.setting === filterSetting);
  }

  facilities.sort((a, b) => {
    let aVal: number | string | null = 0;
    let bVal: number | string | null = 0;

    switch (sortField) {
      case 'rank': aVal = a.rank; bVal = b.rank; break;
      case 'name': aVal = a.name; bVal = b.name; break;
      case 'score': aVal = a.score; bVal = b.score; break;
      case 'operatingMargin': aVal = a.metrics.operatingMargin; bVal = b.metrics.operatingMargin; break;
      case 'occupancy': aVal = a.metrics.occupancy; bVal = b.metrics.occupancy; break;
      case 'skilledMix': aVal = a.metrics.skilledMix; bVal = b.metrics.skilledMix; break;
      case 'revenuePerDay': aVal = a.metrics.revenuePerDay; bVal = b.metrics.revenuePerDay; break;
    }

    if (aVal === null) return 1;
    if (bVal === null) return -1;
    if (typeof aVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
    }
    return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
        ) : (
          <ArrowUpDown size={12} className="text-muted" style={{ opacity: 0.5 }} />
        )}
      </div>
    </th>
  );

  return (
    <div>
      {/* Header with stats */}
      <div className="grid grid-cols-4 mb-6">
        <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.05))' }}>
          <div className="flex items-center gap-3">
            <Crown size={32} style={{ color: '#FFD700' }} />
            <div>
              <div className="text-xs text-muted">Top Performer</div>
              <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.topPerformers[0]?.name || 'N/A'}
              </div>
              <div className="text-sm text-success">
                {data.topPerformers[0]?.score.toFixed(0)} pts
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(0, 217, 165, 0.2), rgba(0, 217, 165, 0.05))' }}>
          <div className="flex items-center gap-3">
            <TrendingUp size={32} className="text-success" />
            <div>
              <div className="text-xs text-muted">Most Improved</div>
              <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.mostImproved[0]?.name || 'N/A'}
              </div>
              <div className="text-sm text-success">
                +{data.mostImproved[0] ? (data.mostImproved[0].previousRank - data.mostImproved[0].rank) : 0} ranks
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(255, 71, 87, 0.2), rgba(255, 71, 87, 0.05))' }}>
          <div className="flex items-center gap-3">
            <TrendingDown size={32} className="text-danger" />
            <div>
              <div className="text-xs text-muted">Needs Attention</div>
              <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.needsAttention[0]?.name || 'None'}
              </div>
              <div className="text-sm text-danger">
                {data.needsAttention[0]?.score.toFixed(0) || '-'} pts
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div className="flex items-center gap-3">
            <Trophy size={32} className="text-primary" />
            <div>
              <div className="text-xs text-muted">Total Facilities</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {data.facilities.length}
              </div>
              <div className="text-sm text-muted">ranked</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-2">
          {['all', 'SNF', 'ALF', 'ILF'].map(setting => (
            <button
              key={setting}
              className={`btn ${filterSetting === setting ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterSetting(setting)}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              {setting === 'all' ? 'All' : setting}
            </button>
          ))}
        </div>
        <span className="text-muted text-sm">
          Showing {facilities.length} facilities
        </span>
      </div>

      {/* Leaderboard table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <SortHeader field="rank">Rank</SortHeader>
                <th style={{ width: '30px' }}></th>
                <SortHeader field="name">Facility</SortHeader>
                <th>Setting</th>
                <SortHeader field="score">Score</SortHeader>
                <SortHeader field="operatingMargin">Margin</SortHeader>
                <SortHeader field="occupancy">Occupancy</SortHeader>
                <SortHeader field="skilledMix">Skilled Mix</SortHeader>
                <SortHeader field="revenuePerDay">Rev/Day</SortHeader>
                <th style={{ textAlign: 'center' }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((facility) => {
                const rankChange = getRankChange(facility.rank, facility.previousRank);
                return (
                  <tr
                    key={facility.facilityId}
                    onClick={() => onFacilityClick?.(facility.facilityId)}
                    style={{ cursor: onFacilityClick ? 'pointer' : 'default' }}
                  >
                    <td style={{ textAlign: 'center', width: '60px' }}>
                      {getRankBadge(facility.rank)}
                    </td>
                    <td style={{ width: '40px' }}>
                      <span className={`flex items-center ${rankChange.class}`} style={{ fontSize: '11px' }}>
                        {rankChange.icon}
                        {rankChange.text}
                      </span>
                    </td>
                    <td>
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {facility.name}
                      </div>
                      <div className="text-xs text-muted">{facility.state}</div>
                    </td>
                    <td>
                      <span className="badge badge-info">{facility.setting}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div style={{
                          width: '50px',
                          height: '8px',
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${facility.score}%`,
                            background: getScoreColor(facility.score),
                            borderRadius: '4px'
                          }} />
                        </div>
                        <span className="font-bold" style={{ color: getScoreColor(facility.score), minWidth: '35px' }}>
                          {facility.score.toFixed(0)}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>
                      <span style={{ color: (facility.metrics.operatingMargin || 0) >= 10 ? 'var(--success)' : (facility.metrics.operatingMargin || 0) >= 0 ? 'var(--warning)' : 'var(--danger)' }}>
                        {formatValue(facility.metrics.operatingMargin, 'percentage')}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>
                      {formatValue(facility.metrics.occupancy, 'percentage')}
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>
                      {formatValue(facility.metrics.skilledMix, 'percentage')}
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>
                      {formatValue(facility.metrics.revenuePerDay, 'currency')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {facility.trend === 'up' && <TrendingUp size={16} className="text-success" />}
                      {facility.trend === 'down' && <TrendingDown size={16} className="text-danger" />}
                      {facility.trend === 'stable' && <span className="text-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
