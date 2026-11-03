import React, { useEffect, useState } from 'react';
import { BadgePercent, X } from 'lucide-react';
import { CurrencyInput } from '../ui/CurrencyInput';
import { formatCurrency } from '../../utils/saleCalculations';
import { discountFromPercent, percentOfBase, clampDiscount } from './saleDiscount.js';

// Desconto da venda no PDV: sempre visível, em R$ ou %, vale para qualquer forma de pagamento.
// Bloqueado enquanto houver pagamento lançado (o valor do Pix/cartão já foi calculado com o total antigo).

interface Props {
  /** Total antes do desconto (itens + entrega cobrada do cliente), em centavos. */
  base: number;
  /** Desconto atual, em centavos. */
  value: number;
  onChange: (cents: number) => void;
  /** Motivo do bloqueio (ex.: pagamento lançado, cupom aplicado). */
  lockedReason?: string | null;
}

const QUICK_PERCENTS = [5, 10, 15];

export function SaleDiscountControl({ base, value, onChange, lockedReason }: Props) {
  const [mode, setMode] = useState<'money' | 'percent'>('money');
  const [percentText, setPercentText] = useState('');
  const locked = Boolean(lockedReason);
  const percent = percentOfBase(value, base);

  // Se o total mudar (item a mais/a menos), o desconto nunca passa do total.
  useEffect(() => {
    const limited = clampDiscount(value, base);
    if (limited !== value) onChange(limited);
  }, [base, value, onChange]);

  const applyPercent = (text: string) => {
    setPercentText(text);
    const parsed = Number(String(text).replace(',', '.'));
    if (!Number.isFinite(parsed)) return;
    onChange(discountFromPercent(base, parsed));
  };

  return (
    <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4" aria-label="Desconto da venda" data-pdv-sale-discount>
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><BadgePercent size={18} /> Desconto da venda</h4>
        <div className="inline-flex rounded-lg border border-emerald-200 bg-white p-0.5 text-xs font-semibold" role="group" aria-label="Tipo de desconto">
          <button type="button" disabled={locked} onClick={() => setMode('money')} aria-pressed={mode === 'money'}
            className={`min-h-[36px] rounded-md px-3 ${mode === 'money' ? 'bg-emerald-600 text-white' : 'text-emerald-800'}`}>R$</button>
          <button type="button" disabled={locked} onClick={() => { setMode('percent'); setPercentText(percent ? String(percent).replace('.', ',') : ''); }} aria-pressed={mode === 'percent'}
            className={`min-h-[36px] rounded-md px-3 ${mode === 'percent' ? 'bg-emerald-600 text-white' : 'text-emerald-800'}`}>%</button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[140px] flex-1">
          {mode === 'money' ? (
            <CurrencyInput label="Valor do desconto" value={value || 0} onChange={cents => onChange(clampDiscount(cents, base))} disabled={locked} />
          ) : (
            <label className="block text-sm font-medium text-slate-700">Percentual
              <input type="text" inputMode="decimal" value={percentText} disabled={locked} placeholder="0"
                onChange={event => applyPercent(event.target.value)}
                className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3 text-base disabled:bg-slate-100" />
            </label>
          )}
        </div>
        {QUICK_PERCENTS.map(item => (
          <button key={item} type="button" disabled={locked} onClick={() => { setMode('percent'); applyPercent(String(item)); }}
            className="min-h-[44px] rounded-lg border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-800 disabled:opacity-50">{item}%</button>
        ))}
        {value > 0 && !locked && (
          <button type="button" onClick={() => { onChange(0); setPercentText(''); }} aria-label="Tirar desconto"
            className="flex min-h-[44px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"><X size={16} /> Tirar</button>
        )}
      </div>

      {value > 0 && (
        <p className="mt-2 text-sm text-emerald-900" data-pdv-discount-summary>
          De {formatCurrency(base)} por <strong>{formatCurrency(Math.max(0, base - value))}</strong> · desconto de {formatCurrency(value)} ({String(percent).replace('.', ',')}%)
        </p>
      )}
      {lockedReason && <p className="mt-2 text-xs font-semibold text-amber-800">{lockedReason}</p>}
    </section>
  );
}
