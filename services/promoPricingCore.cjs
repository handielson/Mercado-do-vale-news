'use strict';

// Regra única de promoção por tempo determinado (centavos).
// Uma promoção está ativa quando price_promo > 0, é menor que price_retail e o
// momento atual está entre promo_start (se houver) e promo_end (se houver).

const HEADLINE_MAX = 120;
const FOOTER_MAX = 300;
// Legenda de mídia no WhatsApp: acima disso a mensagem precisa ir em texto separado.
const WHATSAPP_MEDIA_CAPTION_LIMIT = 1024;

function cents(value) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function time(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function isPromoActive(product, now = Date.now()) {
  const promo = cents(product?.price_promo);
  const retail = cents(product?.price_retail);
  if (!promo || !retail || promo >= retail) return false;
  const current = time(now);
  const start = time(product?.promo_start);
  const end = time(product?.promo_end);
  if (start !== null && start > current) return false;
  if (end !== null && end < current) return false;
  return true;
}

function activePromoPriceCents(product, now = Date.now()) {
  return isPromoActive(product, now) ? cents(product.price_promo) : null;
}

function effectivePriceCents(product, now = Date.now()) {
  return activePromoPriceCents(product, now) ?? cents(product?.price_retail);
}

// Campos prontos para consumidores externos (bot n8n, integrações): não repetem a regra de data.
function promoPriceFields(product, now = Date.now()) {
  const active = isPromoActive(product, now);
  return { price_effective: active ? cents(product.price_promo) : (cents(product?.price_retail) || null), promo_active: active };
}

// Datas gravadas como UTC (o admin envia ISO em UTC); compara com UTC_TIMESTAMP().
function activePromoPriceSql(alias = '') {
  const col = (name) => (alias ? `${alias}.${name}` : name);
  return `(CASE WHEN ${col('price_promo')} > 0 AND ${col('price_promo')} < ${col('price_retail')}
    AND (${col('promo_start')} IS NULL OR ${col('promo_start')} <= UTC_TIMESTAMP())
    AND (${col('promo_end')} IS NULL OR ${col('promo_end')} >= UTC_TIMESTAMP())
    THEN ${col('price_promo')} ELSE NULL END)`;
}

function effectivePriceSql(alias = '') {
  const col = alias ? `${alias}.price_retail` : 'price_retail';
  return `COALESCE(${activePromoPriceSql(alias)}, ${col})`;
}

function failure(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function cleanText(value, max, field) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw failure(`${field} inválido.`);
  const text = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (text.length > max) throw failure(`${field} pode ter no máximo ${max} caracteres.`);
  return text;
}

function normalizePromoCampaign(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw failure('Campanha inválida.');
  const headline = cleanText(input.headline, HEADLINE_MAX, 'Título da primeira linha');
  if (!headline) throw failure('Escreva o título da primeira linha da campanha.');
  const footer = cleanText(input.footer, FOOTER_MAX, 'Rodapé');
  let mediaUrl = null;
  let mediaType = null;
  if (input.media_url) {
    if (typeof input.media_url !== 'string' || input.media_url.length > 1200 || !/^https:\/\//i.test(input.media_url)) {
      throw failure('A mídia da campanha precisa ser um endereço HTTPS.');
    }
    mediaUrl = input.media_url.trim();
    mediaType = input.media_type === 'video' ? 'video' : 'image';
  }
  return { headline, footer, media_url: mediaUrl, media_type: mediaType };
}

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);

function shortDate(value) {
  const parsed = time(value);
  if (parsed === null) return null;
  return new Date(parsed).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
}

// Itens: { name, retailCents, promoCents, promoEnd }
function buildPromoWhatsAppText({ headline, footer = '', items = [] }) {
  const blocks = [String(headline || '').trim()];
  for (const item of items) {
    const until = shortDate(item.promoEnd);
    // WhatsApp: ~riscado~ e *negrito*; o nome fica em linha própria para leitura no celular.
    blocks.push(`▪️ ${String(item.name || '').trim()}\nde ~${money(item.retailCents)}~ por *${money(item.promoCents)}*${until ? `\n_válido até ${until}_` : ''}`);
  }
  if (String(footer || '').trim()) blocks.push(String(footer).trim());
  const text = blocks.filter(Boolean).join('\n\n');
  return { text, length: text.length, fitsMediaCaption: text.length <= WHATSAPP_MEDIA_CAPTION_LIMIT };
}

module.exports = {
  HEADLINE_MAX,
  FOOTER_MAX,
  WHATSAPP_MEDIA_CAPTION_LIMIT,
  isPromoActive,
  activePromoPriceCents,
  effectivePriceCents,
  promoPriceFields,
  activePromoPriceSql,
  effectivePriceSql,
  normalizePromoCampaign,
  buildPromoWhatsAppText,
  formatBRL: money,
  shortPromoDate: shortDate,
};
