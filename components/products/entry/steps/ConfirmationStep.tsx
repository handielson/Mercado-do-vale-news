/**
 * CONFIRMATION STEP - Step 3 of 3
 * 
 * Technical: Shows batch summary and list of products before saving
 * Database: Final review before INSERT into products table
 */

import React from 'react';
import { CheckCircle, ChevronLeft, Save } from 'lucide-react';
import { Model } from '../../../../types/model';
import { BatchProductRow } from '../ProductEntryWizard';

interface ConfirmationStepProps {
    model: Model;
    products: BatchProductRow[];
    templateData: Record<string, any>;
    onConfirm: () => Promise<void>;
    onBack: () => void;
}

export function ConfirmationStep({ model, products, templateData, onConfirm, onBack }: ConfirmationStepProps) {
    const [saving, setSaving] = React.useState(false);

    // Technical: Group products by variation (color + storage)
    const groupedProducts = products.reduce((acc, product) => {
        const key = `${product.color || 'Sem cor'}-${product.storage || 'Sem storage'}`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(product);
        return acc;
    }, {} as Record<string, BatchProductRow[]>);

    // Technical: Calculate total value (if price_retail exists in template)
    const unitPrice = templateData.price_retail || 0;
    const totalValue = unitPrice * products.length;

    // Technical: handleConfirm - Save to database
    const handleConfirm = async () => {
        setSaving(true);
        try {
            await onConfirm();
        } catch (error) {
            console.error('❌ [ConfirmationStep] Error saving:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle size={28} className="text-green-500" />
                    Confirmar Lote
                </h2>
                <p className="text-slate-600 mt-1">
                    Revise os produtos antes de salvar
                </p>
            </div>

            {/* Technical: Batch Summary */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-xl font-bold text-green-900 mb-4">
                    📱 {model.name} - {products.length} unidade{products.length > 1 ? 's' : ''}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {/* Technical: Model info */}
                    <div>
                        <span className="text-green-700 font-medium">Modelo:</span>
                        <span className="ml-2 text-green-900">{model.name}</span>
                    </div>

                    {/* Technical: Variations */}
                    <div>
                        <span className="text-green-700 font-medium">Variações:</span>
                        <ul className="ml-2 text-green-900">
                            {Object.entries(groupedProducts).map(([key, items]) => (
                                <li key={key}>
                                    • {items.length}x {key}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Technical: Price info (if available) */}
                    {unitPrice > 0 && (
                        <>
                            <div>
                                <span className="text-green-700 font-medium">Preço Unitário:</span>
                                <span className="ml-2 text-green-900">
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                    }).format(unitPrice / 100)}
                                </span>
                            </div>
                            <div>
                                <span className="text-green-700 font-medium">Valor Total:</span>
                                <span className="ml-2 text-green-900 font-bold">
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                    }).format(totalValue / 100)}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Technical: Products List */}
            <div>
                <h3 className="font-medium text-slate-800 mb-3">Produtos</h3>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 max-h-96 overflow-y-auto">
                    {products.map((product, index) => (
                        <div key={product.id} className="p-3 hover:bg-slate-50">
                            <div className="flex items-start gap-3">
                                <span className="text-slate-500 font-medium min-w-[2rem]">
                                    {index + 1}.
                                </span>
                                <div className="flex-1 text-sm">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {product.imei1 && (
                                            <div>
                                                <span className="text-slate-600">IMEI 1:</span>
                                                <span className="ml-1 text-slate-900 font-mono">
                                                    {product.imei1}
                                                </span>
                                            </div>
                                        )}
                                        {product.imei2 && (
                                            <div>
                                                <span className="text-slate-600">IMEI 2:</span>
                                                <span className="ml-1 text-slate-900 font-mono">
                                                    {product.imei2}
                                                </span>
                                            </div>
                                        )}
                                        {product.serial && (
                                            <div>
                                                <span className="text-slate-600">Serial:</span>
                                                <span className="ml-1 text-slate-900 font-mono">
                                                    {product.serial}
                                                </span>
                                            </div>
                                        )}
                                        {product.color && (
                                            <div>
                                                <span className="text-slate-600">Cor:</span>
                                                <span className="ml-1 text-slate-900">
                                                    {product.color}
                                                </span>
                                            </div>
                                        )}
                                        {product.storage && (
                                            <div>
                                                <span className="text-slate-600">Storage:</span>
                                                <span className="ml-1 text-slate-900">
                                                    {product.storage}
                                                </span>
                                            </div>
                                        )}
                                        {product.ram && (
                                            <div>
                                                <span className="text-slate-600">RAM:</span>
                                                <span className="ml-1 text-slate-900">
                                                    {product.ram}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Technical: Action Buttons */}
            <div className="flex justify-between pt-4 border-t border-slate-200">
                <button
                    onClick={onBack}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 text-slate-600 hover:text-slate-800 font-medium disabled:opacity-50"
                >
                    <ChevronLeft size={18} />
                    Voltar
                </button>
                <div className="flex gap-3">
                    <button
                        onClick={handleConfirm}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        <Save size={18} />
                        {saving ? 'Salvando...' : 'Salvar Lote'}
                    </button>
                </div>
            </div>
        </div>
    );
}
