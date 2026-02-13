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
}

export function CatalogSectionComponent({ section }: CatalogSectionProps) {
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
                        href={section.view_all_url || '/catalog'}
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
                    {products.map((product) => (
                        <ModernProductCard key={product.id} product={product} />
                    ))}
                </div>
            )}

            {section.layout_style === 'carousel' && (
                <div className="overflow-x-auto">
                    <div className="flex gap-4 pb-4">
                        {products.map((product) => (
                            <div key={product.id} className="flex-shrink-0 w-80">
                                <ModernProductCard product={product} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {section.layout_style === 'list' && (
                <div className="space-y-4">
                    {products.map((product) => (
                        <ModernProductCard key={product.id} product={product} />
                    ))}
                </div>
            )}
        </section>
    );
}
