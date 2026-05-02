import mysql from 'mysql2/promise';
import 'dotenv/config';

async function test() {
    try {
        console.log('Testing connection to:', process.env.MYSQLHOST);
        const connection = await mysql.createConnection({
            host: process.env.MYSQLHOST,
            user: process.env.MYSQLUSER,
            password: process.env.MYSQLPASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: process.env.MYSQLPORT
        });
        console.log('Successfully connected!');
        await connection.end();
    } catch (err) {
        console.error('Connection failed:', err);
    }
}

test();
