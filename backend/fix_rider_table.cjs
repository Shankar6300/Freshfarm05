const mysql = require('mysql2');
require('dotenv').config({ path: './backend/.env' });

const db = mysql.createConnection({
    host: process.env.MYSQLHOST || "localhost",
    user: process.env.MYSQLUSER || "root",
    password: process.env.MYSQLPASSWORD || "",
    database: process.env.MYSQL_DATABASE || "Signup",
    port: process.env.MYSQLPORT || 3306
});

const alterQueries = [
    "ALTER TABLE delivery_partner_applications ADD COLUMN IF NOT EXISTS password VARCHAR(255) NOT NULL AFTER phone_number;",
    "ALTER TABLE delivery_partner_applications MODIFY COLUMN vehicle_type VARCHAR(120) NULL;",
    "ALTER TABLE delivery_partner_applications MODIFY COLUMN vehicle_number VARCHAR(80) NULL;",
    "ALTER TABLE delivery_partner_applications MODIFY COLUMN rc_number VARCHAR(120) NULL;",
    "ALTER TABLE delivery_partner_applications MODIFY COLUMN license_number VARCHAR(120) NULL;",
    "ALTER TABLE delivery_partner_applications MODIFY COLUMN aadhaar_number VARCHAR(120) NULL;",
    "ALTER TABLE delivery_partner_applications MODIFY COLUMN service_area VARCHAR(255) NULL;",
    "ALTER TABLE delivery_partner_applications MODIFY COLUMN availability VARCHAR(120) NULL;"
];

const runQueries = async () => {
    for (const sql of alterQueries) {
        try {
            await new Promise((resolve, reject) => {
                db.query(sql, (err) => {
                    if (err) {
                        // Ignore "Duplicate column name" error if IF NOT EXISTS fails for some reason
                        if (err.code === 'ER_DUP_FIELDNAME') {
                            resolve();
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve();
                    }
                });
            });
            console.log('Executed:', sql.substring(0, 50) + '...');
        } catch (err) {
            console.error('Error executing query:', err.message);
        }
    }
    db.end();
};

runQueries();
