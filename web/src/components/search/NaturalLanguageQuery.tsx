import { useState, useRef } from 'react';
import { Search, Sparkles, X, ArrowRight, Building2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface QueryResultItem {
  facilityId: string;
  name: string;
  setting: string;
  state?: string;
  value: number;
  status: 'success' | 'warning' | 'danger';
  trend?: 'up' | 'down' | 'stable';
}

interface QueryResult {
  type: 'facilities' | 'metric' | 'comparison' | 'alert';
  title: string;
  description: string;
  data: QueryResultItem[];
  query: string;
}

interface NaturalLanguageQueryProps {
  onFacilityClick?: (facilityId: string) => void;
}

const EXAMPLE_QUERIES = [
  "Show facilities with margin decline > 5%",
  "Which facilities have occupancy below 80%?",
  "Top 5 performers by operating margin",
  "Facilities with high contract labor",
  "Compare SNF vs ALF margins",
  "Show struggling facilities",
  "Best skilled mix performers",
  "Facilities in Arizona",
];

export function NaturalLanguageQuery({ onFacilityClick }: NaturalLanguageQueryProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<QueryResult | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseAndExecuteQuery = async (queryText: string) => {
    setIsSearching(true);
    setResults(null);

    try {
      const response = await fetch('https://snfpnl.onrender.com/api/natural-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });

      if (!response.ok) throw new Error('Query failed');
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Query failed:', error);
      // Fallback to client-side parsing
      setResults(parseQueryLocally(queryText));
    } finally {
      setIsSearching(false);
    }
  };

  const parseQueryLocally = (queryText: string): QueryResult => {
    const lowerQuery = queryText.toLowerCase();

    // Simple pattern matching for demo
    if (lowerQuery.includes('margin') && (lowerQuery.includes('decline') || lowerQuery.includes('drop'))) {
      return {
        type: 'facilities',
        title: 'Facilities with Margin Decline',
        description: 'Showing facilities where operating margin has decreased',
        query: queryText,
        data: [],
      };
    }

    if (lowerQuery.includes('top') && lowerQuery.includes('performer')) {
      return {
        type: 'facilities',
        title: 'Top Performers',
        description: 'Highest performing facilities by composite score',
        query: queryText,
        data: [],
      };
    }

    if (lowerQuery.includes('occupancy') && lowerQuery.includes('below')) {
      return {
        type: 'alert',
        title: 'Low Occupancy Facilities',
        description: 'Facilities with occupancy below threshold',
        query: queryText,
        data: [],
      };
    }

    return {
      type: 'facilities',
      title: 'Search Results',
      description: `Results for "${queryText}"`,
      query: queryText,
      data: [],
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      parseAndExecuteQuery(query.trim());
      setShowExamples(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    parseAndExecuteQuery(example);
    setShowExamples(false);
  };

  const clearResults = () => {
    setResults(null);
    setQuery('');
    inputRef.current?.focus();
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'facilities': return <Building2 size={20} />;
      case 'metric': return <TrendingUp size={20} />;
      case 'alert': return <AlertTriangle size={20} />;
      default: return <Search size={20} />;
    }
  };

  return (
    <div className="natural-language-query">
      {/* Search bar */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-4">
            <div style={{ position: 'relative', flex: 1 }}>
              <div style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Sparkles size={20} className="text-primary" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowExamples(true)}
                placeholder="Ask anything... e.g., 'Show facilities with declining margins'"
                style={{
                  width: '100%',
                  padding: '16px 16px 16px 52px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '2px solid rgba(102, 126, 234, 0.3)',
                  borderRadius: '12px',
                  color: 'var(--text-primary)',
                  fontSize: '16px',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onBlur={() => setTimeout(() => setShowExamples(false), 200)}
              />
              {query && (
                <button
                  type="button"
                  onClick={clearResults}
                  style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)'
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!query.trim() || isSearching}
              style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isSearching ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                  Searching...
                </>
              ) : (
                <>
                  <Search size={18} />
                  Search
                </>
              )}
            </button>
          </div>
        </form>

        {/* Example queries */}
        {showExamples && !results && (
          <div className="mt-4">
            <div className="text-xs text-muted mb-2">Try asking:</div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(example)}
                  className="btn btn-secondary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ArrowRight size={12} />
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="card" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-primary">{getResultIcon(results.type)}</span>
              <div>
                <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{results.title}</h3>
                <p className="text-sm text-muted">{results.description}</p>
              </div>
            </div>
            <button
              onClick={clearResults}
              className="btn btn-secondary btn-icon"
              style={{ width: '32px', height: '32px' }}
            >
              <X size={16} />
            </button>
          </div>

          {results.data.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Facility</th>
                    <th>State</th>
                    <th>Setting</th>
                    <th style={{ textAlign: 'right' }}>Value</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.data.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => onFacilityClick?.(item.facilityId)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {item.name}
                      </td>
                      <td className="text-muted">{item.state}</td>
                      <td><span className="badge badge-info">{item.setting}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {item.value}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.trend === 'up' && <TrendingUp size={16} className="text-success" />}
                        {item.trend === 'down' && <TrendingDown size={16} className="text-danger" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Search size={48} className="text-muted" style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p className="text-muted">No results found for this query.</p>
              <p className="text-sm text-muted mt-2">Try rephrasing your question or use one of the example queries above.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
