import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProductionProgressCard } from '@/components/print3d/ProductionProgressCard';
import { print3dProductionClient, readProductionDemo, type ProductionJob } from '@/services/print3dProductionClient';

export default function Print3dProductionPage() {
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true;
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      setBusy(true);
      try {
        const result = demo ? { jobs: [readProductionDemo()] } : await print3dProductionClient.customerList();
        if (active) { setJobs(result.jobs); setError(''); }
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Não foi possível atualizar a produção.'); }
      finally { pending = false; if (active) setBusy(false); }
    }
    refresh.current = () => { void load(); };
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000);
    return () => { active = false; window.clearInterval(timer); refresh.current = () => {}; };
  }, [demo]);
  const suffix = demo ? '?demo=1' : '';
  return <main className="min-h-screen bg-[var(--print3d-surface)] px-4 py-8 text-stone-800 sm:px-6"><div className="mx-auto max-w-3xl">
    <Link to={'/loja-3d/conta' + suffix} className="text-sm text-stone-600">← Minha conta</Link>
    <div className="my-7 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">Minhas encomendas</h1><p className="mt-2 text-sm text-stone-600">Acompanhe as unidades produzidas e aprovadas.</p></div>
      <button disabled={busy} onClick={() => refresh.current()} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Atualizando…' : 'Atualizar'}</button></div>
    {demo && <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Simulação local. Este pedido é fictício e não altera dados reais.</p>}
    {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}<p className="mt-2">Verifique seu acesso na <Link className="underline" to={'/loja-3d/conta' + suffix}>conta da loja 3D</Link> e tente atualizar novamente.</p></div>}
    <div className="space-y-5">{jobs.map(job => <ProductionProgressCard key={job.id} job={job} />)}</div>
    {!busy && !error && !jobs.length && <p className="rounded-2xl border border-stone-200 bg-white p-6 text-stone-600">Você ainda não tem encomendas em produção.</p>}
    <p className="mt-5 text-xs text-stone-500">Atualização automática a cada 30 segundos enquanto esta página estiver visível.</p>
  </div></main>;
}
