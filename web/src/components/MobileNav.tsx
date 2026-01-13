import { useState } from 'react';
import {
  Menu, X, LayoutDashboard, List, Map, Wrench, DollarSign,
  ClipboardCheck, FileText, GitCompare, Bell, Building2, BookOpen, Upload, Settings
} from 'lucide-react';
import './MobileNav.css';

type View = 'dashboard' | 'facilities' | 'facility-detail' | 'tools' | 'map' | 'ppd' | 'verification' | 'executive' | 'comparison' | 'alerts' | 'directory' | 'upload' | 'manage';

interface MobileNavProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const NAV_ITEMS: { view: View; icon: typeof LayoutDashboard; label: string }[] = [
  { view: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { view: 'facilities', icon: List, label: 'Facilities' },
  { view: 'map', icon: Map, label: 'Map' },
  { view: 'tools', icon: Wrench, label: 'Tools' },
  { view: 'ppd', icon: DollarSign, label: 'PPD' },
  { view: 'verification', icon: ClipboardCheck, label: 'Verify' },
  { view: 'executive', icon: FileText, label: 'Summary' },
  { view: 'comparison', icon: GitCompare, label: 'Compare' },
  { view: 'alerts', icon: Bell, label: 'Alerts' },
  { view: 'directory', icon: BookOpen, label: 'Directory' },
  { view: 'upload', icon: Upload, label: 'Upload Data' },
  { view: 'manage', icon: Settings, label: 'Manage Facilities' },
];

export function MobileNav({ currentView, onNavigate }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = (view: View) => {
    onNavigate(view);
    setIsOpen(false);
  };

  return (
    <>
      <button
        className="mobile-menu-btn"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation"
      >
        <Menu size={24} />
      </button>

      {isOpen && (
        <>
          <div className="mobile-nav-overlay" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <nav className="mobile-nav" id="mobile-navigation" aria-label="Main navigation">
            <div className="mobile-nav-header">
              <div className="mobile-nav-brand">
                <Building2 size={20} />
                <span>SNFPNL</span>
              </div>
              <button
                className="mobile-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mobile-nav-items" role="menu">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.view}
                  role="menuitem"
                  className={`mobile-nav-item ${currentView === item.view ? 'active' : ''}`}
                  onClick={() => handleNavigate(item.view)}
                  aria-current={currentView === item.view ? 'page' : undefined}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="mobile-nav-footer">
              <span className="keyboard-hint">Press ? for keyboard shortcuts</span>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
