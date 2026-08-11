import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Save, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { ProtectedIntakePhoto } from './ProtectedIntakePhoto';
import type { Color } from '../../../types/color';
import type { Model } from '../../../types/model';
import type {
  SmartphoneBrandPriceMargin,
  SmartphonePhotoIntake,
  SmartphonePhotoIntakeUpdate,
} from '../../../types/smartphone-photo-intake';
import { SMARTPHONE_PHOTO_INTAKE_STATUS_LABELS } from '../../../types/smartphone-photo-intake';

interface PhotoIntakeReviewCardProps {
  intake: SmartphonePhotoIntake;
  models: Model[];
  colors: Color[];
  margin?: SmartphoneBrandPriceMargin | null;
  busy?: boolean;
  onUpdate: (input: SmartphonePhotoIntakeUpdate) => Promise<void>;
  onAttachModel: (modelId: string) => Promise<void>;
  onRetry: () => Promise<void>;
  onRefreshColors: () => Promise<void>;
  onFinalize: (sku?: string) => Promise<void>;
}

const TEXT_FIELDS: Array<{ key: keyof SmartphonePhotoIntakeUpdate; label: string; mono?: boolean }> = [
  { key: 'detected_brand', label: 'Marca' },
  { key: 'detected_model', label: 'Modelo' },
  { key: 'detected_ram', label: 'RAM' },
  { key: 'detected_storage', label: 'Armazenamento' },
  { key: 'detected_serial', label: 'Número de série', mono: true },
  { key: 'detected_imei_1', label: 'IMEI 1', mono: true },
  { key: 'detected_imei_2', label: 'IMEI 2', mono: true },
  { key: 'detected_ean', label: 'EAN/GTIN', mono: true },
];

function buildDraft(intake: SmartphonePhotoIntake): SmartphonePhotoIntakeUpdate {
  return {
    detected_brand: intake.detected_brand || '',
    detected_model: intake.detected_model || '',
    detected_color: intake.detected_color || '',
    detected_ram: intake.detected_ram || '',
    detected_storage: intake.detected_storage || '',
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
  };
}

export function PhotoIntakeReviewCard({
  intake,
  models,
  colors,
  margin,
  busy,
  onUpdate,
  onAttachModel,
  onRetry,
  onRefreshColors,
  onFinalize,
}: PhotoIntakeReviewCardProps) {
  const [draft, setDraft] = useState<SmartphonePhotoIntakeUpdate>(() => buildDraft(intake));
  const [selectedModelId, setSelectedModelId] = useState(intake.matched_model_id || '');
  const [sku, setSku] = useState(intake.detected_product_code || '');

  useEffect(() => {
    setDraft(buildDraft(intake));
    setSelectedModelId(intake.matched_model_id || '');
    setSku(intake.detected_product_code || '');
  }, [intake]);

  const sortedModels = useMemo(
    () => [...models].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
    [models],
  );

  const updateCost = (cost: number) => {
    const activeMargin = margin && Boolean(margin.active) ? margin : null;
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
    await onUpdate({ ...draft, prices_confirmed: true });
  };

  const issues = [
    ...(intake.validation_errors || []),
    ...(intake.validation_warnings || []),
  ];
  const canFinalize = intake.status === 'ready_to_finalize' && Boolean(intake.matched_color_id);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
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

      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(420px,1.2fr)]">
        <div className="space-y-4">
          <ProtectedIntakePhoto intakeId={intake.id} />
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
            Esta etiqueta é carregada por uma rota autenticada e não fica exposta como imagem pública.
          </div>
          {issues.length > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs font-bold text-orange-800">Pontos para conferir</p>
              <ul className="mt-2 space-y-1 text-xs text-orange-700">
                {issues.map((issue, index) => <li key={`${issue.field || 'issue'}-${index}`}>• {issue.message}</li>)}
              </ul>
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

        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold text-slate-800">Dados identificados</h3>
              <button
                type="button"
                onClick={() => void onUpdate(draft)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Save size={14} /> Salvar conferência
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TEXT_FIELDS.map(field => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">{field.label}</span>
                  <input
                    value={String(draft[field.key] ?? '')}
                    onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))}
                    className={`h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 ${field.mono ? 'font-mono' : ''}`}
                  />
                </label>
              ))}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Cor do sistema</span>
                <select
                  value={String(draft.matched_color_id || '')}
                  onChange={event => {
                    const selectedColor = colors.find(color => color.id === event.target.value);
                    setDraft(current => ({
                      ...current,
                      matched_color_id: selectedColor?.id || null,
                      detected_color: selectedColor?.name || current.detected_color || '',
                    }));
                  }}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedModelId}
                onChange={event => setSelectedModelId(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-violet-200 bg-white px-3 text-sm"
              >
                <option value="">Selecione um modelo cadastrado</option>
                {sortedModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
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
              {!margin && <p className="mt-1 text-xs font-semibold text-red-700">Cadastre a margem desta marca antes de confirmar.</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CurrencyInput label="Compra" value={draft.price_cost || 0} onChange={updateCost} />
              <CurrencyInput label="Varejo" value={draft.price_retail || 0} onChange={value => setDraft(current => ({ ...current, price_retail: value }))} />
              <CurrencyInput label="Revenda" value={draft.price_reseller || 0} onChange={value => setDraft(current => ({ ...current, price_reseller: value }))} />
              <CurrencyInput label="Atacado" value={draft.price_wholesale || 0} onChange={value => setDraft(current => ({ ...current, price_wholesale: value }))} />
            </div>
            <button
              type="button"
              onClick={() => void confirmPrices()}
              disabled={busy || !intake.matched_model_id || !margin || !Boolean(margin.active) || !(draft.price_cost && draft.price_retail && draft.price_reseller && draft.price_wholesale)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 size={16} /> Confirmar preços
            </button>
          </div>

          {!intake.matched_product_id && (
            <label className="block rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="mb-1 block text-xs font-bold text-slate-700">SKU da nova variação</span>
              <input
                value={sku}
                onChange={event => setSku(event.target.value)}
                placeholder="Informe o SKU antes de finalizar"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => void onFinalize(sku.trim() || undefined)}
            disabled={busy || !canFinalize || (!intake.matched_product_id && !sku.trim())}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
            Salvar e disponibilizar para venda
          </button>
        </div>
      </div>
    </section>
  );
}
