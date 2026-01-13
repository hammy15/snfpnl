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
  const [activeIndex, setActiveIndex] = useState(-1);
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

  // Get visible items for keyboard navigation
  const visibleItems = query.trim()
    ? filteredFacilities.slice(0, 10)
    : favoriteFacilities;

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

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

  // Handle keyboard navigation within search
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!visibleItems.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, visibleItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && visibleItems[activeIndex]) {
          handleSelect(visibleItems[activeIndex].facility_id);
        }
        break;
    }
  };

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
    setActiveIndex(-1);
  };

  return (
    <div className="facility-search" ref={containerRef}>
      <button
        className="search-trigger"
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="facility-search-listbox"
        aria-label="Search facilities (Cmd+K)"
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
              onKeyDown={handleInputKeyDown}
              placeholder="Search by name, state, or ID..."
              aria-label="Search facilities by name, state, or ID"
              aria-autocomplete="list"
              aria-controls="facility-search-listbox"
              aria-activedescendant={activeIndex >= 0 ? `facility-option-${visibleItems[activeIndex]?.facility_id}` : undefined}
              autoFocus
            />
            {query && (
              <button className="clear-btn" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="search-results" id="facility-search-listbox" role="listbox" aria-label="Search results">
            {/* Favorites section */}
            {!query && favoriteFacilities.length > 0 && (
              <div className="results-section">
                <div className="section-header">
                  <Star size={12} />
                  Favorites
                </div>
                {favoriteFacilities.map((facility, index) => (
                  <div
                    key={facility.facility_id}
                    id={`facility-option-${facility.facility_id}`}
                    role="option"
                    aria-selected={activeIndex === index}
                    className={`result-item ${activeIndex === index ? 'active' : ''}`}
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
                      aria-label={`Remove ${facility.name} from favorites`}
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
                {filteredFacilities.slice(0, 10).map((facility, index) => (
                  <div
                    key={facility.facility_id}
                    id={`facility-option-${facility.facility_id}`}
                    role="option"
                    aria-selected={activeIndex === index}
                    className={`result-item ${activeIndex === index ? 'active' : ''}`}
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
                      aria-label={isFavorite(facility.facility_id) ? `Remove ${facility.name} from favorites` : `Add ${facility.name} to favorites`}
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
