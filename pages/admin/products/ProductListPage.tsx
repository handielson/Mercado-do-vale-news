
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Share2, Images, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useProducts } from '../../../hooks/useProducts';
import { ProductFilters } from '../../../components/products/ProductFilters';
import { ProductList } from '../../../components/products/ProductList';
import { Product } from '../../../types/product';
import { ExportCatalogModal } from '../../../components/admin/ExportCatalogModal';

/**
 * ProductListPage
 * Main page for product management - displays list with filters and actions.
 * Products are loaded instantly from localStorage cache and silently refreshed
 * in the background. A manual "Atualizar" button forces a fresh fetch.
 */
export const ProductListPage: React.FC = () => {
    const navigate = useNavigate();
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    const {
        products,
        isLoading,
        isRefreshing,
        error,
        handleFilterChange,
        deleteProduct,
        refresh,
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        totalPages,
        allFilteredProducts,
        cacheAge,
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
                    {/* Refresh button */}
                    <button
                        onClick={refresh}
                        disabled={isRefreshing}
                        title="Atualizar dados sem recarregar a página"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors shadow-sm disabled:opacity-60"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span className="font-medium">
                            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
                        </span>
                        {cacheAge && !isRefreshing && (
                            <span className="text-xs text-slate-400 font-normal">
                                ({cacheAge})
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                    >
                        <Share2 className="w-5 h-5" />
                        <span className="font-medium">Exportar Catálogo</span>
                    </button>
                    <button
                        onClick={() => navigate('/admin/products/image-bank')}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
                    >
                        <Images className="w-5 h-5" />
                        <span className="font-medium">Banco de Imagens</span>
                    </button>
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

            {/* Refreshing banner (shows when refreshing in background while list is visible) */}
            {isRefreshing && allFilteredProducts.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                    <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                    Atualizando lista de produtos em segundo plano...
                </div>
            )}

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

            {/* Results Count and Pagination Controls */}
            {!isLoading && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-500">
                        {allFilteredProducts.length === 0 ? (
                            'Nenhum produto encontrado'
                        ) : (
                            `Exibindo ${products.length} de ${allFilteredProducts.length} ${allFilteredProducts.length === 1 ? 'produto' : 'produtos'}`
                        )}
                    </div>

                    {allFilteredProducts.length > 0 && (
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-500">Itens por pág:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="p-1.5 border border-slate-300 rounded text-sm bg-slate-50"
                                >
                                    <option value={12}>12</option>
                                    <option value={24}>24</option>
                                    <option value={36}>36</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-sm font-medium text-slate-700">
                                    Página {currentPage} de {totalPages || 1}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Export Catalog Modal */}
            <ExportCatalogModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
            />
        </div>
    );
};
