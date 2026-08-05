
import { z } from 'zod';
import { ProductStatus } from '../utils/field-standards';

/**
 * PRODUCT SCHEMA
 * Validation for product creation/update with category governance
 * Fixed: NaN issue in logistics fields using z.coerce
 */

const IMEI_REGEX = /^[0-9]{15}$/;
export const productSchema = z.object({
    // Model Reference (optional - populated by EAN scanner)
    model_id: z.union([z.string(), z.null(), z.undefined()]).optional().transform(v => v || undefined),

    // Category & Brand (optional - come from model)
    category_id: z.union([z.string(), z.null(), z.undefined()]).optional().transform(v => v || undefined),
    brand: z.union([z.string(), z.null(), z.undefined()]).optional().transform(v => v || undefined),
    model: z.union([z.string(), z.null(), z.undefined()]).optional().transform(v => v || undefined),
    parent_id: z.union([z.string(), z.null(), z.undefined()]).optional().transform(v => v || undefined),

    // Basic Information
    name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    sku: z.string().optional(), // Auto-generated if empty

    // Pricing (in centavos) - Fixed NaN issue with z.coerce
    price_cost: z.coerce.number().min(0, 'Preço de custo deve ser maior ou igual a zero').nullable().optional(),
    price_retail: z.coerce.number().min(0, 'Preço varejo deve ser maior ou igual a zero'),
    price_reseller: z.coerce.number().min(0, 'Preço revenda deve ser maior ou igual a zero'),
    price_wholesale: z.coerce.number().min(0, 'Preço atacado deve ser maior ou igual a zero'),

    // Media & Identifiers
    images: z.array(z.string()).optional(),
    eans: z.array(z.string()).optional(),
    video_url: z.string().nullable().optional(),
    marketing_background_url: z.string().nullable().optional(),
    marketing_video_url: z.string().nullable().optional(),

    // Specifications (flexible object)
    specs: z.record(z.any()).optional(),

    // SEO Fields
    description: z.string().nullable().optional()
        .transform(val => !val ? undefined : val),
    slug: z.string().optional(),
    meta_title: z.string().max(60, 'Título SEO deve ter no máximo 60 caracteres').optional(),
    meta_description: z.string().max(160, 'Meta descrição deve ter no máximo 160 caracteres').optional(),
    keywords: z.array(z.string()).optional(),

    // Status
    status: z.nativeEnum(ProductStatus, {
        errorMap: () => ({ message: 'Status inválido' })
    }),

    // Gift Product Flag
    is_gift: z.boolean().optional().default(false),

    // Virtual Product Flag
    is_virtual: z.boolean().optional().default(false),

    // Combo Product Fields
    is_combo: z.boolean().optional().default(false),
    combo_discount_type: z.enum(['percentage', 'fixed']).nullable().optional(),
    combo_discount_value: z.coerce.number().min(0, 'Desconto não pode ser negativo').nullable().optional(),
    combo_children: z.array(z.object({
        id: z.string(),
        quantity: z.number().int().min(1)
    })).nullable().optional(),

    // Product Kits (Volume Pricing)
    kits: z.array(z.object({
        quantity: z.coerce.number().int().min(2, 'A quantidade do kit deve ser pelo menos 2'),
        price: z.coerce.number().min(0, 'O preço do kit não pode ser negativo'),
        price_wholesale: z.coerce.number().min(0).optional(),
        price_reseller: z.coerce.number().min(0).optional(),
        name: z.string().optional()
    })).optional().default([]),

    // Fiscal Fields - Accept null, empty strings, and undefined
    ncm: z.string().nullable().optional()
        .transform(val => !val ? undefined : val.replace(/\D/g, '').slice(0, 8) || undefined),
    cest: z.string().nullable().optional()
        .transform(val => !val ? undefined : val.replace(/\D/g, '').slice(0, 7) || undefined),
    origin: z.string().nullable().optional()
        .transform(val => !val || val === '' ? undefined : val),

    // Logistics Fields - Truly optional, allow empty values, with postal limits
    weight_kg: z.union([
        z.coerce.number()
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
            z.coerce.number()
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
            z.coerce.number()
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
            z.coerce.number()
                .min(0, 'Profundidade deve ser maior ou igual a zero')
                .max(105, 'Profundidade máxima permitida pelos Correios: 105cm'),
            z.nan(),
            z.null(),
            z.undefined()
        ]).optional().transform(val => {
            if (val === null || val === undefined || Number.isNaN(val) || val === 0) return undefined;
            return val;
        })
    }).nullable().optional(),

    // Inventory Control
    track_inventory: z.boolean().default(true),
    stock_quantity: z.coerce.number().int().min(0).nullable().optional()
        .transform(val => val === null || val === 0 ? undefined : val),

    // Promotional Pricing
    price_promo: z.coerce.number().min(0).nullable().optional()
        .transform(val => (val === null || val === 0) ? undefined : val),
    promo_start: z.string().nullable().optional()
        .transform(val => !val ? undefined : val),
    promo_end: z.string().nullable().optional()
        .transform(val => !val ? undefined : val),
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
        // If tracking inventory and NOT a combo, stock_quantity is required.
        // Combos calculate their stock dynamically on the backend based on child stocks.
        // Virtual products do not need stock tracking.
        if (data.is_virtual) {
            return true;
        }
        if (data.track_inventory === true && !data.is_combo && (data.stock_quantity === undefined || data.stock_quantity === null)) {
            return false;
        }
        return true;
    },
    {
        message: 'Quantidade em estoque é obrigatória quando monitoramento está ativo',
        path: ['stock_quantity']
    }
).superRefine((data, ctx) => {
    const imei1 = data.specs?.imei1;
    if (imei1 !== undefined && imei1 !== null && String(imei1).trim() !== '' && !IMEI_REGEX.test(String(imei1).trim())) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'IMEI 1 deve ter exatamente 15 numeros',
            path: ['specs', 'imei1'],
        });
    }

    const imei2 = data.specs?.imei2;
    if (imei2 !== undefined && imei2 !== null && String(imei2).trim() !== '' && !IMEI_REGEX.test(String(imei2).trim())) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'IMEI 2 deve ter exatamente 15 numeros',
            path: ['specs', 'imei2'],
        });
    }
});

export type ProductSchemaType = z.infer<typeof productSchema>;

/**
 * Validate product data
 */
export function validateProduct(data: unknown) {
    return productSchema.safeParse(data);
}
