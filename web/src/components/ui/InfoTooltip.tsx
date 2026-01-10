import { useState, useRef, useEffect } from 'react';
import { HelpCircle, Lightbulb, TrendingUp, AlertTriangle } from 'lucide-react';
import './InfoTooltip.css';

type TooltipType = 'info' | 'tip' | 'metric' | 'warning';

interface InfoTooltipProps {
  content: string;
  title?: string;
  type?: TooltipType;
  position?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
}

export function InfoTooltip({
  content,
  title,
  type = 'info',
  position = 'top',
  maxWidth = 280
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      let x = 0;
      let y = 0;

      switch (position) {
        case 'top':
          x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          y = triggerRect.top - tooltipRect.height - 8;
          break;
        case 'bottom':
          x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          y = triggerRect.bottom + 8;
          break;
        case 'left':
          x = triggerRect.left - tooltipRect.width - 8;
          y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          break;
        case 'right':
          x = triggerRect.right + 8;
          y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          break;
      }

      // Keep tooltip within viewport
      x = Math.max(8, Math.min(x, window.innerWidth - tooltipRect.width - 8));
      y = Math.max(8, Math.min(y, window.innerHeight - tooltipRect.height - 8));

      setTooltipPosition({ x, y });
    }
  }, [isVisible, position]);

  const Icon = type === 'tip' ? Lightbulb : type === 'metric' ? TrendingUp : type === 'warning' ? AlertTriangle : HelpCircle;

  return (
    <span className="info-tooltip-wrapper">
      <button
        ref={triggerRef}
        className={`info-tooltip-trigger info-tooltip-trigger--${type}`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="More information"
      >
        <Icon size={14} />
      </button>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`info-tooltip info-tooltip--${type} info-tooltip--${position}`}
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            maxWidth
          }}
          role="tooltip"
        >
          {title && <div className="info-tooltip-title">{title}</div>}
          <div className="info-tooltip-content">{content}</div>
        </div>
      )}
    </span>
  );
}

// Section header with built-in explainer
interface SectionExplainerProps {
  title: string;
  subtitle?: string;
  explanation: string;
  tips?: string[];
  reviewSuggestions?: string[];
}

export function SectionExplainer({
  title,
  subtitle,
  explanation,
  tips = [],
  reviewSuggestions = []
}: SectionExplainerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="section-explainer">
      <div className="section-explainer-header">
        <div className="section-explainer-titles">
          <h2>{title}</h2>
          {subtitle && <p className="text-muted">{subtitle}</p>}
        </div>
        <button
          className={`section-explainer-toggle ${isExpanded ? 'expanded' : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <HelpCircle size={18} />
          <span>How to use</span>
        </button>
      </div>

      {isExpanded && (
        <div className="section-explainer-content animate-fade-in">
          <div className="explainer-section">
            <p>{explanation}</p>
          </div>

          {tips.length > 0 && (
            <div className="explainer-section">
              <div className="explainer-label">
                <Lightbulb size={14} />
                <span>Tips</span>
              </div>
              <ul>
                {tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {reviewSuggestions.length > 0 && (
            <div className="explainer-section">
              <div className="explainer-label">
                <TrendingUp size={14} />
                <span>What to Review</span>
              </div>
              <ul>
                {reviewSuggestions.map((suggestion, i) => (
                  <li key={i}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Inline metric explainer for KPI values
interface MetricExplainerProps {
  label: string;
  value: string | number;
  explanation: string;
  benchmark?: string;
  trend?: 'up' | 'down' | 'stable';
  isGood?: boolean;
}

export function MetricExplainer({
  label,
  value,
  explanation,
  benchmark,
  trend,
  isGood
}: MetricExplainerProps) {
  return (
    <div className="metric-explainer">
      <div className="metric-explainer-header">
        <span className="metric-explainer-label">{label}</span>
        <InfoTooltip
          content={explanation}
          title={label}
          type="metric"
        />
      </div>
      <div className="metric-explainer-value">
        <span className={`value ${isGood !== undefined ? (isGood ? 'good' : 'poor') : ''}`}>
          {value}
        </span>
        {trend && (
          <span className={`trend trend--${trend} ${isGood !== undefined ? (isGood ? 'good' : 'poor') : ''}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      {benchmark && (
        <div className="metric-explainer-benchmark">
          Benchmark: {benchmark}
        </div>
      )}
    </div>
  );
}
