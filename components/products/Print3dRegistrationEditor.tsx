import React, { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CurrencyInput } from '../ui/CurrencyInput';
import { SearchableSelect } from '../ui/SearchableSelect';
import { colorService, getColorHex } from '../../services/colors';
import { filamentColorStyle } from '../../utils/print3dFilamentInventory.mjs';
import { print3dCostSettingsService } from '../../services/print3dCostSettings';
import { print3dRecipesService } from '../../services/print3dRecipes';
import { print3dRecipeFilesService } from '../../services/print3dRecipeFiles';
import { newPrint3dPlate, newPrint3dSetup, PRINT3D_PRINTER_OPTIONS, DEFAULT_PRINT3D_PRINTER, BAMBU_A1_AVERAGE_WATTS, formatPrint3dDuration, parsePrint3dDuration, print3dFileKind, print3dSetupParameters, type Print3dSetup } from '../../services/print3dRegistration';
import { isLocalCatalogPreviewRuntime } from '../../services/localCatalogPreview';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const money = (cents:number) => (cents / 100).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
function PrintDurationInput({label,minutes,onChange}:{label:string;minutes:number;onChange:(minutes:number)=>void}) {
  const [text,setText] = useState(formatPrint3dDuration(minutes));
  useEffect(() => { setText(formatPrint3dDuration(minutes)); },[minutes]);
  return <label className="block text-sm text-slate-700">{label}<input className={inputClass} type="text" inputMode="numeric" placeholder="00:00" value={text} onChange={e => {
    setText(e.target.value);
    const parsed = parsePrint3dDuration(e.target.value);
    e.target.setCustomValidity(parsed === undefined ? 'Informe a duração em horas:minutos, por exemplo 02:30.' : '');
    if (parsed !== undefined) onChange(parsed);
  }} onBlur={e => {
    const parsed = parsePrint3dDuration(text);
    if (parsed === undefined) { toast.warning('Duração inválida. Use horas:minutos, por exemplo 02:30.'); setText(formatPrint3dDuration(minutes)); e.target.setCustomValidity(''); }
    else setText(formatPrint3dDuration(parsed));
  }} /><span className="mt-1 block text-xs text-slate-500">Horas:minutos, inclusive durações acima de 24 horas.</span></label>;
}
export function Print3dRegistrationEditor({ value, onChange, productId, disabled = false, view = 'all', template = false }: {
  value?:Print3dSetup; onChange:(value:Print3dSetup | undefined) => void; productId?:string; disabled?:boolean;
  view?:'all' | 'files' | 'parameters'; template?:boolean;
}) {
  const printerOptionsId = useId();
  const finalCostId = useId();
  const currentSetup = useRef(value);
  currentSetup.current = value;
  const [filamentLoadError,setFilamentLoadError] = useState('');
  useEffect(() => {
    if (!value) return;
    let active = true;
    print3dCostSettingsService.get().then(settings => {
      if (!active || !currentSetup.current) return;
      const current = currentSetup.current;
      const ids = new Set(current.settings.filaments.map(f => f.id));
      const added = settings.filaments.filter(f => !ids.has(f.id));
      if (added.length) onChange({...current,settings:{...current.settings,filaments:[...current.settings.filaments,...added]}});
      setFilamentLoadError('');
    }).catch(() => { if (active) setFilamentLoadError('Não foi possível consultar os novos filamentos. A lista salva na ficha foi preservada; tente Atualizar filamentos, insumos e tarifas cadastrados.'); });
    return () => { active = false; };
  },[Boolean(value),productId]);
  const [colorHexes,setColorHexes] = useState<Record<string,string>>({});
  useEffect(() => {
    if (value?.printer === DEFAULT_PRINT3D_PRINTER && value.settings.printerWatts === 0) {
      onChange({...value,settings:{...value.settings,printerWatts:BAMBU_A1_AVERAGE_WATTS}});
    }
  },[Boolean(value),productId]);
  useEffect(() => { let active = true; colorService.list().then(colors => {
    if (active) setColorHexes(Object.fromEntries(colors.filter(c => c.hex_code).map(c => [c.name,c.hex_code!])));
  }).catch(() => {}); return () => { active = false; }; },[]);
  const [busy, setBusy] = useState(false);
  const [revisions, setRevisions] = useState<Array<{ revision:string; preview?:boolean }>>([]);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    if (!productId) return;
    let active = true;
    print3dRecipesService.list(productId).then(r => { if (active) { setRevisions(r.recipes); setLoadError(''); } })
      .catch(e => { if (active) setLoadError(e.message); });
    return () => { active = false; };
  }, [productId]);
  const enable = async () => {
    setBusy(true);
    try { onChange(newPrint3dSetup(await print3dCostSettingsService.get())); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível carregar os custos cadastrados.'); }
    finally { setBusy(false); }
  };
  const load = async (revision:string) => {
    if (!productId) return;
    setBusy(true);
    try {
      const { id, draft } = await print3dRecipesService.get(productId, revision);
      const { files } = await print3dRecipeFilesService.list(id);
      if (!draft.plates) throw new Error('Esta ficha antiga não separa placas. Consulte a calculadora e cadastre o plano de placas abaixo.');
      onChange({ revision:`r${Date.now()}`, sourceUrl:draft.sourceUrl || '', printer:draft.productionDetails.printer,
        profile:draft.productionDetails.profile, includesWaste:draft.productionDetails.material_includes_supports_and_purge,
        notes:draft.productionDetails.notes, pieces:draft.piecesPerBatch, laborMinutes:draft.laborMinutes,
        settings:{ ...(await print3dCostSettingsService.get()), ...draft.rateSnapshot, packagingCentsPerPiece:0,
          filaments:draft.filaments, supplies:draft.supplies }, supplies:draft.supplies.map(s => ({ id:s.id, quantity:s.quantity })),
        plates:draft.plates.map(p => ({ id:p.id, name:p.name, hours:Math.floor(p.printMinutes / 60), minutes:p.printMinutes % 60,
          notes:p.notes, filaments:p.filaments.map(f => ({ id:f.id, grams:f.consumedGrams })), files:p.files.map(reference => {
            const existing = files.find(f => f.kind === reference.kind && f.sha256 === reference.sha256 && f.byte_size === reference.byte_size);
            if (!existing) throw new Error(`${p.name}: arquivo ausente. A ficha não foi carregada.`);
            return { kind:reference.kind, existing };
          }) })),
      });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao carregar ficha.'); }
    finally { setBusy(false); }
  };
  const change = (patch:Partial<Print3dSetup>) => value && onChange({ ...value, ...patch });
  const addCost = (fixed = false) => {
    if (!value) return;
    const id = crypto.randomUUID();
    change({supplies:[...value.supplies,{id,quantity:1,custom:{id,name:fixed ? 'Custo fixo' : '',unitLabel:fixed ? 'lote' : 'un',unitCostCents:0}}]});
  };
  const changePlate = (index:number, patch:Partial<Print3dSetup['plates'][number]>) => value && change({ plates:value.plates.map((p, i) => i === index ? { ...p, ...patch } : p) });
  let totals:ReturnType<typeof print3dSetupParameters> | undefined;
  let costError = '';
  if (value) { try { totals = print3dSetupParameters(value); } catch (e) { costError = e instanceof Error ? e.message : 'Preencha os custos.'; } }
  const energyMissing = Boolean(totals && totals.printMinutes > 0 && value && (value.settings.energyCentsPerKwh <= 0 || value.settings.printerWatts <= 0));
  const numeric = (label:string, number:number, update:(n:number)=>void, step = 'any') => <label className="block text-sm text-slate-700">{label}<input className={inputClass} type="number" min="0" step={step} value={number || ''} onChange={e => update(Number(e.target.value))} /></label>;
  return <fieldset disabled={disabled || busy} className="space-y-4 rounded-xl border border-violet-200 bg-white p-4 disabled:opacity-60">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h4 className="font-bold text-slate-900">{view === 'files' ? 'Arquivos e URL de origem' : 'Lote e placas de impressão'}</h4>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(value)} onChange={e => e.target.checked ? void enable() : onChange(undefined)} />{template ? 'Preparar base para copiar nas variações' : value ? 'Salvar uma nova revisão com o produto' : 'Cadastrar arquivos e parâmetros de impressão (opcional)'}</label>
    </div>
    {isLocalCatalogPreviewRuntime() && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No localhost, a ficha e os arquivos ficam somente no rascunho local. O envio privado ao Synology acontece após Aprovar para produção.</p>}
    {loadError && <p role="alert" className="text-sm text-amber-800">Não foi possível consultar as revisões: {loadError}</p>}
    {revisions.length > 0 && <label className="block text-sm">Copiar uma revisão existente para editar (a original não muda)<select className={inputClass} value="" onChange={e => e.target.value && void load(e.target.value)}><option value="">Escolha uma revisão</option>{revisions.map(r => <option key={r.revision} value={r.revision}>{r.revision}</option>)}</select></label>}
    {revisions.filter(r => r.preview).map(r => <div key={r.revision} className="flex flex-wrap justify-between gap-2 text-xs"><span>Revisão local pendente: {r.revision}</span><button type="button" className="text-red-700 underline" onClick={async () => {
      if (!productId || !window.confirm('Descartar esta revisão local pendente? A produção não muda; uma cópia local e os arquivos serão preservados para recuperação.')) return;
      setBusy(true);
      try { await print3dRecipesService.discardLocalDraft(productId, r.revision); setRevisions(current => current.filter(item => item.revision !== r.revision)); toast.success('Revisão local descartada. Produção intacta.'); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'Falha ao descartar revisão.'); }
      finally { setBusy(false); }
    }}>Descartar rascunho desta revisão</button></div>)}
    {value && <>
      {value.settings.filaments.filter(f => f.active !== false).length === 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Ainda não há filamentos ativos com custo por kg cadastrados. <a href="/admin/loja-3d/filamentos" target="_blank" rel="noreferrer" className="font-semibold underline">Cadastrar filamentos, marcas e cores</a>. Você pode preencher as placas agora; o cálculo precisa desses custos.</p>}
      <div className={view === 'files' ? 'hidden' : 'space-y-4'}>
      {filamentLoadError && <p role="alert" className="text-sm text-amber-800">{filamentLoadError}</p>}
      <p className="text-xs text-slate-500">Novos filamentos são incluídos na lista automaticamente. Os custos e consumos já preenchidos na ficha são preservados.</p>
      <button type="button" className="text-sm text-blue-700 underline" onClick={async () => {
        setBusy(true);
        try { change({ settings:await print3dCostSettingsService.get() }); }
        catch (error) { toast.error(error instanceof Error ? error.message : 'Erro ao atualizar custos.'); }
        finally { setBusy(false); }
      }}>Atualizar filamentos, insumos e tarifas cadastrados</button>
      <p className="text-sm text-slate-600">Exemplo: 3 placas completam 10 chaveiros. Informe <strong>10 produtos completos no lote</strong>, não a soma das partes de cada placa. Os tempos e consumos são somados.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {numeric('Produtos completos por lote', value.pieces, pieces => change({ pieces }), '1')}
        <label className="text-sm">Revisão<input className={inputClass} value={value.revision} onChange={e => change({ revision:e.target.value })} maxLength={80} /></label>
        <PrintDurationInput label="Mão de obra do lote (HH:MM)" minutes={value.laborMinutes} onChange={laborMinutes => change({ laborMinutes })} />
        <label className="text-sm">Impressora<input className={inputClass} list={printerOptionsId} value={value.printer} onChange={e => change({ printer:e.target.value })} placeholder="Selecione ou digite a impressora" maxLength={120} /><datalist id={printerOptionsId}>{PRINT3D_PRINTER_OPTIONS.map(printer => <option key={printer} value={printer} />)}</datalist><span className="mt-1 block text-xs text-slate-500">Escolha uma opção ou digite outro modelo.</span></label>
        <label className="text-sm">Perfil de impressão<input className={inputClass} value={value.profile} onChange={e => change({ profile:e.target.value })} placeholder="Ex.: A1, bico 0,4 mm, camada 0,2 mm" maxLength={120} /></label>
      </div>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={value.includesWaste} onChange={e => change({ includesWaste:e.target.checked })} />O consumo informado inclui suportes e purga</label>
      </div>
      {view !== 'parameters' && <label className="block text-sm">Link de origem (opcional)<input type="url" className={inputClass} value={value.sourceUrl} onChange={e => change({ sourceUrl:e.target.value })} placeholder="https://makerworld.com/..." /></label>}
      {value.plates.map((plate, index) => <section key={plate.id} className="space-y-3 rounded-lg border border-violet-200 bg-violet-50 p-4">
        <div className="flex items-center justify-between gap-3"><h5 className="font-semibold">Placa {index + 1}</h5><button type="button" className="text-sm text-red-600 disabled:opacity-50" disabled={value.plates.length === 1} onClick={() => change({ plates:value.plates.filter((_, i) => i !== index) })}>Remover placa</button></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Identificação / partes<input className={inputClass} value={plate.name} onChange={e => changePlate(index, { name:e.target.value })} placeholder={`Placa ${index + 1} — corpos / argolas`} maxLength={120} /></label>
          {view !== 'files' && <PrintDurationInput label={`Tempo da placa ${index + 1} (HH:MM)`} minutes={plate.hours * 60 + plate.minutes} onChange={total => changePlate(index, { hours:Math.floor(total / 60), minutes:total % 60 })} />}
        </div>
        <div className={view === 'files' ? 'hidden' : 'space-y-3'}>
        {plate.filaments.map((line, lineIndex) => <div key={lineIndex} className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
          {(() => {
            const activeFilaments = value.settings.filaments.filter(f => f.active !== false);
            const labelFor = (f:typeof activeFilaments[number]) => `${f.name} — ${f.color} (${money(f.costPerKgCents ?? Math.round(f.spoolCostCents * 1000 / f.spoolGrams))} / kg)`;
            const choices = activeFilaments.map((f,n) => ({filament:f,label:labelFor(f)+(activeFilaments.filter(other => labelFor(other) === labelFor(f)).length > 1 ? ` · opção ${n+1}` : '')}));
            const selectId = `${printerOptionsId}-filament-${plate.id}-${lineIndex}`;
            return <div className="text-sm"><label htmlFor={selectId}>Filamento / cor</label><SearchableSelect id={selectId} value={choices.find(c => c.filament.id === line.id)?.label || ''} options={choices.map(c => c.label)} placeholder="Selecione ou busque o filamento" disabled={disabled || busy} className={inputClass} onChange={label => changePlate(index, { filaments:plate.filaments.map((f,i) => i === lineIndex ? {...f,id:choices.find(c => c.label === label)?.filament.id || ''} : f) })} renderLeading={label => {
              const f = choices.find(c => c.label === label)?.filament;
              const style = f && filamentColorStyle(f.color,f.colorNames,(name:string) => colorHexes[name] || getColorHex(name));
              return style ? <span title={f!.color} aria-label={`Amostra da cor ${f!.color}`} className="inline-block h-5 w-5 shrink-0 rounded-full border border-slate-300" style={style} /> : null;
            }} /></div>;
          })()}
          {numeric(`Consumo da placa ${index + 1} (g)`, line.grams, grams => changePlate(index, { filaments:plate.filaments.map((f, i) => i === lineIndex ? { ...f, grams } : f) }))}
          <button type="button" className="px-2 py-2 text-sm text-red-600" disabled={plate.filaments.length === 1} onClick={() => changePlate(index, { filaments:plate.filaments.filter((_, i) => i !== lineIndex) })}>Remover</button>
        </div>)}
        <button type="button" className="text-sm text-blue-700" onClick={() => changePlate(index, { filaments:[...plate.filaments, { id:'', grams:0 }] })}>+ Outro filamento nesta placa</button>
        </div>
        <div className={view === 'parameters' ? 'hidden' : 'space-y-3'}>
        <label className="block text-sm">Arquivos privados da placa {index + 1} (até 50 MB cada)<input type="file" multiple accept=".stl,.obj,.step,.stp,.3mf,.f3d,.gcode,.gco,.json,.txt,.pdf,.png,.jpg,.jpeg,.webp" className="mt-1 block w-full text-sm" onChange={e => {
          try {
            const added = Array.from(e.target.files || []).map(file => {
              if (!file.size || file.size > 50 * 1024 * 1024) throw new Error('Arquivo vazio ou maior que 50 MB.');
              return { file, kind:print3dFileKind(file.name) };
            });
            changePlate(index, { files:[...plate.files, ...added] });
          } catch (error) { toast.error(error instanceof Error ? error.message : 'Arquivo inválido.'); }
          e.target.value = '';
        }} /></label>
        {plate.files.map((entry, i) => <div className="flex justify-between gap-2 text-sm" key={i}><span>{entry.file?.name || entry.existing?.original_name} — {entry.kind}</span><button type="button" className="text-red-600" onClick={() => changePlate(index, { files:plate.files.filter((_, n) => n !== i) })}>Remover arquivo</button></div>)}
        </div>
        <label className="block text-sm">Instruções desta placa<textarea className={inputClass} rows={2} value={plate.notes} maxLength={1000} onChange={e => changePlate(index, { notes:e.target.value })} placeholder="Partes impressas, orientação, montagem..." /></label>
      </section>)}
      <button type="button" className="rounded-lg border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-800" disabled={value.plates.length >= 50} onClick={() => change({ plates:[...value.plates, newPrint3dPlate()] })}>+ Adicionar placa ({value.plates.length} no lote)</button>
      <section className={view === 'files' ? 'hidden' : 'space-y-3 rounded-lg border border-slate-200 p-4'}>
        <h4 className="font-semibold">Energia elétrica</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <CurrencyInput label="Valor da energia (R$/kWh)" value={value.settings.energyCentsPerKwh} onChange={energyCentsPerKwh => change({settings:{...value.settings,energyCentsPerKwh}})} disabled={disabled || busy} />
          {numeric('Potência da impressora (W)',value.settings.printerWatts,printerWatts => change({settings:{...value.settings,printerWatts}}))}
        </div>
        <p className="text-sm text-slate-600">Informe a tarifa por kWh e a potência usada para estimar o consumo. O custo da energia é calculado com o tempo total das placas e dividido entre os produtos completos do lote.</p>
        {value.printer === DEFAULT_PRINT3D_PRINTER && <div className="space-y-1 text-xs text-slate-500">
          <p>Referência da Bambu Lab A1: {BAMBU_A1_AVERAGE_WATTS} W de média em PLA, a 220 V. Ajuste conforme o consumo medido para o material e o perfil utilizados. <a href="https://wiki.bambulab.com/en/a1/manual/faq" target="_blank" rel="noreferrer" className="text-blue-700 underline">Fonte: Bambu Lab</a></p>
          <button type="button" className="font-medium text-blue-700 underline" onClick={() => change({settings:{...value.settings,printerWatts:BAMBU_A1_AVERAGE_WATTS}})}>Usar referência da A1 ({BAMBU_A1_AVERAGE_WATTS} W)</button>
        </div>}
        {totals && <p className="text-sm font-semibold text-slate-800">Energia neste lote: {money(totals.cost.energyCents)}</p>}
      </section>
      <section className={view === 'files' ? 'hidden' : 'space-y-3 rounded-lg border border-slate-200 p-4'}>
        <h4 className="font-semibold">Custos fixos e imposto</h4>
        <label className="block max-w-sm text-sm">Imposto estimado sobre a venda (%)<input className={inputClass} type="number" min="0" max="99.99" step="0.01" value={value.settings.taxPercent ?? 0} onChange={e => change({settings:{...value.settings,taxPercent:Number(e.target.value)}})} /></label>
        <p className="text-sm text-slate-600">Informe o percentual que deseja considerar. O imposto entra no mínimo para cobrir custo e imposto, apresentado no resumo. O preço de venda continua sendo informado na aba Preços.</p>
        <p className="text-sm text-slate-600">Para despesas em reais, adicione um custo fixo ao lote, como uma parcela de aluguel ou manutenção. O valor será dividido pela quantidade de produtos completos. Use somente o valor destinado a este lote.</p>
        <button type="button" disabled={value.supplies.length >= 500} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700" onClick={() => addCost(true)}>+ Adicionar custo fixo ao lote</button>
      </section>
      <section className={view === 'files' ? 'hidden' : 'space-y-3 rounded-lg border border-slate-200 p-4'}>
        <h4 className="font-semibold">Insumos e outros custos do lote</h4>
        <p className="text-sm text-slate-600">Adicione argolas, embalagens, cola ou serviços. Informe a quantidade total usada no lote e o custo por unidade. Os valores desta ficha não alteram o cadastro geral.</p>
        {value.supplies.map((line,index) => {
          const supply = line.custom || value.settings.supplies.find(s => s.id === line.id);
          const edit = (patch:Partial<NonNullable<typeof line.custom>>) => change({supplies:value.supplies.map((s,i) => i === index ? {...s,custom:{id:line.id,name:supply?.name || '',unitLabel:supply?.unitLabel || 'un',unitCostCents:supply?.unitCostCents || 0,...patch}} : s)});
          return <div key={line.id || index} className="space-y-3 rounded-lg bg-slate-50 p-3">
            <label className="block text-sm">Usar insumo cadastrado<select className={inputClass} value={line.custom ? '' : line.id} onChange={e => {
              if (!e.target.value) { const id = crypto.randomUUID(); change({supplies:value.supplies.map((s,i) => i === index ? {id,quantity:s.quantity,custom:{id,name:'',unitLabel:'un',unitCostCents:0}} : s)}); }
              else change({supplies:value.supplies.map((s,i) => i === index ? {id:e.target.value,quantity:s.quantity} : s)});
            }}><option value="">Preencher neste lote</option>{value.settings.supplies.filter(s => !value.supplies.some((other,i) => i !== index && other.id === s.id)).map(s => <option key={s.id} value={s.id}>{s.name} — {money(s.unitCostCents)} / {s.unitLabel || 'un'}</option>)}</select></label>
            <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_5rem_1fr_1fr_auto]">
              <label className="text-sm">Nome do insumo ou custo<input className={inputClass} value={supply?.name || ''} maxLength={120} placeholder="Ex.: argola para chaveiro" onChange={e => edit({name:e.target.value})} /></label>
              <label className="text-sm">Unidade<input className={inputClass} value={supply?.unitLabel ?? 'un'} maxLength={40} placeholder="un, g, ml" onChange={e => edit({unitLabel:e.target.value})} /></label>
              {numeric(`Quantidade do insumo ${index+1} no lote`,line.quantity,quantity => change({supplies:value.supplies.map((s,i) => i === index ? {...s,quantity} : s)}))}
              <CurrencyInput label="Custo por unidade" value={supply?.unitCostCents || 0} onChange={unitCostCents => edit({unitCostCents})} disabled={disabled || busy} />
              <button type="button" className="py-2 text-sm text-red-600" onClick={() => change({supplies:value.supplies.filter((_,i) => i !== index)})}>Remover insumo</button>
            </div>
            <p className="text-sm text-slate-600">Total deste item no lote: {money(Math.round(line.quantity * (supply?.unitCostCents || 0)))}</p>
          </div>;
        })}
        <button type="button" disabled={value.supplies.length >= 500} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700" onClick={() => addCost()}>+ Adicionar insumo ou custo</button>
      </section>
      <details className={view === 'files' ? 'hidden' : 'rounded-lg border p-3'}><summary className="cursor-pointer text-sm font-semibold">Tarifas e insumos usados nesta revisão</summary>
        <p className="my-2 text-xs text-slate-600">Copiados do cadastro de custos. O custo por produto alimenta o cadastro. O preço de venda é informado na aba Preços; as tarifas gerais permanecem no cadastro de custos.</p>
        <div className="grid gap-3 sm:grid-cols-3">{(['machineCentsPerHour', 'laborCentsPerHour', 'packagingCentsPerPiece'] as const).map((key, i) => <CurrencyInput key={key} label={['Máquina (R$/h)', 'Mão de obra (R$/h)', 'Embalagem por peça (R$)'][i]} value={value.settings[key]} onChange={n => change({ settings:{ ...value.settings, [key]:n } })} disabled={disabled} />)}</div>
        <a className="ml-4 text-sm text-blue-700 underline" href="/admin/loja-3d/filamentos" target="_blank" rel="noreferrer">Cadastrar filamentos</a>
        <a className="ml-4 text-sm text-blue-700 underline" href="/admin/loja-3d/calculadora" target="_blank" rel="noreferrer">Tarifas e outros insumos</a>
      </details>
      <label className="block text-sm">Instruções gerais / montagem<textarea className={inputClass} rows={2} maxLength={1000} value={value.notes} onChange={e => change({ notes:e.target.value })} /></label>
      {totals && view !== 'files' && <section aria-label="Resumo do custo" className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
        <label htmlFor={finalCostId} className="block text-sm font-semibold">Custo final por unidade</label>
        <output id={finalCostId} aria-live="polite" className="block rounded-lg border border-emerald-200 bg-white px-4 py-3 text-3xl font-bold">{energyMissing ? 'Aguardando energia' : money(totals.cost.minimumUnitSaleCents)}</output>
        {energyMissing ? <p role="status" className="text-sm font-medium text-amber-900">Preencha {value.settings.energyCentsPerKwh <= 0 ? 'o valor da energia (R$/kWh)' : 'a potência da impressora (W)'} para incluir a energia e apresentar o custo final.</p> : <p className="text-sm">Inclui filamento, energia, máquina, mão de obra, insumos, custos fixos e imposto informado ({totals.cost.taxPercent.toLocaleString('pt-BR')}%), divididos entre {value.pieces} produtos completos.</p>}
        <p className="text-xs">Calculado automaticamente com os valores informados, sem margem de lucro. O preço de venda é definido na aba Preços.</p>
        <details className="rounded-lg border border-emerald-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Detalhamento do cálculo</summary>
          <div className="mt-3 space-y-2">
            <p>{value.plates.length} placa(s) · {value.pieces} produtos completos · {totals.materialGrams.toLocaleString('pt-BR')} g · {totals.printMinutes.toLocaleString('pt-BR')} min</p>
            <p>Filamento: {money(totals.cost.filamentCents)} · Energia: {money(totals.cost.energyCents)} · Máquina: {money(totals.cost.machineCents)} · Mão de obra: {money(totals.cost.laborCents)} · Insumos e custos fixos: {money(totals.cost.suppliesCents)}</p>
            <p>Custo de produção do lote: {money(totals.cost.batchCents)}</p>
            <p>Imposto estimado ({totals.cost.taxPercent.toLocaleString('pt-BR')}%): {money(totals.cost.estimatedTaxCents)} no lote</p>
            <p>Total do lote com imposto{energyMissing ? ', ainda sem energia' : ''}: {money(totals.cost.minimumBatchSaleCents)}</p>
            <p className="text-xs text-slate-600">O imposto é estimado sobre o mínimo necessário para cobrir os custos, sem lucro. O custo por unidade é arredondado para cima em centavos.</p>
          </div>
        </details>
      </section>}
      {costError && <p className="text-sm text-amber-800">{costError}</p>}
      <p className="text-xs text-slate-600">{template ? 'Esta base fica privada no pai para cópia explícita. Cada variação recebe sua própria ficha; editar a base não atualiza cópias anteriores.' : 'Salvar cria uma revisão privada imutável. Para utilizá-la em novas produções, confira os arquivos e selecione a revisão na ficha de produção. Cada placa precisa de um arquivo imprimível; ordens antigas mantêm sua revisão.'}</p>
    </>}
  </fieldset>;
}
