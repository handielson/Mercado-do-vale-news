const fetch = require('node-fetch');

async function check() {
    try {
        console.log("=== Querying SKU PMCS ===");
        let res = await fetch('https://api.xiaomipetrolina.com.br/products?sku=PMCS');
        let data = await res.json();
        console.log(JSON.stringify(data, null, 2));

        console.log("\n=== Querying Alphasat ===");
        res = await fetch('https://api.xiaomipetrolina.com.br/products?search=Alphasat');
        data = await res.json();
        console.log(JSON.stringify(data, null, 2));

    } catch (e) {
        console.error(e);
    }
}
check();
