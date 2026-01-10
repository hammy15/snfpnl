import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calculator, ChevronDown, ChevronRight, TrendingUp, TrendingDown,
  Minus, HelpCircle
} from 'lucide-react';

interface FinancialRatio {
  id: string;
  name: string;
  category: 'profitability' | 'liquidity' | 'efficiency' | 'leverage';
  formula: string;
  value: number;
  previousValue?: number;
  benchmark: number;
  interpretation: string;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  trend: 'improving' | 'declining' | 'stable';
  tooltipExplanation: string;
}

interface FinancialRatioCalculatorProps {
  facilityId: number;
  periodId: string;
}

const CATEGORY_CONFIG = {
  profitability: { color: 'var(--success)', label: 'Profitability', icon: '💰' },
  liquidity: { color: 'var(--primary)', label: 'Liquidity', icon: '💧' },
  efficiency: { color: 'var(--warning)', label: 'Efficiency', icon: '⚡' },
  leverage: { color: 'var(--danger)', label: 'Leverage', icon: '📊' }
};

const STATUS_COLORS = {
  excellent: 'var(--success)',
  good: 'var(--primary)',
  fair: 'var(--warning)',
  poor: 'var(--danger)'
};

export function FinancialRatioCalculator({ facilityId, periodId }: FinancialRatioCalculatorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFormulas, setShowFormulas] = useState(false);
  const [hoveredRatio, setHoveredRatio] = useState<string | null>(null);

  const { data: ratios = [], isLoading } = useQuery<FinancialRatio[]>({
    queryKey: ['financial-ratios', facilityId, periodId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3002/api/financial-ratios/${facilityId}/${periodId}`);
      if (!response.ok) throw new Error('Failed to fetch financial ratios');
      return response.json();
    },
  });

  const filteredRatios = useMemo(() =>
    ratios.filter(r => selectedCategory === 'all' || r.category === selectedCategory),
    [ratios, selectedCategory]
  );

  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; excellent: number; poor: number }> = {};
    for (const ratio of ratios) {
      if (!stats[ratio.category]) {
        stats[ratio.category] = { count: 0, excellent: 0, poor: 0 };
      }
      stats[ratio.category].count++;
      if (ratio.status === 'excellent') stats[ratio.category].excellent++;
      if (ratio.status === 'poor') stats[ratio.category].poor++;
    }
    return stats;
  }, [ratios]);

  const formatValue = (value: number, id: string) => {
    if (id.includes('pct') || id.includes('margin') || id.includes('ratio') || id.includes('return')) {
      return `${value.toFixed(1)}%`;
    }
    if (id.includes('days')) {
      return `${value.toFixed(0)} days`;
    }
    return value.toFixed(2);
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp size={14} className="text-success" />;
    if (trend === 'declining') return <TrendingDown size={14} className="text-danger" />;
    return <Minus size={14} className="text-muted" />;
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p className="text-muted mt-4">Calculating financial ratios...</p>
      </div>
    );
  }

  return (
    <section className="kpi-section">
      <button
        className="section-title"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Calculator size={20} />
          Financial Ratio Calculator
          <span className="badge badge-info">{ratios.length} ratios</span>
        </span>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>

      {isExpanded && (
        <>
          {/* Category Summary Cards */}
          <div className="grid grid-cols-4 mb-4">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const stats = categoryStats[key] || { count: 0, excellent: 0, poor: 0 };
              return (
                <div
                  key={key}
                  className="card"
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    border: selectedCategory === key ? `2px solid ${config.color}` : undefined
                  }}
                  onClick={() => setSelectedCategory(selectedCategory === key ? 'all' : key)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: '20px' }}>{config.icon}</span>
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{config.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-2xl font-bold" style={{ color: config.color }}>{stats.count}</div>
                      <div className="text-xs text-muted">ratios</div>
                    </div>
                    <div className="flex gap-2">
                      {stats.excellent > 0 && (
                        <span className="badge badge-success" style={{ fontSize: '10px' }}>
                          {stats.excellent} excellent
                        </span>
                      )}
                      {stats.poor > 0 && (
                        <span className="badge badge-danger" style={{ fontSize: '10px' }}>
                          {stats.poor} poor
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`btn ${selectedCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                All Ratios
              </button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showFormulas}
                onChange={(e) => setShowFormulas(e.target.checked)}
              />
              <span className="text-sm">Show formulas</span>
            </label>
          </div>

          {/* Ratios Grid */}
          <div className="grid grid-cols-2 gap-4">
            {filteredRatios.map(ratio => (
              <div
                key={ratio.id}
                className="card"
                style={{
                  padding: '16px',
                  borderLeft: `4px solid ${STATUS_COLORS[ratio.status]}`,
                  position: 'relative'
                }}
                onMouseEnter={() => setHoveredRatio(ratio.id)}
                onMouseLeave={() => setHoveredRatio(null)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '16px' }}>{CATEGORY_CONFIG[ratio.category].icon}</span>
                      <h5 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        {ratio.name}
                      </h5>
                      <span title={ratio.tooltipExplanation}>
                        <HelpCircle size={14} className="text-muted cursor-pointer" />
                      </span>
                    </div>
                    <div className="text-xs text-muted">{CATEGORY_CONFIG[ratio.category].label}</div>
                  </div>
                  <span className="badge" style={{
                    background: `${STATUS_COLORS[ratio.status]}22`,
                    color: STATUS_COLORS[ratio.status],
                    fontSize: '10px'
                  }}>
                    {ratio.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="text-3xl font-bold" style={{ color: STATUS_COLORS[ratio.status] }}>
                      {formatValue(ratio.value, ratio.id)}
                    </div>
                    {ratio.previousValue !== undefined && (
                      <div className="flex items-center gap-1 text-sm">
                        {getTrendIcon(ratio.trend)}
                        <span className="text-muted">
                          from {formatValue(ratio.previousValue, ratio.id)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">Benchmark</div>
                    <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {formatValue(ratio.benchmark, ratio.id)}
                    </div>
                  </div>
                </div>

                {/* Gauge visualization */}
                <div style={{ position: 'relative', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '8px' }}>
                  {/* Benchmark marker */}
                  <div style={{
                    position: 'absolute',
                    left: `${Math.min(100, (ratio.benchmark / (Math.max(ratio.value, ratio.benchmark) * 1.2)) * 100)}%`,
                    top: '-4px',
                    width: '2px',
                    height: '16px',
                    background: 'rgba(255,255,255,0.5)'
                  }} />
                  {/* Value bar */}
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (ratio.value / (Math.max(ratio.value, ratio.benchmark) * 1.2)) * 100)}%`,
                    background: STATUS_COLORS[ratio.status],
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {ratio.interpretation}
                </p>

                {showFormulas && (
                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <code style={{
                      fontSize: '10px',
                      background: 'rgba(255,255,255,0.05)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      color: 'var(--primary)'
                    }}>
                      {ratio.formula}
                    </code>
                  </div>
                )}

                {/* Tooltip on hover */}
                {hoveredRatio === ratio.id && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    marginTop: '8px',
                    padding: '12px',
                    background: 'rgba(15, 15, 26, 0.98)',
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                  }}>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {ratio.tooltipExplanation}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4 text-sm">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <span key={status} className="flex items-center gap-2">
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: color }} />
                <span className="text-muted capitalize">{status}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
