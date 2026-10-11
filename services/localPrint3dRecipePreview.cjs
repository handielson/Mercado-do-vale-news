'use strict';
// Draft adapter only: same canonical recipe contract, private local bytes and
// explicit approval replay through the existing authenticated production API.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { MAX_BYTES, EXTENSIONS } = require('./print3dRecipeFilesServer.cjs');
const { isLocalFilamentPath, registerLocalFilaments } = require('./localPrint3dFilaments.cjs');

function isLocalPrint3dRecipePath(raw, method = 'GET') {
  if (isLocalFilamentPath(raw, method)) return true;
  const pathname = new URL(raw, 'http://localhost').pathname;
  return (method === 'GET' && ['/admin/print3d/status', '/admin/print3d/files/status'].includes(pathname))
    || (/^\/admin\/print3d\/products\/[0-9a-f-]{36}\/recipes(?:\/[A-Za-z0-9._-]+)?$/i.test(pathname) && ['GET', 'POST', 'DELETE'].includes(method))
    || (/^\/admin\/print3d\/recipes\/[0-9a-f-]{36}\/files(?:\/integrity)?$/i.test(pathname) && ['GET', 'POST'].includes(method))
    || (/^\/admin\/print3d\/files\/[0-9a-f-]{36}\/download$/i.test(pathname) && method === 'GET');
}

function createLocalPrint3dRecipePreview({ store, assetRoot, serialize, remoteRequest, getProduct }) {
  const app = require('fastify')({ bodyLimit:1024 * 1024 });
  app.register(require('@fastify/multipart'), { limits:{ fileSize:MAX_BYTES, files:1 } });
  const requestRemote = async (url, authorization, options = {}) => {
    if (!/^Bearer \S+$/i.test(authorization || '')) throw Object.assign(new Error('Sessão de administrador necessária.'), { statusCode:401 });
    return remoteRequest(url, { ...options, headers:{ ...options.headers, authorization } });
  };
  const auth = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    // The existing status endpoint authenticates administrators even when the
    // production recipe feature is off; no credentials are persisted locally.
    await requestRemote('/admin/print3d/status', req.headers.authorization);
  };
  app.addHook('preHandler', auth);
  registerLocalFilaments({ app, store, serialize, requestRemote });
  app.setErrorHandler((error, req, reply) => reply.code(error.statusCode || 400).send({ error:error.message }));
  app.get('/admin/print3d/status', async () => ({ enabled:true, platePlans:true, storage:'local-draft' }));
  app.get('/admin/print3d/files/status', async () => ({ enabled:true, maxBytes:MAX_BYTES, storage:'local-draft' }));
  app.post('/admin/print3d/products/:productId/recipes', async (req, reply) => serialize(async () => {
    const { validatePrint3dRecipeDraft } = await import('../utils/print3dRecipeDraft.mjs');
    const draft = validatePrint3dRecipeDraft(req.body);
    const product = await getProduct(req.params.productId);
    if (!product || Number(product.is_parent) === 1) return reply.code(404).send({ error:'Escolha uma variação vendável.' });
    if (draft.productId !== product.id || draft.sku !== product.sku || draft.productName !== product.name) return reply.code(409).send({ error:'A ficha não corresponde ao produto salvo.' });
    const state = await store.read(); state.print3dRecipes ||= {};
    const serialized = JSON.stringify(draft);
    if (Buffer.byteLength(serialized) > 48 * 1024) return reply.code(413).send({ error:'Ficha muito grande.' });
    const hash = crypto.createHash('sha256').update(serialized).digest('hex');
    const previous = Object.values(state.print3dRecipes).find(r => r.draft.productId === draft.productId && r.draft.revision === draft.revision);
    if (previous && previous.sha256 !== hash) return reply.code(409).send({ error:'Revisão imutável: informe uma nova revisão.' });
    if (previous) return { id:previous.id, revision:draft.revision, saved:false, sha256:hash };
    if (!state.products?.[product.id]?.local_only) {
      const status = await requestRemote('/admin/print3d/status', req.headers.authorization);
      const existing = status.enabled ? await requestRemote(`/admin/print3d/products/${product.id}/recipes`, req.headers.authorization) : { recipes:[] };
      if (existing.recipes.some(r => r.revision === draft.revision)) return reply.code(409).send({ error:'Esta revisão já existe na produção. Use outra revisão.' });
    }
    const id = crypto.randomUUID();
    state.print3dRecipes[id] = { id, draft, sha256:hash, created_at:new Date().toISOString() };
    await store.write(state);
    return reply.code(201).send({ id, revision:draft.revision, saved:true, sha256:hash, preview:true });
  }));
  app.get('/admin/print3d/products/:productId/recipes', async req => {
    const state = await store.read();
    const status = await requestRemote('/admin/print3d/status', req.headers.authorization);
    const remote = state.products?.[req.params.productId]?.local_only || !status.enabled ? { recipes:[] } : await requestRemote(req.url, req.headers.authorization);
    return { recipes:[...Object.values(state.print3dRecipes || {}).filter(r => r.draft.productId === req.params.productId).map(r => ({ id:r.id, revision:r.draft.revision, sku_snapshot:r.draft.sku, draft_sha256:r.sha256, created_at:r.created_at, input_source:r.draft.printSummary.source, source_url:r.draft.sourceUrl, preview:true })), ...remote.recipes] };
  });
  app.get('/admin/print3d/products/:productId/recipes/:revision', async req => {
    const state = await store.read();
    const local = Object.values(state.print3dRecipes || {}).find(r => r.draft.productId === req.params.productId && r.draft.revision === req.params.revision);
    return local ? { id:local.id, draft:local.draft, preview:true } : requestRemote(req.url, req.headers.authorization);
  });
  app.delete('/admin/print3d/products/:productId/recipes/:revision', async (req, reply) => serialize(async () => {
    const state = await store.read();
    const local = Object.values(state.print3dRecipes || {}).find(r => r.draft.productId === req.params.productId && r.draft.revision === req.params.revision);
    if (!local) return reply.code(409).send({ error:'Somente um rascunho local pode ser descartado. Nenhuma revisão da produção foi alterada.' });
    const files = Object.values(state.print3dFiles || {}).filter(f => f.recipe_id === local.id);
    // Keep the discarded draft and its private bytes recoverable. Production
    // revisions and any active order are outside this route's authority.
    state.print3dDiscarded ||= {};
    state.print3dDiscarded[local.id] = { ...local, files, discarded_at:new Date().toISOString() };
    delete state.print3dRecipes[local.id];
    for (const file of files) delete state.print3dFiles[file.id];
    await store.write(state);
    return { discarded:true, preview:true };
  }));
  app.get('/admin/print3d/recipes/:recipeId/files', async req => {
    const state = await store.read();
    if (!state.print3dRecipes?.[req.params.recipeId]) return requestRemote(req.url, req.headers.authorization);
    return { files:Object.values(state.print3dFiles || {}).filter(f => f.recipe_id === req.params.recipeId) };
  });
  app.post('/admin/print3d/recipes/:recipeId/files', async (req, reply) => {
    const state = await store.read();
    const recipe = state.print3dRecipes?.[req.params.recipeId];
    if (!recipe) return reply.code(409).send({ error:'Crie uma nova revisão local antes de enviar arquivos. Produção não foi alterada.' });
    const kind = req.query.kind;
    if (!Object.hasOwn(EXTENSIONS, kind)) return reply.code(400).send({ error:'Tipo de arquivo inválido.' });
    const profile = String(req.query.printerProfile || '').trim();
    if (kind === 'gcode' && (!profile || profile.length > 120 || /[\x00-\x1f]/.test(profile))) return reply.code(400).send({ error:'Informe o perfil do G-code (até 120 caracteres).' });
    const part = await req.file();
    if (!part || part.fieldname !== 'file') return reply.code(400).send({ error:'Campo file obrigatório.' });
    const name = String(part.filename || '');
    if (!name || name.length > 255 || /[\\/\x00-\x1f]/.test(name) || !EXTENSIONS[kind].includes(path.extname(name).toLowerCase())) { part.file.resume(); return reply.code(400).send({ error:'Nome ou extensão inválidos.' }); }
    const bytes = await part.toBuffer();
    if (!bytes.length || part.file.truncated) return reply.code(413).send({ error:'Arquivo vazio ou maior que 50 MB.' });
    if (kind === 'print-json') {
      const { parsePrint3dSummary } = await import('../utils/print3dImport.mjs');
      const imported = parsePrint3dSummary(bytes.toString('utf8'));
      const plate = recipe.draft.plates?.find(p => p.id === req.query.plateId);
      if (req.query.plateId && !plate) return reply.code(400).send({ error:'Placa inválida.' });
      const grams = plate ? plate.filaments.reduce((sum, f) => sum + f.consumedGrams, 0) : recipe.draft.printSummary.material_gramas;
      const minutes = plate ? plate.printMinutes : recipe.draft.printSummary.tempo_impressao_minutos;
      if (Math.abs(imported.materialGrams - grams) > 0.001 || Math.abs(imported.printMinutes - minutes) > 0.001) return reply.code(409).send({ error:'JSON diverge dos parâmetros da placa.' });
    }
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    return serialize(async () => {
      const current = await store.read(); current.print3dFiles ||= {};
      const existing = Object.values(current.print3dFiles).find(f => f.recipe_id === recipe.id && f.kind === kind && f.sha256 === sha256);
      if (existing) {
        if (kind === 'gcode' && existing.printer_profile !== profile) return reply.code(409).send({ error:'G-code já vinculado a outro perfil.' });
        return { file:existing, saved:false };
      }
      await fs.mkdir(assetRoot, { recursive:true });
      await fs.writeFile(path.join(assetRoot, sha256), bytes, { flag:'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
      const file = { id:crypto.randomUUID(), asset_id:sha256, recipe_id:recipe.id, kind, printer_profile:kind === 'gcode' ? profile : null, original_name:name, byte_size:bytes.length, sha256, created_at:new Date().toISOString(), shared:false, plate_id:req.query.plateId || null };
      current.print3dFiles[file.id] = file;
      await store.write(current);
      return reply.code(201).send({ file, saved:true, preview:true });
    });
  });
  const readVerified = async file => {
    const bytes = await fs.readFile(path.join(assetRoot, file.sha256));
    if (bytes.length !== file.byte_size || crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Integridade do arquivo local não confere.');
    return bytes;
  };
  app.get('/admin/print3d/files/:fileId/download', async (req, reply) => {
    const state = await store.read(); const file = state.print3dFiles?.[req.params.fileId];
    if (!file) {
      const response = await remoteRequest(req.url, { headers:{ authorization:req.headers.authorization }, binary:true });
      return reply.type('application/octet-stream').send(response);
    }
    reply.header('Content-Disposition', `attachment; filename="${file.original_name.replace(/"/g, '_')}"`);
    return reply.type('application/octet-stream').send(await readVerified(file));
  });
  app.get('/admin/print3d/recipes/:recipeId/files/integrity', async req => {
    const state = await store.read();
    if (!state.print3dRecipes?.[req.params.recipeId]) return requestRemote(req.url, req.headers.authorization);
    const files = Object.values(state.print3dFiles || {}).filter(f => f.recipe_id === req.params.recipeId);
    const checked = await Promise.all(files.map(async file => { await readVerified(file); return { ...file, valid:true }; }));
    return { recipe_id:req.params.recipeId, verified:checked.length > 0, files:checked };
  });
  return {
    app,
    async preflight(state, productId, authorization) {
      const recipes = Object.values(state.print3dRecipes || {}).filter(r => r.draft.productId === productId);
      if (!recipes.length) return;
      const status = await requestRemote('/admin/print3d/status', authorization);
      const filesStatus = await requestRemote('/admin/print3d/files/status', authorization);
      if (!status.enabled || !filesStatus.enabled) throw Object.assign(new Error('Fichas/arquivos privados não habilitados na produção. Rascunho mantido; aprovação bloqueada.'), { statusCode:503 });
      if (recipes.some(r => r.draft.plates) && status.platePlans !== true) throw Object.assign(new Error('A API central ainda não suporta o plano de placas. Publique esta atualização antes de aprovar. Rascunho mantido.'), { statusCode:503 });
      const product = await getProduct(productId);
      const { resolvePrint3dPlateFiles } = await import('../utils/print3dPlatePlan.mjs');
      for (const recipe of recipes) {
        if (recipe.draft.productName !== product.name || recipe.draft.sku !== product.sku) throw Object.assign(new Error('O nome ou SKU mudou desde a ficha. Revise os rascunhos de produção antes de aprovar.'), { statusCode:409 });
        const files = Object.values(state.print3dFiles || {}).filter(f => f.recipe_id === recipe.id);
        try { resolvePrint3dPlateFiles(recipe.draft, files); }
        catch (error) { throw Object.assign(error, { statusCode:409 }); }
        for (const file of files) await readVerified(file);
      }
    },
    async publish(state, productId, authorization) {
      const recipes = Object.values(state.print3dRecipes || {}).filter(r => r.draft.productId === productId);
      for (const recipe of recipes) {
        const saved = await requestRemote(`/admin/print3d/products/${productId}/recipes`, authorization, { method:'POST', json:recipe.draft });
        if (!saved.id || saved.sha256 !== recipe.sha256) throw Object.assign(new Error('A API central não confirmou integralmente a ficha. Rascunho mantido.'), { statusCode:409 });
        for (const file of Object.values(state.print3dFiles || {}).filter(f => f.recipe_id === recipe.id)) {
          const form = new FormData();
          form.append('file', new Blob([await readVerified(file)]), file.original_name);
          await requestRemote(`/admin/print3d/recipes/${saved.id}/files?kind=${encodeURIComponent(file.kind)}&printerProfile=${encodeURIComponent(file.printer_profile || '')}&plateId=${encodeURIComponent(file.plate_id || '')}`, authorization, { method:'POST', body:form });
        }
      }
      for (const recipe of recipes) {
        delete state.print3dRecipes[recipe.id];
        for (const file of Object.values(state.print3dFiles || {}).filter(f => f.recipe_id === recipe.id)) delete state.print3dFiles[file.id];
      }
      return recipes.length;
    },
  };
}
module.exports = { createLocalPrint3dRecipePreview, isLocalPrint3dRecipePath };
