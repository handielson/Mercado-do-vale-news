const sharp = require('sharp');

const WIDTH = 1080;
const HEIGHT = 1920;
const BRANDS = ['Xiaomi', 'POCO', 'realme'];
const escapeXml = (value) => String(value ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const brandName = (value) => BRANDS.find((brand) => brand.toLowerCase() === String(value ?? '').trim().toLowerCase()) || String(value ?? '').trim() || 'Celulares';

// Receives already eligible, priced catalog items. No catalog filtering or brand inference.
function paginatePhonePriceList(items) {
  if (!Array.isArray(items)) throw new TypeError('items deve ser uma lista');
  const groups = new Map();
  for (const item of items) {
    const brand = brandName(item.brand);
    if (!groups.has(brand)) groups.set(brand, []);
    groups.get(brand).push(item);
  }
  const ordered = [...BRANDS.filter((brand) => groups.has(brand)), ...[...groups.keys()].filter((brand) => !BRANDS.includes(brand))];
  return ordered.flatMap((brand) => {
    const group = groups.get(brand);
    const totalPages = Math.ceil(group.length / 6);
    return Array.from({ length: totalPages }, (_, index) => ({ brand, items: group.slice(index * 6, index * 6 + 6), pageNumber: index + 1, totalPages }));
  });
}

function lines(value, maxLength = 25, maxLines = 2) {
  const words = String(value ?? '').trim().split(/\s+/);
  const result = [''];
  for (const word of words) {
    const last = result.length - 1;
    if (result[last] && `${result[last]} ${word}`.length > maxLength) result.push(word);
    else result[last] += `${result[last] ? ' ' : ''}${word}`;
  }
  return result.slice(0, maxLines).map((line, i) => line.length > maxLength || (i === maxLines - 1 && result.length > maxLines) ? `${line.slice(0, maxLength - 1)}…` : line);
}

async function renderPhonePriceListPage({ brand, items, logoBuffer, whatsapp = '', website = '', pageNumber = 1, totalPages = 1, generatedAt = new Date(), priceLabel = 'à vista' }) {
  if (!Array.isArray(items) || !items.length || items.length > 6) throw new RangeError('A página deve conter de 1 a 6 aparelhos');
  for (const item of items) if (!Number.isSafeInteger(item.priceCents) || item.priceCents <= 0) throw new TypeError('priceCents deve ser um inteiro positivo em centavos');
  const date = new Date(generatedAt);
  if (!Number.isFinite(date.getTime())) throw new TypeError('generatedAt inválido');
  const title = brandName(brand);
  const accent = title === 'Xiaomi' ? '#ff5100' : '#d09b00';
  const text = (x, y, value, size, fill = '#0b1424', weight = 600) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle">${escapeXml(value)}</text>`;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><rect width="1080" height="1920" fill="#061f40"/><g font-family="Arial, sans-serif">`];
  parts.push(text(620, 91, title === 'Xiaomi' ? 'XIAOMI' : title, 72, title === 'Xiaomi' ? '#ff6900' : '#ffda26', title === 'realme' ? 500 : 800), text(620, 132, 'Tabela de preços', 28, '#ffffff'));
  const composites = [];
  if (Buffer.isBuffer(logoBuffer)) composites.push({ input: await sharp(logoBuffer).rotate().resize(150, 120, { fit: 'inside', withoutEnlargement: true }).png().toBuffer(), left: 34, top: 22 });
  else parts.push(text(111, 63, 'Mercado', 25, '#ffffff', 800), text(111, 95, 'do Vale', 25, '#ffffff', 800));
  // Keep the approved six-card proportions even on the final partial page.
  const cardHeight = 532;
  const imageHeight = 376;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const x = 20 + (index % 2) * 530;
    const y = 160 + Math.floor(index / 2) * (cardHeight + 12);
    const cx = x + 255;
    parts.push(`<rect x="${x}" y="${y}" width="510" height="${cardHeight}" rx="20" fill="#ffffff"/>`);
    if (Buffer.isBuffer(item.imageBuffer)) {
      // Catalog photos often have large white margins; trim those before fitting,
      // otherwise the phone remains tiny even when the image box is large.
      const cropped = await sharp(item.imageBuffer).rotate().trim({ threshold: 15 }).toBuffer();
      composites.push({ input: await sharp(cropped).resize(486, imageHeight, { fit: 'contain', background: '#ffffff' }).png().toBuffer(), left: x + 12, top: y + 8 });
    } else {
      parts.push(`<rect x="${cx - 65}" y="${y + 58}" width="130" height="220" rx="20" fill="#eef2f6" stroke="#c7d1dd" stroke-width="3"/>`, text(cx, y + 314, 'Foto indisponível', 23, '#65748a'));
    }
    const nameLines = lines(item.name, 25, 2);
    nameLines.forEach((line, i) => parts.push(text(cx, y + 412 + i * 29, line, 34, '#101928', 800)));
    const memoryY = nameLines.length > 1 ? 465 : 442;
    parts.push(text(cx, y + memoryY, lines(item.memory, 36, 1)[0], 25));
    const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.priceCents / 100);
    parts.push(text(cx, y + (nameLines.length > 1 ? 499 : 489), price, price.length > 13 ? 38 : 48, accent, 800), text(cx, y + 520, priceLabel, 23));
  }
  parts.push(`<circle cx="55" cy="1825" r="22" fill="#35b954" stroke="white" stroke-width="3"/><path d="M44 1812 Q40 1828 57 1838 L64 1830 L57 1825 L53 1830 Q46 1826 48 1820 Z" fill="white"/><path d="M38 1845 L40 1834 L48 1840 Z" fill="white"/><path d="M515 1805 V1846" stroke="#d09b00" stroke-width="2"/><circle cx="561" cy="1825" r="20" fill="none" stroke="#d09b00" stroke-width="3"/><ellipse cx="561" cy="1825" rx="9" ry="20" fill="none" stroke="#d09b00" stroke-width="2"/><path d="M541 1825 H581 M545 1815 H577 M545 1835 H577" stroke="#d09b00" stroke-width="2"/>`);
  parts.push(text(288, 1837, whatsapp, 30, '#ffffff'), text(819, 1837, website.replace(/^www\./, ''), 28, '#ffffff'), text(540, 1880, `Consulte condições e disponibilidade • ${date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} • ${pageNumber}/${totalPages}`, 21, '#ffffff'), '</g></svg>');
  return sharp(Buffer.from(parts.join(''))).composite(composites).png().toBuffer();
}

module.exports = { renderPhonePriceListPage, paginatePhonePriceList };
