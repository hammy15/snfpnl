import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface RecentFacility {
  facilityId: string;
  name: string;
  visitedAt: number;
}

interface RecentFacilitiesContextType {
  recentFacilities: RecentFacility[];
  addRecentFacility: (facilityId: string, name: string) => void;
  clearRecent: () => void;
}

const RecentFacilitiesContext = createContext<RecentFacilitiesContextType | undefined>(undefined);

const STORAGE_KEY = 'snfpnl_recent_facilities';
const MAX_RECENT = 5;

export function RecentFacilitiesProvider({ children }: { children: ReactNode }) {
  const [recentFacilities, setRecentFacilities] = useState<RecentFacility[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentFacilities));
  }, [recentFacilities]);

  const addRecentFacility = (facilityId: string, name: string) => {
    setRecentFacilities(prev => {
      // Remove if already exists
      const filtered = prev.filter(f => f.facilityId !== facilityId);
      // Add to front
      const updated = [
        { facilityId, name, visitedAt: Date.now() },
        ...filtered
      ].slice(0, MAX_RECENT);
      return updated;
    });
  };

  const clearRecent = () => {
    setRecentFacilities([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <RecentFacilitiesContext.Provider value={{ recentFacilities, addRecentFacility, clearRecent }}>
      {children}
    </RecentFacilitiesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRecentFacilities() {
  const context = useContext(RecentFacilitiesContext);
  if (!context) {
    throw new Error('useRecentFacilities must be used within a RecentFacilitiesProvider');
  }
  return context;
}
