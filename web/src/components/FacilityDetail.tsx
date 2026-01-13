import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ArrowLeft, Building2, MapPin, FileText, Star, LayoutDashboard, DollarSign, BarChart3, FileBarChart } from 'lucide-react';
import { useFavorites } from '../contexts/FavoritesContext';
import { PDFExport } from './export/PDFExport';
import { TabPanel } from './ui/TabPanel';
import { FacilityOverviewTab, FacilityFinancialsTab, FacilityAnalysisTab, FacilityReportsTab } from './facility/tabs';
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
  const res = await fetch(`https://snfpnl.onrender.com/api/facilities/${id}`);
  if (!res.ok) throw new Error('Failed to fetch facility');
  return res.json();
}

async function fetchKPIs(facilityId: string, periodId: string): Promise<KPIResult[]> {
  const res = await fetch(`https://snfpnl.onrender.com/api/kpis/${facilityId}/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch KPIs');
  return res.json();
}

async function fetchAnomalies(facilityId: string, periodId: string): Promise<Anomaly[]> {
  const res = await fetch(`https://snfpnl.onrender.com/api/anomalies/${facilityId}/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch anomalies');
  return res.json();
}

async function fetchTrends(facilityId: string, kpiId: string): Promise<TrendData[]> {
  const res = await fetch(`https://snfpnl.onrender.com/api/trends/${facilityId}/${kpiId}`);
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
  const res = await fetch(`https://snfpnl.onrender.com/api/financials/summary/${periodId}`);
  if (!res.ok) throw new Error('Failed to fetch financials');
  const data = await res.json();
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
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!facility) {
    return <div className="error">Facility not found</div>;
  }

  const getKPIValue = (kpiId: string) => kpis.find(k => k.kpi_id === kpiId)?.value ?? null;

  const facilityTabs = [
    { id: 'overview' as const, label: 'Overview', icon: <LayoutDashboard size={18} /> },
    { id: 'financials' as const, label: 'Financials', icon: <DollarSign size={18} /> },
    { id: 'analysis' as const, label: 'Analysis', icon: <BarChart3 size={18} /> },
    { id: 'reports' as const, label: 'Reports', icon: <FileBarChart size={18} /> },
  ];

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
            <div className="facility-title-row">
              <h1>{facility.name}</h1>
              <button
                className={`favorite-btn-large ${isFavorite(facilityId) ? 'active' : ''}`}
                onClick={() => toggleFavorite(facilityId)}
                title={isFavorite(facilityId) ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star size={22} fill={isFavorite(facilityId) ? 'currentColor' : 'none'} />
              </button>
            </div>
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

      {/* View Tabs */}
      <TabPanel
        tabs={facilityTabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as FacilityTab)}
        variant="primary"
      >
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
      </TabPanel>
    </div>
  );
}

function formatPeriod(periodId: string): string {
  const [year, month] = periodId.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}
