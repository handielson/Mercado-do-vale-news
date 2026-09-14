import type { CatalogProduct } from '../../../../types/catalog';

export interface ProductCommercialCopy {
  title: string;
  subtitle: string;
  badge: string;
  benefits: string[];
  cta: string;
  technicalName: string;
}

export interface ProductCommercialValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const COMMERCIAL_COPY_LIMITS = {
  title: 35,
  subtitle: 65,
  badge: 22,
  benefit: 30,
  cta: 30,
} as const;

export const formatProductMarketingPrice = (cents: number): string => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(cents / 100);

const cleanText = (value: unknown): string => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalized = (value: unknown): string => cleanText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

export function limitCommercialText(value: string, maxLength: number): string {
  const clean = cleanText(value);
  if (clean.length <= maxLength) return clean;
  const clipped = clean.slice(0, maxLength + 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return (lastSpace > 0 ? clipped.slice(0, lastSpace) : clean.slice(0, maxLength)).trim();
}

function uniqueBenefits(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalized(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3).map((value) => limitCommercialText(value, COMMERCIAL_COPY_LIMITS.benefit));
}

export function buildProductCommercialEvidenceText(product: CatalogProduct, categoryName = ''): string {
  return cleanText([
    product.name,
    product.model,
    product.brand,
    product.description,
    categoryName,
    ...Object.entries(product.specs || {}).flatMap(([key, value]) => [key, value]),
  ].join(' '));
}

export function buildProductCommercialCopy(product: CatalogProduct, categoryName = ''): ProductCommercialCopy {
  const source = normalized(buildProductCommercialEvidenceText(product, categoryName));
  let title = 'A ESCOLHA PARA SEU PROJETO';
  let subtitle = 'Encontre a solução certa para sua necessidade';
  let badge = limitCommercialText(categoryName || product.brand || 'DESTAQUE', COMMERCIAL_COPY_LIMITS.badge).toUpperCase();
  let cta = 'PEÇA AGORA NO WHATSAPP';
  const benefits: string[] = [];

  if (/balanca.*cozinha|cozinha.*balanca/.test(source)) {
    title = 'PRATICIDADE EM CADA RECEITA';
    subtitle = 'Facilite o preparo dos seus ingredientes';
    badge = 'PARA SUA COZINHA';
    if (/10\s*kg/.test(source)) benefits.push('Capacidade de 10 kg');
    if (/digital/.test(source)) benefits.push('Leitura digital');
    if (/tara/.test(source)) benefits.push('Função tara');
  } else if (/guia organizador|organizador de cabo/.test(source)) {
    title = 'ADEUS, CABOS BAGUNÇADOS';
    subtitle = /rack/.test(source) ? 'Organização profissional para seu rack' : 'Organize e direcione seus cabos';
    benefits.push('Visual mais limpo', 'Cabos bem direcionados', 'Instalação profissional');
  } else if (/patch panel/.test(source)) {
    title = 'SUA REDE BEM ORGANIZADA';
    subtitle = /rack/.test(source) ? 'Centralize as conexões do seu rack' : 'Conexões centralizadas e identificadas';
  } else if (/keystone|tomada de rede|conector rj45/.test(source)) {
    title = 'CONEXÃO SEM BAGUNÇA';
    subtitle = 'Acabamento profissional para sua rede';
  } else if (/carregador|power bank|bateria portatil/.test(source)) {
    title = 'ENERGIA QUANDO PRECISAR';
    subtitle = 'Mantenha seus dispositivos prontos para uso';
  } else if (/cabo|rede|rj45/.test(source)) {
    title = 'CONECTE COM ORGANIZAÇÃO';
    subtitle = 'Uma solução prática para sua instalação';
  }

  const rackSize = source.match(/rack\s*(?:de\s*)?(\d+)\s*(?:"|polegadas)/)?.[1]
    || source.match(/(\d+)\s*(?:"|polegadas)\s*(?:horizontal|vertical|rack)/)?.[1];
  const category = source.match(/\bcat\s*([5-8](?:e|a)?)\b/)?.[1];
  const ports = source.match(/\b(\d+)\s*portas?\b/)?.[1];

  if (rackSize) {
    badge = `PARA RACK ${rackSize}″`;
    benefits.push('Encaixe no rack informado');
  }
  if (category) benefits.push(`Padrão CAT${category.toUpperCase()}`);
  if (ports) benefits.push(`${ports} portas identificadas`);
  if (/t568a\/?b|t568a.*t568b/.test(source)) benefits.push('Padrões T568A e T568B');
  if (/horizontal/.test(source)) benefits.push('Organização horizontal');
  if (/vertical/.test(source)) benefits.push('Organização vertical');
  if (/rj45/.test(source)) benefits.push('Conexão RJ45');
  if (/gigalan/.test(source)) benefits.push('Linha GigaLan');
  if (/branco/.test(source)) benefits.push('Acabamento branco');

  if (!rackSize && category) badge = `PADRÃO CAT${category.toUpperCase()}`;
  else if (!rackSize && ports) badge = `${ports} PORTAS`;

  return {
    title: limitCommercialText(title, COMMERCIAL_COPY_LIMITS.title).toUpperCase(),
    subtitle: limitCommercialText(subtitle, COMMERCIAL_COPY_LIMITS.subtitle),
    badge: limitCommercialText(badge, COMMERCIAL_COPY_LIMITS.badge).toUpperCase(),
    benefits: uniqueBenefits(benefits),
    cta: limitCommercialText(cta, COMMERCIAL_COPY_LIMITS.cta).toUpperCase(),
    technicalName: cleanText(product.name || product.model),
  };
}

export function validateProductCommercialArtwork(input: {
  copy: ProductCommercialCopy;
  imageUrl?: string | null;
  logoUrl?: string | null;
  showPrice: boolean;
  price?: number | null;
  supportedBenefits?: string[];
  evidenceText?: string;
}): ProductCommercialValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const imageUrl = cleanText(input.imageUrl);
  const logoUrl = cleanText(input.logoUrl);
  if (!imageUrl) errors.push('Cadastre uma imagem oficial para este produto.');
  else if (!/^(https?:\/\/|data:image\/|blob:|\/)/i.test(imageUrl)) errors.push('A imagem do produto possui um endereço inválido.');
  if (!logoUrl) errors.push('Configure a logomarca oficial da loja.');
  if (!cleanText(input.copy.title)) errors.push('Informe o título comercial.');
  if (!cleanText(input.copy.subtitle)) errors.push('Informe o subtítulo comercial.');
  if (!cleanText(input.copy.badge)) errors.push('Informe o selo de aplicação ou categoria.');
  if (!cleanText(input.copy.cta)) errors.push('Informe a chamada para ação.');
  if (!cleanText(input.copy.technicalName)) errors.push('O produto precisa ter nome técnico.');
  if (input.copy.title.length > COMMERCIAL_COPY_LIMITS.title) errors.push(`O título deve ter até ${COMMERCIAL_COPY_LIMITS.title} caracteres.`);
  if (input.copy.subtitle.length > COMMERCIAL_COPY_LIMITS.subtitle) errors.push(`O subtítulo deve ter até ${COMMERCIAL_COPY_LIMITS.subtitle} caracteres.`);
  if (input.copy.badge.length > COMMERCIAL_COPY_LIMITS.badge) errors.push(`O selo deve ter até ${COMMERCIAL_COPY_LIMITS.badge} caracteres.`);
  if (input.copy.cta.length > COMMERCIAL_COPY_LIMITS.cta) errors.push(`O CTA deve ter até ${COMMERCIAL_COPY_LIMITS.cta} caracteres.`);
  if (input.copy.benefits.some((benefit) => benefit.length > COMMERCIAL_COPY_LIMITS.benefit)) errors.push(`Cada benefício deve ter até ${COMMERCIAL_COPY_LIMITS.benefit} caracteres.`);
  if (input.copy.benefits.length > 3) errors.push('Use no máximo três benefícios na arte.');
  if (input.supportedBenefits) {
    const supported = new Set(input.supportedBenefits.map(normalized));
    const editedBenefits = input.copy.benefits.filter((benefit) => !supported.has(normalized(benefit)));
    if (editedBenefits.length > 0) {
      const evidence = normalized(input.evidenceText);
      const restrictedClaims = [
        { claim: /garantia/, evidence: /garantia/ },
        { claim: /desconto|economize|off\b/, evidence: /desconto|preco anterior|promo/ },
        { claim: /frete|entrega/, evidence: /frete|entrega/ },
        { claim: /certific/, evidence: /certific/ },
        { claim: /compativ/, evidence: /compativ/ },
      ];
      const hasUnsupportedRestrictedClaim = editedBenefits.some((benefit) => {
        const candidate = normalized(benefit);
        return restrictedClaims.some((rule) => rule.claim.test(candidate) && !rule.evidence.test(evidence));
      });
      if (hasUnsupportedRestrictedClaim) {
        errors.push('O benefício editado contém uma alegação sem apoio nos dados oficiais do produto.');
      } else {
        warnings.push('Revise os benefícios editados manualmente antes de baixar a arte.');
      }
    }
  }
  if (input.showPrice && Number(input.price || 0) <= 0) warnings.push('Preço inválido: a arte será reorganizada sem preço.');
  if (input.copy.benefits.length < 3) warnings.push('O cadastro possui menos de três benefícios comprováveis.');
  return { valid: errors.length === 0, errors, warnings };
}
