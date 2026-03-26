import https from 'https';
import crypto from 'crypto';

function generateSign(partnerId, partnerKey, apiPath, timestamp) {
    const baseString = `${partnerId}${apiPath}${timestamp}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

function httpsPost(url, body) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const data = JSON.stringify(body);
        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        const req = https.request(options, (res) => {
            let result = '';
            res.on('data', chunk => result += chunk);
            res.on('end', () => resolve(JSON.parse(result)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Buscar keys do VPS
https.get('https://api.xiaomipetrolina.com.br/company-settings', async (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', async () => {
        const settings = JSON.parse(data);
        const partnerId = String(settings.shopee_partner_id || '');
        const partnerKey = String(settings.shopee_partner_key || '');
        
        console.log('Partner ID:', partnerId);
        console.log('Key OK:', partnerKey.length === 64 ? 'YES' : 'NO (' + partnerKey.length + ' chars)');
        
        const apiPath = '/api/v2/auth/token/get';
        const timestamp = Math.floor(Date.now() / 1000);
        const sign = generateSign(partnerId, partnerKey, apiPath, timestamp);
        
        const tokenUrl = `https://partner.test-stable.shopeemobile.com${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;
        
        console.log('\nChamando Shopee Sandbox com código FAKE para testar assinatura...');
        
        try {
            const result = await httpsPost(tokenUrl, {
                code: 'TEST_FAKE_CODE_JUST_TO_CHECK_SIGN',
                shop_id: 0,
                partner_id: Number(partnerId)
            });
            
            console.log('\nResposta da Shopee:', JSON.stringify(result, null, 2));
            
            if (result.error === 'error_sign') {
                console.log('\n❌ ASSINATURA AINDA INVÁLIDA - Problema está no algoritmo ou na chave');
            } else if (result.error === 'error_auth' || result.error === 'common_error') {
                console.log('\n✅ ASSINATURA VÁLIDA! O erro é sobre o código/shop_id (esperado com dados falsos)');
            } else {
                console.log('\nOutro erro:', result.error);
            }
        } catch (e) {
            console.error('Erro HTTP:', e.message);
        }
    });
});
