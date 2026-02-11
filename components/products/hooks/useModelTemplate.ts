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
    skipToast = false
) {
    useEffect(() => {
        if (!selectedModel) return;

        console.log('🔍 useModelTemplate - Model selected:', {
            name: selectedModel.name,
            hasTemplateValues: !!selectedModel.template_values,
            templateValues: selectedModel.template_values,
            category_id: selectedModel.category_id,
            description: selectedModel.description
        });

        // Skip if no template values
        if (!selectedModel.template_values || Object.keys(selectedModel.template_values).length === 0) {
            console.log('⏭️ useModelTemplate - No template values, skipping');
            return;
        }

        let fieldsFilledCount = 0;

        // 1. Preencher categoria
        if (selectedModel.category_id) {
            setValue('category_id', selectedModel.category_id);
            fieldsFilledCount++;
        }

        // 2. Preencher descrição
        if (selectedModel.description) {
            setValue('description', selectedModel.description);
            fieldsFilledCount++;
        }

        // 3. Preencher valores do template (excluindo campos únicos)
        Object.entries(selectedModel.template_values).forEach(([key, value]) => {
            // Pular campos únicos
            if (UNIQUE_FIELDS.includes(key)) {
                console.log(`⏭️ Skipping unique field: ${key}`);
                return;
            }

            // Determinar caminho do campo
            // Se for preço, vai direto (price_retail, price_cost, etc.)
            // Se for spec, vai em specs.{key}
            if (key.startsWith('price_')) {
                setValue(key, value);
                console.log(`✅ Filled price field: ${key} = ${value}`);
            } else if (key.startsWith('specs.')) {
                setValue(key, value);
                console.log(`✅ Filled spec field: ${key} = ${value}`);
            } else {
                // Assumir que é spec se não for preço
                setValue(`specs.${key}`, value);
                console.log(`✅ Filled spec field: specs.${key} = ${value}`);
            }

            fieldsFilledCount++;
        });

        // Mostrar toast apenas se preencheu algum campo
        if (fieldsFilledCount > 0 && !skipToast) {
            toast.success(`📋 ${fieldsFilledCount} campos preenchidos do template!`);
        }

        console.log(`🎯 Template applied: ${fieldsFilledCount} fields filled from model "${selectedModel.name}"`);
    }, [selectedModel, setValue, skipToast]);
}
