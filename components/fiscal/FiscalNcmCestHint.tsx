import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fiscalTaxProfileService, type CestOption, type NcmLookup } from '../../services/fiscalTaxProfileService';

/** Confere NCM e CEST na hora, contra a tabela NCM vigente (Siscomex) e o Convênio ICMS 142/2018. Só orienta; não salva nada. */
export function FiscalNcmCestHint({ ncm, cest, onPickCest }: { ncm?: string; cest?: string; onPickCest: (code: string) => void }) {
  const digits = String(ncm || '').replace(/\D/g, '');
  const cestDigits = String(cest || '').replace(/\D/g, '');
  const [result, setResult] = useState<(NcmLookup & { cest: CestOption[] }) | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (digits.length !== 8) { setResult(null); return; }
    let active = true;
    const timer = setTimeout(() => {
      fiscalTaxProfileService.lookupNcm(digits).then(r => { if (active) setResult(r); }).catch(() => { if (active) setFailed(true); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [digits]);
  if (!digits) return <p className="text-xs text-slate-500">Informe o NCM com 8 dígitos (ex.: smartphone 8517.13.00).</p>;
  if (digits.length !== 8) return <p className="flex items-center gap-1 text-xs font-semibold text-amber-800"><AlertTriangle size={13} />NCM tem 8 dígitos; foram informados {digits.length}. Confira com a contadora.</p>;
  if (failed) return <p className="text-xs text-slate-500">Não foi possível consultar a tabela oficial agora.</p>;
  if (!result) return <p className="text-xs text-slate-500">Consultando tabela oficial…</p>;
  if (!result.valid) return <p className="flex items-center gap-1 text-xs font-semibold text-amber-800"><AlertTriangle size={13} />{result.message}</p>;
  const cestOk = !cestDigits || result.cest.some(o => o.code === cestDigits);
  return <div className="space-y-1 text-xs">
    <p className="flex items-start gap-1 text-emerald-800"><CheckCircle2 size={13} className="mt-0.5 shrink-0" /><span><b>{result.formatted}</b> — {result.description}</span></p>
    {result.cest.length === 0
      ? <p className="text-slate-600">Nenhum CEST no Convênio 142/2018 para este NCM (em geral, sem substituição tributária).{cestDigits ? ' O CEST preenchido não corresponde a este NCM.' : ''}</p>
      : <div className="space-y-1">
        <p className="text-slate-600">CESTs possíveis para este NCM (a contadora confirma se há ST):</p>
        <div className="flex flex-wrap gap-1">{result.cest.slice(0, 8).map(o => <button key={o.code} type="button" title={o.description} onClick={() => onPickCest(o.code)}
          className={`rounded-full border px-2 py-0.5 ${o.code === cestDigits ? 'border-blue-600 bg-blue-50 font-semibold text-blue-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{o.formatted}</button>)}</div>
        {!cestOk && <p className="flex items-center gap-1 font-semibold text-amber-800"><AlertTriangle size={13} />O CEST preenchido não corresponde a este NCM no Convênio 142/2018.</p>}
      </div>}
  </div>;
}

export default FiscalNcmCestHint;
