import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface SavedFilter {
  id: string;
  name: string;
  settingFilter: 'all' | 'SNF' | 'ALF' | 'ILF';
  stateFilter: string;
  searchQuery: string;
  createdAt: number;
}

interface SavedFiltersContextType {
  savedFilters: SavedFilter[];
  saveFilter: (filter: Omit<SavedFilter, 'id' | 'createdAt'>) => void;
  deleteFilter: (id: string) => void;
  applyFilter: (id: string) => SavedFilter | undefined;
}

const SavedFiltersContext = createContext<SavedFiltersContextType | undefined>(undefined);

const STORAGE_KEY = 'snfpnl_saved_filters';

export function SavedFiltersProvider({ children }: { children: ReactNode }) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedFilters));
  }, [savedFilters]);

  const saveFilter = (filter: Omit<SavedFilter, 'id' | 'createdAt'>) => {
    const newFilter: SavedFilter = {
      ...filter,
      id: `filter-${Date.now()}`,
      createdAt: Date.now()
    };
    setSavedFilters(prev => [...prev, newFilter]);
  };

  const deleteFilter = (id: string) => {
    setSavedFilters(prev => prev.filter(f => f.id !== id));
  };

  const applyFilter = (id: string) => {
    return savedFilters.find(f => f.id === id);
  };

  return (
    <SavedFiltersContext.Provider value={{ savedFilters, saveFilter, deleteFilter, applyFilter }}>
      {children}
    </SavedFiltersContext.Provider>
  );
}

export function useSavedFilters() {
  const context = useContext(SavedFiltersContext);
  if (!context) {
    throw new Error('useSavedFilters must be used within a SavedFiltersProvider');
  }
  return context;
}
