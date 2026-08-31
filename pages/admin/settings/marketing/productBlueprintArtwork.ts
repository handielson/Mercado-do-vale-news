import type { CatalogProduct, ProductGroup } from '../../../../types/catalog';
import { resolveProductMarketingTheme, type ProductMarketingTheme } from './productMarketingArtwork';

export interface ProductBlueprintItem {
  label: string;
  value: string;
}

export interface ProductBlueprintSection {
  key: 'display' | 'cameras' | 'performance' | 'memory' | 'battery' | 'connectivity' | 'construction' | 'dimensions' | 'system';
  label: string;
  items: ProductBlueprintItem[];
}

export interface ProductBlueprintData {
  modelId: string;
  brand: string;
  name: string;
  subtitle: string;
  overview: string;
  colors: string[];
  memoryVariants: string[];
  sections: ProductBlueprintSection[];
  missingFields: string[];
  theme: ProductMarketingTheme;
}

const clean = (value: unknown): string => value == null ? '' : String(value).trim();

function readSpec(product: CatalogProduct, aliases: string[]): string {
  const specs = product.specs || {};
  for (const alias of aliases) {
    const nestedValue = alias.split('.').reduce<unknown>((current, key) => (
      current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined
    ), specs);
    const value = clean(specs[alias] ?? nestedValue);
    if (value && value !== '0' && value.toLowerCase() !== 'null') return value;
  }
  return '';
}

function item(label: string, value: string): ProductBlueprintItem | null {
  return value ? { label, value } : null;
}

function section(
  key: ProductBlueprintSection['key'],
  label: string,
  values: Array<ProductBlueprintItem | null>,
): ProductBlueprintSection | null {
  const items = values.filter((entry): entry is ProductBlueprintItem => Boolean(entry));
  return items.length ? { key, label, items } : null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

export function buildProductBlueprintArtworkData(group: ProductGroup): ProductBlueprintData {
  const products = group.variants.flatMap((variant) => variant.products);
  const representative = group.representativeProduct || products[0];
  const brand = clean(group.brand || representative?.brand).toUpperCase();
  const name = clean(group.model || representative?.model || representative?.name);
  const network = readSpec(representative, ['network', 'network_type', 'rede', 'rede_operadora', 'tecnologia']);
  const version = readSpec(representative, ['version', 'versao', 'versão']);
  const subtitle = unique([version, /5g/i.test(`${network} ${name}`) ? '5G' : network]).join(' • ');
  const colors = unique([
    ...group.allColors.map((color) => color.name),
    ...products.map((product) => readSpec(product, ['color', 'cor', 'colour'])),
  ]);
  const memoryVariants = unique(group.variants.map((variant) => (
    [clean(variant.ram).replace('no-ram', ''), clean(variant.storage).replace('no-storage', '')]
      .filter(Boolean)
      .join(' / ')
  )));

  const display = section('display', 'Tela', [
    item('Tipo', readSpec(representative, ['display_type', 'tipo_de_display', 'tipo_de_tela', 'display', 'screen_type'])),
    item('Tamanho', readSpec(representative, ['tamanho_tela', 'screen_size', 'display_size', 'polegadas'])),
    item('Resolução', readSpec(representative, ['resolucao_tela', 'screen_resolution', 'resolution'])),
    item('Atualização', readSpec(representative, ['celular_fps_display', 'taxa_atualizacao_hz', 'refresh_rate', 'taxa_de_atualizacao'])),
    item('Brilho', readSpec(representative, ['brilho_nits', 'brightness_nits', 'brilho_maximo'])),
    item('Proteção', readSpec(representative, ['celular_tipo_de_protecao_de_tela', 'protecao_tela', 'screen_protection'])),
  ]);
  const cameras = section('cameras', 'Câmeras', [
    item('Principal', readSpec(representative, ['cam_principal_mpx', 'camera_principal_mpx', 'camera_traseira_mpx', 'rear_camera', 'camera'])),
    item('Ultrawide', readSpec(representative, ['camera_ultrawide_mpx', 'cam_ultrawide_mpx', 'ultrawide'])),
    item('Frontal', readSpec(representative, ['cam_selfie_mpx', 'camera_selfie_mpx', 'camera_frontal_mpx', 'front_camera'])),
    item('Vídeo traseiro', readSpec(representative, ['camera_traseira_video', 'rear_video'])),
    item('Vídeo frontal', readSpec(representative, ['camera_frontal_video', 'front_video'])),
  ]);
  const performance = section('performance', 'Desempenho', [
    item('Chipset', readSpec(representative, ['chipset', 'processador', 'processor'])),
    item('CPU', readSpec(representative, ['cpu', 'nucleos_cpu'])),
    item('GPU', readSpec(representative, ['gpu'])),
    item('Litografia', readSpec(representative, ['litografia_nm', 'lithography'])),
    item('AnTuTu', readSpec(representative, ['antutu', 'antutu_score'])),
  ]);
  const memory = section('memory', 'Memória', [
    item('Versões', memoryVariants.join(' • ')),
    item('Tipo de RAM', readSpec(representative, ['ram_type', 'tipo_ram'])),
    item('Armazenamento', readSpec(representative, ['storage_type', 'tipo_armazenamento', 'ufs'])),
  ]);
  const battery = section('battery', 'Bateria e carregamento', [
    item('Capacidade', readSpec(representative, ['battery_mah', 'bateria_mah', 'battery', 'bateria'])),
    item('Carregamento', readSpec(representative, ['carregamento_w', 'charging_w', 'carregamento', 'charging'])),
    item('Sem fio', readSpec(representative, ['carregamento_sem_fio', 'wireless_charging'])),
  ]);
  const connectivity = section('connectivity', 'Conectividade', [
    item('Redes', network),
    item('Wi‑Fi', readSpec(representative, ['wifi', 'wi_fi'])),
    item('Bluetooth', readSpec(representative, ['bluetooth'])),
    item('NFC', readSpec(representative, ['nfc'])),
    item('GPS', readSpec(representative, ['gps'])),
    item('USB', readSpec(representative, ['usb', 'conector'])),
    item('SIM', readSpec(representative, ['sim', 'dual_sim', 'celular_slot_para_cartao'])),
  ]);
  const construction = section('construction', 'Construção', [
    item('Proteção', readSpec(representative, ['resistencia', 'protecao_ip', 'ip_rating'])),
    item('Biometria', readSpec(representative, ['celular_biometria', 'biometria'])),
    item('Material', readSpec(representative, ['material', 'material_traseira', 'construction'])),
  ]);
  const dimensions = section('dimensions', 'Dimensões e peso', [
    item('Altura', readSpec(representative, ['dimensions.height_cm', 'altura_cm', 'altura'])),
    item('Largura', readSpec(representative, ['dimensions.width_cm', 'largura_cm', 'largura'])),
    item('Espessura', readSpec(representative, ['dimensions.depth_cm', 'profundidade_cm', 'espessura'])),
    item('Peso', readSpec(representative, ['dimensions.weight_kg', 'peso_g', 'peso_kg', 'weight_kg'])),
  ]);
  const system = section('system', 'Sistema', [
    item('Sistema operacional', readSpec(representative, ['sistema_operacional', 'operating_system', 'os', 'sistema'])),
    item('Conteúdo da caixa', readSpec(representative, ['conteudo_da_caixa', 'conteudo_caixa', 'box_contents'])),
  ]);

  const coreChecks = [
    ['Foto oficial', products.some((product) => Array.isArray(product.images) && product.images.some(Boolean))],
    ['Tela', Boolean(display)],
    ['Resolução da tela', Boolean(readSpec(representative, ['resolucao_tela', 'screen_resolution', 'resolution']))],
    ['Processador', Boolean(performance)],
    ['Câmera principal', Boolean(cameras)],
    ['Bateria', Boolean(battery)],
    ['Memória', memoryVariants.length > 0],
    ['Cores', colors.length > 0],
    ['Dimensões', Boolean(dimensions)],
    ['Conteúdo da caixa', Boolean(readSpec(representative, ['conteudo_da_caixa', 'conteudo_caixa', 'box_contents']))],
  ] as const;

  return {
    modelId: clean(representative?.model_id || group.groupKey),
    brand,
    name,
    subtitle,
    overview: clean(representative?.description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 260),
    colors,
    memoryVariants,
    sections: [display, cameras, performance, memory, battery, connectivity, construction, dimensions, system]
      .filter((entry): entry is ProductBlueprintSection => Boolean(entry)),
    missingFields: coreChecks.filter(([, present]) => !present).map(([label]) => label),
    theme: resolveProductMarketingTheme(representative),
  };
}

export function buildProductBlueprintSourcePayload(data: ProductBlueprintData, imageUrls: string[]) {
  return {
    modelId: data.modelId,
    brand: data.brand,
    name: data.name,
    colors: data.colors,
    memoryVariants: data.memoryVariants,
    sections: data.sections,
    imageUrls,
  };
}
