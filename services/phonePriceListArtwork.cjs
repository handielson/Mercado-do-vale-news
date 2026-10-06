const sharp = require('sharp');

const WIDTH = 1080;
const HEIGHT = 1920;
const BRANDS = ['Xiaomi', 'POCO', 'realme'];
const escapeXml = (value) => String(value ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const brandName = (value) => BRANDS.find((brand) => brand.toLowerCase() === String(value ?? '').trim().toLowerCase()) || String(value ?? '').trim() || 'Celulares';

// Receives already eligible, priced catalog items. No catalog filtering or brand inference.
function paginatePhonePriceList(items, pageSize = 6) {
  if (!Array.isArray(items)) throw new TypeError('items deve ser uma lista');
  if (![6, 14].includes(pageSize)) throw new RangeError('Tamanho de página inválido');
  const groups = new Map();
  for (const item of items) {
    const brand = brandName(item.brand);
    if (!groups.has(brand)) groups.set(brand, []);
    groups.get(brand).push(item);
  }
  const ordered = [...BRANDS.filter((brand) => groups.has(brand)), ...[...groups.keys()].filter((brand) => !BRANDS.includes(brand))];
  return ordered.flatMap((brand) => {
    const group = groups.get(brand);
    const totalPages = Math.ceil(group.length / pageSize);
    return Array.from({ length: totalPages }, (_, index) => ({ brand, items: group.slice(index * pageSize, index * pageSize + pageSize), pageNumber: index + 1, totalPages }));
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

function buildPhoneListSvg({ brand, items, logoBuffer, whatsapp = '', website = '', pageNumber = 1, totalPages = 1, generatedAt = new Date(), priceMode = 'cash' }) {
  if (!['none', 'cash', 'card'].includes(priceMode)) throw new TypeError('Tipo de tabela inválido');
  if (!Array.isArray(items) || !items.length || items.length > 14) throw new RangeError('A tabela deve conter de 1 a 14 aparelhos');
  const date = new Date(generatedAt);
  if (!Number.isFinite(date.getTime())) throw new TypeError('generatedAt inválido');
  for (const item of items) {
    if (priceMode !== 'none' && (!Number.isSafeInteger(item.priceCents) || item.priceCents <= 0)) throw new TypeError('Preço inválido em centavos');
    if (priceMode === 'card' && (!Number.isSafeInteger(item.cardPlan?.total) || item.cardPlan.total <= 0 || !Number.isSafeInteger(item.cardPlan.value) || item.cardPlan.value <= 0 || !Number.isInteger(item.cardPlan.installments) || item.cardPlan.installments < 2 || item.cardPlan.installments > 12)) throw new TypeError('Parcelamento de cartão inválido');
  }
  const title = brandName(brand);
  const accent = title === 'Xiaomi' ? '#ff6900' : '#ffda26';
  const ink = title === 'Xiaomi' ? '#c74c00' : '#725600';
  const label = { none: 'SEM PREÇO', cash: 'À VISTA NO PIX', card: 'NO CARTÃO' }[priceMode];
  const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
  const text = (x, y, value, size, color, weight = 400, anchor = 'start') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#061f40"/><stop offset="1" stop-color="#102d4c"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#bg)"/><g font-family="Arial, sans-serif">`];
  if (Buffer.isBuffer(logoBuffer)) parts.push(`<rect x="54" y="48" width="184" height="138" rx="20" fill="#fff"/><image href="data:image/png;base64,${logoBuffer.toString('base64')}" x="68" y="61" width="156" height="112"/>`);
  parts.push(text(1026, 103, 'MERCADO DO VALE', 27, '#ffffff', 700, 'end'), text(1026, 145, 'SMARTPHONES DISPONÍVEIS', 21, '#b9ccdf', 400, 'end'));
  parts.push(text(54, 287, title === 'realme' ? title : title.toUpperCase(), 91, accent, 800), text(57, 340, priceMode === 'none' ? 'Lista de smartphones' : 'Lista de preços', 43, '#ffffff', 700));
  parts.push(`<rect x="720" y="252" width="306" height="82" rx="16" fill="${accent}"/>`, text(873, 304, label, 27, title === 'Xiaomi' ? '#ffffff' : '#0b2541', 700, 'middle'));
  parts.push(text(58, 402, 'MODELO / MEMÓRIA', 22, '#c4d5e6', 700));
  if (priceMode !== 'none') parts.push(text(997, 402, priceMode === 'card' ? 'PARCELAS / TOTAL' : 'PREÇO À VISTA', 22, '#c4d5e6', 700, 'end'));
  const rowHeight = Math.min(110, Math.floor(1316 / items.length));
  items.forEach((item, index) => {
    const y = 424 + index * rowHeight;
    parts.push(`<rect x="54" y="${y}" width="972" height="${rowHeight - 6}" rx="12" fill="${index % 2 ? '#edf3f8' : '#ffffff'}"/>`);
    const name = String(item.name).replace(/pró/ig, 'Pro').replace(/15c\b/ig, '15C');
    parts.push(text(80, y + 35, lines(name, priceMode === 'none' ? 55 : 35, 1)[0], 31, '#0b2541', 700), text(81, y + 66, String(item.memory || '').replace(/(\d+)GB/g, '$1 GB'), 22, '#50667d'));
    if (priceMode === 'cash') parts.push(text(997, y + 51, money(item.priceCents), 37, ink, 700, 'end'));
    if (priceMode === 'card') parts.push(text(997, y + 35, `${item.cardPlan.installments}x ${money(item.cardPlan.value)}`, 32, ink, 700, 'end'), text(997, y + 66, `Total: ${money(item.cardPlan.total)}`, 22, '#50667d', 400, 'end'));
  });
  const footer = `${priceMode === 'none' ? 'Lista' : 'Preços'} de ${date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} • Consulte condições e disponibilidade${totalPages > 1 ? ` • ${pageNumber}/${totalPages}` : ''}`;
  parts.push(`<rect x="54" y="1788" width="972" height="3" fill="${accent}"/>`, text(54, 1840, whatsapp, 32, '#ffffff', 700), text(1026, 1840, website.replace(/^www\./, ''), 27, '#ffffff', 400, 'end'), text(540, 1891, footer, totalPages > 1 ? 20 : 22, '#b9ccdf', 400, 'middle'), '</g></svg>');
  return parts.join('');
}

async function renderPhoneListTable(options) {
  return sharp(Buffer.from(buildPhoneListSvg(options))).png().toBuffer();
}

module.exports = { renderPhonePriceListPage, paginatePhonePriceList, buildPhoneListSvg, renderPhoneListTable };
