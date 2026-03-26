// Troca o code pelo access_token DIRETAMENTE (contornando o callback da Vercel)
import https from 'https';
import crypto from 'crypto';

// Capturado pelo browser agent
const CODE = '7971556569786d504b61656767594679';
const SHOP_ID = 226950609;
const PARTNER_ID = 1229870;
const PARTNER_KEY = 'shpk45434a69786d53566659686c634d6254796f556956517347454c47754e45';

const apiPath = '/api/v2/auth/token/get';
const timestamp = Math.floor(Date.now() / 1000);
const baseString = `${PARTNER_ID}${apiPath}${timestamp}`;
const sign = crypto.createHmac('sha256', PARTNER_KEY).update(baseString).digest('hex');

const url = `https://partner.test-stable.shopeemobile.com${apiPath}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`;
const payload = JSON.stringify({ code: CODE, shop_id: SHOP_ID, partner_id: PARTNER_ID });

console.log('URL:', url);
console.log('Payload:', payload);
console.log('Base String:', baseString);
console.log('Sign:', sign);

const req = https.request(new URL(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        console.log('\nResposta:', JSON.stringify(JSON.parse(data), null, 2));
    });
});
req.on('error', e => console.error(e));
req.write(payload);
req.end();
