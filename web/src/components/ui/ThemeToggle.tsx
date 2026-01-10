import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useState } from 'react';

interface ThemeToggleProps {
  variant?: 'icon' | 'button' | 'dropdown';
}

export function ThemeToggle({ variant = 'icon' }: ThemeToggleProps) {
  const { theme, toggleTheme, setTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleTheme}
        className="btn btn-secondary btn-icon"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          position: 'relative',
          overflow: 'hidden'
        }}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          transform: theme === 'dark' ? 'rotate(0deg)' : 'rotate(90deg)',
          opacity: theme === 'dark' ? 1 : 0
        }}>
          <Moon size={18} />
        </div>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          transform: theme === 'light' ? 'rotate(0deg)' : 'rotate(-90deg)',
          opacity: theme === 'light' ? 1 : 0
        }}>
          <Sun size={18} />
        </div>
      </button>
    );
  }

  if (variant === 'button') {
    return (
      <button
        onClick={toggleTheme}
        className="btn btn-secondary"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px'
        }}
      >
        {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
        {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
      </button>
    );
  }

  // Dropdown variant
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="btn btn-secondary"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px'
        }}
      >
        {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
        Theme
      </button>

      {showDropdown && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99
            }}
            onClick={() => setShowDropdown(false)}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '12px',
            padding: '8px',
            minWidth: '160px',
            zIndex: 100,
            boxShadow: '0 8px 32px var(--shadow-color)'
          }}>
            <button
              onClick={() => { setTheme('light'); setShowDropdown(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                background: theme === 'light' ? 'var(--hover-bg)' : 'none',
                border: 'none',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              <Sun size={16} />
              Light
              {theme === 'light' && (
                <span style={{
                  marginLeft: 'auto',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--primary)'
                }} />
              )}
            </button>

            <button
              onClick={() => { setTheme('dark'); setShowDropdown(false); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                background: theme === 'dark' ? 'var(--hover-bg)' : 'none',
                border: 'none',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              <Moon size={16} />
              Dark
              {theme === 'dark' && (
                <span style={{
                  marginLeft: 'auto',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--primary)'
                }} />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Animated toggle switch version
export function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      style={{
        width: '64px',
        height: '32px',
        borderRadius: '16px',
        background: theme === 'dark'
          ? 'linear-gradient(135deg, #1a1a2e, #252542)'
          : 'linear-gradient(135deg, #87ceeb, #ffd700)',
        border: '2px solid',
        borderColor: theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        overflow: 'hidden'
      }}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {/* Stars (visible in dark mode) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: theme === 'dark' ? 1 : 0,
        transition: 'opacity 0.3s ease'
      }}>
        <span style={{ position: 'absolute', top: '6px', left: '8px', width: '2px', height: '2px', borderRadius: '50%', background: '#fff' }} />
        <span style={{ position: 'absolute', top: '12px', left: '14px', width: '1.5px', height: '1.5px', borderRadius: '50%', background: '#fff' }} />
        <span style={{ position: 'absolute', top: '8px', left: '22px', width: '2px', height: '2px', borderRadius: '50%', background: '#fff' }} />
        <span style={{ position: 'absolute', top: '18px', left: '10px', width: '1.5px', height: '1.5px', borderRadius: '50%', background: '#fff' }} />
      </div>

      {/* Clouds (visible in light mode) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: theme === 'light' ? 1 : 0,
        transition: 'opacity 0.3s ease'
      }}>
        <span style={{
          position: 'absolute',
          bottom: '8px',
          right: '6px',
          width: '12px',
          height: '6px',
          borderRadius: '6px',
          background: 'rgba(255,255,255,0.8)'
        }} />
        <span style={{
          position: 'absolute',
          bottom: '10px',
          right: '12px',
          width: '8px',
          height: '4px',
          borderRadius: '4px',
          background: 'rgba(255,255,255,0.6)'
        }} />
      </div>

      {/* Toggle knob */}
      <div style={{
        position: 'absolute',
        top: '2px',
        left: theme === 'dark' ? '2px' : '32px',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: theme === 'dark'
          ? 'linear-gradient(135deg, #c0c0c0, #f5f5f5)'
          : 'linear-gradient(135deg, #ffd700, #ff8c00)',
        transition: 'left 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        {theme === 'dark' ? (
          <Moon size={14} color="#1a1a2e" />
        ) : (
          <Sun size={14} color="#fff" />
        )}
      </div>
    </button>
  );
}
