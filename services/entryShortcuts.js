// entrada-atalhos-v1: os atalhos de cadastro de estoque e de nova variação abrem a Entrada (/admin/entrada).

/**
 * "+ peças", "Incluir peças" e "Adicionar Unidade": Entrada com a variação fixa.
 * @param {string | number | null | undefined} productId
 * @returns {string | null} caminho da Entrada, ou null quando não há produto.
 */
export function entryAddUnitsPath(productId) {
  if (productId == null || productId === '') return null;
  return `/admin/entrada?variacao=${encodeURIComponent(String(productId))}`;
}

/**
 * "Nova variação (cor/memória)": Entrada Manual com o modelo do pai.
 * Pai sem model_id (importado do Bling) devolve null: quem chama segue no fluxo antigo
 * (/admin/products/new com getFamilyChildState) até a etapa 6.
 * @param {{ model_id?: string | number | null } | null | undefined} parent
 * @returns {string | null}
 */
export function entryNewVariationPath(parent) {
  const modelId = parent?.model_id;
  if (modelId == null || modelId === '') return null;
  return `/admin/entrada?aba=manual&modelo=${encodeURIComponent(String(modelId))}`;
}

/**
 * stock-entry-only-v1: "Dar entrada no estoque" depois do cadastro no formulário de produto.
 * Produto simples ou variação: Entrada com a variação fixa. Família: Entrada Manual com o modelo
 * do pai; sem modelo, a primeira variação salva.
 * @param {{ id?: string | number | null, is_parent?: boolean | number | null, model_id?: string | number | null } | null | undefined} product
 * @param {Array<{ id?: string | number | null } | null | undefined>} [children] variações confirmadas, na ordem do cadastro.
 * @returns {string | null}
 */
export function entryAfterRegistrationPath(product, children = []) {
  if (product?.id == null || product.id === '') return null;
  if (!product.is_parent) return entryAddUnitsPath(product.id);
  return entryNewVariationPath(product) || entryAddUnitsPath(children.find(child => child?.id)?.id);
}
