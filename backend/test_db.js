import mysql from 'mysql2/promise';

async function test() {
    try {
        const connection = await mysql.createConnection({
            host: 'freshfarm-db.cr080qyq2nar.ap-south-2.rds.amazonaws.com',
            user: 'admin',
            password: 'Freshfarm6300783770',
            database: 'freshfarm-db'
        });
        
        try {
            await connection.query('SELECT * FROM admins WHERE email = "test@test.com"');
            console.log('admins query success');
        } catch (e) {
            console.error('admins table error:', e.message);
        }

        try {
            await connection.query('SELECT * FROM farmer WHERE email = "test@test.com"');
            console.log('farmer query success');
        } catch (e) {
            console.error('farmer table error:', e.message);
        }

        try {
            await connection.query('SELECT * FROM login WHERE email = "test@test.com"');
            console.log('login query success');
        } catch (e) {
            console.error('login table error:', e.message);
        }
        
        try {
            await connection.query('SELECT * FROM delivery_partner_applications WHERE email = "test@test.com"');
            console.log('delivery query success');
        } catch (e) {
            console.error('delivery table error:', e.message);
        }

        await connection.end();
    } catch(e) {
        console.error('Connection error:', e.message);
    }
}
test();
