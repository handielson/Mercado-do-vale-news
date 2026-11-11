// promo-media-prompt-v1: texto pronto para colar numa IA de imagem e gerar a mídia da promoção da versão.
// Montado sempre a partir da promoção atual (preço, desconto, datas, cores, versão): mudou a promoção, muda o prompt.
// Os tamanhos são os mesmos dos campos "Mídia da promoção" (fonte única: PROMO_MEDIA_SPECS).

export const PROMO_MEDIA_SPECS = {
  image: { width: 1080, height: 1350, ratio: '4:5', formats: 'PNG, JPG ou WEBP', maxMb: 15, use: 'WhatsApp, Status, Instagram e bot' },
  video: { width: 1080, height: 1920, ratio: '9:16, vertical', formats: 'MP4', maxSeconds: 60, maxMb: 500, use: 'Status, Instagram e bot' },
  banner: { width: 1920, height: 823, ratio: '21:9', formats: 'PNG, JPG ou WEBP', maxMb: 15, use: 'Carrossel da página inicial do site' },
};

export const promoMediaSizeLabel = (key) => {
  const spec = PROMO_MEDIA_SPECS[key];
  const extra = key === 'video' ? ` · até ${spec.maxSeconds} s` : '';
  return `${spec.width} × ${spec.height} px (${spec.ratio}) · ${spec.formats}${extra} · até ${spec.maxMb} MB`;
};

const money = (cents) => (Math.round(Number(cents) || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
const when = (iso, timeZone) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('day')}/${get('month')} às ${get('hour')}:${get('minute')}`;
};

/** "4GB · 128GB · global · 4g lte (...)" → "4GB/128GB" (o resto da versão não vai na arte). */
export function promoMemoryLabel(versionLabel) {
  const sizes = String(versionLabel || '').match(/\d+\s*(?:GB|TB)/gi) || [];
  return sizes.slice(0, 2).map((size) => size.replace(/\s+/g, '').toUpperCase()).join('/');
}

/**
 * @param {{ modelName: string, versionLabel?: string, colors?: string[], retailCents: number, promo: { priceCents: number, discountPct?: number, start?: string|null, end?: string|null } | null, storeName?: string, siteUrl?: string, timeZone?: string }} input
 * @returns {string} prompt em português, ou '' quando não há promoção válida.
 */
export function buildPromoMediaPrompt({ modelName, versionLabel = '', colors = [], retailCents, promo, storeName = 'Mercado do Vale', siteUrl = 'mercadodovale.com.br', timeZone = 'America/Recife' }) {
  if (!promo || !(Number(promo.priceCents) > 0)) return '';
  const memory = promoMemoryLabel(versionLabel);
  const product = [String(modelName || '').trim(), memory].filter(Boolean).join(' ');
  const hasOldPrice = Number(retailCents) > Number(promo.priceCents);
  const discount = Number(promo.discountPct) > 0 ? `${promo.discountPct}% OFF` : '';
  const start = when(promo.start, timeZone);
  const end = when(promo.end, timeZone);
  const validity = start && end ? `Válida de ${start} até ${end}` : end ? `Válida até ${end}` : start ? `A partir de ${start}` : 'Por tempo limitado';
  const colorList = colors.filter(Boolean);
  const { image, video, banner } = PROMO_MEDIA_SPECS;

  const texts = [
    `- Título: "OFERTA RELÂMPAGO"${end ? '' : ' (ou "PROMOÇÃO")'}`,
    `- Produto: "${product}"`,
    hasOldPrice ? `- Preço antigo (riscado, menor): "De ${money(retailCents)}"` : '',
    `- Preço da promoção (maior destaque da arte): "Por ${money(promo.priceCents)}"`,
    '- Junto do preço: "à vista no Pix"',
    discount ? `- Selo de desconto: "${discount}"` : '',
    `- Validade: "${validity}"`,
    `- Loja: "${storeName}" · "${siteUrl}"`,
  ].filter(Boolean);

  return [
    `Crie as artes de uma promoção de celular para a loja ${storeName}, usando a FOTO DO PRODUTO que estou enviando junto.`,
    '',
    'DADOS DA PROMOÇÃO (use exatamente estes valores, sem arredondar nem inventar):',
    `- Produto: ${modelName}${versionLabel ? ` — versão ${versionLabel}` : ''}`,
    colorList.length ? `- Cores disponíveis: ${colorList.join(', ')}` : '',
    hasOldPrice ? `- De ${money(retailCents)} por ${money(promo.priceCents)}${discount ? ` (${discount})` : ''}` : `- Preço: ${money(promo.priceCents)}`,
    `- ${validity} (horário de Pernambuco/Bahia)`,
    '',
    'TEXTOS DA ARTE (português do Brasil, escrever exatamente assim):',
    ...texts,
    '',
    'REGRAS:',
    '- O celular da foto é o produto real: não mude o modelo, o formato, as câmeras, a cor nem o logotipo. Pode recortar, iluminar e posicionar.',
    '- Não escreva nenhuma informação que não esteja acima (sem parcelas, sem brindes, sem especificações técnicas inventadas).',
    '- Preço grande e legível no celular; contraste alto; fundo moderno com tons de vermelho e branco.',
    '- Deixe margem de segurança de 60 px nas bordas sem texto importante.',
    '',
    'ENTREGUE 3 ARQUIVOS, cada um no tamanho exato:',
    `1) IMAGEM DA PROMOÇÃO — ${image.width} × ${image.height} px (${image.ratio}), ${image.formats}, até ${image.maxMb} MB. Uso: ${image.use}. Produto grande no centro, preço logo abaixo.`,
    `2) BANNER DO SITE — ${banner.width} × ${banner.height} px (${banner.ratio}), ${banner.formats}, até ${banner.maxMb} MB. Uso: ${banner.use}. Layout horizontal: celular de um lado, textos e preço do outro, com bastante respiro nas bordas.`,
    `3) CAPA/QUADRO PARA VÍDEO VERTICAL — ${video.width} × ${video.height} px (${video.ratio}). Uso: ${video.use}. Mesmo conteúdo da imagem, com o texto entre 15% e 75% da altura (o topo e o rodapé ficam cobertos pelo Status/Instagram). Se você também gerar vídeo: ${video.formats}, até ${video.maxSeconds} s, até ${video.maxMb} MB, mostrando o celular girando e o preço aparecendo no final.`,
  ].filter((line, index, lines) => line !== '' || (lines[index - 1] !== '' && index > 0)).join('\n');
}
