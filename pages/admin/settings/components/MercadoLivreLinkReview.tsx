import { useState } from 'react';
import { mercadoLivreService, type MercadoLivreCandidate, type MercadoLivreListing } from '../../../../services/mercadoLivreService';

const keyOf = (row: MercadoLivreListing) => `${row.itemId}:${row.variationId}`;
const labels = { linked: 'Já vinculado', unique: 'SKU correspondente — conferir', ambiguous: 'SKU duplicado — escolha manual', missing_sku: 'Anúncio sem SKU', not_found: 'SKU não encontrado no sistema' };

function ManualSelection({ disabled, onChoose }: { disabled: boolean; onChoose: (product: MercadoLivreCandidate) => void }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MercadoLivreCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <div className="mt-2 space-y-2">
    <div className="flex gap-2"><input aria-label="Buscar produto local por SKU ou nome" className="min-w-0 flex-1 rounded border px-2 py-1" value={query} disabled={disabled || busy} onChange={event => { setQuery(event.target.value); setItems([]); setMessage(''); }} placeholder="SKU ou nome do produto local" /><button type="button" disabled={disabled || busy || query.trim().length < 2} className="rounded border px-2 py-1 disabled:opacity-50" onClick={async () => {
      setBusy(true); setMessage(''); setItems([]);
      try { const result = await mercadoLivreService.findCandidates(query.trim()); setItems(result.items); if (!result.items.length) setMessage('Nenhum produto encontrado.'); }
      catch { setMessage('Não foi possível buscar produtos.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Buscando...' : 'Buscar produto'}</button></div>
    {message && <p role="status">{message}</p>}
    {items.length > 0 && <ul className="max-h-48 overflow-y-auto rounded border bg-white">{items.map(item => <li key={item.id}><button type="button" disabled={disabled} className="w-full p-2 text-left hover:bg-yellow-50" onClick={() => { onChoose(item); setItems([]); }}>{item.sku} · {item.name}</button></li>)}</ul>}
  </div>;
}

export default function MercadoLivreLinkReview({ connected }: { connected: boolean }) {
  const [rows, setRows] = useState<MercadoLivreListing[]>([]);
  const [choices, setChoices] = useState<Record<string, MercadoLivreCandidate>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [total, setTotal] = useState(0);
  const [seller, setSeller] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, string>>({});
  const discover = async (more: boolean) => {
    setBusy(true); setMessage('');
    if (!more) { setRows([]); setChoices({}); setChecked({}); setResults({}); setErrors([]); setLoaded(false); setCursor(null); }
    try {
      const data = await mercadoLivreService.discoverProducts(more ? cursor || '' : '');
      if (more && seller !== data.sellerId) throw new Error('A conta mudou. Reinicie a busca.');
      setSeller(data.sellerId); setTotal(data.total); setLoaded(true); setCursor(data.nextCursor);
      setRows(current => [...new Map([...(more ? current : []), ...data.items].map(row => [keyOf(row), row])).values()]);
      setChoices(current => ({ ...(more ? current : {}), ...Object.fromEntries(data.items.filter(row => row.match === 'unique').map(row => [keyOf(row), row.candidates[0]])) }));
      setErrors(current => [...(more ? current : []), ...data.errors.map(error => `${error.itemId}: ${error.error}`)]);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao buscar anúncios. Reinicie a busca.'); }
    finally { setBusy(false); }
  };
  const selected = rows.filter(row => checked[keyOf(row)] && choices[keyOf(row)] && !row.existing.length);
  const confirm = async () => {
    setBusy(true); setMessage('');
    let saved = 0;
    for (const row of selected) {
      const key = keyOf(row), product = choices[key];
      try {
        await mercadoLivreService.linkProduct({ productId: product.id, itemId: row.itemId, variationId: row.variationId });
        saved++;
        setRows(current => current.map(item => keyOf(item) === key ? { ...item, match: 'linked', existing: [{ productId: product.id, sku: product.sku }] } : item));
        setChecked(current => ({ ...current, [key]: false }));
        setResults(current => ({ ...current, [key]: 'Vínculo confirmado.' }));
      } catch (error) { setResults(current => ({ ...current, [key]: error instanceof Error ? error.message : 'Não foi possível vincular. Tente novamente.' })); }
    }
    setMessage(`${saved} de ${selected.length} vínculos confirmados. Confira o resultado em cada anúncio.`);
    setBusy(false);
  };
  return <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
    <h2 className="text-lg font-semibold">Buscar anúncios e conferir vínculos por SKU</h2>
    <p className="text-sm text-slate-600">Busque os anúncios da conta conectada, confira o produto de cada variação e marque somente os vínculos que deseja salvar. Buscar não altera anúncios nem estoque. Vínculos existentes são preservados.</p>
    <button type="button" disabled={!connected || busy} className="rounded-lg bg-yellow-400 px-4 py-2 font-semibold disabled:opacity-50" onClick={() => void discover(false)}>{busy ? 'Processando...' : loaded ? 'Reiniciar busca dos anúncios' : 'Buscar meus anúncios'}</button>
    {!connected && <p className="text-sm">Conecte a conta do Mercado Livre para consultar.</p>}
    {loaded && <p className="text-sm">Conta {seller} · {rows.length} produtos/variações carregados · {total} anúncios na busca{cursor ? ' · há mais páginas' : ' · fim da busca'}.</p>}
    {message && <p role="status" className="rounded bg-amber-50 p-3 text-sm">{message}</p>}
    {errors.length > 0 && <div role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
    <div className="space-y-3">{rows.map(row => {
      const key = keyOf(row), product = choices[key];
      return <article key={key} className="space-y-2 rounded-lg border p-4 text-sm">
        <h3 className="font-semibold">{row.title} · {row.itemId}</h3>
        {/^(MLB)(\d+)$/.test(row.itemId) && <a
          href={`https://produto.mercadolivre.com.br/${row.itemId.replace(/^MLB/, 'MLB-')}-_JM`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Conferir anúncio ${row.itemId} no Mercado Livre (abre em nova aba)`}
          className="inline-flex items-center gap-1 font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
        >Conferir no Mercado Livre ↗</a>}
        <p>{row.variation || 'Sem variação'}{row.variationId && ` · ID ${row.variationId}`} · Status no Mercado Livre: {row.status}</p>
        <p>SKU no anúncio: {row.sku || 'não informado'} · <strong>{labels[row.match]}</strong></p>
        {row.existing.length ? <p className="text-green-800">Vínculo preservado: {row.existing.map(link => link.sku || link.productId).join(', ')}</p> : <>
          {row.candidates.length > 1 && <select aria-label={`Escolher correspondência ${row.itemId} ${row.variationId}`} className="w-full rounded border p-2" disabled={busy} value={product?.id || ''} onChange={event => { const item = row.candidates.find(candidate => candidate.id === event.target.value); if (item) setChoices(current => ({ ...current, [key]: item })); setChecked(current => ({ ...current, [key]: false })); }}><option value="" disabled>Selecione o produto correto</option>{row.candidates.map(item => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</select>}
          <p>Produto local escolhido: <strong>{product ? `${product.sku} · ${product.name}` : 'nenhum'}</strong></p>
          <ManualSelection disabled={busy} onChoose={item => { setChoices(current => ({ ...current, [key]: item })); setChecked(current => ({ ...current, [key]: false })); }} />
          <label className="flex gap-2"><input type="checkbox" disabled={busy || !product} checked={Boolean(checked[key])} onChange={event => setChecked(current => ({ ...current, [key]: event.target.checked }))} />Conferi o produto e a variação; incluir este vínculo</label>
        </>}
        {results[key] && <p role="status" className="rounded bg-slate-50 p-2">{results[key]}</p>}
      </article>;
    })}</div>
    {cursor && <button type="button" disabled={busy} onClick={() => void discover(true)} className="rounded-lg border px-4 py-2">Carregar próxima página</button>}
    {rows.length > 0 && <div className="space-y-2 border-t pt-4"><p className="text-xs text-amber-900">O vínculo será utilizado pelas automações de estoque configuradas nesta conta. Confira especialmente cor, tamanho e modelo.</p><button type="button" disabled={busy || selected.length === 0} onClick={() => void confirm()} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">Confirmar {selected.length} vínculos selecionados</button></div>}
  </section>;
}
