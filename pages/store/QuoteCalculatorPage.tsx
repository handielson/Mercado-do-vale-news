import React from 'react';
import { Calculator, Check, Copy, CreditCard, MessageCircle, Smartphone } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { formatPrice } from '../../services/installmentCalculator';
import { paymentFeesService } from '../../services/payment-fees';
import { publicCompanySettingsService } from '../../services/publicCompanySettings';
import type { PaymentFee } from '../../types/payment-fees';

function centsFromParam(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function parseMoneyInput(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function formatInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2).replace('.', ',');
}

function getFeePercent(fee: PaymentFee | undefined): number {
  return Number((fee as any)?.applied_fee_pct ?? fee?.applied_fee ?? 0) || 0;
}

type QuoteCalculatorItem = {
  produto: string;
  variacao: string;
  total: number;
  entrada: number;
};

function parseQuoteItems(value: string | null, fallback: QuoteCalculatorItem): QuoteCalculatorItem[] {
  let parsed: unknown = null;
  try {
    parsed = value ? JSON.parse(value) : null;
  } catch {
    parsed = null;
  }

  const rows = Array.isArray(parsed) ? parsed : [];
  const validRows = rows
    .map((row) => {
      const candidate = row as Partial<QuoteCalculatorItem>;
      const total = Number(candidate.total);
      if (!Number.isFinite(total) || total <= 0) return null;
      const entrada = Math.min(total, Math.max(0, Number(candidate.entrada) || 0));
      return {
        produto: String(candidate.produto || '').trim() || fallback.produto,
        variacao: String(candidate.variacao || '').trim(),
        total: Math.round(total),
        entrada: Math.round(entrada),
      };
    })
    .filter(Boolean) as QuoteCalculatorItem[];

  if (validRows.length > 0) return validRows;
  return fallback.total > 0 || fallback.produto || fallback.variacao ? [fallback] : [];
}

export default function QuoteCalculatorPage() {
  const [searchParams] = useSearchParams();
  const initialTotal = centsFromParam(searchParams.get('total'));
  const initialEntry = Math.min(initialTotal, centsFromParam(searchParams.get('entrada')));
  const initialInstallment = Number(searchParams.get('parcela')) || null;
  const initialProductName = (searchParams.get('produto') || '').trim();
  const initialProductVariation = (searchParams.get('variacao') || '').trim();
  const quoteItems = React.useMemo(() => parseQuoteItems(searchParams.get('itens'), {
    produto: initialProductName,
    variacao: initialProductVariation,
    total: initialTotal,
    entrada: initialEntry,
  }), [initialEntry, initialProductName, initialProductVariation, initialTotal, searchParams]);

  const [totalInput, setTotalInput] = React.useState(formatInput(initialTotal));
  const [entryInput, setEntryInput] = React.useState(formatInput(initialEntry));
  const [selectedInstallment, setSelectedInstallment] = React.useState<number | null>(initialInstallment);
  const [selectedItemIndex, setSelectedItemIndex] = React.useState(() => Math.max(0, quoteItems.findIndex((item) => (
    item.total === initialTotal
    && item.entrada === initialEntry
    && item.produto === initialProductName
    && item.variacao === initialProductVariation
  ))));
  const [productName, setProductName] = React.useState(initialProductName);
  const [productVariation, setProductVariation] = React.useState(initialProductVariation);
  const [fees, setFees] = React.useState<PaymentFee[]>([]);
  const [storePhone, setStorePhone] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    paymentFeesService.list().then(setFees).catch(() => setFees([]));
    publicCompanySettingsService.get()
      .then((settings) => setStorePhone(settings?.phone || ''))
      .catch(() => setStorePhone(''));
  }, []);

  const totalCents = parseMoneyInput(totalInput);
  const entryCents = Math.min(totalCents, parseMoneyInput(entryInput));
  const cardCents = Math.max(0, totalCents - entryCents);

  const options = React.useMemo(() => {
    const creditFees = fees
      .filter((fee) => fee.channel === 'presencial' && fee.installments >= 1 && fee.installments <= 12)
      .sort((a, b) => a.installments - b.installments)
      .filter((fee, index, rows) => index === rows.findIndex((row) => row.installments === fee.installments));

    const feeRows = creditFees.length > 0
      ? creditFees
      : Array.from({ length: 12 }, (_, index) => ({ installments: index + 1, applied_fee: 0, applied_fee_pct: 0 }) as PaymentFee);

    return feeRows.map((fee) => {
      const totalWithFee = Math.round(cardCents * (1 + getFeePercent(fee) / 100));
      return {
        installments: fee.installments,
        monthlyValue: Math.round(totalWithFee / fee.installments),
        totalWithFee,
      };
    });
  }, [cardCents, fees]);

  React.useEffect(() => {
    if (selectedInstallment && !options.some((option) => option.installments === selectedInstallment)) {
      setSelectedInstallment(null);
    }
  }, [options, selectedInstallment]);

  const selectedOption = options.find((option) => option.installments === selectedInstallment) || null;
  const grandTotal = entryCents + (selectedOption?.totalWithFee || cardCents);
  const productLabel = [productName, productVariation].filter(Boolean).join(' - ');
  const selectQuoteItem = (item: QuoteCalculatorItem, index: number) => {
    setSelectedItemIndex(index);
    setProductName(item.produto);
    setProductVariation(item.variacao);
    setTotalInput(formatInput(item.total));
    setEntryInput(formatInput(Math.min(item.total, item.entrada)));
  };
  const currentCalculatorUrl = React.useMemo(() => {
    const params = new URLSearchParams({
      total: String(totalCents),
      entrada: String(entryCents),
    });
    if (selectedInstallment) params.set('parcela', String(selectedInstallment));
    if (productName) params.set('produto', productName);
    if (productVariation) params.set('variacao', productVariation);
    if (quoteItems.length > 0) params.set('itens', JSON.stringify(quoteItems));
    return `https://mercadodovale.com.br/calculadora-orcamento?${params.toString()}`;
  }, [entryCents, productName, productVariation, quoteItems, selectedInstallment, totalCents]);

  const shareMessage = React.useMemo(() => {
    let text = 'Olá! Fiz uma simulação de orçamento.\n\n';
    if (productLabel) text += `Produto: ${productLabel}\n`;
    text += `Valor do orçamento: ${formatPrice(totalCents)}\n`;
    text += `Entrada Pix/Dinheiro: ${formatPrice(entryCents)}\n`;
    text += `Restante no cartão: ${formatPrice(cardCents)}\n`;
    if (selectedOption) {
      text += `Opção escolhida: ${selectedOption.installments}x de ${formatPrice(selectedOption.monthlyValue)} = ${formatPrice(selectedOption.totalWithFee)}\n`;
      text += `Total geral: ${formatPrice(entryCents + selectedOption.totalWithFee)}\n`;
    }
    text += `\nLink da simulação: ${currentCalculatorUrl}`;
    return text;
  }, [cardCents, currentCalculatorUrl, entryCents, productLabel, selectedOption, totalCents]);

  const handleCopySimulation = async () => {
    await navigator.clipboard.writeText(shareMessage);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleShareStore = () => {
    const cleanPhone = storePhone.replace(/\D/g, '');
    const phone = cleanPhone ? `55${cleanPhone}` : '';
    const encoded = encodeURIComponent(shareMessage);
    const href = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Calculadora de Orçamento</h1>
            <p className="text-sm text-slate-600">Simule entrada no Pix e parcelamento no cartão.</p>
          </div>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {quoteItems.length > 1 ? (
            <div className="mb-4">
              <div className="mb-2 text-xs font-bold uppercase text-slate-500">Escolha o aparelho</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {quoteItems.map((item, index) => {
                  const selected = index === selectedItemIndex;
                  return (
                    <button
                      key={`${item.produto}-${item.variacao}-${index}`}
                      type="button"
                      onClick={() => selectQuoteItem(item, index)}
                      className={`rounded-lg border-2 p-3 text-left transition ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-slate-950">{item.produto || 'Produto'}</div>
                          {item.variacao && <div className="mt-0.5 text-xs font-semibold text-blue-700">{item.variacao}</div>}
                        </div>
                        {selected && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">Orçamento</div>
                      <div className="text-sm font-black text-slate-900">{formatPrice(item.total)}</div>
                      {item.entrada > 0 && (
                        <div className="mt-1 text-xs font-semibold text-cyan-700">Entrada {formatPrice(item.entrada)}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : productLabel && (
            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
              <div className="text-xs font-bold uppercase text-blue-600">Produto da simulação</div>
              <div className="mt-1 text-base font-black text-blue-950">{productName || 'Produto'}</div>
              {productVariation && <div className="text-sm font-semibold text-blue-800">{productVariation}</div>}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
                <Calculator className="h-3.5 w-3.5" /> Valor do orçamento
              </span>
              <input
                value={totalInput}
                onChange={(event) => setTotalInput(event.target.value.replace(/[^0-9,.]/g, ''))}
                inputMode="decimal"
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-lg font-bold outline-none focus:border-blue-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
                <Smartphone className="h-3.5 w-3.5" /> Entrada Pix/Dinheiro
              </span>
              <input
                value={entryInput}
                onChange={(event) => setEntryInput(event.target.value.replace(/[^0-9,.]/g, ''))}
                inputMode="decimal"
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-lg font-bold outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span>Entrada</span>
              <strong>{formatPrice(entryCents)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Restante no cartão</span>
              <strong>{formatPrice(cardCents)}</strong>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span>Total estimado</span>
              <strong>{formatPrice(grandTotal)}</strong>
            </div>
          </div>
        </section>

        {cardCents > 0 ? (
          <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
              <CreditCard className="h-4 w-4 text-blue-600" />
              Parcelamento do restante no cartão
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {options.map((option) => {
                const selected = selectedInstallment === option.installments;
                return (
                  <button
                    key={option.installments}
                    onClick={() => setSelectedInstallment(selected ? null : option.installments)}
                    className={`rounded-lg border-2 p-3 text-center transition ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                  >
                    <div className="text-sm font-black">{option.installments}x de {formatPrice(option.monthlyValue)}</div>
                    <div className="mt-1 text-xs text-slate-500">Total {formatPrice(option.totalWithFee)}</div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-center text-sm font-bold text-green-800">
            Pagamento completo no Pix/Dinheiro.
          </section>
        )}

        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-bold text-slate-700">Compartilhar simulação</div>
          {!selectedOption && cardCents > 0 && (
            <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Escolha uma opção de parcelamento para enviar a simulação selecionada para a loja.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleShareStore}
              disabled={cardCents > 0 && !selectedOption}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" />
              Compartilhar com a loja
            </button>
            <button
              type="button"
              onClick={handleCopySimulation}
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-blue-200 px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar simulação'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
