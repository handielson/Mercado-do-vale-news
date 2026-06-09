import React from 'react';
import { Plus, RefreshCw, Trash2, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../services/autoResponderService';
import type { AutoResponderAttendant } from '../../types/autoResponder';

function isActive(value: AutoResponderAttendant['active']): boolean {
  return value === true || String(value) === '1';
}

export function WhatsAppAttendantsPanel() {
  const [attendants, setAttendants] = React.useState<AutoResponderAttendant[]>([]);
  const [newAttendantName, setNewAttendantName] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [actionId, setActionId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadAttendants = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await autoResponderService.listAttendants({ active: 1 });
      setAttendants(data.filter((attendant) => isActive(attendant.active)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar atendentes.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadAttendants();
  }, [loadAttendants]);

  async function addAttendant() {
    const name = newAttendantName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await autoResponderService.createAttendant({ name });
      setNewAttendantName('');
      await loadAttendants();
      toast.success('Atendente salvo na VPS');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar atendente.');
    } finally {
      setSaving(false);
    }
  }

  async function removeAttendant(attendant: AutoResponderAttendant) {
    if (!window.confirm(`Remover ${attendant.name} da lista de atendentes?`)) return;
    setActionId(attendant.id);
    setError(null);
    try {
      await autoResponderService.deleteAttendant(attendant.id);
      await loadAttendants();
      toast.success('Atendente removido da lista ativa');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover atendente.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-600">
            <UserRound size={15} />
            Atendentes
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Equipe de atendimento</h3>
          <p className="mt-1 text-sm text-slate-500">
            Lista oficial salva na VPS para mensagens manuais, filtros e auditoria das conversas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadAttendants();
          }}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={loading ? 'animate-spin' : undefined} size={16} />
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="text-xs font-semibold uppercase text-slate-500">
            Novo atendente
            <input
              type="text"
              value={newAttendantName}
              onChange={(event) => setNewAttendantName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void addAttendant();
                }
              }}
              placeholder="Nome do atendente"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              void addAttendant();
            }}
            disabled={saving || !newAttendantName.trim()}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Plus size={16} />
            {saving ? 'Salvando...' : 'Cadastrar atendente'}
          </button>
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <span className="text-xs font-semibold uppercase text-slate-500">Atendentes ativos</span>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              {attendants.length}
            </span>
          </div>

          {loading && attendants.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center gap-2 text-sm font-medium text-slate-500">
              <RefreshCw className="animate-spin" size={16} />
              Carregando atendentes...
            </div>
          ) : attendants.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center p-4 text-center text-sm font-medium text-slate-500">
              Nenhum atendente cadastrado.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {attendants.map((attendant) => (
                <div key={attendant.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{attendant.name}</p>
                    <p className="text-xs text-slate-500">Salvo na VPS</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void removeAttendant(attendant);
                    }}
                    disabled={actionId === attendant.id}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                    aria-label={`Remover ${attendant.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}
