import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, List, Map, Wrench, Bot, ClipboardCheck, DollarSign, FileText, GitCompare, Bell, BookOpen, Upload, Settings, HelpCircle } from 'lucide-react';
import { ThemeToggle } from './ui/ThemeToggle';
import { FacilitySearch } from './FacilitySearch';
import { MobileNav } from './MobileNav';
import { Logo } from './Logo';
import { ExcelExport } from './export/ExcelExport';
import { SyncButton } from './SyncButton';
import { formatPeriod } from '../utils/dateFormatters';
import './Header.css';

type View = 'dashboard' | 'facilities' | 'facility-detail' | 'tools' | 'map' | 'ppd' | 'verification' | 'executive' | 'comparison' | 'alerts' | 'directory' | 'upload' | 'manage';

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
  onShowGuide?: () => void;
}

async function fetchPeriods(): Promise<string[]> {
  const res = await fetch('https://snfpnl.onrender.com/api/periods');
  if (!res.ok) throw new Error('Failed to fetch periods');
  return res.json();
}

export function Header({ currentView, onNavigate, selectedPeriod, onPeriodChange, onToggleAI, isAIOpen, facilities, onFacilitySelect, onShowGuide }: HeaderProps) {
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

        <nav className="header-nav" role="tablist" aria-label="Main navigation">
          <button
            role="tab"
            aria-selected={currentView === 'dashboard'}
            className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNavigate('dashboard')}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button
            role="tab"
            aria-selected={currentView === 'facilities'}
            className={`nav-btn ${currentView === 'facilities' ? 'active' : ''}`}
            onClick={() => onNavigate('facilities')}
          >
            <List size={18} />
            Facilities
          </button>
          <button
            role="tab"
            aria-selected={currentView === 'map'}
            className={`nav-btn ${currentView === 'map' ? 'active' : ''}`}
            onClick={() => onNavigate('map')}
          >
            <Map size={18} />
            Heat Map
          </button>
          <button
            role="tab"
            aria-selected={currentView === 'tools'}
            className={`nav-btn ${currentView === 'tools' ? 'active' : ''}`}
            onClick={() => onNavigate('tools')}
          >
            <Wrench size={18} />
            Tools
          </button>
          <button
            role="tab"
            aria-selected={currentView === 'ppd'}
            className={`nav-btn ${currentView === 'ppd' ? 'active' : ''}`}
            onClick={() => onNavigate('ppd')}
          >
            <DollarSign size={18} />
            PPD
          </button>
          <button
            role="tab"
            aria-selected={currentView === 'verification'}
            className={`nav-btn ${currentView === 'verification' ? 'active' : ''}`}
            onClick={() => onNavigate('verification')}
          >
            <ClipboardCheck size={18} />
            Verify
          </button>
          <button
            role="tab"
            aria-selected={currentView === 'executive'}
            className={`nav-btn ${currentView === 'executive' ? 'active' : ''}`}
            onClick={() => onNavigate('executive')}
          >
            <FileText size={18} />
            Summary
          </button>
          <button
            role="tab"
            aria-selected={currentView === 'comparison'}
            className={`nav-btn ${currentView === 'comparison' ? 'active' : ''}`}
            onClick={() => onNavigate('comparison')}
          >
            <GitCompare size={18} />
            Compare
          </button>
          <button
            role="tab"
            aria-selected={currentView === 'alerts'}
            className={`nav-btn ${currentView === 'alerts' ? 'active' : ''}`}
            onClick={() => onNavigate('alerts')}
          >
            <Bell size={18} />
            Alerts
          </button>
          <button
            role="tab"
            aria-selected={currentView === 'directory'}
            className={`nav-btn ${currentView === 'directory' ? 'active' : ''}`}
            onClick={() => onNavigate('directory')}
          >
            <BookOpen size={18} />
            Directory
          </button>
          <button
            role="tab"
            aria-selected={currentView === 'upload'}
            className={`nav-btn ${currentView === 'upload' ? 'active' : ''}`}
            onClick={() => onNavigate('upload')}
          >
            <Upload size={18} />
            Upload
          </button>
          <button
            role="tab"
            aria-selected={currentView === 'manage'}
            className={`nav-btn ${currentView === 'manage' ? 'active' : ''}`}
            onClick={() => onNavigate('manage')}
          >
            <Settings size={18} />
            Manage
          </button>
        </nav>

        <div className="header-right">
          <select
            id="period-selector"
            value={selectedPeriod}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="period-select"
            aria-label="Select reporting period"
          >
            {periods.map((period) => (
              <option key={period} value={period}>
                {formatPeriod(period)}
              </option>
            ))}
          </select>
          <SyncButton />
          <ExcelExport periodId={selectedPeriod} />
          <button
            className="help-btn"
            onClick={onShowGuide}
            title="User Guide"
          >
            <HelpCircle size={20} />
          </button>
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
