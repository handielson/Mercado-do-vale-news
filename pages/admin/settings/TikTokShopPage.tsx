import React, { useEffect, useState } from 'react';
import { ExternalLink, KeyRound, Loader2, RefreshCw, Save, ShieldCheck, Store } from 'lucide-react';
import { toast } from 'sonner';
import {
  tiktokShopService,
  type TikTokAuthorizedShopSummary,
  type TikTokShopSafeStatus,
} from '../../../services/tiktokShopService';
import TikTokShopSaleCalculator from './components/TikTokShopSaleCalculator';

type TikTokShopDraft = {
  app_key: string;
  app_secret: string;
  service_id: string;
};

const emptyDraft: TikTokShopDraft = {
  app_key: '',
  app_secret: '',
  service_id: '',
};

function formatTokenDate(value?: string | null) {
  if (!value) return 'Nao conectado';
  const asNumber = Number(value);
  const date = Number.isFinite(asNumber) && asNumber > 0
    ? new Date(asNumber * 1000)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data invalida';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function TikTokShopPage() {
  const [status, setStatus] = useState<TikTokShopSafeStatus | null>(null);
  const [shops, setShops] = useState<TikTokAuthorizedShopSummary[]>([]);
  const [draft, setDraft] = useState<TikTokShopDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);

    async function initialize() {
      setLoading(true);
      try {
        const data = await tiktokShopService.getStatus();
        if (cancelled) return;
        setStatus(data);
        setDraft({
          app_key: data.app_key || '',
          app_secret: '',
          service_id: data.service_id || '',
        });
      } catch (error) {
        console.error('[TikTokShopPage] status error:', error);
        if (!cancelled) toast.error('Nao foi possivel carregar o status do TikTok Shop.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initialize();

    if (params.get('connected') === 'true') {
      toast.success('TikTok Shop conectado com sucesso.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('error')) {
      toast.error(`Falha ao conectar TikTok Shop: ${params.get('detail') || params.get('error')}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  function updateDraft(key: keyof TikTokShopDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await tiktokShopService.updateSettings({
        app_key: draft.app_key.trim() || null,
        service_id: draft.service_id.trim() || null,
        ...(draft.app_secret.trim() ? { app_secret: draft.app_secret.trim() } : {}),
      });
      setStatus(updated);
      setDraft((current) => ({ ...current, app_secret: '' }));
      toast.success('Configuracao TikTok Shop salva sem expor o segredo.');
    } catch (error) {
      console.error('[TikTokShopPage] save error:', error);
      toast.error('Nao foi possivel salvar a configuracao TikTok Shop.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const data = await tiktokShopService.getAuthorizationUrl();
      if (!data?.url) throw new Error('Nao foi possivel gerar a URL de autorizacao.');
      window.location.href = data.url;
    } catch (error: any) {
      console.error('[TikTokShopPage] connect error:', error);
      toast.error(error?.message || 'Nao foi possivel iniciar a autorizacao TikTok Shop.');
    } finally {
      setConnecting(false);
    }
  }

  async function handleRefreshShops() {
    setRefreshing(true);
    try {
      const result = await tiktokShopService.refreshAuthorizedShops();
      setShops(result.shops || []);
      setStatus(result.status);
      toast.success(`${result.count} loja(s) autorizada(s) encontrada(s).`);
    } catch (error) {
      console.error('[TikTokShopPage] shops error:', error);
      toast.error('Nao foi possivel consultar as lojas autorizadas.');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando TikTok Shop...
      </div>
    );
  }

  const isConfigured = Boolean(status?.configured);
  const isConnected = Boolean(status?.connected);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Marketplace</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">TikTok Shop</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Conexao segura, renovacao de token, lojas autorizadas e calculadora comercial.
            Pedidos, estoque, etiquetas e catalogo serao liberados por etapas.
          </p>
        </div>
        <div className={`rounded-lg border px-4 py-3 text-sm ${isConnected ? 'border-green-200 bg-green-50 text-green-800' : isConfigured ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600'}`}>
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            {isConnected ? 'Conectado' : isConfigured ? 'Credenciais prontas' : 'Pendente'}
          </div>
          <p className="mt-1 text-xs opacity-80">
            {isConnected ? 'Token protegido no backend.' : isConfigured ? 'Pronto para autorizar a loja.' : 'Informe App Key, App Secret e Service ID.'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Credenciais do app</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">App Key</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                value={draft.app_key}
                onChange={(event) => updateDraft('app_key', event.target.value)}
                placeholder="App key do Partner Center"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">App Secret</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                type="password"
                autoComplete="new-password"
                value={draft.app_secret}
                onChange={(event) => updateDraft('app_secret', event.target.value)}
                placeholder={status?.app_secret_configured ? 'Configurado; deixe vazio para manter' : 'Informe o segredo uma vez'}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Service ID</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                value={draft.service_id}
                onChange={(event) => updateDraft('service_id', event.target.value)}
                placeholder="ID do aplicativo personalizado"
              />
            </label>
          </div>

          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            O App Secret, access token, refresh token e shop cipher permanecem somente no backend e nunca retornam para o navegador.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configuracao
            </button>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || !isConfigured}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Conectar com TikTok Shop
            </button>
            <button
              type="button"
              onClick={handleRefreshShops}
              disabled={refreshing || !isConnected}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Consultar lojas
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Store className="h-5 w-5 text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Status seguro</h2>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Seller / loja</dt>
                <dd className="font-medium text-slate-900">{status?.seller_name || 'Nao autorizado'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Regiao</dt>
                <dd className="font-medium text-slate-900">{status?.seller_base_region || 'Nao definida'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Open ID</dt>
                <dd className="font-mono text-xs text-slate-700">{status?.open_id_masked || 'Nao configurado'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Access token expira</dt>
                <dd className="font-medium text-slate-900">{formatTokenDate(status?.access_token_expires_at)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Shop cipher</dt>
                <dd className="font-medium text-slate-900">{status?.shop_cipher_configured ? 'Obtido com seguranca' : 'Pendente'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Callback OAuth</h2>
            <p className="mt-2 break-all font-mono text-xs text-slate-700">{status?.redirect_url}</p>
            <a
              href="https://partner.tiktokshop.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              Abrir Partner Center
              <ExternalLink className="h-4 w-4" />
            </a>
          </section>
        </aside>
      </div>

      {shops.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Lojas autorizadas</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((shop, index) => (
              <div key={`${shop.code || shop.name || 'shop'}-${index}`} className="rounded-lg border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">{shop.name || 'Loja TikTok Shop'}</p>
                <p className="mt-1 text-sm text-slate-600">{shop.region || 'Regiao nao informada'} · {shop.seller_type || 'Tipo nao informado'}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <TikTokShopSaleCalculator status={status} />
    </div>
  );
}
