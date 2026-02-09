import { supabase } from '../lib/supabase';
import { Product, ProductInput } from '../types/product';
import { calculateAllAveragePrices } from '../utils/calculateAveragePrice';

/**
 * Average Price Service
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Manages average price calculations by variation
 * - Variation key: model_id + specs.ram + specs.storage
 * - Updates all products of same variation
 * - Only recalculates on stock entry, not on sales
 */

interface VariationKey {
    model_id: string;
    ram: string;
    storage: string;
}

/**
 * Get all products of the same variation (model + RAM + storage)
 * 
 * @param variation - Variation key (model_id, ram, storage)
 * @returns Array of products matching the variation
 */
async function getProductsByVariation(variation: VariationKey): Promise<Product[]> {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('model_id', variation.model_id)
        .eq('specs->>ram', variation.ram)
        .eq('specs->>storage', variation.storage)
        .eq('status', 'active'); // Only active products

    if (error) {
        console.error('Error fetching products by variation:', error);
        throw error;
    }

    return data || [];
}

/**
 * Calculate current average prices from existing products
 * 
 * @param products - Array of products
 * @returns Object with average prices and total stock
 */
function getCurrentAverages(products: Product[]) {
    if (products.length === 0) {
        return {
            totalStock: 0,
            avgPrices: {
                price_cost: 0,
                price_retail: 0,
                price_reseller: 0,
                price_wholesale: 0
            }
        };
    }

    const totalStock = products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);

    // Calculate weighted average for each price type
    const sumCost = products.reduce((sum, p) => sum + (p.price_cost * (p.stock_quantity || 0)), 0);
    const sumRetail = products.reduce((sum, p) => sum + (p.price_retail * (p.stock_quantity || 0)), 0);
    const sumReseller = products.reduce((sum, p) => sum + (p.price_reseller * (p.stock_quantity || 0)), 0);
    const sumWholesale = products.reduce((sum, p) => sum + (p.price_wholesale * (p.stock_quantity || 0)), 0);

    return {
        totalStock,
        avgPrices: {
            price_cost: totalStock > 0 ? Math.round((sumCost / totalStock) * 100) / 100 : 0,
            price_retail: totalStock > 0 ? Math.round((sumRetail / totalStock) * 100) / 100 : 0,
            price_reseller: totalStock > 0 ? Math.round((sumReseller / totalStock) * 100) / 100 : 0,
            price_wholesale: totalStock > 0 ? Math.round((sumWholesale / totalStock) * 100) / 100 : 0
        }
    };
}

/**
 * Update average prices for a product variation
 * 
 * This function:
 * 1. Finds all products of the same variation
 * 2. Calculates new average prices including the new product
 * 3. Updates all products with the new average prices
 * 
 * @param newProduct - The new product being added
 * @returns Updated average prices and statistics
 */
export async function updateAveragePrices(newProduct: ProductInput & { model_id: string }) {
    try {
        // Extract variation key
        const ram = newProduct.specs?.ram || '';
        const storage = newProduct.specs?.storage || '';

        if (!newProduct.model_id || !ram || !storage) {
            console.log('⏭️ Skipping average price calculation - missing variation data');
            return null;
        }

        const variation: VariationKey = {
            model_id: newProduct.model_id,
            ram,
            storage
        };

        console.log('🔍 Calculating average prices for variation:', variation);

        // 1. Get existing products of same variation
        const existingProducts = await getProductsByVariation(variation);

        // 2. Calculate current averages
        const { totalStock, avgPrices: currentPrices } = getCurrentAverages(existingProducts);

        console.log(`📊 Current stock: ${totalStock} units`);
        console.log(`💰 Current prices:`, currentPrices);

        // 3. Calculate new average prices
        const newPrices = {
            price_cost: newProduct.price_cost || 0,
            price_retail: newProduct.price_retail || 0,
            price_reseller: newProduct.price_reseller || 0,
            price_wholesale: newProduct.price_wholesale || 0
        };

        const averages = calculateAllAveragePrices(
            totalStock,
            currentPrices,
            newProduct.stock_quantity || 1,
            newPrices
        );

        console.log(`✨ New average prices calculated:`, {
            cost: averages.price_cost.averagePrice,
            retail: averages.price_retail.averagePrice,
            reseller: averages.price_reseller.averagePrice,
            wholesale: averages.price_wholesale.averagePrice
        });

        // 4. Update all products of this variation (if there are existing products)
        if (existingProducts.length > 0) {
            const productIds = existingProducts.map(p => p.id);

            const { error } = await supabase
                .from('products')
                .update({
                    price_cost: averages.price_cost.averagePrice,
                    price_retail: averages.price_retail.averagePrice,
                    price_reseller: averages.price_reseller.averagePrice,
                    price_wholesale: averages.price_wholesale.averagePrice
                })
                .in('id', productIds);

            if (error) {
                console.error('❌ Error updating product prices:', error);
                throw error;
            }

            console.log(`✅ Updated ${existingProducts.length} existing products with new average prices`);
        }

        return {
            variation,
            previousStock: totalStock,
            newStock: totalStock + (newProduct.stock_quantity || 1),
            averages: {
                price_cost: averages.price_cost,
                price_retail: averages.price_retail,
                price_reseller: averages.price_reseller,
                price_wholesale: averages.price_wholesale
            }
        };

    } catch (error) {
        console.error('❌ Error in updateAveragePrices:', error);
        throw error;
    }
}

export const averagePriceService = {
    updateAveragePrices,
    getProductsByVariation
};
