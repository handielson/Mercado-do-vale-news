
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
    price_cost: z.coerce.number().min(0, 'Preço de custo deve ser maior ou igual a zero').nullable().optional(),
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

    // Fiscal Fields - Accept null, empty strings, and undefined
    ncm: z.string().max(8).nullable().optional()
        .transform(val => !val || val === '' ? undefined : val),
    cest: z.string().max(7).nullable().optional()
        .transform(val => !val || val === '' ? undefined : val),
    origin: z.string().nullable().optional()
        .transform(val => !val || val === '' ? undefined : val),

    // Logistics Fields - Truly optional, allow empty values, with postal limits
    weight_kg: z.union([
        z.number()
            .min(0, 'Peso deve ser maior ou igual a zero')
            .max(30, 'Peso máximo permitido pelos Correios: 30kg'),
        z.nan(),
        z.null(),
        z.undefined()
    ]).optional().transform(val => {
        if (val === null || val === undefined || Number.isNaN(val) || val === 0) return undefined;
        return val;
    }),

    dimensions: z.object({
        width_cm: z.union([
            z.number()
                .min(0, 'Largura deve ser maior ou igual a zero')
                .max(105, 'Largura máxima permitida pelos Correios: 105cm'),
            z.nan(),
            z.null(),
            z.undefined()
        ]).optional().transform(val => {
            if (val === null || val === undefined || Number.isNaN(val) || val === 0) return undefined;
            return val;
        }),
        height_cm: z.union([
            z.number()
                .min(0, 'Altura deve ser maior ou igual a zero')
                .max(105, 'Altura máxima permitida pelos Correios: 105cm'),
            z.nan(),
            z.null(),
            z.undefined()
        ]).optional().transform(val => {
            if (val === null || val === undefined || Number.isNaN(val) || val === 0) return undefined;
            return val;
        }),
        depth_cm: z.union([
            z.number()
                .min(16, 'Profundidade mínima permitida pelos Correios: 16cm')
                .max(105, 'Profundidade máxima permitida pelos Correios: 105cm'),
            z.nan(),
            z.null(),
            z.undefined()
        ]).optional().transform(val => {
            if (val === null || val === undefined || Number.isNaN(val) || val === 0) return undefined;
            return val;
        })
    }).optional(),

    // Inventory Control
    track_inventory: z.boolean().default(true),
    stock_quantity: z.coerce.number().int().min(0).nullable().optional()
        .transform(val => val === null || val === 0 ? undefined : val)
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
