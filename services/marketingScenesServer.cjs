const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const core = import('./marketingSceneCore.mjs');
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode, sceneSafe: true });
const short = value => String(value || '').trim().slice(0, 200);
const safePexelsUrl = (value, image = false) => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port && (image ? u.hostname === 'images.pexels.com' : ['www.pexels.com', 'pexels.com'].includes(u.hostname)) ? u.href : ''; } catch { return ''; }
};

// Dependency injection keeps integration tests entirely local (no keys, network or production DB).
function createSceneRepository(pool) {
  return {
    async list() { const [rows] = await pool.query('SELECT data FROM marketing_scene_backgrounds ORDER BY created_at DESC LIMIT 1000'); return rows.map(r => parse(r.data)); },
    async get(id) { const [[row]] = await pool.query('SELECT data FROM marketing_scene_backgrounds WHERE id=?', [id]); return row ? parse(row.data) : null; },
    async put(b) { await pool.query('INSERT INTO marketing_scene_backgrounds (id,data) VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)', [b.id, JSON.stringify(b)]); return b; },
    async cacheGet(id) { const [[row]] = await pool.query('SELECT data FROM marketing_scene_cache WHERE id=? AND expires_at>?', [id, Date.now()]); return row ? parse(row.data) : null; },
    async cachePut(id, data, ttl) { await pool.query('DELETE FROM marketing_scene_cache WHERE expires_at<?', [Date.now()]); await pool.query('INSERT INTO marketing_scene_cache (id,data,expires_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data),expires_at=VALUES(expires_at)', [id, JSON.stringify(data), Date.now()+ttl]); },
    async selection(id) { const [[row]] = await pool.query('SELECT data FROM marketing_scene_selections WHERE product_id=?', [id]); return row ? parse(row.data) : null; },
    async select(id, data) { await pool.query('INSERT INTO marketing_scene_selections (product_id,data) VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)', [id, JSON.stringify(data)]); },
  };
}

function createSceneService({ repository, fetchImpl = fetch, apiKey = () => process.env.PEXELS_API_KEY, uploadsDir, concurrency = Number(process.env.BULK_IMAGE_CONCURRENCY || 3) }) {
  const inFlight = new Map();
  const cachedRate = () => repository.cacheGet('pexels-rate');
  async function request(query, locale, page) {
    const key = digest(JSON.stringify({ query, locale, page, orientation: 'portrait', size: 'large', per_page: 12 }));
    const cached = await repository.cacheGet(key);
    if (cached) return { ...cached, cached: true, queries: 0 };
    if (inFlight.has(key)) return { ...await inFlight.get(key), queries: 0 };
    const promise = (async () => {
      if (!apiKey()) throw fail('Pexels não configurado. Defina PEXELS_API_KEY somente na API.', 503);
      const rate = await cachedRate();
      if (rate?.blockedUntil > Date.now() || (rate?.remaining != null && rate.remaining <= 5 && rate.reset * 1000 > Date.now())) throw fail('Limite do Pexels próximo do fim. Use a biblioteca até a renovação.', 429);
      const url = new URL('https://api.pexels.com/v1/search');
      Object.entries({ query, locale, page, per_page: 12, orientation: 'portrait', size: 'large' }).forEach(([k,v]) => url.searchParams.set(k, String(v)));
      let response;
      try { response = await fetchImpl(url, { headers: { Authorization: apiKey() }, signal: AbortSignal.timeout(12000), redirect: 'error' }); }
      catch { throw fail('Tempo esgotado ou falha de rede ao consultar o Pexels.', 504); }
      if (response.status === 429) {
        const wait = Math.max(3600, Number(response.headers.get('retry-after')) || 0);
        await repository.cachePut('pexels-rate', { ...rate, blockedUntil: Date.now()+wait*1000 }, wait*1000);
      }
      if (!response.ok) throw fail(({401:'Chave do Pexels inválida.',403:'Acesso ao Pexels recusado.',404:'Pesquisa do Pexels indisponível.',429:'Limite do Pexels atingido. Use a biblioteca.'})[response.status] || 'Pexels temporariamente indisponível.', response.status >= 500 ? 502 : response.status);
      const numericHeader = name => response.headers.has(name) ? Number(response.headers.get(name)) : null;
      const limits = { limit: numericHeader('X-Ratelimit-Limit'), remaining: numericHeader('X-Ratelimit-Remaining'), reset: numericHeader('X-Ratelimit-Reset') };
      await repository.cachePut('pexels-rate', limits, Math.max(3600000, (limits.reset || 0)*1000-Date.now()));
      let body; try { body = await response.json(); } catch { throw fail('Resposta inválida do Pexels.', 502); }
      const photos = (Array.isArray(body.photos) ? body.photos : []).slice(0,12).filter(p => Number.isSafeInteger(p.id) && safePexelsUrl(p.src?.original, true) && safePexelsUrl(p.url)).map(p => ({
        id: `pexels-${p.id}`, pexelsPhotoId: p.id, origin: 'pexels', url: safePexelsUrl(p.src.original, true), thumbnail: safePexelsUrl(p.src.medium, true), photoPage: safePexelsUrl(p.url), photographer: short(p.photographer), photographerPage: safePexelsUrl(p.photographer_url), width: Number(p.width), height: Number(p.height), averageColor: /^#[\da-f]{6}$/i.test(p.avg_color) ? p.avg_color : '#172333', alt: short(p.alt), orientation: p.height > p.width ? 'portrait' : 'landscape', approved: false, active: true, imported: false, uses: 0, importedAt: null, lastUsedAt: null, query, discoveredAt: new Date().toISOString(),
      }));
      const result = { photos, limits, page, hasMore: Boolean(body.next_page), cached: false, queries: 1 };
      await repository.cachePut(key, result, 86400000);
      return result;
    })();
    inFlight.set(key, promise);
    try { return await promise; } finally { inFlight.delete(key); }
  }
  async function search(product, { query, locale = 'en-US', page = 1 } = {}) {
    const { resolveProductSceneContext, scoreBackground } = await core;
    const scene = resolveProductSceneContext(product);
    const result = await request(short(query) || (locale === 'pt-BR' ? scene.alternativeQuery : scene.primaryQuery), locale === 'pt-BR' ? 'pt-BR' : 'en-US', Math.min(100, Math.max(1, Number(page) || 1)));
    const items = [];
    for (const photo of result.photos) {
      let record = await repository.get(photo.id);
      if (!record) record = await repository.put({ ...photo, categoryId: product.category_id || null, subcategoryId: product.subcategory_id || null, contextKey: scene.key, context: scene.context, tags: scene.tags });
      items.push({ ...record, assessment: scoreBackground(record, product, scene) });
    }
    return { ...result, photos: undefined, items, scene, warning: 'Resultados avaliados por metadados. Revise pessoas, marcas, textos e acessórios antes de aprovar.' };
  }
  async function image(id) {
    const record = await repository.get(id);
    if (!record?.active) throw fail('Fundo indisponível.', 404);
    if (record.imported) {
      try { return await fs.readFile(path.join(uploadsDir, 'marketing-scenes', `${digest(id)}.jpg`)); } catch { throw fail('Arquivo do fundo indisponível. Importe novamente.', 404); }
    }
    const url = safePexelsUrl(record.url, true);
    if (!url) throw fail('Origem de imagem não permitida.');
    const u = new URL(url); u.searchParams.set('w','1440'); u.searchParams.set('auto','compress');
    try {
      const response = await fetchImpl(u, { signal: AbortSignal.timeout(15000), redirect: 'error' });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw Error();
      const chunks = []; let size = 0;
      for await (const chunk of response.body) { size += chunk.length; if(size > 12000000) throw Error(); chunks.push(chunk); }
      return await sharp(Buffer.concat(chunks), { limitInputPixels: 40000000 }).rotate().resize(1440,2560,{fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
    } catch { throw fail('Imagem do cenário inacessível, muito grande ou inválida.', 502); }
  }
  async function importBackground(id, approved) {
    const record = await repository.get(id); if (!record) throw fail('Fundo não encontrado.',404);
    const bytes = await image(id);
    const directory = path.join(uploadsDir,'marketing-scenes'); await fs.mkdir(directory,{recursive:true});
    const target = path.join(directory,`${digest(id)}.jpg`);
    await fs.writeFile(target, bytes, { flag: 'w' });
    return repository.put({ ...record, approved: approved === true, imported: true, importedAt: record.importedAt || new Date().toISOString() });
  }
  async function upload(product, dataUrl) {
    if(typeof dataUrl!=='string' || dataUrl.length>15000000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) throw fail('Envie uma fotografia JPEG, PNG ou WebP de até 10 MB.');
    const original=Buffer.from(dataUrl.split(',')[1],'base64');
    let bytes, metadata;
    try { metadata=await sharp(original,{limitInputPixels:40000000}).metadata(); bytes=await sharp(original,{limitInputPixels:40000000}).rotate().resize(1440,2560,{fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer(); } catch {throw fail('Fotografia inválida ou muito grande.');}
    const id='upload-'+digest(original), directory=path.join(uploadsDir,'marketing-scenes');
    await fs.mkdir(directory,{recursive:true}); await fs.writeFile(path.join(directory,`${digest(id)}.jpg`),bytes);
    const scene=(await core).resolveProductSceneContext(product), previous=await repository.get(id);
    const thumbnail='data:image/jpeg;base64,'+(await sharp(bytes).resize(240,320,{fit:'inside'}).jpeg({quality:65}).toBuffer()).toString('base64');
    return repository.put(previous || {id,origin:'upload',url:'',thumbnail,categoryId:product.category_id,subcategoryId:product.subcategory_id,contextKey:scene.key,context:scene.context,tags:scene.tags,width:metadata.width,height:metadata.height,orientation:metadata.height>metadata.width?'portrait':'landscape',active:true,approved:true,imported:true,uses:0,importedAt:new Date().toISOString()});
  }
  async function prepare(products, { variation = 0 } = {}) {
    const { resolveProductSceneContext, selectBackgroundForProduct, scoreBackground, mapScenePool } = await core;
    let library = await repository.list(); let queries = 0; const initialIds = new Set(library.map(b=>b.id));
    const contexts = new Map();
    for(const product of products) {
      const previous=await repository.selection(product.id);
      if(!variation && previous?.manual && library.some(b=>b.id===previous.backgroundId && b.active && b.approved)) continue;
      const selected = selectBackgroundForProduct(product, library);
      if(!selected.background) contexts.set(resolveProductSceneContext(product).key, product);
    }
    const warnings = await mapScenePool([...contexts.values()], async product => {
      try { const response = await search(product); queries += response.queries; return response.items.length ? response.warning : 'Nenhuma fotografia encontrada para este contexto.'; }
      catch(error) { return error.sceneSafe ? error.message : 'Biblioteca indisponível.'; }
    }, concurrency);
    library = await repository.list();
    const items = await mapScenePool(products, async product => {
      const previous = await repository.selection(product.id);
      const manual=!variation && previous?.manual && library.find(b=>b.id===previous.backgroundId && b.active && b.approved);
      const scene=resolveProductSceneContext(product);
      const selected = manual ? {background:manual,scene,...scoreBackground(manual,product,scene)} : selectBackgroundForProduct(product, library, { variation, preferredId: previous?.backgroundId });
      if(selected.background) await repository.select(product.id,{backgroundId:selected.background.id,contextKey:selected.scene.key,manual:Boolean(manual)});
      return { productId: product.id, productName: product.name, background: selected.background, context: selected.scene, confidence: selected.score, status: selected.background ? 'pending' : 'review_required', attempts: 0, message: selected.background && selected.score<80 ? 'Fundo aprovado com compatibilidade parcial; revise resolução e contexto.' : selected.background ? '' : 'Escolha e aprove um fundo contextual. O fundo neutro só será usado por escolha explícita.' };
    }, concurrency);
    return { items, queries, warnings: [...new Set(warnings)], contexts: new Set(products.map(p => resolveProductSceneContext(p).key)).size, reused: items.filter(i=>i.background).length, newBackgrounds: library.filter(b=>!initialIds.has(b.id)).length };
  }
  return { search, prepare, image, importBackground, upload, repository };
}

function registerMarketingSceneRoutes(app, deps) {
  const { pool, requireAdminBearerToken, getBearerAuthContext } = deps;
  const service = createSceneService({ repository: createSceneRepository(pool), uploadsDir: deps.uploadsDir });
  const locks = new Set();
  const owner = async req => { const auth = await getBearerAuthContext(req); const id = auth?.user?.id || auth?.userId || auth?.id; if (!id) throw fail('Sessão administrativa inválida.',401); return String(id); };
  const route = (method, url, handler) => app.route({ method, url: '/admin/marketing/scenes'+url, preHandler: requireAdminBearerToken, bodyLimit: 16000000, config: {rateLimit:{max:url.startsWith('/jobs')?2400:url==='/image'?300:60,timeWindow:'1 minute'}}, handler: async(req,reply) => {
    try { return await handler(req,reply); } catch(error) { return reply.code(error.sceneSafe ? error.statusCode : error.code === 'ER_NO_SUCH_TABLE' ? 503 : 500).send({ error: error.sceneSafe ? error.message : error.code === 'ER_NO_SUCH_TABLE' ? 'Biblioteca pendente: aplique a migração de cenários no ambiente de teste.' : 'Não foi possível concluir a operação de cenários.' }); }
  }});
  async function products(ids) {
    if(!Array.isArray(ids) || !ids.length || ids.length>200 || ids.some(id=>typeof id !== 'string' || id.length>80)) throw fail('Selecione de 1 a 200 produtos.');
    const [rows] = await pool.query('SELECT p.*, c.name AS leaf_category_name, c.parent_id AS parent_category_id, parent.name AS parent_category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN categories parent ON parent.id=c.parent_id WHERE p.id IN (?)', [[...new Set(ids)]]);
    const fields=value=>{try{return parse(value||'{}')}catch{return {}}};
    return rows.map(row=>({...row,category_id:row.parent_category_id||row.category_id,category_name:row.parent_category_name||row.leaf_category_name,subcategory_id:row.parent_category_id?row.category_id:null,subcategory_name:row.parent_category_id?row.leaf_category_name:null,specs:fields(row.specs),custom_fields:fields(row.custom_fields)}));
  }
  async function prepareIds(ids,options) {
    const found=await products(ids), plan=await service.prepare(found,options);
    for(const id of new Set(ids)) if(!found.some(p=>p.id===id)) plan.items.push({productId:id,productName:'Produto indisponível',background:null,context:{key:'neutral',context:'Cadastro indisponível'},status:'failed',attempts:0,message:'Produto não encontrado no catálogo.'});
    return plan;
  }
  route('GET','/status',async()=>({configured:Boolean(process.env.PEXELS_API_KEY),concurrency:Math.max(1,Math.min(8,Number(process.env.BULK_IMAGE_CONCURRENCY)||3)),limits:await service.repository.cacheGet('pexels-rate')}));
  route('GET','/library',async()=>({items:await service.repository.list()}));
  route('POST','/search',async req=>{ const [product] = await products([req.body?.productId]); if(!product) throw fail('Produto não encontrado.',404); return service.search(product,req.body); });
  route('POST','/image',async req=>({dataUrl:`data:image/jpeg;base64,${(await service.image(short(req.body?.id))).toString('base64')}`}));
  route('POST','/upload',async req=>{const [product]=await products([req.body?.productId]); if(!product) throw fail('Produto não encontrado.',404);return service.upload(product,req.body.dataUrl);});
  route('POST','/import',async req=>{
    const ids = req.body?.ids;
    if(!Array.isArray(ids)||!ids.length||ids.length>12) throw fail('Selecione até 12 fotografias.');
    const { mapScenePool } = await core;
    return {items:await mapScenePool(ids,id=>service.importBackground(short(id),req.body.approved),3)};
  });
  route('PATCH','/library/:id',async req=>{
    const record=await service.repository.get(short(req.params.id)); if(!record) throw fail('Fundo não encontrado.',404);
    return service.repository.put({...record,approved: typeof req.body.approved==='boolean'?req.body.approved:record.approved,active:typeof req.body.active==='boolean'?req.body.active:record.active});
  });
  route('POST','/select',async req=>{
    const [product]=await products([req.body.productId]); if(!product) throw fail('Produto não encontrado.',404);
    const background=await service.repository.get(short(req.body.id)); if(!background?.active || !background.approved) throw fail('Escolha um fundo ativo e aprovado.',400);
    await service.repository.select(product.id,{backgroundId:background.id,contextKey:background.contextKey,manual:true});
    return {background};
  });
  route('POST','/prepare',async req=> prepareIds(req.body?.productIds, {variation:Math.min(100,Math.max(0,Number(req.body.variation)||0))}));
  route('POST','/jobs',async req=>{
    const ownerId=await owner(req), key=short(req.body?.idempotencyKey).slice(0,100); if(!key) throw fail('Identificador do lote obrigatório.');
    const [[existing]]=await pool.query('SELECT data FROM marketing_scene_jobs WHERE owner_id=? AND idempotency_key=?',[ownerId,key]); if(existing) return parse(existing.data);
    const lock=ownerId+key; if(locks.has(lock)) throw fail('Lote em preparação. Tente novamente.',409); locks.add(lock);
    try {
      const prepared=await prepareIds(req.body.productIds);
      const data={...prepared,id:crypto.randomUUID(),createdAt:new Date().toISOString(),format:req.body.format==='feed'?'feed':'status',showPrice:req.body.showPrice===true,cancelled:false};
      await pool.query('INSERT INTO marketing_scene_jobs (id,owner_id,idempotency_key,data) VALUES (?,?,?,?)',[data.id,ownerId,key,JSON.stringify(data)]);return data;
    } finally {locks.delete(lock);}
  });
  route('GET','/jobs',async req=>{const [rows]=await pool.query('SELECT data FROM marketing_scene_jobs WHERE owner_id=? ORDER BY created_at DESC LIMIT 30',[await owner(req)]);return {items:rows.map(r=>parse(r.data))};});
  route('POST','/jobs/:id/claim',async req=>{
    const token=short(req.body?.runToken).slice(0,64); if(!token) throw fail('Identificador de execução obrigatório.');
    const [result]=await pool.query('UPDATE marketing_scene_jobs SET lease_token=?,lease_expires_at=? WHERE id=? AND owner_id=? AND (lease_expires_at<? OR lease_token=?)',[token,Date.now()+180000,short(req.params.id),await owner(req),Date.now(),token]);
    if(!result.affectedRows) throw fail('Este lote já está em execução em outra aba. Aguarde até três minutos se ela foi fechada.',409);
    return {ok:true};
  });
  route('POST','/jobs/:id/release',async req=>{await pool.query('UPDATE marketing_scene_jobs SET lease_token=NULL,lease_expires_at=0 WHERE id=? AND owner_id=? AND lease_token=?',[short(req.params.id),await owner(req),short(req.body?.runToken)]);return {ok:true};});
  route('POST','/jobs/:id/replan',async req=>{
    const id=short(req.params.id),ownerId=await owner(req);
    const [[row]]=await pool.query('SELECT data,lease_token,lease_expires_at FROM marketing_scene_jobs WHERE id=? AND owner_id=?',[id,ownerId]);
    if(!row || !row.lease_token || row.lease_token!==req.body.runToken || row.lease_expires_at<Date.now()) throw fail('Lote ocupado ou execução expirada.',409);
    const job=parse(row.data), pending=job.items.filter(i=>!['completed','completed_with_warning'].includes(i.status) && !i.completedSlides?.length);
    if(pending.length) {
      const plan=await prepareIds(pending.map(i=>i.productId));
      job.items=job.items.map(i=>{const refreshed=plan.items.find(p=>p.productId===i.productId);return refreshed?{...i,...refreshed,attempts:i.attempts}:i;});
      job.queries+=plan.queries;job.newBackgrounds+=plan.newBackgrounds;job.warnings=[...new Set([...job.warnings,...plan.warnings])];
    }
    job.updatedAt=new Date().toISOString();await pool.query('UPDATE marketing_scene_jobs SET data=?,lease_expires_at=? WHERE id=? AND owner_id=? AND lease_token=?',[JSON.stringify(job),Date.now()+180000,id,ownerId,req.body.runToken]);return job;
  });
  route('PATCH','/jobs/:id',async req=>{
    const ownerId=await owner(req), id=short(req.params.id), lock=`job:${id}`; if(locks.has(lock)) throw fail('Lote ocupado.',409);locks.add(lock);
    try {
      const [[row]]=await pool.query('SELECT data,lease_token,lease_expires_at FROM marketing_scene_jobs WHERE id=? AND owner_id=?',[id,ownerId]); if(!row) throw fail('Lote não encontrado.',404);
      if(!row.lease_token || row.lease_token!==req.body.runToken || row.lease_expires_at<Date.now()) throw fail('Execução do lote expirada ou ocupada. Retome pelo histórico.',409);
      const job=parse(row.data);
      if(typeof req.body.cancelled==='boolean') job.cancelled=req.body.cancelled;
      const item=job.items.find(i=>i.productId===req.body.productId);
      if(item && !['completed','completed_with_warning'].includes(item.status)) {
        const allowed=['pending','validating','resolving_context','selecting_background','generating_copy','composing','completed','completed_with_warning','review_required','failed'];
        if(!allowed.includes(req.body.status)) throw fail('Status inválido.');
        item.status=req.body.status; if(req.body.message!==undefined) item.message=short(req.body.message);
        if(req.body.status==='composing' && !req.body.completedSlide) item.attempts=(item.attempts||0)+1;
        if(Number.isInteger(req.body.completedSlide) && req.body.completedSlide>0 && req.body.completedSlide<=100) item.completedSlides=[...new Set([...(item.completedSlides||[]),req.body.completedSlide])];
        if(['completed','completed_with_warning'].includes(item.status)) {
          item.completedAt=new Date().toISOString(); item.outputUrl=String(req.body.outputUrl||'').slice(0,2048);
          item.copy=req.body.copy && typeof req.body.copy==='object' && JSON.stringify(req.body.copy).length<=8000 ? req.body.copy : null;
          if(item.background) {const current=await service.repository.get(item.background.id);if(current) await service.repository.put({...current,uses:(current.uses||0)+1,lastUsedAt:item.completedAt});}
        }
      }
      job.updatedAt=new Date().toISOString();await pool.query('UPDATE marketing_scene_jobs SET data=?,lease_expires_at=? WHERE id=? AND owner_id=? AND lease_token=?',[JSON.stringify(job),Date.now()+180000,id,ownerId,req.body.runToken]);return job;
    } finally {locks.delete(lock);}
  });
}
module.exports={createSceneRepository,createSceneService,registerMarketingSceneRoutes,safePexelsUrl};
