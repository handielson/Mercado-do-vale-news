import { ModernProductCard } from './ModernProductCard';
import type { ProductGroup, CatalogProduct } from '@/types/catalog';

interface ProductGroupGridProps {
    groups: ProductGroup[];
    loading?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    onFavorite?: (productId: string) => void;
    onShare?: (product: CatalogProduct) => void;
    favorites?: Set<string>;
    variant?: 'grid' | 'list';
    columns?: {
        mobile?: number;
        tablet?: number;
        desktop?: number;
        wide?: number;
    };
    priorityImageCount?: number;
    mobileColumns?: 2 | 4; // toggle mobile: 2 colunas (padrão) ou 4
}

// Skeleton loader para ProductCard
export function ProductCardSkeleton() {
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

// Mapa seguro de classes Tailwind — interpolação dinâmica quebra o JIT em produção
const MOBILE_GRID: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
};

export function ProductGroupGrid({
    groups,
    loading = false,
    hasMore = false,
    onLoadMore,
    onFavorite,
    onShare,
    favorites = new Set(),
    variant = 'grid',
    columns = { mobile: 2, tablet: 3, desktop: 4, wide: 5 },
    mobileColumns,
    priorityImageCount = 0,
}: ProductGroupGridProps) {
    const effectiveMobile = mobileColumns ?? columns.mobile ?? 2;

    // Classes seguras — sem interpolação dinâmica
    const tabletClass = columns.tablet === 3 ? 'sm:grid-cols-3' : columns.tablet === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3';
    const desktopClass = columns.desktop === 4 ? 'lg:grid-cols-4' : columns.desktop === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4';
    const wideClass = columns.wide === 5 ? 'xl:grid-cols-5' : columns.wide === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-5';

    const mobileClass = MOBILE_GRID[effectiveMobile] ?? 'grid-cols-2';
    const gapClass = effectiveMobile === 4 ? 'gap-1.5 sm:gap-4 md:gap-6' : 'gap-3 sm:gap-4 md:gap-6';

    const gridClasses = `grid ${gapClass} ${variant === 'grid'
        ? `${mobileClass} ${tabletClass} ${desktopClass} ${wideClass}`
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
            {/* Grid / Lista de produtos */}
            <div className={variant === 'list' ? 'space-y-2' : gridClasses}>
                {groups.map((group, index) => (
                    <ModernProductCard
                        key={group.groupKey}
                        product={group.representativeProduct}
                        productGroup={group}
                        onFavorite={onFavorite}
                        onShare={onShare ? () => onShare(group.representativeProduct) : undefined}
                        isFavorite={favorites.has(group.representativeProduct.id)}
                        listMode={variant === 'list'}
                        priorityImage={index < priorityImageCount}
                    />
                ))}

                {/* Skeleton loaders durante carregamento */}
                {loading &&
                    Array.from({ length: columns.desktop || 4 }).map((_, i) => (
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
