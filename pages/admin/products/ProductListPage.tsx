
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package } from 'lucide-react';
import { useProducts } from '../../../hooks/useProducts';
import { ProductFilters } from '../../../components/products/ProductFilters';
import { ProductList } from '../../../components/products/ProductList';
import { Product } from '../../../types/product';

/**
 * ProductListPage
 * Main page for product management - displays list with filters and actions
 */
export const ProductListPage: React.FC = () => {
    const navigate = useNavigate();
    const {
        products,
        isLoading,
        error,
        handleFilterChange,
        deleteProduct
    } = useProducts();

    const handleNewProduct = () => {
        navigate('/admin/products/new');
    };

    const handleBulkRegistration = () => {
        navigate('/admin/products/bulk');
    };

    const handleEditProduct = (product: Product) => {
        navigate(`/admin/products/${product.id}`);
    };

    const handleDeleteProduct = async (product: Product) => {
        const confirmed = window.confirm(
            `Tem certeza que deseja excluir o produto "${product.name}"?\n\nEsta ação não pode ser desfeita.`
        );

        if (confirmed) {
            await deleteProduct(product.id);
            // Note: refetch is automatic in the hook
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Produtos</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Gerencie o catálogo de produtos do sistema
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleBulkRegistration}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                    >
                        <Package className="w-5 h-5" />
                        <span className="font-medium">Cadastro em Massa</span>
                    </button>
                    <button
                        onClick={handleNewProduct}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium">Novo Produto</span>
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                        <strong>Erro:</strong> {error}
                    </p>
                </div>
            )}

            {/* Filters */}
            <ProductFilters onFilterChange={handleFilterChange} />

            {/* Products List */}
            <ProductList
                products={products}
                isLoading={isLoading}
                onEditProduct={handleEditProduct}
                onDeleteProduct={handleDeleteProduct}
            />

            {/* Results Count */}
            {!isLoading && (
                <div className="text-center text-sm text-slate-500">
                    {products.length === 0 ? (
                        'Nenhum produto encontrado'
                    ) : (
                        `Exibindo ${products.length} ${products.length === 1 ? 'produto' : 'produtos'}`
                    )}
                </div>
            )}
        </div>
    );
};
