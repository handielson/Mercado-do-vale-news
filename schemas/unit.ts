
import { z } from 'zod';
import { UnitStatus, ProductCondition } from '../utils/field-standards';
import { CategoryConfig } from '../types/category';

/**
 * CONDITIONAL UNIT SCHEMA
 * Implements dynamic validation based on category configuration (Traffic Light Pattern)
 */

/**
 * Context for conditional validation
 */
export interface UnitValidationContext {
    categoryConfig: CategoryConfig;
    condition: ProductCondition;
}

/**
 * Base IMEI validation (15 digits, numeric only)
 */
const imeiValidation = z
    .string()
    .length(15, 'IMEI deve ter exatamente 15 dígitos')
    .regex(/^\d+$/, 'IMEI deve conter apenas números');

/**
 * Create conditional unit schema based on category config and condition
 * 
 * Traffic Light Rules:
 * - 'off': Field is not validated (will be hidden in UI)
 * - 'optional': Field can be empty or filled
 * - 'required': Field must be filled and valid
 */
export function createUnitSchema(context: UnitValidationContext) {
    const { categoryConfig, condition } = context;

    return z.object({
        product_id: z.string().min(1, 'Produto é obrigatório'),

        // IMEI 1 - Based on config
        imei_1: categoryConfig.imei === 'required'
            ? imeiValidation
            : categoryConfig.imei === 'optional'
                ? z.string().optional().or(z.literal(''))
                : z.string().optional(), // off - permissive for hidden field

        // IMEI 2 - Based on config (always optional or off)
        imei_2: categoryConfig.imei === 'required' || categoryConfig.imei === 'optional'
            ? z.string().optional().or(z.literal(''))
            : z.string().optional(),

        // Serial Number - Based on config
        serial_number: categoryConfig.serial === 'required'
            ? z.string().min(3, 'Serial deve ter pelo menos 3 caracteres')
            : categoryConfig.serial === 'optional'
                ? z.string().optional().or(z.literal(''))
                : z.string().optional(), // off

        // Condition
        condition: z.nativeEnum(ProductCondition, {
            errorMap: () => ({ message: 'Condição inválida' })
        }),

        // Battery Health - Required if USED AND config allows it
        battery_health:
            condition === ProductCondition.USED && categoryConfig.battery_health === 'required'
                ? z.number().min(0).max(100, 'Saúde da bateria deve estar entre 0 e 100')
                : z.number().optional(),

        // Status
        status: z.nativeEnum(UnitStatus, {
            errorMap: () => ({ message: 'Status inválido' })
        }),

        // Cost Price (always optional)
        cost_price: z.number().optional()
    });
}


/**
 * Type inference from schema
 */
export type UnitSchemaType = z.infer<ReturnType<typeof createUnitSchema>>;

/**
 * Default schema (for phones with new condition)
 */
export const unitSchema = createUnitSchema({
    categoryConfig: {
        imei: 'required',
        serial: 'optional',
        color: 'required',
        storage: 'required',
        ram: 'required',
        version: 'optional',
        battery_health: 'required'
    },
    condition: ProductCondition.NEW
});

/**
 * Simple schema for status updates only
 * Used when updating unit status without full validation
 */
export const unitStatusUpdateSchema = z.object({
    status: z.nativeEnum(UnitStatus, {
        errorMap: () => ({ message: 'Status inválido' })
    })
});
