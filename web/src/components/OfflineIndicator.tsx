/**
 * Offline indicator component - shows when the user is offline
 */

import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import './OfflineIndicator.css';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Show "back online" message briefly
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div className={`offline-indicator ${isOnline ? 'online' : 'offline'}`}>
      <div className="offline-indicator__content">
        {isOnline ? (
          <>
            <RefreshCw size={18} className="offline-indicator__icon" />
            <span>Back online</span>
          </>
        ) : (
          <>
            <WifiOff size={18} className="offline-indicator__icon" />
            <span>You're offline. Some features may be limited.</span>
          </>
        )}
      </div>
      {!isOnline && (
        <button
          className="offline-indicator__dismiss"
          onClick={() => setShowBanner(false)}
          aria-label="Dismiss"
        >
          &times;
        </button>
      )}
    </div>
  );
}

/**
 * Hook to check online status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
