/**
 * BATCH ENTRY STEP - Step 2 of 3
 * 
 * Technical: Shows template data (read-only) and batch entry grid
 * Database: Displays models.template_values, collects data for products table
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { Model } from '../../../../types/model';
import { BatchProductRow } from '../ProductEntryWizard';
import { BatchEntryGrid } from '../components/BatchEntryGrid';
import { UNIQUE_FIELDS } from '../../../../config/product-fields';
import { categoryService } from '../../../../services/categories';

interface BatchEntryStepProps {
    model: Model; // Selected model from Step 1
    templateData: Record<string, any>; // models.template_values
    onComplete: (products: BatchProductRow[]) => void;
    onBack: () => void;
}

export function BatchEntryStep({ model, templateData, onComplete, onBack }: BatchEntryStepProps) {
    // Technical: State for batch products grid
    const [batchProducts, setBatchProducts] = useState<BatchProductRow[]>([]);

    // Technical: State for category configuration
    const [categoryConfig, setCategoryConfig] = useState<any>(null);
    const [loadingConfig, setLoadingConfig] = useState(true);

    // Technical: Load category configuration when model changes
    useEffect(() => {
        const loadCategoryConfig = async () => {
            if (!model.category_id) {
                console.log('⏭️ [BatchEntryStep] No category_id in model, showing all fields');
                setCategoryConfig(null);
                setLoadingConfig(false);
                return;
            }

            try {
                console.log('🔄 [BatchEntryStep] Loading category config for model:', model.name, 'category_id:', model.category_id);
                const category = await categoryService.getById(model.category_id);
                if (category) {
                    console.log('✅ [BatchEntryStep] Category config loaded:', category.name, category.config);
                    setCategoryConfig(category.config);
                } else {
                    console.log('⚠️ [BatchEntryStep] Category not found');
                    setCategoryConfig(null);
                }
            } catch (error) {
                console.error('❌ [BatchEntryStep] Error loading category config:', error);
                setCategoryConfig(null);
            } finally {
                setLoadingConfig(false);
            }
        };

        loadCategoryConfig();
    }, [model.category_id]);

    // Technical: Filter UNIQUE_FIELDS based on category configuration
    // Using useMemo to recalculate when categoryConfig changes
    const relevantFields = useMemo(() => {
        // Wait for config to load before filtering
        if (loadingConfig) {
            console.log('⏳ [BatchEntryStep] Config still loading, returning empty fields');
            return [];
        }

        const filtered = UNIQUE_FIELDS.filter(field => {
            // Always hide SKU and EAN for now (can be added later)
            if (['sku', 'ean'].includes(field)) {
                console.log(`🔍 [BatchEntryStep] Hiding ${field} (SKU/EAN always hidden)`);
                return false;
            }

            // If no category config loaded or no category, show all remaining fields
            if (!categoryConfig) {
                console.log(`🔍 [BatchEntryStep] Showing ${field} (no category config)`);
                return true;
            }

            // Check if field is configured in category
            const configValue = categoryConfig[field];

            console.log(`🔍 [BatchEntryStep] Field ${field}: configValue = ${configValue}`);

            // If field is explicitly set to 'off', hide it
            if (configValue === 'off') {
                console.log(`🔍 [BatchEntryStep] Hiding ${field} (configured as 'off')`);
                return false;
            }

            // Show field if it's required, optional, or not configured
            console.log(`🔍 [BatchEntryStep] Showing ${field} (required/optional/not configured)`);
            return true;
        });

        console.log('✅ [BatchEntryStep] Filtered fields:', filtered);
        return filtered;
    }, [categoryConfig, loadingConfig]);

    // Technical: Count valid products (ready to save)
    const validProductsCount = batchProducts.filter(p => p.isValid).length;

    // Technical: handleContinue - Validate and proceed to confirmation
    const handleContinue = () => {
        if (validProductsCount === 0) {
            alert('Adicione pelo menos um produto válido');
            return;
        }

        // Filter only valid products
        const validProducts = batchProducts.filter(p => p.isValid);
        console.log('✅ [BatchEntryStep] Proceeding with', validProducts.length, 'valid products');
        onComplete(validProducts);
    };

    // Technical: formatTemplateValue - Format template values for display
    const formatTemplateValue = (key: string, value: any): string => {
        if (typeof value === 'number') {
            // Format prices
            if (key.startsWith('price_')) {
                return new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                }).format(value / 100); // Assuming prices are in cents
            }
            // Format weight
            if (key === 'weight_kg') {
                return `${value} kg`;
            }
            // Format dimensions
            if (key.startsWith('dimensions.')) {
                return `${value} cm`;
            }
        }
        return String(value);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Package size={28} className="text-blue-500" />
                    Entrada em Lote
                    <span className="ml-2 text-xs text-slate-400 font-mono font-normal">BatchProductRow[]</span>
                </h2>
                <p className="text-slate-600 mt-1">
                    Preencha os campos únicos de cada produto
                </p>
            </div>

            {/* Technical: Template Data Display (Read-only) */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                    📋 Dados do Template (somente leitura)
                    <span className="ml-2 text-xs text-slate-400 font-mono font-normal">models.template_values</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                        <span className="text-blue-700 font-medium">Modelo:</span>
                        <span className="ml-2 text-blue-900">{model.name}</span>
                    </div>
                    {Object.entries(templateData).map(([key, value]) => (
                        <div key={key}>
                            <span className="text-blue-700 font-medium">{key}:</span>
                            <span className="ml-2 text-blue-900">
                                {formatTemplateValue(key, value)}
                            </span>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-blue-600 mt-3">
                    💡 Estes valores serão aplicados automaticamente a todos os produtos do lote
                </p>
            </div>

            {/* Technical: Batch Entry Grid */}
            <div>
                <h3 className="font-medium text-slate-800 mb-3">
                    Cadastrar Produtos (preencha os campos únicos)
                    <span className="ml-2 text-xs text-slate-400 font-mono">specs.imei1 | specs.imei2 | specs.serial | specs.color | specs.storage | specs.ram</span>
                </h3>
                <BatchEntryGrid
                    rows={batchProducts}
                    onChange={setBatchProducts}
                    uniqueFields={relevantFields}
                />
            </div>

            {/* Technical: Products Counter */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <span className="text-slate-700">
                        📊 Produtos prontos para salvar:
                    </span>
                    <span className="text-2xl font-bold text-blue-600">
                        {validProductsCount}
                    </span>
                </div>
                {batchProducts.length > validProductsCount && (
                    <p className="text-xs text-amber-600 mt-2">
                        ⚠️ {batchProducts.length - validProductsCount} produto(s) com erros ou incompletos
                    </p>
                )}
            </div>

            {/* Technical: Action Buttons */}
            <div className="flex justify-between pt-4 border-t border-slate-200">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-6 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                    <ChevronLeft size={18} />
                    Voltar
                </button>
                <button
                    onClick={handleContinue}
                    disabled={validProductsCount === 0}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                    Continuar
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}
