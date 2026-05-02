import React, { useState, useEffect } from 'react';
import FarmerSidebar from '../../Components/Sidebar/FarmerSidebar';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const FarmerRiders = () => {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_BASE_URL = 'http://freshfarm-backend-env.eba-qnm4hc4g.ap-south-1.elasticbeanstalk.com';

  const fetchOnlineRiders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/delivery-partners/online`);
      const data = await response.json();
      if (response.ok) {
        setRiders(data);
      }
    } catch (err) {
      console.error('Failed to fetch online riders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnlineRiders();
    const interval = setInterval(fetchOnlineRiders, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f7f6' }}>
      <FarmerSidebar />
      <main style={{ flex: 1, padding: '30px', marginLeft: '20px' }}>
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#00AC7F', margin: 0 }}>Active Delivery Partners</h2>
          <p style={{ color: '#666' }}>See all online riders currently available for deliveries.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px', height: 'calc(100vh - 150px)' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
            <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {riders.map((rider, idx) => rider.current_lat && (
                <Marker key={idx} position={[rider.current_lat, rider.current_lng]}>
                  <Popup>
                    <div style={{ padding: '5px' }}>
                      <b style={{ color: '#00AC7F', fontSize: '14px' }}>{rider.full_name}</b><br/>
                      <span style={{ fontSize: '12px', color: '#666' }}>{rider.vehicle_type}</span><br/>
                      <a href={`tel:${rider.phone_number}`} style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold' }}>{rider.phone_number}</a>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div style={{ backgroundColor: '#fff', borderRadius: '15px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #eee', overflowY: 'auto' }}>
            <h4 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Online Now ({riders.length})</h4>
            {riders.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', marginTop: '50px' }}>No riders are online at the moment.</p>
            ) : (
              <div style={{ display: 'grid', gap: '15px' }}>
                {riders.map((rider, idx) => (
                  <div key={idx} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #f0f0f0', backgroundColor: '#fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ color: '#333' }}>{rider.full_name}</b>
                      <span style={{ fontSize: '11px', backgroundColor: '#e6fffa', color: '#00AC7F', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>ONLINE</span>
                    </div>
                    <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>{rider.vehicle_type} • {rider.vehicle_number}</p>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {rider.current_lat ? '📍 Location Active' : '⌛ Waiting for GPS...'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default FarmerRiders;
