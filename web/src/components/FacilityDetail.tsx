import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { ArrowLeft, Building2, MapPin, TrendingUp, DollarSign, Users, Percent, Activity, AlertTriangle, FileText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { KPICard } from './KPICard';
import { T12MAnalysis } from './performance/T12MAnalysis';
import { CorrelationPanel } from './correlation/CorrelationPanel';
import { ExecutiveSummary } from './executive/ExecutiveSummary';
import { ThresholdAlerts } from './alerts/ThresholdAlerts';
import { PeerComparison } from './comparison/PeerComparison';
import { GoalTracking } from './goals/GoalTracking';
import { PDFExport } from './export/PDFExport';
import { InfoTooltip } from './ui/InfoTooltip';
import { NarrativeReport, FinancialPacketGenerator } from './NarrativeReport';
import { CMSStarRatings } from './CMSStarRatings';
import './FacilityDetail.css';

interface FacilityDetailProps {
  facilityId: string;
  periodId: string;
  onBack: () => void;
}

interface Facility {
  facility_id: string;
  name: string;
  short_name: string;
  state: string;
  setting: string;
  licensed_beds: number | null;
  operational_beds: number | null;
  parent_opco: string | null;
  therapy_delivery_model: string | null;
  cms_overall_rating: number | null;
  cms_health_inspection_rating: number | null;
  cms_staffing_rating: number | null;
  cms_quality_rating: number | null;
  cms_last_updated: string | null;
}

interface KPIResult {
  kpi_id: string;
  value: number | null;
  numerator_value: number;
  denominator_value: number;
  denominator_type: string;
  payer_scope: string;
  unit: string;
  warnings: string;
}

interface Anomaly {
  type: string;
  severity: string;
  message: string;
  field: string;
  expected: string;
  actual: string;
}

interface TrendData {
  period_id: string;
  value: number;
}

async function fetchFacility(id: string): Promise<Facility> {
  const res = await fetch(`https://snfpnl-production.up.railway.app/api/facilities/${id}`);
  if (!res.ok) throw new Error('Failed to fetch facility');
  return res.json();
}

async function fetchKPIs(facilityId: string, periodId: string): Promise<KPIResult[]> {
  const res = await fetch(`https://snfpnl-production.up.railway.app/api/kpis/${facilityId}/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch KPIs');
  return res.json();
}

async function fetchAnomalies(facilityId: string, periodId: string): Promise<Anomaly[]> {
  const res = await fetch(`https://snfpnl-production.up.railway.app/api/anomalies/${facilityId}/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch anomalies');
  return res.json();
}

async function fetchTrends(facilityId: string, kpiId: string): Promise<TrendData[]> {
  const res = await fetch(`https://snfpnl-production.up.railway.app/api/trends/${facilityId}/${kpiId}`);
  if (!res.ok) throw new Error('Failed to fetch trends');
  return res.json();
}

interface FacilityFinancials {
  facility_id: string;
  name: string;
  setting: string;
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  net_income_pct: number;
}

async function fetchFacilityFinancials(facilityId: string, periodId: string): Promise<FacilityFinancials | null> {
  const res = await fetch(`https://snfpnl-production.up.railway.app/api/financials/summary/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch financials');
  const data = await res.json();
  return data.facilities?.find((f: FacilityFinancials) => f.facility_id === facilityId) || null;
}

// Determine which margin KPI to use based on setting
function getMarginKpiId(setting: string): string {
  return setting === 'SNF' ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct';
}

export function FacilityDetail({ facilityId, periodId, onBack }: FacilityDetailProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const packetRef = useRef<HTMLDivElement>(null);

  const scrollToPacket = () => {
    packetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const { data: facility, isLoading: facilityLoading } = useQuery({
    queryKey: ['facility', facilityId],
    queryFn: () => fetchFacility(facilityId),
  });

  const { data: kpis = [], isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis', facilityId, periodId],
    queryFn: () => fetchKPIs(facilityId, periodId),
  });

  const { data: anomalies = [] } = useQuery({
    queryKey: ['anomalies', facilityId, periodId],
    queryFn: () => fetchAnomalies(facilityId, periodId),
  });

  const { data: financials } = useQuery({
    queryKey: ['facilityFinancials', facilityId, periodId],
    queryFn: () => fetchFacilityFinancials(facilityId, periodId),
  });

  // Use the correct margin KPI based on facility setting
  const marginKpiId = facility ? getMarginKpiId(facility.setting) : 'snf_operating_margin_pct';

  const { data: marginTrends = [] } = useQuery({
    queryKey: ['trends', facilityId, marginKpiId],
    queryFn: () => fetchTrends(facilityId, marginKpiId),
    enabled: !!facility,
  });

  if (facilityLoading || kpisLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!facility) {
    return <div className="error">Facility not found</div>;
  }

  const getKPI = (kpiId: string) => kpis.find(k => k.kpi_id === kpiId);
  const getKPIValue = (kpiId: string) => getKPI(kpiId)?.value ?? null;

  // Prepare payer mix data
  const payerMixData = [
    { name: 'Medicare A', value: getKPIValue('snf_medicare_a_mix_pct') || 0 },
    { name: 'MA/HMO', value: getKPIValue('snf_ma_mix_pct') || 0 },
    { name: 'Medicaid', value: 100 - (getKPIValue('snf_skilled_mix_pct') || 0) - (getKPIValue('snf_medicare_a_mix_pct') || 0) - (getKPIValue('snf_ma_mix_pct') || 0) },
  ].filter(d => d.value > 0);

  const PAYER_COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#ca8a04', '#dc2626'];

  return (
    <div className="facility-detail" ref={reportRef}>
      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      <div className="facility-header">
        <div className="facility-header-left">
          <div className="facility-icon-large">
            <Building2 size={32} />
          </div>
          <div>
            <h1>{facility.name}</h1>
            <div className="facility-meta">
              <span className="meta-item">
                <MapPin size={16} />
                {facility.state || 'Unknown'}
              </span>
              <span className="meta-item badge badge-info">{facility.setting}</span>
              {facility.licensed_beds && (
                <span className="meta-item">{facility.licensed_beds} beds</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="period-badge">{formatPeriod(periodId)}</div>
          <button className="generate-packet-quick-btn" onClick={scrollToPacket} title="Generate Financial Packet for this facility">
            <FileText size={18} />
            Generate Packet
          </button>
          <PDFExport
            facilityName={facility.name}
            periodId={periodId}
            targetRef={reportRef}
          />
        </div>
      </div>

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

      {/* Revenue & Margin KPIs - Setting-aware */}
      <section className="kpi-section">
        <h2 className="section-title">
          Revenue & Margins
          <InfoTooltip
            content="Revenue metrics show income per patient day (PPD) or skilled day (PSD). Operating Margin is your key profitability metric - aim for 8%+ for SNF, 12%+ for ALF/ILF. Compare against your portfolio average."
            type="metric"
          />
        </h2>
        {facility.setting === 'SNF' ? (
          <div className="grid grid-cols-4">
            <KPICard
              title="Total Revenue PPD"
              value={getKPIValue('snf_total_revenue_ppd')}
              icon={<DollarSign size={20} />}
              format="currency"
            />
            <KPICard
              title="Skilled Revenue PSD"
              value={getKPIValue('snf_skilled_revenue_psd')}
              icon={<DollarSign size={20} />}
              format="currency"
            />
            <KPICard
              title="Operating Margin"
              value={getKPIValue('snf_operating_margin_pct')}
              icon={<Percent size={20} />}
              format="percentage"
              variant={getMarginVariant(getKPIValue('snf_operating_margin_pct'))}
            />
            <KPICard
              title="Skilled Margin"
              value={getKPIValue('snf_skilled_margin_pct')}
              icon={<Percent size={20} />}
              format="percentage"
              variant={getMarginVariant(getKPIValue('snf_skilled_margin_pct'))}
            />
          </div>
        ) : (
          <div className="grid grid-cols-4">
            <KPICard
              title="RevPOR (Monthly)"
              value={getKPIValue('sl_revpor')}
              icon={<DollarSign size={20} />}
              format="currency"
            />
            <KPICard
              title="Revenue PPD"
              value={getKPIValue('sl_revenue_prd')}
              icon={<DollarSign size={20} />}
              format="currency"
            />
            <KPICard
              title="Operating Margin"
              value={getKPIValue('sl_operating_margin_pct')}
              icon={<Percent size={20} />}
              format="percentage"
              variant={getMarginVariant(getKPIValue('sl_operating_margin_pct'))}
            />
            <KPICard
              title="Occupancy %"
              value={getKPIValue('sl_occupancy_pct')}
              icon={<Percent size={20} />}
              format="percentage"
              variant={getOccupancyVariant(getKPIValue('sl_occupancy_pct'))}
            />
          </div>
        )}
      </section>

      {/* Payer Mix KPIs - SNF only */}
      {facility.setting === 'SNF' && (
        <section className="kpi-section">
          <h2 className="section-title">
            Payer Mix (MCR vs MCD)
            <InfoTooltip
              content="Your patient mix between Medicare (MCR) and Medicaid (MCD) directly determines revenue. Medicare pays ~$600-800/day while Medicaid pays ~$200-300/day. Increasing skilled mix by even 5% can significantly impact your bottom line."
              type="tip"
            />
          </h2>

          {/* Medicare (Skilled) vs Medicaid Summary */}
          <div className="grid grid-cols-2 mb-4">
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--success)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Medicare (Skilled) Mix
                    <InfoTooltip
                      content="Medicare A + MA/HMO patients combined. These are your highest-paying patients - short-term rehab stays typically 20-100 days."
                      type="metric"
                    />
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success)' }}>
                    {getKPIValue('snf_skilled_mix_pct')?.toFixed(1) ?? '--'}%
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div>MCR-A: {getKPIValue('snf_medicare_a_mix_pct')?.toFixed(1) ?? '--'}%</div>
                  <div>MA/HMO: {getKPIValue('snf_ma_mix_pct')?.toFixed(1) ?? '--'}%</div>
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--warning)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Medicaid (Long-Term) Mix
                    <InfoTooltip
                      content="Long-term care patients paid by Medicaid. Lower reimbursement but provides census stability. Target: balance skilled volume with stable Medicaid base."
                      type="metric"
                    />
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--warning)' }}>
                    {getKPIValue('snf_medicaid_mix_pct')?.toFixed(1) ?? '--'}%
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div>Rev PPD: ${getKPIValue('snf_medicaid_revenue_ppd')?.toFixed(0) ?? '--'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Revenue by Payer */}
          <div className="grid grid-cols-4">
            <KPICard
              title="Medicare A Rev PSD"
              value={getKPIValue('snf_medicare_a_revenue_psd')}
              icon={<DollarSign size={20} />}
              format="currency"
              subtitle="~$650-800/day target"
            />
            <KPICard
              title="MA/HMO Rev PSD"
              value={getKPIValue('snf_ma_revenue_psd')}
              icon={<DollarSign size={20} />}
              format="currency"
              subtitle="~$450-600/day target"
            />
            <KPICard
              title="Medicaid Rev PPD"
              value={getKPIValue('snf_medicaid_revenue_ppd')}
              icon={<DollarSign size={20} />}
              format="currency"
              subtitle="~$220-280/day typical"
            />
            <KPICard
              title="Skilled Rev PSD"
              value={getKPIValue('snf_skilled_revenue_psd')}
              icon={<DollarSign size={20} />}
              format="currency"
              subtitle="Blended skilled rate"
            />
          </div>
        </section>
      )}

      {/* Private Pay for ALF/ILF */}
      {(facility.setting === 'ALF' || facility.setting === 'ILF') && (
        <section className="kpi-section">
          <h2 className="section-title">Resident Mix</h2>
          <div className="grid grid-cols-4">
            <KPICard
              title="Private Pay %"
              value={getKPIValue('sl_private_pay_pct')}
              icon={<Users size={20} />}
              format="percentage"
            />
          </div>
        </section>
      )}

      {/* Cost KPIs - Setting-aware */}
      <section className="kpi-section">
        <h2 className="section-title">
          Cost Management
          <InfoTooltip
            content="Cost PPD metrics help identify efficiency opportunities. Nursing is typically 45-50% of costs. Contract labor above 10% signals staffing challenges and erodes margins significantly. Compare costs to revenue to understand your spread."
            type="warning"
          />
        </h2>
        {facility.setting === 'SNF' ? (
          <div className="grid grid-cols-4">
            <KPICard
              title="Total Cost PPD"
              value={getKPIValue('snf_total_cost_ppd')}
              icon={<DollarSign size={20} />}
              format="currency"
            />
            <KPICard
              title="Nursing Cost PPD"
              value={getKPIValue('snf_nursing_cost_ppd')}
              icon={<Activity size={20} />}
              format="currency"
            />
            <KPICard
              title="Therapy Cost PSD"
              value={getKPIValue('snf_therapy_cost_psd')}
              icon={<Activity size={20} />}
              format="currency"
            />
            <KPICard
              title="Contract Labor %"
              value={getKPIValue('snf_contract_labor_pct_nursing')}
              icon={<Users size={20} />}
              format="percentage"
              variant={getContractLaborVariant(getKPIValue('snf_contract_labor_pct_nursing'))}
            />
          </div>
        ) : (
          <div className="grid grid-cols-4">
            <KPICard
              title="Expense PPD"
              value={getKPIValue('sl_expense_prd')}
              icon={<DollarSign size={20} />}
              format="currency"
            />
            <KPICard
              title="Nursing PPD"
              value={getKPIValue('sl_nursing_prd')}
              icon={<Activity size={20} />}
              format="currency"
            />
            <KPICard
              title="Dietary PPD"
              value={getKPIValue('sl_dietary_prd')}
              icon={<Activity size={20} />}
              format="currency"
            />
            <KPICard
              title="Admin PPD"
              value={getKPIValue('sl_admin_prd')}
              icon={<Activity size={20} />}
              format="currency"
            />
          </div>
        )}
      </section>

      {/* Charts */}
      <div className={`grid ${facility.setting === 'SNF' ? 'grid-cols-2' : 'grid-cols-1'} mb-6`}>
        {/* Margin Trend */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <TrendingUp size={18} />
              Operating Margin Trend
              <InfoTooltip
                content="Track margin over time to spot patterns. Look for: sustained improvement (good), seasonal dips (normal), sudden drops (investigate). Consistent upward trends indicate operational improvements taking hold."
                type="metric"
              />
            </h3>
          </div>
          {marginTrends.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={marginTrends}>
                  <XAxis
                    dataKey="period_id"
                    tickFormatter={(p) => {
                      const [y, m] = p.split('-');
                      return `${m}/${y.slice(2)}`;
                    }}
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v}%`}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Margin']}
                    labelFormatter={(label) => formatPeriod(String(label))}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ fill: '#2563eb', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">No trend data available</div>
          )}
        </div>

        {/* Payer Mix Chart - SNF only */}
        {facility.setting === 'SNF' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Users size={18} />
                Payer Mix Distribution
              </h3>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={payerMixData} layout="vertical">
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={80} fontSize={12} />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {payerMixData.map((_, index) => (
                      <Cell key={index} fill={PAYER_COLORS[index % PAYER_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Executive Summary & Alerts */}
      <div className="mt-6 space-y-6">
        <ExecutiveSummary facilityId={parseInt(facilityId)} periodId={periodId} />
        <ThresholdAlerts facilityId={parseInt(facilityId)} periodId={periodId} />
      </div>

      {/* Performance Analysis */}
      <div className="mt-6 space-y-6">
        <T12MAnalysis facilityId={facilityId} periodId={periodId} />
        <CorrelationPanel facilityId={facilityId} periodId={periodId} />
      </div>

      {/* Peer Comparison & Goals */}
      <div className="mt-6 space-y-6">
        <PeerComparison facilityId={parseInt(facilityId)} periodId={periodId} />
        <GoalTracking facilityId={parseInt(facilityId)} />
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <section className="kpi-section">
          <h2 className="section-title">
            <AlertTriangle size={20} className="text-warning" />
            Data Quality Alerts
          </h2>
          <div className="anomaly-list">
            {anomalies.map((anomaly, idx) => (
              <div key={idx} className={`anomaly-item anomaly-${anomaly.severity}`}>
                <div className="anomaly-header">
                  <span className={`badge badge-${getSeverityBadge(anomaly.severity)}`}>
                    {anomaly.severity}
                  </span>
                  <span className="anomaly-type">{anomaly.type}</span>
                </div>
                <p className="anomaly-message">{anomaly.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All KPIs Table */}
      <section className="kpi-section">
        <h2 className="section-title">
          All KPI Details
          <InfoTooltip
            content="Complete KPI breakdown with underlying data. Numerator/Denominator columns show the raw values used in calculations - useful for data verification. Scope indicates which patient population (skilled, all patients, etc.)."
            type="info"
          />
        </h2>
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>KPI</th>
                  <th>Value</th>
                  <th>Numerator</th>
                  <th>Denominator</th>
                  <th>Scope</th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((kpi) => (
                  <tr key={kpi.kpi_id}>
                    <td className="kpi-name">{formatKPIName(kpi.kpi_id)}</td>
                    <td className="kpi-value">
                      {formatKPIValue(kpi.value, kpi.unit)}
                    </td>
                    <td className="text-muted">
                      {kpi.numerator_value?.toLocaleString() ?? '--'}
                    </td>
                    <td className="text-muted">
                      {kpi.denominator_value?.toLocaleString() ?? '--'}
                    </td>
                    <td>
                      <span className="badge badge-info">{kpi.payer_scope}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Narrative Report Section */}
      <NarrativeReport
        context="facility"
        periodId={periodId}
        facilityId={facilityId}
        title={`${facility.name} - Detailed Narrative`}
      />

      {/* Financial Packet Generator */}
      <div ref={packetRef}>
        <FinancialPacketGenerator
          facilityId={facilityId}
          periodId={periodId}
        />
      </div>
    </div>
  );
}

function formatPeriod(periodId: string): string {
  const [year, month] = periodId.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function formatKPIName(kpiId: string): string {
  return kpiId
    .replace(/^(snf_|sl_)/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/Ppd/g, 'PPD')
    .replace(/Psd/g, 'PSD')
    .replace(/Pct/g, '%');
}

function formatKPIValue(value: number | null, unit: string): string {
  if (value === null || value === undefined) return '--';

  switch (unit) {
    case 'currency':
      return `$${value.toFixed(2)}`;
    case 'percentage':
      return `${value.toFixed(1)}%`;
    default:
      return value.toFixed(2);
  }
}

function getMarginVariant(value: number | null): 'success' | 'warning' | 'danger' | 'default' {
  if (value === null) return 'default';
  if (value >= 10) return 'success';
  if (value >= 0) return 'warning';
  return 'danger';
}

function getContractLaborVariant(value: number | null): 'success' | 'warning' | 'danger' | 'default' {
  if (value === null) return 'default';
  if (value <= 5) return 'success';
  if (value <= 15) return 'warning';
  return 'danger';
}

function getOccupancyVariant(value: number | null): 'success' | 'warning' | 'danger' | 'default' {
  if (value === null) return 'default';
  if (value >= 90) return 'success';
  if (value >= 80) return 'warning';
  return 'danger';
}

function getSeverityBadge(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'high': return 'danger';
    case 'medium': return 'warning';
    default: return 'info';
  }
}
