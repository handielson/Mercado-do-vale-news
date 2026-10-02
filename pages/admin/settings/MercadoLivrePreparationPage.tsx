import React, { useEffect, useRef, useState } from 'react';
import MercadoLivrePricingPolicy, { PricingSummary } from './MercadoLivrePricingPolicy';
import { mercadoLivreService } from '../../../services/mercadoLivreService';
import { CurrencyInput } from '../../../components/ui/CurrencyInput';
import { FIELD_NAMES, createBatch, createDraft, editField, confirmField, resolveConflict, parseSnapshot, importProposals, evaluateBatch, previewContract, researchPacket, restoreDraftFile, draftFile } from '../../../services/mercadoLivrePreparation';
import type { Batch, FieldName, SourceKind } from '../../../services/mercadoLivrePreparation';

const labels: Record<FieldName, string> = { title: 'Título legado', familyName: 'Nome da família (User Products)', description: 'Descrição', categoryId: 'Categoria', categoryRequirements: 'Requisitos oficiais da categoria', condition: 'Condição', priceCents: 'Preço', quantity: 'Quantidade', photos: 'Fotos e autorização', attributes: 'Atributos', gtin: 'GTIN', certificates: 'Certificações e evidências', commercialPolicy: 'Política comercial', variations: 'Variantes' };
const structured = new Set<FieldName>(['categoryRequirements', 'photos', 'attributes', 'certificates', 'commercialPolicy', 'variations']);
const kinds: SourceKind[] = ['catalog', 'manufacturer', 'official_catalog', 'official_document', 'operator', 'authorized_photo', 'marketplace_reference'];
const download = (name: string, value: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function MercadoLivrePreparationPage({ localPilotFile }: {localPilotFile?:string}) {
  const [batch, setBatch] = useState<Batch | null>(null), [active, setActive] = useState(''), [query, setQuery] = useState('');
  const [error, setError] = useState(''), [field, setField] = useState<FieldName>('title'), [value, setValue] = useState('');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<any>(null), [officialAttributes, setOfficialAttributes] = useState<any[]>([]);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setPreview(null); }, [batch, active]);
  useEffect(() => {
    if(!batch?.drafts.length) return;
    try { localStorage.setItem('mdv.ml.last-draft',JSON.stringify(draftFile(batch))); } catch { /* Manual file export remains available when browser storage is full. */ }
  }, [batch]);
  const [kind, setKind] = useState<SourceKind>('operator'), [reference, setReference] = useState(''), [modeSource, setModeSource] = useState('');
  const [, refreshClock] = useState(0);
  useEffect(() => { const timer = setInterval(() => refreshClock(n => n + 1), 30000); return () => clearInterval(timer); }, []);
  const reports = batch ? evaluateBatch(batch) : [];
  const draft = batch?.drafts.find(d => d.productId === active), report = reports.find(r => r.productId === active);
  const update = (next: typeof draft) => { if (batch && next) setBatch({ ...batch, drafts: batch.drafts.map(d => d.productId === next.productId ? next : d) }); };
  const selectField = (name: FieldName) => { setField(name); const f = draft?.fields[name]; setValue(structured.has(name) ? JSON.stringify(f?.value ?? (name === 'photos' || name === 'variations' ? [] : {}), null, 2) : String(f?.value ?? '')); setKind(f?.sources[0]?.kind || 'operator'); setReference(f?.sources[0]?.reference || ''); };
  useEffect(() => { selectField('title'); }, [active]);
  useEffect(() => { selectField(field); }, [draft?.fields[field]]);
  const loadDraft = (raw: unknown) => { const next = restoreDraftFile(raw); setBatch(next); setActive(next.drafts[0]?.productId || ''); setModeSource(next.accountMode.sources[0]?.reference || ''); setError(''); };
  const importFile = async (file: File | undefined, type: 'snapshot' | 'proposal' | 'draft') => {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Arquivo excede 10 MB.');
      const raw = JSON.parse(await file.text());
      if (type === 'snapshot') { const snapshot = parseSnapshot(raw); setBatch(createBatch(snapshot)); setActive(''); setModeSource(''); }
      else if (type === 'draft') loadDraft(raw);
      else { if (!batch) throw new Error('Importe o snapshot e selecione produtos primeiro.'); setBatch(importProposals(batch, raw)); }
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao importar.'); }
  };
  const save = () => {
    try {
      if (!draft || !reference.trim()) throw new Error('Informe uma fonte para este campo.');
      const parsed = structured.has(field) ? JSON.parse(value) : field === 'priceCents' || field === 'quantity' ? Number(value) : value;
      update(editField(draft, field, parsed, { kind, reference: reference.trim() })); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Valor inválido.'); }
  };
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); } catch(e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const loadCatalog = () => run(async () => {
    const raw = await mercadoLivreService.getPreparationSnapshot();
    const next = createBatch(parseSnapshot(raw));
    next.accountMode = {value:raw.mode,confirmed:true,sources:[{kind:'official_document',reference:`https://api.mercadolibre.com/users/${raw.sellerId}`} ]};
    setBatch(next); setActive(''); setModeSource(next.accountMode.sources[0].reference);
    setNotice('Catálogo e anúncios consultados. Selecione até 5 produtos para pesquisar.');
  });
  const research = () => run(async () => {
    if (!batch) return;
    if (!import.meta.env.DEV || !['localhost','127.0.0.1','[::1]'].includes(location.hostname)) throw new Error('Abra o sistema no computador com npm run dev para usar o Codex local.');
    const headers = {'Content-Type':'application/json','x-mdv-local-research':'1'};
    const started = await fetch('/__ml-local/research', {method:'POST',headers,body:JSON.stringify(researchPacket(batch))});
    const job = await started.json(); if (!started.ok) throw new Error(job.error || 'Codex local indisponível.');
    setNotice('Codex pesquisando modelos e comparando anúncios. Você pode aguardar nesta tela.');
    const deadline=Date.now()+920000;
    while(alive.current && Date.now()<deadline) {
      await new Promise(resolve=>setTimeout(resolve,2500)); if(!alive.current) return;
      const response=await fetch(`/__ml-local/research?id=${encodeURIComponent(job.id)}`,{headers}); const result=await response.json();
      if(!response.ok || result.status==='failed') throw new Error(result.error || 'Pesquisa indisponível.');
      if(result.status==='complete') {setBatch(importProposals(batch,result.result));setNotice(['Pesquisa recebida. Confira propostas e resolva diferenças.',...(result.result.notes || [])].join('\n'));return;}
    }
    if(alive.current) throw new Error('Tempo de espera excedido. Confira o Codex local.');
  });
  const loadRequirements = () => run(async () => {
    if(!draft) return; const id=String(draft.fields.categoryId?.value || '');
    const data=await mercadoLivreService.getCategoryRequirements(id);
    if(!Array.isArray(data.attributes)) throw new Error('Exigências da categoria indisponíveis.');
    const required=data.attributes.filter((a:any)=>a.tags?.required || a.tags?.conditionally_required);
    update(editField(draft,'categoryRequirements',{categoryId:id,requiredAttributes:required.map((a:any)=>a.id),requiredCertificates:required.filter((a:any)=>/ANATEL|INMETRO/i.test(a.id)).map((a:any)=>a.id),allowsLegacyVariations:false},{kind:'official_document',reference:`https://api.mercadolibre.com/categories/${id}/attributes`}));
    setOfficialAttributes(data.attributes.filter((a:any)=>!a.tags?.read_only));
    setNotice('Exigências oficiais carregadas. Confira os atributos e confirme a revisão.');
  });
  const validateRemote = () => run(async () => { if(!batch || !draft) return; setPreview(await mercadoLivreService.previewPublication(batch.sellerId,draft)); setNotice('Prévia validada pelo Mercado Livre. Confira antes de publicar.'); });
  const publish = () => {
    if(!batch || !draft || !preview || !window.confirm(`Publicar ${draft.sku} na conta ${batch.snapshot.nickname || batch.sellerId}, com preço e frete revisados?`)) return;
    void run(async () => {const result=await mercadoLivreService.publishPrepared(batch.sellerId,draft);setPreview(null);setBatch({...batch,snapshot:{...batch.snapshot,links:[...batch.snapshot.links,{product_id:draft.productId,item_id:result.itemId,variation_id:''}]}});setNotice(`Anúncio ${result.itemId} publicado e vinculado ao produto.`);});
  };
  return <main className="max-w-6xl mx-auto p-6 space-y-5 text-gray-900">
    <h1 className="text-2xl font-bold">Criar anúncios • Mercado Livre</h1>
    <p>Carregue os produtos, pesquise com o Codex local e revise as informações. Depois valide e publique na conta conectada.</p>
    <p className="bg-amber-50 border p-3 rounded">A pesquisa usa seu login do Codex neste computador. Dados e regras comerciais precisam de revisão. Salve o rascunho antes de sair. Publique produtos simples ou variantes individuais; produtos pai precisam ser separados por variante.</p>
    {notice && <p role="status" className="whitespace-pre-wrap bg-blue-50 p-3">{notice}</p>}
    {busy && <p role="status">Trabalhando, aguarde…</p>}
    <fieldset disabled={busy} className="contents">
    <button onClick={loadCatalog} className="rounded bg-yellow-400 px-4 py-3 font-semibold">1. Carregar produtos do sistema</button>
    <button onClick={()=>{try{const saved=localStorage.getItem('mdv.ml.last-draft');if(!saved)throw new Error('Nenhum rascunho salvo neste navegador.');loadDraft(JSON.parse(saved));setNotice('Rascunho restaurado. Confira novamente os dados e fontes antes de publicar.');}catch(e){setError(e instanceof Error?e.message:'Rascunho indisponível.');}}} className="border rounded p-3 ml-2">Restaurar último rascunho</button>
    {localPilotFile && <button className="border rounded p-3 font-semibold" onClick={async () => { try { if (localPilotFile !== '/pilot/glamir-rascunho-piloto.json') throw new Error('Arquivo piloto não autorizado.'); const response = await fetch(localPilotFile); if (!response.ok) throw new Error('Lote piloto local indisponível.'); loadDraft(await response.json()); } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar piloto.'); } }}>Carregar lote piloto local GLAMIR</button>}
    <details><summary className="cursor-pointer text-sm">Importar arquivos de uma preparação anterior</summary><div className="flex flex-wrap gap-4 mt-3">
      <label className="border p-3 rounded">1. Importar snapshot de catálogo/conta/vínculos/anúncios <input type="file" accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0], 'snapshot'); e.target.value = ''; }} /></label>
      <label className="border p-3 rounded">3. Importar propostas do assistente <input disabled={!batch?.drafts.length} type="file" accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0], 'proposal'); e.target.value = ''; }} /></label>
      <label className="border p-3 rounded">Reabrir rascunho salvo <input type="file" accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0], 'draft'); e.target.value = ''; }} /></label>
    </div></details>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {batch && <>
      <p>Conta: {batch.snapshot.nickname || batch.sellerId} ({batch.sellerId}) • Consulta: {batch.snapshot.capturedAt} • {batch.snapshot.complete ? 'Inventário declarado completo' : 'Inventário incompleto: prontidão bloqueada'}</p>
      <details className="border rounded p-4 space-y-2"><summary className="cursor-pointer">Configuração da conta {batch.accountMode.confirmed ? '• conferida' : '• precisa de revisão'}</summary>
        <h2 className="font-bold">Modo da conta — confirmação obrigatória</h2>
        <select aria-label="Modo da conta" value={batch.accountMode.value} onChange={e => setBatch({ ...batch, accountMode: { value: e.target.value, sources: [], confirmed: false } })} className="border p-2"><option value="unknown">Desconhecido</option><option value="legacy">Legado</option><option value="user_products">User Products</option></select>
        <input aria-label="Evidência do modo da conta" placeholder="Fonte/evidência consultada da conta" value={modeSource} onChange={e => { setModeSource(e.target.value); setBatch({ ...batch, accountMode: { ...batch.accountMode, confirmed: false, sources: [] } }); }} className="border p-2 mx-2 w-96" />
        <button disabled={!modeSource.trim() || batch.accountMode.value === 'unknown'} onClick={() => setBatch({ ...batch, accountMode: { ...batch.accountMode, confirmed: true, sources: [{ kind: 'operator', reference: modeSource.trim() }] } })} className="border p-2">Confirmar modo verificado</button>
        <p>{batch.accountMode.confirmed ? 'Modo confirmado pelo operador.' : 'Modo pendente; contratos de prévia permanecem bloqueados.'}</p>
      </details>
      <section className="border rounded p-4">
        <h2 className="font-bold">2. Selecionar produtos locais</h2><input aria-label="Filtrar produtos" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome ou SKU" className="border p-2 w-full my-2" />
        <div className="max-h-72 overflow-auto">{batch.snapshot.products.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase())).map(p => {
          const selected = batch.drafts.some(d => d.productId === p.id), linked = batch.snapshot.links.some(l => l.product_id === p.id), listed = batch.snapshot.listings.some(l => l.sku && l.sku === p.sku);
          return <label key={p.id} className="flex gap-2 border-b py-2"><input type="checkbox" checked={selected} onChange={() => { setBatch({ ...batch, drafts: selected ? batch.drafts.filter(d => d.productId !== p.id) : [...batch.drafts, createDraft(p, batch.snapshot)] }); if (!selected) setActive(p.id); }} />{p.sku || 'SEM SKU'} — {p.name} {linked ? '• vínculo existente' : listed ? '• SKU já anunciado' : ''}{p.parent_id ? ' • variante' : ''}</label>;
        })}</div>
        <button disabled={!batch.drafts.length || batch.drafts.length>5} onClick={research} className="rounded bg-yellow-400 p-3 mt-3 font-semibold">Pesquisar e comparar com o Codex local</button>
        <button disabled={!batch.drafts.length} onClick={() => download('ml-pesquisa-assistida.json', researchPacket(batch))} className="border p-2 mt-3 ml-2">Exportar pesquisa manual</button>
      </section>
      <section className="border rounded p-4 space-y-3">
        <h2 className="font-bold">4. Revisar propostas e pendências</h2>
        <MercadoLivrePricingPolicy batch={batch} active={active} run={run} onApply={drafts=>{setBatch({...batch,drafts});setNotice('Preços calculados. Confira o demonstrativo e confirme preço e condições comerciais de cada anúncio.');}} />
        <select aria-label="Rascunho em revisão" value={active} onChange={e => { setActive(e.target.value); setValue(''); setReference(''); }} className="border p-2"><option value="">Selecione um rascunho</option>{batch.drafts.map(d => <option key={d.productId} value={d.productId}>{d.sku} — {reports.find(r => r.productId === d.productId)?.status === 'ready_for_local_preview' ? 'Pronto para prévia' : 'Revisão pendente'}</option>)}</select>
        {draft && <>
          <p className="text-sm bg-slate-50 p-3">Dados aproveitados do cadastro: {(() => {const p=batch.snapshot.products.find(p=>p.id===draft.productId);return [p?.color && `cor ${p.color}`,p?.weight_kg && `peso cadastrado ${Math.round(p.weight_kg*1000)} g`,p?.dimensions && `medidas ${p.dimensions.height_cm} × ${p.dimensions.width_cm} × ${p.dimensions.depth_cm} cm`,p?.warranty_days!==undefined && `garantia ${p.warranty_days} dias (${p.warranty_type})`].filter(Boolean).join(' • ') || 'Confira os campos abaixo.';})()} . Para frete, confira se peso e medidas incluem embalagem.</p>
          <PricingSummary quote={draft.fields.commercialPolicy?.value?.pricingQuote} />
          <section className="border rounded p-4 space-y-3">
            <h3 className="font-semibold">Condições comerciais</h3>
            <p className="text-sm">Defina suas condições. A pesquisa não escolhe preço, frete ou garantia.</p>
            <label className="block text-sm">Tipo do anúncio<select className="block border rounded p-2" value={draft.fields.commercialPolicy?.value?.listingTypeId || ''} onChange={e=>update(editField(draft,'commercialPolicy',{...(draft.fields.commercialPolicy?.value || {}),listingTypeId:e.target.value},{kind:'operator',reference:`condições revisadas:${draft.sku}`}))}><option value="">Selecione</option><option value="gold_special">Clássico</option><option value="gold_pro">Premium</option></select></label>
            {(['warranty','warrantyTime'] as const).map(key=><label key={key} className="block text-sm">{{warranty:'Tipo da garantia (ex.: Garantia do vendedor)',warrantyTime:'Prazo da garantia (ex.: 90 dias)'}[key]}<input className="block border rounded p-2 w-full" value={draft.fields.commercialPolicy?.value?.[key] || ''} onChange={e=>update(editField(draft,'commercialPolicy',{...(draft.fields.commercialPolicy?.value || {}),[key]:e.target.value},{kind:'operator',reference:`condições revisadas:${draft.sku}`}))} /></label>)}
            <label className="block text-sm">Modo de envio<select className="block border rounded p-2" value={draft.fields.commercialPolicy?.value?.shipping?.mode || ''} onChange={e=>update(editField(draft,'commercialPolicy',{...(draft.fields.commercialPolicy?.value || {}),shipping:{...(draft.fields.commercialPolicy?.value?.shipping || {}),mode:e.target.value}},{kind:'operator',reference:`frete revisado:${draft.sku}`}))}><option value="">Selecione</option><option value="me2">Mercado Envios</option><option value="custom">Envio combinado com o comprador</option></select></label>
            <label className="block text-sm">Quem paga o frete?<select className="block border rounded p-2" value={draft.fields.commercialPolicy?.value?.shipping?.payer || ''} onChange={e=>update(editField(draft,'commercialPolicy',{...(draft.fields.commercialPolicy?.value || {}),shipping:{...(draft.fields.commercialPolicy?.value?.shipping || {}),payer:e.target.value,freeShipping:e.target.value==='seller'}},{kind:'operator',reference:`frete revisado:${draft.sku}`}))}><option value="">Selecione</option><option value="buyer">Comprador</option><option value="seller">Vendedor — grátis para o comprador</option></select></label>
            <button className="border rounded p-2" onClick={()=>{if(window.confirm('Todas as fotos cadastradas são suas e podem ser usadas neste anúncio?')) update(editField(draft,'photos',(draft.fields.photos?.value || []).map((p:any)=>({...p,rights:'own',evidence:`Declaração do operador: fotos próprias do produto ${draft.sku}`})),{kind:'operator',reference:`fotos próprias:${draft.sku}`}));}}>Declarar autoria das fotos cadastradas</button>
          </section>
          <button onClick={loadRequirements} disabled={!draft.fields.categoryId?.value} className="border rounded p-3">Consultar exigências oficiais da categoria</button>
          {officialAttributes.length>0 && <div className="grid gap-3 sm:grid-cols-2">{officialAttributes.map(a=><label key={a.id} className="text-sm">{a.name}{a.tags?.required || a.tags?.conditionally_required ? ' • obrigatório' : ''}<input className="border rounded p-2 block w-full" value={draft.fields.attributes?.value?.[a.id] || ''} placeholder={a.values?.slice(0,3).map((v:any)=>v.name).join(', ')} onChange={e=>{const attributes={...(draft.fields.attributes?.value || {})};if(e.target.value)attributes[a.id]=e.target.value;else delete attributes[a.id];update(editField(draft,'attributes',attributes,{kind:'operator',reference:`revisão:${draft.sku}`}));}} /></label>)}</div>}
          <div className="grid md:grid-cols-2 gap-4"><div className="space-y-2">{FIELD_NAMES.map(name => { const f = draft.fields[name]; return <div key={name} className="border p-2 rounded">
            <button className="underline font-semibold" onClick={() => selectField(name)}>{labels[name]}</button> • {f?.conflict ? 'Conflito' : f?.confirmed ? 'Confirmado' : 'Pendente'}
            {structured.has(name) ? <details className="text-sm"><summary>Ver informações de {labels[name].toLowerCase()}</summary><pre className="text-xs overflow-auto max-h-48 whitespace-pre-wrap">{JSON.stringify(f?.value ?? null,null,2)}</pre></details> : <p className="whitespace-pre-wrap text-sm">{name==='priceCents' ? (Number(f?.value || 0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : name==='condition' ? ({new:'Novo',used:'Usado',not_specified:'Não especificado'}[String(f?.value)] || 'Não informado') : String(f?.value ?? 'Não informado')}</p>}
            <details className="text-xs break-all"><summary>Fontes consultadas</summary>{f?.sources.map(s => s.reference).join(' | ') || 'Sem fonte'}</details>
            {f?.conflict ? <><pre className="text-xs whitespace-pre-wrap">Proposta: {JSON.stringify(f.conflict.value)}</pre><p className="text-xs break-all">{f.conflict.sources.map(s => `${s.kind}: ${s.reference}`).join(' | ')}</p><button className="border p-1 mr-2" onClick={() => update(resolveConflict(draft, name, 'current'))}>Manter atual</button><button className="border p-1" onClick={() => update(resolveConflict(draft, name, 'proposal'))}>Aceitar proposta</button></> : <label className="text-sm"><input type="checkbox" checked={!!f?.confirmed} disabled={!f?.sources.length} onChange={e => update(confirmField(draft, name, e.target.checked))} /> Conferi valor e fontes</label>}
          </div>; })}</div><div className="space-y-3">
            <h3 className="font-bold">Editar: {labels[field]}</h3>
            {field === 'priceCents' ? <CurrencyInput value={Number(value) || 0} onChange={n => setValue(String(n))} /> : <textarea aria-label={`Valor de ${labels[field]}`} rows={structured.has(field) ? 10 : 4} value={value} onChange={e => setValue(e.target.value)} className="border p-2 w-full font-mono text-sm" />}
            <select aria-label="Tipo da fonte" className="border p-2" value={kind} onChange={e => setKind(e.target.value as SourceKind)}>{kinds.map(k => <option key={k}>{k}</option>)}</select>
            <input aria-label="Referência da fonte" placeholder="URL ou referência verificável" value={reference} onChange={e => setReference(e.target.value)} className="border p-2 w-full" />
            <button onClick={save} className="border p-2">Salvar edição e revisar confirmação</button>
            <h3 className="font-bold">Pendências</h3><ul className="space-y-2">{report?.issues.map((i, n) => <li key={n} className={i.level === 'blocker' ? 'text-red-700' : 'text-amber-800'}>{i.level === 'blocker' ? 'Bloqueio' : 'Aviso'}: {i.message}</li>)}</ul>
            <details><summary>Dados técnicos da prévia</summary><pre className="bg-gray-50 p-2 overflow-auto text-xs whitespace-pre-wrap">{previewContract(batch, draft) ? JSON.stringify(previewContract(batch, draft), null, 2) : 'Prévia bloqueada'}</pre></details>
          </div></div>
        </>}
        <button onClick={() => download('ml-relatorio-local.json', { batch, reports, previews: batch.drafts.map(d => previewContract(batch, d)) })} className="border p-2">Exportar relatório e propostas revisadas</button>
        <button onClick={() => download('ml-rascunho-local.json', draftFile(batch))} className="border p-2 ml-2">Salvar rascunho em arquivo</button>
        <div className="border-t pt-4 space-y-3">
          <button disabled={!draft || report?.status!=='ready_for_local_preview'} onClick={validateRemote} className="rounded bg-slate-900 text-white p-3 disabled:opacity-50">Validar anúncio no Mercado Livre</button>
          {preview?.pricing && <PricingSummary quote={preview.pricing} />}
          {preview?.validation?.cause?.filter((cause: any) => cause.type === 'warning').map((cause: any, index: number) => <p key={`${cause.code}-${index}`} role="status">Aviso do Mercado Livre: {cause.message || cause.code}</p>)}
          {preview && <><p>Preço: {Number(preview.payload.price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} • Quantidade: {preview.payload.available_quantity} • Frete grátis: {preview.payload.shipping.free_shipping ? 'sim' : 'não'}</p><details><summary>Ver detalhes do envio</summary><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(preview.payload,null,2)}</pre></details><button onClick={publish} className="rounded bg-green-700 text-white p-3">Publicar anúncio revisado</button></>}
          <button disabled={!draft} onClick={()=>{if(batch && draft && window.confirm('Retomar somente um envio anterior que falhou, sem criar outro anúncio?')) void run(async()=>{const result=await mercadoLivreService.publishPrepared(batch.sellerId,draft,true);setNotice(`Envio concluído: ${result.itemId}. Recarregue o catálogo.`);});}} className="border rounded p-3 ml-2">Retomar envio interrompido</button>
        </div>
      </section>
    </>}
    </fieldset>
  </main>;
}
