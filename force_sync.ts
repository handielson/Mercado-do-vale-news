import { productService } from './services/products';

async function forceProductSync() {
    const id = 'e29ea56a-09c0-4560-b881-619abc58b549';
    try {
        const prod = await productService.getById(id);
        if (prod) {
            prod.stock_quantity = 0;
            // The signature of update requires ProductInput (which mostly matches Product)
            await productService.update(id, prod as any);
            console.log("Successfully synced product stock to 0 internally on both VPS and Supabase");
        } else {
            console.log("Product not found");
        }
    } catch (err) {
        console.error("Error formatting product:", err);
    }
}

forceProductSync();
