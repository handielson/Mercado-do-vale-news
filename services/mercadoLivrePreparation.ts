// Pure local preparation. This module has no network, database or publication operation.
export const PREPARATION_SCHEMA = 'mdv.ml.preparation.v1';
export const FIELD_NAMES = ['title', 'familyName', 'description', 'categoryId', 'categoryRequirements', 'condition', 'priceCents', 'quantity', 'photos', 'attributes', 'gtin', 'certificates', 'commercialPolicy', 'variations'] as const;
export type FieldName = typeof FIELD_NAMES[number];
export type AccountMode = 'unknown' | 'legacy' | 'user_products';
export type SourceKind = 'catalog' | 'manufacturer' | 'official_catalog' | 'official_document' | 'operator' | 'authorized_photo' | 'marketplace_reference';
export interface Evidence { kind: SourceKind; reference: string; note?: string }
export interface Field { value: any; sources: Evidence[]; confirmed: boolean; conflict?: { value: any; sources: Evidence[] } }
export interface LocalProduct { id: string; sku: string; name: string; price_retail: number; stock_quantity?: number; images?: string[]; description?: string; brand?: string; eans?: string[]; parent_id?: string; is_parent?: boolean; product_format?: string; status?: string; is_virtual?: boolean; is_gift?: boolean }
export interface Link { product_id: string; item_id: string; variation_id?: string }
export interface Listing { itemId: string; variationId: string; sku: string; title?: string; status?: string }
export interface Snapshot { schema: 'mdv.ml.catalog.v1'; sellerId: string; nickname?: string; capturedAt: string; complete: boolean; products: LocalProduct[]; links: Link[]; listings: Listing[] }
export interface Draft { productId: string; sku: string; fields: Partial<Record<FieldName, Field>> }
export interface Batch { schema: typeof PREPARATION_SCHEMA; sellerId: string; snapshot: Snapshot; accountMode: Field; drafts: Draft[] }
export interface Issue { code: string; message: string; field?: FieldName; level: 'blocker' | 'warning' }
const sourceKinds = ['catalog', 'manufacturer', 'official_catalog', 'official_document', 'operator', 'authorized_photo', 'marketplace_reference'];
const filled = (v: any) => v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0);
const plain = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
const array = (v: any) => Array.isArray(v) ? v : [];
const text = (v: any) => typeof v === 'string' ? v.trim() : '';
const url = (v: any) => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
const proven = (f?: Field) => Boolean(f?.confirmed && f.sources.length && f.sources.every(s => sourceKinds.includes(s.kind) && text(s.reference)));
const official = (f?: Field) => proven(f) && f!.sources.some(s => ['manufacturer', 'official_catalog', 'official_document'].includes(s.kind));
const catalogField = (product: LocalProduct, name: string, value: any): Field => ({ value, confirmed: false, sources: [{ kind: 'catalog', reference: `cadastro:${product.id}#${name}` }] });

// Allowlist: exporting a preparation packet never exports costs, credentials or fiscal documents.
export function normalizeProduct(raw: any): LocalProduct {
  if (!plain(raw) || !text(raw.id) || !text(raw.name)) throw new Error('Produto precisa de ID e nome.');
  let images = raw.images; if (typeof images === 'string') { try { images = JSON.parse(images); } catch { images = []; } }
  let eans = raw.eans; if (typeof eans === 'string') { try { eans = JSON.parse(eans); } catch { eans = []; } }
  return { id: text(raw.id), name: text(raw.name), sku: text(raw.sku), price_retail: Number(raw.price_retail), stock_quantity: raw.stock_quantity == null ? undefined : Number(raw.stock_quantity),
    images: array(images).filter(x => typeof x === 'string'), eans: [...new Set([...array(eans).filter(x => typeof x === 'string'), ...(text(raw.ean) ? [text(raw.ean)] : [])])], description: text(raw.description), brand: text(raw.brand), parent_id: text(raw.parent_id),
    is_parent: raw.is_parent === true || raw.is_parent === 1, product_format: text(raw.product_format), status: text(raw.status), is_virtual: raw.is_virtual === true || raw.is_virtual === 1, is_gift: raw.is_gift === true || raw.is_gift === 1 };
}
export function parseSnapshot(raw: any): Snapshot {
  if (!plain(raw) || raw.schema !== 'mdv.ml.catalog.v1' || !text(raw.sellerId) || !Array.isArray(raw.products) || !Array.isArray(raw.links) || !Array.isArray(raw.listings)) throw new Error('Snapshot inválido. Importe catálogo, conta, vínculos e anúncios juntos.');
  if (!Number.isFinite(Date.parse(raw.capturedAt))) throw new Error('Informe a data da consulta do snapshot.');
  const products = raw.products.map(normalizeProduct);
  if (new Set(products.map(p => p.id)).size !== products.length) throw new Error('Snapshot contém IDs de produto repetidos.');
  const links = raw.links.map((l: any) => { if (!text(l.product_id) || !/^MLB\d+$/.test(l.item_id) || !/^\d*$/.test(l.variation_id || '')) throw new Error('Vínculo inválido.'); return { product_id: l.product_id, item_id: l.item_id, variation_id: l.variation_id || '' }; });
  const listings = raw.listings.map((l: any) => { if (!/^MLB\d+$/.test(l.itemId) || !/^\d*$/.test(l.variationId || '')) throw new Error('Anúncio inválido.'); return { itemId: l.itemId, variationId: l.variationId || '', sku: text(l.sku), title: text(l.title), status: text(l.status) }; });
  return { schema: 'mdv.ml.catalog.v1', sellerId: text(raw.sellerId), nickname: text(raw.nickname), capturedAt: raw.capturedAt, complete: raw.complete === true, products, links, listings };
}
export function createBatch(snapshot: Snapshot): Batch {
  return { schema: PREPARATION_SCHEMA, sellerId: snapshot.sellerId, snapshot, accountMode: { value: 'unknown', confirmed: false, sources: [] }, drafts: [] };
}
export function restoreDraftFile(raw: any): Batch {
  if (!plain(raw) || raw.schema !== 'mdv.ml.draft-file.v1' || !plain(raw.batch) || raw.batch.schema !== PREPARATION_SCHEMA || !Array.isArray(raw.batch.drafts) || raw.batch.drafts.length > 100) throw new Error('Arquivo de rascunho inválido.');
  const snapshot = parseSnapshot(raw.batch.snapshot), batch = createBatch(snapshot);
  if (raw.batch.sellerId !== snapshot.sellerId) throw new Error('Conta do rascunho diverge do snapshot.');
  const ids = new Set<string>();
  batch.drafts = raw.batch.drafts.map((d: any) => {
    const product = snapshot.products.find(p => p.id === d?.productId);
    if (!product || product.sku !== d.sku || ids.has(d.productId) || !plain(d.fields)) throw new Error('Produto/SKU inválido no rascunho.');
    ids.add(d.productId); const fields: Draft['fields'] = {};
    for (const name of Object.keys(d.fields)) {
      if (!(FIELD_NAMES as readonly string[]).includes(name)) throw new Error('Campo inesperado no rascunho.');
      const field = parseField(d.fields[name]);
      if (d.fields[name].conflict) { const conflict = parseField(d.fields[name].conflict); field.conflict = {value:conflict.value,sources:conflict.sources}; }
      fields[name as FieldName] = field;
    }
    return {productId:product.id,sku:product.sku,fields};
  });
  if (['legacy','user_products'].includes(raw.batch.accountMode?.value)) batch.accountMode = parseField(raw.batch.accountMode);
  // Imported files never grant approval, even when saved by this app. Review again after reopening.
  return batch;
}
export function createDraft(product: LocalProduct, snapshot: Snapshot): Draft {
  const children = snapshot.products.filter(p => p.parent_id === product.id);
  return { productId: product.id, sku: product.sku, fields: {
    title: catalogField(product, 'name', product.name), familyName: catalogField(product, 'name', product.name), description: catalogField(product, 'description', product.description || ''),
    priceCents: catalogField(product, 'price_retail', product.price_retail), quantity: catalogField(product, 'stock_quantity', product.stock_quantity ?? null),
    photos: catalogField(product, 'images', (product.images || []).map(u => ({ url: u, rights: 'unknown', evidence: '' }))),
    attributes: catalogField(product, 'brand', product.brand ? { BRAND: product.brand } : {}),
    gtin: catalogField(product, 'eans', product.eans?.[0] || ''),
    variations: catalogField(product, 'children', children.map(p => ({ productId: p.id, sku: p.sku, priceCents: p.price_retail, quantity: p.stock_quantity ?? null, attributes: {}, photos: [] }))),
  } };
}
export function editField(draft: Draft, name: FieldName, value: any, source: Evidence): Draft {
  return { ...draft, fields: { ...draft.fields, [name]: { value, sources: [source], confirmed: false } } };
}
export function confirmField(draft: Draft, name: FieldName, confirmed: boolean): Draft {
  const field = draft.fields[name]; if (!field) return draft;
  return { ...draft, fields: { ...draft.fields, [name]: { ...field, confirmed: confirmed && !field.conflict } } };
}
export function resolveConflict(draft: Draft, name: FieldName, choice: 'current' | 'proposal'): Draft {
  const f = draft.fields[name]; if (!f?.conflict) return draft;
  return { ...draft, fields: { ...draft.fields, [name]: { value: choice === 'current' ? f.value : f.conflict.value, sources: choice === 'current' ? f.sources : f.conflict.sources, confirmed: false } } };
}
function parseField(raw: any): Field {
  if (!plain(raw) || !Object.hasOwn(raw, 'value') || !Array.isArray(raw.sources) || !raw.sources.length || raw.sources.length > 12) throw new Error('Cada campo proposto precisa de valor e fonte.');
  const sources = raw.sources.map((s: any) => {
    if (!plain(s) || !sourceKinds.includes(s.kind) || !text(s.reference) || s.reference.length > 2048) throw new Error('Fonte inválida.');
    return { kind: s.kind, reference: text(s.reference), note: text(s.note).slice(0, 1000) };
  });
  // Assistant/imported proposals cannot approve themselves or import conflict state.
  return { value: structuredClone(raw.value), sources, confirmed: false };
}
export function importProposals(batch: Batch, raw: any): Batch {
  if (!plain(raw) || raw.schema !== PREPARATION_SCHEMA || raw.sellerId !== batch.sellerId || !Array.isArray(raw.proposals) || raw.proposals.length > 100) throw new Error('Proposta incompatível com o formato ou a conta deste lote.');
  const ids = new Set<string>();
  const parsed = raw.proposals.map((p: any) => {
    const current = batch.drafts.find(d => d.productId === p.productId);
    if (!current || p.sku !== current.sku || ids.has(p.productId) || !plain(p.fields)) throw new Error('Produto/SKU divergente, repetido ou fora da seleção.');
    ids.add(p.productId);
    const fields: Partial<Record<FieldName, Field>> = {};
    for (const name of Object.keys(p.fields)) {
      if (!(FIELD_NAMES as readonly string[]).includes(name)) throw new Error(`Campo não permitido: ${name}`);
      fields[name as FieldName] = parseField(p.fields[name]);
    }
    return { productId: p.productId, fields };
  });
  return { ...batch, drafts: batch.drafts.map(d => {
    const proposal = parsed.find(p => p.productId === d.productId); if (!proposal) return d;
    const fields = { ...d.fields };
    for (const [name, incoming] of Object.entries(proposal.fields) as [FieldName, Field][]) {
      const n = name as FieldName, current = fields[n];
      if (current && filled(current.value) && !same(current.value, incoming!.value)) fields[n] = { ...current, conflict: { value: incoming!.value, sources: incoming!.sources }, confirmed: false };
      else if (!current || !same(current.value, incoming!.value)) fields[n] = incoming;
    }
    return { ...d, fields };
  }) };
}
export function validGtin(value: any): boolean {
  const v = text(value); if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(v)) return false;
  let sum = 0; for (let i = v.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) sum += Number(v[i]) * weight;
  return (10 - sum % 10) % 10 === Number(v.at(-1));
}
export function evaluateDraft(batch: Batch, draft: Draft) {
  const issues: Issue[] = [], f = draft.fields;
  const add = (code: string, message: string, field?: FieldName, level: Issue['level'] = 'blocker') => issues.push({ code, message, field, level });
  const requireField = (name: FieldName) => { const field = f[name]; if (!filled(field?.value)) add('missing', `Preencha ${name}.`, name); else if (!proven(field)) add('unconfirmed', `Confirme o valor e a fonte de ${name}.`, name); };
  const product = batch.snapshot.products.find(p => p.id === draft.productId);
  if (!product || product.sku !== draft.sku) add('product_identity', 'Produto/SKU mudou ou não pertence ao snapshot.');
  if (!draft.sku) add('sku_missing', 'Produto sem SKU.');
  if (product?.is_virtual || product?.is_gift || (product?.status && product.status !== 'active')) add('product_not_sellable', 'Produto virtual, brinde ou fora do estado ativo requer revisão.');
  if (!batch.snapshot.complete || batch.sellerId !== batch.snapshot.sellerId || !batch.sellerId) add('snapshot_incomplete', 'Confirme uma consulta completa e isolada da conta, incluindo anúncios e vínculos.');
  const age = Date.now() - Date.parse(batch.snapshot.capturedAt);
  if (!Number.isFinite(age) || age < -300000 || age > 86400000) add('snapshot_stale', 'Reconsulte catálogo, anúncios e vínculos: snapshot inválido ou com mais de 24 horas.');
  const variations = array(f.variations?.value).filter(plain), members = [draft.productId, ...variations.map(v => v.productId)], skus = [draft.sku, ...variations.map(v => v.sku)].filter(Boolean);
  if (f.variations && (!Array.isArray(f.variations.value) || variations.length !== f.variations.value.length)) add('variant_shape', 'Variantes precisam de uma lista de objetos válidos.', 'variations');
  if (f.attributes && !plain(f.attributes.value)) add('attribute_shape', 'Atributos precisam de um mapa de valores.', 'attributes');
  if (batch.snapshot.links.some(l => members.includes(l.product_id))) add('already_linked', 'Produto ou variante já possui vínculo persistido; revisar anúncio existente.');
  if (batch.snapshot.listings.some(l => skus.includes(l.sku))) add('existing_listing', 'SKU encontrado em anúncio da conta, inclusive pausado/encerrado; conferir antes de criar duplicação.');
  const mode = batch.accountMode.value as AccountMode;
  if (!['legacy', 'user_products'].includes(mode) || !proven(batch.accountMode)) add('account_mode_unknown', 'Modelo da conta ainda não confirmado: legado ou User Products.');
  for (const name of FIELD_NAMES) if (f[name]?.conflict) add('conflict', `Resolva o conflito de ${name}.`, name);
  for (const name of ['description', 'categoryId', 'categoryRequirements', 'condition', 'priceCents', 'quantity', 'photos', 'attributes', 'commercialPolicy'] as FieldName[]) requireField(name);
  requireField(mode === 'user_products' ? 'familyName' : 'title');
  if (f.condition && !['new', 'used', 'not_specified'].includes(f.condition.value)) add('condition_invalid', 'Condição deve ser confirmada para a categoria.', 'condition');
  if (!Number.isSafeInteger(f.priceCents?.value) || f.priceCents!.value <= 0) add('price_invalid', 'Preço precisa ser inteiro positivo em centavos.', 'priceCents');
  if (!Number.isSafeInteger(f.quantity?.value) || f.quantity!.value < 1) add('stock_invalid', 'Confirme quantidade disponível positiva, sem presumir estoque ilimitado.', 'quantity');
  if (!product?.is_parent && (!Number.isSafeInteger(product?.stock_quantity) || f.quantity?.value > product!.stock_quantity!)) add('stock_exceeds_local', 'Quantidade excede o saldo local ou o saldo do cadastro está desconhecido.', 'quantity');
  const photos = array(f.photos?.value);
  if (!photos.length || photos.some(p => !plain(p) || !url(p?.url) || !['own', 'authorized'].includes(p?.rights) || !text(p?.evidence))) add('photos_rights', 'Cada foto precisa de URL HTTPS e evidência de autoria/autorização.', 'photos');
  const requirements = f.categoryRequirements?.value;
  if (!plain(requirements) || requirements.categoryId !== f.categoryId?.value || !Array.isArray(requirements.requiredAttributes) || !Array.isArray(requirements.requiredCertificates) || typeof requirements.allowsLegacyVariations !== 'boolean' || !official(f.categoryRequirements)) add('category_schema_unknown', 'Importe requisitos da categoria com fonte oficial e confirme a revisão.', 'categoryRequirements');
  else {
    for (const id of requirements.requiredAttributes) if (!text(id) || (!filled(f.attributes?.value?.[id]) && !(id === 'GTIN' && proven(f.gtin)))) add('attribute_missing', `Atributo obrigatório pendente: ${id}.`, 'attributes');
    for (const id of requirements.requiredCertificates) {
      const certificate = f.certificates?.value?.[id];
      if (!text(certificate?.number) || !url(certificate?.evidence) || !official(f.certificates)) add('certificate_missing', `Certificação ${id} exige número e evidência oficial.`, 'certificates');
    }
    if (variations.length && !requirements.allowsLegacyVariations && mode === 'legacy') add('variations_not_allowed', 'Categoria não confirmada para variações legadas.', 'variations');
  }
  if (filled(f.gtin?.value) && (!validGtin(f.gtin?.value) || !proven(f.gtin) || !f.gtin!.sources.some(s => ['catalog', 'manufacturer', 'official_catalog', 'official_document'].includes(s.kind)))) add('gtin_unverified', 'GTIN exige dígito válido e cadastro conferido/fonte oficial; anúncio concorrente não comprova GTIN.', 'gtin');
  if (filled(f.attributes?.value?.GTIN) && (f.attributes?.value?.GTIN !== f.gtin?.value || !proven(f.gtin) || !validGtin(f.gtin?.value))) add('gtin_attribute', 'GTIN no mapa de atributos precisa coincidir com o campo GTIN verificado.', 'gtin');
  for (const id of Object.keys(plain(f.attributes?.value) ? f.attributes!.value : {}).filter(id => /ANATEL|INMETRO/i.test(id))) {
    const certificate = f.certificates?.value?.[id];
    if (!official(f.certificates) || !text(certificate?.number) || !url(certificate?.evidence)) add('certificate_attribute', `Atributo ${id} exige certificação com número e fonte oficial, mesmo fora dos requisitos importados.`, 'certificates');
  }
  const policy = f.commercialPolicy?.value;
  if (!plain(policy?.pricing) || !Number.isSafeInteger(policy.pricing.marginBps)) add('pricing_pending', 'Configure a margem líquida e calcule o preço com as tarifas oficiais.', 'commercialPolicy');
  if (!plain(policy) || !text(policy.listingTypeId) || !text(policy.warranty) || !text(policy.shipping?.mode) || typeof policy.shipping?.freeShipping !== 'boolean' || !['seller', 'buyer'].includes(policy.shipping?.payer)) add('commercial_pending', 'Confirme tipo de anúncio, garantia e regra de frete; não há margem/frete presumidos.', 'commercialPolicy');
  if (product?.is_parent && !variations.length) add('children_missing', 'Produto pai requer revisão de todas as variantes.', 'variations');
  if (variations.length) {
    requireField('variations');
    if (new Set(variations.map(v => v.productId)).size !== variations.length || new Set(variations.map(v => v.sku)).size !== variations.length) add('variant_duplicate', 'Variantes ou SKUs repetidos.', 'variations');
    for (const v of variations) {
      const child = batch.snapshot.products.find(p => p.id === v.productId);
      if (child?.is_virtual || child?.is_gift || (child?.status && child.status !== 'active') || !Number.isSafeInteger(child?.stock_quantity) || v.quantity > child!.stock_quantity!) add('variant_stock', `Variante ${v.sku || '?'} exige saldo local suficiente e estado vendável.`, 'variations');
      if (!child || child.sku !== v.sku || child.parent_id !== draft.productId || !Object.keys(v.attributes || {}).length || !Number.isSafeInteger(v.priceCents) || v.priceCents <= 0 || !Number.isSafeInteger(v.quantity) || v.quantity < 1) add('variant_invalid', `Confira identidade, atributos, preço e saldo da variante ${v.sku || '?'}.`, 'variations');
      if (!Array.isArray(v.photos) || !v.photos.length || v.photos.some(p => !plain(p) || !url(p?.url) || !['own', 'authorized'].includes(p?.rights) || !text(p?.evidence))) add('variant_photos', `Fotos/autorização pendentes da variante ${v.sku || '?'}.`, 'variations');
    }
    const expected = batch.snapshot.products.filter(p => p.parent_id === draft.productId).map(p => p.id);
    if (expected.some(id => !variations.some(v => v.productId === id))) add('children_omitted', 'Há variantes locais ausentes da proposta.', 'variations');
  }
  add('live_validation_required', 'Prontidão é local: categoria, conta, estoque e anúncios exigirão validação atual antes de uma publicação futura.', undefined, 'warning');
  const references = Object.values(f).flatMap(x => x?.sources || []).filter(s => s.kind === 'marketplace_reference');
  if (new Set(references.map(s => s.reference)).size < 3) add('research_optional', 'Pesquisa assistida: comparar 3–5 anúncios do modelo exato quando houver acesso permitido; priorizar fabricante/catálogo.', undefined, 'warning');
  return { productId: draft.productId, status: issues.some(i => i.level === 'blocker') ? 'review' : 'ready_for_local_preview', submissionAllowed: false, issues };
}
export function evaluateBatch(batch: Batch) {
  return batch.drafts.map(d => {
    const report = evaluateDraft(batch, d), ids = [d.productId, ...array(d.fields.variations?.value).filter(plain).map(v => v.productId)], skus = [d.sku, ...array(d.fields.variations?.value).filter(plain).map(v => v.sku)];
    if (batch.drafts.some(other => other !== d && ([other.productId, ...array(other.fields.variations?.value).filter(plain).map(v => v.productId)].some(id => ids.includes(id)) || [other.sku, ...array(other.fields.variations?.value).filter(plain).map(v => v.sku)].some(s => s && skus.includes(s))))) {
      report.status = 'review'; report.issues.push({ code: 'batch_duplicate', level: 'blocker', message: 'Produto ou SKU repetido em outro rascunho do lote.' });
    }
    return report;
  });
}
export function previewContract(batch: Batch, draft: Draft) {
  const report = evaluateBatch(batch).find(r => r.productId === draft.productId);
  if (report?.status !== 'ready_for_local_preview') return null;
  const v = (name: FieldName) => draft.fields[name]?.value;
  const common = { category_id: v('categoryId'), price_cents: v('priceCents'), quantity: v('quantity'), sku: draft.sku, condition: v('condition'), photos: v('photos'), attributes: v('attributes'), description: v('description'), gtin: v('gtin'), commercial_policy: v('commercialPolicy') };
  // These are separate preview contracts, intentionally NOT Mercado Livre API payloads.
  return batch.accountMode.value === 'legacy'
    ? { contract: 'legacy_preview', submissionAllowed: false, proposal: { ...common, title: v('title'), variations: v('variations') || [] } }
    : { contract: 'user_products_preview', submissionAllowed: false, proposal: { ...common, family_name: v('familyName'), family_members: v('variations') || [] } };
}
export function researchPacket(batch: Batch) {
  return { schema: PREPARATION_SCHEMA, sellerId: batch.sellerId, purpose: 'Propostas para revisão local; sem publicação',
    instructions: ['Prepare propostas para revisão do operador. A tela pode executar a pesquisa pelo Codex local ou importar este lote manualmente.', 'Compare 3–5 anúncios do modelo exato apenas quando o acesso for permitido. Não faça coleta irrestrita.', 'Priorize fabricante, catálogo oficial ou cadastro conferido. Registre fonte por campo e divergências.', 'Não invente GTIN, certificações Anatel/Inmetro, especificações, preço, frete ou direitos de fotos.', 'Retorne proposals com productId, sku e fields: {nome: {value, sources:[{kind,reference,note}]}}. Não confirme campos em nome do operador.'],
    products: batch.drafts.map(d => ({ product: batch.snapshot.products.find(p => p.id === d.productId), currentFields: d.fields })), proposals: [] };
}
export const preparationProviders = {
  local: { id: 'local_import', automatic: false, import: importProposals },
  futureApi: { id: 'ai_api', enabled: false, async enrich(): Promise<never> { throw new Error('Provedor API de IA desativado nesta etapa.'); } },
};
