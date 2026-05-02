import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './UserInquiry.css';
import axios from 'axios'; // Import Axios for making HTTP requests
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useLanguage } from '../context/LanguageContext';

const UserInquiry = ({ productName }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    contactNumber: '',
    email: '',
    message: '',
  });
  const [isMessageSent, setIsMessageSent] = useState(false);
  const [errors, setErrors] = useState({});
  const { language, setLanguage, t } = useLanguage();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.firstName) newErrors.firstName = `${t('firstName')} is required`;
    if (!form.lastName) newErrors.lastName = `${t('lastName')} is required`;
    if (!form.contactNumber) newErrors.contactNumber = `${t('contactNumber')} is required`;
    if (!form.email) {
      newErrors.email = `${t('email')} is required`;
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = `${t('email')} is invalid`;
    }
    if (!form.message) newErrors.message = `${t('message')} is required`;

    return newErrors;
  };

  const handleSubmit = async () => {
    const formErrors = validateForm();
    if (Object.keys(formErrors).length === 0) {
      try {
        await axios.post('http://localhost:8081/submit-inquiry', form); // Send form data to backend
        setIsMessageSent(true);
      } catch (error) {
        console.error('Error submitting form:', error);
        // Handle error if submission fails
      }
    } else {
      setErrors(formErrors);
    }
  };

  const handleGoBack = () => {
    navigate(-1); // Go back to the previous page
  };

  return (
    <div className="user-inquiry">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px' }}>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ height: '36px', borderRadius: '8px', border: '1px solid #ddd', padding: '0 10px' }}>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="te">Telugu</option>
        </select>
      </div>
       <button className="go-back-button1" onClick={handleGoBack}>
        <FontAwesomeIcon icon={faArrowLeft} className="go-back-icon1" /> 
        <span className="go-back-text1">{t('goHome')}</span>
      </button>
      {!isMessageSent ? (
        <div className="form-container1">
         
          <h2>{t('inquiryTitle')}</h2>
          <div className="form-group">
            <input
              type="text"
              name="firstName"
              placeholder={t('firstName')}
              value={form.firstName}
              onChange={handleChange}
            />
            {errors.firstName && <span className="error">{errors.firstName}</span>}
          </div>
          <div className="form-group">
            <input
              type="text"
              name="lastName"
              placeholder={t('lastName')}
              value={form.lastName}
              onChange={handleChange}
            />
            {errors.lastName && <span className="error">{errors.lastName}</span>}
          </div>
          <div className="form-group">
            <input
              type="text"
              name="contactNumber"
              placeholder={t('contactNumber')}
              value={form.contactNumber}
              onChange={handleChange}
            />
            {errors.contactNumber && <span className="error">{errors.contactNumber}</span>}
          </div>
          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder={t('email')}
              value={form.email}
              onChange={handleChange}
            />
            {errors.email && <span className="error">{errors.email}</span>}
          </div>
          <div className="form-group">
            <textarea
              name="message"
              placeholder={t('message')}
              value={form.message}
              onChange={handleChange}
            ></textarea>
            {errors.message && <span className="error">{errors.message}</span>}
          </div>
          <button2 onClick={handleSubmit}>{t('send')}</button2>
        </div>
      ) : (
        <div className="thank-you-message">
          
          <h2>{t('messageSent')}</h2>
          <p>{t('inquiryThanks')} {productName}. We'll get back to you soon.</p>
        </div>
      )}
    </div>
  );
};

export default UserInquiry;