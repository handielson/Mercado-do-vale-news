// Teste simplificado - chave hardcoded direto
import https from 'https';
import crypto from 'crypto';

// Chave obtida diretamente do painel Shopee via browser
const HARDCODED_KEY = 'shpk45434a69786d53566659686c634d6254796f556956517347454c47754e45';
const partnerId = '1229870';
const apiPath = '/api/v2/auth/token/get';
const timestamp = Math.floor(Date.now() / 1000);

const base = `${partnerId}${apiPath}${timestamp}`;
const sign = crypto.createHmac('sha256', HARDCODED_KEY).update(base).digest('hex');

console.log('Base String:', base);
console.log('Sign:', sign);
console.log('URL:', `https://partner.test-stable.shopeemobile.com${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`);

const postData = JSON.stringify({ code: 'FAKE_CODE', shop_id: 0, partner_id: Number(partnerId) });
const urlObj = new URL(`https://partner.test-stable.shopeemobile.com${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`);

const req = https.request({
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
}, (res) => {
    let r = '';
    res.on('data', d => r += d);
    res.on('end', () => {
        const result = JSON.parse(r);
        console.log('\nResposta:', JSON.stringify(result));
        if (result.error === 'error_sign') {
            console.log('❌ A chave em si está errada ou o algoritmo está errado.');
        } else {
            console.log('✅ A assinatura foi aceita! Problema era outra coisa.');
        }
    });
});
req.on('error', e => console.error(e));
req.write(postData);
req.end();
