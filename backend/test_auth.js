async function test() {
    try {
        const fetch = (await import('node-fetch')).default;
        const res = await fetch('https://d2pskbh3g9o3pk.cloudfront.net/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'newfarmer3@test.com',
                name: 'New Farmer',
                role: 'farmer',
                googleId: '123456789'
            })
        });
        const data = await res.json();
        console.log(data);
    } catch(e) {
        console.error(e);
    }
}
test();
