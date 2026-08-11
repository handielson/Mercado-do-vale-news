import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Settings2 } from 'lucide-react';
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

export function BrandMarginEditor({ brands, margins, loading, onSave }: BrandMarginEditorProps) {
  const [drafts, setDrafts] = useState<Record<string, SmartphoneBrandPriceMargin>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

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

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : (
        <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
          {sortedBrands.map(brand => {
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
        </div>
      )}
    </section>
  );
}
