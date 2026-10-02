import React, { useEffect, useRef, useState } from 'react';
import MercadoLivrePricingPolicy, { PricingSummary } from './MercadoLivrePricingPolicy';
import { mercadoLivreService } from '../../../services/mercadoLivreService';
import { CurrencyInput } from '../../../components/ui/CurrencyInput';
import { FIELD_NAMES, createBatch, editField, confirmField, resolveConflict, parseSnapshot, importProposals, evaluateBatch, previewContract, researchPacket, restoreDraftFile, draftFile, productGroups, selectionBlock, selectProductGroup, selectedGroupCount } from '../../../services/mercadoLivrePreparation';
import type { Batch, FieldName, SourceKind } from '../../../services/mercadoLivrePreparation';

const labels: Record<FieldName, string> = { title: 'Título legado', familyName: 'Nome da família (User Products)', description: 'Descrição', categoryId: 'Categoria', categoryRequirements: 'Requisitos oficiais da categoria', condition: 'Condição', priceCents: 'Preço', quantity: 'Quantidade', photos: 'Fotos e autorização', attributes: 'Atributos', gtin: 'GTIN', certificates: 'Certificações e evidências', commercialPolicy: 'Política comercial', variations: 'Variantes' };
const structured = new Set<FieldName>(['categoryRequirements', 'photos', 'attributes', 'certificates', 'commercialPolicy', 'variations']);
const kinds: SourceKind[] = ['catalog', 'manufacturer', 'official_catalog', 'official_document', 'operator', 'authorized_photo', 'marketplace_reference'];
// String marker in the draft; the publication service serializes the official value_id -1.
const notApplicable = '__ML_NOT_APPLICABLE__';
const attributeRequired = (a:any, condition:unknown) => !!(a.tags?.required || (condition==='new' && a.tags?.new_required));
function AttributeInput({attribute:a,value,onChange,disabled=false}:{attribute:any;value:string;onChange:(value:string)=>void;disabled?:boolean}) {
  const options=a.values || [], units=a.allowed_units || [];
  const common={className:'border rounded p-2 block w-full',disabled,'aria-label':a.name};
  if(a.value_type==='boolean') return <select {...common} value={value} onChange={e=>onChange(e.target.value)}><option value="">Selecione</option>{value && !options.some((v:any)=>v.name===value) && <option value={value}>{value}</option>}{options.map((v:any)=><option key={v.id} value={v.name}>{v.name}</option>)}</select>;
  if(a.value_type==='number_unit' && units.length) {
    const match=value.match(/^(.*?)\s+([^\s]+)$/), amount=match?match[1]:value, unit=match?match[2]:(a.default_unit || units[0].id);
    return <div className="flex gap-2"><input {...common} type="text" inputMode="decimal" value={amount} placeholder="Valor" onChange={e=>onChange(e.target.value?`${e.target.value} ${unit}`:'')} /><select className="border rounded p-2" aria-label={`Unidade de ${a.name}`} disabled={disabled} value={unit} onChange={e=>onChange(amount?`${amount} ${e.target.value}`:'')}>{!units.some((u:any)=>u.id===unit) && <option value={unit}>{unit}</option>}{units.map((u:any)=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>;
  }
  return <><input {...common} type="text" inputMode={a.value_type==='number'?'decimal':undefined} maxLength={a.value_max_length} value={value} list={options.length?`ml-attribute-${a.id}`:undefined} placeholder={a.tags?.multivalued?'Valores separados por vírgula':'Preencher com informação comprovada'} onChange={e=>onChange(e.target.value)} />{options.length>0 && <datalist id={`ml-attribute-${a.id}`}>{options.map((v:any)=><option key={v.id} value={v.name}/>)}</datalist>}</>;
}
const download = (name: string, value: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function MercadoLivrePreparationPage({ localPilotFile }: {localPilotFile?:string}) {
  const [batch, setBatch] = useState<Batch | null>(null), [active, setActive] = useState(''), [query, setQuery] = useState('');
  const [error, setError] = useState(''), [field, setField] = useState<FieldName>('title'), [value, setValue] = useState('');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [categoryData, setCategoryData] = useState<Record<string,any>>({}), [categoryLoading,setCategoryLoading]=useState(false), [categoryError,setCategoryError]=useState(''), [categoryReload,setCategoryReload]=useState(0);
  const categoryRequests=useRef(new Map<string,Promise<any>>());
  const [familyPreviews, setFamilyPreviews] = useState<{productId:string; data:any}[]>([]);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setPreview(null); setFamilyPreviews([]); }, [batch, active]);
  useEffect(() => {
    if(!batch?.drafts.length) return;
    try { localStorage.setItem('mdv.ml.last-draft',JSON.stringify(draftFile(batch))); } catch { /* Manual file export remains available when browser storage is full. */ }
  }, [batch]);
  const [kind, setKind] = useState<SourceKind>('operator'), [reference, setReference] = useState(''), [modeSource, setModeSource] = useState('');
  const [, refreshClock] = useState(0);
  useEffect(() => { const timer = setInterval(() => refreshClock(n => n + 1), 30000); return () => clearInterval(timer); }, []);
  const reports = batch ? evaluateBatch(batch) : [];
  const draft = batch?.drafts.find(d => d.productId === active), report = reports.find(r => r.productId === active);
  const categoryId=String(draft?.fields.categoryId?.value || ''), condition=draft?.fields.condition?.value;
  const officialAttributes=categoryData[categoryId]?.attributes || [];
  useEffect(()=>{
    let cancelled=false;
    setCategoryError('');setCategoryLoading(false);
    if(!draft || !/^MLB\d+$/.test(categoryId)) return;
    const productId=draft.productId;
    const apply=(data:any)=>{
      if(cancelled || !alive.current) return;
      setCategoryData(previous=>({...previous,[categoryId]:data}));
      setBatch(previous=>{
        if(!previous) return previous;
        const current=previous.drafts.find(d=>d.productId===productId);
        if(!current || current.fields.categoryId?.value!==categoryId) return previous;
        const required=data.attributes.filter((a:any)=>attributeRequired(a,current.fields.condition?.value));
        const requirements={categoryId,requiredAttributes:required.map((a:any)=>a.id),requiredCertificates:required.filter((a:any)=>/ANATEL|INMETRO/i.test(a.id)).map((a:any)=>a.id),allowsLegacyVariations:false,attributeDefinitions:data.attributes};
        if(JSON.stringify(current.fields.categoryRequirements?.value)===JSON.stringify(requirements) && current.fields.categoryRequirements?.sources.some(s=>s.kind==='official_document')) return previous;
        const next=editField(current,'categoryRequirements',requirements,{kind:'official_document',reference:`https://api.mercadolibre.com/categories/${categoryId}/attributes`});
        return {...previous,drafts:previous.drafts.map(d=>d.productId===productId?next:d)};
      });
    };
    if(categoryData[categoryId]) {apply(categoryData[categoryId]);return ()=>{cancelled=true;};}
    setCategoryLoading(true);
    let request=categoryRequests.current.get(categoryId);
    if(!request) {
      request=mercadoLivreService.getCategoryRequirements(categoryId).then(data=>{
        if(data.category?.id!==categoryId || !Array.isArray(data.attributes)) throw new Error('Ficha oficial da categoria indisponível.');
        return data;
      }).finally(()=>categoryRequests.current.delete(categoryId));
      categoryRequests.current.set(categoryId,request);
    }
    request.then(apply).catch(e=>{if(!cancelled && alive.current)setCategoryError(e instanceof Error?e.message:'Falha ao consultar atributos.');}).finally(()=>{if(!cancelled && alive.current)setCategoryLoading(false);});
    return ()=>{cancelled=true;};
  },[active,categoryId,condition,categoryReload]);
  const activeParent = batch?.snapshot.products.find(p => p.id === active)?.parent_id;
  const familyDrafts = batch?.drafts.filter(d => activeParent && batch.snapshot.products.find(p => p.id === d.productId)?.parent_id === activeParent) || [];
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
    setNotice('Catálogo e anúncios consultados. Selecione até 5 famílias ou produtos simples. Ao marcar o pai, todas as variações disponíveis e ainda não anunciadas serão incluídas.');
  });
  const research = () => run(async () => {
    if (!batch) return;
    if (!import.meta.env.DEV || !['localhost','127.0.0.1','[::1]'].includes(location.hostname)) throw new Error('Abra o sistema no computador com npm run dev para usar o Codex local.');
    const headers = {'Content-Type':'application/json','x-mdv-local-research':'1'};
    let researched = batch;
    for (let offset=0; offset<batch.drafts.length; offset+=5) {
    const chunk={...batch,drafts:batch.drafts.slice(offset,offset+5).map(d=>{
      const id=String(d.fields.categoryId?.value || ''), definitions=categoryData[id]?.attributes;
      return definitions?{...d,fields:{...d.fields,categoryRequirements:{value:{...(d.fields.categoryRequirements?.value || {}),attributeDefinitions:definitions},sources:d.fields.categoryRequirements?.sources || [],confirmed:false}}}:d;
    })};
    const started = await fetch('/__ml-local/research', {method:'POST',headers,body:JSON.stringify(researchPacket(chunk))});
    const job = await started.json(); if (!started.ok) throw new Error(job.error || 'Codex local indisponível.');
    setNotice('Codex pesquisando modelos e comparando anúncios. Você pode aguardar nesta tela.');
    const deadline=Date.now()+920000;
    while(alive.current && Date.now()<deadline) {
      await new Promise(resolve=>setTimeout(resolve,2500)); if(!alive.current) return;
      const response=await fetch(`/__ml-local/research?id=${encodeURIComponent(job.id)}`,{headers}); const result=await response.json();
      if(!response.ok || result.status==='failed') throw new Error(result.error || 'Pesquisa indisponível.');
      if(result.status==='complete') {researched=importProposals(researched,result.result);setBatch(researched);setNotice(['Pesquisa recebida. Confira propostas e resolva diferenças.',...(result.result.notes || [])].join('\n'));break;}
    }
    if(!alive.current) return;
    if(Date.now()>=deadline) throw new Error('Tempo de espera excedido. Confira o Codex local.');
    }
  });
  const loadRequirements = () => {setCategoryData(previous=>{const next={...previous};delete next[categoryId];return next;});setCategoryReload(n=>n+1);};
  const validateRemote = () => run(async () => { if(!batch || !draft) return; setPreview(await mercadoLivreService.previewPublication(batch.sellerId,draft)); setNotice('Prévia validada pelo Mercado Livre. Confira antes de publicar.'); });
  const publish = () => {
    if(!batch || !draft || !preview || !window.confirm(`Publicar ${draft.sku} na conta ${batch.snapshot.nickname || batch.sellerId}, com preço e frete revisados?`)) return;
    void run(async () => {const result=await mercadoLivreService.publishPrepared(batch.sellerId,draft);setPreview(null);setBatch({...batch,snapshot:{...batch.snapshot,links:[...batch.snapshot.links,{product_id:draft.productId,item_id:result.itemId,variation_id:''}]}});setNotice(`Anúncio ${result.itemId} publicado e vinculado ao produto.`);});
  };
  const validateFamily = () => run(async () => {
    if (!batch || !familyDrafts.length) return;
    setFamilyPreviews([]);
    if (batch.accountMode.value !== 'user_products') throw new Error('Envio agrupado de família exige uma conta User Products. Confira o modo da conta.');
    if (familyDrafts.some(d => reports.find(r => r.productId === d.productId)?.status !== 'ready_for_local_preview')) throw new Error('Confira as pendências de todas as variações da família antes de validar.');
    const signature = (d:typeof familyDrafts[number]) => JSON.stringify([d.fields.familyName?.value,d.fields.categoryId?.value,d.fields.condition?.value,d.fields.attributes?.value?.BRAND,d.fields.attributes?.value?.MODEL]);
    if (new Set(familyDrafts.map(signature)).size !== 1) throw new Error('Nome da família, categoria, condição, marca e modelo precisam coincidir entre as variações.');
    const validated=[];
    for(const d of familyDrafts) validated.push({productId:d.productId,data:await mercadoLivreService.previewPublication(batch.sellerId,d)});
    setFamilyPreviews(validated);setNotice(`${validated.length} variações da família validadas. Confira os preços e estoques antes de enviar.`);
  });
  const publishFamily = () => {
    if(!batch || !familyPreviews.length || !window.confirm(`Enviar ${familyPreviews.length} variações da família para ${batch.snapshot.nickname || batch.sellerId}? Cada variação terá seu SKU, fotos, preço e estoque revisados.`)) return;
    void run(async()=>{
      let next=batch; const completed:string[]=[];
      for(const validated of familyPreviews) {
        const d=next.drafts.find(d=>d.productId===validated.productId);
        if(!d) throw new Error('Seleção mudou. Valide a família novamente.');
        try {
          const result=await mercadoLivreService.publishPrepared(next.sellerId,d);
          completed.push(`${d.sku}: ${result.itemId}`);
          next={...next,snapshot:{...next.snapshot,links:[...next.snapshot.links,{product_id:d.productId,item_id:result.itemId,variation_id:''}]}};
          setBatch(next);setNotice(`Envios concluídos: ${completed.join(' • ')}`);
        } catch(e) { throw new Error(`Envio interrompido em ${d.sku}. ${completed.length} variações concluídas e vinculadas. Recarregue o catálogo para continuar sem duplicar. ${e instanceof Error?e.message:''}`); }
      }
      setFamilyPreviews([]);setNotice(`Família enviada: ${completed.join(' • ')}. Recarregue o catálogo para conferir os vínculos.`);
    });
  };
  return <main className="max-w-6xl mx-auto p-6 space-y-5 text-gray-900">
    <h1 className="text-2xl font-bold">Criar anúncios • Mercado Livre</h1>
    <p>Carregue os produtos, pesquise com o Codex local e revise as informações. Depois valide e publique na conta conectada.</p>
    <p className="bg-amber-50 border p-3 rounded">Selecione o produto pai para preparar sua família completa. Variações já anunciadas ou sem estoque ficam identificadas no grupo. Confira os dados de cada variação, valide a família e envie todas as selecionadas.</p>
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
        <div className="max-h-96 overflow-auto">{productGroups(batch.snapshot).filter(g => [g.product,...g.members].some(p=>`${p.name} ${p.sku} ${p.color || ''}`.toLowerCase().includes(query.toLowerCase()))).map(g => {
          const eligible=g.members.filter(p=>!selectionBlock(batch.snapshot,p)), count=eligible.filter(p=>batch.drafts.some(d=>d.productId===p.id)).length;
          const selected=eligible.length>0 && count===eligible.length;
          return <div key={g.product.id} className="border-b py-2"><label className="flex gap-2 font-semibold"><input type="checkbox" aria-label={g.family?`Selecionar família ${g.product.sku}`:undefined} checked={selected} disabled={!eligible.length || (!count && selectedGroupCount(batch)>=5)} onChange={()=>{const next=selectProductGroup(batch,g.product.id);setBatch(next);if(!selected)setActive(next.drafts.find(d=>eligible.some(p=>p.id===d.productId))?.productId || '');else if(g.members.some(p=>p.id===active))setActive(next.drafts[0]?.productId || '');}} />{g.product.sku || 'SEM SKU'} — {g.product.name}{g.family?` • ${g.members.length} variações • ${count}/${eligible.length} selecionadas`:selectionBlock(batch.snapshot,g.product)?` • ${selectionBlock(batch.snapshot,g.product)}`:''}</label>{g.family && <ul className="pl-7 text-sm">{g.members.map(p=><li key={p.id} className="py-1">{batch.drafts.some(d=>d.productId===p.id)?'✓ ':''}{p.sku} — {p.color || p.name} • Estoque: {p.stock_quantity ?? 'não informado'} • {selectionBlock(batch.snapshot,p) || 'Disponível para envio'}</li>)}</ul>}</div>;
        })}</div>
        <p className="text-sm mt-2">{selectedGroupCount(batch)} famílias/produtos selecionados • {batch.drafts.length} variações/produtos para preparar. A pesquisa ocorre em lotes de até 5 variações.</p>
        <button disabled={!batch.drafts.length || selectedGroupCount(batch)>5} onClick={research} className="rounded bg-yellow-400 p-3 mt-3 font-semibold">Pesquisar e comparar com o Codex local</button>
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
          <section aria-label="Ficha técnica da categoria" className="border rounded p-4 space-y-3">
            <h3 className="font-semibold">Todos os atributos da categoria {categoryData[categoryId]?.category?.name || categoryId}</h3>
            <p className="text-sm">A ficha é carregada automaticamente ao definir a categoria. Aproveite o cadastro, pesquise as lacunas e confira cada informação antes do envio.</p>
            <button onClick={loadRequirements} disabled={!/^MLB\d+$/.test(categoryId) || categoryLoading} className="border rounded p-3">Consultar exigências oficiais da categoria</button>
            {categoryLoading && <p role="status">Carregando todos os atributos oficiais…</p>}
            {categoryError && <p role="alert" className="text-red-700">{categoryError} Tente consultar novamente.</p>}
            {officialAttributes.length>0 && Object.keys(draft.fields.attributes?.value || {}).some(id=>!officialAttributes.some((a:any)=>a.id===id)) && <p role="alert" className="text-amber-800">Há atributos preenchidos que não pertencem a esta categoria: {Object.keys(draft.fields.attributes?.value || {}).filter(id=>!officialAttributes.some((a:any)=>a.id===id)).join(', ')}. Revise o mapa de Atributos antes de enviar.</p>}
            {officialAttributes.length>0 && <button onClick={research} className="rounded bg-yellow-400 p-3">Pesquisar atributos pendentes com o Codex local</button>}
            {!categoryId && <p>Defina a categoria para carregar a ficha técnica.</p>}
            {officialAttributes.length>0 && <><p className="text-sm">{officialAttributes.length} atributos oficiais • {officialAttributes.filter((a:any)=>!a.tags?.read_only && !a.tags?.fixed && !a.tags?.inferred && !draft.fields.attributes?.value?.[a.id] && !(a.id==='GTIN' && draft.fields.gtin?.value) && !['SELLER_SKU','ITEM_CONDITION','SELLER_PACKAGE_HEIGHT','SELLER_PACKAGE_WIDTH','SELLER_PACKAGE_LENGTH','SELLER_PACKAGE_WEIGHT'].includes(a.id)).length} campos sem informação. Campos internos são preenchidos pelo Mercado Livre.</p><div className="grid gap-3 sm:grid-cols-2">{officialAttributes.map((a:any)=>{
              const p=batch.snapshot.products.find(p=>p.id===draft.productId);
              const managed:Record<string,string>={GTIN:String(draft.fields.gtin?.value || ''),SELLER_SKU:draft.sku,ITEM_CONDITION:({new:'Novo',used:'Usado',not_specified:'Não especificado'} as Record<string,string>)[String(condition)] || '',SELLER_PACKAGE_HEIGHT:p?.dimensions?`${Math.ceil(p.dimensions.height_cm)} cm`:'',SELLER_PACKAGE_WIDTH:p?.dimensions?`${Math.ceil(p.dimensions.width_cm)} cm`:'',SELLER_PACKAGE_LENGTH:p?.dimensions?`${Math.ceil(p.dimensions.depth_cm)} cm`:'',SELLER_PACKAGE_WEIGHT:p?.weight_kg?`${Math.ceil(p.weight_kg*1000)} g`:''};
              const internal=!!(a.tags?.read_only || a.tags?.fixed || a.tags?.inferred), isManaged=Object.prototype.hasOwnProperty.call(managed,a.id);
              const current=isManaged?managed[a.id]:String(draft.fields.attributes?.value?.[a.id] || (a.tags?.fixed?a.values?.[0]?.name || '':''));
              const change=(value:string)=>{const attributes={...(draft.fields.attributes?.value || {})};if(value)attributes[a.id]=value;else delete attributes[a.id];update(editField(draft,'attributes',attributes,{kind:'operator',reference:`revisão:${draft.sku}`}));};
              return <div key={a.id} className="border rounded p-3 text-sm"><label className="font-medium">{a.name} • {internal?'Gerenciado pelo Mercado Livre':isManaged?'Dados do cadastro/rascunho':attributeRequired(a,condition)?'Obrigatório':a.tags?.conditional_required || a.tags?.conditionally_required?'Condicional':'Opcional'}</label><span className="block text-xs text-gray-500">{a.id}{a.tags?.multivalued?' • aceita vários valores':''}</span><AttributeInput attribute={a} value={current===notApplicable?'':current} onChange={change} disabled={internal || isManaged || current===notApplicable}/>{!internal && !isManaged && !attributeRequired(a,condition) && !a.tags?.allow_variations && <label className="block mt-1"><input type="checkbox" checked={current===notApplicable} onChange={e=>change(e.target.checked?notApplicable:'')}/> Não se aplica — somente quando verdadeiro</label>}{!current && !internal && <p className="text-amber-800">Pendente: buscar informação ou confirmar.</p>}{isManaged && <p className="text-xs">Confira no campo correspondente do rascunho{a.id.startsWith('SELLER_PACKAGE_')?' e inclua a embalagem nas medidas':''}.</p>}</div>;
            })}</div></>}
          </section>
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
          {familyDrafts.length>0 && <section className="bg-blue-50 rounded p-3 space-y-2"><h3 className="font-semibold">Envio da família • {familyDrafts.length} variações selecionadas</h3><p>Revise cada rascunho. Já anunciadas e sem estoque não geram novos envios.</p><button disabled={familyDrafts.some(d=>reports.find(r=>r.productId===d.productId)?.status!=='ready_for_local_preview')} onClick={validateFamily} className="border rounded p-3">Validar família no Mercado Livre</button>{familyPreviews.length>0 && <><ul>{familyPreviews.map(p=><li key={p.productId}>{batch.drafts.find(d=>d.productId===p.productId)?.sku} • {Number(p.data.payload.price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} • Estoque: {p.data.payload.available_quantity}</li>)}</ul><button onClick={publishFamily} className="rounded bg-green-700 text-white p-3">Enviar todas as variações validadas</button></>}</section>}
          {!activeParent && <button disabled={!draft || report?.status!=='ready_for_local_preview'} onClick={validateRemote} className="rounded bg-slate-900 text-white p-3 disabled:opacity-50">Validar anúncio no Mercado Livre</button>}
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
