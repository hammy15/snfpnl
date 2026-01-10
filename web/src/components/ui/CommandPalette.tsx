import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Building2, BarChart3, TrendingUp, Settings, FileText,
  Map, Users, Bell, Calendar, Calculator, Zap,
  Clock, Star, Command, ArrowRight
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  category: 'navigation' | 'facility' | 'action' | 'recent';
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  facilities?: Array<{ id: number; name: string; setting: string }>;
}

export function CommandPalette({ facilities = [] }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Load recent commands from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('commandPalette_recent');
    if (stored) {
      try {
        setRecentCommands(JSON.parse(stored));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Keyboard shortcut to open palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const addToRecent = useCallback((id: string) => {
    setRecentCommands(prev => {
      const updated = [id, ...prev.filter(r => r !== id)].slice(0, 5);
      localStorage.setItem('commandPalette_recent', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      // Navigation commands
      {
        id: 'nav-dashboard',
        title: 'Go to Dashboard',
        subtitle: 'View portfolio overview',
        icon: <BarChart3 size={18} />,
        category: 'navigation',
        action: () => navigate('/'),
        keywords: ['home', 'overview', 'portfolio']
      },
      {
        id: 'nav-leaderboard',
        title: 'View Leaderboard',
        subtitle: 'Compare facility performance',
        icon: <TrendingUp size={18} />,
        category: 'navigation',
        action: () => navigate('/leaderboard'),
        keywords: ['ranking', 'compare', 'best', 'top']
      },
      {
        id: 'nav-map',
        title: 'Geographic Map',
        subtitle: 'View facilities by location',
        icon: <Map size={18} />,
        category: 'navigation',
        action: () => navigate('/map'),
        keywords: ['location', 'geography', 'state']
      },
      {
        id: 'nav-cohort',
        title: 'Cohort Analysis',
        subtitle: 'Analyze facility groups',
        icon: <Users size={18} />,
        category: 'navigation',
        action: () => navigate('/cohort'),
        keywords: ['group', 'segment', 'analysis']
      },
      {
        id: 'nav-alerts',
        title: 'Smart Alerts',
        subtitle: 'View AI-detected anomalies',
        icon: <Bell size={18} />,
        category: 'navigation',
        action: () => navigate('/alerts'),
        keywords: ['warning', 'anomaly', 'issue']
      },
      {
        id: 'nav-reports',
        title: 'Automated Reports',
        subtitle: 'Manage scheduled reports',
        icon: <FileText size={18} />,
        category: 'navigation',
        action: () => navigate('/reports'),
        keywords: ['schedule', 'email', 'export']
      },
      {
        id: 'nav-legislative',
        title: 'Legislative Tracker',
        subtitle: 'Track healthcare bills',
        icon: <Calendar size={18} />,
        category: 'navigation',
        action: () => navigate('/legislative'),
        keywords: ['bills', 'congress', 'policy', 'law']
      },
      // Action commands
      {
        id: 'action-export',
        title: 'Export to Excel',
        subtitle: 'Download facility data',
        icon: <FileText size={18} />,
        category: 'action',
        action: () => {
          document.dispatchEvent(new CustomEvent('openExcelExport'));
          setIsOpen(false);
        },
        keywords: ['download', 'spreadsheet', 'csv']
      },
      {
        id: 'action-simulator',
        title: 'What-If Simulator',
        subtitle: 'Run scenario analysis',
        icon: <Calculator size={18} />,
        category: 'action',
        action: () => {
          document.dispatchEvent(new CustomEvent('openSimulator'));
          setIsOpen(false);
        },
        keywords: ['scenario', 'forecast', 'projection']
      },
      {
        id: 'action-compare',
        title: 'Compare Facilities',
        subtitle: 'Side-by-side comparison',
        icon: <Zap size={18} />,
        category: 'action',
        action: () => navigate('/compare'),
        keywords: ['versus', 'benchmark', 'side by side']
      },
      {
        id: 'action-settings',
        title: 'Settings',
        subtitle: 'Configure preferences',
        icon: <Settings size={18} />,
        category: 'action',
        action: () => navigate('/settings'),
        keywords: ['preferences', 'config', 'options']
      }
    ];

    // Add facility commands
    facilities.forEach(facility => {
      items.push({
        id: `facility-${facility.id}`,
        title: facility.name,
        subtitle: facility.setting,
        icon: <Building2 size={18} />,
        category: 'facility',
        action: () => navigate(`/facility/${facility.id}`),
        keywords: [facility.setting.toLowerCase()]
      });
    });

    return items;
  }, [facilities, navigate]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands first, then navigation
      const recentItems = recentCommands
        .map(id => commands.find(c => c.id === id))
        .filter(Boolean) as CommandItem[];

      const navItems = commands.filter(c => c.category === 'navigation' && !recentCommands.includes(c.id));
      return [...recentItems.map(c => ({ ...c, category: 'recent' as const })), ...navItems].slice(0, 10);
    }

    const lowerQuery = query.toLowerCase();
    return commands
      .filter(cmd => {
        const matchTitle = cmd.title.toLowerCase().includes(lowerQuery);
        const matchSubtitle = cmd.subtitle?.toLowerCase().includes(lowerQuery);
        const matchKeywords = cmd.keywords?.some(k => k.includes(lowerQuery));
        return matchTitle || matchSubtitle || matchKeywords;
      })
      .slice(0, 12);
  }, [query, commands, recentCommands]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        addToRecent(cmd.id);
        cmd.action();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, addToRecent]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          fontSize: '13px'
        }}
      >
        <Search size={14} />
        <span>Search</span>
        <kbd style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '4px',
          padding: '2px 6px',
          fontSize: '11px',
          marginLeft: '8px'
        }}>
          <Command size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000
        }}
      />

      {/* Palette */}
      <div style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '600px',
        background: 'rgba(15, 15, 26, 0.98)',
        border: '1px solid rgba(102, 126, 234, 0.3)',
        borderRadius: '16px',
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5)',
        zIndex: 1001,
        overflow: 'hidden'
      }}>
        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <Search size={20} style={{ color: 'var(--primary)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, facilities, or actions..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '16px'
            }}
          />
          <kbd style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {filteredCommands.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No results found for "{query}"
            </div>
          ) : (
            <div style={{ padding: '8px' }}>
              {/* Group by category */}
              {['recent', 'navigation', 'action', 'facility'].map(category => {
                const categoryItems = filteredCommands.filter(c => c.category === category);
                if (categoryItems.length === 0) return null;

                const categoryLabels: Record<string, string> = {
                  recent: 'Recent',
                  navigation: 'Navigation',
                  action: 'Actions',
                  facility: 'Facilities'
                };

                return (
                  <div key={category}>
                    <div style={{
                      padding: '8px 12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {category === 'recent' && <Clock size={10} style={{ display: 'inline', marginRight: '6px' }} />}
                      {category === 'facility' && <Star size={10} style={{ display: 'inline', marginRight: '6px' }} />}
                      {categoryLabels[category]}
                    </div>
                    {categoryItems.map((cmd) => {
                      const globalIndex = filteredCommands.indexOf(cmd);
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            addToRecent(cmd.id);
                            cmd.action();
                            setIsOpen(false);
                          }}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            background: isSelected ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.1s'
                          }}
                        >
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isSelected ? '#fff' : 'var(--text-muted)',
                            transition: 'all 0.1s'
                          }}>
                            {cmd.icon}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              color: 'var(--text-primary)',
                              fontWeight: 500,
                              fontSize: '14px'
                            }}>
                              {cmd.title}
                            </div>
                            {cmd.subtitle && (
                              <div style={{
                                color: 'var(--text-muted)',
                                fontSize: '12px',
                                marginTop: '2px'
                              }}>
                                {cmd.subtitle}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <ArrowRight size={16} style={{ color: 'var(--primary)' }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '12px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          fontSize: '11px',
          color: 'var(--text-muted)'
        }}>
          <span>
            <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', marginRight: '4px' }}>↑↓</kbd>
            Navigate
          </span>
          <span>
            <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', marginRight: '4px' }}>↵</kbd>
            Select
          </span>
          <span>
            <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', marginRight: '4px' }}>ESC</kbd>
            Close
          </span>
        </div>
      </div>
    </>
  );
}
