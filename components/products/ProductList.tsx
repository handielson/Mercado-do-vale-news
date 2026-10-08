
import React, { useState } from 'react';
import { Copy, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '../../types/product';
import type { TikTokShopProductLink } from '../../services/tiktokShopService';
import type { ProductFamilyGroup } from './ProductFamilyList';
import { ProductCard } from './ProductCard';
import { CatalogTitleEditor } from './CatalogTitleEditor';
import { getProductVariationSpecs } from '../../services/modelProductAggregator.js';

interface ProductListProps {
    products: Product[];
    groups?: ProductFamilyGroup[];
    isLoading: boolean;
    onEditProduct?: (product: Product) => void;
    onDeleteProduct?: (product: Product) => void;
    selectionMode?: boolean;
    selectedIds?: Set<string>;
    onToggleSelect?: (product: Product) => void;
    tiktokProductLinks?: Record<string, TikTokShopProductLink>;
}

function FamilyCard({ group, onEditProduct, onDeleteProduct, selectionMode, selectedIds, onToggleSelect, tiktokProductLinks }: {
    group: ProductFamilyGroup;
    onEditProduct?: (product: Product) => void;
    onDeleteProduct?: (product: Product) => void;
    selectionMode: boolean;
    selectedIds: Set<string>;
    onToggleSelect?: (product: Product) => void;
    tiktokProductLinks: Record<string, TikTokShopProductLink>;
}) {
    const variants = group.familyProducts.filter(product => String(product.id) !== String(group.parent?.id));
    const [selectedId, setSelectedId] = useState(variants[0]?.id || group.representative.id);
    const selected = variants.find(product => product.id === selectedId) || variants[0] || group.representative;
    const label = (product: Product) => {
        const { color } = getProductVariationSpecs(product);
        return String(color || product.name.match(/Cor:\s*([^,]+)/i)?.[1] || product.sku || product.name);
    };
    const memoryGroups = new Map<string, { title: string; products: Product[] }>();
    const memoryValue = (value: string) => value.replace(/\s+/g, '').toUpperCase();
    for (const product of variants) {
        const { ram, storage } = getProductVariationSpecs(product);
        const key = JSON.stringify([memoryValue(ram), memoryValue(storage)]);
        const title = [ram && `${ram} RAM`, storage && `${storage} armazenamento`].filter(Boolean).join(' · ');
        if (!memoryGroups.has(key)) memoryGroups.set(key, { title, products: [] });
        memoryGroups.get(key)!.products.push(product);
    }
    const sortedMemoryGroups = [...memoryGroups.values()].sort((a, b) =>
        a.title.localeCompare(b.title, 'pt-BR', { numeric: true }));
    const hasMemory = sortedMemoryGroups.some(group => group.title);
    const copySku = async (sku: string) => {
        try {
            await navigator.clipboard.writeText(sku);
            toast.success(`SKU ${sku} copiado`);
        } catch {
            toast.error(`Não foi possível copiar o SKU ${sku}`);
        }
    };

    return <div className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-2 border-b border-violet-100 bg-violet-50 px-3 py-2">
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{group.parent?.name || group.representative.name}</p>
                <p className="text-xs text-violet-700">{variants.length} {variants.length === 1 ? 'variação' : 'variações'} no mesmo produto</p>
                {group.parent && <CatalogTitleEditor product={group.parent} />}
            </div>
            {group.parent && onEditProduct && <button type="button" onClick={() => onEditProduct(group.parent!)}
                className="shrink-0 rounded border border-violet-200 px-2 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-100">Editar família</button>}
        </div>
        <ProductCard key={selected.id} product={selected}
            onEdit={onEditProduct ? () => onEditProduct(group.parent || selected) : undefined}
            onDelete={onDeleteProduct}
            selectionMode={selectionMode} isSelected={selectedIds.has(selected.id)} onToggleSelect={onToggleSelect}
            tiktokProductLink={tiktokProductLinks[selected.id] || (group.parent ? tiktokProductLinks[group.parent.id] : null) || null}
            familyVariants={<div className="mt-2 space-y-2 rounded-lg border border-violet-200 bg-violet-50/40 p-2" aria-label="SKUs da família">
                {group.parent?.sku && <button type="button" onClick={(event) => { event.stopPropagation(); void copySku(group.parent!.sku); }}
                    title={`Copiar SKU do pai: ${group.parent.sku}`} aria-label={`Copiar SKU do pai ${group.parent.sku}`}
                    className="inline-flex items-center gap-1 rounded px-1 font-mono text-[11px] text-violet-800 hover:bg-violet-100 hover:underline">
                    Pai: {group.parent.sku} <Copy size={11} />
                </button>}
                {sortedMemoryGroups.map(memoryGroup => <div key={memoryGroup.title} className="space-y-1.5">
                {hasMemory && <p className="text-xs font-semibold text-slate-700">{memoryGroup.title || 'Memória não informada'}</p>}
                <div className="flex flex-wrap gap-1.5">{[...memoryGroup.products].sort((a, b) => label(a).localeCompare(label(b), 'pt-BR')).map(product => <div key={product.id}
                    className={`rounded-md border px-2 py-1 text-xs ${selected.id === product.id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700'}`}>
                    <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedId(product.id); }} aria-pressed={selected.id === product.id}
                        className="font-semibold hover:underline" aria-label={`Selecionar variação ${label(product)}${memoryGroup.title ? ` · ${memoryGroup.title}` : ''}`}>
                        {label(product)}
                    </button>
                    {product.sku ? <button type="button" onClick={(event) => { event.stopPropagation(); void copySku(product.sku); }}
                        title={`Copiar SKU ${product.sku}`} aria-label={`Copiar SKU da variação ${product.sku}`}
                        className="ml-1 inline-flex items-center gap-1 font-mono text-[10px] hover:underline">
                        {product.sku} <Copy size={10} />
                    </button> : <span className="ml-1 font-mono text-[10px]">Sem SKU</span>}
                    <span className="ml-1 text-[10px]">{Number(product.stock_quantity || 0)} un.</span>
                </div>)}</div>
                </div>)}
                {onEditProduct && group.parent && <button type="button" onClick={(event) => { event.stopPropagation(); onEditProduct(selected); }}
                    className="text-xs font-semibold text-blue-700 hover:underline">
                    Editar somente {label(selected)}{hasMemory && ` · ${[getProductVariationSpecs(selected).ram, getProductVariationSpecs(selected).storage].filter(Boolean).join(' / ')}`}
                </button>}
            </div>} />
    </div>;
}

/**
 * ProductList Component
 * Displays a responsive grid of products with loading and empty states
 */
export const ProductList: React.FC<ProductListProps> = ({
    products,
    groups,
    isLoading,
    onEditProduct,
    onDeleteProduct,
    selectionMode = false,
    selectedIds = new Set(),
    onToggleSelect,
    tiktokProductLinks = {},
}) => {
    // Loading State: Show skeleton cards
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        {/* Skeleton Image */}
                        <div className="aspect-square bg-slate-200 animate-pulse" />

                        {/* Skeleton Content */}
                        <div className="p-4 space-y-3">
                            <div className="space-y-2">
                                <div className="h-5 bg-slate-200 rounded animate-pulse w-3/4" />
                                <div className="h-4 bg-slate-200 rounded animate-pulse w-1/2" />
                            </div>
                            <div className="h-6 bg-slate-200 rounded animate-pulse w-20" />
                            <div className="grid grid-cols-3 gap-2 pt-2">
                                <div className="h-10 bg-slate-200 rounded animate-pulse" />
                                <div className="h-10 bg-slate-200 rounded animate-pulse" />
                                <div className="h-10 bg-slate-200 rounded animate-pulse" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Empty State: No products found
    if ((groups ? groups.length : products.length) === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <Package className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">
                    Nenhum produto encontrado
                </h3>
                <p className="text-sm text-slate-500 text-center max-w-md">
                    Tente ajustar os filtros ou adicione novos produtos ao catálogo.
                </p>
            </div>
        );
    }

    // Products Grid
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups ? groups.map(group => group.isFamily
                ? <FamilyCard key={group.key} group={group} onEditProduct={onEditProduct} onDeleteProduct={onDeleteProduct}
                    selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={onToggleSelect} tiktokProductLinks={tiktokProductLinks} />
                : <ProductCard key={group.key} product={group.representative} onEdit={onEditProduct} onDelete={onDeleteProduct}
                    selectionMode={selectionMode} isSelected={selectedIds.has(group.representative.id)} onToggleSelect={onToggleSelect}
                    tiktokProductLink={tiktokProductLinks[group.representative.id] || null} />) : products.map((product) => (
                <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={onEditProduct}
                    onDelete={onDeleteProduct}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(product.id)}
                    onToggleSelect={onToggleSelect}
                    tiktokProductLink={
                        tiktokProductLinks[product.id]
                        || (product.parent_id ? tiktokProductLinks[product.parent_id] : null)
                        || null
                    }
                />
            ))}
        </div>
    );
};
