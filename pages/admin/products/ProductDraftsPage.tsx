import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { productFormDraftsService, type ProductFormDraftSummary } from '../../../services/productFormDrafts';

export const ProductDraftsPage = () => {
  const [drafts, setDrafts] = useState<ProductFormDraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setDrafts((await productFormDraftsService.list()).drafts); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível carregar os rascunhos.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const archive = async (draft: ProductFormDraftSummary) => {
    if (!window.confirm(`Arquivar o rascunho “${draft.title}”? Ele sairá da lista de pendentes.`)) return;
    setBusy(draft.id);
    try { await productFormDraftsService.setStatus(draft.id, draft.revision, 'archived'); setDrafts(current => current.filter(item => item.id !== draft.id)); toast.success('Rascunho arquivado.'); }
    catch (failure) { toast.error(failure instanceof Error ? failure.message : 'Não foi possível arquivar.'); }
    finally { setBusy(''); }
  };
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visible = drafts.filter(draft => normalize(draft.title).includes(normalize(search)));
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold text-slate-900">Rascunhos de anúncios</h1><p className="mt-1 text-sm text-slate-600">Cadastros incompletos salvos no sistema. Continue de qualquer computador; os rascunhos não aparecem para venda.</p></div><Link to="/admin/products/new" className="rounded-lg bg-blue-600 px-4 py-2 text-white">Novo anúncio</Link></div>
    <div className="flex gap-3"><input aria-label="Pesquisar rascunhos" value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar pelo nome do rascunho..." className="w-full rounded-lg border px-3 py-2" /><button onClick={() => void load()} disabled={loading} className="rounded-lg border px-3 py-2">Atualizar</button></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
    {loading ? <p>Carregando rascunhos...</p> : !error && !visible.length ? <p className="rounded-xl border bg-white p-8 text-slate-600">{drafts.length ? 'Nenhum rascunho corresponde à pesquisa.' : 'Nenhum rascunho pendente. No cadastro, use Salvar rascunho para guardar o trabalho incompleto.'}</p> : <div className="grid gap-4 md:grid-cols-2">{visible.map(draft => <article key={draft.id} className="rounded-xl border bg-white p-5"><h2 className="font-semibold text-slate-900">{draft.title}</h2><p className="mt-1 text-sm text-slate-500">{draft.is_print3d ? 'Produto 3D' : 'Produto'} · {draft.is_parent ? 'Família com variações' : 'Cadastro individual'}</p><p className="mt-2 text-sm">Atualizado: {new Date(draft.updated_at).toLocaleString('pt-BR')}</p><div className="mt-4 flex gap-3"><Link to={`/admin/products/new?draft=${draft.id}${draft.is_print3d ? '&print3d=1' : ''}`} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">Continuar cadastro</Link><button disabled={Boolean(busy)} onClick={() => void archive(draft)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{busy === draft.id ? 'Arquivando...' : 'Arquivar'}</button></div></article>)}</div>}
    <Link to="/admin/products" className="inline-block text-blue-700 underline">Voltar aos produtos</Link>
  </div>;
};
