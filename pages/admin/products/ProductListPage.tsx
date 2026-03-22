import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Share2, Images, ChevronLeft, ChevronRight, RefreshCw, Video } from 'lucide-react';
import { useProducts } from '../../../hooks/useProducts';
import { ProductFilters } from '../../../components/products/ProductFilters';
import { ProductList } from '../../../components/products/ProductList';
import { Product } from '../../../types/product';
import { ExportCatalogModal } from '../../../components/admin/ExportCatalogModal';
import { supabase } from '../../../services/supabase';
import { toast } from 'sonner';

/**
 * ProductListPage
 * Main page for product management - displays list with filters and actions.
 * Products are loaded instantly from localStorage cache and silently refreshed
 * in the background. A manual "Atualizar" button forces a fresh fetch.
 */
export const ProductListPage: React.FC = () => {
    const navigate = useNavigate();
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);

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

    const handleAutoGenerateVideos = async () => {
        const confirmed = window.confirm(
            `Deseja tentar gerar automaticamente o link de vídeo para TODOS os produtos que ainda não possuem um?\n\nEle buscará pelas Definições da Empresa para montar a URL baseada no SKU de cada produto.`
        );
        if (!confirmed) return;

        setIsGeneratingVideos(true);
        toast.loading('Buscando produtos...', { id: 'auto-video' });

        try {
            const { companySettingsService } = await import('../../../services/companySettingsService');
            const settings = await companySettingsService.get() as any;
            const videoBaseUrl = settings?.synology_video_base_url || settings?.synologyVideoBaseUrl;
            if (!videoBaseUrl) {
                toast.error('URL base do Synology não configurada nas Definições da Empresa.', { id: 'auto-video' });
                return;
            }

            const ext = settings?.synologyVideoExtension || settings?.synology_video_extension || '.mp4';
            const baseUrl = videoBaseUrl.endsWith('/') ? videoBaseUrl : `${videoBaseUrl}/`;

            const { data: eligibleProducts, error: fetchError } = await supabase
                .from('products')
                .select('id, sku')
                .is('video_url', null)
                .not('sku', 'is', null)
                .neq('sku', '');

            if (fetchError) throw new Error(fetchError.message);

            if (!eligibleProducts || eligibleProducts.length === 0) {
                toast.success('Nenhum produto precisava de link de vídeo ou com SKU vazio.', { id: 'auto-video' });
                return;
            }

            toast.loading(`Atualizando ${eligibleProducts.length} produto(s)...`, { id: 'auto-video' });

            let updatedCount = 0;
            for (const prod of eligibleProducts) {
                if (!prod.sku) continue;
                
                const candidateUrl = `${baseUrl}${prod.sku.replace(/\s+/g, '')}${ext}`;
                const { error: updateError } = await supabase
                    .from('products')
                    .update({ video_url: candidateUrl })
                    .eq('id', prod.id);
                
                if (!updateError) {
                    updatedCount++;
                }
            }

            toast.success(`Pronto! ${updatedCount} links de vídeo foram gerados.`, { id: 'auto-video' });
            refresh();
        } catch (error) {
            console.error('Error generating videos:', error);
            toast.error('Ocorreu um erro ao gerar links de vídeo em massa.', { id: 'auto-video' });
        } finally {
            setIsGeneratingVideos(false);
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
                        onClick={handleAutoGenerateVideos}
                        disabled={isGeneratingVideos}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60"
                        title="Gerar e vincular vídeos automaticamente para todos os produtos com SKU que ainda não tenham um vídeo associado"
                    >
                        <Video className={`w-5 h-5 ${isGeneratingVideos ? 'animate-pulse' : ''}`} />
                        <span className="font-medium">Gerar Links de Vídeo</span>
                    </button>
                    <button
                        onClick={handleBulkRegistration}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                    >
                        <Package className="w-5 h-5" />
                        <span className="font-medium">Cadastro em Massa</span>
                    </button>
                    <button
                        onClick={() => navigate('/admin/products/combos')}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
                    >
                        <Package className="w-5 h-5" />
                        <span className="font-medium">Combos</span>
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
                                    <option value={100}>100</option>
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
