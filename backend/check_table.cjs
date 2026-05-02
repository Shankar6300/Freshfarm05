const mysql = require('mysql2');
require('dotenv').config({ path: './backend/.env' });

const db = mysql.createConnection({
    host: process.env.MYSQLHOST || "localhost",
    user: process.env.MYSQLUSER || "root",
    password: process.env.MYSQLPASSWORD || "",
    database: process.env.MYSQL_DATABASE || "Signup",
    port: process.env.MYSQLPORT || 3306
});

db.query('DESCRIBE delivery_partner_applications', (err, results) => {
    if (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
    console.log(JSON.stringify(results, null, 2));
    db.end();
});
