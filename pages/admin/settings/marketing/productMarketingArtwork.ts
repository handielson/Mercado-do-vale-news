import type { CatalogProduct } from '../../../../types/catalog';
import type { PaymentFee } from '../../../../types/payment-fees';
import { calculateInstallmentFromFees } from '../../../../services/installmentCalculator';

export interface ProductMarketingTheme {
  accent: string;
  accentSoft: string;
  accentText: string;
}

export interface ProductMarketingSpec {
  key: 'rearCamera' | 'frontCamera' | 'battery' | 'processor' | 'display' | 'refreshRate' | 'storage' | 'ram';
  label: string;
  value: string;
  detail?: string;
}

export interface ProductMarketingArtworkData {
  brand: string;
  name: string;
  version: string;
  technology: string;
  color: string;
  price: number;
  installmentValue: number;
  installmentTotal: number;
  installmentCount: number;
  specs: ProductMarketingSpec[];
  features: string[];
  sellingBadge: string;
  theme: ProductMarketingTheme;
}

const clean = (value: unknown): string => value === undefined || value === null ? '' : String(value).trim();

function readSpec(product: CatalogProduct, aliases: string[]): string {
  const specs = product.specs || {};
  for (const alias of aliases) {
    const value = clean(specs[alias]);
    if (value) return value;
  }
  return '';
}

function withUnit(value: string, unit: string): string {
  if (!value) return '';
  return new RegExp(unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(value) ? value : `${value} ${unit}`;
}

function normalizeMemory(value: string): string {
  if (!value) return '';
  return value.toUpperCase().replace(/^(\d+)\s*G$/, '$1 GB').replace(/^(\d+)\s*T$/, '$1 TB').replace(/(\d)GB/g, '$1 GB');
}

function isEnabled(value: unknown): boolean {
  if (value === true || value === 1) return true;
  return ['sim', 'yes', 'true', '1', 'ativo', 'possui'].includes(clean(value).toLowerCase());
}

export function resolveProductMarketingTheme(product: CatalogProduct): ProductMarketingTheme {
  const identity = `${product.brand || ''} ${product.model || ''} ${product.name || ''}`.toLowerCase();
  if (identity.includes('poco')) return { accent: '#facc15', accentSoft: '#f59e0b', accentText: '#080b0f' };
  if (identity.includes('xiaomi') || identity.includes('redmi')) return { accent: '#ff6900', accentSoft: '#fb923c', accentText: '#ffffff' };
  if (identity.includes('samsung')) return { accent: '#2563eb', accentSoft: '#60a5fa', accentText: '#ffffff' };
  if (identity.includes('motorola') || identity.includes('moto ')) return { accent: '#00a7e1', accentSoft: '#22d3ee', accentText: '#ffffff' };
  if (identity.includes('apple') || identity.includes('iphone')) return { accent: '#d1d5db', accentSoft: '#f8fafc', accentText: '#111827' };
  if (identity.includes('realme')) return { accent: '#facc15', accentSoft: '#fde047', accentText: '#111827' };
  return { accent: '#ff6b00', accentSoft: '#fbbf24', accentText: '#ffffff' };
}

export function resolveCurrentMarketingPrice(product: CatalogProduct, now = new Date()): number {
  const promo = Number(product.price_promo || 0);
  if (!promo) return Number(product.price_retail || 0);
  const startsAt = product.promo_start ? new Date(product.promo_start) : null;
  const endsAt = product.promo_end ? new Date(product.promo_end) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime()) && startsAt > now) return Number(product.price_retail || 0);
  if (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt < now) return Number(product.price_retail || 0);
  return promo;
}

export function buildProductMarketingArtworkData(product: CatalogProduct, paymentFees: PaymentFee[]): ProductMarketingArtworkData {
  const price = resolveCurrentMarketingPrice(product);
  const plan = calculateInstallmentFromFees(price, paymentFees, 12);
  const version = readSpec(product, ['versao', 'version', 'versão']);
  const network = readSpec(product, ['network', 'rede', 'tecnologia', 'technology']);
  const technology = /5g/i.test(`${network} ${product.name}`) ? '5G' : /4g/i.test(`${network} ${product.name}`) ? '4G' : network;
  const rearCamera = readSpec(product, ['cam_principal_mpx', 'camera_principal_mpx', 'camera_traseira_mpx', 'rear_camera', 'camera']);
  const frontCamera = readSpec(product, ['cam_selfie_mpx', 'camera_selfie_mpx', 'camera_frontal_mpx', 'front_camera']);
  const battery = readSpec(product, ['battery_mah', 'bateria_mah', 'battery', 'bateria']);
  const processor = readSpec(product, ['chipset', 'processador', 'processor', 'cpu']);
  const display = readSpec(product, ['display_type', 'tipo_tela', 'screen_type', 'display', 'tela']);
  const refreshRate = readSpec(product, ['celular_fps_display', 'refresh_rate', 'taxa_atualizacao', 'taxa_de_atualizacao']);
  const storage = normalizeMemory(readSpec(product, ['storage', 'armazenamento', 'memoria_interna', 'capacity']));
  const ram = normalizeMemory(readSpec(product, ['ram', 'memoria_ram', 'memory_ram']));
  const specValues: Array<ProductMarketingSpec | null> = [
    rearCamera ? { key: 'rearCamera', label: 'Câmera traseira', value: withUnit(rearCamera, 'MP'), detail: /ois/i.test(rearCamera) ? 'OIS' : undefined } : null,
    frontCamera ? { key: 'frontCamera', label: 'Câmera frontal', value: withUnit(frontCamera, 'MP') } : null,
    battery ? { key: 'battery', label: 'Bateria', value: withUnit(battery, 'mAh') } : null,
    processor ? { key: 'processor', label: 'Processador', value: processor } : null,
    display ? { key: 'display', label: 'Tela', value: display } : null,
    refreshRate ? { key: 'refreshRate', label: 'Atualização', value: withUnit(refreshRate, 'Hz') } : null,
    storage ? { key: 'storage', label: 'Armazenamento', value: storage, detail: readSpec(product, ['storage_type', 'tipo_armazenamento', 'ufs']) } : null,
    ram ? { key: 'ram', label: 'Memória RAM', value: ram, detail: readSpec(product, ['ram_type', 'tipo_ram']) } : null,
  ];
  const specs = specValues.filter((item): item is ProductMarketingSpec => Boolean(item));
  const rawSpecs = product.specs || {};
  const identity = `${product.brand || ''} ${product.model || ''} ${product.name || ''}`.toLowerCase();
  const marketingBrand = identity.includes('poco') ? 'POCO'
    : identity.includes('redmi') ? 'REDMI'
      : product.brand || product.model?.split(' ')[0] || '';
  const displayName = clean(product.model) || product.name;
  const features = [
    isEnabled(rawSpecs.nfc) ? 'NFC' : '',
    technology === '5G' || isEnabled(rawSpecs['5g']) || isEnabled(rawSpecs.has_5g) ? '5G' : '',
    isEnabled(rawSpecs.dual_chip) || isEnabled(rawSpecs.dual_sim) || /dual/i.test(readSpec(product, ['sim', 'chips'])) ? 'DUAL CHIP' : '',
  ].filter(Boolean);

  return {
    brand: marketingBrand,
    name: displayName,
    version,
    technology,
    color: readSpec(product, ['color', 'cor', 'colour']),
    price,
    installmentValue: plan.value,
    installmentTotal: plan.total,
    installmentCount: plan.installments,
    specs,
    features,
    sellingBadge: readSpec(product, ['sellingBadge', 'selling_badge', 'destaque_venda']) || (product.is_new ? 'LANÇAMENTO' : ''),
    theme: resolveProductMarketingTheme(product),
  };
}

export function normalizeBrazilianWhatsapp(value?: string | null): string {
  let digits = clean(value).replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return value || '';
}
