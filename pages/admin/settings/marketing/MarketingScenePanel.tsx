import React, { useEffect, useRef, useState } from 'react';
import { marketingScenes, type SceneBackground, type SceneChoice } from '../../../../services/marketingSceneService';

interface Props { productId?: string; choice?: SceneChoice; disabled: boolean; mode: 'automatic' | 'neutral' | 'upload'; onMode: (mode: Props['mode']) => void; onChoose: (id: string, choice: SceneChoice) => void; onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void }
export default function MarketingScenePanel({ productId, choice, disabled, mode, onMode, onChoose, onUpload }: Props) {
  const [source, setSource] = useState<'library' | 'pexels'>('library');
  const [items, setItems] = useState<SceneBackground[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState(''); const [locale, setLocale] = useState('en-US');
  const [page, setPage] = useState(1); const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [reviewed, setReviewed] = useState(false); const generation = useRef(0);
  const currentProduct = useRef(productId); currentProduct.current = productId;
  const run = async (action: () => Promise<void>) => { setBusy(true); setMessage(''); try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os cenários.'); } finally { setBusy(false); } };
  const choose = async (background: SceneBackground, id = productId) => {
    if (!id) return;
    const dataUrl = await marketingScenes.image(background.id);
    await marketingScenes.select(id, background.id);
    if (currentProduct.current === id) { onChoose(id, { background, dataUrl }); onMode('automatic'); }
  };
  // Only product identity and mode trigger selection; changing commercial copy/price preserves the photo.
  useEffect(() => {
    const token = ++generation.current;
    setItems([]); setSelected([]); setReviewed(false); setPage(1);
    if (!productId || disabled || mode !== 'automatic' || choice) return;
    const id = productId;
    void run(async () => {
      const plan = await marketingScenes.prepare([id]);
      if (generation.current !== token) return;
      const item = plan.items[0];
      if (item?.background) {
        const dataUrl = await marketingScenes.image(item.background.id);
        if (generation.current === token) onChoose(id, { background: item.background, dataUrl });
      } else setMessage([item?.message, ...plan.warnings].filter(Boolean).join(' '));
    });
    return () => { generation.current++; };
  }, [productId, mode, disabled]);
  const search = async (next = 1) => {
    if (!productId) return; const id = productId;
    const result = await marketingScenes.search(id, query, next, locale);
    if (currentProduct.current !== id) return;
    setItems(result.items); setPage(next); setMore(result.hasMore); setSelected([]); setReviewed(false); setMessage(result.warning);
  };
  return <section className="space-y-3 rounded-xl border bg-white p-5 shadow-sm">
    <h3 className="font-bold text-slate-800">Fundo contextual</h3>
    <p className="text-xs text-slate-500">Fotografias de ambientes. O produto e os textos continuam separados do fundo.</p>
    <fieldset disabled={disabled || busy} className="space-y-3 disabled:opacity-60">
      <select aria-label="Modo do fundo contextual" value={mode} onChange={e => onMode(e.target.value as Props['mode'])} className="w-full rounded border p-2">
        <option value="automatic">Automático — fundos aprovados</option><option value="upload">Enviar fotografia</option><option value="neutral">Fundo neutro</option>
      </select>
      {mode === 'upload' && <><p className="text-xs">Envie uma fotografia revisada para usar e guardar na biblioteca. Se a biblioteca estiver indisponível, o envio local continua disponível abaixo.</p><input disabled={!productId} aria-label="Enviar fundo contextual à biblioteca" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file=event.target.files?.[0], id=productId; if(!file || !id) return; void run(async()=>{ if(file.size>10000000) throw new Error('Limite de 10 MB por fotografia.'); const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Falha ao ler fotografia.'));reader.readAsDataURL(file);}); await choose(await marketingScenes.upload(id,dataUrl),id); }); }} /><label className="block text-xs">Usar apenas nesta sessão<input aria-label="Enviar fundo contextual local" type="file" accept="image/jpeg,image/png,image/webp" onChange={onUpload} /></label></>}
      {mode === 'automatic' && <>
        {choice && <div className="rounded-lg border p-2"><img src={choice.dataUrl} alt="Cenário selecionado" className="h-28 w-full rounded object-cover" /><p className="mt-1 text-xs">{choice.background.context} · {choice.background.approved ? 'Aprovado' : 'Revisão pendente'}</p><Credits background={choice.background} /></div>}
        <div className="flex flex-wrap gap-2 text-xs">
          <button type="button" onClick={() => { setSource('library'); void run(async () => setItems((await marketingScenes.library()).items.filter(i => i.active))); }} className="rounded border px-3 py-2">Biblioteca</button>
          <button type="button" onClick={() => { setSource('pexels'); setItems([]); }} className="rounded border px-3 py-2">Buscar no Pexels</button>
          <button type="button" disabled={!productId} onClick={() => void run(async () => { const plan = await marketingScenes.prepare([productId!], 1); if (plan.items[0]?.background) await choose(plan.items[0].background); else setMessage('Aprove outras fotografias deste contexto para alternar.'); })} className="rounded border px-3 py-2">Trocar cenário</button>
        </div>
        {source === 'pexels' && <div className="space-y-2"><input aria-label="Pesquisa de cenário" value={query} onChange={e => setQuery(e.target.value)} placeholder="Automático pelo contexto do produto" className="w-full rounded border p-2 text-sm" /><select aria-label="Idioma da pesquisa" value={locale} onChange={e => setLocale(e.target.value)} className="rounded border p-2 text-sm"><option value="en-US">Inglês (recomendado)</option><option value="pt-BR">Português</option></select><button type="button" disabled={!productId} onClick={() => void run(() => search())} className="ml-2 rounded bg-blue-600 p-2 text-sm text-white">Pesquisar</button></div>}
        {items.length > 0 && <><div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto">{items.map(b => <article key={b.id} className="min-w-0 rounded border p-2">
          <img src={b.thumbnail || b.url} referrerPolicy="no-referrer" alt={b.context} className="h-24 w-full rounded object-cover" />
          <label className="my-1 flex gap-1 text-xs"><input type="checkbox" checked={selected.includes(b.id)} onChange={e => setSelected(s => e.target.checked ? [...s, b.id] : s.filter(id => id !== b.id))} />Selecionar</label>
          <p className="text-xs">{b.context} · {b.orientation} · {b.width}×{b.height}</p><p className="text-xs">{b.approved ? 'Aprovado' : 'Revisar'} · {b.uses} usos</p><Credits background={b} />
          <button type="button" disabled={!productId || !b.approved} onClick={() => void run(() => choose(b))} className="mt-1 rounded border px-2 py-1 text-xs">Usar</button>
        </article>)}</div>
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />Revisei as selecionadas: contexto correto, sem marcas, pessoas ou acessórios que confundam o produto.</label>
        <button type="button" disabled={!selected.length} onClick={() => void run(async () => { const result = await marketingScenes.import(selected, reviewed); const failed = result.items.filter(i => i.status === 'failed'); setMessage(failed.length ? `${failed.length} importações falharam. ${failed[0].message}` : 'Fotografias importadas para a biblioteca.'); setItems((await marketingScenes.library()).items.filter(i => i.active)); setSource('library'); setSelected([]); setReviewed(false); })} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">Importar {selected.length} selecionadas{reviewed ? ' e aprovar' : ''}</button></>}
        {source === 'pexels' && more && <button type="button" onClick={() => void run(() => search(page + 1))} className="text-sm text-blue-700">Ver outras imagens · página {page + 1}</button>}
      </>}
    </fieldset>
    {busy && <p role="status" className="text-xs text-blue-700">Preparando cenários…</p>}
    {message && <p role="status" className="rounded bg-amber-50 p-2 text-xs text-amber-900">{message}</p>}
    <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">Fotografias fornecidas pelo Pexels</a>
  </section>;
}
function Credits({ background: b }: { background: SceneBackground }) { return b.origin === 'pexels' ? <p className="text-xs text-blue-700"><a href={b.photographerPage || b.photoPage} target="_blank" rel="noreferrer">{b.photographer}</a> / <a href={b.photoPage} target="_blank" rel="noreferrer">Pexels</a></p> : <p className="text-xs">Fotografia enviada</p>; }
