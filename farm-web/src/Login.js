import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {jwtDecode} from 'jwt-decode';
import { useGoogleLogin } from '@react-oauth/google';
import { useLanguage } from './context/LanguageContext';

const Login = ({ setAuthenticated }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loginType, setLoginType] = useState('user'); // 'user' or 'partner'
  const { language, setLanguage, t } = useLanguage();

  const finishLogin = (token) => {
    localStorage.setItem('token', token);

    const decodedToken = jwtDecode(token);
    const { email: userEmail, isAdmin, isFarmer } = decodedToken;
    setAuthenticated(true);

    if (isAdmin) {
      navigate(`/dashboard/${userEmail}`);
    } else if (isFarmer) {
      navigate(`/farmerlanding/${userEmail}`);
    } else if (decodedToken.isRider) {
      navigate(`/delivery-partner`);
    } else {
      navigate(`/userlanding`);
    }

    // Log login activity after successful login
    logLoginActivity(email);
  };

  const handleLogin = async () => {
    try {
      const endpoint = loginType === 'partner' ? 'http://freshfarm-backend-env.eba-qnm4hc4g.ap-south-1.elasticbeanstalk.com/api/delivery-partners/login' : 'http://freshfarm-backend-env.eba-qnm4hc4g.ap-south-1.elasticbeanstalk.com/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();
      
      if (data.otpRequired) {
        setOtpRequired(true);
        alert(t('otpSent'));
      } else {
        finishLogin(data.token);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode) {
      alert(t('enterOtp'));
      return;
    }

    try {
      const response = await fetch('http://freshfarm-backend-env.eba-qnm4hc4g.ap-south-1.elasticbeanstalk.com/verify-otp-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify OTP.');
      }

      setOtpRequired(false);
      setOtpCode('');
      finishLogin(data.token);
    } catch (error) {
      alert(error.message);
    }
  };

  const logLoginActivity = async (email) => {
    try {
      await fetch('http://freshfarm-backend-env.eba-qnm4hc4g.ap-south-1.elasticbeanstalk.com/loginactivity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
    } catch (error) {
      console.error('Error logging login activity:', error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert(`${t('email')} / ${t('password')} required.`);
      return;
    }
    handleLogin();
  };

  // Handle Google Sign-In
  const handleGoogleSuccess = async (tokenResponse) => {
    setGoogleLoading(true);
    try {
      // Get user info from Google using access token
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      });
      const userInfo = await userInfoResponse.json();

      // Send to our backend for authentication/registration
      const response = await fetch('http://freshfarm-backend-env.eba-qnm4hc4g.ap-south-1.elasticbeanstalk.com/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: tokenResponse.access_token,
          email: userInfo.email,
          name: userInfo.name,
          googleId: userInfo.sub,
          role: loginType === 'partner' ? 'rider' : 'user'
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
      setAuthenticated(true);

      if (isAdmin) {
        navigate(`/dashboard/${userEmail}`);
      } else if (isFarmer) {
        navigate(`/farmerlanding/${userEmail}`);
      } else if (decodedToken.isRider) {
        navigate('/delivery-partner');
      } else {
        navigate('/userlanding');
      }

      // Log login activity
      logLoginActivity(userInfo.email);
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
    e.currentTarget.style.color = '#00AC7F';
    e.currentTarget.parentNode.querySelector('.underline').style.width = '100%';
  };

  const handleTextMouseLeave = (e) => {
    e.currentTarget.style.color = 'black';
    e.currentTarget.parentNode.querySelector('.underline').style.width = '50%';
  };

  

  return (
    <div>
      <nav style={{ backgroundColor: '#fff', height: '50px', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', borderBottom: '5px solid transparent', }}>
      <img src={require('./uss.png')} alt="logo" style={{ height: '100px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
          <span style={{ position: 'relative', zIndex: 1 }}>{t('becomeASeller')}</span>
          <span className="underline" style={{ ...spanStyle }} />
        </Link>
        <Link
          to="/delivery-partner"
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
          <span style={{ position: 'relative', zIndex: 1 }}>{t('joinAsRider')}</span>
          <span className="underline" style={{ ...spanStyle }} />
        </Link>
        <Link
          to="/login"
          style={{ color: 'black', marginRight: '20px', textDecoration: 'none', transition: 'backgroundColor 0.2s ease', padding: '8px 15px', borderRadius: '5px', border: '1px solid transparent'}}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.backgroundColor = '#00AC7F'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'black'; e.currentTarget.style.backgroundColor = 'white'; }}
        >
          {t('signInButton')}
        </Link>
        <Link
          to="/signup"
          style={{ color: 'black', textDecoration: 'none', transition: 'backgroundColor 0.2s ease', padding: '8px 15px', borderRadius: '5px', border: '1px solid transparent'}}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.backgroundColor = '#00AC7F'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'black'; e.currentTarget.style.backgroundColor = 'white'; }}
        >
          {t('signUp')}
        </Link>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ height: '36px', borderRadius: '8px', border: '1px solid #ddd', padding: '0 10px' }}>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="te">Telugu</option>
        </select>
      </div>
    </nav>

      
      {/* Main Login Content */}
      {/* Main Login Content */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: 'calc(100vh - 80px)', 
        backgroundColor: '#f8fafc',
        padding: '20px'
      }}>
        <div style={{ 
          display: 'flex', 
          borderRadius: '20px', 
          backgroundColor: '#ffffff', 
          overflow: 'hidden', 
          width: '900px',
          maxWidth: '100%',
          height: '550px', 
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' 
        }}>
          {/* Left Side - Image */}
          <div style={{ backgroundColor: '#f1f5f9', flex: 1.2, position: 'relative' }}>
            <img 
              src={require('./u.jpg')} 
              alt="Farmers" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '40px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
              color: '#fff'
            }}>
              <h3 style={{ margin: 0, fontSize: '24px' }}>Freshness Delivered</h3>
              <p style={{ margin: '10px 0 0', opacity: 0.9 }}>Connecting local farmers directly to your doorstep.</p>
            </div>
          </div>

          {/* Right Side - Form */}
          <div style={{ flex: 1, padding: '40px', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <form onSubmit={otpRequired ? handleVerifyOTP : handleSubmit} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <div style={{ marginBottom: '30px' }}>
                <h2 style={{ color: '#1e293b', fontSize: '28px', margin: 0, fontWeight: '800' }}>
                  {t('welcomeTo')} <span style={{ color: '#00AC7F' }}>Fresh Farms</span>
                </h2>
                <p style={{ color: '#64748b', fontSize: '15px', marginTop: '8px' }}>Choose your role to continue</p>
              </div>

              {/* Role Selection Toggle */}
              <div style={{ 
                display: 'flex', 
                background: '#f1f5f9', 
                padding: '4px', 
                borderRadius: '12px', 
                marginBottom: '25px',
                width: '100%' 
              }}>
                <button 
                  type="button" 
                  onClick={() => setLoginType('user')}
                  style={{ 
                    flex: 1, 
                    padding: '10px', 
                    border: 'none', 
                    borderRadius: '10px', 
                    background: loginType === 'user' ? '#fff' : 'transparent', 
                    color: loginType === 'user' ? '#00AC7F' : '#64748b', 
                    fontWeight: '700', 
                    fontSize: '14px', 
                    cursor: 'pointer', 
                    boxShadow: loginType === 'user' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {t('consumerFarmerLogin')}
                </button>
                <button 
                  type="button" 
                  onClick={() => setLoginType('partner')}
                  style={{ 
                    flex: 1, 
                    padding: '10px', 
                    border: 'none', 
                    borderRadius: '10px', 
                    background: loginType === 'partner' ? '#fff' : 'transparent', 
                    color: loginType === 'partner' ? '#00AC7F' : '#64748b', 
                    fontWeight: '700', 
                    fontSize: '14px', 
                    cursor: 'pointer', 
                    boxShadow: loginType === 'partner' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {t('riderLogin')}
                </button>
              </div>

              <div style={{ width: '100%' }}>
                {!otpRequired ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <input 
                        type="text" 
                        name="email" 
                        placeholder={t('email')} 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        style={{ 
                          padding: '12px 15px', 
                          borderRadius: '10px', 
                          border: '1px solid #e2e8f0', 
                          fontSize: '15px',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }} 
                        onFocus={(e) => e.target.style.borderColor = '#00AC7F'}
                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                      />
                      <input 
                        type="password" 
                        name="password" 
                        placeholder={t('password')} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        style={{ 
                          padding: '12px 15px', 
                          borderRadius: '10px', 
                          border: '1px solid #e2e8f0', 
                          fontSize: '15px',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }} 
                        onFocus={(e) => e.target.style.borderColor = '#00AC7F'}
                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                      />
                    </div>

                    <button 
                      type="submit" 
                      style={{ 
                        padding: '12px', 
                        marginTop: '25px', 
                        backgroundColor: '#00AC7F', 
                        border: 'none', 
                        borderRadius: '10px', 
                        cursor: 'pointer', 
                        color: '#fff',
                        width: '100%', 
                        fontWeight: '700',
                        fontSize: '16px',
                        transition: 'background-color 0.2s',
                        boxShadow: '0 4px 6px -1px rgba(0, 172, 127, 0.2)' 
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#00966e'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#00AC7F'}
                    >
                      {t('signInButton')}
                    </button>

                    {/* OR Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                      <span style={{ padding: '0 15px', color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>OR</span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                    </div>

                    {/* Continue with Google Button */}
                    <button
                      type="button"
                      onClick={() => googleLogin()}
                      disabled={googleLoading}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        padding: '12px',
                        width: '100%',
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        cursor: googleLoading ? 'not-allowed' : 'pointer',
                        color: '#475569',
                        fontSize: '15px',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        opacity: googleLoading ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => { if (!googleLoading) { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; } }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                    >
                      <svg width="20" height="20" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      {googleLoading ? t('signIn') : t('continueWithGoogle')}
                    </button>

                    <div style={{ marginTop: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                        {t('dontHaveAccount')} <Link to="/signup" style={{ color: '#00AC7F', textDecoration: 'none', fontWeight: '700' }}>{t('signUp')}</Link>
                      </p>
                      <Link to="/farmer_signup" style={{ color: '#00AC7F', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>{t('becomeASeller')}</Link>
                      <Link to="/rider_signup" style={{ color: '#0070f3', textDecoration: 'none', fontWeight: '700', fontSize: '14px' }}>🚀 Join as Delivery Partner</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px' }}>
                      {t('otpPrompt')} <b>{email}</b>.
                    </p>
                    <input 
                      type="text" 
                      name="otp" 
                      placeholder={t('enterOtp')} 
                      value={otpCode} 
                      onChange={(e) => setOtpCode(e.target.value)} 
                      style={{ 
                        padding: '12px 15px', 
                        borderRadius: '10px', 
                        border: '1px solid #e2e8f0', 
                        fontSize: '15px',
                        width: '100%',
                        outline: 'none' 
                      }} 
                    />
                    <button 
                      type="submit" 
                      style={{ 
                        padding: '12px', 
                        marginTop: '20px', 
                        backgroundColor: '#00AC7F', 
                        border: 'none', 
                        borderRadius: '10px', 
                        cursor: 'pointer', 
                        color: '#fff',
                        width: '100%', 
                        fontWeight: '700',
                        fontSize: '16px' 
                      }}
                    >
                      {t('verifyOtp')}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
