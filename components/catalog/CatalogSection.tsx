import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getEffectivePrice } from '@/hooks/useEffectiveCustomerType';
import { ModernProductCard } from './ModernProductCard';
import { catalogSectionsService } from '@/services/catalogSectionsService';
import type { CatalogSection } from '@/types/catalogSections';
import type { CatalogProduct } from '@/types/catalog';

interface CatalogSectionProps {
    section: CatalogSection;
    onFavorite?: (productId: string) => void;
    onShare?: (product: CatalogProduct) => void;
    favorites?: Set<string>;
}

export function CatalogSectionComponent({ section, onFavorite, onShare, favorites = new Set() }: CatalogSectionProps) {
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const { customer } = useSupabaseAuth();

    useEffect(() => {
        loadProducts();
    }, [section.id]);

    const loadProducts = async () => {
        try {
            setLoading(true);
            const data = await catalogSectionsService.getProductsForSection(section);
            setProducts(data);
        } catch (error) {
            console.error('Erro ao carregar produtos da seção:', error);
        } finally {
            setLoading(false);
        }
    };

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

    // Agrupar por modelo + variação (cor, RAM, storage)
    const groupedProducts = (() => {
        const groups = new Map<string, CatalogProduct>();
        for (const product of products) {
            const key = [
                product.model_id || product.model || product.name,
                product.specs?.color || '',
                product.specs?.ram || '',
                product.specs?.storage || '',
            ].join('|');
            if (groups.has(key)) {
                const existing = groups.get(key)!;
                groups.set(key, {
                    ...existing,
                    stock_quantity: (existing.stock_quantity || 0) + (product.stock_quantity || 0)
                });
            } else {
                groups.set(key, { ...product });
            }
        }
        return Array.from(groups.values());
    })();

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
                {section.show_view_all && (
                    <Link
                        to={section.view_all_url || '/catalog'}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Ver todos
                        <ChevronRight className="w-5 h-5" />
                    </Link>
                )}
            </div>

            {/* Grid/Carousel/Lista de Produtos */}
            {section.layout_style === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {groupedProducts.map((product) => (
                        <ModernProductCard
                            key={`${product.model_id || product.id}-${product.specs?.color || ''}-${product.specs?.ram || ''}-${product.specs?.storage || ''}`}
                            product={product}
                            onFavorite={onFavorite}
                            onShare={onShare}
                            isFavorite={favorites.has(product.id)}
                        />
                    ))}
                </div>
            )}

            {section.layout_style === 'carousel' && (
                <div className="overflow-x-auto">
                    <div className="flex gap-4 pb-4">
                        {groupedProducts.map((product) => (
                            <div key={`${product.model_id || product.id}-${product.specs?.color || ''}-${product.specs?.ram || ''}-${product.specs?.storage || ''}`} className="flex-shrink-0 w-80">
                                <ModernProductCard
                                    product={product}
                                    onFavorite={onFavorite}
                                    onShare={onShare}
                                    isFavorite={favorites.has(product.id)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {section.layout_style === 'list' && (
                <div className="space-y-4">
                    {groupedProducts.map((product) => (
                        <ModernProductCard
                            key={`${product.model_id || product.id}-${product.specs?.color || ''}-${product.specs?.ram || ''}-${product.specs?.storage || ''}`}
                            product={product}
                            onFavorite={onFavorite}
                            onShare={onShare}
                            isFavorite={favorites.has(product.id)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
