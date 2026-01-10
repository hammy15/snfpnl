import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { FacilityList } from './components/FacilityList';
import { FacilityDetail } from './components/FacilityDetail';
import { HeatMap } from './components/HeatMap';
import { Tools } from './components/Tools';
import { PPDRanking } from './components/PPDRanking';
import { Verification } from './components/Verification';
import { ExecutiveSummary } from './components/ExecutiveSummary';
import { PeriodComparison } from './components/PeriodComparison';
import { AlertsDashboard } from './components/AlertsDashboard';
import { FacilityDirectory } from './components/FacilityDirectory';
import { AIAssistant } from './components/AIAssistant';
import { LoginGate } from './components/LoginGate';
import { DataUpload } from './components/DataUpload';
import { FacilityManagement } from './components/FacilityManagement';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

type View = 'dashboard' | 'facilities' | 'facility-detail' | 'tools' | 'map' | 'ppd' | 'verification' | 'executive' | 'comparison' | 'alerts' | 'directory' | 'upload' | 'manage';
type SettingFilter = 'all' | 'SNF' | 'ALF' | 'ILF';

interface Facility {
  facility_id: string;
  name: string;
  state: string;
  setting: string;
}

async function fetchFacilities(): Promise<Facility[]> {
  const res = await fetch('https://snfpnl.onrender.com/api/facilities');
  if (!res.ok) throw new Error('Failed to fetch facilities');
  return res.json();
}

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2025-11');
  const [settingFilter, setSettingFilter] = useState<SettingFilter>('all');
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const { toggleTheme } = useTheme();

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: fetchFacilities,
  });

  // Enable keyboard shortcuts
  useKeyboardShortcuts({
    onNavigate: setCurrentView,
    onToggleAI: () => setIsAIOpen(!isAIOpen),
    onToggleTheme: toggleTheme,
    onShowHelp: () => setIsShortcutsOpen(true),
  });

  const handleFacilitySelect = (facilityId: string) => {
    setSelectedFacilityId(facilityId);
    setCurrentView('facility-detail');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedFacilityId(null);
  };

  return (
    <div className="app">
      <Header
        currentView={currentView}
        onNavigate={setCurrentView}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        onToggleAI={() => setIsAIOpen(!isAIOpen)}
        isAIOpen={isAIOpen}
        facilities={facilities}
        onFacilitySelect={handleFacilitySelect}
      />
      <main className="main-content">
        {currentView === 'dashboard' && (
          <Dashboard
            periodId={selectedPeriod}
            settingFilter={settingFilter}
            onSettingFilterChange={setSettingFilter}
            onFacilitySelect={handleFacilitySelect}
          />
        )}
        {currentView === 'facilities' && (
          <FacilityList
            onFacilitySelect={handleFacilitySelect}
            settingFilter={settingFilter}
            onSettingFilterChange={setSettingFilter}
          />
        )}
        {currentView === 'facility-detail' && selectedFacilityId && (
          <FacilityDetail
            facilityId={selectedFacilityId}
            periodId={selectedPeriod}
            onBack={handleBackToDashboard}
          />
        )}
        {currentView === 'map' && (
          <HeatMap
            periodId={selectedPeriod}
            settingFilter={settingFilter}
            onFacilitySelect={handleFacilitySelect}
          />
        )}
        {currentView === 'tools' && (
          <Tools
            periodId={selectedPeriod}
            settingFilter={settingFilter}
          />
        )}
        {currentView === 'ppd' && (
          <PPDRanking
            periodId={selectedPeriod}
            onFacilitySelect={handleFacilitySelect}
          />
        )}
        {currentView === 'verification' && (
          <Verification />
        )}
        {currentView === 'executive' && (
          <ExecutiveSummary
            periodId={selectedPeriod}
            onFacilitySelect={handleFacilitySelect}
          />
        )}
        {currentView === 'comparison' && (
          <PeriodComparison
            currentPeriod={selectedPeriod}
            onFacilitySelect={handleFacilitySelect}
          />
        )}
        {currentView === 'alerts' && (
          <AlertsDashboard
            periodId={selectedPeriod}
            onFacilitySelect={handleFacilitySelect}
          />
        )}
        {currentView === 'directory' && (
          <FacilityDirectory
            onFacilitySelect={handleFacilitySelect}
          />
        )}
        {currentView === 'upload' && (
          <DataUpload />
        )}
        {currentView === 'manage' && (
          <FacilityManagement />
        )}
      </main>
      <AIAssistant
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        periodId={selectedPeriod}
        selectedFacility={selectedFacilityId}
        facilities={facilities}
      />
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <FavoritesProvider>
          <LoginGate>
            <AppContent />
          </LoginGate>
        </FavoritesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
