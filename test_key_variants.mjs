// Teste variações da chave: string literal vs hex decodificado vs prefixo removido
import https from 'https';
import crypto from 'crypto';

const partnerId = '1229870';
const apiPath = '/api/v2/auth/token/get';

async function testSign(label, key) {
    const timestamp = Math.floor(Date.now() / 1000);
    const base = `${partnerId}${apiPath}${timestamp}`;
    const sign = crypto.createHmac('sha256', key).update(base).digest('hex');
    
    const postData = JSON.stringify({ code: 'FAKE', shop_id: 0, partner_id: Number(partnerId) });
    const url = `https://partner.test-stable.shopeemobile.com${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;
    
    return new Promise((resolve) => {
        const urlObj = new URL(url);
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
                const ok = result.error !== 'error_sign';
                console.log(`[${ok ? '✅' : '❌'}] ${label}: ${result.error} - ${result.message}`);
                resolve(ok);
            });
        });
        req.on('error', e => { console.log(`[ERR] ${label}:`, e.message); resolve(false); });
        req.write(postData);
        req.end();
    });
}

const RAW_KEY = 'shpk45434a69786d53566659686c634d6254796f556956517347454c47754e45';
// Parte depois do prefixo "shpk"
const KEY_NO_PREFIX = RAW_KEY.slice(4); // "45434a69786d..."
// Chave decodificada como hex (os bytes binários que a string representa)
const KEY_HEX_DECODED = Buffer.from(KEY_NO_PREFIX, 'hex');
// Chave completa como buffer utf8 (string literal)
const KEY_AS_BUFFER = Buffer.from(RAW_KEY, 'utf8');

console.log('Testando variações da chave...\n');

await testSign('Raw string (atual)', RAW_KEY);
await testSign('Sem prefixo shpk', KEY_NO_PREFIX);
await testSign('Hex decodificado (sem prefixo)', KEY_HEX_DECODED);
await testSign('Buffer UTF-8 da chave', KEY_AS_BUFFER);

console.log('\nFim dos testes.');
