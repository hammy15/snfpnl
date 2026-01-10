import { useQuery } from '@tanstack/react-query';
import { Search, MapPin, Building2, Filter, Star } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useFavorites } from '../contexts/FavoritesContext';
import './FacilityList.css';

type SettingFilter = 'all' | 'SNF' | 'ALF' | 'ILF';

interface Facility {
  facility_id: string;
  name: string;
  short_name: string;
  state: string;
  setting: string;
  licensed_beds: number | null;
  operational_beds: number | null;
  parent_opco: string | null;
}

interface FacilityListProps {
  onFacilitySelect: (facilityId: string) => void;
  settingFilter: SettingFilter;
  onSettingFilterChange: (filter: SettingFilter) => void;
}

async function fetchFacilities(): Promise<Facility[]> {
  const res = await fetch('https://snfpnl.onrender.com/api/facilities');
  if (!res.ok) throw new Error('Failed to fetch facilities');
  return res.json();
}

export function FacilityList({ onFacilitySelect, settingFilter, onSettingFilterChange }: FacilityListProps) {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const { data: facilities = [], isLoading, error } = useQuery({
    queryKey: ['facilities'],
    queryFn: fetchFacilities,
  });

  const states = useMemo(() => {
    const uniqueStates = [...new Set(facilities.map(f => f.state))].filter(Boolean).sort();
    return uniqueStates;
  }, [facilities]);

  const settingCounts = useMemo(() => {
    return facilities.reduce((acc, f) => {
      acc[f.setting] = (acc[f.setting] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [facilities]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter(facility => {
      const matchesSearch = !search ||
        facility.name.toLowerCase().includes(search.toLowerCase()) ||
        facility.facility_id.toLowerCase().includes(search.toLowerCase()) ||
        (facility.short_name && facility.short_name.toLowerCase().includes(search.toLowerCase()));

      const matchesState = stateFilter === 'all' || facility.state === stateFilter;
      const matchesSetting = settingFilter === 'all' || facility.setting === settingFilter;
      const matchesFavorites = !showFavoritesOnly || isFavorite(facility.facility_id);

      return matchesSearch && matchesState && matchesSetting && matchesFavorites;
    });
  }, [facilities, search, stateFilter, settingFilter, showFavoritesOnly, isFavorite]);

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return <div className="error">Failed to load facilities</div>;
  }

  return (
    <div className="facility-list animate-fade-in">
      <div className="facility-list-header">
        <div>
          <h2>All Facilities</h2>
          <p className="text-muted">{filteredFacilities.length} of {facilities.length} facilities</p>
        </div>
      </div>

      {/* Setting Type Tabs */}
      <div className="setting-tabs mb-6">
        {(['all', 'SNF', 'ALF', 'ILF'] as const).map((setting) => (
          <button
            key={setting}
            className={`setting-tab ${settingFilter === setting ? 'active' : ''}`}
            onClick={() => onSettingFilterChange(setting)}
          >
            {setting === 'all' ? 'All Types' : setting}
            <span className="tab-count">
              {setting === 'all' ? facilities.length : settingCounts[setting] || 0}
            </span>
          </button>
        ))}
      </div>

      <div className="facility-list-filters">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search facilities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <button
          className={`favorites-filter-btn ${showFavoritesOnly ? 'active' : ''}`}
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          title={showFavoritesOnly ? 'Show all facilities' : 'Show favorites only'}
        >
          <Star size={16} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
          <span>Favorites ({favorites.length})</span>
        </button>
        <div className="filter-group">
          <Filter size={18} />
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="state-filter"
          >
            <option value="all">All States</option>
            {states.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="facility-grid">
        {filteredFacilities.map(facility => (
          <div
            key={facility.facility_id}
            className="facility-card"
            onClick={() => onFacilitySelect(facility.facility_id)}
          >
            <div className="facility-card-header">
              <div className="facility-icon">
                <Building2 size={20} />
              </div>
              <div className="facility-badges">
                <button
                  className={`favorite-btn ${isFavorite(facility.facility_id) ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(facility.facility_id);
                  }}
                  title={isFavorite(facility.facility_id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star size={16} fill={isFavorite(facility.facility_id) ? 'currentColor' : 'none'} />
                </button>
                <span className={`badge badge-${facility.setting.toLowerCase()}`}>
                  {facility.setting}
                </span>
                <span className="facility-id">#{facility.facility_id}</span>
              </div>
            </div>
            <h3 className="facility-name">{facility.name}</h3>
            <div className="facility-meta">
              <span className="facility-location">
                <MapPin size={14} />
                {facility.state || 'Unknown'}
              </span>
            </div>
            {facility.licensed_beds && (
              <div className="facility-stats">
                <div className="stat-item">
                  <span className="stat-label">Licensed</span>
                  <span className="stat-value">{facility.licensed_beds}</span>
                </div>
                {facility.operational_beds && (
                  <div className="stat-item">
                    <span className="stat-label">Operational</span>
                    <span className="stat-value">{facility.operational_beds}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredFacilities.length === 0 && (
        <div className="empty-state">
          <Building2 size={48} strokeWidth={1} />
          <p>No facilities found matching your criteria</p>
        </div>
      )}
    </div>
  );
}
