import fetch from 'node-fetch';

async function test() {
    console.log("Fetching correct ID 16226613623...");
    const res = await fetch('https://mercadodovale.com.br/api/bling?resource=product-detail&id=16226613623');
    console.log("Status:", res.status);
    const text = await res.text();
    console.log(text.substring(0, 500));
}
test().catch(console.error);
