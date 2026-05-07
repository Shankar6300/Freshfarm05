import mysql from 'mysql2/promise';

async function fix() {
    try {
        const connection = await mysql.createConnection({
            host: 'freshfarm-db.cr080qyq2nar.ap-south-2.rds.amazonaws.com',
            user: 'admin',
            password: 'Freshfarm6300783770',
            database: 'freshfarm-db',
            multipleStatements: true
        });

        console.log('Creating missing tables...');
        const sql = `
        CREATE TABLE IF NOT EXISTS user_addresses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            label VARCHAR(80) DEFAULT 'Home',
            address_line VARCHAR(255) NOT NULL,
            city VARCHAR(100) NOT NULL,
            state VARCHAR(100) NOT NULL,
            zip_code VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_wallet (
            user_id INT PRIMARY KEY,
            balance DECIMAL(12,2) NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_support_tickets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            subject VARCHAR(255) NOT NULL,
            status VARCHAR(40) DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_referrals (
            user_id INT PRIMARY KEY,
            referral_code VARCHAR(32) NOT NULL UNIQUE,
            referred_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

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
            current_lat DECIMAL(10,8) DEFAULT NULL,
            current_lng DECIMAL(11,8) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_chats (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            sender_role VARCHAR(40) NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS delivery_order_assignments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            partner_email VARCHAR(255) NOT NULL,
            assignment_status VARCHAR(40) DEFAULT 'offered',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS delivery_live_locations (
            order_id INT PRIMARY KEY,
            partner_email VARCHAR(255) NOT NULL,
            lat DECIMAL(10,8) NOT NULL,
            lng DECIMAL(11,8) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS admin_aadhaar_access_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            admin_email VARCHAR(255) NOT NULL,
            partner_email VARCHAR(255) NOT NULL,
            action VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `;
        await connection.query(sql);
        console.log('Tables created successfully!');
        await connection.end();
    } catch(e) {
        console.error(e);
    }
}
fix();
