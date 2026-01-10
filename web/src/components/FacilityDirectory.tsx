import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, MapPin, Bed, Users, Search, Filter,
  ChevronRight, Building, Home, TrendingUp, DollarSign
} from 'lucide-react';
import { SectionExplainer } from './ui/InfoTooltip';
import { NarrativeReport } from './NarrativeReport';
import './FacilityDirectory.css';

interface FacilityDirectoryProps {
  onFacilitySelect: (facilityId: string) => void;
}

interface Facility {
  facility_id: string;
  name: string;
  short_name: string | null;
  dba: string | null;
  legal_name: string | null;
  parent_opco: string | null;
  setting: string;
  state: string;
  city: string | null;
  address: string | null;
  licensed_beds: number | null;
  operational_beds: number | null;
  ownership_status: string | null;
  lender_landlord: string | null;
  latestPeriod: string | null;
  metrics: {
    operatingMargin: number | null;
    skilledMix: number | null;
    revenuePPD: number | null;
    costPPD: number | null;
    contractLaborPct: number | null;
  };
}

interface DirectorySummary {
  totalFacilities: number;
  byType: { SNF: number; ALF: number; ILF: number };
  byOwnership: { Owned: number; Leased: number; PathToOwnership: number; Unknown: number };
  byState: Record<string, number>;
  totalLicensedBeds: number;
  totalOperationalBeds: number;
}

interface DirectoryResponse {
  facilities: Facility[];
  summary: DirectorySummary;
}

async function fetchDirectory(): Promise<DirectoryResponse> {
  const res = await fetch('http://localhost:3002/api/facility-directory');
  if (!res.ok) throw new Error('Failed to fetch facility directory');
  return res.json();
}

const OWNERSHIP_COLORS: Record<string, string> = {
  'Owned': '#10b981',
  'Leased': '#3b82f6',
  'Path to Ownership': '#f59e0b',
  'Unknown': '#6b7280',
};

const TYPE_ICONS: Record<string, typeof Building2> = {
  'SNF': Building2,
  'ALF': Home,
  'ILF': Building,
};

export function FacilityDirectory({ onFacilitySelect }: FacilityDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterOwnership, setFilterOwnership] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'state' | 'margin' | 'beds'>('name');

  const { data, isLoading } = useQuery({
    queryKey: ['facility-directory'],
    queryFn: fetchDirectory,
  });

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  const { facilities = [], summary } = data || {};

  // Get unique states for filter
  const states = [...new Set(facilities.map(f => f.state))].sort();

  // Filter and sort facilities
  const filteredFacilities = facilities
    .filter(f => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          f.name.toLowerCase().includes(search) ||
          f.dba?.toLowerCase().includes(search) ||
          f.city?.toLowerCase().includes(search) ||
          f.address?.toLowerCase().includes(search) ||
          f.facility_id.includes(search)
        );
      }
      return true;
    })
    .filter(f => filterState === 'all' || f.state === filterState)
    .filter(f => filterType === 'all' || f.setting === filterType)
    .filter(f => filterOwnership === 'all' || f.ownership_status === filterOwnership)
    .sort((a, b) => {
      switch (sortBy) {
        case 'state':
          return a.state.localeCompare(b.state) || a.name.localeCompare(b.name);
        case 'margin':
          return (b.metrics.operatingMargin || -999) - (a.metrics.operatingMargin || -999);
        case 'beds':
          return (b.licensed_beds || 0) - (a.licensed_beds || 0);
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const formatMetric = (value: number | null, type: 'percent' | 'currency') => {
    if (value === null) return '--';
    if (type === 'percent') return `${value.toFixed(1)}%`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="facility-directory animate-fade-in">
      <SectionExplainer
        title="Facility Directory"
        subtitle="Complete portfolio overview with facility details"
        explanation="Browse all facilities in your portfolio with comprehensive information including ownership status, bed count, location, and key performance metrics. Use filters to find specific facilities quickly."
        tips={[
          "Use the search box to find facilities by name, city, or address",
          "Filter by state, type, or ownership to narrow results",
          "Sort by operating margin to identify top performers",
          "Click any facility to view detailed analytics"
        ]}
        reviewSuggestions={[
          "Review facilities with negative margins for intervention",
          "Compare owned vs leased facility performance",
          "Identify geographic clusters for regional analysis"
        ]}
      />

      {/* Summary Cards */}
      <div className="directory-summary">
        <div className="summary-card total">
          <Building2 size={24} />
          <div>
            <span className="value">{summary?.totalFacilities || 0}</span>
            <span className="label">Total Facilities</span>
          </div>
        </div>
        <div className="summary-card beds">
          <Bed size={24} />
          <div>
            <span className="value">{summary?.totalOperationalBeds?.toLocaleString() || 0}</span>
            <span className="label">Operational Beds</span>
          </div>
        </div>
        <div className="summary-card owned">
          <Building size={24} />
          <div>
            <span className="value">{summary?.byOwnership.Owned || 0}</span>
            <span className="label">Owned</span>
          </div>
        </div>
        <div className="summary-card leased">
          <Users size={24} />
          <div>
            <span className="value">{summary?.byOwnership.Leased || 0}</span>
            <span className="label">Leased</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="directory-filters">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search facilities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={16} />
          <select value={filterState} onChange={(e) => setFilterState(e.target.value)}>
            <option value="all">All States</option>
            {states.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>

          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="SNF">SNF</option>
            <option value="ALF">ALF</option>
            <option value="ILF">ILF</option>
          </select>

          <select value={filterOwnership} onChange={(e) => setFilterOwnership(e.target.value)}>
            <option value="all">All Ownership</option>
            <option value="Owned">Owned</option>
            <option value="Leased">Leased</option>
            <option value="Path to Ownership">Path to Ownership</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="name">Sort by Name</option>
            <option value="state">Sort by State</option>
            <option value="margin">Sort by Margin</option>
            <option value="beds">Sort by Beds</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="results-count">
        Showing {filteredFacilities.length} of {facilities.length} facilities
      </div>

      {/* Facility Grid */}
      <div className="facility-grid">
        {filteredFacilities.map(facility => {
          const TypeIcon = TYPE_ICONS[facility.setting] || Building2;
          const ownershipColor = OWNERSHIP_COLORS[facility.ownership_status || 'Unknown'];
          const marginPositive = (facility.metrics.operatingMargin || 0) > 0;

          return (
            <div
              key={facility.facility_id}
              className="facility-card"
              onClick={() => onFacilitySelect(facility.facility_id)}
            >
              <div className="card-header">
                <div className="facility-type" style={{ background: ownershipColor }}>
                  <TypeIcon size={16} />
                  <span>{facility.setting}</span>
                </div>
                <span
                  className="ownership-badge"
                  style={{ borderColor: ownershipColor, color: ownershipColor }}
                >
                  {facility.ownership_status || 'Unknown'}
                </span>
              </div>

              <div className="card-body">
                <h3 className="facility-name">{facility.name}</h3>
                {facility.dba && facility.dba !== facility.name && (
                  <p className="facility-dba">DBA: {facility.dba}</p>
                )}

                <div className="facility-location">
                  <MapPin size={14} />
                  <span>{facility.city || facility.state}, {facility.state}</span>
                </div>

                {facility.address && (
                  <p className="facility-address">{facility.address}</p>
                )}

                <div className="facility-details">
                  <div className="detail-item">
                    <Bed size={14} />
                    <span>{facility.operational_beds || facility.licensed_beds || '--'} beds</span>
                  </div>
                  {facility.lender_landlord && (
                    <div className="detail-item lender">
                      <Building size={14} />
                      <span>{facility.lender_landlord}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card-metrics">
                <div className={`metric ${marginPositive ? 'positive' : 'negative'}`}>
                  <TrendingUp size={14} />
                  <span className="metric-value">{formatMetric(facility.metrics.operatingMargin, 'percent')}</span>
                  <span className="metric-label">Margin</span>
                </div>
                <div className="metric">
                  <DollarSign size={14} />
                  <span className="metric-value">{formatMetric(facility.metrics.revenuePPD, 'currency')}</span>
                  <span className="metric-label">Rev PPD</span>
                </div>
              </div>

              <div className="card-footer">
                <span className="view-details">
                  View Details <ChevronRight size={14} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredFacilities.length === 0 && (
        <div className="empty-state">
          <Building2 size={48} />
          <h3>No facilities found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      )}

      {/* Narrative Report Section */}
      <NarrativeReport
        context="directory"
        periodId="2025-11"
        title="Facility Directory Narrative"
      />
    </div>
  );
}
