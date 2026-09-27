import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductionProgressCard } from '@/components/print3d/ProductionProgressCard';
import { initialProductionDemo, print3dProductionClient, readProductionDemo, saveProductionDemo, type ProductionJob } from '@/services/print3dProductionClient';

function ProgressForm({ job, demo, onSaved }: { job: ProductionJob; demo: boolean; onSaved: (job: ProductionJob) => void }) {
  const [approved, setApproved] = useState('');
  const [rejected, setRejected] = useState('0');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pending = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const remaining = Math.max(0, job.target_quantity - job.approved_quantity);
  const allowed = job.status === 'queued' || job.status === 'in_progress';
  function change(setter: (value: string) => void, value: string) { setter(value); attempt.current = null; setSuccess(''); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current || !allowed) return;
    const a = Number(approved || 0), r = Number(rejected || 0);
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(r) || a < 0 || r < 0 || a + r === 0 || a > remaining) {
      setError('Informe novas unidades inteiras. As aprovadas não podem ultrapassar as ' + remaining + ' pendentes.'); return;
    }
    const fingerprint = JSON.stringify([job.id, a, r, note]);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      let updated: ProductionJob;
      if (demo) {
        updated = { ...job, approved_quantity: job.approved_quantity + a, rejected_quantity: (job.rejected_quantity || 0) + r,
          status: job.approved_quantity + a === job.target_quantity ? 'completed' : 'in_progress',
          history: [...job.history, { id: attempt.current.key, approved_quantity: a, rejected_quantity: r, note, created_at: new Date().toISOString() }] };
        saveProductionDemo(updated);
      } else {
        updated = (await print3dProductionClient.record(job.id, { idempotency_key: attempt.current.key, approved_quantity: a, rejected_quantity: r, note })).job;
      }
      onSaved(updated); setApproved(''); setRejected('0'); setNote(''); attempt.current = null;
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
      <label className="block text-sm">Observação interna<textarea maxLength={2000} value={note} onChange={e => change(setNote, e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 p-2" rows={2} /></label>
      <button type="submit" className="rounded-xl bg-[#254a39] px-5 py-3 text-sm font-semibold text-white">{busy ? 'Registrando…' : 'Registrar produção'}</button>
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
  useEffect(() => {
    let active = true;
    setBusy(true); setError('');
    const load = demo ? Promise.resolve({ jobs: [readProductionDemo()] }) : print3dProductionClient.adminList();
    void load.then(data => { if (active) setJobs(data.jobs); }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar a produção.'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [demo, reload]);
  return <div className="mx-auto max-w-5xl p-4 sm:p-6">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Produção 3D</h1><p className="mt-2 text-sm text-stone-600">Registre cada lote aprovado e acompanhe o saldo de cada encomenda.</p></div>
      <button disabled={busy} onClick={() => setReload(n => n + 1)} className="rounded-xl border bg-white px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Carregando…' : 'Atualizar'}</button></div>
    {demo && <div className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p>Simulação local: pedido fictício de 100 unidades. Os registros não alteram pedidos, estoque ou pagamentos reais.</p><button onClick={() => { const job = initialProductionDemo(); saveProductionDemo(job); setJobs([job]); }} className="mt-2 underline">Reiniciar exemplo em 20 de 100</button></div>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-2">{jobs.map(job => <ProductionProgressCard key={job.id} job={job} admin><ProgressForm job={job} demo={demo} onSaved={updated => setJobs(current => current.map(item => item.id === updated.id ? updated : item))} /></ProductionProgressCard>)}</div>
    {!busy && !error && !jobs.length && <p className="rounded-xl border bg-white p-6 text-stone-600">Nenhuma ordem de produção encontrada. As ordens serão vinculadas às encomendas e à confirmação da entrada.</p>}
  </div>;
}
