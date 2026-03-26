import crypto from 'crypto';
import https from 'https';

const partnerId = '1229870';
const partnerKey = 'shpk44656775546c70516b545462446644426377536c79707449674e77474378';

function generateSign(apiPath, timestamp) {
    const baseString = `${partnerId}${apiPath}${timestamp}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

async function testPostVariants() {
    const apiPath = '/api/v2/auth/token/get';
    const ts = Math.floor(Date.now() / 1000);
    const sign = generateSign(apiPath, ts);
    
    const url = `https://partner.test-stable.shopeemobile.com${apiPath}?partner_id=${partnerId}&timestamp=${ts}&sign=${sign}`;

    console.log('--- TEST WITH JSON BODY ---');
    const payloadJson = JSON.stringify({
        code: '7a6e58775873434163556361796d6957',
        shop_id: 226950198,
        partner_id: 1229870
    });
    await makeRequest(url, payloadJson, 'application/json');

    console.log('\n--- TEST WITH EMPTY BODY ---');
    await makeRequest(url, '', 'application/json');

    // What if the code and shop_id are passed in the URL?
    const urlWithParams = `${url}&shop_id=226950198`;
    // Wait, let's see what sign generates if we ADD shop_id to base string?
    // Public API doesn't use shop_id in base string, but what if auth/token/get DOES require shop_id?
    const baseStringWithShopId = `${partnerId}${apiPath}${ts}226950198`;
    const signWithShopId = crypto.createHmac('sha256', partnerKey).update(baseStringWithShopId).digest('hex');
    const urlWithShopIdSign = `https://partner.test-stable.shopeemobile.com${apiPath}?partner_id=${partnerId}&timestamp=${ts}&sign=${signWithShopId}`;
    
    console.log('\n--- TEST WITH SHOP_ID IN SIGNATURE ---');
    await makeRequest(urlWithShopIdSign, payloadJson, 'application/json');
}

function makeRequest(urlStr, payload, contentType) {
    return new Promise((resolve) => {
        const url = new URL(urlStr);
        const options = {
            hostname: url.hostname,
            path: `${url.pathname}${url.search}`,
            method: 'POST',
            headers: {
                'Content-Type': contentType,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Response:', JSON.parse(data));
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error(e);
            resolve();
        });

        req.write(payload);
        req.end();
    });
}

testPostVariants();
