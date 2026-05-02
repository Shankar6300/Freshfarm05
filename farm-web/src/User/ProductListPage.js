import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { faCartShopping } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useLanguage } from '../context/LanguageContext';
import { getLocalizedProductName } from '../utils/localizedProduct';
import '../styles/customer-ui.css';

const ProductListPage = ({ category, products: providedProducts = null, searchTerm: searchTermProp = '' }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 10; // Number of products per page
  const [fetchedProducts, setFetchedProducts] = useState([]);
  const { t, language } = useLanguage();

  const products = Array.isArray(providedProducts) ? providedProducts : fetchedProducts;

  const getCategoryFallback = (cat) => {
    const c = String(cat || '').toLowerCase();
    if (c.includes('fruit')) return 'https://placehold.co/900x700/FFE4E6/9F1239?text=Fresh+Fruits';
    if (c.includes('vegetable')) return 'https://placehold.co/900x700/DCFCE7/166534?text=Fresh+Vegetables';
    if (c.includes('dairy')) return 'https://placehold.co/900x700/DBEAFE/1E3A8A?text=Dairy+Products';
    if (c.includes('grain')) return 'https://placehold.co/900x700/FEF3C7/92400E?text=Grains';
    if (c.includes('spice')) return 'https://placehold.co/900x700/FEE2E2/991B1B?text=Spices';
    if (c.includes('organic')) return 'https://placehold.co/900x700/ECFCCB/365314?text=Organic';
    return 'https://placehold.co/900x700/E5E7EB/374151?text=FreshFarm+Product';
  };

  const getProductImageSrc = (product) => {
    if (product.imageUrl) {
      return product.imageUrl;
    }
    if (product.image) {
      if (String(product.image).startsWith('http://') || String(product.image).startsWith('https://')) {
        return product.image;
      }
      return `http://localhost:8081/${product.image}`;
    }
    return '';
  };

  useEffect(() => {
    if (Array.isArray(providedProducts)) {
      return;
    }

    // Fetch products from the backend API when parent does not provide products
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:8081/api/products');
        setFetchedProducts(response.data);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };
    fetchData();
  }, [category, providedProducts]);

  // Filter products by category if category is provided
  const filteredProducts = category
    ? products.filter((product) =>
        String(product.category || '').toLowerCase().includes(String(category).toLowerCase())
      )
    : products;

  // Filter products based on search term coming from parent search box
  const searchedProducts = filteredProducts.filter(product =>
    getLocalizedProductName(product, language).toLowerCase().includes((searchTermProp || '').toLowerCase())
  );

  // Calculate pagination
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = searchedProducts.slice(indexOfFirstProduct, indexOfLastProduct);

  // Change page
  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    // Scroll to the top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTermProp, category]);

  return (
    <div className="ff-page">
      <main className="ff-grid">
        <h1 className="ff-title">{t('exploreFreshProducts')}</h1>

        {searchedProducts.length === 0 && <p>{t('noProductsFound')}</p>}

        {searchedProducts.length > 0 && (
          <div className="ff-product-grid">
            {currentProducts.map((product) => (
              <Link key={product.id} to={`/product/${product.id}`} className="ff-card">
                <img
                  src={getProductImageSrc(product) || getCategoryFallback(product.category)}
                  alt={getLocalizedProductName(product, language)}
                  className="ff-card-image"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getCategoryFallback(product.category);
                  }}
                />
                <div className="ff-card-body">
                  <h3 className="ff-card-name">{getLocalizedProductName(product, language)}</h3>
                  <p className="ff-card-price">Rs {product.price}</p>
                  <span className="ff-card-cta">
                    <FontAwesomeIcon icon={faCartShopping} />
                    {t('addToCart')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="ff-pagination">
          {Array.from({ length: Math.ceil(searchedProducts.length / productsPerPage) }, (_, i) => (
            <button key={i} onClick={() => paginate(i + 1)} className={currentPage === i + 1 ? 'active' : ''}>
              {i + 1}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default ProductListPage;

