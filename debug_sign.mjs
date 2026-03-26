import https from 'https';
import crypto from 'crypto';

function generateSign(partnerId, partnerKey, apiPath, timestamp) {
    const baseString = `${partnerId}${apiPath}${timestamp}`;
    console.log('Base string:', baseString);
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

// Pegar VPS settings
https.get('https://api.xiaomipetrolina.com.br/company-settings', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const settings = JSON.parse(data);
        const partnerId = String(settings.shopee_partner_id || '');
        const partnerKey = String(settings.shopee_partner_key || '');
        
        console.log('--- VPS Settings ---');
        console.log('Partner ID:', partnerId);
        console.log('Partner Key (first 10 chars):', partnerKey.substring(0, 10));
        console.log('Partner Key length:', partnerKey.length);
        console.log('');

        if (!partnerId || !partnerKey) {
            console.log('ERRO: Chaves da Shopee não encontradas no VPS!');
            return;
        }
        
        const apiPath = '/api/v2/auth/token/get';
        const timestamp = Math.floor(Date.now() / 1000);
        const sign = generateSign(partnerId, partnerKey, apiPath, timestamp);
        
        console.log('--- Signature ---');
        console.log('Timestamp:', timestamp);
        console.log('API Path:', apiPath);
        console.log('Sign:', sign);
        console.log('');

        const isSandbox = partnerId === '1229870';
        const baseUrl = isSandbox 
            ? 'https://partner.test-stable.shopeemobile.com' 
            : 'https://partner.shopeemobile.com';
        
        console.log('Environment:', isSandbox ? 'SANDBOX' : 'PRODUCTION');
        console.log('URL seria:', `${baseUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`);
    });
});
