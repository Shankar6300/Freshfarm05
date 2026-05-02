import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faInstagram, faTwitter } from '@fortawesome/free-brands-svg-icons';
import './footer.css';
import Icon1 from '../../assets/images/icon-1.svg';
import Icon2 from '../../assets/images/icon-2.svg'
import Icon3 from '../../assets/images/icon-3.svg'
import Icon4 from '../../assets/images/icon-4.svg'
import Icon5 from '../../assets/images/icon-5.svg'
import { useLanguage } from '../../context/LanguageContext';

import { Link } from 'react-router-dom';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="footer">
      
      <div className='footerBoxes' style={{ display: 'flex' }}>
        <div className='col' style={{ flex: '1' }}>
          <div className='box d-flex align-items-center w-100'>
            <span><img src={Icon1} alt="Icon1" /></span>
            <div className='info'>
              <h4>{t('bestPrices')}</h4>
              <p>{t('orders50')}</p>
            </div>
          </div>
        </div>

        <div className='col' style={{ flex: '1' }}>
          <div className='box d-flex align-items-center w-100'>
            <span><img src={Icon2} alt="Icon2" /></span>
            <div className='info'>
              <h4>{t('freeDelivery')}</h4>
              <p>{t('orders50')}</p>
            </div>
          </div>
        </div>

        <div className='col' style={{ flex: '1' }}>
          <div className='box d-flex align-items-center w-100'>
            <span><img src={Icon3} alt="Icon3" /></span>
            <div className='info'>
              <h4>{t('greatDailyDeal')}</h4>
              <p>{t('orders50')}</p>
            </div>
          </div>
        </div>

        <div className='col' style={{ flex: '1' }}>
          <div className='box d-flex align-items-center w-100'>
            <span><img src={Icon4} alt="Icon4" /></span>
            <div className='info'>
              <h4>{t('wideAssortment')}</h4>
              <p>{t('orders50')}</p>
            </div>
          </div>
        </div>

        <div className='col' style={{ flex: '1' }}>
          <div className='box d-flex align-items-center w-100'>
            <span><img src={Icon5} alt="Icon5" /></span>
            <div className='info'>
              <h4>{t('easyReturns')}</h4>
              <p>{t('orders50')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-container">


        {/* Get Support Section */}
        <div className="get-support-section">
          <h3>{t('support')}</h3>
          <ul className="support-links">
            <li><a href="#">{t('helpCenter')}</a></li>
            <li><a href="#">{t('liveChat')}</a></li>
            <li><a href="#">{t('orderStatus')}</a></li>
            <li><a href="#">{t('refunds')}</a></li>
            <li><a href="#">{t('reportAbuse')}</a></li>
          </ul>
        </div>

        {/* Products Section */}
        <div className="product-categories">
          <h3>{t('productsSection')}</h3>
          <ul>
            <li>{t('fruits')}</li>
            <li>{t('vegetables')}</li>
            <li>{t('dairyProducts')}</li>
          </ul>
        </div>

        {/* Sell on Fresh Farms Section */}
        <div className="sell-on-fresh-farms">
          <h3>Work with Fresh Farms</h3>
          <ul className="sell-links">
            <li><Link to="/farmer_signup">{t('startSelling')}</Link></li>
            <li><Link to="/delivery-partner">Join as Delivery Partner</Link></li>
            <li><a href="#">{t('partnerships')}</a></li>
          </ul>
        </div>

        {/* Trade Assurance Section */}
        <div className="trade-assurance-section">
          <h3>{t('tradeAssurance')}</h3>
          <ul className="trade-assurance-links">
            <li>{t('safePayments')}</li>
            <li>{t('moneyBackPolicy')}</li>
            <li>{t('onTimeShipping')}</li>
            <li>{t('productMonitoring')}</li>
            <li>{t('cashOnDelivery')}</li>
          </ul>
        </div>

        {/* Get to Know Us Section */}
        <div className="get-to-know-us-section">
          <h3>{t('getToKnowUs')}</h3>
          {/* About Fresh Farms Link */}
          <a href="#" className="about-fresh-farms-link">
            {t('aboutFreshFarms')}
          </a>
        </div>



        {/* Connect with Us Section (Social Media Icons) */}
        <div className="connect-section">
          <h3>{t('connectWithUs')}</h3>
          {/* Social Media Icons */}
          <div className="social-icons">
            <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer">
              <FontAwesomeIcon icon={faFacebook} size="2x" style={{ color: '#3b5998' }} />
            </a>
            <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer">
              <FontAwesomeIcon icon={faInstagram} size="2x" style={{ color: '#e4405f' }} />
            </a>
            <a href="https://www.twitter.com" target="_blank" rel="noopener noreferrer">
              <FontAwesomeIcon icon={faTwitter} size="2x" style={{ color: '#1da1f2' }} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;