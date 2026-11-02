import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { SearchableSelect } from '../../ui/SearchableSelect';
import { VersionSelect } from '../selectors/VersionSelect';
import { ProtectedIntakePhoto } from './ProtectedIntakePhoto';
import { BarcodeScanButton } from '../../ui/BarcodeScanButton';
import { PhotoIntakeBlingMapping } from './PhotoIntakeBlingMapping';
import type { Color } from '../../../types/color';
import type { Model, ModelInput } from '../../../types/model';
import type {
  SmartphoneBrandPriceMargin,
  SmartphonePhotoIntake,
  SmartphonePhotoIntakePriceConfirmation,
  SmartphonePhotoIntakeUpdate,
} from '../../../types/smartphone-photo-intake';
import { SMARTPHONE_PHOTO_INTAKE_STATUS_LABELS } from '../../../types/smartphone-photo-intake';
import { smartphonePriceGroups, SmartphonePriceReference } from '../../../services/smartphonePriceGroups';
import { DEFAULT_PRODUCT_VERSION } from '../../../services/smartphoneModelSpecs.mjs';
import { ModelPricesPanel } from '../../settings/ModelPricesPanel';
import { isScannerValueComplete, nextScannerBurst, SCANNER_IDLE_MS, SCANNER_MIN_FAST_KEYS } from '../../../services/scannerFieldAdvance.mjs';
import { barcodeHint, describeIdentifier, identifierInputProps, isValidGtin, registeredUnitLink } from '../../../services/deviceIdentifiers.mjs';
import { findCatalogOption, guessCatalogBrand, guessCatalogModel, siblingModelCategory, suggestModelName } from '../../../services/photoIntakeCatalogFields.mjs';
import { loadPhotoIntakeCatalogLists, type PhotoIntakeCatalogLists } from '../../../services/photoIntakeCatalogLists';

interface PhotoIntakeReviewCardProps {
  intake: SmartphonePhotoIntake;
  models: Model[];
  colors: Color[];
  margin?: SmartphoneBrandPriceMargin | null;
  busy?: boolean;
  matchingGroupCount?: number;
  onUpdate: (input: SmartphonePhotoIntakeUpdate) => Promise<boolean>;
  onConfirmPrices: (input: SmartphonePhotoIntakePriceConfirmation, applyToGroup: boolean) => Promise<void>;
  onAttachModel: (modelId: string) => Promise<boolean>;
  onRetry: () => Promise<boolean>;
  onRefreshColors: () => Promise<void>;
  /** Cadastra um modelo novo direto da conferência; devolve o modelo criado. */
  onCreateModel?: (input: ModelInput) => Promise<Model | null>;
  onFinalize: (sku?: string) => Promise<void>;
  onRemoveFromQueue: () => Promise<void>;
  fieldsRef: React.Ref<HTMLDivElement>;
}

type BarcodeFieldKey = 'imei1' | 'imei2' | 'ean' | 'serial';
type BarcodeFieldResult = { status?: string; barcode?: string | null };

type CatalogFieldKind = 'brand' | 'model' | 'ram' | 'storage';

// Campos que já existem no cadastro são escolhidos de lista (evita erro de digitação/leitura).
const TEXT_FIELDS: Array<{ key: keyof SmartphonePhotoIntakeUpdate; label: string; mono?: boolean; kind?: 'imei' | 'ean' | 'serial'; barcodeKey?: BarcodeFieldKey; catalog?: CatalogFieldKind }> = [
  { key: 'detected_brand', label: 'Marca', catalog: 'brand' },
  { key: 'detected_model', label: 'Modelo', catalog: 'model' },
  { key: 'detected_ram', label: 'RAM', catalog: 'ram' },
  { key: 'detected_storage', label: 'Armazenamento', catalog: 'storage' },
  { key: 'detected_serial', label: 'Número de série', mono: true, kind: 'serial', barcodeKey: 'serial' },
  { key: 'detected_imei_1', label: 'IMEI 1', mono: true, kind: 'imei', barcodeKey: 'imei1' },
  { key: 'detected_imei_2', label: 'IMEI 2', mono: true, kind: 'imei', barcodeKey: 'imei2' },
  { key: 'detected_ean', label: 'EAN/GTIN', mono: true, kind: 'ean', barcodeKey: 'ean' },
];

const NEXT_SCAN_FIELD: Partial<Record<keyof SmartphonePhotoIntakeUpdate, keyof SmartphonePhotoIntakeUpdate>> = {
  detected_serial: 'detected_imei_1',
  detected_imei_1: 'detected_imei_2',
  detected_imei_2: 'detected_ean',
};

function buildDraft(intake: SmartphonePhotoIntake): SmartphonePhotoIntakeUpdate {
  return {
    detected_brand: intake.detected_brand || '',
    detected_model: intake.detected_model || '',
    detected_color: intake.detected_color || '',
    detected_ram: intake.detected_ram || '',
    detected_storage: intake.detected_storage || '',
    detected_version: intake.detected_version || DEFAULT_PRODUCT_VERSION,
    detected_serial: intake.detected_serial || '',
    detected_imei_1: intake.detected_imei_1 || '',
    detected_imei_2: intake.detected_imei_2 || '',
    detected_ean: intake.detected_ean || '',
    detected_product_code: intake.detected_product_code || '',
    matched_brand_id: intake.matched_brand_id || null,
    matched_model_id: intake.matched_model_id || null,
    matched_color_id: intake.matched_color_id || null,
    price_cost: intake.price_cost || 0,
    price_retail: intake.price_retail || 0,
    price_reseller: intake.price_reseller || 0,
    price_wholesale: intake.price_wholesale || 0,
    prices_confirmed: Boolean(intake.prices_confirmed),
    review_confirmed: Boolean(intake.review_confirmed),
  };
}

export function PhotoIntakeReviewCard({
  intake,
  models,
  colors,
  margin,
  busy,
  matchingGroupCount = 1,
  onUpdate,
  onConfirmPrices,
  onAttachModel,
  onRetry,
  onRefreshColors,
  onCreateModel,
  onFinalize,
  onRemoveFromQueue,
  fieldsRef,
}: PhotoIntakeReviewCardProps) {
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  useEffect(() => { setConfirmRemoval(false); }, [intake.id]);
  const [draft, setDraft] = useState<SmartphonePhotoIntakeUpdate>(() => buildDraft(intake));
  const [selectedModelId, setSelectedModelId] = useState(intake.matched_model_id || '');
  const [sku, setSku] = useState('');
  const [applyPricesToGroup, setApplyPricesToGroup] = useState(true);
  const [priceReference, setPriceReference] = useState<SmartphonePriceReference | null>(null);
  const [priceReferenceError, setPriceReferenceError] = useState('');
  const [loadingPriceReference, setLoadingPriceReference] = useState(false);
  const [priceEditorOpen, setPriceEditorOpen] = useState(false);
  const [priceRefresh, setPriceRefresh] = useState(0);
  const [stockAverage, setStockAverage] = useState<number | null>(null);
  const [loadingStockAverage, setLoadingStockAverage] = useState(false);
  const [stockAverageError, setStockAverageError] = useState('');
  const [lastPurchaseCost, setLastPurchaseCost] = useState<number | null>(null);
  const costEdited = useRef(false);
  const scanInputs = useRef<Partial<Record<keyof SmartphonePhotoIntakeUpdate, HTMLInputElement | null>>>({});
  const scanBurst = useRef<{ field: keyof SmartphonePhotoIntakeUpdate; lastAt: number; count: number } | null>(null);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetScanBurst = () => {
    if (scanTimer.current) clearTimeout(scanTimer.current);
    scanTimer.current = null;
    scanBurst.current = null;
  };
  useEffect(() => () => {
    if (scanTimer.current) clearTimeout(scanTimer.current);
  }, []);
  const advanceScan = (field: keyof SmartphonePhotoIntakeUpdate) => {
    const nextField = NEXT_SCAN_FIELD[field];
    if (nextField) scanInputs.current[nextField]?.focus();
  };
  const handleScanKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, field: keyof SmartphonePhotoIntakeUpdate) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) {
      event.preventDefault();
      resetScanBurst();
      advanceScan(field);
      return;
    }
    if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
    scanBurst.current = nextScannerBurst(scanBurst.current, field, event.timeStamp);
    if (scanBurst.current.count < SCANNER_MIN_FAST_KEYS) return;
    if (scanTimer.current) clearTimeout(scanTimer.current);
    const input = event.currentTarget;
    scanTimer.current = setTimeout(() => {
      scanTimer.current = null;
      if (document.activeElement === input && isScannerValueComplete(field, input.value)) {
        scanBurst.current = null;
        advanceScan(field);
      }
    }, SCANNER_IDLE_MS);
  };
  useEffect(() => { costEdited.current = false; }, [intake.id]);
  const refreshSalePrices = () => {
    setLoadingPriceReference(true);
    setPriceRefresh(current => current + 1);
  };
  useEffect(() => {
    if (!intake.matched_model_id) { setPriceReference(null); setPriceReferenceError(''); setLoadingPriceReference(false); return; }
    let cancelled = false;
    setLoadingPriceReference(true); setPriceReferenceError('');
    smartphonePriceGroups.reference(intake.matched_model_id, { company_id: intake.company_id,
      specs: { ram: draft.detected_ram, storage: draft.detected_storage, version: draft.detected_version || '' } }).then(result => {
      if (!cancelled) setPriceReference(result);
    }).catch(error => { if (!cancelled) { setPriceReference(null); setPriceReferenceError(error.message); } })
      .finally(() => { if (!cancelled) setLoadingPriceReference(false); });
    return () => { cancelled = true; };
  }, [intake.id, intake.matched_model_id, intake.company_id, draft.detected_ram, draft.detected_storage, draft.detected_version, priceRefresh]);
  useEffect(() => {
    setStockAverage(null); setLastPurchaseCost(null); setStockAverageError('');
    if (!intake.matched_model_id || !priceReference?.group_id || loadingPriceReference) { setLoadingStockAverage(false); return; }
    let cancelled = false;
    setLoadingStockAverage(true);
    smartphonePriceGroups.list(intake.matched_model_id).then(result => {
      const group = result.groups.find(group => group.id === priceReference.group_id);
      const average = group?.cost_average_in_stock;
      const lastCost = group?.last_purchase_cost;
      if (!cancelled) {
        setStockAverage(average != null && Number.isFinite(Number(average)) ? Number(average) : null);
        const last = lastCost != null && Number.isSafeInteger(Number(lastCost)) && Number(lastCost) >= 0 ? Number(lastCost) : null;
        setLastPurchaseCost(last);
        if (last != null && !costEdited.current && !intake.prices_confirmed) {
          setDraft(current => ({ ...current, price_cost: last, prices_confirmed: false }));
        }
      }
    }).catch(() => { if (!cancelled) setStockAverageError('Não foi possível consultar a média em estoque. Use Atualizar valores para tentar novamente.'); })
      .finally(() => { if (!cancelled) setLoadingStockAverage(false); });
    return () => { cancelled = true; };
  }, [intake.id, intake.matched_model_id, intake.prices_confirmed, priceReference?.group_id, loadingPriceReference, priceRefresh]);
  useEffect(() => {
    const prices = priceReference?.prices;
    if (!prices || loadingPriceReference) return;
    if (draft.price_retail !== prices.price_retail || draft.price_reseller !== prices.price_reseller || draft.price_wholesale !== prices.price_wholesale) {
      setDraft(current => ({ ...current, ...prices, prices_confirmed: false }));
    }
  }, [priceReference, loadingPriceReference, draft.price_retail, draft.price_reseller, draft.price_wholesale]);
  const groupPriceLocked = loadingPriceReference || !!priceReferenceError || Boolean(priceReference?.established || priceReference?.incomplete);

  useEffect(() => {
    resetScanBurst();
    setDraft(buildDraft(intake));
    setSelectedModelId(intake.matched_model_id || '');
    setSku('');
    setPriceEditorOpen(false);
  }, [intake]);

  const sortedModels = useMemo(
    () => [...models].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
    [models],
  );
  const modelNames = useMemo(() => new Map(models.map(model => [model.id, model.name])), [models]);

  const [catalogLists, setCatalogLists] = useState<PhotoIntakeCatalogLists | null>(null);
  const [catalogListsError, setCatalogListsError] = useState('');
  const refreshCatalogLists = (force = false) => {
    setCatalogListsError('');
    loadPhotoIntakeCatalogLists(force)
      .then(setCatalogLists)
      .catch(() => setCatalogListsError('Não foi possível carregar marcas, RAM e armazenamento. Toque em Atualizar listas.'));
  };
  useEffect(() => { refreshCatalogLists(); }, []);
  const brandNames = useMemo(() => (catalogLists?.brands || []).map(brand => brand.name), [catalogLists]);
  // Marca/modelo já vêm preenchidos com o melhor palpite do que a foto leu; o usuário só troca se errado.
  const [suggestedFrom, setSuggestedFrom] = useState<{ brand?: { from: string; value: string }; model?: { from: string; id: string } }>({});
  useEffect(() => {
    if (!catalogLists) return;
    const readBrand = intake.detected_brand || '';
    const readModel = intake.detected_model || '';
    const brandGuess = guessCatalogBrand(brandNames, readBrand);
    const brandId = catalogLists.brands.find(brand => brand.name === brandGuess?.value)?.id || intake.matched_brand_id || null;
    const modelLinked = Boolean(intake.matched_model_id && models.some(model => model.id === intake.matched_model_id));
    const modelGuess = modelLinked ? null : guessCatalogModel(models, readModel, { brandId, brandName: brandGuess?.value || readBrand });
    const guessedModel = modelGuess ? models.find(model => model.id === modelGuess.id) : null;
    setSuggestedFrom({
      brand: brandGuess && !brandGuess.exact ? { from: readBrand, value: brandGuess.value } : undefined,
      model: guessedModel && !modelGuess?.exact ? { from: readModel, id: guessedModel.id } : undefined,
    });
    if (!brandGuess && !guessedModel) return;
    setDraft(current => ({
      ...current,
      ...(brandGuess && !brandGuess.exact ? { detected_brand: brandGuess.value, matched_brand_id: brandId } : {}),
      ...(guessedModel ? {
        matched_model_id: guessedModel.id,
        matched_brand_id: guessedModel.brand_id || brandId || current.matched_brand_id || null,
        detected_model: guessedModel.name,
      } : {}),
    }));
    if (guessedModel) setSelectedModelId(guessedModel.id);
  }, [intake, catalogLists, models, brandNames]);

  // Cadastro rápido do modelo quando ele ainda não existe no catálogo.
  const [newModelName, setNewModelName] = useState<string | null>(null);
  const [creatingModel, setCreatingModel] = useState(false);
  const [createModelError, setCreateModelError] = useState('');
  useEffect(() => { setNewModelName(null); setCreateModelError(''); }, [intake.id]);
  const createModelFromLabel = async () => {
    const name = String(newModelName ?? '').trim();
    const brandId = catalogLists?.brands.find(brand => brand.name === selectedBrandName)?.id || null;
    if (!onCreateModel || !name || !brandId) return;
    setCreatingModel(true); setCreateModelError('');
    try {
      const ean = String(draft.detected_ean ?? '').replace(/\D/g, '');
      const model = await onCreateModel({
        name,
        brand_id: brandId,
        active: true,
        category_id: siblingModelCategory(models, name, brandId) || undefined,
        eans: ean && isValidGtin(ean) ? [ean] : undefined,
      });
      if (!model) throw new Error('O modelo foi criado, mas não apareceu na lista. Toque em Atualizar.');
      setSelectedModelId(model.id);
      setDraft(current => ({ ...current, matched_model_id: model.id, matched_brand_id: brandId, detected_model: model.name, review_confirmed: false }));
      setNewModelName(null);
    } catch (error) {
      setCreateModelError(error instanceof Error ? error.message : 'Não foi possível cadastrar o modelo.');
    } finally {
      setCreatingModel(false);
    }
  };
  // Etiqueta pode trazer submarca (ex.: "Redmi"); com o modelo vinculado, a marca vem do modelo.
  const linkedModelBrandName = catalogLists?.brands.find(brand => brand.id === models.find(model => model.id === draft.matched_model_id)?.brand_id)?.name || null;
  const selectedBrandName = findCatalogOption(brandNames, String(draft.detected_brand ?? '')) || linkedModelBrandName;
  const selectedBrandId = catalogLists?.brands.find(brand => brand.name === selectedBrandName)?.id || draft.matched_brand_id || null;
  // Com a marca escolhida, a lista de modelos mostra só os dela.
  const brandModels = useMemo(
    () => (selectedBrandId ? sortedModels.filter(model => model.brand_id === selectedBrandId) : sortedModels),
    [sortedModels, selectedBrandId],
  );
  const renderCatalogField = (field: (typeof TEXT_FIELDS)[number]) => {
    const raw = String(draft[field.key] ?? '');
    const inputClass = 'h-12 md:h-10 min-w-0 w-full rounded-lg border bg-white px-3 text-base md:text-sm focus:outline-none focus:ring-2';
    const readHint = (matched: string | null) => (!matched && raw
      ? <span data-catalog-state="unmatched" className="mt-1 block text-xs font-semibold text-amber-700">Lido na foto: “{raw}” — escolha da lista</span>
      : null);
    const suggestedHint = (from?: string) => (from
      ? <span data-catalog-state="suggested" className="mt-1 block text-xs text-blue-700">Sugerido pelo que a foto leu: “{from}” — troque se não for</span>
      : null);
    if (field.catalog === 'brand') {
      return (
        <div key={field.key} className="block min-w-0" data-catalog-field="brand">
          <label htmlFor={`intake-brand-${intake.id}`} className="mb-1 block text-xs font-medium text-slate-500">{field.label}</label>
          <SearchableSelect
            key={`${intake.id}-brand`}
            id={`intake-brand-${intake.id}`}
            value={selectedBrandName || ''}
            options={brandNames}
            onChange={name => {
              const brand = catalogLists?.brands.find(item => item.name === name);
              setDraft(current => ({ ...current, detected_brand: name, matched_brand_id: brand?.id || null, review_confirmed: false }));
            }}
            disabled={busy || !catalogLists}
            placeholder={raw ? `Lido: ${raw} — pesquisar marca` : 'Pesquisar marca...'}
            className={`${inputClass} ${selectedBrandName ? 'border-slate-200' : 'border-amber-300'}`}
          />
          {selectedBrandName && selectedBrandName === suggestedFrom.brand?.value ? suggestedHint(suggestedFrom.brand.from) : readHint(selectedBrandName)}
        </div>
      );
    }
    if (field.catalog === 'model') {
      const modelId = draft.matched_model_id && modelNames.has(draft.matched_model_id) ? draft.matched_model_id : '';
      return (
        <div key={field.key} className="block min-w-0" data-catalog-field="model">
          <label htmlFor={`intake-model-field-${intake.id}`} className="mb-1 block text-xs font-medium text-slate-500">{field.label}</label>
          <SearchableSelect
            key={`${intake.id}-model`}
            id={`intake-model-field-${intake.id}`}
            value={modelId}
            options={brandModels.map(model => model.id)}
            getOptionLabel={id => modelNames.get(id) || ''}
            onChange={id => {
              const model = models.find(item => item.id === id);
              setSelectedModelId(id);
              setDraft(current => ({
                ...current,
                matched_model_id: id || null,
                matched_brand_id: model?.brand_id || current.matched_brand_id || null,
                detected_brand: catalogLists?.brands.find(brand => brand.id === model?.brand_id)?.name || current.detected_brand || '',
                detected_model: model?.name || current.detected_model || '',
                review_confirmed: false,
              }));
            }}
            disabled={busy}
            placeholder={raw ? `Lido: ${raw} — pesquisar modelo` : 'Pesquisar modelo...'}
            className={`${inputClass} ${modelId ? 'border-slate-200' : 'border-amber-300'}`}
          />
          {!modelId && raw && <span data-catalog-state="unmatched" className="mt-1 block text-xs font-semibold text-amber-700">Lido na foto: “{raw}” — escolha da lista ou cadastre o modelo</span>}
          {!modelId && onCreateModel && newModelName === null && (
            <button
              type="button"
              data-create-model
              disabled={busy || !selectedBrandName}
              onClick={() => setNewModelName(suggestModelName(raw, { brandName: selectedBrandName || '', colorNames: colors.map(color => color.name) }))}
              className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 text-sm font-bold text-violet-800 disabled:opacity-50"
            >
              <Sparkles size={16} />
              {selectedBrandName ? `Cadastrar “${suggestModelName(raw, { brandName: selectedBrandName, colorNames: colors.map(color => color.name) }) || 'novo modelo'}” na ${selectedBrandName}` : 'Escolha a marca para cadastrar o modelo'}
            </button>
          )}
          {!modelId && newModelName !== null && (
            <div data-create-model-form className="mt-2 space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3">
              <label className="block text-xs font-medium text-violet-900">
                Nome do modelo ({selectedBrandName})
                <input
                  value={newModelName}
                  onChange={event => setNewModelName(event.target.value)}
                  onFocus={event => event.currentTarget.select()}
                  onClick={event => event.currentTarget.select()}
                  autoCapitalize="words"
                  enterKeyHint="done"
                  className="mt-1 h-12 w-full rounded-lg border border-violet-200 bg-white px-3 text-base"
                />
              </label>
              <p className="text-xs text-violet-700">Confira o nome sem a cor. Depois dá para completar fotos e especificações em Modelos.</p>
              {createModelError && <p className="text-xs font-semibold text-red-600">{createModelError}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={creatingModel || !newModelName.trim()} onClick={() => void createModelFromLabel()} className="min-h-[44px] flex-1 rounded-lg bg-violet-700 px-3 text-sm font-bold text-white disabled:opacity-50">
                  {creatingModel ? 'Cadastrando…' : 'Cadastrar e usar'}
                </button>
                <button type="button" disabled={creatingModel} onClick={() => { setNewModelName(null); setCreateModelError(''); }} className="min-h-[44px] rounded-lg border border-violet-200 bg-white px-3 text-sm">Cancelar</button>
              </div>
            </div>
          )}
          {modelId && modelId === suggestedFrom.model?.id && suggestedHint(suggestedFrom.model.from)}
        </div>
      );
    }
    const options = field.catalog === 'ram' ? catalogLists?.rams || [] : catalogLists?.storages || [];
    const matched = findCatalogOption(options, raw, 'memory');
    return (
      <label key={field.key} className="block min-w-0" data-catalog-field={field.catalog}>
        <span className="mb-1 block text-xs font-medium text-slate-500">{field.label}</span>
        <select
          value={matched || (raw ? `__lido__${raw}` : '')}
          disabled={busy || !catalogLists}
          onChange={event => {
            const value = event.target.value;
            if (value.startsWith('__lido__')) return;
            setDraft(current => ({ ...current, [field.key]: value, review_confirmed: false }));
          }}
          className={`${inputClass} ${matched ? 'border-slate-200 focus:border-blue-400 focus:ring-blue-100' : 'border-amber-300 focus:ring-amber-100'}`}
        >
          {!matched && <option value={raw ? `__lido__${raw}` : ''} disabled>{raw ? `Lido: ${raw} — escolha` : 'Selecione'}</option>}
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        {readHint(matched)}
      </label>
    );
  };

  const updateCost = (cost: number) => {
    costEdited.current = true;
    const activeMargin = !groupPriceLocked && margin && Boolean(margin.active) ? margin : null;
    setDraft(current => ({
      ...current,
      price_cost: cost,
      ...(activeMargin ? {
        price_retail: cost + activeMargin.retail_margin_cents,
        price_reseller: cost + activeMargin.reseller_margin_cents,
        price_wholesale: cost + activeMargin.wholesale_margin_cents,
      } : {}),
    }));
  };

  const confirmPrices = async () => {
    // Persistir as correções feitas no formulário antes de confirmar preços.
    // Sem isso, uma cor/modelo recém-mapeado permanecia apenas no estado local
    // e o endpoint de confirmação do grupo não conseguia localizar o aparelho.
    const saved = await onUpdate({ ...draft, prices_confirmed: false });
    if (!saved) return;
    await onConfirmPrices({
      price_cost: Number(draft.price_cost || 0),
      price_retail: Number(draft.price_retail || 0),
      price_reseller: Number(draft.price_reseller || 0),
      price_wholesale: Number(draft.price_wholesale || 0),
    }, matchingGroupCount > 1 && applyPricesToGroup);
  };

  const issues = [
    ...(intake.validation_errors || []),
    ...(intake.validation_warnings || []),
  ];
  // Resultado da leitura das barras salvo pela API (confere, não sobrescreve).
  const barcodeData = (intake.extracted_data as { barcode?: { fields?: Partial<Record<BarcodeFieldKey, BarcodeFieldResult>> | null } } | null | undefined)?.barcode;
  const barcodeFields = barcodeData?.fields || null;
  const hasNonConfirmableIssues = (intake.validation_errors || [])
    .some(issue => ['required', 'duplicate', 'already_registered'].includes(String(issue.code || '')));
  const confirmReview = async () => {
    await onUpdate({ ...draft, review_confirmed: true });
  };
  const canFinalize = !priceEditorOpen && !loadingPriceReference && !priceReferenceError && !priceReference?.divergent
    && intake.status === 'ready_to_finalize' && Boolean(intake.matched_color_id)
    && Boolean(draft.prices_confirmed) && (draft.detected_version || '') === (intake.detected_version || '')
    && !loadingPriceReference && !priceReferenceError && !priceReference?.divergent;

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Conferência do aparelho</p>
          <h2 className="mt-0.5 font-bold text-slate-800">
            {[intake.detected_brand, intake.detected_model, intake.detected_color].filter(Boolean).join(' · ') || 'Aguardando leitura'}
          </h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
          {SMARTPHONE_PHOTO_INTAKE_STATUS_LABELS[intake.status] || intake.status}
        </span>
      </div>

      <div className="space-y-6 p-5">
        <div className="min-w-0 max-w-xl space-y-4">
          <ProtectedIntakePhoto intakeId={intake.id} />
          <div className="rounded-xl border border-slate-200 p-3">
            {confirmRemoval ? (
              <>
                <p className="text-xs text-slate-600">Excluir somente este registro da fila? O produto, o aparelho, as vendas e o estoque continuam cadastrados. Os demais aparelhos do grupo serão mantidos.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void onRemoveFromQueue()} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Confirmar exclusão da fila</button>
                  <button type="button" disabled={busy} onClick={() => setConfirmRemoval(false)} className="rounded-lg border px-3 py-2 text-xs">Cancelar</button>
                </div>
              </>
            ) : (
              <button type="button" disabled={busy || intake.status === 'analyzing'} onClick={() => setConfirmRemoval(true)} className="inline-flex items-center gap-2 text-xs font-semibold text-red-700 disabled:opacity-50"><Trash2 size={14} />Excluir registro da fila</button>
            )}
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
            Esta etiqueta é carregada por uma rota autenticada e não fica exposta como imagem pública.
          </div>
          {issues.length > 0 && (
            <div className={`rounded-xl border p-3 ${intake.review_confirmed ? 'border-emerald-200 bg-emerald-50' : 'border-orange-200 bg-orange-50'}`}>
              <p className={`text-xs font-bold ${intake.review_confirmed ? 'text-emerald-800' : 'text-orange-800'}`}>
                {intake.review_confirmed ? 'Conferência confirmada' : 'Pontos para conferir'}
              </p>
              <ul className={`mt-2 space-y-1 text-xs ${intake.review_confirmed ? 'text-emerald-700' : 'text-orange-700'}`}>
                {issues.map((issue, index) => {
                  const unitLink = registeredUnitLink(issue);
                  return (
                    <li key={`${issue.field || 'issue'}-${index}`} data-photo-intake-issue={issue.code || undefined}>
                      • {issue.message}
                      {unitLink && <Link to={unitLink} className="ml-1 inline-flex items-center gap-1 font-bold underline">Ver aparelho <ExternalLink size={12} /></Link>}
                    </li>
                  );
                })}
              </ul>
              {!intake.review_confirmed && !hasNonConfirmableIssues && (
                <button
                  type="button"
                  onClick={() => void confirmReview()}
                  disabled={busy}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Conferi os dados, estão corretos
                </button>
              )}
              {!intake.review_confirmed && hasNonConfirmableIssues && (
                <p className="mt-3 text-xs font-semibold text-red-700">
                  Corrija os campos obrigatórios ou identificadores duplicados antes de continuar.
                </p>
              )}
            </div>
          )}
          {intake.error_message && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{intake.error_message}</p>
          )}
          <button
            type="button"
            onClick={() => void onRetry()}
            disabled={busy || intake.status === 'analyzing'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Ler a foto novamente
          </button>
        </div>

        <div className="min-w-0 space-y-6">
          <div ref={fieldsRef} tabIndex={-1} className="scroll-mt-24 focus:outline-none">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-slate-800">Dados identificados</h3>
              <button
                type="button"
                onClick={() => void onUpdate(draft)}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Save size={14} /> Salvar conferência
              </button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
              {catalogListsError && (
                <p className="col-span-full text-xs font-semibold text-red-600">
                  {catalogListsError}{' '}
                  <button type="button" onClick={() => refreshCatalogLists(true)} className="underline">Atualizar listas</button>
                </p>
              )}
              {TEXT_FIELDS.map(field => {
                if (field.catalog) return renderCatalogField(field);
                const identifierState = field.kind ? describeIdentifier(field.kind, draft[field.key]) : null;
                const barcode = field.barcodeKey ? barcodeHint(barcodeFields?.[field.barcodeKey], String(draft[field.key] ?? '')) : null;
                return (
                <label key={field.key} className="block min-w-0">
                  <span className="mb-1 block text-xs font-medium text-slate-500">{field.label}</span>
                  <span className="flex min-w-0 items-center gap-2">
                  <input
                    {...(identifierInputProps(field.kind) as React.InputHTMLAttributes<HTMLInputElement>)}
                    enterKeyHint={NEXT_SCAN_FIELD[field.key] ? 'next' : 'done'}
                    maxLength={field.kind === 'imei' ? 15 : field.kind === 'ean' ? 14 : undefined}
                    aria-invalid={identifierState?.state === 'invalid' || undefined}
                    ref={element => { if (field.mono) scanInputs.current[field.key] = element; }}
                    value={String(draft[field.key] ?? '')}
                    onFocus={event => { resetScanBurst(); event.currentTarget.select(); }}
                    onClick={event => event.currentTarget.select()}
                    onKeyDown={NEXT_SCAN_FIELD[field.key] ? event => handleScanKeyDown(event, field.key) : undefined}
                    onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value, review_confirmed: false }))}
                    className={`h-12 md:h-10 min-w-0 w-full rounded-lg border px-3 text-base md:text-sm focus:outline-none focus:ring-2 ${identifierState?.state === 'invalid' ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : identifierState?.state === 'ok' && field.kind !== 'serial' ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100' : 'border-slate-200 focus:border-blue-400 focus:ring-blue-100'} ${field.mono ? 'font-mono' : ''}`}
                  />
                  {field.kind && (
                    <BarcodeScanButton
                      kind={field.kind}
                      disabled={busy}
                      allowPair={field.key === 'detected_imei_1'}
                      onScan={values => setDraft(current => ({
                        ...current,
                        [field.key]: values[0] || '',
                        ...(field.key === 'detected_imei_1' && values[1] ? { detected_imei_2: values[1] } : {}),
                        review_confirmed: false,
                      }))}
                    />
                  )}
                  </span>
                  {identifierState?.message && <span data-identifier-state={identifierState.state} className={`mt-1 block text-xs ${identifierState.state === 'invalid' ? 'text-red-600' : identifierState.state === 'ok' ? 'text-emerald-700' : 'text-amber-700'}`}>{identifierState.message}</span>}
                  {barcode?.state === 'match' && <span data-barcode-state="match" className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={12} />Confere com o código de barras</span>}
                  {barcode?.state === 'differs' && (
                    <span data-barcode-state="differs" className="mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                      <span>Código de barras: <span className="font-mono font-bold">{barcode.value}</span></span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={event => { event.preventDefault(); setDraft(current => ({ ...current, [field.key]: barcode.value, review_confirmed: false })); }}
                        className="min-h-[36px] rounded-md bg-amber-600 px-3 font-bold text-white disabled:opacity-50"
                      >
                        Usar este
                      </button>
                    </span>
                  )}
                </label>
                );
              })}
              <fieldset disabled={busy} className="min-w-0">
                <legend className="mb-1 text-xs font-medium text-slate-500">Versão comercial</legend>
                <VersionSelect value={draft.detected_version || ''} onChange={version => {
                  setPriceReference(null);
                  setLoadingPriceReference(Boolean(intake.matched_model_id));
                  setDraft(current => ({ ...current, detected_version: version,
                    price_retail: 0, price_reseller: 0, price_wholesale: 0,
                    prices_confirmed: false, review_confirmed: false }));
                }} />
                <p className="mt-1 text-xs text-slate-500">Selecione a versão do aparelho para consultar o preço da configuração correta.</p>
              </fieldset>
              <label className="block min-w-0">
                <span className="mb-1 block text-xs font-medium text-slate-500">Cor do sistema</span>
                <select
                  value={String(draft.matched_color_id || '')}
                  onChange={event => {
                    const selectedColor = colors.find(color => color.id === event.target.value);
                    setDraft(current => ({
                      ...current,
                      matched_color_id: selectedColor?.id || null,
                      detected_color: selectedColor?.name || current.detected_color || '',
                      review_confirmed: false,
                    }));
                  }}
                  className="h-10 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    {draft.detected_color ? `Mapear cor identificada: ${draft.detected_color}` : 'Selecione uma cor'}
                  </option>
                  {colors.map(color => <option key={color.id} value={color.id}>{color.name}</option>)}
                </select>
                {!draft.matched_color_id && draft.detected_color && (
                  <p className="mt-1 text-xs font-semibold text-amber-700">A cor foi lida, mas ainda precisa ser vinculada a uma cor cadastrada.</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-bold">
                  <a href="/admin/settings/colors" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                    Cadastrar nova cor <ExternalLink className="inline" size={12} />
                  </a>
                  <button type="button" onClick={() => void onRefreshColors()} className="text-slate-600 hover:underline">
                    Atualizar cores <RefreshCw className="inline" size={12} />
                  </button>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-violet-900">Modelo do sistema</h3>
                <p className="text-xs text-violet-700">
                  {intake.matched_model_id ? 'Modelo associado. Você pode corrigir a associação abaixo.' : 'Esperando cadastrar modelo'}
                </p>
              </div>
              <Link
                to="/admin/settings/models"
                className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:underline"
              >
                Cadastrar modelo <ExternalLink size={13} />
              </Link>
            </div>
            {intake.matched_product_id && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <strong>Produto encontrado.</strong> O produto já existe. Falta concluir este aparelho para disponibilizá-lo à venda; não será criado outro produto.
              </div>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="min-w-0 flex-1">
                <label htmlFor={`intake-model-${intake.id}`} className="sr-only">Modelo do sistema</label>
                <SearchableSelect
                  key={intake.id}
                  id={`intake-model-${intake.id}`}
                  value={selectedModelId}
                  options={sortedModels.map(model => model.id)}
                  getOptionLabel={id => modelNames.get(id) || ''}
                  onChange={setSelectedModelId}
                  disabled={busy}
                  placeholder="Pesquisar modelo cadastrado..."
                  className="h-10 w-full min-w-0 rounded-lg border border-violet-200 bg-white px-3 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => selectedModelId && void onAttachModel(selectedModelId)}
                disabled={!selectedModelId || busy}
                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                Associar modelo
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-3">
              <h3 className="font-bold text-amber-950">Esperando confirmar preços</h3>
              <p className="text-xs text-amber-800">
                Os valores atuais encontrados ficam preenchidos. Ao alterar o custo, as margens ativas da marca são aplicadas automaticamente.
              </p>
              {!margin && !priceReference?.prices && <p className="mt-1 text-xs font-semibold text-red-700">Cadastre a margem desta marca antes de confirmar.</p>}
              {priceReference?.prices && <p className="mt-1 text-sm text-blue-800">Preço de venda do grupo: todas as cores usam os mesmos valores. Alterar a compra mantém estes preços.</p>}
              {priceReference?.divergent && <p role="alert" className="mt-1 text-sm text-red-700">Preços divergentes. Use Ajustar preços de venda para definir os valores desta configuração antes de concluir.</p>}
              {priceReferenceError && <p role="alert" className="text-red-700">Falha ao consultar o preço do grupo. Recarregue a página.</p>}
            </div>
            {intake.matched_model_id && <div className="mb-4 flex flex-wrap items-center gap-3">
              <button type="button" disabled={busy || loadingPriceReference} onClick={() => setPriceEditorOpen(true)} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50">Ajustar preços de venda</button>
              <button type="button" disabled={busy || loadingPriceReference} onClick={refreshSalePrices} className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900 disabled:opacity-50"><RefreshCw size={14} className={loadingPriceReference ? 'animate-spin' : ''} />Atualizar valores</button>
              <p className="text-xs text-amber-800">O editor é o mesmo da Gestão de Modelos. Ao voltar, os preços de venda são atualizados aqui.</p>
            </div>}
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3" role="status" aria-label="Compra média em estoque">
              <p className="text-sm font-semibold text-blue-950">Compra média em estoque disponível para venda: <strong>{loadingPriceReference || loadingStockAverage ? 'Consultando…' : stockAverageError ? 'Consulta indisponível' : stockAverage != null ? (stockAverage / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem custo de compra informado em estoque'}</strong></p>
              <p className="mt-1 text-xs text-blue-800">Somente aparelhos disponíveis para venda da configuração {draft.detected_ram} / {draft.detected_storage}{draft.detected_version ? ` · ${draft.detected_version}` : ''}, em todas as cores. Vendidos, reservados e ocultos ficam fora da média.</p>
              <p className="mt-2 text-sm text-blue-950">Última compra registrada: <strong>{loadingPriceReference || loadingStockAverage ? 'Consultando…' : stockAverageError ? 'Consulta indisponível' : lastPurchaseCost != null ? (lastPurchaseCost / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informada'}</strong></p>
              <p className="mt-1 text-xs text-blue-800">A última compra pode ser de um aparelho já vendido. É uma sugestão para a nova entrada; confira o valor pago.</p>
              {stockAverageError && <p className="mt-1 text-xs text-red-700">{stockAverageError}</p>}
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-4">
              <div><CurrencyInput label="Compra deste aparelho" className="h-12 text-base tabular-nums" value={draft.price_cost || 0} onChange={updateCost} /><p className="mt-1 text-xs text-amber-800">Sugerido pela última compra registrada, quando disponível. Valores digitados ou já confirmados são preservados; confira quanto pagou neste aparelho.</p></div>
              <CurrencyInput label="Varejo" className="h-12 text-base tabular-nums" disabled={groupPriceLocked} value={draft.price_retail || 0} onChange={value => setDraft(current => ({ ...current, price_retail: value }))} />
              <CurrencyInput label="Revenda" className="h-12 text-base tabular-nums" disabled={groupPriceLocked} value={draft.price_reseller || 0} onChange={value => setDraft(current => ({ ...current, price_reseller: value }))} />
              <CurrencyInput label="Atacado" className="h-12 text-base tabular-nums" disabled={groupPriceLocked} value={draft.price_wholesale || 0} onChange={value => setDraft(current => ({ ...current, price_wholesale: value }))} />
            </div>
            {matchingGroupCount > 1 && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-300 bg-white/80 p-3">
                <input
                  type="checkbox"
                  checked={applyPricesToGroup}
                  onChange={event => setApplyPricesToGroup(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <span>
                  <span className="block text-sm font-bold text-amber-950">Aplicar aos {matchingGroupCount} aparelhos iguais</span>
                  <span className="block text-xs text-amber-800">Confirma os preços de venda dos aparelhos iguais. Confira a compra de cada aparelho separadamente; custos, IMEIs e seriais permanecem individuais.</span>
                </span>
              </label>
            )}
            <button
              type="button"
              onClick={() => void confirmPrices()}
              disabled={busy || loadingPriceReference || !!priceReferenceError || priceReference?.divergent || !intake.matched_model_id || (!priceReference?.prices && (!margin || !Boolean(margin.active))) || !(draft.price_cost && draft.price_retail && draft.price_reseller && draft.price_wholesale)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 size={16} /> Confirmar preços
            </button>
          </div>

          <PhotoIntakeBlingMapping key={intake.id} intake={intake} busy={busy} />
          {!intake.matched_product_id && !models.find(model => model.id === intake.matched_model_id)?.template_values?.bling_family && (
            <label className="block rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="mb-1 block text-xs font-bold text-slate-700">SKU da nova variação (opcional)</span>
              <input
                value={sku}
                onFocus={event => event.currentTarget.select()}
                onClick={event => event.currentTarget.select()}
                onChange={event => setSku(event.target.value)}
                placeholder="Deixe em branco para gerar automaticamente"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => void onFinalize(sku.trim() || undefined)}
            disabled={busy || !canFinalize}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
            Salvar e disponibilizar para venda
          </button>
        </div>
      </div>
      {priceEditorOpen && intake.matched_model_id && <ModelPricesPanel
        modelId={intake.matched_model_id}
        modelName={modelNames.get(intake.matched_model_id) || intake.detected_model || 'Modelo'}
        initialGroupId={priceReference?.group_id}
        onClose={() => { setPriceEditorOpen(false); refreshSalePrices(); }}
        onSaved={() => { setDraft(current => ({ ...current, prices_confirmed: false })); refreshSalePrices(); }}
      />}
    </section>
  );
}
