import React from 'react';
import { Bot, Minus, Plus, Power, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../services/autoResponderService';
import type { AutoResponderSettings } from '../../types/autoResponder';

type ResponseToneMode = NonNullable<AutoResponderSettings['response_tone_mode']>;

const toneOptions: Array<{ value: ResponseToneMode; label: string; description: string }> = [
  { value: 'auto_abc', label: 'Auto A/B/C', description: 'Distribui um tom fixo por conversa para comparar resultados.' },
  { value: 'a', label: 'A - Direto', description: 'Respostas curtas, comerciais e objetivas.' },
  { value: 'b', label: 'B - Consultivo', description: 'Ajuda o cliente com mais contexto antes de encaminhar.' },
  { value: 'c', label: 'C - Humano', description: 'Mais natural, com jeito de conversa no WhatsApp.' },
];

function normalizeFinishPauseDays(value: unknown): number {
  const number = Number(value || 30);
  return Number.isFinite(number) ? Math.max(1, Math.min(Math.round(number), 3650)) : 30;
}

function normalizeToneMode(value: unknown): ResponseToneMode {
  const mode = String(value || 'auto_abc') as ResponseToneMode;
  return toneOptions.some((option) => option.value === mode) ? mode : 'auto_abc';
}

function normalizeEnabled(value: unknown): boolean {
  return value === true || Number(value) === 1 || String(value) === 'true';
}

export function WhatsAppBotSettingsPanel() {
  const [botEnabled, setBotEnabled] = React.useState(false);
  const [finishPauseDays, setFinishPauseDays] = React.useState(30);
  const [responseToneMode, setResponseToneMode] = React.useState<ResponseToneMode>('auto_abc');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    autoResponderService.getSettings()
      .then((settings) => {
        if (!mounted) return;
        setBotEnabled(normalizeEnabled(settings?.enabled));
        setFinishPauseDays(normalizeFinishPauseDays(settings?.manual_finish_pause_days));
        setResponseToneMode(normalizeToneMode(settings?.response_tone_mode));
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar configuracoes do bot.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function saveSettings() {
    setSaving(true);
    setError(null);
    try {
      const settings = await autoResponderService.updateSettings({
        enabled: botEnabled,
        manual_finish_pause_days: normalizeFinishPauseDays(finishPauseDays),
        days_paused_after_finish: normalizeFinishPauseDays(finishPauseDays),
        finish_pause_days: normalizeFinishPauseDays(finishPauseDays),
        response_tone_mode: responseToneMode,
      });
      setBotEnabled(normalizeEnabled(settings.enabled));
      setFinishPauseDays(normalizeFinishPauseDays(settings.manual_finish_pause_days));
      setResponseToneMode(normalizeToneMode(settings.response_tone_mode));
      toast.success('Configuracoes do bot salvas');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar configuracoes do bot.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleBotEnabled() {
    const nextEnabled = !botEnabled;
    setSaving(true);
    setError(null);
    try {
      const settings = await autoResponderService.updateSettings({
        enabled: nextEnabled,
        manual_finish_pause_days: normalizeFinishPauseDays(finishPauseDays),
        days_paused_after_finish: normalizeFinishPauseDays(finishPauseDays),
        finish_pause_days: normalizeFinishPauseDays(finishPauseDays),
        response_tone_mode: responseToneMode,
      });
      setBotEnabled(normalizeEnabled(settings.enabled));
      setFinishPauseDays(normalizeFinishPauseDays(settings.manual_finish_pause_days));
      setResponseToneMode(normalizeToneMode(settings.response_tone_mode));
      toast.success(nextEnabled ? 'Bot ligado' : 'Bot desligado por completo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao alterar status do bot.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-600">
            <Bot size={15} />
            Configuracoes do atendimento automatico
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Atendimento automatico</h3>
          <p className="mt-1 text-sm text-slate-500">
            Controle geral do bot novo, tom das respostas e pausa aplicada ao finalizar atendimento.
          </p>
          <p className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            botEnabled
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
          }`}>
            {botEnabled ? 'Bot ligado' : 'Bot desligado'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void toggleBotEnabled();
            }}
            disabled={loading || saving}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
              botEnabled
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <Power size={16} />
            {botEnabled ? 'Desligar bot' : 'Ligar bot'}
          </button>

          <button
            type="button"
            onClick={() => {
              void saveSettings();
            }}
            disabled={loading || saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Salvando...' : 'Salvar configuracoes'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Tom das respostas</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {toneOptions.map((option) => (
              <label
                key={option.value}
                className={`rounded-lg border p-3 text-sm ${
                  responseToneMode === option.value
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="response_tone_mode"
                  value={option.value}
                  checked={responseToneMode === option.value}
                  onChange={() => setResponseToneMode(option.value)}
                  className="sr-only"
                />
                <span className="block font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="text-xs font-semibold uppercase text-slate-500">
          Dias pausado apos finalizar
          <div className="mt-2 grid h-10 grid-cols-[40px_1fr_40px] overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
            <button
              type="button"
              onClick={() => setFinishPauseDays((current) => normalizeFinishPauseDays(current - 1))}
              disabled={loading || finishPauseDays <= 1}
              className="inline-flex items-center justify-center border-r border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Diminuir dias pausado apos finalizar"
            >
              <Minus size={16} />
            </button>
            <input
              type="number"
              min={1}
              max={3650}
              value={finishPauseDays}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.currentTarget.select()}
              onChange={(event) => setFinishPauseDays(normalizeFinishPauseDays(event.target.value))}
              disabled={loading}
              className="h-full w-full border-0 bg-white px-3 text-center text-sm font-semibold normal-case text-slate-700 outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setFinishPauseDays((current) => normalizeFinishPauseDays(current + 1))}
              disabled={loading || finishPauseDays >= 3650}
              className="inline-flex items-center justify-center border-l border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Aumentar dias pausado apos finalizar"
            >
              <Plus size={16} />
            </button>
          </div>
          <span className="mt-2 block text-xs font-medium normal-case leading-5 text-slate-500">
            A conversa fica pausada na VPS por esse periodo ate alguem clicar em Retomar.
          </span>
        </label>
      </div>

      {error && (
        <div className="mx-4 mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}
