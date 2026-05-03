import React, { useEffect, useMemo, useState } from 'react';
import {
  faArrowLeft,
  faWallet,
  faChevronRight,
  faBagShopping,
  faHeadset,
  faHeart,
  faLocationDot,
  faUser,
  faTrash,
  faPlus
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { jwtDecode } from 'jwt-decode';
import { io } from 'socket.io-client';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Nav from '../Nav';
import { useLanguage } from '../context/LanguageContext';
import '../styles/customer-ui.css';

const API_BASE_URL = 'https://d2pskbh3g9o3pk.cloudfront.net';
const SOCKET_BASE_URL = 'https://d2pskbh3g9o3pk.cloudfront.net';

const ORDER_STEPS = ['pending', 'confirmed', 'packed', 'picked_up', 'out_for_delivery', 'delivered'];
const LIVE_TRACKING_STATUSES = new Set(['picked_up', 'out_for_delivery']);

const deliveryMarkerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const normalizeOrderStatus = (status) => String(status || 'pending').toLowerCase();

const getOrderStepIndex = (status) => {
  const normalized = normalizeOrderStatus(status);
  const index = ORDER_STEPS.indexOf(normalized);
  return index >= 0 ? index : 0;
};

const RecenterMap = ({ lat, lng }) => {
  const map = useMap();

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.setView([lat, lng]);
  }, [lat, lng, map]);

  return null;
};

const OrderLiveMap = ({ latitude, longitude, history }) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const current = [Number(latitude), Number(longitude)];
  const trail = Array.isArray(history) ? history.filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])) : [];

  return (
    <div style={{ marginBottom: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid #dbe5f0' }}>
      <MapContainer center={current} zoom={14} style={{ height: 220, width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        />
        <RecenterMap lat={current[0]} lng={current[1]} />
        {trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: '#0f766e', weight: 4, opacity: 0.8 }} />}
        <Marker position={current} icon={deliveryMarkerIcon} />
      </MapContainer>
    </div>
  );
};

const AccountPage = () => {
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('profile');
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', phone_number: '' });
  const [wallet, setWallet] = useState({ balance: 0 });
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportForm, setSupportForm] = useState({ subject: '', message: '' });
  const [referralData, setReferralData] = useState({ referral_code: '', invited_count: 0, earnings: 0 });
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    recipient_name: '',
    phone_number: '',
    address_line: '',
    is_default: 0
  });
  const [addAmount, setAddAmount] = useState('');
  const [locationHistoryByOrder, setLocationHistoryByOrder] = useState({});

  const [savedNotice, setSavedNotice] = useState('');
  const [chatMessages, setChatMessages] = useState({});
  const [chatInput, setChatInput] = useState('');

  const handleSendMessage = (orderId) => {
    if (!chatInput.trim()) return;
    
    const newMessage = { text: chatInput, sender: 'user' };
    setChatMessages((prev) => ({
      ...prev,
      [orderId]: [...(prev[orderId] || []), newMessage]
    }));
    
    const botReply = { text: `We have received your message regarding order #${orderId}. An agent will look into it shortly!`, sender: 'bot' };
    setChatInput('');
    
    setTimeout(() => {
      setChatMessages((prev) => ({
        ...prev,
        [orderId]: [...(prev[orderId] || []), botReply]
      }));
    }, 600);
  };

  const mergeOrderTrackingUpdate = (incomingUpdate) => {
    if (!incomingUpdate || incomingUpdate.orderId == null) return;

    setOrders((prevOrders) => {
      let changed = false;
      const nextOrders = prevOrders.map((existingOrder) => {
        if (String(existingOrder.orderId) !== String(incomingUpdate.orderId)) {
          return existingOrder;
        }

        changed = true;
        return {
          ...existingOrder,
          status: incomingUpdate.status || existingOrder.status,
          deliveryPartnerEmail: incomingUpdate.deliveryPartnerEmail ?? existingOrder.deliveryPartnerEmail,
          riderLatitude: Number.isFinite(Number(incomingUpdate.riderLatitude)) ? Number(incomingUpdate.riderLatitude) : existingOrder.riderLatitude,
          riderLongitude: Number.isFinite(Number(incomingUpdate.riderLongitude)) ? Number(incomingUpdate.riderLongitude) : existingOrder.riderLongitude,
          riderEtaMinutes: incomingUpdate.riderEtaMinutes ?? existingOrder.riderEtaMinutes
        };
      });

      return changed ? nextOrders : prevOrders;
    });

    if (Number.isFinite(Number(incomingUpdate.riderLatitude)) && Number.isFinite(Number(incomingUpdate.riderLongitude))) {
      const lat = Number(incomingUpdate.riderLatitude);
      const lng = Number(incomingUpdate.riderLongitude);

      setLocationHistoryByOrder((prevHistory) => {
        const orderKey = String(incomingUpdate.orderId);
        const existingTrail = Array.isArray(prevHistory[orderKey]) ? prevHistory[orderKey] : [];
        const lastPoint = existingTrail[existingTrail.length - 1];
        if (lastPoint && Number(lastPoint[0]).toFixed(6) === lat.toFixed(6) && Number(lastPoint[1]).toFixed(6) === lng.toFixed(6)) {
          return prevHistory;
        }

        return {
          ...prevHistory,
          [orderKey]: [...existingTrail, [lat, lng]].slice(-60)
        };
      });
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const decoded = jwtDecode(token);
      if (decoded?.isAdmin || decoded?.isFarmer) {
        setLoading(false);
        return;
      }

      let decodedUserId = Number(decoded?.userId);
      if (!decodedUserId && Number.isFinite(Number(decoded?.email))) {
        decodedUserId = Number(decoded?.email);
      } else if (!decodedUserId && typeof decoded?.email === 'string') {
        // Fallback: we have an email but no integer ID yet in this component.
        // We will call a new endpoint to get the profile by email.
        decodedUserId = decoded.email;
      }

      if (!decodedUserId) {
        setLoading(false);
        return;
      }

      setUserId(decodedUserId);
    } catch (err) {
      setLoading(false);
    }
  }, []);

  const fetchAccountData = async (currentUserId) => {
    try {
      const [profileRes, walletRes, ordersRes, addressesRes, supportRes, referralRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/account/profile/${currentUserId}`),
        fetch(`${API_BASE_URL}/api/account/wallet/${currentUserId}`),
        fetch(`${API_BASE_URL}/api/account/orders/${currentUserId}`),
        fetch(`${API_BASE_URL}/api/account/addresses/${currentUserId}`),
        fetch(`${API_BASE_URL}/api/account/support/${currentUserId}`),
        fetch(`${API_BASE_URL}/api/account/referral/${currentUserId}`)
      ]);

      const profileData = profileRes.ok ? await profileRes.json() : null;
      const walletData = walletRes.ok ? await walletRes.json() : { balance: 0 };
      const ordersData = ordersRes.ok ? await ordersRes.json() : [];
      const addressesData = addressesRes.ok ? await addressesRes.json() : [];
      const supportData = supportRes.ok ? await supportRes.json() : [];
      const referralApiData = referralRes.ok ? await referralRes.json() : { referral_code: '', invited_count: 0, earnings: 0 };

      if (profileData) {
        setForm({
          name: profileData.name || '',
          email: profileData.email || '',
          phone_number: profileData.phone_number || ''
        });
      }

      setWallet({ balance: Number(walletData.balance || 0) });
      const normalizedOrders = Array.isArray(ordersData) ? ordersData : [];
      setOrders(normalizedOrders);

      const seededHistory = {};
      normalizedOrders.forEach((order) => {
        if (Number.isFinite(order.riderLatitude) && Number.isFinite(order.riderLongitude)) {
          seededHistory[String(order.orderId)] = [[Number(order.riderLatitude), Number(order.riderLongitude)]];
        }
      });
      setLocationHistoryByOrder(seededHistory);

      setAddresses(Array.isArray(addressesData) ? addressesData : []);
      setSupportTickets(Array.isArray(supportData) ? supportData : []);
      setReferralData({
        referral_code: referralApiData.referral_code || '',
        invited_count: Number(referralApiData.invited_count || 0),
        earnings: Number(referralApiData.earnings || 0)
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetchAccountData(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const socket = io(SOCKET_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('order:tracking', (update) => {
      mergeOrderTrackingUpdate(update);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  const tabs = useMemo(
    () => [
      { key: 'orders', label: t('myOrders'), icon: faBagShopping },
      { key: 'support', label: t('customerSupport'), icon: faHeadset },
      { key: 'referrals', label: t('manageReferrals'), icon: faHeart },
      { key: 'addresses', label: t('addresses'), icon: faLocationDot },
      { key: 'profile', label: t('accountProfile'), icon: faUser },
      { key: 'logout', label: t('logout') || 'Logout', icon: faArrowLeft }
    ],
    [t]
  );

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/account/orders/${orderId}/cancel`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchAccountData(userId);
      } else {
        alert('Could not cancel order. It may have already been processed.');
      }
    } catch (err) {
      console.error('Cancel order failed', err);
    }
  };

  const [openChatbotOrderId, setOpenChatbotOrderId] = useState(null);

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSavedNotice('');
  };

  const handleProfileSubmit = (event) => {
    event.preventDefault();

    if (!userId) return;

    fetch(`${API_BASE_URL}/api/account/profile/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        setSavedNotice(t('profileSaved'));
      })
      .catch(() => {
        setSavedNotice(t('profileSaveFailed'));
      });
  };

  const handleAddressSubmit = async (event) => {
    event.preventDefault();
    if (!userId) return;

    const response = await fetch(`${API_BASE_URL}/api/account/addresses/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addressForm)
    });

    if (response.ok) {
      setAddressForm({
        label: 'Home',
        recipient_name: '',
        phone_number: '',
        address_line: '',
        is_default: 0
      });
      fetchAccountData(userId);
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!userId) return;
    const response = await fetch(`${API_BASE_URL}/api/account/addresses/${userId}/${addressId}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      fetchAccountData(userId);
    }
  };

  const handleAddBalance = async () => {
    if (!userId) return;
    const amount = Number(addAmount);
    if (!amount || amount <= 0) return;

    const response = await fetch(`${API_BASE_URL}/api/account/wallet/${userId}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    if (response.ok) {
      const data = await response.json();
      setWallet({ balance: Number(data.balance || 0) });
      setAddAmount('');
    }
  };

  const handleSupportSubmit = async (event) => {
    event.preventDefault();
    if (!userId) return;
    if (!supportForm.subject || !supportForm.message) return;

    const response = await fetch(`${API_BASE_URL}/api/account/support/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supportForm)
    });

    if (response.ok) {
      setSupportForm({ subject: '', message: '' });
      fetchAccountData(userId);
    }
  };

  const handleMockInvite = async () => {
    if (!userId) return;
    const response = await fetch(`${API_BASE_URL}/api/account/referral/${userId}/mock-invite`, { method: 'POST' });
    if (response.ok) {
      const data = await response.json();
      setReferralData({
        referral_code: data.referral_code || '',
        invited_count: Number(data.invited_count || 0),
        earnings: Number(data.earnings || 0)
      });
    }
  };

  const renderOrderTracking = (status) => {
    const activeIndex = getOrderStepIndex(status);
    const isCancelled = normalizeOrderStatus(status) === 'cancelled';

    if (isCancelled) {
      return (
        <div style={{ margin: '10px 0 14px', padding: '10px 12px', borderRadius: '14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontWeight: 'bold', textAlign: 'center' }}>
          🚫 Order Cancelled
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '8px', margin: '10px 0 14px', padding: '10px 12px', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        {ORDER_STEPS.map((step, index) => {
          const isComplete = index <= activeIndex;
          const label = step
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

          return (
            <div
              key={step}
              style={{
                display: 'grid',
                justifyItems: 'center',
                gap: '6px',
                color: isComplete ? '#0f766e' : '#94a3b8',
                textAlign: 'center'
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '999px',
                  background: isComplete ? '#0f766e' : '#cbd5e1',
                  boxShadow: isComplete ? '0 0 0 4px rgba(15, 118, 110, 0.12)' : '0 0 0 4px rgba(148, 163, 184, 0.12)'
                }}
              />
              <span style={{ fontSize: '11px', lineHeight: 1.3, fontWeight: 700 }}>{label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderRightPanel = () => {
    if (activeTab === 'orders') {
      return (
        <div className="ff-account-section-card">
          <h3>{t('myOrders')}</h3>
          {orders.length === 0 && <p>{t('ordersComingSoon')}</p>}
          {orders.map((order) => (
            <div key={order.orderId} className="ff-order-card">
              <div className="ff-order-head">
                <strong>{t('orderId')}: #{order.orderId}</strong>
                <span>{order.status || t('orderStatus')}</span>
              </div>
              {renderOrderTracking(order.status)}
              {order.deliveryPartnerEmail && (
                <p style={{ margin: '0 0 8px', color: '#334155', fontWeight: 600 }}>
                  Delivery partner: {order.deliveryPartnerEmail}
                  {Number.isFinite(order.riderEtaMinutes) && order.riderEtaMinutes >= 0 ? ` | ETA: ${order.riderEtaMinutes} min` : ''}
                </p>
              )}
              {Number.isFinite(order.riderLatitude) && Number.isFinite(order.riderLongitude) && LIVE_TRACKING_STATUSES.has(normalizeOrderStatus(order.status)) && (
                <OrderLiveMap
                  latitude={Number(order.riderLatitude)}
                  longitude={Number(order.riderLongitude)}
                  history={locationHistoryByOrder[String(order.orderId)]}
                />
              )}
              {Number.isFinite(order.riderLatitude) && Number.isFinite(order.riderLongitude) && (
                <a
                  href={`https://www.google.com/maps?q=${order.riderLatitude},${order.riderLongitude}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-block', marginBottom: 8, fontWeight: 700, color: '#0f766e' }}
                >
                  View rider live location
                </a>
              )}
              <div className="ff-order-items">
                {(order.items || []).map((item, index) => (
                  <p key={`${order.orderId}-${index}`}>
                    {item.productName} x {item.quantity}
                  </p>
                ))}
              </div>
              <div className="ff-order-total">{t('total')}: {t('currencySymbol')}{order.totalPrice}</div>
              
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {(normalizeOrderStatus(order.status) === 'pending' || normalizeOrderStatus(order.status) === 'confirmed') && (
                  <button onClick={() => handleCancelOrder(order.orderId)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #ef4444', background: '#fef2f2', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}>
                    Cancel Order
                  </button>
                )}
                <button onClick={() => setOpenChatbotOrderId(openChatbotOrderId === order.orderId ? null : order.orderId)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0f766e', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                  Help with this Order
                </button>
              </div>

              {openChatbotOrderId === order.orderId && (
                <div style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 10px', color: '#0f172a' }}>Real-time Support</h4>
                  <div style={{ height: '150px', overflowY: 'auto', background: 'white', borderRadius: '8px', padding: '10px', border: '1px solid #e2e8f0', marginBottom: '10px', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ alignSelf: 'flex-start', background: '#f1f5f9', padding: '8px 12px', borderRadius: '12px', maxWidth: '80%' }}>
                      <p style={{ margin: 0, color: '#334155' }}>🤖 Hi! How can I help you with order #{order.orderId}?</p>
                    </div>
                    {(chatMessages[order.orderId] || []).map((msg, idx) => (
                      <div key={idx} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', background: msg.sender === 'user' ? '#0f766e' : '#f1f5f9', color: msg.sender === 'user' ? 'white' : '#334155', padding: '8px 12px', borderRadius: '12px', maxWidth: '80%' }}>
                        <p style={{ margin: 0 }}>{msg.sender === 'bot' ? '🤖 ' : ''}{msg.text}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Type your message..." 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(order.orderId)}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} 
                    />
                    <button onClick={() => handleSendMessage(order.orderId)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0f766e', color: 'white', cursor: 'pointer' }}>Send</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'support') {
      return (
        <div className="ff-account-section-card">
          <h3>{t('customerSupport')}</h3>
          <p>{t('supportHelpText')}</p>
          <form className="ff-support-form" onSubmit={handleSupportSubmit}>
            <input
              value={supportForm.subject}
              onChange={(event) => setSupportForm((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder={t('supportSubject')}
              required
            />
            <textarea
              value={supportForm.message}
              onChange={(event) => setSupportForm((prev) => ({ ...prev, message: event.target.value }))}
              placeholder={t('supportMessage')}
              rows={4}
              required
            />
            <button type="submit" className="ff-account-submit-btn">{t('submitTicket')}</button>
          </form>

          <div className="ff-support-ticket-list">
            {supportTickets.map((ticket) => (
              <div key={ticket.id} className="ff-support-ticket-card">
                <div className="ff-support-ticket-head">
                  <strong>{ticket.subject}</strong>
                  <span>{ticket.status}</span>
                </div>
                <p>{ticket.message}</p>
              </div>
            ))}
            {!supportTickets.length && <p>{t('noSupportTickets')}</p>}
          </div>
        </div>
      );
    }

    if (activeTab === 'referrals') {
      return (
        <div className="ff-account-section-card">
          <h3>{t('manageReferrals')}</h3>
          <p>{t('referralHelpText')}</p>
          <div className="ff-referral-card">
            <p><strong>{t('referralCode')}:</strong> {referralData.referral_code || '-'}</p>
            <p><strong>{t('invitedFriends')}:</strong> {referralData.invited_count}</p>
            <p><strong>{t('referralEarnings')}:</strong> {t('currencySymbol')}{referralData.earnings.toFixed(2)}</p>
            <button type="button" className="ff-account-submit-btn" onClick={handleMockInvite}>
              {t('simulateReferral')}
            </button>
          </div>
        </div>
      );
    }

    if (activeTab === 'addresses') {
      return (
        <div className="ff-account-section-card">
          <h3>{t('addresses')}</h3>
          <p>{t('addressHelpText')}</p>
          <form className="ff-address-form" onSubmit={handleAddressSubmit}>
            <input
              value={addressForm.label}
              onChange={(event) => setAddressForm((prev) => ({ ...prev, label: event.target.value }))}
              placeholder={t('addressLabel')}
            />
            <input
              value={addressForm.recipient_name}
              onChange={(event) => setAddressForm((prev) => ({ ...prev, recipient_name: event.target.value }))}
              placeholder={t('name')}
              required
            />
            <input
              value={addressForm.phone_number}
              onChange={(event) => setAddressForm((prev) => ({ ...prev, phone_number: event.target.value }))}
              placeholder={t('phoneNumber')}
              required
            />
            <input
              value={addressForm.address_line}
              onChange={(event) => setAddressForm((prev) => ({ ...prev, address_line: event.target.value }))}
              placeholder={t('addressDetails')}
              required
            />
            <label className="ff-checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(addressForm.is_default)}
                onChange={(event) => setAddressForm((prev) => ({ ...prev, is_default: event.target.checked ? 1 : 0 }))}
              />
              {t('setDefaultAddress')}
            </label>
            <button type="submit" className="ff-account-submit-btn">{t('saveAddress')}</button>
          </form>

          <div className="ff-address-list">
            {addresses.map((address) => (
              <div key={address.id} className="ff-address-card">
                <div>
                  <strong>{address.label}</strong>
                  <p>{address.recipient_name} - {address.phone_number}</p>
                  <p>{address.address_line}</p>
                </div>
                <button type="button" onClick={() => handleDeleteAddress(address.id)}>{t('remove')}</button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="ff-account-profile-wrap">
        <div className="ff-account-panel-title">
          <FontAwesomeIcon icon={faArrowLeft} />
          <h3>{t('accountProfile')}</h3>
        </div>

        <form onSubmit={handleProfileSubmit} className="ff-account-form">
          <label htmlFor="profileName">{t('name')}</label>
          <input
            id="profileName"
            value={form.name}
            onChange={(event) => handleFormChange('name', event.target.value)}
            placeholder={t('name')}
            required
          />

          <label htmlFor="profileEmail">{t('email')}</label>
          <input
            id="profileEmail"
            type="email"
            value={form.email}
            onChange={(event) => handleFormChange('email', event.target.value)}
            placeholder={t('email')}
            required
          />

          <label htmlFor="profilePhone">{t('phoneNumber')}</label>
          <input
            id="profilePhone"
            value={form.phone_number}
            onChange={(event) => handleFormChange('phone_number', event.target.value)}
            placeholder={t('phoneNumber')}
          />

          <p className="ff-account-note">{t('noSpamPromise')}</p>

          <button type="submit" className="ff-account-submit-btn">
            {t('submit')}
          </button>

          {savedNotice && <p className="ff-account-success">{savedNotice}</p>}
        </form>

        <div className="ff-account-delete-block">
          <h4>
            <FontAwesomeIcon icon={faTrash} /> {t('deleteAccount')}
          </h4>
          <p>{t('deleteAccountNote')}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="ff-page">
      <Nav />
      {loading && <main className="ff-account-page"><section className="ff-account-content-panel"><p>{t('loading')}</p></section></main>}
      {!loading && (
      <main className="ff-account-page">
        <section className="ff-account-sidebar-panel">
          <div className="ff-account-user-block">
            <div className="ff-account-avatar">
              <FontAwesomeIcon icon={faUser} />
            </div>
            <div>
              <h2>{form.name || t('customerNameFallback')}</h2>
              <p>{t('phoneNumber')}: {form.phone_number || '-'}</p>
            </div>
          </div>

          <div className="ff-wallet-card">
            <div className="ff-wallet-top">
              <div>
                <FontAwesomeIcon icon={faWallet} /> {t('walletTitle')}
              </div>
              <FontAwesomeIcon icon={faChevronRight} />
            </div>
            <div className="ff-wallet-bottom">
              <span>{t('availableBalance')}: {t('currencySymbol')}{wallet.balance.toFixed(2)}</span>
              <div className="ff-wallet-actions">
                <input
                  value={addAmount}
                  onChange={(event) => setAddAmount(event.target.value)}
                  type="number"
                  min="1"
                  placeholder={t('amount')}
                />
                <button type="button" onClick={handleAddBalance}>
                <FontAwesomeIcon icon={faPlus} /> {t('addBalance')}
                </button>
              </div>
            </div>
          </div>

          <nav className="ff-account-menu-list">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? 'active' : ''}
                onClick={() => {
                  if (tab.key === 'logout') {
                    handleLogout();
                  } else {
                    setActiveTab(tab.key);
                  }
                }}
              >
                <FontAwesomeIcon icon={tab.icon} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </section>

        <section className="ff-account-content-panel">{renderRightPanel()}</section>
      </main>
      )}
    </div>
  );
};

export default AccountPage;
