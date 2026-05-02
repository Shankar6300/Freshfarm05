import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useLanguage } from '../../context/LanguageContext';

const RegistrationForm = () => {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    // Password criteria
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/; // At least 8 characters, one lowercase, one uppercase, one number
    if (!password.match(passwordRegex)) {
      alert('Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, and one number.');
      return;
    }
  
    // Form validation
    if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
      alert('Please fill in all fields.');
      return;
    }
  
    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
  
    try {
      // Send OTP
      const response = await fetch('https://d2pskbh3g9o3pk.cloudfront.net/send-otp-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phoneNumber, password, type: 'user' }),
      });
      
      const data = await response.json();
      if (response.ok) {
        setOtpRequired(true);
        alert(t('otpSent'));
      } else {
        alert(data.error || 'Failed to send OTP.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode) {
      alert(t('enterOtp'));
      return;
    }
    try {
      const response = await fetch('https://d2pskbh3g9o3pk.cloudfront.net/verify-otp-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode }),
      });
      
      const data = await response.json();
      if (response.ok) {
        setFullName('');
        setEmail('');
        setPhoneNumber('');
        setPassword('');
        setConfirmPassword('');
        setOtpRequired(false);
        setOtpCode('');
        alert('You have successfully signed up!');
      } else {
        alert(data.error || 'Invalid OTP.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  };

  // Handle Google Sign-In success
  const handleGoogleSuccess = async (tokenResponse) => {
    setGoogleLoading(true);
    try {
      // Get user info from Google using access token
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      });
      const userInfo = await userInfoResponse.json();

      // Send to our backend for authentication/registration
      const response = await fetch('https://d2pskbh3g9o3pk.cloudfront.net/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: tokenResponse.access_token,
          email: userInfo.email,
          name: userInfo.name,
          googleId: userInfo.sub,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Google sign-in failed');
      }

      const { token } = await response.json();
      localStorage.setItem('token', token);

      const decodedToken = jwtDecode(token);
      const { email: userEmail, isAdmin, isFarmer } = decodedToken;

      if (isAdmin) {
        navigate(`/dashboard/${userEmail}`);
      } else if (isFarmer) {
        navigate(`/farmerlanding/${userEmail}`);
      } else {
        navigate('/userlanding');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      alert(error.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => alert('Google sign-in was cancelled or failed.'),
  });

  const spanStyle = {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '50%',
    height: '3px',
    backgroundColor: '#00AC7F',
    transition: 'width 0.2s ease'
  };

  const handleTextMouseEnter = (e) => {
    e.target.style.color = '#00AC7F';
    e.target.parentNode.querySelector('.underline').style.width = '100%';
  };

  const handleTextMouseLeave = (e) => {
    e.target.style.color = 'black';
    e.target.parentNode.querySelector('.underline').style.width = '50%';
  };

  
  return (
    <div>
      {/* Navigation Header */}
      <nav style={{ backgroundColor: '#fff', height: '50px', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', borderBottom: '5px solid transparent', }}>
      <img src={require('../../uss.png')} alt="logo" style={{ height: '100px' }} />
      <div>
        <Link
          to="/farmer_signup"
          style={{
            color: 'black',
            marginRight: '20px',
            textDecoration: 'none',
            transition: 'backgroundColor 0.2s ease',
            padding: '8px 15px',
            borderRadius: '5px',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={handleTextMouseEnter}
          onMouseLeave={handleTextMouseLeave}
        >
          <span
            style={{ position: 'relative', zIndex: 1 }}
          >
            {t('becomeASeller')}
          </span>
          <span
            className="underline"
            style={{ ...spanStyle }}
          />
        </Link>
        <Link
          to="/login"
          style={{ color: 'black', marginRight: '20px', textDecoration: 'none', transition: 'backgroundColor 0.2s ease', padding: '8px 15px', borderRadius: '5px', border: '1px solid transparent'}}
          onMouseEnter={(e) => { e.target.style.color = 'white'; e.target.style.backgroundColor = '#00AC7F'; }}
          onMouseLeave={(e) => { e.target.style.color = 'black'; e.target.style.backgroundColor = 'white'; }}
        >
          {t('signInButton')}
        </Link>
        <Link
          to="/signup"
          style={{ color: 'black', textDecoration: 'none', transition: 'backgroundColor 0.2s ease', padding: '8px 15px', borderRadius: '5px', border: '1px solid transparent'}}
          onMouseEnter={(e) => { e.target.style.color = 'white'; e.target.style.backgroundColor = '#00AC7F'; }}
          onMouseLeave={(e) => { e.target.style.color = 'black'; e.target.style.backgroundColor = 'white'; }}
        >
          {t('signUp')}
        </Link>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ height: '36px', borderRadius: '8px', border: '1px solid #ddd', padding: '0 10px', marginLeft: '10px' }}>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="te">Telugu</option>
        </select>
      </div>
    </nav>

      {/* Main Signup Content */}
      <div className="form-container" style={{ marginTop: '-50px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#fff', marginBottom: '200px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '10px', backgroundColor: '#ffffff', overflow: 'hidden', height: 'auto', paddingBottom: '20px', boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', marginRight:'20px' }}>
              <form onSubmit={otpRequired ? handleVerifyOTP : handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                <div>
                  <h2 style={{ color: 'black', fontSize: '20px', marginBottom: '10px', marginLeft: '10px' }}>
                    {t('createAccount')} <span style={{ color: '#00AC7F' }}>Fresh Farms</span>
                  </h2>
                </div>
                <div style={{ backgroundColor: 'transparent' }}>
                  {!otpRequired ? (
                    <>
                  <label style={{ marginTop: '0px', color: '#333' }}>
                    <input
                      type="text"
                      placeholder={t('fullName')}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      style={{ padding: '12px', borderRadius: '8px', height: '7px', border: '1px solid #ccc', transition: 'border-color 0.3s ease', marginBottom: '5px' }}
                    />
                  </label>
                  <label style={{ marginTop: '0px', color: '#333' }}>
                    <input
                      type="email"
                      placeholder={t('email')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ padding: '12px', borderRadius: '8px', height: '7px', border: '1px solid #ccc', transition: 'border-color 0.3s ease', marginBottom: '5px' }}
                    />
                  </label>
                  <label style={{ marginTop: '0px', color: '#333' }}>
                    <input
                      type="tel"
                      placeholder={t('phoneNumberField')}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      style={{ padding: '12px', borderRadius: '8px', height: '7px', border: '1px solid #ccc', transition: 'border-color 0.3s ease', marginBottom: '5px' }}
                    />
                  </label>
                  <label style={{ marginTop: '0px', color: '#333' }}>
                    <input
                      type="password"
                      placeholder={t('password')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ padding: '12px', borderRadius: '8px', height: '7px', border: '1px solid #ccc', transition: 'border-color 0.3s ease', marginBottom: '5px' }}
                    />
                  </label>
                  <label style={{ marginTop: '0px', color: '#333' }}>
                    <input
                      type="password"
                      placeholder={t('confirmPassword')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ padding: '12px', borderRadius: '8px', height: '7px', border: '1px solid #ccc', transition: 'border-color 0.3s ease', marginBottom: '5px' }}
                    />
                  </label>
                  <button type="submit" style={{ padding: '8px 18px', marginTop: '10px',  backgroundColor: '#06C265', border: 'none', height: '40px', borderRadius: '10px', cursor: 'pointer', color: '#fff', transition: 'background-color 0.3s ease', boxShadow: '0 4px 6px rgba(0, 123, 255, 0.1)' , width:'320px'}}>{t('signUp')}</button>
                  
                  <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', width: '320px' }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: '#e0e0e0' }}></div>
                    <span style={{ margin: '0 10px', color: '#666', fontSize: '14px' }}>OR</span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: '#e0e0e0' }}></div>
                  </div>

                  <button 
                    type="button" 
                    onClick={() => googleLogin()}
                    disabled={googleLoading}
                    style={{ 
                      padding: '8px 18px', 
                      backgroundColor: '#fff', 
                      border: '1px solid #ddd', 
                      height: '40px', 
                      borderRadius: '10px', 
                      cursor: googleLoading ? 'not-allowed' : 'pointer', 
                      color: '#555', 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: googleLoading ? 'not-allowed' : 'pointer',
                      color: '#444',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                      opacity: googleLoading ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => { if (!googleLoading) { e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)'; e.target.style.borderColor = '#bbb'; } }}
                    onMouseLeave={(e) => { e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)'; e.target.style.borderColor = '#ddd'; }}
                  >
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    {googleLoading ? t('signIn') : t('continueWithGoogle')}
                  </button>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '10px', color: '#555' }}>
                        We sent a verification code to <b>{email}</b>.
                      </p>
                      <label style={{ marginTop: '10px', color: '#333' }}>
                        <input type="text" name="otp" placeholder="Enter OTP" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} style={{ padding: '12px', borderRadius: '8px', height: '7px', border: '1px solid #ccc', transition: 'border-color 0.3s ease', marginBottom: '5px' }} />
                      </label>
                      <button type="submit" style={{ padding: '8px 18px', marginTop: '10px',  backgroundColor: '#06C265', border: 'none', height: '40px', borderRadius: '10px', cursor: 'pointer', color: '#fff', transition: 'background-color 0.3s ease', boxShadow: '0 4px 6px rgba(0, 123, 255, 0.1)', width:'320px' }}>Verify OTP</button>
                    </>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <p style={{ marginTop: '10px', textAlign: 'center' }}>{t('alreadyHaveAccount')} <Link to="/login" style={{ color: '#28a745', textDecoration: 'none' }}>{t('signInButton')}</Link></p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <p style={{ marginTop: '1px', textAlign: 'center' }}> <Link to="/farmer_signup" style={{ color: '#28a745', textDecoration: 'none' }}>{t('becomeASeller')}</Link></p>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationForm;