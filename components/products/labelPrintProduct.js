// Produto que vai para a etiqueta de preço.
// Variação de família sem preço próprio (herdado do pai) usa o preço do pai, para a etiqueta não sair R$ 0,00.
export function labelPrintProduct(product, parent = null) {
  if (!product) return null;
  const ownPrice = Number(product.price_retail) || 0;
  const parentPrice = Number(parent?.price_retail) || 0;
  if (ownPrice > 0 || parentPrice <= 0 || !parent || String(parent.id) === String(product.id)) return product;
  return { ...product, price_retail: parentPrice };
}
