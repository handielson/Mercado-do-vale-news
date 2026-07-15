import React from 'react';
import { Calculator, CreditCard, Smartphone } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { formatPrice } from '../../services/installmentCalculator';
import { paymentFeesService } from '../../services/payment-fees';
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

export default function QuoteCalculatorPage() {
  const [searchParams] = useSearchParams();
  const initialTotal = centsFromParam(searchParams.get('total'));
  const initialEntry = Math.min(initialTotal, centsFromParam(searchParams.get('entrada')));
  const initialInstallment = Number(searchParams.get('parcela')) || null;

  const [totalInput, setTotalInput] = React.useState(formatInput(initialTotal));
  const [entryInput, setEntryInput] = React.useState(formatInput(initialEntry));
  const [selectedInstallment, setSelectedInstallment] = React.useState<number | null>(initialInstallment);
  const [fees, setFees] = React.useState<PaymentFee[]>([]);

  React.useEffect(() => {
    paymentFeesService.list().then(setFees).catch(() => setFees([]));
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
      </div>
    </main>
  );
}
