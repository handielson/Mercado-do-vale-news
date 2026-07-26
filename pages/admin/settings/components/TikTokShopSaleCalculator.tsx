import React, { useMemo, useState } from 'react';
import { Calculator, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { tiktokShopService, type TikTokShopSafeStatus } from '../../../../services/tiktokShopService';
import { calculateTikTokShopSaleCost } from '../../../../utils/tiktokShopSaleCalculator.js';

type FormState = {
  salePrice: string;
  productCost: string;
  commissionPct: string;
  transactionFeePct: string;
  taxPct: string;
  adsPct: string;
  fixedFee: string;
  shippingCost: string;
  shippingSubsidy: string;
  packagingCost: string;
  targetMarginPct: string;
  productId: string;
  skuId: string;
};

const initialForm: FormState = {
  salePrice: '0,00',
  productCost: '0,00',
  commissionPct: '0',
  transactionFeePct: '0',
  taxPct: '0',
  adsPct: '0',
  fixedFee: '0,00',
  shippingCost: '0,00',
  shippingSubsidy: '0,00',
  packagingCost: '0,00',
  targetMarginPct: '20',
  productId: '',
  skuId: '',
};

function parseDecimal(value: string) {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyToCents(value: string) {
  return Math.max(0, Math.round(parseDecimal(value) * 100));
}

function formatMoney(cents: number | null) {
  if (cents === null) return 'Inviavel com estas taxas';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function PercentInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1 flex rounded-lg border border-slate-300 bg-white shadow-sm">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          className="min-w-0 flex-1 rounded-l-lg px-3 py-2 text-sm outline-none"
        />
        <span className="border-l border-slate-200 px-3 py-2 text-sm text-slate-500">%</span>
      </div>
    </label>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1 flex rounded-lg border border-slate-300 bg-white shadow-sm">
        <span className="border-r border-slate-200 px-3 py-2 text-sm text-slate-500">R$</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          className="min-w-0 flex-1 rounded-r-lg px-3 py-2 text-sm outline-none"
        />
      </div>
    </label>
  );
}

export default function TikTokShopSaleCalculator({ status }: { status: TikTokShopSafeStatus | null }) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [syncing, setSyncing] = useState(false);
  const result = useMemo(() => calculateTikTokShopSaleCost({
    salePriceCents: moneyToCents(form.salePrice),
    productCostCents: moneyToCents(form.productCost),
    commissionPct: parseDecimal(form.commissionPct),
    transactionFeePct: parseDecimal(form.transactionFeePct),
    taxPct: parseDecimal(form.taxPct),
    adsPct: parseDecimal(form.adsPct),
    fixedFeeCents: moneyToCents(form.fixedFee),
    shippingCostCents: moneyToCents(form.shippingCost),
    shippingSubsidyCents: moneyToCents(form.shippingSubsidy),
    packagingCostCents: moneyToCents(form.packagingCost),
    targetMarginPct: parseDecimal(form.targetMarginPct),
  }), [form]);
  const canSync = Boolean(
    status?.connected &&
    status.granted_scopes.includes('seller.product.write') &&
    form.productId.trim() &&
    form.skuId.trim() &&
    result.salePriceCents > 0,
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function syncPrice() {
    if (!canSync) return;
    setSyncing(true);
    try {
      await tiktokShopService.updatePrice({
        product_id: form.productId.trim(),
        sku_id: form.skuId.trim(),
        amount_cents: result.salePriceCents,
        currency: 'BRL',
      });
      toast.success('Preco sincronizado com o TikTok Shop.');
    } catch (error: any) {
      console.error('[TikTokShopSaleCalculator] price sync failed:', error);
      toast.error(error?.message || 'Falha ao sincronizar o preco.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-900">Calculadora de custo da venda</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            As taxas sao configuraveis porque comissao, campanhas e subsidios variam por loja.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MoneyInput label="Preco de venda" value={form.salePrice} onChange={(value) => update('salePrice', value)} />
          <MoneyInput label="Custo do produto" value={form.productCost} onChange={(value) => update('productCost', value)} />
          <MoneyInput label="Tarifa fixa" value={form.fixedFee} onChange={(value) => update('fixedFee', value)} />
          <PercentInput label="Comissao TikTok" value={form.commissionPct} onChange={(value) => update('commissionPct', value)} />
          <PercentInput label="Tarifa de transacao" value={form.transactionFeePct} onChange={(value) => update('transactionFeePct', value)} />
          <PercentInput label="Impostos" value={form.taxPct} onChange={(value) => update('taxPct', value)} />
          <PercentInput label="Anuncios/afiliados" value={form.adsPct} onChange={(value) => update('adsPct', value)} />
          <MoneyInput label="Frete pago pela loja" value={form.shippingCost} onChange={(value) => update('shippingCost', value)} />
          <MoneyInput label="Subsidio de frete" value={form.shippingSubsidy} onChange={(value) => update('shippingSubsidy', value)} />
          <MoneyInput label="Embalagem" value={form.packagingCost} onChange={(value) => update('packagingCost', value)} />
          <PercentInput label="Margem desejada" value={form.targetMarginPct} onChange={(value) => update('targetMarginPct', value)} />
        </div>

        <div className="rounded-lg bg-slate-950 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resultado estimado</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-400">Taxas variaveis</dt>
              <dd className="mt-1 text-lg font-semibold">{formatMoney(result.variableFeesCents)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Custo total</dt>
              <dd className="mt-1 text-lg font-semibold">{formatMoney(result.totalCostCents)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Lucro liquido</dt>
              <dd className={`mt-1 text-lg font-semibold ${result.netProfitCents >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {formatMoney(result.netProfitCents)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Margem</dt>
              <dd className="mt-1 text-lg font-semibold">{result.marginPct.toFixed(2)}%</dd>
            </div>
            <div>
              <dt className="text-slate-400">Preco de equilibrio</dt>
              <dd className="mt-1 font-semibold">{formatMoney(result.breakEvenPriceCents)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Preco sugerido</dt>
              <dd className="mt-1 font-semibold text-teal-300">{formatMoney(result.suggestedPriceCents)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Sincronizar este preco</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={form.productId}
            onChange={(event) => update('productId', event.target.value)}
            placeholder="TikTok Product ID"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            value={form.skuId}
            onChange={(event) => update('skuId', event.target.value)}
            placeholder="TikTok SKU ID"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={syncPrice}
            disabled={!canSync || syncing}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar
          </button>
        </div>
        {!status?.granted_scopes.includes('seller.product.write') && (
          <p className="mt-2 text-xs text-amber-700">
            Ative o escopo seller.product.write e reconecte a loja para liberar a sincronizacao.
          </p>
        )}
      </div>
    </section>
  );
}
