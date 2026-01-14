import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ArrowLeft, Building2, MapPin, FileText, Star, LayoutDashboard, DollarSign, BarChart3, FileBarChart } from 'lucide-react';
import { useFavorites } from '../contexts/FavoritesContext';
import { PDFExport } from './export/PDFExport';
import { FacilityOverviewTab, FacilityFinancialsTab, FacilityAnalysisTab, FacilityReportsTab } from './facility/tabs';
import { FacilityDetailSkeleton } from './facility/FacilityDetailSkeleton';
import { formatPeriod } from '../utils/dateFormatters';
import { api } from '../api';
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
  return api.facilities.getFacility(id) as unknown as Promise<Facility>;
}

async function fetchKPIs(facilityId: string, periodId: string): Promise<KPIResult[]> {
  return api.kpis.getKPIs(facilityId, periodId) as unknown as Promise<KPIResult[]>;
}

async function fetchAnomalies(facilityId: string, periodId: string): Promise<Anomaly[]> {
  return api.alerts.getAnomalies(facilityId, periodId) as unknown as Promise<Anomaly[]>;
}

async function fetchTrends(facilityId: string, kpiId: string): Promise<TrendData[]> {
  return api.kpis.getKPITrends(facilityId, kpiId) as unknown as Promise<TrendData[]>;
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
  const data = await api.dashboard.getFinancialSummary(periodId) as unknown as { facilities?: FacilityFinancials[] };
  return data.facilities?.find((f: FacilityFinancials) => f.facility_id === facilityId) || null;
}

// Determine which margin KPI to use based on setting
function getMarginKpiId(setting: string): string {
  return setting === 'SNF' ? 'snf_operating_margin_pct' : 'sl_operating_margin_pct';
}

type FacilityTab = 'overview' | 'financials' | 'analysis' | 'reports';

export function FacilityDetail({ facilityId, periodId, onBack }: FacilityDetailProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const packetRef = useRef<HTMLDivElement | null>(null);
  const { toggleFavorite, isFavorite } = useFavorites();
  const [activeTab, setActiveTab] = useState<FacilityTab>('overview');

  const scrollToPacket = () => {
    setActiveTab('reports');
    setTimeout(() => {
      packetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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
    return <FacilityDetailSkeleton />;
  }

  if (!facility) {
    return <div className="error">Facility not found</div>;
  }

  const getKPIValue = (kpiId: string) => kpis.find(k => k.kpi_id === kpiId)?.value ?? null;

  const facilityTabs = [
    { id: 'overview' as const, label: 'Overview', icon: <LayoutDashboard size={18} />, description: 'Summary & ratings' },
    { id: 'financials' as const, label: 'Financials', icon: <DollarSign size={18} />, description: 'Revenue & costs' },
    { id: 'analysis' as const, label: 'Analysis', icon: <BarChart3 size={18} />, description: 'Trends & alerts' },
    { id: 'reports' as const, label: 'Reports', icon: <FileBarChart size={18} />, description: 'Export & notes' },
  ];

  return (
    <div className="facility-detail" ref={reportRef}>
      {/* Back Button */}
      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      {/* Unified Toolbar */}
      <div className="facility-toolbar">
        {/* Facility Info */}
        <div className="toolbar-facility-info">
          <div className="toolbar-facility-icon">
            <Building2 size={20} />
          </div>
          <div className="toolbar-facility-name">
            <span className="facility-name-text">{facility.name}</span>
            <div className="toolbar-facility-meta">
              <span className="facility-setting-badge">{facility.setting}</span>
              <span className="facility-location">
                <MapPin size={12} />
                {facility.state || 'Unknown'}
              </span>
              {facility.licensed_beds && (
                <span className="facility-beds">{facility.licensed_beds} beds</span>
              )}
            </div>
          </div>
          <button
            className={`toolbar-favorite-btn ${isFavorite(facilityId) ? 'active' : ''}`}
            onClick={() => toggleFavorite(facilityId)}
            title={isFavorite(facilityId) ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={16} fill={isFavorite(facilityId) ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* View Tabs */}
        <nav className="toolbar-tabs" role="tablist" aria-label="Facility views">
          {facilityTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`toolbar-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.description}
            >
              {tab.icon}
              <span className="toolbar-tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="toolbar-actions">
          <span className="period-badge">{formatPeriod(periodId)}</span>
          <button className="toolbar-action-btn" onClick={scrollToPacket} title="Generate Financial Packet">
            <FileText size={16} />
            <span className="action-btn-label">Packet</span>
          </button>
          <PDFExport
            facilityName={facility.name}
            periodId={periodId}
            targetRef={reportRef}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="facility-content">
        {activeTab === 'overview' && (
          <FacilityOverviewTab
            facility={facility}
            financials={financials ?? null}
          />
        )}
        {activeTab === 'financials' && (
          <FacilityFinancialsTab
            setting={facility.setting}
            kpis={kpis}
            marginTrends={marginTrends}
            getKPIValue={getKPIValue}
          />
        )}
        {activeTab === 'analysis' && (
          <FacilityAnalysisTab
            facilityId={facilityId}
            periodId={periodId}
            kpis={kpis}
            anomalies={anomalies}
          />
        )}
        {activeTab === 'reports' && (
          <FacilityReportsTab
            facilityId={facilityId}
            facilityName={facility.name}
            periodId={periodId}
            packetRef={packetRef}
          />
        )}
      </div>
    </div>
  );
}
