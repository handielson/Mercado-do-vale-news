import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getEffectivePrice } from '@/hooks/useEffectiveCustomerType';
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {products.map((product) => (
                        <ProductCard key={product.id} product={product} customer={customer} />
                    ))}
                </div>
            )}

            {section.layout_style === 'carousel' && (
                <div className="overflow-x-auto">
                    <div className="flex gap-4 pb-4">
                        {products.map((product) => (
                            <div key={product.id} className="flex-shrink-0 w-64">
                                <ProductCard product={product} customer={customer} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {section.layout_style === 'list' && (
                <div className="space-y-4">
                    {products.map((product) => (
                        <ProductListItem key={product.id} product={product} customer={customer} />
                    ))}
                </div>
            )}
        </section>
    );
}

// Card de Produto para Grid e Carousel
function ProductCard({ product, customer }: { product: CatalogProduct; customer: any }) {
    return (
        <Link
            href={`/catalog/product/${product.id}`}
            className="group bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
        >
            {/* Imagem */}
            <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {product.images && product.images.length > 0 ? (
                    <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        Sem imagem
                    </div>
                )}

                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {product.is_new && (
                        <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">
                            NOVO
                        </span>
                    )}
                    {product.discount_percentage > 0 && (
                        <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                            -{product.discount_percentage}%
                        </span>
                    )}
                </div>
            </div>

            {/* Info */}
            <div className="p-4">
                <h3 className="font-medium text-gray-900 line-clamp-2 mb-2">
                    {product.name}
                </h3>
                <div className="flex items-baseline gap-2">
                    {product.discount_percentage && product.discount_percentage > 0 ? (
                        <>
                            <span className="text-lg font-bold text-green-600">
                                R$ {((getEffectivePrice(product, customer) / 100) * (1 - product.discount_percentage / 100)).toFixed(2)}
                            </span>
                            <span className="text-sm text-gray-500 line-through">
                                R$ {(getEffectivePrice(product, customer) / 100).toFixed(2)}
                            </span>
                        </>
                    ) : (
                        <span className="text-lg font-bold text-gray-900">
                            R$ {(getEffectivePrice(product, customer) / 100).toFixed(2)}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}

// Item de Produto para Lista
function ProductListItem({ product, customer }: { product: CatalogProduct; customer: any }) {
    return (
        <Link
            href={`/catalog/product/${product.id}`}
            className="flex gap-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"
        >
            {/* Imagem */}
            <div className="w-24 h-24 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                {product.images && product.images.length > 0 ? (
                    <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        Sem imagem
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1">
                <div className="flex items-start gap-2 mb-2">
                    <h3 className="font-medium text-gray-900 flex-1">
                        {product.name}
                    </h3>
                    {product.is_new && (
                        <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">
                            NOVO
                        </span>
                    )}
                    {product.discount_percentage > 0 && (
                        <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                            -{product.discount_percentage}%
                        </span>
                    )}
                </div>

                {product.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {product.description}
                    </p>
                )}

                <div className="flex items-baseline gap-2">
                    {product.discount_percentage && product.discount_percentage > 0 ? (
                        <>
                            <span className="text-xl font-bold text-green-600">
                                R$ {((getEffectivePrice(product, customer) / 100) * (1 - product.discount_percentage / 100)).toFixed(2)}
                            </span>
                            <span className="text-sm text-gray-500 line-through">
                                R$ {(getEffectivePrice(product, customer) / 100).toFixed(2)}
                            </span>
                        </>
                    ) : (
                        <span className="text-xl font-bold text-gray-900">
                            R$ {(getEffectivePrice(product, customer) / 100).toFixed(2)}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}
