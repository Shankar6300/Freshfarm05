// ProductDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Nav from '../Nav';
import Footer from '../Components/AppFooter/footer';
import './ProductDetailPage.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCartShopping, faBagShopping, faEnvelope } from '@fortawesome/free-solid-svg-icons'; // Import the envelope icon
import CartModal from './CartModal';
import { useLanguage } from '../context/LanguageContext';
import { getLocalizedProductName } from '../utils/localizedProduct';

const ProductDetailPage = () => {
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [availability, setAvailability] = useState('Unknown');
  const [category, setCategory] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const { t, language } = useLanguage();

  const { productId } = useParams();

  useEffect(() => {
    axios.get(`https://d2pskbh3g9o3pk.cloudfront.net/api1/products/${productId}`)
      .then(response => {
        setProduct(response.data);
        setCategory(response.data.category);
        if (response.data.quantity >= 10) {
          setAvailability('High Stock');
        } else if (response.data.quantity > 0 && response.data.quantity < 10) {
          setAvailability('Low Stock');
        } else {
          setAvailability('Out of Stock');
        }
      })
      .catch(error => {
        console.error('Error fetching product detail:', error);
      });

  }, [productId]);

  const handleIncreaseQuantity = () => {
    setQuantity(quantity + 1);
  };

  const handleDecreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleAddToCart = () => {
    const totalPrice = product.price * quantity;

    axios.post('https://d2pskbh3g9o3pk.cloudfront.net/api11/products/cart', {
      product_name: product.name,
      quantity,
      category: category,
      price: totalPrice,
      timestamp: product.timestamp
    })
      .then(response => {
        console.log('Product added to cart successfully');
        setShowModal(true); // Show modal on successful add to cart
      })
      .catch(error => {
        console.error('Error adding product to cart:', error);
      });
  };

  const handleGoToCart = () => {
    setShowModal(false);
    navigate('/addCart');
  };

  const handleInquiry = () => {
    navigate('/inquiry');
  };

  if (!product) {
    return <div>{t('loading')}</div>;
  }

  const localizedProductName = getLocalizedProductName(product, language);
  const imageSrc = product.image && (String(product.image).startsWith('http://') || String(product.image).startsWith('https://'))
    ? product.image
    : `https://d2pskbh3g9o3pk.cloudfront.net/${product.image}`;
  const fallbackImage = 'https://placehold.co/900x700/E5E7EB/374151?text=FreshFarm+Product';

  return (
    <div>
      <Nav />
      <div className="product-container">
        <div className="product-details">
          <img
            className="product-image"
            src={imageSrc}
            alt={localizedProductName}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = fallbackImage;
            }}
          />
          <div className="product-info">
            <h2>{localizedProductName}</h2>
            <p>{t('price')}: Rs.{product.price}</p>
            <p1>{product.description}</p1>
            <p style={{ color: 'black' }}>{t('category')}: {category}</p>
            <p style={{ color: 'grey', fontSize: '16px' }}>{t('availability')}: {availability === 'Out of Stock' ? t('outOfStock') : t('inStock')}</p>
            <div className="quantity-control">
              <span>{t('kilogram')}:</span>
              <button onClick={handleDecreaseQuantity}>-</button>
              <span>{quantity}</span>
              <button onClick={handleIncreaseQuantity}>+</button>
            </div>
            <div className='new-button'>
              <div className="add-to-cart-button">
                <button onClick={handleAddToCart} className='buttonStyle'>
                  <FontAwesomeIcon icon={faCartShopping} /> {t('addToCart')}
                </button>
              </div>
              <div className="buy-now-button">
                <button onClick={handleGoToCart} className='buyNowButton'>
                  <FontAwesomeIcon icon={faBagShopping} /> {t('buyNow')}
                </button>
              </div>
            </div>
          </div>
          <div className="inquiry-button">
          <button className="inquiryButton" onClick={handleInquiry}>
              <FontAwesomeIcon icon={faEnvelope} /> {t('inquiry')}
            </button>
          </div>
        </div>
      </div>
      <Footer />
      <CartModal show={showModal} onClose={() => setShowModal(false)} onGoToCart={handleGoToCart} />
    </div>
  );
};

export default ProductDetailPage;