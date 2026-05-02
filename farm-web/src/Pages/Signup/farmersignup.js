import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import './Signup.css';
import { useLanguage } from '../../context/LanguageContext';

const NavigationBar = () => {
  const { language, setLanguage, t } = useLanguage();
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
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ height: '36px', borderRadius: '8px', border: '1px solid #ddd', padding: '0 10px', marginLeft: '10px' }}>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="te">Telugu</option>
        </select>
      </div>
    </nav>
  );
}

const SignupForm = () => {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [farmName, setFarmName] = useState('');
  const [farmerAddress, setFarmerAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prepare the data to be sent
    const formData = {
      fullName,
      email,
      phoneNumber,
      farmName,
      farmerAddress,
      password,
      type: 'farmer'
    };

    try {
      const response = await fetch('http://localhost:8081/send-otp-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
  
      const data = await response.json();
      if (response.ok) {
        setOtpRequired(true);
        alert(t('otpSent'));
      } else {
        alert(data.error || 'Failed to send OTP.');
      }
    } catch (error) {
      console.error('Error during signup:', error);
      alert('An unexpected error occurred. Please try again later.');
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode) {
      alert(t('enterOtp'));
      return;
    }
    try {
      const response = await fetch('http://localhost:8081/verify-otp-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode })
      });
  
      const data = await response.json();
      if (response.ok) {
        setOtpRequired(false);
        setOtpCode('');
        clearForm();
        alert('Signup successful!');
        navigate('/login');
      } else {
        alert(data.error || 'Invalid OTP.');
      }
    } catch (error) {
      console.error('Error during OTP verify:', error);
      alert('An unexpected error occurred. Please try again later.');
    }
  };
  
  const clearForm = () => {
    setFullName('');
    setEmail('');
    setPhoneNumber('');
    setFarmName('');
    setFarmerAddress('');
    setPassword('');
    setConfirmPassword('');
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

      // Send to our backend for authentication/registration with farmer role
      const response = await fetch('http://localhost:8081/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: tokenResponse.access_token,
          email: userInfo.email,
          name: userInfo.name,
          googleId: userInfo.sub,
          role: 'farmer'
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

  return (
    <>
      <NavigationBar />
      <div className="form-container" style={{ marginTop: '-50px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#fff', marginBottom: '100px', marginTop:'50px'}}>
          <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '10px', backgroundColor: '#ffffff', overflow: 'hidden', height: 'auto', paddingBottom: '20px', boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px' }}>
              <form onSubmit={otpRequired ? handleVerifyOTP : handleSubmit} style={{ display: 'flex', flexDirection: 'column'}}>
                <div>
                  <h2 style={{ color: 'black', fontSize: '20px', marginBottom: '10px', marginLeft: '10px' }}>
                    {t('createAccount')} <span style={{ color: '#00AC7F' }}>Fresh Farms</span>
                  </h2>
                </div>
                <div style={{ backgroundColor: 'transparent', marginRight:'22px'}}>
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
                      type="text"
                      placeholder={t('productsSection')}
                      value={farmName}
                      onChange={(e) => setFarmName(e.target.value)}
                      style={{ padding: '12px', borderRadius: '8px', height: '7px', border: '1px solid #ccc', transition: 'border-color 0.3s ease', marginBottom: '5px' }}
                    />
                  </label>
                  <label style={{ marginTop: '0px', color: '#333' }}>
                    <input
                      type="text"
                      placeholder={t('deliveryLocation')}
                      value={farmerAddress}
                      onChange={(e) => setFarmerAddress(e.target.value)}
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
                      transition: 'background-color 0.3s ease', 
                      width:'320px',
                      marginBottom: '15px',
                      opacity: googleLoading ? 0.7 : 1
                    }}
                  >
                    <img src="https://img.icons8.com/color/48/000000/google-logo.png" alt="Google logo" style={{ width: '18px', marginRight: '10px' }} />
                    {googleLoading ? t('signIn') : t('continueWithGoogle')}
                  </button>
                  </>
                  ) : (
                    <>
                      <p style={{ margin: '10px', color: '#555' }}>
                        {t('otpPrompt')} <b>{email}</b>.
                      </p>
                      <label style={{ marginTop: '10px', color: '#333' }}>
                        <input type="text" name="otp" placeholder={t('enterOtp')} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} style={{ padding: '10px', borderRadius: '10px', height: '20px', border: '1px solid #ccc', transition: 'border-color 0.3s ease' }} />
                      </label>
                      <button type="submit" style={{ padding: '10px 40px', marginTop: '30px', marginBottom: '10px', backgroundColor: '#06C265', border: 'none', height: '40px', borderRadius: '10px', cursor: 'pointer', color: '#fff',width:'320px', transition: 'background-color 0.3s ease', boxShadow: '0 4px 6px rgba(0, 123, 255, 0.1)' }}>{t('verifyOtp')}</button>
                    </>
                  )}
                        {/* Move the "Already have an account?" link inside the form container */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <p style={{ marginTop: '10px', textAlign: 'center' }}>{t('alreadyHaveAccount')} <Link to="/login" style={{ color: '#28a745', textDecoration: 'none' }}>{t('signInButton')}</Link></p>
      </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}

export default SignupForm;