import { useState, useRef } from 'react';
import { Info } from 'lucide-react';
import './Tooltip.css';

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="tooltip-wrapper"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children || <Info size={14} className="tooltip-icon" />}
      {isVisible && (
        <div ref={tooltipRef} className={`tooltip-content tooltip-${position}`}>
          {content}
        </div>
      )}
    </div>
  );
}

// KPI descriptions for tooltips
// eslint-disable-next-line react-refresh/only-export-components
export const KPI_TOOLTIPS: Record<string, string> = {
  'snf_occupancy_pct': 'Percentage of available beds that are occupied. Higher is generally better for revenue.',
  'snf_skilled_mix_pct': 'Percentage of patients covered by Medicare or managed care vs Medicaid. Higher skilled mix = higher reimbursement.',
  'snf_operating_margin_pct': 'Revenue minus expenses as a percentage of revenue. Shows overall profitability.',
  'snf_total_revenue_ppd': 'Total revenue divided by patient days. Key metric for revenue efficiency.',
  'snf_nursing_hppd': 'Nursing hours per patient day. Higher can mean better care but also higher costs.',
  'snf_nursing_cost_ppd': 'Nursing labor cost per patient day. Major cost driver to monitor.',
  'snf_contract_labor_pct_nursing': 'Percentage of nursing hours from agency/contract staff. High % usually means higher costs.',
  'snf_therapy_cost_psd': 'Therapy cost per skilled day. Important for skilled margin management.',
  'snf_skilled_margin_pct': 'Profit margin on Medicare/skilled patients. Usually higher than overall margin.',
  'snf_medicaid_rate': 'Daily rate paid by Medicaid. Often the lowest payer rate.',
  'snf_medicare_rate': 'Daily rate paid by Medicare. Usually the highest payer rate.',
  'snf_ancillary_ppd': 'Revenue from ancillary services (pharmacy, supplies) per patient day.',
  'snf_food_cost_ppd': 'Food and dietary cost per patient day.',
  'snf_housekeeping_cost_ppd': 'Housekeeping and laundry cost per patient day.',
  'snf_admin_cost_ppd': 'Administrative overhead cost per patient day.',
  'snf_total_cost_ppd': 'Total cost per patient day including all departments.',
};
