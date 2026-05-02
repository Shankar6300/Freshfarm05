import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useLanguage } from '../../context/LanguageContext';

const RiderSignup = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [step, setStep] = useState(1); // 1: Details, 2: OTP
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phoneNumber: '',
        password: '',
        confirmPassword: ''
    });
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSendOTP = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert('Passwords do not match!');
            return;
        }
        setLoading(true);
        try {
            const response = await fetch('https://d2pskbh3g9o3pk.cloudfront.net/send-otp-signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, type: 'rider' })
            });
            const data = await response.json();
            if (response.ok) {
                setStep(2);
                alert('OTP sent to your email!');
            } else {
                alert(data.error || 'Failed to send OTP');
            }
        } catch (err) {
            alert('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch('https://d2pskbh3g9o3pk.cloudfront.net/verify-otp-signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, otp, ...formData, type: 'rider' })
            });
            const data = await response.json();
            if (response.ok) {
                alert('Signup successful! Please login to complete your profile.');
                navigate('/login');
            } else {
                alert(data.error || 'Invalid OTP');
            }
        } catch (err) {
            alert('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setLoading(true);
            try {
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const userInfo = await userInfoResponse.json();

                const response = await fetch('https://d2pskbh3g9o3pk.cloudfront.net/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: userInfo.email,
                        name: userInfo.name,
                        role: 'rider'
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('token', data.token);
                    alert('Google signup successful!');
                    navigate('/delivery-partner');
                } else {
                    alert('Google auth failed');
                }
            } catch (error) {
                alert('Error with Google Sign-in');
            } finally {
                setLoading(false);
            }
        },
    });

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f7f6', padding: '20px' }}>
            <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '100%', maxWidth: '450px' }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <h2 style={{ color: '#00AC7F', marginBottom: '10px' }}>🚀 Join as Rider</h2>
                    <p style={{ color: '#666' }}>Deliver fresh produce and earn with us!</p>
                </div>

                {step === 1 ? (
                    <form onSubmit={handleSendOTP}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input name="fullName" placeholder="Full Name" value={formData.fullName} onChange={handleChange} required style={inputStyle} />
                            <input name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} required style={inputStyle} />
                            <input name="phoneNumber" placeholder="Phone Number" value={formData.phoneNumber} onChange={handleChange} required style={inputStyle} />
                            <input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} required style={inputStyle} />
                            <input name="confirmPassword" type="password" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} required style={inputStyle} />
                            
                            <button type="submit" disabled={loading} style={buttonStyle}>
                                {loading ? 'Processing...' : 'Register & Send OTP'}
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', margin: '15px 0' }}>
                                <div style={{ flex: 1, height: '1px', backgroundColor: '#eee' }}></div>
                                <span style={{ padding: '0 10px', color: '#999', fontSize: '14px' }}>OR</span>
                                <div style={{ flex: 1, height: '1px', backgroundColor: '#eee' }}></div>
                            </div>

                            <button type="button" onClick={() => googleLogin()} style={googleButtonStyle}>
                                <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: '10px' }}>
                                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                                </svg>
                                Continue with Google
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOTP}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <p style={{ textAlign: 'center', fontSize: '14px' }}>Enter the 6-digit code sent to <b>{formData.email}</b></p>
                            <input placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} required style={inputStyle} maxLength={6} />
                            <button type="submit" disabled={loading} style={buttonStyle}>
                                {loading ? 'Verifying...' : 'Verify & Finish'}
                            </button>
                            <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#00AC7F', cursor: 'pointer' }}>Back to details</button>
                        </div>
                    </form>
                )}

                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <p style={{ fontSize: '14px', color: '#666' }}>Already have a rider account? <Link to="/login" style={{ color: '#00AC7F', textDecoration: 'none', fontWeight: 'bold' }}>Login here</Link></p>
                </div>
            </div>
        </div>
    );
};

const inputStyle = {
    padding: '12px 15px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '16px',
    width: '100%',
    boxSizing: 'border-box'
};

const buttonStyle = {
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#00AC7F',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
};

const googleButtonStyle = {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    backgroundColor: '#fff',
    color: '#444',
    fontSize: '15px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    width: '100%'
};

export default RiderSignup;
