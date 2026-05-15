import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Share2, Images, ChevronLeft, ChevronRight, RefreshCw, Video, CheckSquare, XSquare, Barcode, Store } from 'lucide-react';
import { useProducts } from '../../../hooks/useProducts';
import { ProductFilters } from '../../../components/products/ProductFilters';
import { ProductList } from '../../../components/products/ProductList';
import { Product } from '../../../types/product';
import { ExportCatalogModal } from '../../../components/admin/ExportCatalogModal';
import { BulkActionBar } from '../../../components/products/BulkActionBar';
import { BulkCategoryModal } from '../../../components/products/BulkCategoryModal';
import { supabase } from '../../../services/supabase';
import { toast } from 'sonner';
import { buildProductVideoUrl } from '../../../utils/video-url';

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

    // Bulk selection state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

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
        if (selectionMode) return; // bloqueia navegação em modo seleção
        const slug = product.name 
            ? product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
            : 'produto';
        navigate(`/admin/products/${product.id}/${slug}`);
    };

    const handleToggleSelect = useCallback((product: Product) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(product.id)) next.delete(product.id);
            else next.add(product.id);
            return next;
        });
    }, []);

    const handleExitSelection = () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
    };

    const handleBulkSuccess = () => {
        handleExitSelection();
        refresh();
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
                
                const candidateUrl = buildProductVideoUrl(videoBaseUrl, prod.sku, ext);
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
            <div className="space-y-3">
                {/* Linha 1: Título + ações principais */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Produtos</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Gerencie o catálogo de produtos do sistema
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Selection mode toggle */}
                        <button
                            onClick={() => selectionMode ? handleExitSelection() : setSelectionMode(true)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors shadow-sm border text-sm font-medium ${
                                selectionMode
                                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                            title={selectionMode ? 'Sair do modo seleção' : 'Ativar modo seleção para edição em lote'}
                        >
                            {selectionMode ? <XSquare className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                            <span>{selectionMode ? 'Cancelar' : 'Selecionar'}</span>
                        </button>

                        {/* Refresh button */}
                        <button
                            onClick={refresh}
                            disabled={isRefreshing}
                            title="Atualizar dados sem recarregar a página"
                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors shadow-sm disabled:opacity-60 text-sm"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            <span className="font-medium">
                                {isRefreshing ? 'Atualizando...' : 'Atualizar'}
                            </span>
                            {cacheAge && !isRefreshing && (
                                <span className="text-xs text-slate-400 font-normal">({cacheAge})</span>
                            )}
                        </button>

                        {/* Novo Produto — ação principal em destaque */}
                        <button
                            onClick={handleNewProduct}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            Novo Produto
                        </button>
                    </div>
                </div>

                {/* Linha 2: Ações secundárias */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mr-1">Ferramentas:</span>
                    <button
                        onClick={() => navigate('/admin/products/labels')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-xs font-medium"
                    >
                        <Barcode className="w-3.5 h-3.5" />
                        Etiquetas
                    </button>
                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm text-xs font-medium"
                    >
                        <Share2 className="w-3.5 h-3.5" />
                        Exportar Catálogo
                    </button>
                    <button
                        onClick={() => navigate('/admin/products/image-bank')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm text-xs font-medium"
                    >
                        <Images className="w-3.5 h-3.5" />
                        Banco de Imagens
                    </button>
                    <button
                        onClick={handleAutoGenerateVideos}
                        disabled={isGeneratingVideos}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60 text-xs font-medium"
                        title="Gerar links de vídeo para todos os produtos com SKU sem vídeo"
                    >
                        <Video className={`w-3.5 h-3.5 ${isGeneratingVideos ? 'animate-pulse' : ''}`} />
                        Gerar Links de Vídeo
                    </button>
                    <button
                        onClick={handleBulkRegistration}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm text-xs font-medium"
                    >
                        <Package className="w-3.5 h-3.5" />
                        Cadastro em Massa
                    </button>
                    <button
                        onClick={() => navigate('/admin/products/offers')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-sm text-xs font-medium"
                    >
                        <Store className="w-3.5 h-3.5" />
                        Ofertas
                    </button>
                    <button
                        onClick={() => navigate('/admin/products/combos')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm text-xs font-medium"
                    >
                        <Package className="w-3.5 h-3.5" />
                        Combos
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
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
            />

            {/* Bulk Action Bar */}
            <BulkActionBar
                selectedCount={selectedIds.size}
                onChangeCategoryClick={() => setIsBulkModalOpen(true)}
                onClearSelection={handleExitSelection}
            />

            {/* Bulk Category Modal */}
            <BulkCategoryModal
                isOpen={isBulkModalOpen}
                selectedCount={selectedIds.size}
                selectedIds={Array.from(selectedIds)}
                onClose={() => setIsBulkModalOpen(false)}
                onSuccess={handleBulkSuccess}
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
