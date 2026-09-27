import { useState } from 'react';
import { CurrencyInput } from '../ui/CurrencyInput';
import type { Print3dCostSettings } from '../../services/print3dCostSettings';
import { calculatePrint3dCost } from '../../utils/print3dCost.mjs';

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const field = 'w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm';

export function QuickCostSimulator({ settings }: { settings: Print3dCostSettings }) {
  const [filamentId, setFilamentId] = useState('');
  const [grams, setGrams] = useState('');
  const [pieces, setPieces] = useState('1');
  const [spoolGrams, setSpoolGrams] = useState('1000');
  const [spoolCostCents, setSpoolCostCents] = useState(0);
  const [includeExtras, setIncludeExtras] = useState(true);
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [laborMinutes, setLaborMinutes] = useState('');
  const [overrides, setOverrides] = useState<Partial<Print3dCostSettings>>({});
  const [otherCents, setOtherCents] = useState(0);
  const rates = { ...settings, ...overrides };
  const editRate = (patch: Partial<Print3dCostSettings>) => setOverrides(current => ({ ...current, ...patch }));
  const duration = Number(hours) * 60 + Number(minutes);
  const filament = settings.filaments.find(item => item.id === filamentId);
  let result: ReturnType<typeof calculatePrint3dCost> | null = null;
  let warning = '';
  if (grams !== '') {
    try {
      if (!(Number(grams) > 0)) throw new Error('Informe o consumo em gramas maior que zero.');
      if (filamentId && !filament) throw new Error('Selecione novamente o filamento.');
      const price = filament ? filament.spoolCostCents : spoolCostCents;
      if (!(price > 0)) throw new Error('Informe o preço do rolo ou selecione um filamento com preço cadastrado.');
      if (includeExtras && (Number(hours) < 0 || Number(minutes) < 0)) throw new Error('O tempo não pode ser negativo.');
      if (includeExtras && duration > 0 && (!(rates.printerWatts > 0) || !(rates.energyCentsPerKwh > 0))) {
        throw new Error('Preencha potência e tarifa de energia nesta simulação para incluir o tempo de impressão.');
      }
      result = calculatePrint3dCost({
        pieces: Number(pieces), printMinutes: includeExtras ? duration : 0,
        laborMinutes: includeExtras ? Number(laborMinutes) : 0,
        printerWatts: includeExtras ? rates.printerWatts : 0,
        energyCentsPerKwh: includeExtras ? rates.energyCentsPerKwh : 0,
        machineCentsPerHour: includeExtras ? rates.machineCentsPerHour : 0,
        laborCentsPerHour: includeExtras ? rates.laborCentsPerHour : 0,
        taxPercent: includeExtras ? rates.taxPercent : 0,
        filaments: [{ consumedGrams: Number(grams), spoolGrams: filament ? filament.spoolGrams : Number(spoolGrams), spoolCostCents: price }],
        supplies: includeExtras ? [{ quantity: Number(pieces), unitCostCents: rates.packagingCentsPerPiece }, { quantity: 1, unitCostCents: otherCents }] : [],
      });
    } catch (cause) {
      warning = cause instanceof Error ? cause.message : 'Confira os valores informados.';
    }
  }
  return <section aria-labelledby="quick-cost-title" className="space-y-4 rounded-xl border border-violet-200 bg-violet-50 p-5">
    <div><h2 id="quick-cost-title" className="text-lg font-semibold text-violet-950">Simulação rápida · produto avulso</h2>
      <p className="mt-1 text-sm text-slate-600">Informe os gramas para calcular na hora. Não exige produto, SKU ou JSON; não salva ficha nem movimenta estoque.</p></div>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm">Filamento da simulação<select className={field} value={filamentId} onChange={event => setFilamentId(event.target.value)}><option value="">Informar preço do rolo manualmente</option>{settings.filaments.map(item => <option key={item.id} value={item.id}>{item.name} · {item.color}</option>)}</select></label>
      <label className="text-sm">Material gasto no lote (g)<input className={field} type="number" min="0" step="any" placeholder="Ex.: 50" value={grams} onChange={event => setGrams(event.target.value)} /></label>
      {!filamentId && <><CurrencyInput label="Preço do rolo na simulação" value={spoolCostCents} onChange={setSpoolCostCents} /><label className="text-sm">Peso do rolo na simulação (g)<input className={field} type="number" min="0" step="any" value={spoolGrams} onChange={event => setSpoolGrams(event.target.value)} /></label></>}
      <label className="text-sm">Quantidade de peças na simulação<input className={field} type="number" min="1" step="1" value={pieces} onChange={event => setPieces(event.target.value)} /></label>
    </div>
    {filament && <p className="text-sm text-slate-600">Rolo: {filament.spoolGrams} g · {money(filament.spoolCostCents)}</p>}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeExtras} onChange={event => setIncludeExtras(event.target.checked)} />Incluir tempo e demais custos · desmarque para calcular somente filamento</label>
    {includeExtras && <div className="space-y-3">
      <h3 className="font-semibold text-violet-950">Tempo e custos da simulação avulsa</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">Tempo de impressão (horas)<input className={field} type="number" min="0" step="any" placeholder="Ex.: 2" value={hours} onChange={event => setHours(event.target.value)} /></label>
        <label className="text-sm">Tempo de impressão (minutos adicionais)<input className={field} type="number" min="0" step="any" placeholder="Ex.: 30" value={minutes} onChange={event => setMinutes(event.target.value)} /></label>
        <CurrencyInput label="Máquina por hora · simulação" value={rates.machineCentsPerHour} onChange={value => editRate({ machineCentsPerHour: value })} />
        <CurrencyInput label="Mão de obra por hora · simulação" value={rates.laborCentsPerHour} onChange={value => editRate({ laborCentsPerHour: value })} />
        <label className="text-sm">Trabalho manual avulso (min)<input className={field} type="number" min="0" step="any" value={laborMinutes} onChange={event => setLaborMinutes(event.target.value)} /></label>
        <label className="text-sm">Potência da impressora · simulação (W)<input className={field} type="number" min="0" step="any" value={rates.printerWatts} onChange={event => editRate({ printerWatts: Number(event.target.value) })} /></label>
        <CurrencyInput label="Energia por kWh · simulação" value={rates.energyCentsPerKwh} onChange={value => editRate({ energyCentsPerKwh: value })} />
        <CurrencyInput label="Embalagem por peça · simulação" value={rates.packagingCentsPerPiece} onChange={value => editRate({ packagingCentsPerPiece: value })} />
        <CurrencyInput label="Outros insumos · total do lote" value={otherCents} onChange={setOtherCents} />
        <label className="text-sm">Imposto sobre venda · simulação (%)<input className={field} type="number" min="0" max="99.99" step="0.01" value={rates.taxPercent} onChange={event => editRate({ taxPercent: Number(event.target.value) })} /></label>
      </div>
      <p className="text-xs text-slate-600">Exemplo: 2 horas + 30 minutos = 2h30. Os tempos são do lote inteiro. Mão de obra considera apenas o trabalho manual. Campos de tempo vazios equivalem a zero. Os valores começam com os custos cadastrados; alterações aqui valem apenas nesta simulação, até sair da página. Não repita embalagem em outros insumos.</p>
      <button type="button" className="text-sm text-violet-700 underline" onClick={() => setOverrides({})}>Restaurar tarifas dos custos cadastrados</button>
    </div>}
    {warning && <p role="alert" className="text-sm text-red-700">{warning}</p>}
    {result && <div role="status" aria-live="polite" className="space-y-2 rounded-lg bg-white p-4 text-sm">
      <p>Material do lote: <strong>{money(result.filamentCents)}</strong></p>
      {!includeExtras && <p>Material por peça: <strong>{money(result.unitCents)}</strong> · somente filamento</p>}
      {includeExtras && <><p>Energia: {money(result.energyCents)} · Máquina: {money(result.machineCents)}</p><p>Mão de obra: {money(result.laborCents)} · Embalagem: {money(result.suppliesCents - otherCents)} · Outros insumos: {money(otherCents)}</p><p>Custo do lote: <strong>{money(result.batchCents)}</strong> · Por peça: <strong>{money(result.unitCents)}</strong></p><p>Mínimo com imposto ({result.taxPercent}%), sem lucro: <strong>{money(result.minimumBatchSaleCents)} por lote · {money(result.minimumUnitSaleCents)} por peça</strong></p></>}
      <p className="text-xs text-slate-500">Estimativa de custo, não preço de venda. Valores por peça arredondados para cima ao centavo.</p>
    </div>}
  </section>;
}
