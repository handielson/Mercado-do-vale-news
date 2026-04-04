import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Mini port of filter logic
const ProductStatus = {
    ACTIVE: 'active',
    INACTIVE: 'inactive'
};

function normalizeProduct(p) {
    const stockRaw = p.stock_quantity !== undefined ? p.stock_quantity : p.stock;
    let stock_quantity = 0;
    if (typeof stockRaw === 'number') {
        stock_quantity = stockRaw;
    } else if (typeof stockRaw === 'string' && stockRaw.trim() && stockRaw.toLowerCase() !== 'null') {
        stock_quantity = parseInt(stockRaw, 10) || 0;
    }

    let track_inventory;
    if (p.track_inventory !== undefined) {
        track_inventory = Boolean(p.track_inventory);
    } else {
        track_inventory = stockRaw !== null && stockRaw !== undefined && String(stockRaw).toLowerCase() !== 'null';
    }

    return {
        ...p,
        id: String(p.id || ''),
        sku: String(p.sku || ''),
        name: String(p.name || ''),
        status: p.status,
        price_retail: p.price_retail !== undefined ? parseFloat(String(p.price_retail)) || 0 : undefined,
        stock_quantity,
        track_inventory,
        is_combo: p.is_combo === 1 || p.is_combo === true,
        category_id: p.category_id,
        specs: p.specs ?? {}
    };
}

(async () => {
    console.log('== FETCHING PRODUCTS FROM VPS (Cuidado Pessoal) ==');
    const res = await fetch(`https://api.xiaomipetrolina.com.br/products?limit=50&category=e91042f3-ef46-4bae-a7bc-14aafdd54a82`);
    let vpsRaw = await res.json();
    console.log('Total Raw Products:', vpsRaw.length);

    let result = vpsRaw.map(normalizeProduct);
    
    // Simulate catalog settings
    const settings = {
        hide_inactive: true,
        hide_out_of_stock: true,
        hide_zero_price: true,
        min_stock_to_show: 1
    };

    const mm112Initial = result.find(p => p.sku === 'MM-T112');
    console.log('\n[DEBUG] MM-T112 After Normalize:', mm112Initial ? { sku: mm112Initial.sku, status: mm112Initial.status, track_inventory: mm112Initial.track_inventory, stock_quantity: mm112Initial.stock_quantity, price_retail: mm112Initial.price_retail } : 'NOT FOUND');

    console.log('\n--- APPLYING FILTERS ---');
    
    // 1. Hide Inactive
    result = result.filter(p => {
        const keep = p.status === 'active';
        if (p.sku === 'MM-T112' && !keep) console.log('MM-T112 removed by hide_inactive');
        return keep;
    });

    // 2. Hide Out of stock
    result = result.filter(p => {
        const keep = !p.track_inventory || (p.stock_quantity || 0) > 0;
        if (p.sku === 'MM-T112' && !keep) console.log('MM-T112 removed by hide_out_of_stock. track_inventory:', p.track_inventory, 'stock:', p.stock_quantity);
        return keep;
    });

    // 3. Hide Zero Price
    result = result.filter(p => {
        const keep = p.is_combo || (p.price_retail || 0) > 0;
        if (p.sku === 'MM-T112' && !keep) console.log('MM-T112 removed by hide_zero_price. price:', p.price_retail);
        return keep;
    });

    // 4. Min stock to show
    result = result.filter(p => {
        const keep = !p.track_inventory || (p.stock_quantity || 0) >= settings.min_stock_to_show;
        if (p.sku === 'MM-T112' && !keep) console.log('MM-T112 removed by min_stock_to_show');
        return keep;
    });

    console.log('\nAvailable products after ALL filters:', result.map(p => p.name));

    // groupProductsByVariants equivalent test
    console.log('\n--- APPLYING GROUPING ---');
    let grouped = result.filter(product => {
        // Must be active (available for sale)
        if (product.status !== ProductStatus.ACTIVE) {
            return false;
        }

        // Se não for admin, filtra por estoque
        if (product.track_inventory && (product.stock_quantity ?? 0) <= 0) {
            if (product.sku === 'MM-T112') console.log('MM-T112 removed in group filter due to stock');
            return false;
        }
        return true;
    });

    // Check generateGroupKey
    console.log('\n--- GROUPING KEYS ---');
    grouped.forEach(p => {
        let baseName = p.name || p.model || 'unknown';
        const lowerBase = baseName.toLowerCase();
        const modelKey = p.model_id ? String(p.model_id) : `${p.brand || 'unknown'}_${baseName}`.toLowerCase().replace(/\s+/g, '-');
        console.log(`- ${p.sku} | model_id: ${p.model_id} | brand: ${p.brand} | KEY: ${modelKey}`);
    });

    const isGrouped = grouped.find(p => p.sku === 'MM-T112');
    if (isGrouped) {
        console.log('\n✅ SUCCESS: MM-T112 survived filters before grouping!');
    } else {
        console.log('\n❌ FAILURE: MM-T112 did not survive.');
    }
})();
