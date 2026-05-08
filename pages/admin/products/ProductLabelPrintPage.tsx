import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, Loader2, PackageSearch, Printer, Search, X } from 'lucide-react';
import { productService } from '../../../services/products';
import { Product } from '../../../types/product';
import { LabelPrintModal } from '../../../components/products/LabelPrintModal';
import { formatCurrency } from '../../../utils/saleCalculations';

function normalizeCode(value: string): string {
    return value.trim();
}

function productMatchesExactCode(product: Product, term: string): boolean {
    const normalized = term.toLowerCase();
    const sku = String(product.sku || '').toLowerCase();
    const eans = Array.isArray(product.eans) ? product.eans.map((ean) => String(ean).toLowerCase()) : [];
    return sku === normalized || eans.includes(normalized);
}

function uniqueProducts(products: Product[]): Product[] {
    const seen = new Set<string>();
    return products.filter((product) => {
        if (seen.has(product.id)) return false;
        seen.add(product.id);
        return true;
    });
}

function filterInStockProducts(products: Product[]): Product[] {
    return products.filter((product) => (product.stock_quantity ?? 0) > 0);
}

export const ProductLabelPrintPage: React.FC = () => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [suggestions, setSuggestions] = useState<Product[]>([]);
    const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [error, setError] = useState('');
    const [lastSearch, setLastSearch] = useState('');

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        const query = normalizeCode(term);

        if (query.length < 2) {
            setSuggestions([]);
            setIsSuggesting(false);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            setIsSuggesting(true);
            try {
                const shouldCheckEan = /^\d{6,}$/.test(query);
                const [searchResults, eanResults] = await Promise.all([
                    productService.search(query),
                    shouldCheckEan ? productService.searchByEAN(query) : Promise.resolve([]),
                ]);

                if (!cancelled) {
                    setSuggestions(filterInStockProducts(uniqueProducts([...eanResults, ...searchResults])).slice(0, 8));
                }
            } catch (err) {
                if (!cancelled) {
                    console.warn('[ProductLabelPrintPage] Erro ao sugerir produtos:', err);
                    setSuggestions([]);
                }
            } finally {
                if (!cancelled) setIsSuggesting(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [term]);

    const hasResults = results.length > 0;
    const helperText = useMemo(() => {
        if (isSearching) return 'Buscando produto no catalogo...';
        if (isSuggesting) return 'Procurando produtos em estoque...';
        if (lastSearch && !hasResults && !error) return 'Nenhum produto em estoque encontrado para esta busca.';
        return 'Escaneie o codigo de barras ou digite nome, SKU ou EAN e pressione Enter.';
    }, [error, hasResults, isSearching, isSuggesting, lastSearch]);

    function handleSelectSuggestion(product: Product) {
        setPreviewProduct(product);
        setResults([product]);
        setSuggestions([]);
        setTerm(`${product.name} - ${product.sku}`);
        setError('');
        setLastSearch(product.sku || product.name);
    }

    const handleSearch = async (event?: React.FormEvent) => {
        event?.preventDefault();

        const query = normalizeCode(term);
        if (!query) {
            inputRef.current?.focus();
            return;
        }

        setIsSearching(true);
        setError('');
        setLastSearch(query);
        setSelectedProduct(null);
        setPreviewProduct(null);
        setSuggestions([]);

        try {
            const [eanResults, searchResults] = await Promise.all([
                productService.searchByEAN(query),
                productService.search(query),
            ]);
            const combined = filterInStockProducts(uniqueProducts([...eanResults, ...searchResults]));
            const exactMatches = combined.filter((product) => productMatchesExactCode(product, query));
            const matches = exactMatches.length > 0 ? exactMatches : combined;

            setResults(matches);

            if (matches.length === 1 && exactMatches.length === 1) {
                setSelectedProduct(matches[0]);
            } else if (matches.length === 1) {
                setPreviewProduct(matches[0]);
            }
        } catch (err) {
            console.error('[ProductLabelPrintPage] Erro ao buscar produto:', err);
            setResults([]);
            setError('Nao foi possivel buscar o produto agora. Tente novamente.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleClear = () => {
        setTerm('');
        setResults([]);
        setSuggestions([]);
        setLastSearch('');
        setError('');
        setPreviewProduct(null);
        setSelectedProduct(null);
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const handleModalClose = () => {
        setSelectedProduct(null);
        requestAnimationFrame(() => inputRef.current?.select());
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                            <Barcode className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Imprimir Etiquetas</h1>
                            <p className="text-sm text-slate-500">Busque no estoque por nome, codigo de barras, EAN ou SKU e imprima sem abrir a lista de produtos.</p>
                        </div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSearch} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <label htmlFor="label-product-search" className="mb-2 block text-sm font-semibold text-slate-700">
                    Nome, codigo de barras, EAN ou SKU
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                            ref={inputRef}
                            id="label-product-search"
                            type="text"
                            value={term}
                            onChange={(event) => {
                                setTerm(event.target.value);
                                setPreviewProduct(null);
                            }}
                            placeholder="Bipe ou digite nome, EAN/SKU do produto"
                            className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 text-base font-mono outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        />
                        {term && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                aria-label="Limpar busca"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                        {suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                                {suggestions.map((product) => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => handleSelectSuggestion(product)}
                                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-blue-50"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                            {product.images?.[0] ? (
                                                <img src={product.images[0]} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <PackageSearch className="h-4 w-4 text-slate-400" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                                            <p className="truncate text-xs font-mono text-slate-500">
                                                SKU: {product.sku || '-'} {product.eans?.[0] ? `· EAN: ${product.eans[0]}` : ''} · Estoque: {product.stock_quantity ?? 0}
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold text-blue-700">{formatCurrency(product.price_retail || 0)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isSearching}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                    >
                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        Buscar para imprimir
                    </button>
                </div>
                <p className={`mt-2 text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>
                    {error || helperText}
                </p>
            </form>

            {previewProduct && (
                <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Produto selecionado</p>
                            <h2 className="text-lg font-bold text-slate-900">{previewProduct.name}</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedProduct(previewProduct)}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                            <Printer className="h-4 w-4" />
                            Abrir impressão
                        </button>
                    </div>
                    <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:w-36">
                            {previewProduct.images?.[0] ? (
                                <img src={previewProduct.images?.[0]} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <PackageSearch className="h-10 w-10 text-slate-400" />
                            )}
                        </div>
                        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-lg bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase text-slate-500">SKU</p>
                                <p className="mt-1 font-mono text-sm font-bold text-slate-900">{previewProduct.sku || '-'}</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase text-slate-500">EAN principal</p>
                                <p className="mt-1 font-mono text-sm font-bold text-slate-900">{previewProduct.eans?.[0] || '-'}</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase text-slate-500">Preço varejo</p>
                                <p className="mt-1 text-sm font-bold text-blue-700">{formatCurrency(previewProduct.price_retail || 0)}</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase text-slate-500">Estoque</p>
                                <p className="mt-1 text-sm font-bold text-slate-900">{previewProduct.stock_quantity ?? 0} un.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {hasResults && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800">
                            {results.length === 1 ? 'Produto encontrado' : `${results.length} produtos encontrados`}
                        </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {results.map((product) => (
                            <button
                                key={product.id}
                                type="button"
                                onClick={() => handleSelectSuggestion(product)}
                                className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-blue-50"
                            >
                                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                    {product.images?.[0] ? (
                                        <img src={product.images[0]} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <PackageSearch className="h-5 w-5 text-slate-400" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                                    <p className="mt-0.5 text-xs font-mono text-slate-500">
                                        SKU: {product.sku || '-'} {product.eans?.[0] ? `· EAN: ${product.eans[0]}` : ''}
                                    </p>
                                </div>
                                <div className="hidden text-right sm:block">
                                    <p className="text-sm font-bold text-blue-700">{formatCurrency(product.price_retail || 0)}</p>
                                    <p className="text-xs text-slate-500">Estoque: {product.stock_quantity ?? 0}</p>
                                </div>
                                <span className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
                                    <Printer className="h-3.5 w-3.5" />
                                    Selecionar
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <LabelPrintModal
                isOpen={Boolean(selectedProduct)}
                product={selectedProduct}
                onClose={handleModalClose}
            />
        </div>
    );
};
