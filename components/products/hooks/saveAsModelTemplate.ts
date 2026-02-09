import { ProductInput } from '../../../types/product';
import { modelService } from '../../../services/models';
import { UNIQUE_FIELDS } from '../../../config/product-fields';

/**
 * Salva valores do produto como template do modelo
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Extrai todos os campos não-únicos do produto
 * - Salva como template_values no modelo
 * - Inclui categoria, descrição, preços e specs
 * - Filtra campos únicos (IMEI, Serial, Cor, EAN, SKU)
 */
export async function saveAsModelTemplate(
    productData: ProductInput,
    modelId: string
): Promise<void> {
    try {
        // Extrair valores para o template
        const templateValues: Record<string, any> = {};

        // 1. Preços
        if (productData.price_cost) templateValues.price_cost = productData.price_cost;
        if (productData.price_retail) templateValues.price_retail = productData.price_retail;
        if (productData.price_reseller) templateValues.price_reseller = productData.price_reseller;
        if (productData.price_wholesale) templateValues.price_wholesale = productData.price_wholesale;

        // 2. Especificações (excluindo campos únicos)
        if (productData.specs) {
            Object.entries(productData.specs).forEach(([key, value]) => {
                // Pular campos únicos
                if (UNIQUE_FIELDS.includes(key)) {
                    console.log(`⏭️ Skipping unique field from template: ${key}`);
                    return;
                }

                // Adicionar ao template
                if (value !== null && value !== undefined && value !== '') {
                    templateValues[key] = value;
                }
            });
        }

        // 3. Outros campos relevantes
        if (productData.ncm) templateValues.ncm = productData.ncm;
        if (productData.cest) templateValues.cest = productData.cest;
        if (productData.origin) templateValues.origin = productData.origin;
        if (productData.weight_kg) templateValues.weight_kg = productData.weight_kg;
        if (productData.dimensions) templateValues.dimensions = productData.dimensions;

        // Buscar modelo atual
        const model = await modelService.getById(modelId);

        // Atualizar modelo com template
        await modelService.update(modelId, {
            name: model.name,
            brand_id: model.brand_id,
            active: model.active,
            category_id: productData.category_id || model.category_id,
            description: productData.description || model.description,
            template_values: templateValues
        });

        console.log('✅ Template saved successfully:', templateValues);
    } catch (error) {
        console.error('❌ Error saving template:', error);
        throw error;
    }
}
