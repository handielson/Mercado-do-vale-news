import React, { useState, useRef, useEffect } from 'react';
import { Link2, Link2Off, Loader2, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';
import { searchBlingProducts, BlingProduct } from '../../../services/blingService';

interface BlingLinkSectionProps {
    blingId?: number;
    blingParentId?: number;
    onLink: (blingId: number, blingParentId?: number) => void;
    onUnlink: () => void;
}

/**
 * BlingLinkSection — Seção do formulário para vincular/desvincular um produto ao Bling.
 * Busca no Bling por nome ou SKU e permite selecionar o produto correto para vincular.
 */
export function BlingLinkSection({ blingId, blingParentId, onLink, onUnlink }: BlingLinkSectionProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<BlingProduct[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Fecha dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = (value: string) => {
        setQuery(value);
        setSearchError(null);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (value.trim().length < 2) {
            setResults([]);
            setShowResults(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const found = await searchBlingProducts(value.trim());
                setResults(found.slice(0, 8));
                setShowResults(true);
            } catch (err: any) {
                setSearchError(err?.message || 'Erro ao buscar no Bling. Verifique a conexão.');
                setResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 600);
    };

    const handleSelect = (product: BlingProduct) => {
        const parentId = product.variacao?.produtoPai?.id;
        onLink(product.id, parentId);
        toast.success(`✅ Vinculado com sucesso: ${product.nome}`);
        setQuery('');
        setResults([]);
        setShowResults(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Impede que o form salve o produto inteiro acidentalmente
            if (results.length > 0) {
                handleSelect(results[0]); // Seleciona o primeiro da lista se der enter
            }
        }
    };

    // Produto já vinculado
    if (blingId) {
        return (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Link2 size={18} className="text-green-600" />
                    Vínculo com Bling
                </h3>
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-900">Produto vinculado ao Bling</p>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="font-mono text-xs text-green-700">ID: {blingId}</span>
                            {blingParentId && (
                                <span className="font-mono text-xs text-green-600">
                                    Pai: {blingParentId}
                                </span>
                            )}
                            <a
                                href={`https://app.bling.com.br/produtos/${blingId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900 transition-colors"
                            >
                                Ver no Bling <ExternalLink size={10} />
                            </a>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onUnlink}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                    >
                        <Link2Off size={12} />
                        Desvincular
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                    💡 As vendas no PDV irão decrementar o estoque no Bling automaticamente.
                </p>
            </div>
        );
    }

    // Produto sem vínculo — exibe buscador
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <Link2Off size={18} className="text-slate-400" />
                Vínculo com Bling
                <span className="ml-2 text-xs font-normal text-slate-400">(opcional)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
                Vincule este produto ao Bling para sincronizar estoque automaticamente nas vendas do PDV.
            </p>

            <div className="relative" ref={containerRef}>
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Buscar no Bling por nome ou SKU... (Digite e aguarde a lista)"
                        className="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {isSearching && (
                        <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                    )}
                </div>

                {searchError && (
                    <p className="text-xs text-red-600 mt-1">{searchError}</p>
                )}

                {showResults && results.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {results.map((product) => (
                            <li
                                key={product.id}
                                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                                onClick={() => handleSelect(product)}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-800 truncate">{product.nome}</p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        {product.codigo && (
                                            <span className="font-mono text-[10px] text-slate-400">SKU: {product.codigo}</span>
                                        )}
                                        {product.gtin && (
                                            <span className="font-mono text-[10px] text-slate-400">EAN: {product.gtin}</span>
                                        )}
                                        {product.variacao?.produtoPai && (
                                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">↳ Variação</span>
                                        )}
                                    </div>
                                </div>
                                <span className="font-mono text-[10px] text-slate-300 shrink-0">#{product.id}</span>
                            </li>
                        ))}
                    </ul>
                )}

                {showResults && results.length === 0 && !isSearching && (
                    <p className="text-xs text-slate-400 mt-2 text-center py-2">
                        Nenhum produto encontrado no Bling para "{query}"
                    </p>
                )}
            </div>
        </div>
    );
}
