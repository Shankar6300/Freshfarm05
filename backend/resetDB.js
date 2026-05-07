import mysql from 'mysql2/promise';

async function resetDB() {
    try {
        const conn = await mysql.createConnection({
            host: 'freshfarm-db.cr080qyq2nar.ap-south-2.rds.amazonaws.com',
            user: 'admin',
            password: 'Freshfarm6300783770',
            database: 'freshfarm-db'
        });
        
        await conn.query('DELETE FROM login');
        await conn.query('DELETE FROM farmer');
        await conn.query('DELETE FROM delivery_partner_applications');
        
        console.log('Database reset: All test users, farmers, and riders have been deleted.');

        await conn.end();
    } catch(e) {
        console.error(e);
    }
}
resetDB();
