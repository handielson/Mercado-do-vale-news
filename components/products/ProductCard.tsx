
import React, { useState, useEffect } from 'react';
import { Edit, Package, Trash2, Printer, Power, PowerOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '../../types/product';
import { ProductStatus } from '../../utils/field-standards';
import { cn } from '../../utils/cn';
import { getModelImageWithCache } from '../../services/modelImageCache';
import { getCacheBustedUrl } from '../../utils/cache-buster';
import { LabelPrintModal } from './LabelPrintModal';
import { supabase } from '../../services/supabase';

interface ProductCardProps {
    product: Product;
    onEdit?: (product: Product) => void;
    onDelete?: (product: Product) => void;
}

const productImagesCache = new Map<string, string[]>();

const getProductImagesWithCache = async (productId: string): Promise<string[]> => {
    if (productImagesCache.has(productId)) {
        return productImagesCache.get(productId)!;
    }
    try {
        const { data } = await supabase.from('products').select('images').eq('id', productId).single();
        const images = data?.images || [];
        productImagesCache.set(productId, images);
        return images;
    } catch {
        return [];
    }
};

/**
 * ProductCard Component
 * Displays product information in a card format with image, prices, and status
 */
export const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onDelete }) => {
    const [fetchedImages, setFetchedImages] = useState<string[]>([]);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [currentStatus, setCurrentStatus] = useState<ProductStatus>(product.status);
    const [currentStock, setCurrentStock] = useState<number | undefined>(product.stock_quantity);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Update internal state if props change
    useEffect(() => {
        setCurrentStatus(product.status);
        setCurrentStock(product.stock_quantity);
    }, [product.status, product.stock_quantity]);

    const handleToggleStatus = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const newStatus = currentStatus === ProductStatus.ACTIVE ? ProductStatus.INACTIVE : ProductStatus.ACTIVE;
        setIsTogglingStatus(true);
        try {
            const { error } = await supabase
                .from('products')
                .update({ status: newStatus })
                .eq('id', product.id);
            if (error) throw error;
            setCurrentStatus(newStatus);
        } catch (err) {
            console.error('[ProductCard] Erro ao alterar status:', err);
        } finally {
            setIsTogglingStatus(false);
        }
    };

    const handleSyncStock = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!product.bling_id) return;

        setIsSyncing(true);
        try {
            // Chama a rota de proxy do Bling para não expor tokens no client-side
            const res = await fetch(`/api/bling?resource=product-detail&id=${product.bling_id}`);
            if (!res.ok) throw new Error('Falha ao consultar Bling');
            const data = await res.json();
            
            // stock_quantity vem do /estoques/saldos. Se 0, fallback p/ data.estoque
            let parsedStock = Number(data.stock_quantity);
            if ((!parsedStock || parsedStock === 0) && data.estoque) {
                const est = data.estoque;
                parsedStock = est.saldoFisicoTotal ?? est.saldoFisico ?? est.saldoVirtualTotal ?? est.saldoVirtual ?? 0;
                parsedStock = parseFloat(String(parsedStock)) || 0;
                console.log('[ProductCard] Usando fallback estoque:', parsedStock, data.estoque);
            }
            const realStock = !isNaN(parsedStock) ? parsedStock : 0;
            
            if (realStock !== currentStock) {
                const { error } = await supabase
                    .from('products')
                    .update({ stock_quantity: realStock })
                    .eq('id', product.id);
                if (error) throw error;
                
                // Sincroniza stock na VPS: busca o produto completo e faz PUT com merge
                // (PUT na VPS é replace completo — enviar só stock_quantity zerava os outros campos)
                try {
                    const { vpsApiService } = await import('../../services/vpsApiService');
                    const currentVpsProduct = await vpsApiService.getProductById(product.id, true);
                    if (currentVpsProduct) {
                        await vpsApiService.updateProduct(product.id, {
                            ...currentVpsProduct,
                            stock_quantity: realStock,
                        });
                    }
                } catch(e) { console.warn('[ProductCard] VPS stock update failed:', e); }

                setCurrentStock(realStock);
                toast.success(`Estoque sincronizado: ${realStock} un.`);
            } else {
                toast.info(`Estoque já estava atualizado: ${realStock} un.`);
            }
        } catch (err) {
            console.error('[ProductCard] Erro ao sincronizar estoque:', err);
            toast.error('Erro ao sincronizar estoque do Bling');
        } finally {
            setIsSyncing(false);
        }
    };

    // Lazy load individual product images (since useProducts fetches with compact:true which strips images)
    useEffect(() => {
        if (product.images && product.images.length > 0) {
            setFetchedImages(product.images);
            return;
        }

        let isMounted = true;
        
        const loadImages = async () => {
            // 1. Try to fetch the product's own images from Supabase
            const ownImages = await getProductImagesWithCache(product.id);
            if (isMounted && ownImages.length > 0) {
                setFetchedImages(ownImages);
                return;
            }

            // 2. Fallback to model image if product has no specific images
            if (product.model_id) {
                const imageUrl = await getModelImageWithCache(product.model_id, product.specs?.color);
                if (isMounted && imageUrl) {
                    setFetchedImages([imageUrl]);
                }
            }
        };

        loadImages();
        
        return () => { isMounted = false; }
    }, [product.id, product.images, product.model_id, product.specs?.color]);

    const rawCoverImage = fetchedImages.length > 0 ? fetchedImages[0] : null;
    const coverImage = getCacheBustedUrl(rawCoverImage, product.updated || product.created);

    // Format price from centavos to BRL
    const formatPrice = (centavos: number): string => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(centavos / 100);
    };

    // Status badge colors
    const getStatusColor = (status: ProductStatus): string => {
        switch (status) {
            case ProductStatus.ACTIVE:
                return 'bg-green-100 text-green-800 border-green-200';
            case ProductStatus.INACTIVE:
                return 'bg-red-100 text-red-800 border-red-200';
            case ProductStatus.OUT_OF_STOCK:
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case ProductStatus.DISCONTINUED:
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusLabel = (status: ProductStatus): string => {
        switch (status) {
            case ProductStatus.ACTIVE:
                return 'Ativo';
            case ProductStatus.INACTIVE:
                return 'Inativo';
            case ProductStatus.OUT_OF_STOCK:
                return 'Sem Estoque';
            case ProductStatus.DISCONTINUED:
                return 'Descontinuado';
            default:
                return status;
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow duration-200">
            {/* Image */}
            <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden relative">
                {coverImage ? (
                    <img
                        src={coverImage}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <Package className="w-16 h-16 text-slate-300" />
                )}

                {/* Stock Badge */}
                {product.track_inventory && (
                    <div className={cn(
                        'absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold shadow-md',
                        currentStock === 0
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : (currentStock ?? 0) < 5
                                ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                : 'bg-green-100 text-green-700 border border-green-300'
                    )}>
                        {currentStock === 0
                            ? 'Sem Estoque'
                            : `${currentStock} un.`}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 text-sm leading-tight line-clamp-2">{product.name}</h3>
                        {/* Specs: cor + memória/RAM */}
                        <p className="font-mono text-xs text-slate-500 mt-0.5">
                            {[
                                product.specs?.color,
                                product.specs?.storage,
                                product.specs?.ram ? `${product.specs.ram} RAM` : undefined,
                            ].filter(Boolean).join(' · ')}
                        </p>
                        {/* SKU sempre visível */}
                        {product.sku && (
                            <p className="font-mono text-[10px] text-slate-400 mt-0.5">SKU: {product.sku}</p>
                        )}
                        {/* Badge Pai / Variação */}
                        {product.parent_id ? (
                            <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                ↳ Variação
                            </span>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                        {product.bling_id && (
                            <button
                                onClick={handleSyncStock}
                                disabled={isSyncing}
                                className={cn(
                                    "p-1.5 rounded-lg transition-colors group",
                                    isSyncing ? "opacity-50 cursor-not-allowed" : "hover:bg-green-50"
                                )}
                                title="Sincronizar Estoque (Bling)"
                            >
                                <RefreshCw className={cn("w-4 h-4 text-slate-400 group-hover:text-green-600", isSyncing && "animate-spin text-green-600")} />
                            </button>
                        )}
                        <button
                            onClick={() => onEdit?.(product)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar produto"
                        >
                            <Edit className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                            onClick={() => setIsPrintModalOpen(true)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors group"
                            title="Imprimir Etiqueta"
                        >
                            <Printer className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                        </button>
                        <button
                            onClick={handleToggleStatus}
                            disabled={isTogglingStatus}
                            className={cn(
                                'p-1.5 rounded-lg transition-colors group',
                                currentStatus === ProductStatus.ACTIVE
                                    ? 'hover:bg-red-50'
                                    : 'hover:bg-green-50'
                            )}
                            title={currentStatus === ProductStatus.ACTIVE ? 'Inativar produto' : 'Ativar produto'}
                        >
                            {currentStatus === ProductStatus.ACTIVE
                                ? <PowerOff className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                                : <Power className="w-4 h-4 text-slate-400 group-hover:text-green-600" />
                            }
                        </button>
                        <button
                            onClick={() => onDelete?.(product)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors group"
                            title="Excluir produto"
                        >
                            <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
                        </button>
                    </div>
                </div>

                {/* Status Badge */}
                <div>
                    <span className={cn(
                        'inline-block px-2 py-1 text-xs font-medium rounded-md border',
                        getStatusColor(currentStatus)
                    )}>
                        {getStatusLabel(currentStatus)}
                    </span>
                </div>

                {/* Unique Identifiers (IMEI / Serial) */}
                {(product.specs?.imei1 || product.specs?.serial || product.specs?.serial_number) && (
                    <div className="border-t border-slate-100 pt-2 space-y-1">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Identificadores</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            {product.specs?.imei1 && (
                                <span className="font-mono text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                    IMEI1 {product.specs.imei1}
                                </span>
                            )}
                            {product.specs?.imei2 && (
                                <span className="font-mono text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                    IMEI2 {product.specs.imei2}
                                </span>
                            )}
                            {!product.specs?.imei1 && (product.specs?.serial || product.specs?.serial_number) && (
                                <span className="font-mono text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                    Serial {product.specs?.serial || product.specs?.serial_number}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Prices */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Varejo</p>
                        <p className="text-sm font-bold text-blue-600">{formatPrice(product.price_retail)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Revenda</p>
                        <p className="text-sm font-semibold text-slate-700">{formatPrice(product.price_reseller)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Atacado</p>
                        <p className="text-sm font-semibold text-slate-700">{formatPrice(product.price_wholesale)}</p>
                    </div>
                </div>
            </div>

            {/* Print Modal */}
            <LabelPrintModal
                isOpen={isPrintModalOpen}
                onClose={() => setIsPrintModalOpen(false)}
                product={product}
            />
        </div>
    );
};
