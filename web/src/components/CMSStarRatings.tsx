import { Star, Shield, Users, Heart, Info } from 'lucide-react';
import './CMSStarRatings.css';

interface CMSStarRatingsProps {
  overallRating: number | null;
  healthInspectionRating: number | null;
  staffingRating: number | null;
  qualityRating: number | null;
  lastUpdated?: string | null;
  facilityName?: string;
}

export function CMSStarRatings({
  overallRating,
  healthInspectionRating,
  staffingRating,
  qualityRating,
  lastUpdated,
}: CMSStarRatingsProps) {

  const renderStars = (rating: number | null, size: number = 14) => {
    if (rating === null || rating === undefined) {
      return <span className="no-rating">Not rated</span>;
    }

    return (
      <div className="stars-container">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            className={`star ${star <= rating ? 'filled' : 'empty'}`}
            fill={star <= rating ? 'currentColor' : 'none'}
          />
        ))}
      </div>
    );
  };

  const getRatingLabel = (rating: number | null): string => {
    if (rating === null) return 'Not Available';
    if (rating === 5) return 'Much Above Average';
    if (rating === 4) return 'Above Average';
    if (rating === 3) return 'Average';
    if (rating === 2) return 'Below Average';
    return 'Much Below Average';
  };

  const getRatingClass = (rating: number | null): string => {
    if (rating === null) return '';
    if (rating >= 4) return 'rating-good';
    if (rating === 3) return 'rating-average';
    return 'rating-poor';
  };

  return (
    <div className="cms-star-ratings">
      <div className="cms-header">
        <div className="cms-title">
          <Shield size={20} />
          <h3>CMS Quality Ratings</h3>
        </div>
        <a
          href="https://www.medicare.gov/care-compare/"
          target="_blank"
          rel="noopener noreferrer"
          className="cms-link"
        >
          <Info size={14} />
          View on Medicare.gov
        </a>
      </div>

      {/* Overall Rating - Prominent Display */}
      <div className={`overall-rating-card ${getRatingClass(overallRating)}`}>
        <div className="overall-rating-content">
          <div className="overall-label">Overall Rating</div>
          <div className="overall-stars">
            {renderStars(overallRating, 20)}
          </div>
          <div className="overall-description">
            {getRatingLabel(overallRating)}
          </div>
        </div>
        {overallRating !== null && (
          <div className="overall-badge">
            <span className="badge-number">{overallRating}</span>
            <span className="badge-label">out of 5</span>
          </div>
        )}
      </div>

      {/* Sub-ratings Grid */}
      <div className="sub-ratings-grid">
        <div className={`sub-rating-card ${getRatingClass(healthInspectionRating)}`}>
          <div className="sub-rating-icon">
            <Shield size={14} />
          </div>
          <div className="sub-rating-content">
            <div className="sub-rating-label">Health Inspection</div>
            <div className="sub-rating-stars">
              {renderStars(healthInspectionRating, 12)}
            </div>
            <div className="sub-rating-description">
              Based on on-site inspections
            </div>
          </div>
        </div>

        <div className={`sub-rating-card ${getRatingClass(staffingRating)}`}>
          <div className="sub-rating-icon">
            <Users size={14} />
          </div>
          <div className="sub-rating-content">
            <div className="sub-rating-label">Staffing</div>
            <div className="sub-rating-stars">
              {renderStars(staffingRating, 12)}
            </div>
            <div className="sub-rating-description">
              RN, LPN, CNA hours per day
            </div>
          </div>
        </div>

        <div className={`sub-rating-card ${getRatingClass(qualityRating)}`}>
          <div className="sub-rating-icon">
            <Heart size={14} />
          </div>
          <div className="sub-rating-content">
            <div className="sub-rating-label">Quality Measures</div>
            <div className="sub-rating-stars">
              {renderStars(qualityRating, 12)}
            </div>
            <div className="sub-rating-description">
              Clinical outcomes & care quality
            </div>
          </div>
        </div>
      </div>

      {/* Rating Legend */}
      <div className="rating-legend">
        <div className="legend-title">Rating Scale:</div>
        <div className="legend-items">
          <span className="legend-item"><Star size={12} fill="currentColor" className="star filled" /> 5 = Much Above Average</span>
          <span className="legend-item"><Star size={12} fill="currentColor" className="star filled" /> 4 = Above Average</span>
          <span className="legend-item"><Star size={12} fill="currentColor" className="star filled" /> 3 = Average</span>
          <span className="legend-item"><Star size={12} fill="currentColor" className="star filled" /> 2 = Below Average</span>
          <span className="legend-item"><Star size={12} fill="currentColor" className="star filled" /> 1 = Much Below Average</span>
        </div>
      </div>

      {lastUpdated && (
        <div className="cms-footer">
          Last updated: {new Date(lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      )}
    </div>
  );
}
