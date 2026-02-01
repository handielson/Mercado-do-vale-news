
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { ProductForm } from '../../../components/products/ProductForm';
import { Product, ProductInput } from '../../../types/product';
import { productService } from '../../../services/products';

/**
 * ProductFormPage
 * Page for creating new products or editing existing ones
 */
export const ProductFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [product, setProduct] = useState<Product | undefined>();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);

    const isEditMode = id && id !== 'new';

    // Fetch product data if editing
    useEffect(() => {
        if (isEditMode) {
            fetchProduct();
        }
    }, [id]);

    const fetchProduct = async () => {
        if (!id) return;

        try {
            setIsFetching(true);
            const data = await productService.getById(id);
            setProduct(data);
        } catch (error) {
            console.error('Error fetching product:', error);
            toast.error('Erro ao carregar produto');
            navigate('/admin/products');
        } finally {
            setIsFetching(false);
        }
    };

    const handleSubmit = async (data: ProductInput) => {
        try {
            setIsLoading(true);

            if (isEditMode && id) {
                // Update existing product
                await productService.update(id, data);
                toast.success('Produto atualizado com sucesso!');
            } else {
                // Create new product
                await productService.create(data);
                toast.success('Produto criado com sucesso!');
            }

            // Redirect to products list
            navigate('/admin/products');
        } catch (error) {
            console.error('Error saving product:', error);
            const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar produto';
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        navigate('/admin/products');
    };

    // Loading state while fetching
    if (isFetching) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Carregando produto...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleCancel}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        {isEditMode ? 'Editar Produto' : 'Novo Produto'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {isEditMode
                            ? 'Atualize as informações do produto abaixo'
                            : 'Preencha os dados para cadastrar um novo produto'}
                    </p>
                </div>
            </div>

            {/* Form */}
            <ProductForm
                initialData={product}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isLoading={isLoading}
            />
        </div>
    );
};
