import https from 'https';

https.get('https://api.xiaomipetrolina.com.br/company-settings', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const settings = JSON.parse(data);
        console.log('VPS Shopee ID:', settings.shopee_partner_id);
        console.log('VPS Shopee Key Length:', settings.shopee_partner_key ? settings.shopee_partner_key.length : 0);
        console.log('VPS Shopee Key:', settings.shopee_partner_key);
    });
});
