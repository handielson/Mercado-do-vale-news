import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductionProgressCard } from '@/components/print3d/ProductionProgressCard';
import { initialProductionDemo, print3dProductionClient, readProductionDemo, saveProductionDemo, type ProductionJob, type Print3dMaterialBalance, type Print3dSupplyBalance } from '@/services/print3dProductionClient';
import { print3dCostSettingsService, type Print3dFilament, type Print3dSupply } from '@/services/print3dCostSettings';
import { print3dRecipeFilesService } from '@/services/print3dRecipeFiles';

function PinnedFilePanel({job}:{job:ProductionJob}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const file=job.primary_file;
  async function download() {
    if (!file || busy) return;
    setBusy(true);setError('');
    try {
      const blob=await print3dRecipeFilesService.download(file.id);
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');link.href=url;link.download=file.original_name;
      document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch (cause) { setError(cause instanceof Error?cause.message:'Não foi possível baixar o arquivo da ordem.'); }
    finally {setBusy(false);}
  }
  return <section className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm">
    <h3 className="font-semibold text-violet-950">Arquivo fixado nesta ordem</h3>
    {!file ? <p role="alert" className="mt-2 text-red-800">A ficha e o arquivo principal desta ordem não conferem. Confira o cadastro antes de imprimir.</p> : <>
      <p className="mt-2 break-all font-medium">{file.original_name} · revisão {file.revision}</p>
      <p className="mt-1 text-violet-900">{file.kind==='gcode'?'G-code pronto para o perfil indicado':file.kind==='project'?'Projeto para preparar na impressora':'Modelo para fatiar'}{file.printer_profile?` · ${file.printer_profile}`:''}</p>
      {job.recipe_summary && Number.isFinite(job.recipe_summary.pieces_per_batch) && Number.isFinite(job.recipe_summary.material_gramas) && Number.isFinite(job.recipe_summary.tempo_impressao_minutos) && <p className="mt-1 text-violet-900">Ficha por lote: {job.recipe_summary.pieces_per_batch} peça(s), {job.recipe_summary.material_gramas.toLocaleString('pt-BR')} g e {job.recipe_summary.tempo_impressao_minutos.toLocaleString('pt-BR')} min de impressão.</p>}
      <p className="mt-1 font-mono text-xs text-violet-700">SHA-256: {file.sha256}</p>
      <button type="button" disabled={busy} onClick={()=>void download()} className="mt-3 rounded-lg bg-[var(--print3d-accent)] px-4 py-2 font-medium text-white disabled:opacity-50">{busy?'Baixando…':'Baixar arquivo desta ordem'}</button>
    </>}
    {error && <p role="alert" className="mt-2 text-red-800">{error}</p>}
  </section>;
}

function ProgressForm({ job, demo, onSaved }: { job: ProductionJob; demo: boolean; onSaved: (job: ProductionJob) => void }) {
  const [approved, setApproved] = useState('');
  const [rejected, setRejected] = useState('0');
  const [filamentGrams, setFilamentGrams] = useState<Record<string,string>>({});
  const [supplyQuantities, setSupplyQuantities] = useState<Record<string,string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pending = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const remaining = Math.max(0, job.target_quantity - job.approved_quantity);
  const allowed = job.status === 'queued' || job.status === 'in_progress';
  const materialTotal = Object.values(filamentGrams).reduce((sum, value) => sum + (Number(value) || 0), 0);
  function change(setter: (value: string) => void, value: string) { setter(value); attempt.current = null; setSuccess(''); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current || !allowed) return;
    const a = Number(approved || 0), r = Number(rejected || 0);
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(r) || a < 0 || r < 0 || a + r === 0 || a > remaining) {
      setError('Informe novas unidades inteiras. As aprovadas não podem ultrapassar as ' + remaining + ' pendentes.'); return;
    }
    const filaments = (job.filaments || []).filter(item => filamentGrams[item.id]?.trim()).map(item => ({ filament_id:item.id,consumed_grams:Number(filamentGrams[item.id]) }));
    const milli = filaments.reduce((sum,item) => sum + Math.round(item.consumed_grams * 1000), 0);
    if (!filaments.length || filaments.some(item => !Number.isFinite(item.consumed_grams) || item.consumed_grams <= 0 || !Number.isInteger(item.consumed_grams * 1000)) || milli <= 0 || milli > 1000000000) {
      setError('Informe o consumo real de cada filamento usado, em gramas e com até três casas decimais.'); return;
    }
    const material = milli / 1000;
    const supplies = (job.supplies || []).map(item => ({ supply_id:item.id,consumed_quantity:Number(supplyQuantities[item.id]) }));
    if (supplies.some(item => supplyQuantities[item.supply_id]?.trim() === '' || !Number.isFinite(item.consumed_quantity)
      || item.consumed_quantity < 0 || item.consumed_quantity > 1000000
      || Math.abs(item.consumed_quantity * 1000000 - Math.round(item.consumed_quantity * 1000000)) >= 0.00001)) {
      setError('Informe o consumo real de cada insumo, inclusive zero quando não utilizado, com até seis casas decimais.'); return;
    }
    const fingerprint = JSON.stringify([job.id, a, r, material, filaments, supplies, note]);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      let updated: ProductionJob;
      if (demo) {
        updated = { ...job, approved_quantity: job.approved_quantity + a, reserved_for_order_quantity: job.reserved_for_order_quantity + a, rejected_quantity: (job.rejected_quantity || 0) + r, material_consumed_grams: (job.material_consumed_grams || 0) + material,
          status: job.approved_quantity + a === job.target_quantity ? 'completed' : 'in_progress',
          history: [...job.history, { id: attempt.current.key, approved_quantity: a, rejected_quantity: r, material_consumed_grams: material, note, created_at: new Date().toISOString() }] };
        saveProductionDemo(updated);
      } else {
        updated = (await print3dProductionClient.record(job.id, { idempotency_key: attempt.current.key, approved_quantity: a, rejected_quantity: r, material_consumed_grams: material, filaments, supplies, note })).job;
      }
      onSaved(updated); setApproved(''); setRejected('0'); setFilamentGrams({}); setSupplyQuantities({}); setNote(''); attempt.current = null;
      setSuccess('Produção registrada: ' + updated.approved_quantity + ' de ' + updated.target_quantity + ' unidades aprovadas.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível registrar. Tente novamente.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-5 border-t border-stone-100 pt-5">
    <h3 className="font-medium">Registrar novas unidades</h3><p className="mt-1 text-xs text-stone-500">Informe somente este lote. As quantidades serão somadas ao que já foi produzido.</p>
    <fieldset disabled={busy || !allowed} className="mt-4 space-y-4 disabled:opacity-60">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">Novas aprovadas<input aria-label="Novas aprovadas" type="number" min="0" max={remaining} step="1" value={approved} onChange={e => change(setApproved, e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-2" /></label>
        <label className="text-sm">Novas reprovadas<input aria-label="Novas reprovadas" type="number" min="0" step="1" value={rejected} onChange={e => change(setRejected, e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-2" /></label>
      </div>
      {(job.filaments || []).map(item => <label key={item.id} className="block text-sm">{item.name} · {item.color} — consumo real (g)<input aria-label={`Consumo de ${item.name} ${item.color} em gramas`} type="number" min="0" max="1000000" step="0.001" value={filamentGrams[item.id] || ''} onChange={e => { setFilamentGrams(current => ({ ...current,[item.id]:e.target.value })); attempt.current = null; setSuccess(''); }} className="mt-1 w-full rounded-lg border border-stone-300 p-2" /></label>)}
      {(job.supplies || []).map(item => <label key={item.id} className="block text-sm">{item.name} — consumo real ({item.unit_label})<input aria-label={`Consumo de ${item.name} em ${item.unit_label}`} type="number" min="0" max="1000000" step="0.000001" value={supplyQuantities[item.id] ?? ''} onChange={e => { setSupplyQuantities(current => ({...current,[item.id]:e.target.value}));attempt.current=null;setSuccess('');}} className="mt-1 w-full rounded-lg border border-stone-300 p-2" /></label>)}
      <p className="text-sm font-medium">Material total deste lote: {materialTotal.toLocaleString('pt-BR', { maximumFractionDigits:3 })} g</p>
      <p className="-mt-2 text-xs text-stone-500">Informe o consumo real deste lançamento, incluindo unidades reprovadas. Cada filamento será baixado do saldo físico; o cliente não vê esses valores.</p>
      {!!job.supplies?.length && <p className="-mt-2 text-xs text-stone-500">Informe também cada insumo da ficha. Use zero quando este lote não consumiu o item; valores positivos serão baixados do saldo físico.</p>}
      <label className="block text-sm">Observação interna<textarea maxLength={2000} value={note} onChange={e => change(setNote, e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-2" rows={2} /></label>
      <button type="submit" className="rounded-xl bg-[var(--print3d-accent)] px-5 py-3 text-sm font-semibold text-white">{busy ? 'Registrando…' : 'Registrar produção'}</button>
    </fieldset>
    {!allowed && <p className="mt-3 text-sm text-stone-600">O status atual não permite registrar novos lotes.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="mt-3 text-sm text-green-800">{success}</p>}
  </form>;
}
export default function Print3dProductionPage() {
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [materials, setMaterials] = useState<Print3dMaterialBalance[]>([]);
  const [supplyStock, setSupplyStock] = useState<Print3dSupplyBalance[]>([]);
  const [filamentCatalog, setFilamentCatalog] = useState<Print3dFilament[]>([]);
  const [supplyCatalog, setSupplyCatalog] = useState<Print3dSupply[]>([]);
  const [receiptFilament, setReceiptFilament] = useState('');
  const [receiptGrams, setReceiptGrams] = useState('');
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [receiptNotice, setReceiptNotice] = useState('');
  const receiptAttempt = useRef<{ fingerprint:string; key:string } | null>(null);
  const [receiptSupply, setReceiptSupply] = useState('');
  const [receiptSupplyQuantity, setReceiptSupplyQuantity] = useState('');
  const [supplyBusy, setSupplyBusy] = useState(false);
  const [supplyError, setSupplyError] = useState('');
  const [supplyNotice, setSupplyNotice] = useState('');
  const supplyAttempt = useRef<{fingerprint:string;key:string}|null>(null);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(''); setJobs([]); setEnabled(true);
    const load = demo ? Promise.resolve({ enabled:true, jobs: [readProductionDemo()] }) : print3dProductionClient.adminList();
    void load.then(data => { if (active) { setEnabled(data.enabled !== false); setJobs(data.enabled === false ? [] : data.jobs); } }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar a produção.'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [demo, reload]);
  useEffect(() => {
    if (demo || !enabled) return;
    let active = true;
    void Promise.all([print3dProductionClient.materials(),print3dProductionClient.supplies(),print3dCostSettingsService.get()]).then(([stock,supplies,settings]) => {
      if (!active) return;
      setMaterials(stock.materials);setFilamentCatalog(settings.filaments);setReceiptFilament(current => current || settings.filaments[0]?.id || '');
      setSupplyStock(supplies.supplies);
      const catalog = [...settings.supplies,...(settings.packagingCentsPerPiece > 0 ? [{id:'packaging-per-piece',name:'Embalagem por peça',unitLabel:'un',unitCostCents:settings.packagingCentsPerPiece}] : [])];
      setSupplyCatalog(catalog);setReceiptSupply(current => current || catalog[0]?.id || '');
    }).catch(error => { if (active) setReceiptError(error instanceof Error ? error.message : 'Não foi possível consultar os filamentos.'); });
    return () => { active = false; };
  }, [demo,enabled,reload]);
  async function receiveMaterial(event: FormEvent) {
    event.preventDefault();
    if (receiptBusy) return;
    const grams = Number(receiptGrams);
    if (!receiptFilament || !Number.isFinite(grams) || grams <= 0 || grams > 1000000 || !Number.isInteger(grams * 1000)) { setReceiptError('Escolha um filamento e informe gramas positivos, com até três casas decimais.'); return; }
    const fingerprint = JSON.stringify([receiptFilament,grams]);
    if (receiptAttempt.current?.fingerprint !== fingerprint) receiptAttempt.current = { fingerprint,key:crypto.randomUUID() };
    setReceiptBusy(true);setReceiptError('');setReceiptNotice('');
    try {
      const result = await print3dProductionClient.receiveMaterial(receiptFilament,grams,receiptAttempt.current.key);
      setReceiptNotice(result.replayed ? 'Esta entrada já havia sido registrada.' : 'Entrada física registrada.');
      setReceiptGrams('');receiptAttempt.current = null;
      setMaterials((await print3dProductionClient.materials()).materials);
    } catch (error) { setReceiptError(error instanceof Error ? error.message : 'Não foi possível registrar a entrada.'); }
    finally { setReceiptBusy(false); }
  }
  async function receiveSupply(event: FormEvent) {
    event.preventDefault();
    if (supplyBusy) return;
    const units = Number(receiptSupplyQuantity);
    if (!receiptSupply || !Number.isFinite(units) || units <= 0 || units > 1000000
      || Math.abs(units*1000000-Math.round(units*1000000)) >= 0.00001) {
      setSupplyError('Escolha um insumo e informe uma quantidade positiva, com até seis casas decimais.');return;
    }
    const fingerprint=JSON.stringify([receiptSupply,units]);
    if (supplyAttempt.current?.fingerprint !== fingerprint) supplyAttempt.current={fingerprint,key:crypto.randomUUID()};
    setSupplyBusy(true);setSupplyError('');setSupplyNotice('');
    try {
      const result=await print3dProductionClient.receiveSupply(receiptSupply,units,supplyAttempt.current.key);
      setSupplyNotice(result.replayed?'Esta entrada já havia sido registrada.':'Entrada física do insumo registrada.');
      setReceiptSupplyQuantity('');supplyAttempt.current=null;
      setSupplyStock((await print3dProductionClient.supplies()).supplies);
    } catch (error) { setSupplyError(error instanceof Error?error.message:'Não foi possível registrar o insumo.'); }
    finally { setSupplyBusy(false); }
  }
  return <div className="mx-auto max-w-5xl p-4 sm:p-6">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Produção 3D</h1><p className="mt-2 text-sm text-stone-600">Registre cada lote aprovado e acompanhe o saldo de cada encomenda.</p></div>
      <button disabled={busy} onClick={() => setReload(n => n + 1)} className="rounded-xl border bg-white px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Carregando…' : 'Atualizar'}</button></div>
    {demo && <div className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p>Simulação local: pedido fictício de 100 unidades. Os registros não alteram pedidos, estoque ou pagamentos reais.</p><button onClick={() => { const job = initialProductionDemo(); saveProductionDemo(job); setJobs([job]); }} className="mt-2 underline">Reiniciar exemplo em 20 de 100</button></div>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {!busy && !error && !enabled && <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-semibold">Produção real ainda não habilitada</h2><p className="mt-2 text-sm">Você pode testar o acompanhamento por lotes na simulação. Nenhum pedido, estoque ou pagamento real será alterado.</p><button onClick={() => { const next = new URLSearchParams(params); next.set('demo', '1'); window.location.search = next.toString(); }} className="mt-3 rounded-xl bg-[var(--print3d-accent)] px-4 py-2 text-sm font-semibold text-white">Testar simulação de produção</button></div>}
    {!demo && enabled && <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5"><h2 className="text-lg font-semibold">Estoque físico de filamentos</h2><p className="mt-1 text-sm text-stone-600">Saldos em gramas, separados do estoque de produtos acabados.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{materials.map(item => <p key={item.filament_id} className="rounded-lg bg-stone-50 p-3 text-sm">{item.name_snapshot} · {item.color_snapshot}<strong className="block text-lg">{item.quantity_grams.toLocaleString('pt-BR', { maximumFractionDigits:3 })} g</strong></p>)}</div><form onSubmit={receiveMaterial} className="mt-5 flex flex-wrap items-end gap-3"><label className="text-sm">Filamento<select className="mt-1 block rounded-lg border border-stone-300 p-2" value={receiptFilament} onChange={e => { setReceiptFilament(e.target.value);receiptAttempt.current = null; }}>{filamentCatalog.map(item => <option key={item.id} value={item.id}>{item.name} · {item.color}</option>)}</select></label><label className="text-sm">Entrada (g)<input className="mt-1 block rounded-lg border border-stone-300 p-2" type="number" min="0.001" max="1000000" step="0.001" value={receiptGrams} onChange={e => { setReceiptGrams(e.target.value);receiptAttempt.current = null; }} /></label><button disabled={receiptBusy || !filamentCatalog.length} className="rounded-lg bg-[var(--print3d-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{receiptBusy ? 'Registrando…' : 'Registrar entrada física'}</button></form>{receiptError && <p role="alert" className="mt-3 text-sm text-red-700">{receiptError}</p>}{receiptNotice && <p role="status" className="mt-3 text-sm text-green-800">{receiptNotice}</p>}</section>}
    {!demo && enabled && <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5"><h2 className="text-lg font-semibold">Estoque físico de insumos</h2><p className="mt-1 text-sm text-stone-600">Argolas, embalagens e outros itens cadastrados na calculadora, cada um na sua unidade.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{supplyStock.map(item => <p key={item.supply_id} className="rounded-lg bg-stone-50 p-3 text-sm">{item.name_snapshot}<strong className="block text-lg">{item.quantity_units.toLocaleString('pt-BR',{maximumFractionDigits:6})} {item.unit_snapshot}</strong></p>)}</div><form onSubmit={receiveSupply} className="mt-5 flex flex-wrap items-end gap-3"><label className="text-sm">Insumo<select className="mt-1 block rounded-lg border border-stone-300 p-2" value={receiptSupply} onChange={e => {setReceiptSupply(e.target.value);supplyAttempt.current=null;}}>{supplyCatalog.map(item => <option key={item.id} value={item.id}>{item.name} ({item.unitLabel || 'un'})</option>)}</select></label><label className="text-sm">Entrada<input className="mt-1 block rounded-lg border border-stone-300 p-2" type="number" min="0.000001" max="1000000" step="0.000001" value={receiptSupplyQuantity} onChange={e => {setReceiptSupplyQuantity(e.target.value);supplyAttempt.current=null;}} /></label><button disabled={supplyBusy || !supplyCatalog.length} className="rounded-lg bg-[var(--print3d-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{supplyBusy?'Registrando…':'Registrar entrada do insumo'}</button></form>{supplyError && <p role="alert" className="mt-3 text-sm text-red-700">{supplyError}</p>}{supplyNotice && <p role="status" className="mt-3 text-sm text-green-800">{supplyNotice}</p>}</section>}
    <div className="grid gap-5 lg:grid-cols-2">{jobs.map(job => <ProductionProgressCard key={job.id} job={job} admin>{!demo && <PinnedFilePanel job={job} />}<ProgressForm job={job} demo={demo} onSaved={updated => { setJobs(current => current.map(item => item.id === updated.id ? updated : item)); if (!demo) void Promise.all([print3dProductionClient.materials(),print3dProductionClient.supplies()]).then(([filaments,supplies]) => {setMaterials(filaments.materials);setSupplyStock(supplies.supplies);}).catch(() => {}); }} /></ProductionProgressCard>)}</div>
    {!busy && !error && enabled && !jobs.length && <p className="rounded-xl border bg-white p-6 text-stone-600">Nenhuma ordem de produção encontrada. As ordens serão vinculadas às encomendas e à confirmação da entrada.</p>}
  </div>;
}
