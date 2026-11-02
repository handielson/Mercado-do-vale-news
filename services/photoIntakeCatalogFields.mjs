// Campos do cadastro por foto que já existem no catálogo (marca, modelo, RAM, armazenamento)
// são escolhidos de lista. Aqui fica a comparação entre o que a IA leu e o que está cadastrado.

function stripAccents(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Texto comparável: sem acento, espaço ou pontuação, em maiúsculas. */
export function normalizeCatalogText(value) {
  return stripAccents(value).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/** Memória comparável: "8 GB", "8gb" e "8" viram "8GB"; "1 TB" vira "1TB". */
export function normalizeMemoryText(value) {
  const text = normalizeCatalogText(value);
  if (/^\d+$/.test(text)) return `${text}GB`;
  return text;
}

/**
 * Procura a opção cadastrada que corresponde ao valor lido.
 * @param {string[]} options rótulos cadastrados
 * @param {string} value valor lido/atual
 * @param {'text' | 'memory'} kind
 * @returns {string | null} o rótulo cadastrado, ou null quando não existe
 */
export function findCatalogOption(options, value, kind = 'text') {
  const normalize = kind === 'memory' ? normalizeMemoryText : normalizeCatalogText;
  const target = normalize(value);
  if (!target) return null;
  return (Array.isArray(options) ? options : []).find(option => normalize(option) === target) ?? null;
}

// Submarcas impressas na caixa → marca do cadastro (só quando a submarca não existe como marca).
const BRAND_FAMILY = Object.freeze({
  REDMI: 'XIAOMI',
  MI: 'XIAOMI',
  POCO: 'XIAOMI',
  GALAXY: 'SAMSUNG',
  IPHONE: 'APPLE',
  MOTO: 'MOTOROLA',
});

/**
 * Melhor palpite de marca: igual ao cadastro, ou a marca-mãe da submarca lida.
 * @returns {{ value: string, exact: boolean } | null}
 */
export function guessCatalogBrand(brandNames, raw) {
  const exact = findCatalogOption(brandNames, raw);
  if (exact) return { value: exact, exact: true };
  const family = BRAND_FAMILY[normalizeCatalogText(raw)];
  const parent = family ? findCatalogOption(brandNames, family) : null;
  return parent ? { value: parent, exact: false } : null;
}

function modelSlug(value) {
  return stripAccents(value).toUpperCase().replace(/[^0-9A-Z]+/g, ' ').trim();
}

/**
 * Melhor palpite de modelo: nome igual, ou o nome cadastrado mais longo que começa o texto lido
 * (a etiqueta costuma grudar cor/versão: "Redmi Note 17 Black" → "Redmi Note 17").
 * @param {Array<{id: string, name: string, brand_id?: string}>} models
 * @param {string} raw
 * @param {{ brandName?: string | null, brandId?: string | null }} context
 * @returns {{ id: string, exact: boolean } | null}
 */
export function guessCatalogModel(models, raw, context = {}) {
  const wanted = modelSlug(raw);
  if (!wanted) return null;
  const brand = context.brandName ? modelSlug(context.brandName) : '';
  const variants = new Set([wanted]);
  // Aceita com ou sem o nome da marca na frente ("Xiaomi Redmi Note 17" ↔ "Redmi Note 17").
  if (brand && wanted.startsWith(`${brand} `)) variants.add(wanted.slice(brand.length + 1));
  if (brand && !wanted.startsWith(`${brand} `)) variants.add(`${brand} ${wanted}`);
  const pool = (Array.isArray(models) ? models : []).filter(model => !context.brandId || !model.brand_id || model.brand_id === context.brandId);
  let best = null;
  for (const model of pool) {
    const name = modelSlug(model.name);
    if (!name) continue;
    for (const variant of variants) {
      if (variant === name) return { id: model.id, exact: true };
      // Precisa de pelo menos 2 palavras para não casar "Redmi" sozinho com tudo.
      if (name.includes(' ') && variant.startsWith(`${name} `) && (!best || name.length > best.length)) {
        best = { id: model.id, length: name.length };
      }
    }
  }
  return best ? { id: best.id, exact: false } : null;
}

const COLOR_WORDS = new Set([
  'BLACK', 'WHITE', 'BLUE', 'GREEN', 'PURPLE', 'GOLD', 'SILVER', 'GRAY', 'GREY', 'PINK', 'RED', 'YELLOW',
  'ORANGE', 'MIDNIGHT', 'TITANIUM', 'GRAPHITE', 'OCEAN', 'SKY', 'MINT', 'LAVENDER', 'CORAL', 'SAND', 'ICE',
  'AURORA', 'STARRY', 'GLACIER', 'FOREST', 'MOONLIGHT', 'SUNSET', 'TWILIGHT', 'LIME', 'OLIVE', 'BRONZE',
  'PRETO', 'BRANCO', 'AZUL', 'VERDE', 'ROXO', 'DOURADO', 'PRATA', 'CINZA', 'ROSA', 'VERMELHO', 'AMARELO', 'LARANJA',
]);

/**
 * Nome sugerido para cadastrar um modelo novo a partir do texto da etiqueta:
 * tira a marca da frente, memória ("8GB+256GB") e a cor que gruda no fim.
 */
export function suggestModelName(raw, { brandName = '', colorNames = [] } = {}) {
  let words = String(raw ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const brand = normalizeCatalogText(brandName);
  if (brand && words.length > 1 && normalizeCatalogText(words[0]) === brand) words = words.slice(1);
  words = words.filter(word => !/^\d+\s*(GB|TB)(\+\d+\s*(GB|TB))?$/i.test(word) && !/^\d+\+\d+(GB|TB)?$/i.test(word));
  const colorWords = new Set([...COLOR_WORDS, ...colorNames.flatMap(name => String(name).split(/\s+/)).map(normalizeCatalogText).filter(Boolean)]);
  while (words.length > 1 && colorWords.has(normalizeCatalogText(words[words.length - 1]))) words.pop();
  return words.join(' ');
}

/** Categoria do modelo "irmão" mais parecido da mesma marca (ex.: Redmi Note 15 → Redmi Note 17). */
export function siblingModelCategory(models, name, brandId) {
  const target = modelSlug(name).split(' ');
  let best = null;
  for (const model of Array.isArray(models) ? models : []) {
    if (!model?.category_id || (brandId && model.brand_id !== brandId)) continue;
    const words = modelSlug(model.name).split(' ');
    let shared = 0;
    while (shared < Math.min(words.length, target.length) && words[shared] === target[shared]) shared += 1;
    if (shared > 0 && (!best || shared > best.shared)) best = { shared, category_id: model.category_id };
  }
  return best?.category_id || null;
}
