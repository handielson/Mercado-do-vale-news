'use strict';
const { randomUUID } = require('node:crypto');
const { parse, version, upsertFilament, applyStock, initialReceipt, fail } = require('./print3dFilaments.cjs');
const { mergeCosts } = require('./print3dFilamentsServer.cjs');
const COST = '/admin/preferences/print3d.cost.v1';
function isLocalFilamentPath(raw, method) {
  const path = new URL(raw, 'http://localhost').pathname;
  return (path === COST && ['GET','PATCH'].includes(method)) ||
    (['/admin/print3d/filaments','/admin/print3d/filaments/status','/admin/print3d/filaments/stock'].includes(path) && method === 'GET') ||
    (['/admin/print3d/filaments','/admin/print3d/filaments/movements','/admin/print3d/filaments/approve'].includes(path) && method === 'POST');
}
function registerLocalFilaments({ app, store, serialize, requestRemote }) {
  const centralSettings = async auth => parse((await requestRemote(COST, auth)).value);
  const colorRows = async auth => {
    const rows = [];
    for (let offset = 0; offset < 10000; offset += 200) {
      // Reuse the same paginated database endpoint as services/colors.ts.
      const response = await requestRemote(`/table-data/colors?limit=200&offset=${offset}`, auth);
      const batch = Array.isArray(response) ? response : response?.data || response?.rows || response?.items;
      if (!Array.isArray(batch)) fail(502, 'Resposta inválida do cadastro de cores.');
      rows.push(...batch);
      if (batch.length < 200) return rows;
    }
    fail(502, 'Cadastro de cores excedeu o limite de leitura.');
  };
  const refs = async auth => {
    const [brands, colors, materials] = await Promise.all([requestRemote('/brands', auth), colorRows(auth), requestRemote('/admin/print3d/material-types', auth)]);
    const names = rows => [...new Set(rows.filter(r => r.active !== false && Number(r.active ?? 1) !== 0).map(r => r.name))].sort((a,b) => a.localeCompare(b,'pt-BR'));
    return { brands:names(brands), colors:names(colors), color_hex:Object.fromEntries(colors.map(c => [c.name,c.hex_code || ''])), materials:materials.materials };
  };
  const current = async auth => {
    const base = await centralSettings(auth);
    const state = await store.read();
    const draft = state.filamentDraft;
    return { state, base, items:draft?.filaments || base.filaments || [] };
  };
  const draftFor = (state, base) => state.filamentDraft ||= { base_version:version(base.filaments), filaments:base.filaments || [], movements:[], base_costs:base };
  const stock = async (auth, pending = []) => {
    try {
      const result = await requestRemote('/admin/print3d/filaments/stock', auth);
      const movements = new Map((result.movements || []).map(m => [m.movement_key, m]));
      // Include pending UUIDs outside the latest 200 events: a lost approval
      // response must not make an already committed receipt appear twice.
      if (result.enabled) for (let offset = 0; offset < pending.length; offset += 100) {
        const keys = pending.slice(offset, offset + 100).map(m => m.idempotency_key).join(',');
        const replay = await requestRemote(`/admin/print3d/filaments/stock?movement_keys=${encodeURIComponent(keys)}`, auth);
        for (const m of replay.movements || []) movements.set(m.movement_key, m);
      }
      return { ...result, movements:[...movements.values()] };
    }
    catch (error) {
      if (error.statusCode !== 404) throw error;
      try { const result = await requestRemote('/admin/print3d/materials', auth); return { enabled:true, balances:result.materials, movements:[] }; }
      catch (legacy) { if (legacy.statusCode !== 503) throw legacy; return { enabled:false, balances:[], movements:[] }; }
    }
  };
  const projectedStock = async auth => {
    const { state, base, items } = await current(auth);
    const pending = state.filamentDraft?.movements || [];
    const remote = await stock(auth, pending);
    const balances = new Map((remote.balances || []).map(b => [b.filament_id, Number(b.quantity_grams)]));
    const uncommitted = pending.filter(m => {
      if (!remote.movements.some(event => event.movement_key === m.idempotency_key)) return true;
      applyStock(0, remote.movements, m); // validate committed replay identity
      return false;
    });
    for (const m of uncommitted) balances.set(m.filament_id, (balances.get(m.filament_id) || 0) + m.quantity_grams);
    return { enabled:true, preview:true, unknown_ids:remote.enabled ? [] : (base.filaments || []).map(f => f.id),
      balances:items.map(f => ({ filament_id:f.id, quantity_grams:balances.get(f.id) || 0 })),
      movements:[...uncommitted.map(m => ({ id:m.idempotency_key, movement_key:m.idempotency_key, filament_id:m.filament_id, quantity_delta_grams:m.quantity_grams, reason:m.reason, note:m.note, created_at:m.created_at, preview:true })).reverse(), ...(remote.movements || [])] };
  };
  app.get('/admin/print3d/filaments/status', async () => ({ enabled:true, stockEnabled:true, preview:true }));
  app.get('/admin/print3d/filaments', async req => {
    const { state, items } = await current(req.headers.authorization);
    return { filaments:items, version:version(items), references:await refs(req.headers.authorization), preview:true, pending:Boolean(state.filamentDraft) };
  });
  app.get(COST, async req => {
    const { state, base, items } = await current(req.headers.authorization);
    return { value:{ ...base, ...state.filamentDraft?.costs, filaments:items }, preview:true };
  });
  app.patch(COST, async req => serialize(async () => {
    const { state, base, items } = await current(req.headers.authorization);
    if (version(req.body?.value?.filaments) !== version(items)) fail(409, 'Atualize o cadastro de filamentos antes de salvar tarifas.');
    const draft = draftFor(state, base);
    draft.costs = mergeCosts({ ...base, ...draft.costs, filaments:items }, req.body.value);
    await store.write(state);
    return { value:draft.costs, preview:true };
  }));
  app.post('/admin/print3d/filaments', async req => serialize(async () => {
    const { state, base, items } = await current(req.headers.authorization);
    if (req.body?.version !== version(items)) fail(409, 'O cadastro mudou. Atualize antes de salvar.');
    const receipt = initialReceipt(req.body.receipt, req.body.filament || {}, items);
    const filaments = upsertFilament(items, req.body.filament || {}, await refs(req.headers.authorization));
    let entry;
    if (receipt) {
      const projected = await projectedStock(req.headers.authorization);
      entry = applyStock(0, projected.movements, receipt);
      if (!entry.replayed && (state.filamentDraft?.movements.length || 0) >= 1000) fail(400, 'Aprove os movimentos pendentes antes de acrescentar mais lançamentos.');
    }
    // Validate everything first; persist catalog + receipt in one local write.
    const next = structuredClone(state);
    const draft = draftFor(next, base);
    draft.filaments = filaments;
    if (entry && !entry.replayed) draft.movements.push({ ...entry.input, created_at:new Date().toISOString() });
    await store.write(next);
    return { filaments:draft.filaments, version:version(draft.filaments), preview:true, pending:true };
  }));
  app.get('/admin/print3d/filaments/stock', req => projectedStock(req.headers.authorization));
  app.post('/admin/print3d/filaments/movements', async req => serialize(async () => {
    const { state, base, items } = await current(req.headers.authorization);
    const f = items.find(f => f.id === req.body.filament_id);
    if (!f) fail(409, 'Escolha um filamento cadastrado.');
    const projected = await projectedStock(req.headers.authorization);
    if (projected.unknown_ids.includes(f.id)) fail(503, 'Saldo central indisponível. Não é seguro simular ajustes deste filamento.');
    const balance = projected.balances.find(b => b.filament_id === f.id)?.quantity_grams || 0;
    const result = applyStock(balance, projected.movements, req.body);
    if (f.active === false && !result.replayed) fail(409, 'Escolha um filamento ativo.');
    if (!result.replayed) {
      if ((state.filamentDraft?.movements.length || 0) >= 1000) fail(400, 'Aprove os movimentos pendentes antes de acrescentar mais lançamentos.');
      const next = structuredClone(state);
      const draft = draftFor(next, base);
      draft.movements.push({ ...result.input, created_at:new Date().toISOString() });
      if (result.input.action === 'deactivate') draft.filaments = items.map(item => item.id === f.id ? {...item,active:false} : item);
      await store.write(next);
    }
    return { filament_id:f.id, quantity_grams:result.balance, replayed:result.replayed, preview:true };
  }));
  app.post('/admin/print3d/filaments/approve', async req => serialize(async () => {
    const { state, base } = await current(req.headers.authorization);
    const draft = state.filamentDraft;
    if (!draft) return { approved:true, unchanged:true };
    let capability;
    try { capability = await requestRemote('/admin/print3d/filaments/status', req.headers.authorization); }
    catch (error) { if (error.statusCode === 404) fail(503, 'A atualização de filamentos ainda precisa ser publicada na API central. O rascunho local foi preservado.'); throw error; }
    if (!capability.approval || (draft.movements.length && !capability.stockEnabled)) fail(503, 'Publique a atualização e aprove a migração 054 antes de enviar estoque à produção.');
    const withoutFilaments = value => { const { filaments, ...rest } = value || {}; return rest; };
    if (draft.costs && JSON.stringify(withoutFilaments(base)) !== JSON.stringify(withoutFilaments(draft.base_costs)) && JSON.stringify(withoutFilaments(base)) !== JSON.stringify(withoutFilaments(draft.costs))) fail(409, 'As tarifas centrais mudaram. Reconcilie antes de aprovar.');
    await requestRemote('/admin/print3d/filaments/approve', req.headers.authorization, { method:'POST', json:{ base_version:draft.base_version, filaments:draft.filaments, movements:draft.movements } });
    if (draft.costs) await requestRemote(COST, req.headers.authorization, { method:'PATCH', json:{ value:{ ...draft.costs, filaments:draft.filaments } } });
    state.filamentApprovedArchives ||= [];
    state.filamentApprovedArchives.push({ ...draft, approved_at:new Date().toISOString(), id:randomUUID() });
    delete state.filamentDraft;
    await store.write(state);
    return { approved:true };
  }));
}
function createLocalFilamentPreview({ store, serialize, fetchImpl, origin, syncKey }) {
  const app = require('fastify')({ bodyLimit:1024 * 1024 });
  const requestRemote = async (url, authorization, options = {}) => {
    if (!/^Bearer \S+$/i.test(authorization || '')) fail(401, 'Sessão de administrador necessária.');
    const response = await fetchImpl(new URL(url, origin), {
      method:options.method || 'GET',
      headers:{ ...(syncKey ? {'x-sync-key':syncKey} : {}), authorization, ...(options.json === undefined ? {} : {'Content-Type':'application/json'}) },
      body:options.json === undefined ? undefined : JSON.stringify(options.json), signal:AbortSignal.timeout(60_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || `API central respondeu ${response.status}.`),{statusCode:response.status});
    return data;
  };
  app.addHook('preHandler',async (req,reply) => {
    reply.header('Cache-Control','no-store');
    await requestRemote('/admin/print3d/status',req.headers.authorization);
  });
  app.setErrorHandler((error,req,reply)=>reply.code(error.statusCode || 400).send({error:error.message}));
  registerLocalFilaments({app,store,serialize,requestRemote});
  return app;
}
module.exports = { isLocalFilamentPath, registerLocalFilaments, createLocalFilamentPreview };
