import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CurrencyInput } from '../ui/CurrencyInput';
import { print3dCostSettingsService } from '../../services/print3dCostSettings';
import { print3dRecipesService } from '../../services/print3dRecipes';
import { print3dRecipeFilesService } from '../../services/print3dRecipeFiles';
import { newPrint3dPlate, newPrint3dSetup, print3dFileKind, print3dSetupParameters, type Print3dSetup } from '../../services/print3dRegistration';
import { isLocalCatalogPreviewRuntime } from '../../services/localCatalogPreview';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const money = (cents:number) => (cents / 100).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
export function Print3dRegistrationEditor({ value, onChange, productId, disabled = false, view = 'all', template = false }: {
  value?:Print3dSetup; onChange:(value:Print3dSetup | undefined) => void; productId?:string; disabled?:boolean;
  view?:'all' | 'files' | 'parameters'; template?:boolean;
}) {
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
  const changePlate = (index:number, patch:Partial<Print3dSetup['plates'][number]>) => value && change({ plates:value.plates.map((p, i) => i === index ? { ...p, ...patch } : p) });
  let totals:ReturnType<typeof print3dSetupParameters> | undefined;
  let costError = '';
  if (value) { try { totals = print3dSetupParameters(value); } catch (e) { costError = e instanceof Error ? e.message : 'Preencha os custos.'; } }
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
        {numeric('Mão de obra do lote (min)', value.laborMinutes, laborMinutes => change({ laborMinutes }))}
        <label className="text-sm">Impressora<input className={inputClass} value={value.printer} onChange={e => change({ printer:e.target.value })} placeholder="Ex.: Bambu Lab A1" maxLength={120} /></label>
        <label className="text-sm">Perfil de impressão<input className={inputClass} value={value.profile} onChange={e => change({ profile:e.target.value })} placeholder="Ex.: A1, bico 0,4 mm, camada 0,2 mm" maxLength={120} /></label>
      </div>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={value.includesWaste} onChange={e => change({ includesWaste:e.target.checked })} />O consumo informado inclui suportes e purga</label>
      </div>
      {view !== 'parameters' && <label className="block text-sm">Link de origem (opcional)<input type="url" className={inputClass} value={value.sourceUrl} onChange={e => change({ sourceUrl:e.target.value })} placeholder="https://makerworld.com/..." /></label>}
      {value.plates.map((plate, index) => <section key={plate.id} className="space-y-3 rounded-lg border border-violet-200 bg-violet-50 p-4">
        <div className="flex items-center justify-between gap-3"><h5 className="font-semibold">Placa {index + 1}</h5><button type="button" className="text-sm text-red-600 disabled:opacity-50" disabled={value.plates.length === 1} onClick={() => change({ plates:value.plates.filter((_, i) => i !== index) })}>Remover placa</button></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Identificação / partes<input className={inputClass} value={plate.name} onChange={e => changePlate(index, { name:e.target.value })} placeholder={`Placa ${index + 1} — corpos / argolas`} maxLength={120} /></label>
          {view !== 'files' && numeric(`Placa ${index + 1}: horas`, plate.hours, hours => changePlate(index, { hours }), '1')}
          {view !== 'files' && numeric(`Placa ${index + 1}: minutos`, plate.minutes, minutes => changePlate(index, { minutes }))}
        </div>
        <div className={view === 'files' ? 'hidden' : 'space-y-3'}>
        {plate.filaments.map((line, lineIndex) => <div key={lineIndex} className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <label className="text-sm">Filamento / cor<select className={inputClass} value={line.id} onChange={e => changePlate(index, { filaments:plate.filaments.map((f, i) => i === lineIndex ? { ...f, id:e.target.value } : f) })}><option value="">Selecione o filamento</option>{value.settings.filaments.filter(f => f.active !== false).map(f => <option key={f.id} value={f.id}>{f.name} — {f.color} ({money(f.costPerKgCents ?? Math.round(f.spoolCostCents * 1000 / f.spoolGrams))} / kg)</option>)}</select></label>
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
      <details className={view === 'files' ? 'hidden' : 'rounded-lg border p-3'}><summary className="cursor-pointer text-sm font-semibold">Tarifas e insumos usados nesta revisão</summary>
        <p className="my-2 text-xs text-slate-600">Copiados do cadastro de custos. O custo por produto alimenta o cadastro. O preço de venda é informado na aba Preços; as tarifas gerais permanecem no cadastro de custos.</p>
        <div className="grid gap-3 sm:grid-cols-3">{numeric('Potência (W)', value.settings.printerWatts, n => change({ settings:{ ...value.settings, printerWatts:n } }))}{(['energyCentsPerKwh', 'machineCentsPerHour', 'laborCentsPerHour', 'packagingCentsPerPiece'] as const).map((key, i) => <CurrencyInput key={key} label={['Energia (R$/kWh)', 'Máquina (R$/h)', 'Mão de obra (R$/h)', 'Embalagem por peça (R$)'][i]} value={value.settings[key]} onChange={n => change({ settings:{ ...value.settings, [key]:n } })} disabled={disabled} />)}</div>
        {value.supplies.map((line, index) => <div key={index} className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_auto]"><label className="text-sm">Insumo<select className={inputClass} value={line.id} onChange={e => change({ supplies:value.supplies.map((s, i) => i === index ? { ...s, id:e.target.value } : s) })}><option value="">Selecione</option>{value.settings.supplies.map(s => <option value={s.id} key={s.id}>{s.name} — {money(s.unitCostCents)}</option>)}</select></label>{numeric('Quantidade no lote', line.quantity, quantity => change({ supplies:value.supplies.map((s, i) => i === index ? { ...s, quantity } : s) }))}<button type="button" className="text-red-600 text-sm" onClick={() => change({ supplies:value.supplies.filter((_, i) => i !== index) })}>Remover</button></div>)}
        <button type="button" className="mt-3 text-sm text-blue-700" onClick={() => change({ supplies:[...value.supplies, { id:'', quantity:1 }] })}>+ Insumo / montagem</button>
        <a className="ml-4 text-sm text-blue-700 underline" href="/admin/loja-3d/filamentos" target="_blank" rel="noreferrer">Cadastrar filamentos</a>
        <a className="ml-4 text-sm text-blue-700 underline" href="/admin/loja-3d/calculadora" target="_blank" rel="noreferrer">Tarifas e outros insumos</a>
      </details>
      <label className="block text-sm">Instruções gerais / montagem<textarea className={inputClass} rows={2} maxLength={1000} value={value.notes} onChange={e => change({ notes:e.target.value })} /></label>
      {totals && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950"><p>{value.plates.length} placa(s) → {value.pieces} produto(s) completos · {totals.materialGrams.toLocaleString('pt-BR')} g · {totals.printMinutes.toLocaleString('pt-BR')} min</p><p className="mt-1 font-bold">Custo do lote: {money(totals.cost.batchCents)} · Por produto: {money(totals.cost.unitCents)}</p><p className="mt-1 text-xs">Filamento {money(totals.cost.filamentCents)} · Energia {money(totals.cost.energyCents)} · Máquina {money(totals.cost.machineCents)} · Mão de obra {money(totals.cost.laborCents)} · Insumos {money(totals.cost.suppliesCents)}</p></div>}
      {costError && <p className="text-sm text-amber-800">{costError}</p>}
      <p className="text-xs text-slate-600">{template ? 'Esta base fica privada no pai para cópia explícita. Cada variação recebe sua própria ficha; editar a base não atualiza cópias anteriores.' : 'Salvar cria uma revisão privada imutável. Para utilizá-la em novas produções, confira os arquivos e selecione a revisão na ficha de produção. Cada placa precisa de um arquivo imprimível; ordens antigas mantêm sua revisão.'}</p>
    </>}
  </fieldset>;
}
