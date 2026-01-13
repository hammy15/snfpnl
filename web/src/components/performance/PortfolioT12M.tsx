import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, ChevronRight, Building2, DollarSign, Percent, Users } from 'lucide-react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { formatPeriod } from '../../utils/dateFormatters';
import './PortfolioT12M.css';

interface PortfolioT12MProps {
  periodId: string;
  onFacilitySelect?: (facilityId: string) => void;
}

interface FacilityData {
  facility_id: string;
  name: string;
  setting: string;
  state: string;
  margin: number | null;
  revenue: number | null;
  cost: number | null;
  occupancy: number | null;
  skilledMix: number | null;
}

interface TrendPoint {
  period_id: string;
  avgMargin: number;
  avgRevenue: number;
  avgCost: number;
  avgOccupancy: number;
  facilitiesCount: number;
}

interface APIFacility {
  facility_id: string;
  name: string;
  setting: string;
  state?: string;
  total_revenue?: number;
  total_expenses?: number;
  ebitdar_pct?: number;
}

function transformFacility(f: APIFacility): FacilityData {
  return {
    facility_id: f.facility_id,
    name: f.name,
    setting: f.setting,
    state: f.state || '',
    margin: f.ebitdar_pct ?? null,
    revenue: f.total_revenue ?? null,
    cost: f.total_expenses ?? null,
    occupancy: null, // Not available in this API
    skilledMix: null // Not available in this API
  };
}

async function fetchPortfolioSummary(periodId: string): Promise<{ facilities: FacilityData[], trends: TrendPoint[] }> {
  const res = await fetch(`https://snfpnl.onrender.com/api/financials/summary/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch portfolio data');
  const data = await res.json();

  // Transform facilities to expected format
  const facilities: FacilityData[] = (data.facilities || []).map(transformFacility);

  // Get trailing 12 months of data
  const periods = generateT12MPeriods(periodId);
  const trendsPromises = periods.map(async (p) => {
    const pRes = await fetch(`https://snfpnl.onrender.com/api/financials/summary/${p}`);
    if (!pRes.ok) return null;
    return { period_id: p, data: await pRes.json() };
  });

  const trendsData = await Promise.all(trendsPromises);
  const trends: TrendPoint[] = trendsData
    .filter((t): t is { period_id: string; data: { facilities: APIFacility[] } } => t !== null)
    .map(t => {
      const rawFacilities = t.data.facilities || [];
      const mapped = rawFacilities.map(transformFacility);
      const withMargin = mapped.filter((f: FacilityData) => f.margin !== null);
      const withRevenue = mapped.filter((f: FacilityData) => f.revenue !== null);
      const withCost = mapped.filter((f: FacilityData) => f.cost !== null);
      const withOccupancy = mapped.filter((f: FacilityData) => f.occupancy !== null);

      return {
        period_id: t.period_id,
        avgMargin: withMargin.length > 0 ? withMargin.reduce((sum: number, f: FacilityData) => sum + (f.margin || 0), 0) / withMargin.length : 0,
        avgRevenue: withRevenue.length > 0 ? withRevenue.reduce((sum: number, f: FacilityData) => sum + (f.revenue || 0), 0) / withRevenue.length : 0,
        avgCost: withCost.length > 0 ? withCost.reduce((sum: number, f: FacilityData) => sum + (f.cost || 0), 0) / withCost.length : 0,
        avgOccupancy: withOccupancy.length > 0 ? withOccupancy.reduce((sum: number, f: FacilityData) => sum + (f.occupancy || 0), 0) / withOccupancy.length : 0,
        facilitiesCount: mapped.length
      };
    })
    .sort((a, b) => a.period_id.localeCompare(b.period_id));

  return {
    facilities,
    trends
  };
}

function generateT12MPeriods(currentPeriod: string): string[] {
  const [year, month] = currentPeriod.split('-').map(Number);
  const periods: string[] = [];

  for (let i = 11; i >= 0; i--) {
    let m = month - i;
    let y = year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    periods.push(`${y}-${m.toString().padStart(2, '0')}`);
  }

  return periods;
}

export function PortfolioT12M({ periodId, onFacilitySelect }: PortfolioT12MProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'margin' | 'revenue' | 'cost' | 'occupancy'>('margin');

  const { data, isLoading, error } = useQuery({
    queryKey: ['portfolioT12M', periodId],
    queryFn: () => fetchPortfolioSummary(periodId),
  });

  if (isLoading) {
    return (
      <div className="portfolio-t12m-loading">
        <div className="spinner" />
        <span>Loading portfolio trends...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="portfolio-t12m-error">
        Failed to load portfolio data
      </div>
    );
  }

  const { facilities, trends } = data;

  // Calculate current period stats
  const currentStats = trends.length > 0 ? trends[trends.length - 1] : null;
  const firstStats = trends.length > 0 ? trends[0] : null;

  // Calculate changes
  const marginChange = currentStats && firstStats ? currentStats.avgMargin - firstStats.avgMargin : 0;
  const revenueChange = currentStats && firstStats ? currentStats.avgRevenue - firstStats.avgRevenue : 0;
  const costChange = currentStats && firstStats ? currentStats.avgCost - firstStats.avgCost : 0;
  const occupancyChange = currentStats && firstStats ? currentStats.avgOccupancy - firstStats.avgOccupancy : 0;

  // Categorize facilities by performance
  const topPerformers = facilities
    .filter(f => f.margin !== null && f.margin >= 10)
    .sort((a, b) => (b.margin || 0) - (a.margin || 0))
    .slice(0, 5);

  const needsAttention = facilities
    .filter(f => f.margin !== null && f.margin < 0)
    .sort((a, b) => (a.margin || 0) - (b.margin || 0))
    .slice(0, 5);

  const getChartData = () => {
    return trends.map(t => ({
      period: formatPeriod(t.period_id),
      value: selectedMetric === 'margin' ? t.avgMargin :
             selectedMetric === 'revenue' ? t.avgRevenue :
             selectedMetric === 'cost' ? t.avgCost : t.avgOccupancy
    }));
  };

  const getMetricConfig = () => {
    switch (selectedMetric) {
      case 'margin':
        return { label: 'Operating Margin %', color: '#2563eb', format: (v: number) => `${v.toFixed(1)}%` };
      case 'revenue':
        return { label: 'Revenue PPD', color: '#16a34a', format: (v: number) => `$${v.toFixed(0)}` };
      case 'cost':
        return { label: 'Cost PPD', color: '#dc2626', format: (v: number) => `$${v.toFixed(0)}` };
      case 'occupancy':
        return { label: 'Occupancy %', color: '#7c3aed', format: (v: number) => `${v.toFixed(1)}%` };
    }
  };

  const metricConfig = getMetricConfig();

  return (
    <div className="portfolio-t12m">
      <div className="portfolio-t12m-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-left">
          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <TrendingUp size={20} className="header-icon" />
          <h2>Portfolio T12M Performance</h2>
        </div>
        <div className="header-badges">
          <span className="facility-count-badge">
            <Building2 size={14} />
            {facilities.length} Facilities
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="portfolio-t12m-content">
          {/* Summary Cards */}
          <div className="portfolio-summary-grid">
            <div className={`summary-card ${selectedMetric === 'margin' ? 'selected' : ''}`} onClick={() => setSelectedMetric('margin')}>
              <div className="summary-icon margin">
                <Percent size={18} />
              </div>
              <div className="summary-content">
                <span className="summary-label">Avg Operating Margin</span>
                <span className="summary-value">{currentStats?.avgMargin.toFixed(1)}%</span>
                <span className={`summary-change ${marginChange >= 0 ? 'positive' : 'negative'}`}>
                  {marginChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {marginChange >= 0 ? '+' : ''}{marginChange.toFixed(1)}% T12M
                </span>
              </div>
            </div>

            <div className={`summary-card ${selectedMetric === 'revenue' ? 'selected' : ''}`} onClick={() => setSelectedMetric('revenue')}>
              <div className="summary-icon revenue">
                <DollarSign size={18} />
              </div>
              <div className="summary-content">
                <span className="summary-label">Avg Revenue PPD</span>
                <span className="summary-value">${currentStats?.avgRevenue.toFixed(0)}</span>
                <span className={`summary-change ${revenueChange >= 0 ? 'positive' : 'negative'}`}>
                  {revenueChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(0)} T12M
                </span>
              </div>
            </div>

            <div className={`summary-card ${selectedMetric === 'cost' ? 'selected' : ''}`} onClick={() => setSelectedMetric('cost')}>
              <div className="summary-icon cost">
                <DollarSign size={18} />
              </div>
              <div className="summary-content">
                <span className="summary-label">Avg Cost PPD</span>
                <span className="summary-value">${currentStats?.avgCost.toFixed(0)}</span>
                <span className={`summary-change ${costChange <= 0 ? 'positive' : 'negative'}`}>
                  {costChange <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                  {costChange >= 0 ? '+' : ''}${costChange.toFixed(0)} T12M
                </span>
              </div>
            </div>

            <div className={`summary-card ${selectedMetric === 'occupancy' ? 'selected' : ''}`} onClick={() => setSelectedMetric('occupancy')}>
              <div className="summary-icon occupancy">
                <Users size={18} />
              </div>
              <div className="summary-content">
                <span className="summary-label">Avg Occupancy</span>
                <span className="summary-value">{currentStats?.avgOccupancy.toFixed(1)}%</span>
                <span className={`summary-change ${occupancyChange >= 0 ? 'positive' : 'negative'}`}>
                  {occupancyChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {occupancyChange >= 0 ? '+' : ''}{occupancyChange.toFixed(1)}% T12M
                </span>
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="portfolio-chart-section">
            <h3 className="chart-title">Portfolio {metricConfig.label} Trend</h3>
            <div className="portfolio-chart">
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={getChartData()}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={metricConfig.color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={metricConfig.color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="period" fontSize={11} />
                  <YAxis
                    tickFormatter={(v) => metricConfig.format(v)}
                    fontSize={11}
                    width={60}
                  />
                  <Tooltip
                    formatter={(value) => [metricConfig.format(value as number), metricConfig.label]}
                    contentStyle={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={metricConfig.color}
                    fill="url(#colorValue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Facility Rankings */}
          <div className="portfolio-rankings">
            <div className="ranking-section">
              <h4 className="ranking-title positive">
                <TrendingUp size={16} />
                Top Performers
              </h4>
              {topPerformers.length > 0 ? (
                <div className="ranking-list">
                  {topPerformers.map((f, i) => (
                    <div
                      key={f.facility_id}
                      className="ranking-item"
                      onClick={() => onFacilitySelect?.(f.facility_id)}
                    >
                      <span className="rank">{i + 1}</span>
                      <div className="facility-info">
                        <span className="facility-name">{f.name}</span>
                        <span className="facility-meta">{f.state} | {f.setting}</span>
                      </div>
                      <span className="margin-value positive">{f.margin?.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data">No facilities with 10%+ margin</p>
              )}
            </div>

            <div className="ranking-section">
              <h4 className="ranking-title negative">
                <TrendingDown size={16} />
                Needs Attention
              </h4>
              {needsAttention.length > 0 ? (
                <div className="ranking-list">
                  {needsAttention.map((f, i) => (
                    <div
                      key={f.facility_id}
                      className="ranking-item"
                      onClick={() => onFacilitySelect?.(f.facility_id)}
                    >
                      <span className="rank">{i + 1}</span>
                      <div className="facility-info">
                        <span className="facility-name">{f.name}</span>
                        <span className="facility-meta">{f.state} | {f.setting}</span>
                      </div>
                      <span className="margin-value negative">{f.margin?.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data positive">No facilities with negative margins</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
