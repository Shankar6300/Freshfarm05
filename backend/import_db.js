import fs from 'fs';
import mysql from 'mysql2/promise';

async function run() {
    try {
        console.log('Connecting to RDS...');
        const connection = await mysql.createConnection({
            host: 'freshfarm-db.cr080qyq2nar.ap-south-2.rds.amazonaws.com',
            user: 'admin',
            password: 'Freshfarm6300783770',
            multipleStatements: true
        });

        console.log('Connected. Creating database if not exists...');
        await connection.query('CREATE DATABASE IF NOT EXISTS `freshfarm-db`;');
        await connection.query('USE `freshfarm-db`;');

        console.log('Reading Signup.sql...');
        const sql = fs.readFileSync('../Signup.sql', 'utf8');

        console.log('Executing SQL file...');
        await connection.query(sql);

        console.log('Successfully imported all tables!');
        await connection.end();
    } catch (e) {
        console.error('Error:', e);
    }
}
run();
