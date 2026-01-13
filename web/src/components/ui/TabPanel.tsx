import type { ReactNode } from 'react';
import './TabPanel.css';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

interface TabPanelProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'primary' | 'secondary';
  children: ReactNode;
}

export function TabPanel({
  tabs,
  activeTab,
  onTabChange,
  variant = 'primary',
  children
}: TabPanelProps) {
  return (
    <div className="tab-panel-container">
      <nav className={`tab-panel-nav ${variant}`} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            className={`tab-panel-tab ${variant} ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon && <span className="tab-panel-icon">{tab.icon}</span>}
            <span className="tab-panel-label">{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="tab-panel-badge">{tab.badge}</span>
            )}
          </button>
        ))}
      </nav>
      <div
        className="tab-panel-content"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
      >
        {children}
      </div>
    </div>
  );
}
