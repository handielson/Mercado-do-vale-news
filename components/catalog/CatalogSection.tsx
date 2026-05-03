import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getEffectivePrice } from '@/hooks/useEffectiveCustomerType';
import { ModernProductCard } from './ModernProductCard';
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
    const [colorHexMap, setColorHexMap] = useState<Record<string, string>>({});
    const { customer } = useSupabaseAuth();

    useEffect(() => {
        loadProducts();
        // Carrega cores do banco uma vez (para resolver hex dinamicamente)
        colorService.listActive().then(colors => {
            const map: Record<string, string> = {};
            colors.forEach(c => { if (c.hex_code) map[c.name] = c.hex_code; });
            setColorHexMap(map);
        }).catch(() => {}); // silencia erro — fallback para COLOR_MAP
    }, [section.id]);

    const loadProducts = async () => {
        try {
            setLoading(true);
            const bypassCache = customer?.customer_type === 'ADMIN';
            const data = await catalogSectionsService.getProductsForSection(section, bypassCache);
            setProducts(data);
        } catch (error) {
            console.error('Erro ao carregar produtos da seção:', error);
        } finally {
            setLoading(false);
        }
    };

    // Seções que NÃO devem agrupar (cada cor/variação aparece como card individual)
    const UNGROUPED_SECTION_TYPES = ['recent', 'new', 'bestsellers'];
    const shouldGroup = !UNGROUPED_SECTION_TYPES.includes(section.section_type);

    const displayItems = React.useMemo(() => {
        let items: any[] = [];
        
        if (shouldGroup) {
            // Agrupar por modelo — exibe seletor rico de "X Cores"
            items = groupProductsByVariants(products, false, colorHexMap).map(group => ({
                key: group.groupKey,
                product: group.representativeProduct,
                productGroup: group
            }));
        } else {
            // Sem agrupamento: desduplica apenas o mesmo SKU exato (mesmo modelo+cor+ram+storage)
            const deduplicated = new Map<string, CatalogProduct>();
            for (const p of products) {
                const key = [
                    p.model_id || p.model || p.name,
                    p.specs?.color || '',
                    p.specs?.ram || '',
                    p.specs?.storage || '',
                ].join('|');
                if (!deduplicated.has(key)) {
                    deduplicated.set(key, { ...p });
                }
            }

            items = Array.from(deduplicated.values()).map(p => ({
                key: p.id,
                product: p,
                productGroup: undefined as ProductGroup | undefined
            }));
        }
        
        // Garante que a seção exibe exatamente no máximo X CARDS, e não apenas X produtos brutos
        return items.slice(0, section.max_products);

    }, [products, shouldGroup, colorHexMap, section.max_products]);

    if (loading) {
        return (
            <div className="py-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(section.max_products)].map((_, i) => (
                            <div key={i} className="h-64 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (products.length === 0) {
        return null; // Não mostrar seção vazia
    }

    return (
        <section className="py-8">
            {/* Header da Seção */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
                    {section.subtitle && (
                        <p className="text-gray-600 mt-1">{section.subtitle}</p>
                    )}
                </div>
                {(section.show_view_all && (section.view_all_url || section.category_id)) && (
                    <Link
                        to={section.view_all_url || `/?categoria=${section.category_id}`}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Ver todos
                        <ChevronRight className="w-5 h-5" />
                    </Link>
                )}
            </div>

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
