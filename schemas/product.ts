
import { z } from 'zod';
import { ProductStatus } from '../utils/field-standards';

/**
 * PRODUCT SCHEMA
 * Validation for product creation/update with category governance
 * Fixed: NaN issue in logistics fields using z.coerce
 */

export const productSchema = z.object({
    // Category & Brand
    category_id: z.string().min(1, 'Categoria é obrigatória'),
    brand: z.string().min(1, 'Marca é obrigatória'),
    model: z.string().min(1, 'Modelo é obrigatório'),

    // Basic Information
    name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    sku: z.string().min(3, 'SKU deve ter pelo menos 3 caracteres'),

    // Pricing (in centavos) - Fixed NaN issue with z.coerce
    price_retail: z.coerce.number().min(0, 'Preço varejo deve ser maior ou igual a zero'),
    price_reseller: z.coerce.number().min(0, 'Preço revenda deve ser maior ou igual a zero'),
    price_wholesale: z.coerce.number().min(0, 'Preço atacado deve ser maior ou igual a zero'),

    // Media & Identifiers
    images: z.array(z.string()).optional(),
    eans: z.array(z.string()).optional(),

    // Specifications (flexible object)
    specs: z.record(z.any()).optional(),

    // Status
    status: z.nativeEnum(ProductStatus, {
        errorMap: () => ({ message: 'Status inválido' })
    }),

    // Fiscal Fields
    ncm: z.string().max(8).optional(),
    cest: z.string().max(7).optional(),
    origin: z.string().optional(),

    // Logistics Fields (Fixed NaN issue)
    // z.coerce converts string to number automatically
    // .or(z.literal('')) allows empty string from HTML inputs
    // .nullable() allows null values
    // .transform() converts empty/null to undefined
    weight_kg: z.coerce.number().min(0).optional()
        .or(z.literal(''))
        .or(z.null())
        .transform(val => val === '' || val === null ? undefined : val),

    dimensions: z.object({
        width_cm: z.coerce.number().min(0).optional()
            .or(z.literal(''))
            .or(z.null())
            .transform(val => val === '' || val === null ? undefined : val),
        height_cm: z.coerce.number().min(0).optional()
            .or(z.literal(''))
            .or(z.null())
            .transform(val => val === '' || val === null ? undefined : val),
        depth_cm: z.coerce.number().min(0).optional()
            .or(z.literal(''))
            .or(z.null())
            .transform(val => val === '' || val === null ? undefined : val)
    }).optional(),

    // Inventory Control
    track_inventory: z.boolean().default(true),
    stock_quantity: z.coerce.number().int().min(0).optional()
        .or(z.literal(''))
        .or(z.null())
        .transform(val => val === '' || val === null ? undefined : val)
}).refine(
    (data) => data.price_retail >= data.price_reseller,
    {
        message: 'Preço varejo deve ser maior ou igual ao preço revenda',
        path: ['price_retail']
    }
).refine(
    (data) => data.price_reseller >= data.price_wholesale,
    {
        message: 'Preço revenda deve ser maior ou igual ao preço atacado',
        path: ['price_reseller']
    }
).refine(
    (data) => {
        // If tracking inventory, stock_quantity is required
        if (data.track_inventory && data.stock_quantity === undefined) {
            return false;
        }
        return true;
    },
    {
        message: 'Quantidade em estoque é obrigatória quando monitoramento está ativo',
        path: ['stock_quantity']
    }
);

export type ProductSchemaType = z.infer<typeof productSchema>;

/**
 * Validate product data
 */
export function validateProduct(data: unknown) {
    return productSchema.safeParse(data);
}
