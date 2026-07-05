import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, KeyRound, Loader2, Save, ShieldCheck, Store } from 'lucide-react';
import { toast } from 'sonner';
import { companySettingsService } from '../../../services/companySettingsService';
import type { CompanySettings } from '../../../types/companySettings';
import { buildTikTokShopSellerAuthUrl } from '../../../services/tiktokShopAuthUrlService.js';

type TikTokShopDraft = Pick<
  CompanySettings,
  | 'tiktok_app_key'
  | 'tiktok_app_secret'
  | 'tiktok_service_id'
  | 'tiktok_shop_cipher'
>;

const emptyDraft: TikTokShopDraft = {
  tiktok_app_key: '',
  tiktok_app_secret: '',
  tiktok_service_id: '',
  tiktok_shop_cipher: '',
};

function maskValue(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return 'Nao configurado';
  if (text.length <= 8) return 'Configurado';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

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
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [draft, setDraft] = useState<TikTokShopDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const isConfigured = Boolean(draft.tiktok_app_key && draft.tiktok_app_secret && draft.tiktok_service_id);
  const isConnected = Boolean(settings?.tiktok_access_token);
  const sellerAuthUrl = useMemo(
    () => buildTikTokShopSellerAuthUrl({ serviceId: draft.tiktok_service_id, market: 'ROW' }),
    [draft.tiktok_service_id],
  );

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true' || params.get('error')) {
      companySettingsService.clearCache();
    }

    async function loadSettings() {
      setLoading(true);
      try {
        const data = await companySettingsService.get();
        if (cancelled) return;
        setSettings(data);
        setDraft({
          tiktok_app_key: data?.tiktok_app_key || '',
          tiktok_app_secret: data?.tiktok_app_secret || '',
          tiktok_service_id: data?.tiktok_service_id || '',
          tiktok_shop_cipher: data?.tiktok_shop_cipher || '',
        });
      } catch (error) {
        console.error('[TikTokShopPage] load error:', error);
        if (!cancelled) toast.error('Nao foi possivel carregar a configuracao TikTok Shop.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      toast.success('TikTok Shop conectado com sucesso.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    const error = params.get('error');
    if (error) {
      const detail = params.get('detail');
      toast.error(`Falha ao conectar TikTok Shop: ${detail || error}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  function updateDraft(key: keyof TikTokShopDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await companySettingsService.update({
        tiktok_app_key: draft.tiktok_app_key?.trim() || null,
        tiktok_app_secret: draft.tiktok_app_secret?.trim() || null,
        tiktok_service_id: draft.tiktok_service_id?.trim() || null,
        tiktok_shop_cipher: draft.tiktok_shop_cipher?.trim() || null,
      });
      setSettings(updated);
      toast.success('Configuracao TikTok Shop salva.');
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
      const response = await fetch('/api/tiktok-shop/oauth/auth', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Nao foi possivel gerar a URL de autorizacao.');
      }
      window.location.href = data.url;
    } catch (error: any) {
      console.error('[TikTokShopPage] connect error:', error);
      toast.error(error?.message || 'Nao foi possivel iniciar a autorizacao TikTok Shop.');
    } finally {
      setConnecting(false);
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Marketplace</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">TikTok Shop</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Base inicial para credenciais, autorizacao e identidade da loja. Sync de produtos, pedidos e webhooks fica desligado nesta fase.
          </p>
        </div>
        <div className={`rounded-lg border px-4 py-3 text-sm ${isConnected ? 'border-green-200 bg-green-50 text-green-800' : isConfigured ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600'}`}>
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            {isConnected ? 'Conectado' : isConfigured ? 'Credenciais prontas' : 'Pendente'}
          </div>
          <p className="mt-1 text-xs opacity-80">
            {isConnected ? 'Token salvo para uso futuro.' : isConfigured ? 'Proximo passo: callback OAuth.' : 'Informe App Key, App Secret e Service ID.'}
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
                value={draft.tiktok_app_key || ''}
                onChange={(event) => updateDraft('tiktok_app_key', event.target.value)}
                placeholder="App key do Partner Center"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">App Secret</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                type="password"
                value={draft.tiktok_app_secret || ''}
                onChange={(event) => updateDraft('tiktok_app_secret', event.target.value)}
                placeholder="Nunca expor em logs"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Service ID</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                value={draft.tiktok_service_id || ''}
                onChange={(event) => updateDraft('tiktok_service_id', event.target.value)}
                placeholder="ID do aplicativo online"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Shop Cipher</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
                value={draft.tiktok_shop_cipher || ''}
                onChange={(event) => updateDraft('tiktok_shop_cipher', event.target.value)}
                placeholder="Necessario para APIs da loja"
              />
            </label>
          </div>

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
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Conectar com TikTok Shop
            </button>
            <a
              href="https://partner.tiktokshop.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Abrir Partner Center
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Store className="h-5 w-5 text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Status</h2>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Seller</dt>
                <dd className="font-medium text-slate-900">{settings?.tiktok_seller_name || 'Nao autorizado'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Regiao</dt>
                <dd className="font-medium text-slate-900">{settings?.tiktok_seller_base_region || 'Nao definida'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Open ID</dt>
                <dd className="font-mono text-xs text-slate-700">{maskValue(settings?.tiktok_open_id)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Access token expira</dt>
                <dd className="font-medium text-slate-900">{formatTokenDate(settings?.tiktok_access_token_expires_at)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Proxima URL OAuth</h2>
            <p className="mt-2 text-sm text-slate-600">
              Previa sem assinatura de seguranca. Use o botao Conectar para gerar a URL oficial com state pelo backend.
            </p>
            <textarea
              readOnly
              className="mt-3 h-24 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700"
              value={sellerAuthUrl || 'Informe o Service ID para gerar a URL.'}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
