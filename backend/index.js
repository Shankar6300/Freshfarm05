import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import multer from 'multer'; 
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';
import Stripe from 'stripe';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  }
});

const activeSockets = {}; // Mapping of email to socket ID

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('register', (email) => {
    if (email) {
      activeSockets[email] = socket.id;
      console.log(`Registered socket for ${email}`);
    }
  });

  socket.on('request_rider', (data) => {
    console.log('Rider requested:', data);
    const riderSocket = activeSockets[data.riderEmail];
    if (riderSocket) {
      io.to(riderSocket).emit('incoming_request', data);
    }
  });

  socket.on('accept_request', (data) => {
    const farmerSocket = activeSockets[data.farmerEmail];
    if (farmerSocket) {
      io.to(farmerSocket).emit('request_accepted', data);
    }
  });

  socket.on('send_message', (data) => {
    const targetSocket = activeSockets[data.toEmail];
    if (targetSocket) {
      io.to(targetSocket).emit('receive_message', data);
    }
  });

  socket.on('update_location', (data) => {
    const targetSocket = activeSockets[data.toEmail];
    if (targetSocket) {
      io.to(targetSocket).emit('rider_location_update', data);
    }
  });

  socket.on('confirm_order', (data) => {
    const farmerSocket = activeSockets[data.farmerEmail];
    if (farmerSocket) {
      io.to(farmerSocket).emit('order_confirmed', data);
    }
  });

  socket.on('disconnect', () => {
    for (const [email, id] of Object.entries(activeSockets)) {
      if (id === socket.id) {
        delete activeSockets[email];
        break;
      }
    }
  });
});

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// OTP Store for in-memory temporary OTP storage
const otpStore = {};

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});


// CORS configuration for frontend access
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('uploads'));



const db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.MYSQLHOST || "localhost",
    user: process.env.MYSQLUSER || "root",
    password: process.env.MYSQLPASSWORD || "",
    database: process.env.MYSQL_DATABASE || "Signup",
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

db.on('error', (err) => {
    console.error('MySQL Pool Error:', err);
});

console.log(`DB connecting to: ${process.env.MYSQLHOST || 'localhost'} (${process.env.MYSQL_DATABASE || 'Signup'} DB)`);

let farmerProductColumns = new Set();

const loadFarmerProductColumns = () => {
  db.query('SHOW COLUMNS FROM farmer_product', (err, results) => {
    if (err) {
      console.error('Could not load farmer_product columns:', err.message);
      return;
    }
    farmerProductColumns = new Set(results.map((col) => col.Field));
    console.log('Loaded farmer_product columns for multilingual support');
  });
};

const hasFarmerProductColumn = (columnName) => farmerProductColumns.has(columnName);

const buildStableImageUrl = (name, category) => {
  const seed = String(`${category || 'product'}-${name || 'item'}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `https://picsum.photos/seed/${seed || 'freshfarm'}/900/700`;
};

const queryAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(results);
    });
  });

const aadhaarCryptoKey = crypto
  .createHash('sha256')
  .update(String(process.env.AADHAAR_ENCRYPTION_KEY || process.env.JWT_SECRET || 'freshfarm-aadhaar'))
  .digest();

const encryptAadhaar = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', aadhaarCryptoKey, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

const maskAadhaar = (value) => {
  const text = String(value || '').replace(/\s+/g, '');
  if (!text) return '';
  const last4 = text.slice(-4);
  return `XXXX-XXXX-${last4}`;
};

const buildSeedItems = (category, entries) => entries.map((item) => ({ ...item, category }));

const realisticSeedProducts = [
  ...buildSeedItems('Fruits', [
    { name: 'Shimla Apples', description: 'Crisp premium apples from Himachal orchards.', price: 180, quantity: 55, image: 'https://source.unsplash.com/900x700/?apple,fruit' },
    { name: 'Nagpur Oranges', description: 'Sweet citrus oranges rich in vitamin C.', price: 95, quantity: 70, image: 'https://source.unsplash.com/900x700/?orange,fruit' },
    { name: 'Banana (Robusta)', description: 'Fresh bananas, ideal for breakfast and shakes.', price: 60, quantity: 90, image: 'https://source.unsplash.com/900x700/?banana,fruit' },
    { name: 'Pomegranate', description: 'Juicy ruby-red pomegranate packed with antioxidants.', price: 220, quantity: 40, image: 'https://source.unsplash.com/900x700/?pomegranate,fruit' },
    { name: 'Seedless Grapes', description: 'Sweet and fresh green grapes.', price: 140, quantity: 45, image: 'https://source.unsplash.com/900x700/?grapes,fruit' },
    { name: 'Mango Kesar', description: 'Aromatic Kesar mangoes with rich sweetness.', price: 210, quantity: 38, image: 'https://source.unsplash.com/900x700/?mango,fruit' },
    { name: 'Papaya', description: 'Ripe papaya for a healthy daily fruit bowl.', price: 72, quantity: 58, image: 'https://source.unsplash.com/900x700/?papaya,fruit' },
    { name: 'Guava', description: 'Juicy guavas with a sweet tropical aroma.', price: 64, quantity: 60, image: 'https://source.unsplash.com/900x700/?guava,fruit' },
    { name: 'Watermelon', description: 'Large farm-fresh watermelon for summer hydration.', price: 110, quantity: 36, image: 'https://source.unsplash.com/900x700/?watermelon,fruit' },
    { name: 'Sweet Lime', description: 'Refreshing mosambi ideal for juice and snacking.', price: 88, quantity: 72, image: 'https://source.unsplash.com/900x700/?lime,fruit' },
    { name: 'Pear', description: 'Soft, sweet pears harvested at peak ripeness.', price: 150, quantity: 34, image: 'https://source.unsplash.com/900x700/?pear,fruit' },
    { name: 'Kiwi', description: 'Tangy kiwi with a bright green center.', price: 250, quantity: 28, image: 'https://source.unsplash.com/900x700/?kiwi,fruit' },
    { name: 'Strawberry', description: 'Fresh handpicked strawberries for desserts.', price: 260, quantity: 24, image: 'https://source.unsplash.com/900x700/?strawberry,fruit' },
    { name: 'Plum', description: 'Juicy plums with a balanced sweet-tart taste.', price: 170, quantity: 30, image: 'https://source.unsplash.com/900x700/?plum,fruit' },
    { name: 'Black Grapes', description: 'Naturally sweet black grapes packed fresh.', price: 155, quantity: 42, image: 'https://source.unsplash.com/900x700/?black-grapes,fruit' },
    { name: 'Dragon Fruit', description: 'Exotic dragon fruit with striking color.', price: 320, quantity: 18, image: 'https://source.unsplash.com/900x700/?dragonfruit,fruit' },
    { name: 'Jackfruit', description: 'Seasonal jackfruit chunks with rich aroma.', price: 130, quantity: 22, image: 'https://source.unsplash.com/900x700/?jackfruit,fruit' },
    { name: 'Litchi', description: 'Sweet litchis with soft juicy flesh.', price: 240, quantity: 26, image: 'https://source.unsplash.com/900x700/?lychee,fruit' },
    { name: 'Coconut', description: 'Tender coconut for fresh water and pulp.', price: 52, quantity: 80, image: 'https://source.unsplash.com/900x700/?coconut,fruit' },
    { name: 'Avocado', description: 'Creamy avocados for salads and toast.', price: 280, quantity: 20, image: 'https://source.unsplash.com/900x700/?avocado,fruit' }
  ]),
  ...buildSeedItems('Vegetables', [
    { name: 'Farm Tomato', description: 'Fresh red tomatoes for daily cooking.', price: 42, quantity: 120, image: 'https://source.unsplash.com/900x700/?tomato,vegetable' },
    { name: 'Potato (New Crop)', description: 'All-purpose potatoes with smooth texture.', price: 32, quantity: 140, image: 'https://source.unsplash.com/900x700/?potato,vegetable' },
    { name: 'Red Onion', description: 'Strong flavor onions for curries and salads.', price: 38, quantity: 130, image: 'https://source.unsplash.com/900x700/?onion,vegetable' },
    { name: 'Capsicum Green', description: 'Crisp capsicum great for stir fry.', price: 68, quantity: 60, image: 'https://source.unsplash.com/900x700/?capsicum,vegetable' },
    { name: 'Cauliflower', description: 'Fresh cauliflower harvested this week.', price: 48, quantity: 65, image: 'https://source.unsplash.com/900x700/?cauliflower,vegetable' },
    { name: 'Carrot', description: 'Crunchy carrots with natural sweetness.', price: 44, quantity: 90, image: 'https://source.unsplash.com/900x700/?carrot,vegetable' },
    { name: 'Cucumber', description: 'Hydrating cucumbers for salads and raita.', price: 36, quantity: 110, image: 'https://source.unsplash.com/900x700/?cucumber,vegetable' },
    { name: 'Spinach', description: 'Leafy spinach bundled fresh from the farm.', price: 28, quantity: 75, image: 'https://source.unsplash.com/900x700/?spinach,vegetable' },
    { name: 'Brinjal', description: 'Glossy brinjals suitable for curry dishes.', price: 40, quantity: 62, image: 'https://source.unsplash.com/900x700/?eggplant,vegetable' },
    { name: 'Cabbage', description: 'Firm cabbage heads ideal for slaw and stir fry.', price: 34, quantity: 68, image: 'https://source.unsplash.com/900x700/?cabbage,vegetable' },
    { name: 'Broccoli', description: 'Green broccoli florets with fresh crunch.', price: 74, quantity: 45, image: 'https://source.unsplash.com/900x700/?broccoli,vegetable' },
    { name: 'Beetroot', description: 'Sweet beetroot for salads and juice.', price: 46, quantity: 54, image: 'https://source.unsplash.com/900x700/?beetroot,vegetable' },
    { name: 'Lettuce', description: 'Tender lettuce leaves for sandwiches and salads.', price: 52, quantity: 48, image: 'https://source.unsplash.com/900x700/?lettuce,vegetable' },
    { name: 'Green Beans', description: 'Fresh green beans harvested at peak quality.', price: 58, quantity: 70, image: 'https://source.unsplash.com/900x700/?green-beans,vegetable' },
    { name: 'Radish', description: 'Sharp and crisp radishes for fresh meals.', price: 30, quantity: 64, image: 'https://source.unsplash.com/900x700/?radish,vegetable' },
    { name: 'Peas', description: 'Sweet green peas for curries and pulao.', price: 62, quantity: 57, image: 'https://source.unsplash.com/900x700/?peas,vegetable' },
    { name: 'Pumpkin', description: 'Seasonal pumpkin with soft orange flesh.', price: 26, quantity: 43, image: 'https://source.unsplash.com/900x700/?pumpkin,vegetable' },
    { name: 'Ginger', description: 'Aromatic ginger roots for daily cooking.', price: 96, quantity: 38, image: 'https://source.unsplash.com/900x700/?ginger,vegetable' },
    { name: 'Garlic', description: 'Fresh garlic bulbs with strong aroma.', price: 82, quantity: 77, image: 'https://source.unsplash.com/900x700/?garlic,vegetable' },
    { name: 'Mushroom', description: 'Button mushrooms packed fresh for cooking.', price: 98, quantity: 31, image: 'https://source.unsplash.com/900x700/?mushroom,vegetable' }
  ]),
  ...buildSeedItems('Dairy', [
    { name: 'Cow Milk 1L', description: 'Full cream fresh milk, daily delivery quality.', price: 62, quantity: 80, image: 'https://source.unsplash.com/900x700/?milk,dairy' },
    { name: 'Curd 500g', description: 'Thick and creamy fresh curd.', price: 52, quantity: 75, image: 'https://source.unsplash.com/900x700/?curd,yogurt' },
    { name: 'Paneer 200g', description: 'Soft paneer for curries and snacks.', price: 88, quantity: 55, image: 'https://source.unsplash.com/900x700/?paneer,cheese' },
    { name: 'Farm Butter 100g', description: 'Creamy salted butter block.', price: 64, quantity: 50, image: 'https://source.unsplash.com/900x700/?butter,dairy' },
    { name: 'Ghee 500ml', description: 'Pure clarified ghee for rich cooking.', price: 240, quantity: 42, image: 'https://source.unsplash.com/900x700/?ghee,dairy' },
    { name: 'Buttermilk 1L', description: 'Refreshing spiced buttermilk.', price: 28, quantity: 70, image: 'https://source.unsplash.com/900x700/?buttermilk,dairy' },
    { name: 'Cheese Slice Pack', description: 'Processed cheese slices for sandwiches.', price: 110, quantity: 36, image: 'https://source.unsplash.com/900x700/?cheese,dairy' },
    { name: 'Mozzarella Block', description: 'Melty mozzarella for pizzas and bakes.', price: 185, quantity: 22, image: 'https://source.unsplash.com/900x700/?mozzarella,cheese' },
    { name: 'Greek Yogurt', description: 'Protein-rich Greek yogurt cup.', price: 96, quantity: 29, image: 'https://source.unsplash.com/900x700/?yogurt,dairy' },
    { name: 'Kefir Drink', description: 'Probiotic kefir for healthy digestion.', price: 124, quantity: 18, image: 'https://source.unsplash.com/900x700/?kefir,dairy' },
    { name: 'Lassi Sweet', description: 'Traditional sweet lassi chilled fresh.', price: 34, quantity: 65, image: 'https://source.unsplash.com/900x700/?lassi,dairy' },
    { name: 'Flavored Milk', description: 'Chocolate flavored milk bottle.', price: 40, quantity: 58, image: 'https://source.unsplash.com/900x700/?milk,bottle' },
    { name: 'Ice Cream Cup', description: 'Small premium dairy ice cream cup.', price: 74, quantity: 33, image: 'https://source.unsplash.com/900x700/?ice-cream,dairy' },
    { name: 'Fresh Cream 250ml', description: 'Rich cooking cream for desserts.', price: 92, quantity: 24, image: 'https://source.unsplash.com/900x700/?cream,dairy' },
    { name: 'Cottage Cheese Block', description: 'Fresh cottage cheese block.', price: 104, quantity: 27, image: 'https://source.unsplash.com/900x700/?cottage-cheese,dairy' },
    { name: 'Skim Milk 1L', description: 'Low-fat skim milk pack.', price: 56, quantity: 61, image: 'https://source.unsplash.com/900x700/?skim-milk,dairy' },
    { name: 'Salted Butter 200g', description: 'Farm butter suitable for breakfast.', price: 118, quantity: 38, image: 'https://source.unsplash.com/900x700/?salted-butter,dairy' },
    { name: 'Milk Paneer Combo', description: 'Combo pack for home cooking.', price: 142, quantity: 19, image: 'https://source.unsplash.com/900x700/?dairy,products' },
    { name: 'Dahi Bucket 1kg', description: 'Bulk curd bucket for families.', price: 88, quantity: 26, image: 'https://source.unsplash.com/900x700/?curd,bucket' },
    { name: 'Farm Cheese Cubes', description: 'Soft cheese cubes for salads.', price: 132, quantity: 21, image: 'https://source.unsplash.com/900x700/?cheese,cubes' }
  ]),
  ...buildSeedItems('Grains', [
    { name: 'Basmati Rice 1kg', description: 'Long grain aromatic basmati rice.', price: 120, quantity: 90, image: 'https://source.unsplash.com/900x700/?rice,grain' },
    { name: 'Wheat Flour 1kg', description: 'Stone-ground whole wheat atta.', price: 54, quantity: 100, image: 'https://source.unsplash.com/900x700/?wheat,flour' },
    { name: 'Rolled Oats 500g', description: 'High-fiber breakfast oats.', price: 78, quantity: 65, image: 'https://source.unsplash.com/900x700/?oats,grain' },
    { name: 'Poha 1kg', description: 'Premium flattened rice for quick meals.', price: 66, quantity: 70, image: 'https://source.unsplash.com/900x700/?poha,grain' },
    { name: 'Brown Rice 1kg', description: 'Nutritious whole grain brown rice.', price: 138, quantity: 54, image: 'https://source.unsplash.com/900x700/?brown-rice,grain' },
    { name: 'Jowar Flour 1kg', description: 'Healthy sorghum flour for rotis.', price: 58, quantity: 48, image: 'https://source.unsplash.com/900x700/?sorghum,grain' },
    { name: 'Bajra Flour 1kg', description: 'Pearl millet flour for rustic meals.', price: 56, quantity: 46, image: 'https://source.unsplash.com/900x700/?millet,grain' },
    { name: 'Ragi Flour 1kg', description: 'Finger millet flour for nutritious cooking.', price: 64, quantity: 52, image: 'https://source.unsplash.com/900x700/?ragi,grain' },
    { name: 'Corn Flakes', description: 'Crunchy corn flakes for breakfast.', price: 92, quantity: 33, image: 'https://source.unsplash.com/900x700/?cornflakes,grain' },
    { name: 'Broken Wheat', description: 'Nutty broken wheat for upma and khichdi.', price: 49, quantity: 64, image: 'https://source.unsplash.com/900x700/?broken-wheat,grain' },
    { name: 'Sona Masoori Rice', description: 'Light daily-cook rice with good aroma.', price: 98, quantity: 72, image: 'https://source.unsplash.com/900x700/?sona-masoori,rice' },
    { name: 'Quinoa 500g', description: 'Protein-rich grain for modern healthy meals.', price: 210, quantity: 28, image: 'https://source.unsplash.com/900x700/?quinoa,grain' },
    { name: 'Semolina 1kg', description: 'Fine sooji for upma and desserts.', price: 44, quantity: 86, image: 'https://source.unsplash.com/900x700/?semolina,grain' },
    { name: 'Barley 1kg', description: 'Nutrient-dense barley grains.', price: 66, quantity: 30, image: 'https://source.unsplash.com/900x700/?barley,grain' },
    { name: 'Multigrain Atta', description: 'Blended flour for everyday rotis.', price: 72, quantity: 58, image: 'https://source.unsplash.com/900x700/?multigrain,flour' },
    { name: 'Chickpea Flour', description: 'Protein-rich besan for snacks and batter.', price: 84, quantity: 76, image: 'https://source.unsplash.com/900x700/?besan,grain' },
    { name: 'Red Rice 1kg', description: 'Traditional red rice with earthy flavor.', price: 148, quantity: 22, image: 'https://source.unsplash.com/900x700/?red-rice,grain' },
    { name: 'Millet Mix', description: 'Healthy multi-millet grain mix.', price: 110, quantity: 41, image: 'https://source.unsplash.com/900x700/?millet,healthy' },
    { name: 'Flattened Oats', description: 'Quick-cook oats for breakfast bowls.', price: 88, quantity: 38, image: 'https://source.unsplash.com/900x700/?oatmeal,grain' },
    { name: 'Rice Flakes', description: 'Crispy rice flakes for light meals.', price: 52, quantity: 67, image: 'https://source.unsplash.com/900x700/?rice-flakes,grain' }
  ]),
  ...buildSeedItems('Spices', [
    { name: 'Turmeric Powder 200g', description: 'Pure turmeric with strong aroma and color.', price: 58, quantity: 85, image: 'https://source.unsplash.com/900x700/?turmeric,spice' },
    { name: 'Red Chilli Powder 200g', description: 'Medium-hot chilli powder for Indian cooking.', price: 72, quantity: 75, image: 'https://source.unsplash.com/900x700/?chilli,spice' },
    { name: 'Coriander Powder 200g', description: 'Fresh coriander powder for curries.', price: 62, quantity: 80, image: 'https://source.unsplash.com/900x700/?coriander,spice' },
    { name: 'Garam Masala 100g', description: 'House blend garam masala.', price: 84, quantity: 65, image: 'https://source.unsplash.com/900x700/?garam-masala,spice' },
    { name: 'Cumin Seeds 100g', description: 'Whole cumin seeds with earthy aroma.', price: 54, quantity: 90, image: 'https://source.unsplash.com/900x700/?cumin,seeds' },
    { name: 'Mustard Seeds 100g', description: 'Classic mustard seeds for tempering.', price: 36, quantity: 88, image: 'https://source.unsplash.com/900x700/?mustard,seeds' },
    { name: 'Black Pepper 100g', description: 'Sharp black peppercorns.', price: 98, quantity: 54, image: 'https://source.unsplash.com/900x700/?black-pepper,spice' },
    { name: 'Cardamom 50g', description: 'Premium green cardamom pods.', price: 210, quantity: 27, image: 'https://source.unsplash.com/900x700/?cardamom,spice' },
    { name: 'Cinnamon Sticks 100g', description: 'Fragrant cinnamon sticks for sweets and tea.', price: 124, quantity: 31, image: 'https://source.unsplash.com/900x700/?cinnamon,spice' },
    { name: 'Cloves 50g', description: 'Aromatic cloves for biryani and chai.', price: 112, quantity: 35, image: 'https://source.unsplash.com/900x700/?cloves,spice' },
    { name: 'Bay Leaves 50g', description: 'Dried bay leaves for flavoring dishes.', price: 42, quantity: 62, image: 'https://source.unsplash.com/900x700/?bay-leaves,spice' },
    { name: 'Fenugreek 100g', description: 'Fresh fenugreek seeds for tadka.', price: 48, quantity: 68, image: 'https://source.unsplash.com/900x700/?fenugreek,spice' },
    { name: 'Fennel 100g', description: 'Sweet fennel seeds for after-meal refreshment.', price: 56, quantity: 60, image: 'https://source.unsplash.com/900x700/?fennel,spice' },
    { name: 'Asafoetida 50g', description: 'Small pack of hing for digestible cooking.', price: 78, quantity: 25, image: 'https://source.unsplash.com/900x700/?asafoetida,spice' },
    { name: 'Sambar Masala', description: 'Southern Indian spice blend for sambar.', price: 92, quantity: 44, image: 'https://source.unsplash.com/900x700/?sambar-masala,spice' },
    { name: 'Chaat Masala', description: 'Tangy masala for snacks and fruit bowls.', price: 64, quantity: 51, image: 'https://source.unsplash.com/900x700/?chaat-masala,spice' },
    { name: 'Kitchen King Masala', description: 'All-purpose kitchen spice mix.', price: 88, quantity: 43, image: 'https://source.unsplash.com/900x700/?spice-mix,masala' },
    { name: 'Methi Seeds', description: 'Bittersweet fenugreek seeds.', price: 44, quantity: 46, image: 'https://source.unsplash.com/900x700/?methi,seeds' },
    { name: 'Ajwain', description: 'Carom seeds for flavor and digestion.', price: 52, quantity: 39, image: 'https://source.unsplash.com/900x700/?ajwain,spice' },
    { name: 'Paprika', description: 'Mild and colorful paprika powder.', price: 118, quantity: 21, image: 'https://source.unsplash.com/900x700/?paprika,spice' }
  ]),
  ...buildSeedItems('Organic', [
    { name: 'Organic Spinach', description: 'Chemical-free leafy spinach.', price: 48, quantity: 55, image: 'https://source.unsplash.com/900x700/?spinach,organic' },
    { name: 'Organic Carrot', description: 'Fresh organic carrots from certified farms.', price: 62, quantity: 60, image: 'https://source.unsplash.com/900x700/?carrot,organic' },
    { name: 'Organic Brown Rice 1kg', description: 'Nutritious high-fiber brown rice.', price: 138, quantity: 45, image: 'https://source.unsplash.com/900x700/?brown-rice,organic' },
    { name: 'Organic Jaggery 500g', description: 'Unrefined natural jaggery blocks.', price: 86, quantity: 50, image: 'https://source.unsplash.com/900x700/?jaggery,organic' },
    { name: 'Organic Tomato', description: 'Naturally grown tomatoes for clean cooking.', price: 52, quantity: 70, image: 'https://source.unsplash.com/900x700/?organic,tomato' },
    { name: 'Organic Cucumber', description: 'Farm-certified cucumbers with crisp texture.', price: 44, quantity: 64, image: 'https://source.unsplash.com/900x700/?organic,cucumber' },
    { name: 'Organic Potatoes', description: 'Naturally grown potatoes from local farms.', price: 36, quantity: 82, image: 'https://source.unsplash.com/900x700/?organic,potato' },
    { name: 'Organic Lettuce', description: 'Leaf lettuce grown without pesticides.', price: 58, quantity: 35, image: 'https://source.unsplash.com/900x700/?organic,lettuce' },
    { name: 'Organic Mint', description: 'Fresh mint for chutney and drinks.', price: 28, quantity: 40, image: 'https://source.unsplash.com/900x700/?organic,mint' },
    { name: 'Organic Coriander', description: 'Naturally cultivated coriander bunches.', price: 24, quantity: 72, image: 'https://source.unsplash.com/900x700/?organic,coriander' },
    { name: 'Organic Millet Flour', description: 'Stone-ground organic millet flour.', price: 96, quantity: 38, image: 'https://source.unsplash.com/900x700/?organic,millet' },
    { name: 'Organic Honey 250g', description: 'Pure natural honey from organic farms.', price: 198, quantity: 27, image: 'https://source.unsplash.com/900x700/?organic,honey' },
    { name: 'Organic Turmeric', description: 'Chemical-free turmeric roots and powder.', price: 74, quantity: 31, image: 'https://source.unsplash.com/900x700/?organic,turmeric' },
    { name: 'Organic Green Gram', description: 'Nutritious moong for sprouts and dals.', price: 88, quantity: 42, image: 'https://source.unsplash.com/900x700/?organic,moong' },
    { name: 'Organic Sesame', description: 'Natural sesame seeds for cooking and sweets.', price: 64, quantity: 33, image: 'https://source.unsplash.com/900x700/?organic,sesame' },
    { name: 'Organic Ginger', description: 'Fresh organic ginger roots.', price: 90, quantity: 29, image: 'https://source.unsplash.com/900x700/?organic,ginger' },
    { name: 'Organic Garlic', description: 'Naturally grown garlic bulbs.', price: 92, quantity: 41, image: 'https://source.unsplash.com/900x700/?organic,garlic' },
    { name: 'Organic Apples', description: 'Certified organic apples for healthy snacking.', price: 210, quantity: 24, image: 'https://source.unsplash.com/900x700/?organic,apple' },
    { name: 'Organic Lemons', description: 'Handpicked lemons from organic orchards.', price: 58, quantity: 66, image: 'https://source.unsplash.com/900x700/?organic,lemon' },
    { name: 'Organic Coconut Oil', description: 'Cold-pressed organic coconut oil.', price: 240, quantity: 18, image: 'https://source.unsplash.com/900x700/?organic,coconut-oil' }
  ])
];

const ensureAccountSchema = () => {
  const createAddressesTable = `
    CREATE TABLE IF NOT EXISTS user_addresses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      label VARCHAR(80) DEFAULT 'Home',
      recipient_name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      address_line VARCHAR(500) NOT NULL,
      is_default TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `;

  const createWalletTable = `
    CREATE TABLE IF NOT EXISTS user_wallet (
      user_id INT PRIMARY KEY,
      balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `;

  const createSupportTicketsTable = `
    CREATE TABLE IF NOT EXISTS user_support_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `;

  const createReferralsTable = `
    CREATE TABLE IF NOT EXISTS user_referrals (
      user_id INT PRIMARY KEY,
      referral_code VARCHAR(32) NOT NULL UNIQUE,
      invited_count INT NOT NULL DEFAULT 0,
      earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `;

  const createDeliveryPartnerApplicationsTable = `
    CREATE TABLE IF NOT EXISTS delivery_partner_applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone_number VARCHAR(20) NOT NULL,
      password VARCHAR(255) NOT NULL,
      vehicle_type VARCHAR(120) NOT NULL,
      vehicle_number VARCHAR(80) NOT NULL,
      capacity_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
      rc_number VARCHAR(120) NOT NULL,
      license_number VARCHAR(120) NOT NULL,
      aadhaar_number VARCHAR(120) NOT NULL,
      rc_photo VARCHAR(255) DEFAULT NULL,
      license_photo VARCHAR(255) DEFAULT NULL,
      aadhaar_photo VARCHAR(255) DEFAULT NULL,
      owner_vehicle_photo VARCHAR(255) DEFAULT NULL,
      person_photo VARCHAR(255) DEFAULT NULL,
      aadhaar_number_encrypted TEXT DEFAULT NULL,
      service_area VARCHAR(255) NOT NULL,
      availability VARCHAR(120) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'Pending',
      is_online TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `;

  const createOrderChatsTable = `
    CREATE TABLE IF NOT EXISTS order_chats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      sender_role VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `;

  const createDeliveryAssignmentsTable = `
    CREATE TABLE IF NOT EXISTS delivery_order_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      partner_email VARCHAR(255) NOT NULL,
      partner_name VARCHAR(255) NULL,
      delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
      assignment_status VARCHAR(40) NOT NULL DEFAULT 'offered',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      accepted_at TIMESTAMP NULL,
      UNIQUE KEY uq_order_partner (order_id, partner_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `;

  const createDeliveryLiveLocationsTable = `
    CREATE TABLE IF NOT EXISTS delivery_live_locations (
      order_id INT PRIMARY KEY,
      partner_email VARCHAR(255) NOT NULL,
      latitude DECIMAL(10,6) NOT NULL,
      longitude DECIMAL(10,6) NOT NULL,
      eta_minutes INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `;

  db.query(createAddressesTable, (err) => {
    if (err) {
      console.error('Could not ensure user_addresses table:', err.message);
    }
  });

  db.query(createWalletTable, (err) => {
    if (err) {
      console.error('Could not ensure user_wallet table:', err.message);
    }
  });

  db.query(createSupportTicketsTable, (err) => {
    if (err) {
      console.error('Could not ensure user_support_tickets table:', err.message);
    }
  });

  db.query(createReferralsTable, (err) => {
    if (err) {
      console.error('Could not ensure user_referrals table:', err.message);
    }
  });

  db.query(createDeliveryPartnerApplicationsTable, (err) => {
    if (err) {
      console.error('Could not ensure delivery_partner_applications table:', err.message);
    }
  });

  db.query(createOrderChatsTable, (err) => {
    if (err) {
      console.error('Could not ensure order_chats table:', err.message);
    }
  });

  db.query(createDeliveryAssignmentsTable, (err) => {
    if (err) {
      console.error('Could not ensure delivery_order_assignments table:', err.message);
    }
  });

  db.query(createDeliveryLiveLocationsTable, (err) => {
    if (err) {
      console.error('Could not ensure delivery_live_locations table:', err.message);
    }
  });

  const createAdminAadhaarAccessLogs = `
    CREATE TABLE IF NOT EXISTS admin_aadhaar_access_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_email VARCHAR(255) NOT NULL,
      partner_email VARCHAR(255) NOT NULL,
      action VARCHAR(100) NOT NULL DEFAULT 'viewed_aadhaar',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `;

  db.query(createAdminAadhaarAccessLogs, (err) => {
    if (err) {
      console.error('Could not ensure admin_aadhaar_access_logs table:', err.message);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN user_id INT NULL', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
      console.error('Could not ensure orders.user_id column:', err.message);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN customer_email VARCHAR(255) NULL', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
      console.error('Could not ensure orders.customer_email column:', err.message);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN status VARCHAR(40) NOT NULL DEFAULT "pending"', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
      console.error('Could not ensure orders.status column:', err.message);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN delivery_partner_email VARCHAR(255) NULL', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
      console.error('Could not ensure orders.delivery_partner_email column:', err.message);
    }
  });
  // Ensure delivery partner document/photo columns exist for existing DBs
  db.query('ALTER TABLE delivery_partner_applications ADD COLUMN rc_photo VARCHAR(255) NULL', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
      // ignore if already present
    }
  });
  db.query('ALTER TABLE delivery_partner_applications ADD COLUMN license_photo VARCHAR(255) NULL', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
    }
  });
  db.query('ALTER TABLE delivery_partner_applications ADD COLUMN aadhaar_photo VARCHAR(255) NULL', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
    }
  });
  db.query('ALTER TABLE delivery_partner_applications ADD COLUMN owner_vehicle_photo VARCHAR(255) NULL', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
    }
  });
  db.query('ALTER TABLE delivery_partner_applications ADD COLUMN person_photo VARCHAR(255) NULL', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
    }
  });
  db.query('ALTER TABLE delivery_partner_applications ADD COLUMN aadhaar_number_encrypted TEXT NULL', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
    }
  });

  const createFarmerRiderRequestsTable = `
    CREATE TABLE IF NOT EXISTS farmer_rider_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      farmer_email VARCHAR(255) NOT NULL,
      rider_email VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `;

  db.query(createFarmerRiderRequestsTable, (err) => {
    if (err) console.error('Could not ensure farmer_rider_requests table:', err.message);
  });

  db.query('ALTER TABLE delivery_partner_applications ADD COLUMN current_lat DECIMAL(10,6) NULL', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
      console.error('Could not ensure current_lat column:', err.message);
    }
  });
  db.query('ALTER TABLE delivery_partner_applications ADD COLUMN current_lng DECIMAL(10,6) NULL', (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
      console.error('Could not ensure current_lng column:', err.message);
    }
  });
};


// Get a connection from the pool
db.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
    return;
  }
  console.log('Connected to MySQL database');

  // Use the connection for querying
  connection.query('SELECT 1 + 1 AS solution', (error, results, fields) => {
    // Release the connection when done with querying
    connection.release();
    
    if (error) {
      console.error('Error executing query:', error);
      return;
    }
    console.log('The solution is: ', results[0].solution);
  });
});

loadFarmerProductColumns();
ensureAccountSchema();

import fs from 'fs';
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Specify the directory where you want to save files
    },
    filename: function (req, file, cb) {
        const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = file.originalname.split('.').pop();
        const filename = uniquePrefix + '.' + extension;
        cb(null, filename);
    }
});


// Multer upload configuration
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5 // Limit file size to 5MB
    },
    fileFilter: function (req, file, cb) {
        const allowedFileTypes = /jpeg|jpg|png|gif/;
        const extension = allowedFileTypes.test(file.originalname.split('.').pop().toLowerCase());
        if (extension) {
            cb(null, true);
        } else {
            cb(new Error('Only images with .jpeg, .jpg, .png, or .gif extensions are allowed.'));
        }
    }
});


// Fetch all products
app.get('/api/products/:farmerId', (req, res) => {
    const farmerEmail = req.params.farmerId; // Accessing farmerId from URL params

    db.query('SELECT * FROM farmer_product WHERE farmer_email = ?', farmerEmail, (err, results) => {
        if (err) {
            console.error('Error fetching products from database:', err);
            return res.status(500).json({ error: 'Error fetching products' });
        }
        res.status(200).json(results);
    });
});


app.get('/api1/products/:id', (req, res) => {
    const productId = req.params.id; // Use consistent variable name
  
    // Query to fetch product details from MySQL database
    const query = `SELECT * FROM farmer_product WHERE id = ?`;
  
    // Execute the query with productId as a parameter
    db.query(query, [productId], (err, results) => {
      if (err) {
        console.error('Error fetching product details:', err);
        res.status(500).json({ error: 'Error fetching product details' });
        return;
      }
      if (results.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      // Product found, send it as JSON response
      res.json(results[0]);
    });
  });

    // Get all products
app.get('/api/products', (req, res) => {
    const sql = 'SELECT * FROM farmer_product';
    db.query(sql, (err, result) => {
      if (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }
      res.json(result);
    });
  });

app.post('/api/seed/realistic-products', async (req, res) => {
  try {
    const farmerEmail = req.body?.farmerEmail || req.query?.farmerEmail || null;

    let farmerRows;
    if (farmerEmail) {
      farmerRows = await queryAsync('SELECT id, fullName, email FROM farmer WHERE email = ? LIMIT 1', [farmerEmail]);
    } else {
      farmerRows = await queryAsync('SELECT id, fullName, email FROM farmer ORDER BY id ASC LIMIT 1');
    }

    if (!farmerRows || farmerRows.length === 0) {
      return res.status(404).json({ error: 'No farmer found. Create a farmer account first.' });
    }

    const farmer = farmerRows[0];
    const existingRows = await queryAsync('SELECT name FROM farmer_product WHERE farmer_email = ?', [farmer.email]);
    const existingNames = new Set(existingRows.map((row) => String(row.name || '').trim().toLowerCase()));

    const insertColumns = ['name', 'description', 'category', 'price', 'quantity', 'image', 'farmer_id', 'farmerName', 'farmer_email'];
    if (hasFarmerProductColumn('name_hi')) {
      insertColumns.push('name_hi');
    }
    if (hasFarmerProductColumn('name_te')) {
      insertColumns.push('name_te');
    }

    const placeholders = insertColumns.map(() => '?').join(', ');
    const insertSql = `INSERT INTO farmer_product (${insertColumns.join(', ')}) VALUES (${placeholders})`;

    let inserted = 0;
    let skipped = 0;

    for (const item of realisticSeedProducts) {
      const key = String(item.name || '').trim().toLowerCase();
      if (!key || existingNames.has(key)) {
        skipped += 1;
        continue;
      }

      const values = [
        item.name,
        item.description,
        item.category,
        item.price,
        item.quantity,
        item.image || buildStableImageUrl(item.name, item.category),
        farmer.id,
        farmer.fullName,
        farmer.email
      ];

      if (hasFarmerProductColumn('name_hi')) {
        values.push(null);
      }
      if (hasFarmerProductColumn('name_te')) {
        values.push(null);
      }

      await queryAsync(insertSql, values);
      existingNames.add(key);
      inserted += 1;
    }

    return res.status(200).json({
      message: 'Realistic category products seeded successfully.',
      farmer: { id: farmer.id, name: farmer.fullName, email: farmer.email },
      inserted,
      skipped,
      totalSeedSet: realisticSeedProducts.length
    });
  } catch (error) {
    console.error('Error seeding realistic products:', error);
    return res.status(500).json({ error: 'Failed to seed realistic products.' });
  }
});

app.post('/api/seed/normalize-product-images', async (req, res) => {
  try {
    const rows = await queryAsync('SELECT id, name, category, image FROM farmer_product');
    let updated = 0;

    for (const row of rows) {
      const image = String(row.image || '').trim();
      const shouldUpdate = !image || image.startsWith('https://source.unsplash.com/');

      if (!shouldUpdate) continue;

      const nextImage = buildStableImageUrl(row.name, row.category);
      await queryAsync('UPDATE farmer_product SET image = ? WHERE id = ?', [nextImage, row.id]);
      updated += 1;
    }

    return res.status(200).json({ message: 'Product image normalization completed.', updated, total: rows.length });
  } catch (error) {
    console.error('Error normalizing product images:', error);
    return res.status(500).json({ error: 'Failed to normalize product images.' });
  }
});

  

// Backend code

app.post('/api/products1', upload.single('image'), (req, res) => {
    console.log(req.file);
  const { name, name_hi, name_te, description, category, price, quantity } = req.body;
    const image = req.file.filename; // Multer saves uploaded file to 'uploads/' directory
    const farmerEmail= req.query.farmerId; // Extract farmer name from query parameters

    const fetchFarmerIdQuery = 'SELECT id, fullName FROM farmer WHERE email = ?';
    db.query(fetchFarmerIdQuery, [farmerEmail], (fetchErr, fetchResult) => {
        if (fetchErr) {
            console.error('Error fetching farmer ID:', fetchErr);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
    
        if (fetchResult.length === 0) {
            console.error('Farmer not found');
            res.status(404).json({ error: 'Farmer not found' });
            return;
        }
    
        // Extract farmer_id and name from fetchResult
        const farmerId = fetchResult[0].id;
        const farmerName = fetchResult[0].fullName;
        
    
        // Insert product into database with farmer_id and farmerName
        const baseColumns = ['name', 'description', 'category', 'price', 'quantity', 'image', 'farmer_id', 'farmerName', 'farmer_email'];
        const baseValues = [name, description, category, price, quantity, image, farmerId, farmerName, farmerEmail];

        if (hasFarmerProductColumn('name_hi')) {
          baseColumns.push('name_hi');
          baseValues.push(name_hi || null);
        }

        if (hasFarmerProductColumn('name_te')) {
          baseColumns.push('name_te');
          baseValues.push(name_te || null);
        }

        const placeholders = baseColumns.map(() => '?').join(', ');
        const insertProductQuery = `INSERT INTO farmer_product (${baseColumns.join(', ')}) VALUES (${placeholders})`;

        db.query(insertProductQuery, baseValues, (insertErr, insertResult) => {
            if (insertErr) {
                console.error('Error inserting product into database:', insertErr);
                res.status(500).json({ error: 'Internal server error' });
                return;
            }
            console.log('Product added successfully');
            res.status(200).json({ message: 'Product added successfully' });
        });
    });
   
});

app.put('/api/products/:productId', upload.single('image'), (req, res) => {
  const productId = req.params.productId;
  const { name, name_hi, name_te, description, category, price, quantity } = req.body;
  let image = null;

  // Check if an image was uploaded
  if (req.file) {
    image = req.file.filename; // If an image is uploaded, get the filename
  }

  // Retrieve the current image filename from the database
  const getCurrentImageQuery = 'SELECT image FROM farmer_product WHERE id = ?';
  db.query(getCurrentImageQuery, [productId], (imageErr, imageResult) => {
    if (imageErr) {
      console.error('Error retrieving current image filename:', imageErr);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    if (imageResult.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // If no new image was uploaded, retain the current image filename
    if (!image) {
      image = imageResult[0].image;
    }

    // Update product in the database
    const updateFields = ['name = ?', 'description = ?', 'category = ?', 'price = ?', 'quantity = ?', 'image = ?'];
    const updateValues = [name, description, category, price, quantity, image];

    if (hasFarmerProductColumn('name_hi')) {
      updateFields.push('name_hi = ?');
      updateValues.push(name_hi || null);
    }

    if (hasFarmerProductColumn('name_te')) {
      updateFields.push('name_te = ?');
      updateValues.push(name_te || null);
    }

    const updateProductQuery = `UPDATE farmer_product SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(productId);

    db.query(updateProductQuery, updateValues, (updateErr, updateResult) => {
      if (updateErr) {
        console.error('Error updating product:', updateErr);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }
      console.log('Product updated successfully');
      res.status(200).json({ message: 'Product updated successfully' });
    });
  });
});




// Define route to fetch total products
app.get('/api/totalproducts11', (req, res) => {
  const query = 'SELECT COUNT(*) AS totalProducts FROM farmer_product';
  db.query(query, (err, result) => {
    if (err) {
      console.error('Error fetching total products:', err);
      res.status(500).json({ error: 'Error fetching total products' });
      return;
    }
    if (result.length === 0 || result[0].totalProducts === null) {
      res.status(404).json({ error: 'No products found' });
      return;
    }
    
    // Log the fetched result to the console
    console.log('Query Result:', result);

    // Log the fetched total products to the console
    console.log('Total Products:', result[0].totalProducts);

    // Send the total products as JSON response
    res.json({ totalProducts: result[0].totalProducts });
  });
});
// // API endpoint to get total products
// app.get('/api/products/total', (req, res) => {
//   const query = 'SELECT COUNT(*) AS total FROM farmer_product';
//   db.query(query, (err, results) => {
//     if (err) {
//       console.error('Error executing query:', err);
//       return res.status(500).send(err);
//     }
//     console.log('Query result:', results); // Log the results
//     res.json({ total: results[0].total });
//   });
// });

  

// Example query execution using the pool
db.query('SELECT * FROM users', (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return;
    }

  });
// Define route to fetch total products, total inventory, order statuses count, and total price of delivered orders
app.get('/api/totaldata', (req, res) => {
  console.log('Request received for /api/totaldata'); // Add a debug statement
  
  const totalProductsQuery = 'SELECT COUNT(*) AS totalProducts FROM farmer_product';
  console.log('Executing total products query:', totalProductsQuery); // Add a debug statement
  
  const totalInventoryQuery = 'SELECT SUM(quantity) AS totalInventory FROM farmer_product';
  console.log('Executing total inventory query:', totalInventoryQuery); // Add a debug statement
  
  const pendingOrdersQuery = 'SELECT COUNT(*) AS pendingOrders FROM orders WHERE status = "pending"';
  console.log('Executing pending orders query:', pendingOrdersQuery); // Add a debug statement
  
  const shippingOrdersQuery = 'SELECT COUNT(*) AS shippingOrders FROM orders WHERE status = "shipping"';
  console.log('Executing shipping orders query:', shippingOrdersQuery); // Add a debug statement
  
  const totalPriceDeliveredQuery = 'SELECT SUM(totalPrice) AS totalPriceDelivered FROM orders WHERE status = "delivered"';
  console.log('Executing total price of delivered orders query:', totalPriceDeliveredQuery); // Add a debug statement
  
  const queries = [
    totalProductsQuery,
    totalInventoryQuery,
    pendingOrdersQuery,
    shippingOrdersQuery,
    totalPriceDeliveredQuery
  ];

  let responseData = {};

  Promise.all(queries.map(query => {
    return new Promise((resolve, reject) => {
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result[0]);
      });
    });
  }))
  .then(results => {
    responseData = {
      totalProducts: results[0].totalProducts,
      totalInventory: results[1].totalInventory,
      pendingOrders: results[2].pendingOrders,
      shippingOrders: results[3].shippingOrders,
      totalPriceDelivered: results[4].totalPriceDelivered || 0 // Set default value if null
    };
    res.json(responseData);
  })
  .catch(error => {
    console.error('Error fetching total data:', error);
    res.status(500).json({ error: 'Error fetching total data' });
  });
});




// JWT secret key
const JWT_SECRET = 'your_secret_key';

// Google OAuth Client ID - replace with your own from Google Cloud Console
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Google Auth endpoint - handles both sign-up and sign-in with Google
// Frontend fetches user info from Google's userinfo API, then sends email/name/googleId here
app.post('/auth/google', async (req, res) => {
    try {
        const { email, name, role, googleId } = req.body;
        const googlePassword = 'GOOGLE_AUTH_USER';

        if (!email) {
            return res.status(400).json({ error: 'Google email is required.' });
        }

        // Check Admin
        db.query('SELECT * FROM admins WHERE email = ?', [email], (err, adminRows) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (adminRows.length > 0) {
                const token = jwt.sign({ email, adminId: adminRows[0].admin_id, isAdmin: true }, JWT_SECRET);
                return res.json({ token });
            }

            // Check Farmer
            db.query('SELECT * FROM farmer WHERE email = ?', [email], (err, farmerRows) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                if (farmerRows.length > 0) {
                    const token = jwt.sign({ email, farmerId: farmerRows[0].id, isFarmer: true }, JWT_SECRET);
                    return res.json({ token });
                }

                // Check Customer
                db.query('SELECT * FROM login WHERE email = ?', [email], (err, userRows) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    if (userRows.length > 0) {
                        const token = jwt.sign({ email, userId: userRows[0].id, isUser: true }, JWT_SECRET);
                        return res.json({ token });
                    }

                    // Check Rider
                    db.query('SELECT * FROM delivery_partner_applications WHERE email = ?', [email], (err, riderRows) => {
                        if (err) return res.status(500).json({ error: 'Database error' });
                        if (riderRows.length > 0) {
                            const token = jwt.sign({ email, fullName: riderRows[0].full_name, isRider: true }, JWT_SECRET);
                            return res.json({ token });
                        }

                        // If not found, register new based on role
                        if (role === 'farmer') {
                            const insertQuery = 'INSERT INTO farmer (fullName, email, phoneNumber, farmName, farmerAddress, password) VALUES (?, ?, ?, ?, ?, ?)';
                            db.query(insertQuery, [name, email, '', 'Google Farm', '', googlePassword], (err, insertResult) => {
                                if (err) return res.status(500).json({ error: 'Error creating farmer account.' });
                                const token = jwt.sign({ email, farmerId: insertResult.insertId, isFarmer: true }, JWT_SECRET);
                                return res.json({ token });
                            });
                        } else if (role === 'rider') {
                          const insertQuery = `
                            INSERT INTO delivery_partner_applications
                            (full_name, email, phone_number, password, vehicle_type, vehicle_number, capacity_kg, rc_number, license_number, aadhaar_number, service_area, availability, status)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
                          `;
                          db.query(insertQuery, [name, email, '', googlePassword, '', '', 0, '', '', '', '', 'Full Time'], (err, insertResult) => {
                                if (err) return res.status(500).json({ error: 'Error creating rider account.' });
                                const token = jwt.sign({ email, fullName: name, isRider: true }, JWT_SECRET);
                                return res.json({ token });
                            });
                        } else {
                            const insertQuery = 'INSERT INTO login (name, email, phone_number, password) VALUES (?, ?, ?, ?)';
                            db.query(insertQuery, [name || 'Google User', email, '', googlePassword], (err, insertResult) => {
                                if (err) return res.status(500).json({ error: 'Error creating account.' });
                                const token = jwt.sign({ email, userId: insertResult.insertId, isUser: true }, JWT_SECRET);
                                return res.json({ token });
                            });
                        }
                    });
                });
            });
        });
    } catch (error) {
        console.error('Google auth error:', error);
        return res.status(500).json({ error: 'An error occurred.' });
    }
});

// Middleware to verify JWT token and extract user ID
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(403).json({ error: 'Token not provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Failed to authenticate token.' });
        }
        req.user = decoded;
        next();
    });
};

// Helper to decrypt Aadhaar values stored as iv:encryptedHex
const decryptAadhaar = (stored) => {
  try {
    if (!stored) return '';
    const parts = String(stored).split(':');
    if (parts.length !== 2) return '';
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', aadhaarCryptoKey, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Aadhaar decryption failed:', err.message);
    return '';
  }
};

// Admin-only endpoint to decrypt a delivery partner's Aadhaar (audit logged)
app.get('/api/admin/delivery-partner/:email/aadhaar', verifyToken, async (req, res) => {
  try {
    const requester = req.user || {};
    if (!requester.isAdmin) return res.status(403).json({ error: 'Admin access required.' });

    const partnerEmail = req.params.email;
    if (!partnerEmail) return res.status(400).json({ error: 'partner email required in path' });

    const rows = await queryAsync('SELECT email, aadhaar_number_encrypted, aadhaar_number FROM delivery_partner_applications WHERE email = ? LIMIT 1', [partnerEmail]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Delivery partner not found' });

    const partner = rows[0];
    const stored = partner.aadhaar_number_encrypted || partner.aadhaar_number || '';
    const decrypted = decryptAadhaar(stored) || '';

    // Insert audit log
    try {
      await queryAsync('INSERT INTO admin_aadhaar_access_logs (admin_email, partner_email, action) VALUES (?, ?, ?)', [requester.email || 'unknown', partnerEmail, 'viewed_aadhaar']);
    } catch (logErr) {
      console.error('Failed to write aadhaar access log:', logErr.message);
    }

    return res.json({ partner_email: partnerEmail, aadhaar: decrypted, masked: maskAadhaar(decrypted) });
  } catch (err) {
    console.error('Admin decrypt endpoint error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: generate a short-lived signed URL for an uploaded file
app.post('/api/admin/uploads/signed-url', verifyToken, async (req, res) => {
  try {
    const requester = req.user || {};
    if (!requester.isAdmin) return res.status(403).json({ error: 'Admin access required.' });

    const { filename, expiresSeconds } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'filename is required in body' });

    const ttl = Number(expiresSeconds) || 300; // default 5 minutes
    const token = jwt.sign({ filename }, JWT_SECRET, { expiresIn: ttl });

    const url = `${req.protocol}://${req.get('host')}/uploads/secure/${token}`;
    return res.json({ url, expiresIn: ttl });
  } catch (err) {
    console.error('Signed URL generation error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve uploaded files via signed token (no public directory exposure required)
app.get('/uploads/secure/:token', (req, res) => {
  const token = req.params.token;
  if (!token) return res.status(400).send('token required');

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send('Invalid or expired token');
    }
    const filename = decoded && decoded.filename;
    if (!filename) return res.status(400).send('Invalid token payload');

    // Prevent path traversal
    const safeName = path.basename(filename);
    const filePath = path.resolve('uploads', safeName);

    res.sendFile(filePath, (sendErr) => {
      if (sendErr) {
        console.error('Secure file send error:', sendErr.message);
        return res.status(404).send('File not found');
      }
    });
  });
});

// --- OTP Helper Functions ---
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOTPEmail = async (email, otp) => {
    const mailOptions = {
        from: `"FreshFarm" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Your Verification Code',
        text: `Your FreshFarm verification code is: ${otp}. It will expire in 10 minutes.`,
        html: `<p>Your FreshFarm verification code is: <b>${otp}</b></p><p>It will expire in 10 minutes.</p>`
    };
    return transporter.sendMail(mailOptions);
};

const sendAppEmail = async ({ to, subject, text, html }) => {
  if (!to || !process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"FreshFarm" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
      html
    });
    return true;
  } catch (error) {
    console.error('Email notification failed:', error.message);
    return false;
  }
};

const formatOrderStatus = (status) => {
  const normalized = String(status || 'pending').toLowerCase();
  return {
    pending: 'Pending',
    confirmed: 'Confirmed',
    packed: 'Packed',
    picked_up: 'Picked Up',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  }[normalized] || 'Pending';
};

const buildOrderNotificationCopy = ({ orderId, buyerName, totalPrice, status, items }) => {
  const statusLabel = formatOrderStatus(status);
  const itemLines = (items || []).map((item) => `${item.productName} x ${item.quantity}`).join(', ') || 'No items listed';

  return {
    subject: `FreshFarm Order #${orderId} - ${statusLabel}`,
    text: `Hello ${buyerName},\n\nYour FreshFarm order #${orderId} is now ${statusLabel}.\nItems: ${itemLines}\nTotal: Rs. ${totalPrice}\n\nThank you for shopping with FreshFarm.`,
    html: `<p>Hello ${buyerName},</p><p>Your FreshFarm order <b>#${orderId}</b> is now <b>${statusLabel}</b>.</p><p><b>Items:</b> ${itemLines}</p><p><b>Total:</b> Rs. ${totalPrice}</p><p>Thank you for shopping with FreshFarm.</p>`
  };
};

const sendOrderStatusToCustomer = async ({ customerEmail, buyerName, orderId, totalPrice, status, items }) => {
  if (!customerEmail) return false;
  const copy = buildOrderNotificationCopy({ orderId, buyerName, totalPrice, status, items });
  return sendAppEmail({
    to: customerEmail,
    subject: copy.subject,
    text: copy.text,
    html: copy.html
  });
};

const sendOrderPlacedToFarmer = async ({ farmerEmail, buyerName, buyerPhoneNumber, buyerLocation, orderId, totalPrice, items }) => {
  if (!farmerEmail) return false;
  const itemLines = (items || []).map((item) => `${item.productName} x ${item.quantity}`).join(', ') || 'No items listed';

  return sendAppEmail({
    to: farmerEmail,
    subject: `New FreshFarm order #${orderId} received`,
    text: `Hello Farmer,\n\nA new order has been placed on FreshFarm.\nOrder ID: #${orderId}\nCustomer: ${buyerName}\nPhone: ${buyerPhoneNumber || '-'}\nLocation: ${buyerLocation || '-'}\nItems: ${itemLines}\nTotal: Rs. ${totalPrice}\n\nPlease confirm and start packing when ready.`,
    html: `<p>Hello Farmer,</p><p>A new order has been placed on FreshFarm.</p><p><b>Order ID:</b> #${orderId}<br/><b>Customer:</b> ${buyerName}<br/><b>Phone:</b> ${buyerPhoneNumber || '-'}<br/><b>Location:</b> ${buyerLocation || '-'}<br/><b>Items:</b> ${itemLines}<br/><b>Total:</b> Rs. ${totalPrice}</p><p>Please confirm and start packing when ready.</p>`
  });
};

const runQuery = (sql, params = []) => (
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  })
);

const parseValidUserId = (value) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
};

const emitOrderTrackingUpdate = async (orderId, overrides = {}) => {
  const normalizedOrderId = Number(orderId || 0);
  if (!normalizedOrderId) return;

  try {
    const rows = await runQuery(
      `
      SELECT
        o.new_id AS order_id,
        o.user_id,
        o.status,
        o.delivery_partner_email,
        l.latitude,
        l.longitude,
        l.eta_minutes,
        l.updated_at AS location_updated_at
      FROM orders o
      LEFT JOIN delivery_live_locations l ON l.order_id = o.new_id
      WHERE o.new_id = ?
      LIMIT 1
      `,
      [normalizedOrderId]
    );

    const row = rows?.[0];
    if (!row) {
      io.emit('order:tracking', { orderId: normalizedOrderId, ...overrides });
      return;
    }

    io.emit('order:tracking', {
      orderId: Number(row.order_id),
      userId: row.user_id,
      status: row.status,
      deliveryPartnerEmail: row.delivery_partner_email || null,
      riderLatitude: row.latitude == null ? null : Number(row.latitude),
      riderLongitude: row.longitude == null ? null : Number(row.longitude),
      riderEtaMinutes: row.eta_minutes == null ? null : Number(row.eta_minutes),
      riderLocationUpdatedAt: row.location_updated_at || null,
      ...overrides
    });
  } catch (error) {
    console.error('Error emitting order tracking update:', error.message);
    io.emit('order:tracking', { orderId: normalizedOrderId, ...overrides });
  }
};

const VEHICLE_TIER_RULES = [
  { label: 'Two Wheeler', rank: 2, maxQuantity: 5 },
  { label: 'Three Wheeler', rank: 3, maxQuantity: 12 },
  { label: 'Four Wheeler', rank: 4, maxQuantity: 24 },
  { label: 'Six Wheeler', rank: 6, maxQuantity: 40 },
  { label: '12 Wheeler Truck', rank: 12, maxQuantity: 80 },
  { label: '14 Wheeler Truck', rank: 14, maxQuantity: Infinity }
];

const normalizeVehicleLabel = (value) => String(value || '').trim().toLowerCase();

const getVehicleRank = (value) => {
  const normalized = normalizeVehicleLabel(value);
  if (!normalized) return 0;
  if (normalized.includes('14')) return 14;
  if (normalized.includes('12')) return 12;
  if (normalized.includes('six')) return 6;
  if (normalized.includes('four')) return 4;
  if (normalized.includes('three') || normalized.includes('auto')) return 3;
  if (normalized.includes('two') || normalized.includes('bike') || normalized.includes('scooter') || normalized.includes('cycle')) return 2;
  return 0;
};

const getRequiredVehicleTier = (totalQuantity) => {
  const quantity = Math.max(0, Number(totalQuantity || 0));
  return VEHICLE_TIER_RULES.find((tier) => quantity <= tier.maxQuantity) || VEHICLE_TIER_RULES[VEHICLE_TIER_RULES.length - 1];
};

const getDeliveryPartnerFitScore = ({ orderLocation, totalQuantity, partner }) => {
  const requiredTier = getRequiredVehicleTier(totalQuantity);
  const partnerRank = getVehicleRank(partner.vehicle_type);
  const capacityKg = Number(partner.capacity_kg || 0);
  const estimatedLoadKg = Math.max(4, Math.round(Number(totalQuantity || 0) * 4));
  const areaText = String(partner.service_area || '').trim().toLowerCase();
  const normalizedOrderLocation = String(orderLocation || '').trim().toLowerCase();

  if (partnerRank > 0 && partnerRank < requiredTier.rank) return null;
  if (Number.isFinite(capacityKg) && capacityKg > 0 && capacityKg < estimatedLoadKg) return null;

  let score = 0;
  if (partnerRank === requiredTier.rank) {
    score += 60;
  } else if (partnerRank > requiredTier.rank) {
    score += 40;
  }

  if (areaText && normalizedOrderLocation) {
    if (normalizedOrderLocation.includes(areaText) || areaText.includes(normalizedOrderLocation)) {
      score += 40;
    } else {
      const overlap = areaText.split(/[,/\-\s]+/).filter(Boolean).some((part) => normalizedOrderLocation.includes(part) || part.includes(normalizedOrderLocation));
      if (overlap) score += 20;
    }
  }

  if (!areaText) score += 10;
  if (!capacityKg) score += 5;

  return score;
};

const sendOrderOfferToPartner = async ({ partnerEmail, partnerName, orderId, deliveryFee, buyerLocation, totalQuantity, requiredVehicleType }) => {
  if (!partnerEmail) return false;
  return sendAppEmail({
    to: partnerEmail,
    subject: `FreshFarm delivery request for order #${orderId}`,
    text: `Hello ${partnerName || 'Partner'},\n\nA nearby order is available.\nOrder ID: #${orderId}\nPickup/Drop area: ${buyerLocation || '-'}\nTotal quantity: ${totalQuantity}\nRecommended vehicle: ${requiredVehicleType || 'Any suitable vehicle'}\nEstimated payout: Rs. ${deliveryFee}\n\nOpen Delivery Partner dashboard to accept the job.`,
    html: `<p>Hello ${partnerName || 'Partner'},</p><p>A nearby order is available.</p><p><b>Order ID:</b> #${orderId}<br/><b>Pickup/Drop area:</b> ${buyerLocation || '-'}<br/><b>Total quantity:</b> ${totalQuantity}<br/><b>Recommended vehicle:</b> ${requiredVehicleType || 'Any suitable vehicle'}<br/><b>Estimated payout:</b> Rs. ${deliveryFee}</p><p>Open Delivery Partner dashboard to accept the job.</p>`
  });
};

const triggerDeliveryPartnerOffers = async (orderId) => {
  try {
    const orderRows = await runQuery(
      `
      SELECT
        o.new_id,
        o.buyerLocation,
        o.totalPrice,
        COALESCE(SUM(oi.quantity), 0) AS totalQuantity
      FROM orders o
      LEFT JOIN order_item oi ON oi.orderId = o.new_id
      WHERE o.new_id = ?
      GROUP BY o.new_id, o.buyerLocation, o.totalPrice
      `,
      [orderId]
    );

    if (!orderRows.length) return;
    const order = orderRows[0];
    const totalQuantity = Number(order.totalQuantity || 0);
    const deliveryFee = Math.max(40, Math.round(40 + totalQuantity * 5 + Number(order.totalPrice || 0) * 0.02));
    const requiredTier = getRequiredVehicleTier(totalQuantity);

    const partners = await runQuery(
      `
      SELECT email, full_name, service_area, vehicle_type, capacity_kg, updated_at
      FROM delivery_partner_applications
      WHERE LOWER(status) IN ('pending', 'approved') AND is_online = 1
      ORDER BY updated_at DESC
      `
    );

    if (!partners.length) return;

    const targetPartners = partners
      .map((partner) => ({
        partner,
        score: getDeliveryPartnerFitScore({
          orderLocation: order.buyerLocation,
          totalQuantity,
          partner
        })
      }))
      .filter(({ score }) => score !== null)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        const rightUpdated = new Date(right.partner.updated_at || 0).getTime();
        const leftUpdated = new Date(left.partner.updated_at || 0).getTime();
        return rightUpdated - leftUpdated;
      })
      .map(({ partner }) => partner)
      .slice(0, 8);
    if (!targetPartners.length) return;

    const assignmentValues = targetPartners.map((partner) => [
      orderId,
      partner.email,
      partner.full_name || null,
      deliveryFee,
      'offered'
    ]);

    await runQuery(
      `
      INSERT INTO delivery_order_assignments
      (order_id, partner_email, partner_name, delivery_fee, assignment_status)
      VALUES ?
      ON DUPLICATE KEY UPDATE
      delivery_fee = VALUES(delivery_fee),
      assignment_status = IF(assignment_status = 'accepted', assignment_status, 'offered')
      `,
      [assignmentValues]
    );

    await Promise.allSettled(
      targetPartners.map((partner) => sendOrderOfferToPartner({
        partnerEmail: partner.email,
        partnerName: partner.full_name,
        orderId,
        deliveryFee,
        buyerLocation: order.buyerLocation,
        totalQuantity,
        requiredVehicleType: requiredTier.label
      }))
    );
  } catch (error) {
    console.error('Could not trigger delivery partner offers:', error.message);
  }
};

// --- OTP Endpoints ---

// 1. Send OTP for Signup (Both Customer and Farmer)
app.post("/send-otp-signup", (req, res) => {
    const { email, type } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    // Check if email already exists in relevant table based on type
    let tableToCheck = 'login';
    if (type === 'farmer') tableToCheck = 'farmer';
    if (type === 'rider') tableToCheck = 'delivery_partner_applications';

    db.query(`SELECT * FROM ${tableToCheck} WHERE email = ?`, [email], async (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (result.length > 0) return res.status(409).json({ error: `Email already exists as a ${type}.` });

        // Generate and send OTP
        const otp = generateOTP();
        otpStore[email] = { code: otp, data: req.body, expires: Date.now() + 10 * 60 * 1000 };

        try {
            await sendOTPEmail(email, otp);
            res.json({ message: 'OTP sent successfully.' });
        } catch (error) {
            console.error('Error sending OTP:', error);
            res.status(500).json({ error: 'Failed to send OTP email. Please make sure email is valid.' });
        }
    });
});

// 2. Verify OTP for Signup
app.post("/verify-otp-signup", (req, res) => {
    const { email, otp } = req.body;
    const stored = otpStore[email];

    if (!stored || stored.expires < Date.now()) {
        return res.status(400).json({ error: 'OTP expired or not requested.' });
    }
    if (stored.code !== otp) {
        return res.status(400).json({ error: 'Invalid OTP.' });
    }

    const data = stored.data;
    delete otpStore[email];

    if (data.type === 'farmer') {
        const insertSql = "INSERT INTO farmer (fullName, email, phoneNumber, farmName, farmerAddress, password) VALUES (?, ?, ?, ?, ?, ?)";
        db.query(insertSql, [data.fullName, data.email, data.phoneNumber, data.farmName, data.farmerAddress, data.password], (err, result) => {
            if (err) return res.status(500).json({ error: 'Failed to create farmer account.' });
            return res.status(200).json({ message: 'Farmer signup successful' });
        });
    } else if (data.type === 'rider') {
      const insertSql = `
        INSERT INTO delivery_partner_applications
        (full_name, email, phone_number, password, vehicle_type, vehicle_number, capacity_kg, rc_number, license_number, aadhaar_number, service_area, availability, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
      `;
      db.query(insertSql, [data.fullName, data.email, data.phoneNumber, data.password, '', '', 0, '', '', '', '', 'Full Time'], (err, result) => {
            if (err) {
                console.error('Error creating rider account:', err);
                return res.status(500).json({ error: 'Failed to create rider account.' });
            }
            return res.status(200).json({ message: 'Rider signup successful. Please login to complete your profile.' });
        });
    } else {
        const insertSql = "INSERT INTO login (name, email, phone_number, password) VALUES (?, ?, ?, ?)";
        db.query(insertSql, [data.fullName, data.email, data.phoneNumber, data.password], (err, result) => {
            if (err) return res.status(500).json({ error: 'Failed to create user account.' });
            return res.status(200).json({ message: 'Signup successful' });
        });
    }
});

// 3. Verify OTP for Login
app.post("/verify-otp-login", (req, res) => {
    const { email, otp } = req.body;
    const stored = otpStore[email];

    if (!stored || stored.type !== 'login' || stored.expires < Date.now()) {
        return res.status(400).json({ error: 'OTP expired or not requested.' });
    }
    if (stored.code !== otp) {
        return res.status(400).json({ error: 'Invalid OTP.' });
    }

    const token = stored.token;
    delete otpStore[email];
    
    return res.json({ token, message: 'OTP verified successfully.' });
});


app.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password.' });
    }

    let sql = "SELECT * FROM farmer WHERE email = ? AND password = ?";
    db.query(sql, [email, password], async (err, farmerResult) => {
        if (err) return res.status(500).json({ error: 'Database error.' });

        if (farmerResult.length > 0) {
            let token = jwt.sign({ email, farmerName: farmerResult[0].id, isFarmer: true }, JWT_SECRET);
            return await triggerLoginOTP(email, token, res);
        }
        
        // Check login table if not farmer
        db.query("SELECT * FROM login WHERE email = ? AND password = ?", [email, password], async (err, loginResult) => {
            if (err) return res.status(500).json({ error: 'Database error.' });
    
            if (loginResult.length > 0) {
                let token = jwt.sign({ email: loginResult[0].id, isFarmer: false }, JWT_SECRET);
                return await triggerLoginOTP(email, token, res);
            }
            
                db.query("SELECT * FROM admins WHERE email = ? AND password = ?", [email, password], async (err, adminResult) => {
                    if (err) return res.status(500).json({ error: 'Database error.' });
            
                    if (adminResult.length > 0) {
                        let token = jwt.sign({ email: adminResult[0].admin_id, isAdmin: true }, JWT_SECRET);
                        return await triggerLoginOTP(email, token, res);
                    }

                    // Check riders table
                    db.query("SELECT * FROM delivery_partner_applications WHERE email = ? AND password = ?", [email, password], async (err, riderResult) => {
                        if (err) return res.status(500).json({ error: 'Database error.' });
                        if (riderResult.length > 0) {
                            let token = jwt.sign({ email, fullName: riderResult[0].full_name, isRider: true }, JWT_SECRET);
                            return await triggerLoginOTP(email, token, res);
                        }
                        
                        return res.status(401).json({ error: 'Invalid username or password.' });
                    });
                });
            });
        });
    });

app.post('/api/delivery-partners/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

  db.query("SELECT * FROM delivery_partner_applications WHERE email = ? AND password = ?", [email, password], async (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (result.length === 0) return res.status(401).json({ error: 'Invalid credentials.' });

    const partner = result[0];
    const token = jwt.sign({ email, fullName: partner.full_name, isRider: true }, JWT_SECRET);
    
    // We can also trigger OTP for partners if desired, or skip it
    return await triggerLoginOTP(email, token, res);
  });
});

async function triggerLoginOTP(email, token, res) {
    if (email === 'testrider@freshfarm.com') {
        return res.json({ token, message: 'OTP bypassed for test rider.' });
    }
    const otp = generateOTP();
    otpStore[email] = { code: otp, token: token, type: 'login', expires: Date.now() + 10 * 60 * 1000 };
    
    try {
        await sendOTPEmail(email, otp);
        res.json({ message: 'OTP sent to your email.', otpRequired: true });
    } catch (error) {
        console.error('OTP Send Error:', error);
        res.status(500).json({ error: 'Could not send OTP. Make sure your email is valid.' });
    }
}

//Log the logging activity
app.post('/loginactivity', async (req, res) => {
    const { email, name } = req.body;
  
    try {
      db.query('SELECT name FROM login WHERE email = ?', [email], async (err, results) => {
        if (err) {
          return res.status(500).json({ error: 'Database query error' });
        }
  
        if (results.length === 0) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }
  
        const name = results[0].name;
        const loginTime = new Date();
        db.query('INSERT INTO login_activity (name, email, login_time) VALUES (?, ?, ?)', [name, email, loginTime], (err, results) => {
          if (err) {
            console.error('Error logging login activity:', err);
            return res.status(500).json({ error: 'Failed to log login activity.' });
          }

          return res.json({ message: 'Login activity recorded.' });
        });
  
        
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });


  
  

app.delete('/farmers/:id', (req, res) => {
    const { id } = req.params;

    const deleteSql = "DELETE FROM farmer WHERE id = ?";
    db.query(deleteSql, id, (err, result) => {
        if (err) {
            console.error('Error deleting farmer signup:', err);
            res.status(500).json({ error: 'Error deleting farmer signup' });
        } else {
            console.log('Farmer signup deleted successfully:', result);
            res.json({ message: 'Farmer signup deleted successfully' });
        }
    });
});
app.put('/farmers/:id', (req, res) => {
    const { id } = req.params;
    const updatedData = req.body; // Assuming the updated data is sent in the request body

    const updateSql = "UPDATE farmer SET ? WHERE id = ?";
    db.query(updateSql, [updatedData, id], (err, result) => {
        if (err) {
            console.error('Error updating farmer signup:', err);
            res.status(500).json({ error: 'Error updating farmer signup' });
        } else {
            console.log('Farmer signup updated successfully:', result);
            res.json({ message: 'Farmer signup updated successfully' });
        }
    });
});



app.get('/farmers', (req, res) => {
    db.query('SELECT * FROM farmer', (err, results) => {
        if (err) {
            console.error('Error fetching products from database:', err);
            return res.status(500).json({ error: 'Error fetching products' });
        }
        res.status(200).json(results);
    });
});

// Add a new product
app.post('/api/products', (req, res) => {
    const productData = req.body;
    db.query('INSERT INTO farmer_product SET ?', productData, (err, result) => {
        if (err) {
            console.error('Error adding product to database:', err);
            return res.status(500).json({ error: 'Error adding product' });
        }
        console.log('Product added to database:', result);
        const newProduct = { ...productData, id: result.insertId };
        res.status(200).json(newProduct);
    });
});

// Delete an existing product
app.delete('/api/products/:id', (req, res) => {
    const productId = req.params.id;
    db.query('DELETE FROM farmer_product WHERE id = ?', productId, (err, result) => {
        if (err) {
            console.error('Error deleting product from database:', err);
            return res.status(500).json({ error: 'Error deleting product' });
        }
        console.log('Product deleted from database:', result);
        res.status(200).json({ message: 'Product deleted successfully' });
    });
});



// Route to fetch all admins data
app.get('/admins', (req, res) => {
    const selectSql = "SELECT * FROM admins";
    db.query(selectSql, (err, result) => {
        if (err) {
            console.error('Error executing MySQL query:', err);
            res.status(500).json({ error: 'Error fetching admins data' });
        } else {
            console.log('Admins data fetched successfully:', result);
            res.json(result);
        }
    });
});

app.put('/admins/:id', (req, res) => {
  const { id } = req.params;
  const { email, password, created_by } = req.body; // Extract updated admin data from request body

  // Convert the provided datetime value to the desired format
  const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Now, update your SQL query to use the dynamic values
  const updateSql = "UPDATE admins SET email = ?, password = ?, created_by = ?, created_at = ? WHERE admin_id = ?";

  // Execute the SQL query with the dynamic values
  db.query(updateSql, [email, password, created_by, createdAt, id], (err, result) => {
    if (err) {
      console.error('Error updating admin:', err);
      res.status(500).json({ error: 'Error updating admin' });
    } else {
      console.log('Admin updated successfully:', result);
      res.json({ message: 'Admin updated successfully' });
    }
  });
});

// Route to delete admin data
app.delete('/admins/:id', (req, res) => {
    const { id } = req.params;

    const deleteSql = "DELETE FROM admins WHERE admin_id = ?";
    db.query(deleteSql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting admin:', err);
            res.status(500).json({ error: 'Error deleting admin' });
        } else {
            if (result.affectedRows > 0) {
                console.log('Admin deleted successfully');
                res.json({ message: 'Admin deleted successfully' });
            } else {
                console.log('Admin not found');
                res.status(404).json({ error: 'Admin not found' });
            }
        }
    });
});

// Route to fetch users from the login table
app.get('/api/users', (req, res) => {
    const selectSql = "SELECT * FROM login";
    db.query(selectSql, (err, result) => {
        if (err) {
            console.error('Error fetching users from database:', err);
            res.status(500).json({ error: 'Error fetching users' });
        } else {
            console.log('Users fetched successfully:', result);
            res.json(result);
        }
    });
});

// Route to delete a user from the login table
app.delete('/api/deleteUser/:id', (req, res) => {
    const userId = req.params.id;
    const deleteSql = "DELETE FROM login WHERE id = ?";
    db.query(deleteSql, userId, (err, result) => {
        if (err) {
            console.error('Error deleting user from database:', err);
            res.status(500).json({ error: 'Error deleting user' });
        } else {
            console.log('User deleted successfully:', result);
            res.status(200).json({ message: 'User deleted successfully' });
        }
    });
});



 //Backend API endpoint to handle adding a product to the cart
 app.post('/api11/products/cart', (req, res) => {
    const { product_name, category, quantity, price } = req.body;
    const timestamp = new Date(); // Generate current timestamp
  
    // Insert the product into the cart_items table in the database
    db.query('INSERT INTO cart_items (product_name, category, quantity, price, timestamp) VALUES (?, ?, ?, ?, ?)',
      [product_name, category, quantity, price, timestamp],
      (error, results) => {
        if (error) {
          console.error('Error adding product to cart:', error);
          return res.status(500).json({ error: 'Internal server error' });
        }
  
        return res.status(200).json({ message: 'Product added to cart successfully' });
      }
    );
  });

    // Route to remove an item from the cart
    app.delete('/api11/products/cart/:id', (req, res) => {
        const productId = req.params.id;
        const deleteSql = 'DELETE FROM cart_items WHERE id = ?';
        db.query(deleteSql, productId, (err, result) => {
          if (err) {
            console.error('Error removing product from cart:', err);
            res.status(500).json({ error: 'Error removing product from cart' });
          } else {
            console.log('Product removed from cart successfully:', result);
            res.status(200).json({ message: 'Product removed from cart successfully' });
          }
        });
      });

  // Route to update quantity of an item in the cart
app.patch('/api11/products/cart/:id', (req, res) => {
    const productId = req.params.id;
    const { quantity} = req.body;
    const updateSql = 'UPDATE cart_items SET quantity = ? WHERE id = ?';
    db.query(updateSql, [quantity, productId], (err, result) => {
      if (err) {
        console.error('Error updating product quantity:', err);
        res.status(500).json({ error: 'Error updating product quantity' });
      } else {
        console.log('Product quantity updated successfully:', result);
        res.status(200).json({ message: 'Product quantity updated successfully' });
      }
    });
  });
  
  
  // Endpoint to fetch cart items
app.get('/api11/products/cart', (req, res) => {
    const sql = 'SELECT * FROM cart_items';
    db.query(sql, (err, result) => {
      if (err) {
        console.error('Error fetching cart items:', err);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }
      res.json(result); // Return cart items as JSON response
    });
  });


  // Route to handle storing user messages
app.post('/api/sendMessage', (req, res) => {
    const { farmerId, message, senderUsername } = req.body;
  
    // Validate request parameters
    if (!farmerId || !message || !senderUsername) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
  
    // SQL query to insert the user's message into the database
    const insertSql = 'INSERT INTO user_messages (farmer_id, message, sender, timestamp) VALUES (?, ?, ?, NOW())'; // Assuming 'timestamp' column exists in 'user_messages'
    
    db.query(insertSql, [farmerId, message, senderUsername], (err, result) => {
      if (err) {
        console.error('Error storing user message:', err);
        return res.status(500).json({ error: 'Error storing user message' });
      }
  
      // Message stored successfully
      res.status(201).json({ message: 'User message sent successfully' });
    });
  });

// API endpoints
// Fetch messages for a specific user
app.get('/api/messages/:user', (req, res) => {
    const user = req.params.user;
  
    // Assuming 'user_messages' table schema: id, user_id, message, sender, timestamp
    const query = 'SELECT * FROM user_messages WHERE user_id = ? ORDER BY timestamp';
    
    db.query(query, [user], (err, results) => {
      if (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Error fetching messages' });
      } else {
        const messages = results.map(row => ({
          text: row.message,
          sender: row.sender,
          timestamp: row.timestamp,
        }));
        res.status(200).json({ messages });
      }
    });
  });

  
  
  app.post('/api11/products/cart/placeOrder', (req, res) => {
    console.log("Received place order request");
      const {
        buyerName,
        buyerPhoneNumber,
        buyerLocation,
        cartItems,
        totalPrice,
        userId,
        customerEmail = userId || null,
        paymentMethod = 'online',
        codAdvanceAmount = 0,
        codRemainingAmount = 0
      } = req.body;
      console.log("Order Details:", { buyerName, buyerPhoneNumber, buyerLocation, totalPrice, userId, customerEmail, paymentMethod }); // Log received order details

    const normalizedCustomerEmail = typeof customerEmail === 'string' && customerEmail.trim() ? customerEmail.trim() : null;
    const requestedUserId = parseValidUserId(userId);
    const emailDerivedUserId = parseValidUserId(normalizedCustomerEmail);
  
    // Insert order details into the database
      const orderStatus = 'pending';
      const orderQuery = 'INSERT INTO orders (buyerName, buyerPhoneNumber, buyerLocation, totalPrice, user_id, customer_email, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const saveOrder = (resolvedUserId) => {
        db.query(orderQuery, [buyerName, buyerPhoneNumber, buyerLocation, totalPrice, resolvedUserId, normalizedCustomerEmail, orderStatus], (err, result) => {
          if (err) {
            console.error('Error inserting order details into the database:', err);
            return res.status(500).json({ error: 'Error placing order. Please try again.' });
          }

          const orderId = result.insertId;

          // Fetch productId for each cart item from farmer_product table
          const fetchProductIds = cartItems.map(item => {
            return new Promise((resolve, reject) => {
                const productQuery = 'SELECT id, farmer_email FROM farmer_product WHERE name = ? AND category = ?';
              db.query(productQuery, [item.productName, item.category], (err, results) => {
                if (err) {
                  reject(err);
                } else if (results.length > 0) {
                    resolve({ ...item, productId: results[0].id, farmerEmail: results[0].farmer_email || null });
                } else {
                  reject(new Error('Product not found in farmer_product table'));
                }
              });
            });
          });

          // Resolve all productId fetch promises
          Promise.all(fetchProductIds)
            .then(itemsWithProductIds => {
              const orderItemsValues = itemsWithProductIds.map(item => [
                orderId, item.productId, item.productName, item.category, item.quantity, item.price, item.price * item.quantity
              ]);

              // Insert order items into the database
              const orderItemsQuery = 'INSERT INTO order_item (orderId, productId, productName, category, quantity, price, totalPrice) VALUES ?';
              db.query(orderItemsQuery, [orderItemsValues], (err, result) => {
                if (err) {
                  console.error('Error inserting order items into the database:', err);
                  return res.status(500).json({ error: 'Error placing order. Please try again.' });
                }

                const farmerEmails = [...new Set(itemsWithProductIds.map((item) => item.farmerEmail).filter(Boolean))];
                const notificationPayload = {
                  orderId,
                  buyerName,
                  buyerPhoneNumber,
                  buyerLocation,
                  totalPrice,
                  items: itemsWithProductIds
                };

                Promise.allSettled([
                  sendOrderStatusToCustomer({
                    customerEmail: normalizedCustomerEmail,
                    buyerName,
                    orderId,
                    totalPrice,
                    status: orderStatus,
                    items: itemsWithProductIds
                  }),
                  ...farmerEmails.map((farmerEmail) => sendOrderPlacedToFarmer({ farmerEmail, ...notificationPayload }))
                ]).catch((notifyErr) => {
                  console.error('Error sending order notifications:', notifyErr);
                });

                res.status(200).json({ message: 'Order placed successfully!' });
              });
            })
            .catch(err => {
              console.error('Error fetching product IDs:', err);
              res.status(500).json({ error: 'Error fetching product IDs. Please try again.' });
            });
        });
      };

      if (requestedUserId) {
        saveOrder(requestedUserId);
      } else if (emailDerivedUserId) {
        saveOrder(emailDerivedUserId);
      } else if (normalizedCustomerEmail) {
        db.query('SELECT id FROM login WHERE email = ? LIMIT 1', [normalizedCustomerEmail], (lookupErr, lookupRows) => {
          if (lookupErr) {
            console.error('Error resolving user_id from email during place order:', lookupErr);
            return saveOrder(null);
          }

          const resolvedUserId = lookupRows?.length ? parseValidUserId(lookupRows[0].id) : null;
          saveOrder(resolvedUserId);
        });
      } else {
        saveOrder(null);
      }
  });
  

    // Route to handle placing orders with validation
app.post('/api11/products/cart/match', (req, res) => {
    const { buyerName } = req.body;
  
    // Check if the provided name matches any entry in the login_activity table
    const sql = 'SELECT * FROM login_activity WHERE name = ?';
    db.query(sql, [buyerName], (err, result) => {
      if (err) {
        console.error('Error querying database:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
  
      if (result.length > 0) {
        // Match found, proceed to place the order
        // Your existing logic to place the order goes here
        return res.status(200).json({ message: 'Order placed successfully' });
      } else {
        // No match found, return an error
        return res.status(400).json({ error: 'Invalid name. Please check your details and try again.' });
      }
    });
  });

app.post('/api11/payments/stripe/checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in backend environment.' });
    }

    const { cartItems = [], shippingFee = 250, origin, paymentMode = 'online', codAdvanceAmount = null } = req.body || {};
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const baseUrl = origin && /^https?:\/\//.test(origin) ? origin : 'http://localhost:3000';
    const normalizedShipping = Math.max(0, Number(shippingFee) || 0);

    const subtotal = cartItems.reduce((sum, item) => {
      const unit = Math.max(0, Number(item.price || 0));
      const qty = Math.max(1, Number(item.quantity || 1));
      return sum + unit * qty;
    }, 0);

    const grandTotal = subtotal + normalizedShipping;

    let lineItems;

    if (paymentMode === 'cod') {
      const computedAdvance = Math.max(1, Math.round(grandTotal * 0.25));
      const upfrontAmount = Math.max(1, Math.round(Number(codAdvanceAmount || computedAdvance)));

      lineItems = [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: 'Cash on Delivery Advance (25%)'
            },
            unit_amount: upfrontAmount * 100
          },
          quantity: 1
        }
      ];
    } else {
      lineItems = cartItems.map((item) => {
        const unitAmount = Math.max(1, Math.round(Number(item.price || 0) * 100));
        const quantity = Math.max(1, Number(item.quantity || 1));
        return {
          price_data: {
            currency: 'inr',
            product_data: {
              name: item.product_name || item.productName || 'FreshFarm Product'
            },
            unit_amount: unitAmount
          },
          quantity
        };
      });

      if (normalizedShipping > 0) {
        lineItems.push({
          price_data: {
            currency: 'inr',
            product_data: { name: 'Shipping Fee' },
            unit_amount: Math.round(normalizedShipping * 100)
          },
          quantity: 1
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'upi'],
      line_items: lineItems,
      success_url: `${baseUrl}/addCart?payment=success&method=${paymentMode}`,
      cancel_url: `${baseUrl}/addCart?payment=cancelled&method=${paymentMode}`
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    return res.status(500).json({ error: 'Failed to create Stripe checkout session.' });
  }
});

  app.get('/api11/farmer/orders', (req, res) => {
    const query = `
      SELECT 
        o.buyerName,
        o.buyerPhoneNumber,
        o.buyerLocation,
        o.totalPrice,
        o.orderDate,
        o.status, -- Include status column
        oi.orderId, 
        oi.productName,
        oi.productId,
        oi.category,
        oi.quantity,
        oi.price,
        oi.totalPrice AS itemTotalPrice
      FROM orders o
      JOIN order_item oi ON o.new_id = oi.orderId
    `;
  
    db.query(query, (error, results) => {
      if (error) {
        console.error('Error fetching orders from database:', error);
        res.status(500).json({ error: 'Internal server error' });
      } else {
        const orders = results.reduce((acc, order) => {
          const orderId = order.orderId;
          if (!acc[orderId]) {
            acc[orderId] = {
              buyerName: order.buyerName,
              buyerPhoneNumber: order.buyerPhoneNumber,
              buyerLocation: order.buyerLocation,
              totalPrice: order.totalPrice,
              orderDate: order.orderDate,
              status: order.status, // Include status
              items: []
            };
          }
          acc[orderId].items.push({
            orderId: order.orderId,
            productName: order.productName,
            productId: order.productId,
            category: order.category,
            quantity: order.quantity,
            price: order.price,
            itemTotalPrice: order.itemTotalPrice
          });
          return acc;
        }, {});
  
        res.json(Object.values(orders));
      }
    });
});

app.get('/api/account/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const query = 'SELECT id, name, email, phone_number FROM login WHERE id = ? LIMIT 1';

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching account profile:', err);
      return res.status(500).json({ error: 'Failed to fetch profile.' });
    }

    if (!results.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json(results[0]);
  });
});

app.put('/api/account/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const { name, email, phone_number } = req.body;

  const query = 'UPDATE login SET name = ?, email = ?, phone_number = ? WHERE id = ?';
  db.query(query, [name, email, phone_number || '', userId], (err) => {
    if (err) {
      console.error('Error updating account profile:', err);
      return res.status(500).json({ error: 'Failed to update profile.' });
    }

    return res.json({ message: 'Profile updated successfully.' });
  });
});

app.get('/api/account/orders/:userId', (req, res) => {
  const { userId } = req.params;

  const query = `
    SELECT
      o.new_id,
      o.buyerName,
      o.buyerPhoneNumber,
      o.buyerLocation,
      o.totalPrice,
      o.orderDate,
      o.status,
      o.delivery_partner_email,
      l.latitude AS riderLatitude,
      l.longitude AS riderLongitude,
      l.eta_minutes AS riderEtaMinutes,
      l.updated_at AS riderLocationUpdatedAt,
      oi.productName,
      oi.category,
      oi.quantity,
      oi.price,
      oi.totalPrice AS itemTotalPrice
    FROM orders o
    LEFT JOIN order_item oi ON oi.orderId = o.new_id
    LEFT JOIN delivery_live_locations l ON l.order_id = o.new_id
    WHERE o.user_id = ? OR o.customer_email = ?
    ORDER BY o.orderDate DESC, o.new_id DESC
  `;

  // Determine if userId is an integer or email
  const isNumeric = !isNaN(Number(userId));
  const numericId = isNumeric ? Number(userId) : 0;
  const emailParam = isNumeric ? null : userId;

  db.query(query, [numericId, emailParam], (err, results) => {
    if (err) {
      console.error('Error fetching account orders:', err);
      return res.status(500).json({ error: 'Failed to fetch orders.' });
    }

    const grouped = results.reduce((acc, row) => {
      if (!acc[row.new_id]) {
        acc[row.new_id] = {
          orderId: row.new_id,
          buyerName: row.buyerName,
          buyerPhoneNumber: row.buyerPhoneNumber,
          buyerLocation: row.buyerLocation,
          totalPrice: row.totalPrice,
          orderDate: row.orderDate,
          status: row.status,
          deliveryPartnerEmail: row.delivery_partner_email || null,
          riderLatitude: row.riderLatitude == null ? null : Number(row.riderLatitude),
          riderLongitude: row.riderLongitude == null ? null : Number(row.riderLongitude),
          riderEtaMinutes: row.riderEtaMinutes == null ? null : Number(row.riderEtaMinutes),
          riderLocationUpdatedAt: row.riderLocationUpdatedAt || null,
          items: []
        };
      }

      if (row.productName) {
        acc[row.new_id].items.push({
          productName: row.productName,
          category: row.category,
          quantity: row.quantity,
          price: row.price,
          itemTotalPrice: row.itemTotalPrice
        });
      }

      return acc;
    }, {});

    return res.json(Object.values(grouped));
  });
});

app.post('/api/account/orders/:orderId/cancel', (req, res) => {
  const { orderId } = req.params;
  const cancelQuery = 'UPDATE orders SET status = "cancelled" WHERE new_id = ? AND (status = "pending" OR status = "confirmed")';
  db.query(cancelQuery, [orderId], (err, result) => {
    if (err) {
      console.error('Error cancelling order:', err);
      return res.status(500).json({ error: 'Failed to cancel order.' });
    }
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Order cannot be cancelled at this stage or does not exist.' });
    }
    return res.json({ message: 'Order cancelled successfully.' });
  });
});

app.get('/api/account/addresses/:userId', (req, res) => {
  const { userId } = req.params;
  const query = 'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, updated_at DESC';

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching account addresses:', err);
      return res.status(500).json({ error: 'Failed to fetch addresses.' });
    }

    return res.json(results);
  });
});

app.post('/api/account/addresses/:userId', (req, res) => {
  const { userId } = req.params;
  const { label, recipient_name, phone_number, address_line, is_default } = req.body;

  const insertQuery = `
    INSERT INTO user_addresses (user_id, label, recipient_name, phone_number, address_line, is_default)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const makeDefault = Number(is_default) === 1;

  const performInsert = () => {
    db.query(
      insertQuery,
      [userId, label || 'Home', recipient_name, phone_number, address_line, makeDefault ? 1 : 0],
      (insertErr, result) => {
        if (insertErr) {
          console.error('Error creating address:', insertErr);
          return res.status(500).json({ error: 'Failed to add address.' });
        }

        return res.json({ message: 'Address added successfully.', id: result.insertId });
      }
    );
  };

  if (makeDefault) {
    db.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId], (updateErr) => {
      if (updateErr) {
        console.error('Error resetting default address:', updateErr);
        return res.status(500).json({ error: 'Failed to set default address.' });
      }
      performInsert();
    });
  } else {
    performInsert();
  }
});

app.put('/api/account/addresses/:userId/:addressId', (req, res) => {
  const { userId, addressId } = req.params;
  const { label, recipient_name, phone_number, address_line, is_default } = req.body;
  const makeDefault = Number(is_default) === 1;

  const runUpdate = () => {
    const updateQuery = `
      UPDATE user_addresses
      SET label = ?, recipient_name = ?, phone_number = ?, address_line = ?, is_default = ?
      WHERE id = ? AND user_id = ?
    `;

    db.query(
      updateQuery,
      [label || 'Home', recipient_name, phone_number, address_line, makeDefault ? 1 : 0, addressId, userId],
      (err) => {
        if (err) {
          console.error('Error updating address:', err);
          return res.status(500).json({ error: 'Failed to update address.' });
        }

        return res.json({ message: 'Address updated successfully.' });
      }
    );
  };

  if (makeDefault) {
    db.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId], (resetErr) => {
      if (resetErr) {
        console.error('Error resetting default address:', resetErr);
        return res.status(500).json({ error: 'Failed to set default address.' });
      }
      runUpdate();
    });
  } else {
    runUpdate();
  }
});

app.delete('/api/account/addresses/:userId/:addressId', (req, res) => {
  const { userId, addressId } = req.params;
  const query = 'DELETE FROM user_addresses WHERE id = ? AND user_id = ?';

  db.query(query, [addressId, userId], (err) => {
    if (err) {
      console.error('Error deleting address:', err);
      return res.status(500).json({ error: 'Failed to delete address.' });
    }

    return res.json({ message: 'Address deleted successfully.' });
  });
});

app.get('/api/account/wallet/:userId', (req, res) => {
  const { userId } = req.params;

  const seedWallet = () => {
    db.query('INSERT INTO user_wallet (user_id, balance) VALUES (?, 0)', [userId], (insertErr) => {
      if (insertErr) {
        console.error('Error seeding wallet:', insertErr);
        return res.status(500).json({ error: 'Failed to initialize wallet.' });
      }
      return res.json({ user_id: Number(userId), balance: 0 });
    });
  };

  db.query('SELECT user_id, balance FROM user_wallet WHERE user_id = ? LIMIT 1', [userId], (err, results) => {
    if (err) {
      console.error('Error fetching wallet:', err);
      return res.status(500).json({ error: 'Failed to fetch wallet.' });
    }

    if (!results.length) {
      return seedWallet();
    }

    return res.json(results[0]);
  });
});

app.post('/api/account/wallet/:userId/add', (req, res) => {
  const { userId } = req.params;
  const amount = Number(req.body.amount || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount.' });
  }

  const upsert = `
    INSERT INTO user_wallet (user_id, balance)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)
  `;

  db.query(upsert, [userId, amount], (err) => {
    if (err) {
      console.error('Error updating wallet balance:', err);
      return res.status(500).json({ error: 'Failed to add balance.' });
    }

    db.query('SELECT user_id, balance FROM user_wallet WHERE user_id = ? LIMIT 1', [userId], (fetchErr, rows) => {
      if (fetchErr) {
        console.error('Error fetching wallet after add:', fetchErr);
        return res.status(500).json({ error: 'Failed to fetch wallet.' });
      }
      return res.json(rows[0]);
    });
  });
});

app.get('/api/account/support/:userId', (req, res) => {
  const { userId } = req.params;
  const query = 'SELECT * FROM user_support_tickets WHERE user_id = ? ORDER BY updated_at DESC';

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching support tickets:', err);
      return res.status(500).json({ error: 'Failed to fetch support tickets.' });
    }

    return res.json(results);
  });
});

app.post('/api/account/support/:userId', (req, res) => {
  const { userId } = req.params;
  const { subject, message } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required.' });
  }

  const query = 'INSERT INTO user_support_tickets (user_id, subject, message) VALUES (?, ?, ?)';
  db.query(query, [userId, subject, message], (err, result) => {
    if (err) {
      console.error('Error creating support ticket:', err);
      return res.status(500).json({ error: 'Failed to create support ticket.' });
    }

    return res.json({ id: result.insertId, message: 'Support ticket created successfully.' });
  });
});

app.get('/api/account/referral/:userId', (req, res) => {
  const { userId } = req.params;

  const fetchQuery = 'SELECT * FROM user_referrals WHERE user_id = ? LIMIT 1';

  const generateCode = () => `FF${String(userId).padStart(4, '0')}REF`;

  db.query(fetchQuery, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching referral data:', err);
      return res.status(500).json({ error: 'Failed to fetch referral data.' });
    }

    if (results.length > 0) {
      return res.json(results[0]);
    }

    const insertQuery = 'INSERT INTO user_referrals (user_id, referral_code, invited_count, earnings) VALUES (?, ?, 0, 0)';
    const code = generateCode();

    db.query(insertQuery, [userId, code], (insertErr) => {
      if (insertErr) {
        console.error('Error creating referral profile:', insertErr);
        return res.status(500).json({ error: 'Failed to create referral profile.' });
      }
      return res.json({ user_id: Number(userId), referral_code: code, invited_count: 0, earnings: 0 });
    });
  });
});

app.post('/api/account/referral/:userId/mock-invite', (req, res) => {
  const { userId } = req.params;
  const rewardPerInvite = 20;

  const query = `
    UPDATE user_referrals
    SET invited_count = invited_count + 1,
        earnings = earnings + ?
    WHERE user_id = ?
  `;

  db.query(query, [rewardPerInvite, userId], (err) => {
    if (err) {
      console.error('Error applying referral invite:', err);
      return res.status(500).json({ error: 'Failed to apply referral invite.' });
    }

    db.query('SELECT * FROM user_referrals WHERE user_id = ? LIMIT 1', [userId], (fetchErr, rows) => {
      if (fetchErr) {
        console.error('Error fetching referral data after invite:', fetchErr);
        return res.status(500).json({ error: 'Failed to fetch referral data.' });
      }
      return res.json(rows[0]);
    });
  });
});

// // Define route to fetch total products
// app.get('/api/totalproducts', (req, res) => {
//   const query = 'SELECT COUNT(*) AS totalProducts FROM farmer_product';
//   db.query(query, (err, result) => {
//     if (err) {
//       console.error('Error fetching total products:', err);
//       res.status(500).json({ error: 'Error fetching total products' });
//       return;
//     }
//     if (result.length === 0 || result[0].totalProducts === null) {
//       res.status(404).json({ error: 'No products found' });
//       return;
//     }

//     // Log the fetched total products to the console
//     console.log('Total Products:', result[0].totalProducts);

//     // Send the total products as JSON response
//     res.json({ totalProducts: result[0].totalProducts });
//   });
// });




app.post('/api11/farmer/orders/:orderId/status', (req, res) => {
  const orderId = req.params.orderId;
  const newStatus = String(req.body.status || '').toLowerCase();
  const allowedStatuses = ['pending', 'confirmed', 'packed', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'];

  if (!allowedStatuses.includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  const query = `
    UPDATE orders
    SET status = ?
    WHERE new_id = ?;
  `;

  db.query('SELECT buyerName, totalPrice, customer_email FROM orders WHERE new_id = ? LIMIT 1', [orderId], (lookupError, rows) => {
    if (lookupError) {
      console.error('Error loading order for status update:', lookupError);
      return res.status(500).json({ error: 'Internal server error' });
    }

    db.query(query, [newStatus, orderId], async (error, results) => {
      if (error) {
        console.error('Error updating order status in database:', error);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }

      const order = rows?.[0];
      if (order?.customer_email) {
        await sendOrderStatusToCustomer({
          customerEmail: order.customer_email,
          buyerName: order.buyerName,
          orderId,
          totalPrice: order.totalPrice,
          status: newStatus,
          items: []
        });
      }

      if (newStatus === 'packed') {
        await triggerDeliveryPartnerOffers(orderId);
      }

      await emitOrderTrackingUpdate(orderId, { status: newStatus });

      res.json({ message: 'Order status updated successfully' });
    });
  });
});

app.get('/api/delivery-partners/:email/offers', async (req, res) => {
  const email = String(req.params.email || '').trim();
  if (!email) {
    return res.status(400).json({ error: 'Partner email is required.' });
  }

  try {
    const offers = await runQuery(
      `
      SELECT
        a.id,
        a.order_id,
        a.partner_email,
        a.partner_name,
        a.delivery_fee,
        a.assignment_status,
        o.buyerName,
        o.buyerPhoneNumber,
        o.buyerLocation,
        o.totalPrice,
        o.status AS order_status,
        COALESCE(SUM(oi.quantity), 0) AS total_quantity,
        CASE
          WHEN COALESCE(SUM(oi.quantity), 0) <= 5 THEN 'Two Wheeler'
          WHEN COALESCE(SUM(oi.quantity), 0) <= 12 THEN 'Three Wheeler'
          WHEN COALESCE(SUM(oi.quantity), 0) <= 24 THEN 'Four Wheeler'
          WHEN COALESCE(SUM(oi.quantity), 0) <= 40 THEN 'Six Wheeler'
          WHEN COALESCE(SUM(oi.quantity), 0) <= 80 THEN '12 Wheeler Truck'
          ELSE '14 Wheeler Truck'
        END AS required_vehicle_type,
        CASE
          WHEN COALESCE(SUM(oi.quantity), 0) <= 5 THEN 20
          WHEN COALESCE(SUM(oi.quantity), 0) <= 12 THEN 50
          WHEN COALESCE(SUM(oi.quantity), 0) <= 24 THEN 100
          WHEN COALESCE(SUM(oi.quantity), 0) <= 40 THEN 180
          WHEN COALESCE(SUM(oi.quantity), 0) <= 80 THEN 320
          ELSE 500
        END AS required_capacity_kg,
        l.latitude,
        l.longitude,
        l.eta_minutes,
        l.updated_at AS location_updated_at
      FROM delivery_order_assignments a
      JOIN orders o ON o.new_id = a.order_id
      LEFT JOIN order_item oi ON oi.orderId = o.new_id
      LEFT JOIN delivery_live_locations l ON l.order_id = o.new_id
      WHERE a.partner_email = ?
      GROUP BY a.id, a.order_id, a.partner_email, a.partner_name, a.delivery_fee, a.assignment_status,
               o.buyerName, o.buyerPhoneNumber, o.buyerLocation, o.totalPrice, o.status,
               l.latitude, l.longitude, l.eta_minutes, l.updated_at
      ORDER BY a.updated_at DESC, a.id DESC
      `,
      [email]
    );

    return res.json(offers);
  } catch (error) {
    console.error('Error fetching rider offers:', error);
    return res.status(500).json({ error: 'Failed to fetch rider offers.' });
  }
});

app.post('/api/delivery-partners/:email/offers/:assignmentId/accept', async (req, res) => {
  const email = String(req.params.email || '').trim();
  const assignmentId = Number(req.params.assignmentId || 0);

  if (!email || !assignmentId) {
    return res.status(400).json({ error: 'Partner email and assignment id are required.' });
  }

  try {
    const updateResult = await runQuery(
      `
      UPDATE delivery_order_assignments
      SET assignment_status = 'accepted', accepted_at = CURRENT_TIMESTAMP
      WHERE id = ? AND partner_email = ? AND assignment_status = 'offered'
      `,
      [assignmentId, email]
    );

    if (!updateResult.affectedRows) {
      return res.status(409).json({ error: 'Offer is no longer available.' });
    }

    const assignmentRows = await runQuery('SELECT order_id FROM delivery_order_assignments WHERE id = ? LIMIT 1', [assignmentId]);
    if (!assignmentRows.length) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    const orderId = assignmentRows[0].order_id;

    await runQuery(
      `
      UPDATE delivery_order_assignments
      SET assignment_status = 'rejected'
      WHERE order_id = ? AND id <> ? AND assignment_status = 'offered'
      `,
      [orderId, assignmentId]
    );

    await runQuery('UPDATE orders SET delivery_partner_email = ?, status = IF(status IN ("pending", "confirmed"), "confirmed", status) WHERE new_id = ?', [email, orderId]);

    await emitOrderTrackingUpdate(orderId, { deliveryPartnerEmail: email });

    return res.json({ message: 'Offer accepted successfully.', orderId });
  } catch (error) {
    console.error('Error accepting rider offer:', error);
    return res.status(500).json({ error: 'Failed to accept offer.' });
  }
});

app.post('/api/delivery-partners/:email/orders/:orderId/status', async (req, res) => {
  const email = String(req.params.email || '').trim();
  const orderId = Number(req.params.orderId || 0);
  const status = String(req.body.status || '').toLowerCase();
  const allowed = ['picked_up', 'out_for_delivery', 'delivered'];

  if (!email || !orderId || !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid rider status update request.' });
  }

  try {
    const assignment = await runQuery(
      `
      UPDATE delivery_order_assignments
      SET assignment_status = ?
      WHERE order_id = ? AND partner_email = ? AND assignment_status IN ('accepted', 'picked_up', 'out_for_delivery')
      `,
      [status, orderId, email]
    );

    if (!assignment.affectedRows) {
      return res.status(409).json({ error: 'No active accepted assignment found for this partner.' });
    }

    await runQuery('UPDATE orders SET status = ?, delivery_partner_email = ? WHERE new_id = ?', [status, email, orderId]);

    const orderRows = await runQuery('SELECT buyerName, totalPrice, customer_email FROM orders WHERE new_id = ? LIMIT 1', [orderId]);
    const order = orderRows?.[0];
    if (order?.customer_email) {
      await sendOrderStatusToCustomer({
        customerEmail: order.customer_email,
        buyerName: order.buyerName,
        orderId,
        totalPrice: order.totalPrice,
        status,
        items: []
      });
    }

    await emitOrderTrackingUpdate(orderId, { status, deliveryPartnerEmail: email });

    return res.json({ message: 'Rider status updated successfully.' });
  } catch (error) {
    console.error('Error updating rider status:', error);
    return res.status(500).json({ error: 'Failed to update rider status.' });
  }
});

app.post('/api/delivery-partners/:email/orders/:orderId/location', async (req, res) => {
  const email = String(req.params.email || '').trim();
  const orderId = Number(req.params.orderId || 0);
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const etaMinutes = req.body.etaMinutes == null ? null : Number(req.body.etaMinutes);

  if (!email || !orderId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: 'Invalid location payload.' });
  }

  try {
    await runQuery(
      `
      INSERT INTO delivery_live_locations (order_id, partner_email, latitude, longitude, eta_minutes)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        partner_email = VALUES(partner_email),
        latitude = VALUES(latitude),
        longitude = VALUES(longitude),
        eta_minutes = VALUES(eta_minutes)
      `,
      [orderId, email, latitude, longitude, Number.isFinite(etaMinutes) ? etaMinutes : null]
    );

    await emitOrderTrackingUpdate(orderId, {
      deliveryPartnerEmail: email,
      riderLatitude: latitude,
      riderLongitude: longitude,
      riderEtaMinutes: Number.isFinite(etaMinutes) ? etaMinutes : null,
      riderLocationUpdatedAt: new Date().toISOString()
    });

    return res.json({ message: 'Live location updated.' });
  } catch (error) {
    console.error('Error updating live location:', error);
    return res.status(500).json({ error: 'Failed to update live location.' });
  }
});

// Accept application (with optional document uploads)
app.post('/api/delivery-partners/apply', upload.fields([
  { name: 'rc_photo', maxCount: 1 },
  { name: 'license_photo', maxCount: 1 },
  { name: 'aadhaar_photo', maxCount: 1 },
  { name: 'owner_vehicle_photo', maxCount: 1 },
  { name: 'person_photo', maxCount: 1 }
]), async (req, res) => {
  const body = req.body || {};
  const files = req.files || {};

  const fullName = body.fullName || body.full_name;
  const email = body.email;
  const phoneNumber = body.phoneNumber || body.phone_number;
  const password = body.password || null; // password may be null for OAuth sign-ins
  const vehicleType = body.vehicleType || body.vehicle_type;
  const vehicleNumber = body.vehicleNumber || body.vehicle_number;
  const capacityKg = body.capacityKg || body.capacity_kg || 0;
  const rcNumber = body.rcNumber || body.rc_number;
  const licenseNumber = body.licenseNumber || body.license_number;
  const aadhaarNumber = body.aadhaarNumber || body.aadhaar_number;
  const serviceArea = body.serviceArea || body.service_area || '';
  const availability = body.availability || 'Full Time';

  if (!fullName || !email || !phoneNumber || !vehicleType || !vehicleNumber || !rcNumber || !licenseNumber || !aadhaarNumber || !serviceArea) {
    return res.status(400).json({ error: 'Please fill in required delivery partner fields.' });
  }

  const rcPhoto = files.rc_photo && files.rc_photo[0] ? files.rc_photo[0].filename : null;
  const licensePhoto = files.license_photo && files.license_photo[0] ? files.license_photo[0].filename : null;
  const aadhaarPhoto = files.aadhaar_photo && files.aadhaar_photo[0] ? files.aadhaar_photo[0].filename : null;
  const ownerVehiclePhoto = files.owner_vehicle_photo && files.owner_vehicle_photo[0] ? files.owner_vehicle_photo[0].filename : null;
  const personPhoto = files.person_photo && files.person_photo[0] ? files.person_photo[0].filename : null;

  const aadhaarNumberEncrypted = encryptAadhaar(aadhaarNumber);
  const maskedAadhaarNumber = maskAadhaar(aadhaarNumber);

  const insertSql = `
    INSERT INTO delivery_partner_applications
    (full_name, email, phone_number, password, vehicle_type, vehicle_number, capacity_kg, rc_number, license_number, aadhaar_number, aadhaar_number_encrypted, rc_photo, license_photo, aadhaar_photo, owner_vehicle_photo, person_photo, service_area, availability, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(insertSql, [fullName, email, phoneNumber, password || '', vehicleType, vehicleNumber, capacityKg, rcNumber, licenseNumber, maskedAadhaarNumber, aadhaarNumberEncrypted, rcPhoto, licensePhoto, aadhaarPhoto, ownerVehiclePhoto, personPhoto, serviceArea, availability, 'Pending'], async (err, result) => {
    if (err) {
      console.error('Error storing delivery partner application:', err);
      return res.status(500).json({ error: 'Failed to submit delivery partner application.' });
    }

    try {
      await sendAppEmail({
        to: email,
        subject: 'FreshFarm delivery partner application received',
        text: `Hello ${fullName},\n\nWe received your delivery partner application. Our team will review your vehicle and document details and get back to you soon.\n\nThank you for choosing FreshFarm.`,
        html: `<p>Hello ${fullName},</p><p>We received your delivery partner application. Our team will review your vehicle and document details and get back to you soon.</p><p>Thank you for choosing FreshFarm.</p>`
      });
    } catch (e) {
      console.warn('Failed to send confirmation email:', e && e.message);
    }

    return res.status(200).json({ message: 'Delivery partner application submitted successfully.' });
  });
});

app.get('/api/delivery-partners/:email', (req, res) => {
  const { email } = req.params;
  const sql = 'SELECT * FROM delivery_partner_applications WHERE email = ? LIMIT 1';
  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (results.length === 0) return res.status(404).json({ error: 'Partner not found.' });
    res.json(results[0]);
  });
});

app.put('/api/delivery-partners/:email', (req, res) => {
  const { email } = req.params;
  const {
    fullName,
    phoneNumber,
    vehicleType,
    vehicleNumber,
    capacityKg,
    rcNumber,
    licenseNumber,
    aadhaarNumber,
    serviceArea,
    availability,
    isOnline
  } = req.body;

  const updateFields = [];
  const values = [];

  if (fullName) { updateFields.push('full_name = ?'); values.push(fullName); }
  if (phoneNumber) { updateFields.push('phone_number = ?'); values.push(phoneNumber); }
  if (vehicleType) { updateFields.push('vehicle_type = ?'); values.push(vehicleType); }
  if (vehicleNumber) { updateFields.push('vehicle_number = ?'); values.push(vehicleNumber); }
  if (capacityKg) { updateFields.push('capacity_kg = ?'); values.push(capacityKg); }
  if (rcNumber) { updateFields.push('rc_number = ?'); values.push(rcNumber); }
  if (licenseNumber) { updateFields.push('license_number = ?'); values.push(licenseNumber); }
  if (aadhaarNumber) {
    updateFields.push('aadhaar_number = ?');
    values.push(maskAadhaar(aadhaarNumber));
    updateFields.push('aadhaar_number_encrypted = ?');
    values.push(encryptAadhaar(aadhaarNumber));
  }
  if (serviceArea) { updateFields.push('service_area = ?'); values.push(serviceArea); }
  if (availability) { updateFields.push('availability = ?'); values.push(availability); }
  if (isOnline !== undefined) { updateFields.push('is_online = ?'); values.push(isOnline ? 1 : 0); }

  if (updateFields.length === 0) return res.status(400).json({ error: 'No fields to update.' });

  const sql = `UPDATE delivery_partner_applications SET ${updateFields.join(', ')} WHERE email = ?`;
  values.push(email);

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error updating partner profile:', err);
      return res.status(500).json({ error: 'Failed to update profile.' });
    }
    res.json({ message: 'Profile updated successfully.' });
  });
});

// Endpoint to upload/update documents/photos for an existing partner and update profile fields
app.post('/api/delivery-partners/:email/upload-docs', upload.fields([
  { name: 'rc_photo', maxCount: 1 },
  { name: 'license_photo', maxCount: 1 },
  { name: 'aadhaar_photo', maxCount: 1 },
  { name: 'owner_vehicle_photo', maxCount: 1 },
  { name: 'person_photo', maxCount: 1 }
]), (req, res) => {
  const { email } = req.params;
  const body = req.body || {};
  const files = req.files || {};

  const updateFields = [];
  const values = [];

  const mapField = (bodyKey, column) => {
    if (body[bodyKey] !== undefined) {
      updateFields.push(`${column} = ?`);
      values.push(body[bodyKey]);
    }
  };

  mapField('fullName', 'full_name');
  mapField('phoneNumber', 'phone_number');
  mapField('vehicleType', 'vehicle_type');
  mapField('vehicleNumber', 'vehicle_number');
  mapField('capacityKg', 'capacity_kg');
  mapField('rcNumber', 'rc_number');
  mapField('licenseNumber', 'license_number');
  mapField('serviceArea', 'service_area');
  mapField('availability', 'availability');

  if (files.rc_photo && files.rc_photo[0]) { updateFields.push('rc_photo = ?'); values.push(files.rc_photo[0].filename); }
  if (files.license_photo && files.license_photo[0]) { updateFields.push('license_photo = ?'); values.push(files.license_photo[0].filename); }
  if (files.aadhaar_photo && files.aadhaar_photo[0]) { updateFields.push('aadhaar_photo = ?'); values.push(files.aadhaar_photo[0].filename); }
  if (files.owner_vehicle_photo && files.owner_vehicle_photo[0]) { updateFields.push('owner_vehicle_photo = ?'); values.push(files.owner_vehicle_photo[0].filename); }
  if (files.person_photo && files.person_photo[0]) { updateFields.push('person_photo = ?'); values.push(files.person_photo[0].filename); }

  if (body.aadhaarNumber || body.aadhaar_number) {
    const aadhaarNumber = body.aadhaarNumber || body.aadhaar_number;
    updateFields.push('aadhaar_number = ?');
    values.push(maskAadhaar(aadhaarNumber));
    updateFields.push('aadhaar_number_encrypted = ?');
    values.push(encryptAadhaar(aadhaarNumber));
  }

  if (updateFields.length === 0) return res.status(400).json({ error: 'No fields or files provided to update.' });

  const sql = `UPDATE delivery_partner_applications SET ${updateFields.join(', ')} WHERE email = ?`;
  values.push(email);

  db.query(sql, values, (err) => {
    if (err) {
      console.error('Error updating partner documents:', err);
      return res.status(500).json({ error: 'Failed to update documents.' });
    }
    res.json({ message: 'Profile and documents updated.' });
  });
});

// Endpoint to handle form submission
app.post('/submit-inquiry', (req, res) => {
  const { firstName, lastName, contactNumber, email, message } = req.body;
  
  const sql = `INSERT INTO user_inquiries (firstName, lastName, contactNumber, email, message) VALUES (?, ?, ?, ?, ?)`;
  db.query(sql, [firstName, lastName, contactNumber, email, message], (err, result) => {
    if (err) {
      console.error('Error storing inquiry:', err);
      return res.status(500).json({ error: 'An error occurred while processing your request' });
    }
    console.log('Inquiry stored successfully');
    res.status(200).json({ message: 'Inquiry stored successfully' });
  });
});

// Endpoint to fetch inquiries
app.get('/get-inquiries', (req, res) => {
  const sql = 'SELECT id, firstName, lastName, contactNumber, email, message FROM user_inquiries';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching inquiries:', err);
      return res.status(500).json({ error: 'An error occurred while fetching inquiries' });
    }
    res.status(200).json(results);
  });
});

// Endpoint to handle form submission
app.post('/submit-inquiry', (req, res) => {
  const { firstName, lastName, contactNumber, email, message } = req.body;
  
  const sql = `INSERT INTO user_inquiries (firstName, lastName, contactNumber, email, message) VALUES (?, ?, ?, ?, ?)`;
  db.query(sql, [firstName, lastName, contactNumber, email, message], (err, result) => {
    if (err) {
      console.error('Error storing inquiry:', err);
      return res.status(500).json({ error: 'An error occurred while processing your request' });
    }
    console.log('Inquiry stored successfully');
    res.status(200).json({ message: 'Inquiry stored successfully' });
  });
});

// Define route to fetch total data for admin dashboard
app.get('/api/admintotaldata', (req, res) => {
  console.log('Request received for /api/admintotaldata'); // Add a debug statement

  const totalProductsQuery = 'SELECT COUNT(*) AS totalProducts FROM farmer_product';
  console.log('Executing total products query:', totalProductsQuery); // Add a debug statement

  const totalInventoryQuery = 'SELECT SUM(quantity) AS totalInventory FROM farmer_product';
  console.log('Executing total inventory query:', totalInventoryQuery); // Add a debug statement

  const totalOrdersQuery = 'SELECT COUNT(*) AS totalOrders FROM orders';
  console.log('Executing total orders query:', totalOrdersQuery); // Add a debug statement

  const totalFarmersQuery = 'SELECT COUNT(*) AS totalFarmers FROM farmer';
  console.log('Executing total farmers query:', totalFarmersQuery); // Add a debug statement

  const totalUsersQuery = 'SELECT COUNT(*) AS totalUsers FROM login';
  console.log('Executing total users query:', totalUsersQuery); // Add a debug statement

  const totalSalesQuery = 'SELECT SUM(totalPrice) AS totalSales FROM orders';
  console.log('Executing total sales query:', totalSalesQuery); // Debug statement



  // Add queries for total inventory and total sales if applicable

  const queries = [
    totalProductsQuery,
    totalInventoryQuery,
    totalOrdersQuery,
    totalFarmersQuery,
    totalUsersQuery,
    totalSalesQuery
    // Add more queries as needed
  ];

  let responseData = {};

  Promise.all(queries.map(query => {
    return new Promise((resolve, reject) => {
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result[0]);
      });
    });
  }))
  .then(results => {
    responseData = {
      totalProducts: results[0].totalProducts,
      totalInventory: results[1].totalInventory,
      totalOrders: results[2].totalOrders,
      totalFarmers: results[3].totalFarmers,
      totalUsers: results[4].totalUsers,
      totalSales: results[5].totalSales
      // Add more properties to responseData as needed
    };
    res.json(responseData);
  })
  .catch(error => {
    console.error('Error fetching total admin data:', error);
    res.status(500).json({ error: 'Error fetching total admin data' });
  });
});

      



// Example protected route
app.get("/protected", verifyToken, (req, res) => {
    const userId = req.user.userId; // Accessing user ID from decoded token payload
    res.json({ message: 'This is a protected route!', userId });
});


const port = process.env.PORT || 8081;

app.post('/api/orders/:orderId/trigger-rider-offers', async (req, res) => {
  const { orderId } = req.params;
  try {
    await triggerDeliveryPartnerOffers(orderId);
    res.json({ message: 'Rider offers triggered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/:orderId/assignment', (req, res) => {
  const { orderId } = req.params;
  db.query(
    `
    SELECT 
      da.*,
      dp.current_lat, dp.current_lng, dp.phone_number, dp.vehicle_number, dp.vehicle_type
    FROM delivery_order_assignments da
    JOIN delivery_partner_applications dp ON da.partner_email = dp.email
    WHERE da.order_id = ? AND da.assignment_status = 'accepted'
    LIMIT 1
    `,
    [orderId],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results[0] || null);
    }
  );
});

app.post('/api/chats', (req, res) => {
  const { orderId, senderRole, message } = req.body;
  if (!orderId || !senderRole || !message) {
    return res.status(400).json({ error: 'Order ID, role, and message are required.' });
  }

  const sql = 'INSERT INTO order_chats (order_id, sender_role, message) VALUES (?, ?, ?)';
  db.query(sql, [orderId, senderRole, message], (err, result) => {
    if (err) {
      console.error('Error saving chat:', err);
      return res.status(500).json({ error: 'Failed to send message.' });
    }
    res.json({ id: result.insertId, message: 'Message sent.' });
  });
});

app.get('/api/chats/:orderId', (req, res) => {
  const { orderId } = req.params;
  const sql = 'SELECT * FROM order_chats WHERE order_id = ? ORDER BY created_at ASC';
  db.query(sql, [orderId], (err, results) => {
    if (err) {
      console.error('Error fetching chats:', err);
      return res.status(500).json({ error: 'Failed to fetch messages.' });
    }
    res.json(results);
  });
});

app.post('/api/delivery-partners/:email/location', (req, res) => {
  const { email } = req.params;
  const { latitude, longitude } = req.body;
  
  db.query(
    'UPDATE delivery_partner_applications SET current_lat = ?, current_lng = ? WHERE email = ?',
    [latitude, longitude, email],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Location updated' });
    }
  );
});

app.get('/api/delivery-partners/:email', (req, res) => {
  const { email } = req.params;
  db.query('SELECT * FROM delivery_partner_applications WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Partner not found' });
    const partner = { ...results[0] };
    if (partner.aadhaar_number_encrypted) {
      partner.aadhaar_number = maskAadhaar(partner.aadhaar_number);
    }
    res.json(partner);
  });
});

app.put('/api/delivery-partners/:email', (req, res) => {
  const { email } = req.params;
  const { fullName, phoneNumber, vehicleType, vehicleNumber, capacityKg, rcNumber, licenseNumber, aadhaarNumber, serviceArea, availability } = req.body;
  
  const sql = `
    UPDATE delivery_partner_applications SET 
      full_name = ?, phone_number = ?, vehicle_type = ?, vehicle_number = ?, 
      capacity_kg = ?, rc_number = ?, license_number = ?, aadhaar_number = ?, 
      service_area = ?, availability = ?
    WHERE email = ?
  `;
  const params = [fullName, phoneNumber, vehicleType, vehicleNumber, capacityKg, rcNumber, licenseNumber, aadhaarNumber, serviceArea, availability, email];
  
  db.query(sql, params, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Profile updated' });
  });
});

app.post('/api/delivery-partners/:email/online', (req, res) => {
  const { email } = req.params;
  const { isOnline } = req.body;
  db.query('UPDATE delivery_partner_applications SET is_online = ? WHERE email = ?', [isOnline ? 1 : 0, email], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Online status updated' });
  });
});

app.get('/api/delivery-partners/:email/offers', (req, res) => {
  const { email } = req.params;
  db.query(
    `
    SELECT da.*, o.buyerLocation, o.totalPrice, o.status as order_status
    FROM delivery_order_assignments da
    JOIN orders o ON da.order_id = o.new_id
    WHERE da.partner_email = ? AND da.assignment_status = 'offered'
    `,
    [email],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

app.post('/api/orders/:orderId/accept', (req, res) => {
  const { orderId } = req.params;
  const { partnerEmail } = req.body;
  
  db.query(
    'UPDATE delivery_order_assignments SET assignment_status = "accepted" WHERE order_id = ? AND partner_email = ?',
    [orderId, partnerEmail],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Offer accepted' });
    }
  );
});

app.get('/api/delivery-partners/online', (req, res) => {
  db.query(
    'SELECT full_name, email, phone_number, vehicle_type, vehicle_number, current_lat, current_lng FROM delivery_partner_applications WHERE is_online = 1',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// Admin-only: list delivery partner applications (basic fields)
app.get('/api/admin/delivery-partners', verifyToken, (req, res) => {
  const requester = req.user || {};
  if (!requester.isAdmin) return res.status(403).json({ error: 'Admin access required.' });

  const sql = `SELECT id, full_name, email, phone_number, vehicle_type, vehicle_number, rc_photo, license_photo, aadhaar_photo, owner_vehicle_photo, person_photo, status, is_online, created_at FROM delivery_partner_applications ORDER BY created_at DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results || []);
  });
});

// Admin-only: change partner status (approve/reject)
app.post('/api/admin/delivery-partners/:email/status', verifyToken, async (req, res) => {
  try {
    const requester = req.user || {};
    if (!requester.isAdmin) return res.status(403).json({ error: 'Admin access required.' });

    const partnerEmail = req.params.email;
    const { status } = req.body || {};
    if (!partnerEmail || !status) return res.status(400).json({ error: 'email and status required' });

    const allowed = ['approved', 'rejected', 'pending'];
    if (!allowed.includes(String(status).toLowerCase())) return res.status(400).json({ error: 'invalid status' });

    // fetch partner row for notification
    let partnerRow = null;
    try {
      const rows = await queryAsync('SELECT full_name, email FROM delivery_partner_applications WHERE email = ? LIMIT 1', [partnerEmail]);
      partnerRow = rows && rows[0];
    } catch (fetchErr) {
      console.error('Failed to fetch partner row for notification:', fetchErr.message);
    }

    await queryAsync('UPDATE delivery_partner_applications SET status = ?, is_online = 0 WHERE email = ?', [String(status).toLowerCase(), partnerEmail]);

    // audit
    try {
      await queryAsync('INSERT INTO admin_aadhaar_access_logs (admin_email, partner_email, action) VALUES (?, ?, ?)', [requester.email || 'unknown', partnerEmail, `status:${status}`]);
    } catch (logErr) {
      console.error('Failed to write admin action log:', logErr.message);
    }

    // send notification email to partner (if available)
    try {
      if (partnerRow && partnerRow.email) {
        const subject = `Your FreshFarm delivery partner application has been ${String(status).toLowerCase()}`;
        const name = partnerRow.full_name || 'Partner';
        const text = `Hello ${name},\n\nYour delivery partner application status is now: ${status}.\n\nIf you have questions, contact support.`;
        const html = `<p>Hello ${name},</p><p>Your delivery partner application status is now: <b>${status}</b>.</p><p>If you have questions, contact support.</p>`;
        await sendAppEmail({ to: partnerRow.email, subject, text, html });
      }
    } catch (emailErr) {
      console.error('Failed to send partner status email:', emailErr.message);
    }

    return res.json({ message: 'Status updated' });
  } catch (err) {
    console.error('Admin change status error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
