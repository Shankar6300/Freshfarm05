import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { io } from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPaperPlane, faCheck } from '@fortawesome/free-solid-svg-icons';
import Nav from '../Nav';
import './OrderDetailPage.css';

const API_BASE_URL = 'https://d2pskbh3g9o3pk.cloudfront.net';
const SOCKET_BASE_URL = 'https://d2pskbh3g9o3pk.cloudfront.net';

const ORDER_STEPS = ['pending', 'confirmed', 'packed', 'picked_up', 'out_for_delivery', 'delivered'];
const STEP_LABELS = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered'
};

const OrderDetailPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [currentStatus, setCurrentStatus] = useState('pending');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize socket and fetch order
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        jwtDecode(token);
      } catch (err) {
        console.error('Token decode error:', err);
      }
    }

    // Connect socket for real-time updates with auth token
    const authToken = localStorage.getItem('token');
    const newSocket = io(SOCKET_BASE_URL, { auth: { token: authToken } });
    setSocket(newSocket);

    // Listen for status updates from backend
    newSocket.on('order:tracking', (data) => {
      if (data.orderId === parseInt(orderId)) {
        setCurrentStatus(data.status);
        setOrder(prev => prev ? { ...prev, status: data.status } : null);
      }
    });

    // Join the order-specific room and listen for new messages
    newSocket.emit('joinOrder', { orderId: Number(orderId) });
    newSocket.on(`chat:${orderId}`, (messageData) => {
      setMessages(prev => [...prev, messageData]);

      // Show notification when farmer sends a message
      if (messageData.sender_role === 'farmer' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('New message from farmer', {
          body: messageData.message,
          tag: `chat-${orderId}`
        });
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [orderId]);

  // Fetch order details and chat messages
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const [orderRes, chatRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/account/orders/${orderId}`),
          fetch(`${API_BASE_URL}/api/chats/${orderId}`)
        ]);

        if (orderRes.ok) {
          const orderData = await orderRes.json();
          setOrder(orderData);
          setCurrentStatus(orderData.status || 'pending');
        }

        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setMessages(chatData);
        }
      } catch (error) {
        console.error('Error fetching order details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: parseInt(orderId),
          senderRole: 'customer',
          message: newMessage
        })
      });

      if (response.ok) {
        const newMsg = {
          order_id: parseInt(orderId),
          sender_role: 'customer',
          message: newMessage,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, newMsg]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const getStepIndex = (status) => {
    const normalized = String(status || 'pending').toLowerCase();
    const index = ORDER_STEPS.indexOf(normalized);
    return index >= 0 ? index : 0;
  };

  const currentStepIndex = getStepIndex(currentStatus);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Order not found</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <>
      <Nav />
      <div className="order-detail-page" style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              marginRight: '15px'
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Order #{orderId}</h1>
        </div>

        <div className="status-timeline" style={{ backgroundColor: '#f8f9fa', padding: '30px', borderRadius: '12px', marginBottom: '30px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '16px', fontWeight: '600' }}>Delivery Status</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '20px', left: 0, right: 0, height: '2px', backgroundColor: '#e0e0e0', zIndex: 0 }}>
              <div style={{ height: '100%', backgroundColor: '#4CAF50', width: `${(currentStepIndex / (ORDER_STEPS.length - 1)) * 100}%`, transition: 'width 0.3s ease' }} />
            </div>
            {ORDER_STEPS.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isActive = index === currentStepIndex;
              return (
                <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative', zIndex: 1 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: isCompleted ? '#4CAF50' : '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: '8px', transition: 'background-color 0.3s ease', fontWeight: 'bold' }}>
                    {isCompleted ? <FontAwesomeIcon icon={faCheck} /> : index + 1}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: isActive ? '600' : '500', textAlign: 'center', color: isCompleted ? '#333' : '#999', marginBottom: '4px' }}>
                    {STEP_LABELS[step]}
                  </div>
                  {isCompleted && <div style={{ fontSize: '11px', color: '#666' }}>{step === 'pending' ? 'Just now' : ''}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '20px', marginBottom: '30px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '14px', fontWeight: '600' }}>Order Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div><p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Recipient</p><p style={{ margin: 0, fontWeight: '500' }}>{order.buyerName}</p></div>
            <div><p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Phone</p><p style={{ margin: 0, fontWeight: '500' }}>{order.buyerPhoneNumber}</p></div>
            <div><p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Delivery Address</p><p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{order.buyerLocation}</p></div>
            <div><p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>Total Amount</p><p style={{ margin: 0, fontWeight: '600', fontSize: '16px', color: '#4CAF50' }}>₹{order.totalPrice}</p></div>
          </div>
        </div>

        <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '500px' }}>
          <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderBottom: '1px solid #e0e0e0', fontWeight: '600', fontSize: '14px' }}>
            Chat with Farmer
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', fontSize: '14px', marginTop: 'auto', marginBottom: 'auto' }}>
                No messages yet. Send the first message!
              </div>
            ) : (
              messages.map((msg, index) => {
                const isCustomer = msg.sender_role === 'customer';
                return (
                  <div key={msg.id || index} style={{ display: 'flex', justifyContent: isCustomer ? 'flex-end' : 'flex-start' }}>
                    <div style={{ backgroundColor: isCustomer ? '#4CAF50' : '#e0e0e0', color: isCustomer ? 'white' : '#333', padding: '10px 15px', borderRadius: '12px', maxWidth: '70%', wordWrap: 'break-word', fontSize: '14px' }}>
                      {msg.message}
                      <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '5px' }}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} style={{ display: 'flex', borderTop: '1px solid #e0e0e0', padding: '15px', gap: '10px' }}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', padding: '10px', fontSize: '14px', outline: 'none' }}
              disabled={sendingMessage}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sendingMessage}
              style={{ backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: '500', opacity: (!newMessage.trim() || sendingMessage) ? 0.5 : 1, transition: 'opacity 0.3s' }}
            >
              <FontAwesomeIcon icon={faPaperPlane} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default OrderDetailPage;
