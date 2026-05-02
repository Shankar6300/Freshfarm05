import React, { useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';

const EditProductDialog = ({ product, onSave, onClose }) => {
  const [editedProduct, setEditedProduct] = useState(product);
  const [errors, setErrors] = useState({});
  const { t } = useLanguage();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedProduct({ ...editedProduct, [name]: value });
    validateInput(name, value);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setEditedProduct({ ...editedProduct, image: file });
  };

  const validateInput = (name, value) => {
    let newErrors = { ...errors };
    switch (name) {
      case 'name':
        if (!value.match(/^[A-Z].*$/)) {
          newErrors[name] = t('nameMustStartCapital');
        } else {
          delete newErrors[name];
        }
        break;
      case 'price':
      case 'quantity':
        if (!value.match(/^\d+$/)) {
          newErrors[name] = t('enterNumericValue');
        } else {
          delete newErrors[name];
        }
        break;
      default:
        break;
    }
    setErrors(newErrors);
  };

  const handleSave = async () => {
    const isError = Object.keys(errors).length !== 0;
    if (!isError) {
      try {
        const formData = new FormData();
        formData.append('name', editedProduct.name);
        formData.append('name_hi', editedProduct.name_hi || '');
        formData.append('name_te', editedProduct.name_te || '');
        formData.append('description', editedProduct.description);
        formData.append('category', editedProduct.category);
        formData.append('price', editedProduct.price);
        formData.append('quantity', editedProduct.quantity);
        if (editedProduct.image instanceof File) {
          formData.append('image', editedProduct.image);
        }

        const response = await axios.put(`http://freshfarm-backend-env.eba-qnm4hc4g.ap-south-1.elasticbeanstalk.com/api/products/${editedProduct.id}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        onSave(response.data);
        onClose();
      } catch (error) {
        console.error('Error saving product:', error);
      }
    }
  };


  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: '#fff', padding: '30px 30px 30px 40px', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)', maxWidth: '450px', width: '450px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '20px', color: '#333', borderBottom: '2px solid #ccc', paddingBottom: '10px' }}>{t('editQuantity')}</h2>
        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
          <label htmlFor="name" style={{ display: 'block', marginBottom: '5px', color: '#555', fontWeight: 'bold' }}>{t('nameLabel')}:</label>
          <input type="text" id="name" name="name" value={editedProduct.name} onChange={handleInputChange} style={{ width: '90%', padding: '10px', border: '1px solid #ccc', borderRadius: '12px', marginBottom: '15px', fontSize: '14px' }} />
          {errors.name && <span style={{ color: 'red', fontSize: '10px' }}>{errors.name}</span>}
          <label htmlFor="name_hi" style={{ display: 'block', marginBottom: '5px', color: '#555', fontWeight: 'bold' }}>{t('nameHindiLabel')}:</label>
          <input type="text" id="name_hi" name="name_hi" value={editedProduct.name_hi || ''} onChange={handleInputChange} style={{ width: '90%', padding: '10px', border: '1px solid #ccc', borderRadius: '12px', marginBottom: '15px', fontSize: '14px' }} />
          <label htmlFor="name_te" style={{ display: 'block', marginBottom: '5px', color: '#555', fontWeight: 'bold' }}>{t('nameTeluguLabel')}:</label>
          <input type="text" id="name_te" name="name_te" value={editedProduct.name_te || ''} onChange={handleInputChange} style={{ width: '90%', padding: '10px', border: '1px solid #ccc', borderRadius: '12px', marginBottom: '15px', fontSize: '14px' }} />
          <label htmlFor="description" style={{ display: 'block', marginBottom: '5px', color: '#555', fontWeight: 'bold' }}>{t('description')}:</label>
          <input type="text" id="description" name="description" value={editedProduct.description} onChange={handleInputChange} style={{ width: '90%', padding: '10px', border: '1px solid #ccc', borderRadius: '12px', marginBottom: '15px', fontSize: '14px' }} />
          <label htmlFor="category" style={{ display: 'block', marginBottom: '5px', color: '#555', fontWeight: 'bold' }}>{t('categoryLabel')}:</label>
          <select id="category" name="category" value={editedProduct.category} onChange={handleInputChange} style={{ width: '90%', padding: '10px', border: '1px solid #ccc', borderRadius: '12px', marginBottom: '15px', fontSize: '14px' }}>
            <option value="">{t('selectCategory')}</option>
            <option value="dairy">{t('dairyProducts')}</option>
            <option value="fruits">{t('fruits')}</option>
            <option value="vegetables">{t('vegetables')}</option>
          </select>
          <label htmlFor="price" style={{ display: 'block', marginBottom: '5px', color: '#555', fontWeight: 'bold' }}>{t('priceLabel')}:</label>
          <input type="text" id="price" name="price" value={editedProduct.price} onChange={handleInputChange} style={{ width: '90%', padding: '10px', border: '1px solid #ccc', borderRadius: '12px', marginBottom: '15px', fontSize: '14px' }} />
          {errors.price && <span style={{ color: 'red', fontSize: '10px' }}>{errors.price}</span>}
          <label htmlFor="quantity" style={{ display: 'block', marginBottom: '5px', color: '#555', fontWeight: 'bold' }}>{t('quantityLabel')}:</label>
          <input type="text" id="quantity" name="quantity" value={editedProduct.quantity} onChange={handleInputChange} style={{ width: '90%', padding: '10px', border: '1px solid #ccc', borderRadius: '12px', marginBottom: '15px', fontSize: '14px' }} />
          {errors.quantity && <span style={{ color: 'red', fontSize: '10px' }}>{errors.quantity}</span>}
          <input type="file" id="image" accept="image/*" onChange={handleImageChange} style={{ width: '90%', marginBottom: '25px', fontSize: '14px' }} />
          {editedProduct.image && <img src={editedProduct.image instanceof File ? URL.createObjectURL(editedProduct.image) : editedProduct.image} alt="Product" style={{ maxWidth: '30%', height: '100px', marginBottom: '15px' }} />}
        </div>
        <div>
          <button onClick={handleSave} style={{ padding: '12px 24px', border: 'none', borderRadius: '5px', backgroundColor: '#4CAF50', color: 'white', cursor: 'pointer', marginRight: '10px', fontSize: '16px' }}>{t('save')}</button>
          <button onClick={onClose} style={{ padding: '12px 24px', border: 'none', borderRadius: '5px', backgroundColor: '#B01818', color: 'white', cursor: 'pointer', fontSize: '16px' }}>{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
};

export default EditProductDialog;
