import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useVpsAuth } from '@/contexts/VpsAuthContext';
import { getEffectivePrice } from '@/hooks/useEffectiveCustomerType';
import { ModernProductCard } from './ModernProductCard';
import { ProductCardSkeleton } from './ProductGroupGrid';
import { catalogSectionsService } from '@/services/catalogSectionsService';
import type { CatalogSection } from '@/types/catalogSections';
import type { CatalogProduct } from '@/types/catalog';
import { groupProductsByVariants } from '@/services/productGrouping';
import { colorService } from '@/services/colors';

// Mapa seguro para Tailwind JIT
const SECTION_MOBILE_GRID: Record<number, string> = { 2: 'grid-cols-2', 4: 'grid-cols-4' };

interface CatalogSectionProps {
    section: CatalogSection;
    onFavorite?: (productId: string) => void;
    onShare?: (product: CatalogProduct) => void;
    favorites?: Set<string>;
    mobileView?: 'grid' | 'list';
}

export function CatalogSectionComponent({ section, onFavorite, onShare, favorites = new Set(), mobileView = 'grid' }: CatalogSectionProps) {
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadWarning, setLoadWarning] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [colorHexMap, setColorHexMap] = useState<Record<string, string>>({});
    const { customer } = useVpsAuth();
    const showSubtitle = Boolean(section.subtitle)
        && !['recent', 'featured', 'bestsellers'].includes(section.section_type);
    const categoryId = section.filter_categories?.length === 1 ? section.filter_categories[0] : undefined;
    const viewAllUrl = section.view_all_url || (categoryId ? `/?categoria=${encodeURIComponent(categoryId)}` : undefined);

    useEffect(() => {
        let current = true;
        loadProducts(() => current);
        // Carrega cores do banco uma vez (para resolver hex dinamicamente)
        colorService.listActive().then(colors => {
            const map: Record<string, string> = {};
            colors.forEach(c => { if (c.hex_code) map[c.name] = c.hex_code; });
            setColorHexMap(map);
        }).catch(() => {}); // silencia erro — fallback para COLOR_MAP
        return () => { current = false; };
    }, [section.id, customer?.id, customer?.customer_type, retryCount]);

    const loadProducts = async (isCurrent: () => boolean) => {
        try {
            setLoading(true);
            setLoadWarning(null);
            const bypassCache = customer?.customer_type === 'ADMIN' || retryCount > 0;
            const data = await catalogSectionsService.getProductsForSection(section, bypassCache, () => {
                if (isCurrent()) setLoadWarning('Não foi possível atualizar os produtos. Exibindo dados dos últimos cinco minutos; preços e disponibilidade podem ter mudado.');
            });
            if (isCurrent()) setProducts(data);
        } catch (error) {
            console.error('Erro ao carregar produtos da seção:', error);
            if (isCurrent()) {
                setProducts([]);
                setLoadWarning('Não foi possível carregar os produtos desta seção. Tente novamente.');
            }
        } finally {
            if (isCurrent()) setLoading(false);
        }
    };

    const displayItems = React.useMemo(() => {
        // Todas as secoes usam a mesma familia, com memorias e cores dentro do card.
        // A ordem das familias acompanha a primeira variacao na ordenacao da secao.
        const items = groupProductsByVariants(products, false, colorHexMap).map(group => ({
            key: group.groupKey,
            product: group.representativeProduct,
            productGroup: group
        }));
        
        // Garante que a seção exibe exatamente no máximo X CARDS, e não apenas X produtos brutos
        return items.slice(0, section.max_products);

    }, [products, colorHexMap, section.max_products]);

    if (loading) {
        return (
            <section className="py-3 sm:py-8">
                <div className="mb-4 flex items-center justify-between sm:mb-6">
                    <div className="animate-pulse">
                        <div className="h-7 bg-slate-200 rounded w-40" />
                        {showSubtitle && <div className="h-4 bg-slate-100 rounded w-64 max-w-full mt-2" />}
                    </div>
                    {section.show_view_all && viewAllUrl && <div className="h-5 bg-slate-100 rounded w-16 animate-pulse" />}
                </div>
                <div className="grid gap-2 sm:gap-4 md:gap-6 grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: Math.min(section.max_products || 8, 8) }).map((_, i) => (
                        <ProductCardSkeleton key={i} />
                    ))}
                </div>
            </section>
        );
    }

    if (products.length === 0 && !loadWarning) {
        return null; // Não mostrar seção vazia
    }

    return (
        <section className="py-3 sm:py-8">
            {/* Header da Seção */}
            <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
                    {showSubtitle && (
                        <p className="text-gray-600 mt-1">{section.subtitle}</p>
                    )}
                </div>
                {section.show_view_all && viewAllUrl && (
                    <Link
                        to={viewAllUrl}
                        reloadDocument={!section.view_all_url}
                        className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                    >
                        Ver todos
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                )}
            </div>

            {loadWarning && (
                <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p>{loadWarning}</p>
                    <button type="button" onClick={() => setRetryCount(count => count + 1)} className="shrink-0 rounded-md px-3 py-2 font-medium underline hover:bg-amber-100">
                        Tentar novamente
                    </button>
                </div>
            )}

            {/* Grid/Carousel/Lista de Produtos */}
            {section.layout_style === 'grid' && mobileView === 'list' && (
                <div className="space-y-2">
                    {displayItems.map((item, index) => (
                        <ModernProductCard
                            key={item.key}
                            product={item.product}
                            productGroup={item.productGroup}
                            onFavorite={onFavorite}
                            onShare={onShare ? () => onShare(item.product) : undefined}
                            isFavorite={favorites.has(item.product.id)}
                            listMode
                            priorityImage={index < 1}
                        />
                    ))}
                </div>
            )}

            {section.layout_style === 'grid' && mobileView === 'grid' && (
                <div className="grid gap-2 sm:gap-4 md:gap-6 grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {displayItems.map((item, index) => (
                        <ModernProductCard
                            key={item.key}
                            product={item.product}
                            productGroup={item.productGroup}
                            onFavorite={onFavorite}
                            onShare={onShare ? () => onShare(item.product) : undefined}
                            isFavorite={favorites.has(item.product.id)}
                            priorityImage={index < 1}
                        />
                    ))}
                </div>
            )}

            {section.layout_style === 'carousel' && (
                <div className="overflow-x-auto">
                    <div className="flex gap-4 pb-4">
                        {displayItems.map((item, index) => (
                            <div key={item.key} className="flex-shrink-0 w-80">
                                <ModernProductCard
                                    product={item.product}
                                    productGroup={item.productGroup}
                                    onFavorite={onFavorite}
                                    onShare={onShare ? () => onShare(item.product) : undefined}
                                    isFavorite={favorites.has(item.product.id)}
                                    priorityImage={index < 1}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {section.layout_style === 'list' && (
                <div className="space-y-4">
                    {displayItems.map((item, index) => (
                        <ModernProductCard
                            key={item.key}
                            product={item.product}
                            productGroup={item.productGroup}
                            onFavorite={onFavorite}
                            onShare={onShare ? () => onShare(item.product) : undefined}
                            isFavorite={favorites.has(item.product.id)}
                            priorityImage={index < 1}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
