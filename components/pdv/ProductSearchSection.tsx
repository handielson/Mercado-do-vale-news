import React, { useState, useEffect } from 'react';
import { Search, Plus, Package } from 'lucide-react';
import { Product } from '../../types/product';
import { toast } from 'sonner';

interface ProductSearchSectionProps {
    onAddToCart: (product: Product, quantity: number) => void;
}

export default function ProductSearchSection({ onAddToCart }: ProductSearchSectionProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [quantities, setQuantities] = useState<Record<string, number>>({});

    // Busca automática com debounce
    useEffect(() => {
        // Não buscar se o termo for muito curto
        if (searchTerm.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        // Debounce: esperar 500ms após parar de digitar
        const timeoutId = setTimeout(() => {
            handleSearch();
        }, 500);

        // Limpar timeout se o usuário continuar digitando
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    // Buscar produtos
    const handleSearch = async () => {
        const term = searchTerm.trim();

        if (term.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // Importar dynamicamente para evitar circular dependency
            const { searchProducts } = await import('../../services/productService');

            const results = await searchProducts(term);

            // Filtrar produtos sem estoque (apenas se track_inventory = true)
            const availableProducts = results.filter(product => {
                // Se não controla estoque, sempre disponível
                if (!product.track_inventory) return true;

                // Se controla estoque, verificar se tem quantidade > 0
                return product.stock_quantity !== undefined && product.stock_quantity > 0;
            });

            setSearchResults(availableProducts);

            // Não mostrar toast em busca automática, apenas em Enter
        } catch (error) {
            console.error('Erro ao buscar produtos:', error);
            toast.error('Erro ao buscar produtos');
        } finally {
            setIsSearching(false);
        }
    };

    // Adicionar ao carrinho
    const handleAddToCart = (product: Product) => {
        const quantity = quantities[product.id] || 1;

        // Validar estoque se necessário
        if (product.track_inventory && product.stock_quantity !== undefined) {
            if (product.stock_quantity < quantity) {
                toast.error(`Estoque insuficiente. Disponível: ${product.stock_quantity}`);
                return;
            }
        }

        onAddToCart(product, quantity);
        toast.success(`${product.name} adicionado ao carrinho`);

        // Resetar quantidade
        setQuantities(prev => ({ ...prev, [product.id]: 1 }));
    };

    // Atualizar quantidade
    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) return;
        setQuantities(prev => ({ ...prev, [productId]: quantity }));
    };

    // Enter para buscar
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Search size={20} />
                Buscar Produto
            </h3>

            {/* Campo de Busca */}
            <div className="mb-4">
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Digite para buscar: Nome, SKU, Código de Barras, IMEI..."
                        className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    {isSearching && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Dica de Busca */}
            <p className="text-xs text-slate-500 mb-4">
                💡 Digite pelo menos 2 caracteres para buscar automaticamente
            </p>

            {/* Resultados */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.length === 0 && !isSearching && (
                    <div className="text-center py-8 text-slate-400">
                        <Package size={48} className="mx-auto mb-2 opacity-50" />
                        <p>Busque produtos para adicionar ao carrinho</p>
                    </div>
                )}

                {searchResults.map((product) => {
                    const quantity = quantities[product.id] || 1;
                    const price = product.price_retail; // Preço varejo em centavos
                    const isGift = product.is_gift || false;

                    return (
                        <div
                            key={product.id}
                            className={`p-4 border rounded-lg hover:bg-slate-50 transition-colors ${isGift ? 'border-green-300 bg-green-50' : 'border-slate-200'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                {/* Imagem do Produto */}
                                <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                                    {product.images && product.images.length > 0 ? (
                                        <img
                                            src={product.images[0]}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <Package size={32} className="text-slate-400" />
                                    )}
                                </div>

                                {/* Informações */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-slate-800">{product.name}</h4>
                                        {isGift && (
                                            <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded font-medium">
                                                🎁 BRINDE
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        SKU: {product.sku}
                                    </p>
                                    <div className="flex items-center gap-4 mt-1">
                                        <p className={`text-lg font-bold ${isGift ? 'text-green-700' : 'text-blue-700'}`}>
                                            {isGift ? (
                                                <>
                                                    <span className="line-through text-slate-400 text-sm mr-2">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price / 100)}
                                                    </span>
                                                    R$ 0,00
                                                </>
                                            ) : (
                                                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price / 100)
                                            )}
                                        </p>
                                        {product.track_inventory && (
                                            <p className={`text-sm ${product.stock_quantity === 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                                                Estoque: {product.stock_quantity || 0} un.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Quantidade e Adicionar */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max={product.track_inventory ? product.stock_quantity : undefined}
                                        value={quantity}
                                        onChange={(e) => {
                                            const newQty = parseInt(e.target.value) || 1;
                                            const maxQty = product.track_inventory ? (product.stock_quantity || 0) : Infinity;
                                            updateQuantity(product.id, Math.min(newQty, maxQty));
                                        }}
                                        className="w-16 px-2 py-1 border border-slate-300 rounded text-center"
                                        disabled={product.track_inventory && product.stock_quantity === 0}
                                    />
                                    <button
                                        onClick={() => handleAddToCart(product)}
                                        disabled={product.track_inventory && product.stock_quantity === 0}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                                    >
                                        <Plus size={18} />
                                        {product.track_inventory && product.stock_quantity === 0 ? 'Sem Estoque' : 'Adicionar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
