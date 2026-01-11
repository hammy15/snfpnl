import { useState, useEffect, useCallback } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import './PasswordGate.css';

interface PasswordGateProps {
  children: React.ReactNode;
}

// Password for access - change this to set a new password
const APP_PASSWORD = 'snfpnl2025';
const AUTH_KEY = 'snfpnl_authenticated';

// Extend window type for logout function
declare global {
  interface Window {
    snfpnlLogout?: () => void;
  }
}

// Check auth status synchronously during initialization
function getInitialAuthState(): boolean {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

export function PasswordGate({ children }: PasswordGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(getInitialAuthState);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password === APP_PASSWORD) {
      localStorage.setItem(AUTH_KEY, 'true');
      setIsAuthenticated(true);
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
    setPassword('');
  }, []);

  // Expose logout function globally for use in header
  useEffect(() => {
    window.snfpnlLogout = handleLogout;
    return () => {
      delete window.snfpnlLogout;
    };
  }, [handleLogout]);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="password-gate">
      <div className="password-gate-card">
        <div className="password-gate-logo">
          <div className="logo-icon">
            <Lock size={32} />
          </div>
          <h1>SNFPNL</h1>
          <p>SNF Financial Intelligence</p>
        </div>

        <form onSubmit={handleSubmit} className="password-form">
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              className={error ? 'error' : ''}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <div className="password-error">{error}</div>}

          <button type="submit" className="login-button">
            Sign In
          </button>
        </form>

        <div className="password-gate-footer">
          <p>Contact your administrator for access</p>
        </div>
      </div>
    </div>
  );
}
