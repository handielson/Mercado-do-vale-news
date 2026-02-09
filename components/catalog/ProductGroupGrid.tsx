import { ModernProductCard } from './ModernProductCard';
import type { ProductGroup } from '@/types/catalog';

interface ProductGroupGridProps {
    groups: ProductGroup[];
    loading?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    onFavorite?: (productId: string) => void;
    onShare?: (groupKey: string) => void;
    favorites?: Set<string>;
    variant?: 'grid' | 'list';
    columns?: {
        mobile?: number;
        tablet?: number;
        desktop?: number;
        wide?: number;
    };
}

// Skeleton loader para ProductCard
function ProductCardSkeleton() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-pulse">
            <div className="aspect-[4/3] bg-slate-200" />
            <div className="p-4">
                <div className="h-4 bg-slate-200 rounded mb-2" />
                <div className="h-3 bg-slate-200 rounded w-2/3 mb-4" />
                <div className="h-6 bg-slate-200 rounded w-1/2 mb-3" />
                <div className="h-10 bg-slate-200 rounded" />
            </div>
        </div>
    );
}

export function ProductGroupGrid({
    groups,
    loading = false,
    hasMore = false,
    onLoadMore,
    onFavorite,
    onShare,
    favorites = new Set(),
    variant = 'grid',
    columns = {
        mobile: 1,
        tablet: 2,
        desktop: 3,
        wide: 4
    }
}: ProductGroupGridProps) {
    // Gerar classes de grid baseado nas colunas
    const gridClasses = `grid gap-4 md:gap-6 ${variant === 'grid'
        ? `grid-cols-${columns.mobile} sm:grid-cols-${columns.tablet} lg:grid-cols-${columns.desktop} xl:grid-cols-${columns.wide}`
        : 'grid-cols-1'
        }`;

    // Estado vazio
    if (!loading && groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                        className="w-12 h-12 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                    </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    Nenhum produto disponível
                </h3>
                <p className="text-slate-600 text-center max-w-md">
                    Não há produtos disponíveis para venda no momento.
                    Volte em breve para conferir novidades!
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Grid de produtos */}
            <div className={gridClasses}>
                {groups.map((group) => (
                    <ModernProductCard
                        key={group.groupKey}
                        product={group.representativeProduct}
                        productGroup={group}
                        onFavorite={onFavorite}
                        onShare={() => onShare?.(group.groupKey)}
                        isFavorite={favorites.has(group.representativeProduct.id)}
                    />
                ))}

                {/* Skeleton loaders durante carregamento */}
                {loading &&
                    Array.from({ length: columns.desktop || 3 }).map((_, i) => (
                        <ProductCardSkeleton key={`skeleton-${i}`} />
                    ))}
            </div>

            {/* Botão "Carregar Mais" */}
            {hasMore && !loading && onLoadMore && (
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={onLoadMore}
                        className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg active:scale-95"
                    >
                        Carregar Mais Produtos
                    </button>
                </div>
            )}

            {/* Loading indicator para infinite scroll */}
            {loading && groups.length > 0 && (
                <div className="mt-8 flex justify-center">
                    <div className="flex items-center gap-3 text-slate-600">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                        <span>Carregando mais produtos...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
