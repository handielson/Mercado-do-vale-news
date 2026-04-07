import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Package, ChevronDown, ChevronUp, GripVertical, Loader2, Plus, Trash2 } from 'lucide-react';
import { vpsApiService } from '../../services/vpsApiService';
import { toast } from 'react-hot-toast';

interface CategoryProduct {
    id: string;
    name: string;
    sku: string;
    brand: string;
    category_id: string;
    status: string;
    price_retail: number;
    stock_quantity: number;
    thumbnail: string | null;
    is_primary_category: boolean;
}

interface CategoryProductsPanelProps {
    categoryId: string;
    categoryName: string;
    // Callback: outro componente chamará para saber qual produto está sendo arrastado
    onDragStart: (product: CategoryProduct, sourceCategoryId: string) => void;
    // Dados do produto sendo arrastado de outra categoria
    draggedProduct: { product: CategoryProduct; sourceCategoryId: string } | null;
    onDragEnd: () => void;
}

export const CategoryProductsPanel: React.FC<CategoryProductsPanelProps> = ({
    categoryId,
    categoryName,
    onDragStart,
    draggedProduct,
    onDragEnd,
}) => {
    const [items, setItems] = useState<CategoryProduct[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isDropTarget, setIsDropTarget] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async (p: number, reset: boolean) => {
        setIsLoading(true);
        try {
            const res = await vpsApiService.getProductsByCategory(categoryId, p, 20);
            setItems(prev => reset ? res.items : [...prev, ...res.items]);
            setTotal(res.total);
            setHasMore(res.hasMore);
            setPage(p);
        } catch {
            toast.error('Erro ao carregar produtos da categoria');
        } finally {
            setIsLoading(false);
        }
    }, [categoryId]);

    useEffect(() => {
        load(1, true);
    }, [load]);

    // --- Drop handlers ---
    const handleDragOver = (e: React.DragEvent) => {
        if (!draggedProduct || draggedProduct.sourceCategoryId === categoryId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDropTarget(true);
    };

    const handleDragLeave = () => setIsDropTarget(false);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDropTarget(false);
        console.log('[CategoryProductsPanel] Drop recebido:', { draggedProduct, categoryId });
        if (!draggedProduct || draggedProduct.sourceCategoryId === categoryId) {
            console.log('[CategoryProductsPanel] Drop ignorado: sem produto arrastado ou mesma categoria');
            return;
        }

        const { product, sourceCategoryId } = draggedProduct;
        const isCtrl = e.ctrlKey || e.metaKey;

        onDragEnd();

        const toastId = toast.loading(
            isCtrl
                ? `Adicionando "${product.name}" também em ${categoryName}...`
                : `Movendo "${product.name}" para ${categoryName}...`
        );

        try {
            if (isCtrl) {
                // Adicionar como categoria extra
                await vpsApiService.addProductCategory(product.id, categoryId);
                toast.success(`"${product.name}" agora aparece em ${categoryName} também!`, { id: toastId });
            } else {
                // Mover (altera categoria principal)
                await vpsApiService.moveProductCategory(product.id, categoryId);
                toast.success(`"${product.name}" movido para ${categoryName}!`, { id: toastId });
                // Invalida cache da categoria de origem
                vpsApiService.clearCache();
            }
            // Recarrega esta category
            load(1, true);
        } catch {
            toast.error('Erro ao mover produto', { id: toastId });
        }
    };

    const handleRemoveExtra = async (product: CategoryProduct) => {
        const toastId = toast.loading(`Removendo de ${categoryName}...`);
        try {
            await vpsApiService.removeProductCategory(product.id, categoryId);
            setItems(prev => prev.filter(p => p.id !== product.id));
            setTotal(prev => prev - 1);
            toast.success('Removido desta categoria', { id: toastId });
        } catch {
            toast.error('Erro ao remover', { id: toastId });
        }
    };

    const isDraggingFromOther = draggedProduct && draggedProduct.sourceCategoryId !== categoryId;

    useEffect(() => {
        console.log(`[CategoryProductsPanel ${categoryId}] draggedProduct atualizado:`, draggedProduct);
    }, [draggedProduct, categoryId]);

    return (
        <div
            ref={dropRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`transition-all duration-200 rounded-b-lg border-x border-b overflow-hidden ${
                isDropTarget
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400 ring-inset'
                    : isDraggingFromOther
                    ? 'border-dashed border-slate-300 bg-slate-50'
                    : 'border-slate-200 bg-slate-50'
            }`}
        >
            {/* Drop hint */}
            {isDraggingFromOther && (
                <div className={`py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                    isDropTarget ? 'text-blue-700' : 'text-slate-400'
                }`}>
                    <Plus className="w-4 h-4" />
                    {isDropTarget
                        ? `Soltar aqui para ${draggedProduct!.product && 'Ctrl' ? 'adicionar também' : 'mover'} para ${categoryName}`
                        : `Solte aqui para mover • Com Ctrl = adicionar também`
                    }
                </div>
            )}

            {/* Product list */}
            <div className="divide-y divide-slate-200">
                {isLoading && items.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Carregando produtos...
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        Nenhum produto nesta categoria
                    </div>
                ) : (
                    items.map(product => (
                        <div
                            key={product.id}
                            draggable
                            onDragStart={e => {
                                console.log('[CategoryProductsPanel] Iniciando drag:', product.name);
                                e.dataTransfer.effectAllowed = 'move';
                                onDragStart(product, categoryId);
                            }}
                            onDragEnd={() => {
                                console.log('[CategoryProductsPanel] Drag finalizado (NÃO limpando draggedProduct ainda)');
                                // NÃO chamar onDragEnd aqui! Deixar a página limpar quando o drop terminar
                            }}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white transition-colors cursor-grab active:cursor-grabbing group"
                        >
                            {/* Grip */}
                            <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />

                            {/* Thumbnail */}
                            <div className="w-8 h-8 rounded border border-slate-200 overflow-hidden flex-shrink-0 bg-white">
                                {product.thumbnail ? (
                                    <img src={product.thumbnail} alt="" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                        <Package className="w-4 h-4" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-slate-400">{product.sku}</span>
                                    {product.brand && (
                                        <span className="text-xs text-slate-400">· {product.brand}</span>
                                    )}
                                    {!product.is_primary_category && (
                                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                            Categoria Extra
                                        </span>
                                    )}
                                    {product.status !== 'active' && (
                                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                                            {product.status}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Stock */}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                                product.stock_quantity > 0
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-600'
                            }`}>
                                {product.stock_quantity} un
                            </span>

                            {/* Price — stored as INTEGER CENTS (4900 = R$ 49,00) */}
                            <span className="text-sm font-medium text-slate-700 flex-shrink-0 w-28 text-right whitespace-nowrap">
                                {parseFloat(String(product.price_retail)) > 0
                                    ? (parseFloat(String(product.price_retail)) / 100).toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                        minimumFractionDigits: 2,
                                    })
                                    : '-'
                                }
                            </span>

                            {/* Remove extra-category button */}
                            {!product.is_primary_category && (
                                <button
                                    onClick={() => handleRemoveExtra(product)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0"
                                    title="Remover desta categoria extra"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Footer: total + load more */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-white">
                <span className="text-xs text-slate-400">
                    {isLoading ? 'Carregando...' : `${items.length} de ${total} produto${total !== 1 ? 's' : ''}`}
                </span>
                {hasMore && (
                    <button
                        onClick={() => load(page + 1, false)}
                        disabled={isLoading}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-40 font-medium"
                    >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
                        Carregar mais
                    </button>
                )}
            </div>
        </div>
    );
};
