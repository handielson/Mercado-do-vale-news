import React, { useState, useEffect } from 'react';
import { Search, Globe, EyeOff, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { vpsApiService } from '@/services/vpsApiService';
import { useDebounce } from '@/hooks/useDebounce';

interface BlacklistProduct {
    id: string;
    name: string;
    sku: string | null;
    exclude_from_seo: boolean;
    images?: string[];
}

export const SEOBlacklistPage: React.FC = () => {
    const [products, setProducts] = useState<BlacklistProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'blacklisted'>('all');
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const debouncedSearch = useDebounce(searchQuery, 300);

    const loadProducts = async () => {
        try {
            setLoading(true);
            
            // Busca os dados exclusivamente pela VPS, sem tocar no Supabase
            const vpsData = await vpsApiService.getProducts({ 
                search: debouncedSearch.trim() || undefined
            });

            if (vpsData) {
                let mapped = vpsData.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    sku: p.sku || null,
                    exclude_from_seo: Boolean(p.exclude_from_seo),
                    images: p.images || []
                }));

                if (filter === 'blacklisted') {
                    mapped = mapped.filter((p: BlacklistProduct) => p.exclude_from_seo);
                }

                setProducts(mapped);
            }
        } catch (error) {
            console.error('Falha ao carregar produtos:', error);
            toast.error('Erro ao carregar produtos do servidor VPS');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProducts();
    }, [debouncedSearch, filter]);

    const handleToggleSEO = async (product: BlacklistProduct) => {
        try {
            setTogglingId(product.id);
            const newValue = !product.exclude_from_seo;
            
            // Envia a chamada APENAS para a VPS (MySQL), garantindo que
            // nenhuma tabela/coluna desconhecida seja cobrada do Supabase.
            const ok = await vpsApiService.updateProduct(product.id, { exclude_from_seo: newValue });

            if (!ok) throw new Error("A VPS rejeitou a atualização.");

            toast.success(newValue 
                ? `Produto ocultado do Google com sucesso!` 
                : `Produto visível no Google novamente!`
            );

            setProducts(current => 
                current.map(p => 
                    p.id === product.id ? { ...p, exclude_from_seo: newValue } : p
                )
            );
        } catch (error) {
            console.error('Erro ao alternar status SEO:', error);
            toast.error('Ocorreu um erro ao salvar na VPS.');
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className="animate-in fade-in duration-300 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Globe className="w-8 h-8 text-blue-500" />
                    Lista Negra SEO (Google)
                </h1>
                <p className="text-slate-500 mt-1">
                    Gerencie quais produtos **NÃO** devem aparecer nas buscas do Google (por direitos autorais ou exclusividade).
                    Eles continuarão aparecendo normalmente na sua loja.
                </p>
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex gap-3">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-500" />
                    <div>
                        <strong>Aviso importante:</strong> Esta página agora salva e lê os dados 100% via VPS. O bloqueio na página do produto reflete o banco do VPS.
                    </div>
                </div>
            </div>

            {/* Config & Filters */}
            <div className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-center shadow-sm">
                <div className="relative flex-1 w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Pesquisar produto pelo nome..."
                        className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-shadow"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setFilter('blacklisted')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filter === 'blacklisted' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        Apenas Bloqueados
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        Todos os Produtos
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b text-sm font-semibold text-slate-700">
                            <th className="p-4 w-16">Item</th>
                            <th className="p-4">Produto</th>
                            <th className="p-4 w-32">SKU</th>
                            <th className="p-4 w-40 text-center">Status no Google</th>
                            <th className="p-4 w-32 text-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center">
                                    <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="mt-2 text-slate-500 font-medium">Buscando produtos...</p>
                                </td>
                            </tr>
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-500">
                                    <Globe className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    Nenhum produto encontrado com os filtros atuais.
                                </td>
                            </tr>
                        ) : (
                            products.map((product) => (
                                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 border overflow-hidden flex items-center justify-center bg-white">
                                            {product.images && product.images.length > 0 ? (
                                                <img src={product.images[0]} alt="" className="w-full h-full object-contain" />
                                            ) : (
                                                <span className="text-xs text-slate-400">Sem Img</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 font-medium text-slate-900">
                                        {product.name}
                                    </td>
                                    <td className="p-4 text-slate-500 font-mono text-xs">
                                        {product.sku || 'N/D'}
                                    </td>
                                    <td className="p-4 text-center">
                                        {product.exclude_from_seo ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                <EyeOff className="w-3.5 h-3.5" />
                                                Bloqueado
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                                <Globe className="w-3.5 h-3.5" />
                                                Indexável
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleToggleSEO(product)}
                                            disabled={togglingId === product.id}
                                            className={`px-3 py-1.5 rounded font-bold text-xs transition border focus:ring-2 focus:ring-offset-1 ${
                                                product.exclude_from_seo 
                                                ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' 
                                                : 'bg-amber-100 border-amber-200 text-amber-800 hover:bg-amber-200'
                                            } disabled:opacity-50`}
                                        >
                                            {togglingId === product.id ? 'Aguarde...' : product.exclude_from_seo ? 'Permitir no Google' : 'Ocultar do Google'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
