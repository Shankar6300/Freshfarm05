import mysql from 'mysql2/promise';

async function testLocal() {
    try {
        console.log('Testing connection to local MySQL (3306)...');
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            port: 3306
        });
        console.log('Successfully connected to local MySQL!');
        await connection.end();
    } catch (err) {
        console.error('Local connection failed:', err.message);
    }
}

testLocal();
