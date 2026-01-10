import type { ReactNode } from 'react';
import './KPICard.css';

interface KPICardProps {
  title: string;
  value: number | null;
  icon?: ReactNode;
  format?: 'currency' | 'percentage' | 'number';
  variant?: 'default' | 'success' | 'warning' | 'danger';
  subtitle?: string;
}

export function KPICard({ title, value, icon, format = 'number', variant = 'default', subtitle }: KPICardProps) {
  const formattedValue = formatValue(value, format);

  return (
    <div className={`kpi-card ${variant !== 'default' ? `kpi-card--${variant}` : ''}`}>
      <div className="kpi-card-header">
        {icon && <div className="kpi-card-icon">{icon}</div>}
        <span className="kpi-card-title">{title}</span>
      </div>
      <div className="kpi-card-value">{formattedValue}</div>
      {subtitle && <div className="kpi-card-subtitle">{subtitle}</div>}
    </div>
  );
}

function formatValue(value: number | null, format: 'currency' | 'percentage' | 'number'): string {
  if (value === null || value === undefined) return '--';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
}
