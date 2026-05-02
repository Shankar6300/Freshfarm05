import React, { useEffect, useState } from 'react';
import Sidebar from '../../Components/Sidebar/sidebar';
import axios from 'axios';

const API_BASE = 'http://freshfarm-backend-env.eba-qnm4hc4g.ap-south-1.elasticbeanstalk.com';

export default function AdminDeliveryPartners() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 6;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState({});

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/api/admin/delivery-partners`, { headers: { Authorization: token } });
      const rows = res.data || [];
      setPartners(rows);
    } catch (err) {
      console.error('Failed to load partners', err);
    } finally {
      setLoading(false);
    }
  };

  const getSignedUrl = async (filename) => {
    if (!filename) return null;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE}/api/admin/uploads/signed-url`, { filename, expiresSeconds: 120 }, { headers: { Authorization: token } });
      return res.data?.url || null;
    } catch (err) {
      console.error('Signed URL error', err);
      return null;
    }
  };

  const changeStatus = async (email, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/api/admin/delivery-partners/${encodeURIComponent(email)}/status`, { status }, { headers: { Authorization: token } });
      await loadPartners();
      // success handled by refresh
    } catch (err) {
      console.error('Status change failed', err);
      alert('Failed to change status');
    }
  };

  const viewAadhaar = async (email) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/api/admin/delivery-partner/${encodeURIComponent(email)}/aadhaar`, { headers: { Authorization: token } });
      const d = res.data || {};
      alert(`Aadhaar for ${email}\nDecrypted: ${d.aadhaar || '[none]'}\nMasked: ${d.masked || '[none]'}`);
    } catch (err) {
      console.error('View Aadhaar failed', err);
      alert('Failed to fetch Aadhaar (check admin permissions)');
    }
  };

  const totalPages = Math.max(1, Math.ceil((partners.length || 0) / perPage));

  const openConfirm = (email, status) => {
    setConfirmPayload({ email, status });
    setConfirmOpen(true);
  };

  const doConfirm = async () => {
    const { email, status } = confirmPayload || {};
    setConfirmOpen(false);
    if (!email || !status) return;
    await changeStatus(email, status);
    setPage(1);
    alert(`Partner ${email} set to ${status}`);
  };

  const cancelConfirm = () => {
    setConfirmOpen(false);
    setConfirmPayload({});
  };

  return (
    <div>
      <Sidebar adminName="Admin" />
      <div style={{ marginLeft: 260, padding: 20 }}>
        <h2>Delivery Partner Applications</h2>
        {loading && <div>Loading…</div>}
        {!loading && partners.length === 0 && <div>No partners found.</div>}
        <div style={{ display: 'grid', gap: 12 }}>
          {partners.slice((page - 1) * perPage, page * perPage).map((p) => (
            <div key={p.id} style={{ border: '1px solid #e5e7eb', padding: 12, borderRadius: 8, display: 'flex', gap: 12 }}>
              <div style={{ width: 260 }}>
                <div><strong>{p.full_name}</strong></div>
                <div style={{ color: '#6b7280' }}>{p.email}</div>
                <div style={{ marginTop: 8 }}>{p.vehicle_type} • {p.vehicle_number}</div>
                <div style={{ marginTop: 8 }}>Status: {p.status} {p.is_online ? '(Online)' : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['rc_photo','license_photo','aadhaar_photo','owner_vehicle_photo','person_photo'].map((field) => (
                  <SignedImage key={field} filename={p[field]} label={field.replace('_',' ')} getSignedUrl={getSignedUrl} />
                ))}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => openConfirm(p.email, 'approved')} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6 }}>Approve</button>
                <button onClick={() => openConfirm(p.email, 'rejected')} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6 }}>Reject</button>
                <button onClick={() => viewAadhaar(p.email)} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6 }}>View Aadhaar</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
          <div style={{ padding: '0 8px' }}>Page {page} / {totalPages}</div>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
        </div>

        {confirmOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 420 }}>
              <h3>Confirm action</h3>
              <p>Are you sure you want to <b>{confirmPayload.status}</b> partner <b>{confirmPayload.email}</b>?</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={cancelConfirm}>Cancel</button>
                <button onClick={doConfirm} style={{ background: '#111827', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6 }}>Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SignedImage({ filename, label, getSignedUrl }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!filename) return;
      const u = await getSignedUrl(filename);
      if (mounted) setUrl(u);
    })();
    return () => { mounted = false; };
  }, [filename]);

  return (
    <div style={{ width: 140 }}>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>{label}</div>
      {url ? (
        <img src={url} alt={label} style={{ width: 140, height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }} />
      ) : (
        <div style={{ width: 140, height: 90, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', borderRadius: 6 }}>No image</div>
      )}
    </div>
  );
}
