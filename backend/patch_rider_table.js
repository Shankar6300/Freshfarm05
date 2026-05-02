import mysql from 'mysql2/promise';
import 'dotenv/config';

async function patchTable() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'Signup',
            port: 3306
        });
        
        try {
            await connection.query('ALTER TABLE delivery_partner_applications ADD COLUMN is_online TINYINT(1) DEFAULT 0 AFTER status');
            console.log('Added is_online column.');
        } catch (e) {
            console.log('is_online column might already exist.');
        }

        await connection.end();
    } catch (err) {
        console.error('Patch failed:', err.message);
    }
}

patchTable();
