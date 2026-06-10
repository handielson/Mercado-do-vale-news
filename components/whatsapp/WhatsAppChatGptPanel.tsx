import React from 'react';
import { Bot, ExternalLink, KeyRound, RefreshCw, Save, ShieldCheck, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../services/autoResponderService';
import type { AutoResponderSettings, AutoResponderStats } from '../../types/autoResponder';

type ChatGptFormState = {
  ai_enabled: boolean;
  ai_model: string;
  ai_reasoning_effort: string;
  ai_daily_limit: string;
  ai_monthly_limit: string;
  ai_credit_balance_usd: string;
  ai_credit_alert_usd: string;
  ai_input_cost_per_1m_usd: string;
  ai_output_cost_per_1m_usd: string;
  openai_api_key: string;
  openai_admin_api_key: string;
  has_openai_api_key: boolean;
  openai_api_key_masked: string;
  has_openai_admin_api_key: boolean;
  openai_admin_api_key_masked: string;
};

const defaultForm: ChatGptFormState = {
  ai_enabled: false,
  ai_model: 'gpt-5-nano',
  ai_reasoning_effort: 'low',
  ai_daily_limit: '0',
  ai_monthly_limit: '0',
  ai_credit_balance_usd: '0',
  ai_credit_alert_usd: '5',
  ai_input_cost_per_1m_usd: '0',
  ai_output_cost_per_1m_usd: '0',
  openai_api_key: '',
  openai_admin_api_key: '',
  has_openai_api_key: false,
  openai_api_key_masked: '',
  has_openai_admin_api_key: false,
  openai_admin_api_key_masked: '',
};

function isEnabled(value: unknown): boolean {
  return value === true || Number(value) === 1 || String(value) === 'true';
}

function numericText(value: unknown, fallback: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(value ?? fallback) : fallback;
}

function settingsToForm(settings: AutoResponderSettings | null): ChatGptFormState {
  if (!settings) return defaultForm;
  return {
    ai_enabled: isEnabled(settings.ai_enabled),
    ai_model: settings.ai_model || defaultForm.ai_model,
    ai_reasoning_effort: settings.ai_reasoning_effort || defaultForm.ai_reasoning_effort,
    ai_daily_limit: numericText(settings.ai_daily_limit, defaultForm.ai_daily_limit),
    ai_monthly_limit: numericText(settings.ai_monthly_limit, defaultForm.ai_monthly_limit),
    ai_credit_balance_usd: numericText(settings.ai_credit_balance_usd, defaultForm.ai_credit_balance_usd),
    ai_credit_alert_usd: numericText(settings.ai_credit_alert_usd, defaultForm.ai_credit_alert_usd),
    ai_input_cost_per_1m_usd: numericText(settings.ai_input_cost_per_1m_usd, defaultForm.ai_input_cost_per_1m_usd),
    ai_output_cost_per_1m_usd: numericText(settings.ai_output_cost_per_1m_usd, defaultForm.ai_output_cost_per_1m_usd),
    openai_api_key: '',
    openai_admin_api_key: '',
    has_openai_api_key: isEnabled(settings.has_openai_api_key),
    openai_api_key_masked: settings.openai_api_key_masked || '',
    has_openai_admin_api_key: isEnabled(settings.has_openai_admin_api_key),
    openai_admin_api_key_masked: settings.openai_admin_api_key_masked || '',
  };
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUsd(value: unknown): string {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatNumber(value: unknown): string {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('pt-BR').format(Number.isFinite(amount) ? amount : 0);
}

export function WhatsAppChatGptPanel() {
  const [form, setForm] = React.useState<ChatGptFormState>(defaultForm);
  const [stats, setStats] = React.useState<AutoResponderStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const aiFinance = stats?.summary?.ai_finance;

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setSettingsLoaded(false);
    try {
      const settings = await autoResponderService.getSettings();
      setForm(settingsToForm(settings));
      setSettingsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar configuracoes do ChatGPT.');
    } finally {
      setLoading(false);
    }

    try {
      const nextStats = await autoResponderService.getStats({ source: 'mysql' });
      setStats(nextStats);
    } catch {
      setStats(null);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateForm(patch: Partial<ChatGptFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function saveSettings() {
    if (!settingsLoaded) {
      setError('Carregue as configuracoes atuais antes de salvar o ChatGPT.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        ai_enabled: form.ai_enabled,
        ai_model: form.ai_model.trim() || defaultForm.ai_model,
        ai_reasoning_effort: form.ai_reasoning_effort || defaultForm.ai_reasoning_effort,
        ai_daily_limit: toNumber(form.ai_daily_limit),
        ai_monthly_limit: toNumber(form.ai_monthly_limit),
        ai_credit_balance_usd: toNumber(form.ai_credit_balance_usd),
        ai_credit_alert_usd: toNumber(form.ai_credit_alert_usd),
        ai_input_cost_per_1m_usd: toNumber(form.ai_input_cost_per_1m_usd),
        ai_output_cost_per_1m_usd: toNumber(form.ai_output_cost_per_1m_usd),
      };
      if (form.openai_api_key.trim()) payload.openai_api_key = form.openai_api_key.trim();
      if (form.openai_admin_api_key.trim()) payload.openai_admin_api_key = form.openai_admin_api_key.trim();

      const saved = await autoResponderService.updateSettings(payload);
      setForm(settingsToForm(saved));
      toast.success('ChatGPT salvo na VPS');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar configuracoes do ChatGPT.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-600">
            <Sparkles size={15} />
            ChatGPT
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Atendente inteligente com limites</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Controla quando a IA pode responder, qual modelo usar, teto de uso e chaves salvas na VPS.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading || saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={loading || saving || !settingsLoaded}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Salvando...' : 'Salvar ChatGPT'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
            form.ai_enabled ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
          }`}>
            <input
              type="checkbox"
              checked={form.ai_enabled}
              onChange={(event) => updateForm({ ai_enabled: event.target.checked })}
              disabled={loading}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Ativar ChatGPT nas respostas guiadas</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                A IA entra apenas depois de fluxo ativo, regra, intent e busca de produto confiavel.
              </span>
            </span>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase text-slate-500">
              Modelo
              <input
                value={form.ai_model}
                onChange={(event) => updateForm({ ai_model: event.target.value })}
                disabled={loading}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              />
            </label>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Raciocinio
              <select
                value={form.ai_reasoning_effort}
                onChange={(event) => updateForm({ ai_reasoning_effort: event.target.value })}
                disabled={loading}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase text-slate-500">
              Limite diario
              <input
                type="number"
                min={0}
                value={form.ai_daily_limit}
                onChange={(event) => updateForm({ ai_daily_limit: event.target.value })}
                disabled={loading}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              />
            </label>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Limite mensal
              <input
                type="number"
                min={0}
                value={form.ai_monthly_limit}
                onChange={(event) => updateForm({ ai_monthly_limit: event.target.value })}
                disabled={loading}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              />
            </label>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Alerta de credito USD
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.ai_credit_alert_usd}
                onChange={(event) => updateForm({ ai_credit_alert_usd: event.target.value })}
                disabled={loading}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase text-slate-500">
              Custo input / 1M tokens
              <input
                type="number"
                min={0}
                step="0.000001"
                value={form.ai_input_cost_per_1m_usd}
                onChange={(event) => updateForm({ ai_input_cost_per_1m_usd: event.target.value })}
                disabled={loading}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              />
            </label>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Custo output / 1M tokens
              <input
                type="number"
                min={0}
                step="0.000001"
                value={form.ai_output_cost_per_1m_usd}
                onChange={(event) => updateForm({ ai_output_cost_per_1m_usd: event.target.value })}
                disabled={loading}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              />
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="rounded-lg border border-slate-200 p-3 text-xs font-semibold uppercase text-slate-500">
              <span className="flex items-center gap-2">
                <KeyRound size={15} />
                OpenAI API key
              </span>
              <input
                type="password"
                value={form.openai_api_key}
                onChange={(event) => updateForm({ openai_api_key: event.target.value })}
                placeholder={form.has_openai_api_key ? `Chave salva: ${form.openai_api_key_masked}` : 'Cole uma nova chave para salvar na VPS'}
                disabled={loading}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              />
            </label>
            <label className="rounded-lg border border-slate-200 p-3 text-xs font-semibold uppercase text-slate-500">
              <span className="flex items-center gap-2">
                <KeyRound size={15} />
                Admin API key
              </span>
              <input
                type="password"
                value={form.openai_admin_api_key}
                onChange={(event) => updateForm({ openai_admin_api_key: event.target.value })}
                placeholder={form.has_openai_admin_api_key ? `Chave admin salva: ${form.openai_admin_api_key_masked}` : 'Cole uma Admin API key para buscar custos oficiais'}
                disabled={loading}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              />
            </label>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Hoje</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatUsd(aiFinance?.today_estimated_cost_usd)}</p>
              <p className="mt-1 text-xs text-slate-500">{formatNumber(aiFinance?.today_input_tokens)} tokens in</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Mes</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatUsd(aiFinance?.month_estimated_cost_usd)}</p>
              <p className="mt-1 text-xs text-slate-500">{formatNumber(aiFinance?.month_responses)} respostas</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Credito local</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatUsd(aiFinance?.remaining_credit_usd ?? form.ai_credit_balance_usd)}</p>
              <p className="mt-1 text-xs text-slate-500">alerta em {formatUsd(form.ai_credit_alert_usd)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Credito oficial</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {aiFinance?.openai_official_remaining_credit_usd == null ? '-' : formatUsd(aiFinance.openai_official_remaining_credit_usd)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {aiFinance?.openai_official_cost_status || 'Admin key pendente'}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={16} />
              Fallback seguro
            </p>
            <p className="mt-1 text-xs leading-5">
              O ChatGPT so pode responder usando dados enviados pelo sistema. Produtos, precos, estoque, prazos e garantias fora do catalogo oficial sao bloqueados pelo prompt do servidor.
            </p>
          </div>

          <a
            href="https://platform.openai.com/usage"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink size={16} />
            Ver uso na OpenAI
          </a>
        </aside>
      </div>

      {error && (
        <div className="mx-4 mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}
