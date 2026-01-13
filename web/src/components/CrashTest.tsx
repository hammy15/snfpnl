import { useState } from 'react';

/**
 * Test component that crashes during render when triggered.
 * Used only for testing the ErrorBoundary.
 * Remove after testing or keep hidden in production.
 */
export function CrashTest() {
  const [shouldCrash, setShouldCrash] = useState(false);

  if (shouldCrash) {
    // This error is thrown during render, which ErrorBoundary can catch
    throw new Error('Test crash: Intentional error to verify ErrorBoundary works correctly');
  }

  // Only show in development or when URL has ?crash-test
  const showButton = window.location.search.includes('crash-test');

  if (!showButton) {
    return null;
  }

  return (
    <button
      onClick={() => setShouldCrash(true)}
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '24px',
        padding: '12px 20px',
        background: '#ef4444',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 600,
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
      }}
    >
      Test Crash
    </button>
  );
}
