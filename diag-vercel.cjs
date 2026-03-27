async function testVercel() {
    const r = await fetch('https://mercadodovale.com.br/api/shopee-actions?action=refresh_token');
    const txt = await r.text();
    console.log("Status:", r.status);
    console.log("Body:", txt);
}
testVercel();
