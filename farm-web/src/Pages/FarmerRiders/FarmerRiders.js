import React, { useState, useEffect } from 'react';
import FarmerSidebar from '../../Components/Sidebar/FarmerSidebar';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';

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
  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL?.replace(/\/$/, '') || 'https://d2pskbh3g9o3pk.cloudfront.net';

  const { farmerId } = useParams();
  const [socket, setSocket] = useState(null);
  const [activeRequest, setActiveRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

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

  useEffect(() => {
    const newSocket = io(API_BASE_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      if (farmerId) {
        newSocket.emit('register', farmerId);
      }
    });

    newSocket.on('request_accepted', (data) => {
      setActiveRequest(prev => ({ ...prev, status: 'accepted' }));
      setMessages(prev => [...prev, { text: 'Rider accepted the request. You can now chat.', sender: 'system' }]);
    });

    newSocket.on('receive_message', (data) => {
      setMessages(prev => [...prev, { text: data.text, sender: 'rider' }]);
    });

    newSocket.on('order_confirmed', (data) => {
      setActiveRequest(prev => ({ ...prev, status: 'confirmed' }));
      setMessages(prev => [...prev, { text: 'Rider has confirmed the pickup! They are on their way to you.', sender: 'system' }]);
    });

    newSocket.on('rider_location_update', (data) => {
      setRiders(prev => prev.map(r => r.email === data.riderEmail ? { ...r, current_lat: data.lat, current_lng: data.lng } : r));
    });

    return () => newSocket.close();
  }, [farmerId, API_BASE_URL]);

  const sendRequest = (rider) => {
    if (!socket || !farmerId) return alert('Cannot send request. Please ensure you are logged in properly.');
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const requestData = {
            farmerEmail: farmerId,
            riderEmail: rider.email,
            riderName: rider.full_name,
            farmerLat: position.coords.latitude,
            farmerLng: position.coords.longitude
          };
          socket.emit('request_rider', requestData);
          setActiveRequest({ riderEmail: rider.email, riderName: rider.full_name, status: 'pending' });
          setMessages([]);
        },
        (error) => {
          alert('Please allow location access so the rider knows where to pick up.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const sendMessage = () => {
    if (!chatInput.trim() || !socket || !activeRequest) return;
    const msgData = {
      toEmail: activeRequest.riderEmail,
      fromEmail: farmerId,
      text: chatInput,
      timestamp: new Date()
    };
    socket.emit('send_message', msgData);
    setMessages(prev => [...prev, { text: chatInput, sender: 'me' }]);
    setChatInput('');
  };

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
            {activeRequest ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '10px', backgroundColor: '#e6fffa', borderRadius: '10px', marginBottom: '15px', border: activeRequest.status === 'confirmed' ? '2px solid #00AC7F' : 'none' }}>
                  <h4 style={{ margin: 0, color: '#00AC7F' }}>Talking to {activeRequest.riderName}</h4>
                  <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
                    Status: {activeRequest.status === 'pending' ? 'Waiting for rider to accept...' : activeRequest.status === 'confirmed' ? '🚚 Order Confirmed! Watch the map.' : 'Accepted - You can now chat'}
                  </p>
                  <button onClick={() => setActiveRequest(null)} style={{ marginTop: '10px', padding: '5px 10px', border: '1px solid #ddd', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                    Close Chat
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', borderRadius: '10px', padding: '10px', marginBottom: '15px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {messages.map((msg, idx) => (
                    <div key={idx} style={{ alignSelf: msg.sender === 'me' ? 'flex-end' : (msg.sender === 'system' ? 'center' : 'flex-start'), backgroundColor: msg.sender === 'me' ? '#00AC7F' : (msg.sender === 'system' ? '#eee' : '#fff'), color: msg.sender === 'me' ? '#fff' : '#333', padding: '8px 12px', borderRadius: '15px', maxWidth: '80%', fontSize: '13px', border: msg.sender === 'rider' ? '1px solid #ddd' : 'none' }}>
                      {msg.text}
                    </div>
                  ))}
                  {messages.length === 0 && <p style={{ textAlign: 'center', color: '#999', fontSize: '12px', marginTop: '50px' }}>No messages yet.</p>}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '20px', outline: 'none' }} disabled={activeRequest.status === 'pending'} />
                  <button onClick={sendMessage} style={{ padding: '10px 20px', backgroundColor: '#00AC7F', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }} disabled={activeRequest.status === 'pending'}>Send</button>
                </div>
              </div>
            ) : (
              <>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                          <div style={{ fontSize: '12px', color: '#999' }}>
                            {rider.current_lat ? '📍 Location Active' : '⌛ Waiting for GPS...'}
                          </div>
                          <button onClick={() => sendRequest(rider)} style={{ padding: '6px 12px', backgroundColor: '#00AC7F', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                            Send Request
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default FarmerRiders;
