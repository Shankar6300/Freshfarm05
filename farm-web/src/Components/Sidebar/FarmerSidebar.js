import React, { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faBox, faClipboardList, faUserCircle, faSignOutAlt, faEnvelope, faMotorcycle } from '@fortawesome/free-solid-svg-icons'; // Added faEnvelope and faMotorcycle
import './Sidebar.css';
import logo from '../../uss.png';
import { jwtDecode } from 'jwt-decode';
import { useLanguage } from '../../context/LanguageContext';

const FarmerSidebar = () => {
  const { language, setLanguage, t } = useLanguage();
  const [token, setToken] = useState('');
  const [farmerId, setFarmerId] = useState('');
  const location = useLocation();
  const { farmerId: paramFarmerId } = useParams(); // Accessing the farmerId from the URL params

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      const decodedToken = jwtDecode(storedToken);
      if (decodedToken && decodedToken.isFarmer) {
        setFarmerId(decodedToken.farmerId);
      }
    }
  }, []);

  useEffect(() => {
    if (paramFarmerId) {
      setFarmerId(paramFarmerId); // Set farmerId from route params
    }
  }, [paramFarmerId]);

  const [title, setTitle] = useState('Farmer Dashboard');

  const handleItemClick = (newTitle) => {
    setTitle(newTitle);
  };

  const handleLogout = () => {
    // Perform logout actions here (e.g., clear local storage, reset session, etc.)
    // After logout, redirect the user to the login page
    localStorage.removeItem('token'); // Clear token from local storage
    setToken(''); // Clear token from state
    window.location.href = '/'; // Redirect to the login page

  };

  return (
    <div className="sidebar">
      <img src={logo} alt="logo" style={{ height: '100px', marginLeft: '20px', borderRadius: '8px' }} />
      <div style={{ padding: '0 20px 10px' }}>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #ddd', padding: '0 10px' }}>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="te">Telugu</option>
        </select>
      </div>
      <ul>
        <li className={location.pathname === '/farmerlanding' ? 'active' : ''} onClick={() => handleItemClick('Dashboard')}>
          <Link to={`/farmerlanding/${farmerId}`}>
            <FontAwesomeIcon icon={faChartBar} />
            <span>{t('dashboard')}</span>
          </Link>
        </li>
        <li className={location.pathname === '/products' ? 'active' : ''} onClick={() => handleItemClick('Products')}>
          <Link to={`/farmer_products/${farmerId}`}>
            <FontAwesomeIcon icon={faBox} />
            <span style={{paddingLeft: '13px'}}>{t('productsNav')}</span>
          </Link>
        </li>
        <li className={location.pathname === '/orders' ? 'active' : ''} onClick={() => handleItemClick('Orders')}>
  <Link to={`/FarmerOrder/${farmerId}`}>
    <FontAwesomeIcon icon={faClipboardList} />
    <span style={{ paddingLeft: '13px' }}>{t('ordersNav')}</span>
  </Link>
</li>

        <li className={location.pathname === '/inventory' ? 'active' : ''} onClick={() => handleItemClick('Inventory')}>
          <Link to={`/farmer_inventory/${farmerId}`}>
            <FontAwesomeIcon icon={faUserCircle} />
            <span>{t('inventory')}</span>
          </Link>
        </li>
        <li className={location.pathname === '/inquiries' ? 'active' : ''} onClick={() => handleItemClick('Inquiries')}>
          <Link to={`/inquiries/${farmerId}`}>
            <FontAwesomeIcon icon={faEnvelope} />
            <span>{t('inquiries')}</span>
          </Link>
        </li>
        <li className={location.pathname.includes('riders') ? 'active' : ''} onClick={() => handleItemClick('Riders')}>
          <Link to={`/farmer_riders/${farmerId}`}>
            <FontAwesomeIcon icon={faMotorcycle} />
            <span style={{ paddingLeft: '13px' }}>Riders</span>
          </Link>
        </li>
        <li onClick={handleLogout} className="logout-button">
          <FontAwesomeIcon icon={faSignOutAlt} className="logout-icon" />
          <span style={{paddingLeft: '5px'}}>{t('logout')}</span>
        </li>
      </ul>
    </div>
  );
};

export default FarmerSidebar;
