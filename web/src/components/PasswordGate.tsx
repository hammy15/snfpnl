import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import './PasswordGate.css';

interface PasswordGateProps {
  children: React.ReactNode;
}

// Simple hash function for client-side password check
function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Password hash - change this to set a new password
// Current password: "snfpnl2025"
const PASSWORD_HASH = '-1vq6ksq';

export function PasswordGate({ children }: PasswordGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if already authenticated
    const auth = localStorage.getItem('snfpnl_auth');
    if (auth === PASSWORD_HASH) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const hashedInput = hashPassword(password);

    if (hashedInput === PASSWORD_HASH) {
      localStorage.setItem('snfpnl_auth', PASSWORD_HASH);
      setIsAuthenticated(true);
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('snfpnl_auth');
    setIsAuthenticated(false);
    setPassword('');
  };

  // Expose logout function globally for use in header
  useEffect(() => {
    (window as any).snfpnlLogout = handleLogout;
    return () => {
      delete (window as any).snfpnlLogout;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="password-gate">
        <div className="password-gate-card">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

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
