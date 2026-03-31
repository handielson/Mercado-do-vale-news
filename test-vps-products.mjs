import fetch from 'node-fetch'; // Se node 18+, fetch é nativo. Caso dê problema descomente ou ajuste.

const VPS_BASE_URL = 'https://api.xiaomipetrolina.com.br';
const VITE_VPS_SYNC_KEY = '4eae1b3fe1ab3224bb53fd2402d46cf57b86ef98dd53775eb5a5f178f1d5b3f4';

async function run() {
    try {
        console.log('Fetching active products...');
        const res = await fetch(`${VPS_BASE_URL}/products?status=active&limit=5`, {
            headers: {
                'X-Sync-Key': VITE_VPS_SYNC_KEY,
                'Accept': 'application/json'
            }
        });
        
        if (!res.ok) {
            console.error('Fetch failed', res.status);
            return;
        }
        
        const data = await res.json();
        console.log(`Found ${data.length} products with status=active.`);
        if (data.length > 0) {
            console.log('Sample 1 (active):', JSON.stringify(data[0], null, 2));
        }

        console.log('\nFetching ALL products (limit 5)...');
        const resAll = await fetch(`${VPS_BASE_URL}/products?limit=5`, {
            headers: {
                'X-Sync-Key': VITE_VPS_SYNC_KEY,
                'Accept': 'application/json'
            }
        });
        const dataAll = await resAll.json();
        console.log(`Found ${dataAll.length} products total.`);
        if (dataAll.length > 0) {
            console.log('Sample 1 (all):', JSON.stringify(dataAll[0], null, 2));
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
