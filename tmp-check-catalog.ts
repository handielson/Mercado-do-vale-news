import { catalogService } from './services/catalogService';

(async () => {
    // 1. Fetch categories
    const categories = await catalogService.getCategories();
    console.log('[catalogService] total categories:', categories.length);
    const mmCat = categories.find(c => c.id === 'e91042f3-ef46-4bae-a7bc-14aafdd54a82');
    console.log('[catalogService] mmCat:', mmCat);

    // 2. Fetch products for this category
    const products = await catalogService.getProducts({ categories: ['e91042f3-ef46-4bae-a7bc-14aafdd54a82'] });
    console.log(`[catalogService] total products in mmCat:`, products.length);
    
    products.forEach(p => console.log(p.sku, p.name, p.status, p.stock_quantity, p.price_retail));
})();
