import { TrendingUp, TrendingDown } from 'lucide-react';
import { InfoTooltip } from '../../ui/InfoTooltip';
import { PortfolioT12M } from '../../performance/PortfolioT12M';

interface Performer {
  facility_id: string;
  name: string;
  kpi_id: string;
  value: number;
  setting: string;
  net_income: number;
  net_income_pct: number;
}

interface DashboardAnalyticsTabProps {
  periodId: string;
  filteredTopPerformers: Performer[];
  filteredBottomPerformers: Performer[];
  totalCount: number;
  oneThirdCount: number;
  onFacilitySelect: (facilityId: string) => void;
}

export function DashboardAnalyticsTab({
  periodId,
  filteredTopPerformers,
  filteredBottomPerformers,
  totalCount,
  oneThirdCount,
  onFacilitySelect,
}: DashboardAnalyticsTabProps) {
  return (
    <>
      {/* Performance Tables */}
      <div className="grid grid-cols-2 mb-6">
        {/* Top Performers */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <TrendingUp size={18} className="text-success" />
              Top Performers
              <InfoTooltip
                content="The top third of facilities ranked by EBITDAR margin. These are your strongest performers - study their practices for best practice sharing opportunities."
                type="tip"
              />
              <span className="header-count">({filteredTopPerformers.length} of {totalCount})</span>
            </h3>
          </div>
          <div className="table-container scrollable">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Facility</th>
                  <th>Type</th>
                  <th>EBITDAR %</th>
                  <th>Net Income</th>
                  <th>Net %</th>
                </tr>
              </thead>
              <tbody>
                {filteredTopPerformers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>
                      No data for selected filter
                    </td>
                  </tr>
                ) : (
                  filteredTopPerformers.map((facility, index) => (
                    <tr
                      key={facility.facility_id}
                      onClick={() => onFacilitySelect(facility.facility_id)}
                      className="clickable-row"
                    >
                      <td className="text-muted">{index + 1}</td>
                      <td>{facility.name}</td>
                      <td>
                        <span className={`badge badge-${facility.setting.toLowerCase()}`}>
                          {facility.setting}
                        </span>
                      </td>
                      <td className="text-success font-semibold">
                        {facility.value.toFixed(1)}%
                      </td>
                      <td className={facility.net_income >= 0 ? 'text-success' : 'text-danger'}>
                        ${(facility.net_income / 1000).toFixed(0)}K
                      </td>
                      <td className={facility.net_income_pct >= 0 ? 'text-success' : 'text-danger'}>
                        {facility.net_income_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Performers */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <TrendingDown size={18} className="text-danger" />
              Needs Attention
              <InfoTooltip
                content="The bottom third of facilities by EBITDAR margin. Prioritize operational reviews for any with negative margins. Click a row to see detailed breakdown and identify improvement opportunities."
                type="warning"
              />
              <span className="header-count">({filteredBottomPerformers.length} of {totalCount})</span>
            </h3>
          </div>
          <div className="table-container scrollable">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Facility</th>
                  <th>Type</th>
                  <th>EBITDAR %</th>
                  <th>Net Income</th>
                  <th>Net %</th>
                </tr>
              </thead>
              <tbody>
                {filteredBottomPerformers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>
                      No data for selected filter
                    </td>
                  </tr>
                ) : (
                  filteredBottomPerformers.map((facility, index) => (
                    <tr
                      key={facility.facility_id}
                      onClick={() => onFacilitySelect(facility.facility_id)}
                      className="clickable-row"
                    >
                      <td className="text-muted">{totalCount - oneThirdCount + index + 1}</td>
                      <td>{facility.name}</td>
                      <td>
                        <span className={`badge badge-${facility.setting.toLowerCase()}`}>
                          {facility.setting}
                        </span>
                      </td>
                      <td className={facility.value < 0 ? 'text-danger font-semibold' : 'text-warning font-semibold'}>
                        {facility.value.toFixed(1)}%
                      </td>
                      <td className={facility.net_income >= 0 ? 'text-success' : 'text-danger'}>
                        ${(facility.net_income / 1000).toFixed(0)}K
                      </td>
                      <td className={facility.net_income_pct >= 0 ? 'text-success' : 'text-danger'}>
                        {facility.net_income_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Portfolio T12M Performance */}
      <PortfolioT12M
        periodId={periodId}
        onFacilitySelect={onFacilitySelect}
      />
    </>
  );
}
