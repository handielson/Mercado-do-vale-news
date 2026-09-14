// Shared by the existing browser compositor and the authenticated marketing API.
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const rules = [
  ['kitchen', /balanca.*cozinha|cozinha.*balanca|culinaria|utensilio.*cozinha/, 'cozinha moderna', 'modern kitchen countertop cooking ingredients', 'cozinha moderna bancada ingredientes', ['cozinha', 'bancada', 'culinaria'], ['scale', 'kitchen scale']],
  ['patch-panel', /patch\s*panel/, 'rack profissional', 'professional network rack data center', 'rack profissional sala de servidores', ['rede', 'rack', 'servidores'], ['patch panel']],
  ['cable-organizer', /organizador.*cabo|guia.*cabo/, 'cabeamento organizado', 'organized network rack server room', 'sala tecnica rack organizado', ['rede', 'rack', 'cabos'], ['cable organizer']],
  ['network', /rede|rack|rj45|keystone|cat[56]/, 'data center', 'network server rack data center organized cables', 'data center rack cabos organizados', ['rede', 'rack', 'servidores'], ['patch panel', 'connector']],
  ['charging', /carregador|cabo|power.?bank|fonte.*usb/, 'estação de trabalho', 'modern desk charging station', 'mesa moderna estacao de trabalho', ['mesa', 'trabalho', 'tecnologia'], ['charger', 'power bank']],
  ['gaming', /gamer|gaming|joystick|controle.*jogo/, 'setup gamer', 'gaming setup desk rgb', 'mesa setup gamer iluminacao', ['mesa', 'gamer', 'jogos'], ['controller', 'gamepad']],
  ['audio', /audio|fone|headset|caixa.*som/, 'entretenimento', 'modern living room entertainment', 'sala moderna entretenimento', ['sala', 'entretenimento', 'som'], ['speaker', 'headphones']],
  ['tools', /ferramenta|alicate|furadeira|chave.*fenda/, 'bancada de oficina', 'organized workshop workbench', 'oficina bancada organizada', ['oficina', 'bancada', 'ferramentas'], ['pliers', 'drill']],
  ['security', /seguranca|camera|monitoramento|cftv/, 'ambiente monitorado', 'modern home security monitoring', 'casa moderna ambiente monitorado', ['casa', 'seguranca'], ['security camera']],
  ['automotive', /automotiv|veiculo|carro|garagem/, 'garagem profissional', 'modern car interior professional garage', 'interior carro garagem profissional', ['carro', 'garagem'], ['car accessory']],
  ['phone', /celular|smartphone|iphone|redmi|galaxy/, 'ambiente tecnológico premium', 'modern technology desk premium workspace', 'mesa tecnologia ambiente premium', ['mesa', 'tecnologia'], ['smartphone', 'phone']],
  ['computing', /informatica|computador|notebook|mouse|teclado/, 'escritório moderno', 'modern computer desk office', 'escritorio moderno mesa computador', ['mesa', 'escritorio'], ['keyboard', 'mouse']],
];
const contexts = new Map();
export function resolveProductSceneContext(product = {}) {
  const evidence = [product.name, product.category_name, product.subcategory_name, product.description, product.specs, product.custom_fields, product.keywords, product.purpose].map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(' ');
  const key = normalize(evidence);
  if (contexts.has(key)) return contexts.get(key);
  const rule = rules.find(r => r[1].test(key)) || ['neutral', null, 'ambiente tecnológico', 'dark modern technology workspace', 'ambiente tecnologico moderno', ['tecnologia'], []];
  const value = { key: rule[0], context: rule[2], primaryQuery: rule[3], alternativeQuery: rule[4], orientation: 'portrait', tags: rule[5], excludedTerms: rule[6], confidence: rule[0] === 'neutral' ? 40 : 90 };
  if (contexts.size >= 1000) contexts.delete(contexts.keys().next().value);
  contexts.set(key, value);
  return value;
}
export function hashScene(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
export function scoreBackground(background, product, scene) {
  let score = 0;
  if (background.categoryId && background.categoryId === product.category_id) score += 25;
  if (background.subcategoryId && background.subcategoryId === product.subcategory_id) score += 20;
  if (background.contextKey === scene.key) score += 20;
  if ((background.tags || []).some(tag => scene.tags.includes(tag))) score += 15;
  if (background.height > background.width) score += 10;
  if (background.width >= 1080 && background.height >= 1920) score += 10; else score -= 40;
  if (background.approved) score += 20;
  if (scene.key === 'neutral' || background.contextKey === 'neutral') score -= 20;
  const alt = normalize(background.alt);
  const conflict = Boolean(background.conflict) || [...scene.excludedTerms, 'logo', 'brand', 'portrait', 'person', 'packaging'].some(term => alt.includes(term));
  if (conflict) score -= 30;
  // Metadata cannot establish that the photo is visually safe. Unreviewed photos never auto-publish.
  if (!background.approved) score = Math.min(79, score);
  return { score: Math.max(0, Math.min(100, score)), conflict, visualReviewed: Boolean(background.approved), status: score >= 80 && !conflict && background.approved ? 'ready' : score >= 60 && !conflict ? 'completed_with_warning' : 'review_required' };
}
export function selectBackgroundForProduct(product, backgrounds, { variation = 0, preferredId } = {}) {
  const scene = resolveProductSceneContext(product);
  const candidates = backgrounds.filter(b => b.active && b.approved).map(background => ({ background, ...scoreBackground(background, product, scene) })).filter(b => b.status === 'ready' || (b.status === 'completed_with_warning' && b.background.contextKey === scene.key));
  const priority = b => b.productId === product.id ? 4 : b.subcategoryId && b.subcategoryId === product.subcategory_id ? 3 : b.categoryId && b.categoryId === product.category_id ? 2 : b.contextKey === scene.key ? 1 : 0;
  const highest = Math.max(0, ...candidates.map(b => priority(b.background)));
  const pool = candidates.filter(b => priority(b.background) === highest).sort((a,b) => b.score-a.score || a.background.id.localeCompare(b.background.id)).slice(0, 10);
  const preferred = !variation && pool.find(b => b.background.id === preferredId);
  const previousIndex = pool.findIndex(b => b.background.id === preferredId);
  const selected = preferred || pool[((variation && previousIndex >= 0 ? previousIndex : hashScene(product.id + scene.key)) + variation) % pool.length];
  return selected ? { ...selected, scene } : { background: null, scene, score: 0, status: 'review_required' };
}
export async function mapScenePool(items, worker, concurrency = 3) {
  const results = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, Math.min(8, concurrency))) }, async () => {
    while (next < items.length) { const index = next++; try { results[index] = await worker(items[index], index); } catch (error) { results[index] = { status: 'failed', message: error.message }; } }
  }));
  return results;
}
