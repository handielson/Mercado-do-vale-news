/**
 * ENTRADA PAGE - Product Entry Page
 * 
 * Technical: Main page for bulk product entry using wizard interface
 * Database: Creates records in products table via productService
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductEntryWizard } from '../../components/products/entry/ProductEntryWizard';
import { ProductInput } from '../../types/product';
import { productService } from '../../services/products';
import { Package } from 'lucide-react';

export const EntradaPage: React.FC = () => {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);

    // Technical: handleComplete - Save batch of products to database
    const handleComplete = async (products: ProductInput[]) => {
        setSaving(true);
        try {
            console.log('💾 [EntradaPage] Saving', products.length, 'products to database');

            // Save products one by one (TODO: implement batch insert in service)
            const results = [];
            for (const product of products) {
                try {
                    const saved = await productService.create(product);
                    results.push(saved);
                    console.log('✅ [EntradaPage] Product saved:', saved.id);
                } catch (error) {
                    console.error('❌ [EntradaPage] Error saving product:', error);
                    throw error;
                }
            }

            console.log('✅ [EntradaPage] All products saved successfully');
            toast.success(`${results.length} produto(s) cadastrado(s) com sucesso!`);

            // Navigate to products list
            navigate('/admin/products');
        } catch (error) {
            console.error('❌ [EntradaPage] Error saving batch:', error);
            toast.error('Erro ao salvar produtos. Verifique o console.');
        } finally {
            setSaving(false);
        }
    };

    // Technical: handleCancel - Return to products list
    const handleCancel = () => {
        navigate('/admin/products');
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            {/* Technical: Page Header */}
            <div className="max-w-6xl mx-auto mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <Package size={32} className="text-blue-500" />
                    <h1 className="text-3xl font-bold text-slate-800">
                        Entrada de Produtos
                    </h1>
                </div>
                <p className="text-slate-600">
                    Cadastre múltiplos produtos de forma rápida usando o sistema de entrada em lote
                </p>
            </div>

            {/* Technical: Product Entry Wizard */}
            {saving ? (
                <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
                    <div className="text-blue-500 mb-4">
                        <Package size={48} className="mx-auto animate-pulse" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">
                        Salvando produtos...
                    </h2>
                    <p className="text-slate-600">
                        Aguarde enquanto os produtos são cadastrados no sistema
                    </p>
                </div>
            ) : (
                <ProductEntryWizard
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
};
