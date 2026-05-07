import mysql from 'mysql2/promise';

async function fixUser() {
    try {
        const conn = await mysql.createConnection({
            host: 'freshfarm-db.cr080qyq2nar.ap-south-2.rds.amazonaws.com',
            user: 'admin',
            password: 'Freshfarm6300783770',
            database: 'freshfarm-db'
        });
        
        // Add specific emails to the farmer table so they always log in as a farmer
        const emailsToFix = [
            'shankarnarayanareddy196@gmail.com',
            'goddetijagadesh@gmail.com',
            'valmiki1961003@gmail.com',
            'linkloot196@gmail.com'
        ];

        for (const email of emailsToFix) {
            try {
                await conn.query('INSERT IGNORE INTO farmer (fullName, email, phoneNumber, farmName, farmerAddress, password) VALUES (?, ?, ?, ?, ?, ?)', 
                ['Google Farmer', email, '0000000000', 'My Google Farm', 'Farm Address', 'GOOGLE_AUTH_USER']);
                console.log('Added to farmer table:', email);
            } catch (e) {
                console.log('Already in farmer table:', email);
            }
        }

        await conn.end();
    } catch(e) {
        console.error(e);
    }
}
fixUser();
