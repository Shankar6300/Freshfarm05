import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight,
  faMotorcycle,
  faTruck,
  faShieldHeart,
  faLocationDot,
  faIdCard,
  faFileLines,
  faCircleCheck,
  faMapMarkerAlt,
  faRoute,
  faPowerOff,
  faComments,
  faCircle
} from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../../context/LanguageContext';
import { jwtDecode } from 'jwt-decode';

const API_BASE_URL = 'https://d2pskbh3g9o3pk.cloudfront.net';

const ACTIVE_ASSIGNMENT_STATUSES = new Set(['accepted', 'picked_up', 'out_for_delivery']);

const VEHICLE_FLEET = [
  { label: 'Two Wheeler', rank: 2, maxQuantity: 5, detail: 'Best for light baskets and short hops.' },
  { label: 'Three Wheeler', rank: 3, maxQuantity: 12, detail: 'Useful for medium grocery bundles.' },
  { label: 'Four Wheeler', rank: 4, maxQuantity: 24, detail: 'Good for boxed produce and larger drops.' },
  { label: 'Six Wheeler', rank: 6, maxQuantity: 40, detail: 'Fits bulk farm bags and larger market loads.' },
  { label: '12 Wheeler Truck', rank: 12, maxQuantity: 80, detail: 'For city-to-city bulk movement and heavy orders.' },
  { label: '14 Wheeler Truck', rank: 14, maxQuantity: Infinity, detail: 'Best for warehouse-scale movement.' },
  { label: 'Other', rank: 0, maxQuantity: Infinity, detail: 'Custom vehicle or special transport.' }
];

const WORKFLOW_STEPS = [
  { key: 'packed', title: 'Farmer packs the order', detail: 'The order is confirmed and prepared for pickup.' },
  { key: 'matched', title: 'Nearest eligible rider is matched', detail: 'We shortlist riders by quantity, vehicle fit, and service area.' },
  { key: 'picked_up', title: 'Rider picks up from farmer', detail: 'The rider receives pickup details and starts navigation.' },
  { key: 'out_for_delivery', title: 'Rider heads to customer', detail: 'Customer tracking starts with ETA and live movement.' },
  { key: 'delivered', title: 'Order delivered', detail: 'The trip is closed and the status is completed.' }
];

const DASHBOARD_BENEFITS = [
  'Flexible shifts and online/offline control',
  'Vehicle-aware order matching',
  'Farmer, rider, and customer status sync',
  'Live map updates once the trip starts'
];

const normalizeVehicleLabel = (value) => String(value || '').trim().toLowerCase();

const getVehicleRank = (value) => {
  const normalized = normalizeVehicleLabel(value);
  if (!normalized) return 0;
  if (normalized.includes('14')) return 14;
  if (normalized.includes('12')) return 12;
  if (normalized.includes('six')) return 6;
  if (normalized.includes('four')) return 4;
  if (normalized.includes('three') || normalized.includes('auto')) return 3;
  if (normalized.includes('two') || normalized.includes('bike') || normalized.includes('scooter') || normalized.includes('cycle')) return 2;
  return 0;
};

const getRequiredVehicleTier = (totalQuantity) => {
  const quantity = Math.max(0, Number(totalQuantity || 0));
  if (quantity <= 5) return VEHICLE_FLEET[0];
  if (quantity <= 12) return VEHICLE_FLEET[1];
  if (quantity <= 24) return VEHICLE_FLEET[2];
  if (quantity <= 40) return VEHICLE_FLEET[3];
  if (quantity <= 80) return VEHICLE_FLEET[4];
  return VEHICLE_FLEET[5];
};

const estimateEtaMinutes = (quantity, assignmentStatus, vehicleType) => {
  const vehicleRank = getVehicleRank(vehicleType) || 2;
  const base = Number(assignmentStatus === 'accepted' ? 10 : assignmentStatus === 'picked_up' ? 15 : 20);
  const loadFactor = Math.ceil(Math.max(0, Number(quantity || 0)) / Math.max(1, vehicleRank * 2));
  return Math.max(6, base + loadFactor * 2);
};

const formatOrderStep = (value) =>
  String(value || 'pending')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const VEHICLE_OPTIONS = [
  'Two Wheeler',
  'Three Wheeler',
  'Four Wheeler',
  'Six Wheeler',
  '12 Wheeler Truck',
  '14 Wheeler Truck',
  'Mini Truck',
  'Pickup Van',
  'Other'
];

const AVAILABILITY_OPTIONS = ['Full Time', 'Part Time', 'Weekends', 'Night Shift'];

const statusLabel = (value) =>
  String(value || 'offered')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const DeliveryPartnerApplication = () => {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [riderData, setRiderData] = useState(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    vehicleType: 'Two Wheeler',
    vehicleNumber: '',
    capacityKg: '',
    rcNumber: '',
    licenseNumber: '',
    aadhaarNumber: '',
    serviceArea: '',
    availability: 'Full Time'
  });
  const [files, setFiles] = useState({
    rc_photo: null,
    license_photo: null,
    aadhaar_photo: null,
    owner_vehicle_photo: null,
    person_photo: null
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [regStep, setRegStep] = useState(1);
  const [isOnline, setIsOnline] = useState(false);
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [showChat, setShowChat] = useState(false);
  const [activeChatOrder, setActiveChatOrder] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef(null);

  const locationWatchRef = useRef(null);
  const activeAssignments = useMemo(
    () => offers.filter((offer) => ACTIVE_ASSIGNMENT_STATUSES.has(String(offer.assignment_status || '').toLowerCase())),
    [offers]
  );

  const dashboardStats = useMemo(() => {
    const totalOffers = offers.length;
    const offeredCount = offers.filter((offer) => String(offer.assignment_status || '').toLowerCase() === 'offered').length;
    const activeCount = activeAssignments.length;
    const completedCount = offers.filter((offer) => String(offer.assignment_status || '').toLowerCase() === 'delivered').length;
    const estimatedEarnings = offers
      .filter((offer) => String(offer.assignment_status || '').toLowerCase() !== 'rejected')
      .reduce((sum, offer) => sum + Number(offer.delivery_fee || 0), 0);

    return { totalOffers, offeredCount, activeCount, completedCount, estimatedEarnings };
  }, [offers, activeAssignments]);

  // 1. Auth and Profile Fetch
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const decoded = jwtDecode(token);
        if (!decoded.isRider) {
          alert('Access denied. This page is for delivery partners only.');
          navigate('/login');
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/delivery-partners/${encodeURIComponent(decoded.email)}`);
        if (!response.ok) throw new Error('Profile not found');
        const data = await response.json();
        
        setRiderData(data);
        setIsOnline(!!data.is_online);
        
        // Check if registration is complete
        if (!data.vehicle_type || !data.license_number) {
          setNeedsRegistration(true);
          setForm({
            fullName: data.full_name || '',
            phoneNumber: data.phone_number || '',
            vehicleType: data.vehicle_type || 'Two Wheeler',
            vehicleNumber: data.vehicle_number || '',
            capacityKg: data.capacity_kg || '',
            rcNumber: data.rc_number || '',
            licenseNumber: data.license_number || '',
            aadhaarNumber: '',
            serviceArea: data.service_area || '',
            availability: data.availability || 'Full Time'
          });
        }
      } catch (err) {
        console.error(err);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  // 2. Job Fetching (Polled if online)
  useEffect(() => {
    let interval;
    if (riderData && isOnline && !needsRegistration) {
      loadOffers();
      interval = setInterval(loadOffers, 10000); // Every 10 seconds
    }
    return () => clearInterval(interval);
  }, [riderData, isOnline, needsRegistration]);

  const loadOffers = async () => {
    if (!riderData?.email) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/delivery-partners/${encodeURIComponent(riderData.email)}/offers`);
      const data = await response.json();
      if (response.ok) setOffers(data);
    } catch (err) {
      console.error('Failed to load jobs');
    }
  };

  const handleToggleOnline = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    try {
      await fetch(`${API_BASE_URL}/api/delivery-partners/${encodeURIComponent(riderData.email)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline: newStatus })
      });

      if (newStatus) {
        if (activeAssignments.length > 0) {
          startLocationTracking();
        }
      } else {
        stopLocationTracking();
      }
    } catch (err) {
      console.error('Failed to update online status');
    }
  };

  const pushLocationUpdate = (latitude, longitude) => {
    if (!riderData?.email || activeAssignments.length === 0) return;

    activeAssignments.forEach((assignment) => {
      const etaMinutes = estimateEtaMinutes(assignment.total_quantity, assignment.assignment_status, riderData.vehicle_type);
      fetch(`${API_BASE_URL}/api/delivery-partners/${encodeURIComponent(riderData.email)}/orders/${assignment.order_id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude, etaMinutes })
      }).catch((err) => console.error('Location sync failed', err));
    });
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) return;
    
    const sendLocation = (pos) => {
      const { latitude, longitude } = pos.coords;
      pushLocationUpdate(latitude, longitude);
    };

    navigator.geolocation.getCurrentPosition(sendLocation);
    locationWatchRef.current = navigator.geolocation.watchPosition(sendLocation, (err) => console.error(err), {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 27000
    });
  };

  const stopLocationTracking = () => {
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
  };

  useEffect(() => {
    if (isOnline && riderData && !needsRegistration && activeAssignments.length > 0) {
      startLocationTracking();
    }
    return () => stopLocationTracking();
  }, [isOnline, riderData, needsRegistration, activeAssignments.length]);

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      // append form fields
      Object.entries(form).forEach(([k, v]) => {
        formData.append(k, v == null ? '' : v);
      });
      // append files
      Object.entries(files).forEach(([k, v]) => {
        if (v) formData.append(k, v);
      });

      const response = await fetch(`${API_BASE_URL}/api/delivery-partners/${encodeURIComponent(riderData.email)}/upload-docs`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setNeedsRegistration(false);
        setRiderData({ ...riderData, ...form });
        alert('Registration complete! You can now go online to receive orders.');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update profile');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const acceptOffer = async (assignmentId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/delivery-partners/${encodeURIComponent(riderData.email)}/offers/${assignmentId}/accept`, {
        method: 'POST'
      });
      if (response.ok) {
        loadOffers();
        alert('Job accepted!');
      } else {
        const data = await response.json();
        alert(data.error || 'Offer no longer available');
      }
    } catch (err) {
      alert('Error accepting offer');
    }
  };

  // 3. Chat Logic
  useEffect(() => {
    let interval;
    if (showChat && activeChatOrder) {
      fetchMessages();
      interval = setInterval(fetchMessages, 3000);
    }
    return () => clearInterval(interval);
  }, [showChat, activeChatOrder]);

  const fetchMessages = async () => {
    if (!activeChatOrder) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats/${activeChatOrder.order_id}`);
      const data = await response.json();
      if (response.ok) setChatMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages');
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChatOrder) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activeChatOrder.order_id,
          senderRole: 'rider',
          message: newMessage
        })
      });
      if (response.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (err) {
      console.error('Failed to send message');
    }
  };

  const updateJobStatus = async (orderId, status) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/delivery-partners/${encodeURIComponent(riderData.email)}/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (response.ok) loadOffers();
    } catch (err) {
      console.error('Status update failed');
    }
  };

  if (loading) return <div style={loaderStyle}>Checking status...</div>;

  if (needsRegistration) {
    const nextStep = () => setRegStep((s) => Math.min(3, s + 1));
    const prevStep = () => setRegStep((s) => Math.max(1, s - 1));

    return (
      <div style={containerStyle}>
        <header style={headerStyle}>
           <img src={require('../../uss.png')} alt="FreshFarm" style={{ height: 40 }} />
           <h2 style={{ color: '#00AC7F', margin: 0 }}>Complete Your Profile</h2>
           <button onClick={() => { localStorage.removeItem('token'); navigate('/login'); }} style={logoutStyle}>Logout</button>
        </header>
        <main style={{ maxWidth: '900px', margin: '24px auto', padding: '0 20px' }}>
          <div style={cardStyle}>
            <h3>Complete onboarding</h3>
            <p style={{ marginTop: 0 }}>We'll collect vehicle details, ID documents, and a quick review before you can go online.</p>

            <div style={{ display: 'flex', gap: 8, margin: '18px 0' }}>
              {[1,2,3].map((s) => (
                <div key={s} style={{ flex: 1, padding: '8px', borderRadius: 8, textAlign: 'center', background: regStep === s ? '#00AC7F' : '#f1f5f9', color: regStep === s ? '#fff' : '#64748b' }}>
                  {s === 1 ? 'Vehicle' : s === 2 ? 'Documents' : 'Review'}
                </div>
              ))}
            </div>

            <form onSubmit={handleCompleteRegistration} style={{ display: 'grid', gap: '20px' }}>
              {regStep === 1 && (
                <div>
                  <div style={grid2Style}>
                    <Field label="Vehicle Category">
                      <select value={form.vehicleType} onChange={(e) => setForm({...form, vehicleType: e.target.value})} style={inputStyle}>
                        {VEHICLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Vehicle Registration Number">
                      <input value={form.vehicleNumber} onChange={(e) => setForm({...form, vehicleNumber: e.target.value})} placeholder="e.g. KA 01 XY 1234" required style={inputStyle} />
                    </Field>
                    <Field label="Load Capacity (kg)">
                      <input type="number" value={form.capacityKg} onChange={(e) => setForm({...form, capacityKg: e.target.value})} required style={inputStyle} />
                    </Field>
                    <Field label="RC Number">
                      <input value={form.rcNumber} onChange={(e) => setForm({...form, rcNumber: e.target.value})} required style={inputStyle} />
                    </Field>
                    <Field label="License Number">
                      <input value={form.licenseNumber} onChange={(e) => setForm({...form, licenseNumber: e.target.value})} required style={inputStyle} />
                    </Field>
                    <Field label="Service Area">
                      <input value={form.serviceArea} onChange={(e) => setForm({...form, serviceArea: e.target.value})} placeholder="e.g. Koramangala, Bangalore" required style={inputStyle} />
                    </Field>
                  </div>
                </div>
              )}

              {regStep === 2 && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <Field label="Aadhaar Number">
                    <input type="password" value={form.aadhaarNumber} onChange={(e) => setForm({...form, aadhaarNumber: e.target.value})} placeholder="Enter Aadhaar number" required style={inputStyle} />
                  </Field>
                  <Field label="RC Photo">
                    <input type="file" accept="image/*" onChange={(e) => setFiles({...files, rc_photo: e.target.files[0]})} />
                  </Field>
                  <Field label="License Photo">
                    <input type="file" accept="image/*" onChange={(e) => setFiles({...files, license_photo: e.target.files[0]})} />
                  </Field>
                  <Field label="Aadhaar / ID Photo">
                    <input type="file" accept="image/*" onChange={(e) => setFiles({...files, aadhaar_photo: e.target.files[0]})} />
                  </Field>
                  <Field label="Photo with vehicle">
                    <input type="file" accept="image/*" onChange={(e) => setFiles({...files, owner_vehicle_photo: e.target.files[0]})} />
                  </Field>
                  <Field label="Person Photo">
                    <input type="file" accept="image/*" onChange={(e) => setFiles({...files, person_photo: e.target.files[0]})} />
                  </Field>
                </div>
              )}

              {regStep === 3 && (
                <div>
                  <h4>Review details</h4>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div><strong>Full name:</strong> {form.fullName || riderData.full_name}</div>
                    <div><strong>Phone:</strong> {form.phoneNumber || riderData.phone_number}</div>
                    <div><strong>Vehicle:</strong> {form.vehicleType}</div>
                    <div><strong>Vehicle number:</strong> {form.vehicleNumber}</div>
                    <div><strong>Capacity:</strong> {form.capacityKg} kg</div>
                    <div><strong>Service area:</strong> {form.serviceArea}</div>
                    <div style={{ marginTop: 12 }}>
                      <small style={{ color: '#64748b' }}>You'll upload documents and we will verify them before approving your account.</small>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                {regStep > 1 && <button type="button" onClick={prevStep} style={{ ...statusButtonStyle, background: '#fff' }}>Back</button>}
                {regStep < 3 && <button type="button" onClick={nextStep} style={acceptButtonStyle}>Next</button>}
                {regStep === 3 && <button type="submit" disabled={submitting} style={submitButtonStyle}>{submitting ? 'Updating...' : 'Finish Registration'}</button>}
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const riderVehicleRank = getVehicleRank(riderData?.vehicle_type);
  const nextWorkflowStep = activeAssignments.length
    ? activeAssignments.some((offer) => String(offer.assignment_status || '').toLowerCase() === 'out_for_delivery')
      ? WORKFLOW_STEPS[3]
      : activeAssignments.some((offer) => String(offer.assignment_status || '').toLowerCase() === 'picked_up')
        ? WORKFLOW_STEPS[2]
        : WORKFLOW_STEPS[1]
    : WORKFLOW_STEPS[0];

  return (
    <div style={containerStyle}>
       <header style={headerDashboardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
             <img src={require('../../uss.png')} alt="FreshFarm" style={{ height: 40 }} />
             <div>
                <h3 style={{ margin: 0, color: '#00AC7F' }}>Rider Dashboard</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{riderData?.full_name}</p>
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
             <div onClick={handleToggleOnline} style={{ ...onlineToggleStyle, backgroundColor: isOnline ? '#00AC7F' : '#eee' }}>
                <FontAwesomeIcon icon={faPowerOff} style={{ marginRight: '8px' }} />
                {isOnline ? 'ONLINE' : 'OFFLINE'}
             </div>
             <button onClick={() => { localStorage.removeItem('token'); navigate('/login'); }} style={logoutStyle}>Logout</button>
          </div>
       </header>

       <main style={{ maxWidth: '1280px', margin: '28px auto', padding: '0 20px 40px' }}>
          {!isOnline && (
            <div style={offlineWarningStyle}>
               <FontAwesomeIcon icon={faCircle} style={{ color: '#ff4d4d', marginRight: '10px' }} />
               You are currently offline. Go online to receive nearby delivery requests.
            </div>
          )}

          {isOnline && activeAssignments.length === 0 && (
            <div style={{ ...offlineWarningStyle, backgroundColor: '#eefaf5', color: '#0f766e' }}>
               <FontAwesomeIcon icon={faMotorcycle} style={{ marginRight: '10px' }} />
               You are online, but there is no accepted trip yet. Matching begins when the farmer marks the order as packed.
            </div>
          )}

          <section style={heroStyle}>
            <div>
              <div style={{ ...orderBadgeStyle, display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <FontAwesomeIcon icon={faRoute} />
                Live delivery command center
              </div>
              <h2 style={{ margin: '0 0 10px', fontSize: 34, lineHeight: 1.1, color: '#0f172a' }}>
                One dashboard for farmer pickup, rider handoff, and customer tracking.
              </h2>
              <p style={{ margin: 0, maxWidth: 760, color: '#475569', fontSize: 16, lineHeight: 1.6 }}>
                Orders move from farmer confirmation to packing, then to the nearest eligible rider based on load and vehicle class.
                Once accepted, the rider sees pickup details, then customer tracking and ETA continue until delivery.
              </p>
            </div>

            <div style={heroStatsGridStyle}>
              <div style={heroStatCardStyle}>
                <span style={heroStatLabelStyle}>Online status</span>
                <strong style={heroStatValueStyle}>{isOnline ? 'Ready' : 'Offline'}</strong>
              </div>
              <div style={heroStatCardStyle}>
                <span style={heroStatLabelStyle}>Active trips</span>
                <strong style={heroStatValueStyle}>{dashboardStats.activeCount}</strong>
              </div>
              <div style={heroStatCardStyle}>
                <span style={heroStatLabelStyle}>Offer pool</span>
                <strong style={heroStatValueStyle}>{dashboardStats.offeredCount}</strong>
              </div>
              <div style={heroStatCardStyle}>
                <span style={heroStatLabelStyle}>Estimated earnings</span>
                <strong style={heroStatValueStyle}>Rs. {dashboardStats.estimatedEarnings.toFixed(0)}</strong>
              </div>
            </div>
          </section>

          <div style={dashboardLayoutStyle}>
             <section style={leftColumnStyle}>
                <div style={panelStyle}>
                  <div style={panelHeaderStyle}>
                    <div>
                      <h4 style={panelTitleStyle}>Current handoff workflow</h4>
                      <p style={panelSubtitleStyle}>What happens from farmer pack to customer delivery.</p>
                    </div>
                    <div style={fitBadgeStyle}>
                      Vehicle fit: {riderVehicleRank > 0 ? riderData?.vehicle_type : 'Unassigned'}
                    </div>
                  </div>
                  <div style={workflowGridStyle}>
                    {WORKFLOW_STEPS.map((step, index) => {
                      const isActive = step.key === nextWorkflowStep.key;
                      return (
                        <div key={step.key} style={{ ...workflowStepStyle, ...(isActive ? workflowStepActiveStyle : {}) }}>
                          <div style={workflowStepIndexStyle}>{index + 1}</div>
                          <strong style={workflowStepTitleStyle}>{step.title}</strong>
                          <p style={workflowStepTextStyle}>{step.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={panelStyle}>
                  <div style={panelHeaderStyle}>
                    <div>
                      <h4 style={panelTitleStyle}>Job requests</h4>
                      <p style={panelSubtitleStyle}>Offers are ranked by vehicle fit, load, and service area.</p>
                    </div>
                    <div style={fitBadgeStyle}>
                      Recommended vehicle: {getRequiredVehicleTier(dashboardStats.totalOffers ? offers[0]?.total_quantity : 0).label}
                    </div>
                  </div>

                  {offers.length === 0 ? (
                    <div style={emptyStateStyle}>
                       <FontAwesomeIcon icon={faMotorcycle} size="3x" style={{ color: '#ddd', marginBottom: '15px' }} />
                       <p>No active orders found in your area.</p>
                       <p style={{ fontSize: '14px', color: '#999' }}>Stay online to catch the next request.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                       {offers.map(offer => {
                          const offerVehicleTier = getRequiredVehicleTier(offer.total_quantity);
                          const vehicleFit = riderVehicleRank === 0 || riderVehicleRank >= offerVehicleTier.rank;
                          const isActiveTrip = ACTIVE_ASSIGNMENT_STATUSES.has(String(offer.assignment_status || '').toLowerCase());
                          return (
                            <div key={offer.id} style={offerCardStyle}>
                               <div style={offerHeaderStyle}>
                                  <div>
                                     <span style={orderBadgeStyle}>Order #{offer.order_id}</span>
                                     <h5 style={{ margin: '8px 0 6px', fontSize: '18px', color: '#0f172a' }}>{offer.buyerLocation}</h5>
                                     <div style={vehicleChipRowStyle}>
                                       <span style={vehicleFitBadgeStyle(vehicleFit)}>{offerVehicleTier.label} needed</span>
                                       <span style={softMetaBadgeStyle}>{offer.total_quantity} items</span>
                                       <span style={softMetaBadgeStyle}>{offer.buyerName}</span>
                                     </div>
                                  </div>
                                  <div style={feeStyle}>Rs. {offer.delivery_fee}</div>
                               </div>

                               <div style={offerMetaStyle}>
                                  <span>📦 {offer.total_quantity} items</span>
                                  <span>👤 {offer.buyerName}</span>
                                  <span>📍 {offer.buyerLocation}</span>
                                  <span style={{ color: '#00AC7F' }}>Status: {formatOrderStep(offer.assignment_status)}</span>
                               </div>

                               {isActiveTrip && (
                                 <div style={activeTripStripStyle}>
                                   <span>Assigned trip active</span>
                                   <span>ETA {Number.isFinite(Number(offer.eta_minutes)) ? `${Number(offer.eta_minutes)} min` : 'calculating'}</span>
                                 </div>
                               )}

                               <div style={actionRowStyle}>
                                  {offer.assignment_status === 'offered' && (
                                    <button onClick={() => acceptOffer(offer.id)} disabled={!vehicleFit} style={{ ...acceptButtonStyle, opacity: vehicleFit ? 1 : 0.45 }}>
                                      {vehicleFit ? 'Accept Job' : 'Vehicle too small'}
                                    </button>
                                  )}
                                  {['accepted', 'picked_up', 'out_for_delivery'].includes(offer.assignment_status) && (
                                    <>
                                      <button onClick={() => updateJobStatus(offer.order_id, 'picked_up')} disabled={offer.assignment_status !== 'accepted'} style={statusButtonStyle}>Picked Up</button>
                                      <button onClick={() => updateJobStatus(offer.order_id, 'out_for_delivery')} disabled={offer.assignment_status !== 'picked_up'} style={statusButtonStyle}>Out for Delivery</button>
                                      <button onClick={() => updateJobStatus(offer.order_id, 'delivered')} disabled={offer.assignment_status !== 'out_for_delivery'} style={deliveredButtonStyle}>Delivered</button>
                                      <button onClick={() => { setActiveChatOrder(offer); setShowChat(true); }} style={chatButtonStyle}>
                                         <FontAwesomeIcon icon={faComments} /> Chat with Farmer
                                      </button>
                                    </>
                                  )}
                               </div>
                            </div>
                          );
                       })}
                    </div>
                  )}
                </div>
             </section>

             <section style={rightColumnStyle}>
                <div style={statsCardStyle}>
                   <h4 style={{ marginTop: 0 }}>Delivery partner profile</h4>
                   <div style={statItemStyle}><span>Vehicle</span> <b>{riderData?.vehicle_type || 'Not set'}</b></div>
                   <div style={statItemStyle}><span>Availability</span> <b>{riderData?.availability || 'Full Time'}</b></div>
                   <div style={statItemStyle}><span>Service area</span> <b>{riderData?.service_area || 'Not set'}</b></div>
                   <div style={statItemStyle}><span>Load capacity</span> <b>{riderData?.capacity_kg || 0} kg</b></div>
                </div>

                <div style={panelStyle}>
                  <h4 style={{ marginTop: 0 }}>Why riders are matched</h4>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {DASHBOARD_BENEFITS.map((benefit) => (
                      <div key={benefit} style={benefitRowStyle}>
                        <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#00AC7F' }} />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={panelStyle}>
                  <h4 style={{ marginTop: 0 }}>Vehicle ladder</h4>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {VEHICLE_FLEET.slice(0, 6).map((vehicle) => (
                      <div key={vehicle.label} style={{ ...vehicleRowStyle, ...(vehicle.rank === riderVehicleRank ? vehicleRowActiveStyle : {}) }}>
                        <strong>{vehicle.label}</strong>
                        <span>{vehicle.maxQuantity === Infinity ? '80+ items' : `up to ${vehicle.maxQuantity} items`}</span>
                        <small>{vehicle.detail}</small>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={statsCardStyle}>
                   <h4 style={{ marginTop: 0 }}>Daily stats</h4>
                   <div style={statItemStyle}><span>Offers received</span> <b>{dashboardStats.totalOffers}</b></div>
                   <div style={statItemStyle}><span>Active deliveries</span> <b>{dashboardStats.activeCount}</b></div>
                   <div style={statItemStyle}><span>Trips delivered</span> <b>{dashboardStats.completedCount}</b></div>
                </div>
             </section>
          </div>
       </main>

       {/* Chat Modal */}
       {showChat && activeChatOrder && (
         <div style={modalOverlayStyle}>
            <div style={chatBoxStyle}>
               <div style={chatHeaderStyle}>
                  <span>Chat: Farmer for Order #{activeChatOrder.order_id}</span>
                  <button onClick={() => setShowChat(false)} style={closeButtonStyle}>×</button>
               </div>
               <div style={chatMessagesStyle}>
                  {chatMessages.length === 0 && <p style={{ textAlign: 'center', color: '#999' }}>Start a conversation with the farmer.</p>}
                  {chatMessages.map((m, i) => (
                    <div key={i} style={{ ...messageStyle, alignSelf: m.sender === 'rider' ? 'flex-end' : 'flex-start', backgroundColor: m.sender === 'rider' ? '#00AC7F' : '#eee', color: m.sender === 'rider' ? '#fff' : '#333' }}>
                       {m.text}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
               </div>
               <div style={chatInputRowStyle}>
                  <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." style={chatInputStyle} />
                  <button onClick={handleSendMessage} style={sendButtonStyle}>Send</button>
               </div>
            </div>
         </div>
       )}
    </div>
  );
};

// Styles
const loaderStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '20px', color: '#00AC7F' };
const containerStyle = { minHeight: '100vh', backgroundColor: '#f9fafb' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', backgroundColor: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' };
const headerDashboardStyle = { ...headerStyle, position: 'sticky', top: 0, zIndex: 100 };
const cardStyle = { backgroundColor: '#fff', padding: '30px', borderRadius: '15px', boxShadow: '0 5px 15px rgba(0,0,0,0.05)' };
const grid2Style = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', width: '100%', boxSizing: 'border-box' };
const submitButtonStyle = { marginTop: '20px', padding: '15px', borderRadius: '8px', border: 'none', backgroundColor: '#00AC7F', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' };
const logoutStyle = { background: 'none', border: '1px solid #ddd', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' };
const onlineToggleStyle = { color: '#fff', padding: '10px 20px', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s', display: 'flex', alignItems: 'center' };
const offlineWarningStyle = { padding: '15px', backgroundColor: '#ffe5e5', borderRadius: '10px', color: '#d00', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' };
const dashboardGridStyle = { display: 'flex', gap: '30px', flexWrap: 'wrap' };
const emptyStateStyle = { textAlign: 'center', padding: '50px', backgroundColor: '#fff', borderRadius: '15px', border: '2px dashed #eee' };
const offerCardStyle = { backgroundColor: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 3px 10px rgba(0,0,0,0.03)', border: '1px solid #eee' };
const offerHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const feeStyle = { fontSize: '22px', fontWeight: 'bold', color: '#00AC7F' };
const orderBadgeStyle = { backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '5px', fontSize: '12px', fontWeight: 'bold' };
const offerMetaStyle = { display: 'flex', gap: '20px', color: '#666', fontSize: '14px', margin: '15px 0' };
const actionRowStyle = { display: 'flex', gap: '10px', flexWrap: 'wrap' };
const acceptButtonStyle = { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#00AC7F', color: '#fff', fontWeight: 'bold', cursor: 'pointer' };
const statusButtonStyle = { padding: '10px 15px', borderRadius: '8px', border: '1px solid #00AC7F', background: '#fff', color: '#00AC7F', fontWeight: 'bold', cursor: 'pointer' };
const deliveredButtonStyle = { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#15803d', color: '#fff', fontWeight: 'bold', cursor: 'pointer' };
const chatButtonStyle = { padding: '10px 15px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', color: '#555', cursor: 'pointer' };
const statsCardStyle = { backgroundColor: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 3px 10px rgba(0,0,0,0.03)' };
const statItemStyle = { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f5f5f5' };
const heroStyle = { marginBottom: 24, padding: '28px', borderRadius: 24, background: 'linear-gradient(135deg, #f6fffb 0%, #eef6ff 100%)', border: '1px solid #d7e8e0', boxShadow: '0 18px 50px rgba(15, 23, 42, 0.06)', display: 'grid', gap: 20 };
const heroStatsGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 };
const heroStatCardStyle = { backgroundColor: '#fff', borderRadius: 18, padding: '14px 16px', border: '1px solid #e2efe8', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.04)' };
const heroStatLabelStyle = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' };
const heroStatValueStyle = { fontSize: 20, color: '#0f172a' };
const dashboardLayoutStyle = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(300px, 1fr)', gap: 24, alignItems: 'start' };
const leftColumnStyle = { display: 'grid', gap: 18 };
const rightColumnStyle = { display: 'grid', gap: 18 };
const panelStyle = { backgroundColor: '#fff', padding: '20px', borderRadius: '18px', boxShadow: '0 3px 10px rgba(0,0,0,0.03)', border: '1px solid #edf2f7' };
const panelHeaderStyle = { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap' };
const panelTitleStyle = { margin: '0 0 6px', color: '#0f172a' };
const panelSubtitleStyle = { margin: 0, color: '#64748b', fontSize: 14 };
const fitBadgeStyle = { backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 700 };
const workflowGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 };
const workflowStepStyle = { padding: '14px', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', minHeight: 150, display: 'grid', alignContent: 'start', gap: 10 };
const workflowStepActiveStyle = { backgroundColor: '#f0fdf4', borderColor: '#86efac', boxShadow: '0 8px 18px rgba(34,197,94,0.10)' };
const workflowStepIndexStyle = { width: 28, height: 28, borderRadius: '50%', backgroundColor: '#0f172a', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 };
const workflowStepTitleStyle = { fontSize: 14, color: '#0f172a' };
const workflowStepTextStyle = { margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5 };
const vehicleChipRowStyle = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' };
const softMetaBadgeStyle = { borderRadius: 999, padding: '5px 10px', backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', fontSize: 12 };
const activeTripStripStyle = { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 12px', borderRadius: '12px', marginBottom: 14, backgroundColor: '#ecfdf5', color: '#047857', fontSize: 13, fontWeight: 700 };
const benefitRowStyle = { display: 'flex', gap: 10, alignItems: 'center', color: '#334155', fontSize: 14 };
const vehicleRowStyle = { border: '1px solid #e2e8f0', borderRadius: 14, padding: '12px 14px', backgroundColor: '#fff', display: 'grid', gap: 4, color: '#0f172a' };
const vehicleRowActiveStyle = { borderColor: '#00AC7F', boxShadow: '0 8px 20px rgba(0,172,127,0.10)', backgroundColor: '#f0fdf4' };
const vehicleFitBadgeStyle = (fits) => ({
  borderRadius: 999,
  padding: '5px 10px',
  backgroundColor: fits ? '#ecfdf5' : '#fff1f2',
  color: fits ? '#047857' : '#be123c',
  border: `1px solid ${fits ? '#a7f3d0' : '#fecdd3'}`,
  fontSize: 12,
  fontWeight: 700
 });

const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const chatBoxStyle = { width: '400px', height: '500px', backgroundColor: '#fff', borderRadius: '15px', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const chatHeaderStyle = { padding: '15px', backgroundColor: '#00AC7F', color: '#fff', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' };
const closeButtonStyle = { background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' };
const chatMessagesStyle = { flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' };
const messageStyle = { padding: '10px', borderRadius: '10px', maxWidth: '80%', fontSize: '14px' };
const chatInputRowStyle = { padding: '15px', borderTop: '1px solid #eee', display: 'flex', gap: '10px' };
const chatInputStyle = { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd' };
const sendButtonStyle = { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#00AC7F', color: '#fff', fontWeight: 'bold', cursor: 'pointer' };

const Field = ({ label, children }) => (
  <label style={{ display: 'grid', gap: '8px', fontWeight: 'bold', color: '#333', fontSize: '14px' }}>
    <span>{label}</span>
    {children}
  </label>
);

export default DeliveryPartnerApplication;
