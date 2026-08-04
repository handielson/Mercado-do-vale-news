import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Facebook, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
    metaMarketingConnectionService,
    type MetaMarketingConnection,
} from '../../../../services/metaMarketingConnectionService';

const STATUS_LABELS = {
    disconnected: 'Não conectado',
    connected: 'Conectado',
    expired: 'Token expirado',
    error: 'Atenção necessária',
};

export default function MetaMarketingConnectionPanel() {
    const [connection, setConnection] = useState<MetaMarketingConnection | null>(null);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState<'connect' | 'select' | 'audit' | null>(null);
    const [adAccountId, setAdAccountId] = useState('');
    const [pageId, setPageId] = useState('');

    const load = async () => {
        const next = await metaMarketingConnectionService.getStatus();
        setConnection(next);
        setAdAccountId(next.selectedAdAccount?.id || '');
        setPageId(next.selectedPage?.id || '');
    };

    useEffect(() => {
        load()
            .catch((error: any) => toast.error(error?.message || 'Não foi possível consultar a conexão Meta.'))
            .finally(() => setLoading(false));
    }, []);

    const connect = async () => {
        setWorking('connect');
        try {
            const authorizationUrl = await metaMarketingConnectionService.startOAuth();
            window.location.assign(authorizationUrl);
        } catch (error: any) {
            toast.error(error?.message || 'Não foi possível iniciar a conexão com a Meta.');
            setWorking(null);
        }
    };

    const select = async () => {
        if (!adAccountId || !pageId) return toast.error('Selecione a conta de anúncios e a página do Instagram.');
        setWorking('select');
        try {
            setConnection(await metaMarketingConnectionService.selectAssets(adAccountId, pageId));
            toast.success('Conta de anúncios e Instagram selecionados.');
        } catch (error: any) {
            toast.error(error?.message || 'Não foi possível salvar a seleção.');
        } finally {
            setWorking(null);
        }
    };

    const audit = async () => {
        setWorking('audit');
        try {
            setConnection(await metaMarketingConnectionService.audit());
            toast.success('Auditoria somente leitura concluída. Nenhuma campanha foi alterada.');
        } catch (error: any) {
            toast.error(error?.message || 'Não foi possível auditar a conta Meta.');
            await load().catch(() => {});
        } finally {
            setWorking(null);
        }
    };

    if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Consultando conexão Meta...</div>;
    if (!connection) return null;

    const pagesWithInstagram = connection.availablePages.filter((page) => page.instagram_business_account?.id);
    const readyToAudit = connection.status === 'connected' && Boolean(connection.selectedAdAccount && connection.selectedPage);

    return (
        <section className="rounded-2xl border border-blue-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-blue-100 bg-blue-50/60 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-blue-600 p-2.5 text-white"><Facebook className="h-5 w-5" /></div>
                    <div><p className="text-xs font-black uppercase tracking-wide text-blue-600">Conexão oficial Meta</p><h3 className="mt-1 text-lg font-black text-slate-900">{STATUS_LABELS[connection.status]}</h3><p className="mt-1 text-sm text-slate-600">A VPS guarda o token criptografado. A auditoria abaixo não cria, pausa ou edita anúncios.</p></div>
                </div>
                <button onClick={connect} disabled={!connection.configured || working !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{working === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}{connection.status === 'connected' ? 'Reconectar Meta' : 'Conectar Meta'}</button>
            </div>

            <div className="space-y-4 p-5">
                {!connection.configured && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Configuração pendente na VPS.</strong><p className="mt-1">Faltam: {connection.missingConfiguration.join(', ')}.</p>{connection.redirectUri && <p className="mt-1">Callback: <code>{connection.redirectUri}</code></p>}</div>}

                {connection.status === 'connected' && (
                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                        <label><span className="text-xs font-black uppercase tracking-wide text-slate-500">Conta de anúncios</span><select value={adAccountId} onChange={(event) => setAdAccountId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold"><option value="">Selecione</option>{connection.availableAdAccounts.map((account) => <option key={account.id} value={account.id}>{account.name || account.id} {account.currency ? `(${account.currency})` : ''}</option>)}</select></label>
                        <label><span className="text-xs font-black uppercase tracking-wide text-slate-500">Página ligada ao Instagram</span><select value={pageId} onChange={(event) => setPageId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold"><option value="">Selecione</option>{pagesWithInstagram.map((page) => <option key={page.id} value={page.id}>{page.name || page.id} — @{page.instagram_business_account?.username || 'Instagram'}</option>)}</select></label>
                        <button onClick={select} disabled={working !== null} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50 disabled:opacity-50">{working === 'select' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Confirmar contas</button>
                    </div>
                )}

                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="flex items-center gap-2 text-sm font-black text-slate-800"><ShieldCheck className="h-4 w-4 text-emerald-600" />Auditoria segura</p><p className="mt-1 text-xs text-slate-500">Lê conta, perfil e campanhas existentes. Não executa mutações nem gera cobrança.</p></div>
                    <button onClick={audit} disabled={!readyToAudit || working !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50">{working === 'audit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Auditar agora</button>
                </div>

                {connection.lastAudit && <div className="grid gap-3 sm:grid-cols-4"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Instagram</p><p className="mt-1 font-black text-slate-900">@{connection.lastAudit.instagram?.username || connection.instagramUsername || '—'}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Seguidores</p><p className="mt-1 font-black text-slate-900">{connection.lastAudit.instagram?.followers_count ?? '—'}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Campanhas encontradas</p><p className="mt-1 font-black text-slate-900">{connection.lastAudit.campaignSummary?.total ?? 0}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Ativas agora</p><p className="mt-1 font-black text-slate-900">{connection.lastAudit.campaignSummary?.active ?? 0}</p></div></div>}

                {connection.lastError && <p className="flex items-center gap-2 text-xs font-semibold text-rose-700"><RefreshCw className="h-3.5 w-3.5" />{connection.lastError}</p>}
            </div>
        </section>
    );
}
