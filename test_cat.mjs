import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});

(async () => {
    console.log('== Categories Info ==');
    const catRes = await fetch('https://api.xiaomipetrolina.com.br/categories');
    const categories = await catRes.json();
    
    // Find the category for MM-T112
    const targetCatId = 'e91042f3-ef46-4bae-a7bc-14aafdd54a82';
    const tgtCat = categories.find(c => c.id === targetCatId);
    console.log('Target Category for MM-T112:', tgtCat ? { id: tgtCat.id, name: tgtCat.name, parent_id: tgtCat.parent_id } : 'Not found');

    if (tgtCat && tgtCat.parent_id) {
        const parentCat = categories.find(c => c.id === tgtCat.parent_id);
        console.log('Parent Category:', parentCat ? { id: parentCat.id, name: parentCat.name } : 'Not found');
    }

    console.log('\n== Fetching products from VPS for this category ==');
    const pRes = await fetch(`https://api.xiaomipetrolina.com.br/products?category=${targetCatId}&limit=500`);
    const products = await pRes.json();
    console.log(`Found ${products.length} products in VPS for category ${targetCatId}`);
    
    const mm112 = products.find(p => p.sku === 'MM-T112');
    if (mm112) {
        console.log('SUCCESS: MM-T112 found in VPS response!');
        console.log({
            id: mm112.id,
            sku: mm112.sku,
            name: mm112.name,
            in_stock_count: mm112.in_stock_count,
            stock_quantity: mm112.stock_quantity,
            visibility: mm112.visibility,
            status: mm112.status,
            category_id: mm112.category_id
        });
    } else {
        console.log('FAIL: MM-T112 NOT FOUND in VPS response for this category.');
    }

    console.log('\n== Fetching MM-T112 directly from VPS by search ==');
    const pSearch = await fetch(`https://api.xiaomipetrolina.com.br/products?search=MM-T112`);
    const pSearchRes = await pSearch.json();
    const mmSearch = pSearchRes.find(p => p.sku === 'MM-T112');
    if (mmSearch) {
        console.log('Found by search:', {
            id: mmSearch.id,
            sku: mmSearch.sku,
            name: mmSearch.name,
            in_stock_count: mmSearch.in_stock_count,
            stock_quantity: mmSearch.stock_quantity,
            visibility: mmSearch.visibility,
            status: mmSearch.status,
            category_id: mmSearch.category_id
        });
    } else {
        console.log('Not found by search');
    }
})();
