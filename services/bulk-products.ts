import { BulkImportPlan, BulkProductPreview, BulkProductRow, BulkProductValidation, BulkUploadResult } from '../types/bulk-product';
import { productService } from './products';
import { categoryService } from './categories';
import { readExcelObjects } from '../utils/excel';
import {
    buildBulkImportPlan,
    buildBulkProductTemplateExampleRows,
    buildBulkProductTemplateHeaders,
    normalizeBulkImportRows,
    validateBulkImportRows,
} from './bulkProductImportCore.js';

/**
 * Parse Excel file to normalized product import rows.
 */
export async function parseExcelFile(file: File): Promise<BulkProductRow[]> {
    try {
        const jsonData = await readExcelObjects(file);
        return normalizeBulkImportRows(jsonData) as BulkProductRow[];
    } catch (error) {
        throw new Error('Erro ao processar arquivo Excel');
    }
}

export function buildTemplateHeaders(categoryConfig: Record<string, any> = {}): string[] {
    return buildBulkProductTemplateHeaders({ categoryConfig });
}

export function buildTemplateExampleRows(category: { id?: string; name?: string; config?: Record<string, any> } = {}): Record<string, any>[] {
    return buildBulkProductTemplateExampleRows({
        category,
        categoryConfig: category.config || {},
    });
}

export function validateImportRows(
    rows: BulkProductRow[],
    context: { categoryConfig?: Record<string, any>; existingProductsBySku?: Map<string, any> } = {}
): BulkProductValidation[] {
    return validateBulkImportRows(rows, context) as BulkProductValidation[];
}

export function buildImportPlan(
    rows: BulkProductRow[],
    context: { categoryConfig?: Record<string, any>; existingProductsBySku?: Map<string, any> } = {},
    options: { updateExisting?: boolean; updateMode?: 'filled_only' | 'replace_except_images' } = {}
): BulkImportPlan {
    return buildBulkImportPlan(rows, context, options) as BulkImportPlan;
}

function getRowSerial(row: BulkProductRow): string {
    return String(row.serial || row.specs?.serial || '').trim();
}

function getRowImei1(row: BulkProductRow): string {
    return String(row.imei1 || row.specs?.imei1 || '').trim();
}

function getRowImei2(row: BulkProductRow): string {
    return String(row.imei2 || row.specs?.imei2 || '').trim();
}

/**
 * Legacy validation used by the current preview screen.
 * Kept compatible while the new category-aware preview is introduced.
 */
export async function validateBulkRows(rows: BulkProductRow[]): Promise<BulkProductValidation[]> {
    const validations: BulkProductValidation[] = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const ean = String(row.ean || '').trim();
        const serial = getRowSerial(row);
        const imei1 = getRowImei1(row);
        const imei2 = getRowImei2(row);
        const validation: BulkProductValidation = {
            row: i + 1,
            sku: row.sku || '',
            valid: true,
            errors: [],
            warnings: []
        };

        if (!ean) {
            validation.errors.push('EAN e obrigatorio');
            validation.valid = false;
        } else if (ean.length !== 13) {
            validation.errors.push('EAN deve ter 13 digitos');
            validation.valid = false;
        }

        if (imei1 && imei1.length !== 15) {
            validation.errors.push('IMEI 1 deve ter 15 digitos');
            validation.valid = false;
        }

        if (imei2 && imei2.length !== 15) {
            validation.errors.push('IMEI 2 deve ter 15 digitos');
            validation.valid = false;
        }

        if (!serial) {
            validation.errors.push('Serial e obrigatorio');
            validation.valid = false;
        }

        const duplicateSerial = serial && rows.slice(0, i).find(r => getRowSerial(r) === serial);
        if (duplicateSerial) {
            validation.warnings.push('Serial duplicado neste lote');
        }

        const duplicateIMEI1 = imei1 && rows.slice(0, i).find(r => getRowImei1(r) === imei1);
        if (duplicateIMEI1) {
            validation.warnings.push('IMEI 1 duplicado neste lote');
        }

        validations.push(validation);
    }

    return validations;
}

/**
 * Generate preview of products to be created for the legacy EAN clone flow.
 */
export async function generatePreview(rows: BulkProductRow[]): Promise<BulkProductPreview[]> {
    const previews: BulkProductPreview[] = [];
    const validations = await validateBulkRows(rows);

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const validation = validations[i];

        try {
            const products = await productService.searchByEAN(row.ean || '');

            if (products.length === 0) {
                validation.errors.push('Produto base nao encontrado');
                validation.valid = false;
            }

            const baseProduct = products[0];

            if (baseProduct?.category_id) {
                await categoryService.getById(baseProduct.category_id);
            }

            const uniqueFields: Record<string, any> = {};
            const serial = getRowSerial(row);
            const imei1 = getRowImei1(row);
            const imei2 = getRowImei2(row);
            if (serial) uniqueFields.serial = serial;
            if (imei1) uniqueFields.imei1 = imei1;
            if (imei2) uniqueFields.imei2 = imei2;

            const finalProduct = {
                ...baseProduct,
                specs: {
                    ...(baseProduct?.specs || {}),
                    ...uniqueFields,
                },
                id: undefined,
            };

            previews.push({
                row: i + 1,
                baseProduct,
                uniqueFields,
                finalProduct,
                validation
            });
        } catch (error) {
            validation.errors.push('Erro ao buscar produto base');
            validation.valid = false;

            previews.push({
                row: i + 1,
                baseProduct: null,
                uniqueFields: {},
                finalProduct: null,
                validation
            });
        }
    }

    return previews;
}

/**
 * Create products in bulk.
 */
export async function createBulkProducts(previews: BulkProductPreview[]): Promise<BulkUploadResult> {
    const result: BulkUploadResult = {
        total: previews.length,
        success: 0,
        failed: 0,
        errors: []
    };

    const validPreviews = previews.filter(p => p.validation.valid);

    for (const preview of validPreviews) {
        try {
            await productService.create(preview.finalProduct);
            result.success++;
        } catch (error) {
            result.failed++;
            result.errors.push({
                row: preview.row,
                error: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
    }

    result.failed += previews.length - validPreviews.length;

    return result;
}

export const bulkProductService = {
    parseExcelFile,
    buildTemplateHeaders,
    buildTemplateExampleRows,
    validateImportRows,
    buildImportPlan,
    validateBulkRows,
    generatePreview,
    createBulkProducts
};
