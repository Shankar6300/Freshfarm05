import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  faSearch,
  faCartShopping,
  faUserCircle,
  faLocationDot,
  faChevronDown,
  faCrosshairs,
  faGlobe
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useLanguage } from './context/LanguageContext';
import './styles/customer-ui.css';

const Nav = ({ handleSearchChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [location, setLocation] = useState(() => localStorage.getItem('freshfarm_location') || 'Hyderabad');
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const presetLocations = ['Hyderabad', 'Bengaluru', 'Chennai', 'Mumbai', 'Delhi'];

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  const onSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    if (handleSearchChange) {
      handleSearchChange(value);
    }
  };

  const applyLocation = (value) => {
    setLocation(value);
    localStorage.setItem('freshfarm_location', value);
    setShowLocationMenu(false);
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await response.json();
          if (data?.display_name) {
            applyLocation(data.display_name);
          }
        } catch (error) {
          console.error('Location fetch failed:', error);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
      }
    );
  };

  return (
    <header className="ff-topbar">
      <div className="ff-topbar-inner">
        <Link to="/userlanding">
          <img src={require('./uss.png')} alt="logo" className="ff-logo" />
        </Link>

        <div className="ff-location-wrap">
          <button className="ff-location-btn" onClick={() => setShowLocationMenu((prev) => !prev)}>
            <FontAwesomeIcon icon={faLocationDot} />
            <span className="ff-location-label">{location || t('selectLocation')}</span>
            <FontAwesomeIcon icon={faChevronDown} />
          </button>

          {showLocationMenu && (
            <div className="ff-location-menu">
              <button type="button" onClick={handleCurrentLocation}>
                <FontAwesomeIcon icon={faCrosshairs} style={{ marginRight: 8 }} />
                {t('useCurrentLocation')}
              </button>
              {presetLocations.map((city) => (
                <button type="button" key={city} onClick={() => applyLocation(city)}>
                  <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 8 }} />
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ff-search">
          <input type="text" placeholder={t('searchPlaceholder')} value={searchTerm} onChange={onSearchChange} />
          <FontAwesomeIcon icon={faSearch} className="ff-search-icon" />
        </div>

        <div className="ff-top-actions">
          {!isAuthenticated && (
            <>
              <Link to="/farmer_signup" className="ff-action-link">
                {t('becomeSeller')}
              </Link>
              <Link to="/rider_signup" className="ff-action-link" style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '15px' }}>
                Join as Rider
              </Link>
            </>
          )}

          {!isAuthenticated && (
            <>
              <Link to="/login" className="ff-action-link">
                {t('login')}
              </Link>
              <Link to="/signup" className="ff-top-action">
                <FontAwesomeIcon icon={faUserCircle} />
                <span>{t('signup')}</span>
              </Link>
            </>
          )}

          <div className="ff-account-wrap">
            <button className="ff-top-action" type="button" onClick={() => navigate('/account')}>
              <FontAwesomeIcon icon={faUserCircle} />
              <span>{t('account')}</span>
            </button>
          </div>

          <Link to="/addCart" className="ff-top-action">
            <FontAwesomeIcon icon={faCartShopping} />
            <span>{t('cart')}</span>
          </Link>

          <label className="ff-top-action ff-language-select" htmlFor="language-picker" style={{flexDirection: 'row', gap: '5px'}}>
            <FontAwesomeIcon icon={faGlobe} />
            <select
              id="language-picker"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontWeight: 600, outline: 'none' }}
            >
              <option value="en">EN</option>
              <option value="hi">HI</option>
              <option value="te">TE</option>
            </select>
          </label>
        </div>
      </div>
    </header>
  );
};

export default Nav;
