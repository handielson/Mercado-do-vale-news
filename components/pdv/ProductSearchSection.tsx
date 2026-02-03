import React, { useState } from 'react';
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

    // Buscar produtos
    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            toast.error('Digite algo para buscar');
            return;
        }

        setIsSearching(true);
        try {
            // TODO: Implementar busca real com Supabase
            // Buscar por: name, sku, eans (array), imei1, imei2

            // Simulação temporária
            await new Promise(resolve => setTimeout(resolve, 500));

            // Mock de resultados
            const mockResults: Product[] = [];
            setSearchResults(mockResults);

            if (mockResults.length === 0) {
                toast.info('Nenhum produto encontrado');
            }
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
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Nome, SKU, Código de Barras, IMEI..."
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                />
                <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    <Search size={18} />
                    {isSearching ? 'Buscando...' : 'Buscar'}
                </button>
            </div>

            {/* Dica de Busca */}
            <p className="text-xs text-slate-500 mb-4">
                💡 Busque por nome, SKU, código de barras (EAN), IMEI1 ou IMEI2
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
                                            <p className="text-sm text-slate-500">
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
                                        value={quantity}
                                        onChange={(e) => updateQuantity(product.id, parseInt(e.target.value) || 1)}
                                        className="w-16 px-2 py-1 border border-slate-300 rounded text-center"
                                    />
                                    <button
                                        onClick={() => handleAddToCart(product)}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                                    >
                                        <Plus size={18} />
                                        Adicionar
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
