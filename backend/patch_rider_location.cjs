const mysql = require('mysql');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'Signup'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');

  const addLocationColumns = `
    ALTER TABLE delivery_partner_applications 
    ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10,8) NULL,
    ADD COLUMN IF NOT EXISTS current_lng DECIMAL(11,8) NULL
  `;

  db.query(addLocationColumns, (err, result) => {
    if (err) {
      console.error('Error adding location columns:', err);
    } else {
      console.log('Location columns verified/added.');
    }
    db.end();
  });
});
