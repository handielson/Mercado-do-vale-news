import type { ReactNode } from 'react';
import { productionStatusLabel, type ProductionJob } from '@/services/print3dProductionClient';

export function ProductionProgressCard({ job, admin = false, children }: { job: ProductionJob; admin?: boolean; children?: ReactNode }) {
  const remaining = Math.max(0, job.target_quantity - job.approved_quantity);
  const percent = job.target_quantity > 0 ? Math.min(100, Math.floor(job.approved_quantity / job.target_quantity * 100)) : 0;
  return <article className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs uppercase tracking-widest text-stone-500">Pedido {job.order_number}</p>
        <h2 className="mt-2 text-lg font-semibold text-stone-900">{job.product_name}</h2>
        <p className="mt-1 text-xs text-stone-500">SKU {job.sku}</p></div>
      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium">{productionStatusLabel[job.status] || job.status}</span>
    </div>
    <div className="mt-6 flex items-end justify-between gap-3"><p><strong className="text-3xl text-[#254a39]">{job.approved_quantity}</strong><span className="text-stone-500"> / {job.target_quantity} unidades aprovadas</span></p><strong>{percent}%</strong></div>
    <div role="progressbar" aria-label={'Produção de ' + job.product_name} aria-valuenow={job.approved_quantity} aria-valuemin={0} aria-valuemax={job.target_quantity} className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-[#254a39] transition-all" style={{ width: percent + '%' }} /></div>
    <p className="mt-3 text-sm text-stone-600">{job.status === 'cancelled' ? 'Produção cancelada.' : remaining ? 'Faltam ' + remaining + ' unidades para concluir a produção.' : 'Todas as unidades foram produzidas e aprovadas.'}</p>
    <p className="mt-2 text-xs text-stone-500">O progresso de produção não indica envio ou entrega.</p>
    {admin && <p className="mt-3 text-sm text-stone-600">Reprovadas: {job.rejected_quantity || 0} · Não entram no progresso aprovado.</p>}
    {children}
    <details className="mt-5 border-t border-stone-100 pt-4"><summary className="cursor-pointer text-sm font-medium">Histórico de produção</summary>
      <ol className="mt-3 space-y-3">{job.history.filter(event => admin || event.approved_quantity > 0).map(event => <li key={event.id} className="text-sm text-stone-600">
        <time className="block text-xs text-stone-500">{new Date(event.created_at).toLocaleString('pt-BR')}</time>
        <span>+{event.approved_quantity} aprovadas</span>{admin && <span> · +{event.rejected_quantity || 0} reprovadas</span>}
        {admin && event.note && <p className="mt-1 whitespace-pre-wrap break-words">{event.note}</p>}
      </li>)}</ol>{!job.history.length && <p className="mt-3 text-sm text-stone-500">Nenhuma produção registrada.</p>}</details>
  </article>;
}
