import { useEffect, useState } from 'react';
import { CurrencyInput } from '../ui/CurrencyInput';
import { SearchableSelect } from '../ui/SearchableSelect';
import { MaterialSelect } from '../products/selectors/MaterialSelect';
import { print3dFilamentsService, type FilamentCatalog as Catalog, type FilamentStock, type FilamentStockInput } from '../../services/print3dFilaments';
import type { Print3dFilament } from '../../services/print3dCostSettings';
import { FILAMENT_PURCHASE_CHANNELS, filamentPurchaseNote } from '../../utils/print3dPurchaseChannel.mjs';
import { getColorHex } from '../../services/colors';
import { groupFilamentStock, filamentEntryDate, filamentColorStyle } from '../../utils/print3dFilamentInventory.mjs';
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const money = (cents:number) => (cents / 100).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const grams = (value:number) => `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits:3 })} g (${(Number(value) / 1000).toLocaleString('pt-BR', { maximumFractionDigits:6 })} kg)`;
const perKg = (f:Print3dFilament) => f.costPerKgCents ?? Math.round(f.spoolCostCents * 1000 / f.spoolGrams);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const entryDateLabel = (value:string) => value ? value.split('-').reverse().join('/') : 'Data não disponível';
function QuantityKgInput({ id, label, value, onChange, min = 0 }: { id:string; label:string; value:string | number; onChange:(value:string)=>void; min?:number }) {
  const quantity = Number(value) || 0;
  const buttonClass = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-40';
  const changeBy = (delta:number) => onChange(String(Math.max(min, Math.round((quantity + delta) * 1000000) / 1000000)));
  return <div className="space-y-1">
    <label htmlFor={id} className="text-sm">{label}</label>
    <div className="flex w-44 max-w-full items-center gap-1.5">
      <button type="button" aria-label={`Diminuir ${label}`} title="Diminuir 1 kg" className={buttonClass} disabled={quantity <= min} onClick={() => changeBy(-1)}>−</button>
      <input id={id} className={`${inputClass} h-10 min-w-0 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} type="number" min={min} step="1" value={value} onChange={e => onChange(e.target.value)} placeholder="0" />
      <button type="button" aria-label={`Aumentar ${label}`} title="Aumentar 1 kg" className={buttonClass} onClick={() => changeBy(1)}>+</button>
    </div>
  </div>;
}
export function FilamentCatalog({ onSaved = () => undefined, refresh = 0 }: { onSaved?:(items:Print3dFilament[])=>void; refresh?:number }) {
  const [catalog, setCatalog] = useState<Catalog>();
  const [stock, setStock] = useState<FilamentStock>();
  const [editing, setEditing] = useState<Print3dFilament>();
  const [movement, setMovement] = useState<FilamentStockInput>();
  const [purchaseChannel, setPurchaseChannel] = useState('');
  const [otherPurchaseChannel, setOtherPurchaseChannel] = useState('');
  const [entryKg, setEntryKg] = useState('');
  const [entryKey, setEntryKey] = useState(() => crypto.randomUUID());
  const [entryNote, setEntryNote] = useState('');
  const [entryDate, setEntryDate] = useState(today);
  const [movementDate, setMovementDate] = useState(today);
  const [movementAction, setMovementAction] = useState<'receipt'|'used'|'deactivate'>('receipt');
  const [filter, setFilter] = useState('');
  const [historyId, setHistoryId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async (notify = false) => {
    const next = await print3dFilamentsService.list();
    setCatalog(next);
    if (notify) onSaved(next.filaments);
    try { const nextStock = await print3dFilamentsService.stock(); setStock(nextStock); return nextStock; }
    catch (e) { setStock(undefined); throw e; }
  };
  useEffect(() => { let alive = true; print3dFilamentsService.list().then(data => { if (alive) setCatalog(data); }).catch(e => { if (alive) setError(e.message); });
    print3dFilamentsService.stock().then(data => { if (alive) setStock(data); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; }; }, [refresh]);
  useEffect(() => { if (catalog && window.location.hash === '#filamentos') document.getElementById('filamentos')?.scrollIntoView({ block:'start' }); }, [Boolean(catalog)]);
  const run = async (work:()=>Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao acessar filamentos.'); }
    finally { setBusy(false); }
  };
  const existing = editing && catalog?.filaments.find(f => f.id === editing.id);
  const balance = (id:string) => stock?.balances.find(b => b.filament_id === id)?.quantity_grams || 0;
  const knownBalance = (id:string) => Boolean(stock?.enabled && !stock.unknown_ids?.includes(id));
  const openReceipt = (id:string, currentStock = stock) => {
    if (!currentStock?.enabled || currentStock.unknown_ids?.includes(id)) { setError('Consulte o saldo antes de adicionar estoque. Saldo indisponível não é zero.'); return; }
    setPurchaseChannel(''); setOtherPurchaseChannel('');
    setMovementAction('receipt'); setMovementDate(today());
    setMovement({ filament_id:id, quantity_grams:1000, expected_grams:currentStock.balances.find(b => b.filament_id === id)?.quantity_grams || 0, idempotency_key:crypto.randomUUID(), reason:'receipt', note:'' });
  };
  const filtered = catalog?.filaments.filter(f => `${f.brand || ''} ${f.material || ''} ${f.color} ${f.name}`.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR'))) || [];
  const grouped = groupFilamentStock(filtered, stock);
  const colorPreview = (name:string, colors?:string[]) => {
    const style = filamentColorStyle(name, colors, (color:string) => catalog?.references.color_hex?.[color] || getColorHex(color));
    return style ? <span aria-label={`Amostra da cor ${name}`} title={name} className="inline-block h-5 w-5 shrink-0 rounded-full border border-slate-300 align-middle" style={style} /> : null;
  };
  const setGradientColors = (colors:string[]) => { if (editing) setEditing({ ...editing, colorNames:colors, color:`Degradê: ${colors.filter(Boolean).join(' / ')}` }); };
  return <section id="filamentos" className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Cadastro e estoque de filamentos</h3><p className="text-sm text-slate-600">Uma combinação de marca + material + cor. Custo por kg; saldo físico em gramas.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className="rounded-lg border bg-white px-3 py-2 text-sm" onClick={() => void run(() => load(true))}>Atualizar cadastro e saldo</button>
        <button type="button" disabled={busy || !catalog} className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => { setEditing({ id:crypto.randomUUID(), name:'', brand:'', material:'', color:'', spoolGrams:1000, spoolCostCents:0, costPerKgCents:0, active:true }); setMovement(undefined); setEntryKg(''); setEntryKey(crypto.randomUUID()); setEntryNote(''); setEntryDate(today()); setPurchaseChannel(''); setOtherPurchaseChannel(''); setError(''); }}>Novo filamento</button></div>
    </div>
    {catalog?.preview && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Rascunho local: cadastrar, alterar custos e movimentar aqui não altera a produção. Marcas, materiais e cores usam os cadastros compartilhados do sistema; seus atalhos abrem esses cadastros centrais.
      <button type="button" disabled={busy || !catalog.pending} className="ml-3 font-semibold underline disabled:opacity-50" onClick={() => {
        if (window.confirm('Enviar os filamentos, tarifas pendentes e movimentos de estoque locais para a API central? A publicação compatível e a migração de estoque são verificadas antes do envio.')) void run(async () => { await print3dFilamentsService.approve(); await load(true); setNotice('Rascunhos aprovados na API central.'); });
      }}>Aprovar rascunhos de filamentos e custos</button>
    </div>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
    {editing && catalog && <fieldset disabled={busy} className="space-y-3 rounded-lg border bg-white p-4">
      <h4 className="font-semibold">{existing ? 'Editar filamento' : 'Novo filamento'}</h4>
      {existing && <p className="text-xs text-slate-600">Identidade e cor preservadas para não misturar receitas e saldos. Nos cadastros antigos, selecione marca e material uma vez, sem adivinhar a partir do nome.</p>}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1"><label className="text-sm" htmlFor="filament-brand">Marca</label><SearchableSelect key={editing.id} id="filament-brand" className={inputClass} disabled={Boolean(existing?.brand)} value={editing.brand || ''} options={catalog.references.brands} placeholder="Digite para buscar uma marca..." onChange={brand => setEditing({ ...editing, brand })} />
          <div className="flex gap-3 text-xs"><a href="/admin/settings/brands" target="_blank" rel="noreferrer" className="text-blue-700 underline">Cadastrar/gerenciar marcas</a><button type="button" onClick={() => void run(() => load())} className="text-blue-700 underline">Atualizar marcas</button></div></div>
        {existing?.material ? <label className="text-sm">Material<input className={inputClass} value={editing.material || ''} readOnly /></label> : <MaterialSelect value={editing.material || ''} onChange={material => setEditing({ ...editing, material })} />}
        <label className="block text-sm">Tipo de cor<select className={inputClass} disabled={Boolean(existing)} value={editing.colorMode || 'single'} onChange={event => setEditing({ ...editing, colorMode:event.target.value as 'single'|'gradient', color:'', colorNames:event.target.value === 'gradient' ? ['',''] : undefined })}><option value="single">Uma cor</option><option value="gradient">Degradê / troca de cor (2 ou 3 cores)</option></select></label>
      </div>
      <div className="space-y-2">
          {editing.colorMode === 'gradient' ? <div data-testid="filament-gradient-colors" className="grid items-end gap-3 md:grid-cols-3">
            {(editing.colorNames || ['','']).map((color,index) => <div key={index} className="flex items-end gap-2"><div className="min-w-0 flex-1 text-sm"><label htmlFor={`filament-color-${index}`}>Cor {index + 1}</label><SearchableSelect id={`filament-color-${index}`} className={inputClass} disabled={Boolean(existing)} value={color} options={catalog.references.colors.filter(name => name === color || !editing.colorNames?.includes(name))} renderLeading={name => colorPreview(name)} placeholder="Selecione ou busque uma cor..." onChange={value => setGradientColors((editing.colorNames || ['','']).map((name,i) => i === index ? value : name))} /></div>{!existing && index === 2 && <button type="button" className="mb-1 rounded-lg border px-2 py-1 text-sm" aria-label="Remover terceira cor" onClick={() => setGradientColors((editing.colorNames || []).slice(0,2))}>Remover</button>}</div>)}
            {!existing && (editing.colorNames?.length || 2) < 3 && <button type="button" className="justify-self-start rounded-lg border px-3 py-2 text-sm text-blue-700" onClick={() => setGradientColors([...(editing.colorNames || ['','']),''])}>Adicionar terceira cor</button>}
          </div> : <div className="md:max-w-sm"><label className="text-sm" htmlFor="filament-color">Cor</label><SearchableSelect id="filament-color" className={inputClass} disabled={Boolean(existing)} value={editing.color} options={catalog.references.colors} renderLeading={name => colorPreview(name)} placeholder="Selecione ou busque uma cor..." onChange={color => setEditing({ ...editing, color })} /></div>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs"><span className="inline-flex items-center gap-2">{colorPreview(editing.color, editing.colorNames)}{editing.color && <span>{editing.color}</span>}</span><a href="/admin/settings/colors" target="_blank" rel="noreferrer" className="text-blue-700 underline">Cadastrar/gerenciar cores</a><button type="button" onClick={() => void run(() => load())} className="text-blue-700 underline">Atualizar cores</button></div>
          {editing.colorMode === 'gradient' && <p className="text-xs text-slate-600">Um único filamento com duas ou três cores. Custo e estoque pertencem à combinação completa.</p>}
      </div>
      <div className="grid gap-3 md:grid-cols-3"><CurrencyInput label="Custo por kg" value={editing.costPerKgCents || 0} onChange={costPerKgCents => setEditing({ ...editing, costPerKgCents, spoolCostCents:costPerKgCents })} />
        {existing ? <div className="self-center space-y-2 text-xs text-slate-600"><p>Saldo físico: {knownBalance(existing.id) ? grams(balance(existing.id)) : 'Indisponível (não é zero)'}</p><button type="button" disabled={!knownBalance(existing.id) || existing.active === false} className="rounded-lg border px-3 py-2 text-sm font-semibold text-violet-800 disabled:opacity-40" onClick={() => openReceipt(existing.id)}>Adicionar estoque em kg</button></div> : <div className="space-y-1"><QuantityKgInput id="filament-entry-kg" label="Quantidade desta entrada (kg)" value={entryKg} onChange={setEntryKg} /><p className="text-xs text-slate-600">Informe a quantidade comprada. Deixe vazio para cadastrar sem estoque.</p></div>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={Boolean(existing)} checked={editing.active !== false} onChange={e => setEditing({ ...editing, active:e.target.checked })} />Ativo para novas impressões</label></div>
      {!existing && <div className="grid gap-3 md:grid-cols-3"><label className="text-sm">Data de entrada<input className={inputClass} type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} /></label><label className="text-sm">Canal de compra (opcional)<select className={inputClass} value={purchaseChannel} onChange={e => setPurchaseChannel(e.target.value)}><option value="">Não informado</option>{FILAMENT_PURCHASE_CHANNELS.map(channel => <option key={channel}>{channel}</option>)}</select></label>{purchaseChannel === 'Outro' && <label className="text-sm">Outro canal de compra<input className={inputClass} maxLength={80} value={otherPurchaseChannel} onChange={e => setOtherPurchaseChannel(e.target.value)} placeholder="Nome do canal ou loja" /></label>}<label className="text-sm">Referência da entrada (opcional)<input className={inputClass} maxLength={500} value={entryNote} onChange={e => setEntryNote(e.target.value)} placeholder="Pedido, fornecedor…" /></label></div>}
      <div className="flex justify-end gap-2"><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setEditing(undefined)}>Cancelar filamento</button><button type="button" className="rounded-lg bg-violet-700 px-3 py-2 text-sm text-white" onClick={() => void run(async () => {
        if (!existing && (!Number.isFinite(Number(entryKg)) || Number(entryKg) < 0)) throw new Error('Informe uma quantidade positiva em kg.');
        const receipt:FilamentStockInput | undefined = !existing && Number(entryKg) > 0 ? { filament_id:editing.id, quantity_grams:Math.round(Number(entryKg) * 1000000) / 1000, expected_grams:0, idempotency_key:entryKey, reason:'receipt', entry_date:entryDate, note:filamentPurchaseNote({ reason:'receipt', note:entryNote.trim() || 'Entrada no cadastro do filamento' }, purchaseChannel, otherPurchaseChannel) } : undefined;
        const result = await print3dFilamentsService.save(editing, catalog.version, receipt);
        setCatalog({ ...catalog, ...result }); onSaved(result.filaments); setEditing(undefined);
        await load(true);
        setNotice(receipt ? (catalog.preview ? 'Filamento e entrada salvos juntos no rascunho local.' : 'Filamento e entrada salvos juntos.') : (catalog.preview ? 'Filamento salvo no rascunho local.' : 'Filamento salvo no banco.'));
      })}>{!existing && Number(entryKg) > 0 ? 'Salvar filamento e entrada' : 'Salvar filamento'}</button></div>
    </fieldset>}
    {movement && <fieldset disabled={busy} className="space-y-3 rounded-lg border bg-white p-4">
      <h4 className="font-semibold">Movimentar: {catalog?.filaments.find(f => f.id === movement.filament_id)?.name} · {catalog?.filaments.find(f => f.id === movement.filament_id)?.color}</h4>
      <p className="text-sm">Saldo disponível: {grams(movement.expected_grams)}</p>
      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_12rem_minmax(0,1fr)]">
        <label className="text-sm">Operação<select className={inputClass} value={movementAction} onChange={e => { const action = e.target.value as typeof movementAction; setMovementAction(action); setMovement({...movement,reason:action === 'receipt' ? 'receipt' : 'adjustment'}); }}><option value="receipt">Entrada / compra</option><option value="used">Usado</option><option value="deactivate">Desativar</option></select></label>
        {movementAction === 'deactivate' ? <div className="text-sm"><p>Quantidade a retirar</p><p className="font-semibold">{grams(movement.expected_grams)}</p></div> : <QuantityKgInput id="filament-movement-kg" label={movementAction === 'used' ? 'Quantidade usada (kg)' : 'Quantidade da entrada (kg)'} value={movement.quantity_grams / 1000} onChange={value => setMovement({...movement,quantity_grams:Math.round(Number(value) * 1000000) / 1000})} />}
        <label className="text-sm">Motivo / referência<input className={inputClass} maxLength={400} value={movement.note} onChange={e => setMovement({...movement,note:e.target.value})} placeholder="Pedido ou motivo do uso / desativação" /></label>
      </div>
      {movementAction === 'receipt' && <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">Data de entrada<input className={inputClass} type="date" value={movementDate} onChange={e => setMovementDate(e.target.value)} /></label>
        <label className="text-sm">Canal de compra (opcional)<select className={inputClass} value={purchaseChannel} onChange={e => setPurchaseChannel(e.target.value)}><option value="">Não informado</option>{FILAMENT_PURCHASE_CHANNELS.map(channel => <option key={channel}>{channel}</option>)}</select></label>
        {purchaseChannel === 'Outro' && <label className="text-sm">Outro canal de compra<input className={inputClass} maxLength={80} value={otherPurchaseChannel} onChange={e => setOtherPurchaseChannel(e.target.value)} placeholder="Nome do canal ou loja" /></label>}
      </div>}
      <p className="text-xs text-slate-600">{movementAction === 'deactivate' ? 'Retira todo o saldo e bloqueia novas impressões. O cadastro e o histórico são preservados.' : movementAction === 'used' ? 'Baixa a quantidade consumida. Não lance novamente consumo já registrado pela produção.' : 'Os botões − e + alteram 1 kg por clique. A data e o canal ficam registrados nesta entrada.'}</p>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setMovement(undefined)} className="rounded-lg border px-3 py-2 text-sm">Cancelar lançamento</button><button type="button" className="rounded-lg bg-violet-700 px-3 py-2 text-sm text-white" onClick={() => {
        if (movementAction === 'deactivate' && !window.confirm('Retirar todo o saldo e desativar este filamento? O histórico será preservado.')) return;
        void run(async () => {
          if (movementAction !== 'deactivate' && (!Number.isFinite(movement.quantity_grams) || movement.quantity_grams <= 0)) throw new Error('Informe uma quantidade positiva.');
          const receipt = movementAction === 'receipt';
          const input:FilamentStockInput = {...movement,reason:receipt ? 'receipt' : 'adjustment', quantity_grams:receipt ? movement.quantity_grams : movementAction === 'deactivate' ? -movement.expected_grams : -movement.quantity_grams, note:receipt ? filamentPurchaseNote({...movement,reason:'receipt',note:movement.note || 'Entrada de filamento'},purchaseChannel,otherPurchaseChannel) : movement.note || (movementAction === 'used' ? 'Consumo informado' : 'Retirada do saldo'), ...(receipt ? {entry_date:movementDate} : {action:movementAction})};
          await print3dFilamentsService.move(input); setMovement(undefined); await load(true);
          setNotice(catalog?.preview ? 'Operação salva somente no rascunho local.' : 'Operação registrada.');
        });
      }}>{movementAction === 'deactivate' ? 'Retirar saldo e desativar' : movementAction === 'used' ? 'Registrar uso' : 'Registrar entrada'}</button></div>
    </fieldset>}
    <label className="block text-sm">Buscar por marca, material ou cor<input className={inputClass} value={filter} onChange={e => setFilter(e.target.value)} placeholder="Ex.: PETG, Bambu Lab, branco" /></label>
    {grouped.length > 0 && <div className="rounded-lg border bg-white p-3"><h4 className="font-semibold">Estoque por tipo de filamento e cor</h4><p className="text-xs text-slate-600">Soma dos saldos por material + cor, incluindo todas as marcas dos resultados abaixo. Saldo indisponível não é tratado como zero.</p><div className="overflow-x-auto"><table className="mt-2 w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Material</th><th className="p-2">Cor</th><th className="p-2">Marcas</th><th className="p-2">Quantidade total</th></tr></thead><tbody>{grouped.map(group => <tr key={group.key} className="border-b"><td className="p-2">{group.material}</td><td className="p-2"><span className="inline-flex items-center gap-2">{colorPreview(group.color, group.colorNames)}{group.color}</span></td><td className="p-2">{group.brands.join(', ')}</td><td className="p-2 font-semibold">{group.quantity_grams === null ? 'Saldo indisponível' : grams(group.quantity_grams)}</td></tr>)}</tbody></table></div></div>}
    {!catalog ? <p className="text-sm">Carregando cadastro…</p> : !filtered.length ? <p className="text-sm text-slate-600">Nenhum filamento encontrado. Clique em Novo filamento.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Marca / material</th><th className="p-2">Cor</th><th className="p-2">Custo/kg</th><th className="p-2">Saldo físico</th><th className="p-2">Ações</th></tr></thead><tbody>{filtered.map(f => <tr key={f.id} className="border-b"><td className="p-2">{f.brand || 'Marca pendente'}<div className="text-xs text-slate-500">{f.material || f.name}{f.active === false ? ' · Inativo' : ''}</div></td><td className="p-2"><span className="inline-flex items-center gap-2">{colorPreview(f.color, f.colorNames)}{f.color}</span></td><td className="p-2">{money(perKg(f))}</td><td className="p-2">{knownBalance(f.id) ? grams(balance(f.id)) : 'Indisponível (não é zero)'}</td><td className="p-2"><div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className="text-blue-700 underline" onClick={() => { setEditing({ ...f, costPerKgCents:perKg(f) }); setMovement(undefined); }}>Editar</button><button type="button" disabled={busy || f.active === false || !knownBalance(f.id)} className="text-blue-700 underline disabled:opacity-40" onClick={() => { setEditing(undefined); openReceipt(f.id); }}>Movimentar estoque</button><button type="button" className="text-blue-700 underline" onClick={() => setHistoryId(f.id)}>Histórico</button></div></td></tr>)}</tbody></table></div>}
    {stock && !stock.enabled && <p className="text-sm text-amber-800">O estoque central ainda não está habilitado com a migração 054. O cadastro e os cálculos não dependem dessa ativação.</p>}
    {historyId && <div className="rounded-lg border bg-white p-3"><div className="flex justify-between"><h4 className="font-semibold">Histórico · {catalog?.filaments.find(f => f.id === historyId)?.name} · {catalog?.filaments.find(f => f.id === historyId)?.color}</h4><button type="button" onClick={() => setHistoryId('')} className="text-sm underline">Fechar histórico</button></div><p className="text-xs text-slate-500">Até 200 lançamentos recentes do estoque central, mais os rascunhos locais pendentes. A data de entrada é distinta da data de registro.</p><div className="overflow-x-auto"><table className="mt-2 w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Data de entrada</th><th className="p-2">Registrado em</th><th className="p-2">Operação</th><th className="p-2">Quantidade</th><th className="p-2">Referência</th></tr></thead><tbody>{(stock?.movements || []).filter(m => m.filament_id === historyId).map(m => <tr key={m.id} className="border-b"><td className="p-2">{m.reason === 'receipt' ? entryDateLabel(filamentEntryDate(m)) : '—'}</td><td className="p-2">{new Date(m.created_at).toLocaleString('pt-BR')}</td><td className="p-2">{m.reason === 'production' ? 'Produção' : m.reason === 'receipt' ? 'Entrada' : m.note?.startsWith('Desativado | ') ? 'Desativado' : m.note?.startsWith('Usado | ') ? 'Usado' : 'Ajuste anterior'}</td><td className="p-2">{Number(m.quantity_delta_grams) > 0 ? '+' : ''}{grams(Number(m.quantity_delta_grams))}</td><td className="p-2">{m.note || 'Consumo registrado na produção'}{m.preview ? ' · Rascunho' : ''}</td></tr>)}</tbody></table></div></div>}
  </section>;
}
