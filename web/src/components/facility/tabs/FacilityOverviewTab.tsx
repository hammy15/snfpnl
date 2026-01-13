import { CMSStarRatings } from '../../CMSStarRatings';

interface Facility {
  facility_id: string;
  name: string;
  setting: string;
  cms_overall_rating: number | null;
  cms_health_inspection_rating: number | null;
  cms_staffing_rating: number | null;
  cms_quality_rating: number | null;
  cms_last_updated: string | null;
}

interface Financials {
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  net_income_pct: number;
}

interface FacilityOverviewTabProps {
  facility: Facility;
  financials: Financials | null;
}

export function FacilityOverviewTab({ facility, financials }: FacilityOverviewTabProps) {
  return (
    <>
      {/* Net Income Summary */}
      {financials && (
        <div className="net-income-summary">
          <div className="net-income-card">
            <div className="net-income-item">
              <span className="net-income-label">Total Revenue</span>
              <span className="net-income-value">
                ${financials.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="net-income-item">
              <span className="net-income-label">Total Expenses</span>
              <span className="net-income-value">
                ${financials.total_expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="net-income-item highlight">
              <span className="net-income-label">Net Income</span>
              <span className={`net-income-value ${financials.net_income >= 0 ? 'positive' : 'negative'}`}>
                ${financials.net_income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="net-income-item">
              <span className="net-income-label">Net Income %</span>
              <span className={`net-income-value ${financials.net_income_pct >= 0 ? 'positive' : 'negative'}`}>
                {financials.net_income_pct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CMS Star Ratings - SNF Only */}
      {facility.setting === 'SNF' && facility.cms_overall_rating && (
        <CMSStarRatings
          overallRating={facility.cms_overall_rating}
          healthInspectionRating={facility.cms_health_inspection_rating}
          staffingRating={facility.cms_staffing_rating}
          qualityRating={facility.cms_quality_rating}
          lastUpdated={facility.cms_last_updated}
          facilityName={facility.name}
        />
      )}
    </>
  );
}
