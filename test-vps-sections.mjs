import fetch from 'node-fetch';

async function testVps() {
    console.log('Fetching products the exact same way catalogSectionsService does...');
    const url = 'https://api.xiaomipetrolina.com.br/products?limit=10&sort_by=created_at&sort_direction=desc';
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log(`Returned data type: ${Array.isArray(data) ? 'Array' : typeof data}`);
        console.log(`Length: ${Array.isArray(data) ? data.length : 'N/A'}`);
        if (Array.isArray(data) && data.length > 0) {
            console.log('Sample item:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('Data object:', data);
        }
    } catch (e) {
        console.error('Error fetching:', e);
    }
}

testVps();
