import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, Settings2, X } from 'lucide-react';
import { CurrencyInput } from '../../ui/CurrencyInput';
import type { Brand } from '../../../types/brand';
import type { SmartphoneBrandPriceMargin } from '../../../types/smartphone-photo-intake';

interface BrandMarginEditorProps {
  brands: Brand[];
  margins: SmartphoneBrandPriceMargin[];
  loading?: boolean;
  onSave: (brandId: string, margin: SmartphoneBrandPriceMargin) => Promise<void>;
}
function emptyMargin(brandId: string): SmartphoneBrandPriceMargin {
  return {
    brand_id: brandId,
    retail_margin_cents: 0,
    reseller_margin_cents: 0,
    wholesale_margin_cents: 0,
    active: true,
  };
}

const normalizeSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

const ACTIVE_FILTERS = new Set(['ativa', 'ativas', 'ativo', 'ativos']);
const INACTIVE_FILTERS = new Set(['inativa', 'inativas', 'inativo', 'inativos', 'desativada', 'desativadas']);
const CONFIGURED_FILTERS = new Set(['configurada', 'configuradas', 'configurado', 'configurados', 'preenchida', 'preenchidas']);
const PENDING_FILTERS = new Set(['pendente', 'pendentes', 'zerada', 'zeradas']);

export function BrandMarginEditor({ brands, margins, loading, onSave }: BrandMarginEditorProps) {
  const [drafts, setDrafts] = useState<Record<string, SmartphoneBrandPriceMargin>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const next: Record<string, SmartphoneBrandPriceMargin> = {};
    for (const brand of brands) {
      next[brand.id] = margins.find(margin => margin.brand_id === brand.id) || emptyMargin(brand.id);
    }
    setDrafts(next);
  }, [brands, margins]);

  const sortedBrands = useMemo(
    () => [...brands].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
    [brands],
  );

  const filteredBrands = useMemo(() => {
    const normalized = normalizeSearch(search);
    if (!normalized) return sortedBrands;

    const tokens = normalized.split(/\s+/).filter(Boolean);
    const wantsWithoutMargin = normalized.includes('sem margem');
    const nameTokens = tokens.filter(token => !ACTIVE_FILTERS.has(token)
      && !INACTIVE_FILTERS.has(token)
      && !CONFIGURED_FILTERS.has(token)
      && !PENDING_FILTERS.has(token)
      && token !== 'sem'
      && token !== 'margem');

    return sortedBrands.filter(brand => {
      const draft = drafts[brand.id] || emptyMargin(brand.id);
      const hasMargin = draft.retail_margin_cents > 0
        || draft.reseller_margin_cents > 0
        || draft.wholesale_margin_cents > 0;
      const active = Boolean(draft.active);

      if (tokens.some(token => ACTIVE_FILTERS.has(token)) && !active) return false;
      if (tokens.some(token => INACTIVE_FILTERS.has(token)) && active) return false;
      if (tokens.some(token => CONFIGURED_FILTERS.has(token)) && !hasMargin) return false;
      if ((wantsWithoutMargin || tokens.some(token => PENDING_FILTERS.has(token))) && hasMargin) return false;

      const brandName = normalizeSearch(brand.name);
      return nameTokens.every(token => brandName.includes(token));
    });
  }, [drafts, search, sortedBrands]);

  const updateDraft = (brandId: string, patch: Partial<SmartphoneBrandPriceMargin>) => {
    setDrafts(current => ({
      ...current,
      [brandId]: { ...(current[brandId] || emptyMargin(brandId)), ...patch },
    }));
  };

  const save = async (brandId: string) => {
    const draft = drafts[brandId];
    if (!draft) return;
    setSavingId(brandId);
    try {
      await onSave(brandId, draft);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <Settings2 size={19} className="text-slate-500" />
        <div>
          <h2 className="font-bold text-slate-800">Margens para smartphones por marca</h2>
          <p className="text-xs text-slate-500">Valores fixos somados ao preço de compra.</p>
        </div>
      </div>

      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Pesquisar marca, ativa, inativa, configurada ou sem margem..."
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              aria-label="Pesquisar e filtrar margens por marca"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Limpar pesquisa"
              >
                <X size={16} />
              </button>
            )}
          </label>
          <span className="shrink-0 text-xs font-semibold text-slate-500">
            {filteredBrands.length} de {sortedBrands.length} marcas
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          O filtro acontece automaticamente. Exemplos: “POCO”, “ativas”, “configuradas” ou “sem margem”.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : (
        <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
          {filteredBrands.map(brand => {
            const draft = drafts[brand.id] || emptyMargin(brand.id);
            const saving = savingId === brand.id;
            return (
              <div key={brand.id} className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{brand.name}</p>
                    <label className="mt-1 inline-flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.active)}
                        onChange={event => updateDraft(brand.id, { active: event.target.checked })}
                        className="rounded border-slate-300"
                      />
                      Regra ativa
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => void save(brand.id)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Salvar
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <CurrencyInput
                    label="Margem varejo"
                    value={draft.retail_margin_cents}
                    onChange={value => updateDraft(brand.id, { retail_margin_cents: value })}
                    disabled={!Boolean(draft.active)}
                  />
                  <CurrencyInput
                    label="Margem revenda"
                    value={draft.reseller_margin_cents}
                    onChange={value => updateDraft(brand.id, { reseller_margin_cents: value })}
                    disabled={!Boolean(draft.active)}
                  />
                  <CurrencyInput
                    label="Margem atacado"
                    value={draft.wholesale_margin_cents}
                    onChange={value => updateDraft(brand.id, { wholesale_margin_cents: value })}
                    disabled={!Boolean(draft.active)}
                  />
                </div>
              </div>
            );
          })}
          {sortedBrands.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhuma marca cadastrada.</p>
          )}
          {sortedBrands.length > 0 && filteredBrands.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-600">Nenhuma marca encontrada.</p>
              <button type="button" onClick={() => setSearch('')} className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700">
                Limpar pesquisa
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
