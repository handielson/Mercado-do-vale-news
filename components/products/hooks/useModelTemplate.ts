import { useEffect } from 'react';
import { UseFormSetValue } from 'react-hook-form';
import { Model } from '../../../types/model';
import { UNIQUE_FIELDS } from '../../../config/product-fields';
import { toast } from 'sonner';

/**
 * Hook para preencher formulário automaticamente com valores do template do modelo
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Integrado com sistema de custom_fields
 * - Filtra campos únicos (IMEI, Serial, Cor, EAN, SKU)
 * - Preenche apenas valores padrão do modelo
 */
export function useModelTemplate(
    selectedModel: Model | undefined,
    setValue: UseFormSetValue<any>,
    skipApply = false
) {
    useEffect(() => {
        if (!selectedModel) return;
        // Em modo de edição, não sobrescrever os dados do produto
        if (skipApply) return;

        // Use async IIFE to handle async operations
        (async () => {
            console.log('🔍 useModelTemplate - Model selected:', {
                name: selectedModel.name,
                hasTemplateValues: !!selectedModel.template_values,
                templateValues: selectedModel.template_values,
                category_id: selectedModel.category_id,
                description: selectedModel.description,
                brand_id: selectedModel.brand_id
            });

            let fieldsFilledCount = 0;

            // 1. Preencher marca (buscar nome da marca pelo brand_id)
            if (selectedModel.brand_id) {
                try {
                    const { brandService } = await import('../../../services/brands');
                    const brands = await brandService.list();
                    const brand = brands.find(b => b.id === selectedModel.brand_id);
                    if (brand) {
                        setValue('brand', brand.name);
                        fieldsFilledCount++;
                        console.log(`✅ Filled brand: ${brand.name}`);
                    }
                } catch (error) {
                    console.error('Error loading brand:', error);
                }
            }

            // 2. Preencher categoria
            if (selectedModel.category_id) {
                setValue('category_id', selectedModel.category_id);
                fieldsFilledCount++;
                console.log(`✅ Filled category_id: ${selectedModel.category_id}`);
            }

            // 3. Preencher descrição
            if (selectedModel.description) {
                setValue('description', selectedModel.description);
                fieldsFilledCount++;
                console.log(`✅ Filled description`);
            }

            // 4. Preencher valores do template (se existirem)
            if (selectedModel.template_values && Object.keys(selectedModel.template_values).length > 0) {
                Object.entries(selectedModel.template_values).forEach(([key, value]) => {
                    // Pular campos únicos
                    if (UNIQUE_FIELDS.includes(key)) {
                        console.log(`⏭️ Skipping unique field: ${key}`);
                        return;
                    }

                    // Determinar caminho do campo
                    // Preços: price_* (direto)
                    // Logística: weight_kg (direto), dimensions.* (nested)
                    // Specs: specs.* ou assumir spec se não for preço/logística
                    if (key.startsWith('price_')) {
                        setValue(key, value);
                        console.log(`✅ Filled price field: ${key} = ${value}`);
                    } else if (key === 'weight_kg') {
                        setValue('weight_kg', value);
                        console.log(`✅ Filled logistics field: weight_kg = ${value}`);
                    } else if (key.startsWith('dimensions.')) {
                        setValue(key, value);
                        console.log(`✅ Filled logistics field: ${key} = ${value}`);
                    } else if (key.startsWith('specs.')) {
                        setValue(key, value);
                        console.log(`✅ Filled spec field: ${key} = ${value}`);
                    } else {
                        const seoFields = ['meta_title', 'meta_description', 'keywords', 'slug'];
                        if (seoFields.includes(key)) {
                            setValue(key, value);
                            console.log(`✅ Filled SEO field: ${key} = ${value}`);
                        } else {
                            // Assumir que é spec se não for preço, logística ou SEO
                            setValue(`specs.${key}`, value);
                            console.log(`✅ Filled spec field: specs.${key} = ${value}`);
                        }
                    }

                    fieldsFilledCount++;
                });

                // Mostrar toast ao aplicar template
                if (fieldsFilledCount > 0) {
                    toast.success(`📋 ${fieldsFilledCount} campos preenchidos do template!`);
                }

                console.log(`🎯 Template applied: ${fieldsFilledCount} fields filled from model "${selectedModel.name}"`);
            } // Closing brace for template_values if block

            // Show summary log
            console.log(`✅ useModelTemplate completed: ${fieldsFilledCount} total fields filled`);
        })();
    }, [selectedModel, setValue, skipApply]);
}
