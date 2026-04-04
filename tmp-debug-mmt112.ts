import 'dotenv/config'; // Load .env.local

// Polyfill para o Vite (import.meta.env) funcionar no Node.js
if (!globalThis.import) globalThis.import = {} as any;
if (!globalThis.import.meta) globalThis.import.meta = {} as any;
globalThis.import.meta.env = process.env as any;

import { catalogService } from './services/catalogService.ts';
import { catalogConfigService } from './services/catalogConfigService.ts';
import { groupProductsByVariants } from './services/productGrouping.ts';

async function run() {
    console.log('== 1. GETTING CATALOG SETTINGS ==');
    const settings = await catalogConfigService.getSettings();
    console.log('Settings:', Object.keys(settings).length > 0 ? 'Loaded' : 'Empty');

    console.log('\n== 2. FETCHING PRODUCTS FROM VPS (Category Cuidado Pessoal) ==');
    const categoryId = 'e91042f3-ef46-4bae-a7bc-14aafdd54a82'; // Cuidado Pessoal id
    const res = await catalogService.getProducts({ categories: [categoryId] }, 1, 50, true);
    
    console.log('Total Products Returned by Service:', res.products.length);
    
    const mm112 = res.products.find(p => p.sku === 'MM-T112');
    if (mm112) {
        console.log('\n[SUCCESS] MM-T112 made it through catalogService filters!');
        console.log('Stock:', mm112.stock_quantity, 'Track Inv:', mm112.track_inventory, 'Price:', mm112.price_retail, 'Status:', mm112.status);
    } else {
        console.log('\n[ERROR] MM-T112 was stripped inside catalogService.getProducts() !');
    }

    console.log('\n== 3. APPLYING GROUPING (like the UI does) ==');
    const productGroups = groupProductsByVariants(res.products, false);
    console.log('Total Unique Product Cards (Groups):', productGroups.length);

    const groupHasMM112 = productGroups.find(g => g.variants.some(v => v.products.some(p => p.sku === 'MM-T112')));
    if (groupHasMM112) {
         console.log('\n[SUCCESS] MM-T112 survived grouping! Belongs to group:', groupHasMM112.model);
    } else {
         console.log('\n[ERROR] MM-T112 was stripped during grouping (filterAvailableProducts).');
    }
}

run().catch(console.error);
