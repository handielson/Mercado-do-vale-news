import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductEntryForm } from '../../../components/products/ProductEntryForm';
import { productService } from '../../../services/products';
import type { ProductInput } from '../../../types/product';

/**
 * ProductEntryPage - New Simplified Product Entry
 * 
 * Route: /admin/products/new-entry
 * 
 * This is the NEW product entry page with simplified workflow.
 * After testing and approval, this will replace /admin/products/new
 */
export const ProductEntryPage: React.FC = () => {
    const navigate = useNavigate();

    const handleSubmit = async (data: ProductInput) => {
        try {
            await productService.create(data);
            toast.success('Produto cadastrado com sucesso!');
            navigate('/admin/products');
        } catch (error) {
            console.error('Error creating product:', error);
            toast.error('Erro ao cadastrar produto');
        }
    };

    const handleCancel = () => {
        navigate('/admin/products');
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-5xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Nova Entrada de Produto
                    </h1>
                    <p className="text-slate-600 mt-1">
                        Formulário simplificado com auto-preenchimento
                    </p>
                </div>

                <ProductEntryForm
                    onSubmit={handleSubmit}
                    onCancel={handleCancel}
                />
            </div>
        </div>
    );
};
