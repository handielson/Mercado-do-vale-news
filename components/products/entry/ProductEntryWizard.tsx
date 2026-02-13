/**
 * PRODUCT ENTRY WIZARD - Main Component
 * 
 * Technical Names Reference:
 * - Component: ProductEntryWizard
 * - State: ProductEntryState
 * - Steps: IdentificationStep, BatchEntryStep, ConfirmationStep
 * - Database: products table, models table
 */

import React, { useState } from 'react';
import { Model } from '../../../types/model';
import { ProductInput } from '../../../types/product';
import { IdentificationStep } from './steps/IdentificationStep';
import { BatchEntryStep } from './steps/BatchEntryStep';
import { ConfirmationStep } from './steps/ConfirmationStep';
import { ProgressIndicator } from './components/ProgressIndicator';

// Technical: BatchProductRow - Represents one row in the batch entry grid
export interface BatchProductRow {
    id: string; // UUID temporário (não salvo no banco)
    imei1?: string; // products.specs.imei1
    imei2?: string; // products.specs.imei2
    serial?: string; // products.specs.serial
    color?: string; // products.specs.color
    storage?: string; // products.specs.storage
    ram?: string; // products.specs.ram
    ean?: string; // products.eans[]
    isValid: boolean; // Validação local
    errors: Record<string, string>; // Erros por campo
}

// Technical: ProductEntryState - Main wizard state
interface ProductEntryState {
    currentStep: number; // 0=Identification, 1=BatchEntry, 2=Confirmation
    selectedModel?: Model; // models table record
    templateData: Record<string, any>; // models.template_values
    batchProducts: BatchProductRow[]; // Array de produtos para salvar
}

interface ProductEntryWizardProps {
    onComplete: (products: ProductInput[]) => Promise<void>;
    onCancel: () => void;
}

export function ProductEntryWizard({ onComplete, onCancel }: ProductEntryWizardProps) {
    const [state, setState] = useState<ProductEntryState>({
        currentStep: 0,
        templateData: {},
        batchProducts: []
    });

    const steps = [
        { id: 'identification', title: 'Identificação', icon: '🔍' },
        { id: 'batch_entry', title: 'Entrada em Lote', icon: '📝' },
        { id: 'confirmation', title: 'Confirmação', icon: '✅' }
    ];

    // Technical: handleModelSelected - Called when user selects a model in Step 1
    const handleModelSelected = (model: Model) => {
        console.log('📋 [ProductEntryWizard] Model selected:', model.name);
        console.log('📋 [ProductEntryWizard] Template values:', model.template_values);

        setState(prev => ({
            ...prev,
            selectedModel: model,
            templateData: model.template_values || {},
            currentStep: 1
        }));
    };

    // Technical: handleBatchComplete - Called when user completes batch entry grid
    const handleBatchComplete = (products: BatchProductRow[]) => {
        console.log('📊 [ProductEntryWizard] Batch complete:', products.length, 'products');

        setState(prev => ({
            ...prev,
            batchProducts: products,
            currentStep: 2
        }));
    };

    // Technical: handleConfirm - Final save to database
    const handleConfirm = async () => {
        console.log('💾 [ProductEntryWizard] Saving batch to database...');

        // Convert BatchProductRow[] to ProductInput[]
        const productsToSave: ProductInput[] = state.batchProducts.map(row => ({
            // From template (models.template_values)
            ...state.templateData,

            // From model
            model_id: state.selectedModel?.id,
            brand_id: state.selectedModel?.brand_id,
            category_id: state.selectedModel?.category_id,

            // From batch row (unique fields)
            specs: {
                imei1: row.imei1,
                imei2: row.imei2,
                serial: row.serial,
                color: row.color,
                storage: row.storage,
                ram: row.ram
            },
            eans: row.ean ? [row.ean] : undefined,

            // Default values
            active: true,
            status: 'DISPONIVEL'
        }));

        await onComplete(productsToSave);
    };

    // Technical: handleBack - Navigate to previous step
    const handleBack = () => {
        setState(prev => ({
            ...prev,
            currentStep: Math.max(0, prev.currentStep - 1)
        }));
    };

    return (
        <div className="max-w-6xl mx-auto">
            {/* Technical: ProgressIndicator - Shows current step */}
            <ProgressIndicator
                steps={steps}
                currentStep={state.currentStep}
            />

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mt-6">
                {/* Technical: Step 1 - IdentificationStep */}
                {state.currentStep === 0 && (
                    <IdentificationStep
                        onModelSelected={handleModelSelected}
                        onCancel={onCancel}
                    />
                )}

                {/* Technical: Step 2 - BatchEntryStep */}
                {state.currentStep === 1 && state.selectedModel && (
                    <BatchEntryStep
                        model={state.selectedModel}
                        templateData={state.templateData}
                        onComplete={handleBatchComplete}
                        onBack={handleBack}
                    />
                )}

                {/* Technical: Step 3 - ConfirmationStep */}
                {state.currentStep === 2 && (
                    <ConfirmationStep
                        model={state.selectedModel!}
                        products={state.batchProducts}
                        templateData={state.templateData}
                        onConfirm={handleConfirm}
                        onBack={handleBack}
                    />
                )}
            </div>
        </div>
    );
}
