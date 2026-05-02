import React, { useState } from 'react';
import Nav from '../Nav';
import ProductListPage from './ProductListPage';
import Footer from '../Components/AppFooter/footer';
import HomeSlider from '../Pages/slider';


// Only relevant categories for your app
const categories = [
  { name: 'All', icon: '🛍️', term: '' },
  { name: 'Fruits', icon: '🍎', term: 'fruit' },
  { name: 'Vegetables', icon: '🥦', term: 'vegetable' },
  { name: 'Dairy', icon: '🥛', term: 'dairy' },
  { name: 'Grains', icon: '🌾', term: 'grain' },
  { name: 'Spices', icon: '🧂', term: 'spice' },
  { name: 'Organic', icon: '🌱', term: 'organic' },
];

const UserLanding = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const handleSearchChange = (value) => setSearchTerm(value);
  const handleCategoryChange = (category) => setSelectedCategory(category);

  return (
    <>

      <Nav handleSearchChange={handleSearchChange} />
      <div className="zp-category-row">
        {categories.map(cat => (
          <button
            key={cat.name}
            className={"zp-category-btn " + (selectedCategory === cat.term ? 'active' : '')}
            onClick={() => handleCategoryChange(cat.term)}
          >
            <span style={{fontSize: '18px', marginRight: 4}}>{cat.icon}</span> {cat.name}
          </button>
        ))}
      </div>

      {/* Restored promo section */}
      <HomeSlider />


      <ProductListPage
        category={selectedCategory}
        searchTerm={searchTerm}
      />
      <Footer />
    </>
  );
};

export default UserLanding;
