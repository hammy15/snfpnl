import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, List, Map, Wrench, Bot, ClipboardCheck, DollarSign, FileText, GitCompare, Bell, BookOpen } from 'lucide-react';
import { ThemeToggle } from './ui/ThemeToggle';
import { FacilitySearch } from './FacilitySearch';
import { MobileNav } from './MobileNav';
import { Logo } from './Logo';
import './Header.css';

type View = 'dashboard' | 'facilities' | 'facility-detail' | 'tools' | 'map' | 'ppd' | 'verification' | 'executive' | 'comparison' | 'alerts' | 'directory';

interface Facility {
  facility_id: string;
  name: string;
  state: string;
  setting: string;
}

interface HeaderProps {
  currentView: View;
  onNavigate: (view: View) => void;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  onToggleAI: () => void;
  isAIOpen: boolean;
  facilities: Facility[];
  onFacilitySelect: (facilityId: string) => void;
}

async function fetchPeriods(): Promise<string[]> {
  const res = await fetch('http://localhost:3002/api/periods');
  if (!res.ok) throw new Error('Failed to fetch periods');
  return res.json();
}

export function Header({ currentView, onNavigate, selectedPeriod, onPeriodChange, onToggleAI, isAIOpen, facilities, onFacilitySelect }: HeaderProps) {
  const { data: periods = [] } = useQuery({
    queryKey: ['periods'],
    queryFn: fetchPeriods,
  });

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <MobileNav currentView={currentView} onNavigate={onNavigate} />
          <Logo size="sm" />
          <FacilitySearch facilities={facilities} onSelect={onFacilitySelect} />
        </div>

        <nav className="header-nav">
          <button
            className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNavigate('dashboard')}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button
            className={`nav-btn ${currentView === 'facilities' ? 'active' : ''}`}
            onClick={() => onNavigate('facilities')}
          >
            <List size={18} />
            Facilities
          </button>
          <button
            className={`nav-btn ${currentView === 'map' ? 'active' : ''}`}
            onClick={() => onNavigate('map')}
          >
            <Map size={18} />
            Heat Map
          </button>
          <button
            className={`nav-btn ${currentView === 'tools' ? 'active' : ''}`}
            onClick={() => onNavigate('tools')}
          >
            <Wrench size={18} />
            Tools
          </button>
          <button
            className={`nav-btn ${currentView === 'ppd' ? 'active' : ''}`}
            onClick={() => onNavigate('ppd')}
          >
            <DollarSign size={18} />
            PPD
          </button>
          <button
            className={`nav-btn ${currentView === 'verification' ? 'active' : ''}`}
            onClick={() => onNavigate('verification')}
          >
            <ClipboardCheck size={18} />
            Verify
          </button>
          <button
            className={`nav-btn ${currentView === 'executive' ? 'active' : ''}`}
            onClick={() => onNavigate('executive')}
          >
            <FileText size={18} />
            Summary
          </button>
          <button
            className={`nav-btn ${currentView === 'comparison' ? 'active' : ''}`}
            onClick={() => onNavigate('comparison')}
          >
            <GitCompare size={18} />
            Compare
          </button>
          <button
            className={`nav-btn ${currentView === 'alerts' ? 'active' : ''}`}
            onClick={() => onNavigate('alerts')}
          >
            <Bell size={18} />
            Alerts
          </button>
          <button
            className={`nav-btn ${currentView === 'directory' ? 'active' : ''}`}
            onClick={() => onNavigate('directory')}
          >
            <BookOpen size={18} />
            Directory
          </button>
        </nav>

        <div className="header-right">
          <select
            value={selectedPeriod}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="period-select"
          >
            {periods.map((period) => (
              <option key={period} value={period}>
                {formatPeriod(period)}
              </option>
            ))}
          </select>
          <ThemeToggle />
          <button
            className={`ai-toggle ${isAIOpen ? 'active' : ''}`}
            onClick={onToggleAI}
            title="AI Assistant"
          >
            <Bot size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}

function formatPeriod(periodId: string): string {
  const [year, month] = periodId.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}
