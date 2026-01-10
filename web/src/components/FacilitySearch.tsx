import { useState, useRef, useEffect } from 'react';
import { Search, Building2, Star, X } from 'lucide-react';
import { useFavorites } from '../contexts/FavoritesContext';
import './FacilitySearch.css';

interface Facility {
  facility_id: string;
  name: string;
  state: string;
  setting: string;
}

interface FacilitySearchProps {
  facilities: Facility[];
  onSelect: (facilityId: string) => void;
}

export function FacilitySearch({ facilities, onSelect }: FacilitySearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toggleFavorite, isFavorite } = useFavorites();

  // Filter facilities based on query
  const filteredFacilities = query.trim()
    ? facilities.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.state.toLowerCase().includes(query.toLowerCase()) ||
        f.facility_id.includes(query)
      )
    : [];

  // Get favorite facilities
  const favoriteFacilities = facilities.filter(f => isFavorite(f.facility_id));

  // Handle keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (facilityId: string) => {
    onSelect(facilityId);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="facility-search" ref={containerRef}>
      <button
        className="search-trigger"
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
      >
        <Search size={16} />
        <span>Search facilities...</span>
        <kbd>⌘K</kbd>
      </button>

      {isOpen && (
        <div className="search-dropdown">
          <div className="search-input-wrapper">
            <Search size={18} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, state, or ID..."
              autoFocus
            />
            {query && (
              <button className="clear-btn" onClick={() => setQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="search-results">
            {/* Favorites section */}
            {!query && favoriteFacilities.length > 0 && (
              <div className="results-section">
                <div className="section-header">
                  <Star size={12} />
                  Favorites
                </div>
                {favoriteFacilities.map(facility => (
                  <div
                    key={facility.facility_id}
                    className="result-item"
                    onClick={() => handleSelect(facility.facility_id)}
                  >
                    <Building2 size={16} />
                    <div className="result-info">
                      <span className="result-name">{facility.name}</span>
                      <span className="result-meta">{facility.state} • {facility.setting}</span>
                    </div>
                    <button
                      className="favorite-btn active"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(facility.facility_id);
                      }}
                    >
                      <Star size={14} fill="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search results */}
            {query && filteredFacilities.length > 0 && (
              <div className="results-section">
                <div className="section-header">
                  <Search size={12} />
                  Results ({filteredFacilities.length})
                </div>
                {filteredFacilities.slice(0, 10).map(facility => (
                  <div
                    key={facility.facility_id}
                    className="result-item"
                    onClick={() => handleSelect(facility.facility_id)}
                  >
                    <Building2 size={16} />
                    <div className="result-info">
                      <span className="result-name">{facility.name}</span>
                      <span className="result-meta">{facility.state} • {facility.setting}</span>
                    </div>
                    <button
                      className={`favorite-btn ${isFavorite(facility.facility_id) ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(facility.facility_id);
                      }}
                    >
                      <Star size={14} fill={isFavorite(facility.facility_id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                ))}
                {filteredFacilities.length > 10 && (
                  <div className="more-results">
                    +{filteredFacilities.length - 10} more results
                  </div>
                )}
              </div>
            )}

            {/* No results */}
            {query && filteredFacilities.length === 0 && (
              <div className="no-results">
                No facilities found matching "{query}"
              </div>
            )}

            {/* Empty state */}
            {!query && favoriteFacilities.length === 0 && (
              <div className="empty-state">
                <Search size={24} />
                <p>Start typing to search facilities</p>
                <span>Star facilities to add them to favorites</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
