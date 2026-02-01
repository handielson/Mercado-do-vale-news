import React from 'react';
import { X } from 'lucide-react';
import { ProductForm } from '../ProductForm';
import { ProductInput } from '../../../types/product';
import { productService } from '../../../services/products';

interface NewProductModalProps {
    ean: string;
    isOpen: boolean;
    onClose: () => void;
    onProductCreated: (product: any) => void;
}

export function NewProductModal({ ean, isOpen, onClose, onProductCreated }: NewProductModalProps) {
    const handleSubmit = async (data: ProductInput) => {
        try {
            // Add EAN to the product data and create in database
            const productData = {
                ...data,
                ean,
                stock_quantity: 0 // Will be incremented when adding units
            };

            // Create product in database
            const createdProduct = await productService.create(productData);

            // Notify parent component
            onProductCreated(createdProduct);
        } catch (error) {
            throw error; // Let ProductForm handle the error
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">🆕 Cadastrar Produto Novo</h2>
                        <p className="text-sm text-slate-600 mt-1">EAN: {ean}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Product Form */}
                <div className="p-6">
                    <ProductForm
                        initialData={{
                            ean,
                            name: '',
                            category_id: '',
                            stock_quantity: 0
                        } as any}
                        onSubmit={handleSubmit}
                        onCancel={onClose}
                    />
                </div>
            </div>
        </div>
    );
}
