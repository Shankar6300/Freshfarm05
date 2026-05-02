import React, { useState, useEffect } from 'react';
import FarmerSidebar from '../../Components/Sidebar/FarmerSidebar'; // Import Sidebar component
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

const FarmerOrder = () => {
  const [orders, setOrders] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [dropdownStatus, setDropdownStatus] = useState({}); // State to manage dropdown status
  const [showChat, setShowChat] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = React.useRef(null);
  const [showTracker, setShowTracker] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const API_BASE_URL = 'https://d2pskbh3g9o3pk.cloudfront.net';

  useEffect(() => {
    fetchOrders(); // Fetch orders when the component mounts
  }, []); // Empty dependency array to run once on mount

  const fetchOrders = () => {
    // Make an API call to fetch orders
    fetch('https://d2pskbh3g9o3pk.cloudfront.net/api11/farmer/orders') // Replace the URL with your actual backend endpoint
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }
        return response.json();
      })
      .then(data => {
        // Transform the fetched data to match the table structure
        const transformedData = data.map(order => ({
          orderId: order.items?.[0]?.orderId,
          productName: order.items?.[0]?.productName,
          productId: order.items?.[0]?.productId,
          productQuantity: order.items?.[0]?.quantity,
          productCategory: order.items?.[0]?.category,
          productPrice: order.items?.[0]?.price,
          totalPrice: order.totalPrice,
          orderPlacedDate: order.orderDate,
          orderedBy: order.buyerName,
          contactInfo: order.buyerPhoneNumber,
          status: (order.status || 'pending').toLowerCase(),
        }));

        setOrders(transformedData); // Update the orders state with transformed data
        // Set initial dropdown status for each order
        const initialDropdownStatus = {};
        transformedData.forEach(order => {
          initialDropdownStatus[order.orderId] = order.status;
        });
        setDropdownStatus(initialDropdownStatus);
      })
      .catch(error => {
        console.error('Error fetching orders:', error);
        // Handle error (e.g., display error message to the user)
      });
  };

  const updateOrderStatus = (orderId, newStatus) => {
    // Update the order status directly in the frontend
    const updatedOrders = orders.map(order => {
      if (order.orderId === orderId) {
        return { ...order, status: newStatus };
      }
      return order;
    });
    setOrders(updatedOrders);
    // Update dropdown status
    setDropdownStatus(prevStatus => ({
      ...prevStatus,
      [orderId]: newStatus,
    }));

    // Send a POST request to update the order status in the backend
    fetch(`https://d2pskbh3g9o3pk.cloudfront.net/api11/farmer/orders/${orderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: newStatus }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to update order status');
      }
      // Handle successful response if needed
    })
    .catch(error => {
      console.error('Error updating order status:', error);
      // Handle error (e.g., display error message to the user)
    });
  };
  const fetchMessages = async (orderId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats/${orderId}`);
      const data = await response.json();
      if (response.ok) setChatMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeOrder) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activeOrder.orderId,
          senderRole: 'farmer',
          message: newMessage
        })
      });
      if (response.ok) {
        setNewMessage('');
        fetchMessages(activeOrder.orderId);
      }
    } catch (err) {
      console.error('Failed to send message');
    }
  };

  useEffect(() => {
    let interval;
    if (showChat && activeOrder) {
      fetchMessages(activeOrder.orderId);
      interval = setInterval(() => fetchMessages(activeOrder.orderId), 3000);
    }
    return () => clearInterval(interval);
  }, [showChat, activeOrder]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchTrackingData = async () => {
    if (!activeOrder) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/${activeOrder.orderId}/assignment`);
      const data = await response.json();
      if (response.ok && data) {
        setTrackingData(data);
      } else {
        setTrackingData(null);
      }
    } catch (err) {
      console.error('Failed to fetch tracking data');
    }
  };

  useEffect(() => {
    let interval;
    if (showTracker && activeOrder) {
      fetchTrackingData();
      interval = setInterval(fetchTrackingData, 10000); // Sync location every 10s
    }
    return () => clearInterval(interval);
  }, [showTracker, activeOrder]);
  const handleSearchInputChange = e => {
    setSearchInput(e.target.value);
  };

  const filteredOrders = orders.filter(order =>
    order.productName &&
    order.productName.toLowerCase().includes(searchInput.toLowerCase())
  );

  return (
    <div>
      <FarmerSidebar /> {/* Include Sidebar component */}
      <h1 style={{ marginBottom: '30px', fontWeight: '400', fontSize: '24px', marginLeft: '290px' }}>Orders</h1>
      <input
        type="text"
        value={searchInput}
        onChange={handleSearchInputChange}
        placeholder="Search by product name"
        style={{ height: '8px', marginLeft: '290px', padding: '14px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ddd', width: '400px', maxWidth: '400px' }}
      />
      <div className="farmer-order-container">
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Product Name</th>
              <th>Product ID</th>
              <th>Quantity</th>
              <th>Category</th>
              <th>Price</th>
              <th>Total Price</th>
              <th>Date</th>
              <th>Ordered By</th>
              <th>Phone Number</th>
              <th>Order Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.orderId}> {/* Use 'orderId' as key */}
                <td>{order.orderId}</td> {/* Use 'orderId' to display */}
                <td>{order.productName}</td>
                <td>{order.productId}</td>
                <td>{order.productQuantity}</td>
                <td>{order.productCategory}</td>
                <td>{order.productPrice}</td>
                <td>{order.totalPrice}</td>
                <td>{order.orderPlacedDate}</td>
                <td>{order.orderedBy}</td>
                <td>{order.contactInfo}</td>
                <td style={{ textAlign: 'center', position: 'relative' }}>
                  <select
                    value={dropdownStatus[order.orderId] || ''} // Use dropdownStatus to set value
                    onChange={e => {
                      updateOrderStatus(order.orderId, e.target.value); // Use 'orderId' here
                    }}
                    style={{ margin: '0 auto', border: 'none', display: 'flex', alignItems: 'center', position: 'absolute', right: '0' }} // Align dropdown to the right
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="packed">Packed</option>
                    <option value="picked_up">Picked Up</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button 
                        onClick={() => { setActiveOrder(order); setShowChat(true); }}
                        style={{ padding: '5px 10px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                      >
                        Chat
                      </button>
                      <button 
                        onClick={() => { setActiveOrder(order); setShowTracker(true); }}
                        style={{ padding: '5px 10px', backgroundColor: '#00AC7F', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                      >
                        Track
                      </button>
                      <button 
                        onClick={() => fetch(`${API_BASE_URL}/api/orders/${order.orderId}/trigger-rider-offers`, { method: 'POST' }).then(() => alert('Looking for online riders...'))}
                        style={{ padding: '5px 10px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                      >
                        Find Rider
                      </button>
                      {order.status === 'confirmed' && (
                        <button 
                          onClick={() => {
                            fetch(`${API_BASE_URL}/api11/farmer/orders/${order.orderId}/status`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'confirmed' }) // Re-trigger search
                            }).then(() => alert('Search re-triggered! Nearby riders notified.'));
                          }}
                          style={{ padding: '5px 10px', backgroundColor: '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                        >
                          Find Rider
                        </button>
                      )}
                    </div>
                 </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

       {showChat && activeOrder && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ width: '400px', height: '500px', backgroundColor: '#fff', borderRadius: '15px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
               <div style={{ padding: '15px', backgroundColor: '#0070f3', color: '#fff', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Chat: Rider for Order #{activeOrder.orderId}</span>
                  <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>×</button>
               </div>
               <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {chatMessages.length === 0 && <p style={{ textAlign: 'center', color: '#999' }}>No messages yet.</p>}
                  {chatMessages.map((m, i) => (
                    <div key={i} style={{ padding: '10px', borderRadius: '10px', maxWidth: '80%', fontSize: '14px', alignSelf: m.sender_role === 'farmer' ? 'flex-end' : 'flex-start', backgroundColor: m.sender_role === 'farmer' ? '#0070f3' : '#eee', color: m.sender_role === 'farmer' ? '#fff' : '#333' }}>
                       {m.message}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
               </div>
               <div style={{ padding: '15px', borderTop: '1px solid #eee', display: 'flex', gap: '10px' }}>
                  <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
                  <button onClick={handleSendMessage} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0070f3', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Send</button>
               </div>
            </div>
         </div>
       )}
       {showTracker && activeOrder && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ width: 'min(800px, 95%)', height: '600px', backgroundColor: '#fff', borderRadius: '15px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
               <div style={{ padding: '15px', backgroundColor: '#00AC7F', color: '#fff', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Live Rider Tracking: Order #{activeOrder.orderId}</span>
                  <button onClick={() => setShowTracker(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>×</button>
               </div>
               <div style={{ flex: 1, position: 'relative' }}>
                  {!trackingData ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: '10px' }}>
                       <p>Searching for assigned rider...</p>
                       <p style={{ fontSize: '12px', color: '#999' }}>Rider must accept the order before tracking is available.</p>
                    </div>
                  ) : (
                    <>
                      <MapContainer 
                        center={[trackingData.current_lat || 20.5937, trackingData.current_lng || 78.9629]} 
                        zoom={13} 
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {trackingData.current_lat && (
                          <Marker position={[trackingData.current_lat, trackingData.current_lng]}>
                            <Popup>
                              <b>{trackingData.partner_name}</b><br/>
                              {trackingData.vehicle_type} ({trackingData.vehicle_number})<br/>
                              Phone: {trackingData.phone_number}
                            </Popup>
                          </Marker>
                        )}
                      </MapContainer>
                      <div style={{ position: 'absolute', bottom: '20px', left: '20px', backgroundColor: '#fff', padding: '15px', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', zIndex: 1000 }}>
                         <h5 style={{ margin: '0 0 5px' }}>{trackingData.partner_name}</h5>
                         <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>{trackingData.vehicle_type}: {trackingData.vehicle_number}</p>
                         <p style={{ margin: '5px 0 0', fontWeight: 'bold', color: '#00AC7F' }}>Status: {trackingData.assignment_status.toUpperCase()}</p>
                      </div>
                    </>
                  )}
               </div>
            </div>
         </div>
       )}
    </div>
  );
};

export default FarmerOrder;
