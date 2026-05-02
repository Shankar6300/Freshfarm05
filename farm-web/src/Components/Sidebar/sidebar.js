import React, { useState, useEffect } from 'react';
import { faAngleDown, faChartBar, faBox, faClipboardList, faSeedling, faUserFriends, faUserCog, faUserPlus, faUserCircle, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { Link, useLocation, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Sidebar.css';
import logo from '../../uss.png';
import { jwtDecode } from 'jwt-decode'; // Correct import statement
import { useLanguage } from '../../context/LanguageContext';

const Sidebar = () => {
  const { language, setLanguage, t } = useLanguage();
  const [title, setTitle] = useState('Admin Dashboard');
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [token, setToken] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const location = useLocation();
  const { adminEmail: paramAdminEmail } = useParams();

  useEffect(() => {
    const token = localStorage.getItem('token');
    setToken(token);
    if (token) {
      const decodedToken = jwtDecode(token);
      if (decodedToken && decodedToken.isAdmin) {
        setAdminEmail(decodedToken.email);
      }
    }
  }, []);

  useEffect(() => {
    if (paramAdminEmail) {
      setAdminEmail(paramAdminEmail);
    }
  }, [paramAdminEmail]);

  const handleItemClick = (newTitle) => {
    setTitle(newTitle);
  };

  const toggleAdminMenu = () => {
    setShowAdminMenu(!showAdminMenu);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  const isCreateOrAdmins = location.pathname.includes('/create') || location.pathname.includes('/admins');

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
        <li className={location.pathname === '/dashboard' ? 'active' : ''} onClick={() => handleItemClick('Dashboard')}>
          <Link to={`/dashboard/${adminEmail}`}>
            <FontAwesomeIcon icon={faChartBar} />
            <span style={{paddingLeft: '12px'}}>{t('dashboard')}</span>
          </Link>
        </li>
        <li className={location.pathname === '/products' ? 'active' : ''} onClick={() => handleItemClick('Products')}>
          <Link to={`/AdminProduct/${adminEmail}`}>
            <FontAwesomeIcon icon={faBox} />
            <span style={{paddingLeft: '15px'}}>{t('productsNav')}</span>
          </Link>
        </li>
        <li className={location.pathname === '/orders' ? 'active' : ''} onClick={() => handleItemClick('Orders')}>
          <Link to={`/adminorder/${adminEmail}`}>
            <FontAwesomeIcon icon={faClipboardList} />
            <span style={{paddingLeft: '17px'}}>{t('ordersNav')}</span>
          </Link>
        </li>
        <li className={location.pathname === '/farmer' ? 'active' : ''} onClick={() => handleItemClick('Farmers')}>
          <Link to={`/farmermanagement/${adminEmail}`}>
            <FontAwesomeIcon icon={faSeedling} />
            <span style={{paddingLeft: '12px'}}>{t('farmers')}</span>
          </Link>
        </li>
        <li className={location.pathname === '/customers' ? 'active' : ''} onClick={() => handleItemClick('Customers')}>
          <Link to={`/usermanagement/${adminEmail}`}>
            <FontAwesomeIcon icon={faUserFriends} />
            <span style={{paddingLeft: '7px'}}>{t('customers')}</span>
          </Link>
        </li>
        <li className="admin-dropdown" onClick={toggleAdminMenu}>
          <div>
            <FontAwesomeIcon icon={faUserCog} style={{ marginRight: '14px' }} />
            <span style={{paddingLeft: '4px'}}>{t('adminManagement')}</span>
            <FontAwesomeIcon icon={faAngleDown} className={showAdminMenu ? 'icon-rotate' : ''} />
          </div>
        </li>
        {showAdminMenu || isCreateOrAdmins ? (
          <li>
            <ul className="submenu">
              <li className={location.pathname === '/admins' ? 'active' : ''} onClick={() => handleItemClick('Admins')}>
                <Link to={`/admin_management/${adminEmail}`}>
                  <FontAwesomeIcon icon={faUserCircle} />
                  <span style={{paddingLeft: '-1px'}}>{t('admins')}</span>
                </Link>
              </li>
              <li className={location.pathname === '/create' ? 'active' : ''} onClick={() => handleItemClick('Create')}>
                <Link to={`/create/${adminEmail}`}>
                  <FontAwesomeIcon icon={faUserPlus} />
                  <span style={{paddingLeft: '-1px'}}>{t('create')}</span>
                </Link>
              </li>
            </ul>
          </li>
        ) : null}
        <li onClick={handleLogout} className="logout-button">
          <FontAwesomeIcon icon={faSignOutAlt} className="logout-icon" />
          <span style={{paddingLeft: '8px'}}>{t('logout')}</span>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
