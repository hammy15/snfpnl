import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first
    const saved = localStorage.getItem('theme') as Theme;
    if (saved) return saved;

    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update CSS variables based on theme
    const root = document.documentElement;

    if (theme === 'light') {
      root.style.setProperty('--bg-primary', '#f5f7fa');
      root.style.setProperty('--bg-secondary', '#ffffff');
      root.style.setProperty('--bg-tertiary', '#f0f2f5');
      root.style.setProperty('--text-primary', '#1a1a2e');
      root.style.setProperty('--text-secondary', '#4a4a6a');
      root.style.setProperty('--text-muted', '#7a7a9a');
      root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.1)');
      root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.9)');
      root.style.setProperty('--card-border', 'rgba(0, 0, 0, 0.08)');
      root.style.setProperty('--input-bg', 'rgba(0, 0, 0, 0.03)');
      root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.08)');
      root.style.setProperty('--hover-bg', 'rgba(0, 0, 0, 0.05)');
    } else {
      root.style.setProperty('--bg-primary', '#0f0f1a');
      root.style.setProperty('--bg-secondary', '#1a1a2e');
      root.style.setProperty('--bg-tertiary', '#252542');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#b4b4c8');
      root.style.setProperty('--text-muted', '#6b6b8a');
      root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--card-bg', 'rgba(30, 30, 50, 0.8)');
      root.style.setProperty('--card-border', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--input-bg', 'rgba(255, 255, 255, 0.05)');
      root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.3)');
      root.style.setProperty('--hover-bg', 'rgba(255, 255, 255, 0.05)');
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
