import * as XLSX from 'xlsx';
import { BulkProductRow, BulkProductValidation, BulkProductPreview, BulkUploadResult } from '../types/bulk-product';
import { productService } from './products';
import { categoryService } from './categories';

/**
 * Parse Excel file to array of product rows
 */
export async function parseExcelFile(file: File): Promise<BulkProductRow[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet) as BulkProductRow[];

                // Normalize column names to lowercase
                const normalized = jsonData.map(row => {
                    const normalizedRow: BulkProductRow = { ean: '' };
                    Object.keys(row).forEach(key => {
                        const lowerKey = key.toLowerCase().trim();
                        normalizedRow[lowerKey] = row[key];
                    });
                    return normalizedRow;
                });

                resolve(normalized);
            } catch (error) {
                reject(new Error('Erro ao processar arquivo Excel'));
            }
        };

        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsBinaryString(file);
    });
}

/**
 * Validate bulk product rows
 */
export async function validateBulkRows(rows: BulkProductRow[]): Promise<BulkProductValidation[]> {
    const validations: BulkProductValidation[] = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const validation: BulkProductValidation = {
            row: i + 1,
            valid: true,
            errors: [],
            warnings: []
        };

        // Validate EAN
        if (!row.ean) {
            validation.errors.push('EAN é obrigatório');
            validation.valid = false;
        } else if (row.ean.length !== 13) {
            validation.errors.push('EAN deve ter 13 dígitos');
            validation.valid = false;
        }

        // Validate IMEI format (if provided)
        if (row.imei1 && row.imei1.length !== 15) {
            validation.errors.push('IMEI 1 deve ter 15 dígitos');
            validation.valid = false;
        }

        if (row.imei2 && row.imei2.length !== 15) {
            validation.errors.push('IMEI 2 deve ter 15 dígitos');
            validation.valid = false;
        }

        // Validate Serial
        if (!row.serial || row.serial.trim() === '') {
            validation.errors.push('Serial é obrigatório');
            validation.valid = false;
        }

        // Check for duplicates in the same batch
        const duplicateSerial = rows.slice(0, i).find(r => r.serial === row.serial);
        if (duplicateSerial) {
            validation.warnings.push('Serial duplicado neste lote');
        }

        const duplicateIMEI1 = row.imei1 && rows.slice(0, i).find(r => r.imei1 === row.imei1);
        if (duplicateIMEI1) {
            validation.warnings.push('IMEI 1 duplicado neste lote');
        }

        validations.push(validation);
    }

    return validations;
}

/**
 * Generate preview of products to be created
 */
export async function generatePreview(rows: BulkProductRow[]): Promise<BulkProductPreview[]> {
    const previews: BulkProductPreview[] = [];
    const validations = await validateBulkRows(rows);

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const validation = validations[i];

        try {
            // Search for base product by EAN
            const products = await productService.searchByEAN(row.ean);

            if (products.length === 0) {
                validation.errors.push('Produto base não encontrado');
                validation.valid = false;
            }

            const baseProduct = products[0];

            // Get category configuration
            const category = baseProduct?.category_id
                ? await categoryService.getById(baseProduct.category_id)
                : null;

            // Identify unique fields from category config
            const uniqueFields: Record<string, any> = {};
            if (row.serial) uniqueFields.serial = row.serial;
            if (row.imei1) uniqueFields.imei1 = row.imei1;
            if (row.imei2) uniqueFields.imei2 = row.imei2;

            // Merge base product with unique fields
            const finalProduct = {
                ...baseProduct,
                ...uniqueFields,
                id: undefined, // Remove ID to create new product
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
 * Create products in bulk
 */
export async function createBulkProducts(previews: BulkProductPreview[]): Promise<BulkUploadResult> {
    const result: BulkUploadResult = {
        total: previews.length,
        success: 0,
        failed: 0,
        errors: []
    };

    // Filter only valid products
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
    validateBulkRows,
    generatePreview,
    createBulkProducts
};
