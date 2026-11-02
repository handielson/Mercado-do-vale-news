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
