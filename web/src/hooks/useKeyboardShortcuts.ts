import { useEffect, useCallback } from 'react';

type View = 'dashboard' | 'facilities' | 'facility-detail' | 'tools' | 'map' | 'ppd' | 'verification' | 'executive' | 'comparison' | 'alerts';

interface UseKeyboardShortcutsProps {
  onNavigate: (view: View) => void;
  onToggleAI: () => void;
  onToggleTheme?: () => void;
}

export function useKeyboardShortcuts({
  onNavigate,
  onToggleAI,
  onToggleTheme,
}: UseKeyboardShortcutsProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }

    // Modifier + key shortcuts
    if (e.metaKey || e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'k':
          // Handled by FacilitySearch component
          return;
        case 'd':
          e.preventDefault();
          onNavigate('dashboard');
          break;
        case 'f':
          e.preventDefault();
          onNavigate('facilities');
          break;
        case 'm':
          e.preventDefault();
          onNavigate('map');
          break;
        case 'e':
          e.preventDefault();
          onNavigate('executive');
          break;
        case 'j':
          e.preventDefault();
          onToggleAI();
          break;
      }
      return;
    }

    // Single key shortcuts (when holding Alt/Option)
    if (e.altKey) {
      switch (e.key) {
        case '1':
          e.preventDefault();
          onNavigate('dashboard');
          break;
        case '2':
          e.preventDefault();
          onNavigate('facilities');
          break;
        case '3':
          e.preventDefault();
          onNavigate('map');
          break;
        case '4':
          e.preventDefault();
          onNavigate('tools');
          break;
        case '5':
          e.preventDefault();
          onNavigate('ppd');
          break;
        case '6':
          e.preventDefault();
          onNavigate('verification');
          break;
        case '7':
          e.preventDefault();
          onNavigate('executive');
          break;
        case '8':
          e.preventDefault();
          onNavigate('comparison');
          break;
        case '9':
          e.preventDefault();
          onNavigate('alerts');
          break;
        case 't':
          e.preventDefault();
          onToggleTheme?.();
          break;
        case 'a':
          e.preventDefault();
          onToggleAI();
          break;
      }
    }

    // Question mark for help
    if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      showShortcutsHelp();
    }
  }, [onNavigate, onToggleAI, onToggleTheme]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

function showShortcutsHelp() {
  // This could be replaced with a modal in the future
  const shortcuts = `
Keyboard Shortcuts:

Navigation (Alt + number):
  Alt+1  Dashboard
  Alt+2  Facilities
  Alt+3  Map
  Alt+4  Tools
  Alt+5  PPD
  Alt+6  Verification
  Alt+7  Summary
  Alt+8  Compare
  Alt+9  Alerts

Quick Actions:
  Cmd/Ctrl+K  Search facilities
  Cmd/Ctrl+D  Dashboard
  Cmd/Ctrl+F  Facilities
  Cmd/Ctrl+M  Map
  Cmd/Ctrl+E  Executive Summary
  Cmd/Ctrl+J  Toggle AI Assistant
  Alt+T       Toggle theme
  Alt+A       Toggle AI Assistant
  ?           Show this help
  `;
  console.log(shortcuts);
}

export const SHORTCUTS_HELP = [
  { category: 'Navigation', shortcuts: [
    { keys: ['Alt', '1'], description: 'Dashboard' },
    { keys: ['Alt', '2'], description: 'Facilities' },
    { keys: ['Alt', '3'], description: 'Map' },
    { keys: ['Alt', '4'], description: 'Tools' },
    { keys: ['Alt', '5'], description: 'PPD' },
    { keys: ['Alt', '6'], description: 'Verification' },
    { keys: ['Alt', '7'], description: 'Summary' },
    { keys: ['Alt', '8'], description: 'Compare' },
    { keys: ['Alt', '9'], description: 'Alerts' },
  ]},
  { category: 'Quick Actions', shortcuts: [
    { keys: ['⌘', 'K'], description: 'Search facilities' },
    { keys: ['⌘', 'D'], description: 'Dashboard' },
    { keys: ['⌘', 'J'], description: 'Toggle AI' },
    { keys: ['Alt', 'T'], description: 'Toggle theme' },
    { keys: ['?'], description: 'Show shortcuts' },
  ]},
];
