import './Logo.css';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'logo-sm',
    md: 'logo-md',
    lg: 'logo-lg'
  };

  return (
    <div className={`snfpnl-logo ${sizeClasses[size]}`}>
      <div className="logo-icon">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Building/facility icon with chart element */}
          <rect x="4" y="12" width="32" height="24" rx="2" fill="url(#logoGradient)" />
          <rect x="8" y="16" width="6" height="6" rx="1" fill="rgba(255,255,255,0.9)" />
          <rect x="17" y="16" width="6" height="6" rx="1" fill="rgba(255,255,255,0.9)" />
          <rect x="26" y="16" width="6" height="6" rx="1" fill="rgba(255,255,255,0.9)" />
          <rect x="8" y="26" width="6" height="8" rx="1" fill="rgba(255,255,255,0.9)" />
          <rect x="17" y="24" width="6" height="10" rx="1" fill="rgba(255,255,255,0.9)" />
          <rect x="26" y="22" width="6" height="12" rx="1" fill="rgba(255,255,255,0.9)" />
          {/* Roof/header */}
          <path d="M2 12L20 4L38 12" stroke="url(#logoGradient)" strokeWidth="3" strokeLinecap="round" />
          <defs>
            <linearGradient id="logoGradient" x1="0" y1="0" x2="40" y2="40">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {showText && (
        <div className="logo-text">
          <span className="logo-title">SNFPNL</span>
          <span className="logo-subtitle">Financial Intelligence</span>
        </div>
      )}
    </div>
  );
}
