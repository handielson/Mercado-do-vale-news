'use strict';

const sharp = require('sharp');

const WIDTH = 1080;
const HEIGHT = 1920;
const PAGE_SIZE = 6;
const CARD_HEIGHT = 500;
const IMAGE_HEIGHT = 300;
const cardX = (index) => 20 + (index % 2) * 530;
const cardY = (index) => 160 + Math.floor(index / 2) * (CARD_HEIGHT + 12);
// A VPS não garante fonte de emoji: na arte o emoji viraria um quadrado. O texto do WhatsApp mantém os emojis.
const stripEmoji = (value) => String(value ?? '').replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ').trim();
const escapeXml = (value) => String(value ?? '')
  .replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]))
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);

function lines(value, maxLength, maxLines) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  const result = [''];
  for (const word of words) {
    const last = result.length - 1;
    if (result[last] && `${result[last]} ${word}`.length > maxLength) result.push(word);
    else result[last] += `${result[last] ? ' ' : ''}${word}`;
  }
  return result.slice(0, maxLines).map((line, i) => (line.length > maxLength || (i === maxLines - 1 && result.length > maxLines))
    ? `${line.slice(0, maxLength - 1)}…` : line);
}

function paginatePromoItems(items) {
  if (!Array.isArray(items)) throw new TypeError('items deve ser uma lista');
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  return Array.from({ length: totalPages }, (_, index) => ({
    items: items.slice(index * PAGE_SIZE, index * PAGE_SIZE + PAGE_SIZE), pageNumber: index + 1, totalPages,
  }));
}

function validateItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > PAGE_SIZE) throw new RangeError('A página deve conter de 1 a 6 produtos');
  for (const item of items) {
    if (!Number.isSafeInteger(item.promoCents) || item.promoCents <= 0
      || !Number.isSafeInteger(item.retailCents) || item.retailCents <= item.promoCents) {
      throw new TypeError('Cada produto precisa de preço de varejo maior que o promocional, em centavos');
    }
  }
}

// SVG sem fotos/logo (compostos depois pelo sharp). Exportado para teste.
function buildPromoPageSvg({ headline, footer = '', items, whatsapp = '', website = '', pageNumber = 1, totalPages = 1, hasLogo = false }) {
  validateItems(items);
  const text = (x, y, value, size, fill, weight = 700, anchor = 'middle', extra = '') =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${extra}>${escapeXml(value)}</text>`;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><defs><linearGradient id="bg" x2="0" y2="1"><stop stop-color="#7a0b12"/><stop offset="1" stop-color="#2a0306"/></linearGradient></defs><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/><g font-family="Arial, sans-serif">`];
  if (!hasLogo) parts.push(text(111, 63, 'Mercado', 25, '#ffffff', 800), text(111, 95, 'do Vale', 25, '#ffffff', 800));
  const headlineLines = lines(stripEmoji(headline) || 'PROMOÇÃO', 22, 2);
  const headlineSize = headlineLines.length > 1 ? 54 : 62;
  headlineLines.forEach((line, i) => parts.push(text(640, 78 + i * 58 + (headlineLines.length > 1 ? 0 : 20), line, headlineSize, '#ffd400', 900)));

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const x = cardX(index);
    const y = cardY(index);
    const cx = x + 255;
    parts.push(`<rect x="${x}" y="${y}" width="510" height="${CARD_HEIGHT}" rx="20" fill="#ffffff"/>`);
    if (!item.hasImage) parts.push(`<rect x="${cx - 60}" y="${y + 40}" width="120" height="190" rx="20" fill="#eef2f6" stroke="#c7d1dd" stroke-width="3"/>`, text(cx, y + 268, 'Foto indisponível', 23, '#65748a', 600));
    const nameLines = lines(item.name, 26, 2);
    const nameTop = y + IMAGE_HEIGHT + 34;
    nameLines.forEach((line, i) => parts.push(text(cx, nameTop + i * 31, line, 30, '#101928', 800)));
    const priceTop = nameTop + (nameLines.length - 1) * 31 + 20;
    const oldPrice = `de ${money(item.retailCents)}`;
    const oldWidth = Math.round(oldPrice.length * 13.5);
    parts.push(text(cx, priceTop + 18, oldPrice, 26, '#7a8699', 600), `<line x1="${cx - oldWidth / 2}" y1="${priceTop + 9}" x2="${cx + oldWidth / 2}" y2="${priceTop + 9}" stroke="#7a8699" stroke-width="3"/>`);
    const newPrice = money(item.promoCents);
    parts.push(text(cx, priceTop + 70, `por ${newPrice}`, newPrice.length > 12 ? 40 : 48, '#e3001b', 900));
    if (item.untilLabel) parts.push(text(cx, priceTop + 98, `válido até ${item.untilLabel}`, 21, '#4b5868', 600));
  }
  const footerLine = lines(stripEmoji(footer), 60, 1)[0];
  if (footerLine) parts.push(text(540, 1758, footerLine, 32, '#ffd400', 800));
  parts.push(text(288, 1840, whatsapp, 30, '#ffffff', 700), text(819, 1840, String(website).replace(/^www\./, ''), 28, '#ffffff', 600),
    text(540, 1884, `Ofertas por tempo limitado • enquanto durar o estoque${totalPages > 1 ? ` • ${pageNumber}/${totalPages}` : ''}`, 21, '#f3c9cc', 400));
  parts.push('</g></svg>');
  return parts.join('');
}

async function renderPromoCampaignPage(options) {
  const { items, logoBuffer } = options;
  validateItems(items);
  const composites = [];
  if (Buffer.isBuffer(logoBuffer)) {
    composites.push({ input: await sharp(logoBuffer).rotate().resize(150, 120, { fit: 'inside', withoutEnlargement: true }).png().toBuffer(), left: 34, top: 22 });
  }
  const svgItems = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const x = cardX(index);
    const y = cardY(index);
    let hasImage = false;
    if (Buffer.isBuffer(item.imageBuffer)) {
      try {
        const cropped = await sharp(item.imageBuffer).rotate().trim({ threshold: 15 }).toBuffer();
        composites.push({ input: await sharp(cropped).resize(486, IMAGE_HEIGHT - 12, { fit: 'contain', background: '#ffffff' }).png().toBuffer(), left: x + 12, top: y + 8 });
        hasImage = true;
      } catch { hasImage = false; }
    }
    svgItems.push({ ...item, hasImage });
  }
  const svg = buildPromoPageSvg({ ...options, items: svgItems, hasLogo: Buffer.isBuffer(logoBuffer) });
  // O selo de desconto fica por cima da foto (sempre visível).
  const base = await sharp(Buffer.from(svg)).composite(composites).png().toBuffer();
  const badges = svgItems.map((item, index) => {
    const off = Math.round((1 - item.promoCents / item.retailCents) * 100);
    if (off < 1) return null;
    const x = cardX(index);
    const y = cardY(index);
    return { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="132" height="54"><rect width="132" height="54" rx="27" fill="#e3001b"/><text x="66" y="37" font-family="Arial, sans-serif" font-size="30" font-weight="900" fill="#ffffff" text-anchor="middle">-${off}%</text></svg>`), left: x + 16, top: y + 16 };
  }).filter(Boolean);
  return badges.length ? sharp(base).composite(badges).png().toBuffer() : base;
}

module.exports = { PAGE_SIZE, paginatePromoItems, buildPromoPageSvg, renderPromoCampaignPage };
