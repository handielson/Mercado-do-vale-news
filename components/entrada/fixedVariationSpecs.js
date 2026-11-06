// fixed-variation-specs-v1: o card da variação fixa da Entrada mostra RAM, armazenamento e cor
// para o operador conferir com o aparelho/caixa antes de dar entrada.

const clean = value => (value == null ? '' : String(value).trim());

/** Lê ram (RAM física primeiro), storage e color do specs do produto (objeto ou JSON em texto). */
export function readVariationSpecs(product) {
  let specs = product && product.specs;
  if (typeof specs === 'string') {
    try { specs = JSON.parse(specs); } catch { specs = null; }
  }
  if (!specs || typeof specs !== 'object') specs = {};
  return {
    ram: clean(specs.ram_fisica || specs.ram),
    storage: clean(specs.storage),
    color: clean(specs.color),
  };
}

/** Itens para o card, na ordem: RAM, Armazenamento, Cor. Campo vazio aparece como "não informado". */
export function variationSpecItems(specs, { isPhone } = {}) {
  const s = specs || {};
  const items = [];
  if (isPhone || s.ram || s.storage) {
    items.push({ label: 'RAM', value: s.ram || 'não informado', missing: !s.ram });
    items.push({ label: 'Armazenamento', value: s.storage || 'não informado', missing: !s.storage });
  }
  if (s.color) items.push({ label: 'Cor', value: s.color, missing: false });
  return items;
}
