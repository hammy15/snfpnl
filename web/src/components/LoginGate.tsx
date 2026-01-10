import { useState, useEffect } from 'react';
import './LoginGate.css';

interface LoginGateProps {
  children: React.ReactNode;
}

const CORRECT_PASSWORD = 'jockibox26';
const AUTH_KEY = 'snfpnl_auth';

export function LoginGate({ children }: LoginGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if already authenticated
    const auth = localStorage.getItem(AUTH_KEY);
    if (auth) {
      try {
        const { timestamp } = JSON.parse(auth);
        // Session valid for 24 hours
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem(AUTH_KEY);
        }
      } catch {
        localStorage.removeItem(AUTH_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (password !== CORRECT_PASSWORD) {
      setError('Incorrect password');
      return;
    }

    // Log access to backend
    try {
      await fetch('https://snfpnl.onrender.com/api/access-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      // Don't block login if logging fails
      console.error('Failed to log access:', err);
    }

    // Store auth in localStorage
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      name: name.trim(),
      timestamp: Date.now()
    }));

    setIsAuthenticated(true);
  };

  if (isLoading) {
    return (
      <div className="login-gate">
        <div className="login-loading">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="login-gate">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M10 21V7l2-2 2 2v14" />
            </svg>
          </div>
          <h1>SNFPNL</h1>
          <p>SNF Financial Intelligence</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="name">Your Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              autoFocus
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-button">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
