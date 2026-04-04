import fetch from 'node-fetch';

(async () => {
    try {
        const catRes = await fetch('https://api.xiaomipetrolina.com.br/products/category-counts');
        if (catRes.ok) {
            const data = await catRes.json();
            console.log('VPS category-counts data (Total categories):', data.length);
            const mmCat = data.find(c => c.category_id === 'e91042f3-ef46-4bae-a7bc-14aafdd54a82');
            console.log('VPS category-counts for MM-T112 category:', mmCat);
        } else {
            console.log('Failed to fetch category-counts. Status:', catRes.status, await catRes.text());
        }
    } catch (e) {
        console.error('Error fetching:', e);
    }
})();
