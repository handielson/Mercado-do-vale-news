import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Layers3, ListChecks, Loader2, RefreshCw, Settings2, X } from 'lucide-react';
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

import { photoQueueGroupKey } from '../../../services/modelBlingMapping.mjs';

type ViewMode = 'queue' | 'margins';
const GROUPABLE_STATUSES = new Set(['waiting_price_confirmation', 'review_required', 'ready_to_finalize']);
const normalizeGroupValue = (value?: string | null) => String(value || '').replace(/\s+/g, '').toUpperCase();

function sortPhotoIntakeQueue(items: SmartphonePhotoIntake[]): SmartphonePhotoIntake[] {
  return [...items].sort((left, right) => {
    const completedPriority = Number(left.status === 'completed') - Number(right.status === 'completed');
    if (completedPriority !== 0) return completedPriority;
    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
  });
}

function hasSamePriceGroup(left: SmartphonePhotoIntake, right: SmartphonePhotoIntake): boolean {
  return Boolean(left.matched_model_id && left.matched_color_id)
    && left.matched_model_id === right.matched_model_id
    && left.matched_color_id === right.matched_color_id
    && normalizeGroupValue(left.detected_ram) === normalizeGroupValue(right.detected_ram)
    && normalizeGroupValue(left.detected_storage) === normalizeGroupValue(right.detected_storage)
    && normalizeGroupValue(left.detected_version) === normalizeGroupValue(right.detected_version)
    && GROUPABLE_STATUSES.has(right.status);
}

function getQueueGroupKey(item: SmartphonePhotoIntake): string {
  return photoQueueGroupKey(item);
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
  const [groupQueue, setGroupQueue] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<SmartphonePhotoIntake | null>(null);
  const [finalizedNotice, setFinalizedNotice] = useState<SmartphonePhotoIntake | null>(null);
  const finalizedNoticeRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLElement>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);

  const goToSelectedFields = () => {
    fieldsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    fieldsRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (finalizedNotice) finalizedNoticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [finalizedNotice]);

  const upsertItem = useCallback((item: SmartphonePhotoIntake, select = true) => {
    setItems(current => {
      const without = current.filter(candidate => candidate.id !== item.id);
      return sortPhotoIntakeQueue([item, ...without]);
    });
    if (select) setSelectedId(item.id);
  }, []);

  const loadQueue = useCallback(async () => {
    const rows = await smartphonePhotoIntakeService.list();
    const sortedRows = sortPhotoIntakeQueue(rows).filter(item => item.status !== 'cancelled');
    setItems(sortedRows);
    setSelectedId(current => sortedRows.some(item => item.id === current) ? current : sortedRows[0]?.id || null);
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

  const visibleItems = useMemo(
    () => hideCompleted ? items.filter(item => item.status !== 'completed') : items,
    [hideCompleted, items],
  );

  useEffect(() => {
    if (hideCompleted && selected?.status === 'completed') {
      setSelectedId(visibleItems[0]?.id || null);
    }
  }, [hideCompleted, selected, visibleItems]);

  const groupedQueue = useMemo(() => {
    if (!groupQueue) {
      return {
        items: visibleItems,
        groupSizeById: Object.fromEntries(visibleItems.map(item => [item.id, 1])),
      };
    }

    const representatives: SmartphonePhotoIntake[] = [];
    const representativeByKey = new Map<string, SmartphonePhotoIntake>();
    const groupSizeById: Record<string, number> = {};

    for (const item of visibleItems) {
      const key = getQueueGroupKey(item);
      const representative = representativeByKey.get(key);
      if (representative) {
        groupSizeById[representative.id] = (groupSizeById[representative.id] || 1) + 1;
        if (item.id === selectedId) {
          representatives[representatives.indexOf(representative)] = item;
          representativeByKey.set(key, item);
          groupSizeById[item.id] = groupSizeById[representative.id];
          delete groupSizeById[representative.id];
        }
        continue;
      }
      representativeByKey.set(key, item);
      representatives.push(item);
      groupSizeById[item.id] = 1;
    }

    return { items: representatives, groupSizeById };
  }, [groupQueue, visibleItems, selectedId]);

  const toggleQueueGrouping = () => {
    const next = !groupQueue;
    if (next && selected) {
      const selectedKey = getQueueGroupKey(selected);
      const representative = visibleItems.find(item => getQueueGroupKey(item) === selectedKey);
      if (representative) setSelectedId(representative.id);
    }
    setGroupQueue(next);
  };

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
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível concluir a operação.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const updateSelected = async (input: SmartphonePhotoIntakeUpdate) => {
    if (!selected) return false;
    return runMutation(
      () => smartphonePhotoIntakeService.update(selected.id, input),
      input.prices_confirmed ? 'Preços confirmados.' : 'Conferência salva.',
    );
  };

  const removeFromQueue = async (target: SmartphonePhotoIntake) => {
    if (busy) return;
    setBusy(true);
    try {
      await smartphonePhotoIntakeService.removeFromQueue(target.id);
      setPendingRemoval(null);
      await loadQueue();
      toast.success('Registro excluído da fila. Produto, aparelho e estoque foram preservados.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível excluir o registro da fila.');
    } finally { setBusy(false); }
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

  const finalizeSelected = async (sku?: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await smartphonePhotoIntakeService.finalize(selected.id, { sku });
      const nextItems = sortPhotoIntakeQueue([
        updated,
        ...items.filter(item => item.id !== updated.id),
      ]);
      setItems(nextItems);
      setFinalizedNotice(updated);
      const nextPending = nextItems.find(
        item => item.id !== updated.id && item.status !== 'completed',
      );
      setSelectedId(nextPending?.id || updated.id);
      toast.success('Aparelho salvo e disponibilizado para venda.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível disponibilizar o aparelho para venda.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full min-w-0 p-4 sm:p-6">
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
          {finalizedNotice && (
            <div ref={finalizedNoticeRef} role="status" aria-live="polite" className="scroll-mt-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
              <div className="flex min-w-0 items-start gap-3">
                <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-700" />
                <div>
                  <p className="font-bold">Celular cadastrado com sucesso e disponível para venda.</p>
                  <p className="mt-1 text-sm">
                    {[finalizedNotice.detected_brand, finalizedNotice.detected_model, finalizedNotice.detected_ram && finalizedNotice.detected_storage
                      ? `${finalizedNotice.detected_ram}/${finalizedNotice.detected_storage}` : finalizedNotice.detected_ram || finalizedNotice.detected_storage,
                    finalizedNotice.detected_color].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => {
                  setHideCompleted(false);
                  setSelectedId(finalizedNotice.id);
                  requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                }} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100">
                  Ver aparelho salvo
                </button>
                <button type="button" onClick={() => setFinalizedNotice(null)} aria-label="Fechar confirmação de cadastro" className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-100"><X size={17} /></button>
              </div>
            </div>
          )}
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Fila de conferência">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
                <h2 className="font-bold text-slate-800">Fila de conferência</h2>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                  {groupQueue ? `${groupedQueue.items.length} grupos · ${visibleItems.length} aparelhos` : `${visibleItems.length} aparelhos`}
                </span>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <button type="button" onClick={toggleQueueGrouping} aria-pressed={groupQueue} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${groupQueue ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <Layers3 size={16} /> Agrupar iguais <span className="text-xs">{groupQueue ? 'Ativado' : 'Desativado'}</span>
                </button>
                <button type="button" onClick={() => setHideCompleted(current => !current)} aria-pressed={hideCompleted} className={`rounded-xl border px-3 py-2 text-sm font-bold ${hideCompleted ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Ocultar já disponíveis · {hideCompleted ? 'Ativado' : 'Desativado'}
                </button>
              </div>
              <PhotoIntakeQueue
                items={groupedQueue.items}
                groupSizeById={groupedQueue.groupSizeById}
                selectedId={selectedId}
                loading={loading}
                busy={busy}
                onSelect={item => setSelectedId(item.id)}
                onGoToFields={goToSelectedFields}
                onRequestRemove={setPendingRemoval}
              />
            </section>

            <main ref={reviewRef} className="min-w-0 scroll-mt-5">
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
                  onFinalize={finalizeSelected}
                  onRemoveFromQueue={() => removeFromQueue(selected)}
                  fieldsRef={fieldsRef}
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
      {pendingRemoval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="photo-intake-remove-title" aria-describedby="photo-intake-remove-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="photo-intake-remove-title" className="text-lg font-bold text-slate-900">Excluir aparelho da fila?</h2>
            <p id="photo-intake-remove-description" className="mt-2 text-sm text-slate-600">
              {[pendingRemoval.detected_brand, pendingRemoval.detected_model, pendingRemoval.detected_ram, pendingRemoval.detected_storage, pendingRemoval.detected_color].filter(Boolean).join(' · ') || 'Este aparelho'} sairá da fila. Produto, aparelho já cadastrado e estoque serão preservados. Os demais aparelhos do grupo continuam na fila.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setPendingRemoval(null)} disabled={busy} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={() => void removeFromQueue(pendingRemoval)} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Excluindo...' : 'Excluir da fila'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
