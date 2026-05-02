// CartModal.js
import React from 'react';
import './CartModal.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../context/LanguageContext';

const CartModal = ({ show, onClose, onGoToCart }) => {
  const { t } = useLanguage();

  if (!show) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>
          <FontAwesomeIcon icon={faTimes} />
        </button>
        <div className="modal-body">
          <FontAwesomeIcon icon={faCheckCircle} className="success-icon" />
          <p>{t('addedToCartSuccess')}</p>
          <button className="go-to-cart-button" onClick={onGoToCart}>
            {t('goToCart')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartModal;