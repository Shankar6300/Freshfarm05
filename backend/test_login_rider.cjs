async function testLogin() {
    try {
        const response = await fetch('http://localhost:8081/api/delivery-partners/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'testrider@freshfarm.com', password: 'password123' })
        });
        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testLogin();
