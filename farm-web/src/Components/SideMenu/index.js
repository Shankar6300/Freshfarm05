import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

const SideMenu = () => {
    const { t } = useLanguage();

    return (
        <div className='SideMenu'
             style={{ width: '250px', backgroundColor: '#f0f0f0', padding: '20px' }}>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
                <li style={{ marginBottom: '10px' }}>
                    <a href="/dashboard" style={{ textDecoration: 'none', color: '#333' }}>
                        {t('dashboard')}
                    </a>
                </li>
                <li style={{ marginBottom: '10px' }}>
                    <a href="/products" style={{ textDecoration: 'none', color: '#333' }}>
                        {t('productsNav')}
                    </a>
                </li>
                <li style={{ marginBottom: '10px' }}>
                    <a href="/orders" style={{ textDecoration: 'none', color: '#333' }}>
                        {t('ordersNav')}
                    </a>
                </li>
                <li style={{ marginBottom: '10px' }}>
                    <a href="/customers" style={{ textDecoration: 'none', color: '#333' }}>
                        {t('customers')}
                    </a>
                </li>
                {/* Add more menu items as needed */}
            </ul>
        </div>
    );
};

export default SideMenu;
