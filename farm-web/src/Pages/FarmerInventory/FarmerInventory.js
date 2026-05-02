import React, { useState, useEffect } from "react";
import axios from "axios";
import "./FarmerInventory.css";
import FarmerSidebar from "../../Components/Sidebar/FarmerSidebar";
import { useLanguage } from "../../context/LanguageContext";
import { getLocalizedProductName } from "../../utils/localizedProduct";

const API_BASE_URL = "http://freshfarm-backend-env.eba-qnm4hc4g.ap-south-1.elasticbeanstalk.com"; // Define your API base URL

const FarmerInventory = () => {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editedQuantity, setEditedQuantity] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const { t, language } = useLanguage();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/products`);
      setProducts(response.data);
      setFilteredProducts(response.data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const handleEdit = (id) => {
    setSelectedProductId(id);
    setShowEditModal(true);
    const editedProduct = products.find((product) => product.id === id);
    setEditedQuantity(editedProduct.quantity);
  };

  const saveEditedQuantity = async () => {
    try {
      await axios.put(`${API_BASE_URL}/apiedit/products/${selectedProductId}`, {
        quantity: editedQuantity,
      });
      const updatedProducts = products.map((product) =>
        product.id === selectedProductId
          ? { ...product, quantity: editedQuantity }
          : product
      );
      setProducts(updatedProducts);
      setFilteredProducts(updatedProducts); // Update filteredProducts too
    } catch (error) {
      console.error("Error updating product quantity:", error);
    } finally {
      setShowEditModal(false);
    }
  };

  const handleDelete = async (id) => {
    setSelectedProductId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/api/products/${selectedProductId}`);
      const updatedProducts = products.filter(
        (product) => product.id !== selectedProductId
      );
      setProducts(updatedProducts);
      setFilteredProducts(updatedProducts);
    } catch (error) {
      console.error("Error deleting product:", error);
    } finally {
      setSelectedProductId(null);
      setShowDeleteModal(false);
    }
  };

  const handleCancelDelete = () => {
    setSelectedProductId(null);
    setShowDeleteModal(false);
  };

  const handleStockFilterChange = (value) => {
    setSearchQuery("");
    if (value === "low") {
      const lowStockProducts = products.filter(
        (product) => product.quantity < 5
      );
      setFilteredProducts(lowStockProducts);
    } else if (value === "high") {
      const highStockProducts = products.filter(
        (product) => product.quantity >= 10
      );
      setFilteredProducts(highStockProducts);
    } else {
      // If no filter is selected or an invalid filter value is received,
      // display all products
      setFilteredProducts(products);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    const filtered = products.filter((product) =>
      getLocalizedProductName(product, language)
        .toLowerCase()
        .includes(query.toLowerCase())
    );
    setFilteredProducts(filtered);
  };

  const getTranslatedCategory = (category) => {
    const normalized = String(category || '').trim().toLowerCase();

    if (normalized === 'fruits' || normalized === 'fruit') {
      return t('fruits');
    }
    if (normalized === 'vegetables' || normalized === 'vegetable') {
      return t('vegetables');
    }
    if (
      normalized === 'dairy' ||
      normalized === 'dairy product' ||
      normalized === 'dairy products'
    ) {
      return t('dairyProducts');
    }
    if (normalized === 'grains' || normalized === 'grain') {
      return t('grains');
    }
    if (normalized === 'spices' || normalized === 'spice') {
      return t('spices');
    }
    if (normalized === 'organic') {
      return t('organic');
    }

    return category;
  };

  return (
    <div>
      <FarmerSidebar />

      <h1 style={{ fontWeight: "400", fontSize: "24px", marginLeft: "290px" }}>
        {t('inventory')}
      </h1>

      <div className="row-container">
        <div className="search-bar-container">
          <input
            type="text"
            placeholder={t('searchProducts')}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-bar"
          />
        </div>

        <div
          className="filter-container"
          style={{ display: "flex", alignItems: "center", marginLeft: "442px" }}
        >
          <div className="button-group">
            <input
              type="radio"
              id="all-stock"
              name="stock-filter"
              value=""
              onChange={() => handleStockFilterChange("")}
              defaultChecked
              style={{ display: "none" }}
            />
            <label htmlFor="all-stock" className="button">
              {t('allStock')}
            </label>

            <input
              type="radio"
              id="low-stock"
              name="stock-filter"
              value="low"
              onChange={() => handleStockFilterChange("low")}
              style={{ display: "none" }}
            />
            <label htmlFor="low-stock" className="button">
              {t('lowStock')}
            </label>

            <input
              type="radio"
              id="high-stock"
              name="stock-filter"
              value="high"
              onChange={() => handleStockFilterChange("high")}
              style={{ display: "none" }}
            />
            <label htmlFor="high-stock" className="button">
              {t('highStock')}
            </label>
          </div>
        </div>
      </div>

      <div className="farmer-inventory">
        <table>
          <thead>
            <tr>
              <th>{t('productName')}</th>
              <th>{t('productCategory')}</th>
              <th>{t('productId')}</th>
              <th>{t('productPrice')}</th>
              <th>{t('productQuantity')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id}>
                <td>{getLocalizedProductName(product, language)}</td>
                <td>{getTranslatedCategory(product.category)}</td>
                <td>{product.id}</td>
                <td>Rs.{product.price}</td>
                <td>
                  {editingProduct === product.id ? (
                    <input
                      type="number"
                      value={editedQuantity}
                      onChange={(e) => setEditedQuantity(e.target.value)}
                    />
                  ) : (
                    product.quantity
                  )}
                </td>
                <td>
                  {editingProduct === product.id ? (
                    <button
                      style={{
                        backgroundColor: "#4CAF50",
                        color: "white",
                        border: "none",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        marginRight: "8px",
                        fontSize: "12px",
                      }}
                      onClick={saveEditedQuantity}
                    >
                      {t('save')}
                    </button>
                  ) : (
                    <>
                      <button
                        style={{
                          backgroundColor: "#4CAF50",
                          color: "white",
                          border: "none",
                          padding: "8px 14px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          marginRight: "8px",
                          fontSize: "12px",
                          borderRadius: "8px",
                        }}
                        onClick={() => handleEdit(product.id)}
                      >
                        {t('editQuantity')}
                      </button>
                      <button
                        className="delete-button"
                        style={{
                          backgroundColor: "#e2e2e2c0",
                          color: "black",
                          fontSize: "12px",
                          borderRadius: "8px",
                        }}
                        onClick={() => handleDelete(product.id)}
                      >
                        {t('remove')}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEditModal && (
        <div className="modal-overlay">
        <div className="edit-modal-container white-container">
          <div className="edit-modal-content">
          <div className="edit-modal-header">
            <h2>{t('editQuantity')}</h2>
            <button 
  className="close-button" 
  onClick={() => setShowEditModal(false)}
  style={{
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: 'grey',
    marginTop: '-15px',
    marginRight: '-20px'
  }}
  onMouseEnter={(e) => e.target.style.color = '#666'}
  onMouseLeave={(e) => e.target.style.color = '#aaa'}
>
  ×
</button>
            
        </div>
            <input
              type="number"
              value={editedQuantity}
              onChange={(e) => setEditedQuantity(e.target.value)}
            />
            <button
              onClick={saveEditedQuantity}
              style={{ fontSize: "14px", padding: "5px 10px" }}
            >
              {t('save')}
            </button>
          </div>
        </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="delete-modal-overlay">
          <div className="delete-modal-container white-container">
            <div className="delete-modal-content">
              <h2
                style={{
                  fontWeight: "normal",
                  fontSize: "18px",
                  textAlign: "center",
                  marginBottom: "20px",
                }}
              >
                {t('areYouSureDeleteProduct')}
              </h2>
              <div className="delete-modal-buttons" style={{ display: "flex", justifyContent: "center" }}>
                <button className="delete-confirm" onClick={confirmDelete} style={{ fontSize: "14px", padding: "5px 10px", marginRight: "10px" }}>
                  {t('yes')}
                </button>
                <button className="delete-cancel" onClick={handleCancelDelete} style={{ fontSize: "14px", padding: "5px 10px", marginLeft: "10px" }}>
                  {t('no')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerInventory;
