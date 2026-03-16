import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { Search, AlertTriangle, CheckCircle, BarChart2, RefreshCw, Link as LinkIcon, Edit3, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { generateSlug } from '@/utils/urlHelpers';
import { toTitleCase } from '@/utils/stringFormatters';
import { toast } from 'sonner';

interface SEOStats {
    total: number;
    missingSlug: number;
    missingTitle: number;
    missingDesc: number;
    perfectScore: number;
}

export const SEODashboardPage: React.FC = () => {
    const [stats, setStats] = useState<SEOStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState<any[]>([]);

    const fetchSEOData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, slug, meta_title, meta_description, status, description')
                .order('created_at', { ascending: false });

            if (error) throw error;

            let missingSlug = 0;
            let missingTitle = 0;
            let missingDesc = 0;
            let perfectScore = 0;

            data.forEach((p) => {
                const hasSlug = !!p.slug;
                const hasTitle = !!p.meta_title;
                const hasDesc = !!p.meta_description;

                if (!hasSlug) missingSlug++;
                if (!hasTitle) missingTitle++;
                if (!hasDesc) missingDesc++;
                if (hasSlug && hasTitle && hasDesc) perfectScore++;
            });

            setStats({
                total: data.length,
                missingSlug,
                missingTitle,
                missingDesc,
                perfectScore
            });

            setProducts(data);
        } catch (err) {
            console.error('Erro ao buscar dados de SEO:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSEOData();
    }, []);

    const handleGenerateMissingSlugs = async () => {
        const missing = products.filter(p => !p.slug);
        if (missing.length === 0) {
            toast.info('Nenhum slug faltando no catálogo.');
            return;
        }

        setIsGenerating(true);
        let successCount = 0;
        let failCount = 0;

        toast.info(`Gerando ${missing.length} slugs. Por favor, aguarde...`);

        try {
            for (const p of missing) {
                let defaultSlug = generateSlug(p.name);
                let slugToUse = defaultSlug;
                let counter = 1;
                let isUnique = false;

                // Evitar duplicações
                while (!isUnique && counter < 10) {
                    const { data: existing } = await supabase.from('products').select('id').eq('slug', slugToUse).maybeSingle();
                    if (!existing || existing.id === p.id) {
                        isUnique = true;
                    } else {
                        slugToUse = `${defaultSlug}-${counter}`;
                        counter++;
                    }
                }

                const { error } = await supabase.from('products').update({ slug: slugToUse }).eq('id', p.id);
                if (!error) {
                    successCount++;
                } else {
                    console.error('Erro ao gerar slug para', p.name, error);
                    failCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`${successCount} links gerados com sucesso!`);
            }
            if (failCount > 0) {
                toast.error(`Falha ao gerar ${failCount} links.`);
            }

            fetchSEOData();
        } catch (err) {
            toast.error('Ocorreu um erro ao gerar os slugs.');
            console.error(err);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateMissingMetaTags = async () => {
        const missing = products.filter(p => !p.meta_title || !p.meta_description);
        if (missing.length === 0) {
            toast.info('Nenhuma Meta Tag faltando no catálogo.');
            return;
        }

        setIsGenerating(true);
        let successCount = 0;
        let failCount = 0;

        toast.info(`Gerando tags para ${missing.length} produtos. Aguarde...`);

        try {
            for (const p of missing) {
                let title = p.meta_title;
                if (!title) {
                    const baseName = toTitleCase(p.name);
                    const suffix = ' | Mercado do Vale';
                    title = baseName.length + suffix.length <= 60 
                        ? baseName + suffix 
                        : baseName.substring(0, 60);
                }

                // Pega a descrição limpa, ou usa um genérico, respeitando limites (ex: varchar(160))
                let desc = p.meta_description;
                if (!desc) {
                    const fallback = `Compre ${toTitleCase(p.name)} com os melhores preços e garantia no Mercado do Vale.`;
                    desc = p.description 
                        ? p.description.substring(0, 150).replace(/\n/g, ' ') + '...' 
                        : fallback;
                    
                    if (desc.length > 160) {
                         desc = desc.substring(0, 157) + '...';
                    }
                }

                const { error } = await supabase.from('products').update({
                    meta_title: title,
                    meta_description: desc
                }).eq('id', p.id);

                if (!error) {
                    successCount++;
                } else {
                    console.error('Erro ao gerar meta tags para', p.name, error);
                    failCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`${successCount} produtos atualizados com sucesso!`);
            }
            if (failCount > 0) {
                toast.error(`Falha ao atualizar ${failCount} produtos.`);
            }

            fetchSEOData();
        } catch (err) {
            toast.error('Ocorreu um erro ao gerar as tags.');
            console.error(err);
        } finally {
            setIsGenerating(false);
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.slug && p.slug.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold border-b-4 border-blue-600 inline-block pb-1 text-slate-900">
                        Análise de SEO
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Monitore a saúde orgânica do seu catálogo. Para o Google encontrar seu produto, ele precisa de tags bem preenchidas.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {stats && stats.missingSlug > 0 && (
                        <button
                            onClick={handleGenerateMissingSlugs}
                            disabled={isGenerating || loading}
                            className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm ${isGenerating ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            <Settings size={16} className={isGenerating ? "animate-spin" : ""} />
                            {isGenerating ? `Gerando Slugs...` : `Slugs Faltantes`}
                        </button>
                    )}
                    {stats && (stats.missingTitle > 0 || stats.missingDesc > 0) && (
                        <button
                            onClick={handleGenerateMissingMetaTags}
                            disabled={isGenerating || loading}
                            className={`flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors font-medium text-sm ${isGenerating ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            <Settings size={16} className={isGenerating ? "animate-spin" : ""} />
                            {isGenerating ? `Gerando Tags...` : `Gerar Meta Tags`}
                        </button>
                    )}
                    <button
                        onClick={fetchSEOData}
                        disabled={isGenerating || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading && !isGenerating ? "animate-spin" : ""} />
                        Atualizar
                    </button>
                </div>
            </div>

            {loading && !stats ? (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : stats && (
                <>
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                <BarChart2 size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Cadastros (Total)</p>
                                <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total}</h3>
                            </div>
                        </div>

                        <div className={"p-5 rounded-2xl border shadow-sm flex items-start gap-4 " + (stats.perfectScore === stats.total ? "bg-green-50 border-green-200" : "bg-white border-slate-200")}>
                            <div className={"p-3 rounded-xl " + (stats.perfectScore === stats.total ? "bg-green-100 text-green-700" : "bg-green-50 text-green-600")}>
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">SEO Completo</p>
                                <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.perfectScore}</h3>
                                <p className="text-xs text-slate-400 mt-1">{((stats.perfectScore / stats.total) * 100).toFixed(1)}% do catálogo</p>
                            </div>
                        </div>

                        <div className={"p-5 rounded-2xl border shadow-sm flex items-start gap-4 " + (stats.missingSlug > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200")}>
                            <div className={"p-3 rounded-xl " + (stats.missingSlug > 0 ? "bg-red-100 text-red-700" : "bg-red-50 text-red-600")}>
                                <LinkIcon size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Sem Link Amigável</p>
                                <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.missingSlug}</h3>
                                {stats.missingSlug > 0 && <p className="text-xs text-red-500 mt-1 font-medium">Alerta Crítico: Sem Rota</p>}
                            </div>
                        </div>

                        <div className={"p-5 rounded-2xl border shadow-sm flex items-start gap-4 " + ((stats.missingTitle > 0 || stats.missingDesc > 0) ? "bg-yellow-50 border-yellow-200" : "bg-white border-slate-200")}>
                            <div className={"p-3 rounded-xl " + ((stats.missingTitle > 0 || stats.missingDesc > 0) ? "bg-yellow-100 text-yellow-700" : "bg-yellow-50 text-yellow-600")}>
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Falta Título / Desc</p>
                                <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.missingTitle + stats.missingDesc}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Tabela de Produtos */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center gap-4 flex-wrap">
                            <h2 className="font-semibold text-slate-800">Auditoria Detalhada</h2>
                            <div className="relative w-full max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nome ou slug..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="bg-slate-50/50 text-slate-500 uppercase tracking-wider text-xs border-b border-slate-200">
                                        <th className="px-6 py-4 font-semibold">Produto</th>
                                        <th className="px-6 py-4 font-semibold text-center">Slug (Link)</th>
                                        <th className="px-6 py-4 font-semibold text-center">Meta Title</th>
                                        <th className="px-6 py-4 font-semibold text-center">Meta Description</th>
                                        <th className="px-6 py-4 font-semibold text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {filteredProducts.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-900 truncate max-w-[300px]" title={p.name}>
                                                    {p.name}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    {p.status === 'active' ? 'Ativo' : 'Inativo'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {p.slug ? (
                                                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-mono border border-green-200">
                                                        <CheckCircle className="w-3 h-3" /> OK
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-1 rounded text-xs font-semibold border border-red-200">
                                                        <AlertTriangle className="w-3 h-3" /> Ausente
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {p.meta_title ? (
                                                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded text-xs border border-green-200">
                                                        <CheckCircle className="w-3 h-3" /> OK
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-50 px-2 py-1 rounded text-xs border border-yellow-200">
                                                        <AlertTriangle className="w-3 h-3" /> Faltante
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {p.meta_description ? (
                                                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded text-xs border border-green-200">
                                                        <CheckCircle className="w-3 h-3" /> OK
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-50 px-2 py-1 rounded text-xs border border-yellow-200">
                                                        <AlertTriangle className="w-3 h-3" /> Faltante
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    to={`/admin/products/${p.id}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors border border-blue-200"
                                                >
                                                    <Edit3 className="w-3 h-3" /> Editar
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                                Nenhum produto encontrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
