import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ListChecks, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BrandMarginEditor } from '../../../components/products/photo-intake/BrandMarginEditor';
import { PhotoCapturePanel } from '../../../components/products/photo-intake/PhotoCapturePanel';
import { PhotoIntakeQueue } from '../../../components/products/photo-intake/PhotoIntakeQueue';
import { PhotoIntakeReviewCard } from '../../../components/products/photo-intake/PhotoIntakeReviewCard';
import { brandService } from '../../../services/brands';
import { colorService } from '../../../services/colors';
import { modelService } from '../../../services/models';
import { smartphonePhotoIntakeService } from '../../../services/smartphonePhotoIntakeService';
import type { Brand } from '../../../types/brand';
import type { Color } from '../../../types/color';
import type { Model } from '../../../types/model';
import type {
  SmartphoneBrandPriceMargin,
  SmartphonePhotoIntake,
  SmartphonePhotoIntakePriceConfirmation,
  SmartphonePhotoIntakeUpdate,
} from '../../../types/smartphone-photo-intake';

type ViewMode = 'queue' | 'margins';
const GROUPABLE_STATUSES = new Set(['waiting_price_confirmation', 'review_required', 'ready_to_finalize']);
const normalizeGroupValue = (value?: string | null) => String(value || '').replace(/\s+/g, '').toUpperCase();

function hasSamePriceGroup(left: SmartphonePhotoIntake, right: SmartphonePhotoIntake): boolean {
  return Boolean(left.matched_model_id && left.matched_color_id)
    && left.matched_model_id === right.matched_model_id
    && left.matched_color_id === right.matched_color_id
    && normalizeGroupValue(left.detected_ram) === normalizeGroupValue(right.detected_ram)
    && normalizeGroupValue(left.detected_storage) === normalizeGroupValue(right.detected_storage)
    && GROUPABLE_STATUSES.has(right.status);
}

export function SmartphonePhotoIntakePage() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>('queue');
  const [items, setItems] = useState<SmartphonePhotoIntake[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [margins, setMargins] = useState<SmartphoneBrandPriceMargin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const upsertItem = useCallback((item: SmartphonePhotoIntake, select = true) => {
    setItems(current => {
      const without = current.filter(candidate => candidate.id !== item.id);
      return [item, ...without].sort((left, right) =>
        new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());
    });
    if (select) setSelectedId(item.id);
  }, []);

  const loadQueue = useCallback(async () => {
    const rows = await smartphonePhotoIntakeService.list();
    setItems(rows.sort((left, right) =>
      new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()));
    setSelectedId(current => current || rows[0]?.id || null);
  }, []);

  const loadReferences = useCallback(async () => {
    const [brandRows, modelRows, colorRows, marginRows] = await Promise.all([
      brandService.listActive(),
      modelService.listActive(),
      colorService.listActive(),
      smartphonePhotoIntakeService.listMargins(),
    ]);
    setBrands(brandRows);
    setModels(modelRows);
    setColors(colorRows);
    setMargins(marginRows);
  }, []);

  const refreshColors = useCallback(async () => {
    const rows = await colorService.refreshActive();
    setColors(rows);
    toast.success('Lista de cores atualizada.');
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadQueue(), loadReferences()]);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível carregar a fila por foto.');
    } finally {
      setLoading(false);
    }
  }, [loadQueue, loadReferences]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const selected = useMemo(
    () => items.find(item => item.id === selectedId) || null,
    [items, selectedId],
  );

  const selectedMargin = useMemo(() => {
    if (!selected) return null;
    let brandId = selected.matched_brand_id || '';
    if (!brandId && selected.matched_model_id) {
      brandId = models.find(model => model.id === selected.matched_model_id)?.brand_id || '';
    }
    return margins.find(margin => margin.brand_id === brandId && Boolean(margin.active)) || null;
  }, [margins, models, selected]);

  const matchingGroupCount = useMemo(
    () => selected ? items.filter(item => hasSamePriceGroup(selected, item)).length : 0,
    [items, selected],
  );

  const runMutation = async (operation: () => Promise<SmartphonePhotoIntake>, successMessage: string) => {
    setBusy(true);
    try {
      const updated = await operation();
      upsertItem(updated);
      toast.success(successMessage);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível concluir a operação.');
    } finally {
      setBusy(false);
    }
  };

  const updateSelected = async (input: SmartphonePhotoIntakeUpdate) => {
    if (!selected) return;
    await runMutation(
      () => smartphonePhotoIntakeService.update(selected.id, input),
      input.prices_confirmed ? 'Preços confirmados.' : 'Conferência salva.',
    );
  };

  const confirmSelectedPrices = async (input: SmartphonePhotoIntakePriceConfirmation, applyToGroup: boolean) => {
    if (!selected) return;
    if (!applyToGroup) {
      await updateSelected({ ...input, prices_confirmed: true });
      return;
    }
    setBusy(true);
    try {
      const result = await smartphonePhotoIntakeService.confirmGroupPrices(selected.id, input);
      await loadQueue();
      setSelectedId(result.intake.id);
      toast.success(`Preços aplicados a ${result.updated_count} aparelhos iguais.`);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível confirmar os preços do grupo.');
    } finally {
      setBusy(false);
    }
  };

  const saveMargin = async (brandId: string, margin: SmartphoneBrandPriceMargin) => {
    try {
      const saved = await smartphonePhotoIntakeService.saveMargin(brandId, {
        retail_margin_cents: margin.retail_margin_cents,
        reseller_margin_cents: margin.reseller_margin_cents,
        wholesale_margin_cents: margin.wholesale_margin_cents,
        active: margin.active,
      });
      setMargins(current => [saved, ...current.filter(item => item.brand_id !== brandId)]);
      toast.success('Margens da marca salvas.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível salvar as margens.');
      throw error;
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/products/bulk')}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Voltar ao cadastro em massa"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Cadastro de smartphones por foto</h1>
            <p className="text-sm text-slate-500">Leia a etiqueta, confira os dados e só então disponibilize o aparelho para venda.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView('queue')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${view === 'queue' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
          >
            <ListChecks size={17} /> Fila
          </button>
          <button
            type="button"
            onClick={() => setView('margins')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${view === 'margins' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
          >
            <Settings2 size={17} /> Margens por marca
          </button>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
            Atualizar
          </button>
        </div>
      </header>

      {view === 'margins' ? (
        <BrandMarginEditor brands={brands} margins={margins} loading={loading} onSave={saveMargin} />
      ) : (
        <div className="space-y-5">
          <PhotoCapturePanel onProcessed={upsertItem} />
          <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="font-bold text-slate-800">Fila de conferência</h2>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{items.length}</span>
              </div>
              <div className="max-h-[70vh] overflow-y-auto pr-1">
                <PhotoIntakeQueue items={items} selectedId={selectedId} loading={loading} onSelect={item => setSelectedId(item.id)} />
              </div>
            </aside>

            <main className="min-w-0">
              {selected ? (
                <PhotoIntakeReviewCard
                  intake={selected}
                  models={models}
                  colors={colors}
                  margin={selectedMargin}
                  busy={busy}
                  matchingGroupCount={matchingGroupCount}
                  onUpdate={updateSelected}
                  onConfirmPrices={confirmSelectedPrices}
                  onAttachModel={modelId => runMutation(
                    () => smartphonePhotoIntakeService.attachModel(selected.id, modelId),
                    'Modelo associado ao aparelho.',
                  )}
                  onRetry={() => runMutation(
                    () => smartphonePhotoIntakeService.retry(selected.id),
                    'Foto analisada novamente.',
                  )}
                  onRefreshColors={refreshColors}
                  onFinalize={sku => runMutation(
                    () => smartphonePhotoIntakeService.finalize(selected.id, { sku }),
                    'Aparelho salvo e disponibilizado para venda.',
                  )}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center text-sm text-slate-500">
                  Selecione um aparelho da fila para conferir.
                </div>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
