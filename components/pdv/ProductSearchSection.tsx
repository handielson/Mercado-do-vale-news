import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Package, Smartphone } from 'lucide-react';
import { Product } from '../../types/product';
import { toast } from 'sonner';
import { unitService } from '../../services/units';
import { UnitStatus } from '../../utils/field-standards';
import { normalizeCentValue } from '../../utils/promoPrice';

interface ProductSearchSectionProps {
    onAddToCart: (product: Product, quantity: number, unitData?: { unitId: string; imei1?: string; imei2?: string; serial?: string }) => void;
}

type SearchMode = 'product' | 'imei';
type ProductSearchOptions = { autoAddSingle?: boolean };

const hasSerializedIdentity = (product: Product): boolean => {
    const specs = (product as any).specs || {};
    return Boolean(specs.imei1 || specs.imei_1 || specs.imei2 || specs.imei_2 || specs.serial || specs.serial_number);
};

const getSerializedSpecs = (product: Product) => {
    const specs = (product as any).specs || {};
    return {
        imei1: specs.imei1 || specs.imei_1 || undefined,
        imei2: specs.imei2 || specs.imei_2 || undefined,
        serial: specs.serial || specs.serial_number || undefined,
    };
};

const getSerializedLookupValues = (product: Product, preferred?: string) => {
    const specs = getSerializedSpecs(product);
    return [preferred, specs.imei1, specs.imei2, specs.serial]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index);
};

const formatUnitIdentifierLine = (unit: any): string => [
    unit.imei_1 && `IMEI 1: ${unit.imei_1}`,
    unit.imei_2 && `IMEI 2: ${unit.imei_2}`,
    unit.serial_number && `Serial: ${unit.serial_number}`,
].filter(Boolean).join(' | ');

export default function ProductSearchSection({ onAddToCart }: ProductSearchSectionProps) {
    const [mode, setMode] = useState<SearchMode>('product');

    // ── Busca por Produto (modo original) ──────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [skuStockMap, setSkuStockMap] = useState<Record<string, number>>({});
    const [availableSerializedLines, setAvailableSerializedLines] = useState<Record<string, string[]>>({});
    const isKnownSerializedProduct = (product: Product): boolean =>
        hasSerializedIdentity(product) || Object.prototype.hasOwnProperty.call(availableSerializedLines, product.id);

    const getResultIdentifierLine = (product: Product): string => {
        const serializedLines = availableSerializedLines[product.id];
        if (serializedLines?.length) return serializedLines.join(' | ');
        return `SKU: ${product.sku}`;
    };

    // ── Busca por IMEI / Serial ─────────────────────────────────────────────────
    const [imeiQuery, setImeiQuery] = useState('');
    const [isImeiSearching, setIsImeiSearching] = useState(false);
    const imeiInputRef = useRef<HTMLInputElement>(null);

    // Foco automático no campo IMEI ao trocar de tab
    useEffect(() => {
        if (mode === 'imei') {
            setTimeout(() => imeiInputRef.current?.focus(), 50);
        }
    }, [mode]);

    // Busca automática com debounce (modo produto)
    useEffect(() => {
        if (mode !== 'product') return;
        if (searchTerm.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        const timeoutId = setTimeout(() => handleSearch({ autoAddSingle: false }), 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, mode]);

    const addSerializedProductToCart = async (product: Product, preferredIdentifier?: string) => {
        const specs = getSerializedSpecs(product);
        const lookupValues = getSerializedLookupValues(product, preferredIdentifier);
        let unit = null;

        if (preferredIdentifier) {
            for (const value of lookupValues) {
                const matches = await unitService.searchByIdentifier(value);
                if (matches.length > 0) {
                    unit = matches[0];
                    break;
                }
            }
        } else {
            const productUnits = await unitService.listByProduct(product.id);
            unit = productUnits.find(candidate => candidate.status === UnitStatus.AVAILABLE) || null;
        }

        if (!unit) {
            const productUnits = await unitService.listByProduct(product.id).catch(() => []);
            const availableUnit = productUnits.find(candidate => candidate.status === UnitStatus.AVAILABLE);
            if (availableUnit) {
                unit = availableUnit;
            } else if (productUnits.length > 0) {
                toast.error('Nenhuma unidade disponivel para este produto');
                return;
            } else {
                unit = await unitService.create({
                    product_id: product.id,
                    imei_1: specs.imei1,
                    imei_2: specs.imei2,
                    serial_number: specs.serial,
                    condition: 'new',
                    status: UnitStatus.AVAILABLE,
                    cost_price: normalizeCentValue((product as any).price_cost),
                    internal_notes: 'Unidade criada automaticamente pelo PDV a partir do cadastro legado do produto',
                });
            }
        }

        if (unit.status === UnitStatus.SOLD) {
            toast.error('Unidade já vendida');
            return;
        }
        if (unit.status === UnitStatus.RESERVED) {
            toast.error('Unidade já reservada para outro pedido');
            return;
        }
        if (unit.status === UnitStatus.RMA) {
            toast.error('Unidade em processo de devolução (RMA)');
            return;
        }

        onAddToCart(product, 1, {
            unitId: unit.id,
            imei1: unit.imei_1 || specs.imei1,
            imei2: unit.imei_2 || specs.imei2,
            serial: unit.serial_number || specs.serial,
        });

        toast.success(`✅ ${product.name} — IMEI: ${unit.imei_1 || specs.imei1 || unit.serial_number || specs.serial || preferredIdentifier || ''}`);
        setImeiQuery('');
        setSearchResults([]);
        setSearchTerm('');
        setTimeout(() => {
            imeiInputRef.current?.focus();
            imeiInputRef.current?.select();
        }, 50);
    };

    // ── Busca por produto (nome/SKU) ────────────────────────────────────────────
    const handleSearch = async (options: ProductSearchOptions = {}) => {
        const term = searchTerm.trim();
        if (term.length < 2) { setSearchResults([]); return; }

        setIsSearching(true);
        try {
            const { searchProducts } = await import('../../services/productService');
            const results = await searchProducts(term);

            const availableProducts = results.filter(product => {
                if (!product.track_inventory) return true;
                return product.stock_quantity !== undefined && product.stock_quantity > 0;
            });

            const skuMap: Record<string, number> = {};
            for (const p of availableProducts) {
                if (p.track_inventory && p.sku) {
                    const specs = (p as any).specs;
                    const isSerialized = specs?.imei1 || specs?.imei2 || specs?.serial;
                    const key = isSerialized
                        ? `${p.model_id}|${specs?.ram || ''}|${specs?.storage || ''}|${specs?.color || ''}`
                        : p.sku;
                    skuMap[key] = (skuMap[key] || 0) + 1;
                    (p as any)._stockKey = key;
                }
            }

            const serializedLines: Record<string, string[]> = {};
            await Promise.all(availableProducts
                .filter(product => product.track_inventory || hasSerializedIdentity(product))
                .map(async (product) => {
                    try {
                        const units = await unitService.listByProduct(product.id);
                        const availableLines = units
                            .filter(unit => unit.status === UnitStatus.AVAILABLE)
                            .map(formatUnitIdentifierLine)
                            .filter(Boolean);
                        if (units.length > 0 || hasSerializedIdentity(product)) {
                            serializedLines[product.id] = availableLines;
                        }
                    } catch {
                        if (hasSerializedIdentity(product)) serializedLines[product.id] = [];
                    }
                }));

            setSearchResults(availableProducts);
            setSkuStockMap(skuMap);
            setAvailableSerializedLines(serializedLines);

            // Se retornar exatamente 1 resultado, adiciona automaticamente ao carrinho
            if (availableProducts.length === 1 && options.autoAddSingle === true) {
                const singleProduct = availableProducts[0];
                const quantity = quantities[singleProduct.id] || 1;
                if (hasSerializedIdentity(singleProduct) || Object.prototype.hasOwnProperty.call(serializedLines, singleProduct.id)) {
                    await addSerializedProductToCart(singleProduct, term);
                    return;
                }
                if (singleProduct.track_inventory && singleProduct.stock_quantity !== undefined) {
                    if (singleProduct.stock_quantity < quantity) {
                        return;
                    }
                }
                onAddToCart(singleProduct, quantity);
                toast.success(`${singleProduct.name} adicionado ao carrinho`);
                setSearchResults([]);
                setSearchTerm('');
                setTimeout(() => {
                    searchInputRef.current?.focus();
                    searchInputRef.current?.select();
                }, 50);
            }
        } catch (error) {
            console.error('Erro ao buscar produtos:', error);
            toast.error('Erro ao buscar produtos');
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddToCart = async (product: Product) => {
        const quantity = quantities[product.id] || 1;
        if (isKnownSerializedProduct(product)) {
            await addSerializedProductToCart(product);
            return;
        }
        if (product.track_inventory && product.stock_quantity !== undefined) {
            if (product.stock_quantity < quantity) {
                toast.error(`Estoque insuficiente. Disponível: ${product.stock_quantity}`);
                return;
            }
        }
        onAddToCart(product, quantity);
        toast.success(`${product.name} adicionado ao carrinho`);
        setQuantities(prev => ({ ...prev, [product.id]: 1 }));
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) return;
        setQuantities(prev => ({ ...prev, [productId]: quantity }));
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch({ autoAddSingle: true });
    };

    // ── Busca por IMEI / Serial ─────────────────────────────────────────────────
    const handleImeiSearch = async () => {
        const query = imeiQuery.trim();
        if (query.length < 5) {
            toast.error('Digite pelo menos 5 caracteres do IMEI ou serial');
            return;
        }

        setIsImeiSearching(true);
        try {
            const units = await unitService.searchByIdentifier(query);

            if (units.length === 0) {
                const { getProductByImei } = await import('../../services/productService');
                const fallbackProduct = await getProductByImei(query);

                if (fallbackProduct && hasSerializedIdentity(fallbackProduct)) {
                    await addSerializedProductToCart(fallbackProduct, query);
                    return;
                }

                toast.error('Nenhuma unidade encontrada para este IMEI/serial');
                return;
            }

            const unit = units[0];

            if (unit.status === UnitStatus.SOLD) {
                toast.error(`Unidade já vendida`);
                return;
            }
            if (unit.status === UnitStatus.RESERVED) {
                toast.error('Unidade já reservada para outro pedido');
                return;
            }
            if (unit.status === UnitStatus.RMA) {
                toast.error('Unidade em processo de devolução (RMA)');
                return;
            }

            const { getProductById } = await import('../../services/productService');
            const product = await getProductById(unit.product_id);

            if (!product) {
                toast.error('Produto vinculado a este IMEI não encontrado');
                return;
            }

            onAddToCart(product, 1, {
                unitId: unit.id,
                imei1: unit.imei_1 || undefined,
                imei2: unit.imei_2 || undefined,
                serial: unit.serial_number || undefined,
            });

            toast.success(`✅ ${product.name} — IMEI: ${unit.imei_1 || unit.serial_number}`);
            setImeiQuery('');
            setTimeout(() => imeiInputRef.current?.focus(), 100);

        } catch (error: any) {
            console.error('Erro na busca por IMEI:', error);
            toast.error(error.message || 'Erro ao buscar unidade');
        } finally {
            setIsImeiSearching(false);
        }
    };

    const handleImeiKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleImeiSearch();
    };

    // ── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Search size={20} />
                Buscar Produto
            </h3>

            {/* Tabs de modo */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-4">
                <button
                    onClick={() => setMode('product')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        mode === 'product'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Search size={15} />
                    Nome / SKU
                </button>
                <button
                    onClick={() => setMode('imei')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        mode === 'imei'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Smartphone size={15} />
                    IMEI / Serial
                </button>
            </div>

            {/* ── Modo: Busca por produto ─────────────────────────────────────── */}
            {mode === 'product' && (
                <>
                    <div className="mb-4">
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Nome, SKU, Código de Barras..."
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

                    <p className="text-xs text-slate-500 mb-4">
                        💡 Digite pelo menos 2 caracteres para buscar automaticamente
                    </p>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {searchResults.length === 0 && !isSearching && (
                            <div className="text-center py-8 text-slate-400">
                                <Package size={48} className="mx-auto mb-2 opacity-50" />
                                <p>Busque produtos para adicionar ao carrinho</p>
                            </div>
                        )}

                        {searchResults.map((product) => {
                            const quantity = quantities[product.id] || 1;
                            const price = product.price_retail;
                            const isGift = product.is_gift || false;

                            return (
                                <div
                                    key={product.id}
                                    className={`p-4 border rounded-lg hover:bg-slate-50 transition-colors ${isGift ? 'border-green-300 bg-green-50' : 'border-slate-200'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                                            {product.images && product.images.length > 0 ? (
                                                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Package size={32} className="text-slate-400" />
                                            )}
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-slate-800">
                                                    {product.name}
                                                    {(product.specs?.ram || product.specs?.storage || product.specs?.color) && (
                                                        <span className="text-slate-500 font-normal">
                                                            {[
                                                                product.specs?.ram && product.specs?.storage
                                                                    ? `, ${product.specs.ram}/${product.specs.storage}`
                                                                    : product.specs?.ram
                                                                        ? `, ${product.specs.ram}`
                                                                        : product.specs?.storage
                                                                            ? `, ${product.specs.storage}`
                                                                            : '',
                                                                product.specs?.color ? ` - ${product.specs.color}` : '',
                                                            ].join('')}
                                                        </span>
                                                    )}
                                                </h4>
                                                {isGift && (
                                                    <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded font-medium">
                                                        🎁 BRINDE
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500">
                                                {getResultIdentifierLine(product)}
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
                                                        {(() => {
                                                            const key = (product as any)._stockKey || product.sku;
                                                            const count = key ? skuStockMap[key] : undefined;
                                                            return count !== undefined
                                                                ? `${count} disponíveis`
                                                                : `Estoque: ${product.stock_quantity || 0} un.`;
                                                        })()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

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
                </>
            )}

            {/* ── Modo: Busca por IMEI / Serial ──────────────────────────────────── */}
            {mode === 'imei' && (
                <div>
                    <div className="relative mb-3">
                        <input
                            ref={imeiInputRef}
                            type="text"
                            value={imeiQuery}
                            onChange={(e) => setImeiQuery(e.target.value)}
                            onKeyPress={handleImeiKeyPress}
                            placeholder="Bipe ou digite o IMEI / Serial..."
                            className="w-full px-4 py-3 pl-10 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-mono"
                            autoComplete="off"
                        />
                        <Smartphone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" size={18} />
                        {isImeiSearching && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleImeiSearch}
                        disabled={isImeiSearching || imeiQuery.trim().length < 5}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isImeiSearching ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Search size={16} />
                        )}
                        Buscar Unidade
                    </button>

                    <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-xs text-blue-700 font-medium mb-1">📱 Como usar:</p>
                        <ul className="text-xs text-blue-600 space-y-0.5">
                            <li>• Bipe o código de barras do IMEI 1, IMEI 2 ou Serial</li>
                            <li>• O aparelho será adicionado automaticamente ao carrinho</li>
                            <li>• Quantidade travada em 1 unidade por aparelho</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
