import React, { useState, useEffect, useCallback } from 'react';
import './UserAddtocart.css'; // Import the CSS file
import Nav from '../Nav';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCrosshairs } from '@fortawesome/free-solid-svg-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useLanguage } from '../context/LanguageContext';
import { translateProductName } from '../utils/localizedProduct';
import '../styles/customer-ui.css';

// Fix leaflet icon issue natively
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});




function Cart({ userId }) {
  const [cartItems, setCartItems] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhoneNumber, setBuyerPhoneNumber] = useState('');
  const [buyerLocation, setBuyerLocation] = useState('');
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false); // New state for order success message
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [paymentNotice, setPaymentNotice] = useState('');
  const [lastOrderPayment, setLastOrderPayment] = useState(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [resolvedUserId, setResolvedUserId] = useState(null);
  const { t, language } = useLanguage();

  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); 
  const [pinPosition, setPinPosition] = useState(null);

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      if (data && data.display_name) {
        setBuyerLocation(data.display_name);
      }
    } catch (error) {
      console.error("Error reverse geocoding:", error);
    }
  };

  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        setPinPosition(e.latlng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      },
    });

    return pinPosition === null ? null : (
      <Marker position={pinPosition}></Marker>
    );
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const currentPos = { lat, lng };
          setMapCenter([lat, lng]);
          setPinPosition(currentPos);
          reverseGeocode(lat, lng);
        },
        (error) => {
          console.error("Error getting current location:", error);
          alert("Couldn't retrieve current location. Please check your browser location permissions.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser");
    }
  };

  const fetchCartItems = useCallback(() => {
    fetch('https://d2pskbh3g9o3pk.cloudfront.net/api11/products/cart', {
      params: { user_id: userId }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch cart items. Status: ' + response.status);
        }
        return response.json();
      })
      .then(data => {
        setCartItems(data); // Directly set fetched items to state
        setError(null); // Clear any previous errors
        setLoading(false); // Set loading to false once data is fetched
      })
      .catch(error => {
        console.error('Error fetching cart items:', error);
        setError('Error fetching cart items. Please try again later.'); // Set error state
        setLoading(false); // Set loading to false in case of error
      });
  }, [userId]);

  useEffect(() => {
    fetchCartItems();
  }, [fetchCartItems]);

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const decoded = jwtDecode(token);
      if (decoded?.email) {
        setCustomerEmail(decoded.email);
      }
    } catch (err) {
      console.error('Unable to read customer email from token:', err);
    }
  }, []);

  useEffect(() => {
    const resolveNumericUserId = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const decoded = jwtDecode(token);
        if (!decoded?.email) return;

        const response = await fetch(`https://d2pskbh3g9o3pk.cloudfront.net/api/account/profileByEmail/${encodeURIComponent(decoded.email)}`);
        if (!response.ok) return;

        const profile = await response.json();
        if (profile?.id != null) {
          setResolvedUserId(Number(profile.id));
        }
      } catch (err) {
        console.error('Unable to resolve numeric user id for checkout:', err);
      }
    };

    resolveNumericUserId();
  }, []);

  const handleRemoveFromCart = (productId) => {
    fetch(`https://d2pskbh3g9o3pk.cloudfront.net/api11/products/cart/${productId}`, {
      method: 'DELETE',
      params: { user_id: userId }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to remove product from cart. Status: ' + response.status);
        }
        // If the request is successful, update the cartItems state to remove the item
        setCartItems(prevCartItems => prevCartItems.filter(item => item.id !== productId));
      })
      .catch(error => {
        console.error('Error removing product from cart:', error);
        setError('Error removing product from cart. Please try again.'); // Set error state
      });
  };

  const handleQuantityChange = (productId, newQuantity) => {
    // Prevent decreasing quantity below 0
    if (newQuantity < 1) {
      return;
    }

    // Make a PATCH request to update the quantity and price in the backend
    fetch(`https://d2pskbh3g9o3pk.cloudfront.net/api11/products/cart/${productId}`, {
      method: 'PATCH',
      params: { user_id: userId },
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quantity: newQuantity }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to update quantity. Status: ' + response.status);
        }
        // If the request is successful, update the quantity and price in the cartItems state
        setCartItems(prevCartItems =>
          prevCartItems.map(item =>
            item.id === productId ? { ...item, quantity: newQuantity } : item
          )
        );
      })
      .catch(error => {
        console.error('Error updating quantity:', error);
        setError('Error updating quantity. Please try again.'); // Set error state
      });
  };

  // Calculate total price
  const totalPrice = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

  const handleProceedToCheckout = () => {
    setShowCheckoutDialog(true);
  };

  const handleCheckoutCancel = () => {
    setShowCheckoutDialog(false);
  };

  const placeOrderAfterValidation = useCallback(async (finalOrderDetails) => {
    const orderDetails = {
      buyerName: finalOrderDetails.buyerName,
      buyerLocation: finalOrderDetails.buyerLocation,
      cartItems: finalOrderDetails.cartItems,
      totalPrice: finalOrderDetails.totalPrice,
      customerEmail: finalOrderDetails.customerEmail,
      userId: finalOrderDetails.userId
    };

    const validationResponse = await fetch('https://d2pskbh3g9o3pk.cloudfront.net/api11/products/cart/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderDetails),
    });

    const validationData = await validationResponse.json().catch(() => ({}));

    if (!validationResponse.ok) {
      throw new Error(validationData.error || 'Failed to validate user');
    }

    if (validationData.message !== 'Order placed successfully') {
      throw new Error('Invalid name. Please check your details and try again.');
    }

    const placeOrderResponse = await fetch('https://d2pskbh3g9o3pk.cloudfront.net/api11/products/cart/placeOrder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(finalOrderDetails),
    });

    const placeOrderData = await placeOrderResponse.json().catch(() => ({}));

    if (!placeOrderResponse.ok) {
      throw new Error(placeOrderData.error || 'Failed to place order');
    }

    console.log('Order placed successfully:', placeOrderData);
    setCartItems([]);
    setShowCheckoutDialog(false);
    setLastOrderPayment({
      paymentMethod: finalOrderDetails.paymentMethod || 'online',
      grandTotal: Number(finalOrderDetails.grandTotal || finalOrderDetails.totalPrice || 0),
      codAdvanceAmount: Number(finalOrderDetails.codAdvanceAmount || 0),
      codRemainingAmount: Number(finalOrderDetails.codRemainingAmount || 0)
    });
    setOrderPlaced(true);
    localStorage.removeItem('freshfarm_pending_order');
  }, []);

  const buildFinalOrderDetails = () => {
    const modifiedCartItems = cartItems.map(item => ({
      ...item,
      productName: item.product_name,
    }));

    const grandTotal = calculateTotalPrice();
    const codAdvanceAmount = Math.max(1, Math.round(grandTotal * 0.25));
    const codRemainingAmount = Math.max(0, grandTotal - codAdvanceAmount);

    return {
      buyerName,
      buyerPhoneNumber,
      buyerLocation,
      cartItems: modifiedCartItems,
      totalPrice: grandTotal,
      grandTotal,
      paymentMethod,
      customerEmail: customerEmail || '',
      codAdvanceAmount,
      codRemainingAmount,
      userId: resolvedUserId
    };
  };

  const startStripeCheckout = async (mode) => {
    if (!cartItems.length) return;
    if (!buyerName || !buyerPhoneNumber || !buyerLocation) {
      setError('Please fill checkout details before payment.');
      return;
    }

    const orderPayload = buildFinalOrderDetails();
    localStorage.setItem('freshfarm_pending_order', JSON.stringify(orderPayload));

    const codAdvanceAmount = Math.max(1, Math.round(Number(orderPayload.codAdvanceAmount || 0)));

    try {
      setPaymentLoading(true);
      const response = await fetch('https://d2pskbh3g9o3pk.cloudfront.net/api11/payments/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems,
          shippingFee: 250,
          origin: window.location.origin,
          paymentMode: mode,
          codAdvanceAmount
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to start Stripe checkout.');
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err.message || 'Stripe checkout failed.');
      localStorage.removeItem('freshfarm_pending_order');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setError(null);

    if (paymentMethod === 'cod') {
      await startStripeCheckout('cod');
      return;
    }

    await startStripeCheckout('online');
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const payment = params.get('payment');
    if (!payment) return;

    if (payment === 'cancelled') {
      setPaymentNotice('Payment was cancelled. You can try again.');
      navigate('/addCart', { replace: true });
      return;
    }

    if (payment === 'success') {
      const pendingRaw = localStorage.getItem('freshfarm_pending_order');
      if (!pendingRaw) {
        setPaymentNotice('Payment successful.');
        navigate('/addCart', { replace: true });
        return;
      }

      const finalizePayment = async () => {
        try {
          const pendingOrder = JSON.parse(pendingRaw);
          await placeOrderAfterValidation(pendingOrder);
        } catch (err) {
          console.error('Error finalizing Stripe payment:', err);
          setError(err.message || 'Error placing order after payment. Please contact support.');
        } finally {
          navigate('/account', { replace: true });
        }
      };

      finalizePayment();
    }
  }, [location.search, navigate, placeOrderAfterValidation]);

  const calculateTotalPrice = () => {
    // Initialize total price
    let totalPrice = 0;

    // Loop through cart items and sum the prices
    cartItems.forEach(item => {
      totalPrice += item.price * item.quantity;
    });

    // Add shipping fee
    totalPrice += 250;

    return totalPrice;
  };

  const handleGoBackHome = () => {
    // Redirect to home page or perform any other action
    navigate(-3);
  };

  // Show loading indicator while data is being fetched
  if (loading) {
    return <p>{t('loading')}</p>;
  }

  // Render cart items if data fetching is successful
  return (
    <div className="ff-page">
      <Nav />
      <div className="checkout-layout">
        {paymentNotice && <p style={{ margin: '0 20px', color: '#065f46', fontWeight: 600 }}>{paymentNotice}</p>}
        <div className="cart-list">
          {cartItems.length > 0 ? (
            cartItems.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="product-name1">{translateProductName(item.product_name, language)}</div>

                <div className="quantity-control1">
                  <button className="quantity-btn" onClick={() => handleQuantityChange(item.id, item.quantity - 1)}>-</button>
                  <span>{item.quantity}</span>
                  <button className="quantity-btn" onClick={() => handleQuantityChange(item.id, item.quantity + 1)}>+</button>
                </div>

                <div className="product-price1">Rs. {item.price * item.quantity}</div>

                <button className="remove-btn" title={t('remove')} onClick={() => handleRemoveFromCart(item.id)}>
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            ))
          ) : (
            <div className="empty-cart">
              <p>{t('cartEmpty')}</p>
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="order-summary">
            <h3>{t('orderSummary')}</h3>
            {cartItems.map((item) => (
              <p key={item.id} className="order-summary-row">
                <span>{translateProductName(item.product_name, language)} x {item.quantity}</span>
                <span>Rs. {item.price * item.quantity}</span>
              </p>
            ))}

            <p className="order-summary-row">
              <span>{t('subtotal')} ({cartItems.length} items)</span>
              <span>Rs. {totalPrice}</span>
            </p>

            <p className="order-summary-row">
              <span>{t('shippingFee')}</span>
              <span>Rs. 250</span>
            </p>

            <p className="order-summary-row" style={{ fontWeight: 800 }}>
              <span>{t('total')}</span>
              <span>Rs. {totalPrice + 250}</span>
            </p>

            <button onClick={handleProceedToCheckout}>{t('proceedToCheckout')}</button>
          </div>
        )}
      </div>

      {showCheckoutDialog && (
        <div className="checkout-dialog" style={{ overflowY: 'auto' }}>
          <div className="checkout-panel" style={{ width: 'min(920px, 100%)', maxHeight: 'calc(100vh - 32px)', overflow: 'auto' }}>
            <div className="checkout-header" style={{ alignItems: 'flex-start', gap: '14px' }}>
              <div>
                <h2 style={{ margin: 0 }}>{t('checkout')}</h2>
                <p style={{ margin: '6px 0 0', color: '#64748b' }}>Review your contact details, set the delivery pin, and choose a payment mode.</p>
              </div>
              <button type="button" className="close-button" onClick={handleCheckoutCancel}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <form className="checkout-form" onSubmit={handlePlaceOrder} noValidate style={{ display: 'grid', gap: '24px', padding: '24px' }}>
              {error && (
                <div style={{ gridColumn: '1 / -1', padding: '12px 14px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontWeight: 600 }}>
                  {error}
                </div>
              )}

              {/* Contact Details Section */}
              <div className="checkout-contact-grid">
                <div className="checkout-field">
                  <label htmlFor="buyerName" style={{ fontWeight: 700, color: '#334155' }}>{t('name')}</label>
                  <input 
                    type="text" 
                    id="buyerName" 
                    value={buyerName} 
                    onChange={(e) => setBuyerName(e.target.value)} 
                    placeholder="Enter your full name"
                    style={{ height: '48px', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '0 16px' }}
                  />
                </div>

                <div className="checkout-field">
                  <label htmlFor="buyerPhoneNumber" style={{ fontWeight: 700, color: '#334155' }}>{t('phoneNumber')}</label>
                  <input
                    type="text"
                    id="buyerPhoneNumber"
                    value={buyerPhoneNumber}
                    onChange={(e) => setBuyerPhoneNumber(e.target.value)}
                    pattern="[0-9]{10}"
                    title="Enter 10 digit phone number"
                    placeholder="10-digit mobile number"
                    style={{ height: '48px', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '0 16px' }}
                  />
                </div>

                <div className="checkout-field">
                  <label htmlFor="buyerEmail" style={{ fontWeight: 700, color: '#334155' }}>Email Address</label>
                  <input
                    type="email"
                    id="buyerEmail"
                    value={customerEmail}
                    disabled
                    placeholder="Order updates will be sent here"
                    style={{ height: '48px', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '0 16px', background: '#f8fafc', color: '#64748b' }}
                  />
                </div>
              </div>

              {/* Location and Payment Section */}
              <div className="checkout-main-grid">
                {/* Left Side: Map and Address */}
                <div style={{ display: 'grid', gap: '20px' }}>
                  <div className="checkout-field full">
                    <div className="map-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, color: '#334155' }}>{t('pinAddressOnMap')}</span>
                      <button type="button" onClick={handleCurrentLocation} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', fontSize: '13px' }}>
                        <FontAwesomeIcon icon={faCrosshairs} />
                        {t('useCurrentLocation')}
                      </button>
                    </div>

                    <div className="map-box" style={{ height: '280px', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                      <MapContainer center={mapCenter} zoom={4} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <LocationMarker />
                      </MapContainer>
                    </div>
                  </div>

                  <div className="checkout-field full">
                    <label htmlFor="buyerLocation" style={{ fontWeight: 700, color: '#334155' }}>{t('addressDetails')}</label>
                    <textarea
                      id="buyerLocation"
                      placeholder={t('addressPlaceholder')}
                      value={buyerLocation}
                      onChange={(e) => setBuyerLocation(e.target.value)}
                      rows={4}
                      style={{ borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', fontSize: '14px', lineHeight: '1.5', resize: 'none', minHeight: '120px' }}
                    />
                  </div>
                </div>

                {/* Right Side: Payment and Total */}
                <div style={{ display: 'grid', gap: '20px', position: 'sticky', top: '0' }}>
                  <div style={{ padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <h4 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Payment Method</h4>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '12px', border: paymentMethod === 'online' ? '2px solid #0f9d58' : '1px solid #e2e8f0', background: paymentMethod === 'online' ? '#f0fdf4' : '#fff', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="online"
                          checked={paymentMethod === 'online'}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          style={{ accentColor: '#0f9d58', width: '18px', height: '18px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>Full Online Payment</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>Secure payment via Stripe</div>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '12px', border: paymentMethod === 'cod' ? '2px solid #0f9d58' : '1px solid #e2e8f0', background: paymentMethod === 'cod' ? '#f0fdf4' : '#fff', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cod"
                          checked={paymentMethod === 'cod'}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          style={{ accentColor: '#0f9d58', width: '18px', height: '18px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>Cash on Delivery</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>25% advance + 75% on delivery</div>
                        </div>
                      </label>
                    </div>

                    {paymentMethod === 'cod' && (
                      <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fef3c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>Advance Amount:</span>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: '#92400e' }}>Rs. {Math.max(1, Math.round(calculateTotalPrice() * 0.25))}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '24px', borderRadius: '20px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', opacity: 0.8 }}>
                      <span>Subtotal</span>
                      <span>Rs. {totalPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', opacity: 0.8 }}>
                      <span>Shipping</span>
                      <span>Rs. 250</span>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '18px', fontWeight: 600 }}>Total Payable</span>
                      <span style={{ fontSize: '24px', fontWeight: 800 }}>Rs. {calculateTotalPrice()}</span>
                    </div>
                  </div>
                </div>

                <div className="checkout-field full" style={{ display: 'flex', justifyContent: 'flex-end', gridColumn: '1 / -1' }}>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={paymentLoading}
                    style={{ width: 'min(260px, 100%)', height: '52px', background: '#0f9d58', border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: 800, boxShadow: '0 10px 15px -3px rgba(15, 157, 88, 0.3)' }}
                  >
                    {paymentLoading ? 'Redirecting...' : t('placeOrder')}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>
      )}

      {orderPlaced && (
        <div className="order-success-popup">
          <div className="popup-content">
            <h2>{t('orderPlaced')}</h2>
            {lastOrderPayment?.paymentMethod === 'cod' && (
              <p style={{ margin: '10px 0', fontWeight: 600, color: '#7c2d12' }}>
                Paid now: Rs. {lastOrderPayment.codAdvanceAmount} | Pay on delivery: Rs. {lastOrderPayment.codRemainingAmount}
              </p>
            )}
            {lastOrderPayment?.paymentMethod !== 'cod' && (
              <p style={{ margin: '10px 0', fontWeight: 600, color: '#065f46' }}>
                Full payment completed: Rs. {lastOrderPayment?.grandTotal || 0}
              </p>
            )}
            <button onClick={handleGoBackHome} className="go-home-button">{t('goHome')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cart;
