// pdp-internal-specs-hidden-v1: a ficha técnica da página do cliente não mostra dados internos.
// O specs do produto também guarda controles do sistema (marketplaces, grupo de preço, produção,
// unidade fiscal). Eles nunca aparecem em "Outras Características".

const normalize = value => String(value ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toLowerCase().replace(/[\s.-]+/g, '_');

/** Chaves internas exatas. */
export const INTERNAL_SPEC_KEYS = new Set([
  'unit', 'unidade', 'unidade_medida', 'production', 'producao',
  'price_group_network', 'price_group', 'price_group_id', 'price_group_key',
  'mercado_livre', 'mercadolivre', 'shopee', 'tiktok', 'bling',
  'shopee_auto_publish_enabled',
]);

/** Prefixos de integrações e controles internos. */
const INTERNAL_PREFIXES = ['shopee_', 'mercado_livre_', 'mercadolivre_', 'ml_', 'bling_', 'tiktok_', 'price_group_', 'internal_', 'admin_'];

/** Atributos da Shopee viram ficha pública de propósito (shopee_attribute_<id>). */
const PUBLIC_EXCEPTIONS = /^shopee_attribute_\d+$/;

export function isInternalSpecKey(key) {
  // Chave começando com "_" é marca do sistema para campo interno (ex.: _price_group_network, _bling_name_sync).
  if (/^\s*_/.test(String(key ?? ''))) return true;
  const k = normalize(key);
  if (!k) return true;
  if (PUBLIC_EXCEPTIONS.test(k)) return false;
  if (INTERNAL_SPEC_KEYS.has(k)) return true;
  return INTERNAL_PREFIXES.some(prefix => k.startsWith(prefix));
}

/**
 * Valor pode aparecer para o cliente?
 * - objeto nunca (viraria "[object Object]");
 * - true/false soltos só quando o campo é do template da categoria (fromTemplate).
 */
export function isPublicSpecValue(value, { fromTemplate = false } = {}) {
  if (value == null) return false;
  if (typeof value === 'object' && !Array.isArray(value)) return false;
  if (typeof value === 'boolean') return fromTemplate;
  const text = String(value).trim();
  if (!fromTemplate && /^(true|false)$/i.test(text)) return false;
  return text !== '' && text !== '[object Object]';
}
