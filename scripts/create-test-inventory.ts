/**
 * Test Data Script: Create Sample Products for Inventory Testing
 * 
 * This script creates sample products with:
 * - Different specs (IMEI1, IMEI2, Color, Storage, RAM)
 * - Various stock quantities
 * - All price types
 * - Track inventory enabled
 * 
 * Run this in the browser console while logged in
 */

import { supabase } from './supabase';
import { ProductStatus } from '../utils/field-standards';

export async function createTestInventoryProducts() {
    console.log('🚀 Creating test products for inventory...');

    // Get current user's company_id
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
        console.error('❌ User not authenticated');
        return;
    }

    const { data: userRecord } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', userData.user.id)
        .single();

    if (!userRecord?.company_id) {
        console.error('❌ Company not found');
        return;
    }

    // Get or create a test category
    let categoryId: string;
    const { data: categories } = await supabase
        .from('categories')
        .select('id')
        .limit(1);

    if (categories && categories.length > 0) {
        categoryId = categories[0].id;
    } else {
        console.log('📁 Creating test category...');
        const { data: newCategory } = await supabase
            .from('categories')
            .insert({
                name: 'Eletrônicos',
                description: 'Categoria de teste para eletrônicos',
                company_id: userRecord.company_id
            })
            .select()
            .single();

        if (!newCategory) {
            console.error('❌ Failed to create category');
            return;
        }
        categoryId = newCategory.id;
    }

    // Test products with varied specs
    const testProducts = [
        {
            name: 'iPhone 14 Pro Max 256GB Azul',
            sku: 'IPH14PM-256-AZ',
            brand: 'Apple',
            model: 'iPhone 14 Pro Max',
            category_id: categoryId,
            price_cost: 450000,      // R$ 4.500,00
            price_retail: 549900,    // R$ 5.499,00
            price_reseller: 519900,  // R$ 5.199,00
            price_wholesale: 499900, // R$ 4.999,00
            specs: {
                imei1: '123456789012345',
                imei2: '987654321098765',
                color: 'Azul Pacífico',
                storage: '256GB',
                ram: '6GB',
                display: '6.7"',
                battery: '4323mAh'
            },
            eans: ['7891234567890'],
            images: [],
            status: ProductStatus.ACTIVE,
            track_inventory: true,
            stock_quantity: 45
        },
        {
            name: 'Samsung Galaxy S23 Ultra 512GB Preto',
            sku: 'SAM-S23U-512-PT',
            brand: 'Samsung',
            model: 'Galaxy S23 Ultra',
            category_id: categoryId,
            price_cost: 420000,
            price_retail: 519900,
            price_reseller: 489900,
            price_wholesale: 469900,
            specs: {
                imei1: '234567890123456',
                imei2: '876543210987654',
                color: 'Preto Fantasma',
                storage: '512GB',
                ram: '12GB',
                display: '6.8"',
                battery: '5000mAh'
            },
            eans: ['7891234567891'],
            images: [],
            status: ProductStatus.ACTIVE,
            track_inventory: true,
            stock_quantity: 8  // Low stock
        },
        {
            name: 'iPad Air 5ª Geração 64GB Prata',
            sku: 'IPAD-AIR5-64-PR',
            brand: 'Apple',
            model: 'iPad Air',
            category_id: categoryId,
            price_cost: 320000,
            price_retail: 429900,
            price_reseller: 399900,
            price_wholesale: 379900,
            specs: {
                color: 'Prata',
                storage: '64GB',
                ram: '8GB',
                display: '10.9"',
                processor: 'M1'
            },
            eans: ['7891234567892'],
            images: [],
            status: ProductStatus.ACTIVE,
            track_inventory: true,
            stock_quantity: 0  // Out of stock
        },
        {
            name: 'Xiaomi Redmi Note 12 Pro 128GB Verde',
            sku: 'XIA-RN12P-128-VD',
            brand: 'Xiaomi',
            model: 'Redmi Note 12 Pro',
            category_id: categoryId,
            price_cost: 120000,
            price_retail: 179900,
            price_reseller: 159900,
            price_wholesale: 149900,
            specs: {
                imei1: '345678901234567',
                imei2: '765432109876543',
                color: 'Verde Floresta',
                storage: '128GB',
                ram: '8GB',
                display: '6.67"',
                battery: '5000mAh',
                camera: '108MP'
            },
            eans: ['7891234567893'],
            images: [],
            status: ProductStatus.ACTIVE,
            track_inventory: true,
            stock_quantity: 25
        },
        {
            name: 'Motorola Edge 40 256GB Azul',
            sku: 'MOT-E40-256-AZ',
            brand: 'Motorola',
            model: 'Edge 40',
            category_id: categoryId,
            price_cost: 180000,
            price_retail: 249900,
            price_reseller: 229900,
            price_wholesale: 219900,
            specs: {
                imei1: '456789012345678',
                imei2: '654321098765432',
                color: 'Azul Eclipse',
                storage: '256GB',
                ram: '8GB',
                display: '6.55"',
                battery: '4400mAh'
            },
            eans: ['7891234567894'],
            images: [],
            status: ProductStatus.ACTIVE,
            track_inventory: true,
            stock_quantity: 3  // Low stock
        },
        {
            name: 'Samsung Galaxy Tab S8 128GB Grafite',
            sku: 'SAM-TABS8-128-GR',
            brand: 'Samsung',
            model: 'Galaxy Tab S8',
            category_id: categoryId,
            price_cost: 280000,
            price_retail: 379900,
            price_reseller: 349900,
            price_wholesale: 329900,
            specs: {
                color: 'Grafite',
                storage: '128GB',
                ram: '8GB',
                display: '11"',
                battery: '8000mAh',
                processor: 'Snapdragon 8 Gen 1'
            },
            eans: ['7891234567895'],
            images: [],
            status: ProductStatus.ACTIVE,
            track_inventory: true,
            stock_quantity: 15
        },
        {
            name: 'iPhone 13 128GB Rosa',
            sku: 'IPH13-128-RS',
            brand: 'Apple',
            model: 'iPhone 13',
            category_id: categoryId,
            price_cost: 320000,
            price_retail: 419900,
            price_reseller: 389900,
            price_wholesale: 369900,
            specs: {
                imei1: '567890123456789',
                imei2: '543210987654321',
                color: 'Rosa',
                storage: '128GB',
                ram: '4GB',
                display: '6.1"',
                battery: '3240mAh'
            },
            eans: ['7891234567896'],
            images: [],
            status: ProductStatus.ACTIVE,
            track_inventory: true,
            stock_quantity: 60
        }
    ];

    console.log(`📦 Inserting ${testProducts.length} test products...`);

    const { data, error } = await supabase
        .from('products')
        .insert(testProducts)
        .select();

    if (error) {
        console.error('❌ Error creating products:', error);
        return;
    }

    console.log(`✅ Successfully created ${data?.length || 0} products!`);
    console.log('📊 Stock distribution:');
    console.log('  🟢 In stock (>10): 3 products');
    console.log('  🟡 Low stock (1-10): 2 products');
    console.log('  🔴 Out of stock (0): 1 product');
    console.log('\n💡 Products have varied specs:');
    console.log('  - Phones: IMEI1, IMEI2, Color, Storage, RAM');
    console.log('  - Tablets: Color, Storage, RAM, Display');
    console.log('\n🎯 Navigate to /admin/inventory to see dynamic columns!');

    return data;
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
    (window as any).createTestInventoryProducts = createTestInventoryProducts;
    console.log('💡 Run: createTestInventoryProducts()');
}
