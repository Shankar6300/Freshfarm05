import mysql from 'mysql2/promise';

async function setupLocalDB() {
    try {
        console.log('Setting up local Signup database...');
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            port: 3306
        });
        await connection.query('CREATE DATABASE IF NOT EXISTS Signup');
        console.log('Database Signup is ready!');
        await connection.end();
    } catch (err) {
        console.error('Setup failed:', err.message);
    }
}

setupLocalDB();
