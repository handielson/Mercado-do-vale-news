// Public commercial attributes only. Never include arbitrary/internal specs.
export function print3dVariantLabel(product) {
  const specs = Object.entries(product.specs || {});
  const values = [['material'], ['color', 'cor'], ['size', 'tamanho'], ['finish', 'acabamento']].map(aliases => {
    for (const alias of aliases) {
      const entry = specs.find(([key, value]) => key.trim().toLocaleLowerCase('pt-BR') === alias
        && (typeof value === 'string' || typeof value === 'number') && String(value).trim());
      if (entry) return String(entry[1]).trim();
    }
    return '';
  });
  return values.filter(Boolean).join(' · ') || product.sku || '';
}
