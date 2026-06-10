import React from 'react';
import { BookOpen, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../services/autoResponderService';
import type { AutoResponderAiTraining, AutoResponderAiTrainingType } from '../../types/autoResponder';

const trainingTypes: Array<{ value: AutoResponderAiTrainingType; label: string }> = [
  { value: 'category_guidance', label: 'Produto/modelo' },
  { value: 'store_instruction', label: 'Regra geral' },
  { value: 'faq', label: 'Pergunta frequente' },
  { value: 'policy', label: 'Politica' },
];

const emptyForm = {
  title: '',
  training_type: 'category_guidance' as AutoResponderAiTrainingType,
  keywords: '',
  content: '',
  priority: 0,
  active: true,
};

function isEnabled(value: unknown): boolean {
  return value === true || Number(value) === 1 || String(value) === 'true';
}

export function WhatsAppAiTeachingPanel() {
  const [entries, setEntries] = React.useState<AutoResponderAiTraining[]>([]);
  const [form, setForm] = React.useState(emptyForm);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function loadEntries() {
    setLoading(true);
    setError(null);
    try {
      const rows = await autoResponderService.listAiTraining({});
      setEntries(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar ensino da IA.');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadEntries();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editEntry(entry: AutoResponderAiTraining) {
    setEditingId(entry.id);
    setForm({
      title: entry.title || '',
      training_type: entry.training_type || 'category_guidance',
      keywords: String(entry.keywords || ''),
      content: entry.content || '',
      priority: Number(entry.priority || 0),
      active: isEnabled(entry.active),
    });
  }

  async function saveEntry() {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      setError('Informe o nome e a instrucao para IA.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        training_type: form.training_type,
        keywords: form.keywords.trim(),
        content,
        priority: Number(form.priority || 0),
        active: form.active,
      };
      if (editingId) {
        await autoResponderService.updateAiTraining(editingId, payload);
        toast.success('Ensino da IA atualizado');
      } else {
        await autoResponderService.createAiTraining(payload);
        toast.success('Ensino da IA criado');
      }
      resetForm();
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar ensino da IA.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: number) {
    setSaving(true);
    setError(null);
    try {
      await autoResponderService.deleteAiTraining(id);
      if (editingId === id) resetForm();
      setEntries((current) => current.filter((entry) => entry.id !== id));
      toast.success('Ensino da IA removido');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover ensino da IA.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-600">
            <BookOpen size={15} />
            Ensinar IA
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Contextos por palavra-chave</h3>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Plus size={16} />
          Novo ensino
        </button>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Nome
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value.slice(0, 120) }))}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="block text-xs font-semibold uppercase text-slate-500">
              Tipo
              <select
                value={form.training_type}
                onChange={(event) => setForm((current) => ({ ...current, training_type: event.target.value as AutoResponderAiTrainingType }))}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                {trainingTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs font-semibold uppercase text-slate-500">
            Palavras-chave
            <textarea
              value={form.keywords}
              onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value.slice(0, 1000) }))}
              rows={3}
              placeholder="redmi note 15, note 15, capinha note 15"
              className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm normal-case leading-6 text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="block text-xs font-semibold uppercase text-slate-500">
            Instrucao para IA
            <textarea
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value.slice(0, 8000) }))}
              rows={7}
              placeholder="Quando o cliente falar desse modelo, responder primeiro os aparelhos disponiveis do estoque oficial. Se tambem houver capinhas compativeis, sugerir em outra mensagem."
              className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm normal-case leading-6 text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Prioridade
              <input
                type="number"
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: Number(event.target.value || 0) }))}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="mt-6 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              />
              Ativo
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void saveEntry();
              }}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar ensino'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <X size={16} />
                Cancelar
              </button>
            )}
          </div>
        </div>

        <div className="min-h-[240px] rounded-lg border border-slate-200 bg-slate-50 p-3">
          {loading ? (
            <p className="text-sm font-semibold text-slate-500">Carregando...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500">Nenhum ensino cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {trainingTypes.find((type) => type.value === entry.training_type)?.label || entry.training_type}
                        {isEnabled(entry.active) ? ' ativo' : ' inativo'} · prioridade {Number(entry.priority || 0)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => editEntry(entry)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        aria-label="Editar ensino"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void deleteEntry(entry.id);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                        aria-label="Remover ensino"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {entry.keywords && (
                    <p className="mt-2 text-xs font-semibold text-emerald-700">{entry.keywords}</p>
                  )}
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-slate-600">{entry.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}
