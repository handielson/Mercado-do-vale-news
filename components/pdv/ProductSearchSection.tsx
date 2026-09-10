import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Package, Smartphone } from 'lucide-react';
import { Product } from '../../types/product';
import { toast } from 'sonner';
import { unitService } from '../../services/units';
import { UnitStatus } from '../../utils/field-standards';
import {
    buildPdvSearchCards,
    buildPdvUnitOption,
    findPdvUnitOptionByIdentifier,
    fromHydratedPdvSearchPayload,
    type PdvSearchCard,
    type PdvSerializedUnitOption,
} from '../../services/pdvSerializedInventory';
import { vpsApiService } from '../../services/vpsApiService';
import { formatReferenceNumber } from '../../utils/referenceNumber';

interface ProductSearchSectionProps {
    customer?: unknown;
    onAddToCart: (product: Product, quantity: number, unitData?: { unitId?: string; imei1?: string; imei2?: string; serial?: string }) => void;
}

type SearchMode = 'product' | 'imei';
type ProductSearchOptions = { autoAddSingle?: boolean };
type PendingSerializedConfirmation = {
    product: Product;
    unitOptions: PdvSerializedUnitOption[];
    selectedOptionId: string;
    source: SearchMode;
};
type SoldUnitNotice = {
    unitId: string;
    productName?: string;
    identifierLabel: string;
    saleId?: string;
};

function formatPrice(cents: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100);
}

function renderProductSpecs(product: Product) {
    const specs = product.specs || {};
    if (!specs.ram && !specs.storage && !specs.color) return null;
    return (
        <span className="text-slate-500 font-normal">
            {[
                specs.ram && specs.storage
                    ? `, ${specs.ram}/${specs.storage}`
                    : specs.ram
                        ? `, ${specs.ram}`
                        : specs.storage
                            ? `, ${specs.storage}`
                            : '',
                specs.color ? ` - ${specs.color}` : '',
            ].join('')}
        </span>
    );
}

export default function ProductSearchSection({ onAddToCart }: ProductSearchSectionProps) {
    const [mode, setMode] = useState<SearchMode>('product');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchCards, setSearchCards] = useState<PdvSearchCard[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [selectedUnitByCardId, setSelectedUnitByCardId] = useState<Record<string, string>>({});
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [imeiQuery, setImeiQuery] = useState('');
    const [isImeiSearching, setIsImeiSearching] = useState(false);
    const imeiInputRef = useRef<HTMLInputElement>(null);
    const [pendingSerializedConfirmation, setPendingSerializedConfirmation] = useState<PendingSerializedConfirmation | null>(null);
    const [soldUnitNotices, setSoldUnitNotices] = useState<SoldUnitNotice[]>([]);

    useEffect(() => {
        if (mode === 'imei') {
            setTimeout(() => imeiInputRef.current?.focus(), 50);
        }
    }, [mode]);

    useEffect(() => {
        if (mode !== 'product') return;
        if (searchTerm.trim().length < 2) {
            setSearchCards([]);
            return;
        }
        const timeoutId = setTimeout(() => handleSearch({ autoAddSingle: false }), 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, mode]);

    const getSelectedUnit = (card: PdvSearchCard): PdvSerializedUnitOption | undefined => {
        if (card.kind !== 'serialized-product') return undefined;
        const selectedId = selectedUnitByCardId[card.id] || card.unitOptions[0]?.id;
        return card.unitOptions.find(option => option.id === selectedId) || card.unitOptions[0];
    };

    const openSerializedConfirmation = (
        product: Product,
        unitOptions: PdvSerializedUnitOption[],
        selectedOptionId: string,
        source: SearchMode,
    ) => {
        setPendingSerializedConfirmation({ product, unitOptions, selectedOptionId, source });
    };

    const confirmSerializedUnit = () => {
        if (!pendingSerializedConfirmation) return;
        const selectedUnit = pendingSerializedConfirmation.unitOptions.find(
            option => option.id === pendingSerializedConfirmation.selectedOptionId,
        );
        if (!selectedUnit) {
            toast.error('Selecione o IMEI que sera vendido');
            return;
        }

        onAddToCart(pendingSerializedConfirmation.product, 1, selectedUnit.unitData);
        toast.success(`${pendingSerializedConfirmation.product.name} adicionado com o IMEI confirmado`);
        const source = pendingSerializedConfirmation.source;
        setPendingSerializedConfirmation(null);
        setImeiQuery('');
        setSearchCards([]);
        setSearchTerm('');
        setTimeout(() => {
            const input = source === 'imei' ? imeiInputRef.current : searchInputRef.current;
            input?.focus();
            input?.select();
        }, 50);
    };

    const addCardToCart = async (card: PdvSearchCard, preferredUnit?: PdvSerializedUnitOption) => {
        if (card.kind === 'serialized-product') {
            const selectedUnit = preferredUnit || getSelectedUnit(card);
            if (!selectedUnit) {
                toast.error('Selecione uma unidade disponivel');
                return;
            }

            openSerializedConfirmation(card.product, card.unitOptions, selectedUnit.id, 'product');
            return;
        }

        const quantity = quantities[card.id] || 1;
        if (card.product.track_inventory && card.maxQuantity !== undefined && quantity > card.maxQuantity) {
            toast.error(`Estoque insuficiente. Disponivel: ${card.maxQuantity}`);
            return;
        }

        onAddToCart(card.product, quantity);
        toast.success(`${card.product.name} adicionado ao carrinho`);
        setQuantities(prev => ({ ...prev, [card.id]: 1 }));
    };

    const handleSearch = async (options: ProductSearchOptions = {}) => {
        const term = searchTerm.trim();
        if (term.length < 2) {
            setSearchCards([]);
            return;
        }

        setIsSearching(true);
        try {
            const hydrated = await vpsApiService.searchPdvProducts(term, 50);
            let cards = fromHydratedPdvSearchPayload(hydrated || []);

            if (hydrated === null) {
                const { searchProducts } = await import('../../services/productService');
                const results = await searchProducts(term);
                const availableProducts = results.filter(product => {
                    if (!product.track_inventory) return true;
                    return product.stock_quantity !== undefined && product.stock_quantity > 0;
                });
                cards = await buildPdvSearchCards(availableProducts, {
                    listUnitsByProduct: unitService.listByProduct,
                });
            }

            setSearchCards(cards);

            const firstSelections: Record<string, string> = {};
            for (const card of cards) {
                if (card.kind === 'serialized-product' && card.unitOptions[0]) {
                    firstSelections[card.id] = (
                        findPdvUnitOptionByIdentifier(card.unitOptions, term) || card.unitOptions[0]
                    ).id;
                }
            }
            setSelectedUnitByCardId(firstSelections);

            if (cards.length === 1 && options.autoAddSingle === true) {
                const exactUnit = cards[0].kind === 'serialized-product'
                    ? findPdvUnitOptionByIdentifier(cards[0].unitOptions, term)
                    : undefined;
                await addCardToCart(cards[0], exactUnit);
            }
        } catch (error) {
            console.error('Erro ao buscar produtos:', error);
            toast.error('Erro ao buscar produtos');
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddToCart = async (card: PdvSearchCard) => {
        await addCardToCart(card);
    };

    const updateQuantity = (cardId: string, quantity: number) => {
        if (quantity < 1) return;
        setQuantities(prev => ({ ...prev, [cardId]: quantity }));
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch({ autoAddSingle: true });
    };

    const handleImeiSearch = async () => {
        const query = imeiQuery.trim();
        if (query.length < 5) {
            toast.error('Digite pelo menos 5 caracteres do IMEI ou serial');
            return;
        }

        setIsImeiSearching(true);
        setSoldUnitNotices([]);
        try {
            const units = await unitService.searchByIdentifier(query);

            if (units.length === 0) {
                toast.error('Nenhuma unidade encontrada para este IMEI/serial');
                return;
            }

            const soldUnits = units.filter(unit => unit.status === UnitStatus.SOLD);
            if (soldUnits.length > 0) {
                setSoldUnitNotices(soldUnits.map(unit => ({
                    unitId: unit.id,
                    productName: unit.product_name,
                    identifierLabel: buildPdvUnitOption(unit).label,
                    saleId: unit.sale_id || undefined,
                })));
                return;
            }

            const availableUnits = units.filter(unit => unit.status === UnitStatus.AVAILABLE);
            if (availableUnits.length === 0) {
                toast.error('Esta unidade nao esta disponivel para venda');
                return;
            }

            const productIds = new Set(availableUnits.map(unit => unit.product_id));
            if (availableUnits.length > 1 || productIds.size > 1) {
                toast.error('IMEI/serial duplicado no estoque. Corrija o cadastro antes de vender.');
                return;
            }

            const unit = availableUnits[0];

            const { getProductById } = await import('../../services/productService');
            const product = await getProductById(unit.product_id);

            if (!product) {
                toast.error('Produto vinculado a este IMEI/serial nao encontrado');
                return;
            }

            const productUnits = await unitService.listByProduct(unit.product_id);
            const unitOptions = productUnits
                .filter(candidate => candidate.status === UnitStatus.AVAILABLE)
                .map(buildPdvUnitOption);
            const selectedUnit = buildPdvUnitOption(unit);
            openSerializedConfirmation(product, unitOptions, selectedUnit.id, 'imei');
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

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Search size={20} />
                Buscar Produto
            </h3>

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

            {mode === 'product' && (
                <>
                    <div className="mb-4">
                        <div className="relative">
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Nome, SKU, Codigo de Barras..."
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
                        Digite pelo menos 2 caracteres para buscar automaticamente
                    </p>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {searchCards.length === 0 && !isSearching && (
                            <div className="text-center py-8 text-slate-400">
                                <Package size={48} className="mx-auto mb-2 opacity-50" />
                                <p>Busque produtos para adicionar ao carrinho</p>
                            </div>
                        )}

                        {searchCards.map((card) => {
                            const product = card.product;
                            const quantity = card.kind === 'serialized-product' ? 1 : quantities[card.id] || 1;
                            const price = product.price_retail;
                            const isGift = product.is_gift || false;
                            const isUnavailable = card.kind === 'stock-product' && product.track_inventory && card.maxQuantity === 0;

                            return (
                                <div
                                    key={card.id}
                                    className={`p-4 border rounded-lg hover:bg-slate-50 transition-colors ${isGift ? 'border-green-300 bg-green-50' : 'border-slate-200'}`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                                            {product.images && product.images.length > 0 ? (
                                                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Package size={32} className="text-slate-400" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-slate-800">
                                                    {card.title}
                                                    {renderProductSpecs(product)}
                                                </h4>
                                                {isGift && (
                                                    <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded font-medium">
                                                        BRINDE
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500">{card.subtitle}</p>
                                            <div className="flex items-center gap-4 mt-1">
                                                <p className={`text-lg font-bold ${isGift ? 'text-green-700' : 'text-blue-700'}`}>
                                                    {isGift ? (
                                                        <>
                                                            <span className="line-through text-slate-400 text-sm mr-2">
                                                                {formatPrice(price)}
                                                            </span>
                                                            R$ 0,00
                                                        </>
                                                    ) : (
                                                        formatPrice(price)
                                                    )}
                                                </p>
                                                {product.track_inventory && (
                                                    <p className={`text-sm ${isUnavailable ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                                                        {card.stockLabel}
                                                    </p>
                                                )}
                                            </div>

                                        </div>

                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="1"
                                                max={card.kind === 'serialized-product' ? 1 : card.maxQuantity}
                                                value={quantity}
                                                onChange={(e) => {
                                                    const newQty = parseInt(e.target.value) || 1;
                                                    const maxQty = card.kind === 'stock-product' ? card.maxQuantity ?? Infinity : 1;
                                                    updateQuantity(card.id, Math.min(newQty, maxQty));
                                                }}
                                                className="w-16 px-2 py-1 border border-slate-300 rounded text-center disabled:bg-slate-50"
                                                disabled={card.kind === 'serialized-product' || isUnavailable}
                                            />
                                            <button
                                                onClick={() => handleAddToCart(card)}
                                                disabled={isUnavailable}
                                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                                            >
                                                <Plus size={18} />
                                                {isUnavailable ? 'Sem Estoque' : 'Adicionar'}
                                            </button>
                                        </div>
                                    </div>

                                    {card.kind === 'serialized-product' && (
                                        <div className="mt-3 w-full rounded-lg border border-blue-100 bg-blue-50 p-2">
                                            <div className="mb-2 text-xs font-semibold text-blue-800">
                                                Escolha a unidade que sera vendida
                                            </div>
                                            <div className="space-y-1">
                                                {card.unitOptions.map((option) => (
                                                    <label
                                                        key={option.id}
                                                        className="flex w-full cursor-pointer items-start gap-3 rounded-md bg-white px-3 py-2 text-base leading-snug text-slate-800 hover:bg-blue-50 sm:text-lg"
                                                    >
                                                        <input
                                                            type="radio"
                                                            name={`unit-${card.id}`}
                                                            checked={(selectedUnitByCardId[card.id] || card.unitOptions[0]?.id) === option.id}
                                                            onChange={() => setSelectedUnitByCardId(prev => ({ ...prev, [card.id]: option.id }))}
                                                            className="mt-1 h-4 w-4 shrink-0"
                                                        />
                                                        <span className="min-w-0 break-words font-mono font-semibold">{option.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {mode === 'imei' && (
                <div>
                    <div className="relative mb-3">
                        <input
                            ref={imeiInputRef}
                            type="text"
                            value={imeiQuery}
                            onChange={(e) => {
                                setImeiQuery(e.target.value.toUpperCase());
                                setSoldUnitNotices([]);
                            }}
                            onKeyPress={handleImeiKeyPress}
                            placeholder="Bipe ou digite o IMEI / Serial..."
                            className="w-full px-4 py-3 pl-10 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-mono uppercase"
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

                    {soldUnitNotices.length > 0 && (
                        <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 p-4" role="alert">
                            <div className="flex items-center gap-2 text-lg font-bold text-red-800">
                                <Smartphone size={20} />
                                Aparelho já vendido
                            </div>
                            <div className="mt-3 space-y-3">
                                {soldUnitNotices.map(notice => (
                                    <div key={notice.unitId} className="rounded-lg border border-red-200 bg-white p-3">
                                        {notice.productName && (
                                            <p className="font-semibold text-slate-900">{notice.productName}</p>
                                        )}
                                        <p className="mt-1 break-words font-mono text-sm font-semibold text-slate-700">
                                            {notice.identifierLabel}
                                        </p>
                                        {notice.saleId ? (
                                            <a
                                                href={`/admin/sales?sale=${encodeURIComponent(notice.saleId)}`}
                                                className="mt-3 inline-flex items-center rounded-lg bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800"
                                            >
                                                Acessar venda #{formatReferenceNumber(notice.saleId)}
                                            </a>
                                        ) : (
                                            <p className="mt-2 text-sm font-semibold text-red-700">
                                                Venda não vinculada no cadastro da unidade
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-xs text-blue-700 font-medium mb-1">Como usar:</p>
                        <ul className="text-xs text-blue-600 space-y-0.5">
                            <li>Bipe o codigo de barras do IMEI 1, IMEI 2 ou Serial</li>
                            <li>Confirme o IMEI antes de adicionar o aparelho ao carrinho</li>
                            <li>Se necessario, escolha outro IMEI disponivel na confirmacao</li>
                            <li>Quantidade travada em 1 unidade por aparelho</li>
                        </ul>
                    </div>
                </div>
            )}

            {pendingSerializedConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-imei-title">
                    <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <h4 id="confirm-imei-title" className="text-xl font-bold text-slate-900">Confirme o IMEI</h4>
                            <p className="mt-1 text-sm text-slate-600">{pendingSerializedConfirmation.product.name}</p>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
                            <p className="mb-3 text-sm font-semibold text-slate-800">
                                Confira com a etiqueta do aparelho. Para trocar, selecione outro IMEI disponível:
                            </p>
                            <div className="space-y-2">
                                {pendingSerializedConfirmation.unitOptions.map(option => (
                                    <label
                                        key={option.id}
                                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                                            pendingSerializedConfirmation.selectedOptionId === option.id
                                                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="confirmed-serialized-unit"
                                            checked={pendingSerializedConfirmation.selectedOptionId === option.id}
                                            onChange={() => setPendingSerializedConfirmation(current => current ? {
                                                ...current,
                                                selectedOptionId: option.id,
                                            } : current)}
                                            className="mt-1 h-5 w-5 shrink-0"
                                        />
                                        <span className="min-w-0 break-words font-mono text-lg font-bold text-slate-900">{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setPendingSerializedConfirmation(null)}
                                className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmSerializedUnit}
                                className="rounded-lg bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700"
                            >
                                Confirmar este IMEI
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
