import React from 'react';
import { Brain, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../services/autoResponderService';
import { WhatsAppAiTeachingPanel } from './WhatsAppAiTeachingPanel';

const memoryLimitOptions = [
  { value: 10, label: 'Ultimas 10 mensagens' },
  { value: 20, label: 'Ultimas 20 mensagens' },
  { value: 30, label: 'Ultimas 30 mensagens' },
  { value: 50, label: 'Ultimas 50 mensagens' },
];

function normalizeEnabled(value: unknown): boolean {
  return value === true || Number(value) === 1 || String(value) === 'true';
}

function normalizeLimit(value: unknown): number {
  const number = Number(value || 20);
  return [10, 20, 30, 50].includes(number) ? number : 20;
}

function normalizeDays(value: unknown): number {
  const number = Number(value || 7);
  return Number.isFinite(number) ? Math.max(1, Math.min(Math.round(number), 90)) : 7;
}

export function WhatsAppAiMemoryPanel() {
  const [memoryEnabled, setMemoryEnabled] = React.useState(true);
  const [memoryLimit, setMemoryLimit] = React.useState(20);
  const [memoryDays, setMemoryDays] = React.useState(7);
  const [contextMemory, setContextMemory] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    autoResponderService.getSettings()
      .then((settings) => {
        if (!mounted || !settings) return;
        setMemoryEnabled(settings.ai_conversation_memory_enabled == null ? true : normalizeEnabled(settings.ai_conversation_memory_enabled));
        setMemoryLimit(normalizeLimit(settings.ai_conversation_memory_limit));
        setMemoryDays(normalizeDays(settings.ai_conversation_memory_days));
        setContextMemory(String(settings.ai_context_memory || ''));
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar memoria IA.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function saveMemory() {
    setSaving(true);
    setError(null);
    try {
      const settings = await autoResponderService.updateSettings({
        ai_conversation_memory_enabled: memoryEnabled,
        ai_conversation_memory_limit: memoryLimit,
        ai_conversation_memory_days: memoryDays,
        ai_context_memory: contextMemory,
      });
      setMemoryEnabled(settings.ai_conversation_memory_enabled == null ? true : normalizeEnabled(settings.ai_conversation_memory_enabled));
      setMemoryLimit(normalizeLimit(settings.ai_conversation_memory_limit));
      setMemoryDays(normalizeDays(settings.ai_conversation_memory_days));
      setContextMemory(String(settings.ai_context_memory || ''));
      toast.success('Memoria IA salva');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar memoria IA.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-600">
            <Brain size={15} />
            Memoria de conversa
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Memoria IA WhatsApp</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Define quantas mensagens recentes de cada cliente o ChatGPT pode ler antes de responder.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void saveMemory();
          }}
          disabled={loading || saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? 'Salvando...' : 'Salvar memoria IA'}
        </button>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={memoryEnabled}
              onChange={(event) => setMemoryEnabled(event.target.checked)}
              disabled={loading}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-slate-900">Usar memoria personalizada da conversa</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Quando ligado, a IA recebe o historico recente desse cliente antes de responder.
              </span>
            </span>
          </label>

          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Quantidade de contexto</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {memoryLimitOptions.map((option) => (
                <label
                  key={option.value}
                  className={`rounded-lg border p-3 text-sm ${
                    memoryLimit === option.value
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="ai_conversation_memory_limit"
                    value={option.value}
                    checked={memoryLimit === option.value}
                    onChange={() => setMemoryLimit(option.value)}
                    disabled={loading}
                    className="sr-only"
                  />
                  <span className="font-semibold">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="block text-xs font-semibold uppercase text-slate-500">
            Usar mensagens dos ultimos dias
            <input
              type="number"
              min={1}
              max={90}
              value={memoryDays}
              onChange={(event) => setMemoryDays(normalizeDays(event.target.value))}
              disabled={loading}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
            />
          </label>
        </div>

        <label className="block text-xs font-semibold uppercase text-slate-500">
          Instrucoes globais da IA
          <textarea
            value={contextMemory}
            onChange={(event) => setContextMemory(event.target.value.slice(0, 6000))}
            disabled={loading}
            rows={12}
            placeholder="Ex: seja curto, confirme dados sensiveis com a equipe, nunca prometa estoque sem a ferramenta oficial..."
            className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm normal-case leading-6 text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
          />
          <span className="mt-2 block text-xs font-medium normal-case text-slate-500">
            {contextMemory.length}/6000 caracteres. Essas instrucoes entram antes do treinamento, mas nao autorizam inventar preco, estoque ou politica.
          </span>
        </label>
      </div>

      {error && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
      </section>
      <WhatsAppAiTeachingPanel />
    </>
  );
}
