import mysql from 'mysql2/promise';

async function reset() {
    try {
        const connection = await mysql.createConnection({
            host: 'freshfarm-db.cr080qyq2nar.ap-south-2.rds.amazonaws.com',
            user: 'admin',
            password: 'Freshfarm6300783770',
            database: 'freshfarm-db'
        });
        
        await connection.query('DELETE FROM login');
        console.log('Successfully cleared the Customer table.');
        await connection.end();
    } catch(e) {
        console.error(e);
    }
}
reset();
