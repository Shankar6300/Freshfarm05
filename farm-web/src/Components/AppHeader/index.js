import React from 'react';
import gg from '../../uss.png'; // Adjust the path to point to the root directory
import { useLanguage } from '../../context/LanguageContext';

function AppHeader() {
    const { language, setLanguage } = useLanguage();

    return (
        <div className="AppHeader" style={{ backgroundColor: '#fff', padding: '10px', display: 'flex', alignItems: 'center' }}>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'relative', marginRight: '20px' }}>
                    <img src={gg} alt="avatar" style={{ height: '50px', width: '50px', borderRadius: '50%' }} />
                </div>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ height: '36px', borderRadius: '8px', border: '1px solid #ddd', padding: '0 10px' }}>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="te">Telugu</option>
                </select>
            </div>
        </div>
    );
}

export default AppHeader;
