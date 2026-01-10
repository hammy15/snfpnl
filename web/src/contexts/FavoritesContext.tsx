import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface FavoritesContextType {
  favorites: string[];
  toggleFavorite: (facilityId: string) => void;
  isFavorite: (facilityId: string) => boolean;
  addFavorite: (facilityId: string) => void;
  removeFavorite: (facilityId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const STORAGE_KEY = 'cascadia_favorites';

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (facilityId: string) => {
    setFavorites(prev =>
      prev.includes(facilityId)
        ? prev.filter(id => id !== facilityId)
        : [...prev, facilityId]
    );
  };

  const isFavorite = (facilityId: string) => favorites.includes(facilityId);

  const addFavorite = (facilityId: string) => {
    if (!favorites.includes(facilityId)) {
      setFavorites(prev => [...prev, facilityId]);
    }
  };

  const removeFavorite = (facilityId: string) => {
    setFavorites(prev => prev.filter(id => id !== facilityId));
  };

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite, addFavorite, removeFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
