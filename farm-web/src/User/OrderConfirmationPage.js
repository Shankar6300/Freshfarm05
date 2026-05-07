import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faArrowRight, faClock } from '@fortawesome/free-solid-svg-icons';
import Nav from '../Nav';
import { useLanguage } from '../context/LanguageContext';
import '../styles/customer-ui.css';

const API_BASE_URL = 'https://d2pskbh3g9o3pk.cloudfront.net';

const OrderConfirmationPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/account/orders/${orderId}`);
        if (response.ok) {
          const data = await response.json();
          setOrder(data);
        }
      } catch (err) {
        console.error('Error fetching order details:', err);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="ff-page">
        <Nav />
        <main style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p>{t('loading')}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="ff-page">
      <Nav />
      <main style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{
          background: '#f0fdf4',
          border: '2px solid #22c55e',
          borderRadius: '12px',
          padding: '40px 20px',
          textAlign: 'center',
          marginBottom: '30px'
        }}>
          <FontAwesomeIcon
            icon={faCheckCircle}
            style={{ fontSize: '48px', color: '#22c55e', marginBottom: '16px' }}
          />
          <h1 style={{ margin: '16px 0', color: '#15803d', fontSize: '28px' }}>
            Order Confirmed!
          </h1>
          <p style={{ color: '#166534', margin: '8px 0', fontSize: '16px' }}>
            Thank you for your order. Your payment has been received.
          </p>
        </div>

        {order ? (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#0f766e' }}>
              Order #<span style={{ fontSize: '24px' }}>{order.orderId || orderId}</span>
            </h2>

            <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#475569', marginBottom: '12px' }}>Items</h3>
              {(order.items || []).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px' }}>
                  <span>{item.productName} x {item.quantity}</span>
                  <span>₹{(item.itemTotalPrice || item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px' }}>
                <span>Subtotal</span>
                <span>₹{order.totalPrice?.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px' }}>
                <span>Shipping</span>
                <span>₹250</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '16px', fontWeight: 'bold', color: '#0f766e' }}>
              <span>Total</span>
              <span>₹{(Number(order.totalPrice || 0) + 250).toFixed(2)}</span>
            </div>

            <div style={{ background: '#e0f2fe', border: '1px solid #0ea5e9', borderRadius: '8px', padding: '16px', marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FontAwesomeIcon icon={faClock} style={{ color: '#0369a1', fontSize: '20px' }} />
              <span style={{ color: '#0369a1', fontSize: '14px' }}>
                Expected delivery in 3-5 business days
              </span>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate(`/order/${order.orderId || orderId}`)}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '12px 20px',
                  background: '#0f766e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                Track Order <FontAwesomeIcon icon={faArrowRight} />
              </button>
              <button
                onClick={() => navigate('/account')}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '12px 20px',
                  background: 'white',
                  color: '#0f766e',
                  border: '2px solid #0f766e',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Back to Orders
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', background: '#fff7ed', borderRadius: '8px' }}>
            <p style={{ color: '#b45309' }}>Order details will load shortly. Your order ID is: <strong>#{orderId}</strong></p>
          </div>
        )}
      </main>
    </div>
  );
};

export default OrderConfirmationPage;
