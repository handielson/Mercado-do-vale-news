import React, { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Palette, Search, Trash2 } from 'lucide-react';
import type { Color } from '../../../types/color';
import type { SmartphonePhotoColorMapping } from '../../../types/smartphone-photo-intake';
import { cn } from '../../../utils/cn';

// "Cores mapeadas" do cadastro por foto: cada nome de cor lido na etiqueta e a cor do catálogo ligada a ele.
// Trocar corrige as próximas leituras; apagar faz a próxima leitura voltar a pedir a cor.

interface Props {
  mappings: SmartphonePhotoColorMapping[];
  colors: Color[];
  loading?: boolean;
  onChange: (mapping: SmartphonePhotoColorMapping, colorId: string) => Promise<void>;
  onDelete: (mapping: SmartphonePhotoColorMapping) => Promise<void>;
}

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').trim();

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
};

export function ColorMappingEditor({ mappings, colors, loading, onChange, onDelete }: Props) {
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const sortedColors = useMemo(() => [...colors].filter(color => color.active !== false)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')), [colors]);

  const visible = useMemo(() => {
    const term = normalize(search);
    if (!term) return mappings;
    return mappings.filter(mapping => normalize(`${mapping.source_color} ${mapping.color_name || ''}`).includes(term));
  }, [mappings, search]);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try { await action(); } finally { setBusyId(null); setConfirmId(null); }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5" data-color-mapping-editor>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Palette size={20} className="text-blue-600" /> Cores mapeadas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Quando a cor da etiqueta não existe no catálogo, a cor que você escolhe fica ligada a ela para as próximas leituras.
          Corrija aqui uma ligação errada. Se apagar, a próxima leitura volta a pedir a cor.
        </p>
      </div>

      <label className="relative block">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar cor da etiqueta ou do catálogo"
          aria-label="Buscar cor mapeada"
          className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-base sm:text-sm"
        />
      </label>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
          {mappings.length === 0 ? 'Nenhuma cor mapeada ainda.' : 'Nada encontrado nessa busca.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {visible.map(mapping => {
            const busy = busyId === mapping.id;
            const missing = !mapping.color_name || mapping.color_active === 0 || mapping.color_active === false;
            return (
              <li key={mapping.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3" data-color-mapping={mapping.source_color}>
                <div className="min-w-0 sm:w-1/3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Na etiqueta</p>
                  <p className="truncate text-base font-semibold text-slate-900">{mapping.source_color}</p>
                  {formatDate(mapping.updated_at || mapping.created_at) && (
                    <p className="text-xs text-slate-400">desde {formatDate(mapping.updated_at || mapping.created_at)}</p>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="hidden text-slate-400 sm:inline" aria-hidden="true">→</span>
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Cor do catálogo para {mapping.source_color}</span>
                    <select
                      value={missing ? '' : mapping.color_id}
                      disabled={busy}
                      onChange={event => { const value = event.target.value; if (value) void run(mapping.id, () => onChange(mapping, value)); }}
                      className={cn('h-11 w-full rounded-xl border px-3 text-base sm:text-sm', missing ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white')}
                    >
                      {missing && <option value="">Cor removida do catálogo — escolha outra</option>}
                      {sortedColors.map(color => <option key={color.id} value={color.id}>{color.name}</option>)}
                    </select>
                  </label>
                  {confirmId === mapping.id ? (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" disabled={busy} onClick={() => void run(mapping.id, () => onDelete(mapping))}
                        className="inline-flex h-11 items-center gap-1 rounded-xl bg-red-600 px-3 text-sm font-bold text-white disabled:opacity-60">
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Apagar
                      </button>
                      <button type="button" disabled={busy} onClick={() => setConfirmId(null)}
                        className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">Não</button>
                    </div>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => setConfirmId(mapping.id)}
                      aria-label={`Apagar ligação de ${mapping.source_color}`} title="Apagar ligação"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={18} />}
                    </button>
                  )}
                </div>
                {missing && (
                  <p className="flex items-center gap-1 text-xs text-amber-700 sm:hidden"><AlertTriangle size={14} /> A cor ligada não existe mais no catálogo.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
