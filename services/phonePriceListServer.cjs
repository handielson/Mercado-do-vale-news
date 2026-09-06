const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { normalizeProductSpecsRam } = require('./physicalRamCore.cjs');
const { renderPhonePriceListPage, paginatePhonePriceList } = require('./phonePriceListArtwork.cjs');

const DEFAULT_BRANDS = ['Xiaomi', 'POCO', 'realme'];
const IMAGE_HOSTS = new Set(['api.xiaomipetrolina.com.br', 'imagens.xiaomipetrolina.com.br', 'mercadodovale.com.br', 'www.mercadodovale.com.br']);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const parse = (value, fallback = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function failure(message, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }
function displayWhatsapp(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return String(value || '');
}

function resolveBrand(product) {
  const identity = normalize([product.brand_name, product.brand, product.name].join(' '));
  if (/\bpoco\b/.test(identity)) return 'POCO';
  if (/\b(?:xiaomi|redmi)\b/.test(identity)) return 'Xiaomi';
  if (/\brealme\b/.test(identity)) return 'realme';
  return String(product.brand_name || product.brand || 'Celulares');
}

function isEligible(product) {
  return product.status === 'active' && Number(product.stock_quantity) > 0
    && ![true, 1, '1'].includes(product.hide_from_catalog)
    && product.offer_visibility !== 'hidden' && !Number(product.is_parent) && !Number(product.is_combo)
    && /^(?:celulares?|smartphones?)(?:\b|$)/.test(normalize(product.category_name))
    && Number.isSafeInteger(Number(product.price_retail)) && Number(product.price_retail) > 0;
}

function productIdentity(product) {
  const specs = normalizeProductSpecsRam(product.specs);
  const custom = parse(product.custom_fields);
  const color = String(specs.color || specs.cor || custom.color || custom.cor || '').trim();
  let name = String(product.name || '').replace(/\s*[-–—|,]?\s*cor\s*:?\s*[^,|]+$/i, '').trim();
  if (color) name = name.replace(new RegExp('\\s*[-–—|,]?\\s*' + color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i'), '').trim();
  const memoryValue = (value) => String(value || '').replace(/\s+/g, '').replace(/(\d)g$/i, '$1GB').toUpperCase();
  const ram = memoryValue(specs.ram || custom.ram || custom.memoria_ram);
  const storage = memoryValue(specs.storage || specs.armazenamento || specs.memoria || specs.capacity || custom.storage || custom.armazenamento);
  const memory = [ram && `${ram} RAM`, storage].filter(Boolean).join(' • ');
  return { name, memory };
}

function buildPriceListGroups(rows, requestedGroups, brands = DEFAULT_BRANDS) {
  const eligible = rows.filter(isEligible);
  const byId = new Map(eligible.map((p) => [String(p.id), p]));
  if (requestedGroups) {
    return requestedGroups.map((group) => {
      const members = group.productIds.map((id) => byId.get(id));
      if (members.some((p) => !p)) throw failure('O estoque da lista mudou. Gere a lista novamente.', 409);
      const priceCents = Math.max(...members.map((p) => Number(p.price_retail)));
      if (priceCents !== group.priceCents) throw failure('O preço da lista mudou. Gere a lista novamente.', 409);
      const brand = resolveBrand(members[0]);
      if (members.some((p) => resolveBrand(p) !== brand)) throw failure('Um card não pode misturar marcas.');
      return { id: group.productIds.join(','), name: group.name, memory: group.memory, brand, priceCents, products: members };
    });
  }
  const groups = new Map();
  for (const product of eligible) {
    const brand = resolveBrand(product);
    if (!brands.includes(brand)) continue;
    const identity = productIdentity(product);
    // Same commercial rule as the official bot list: one price per name/memory,
    // taking the maximum registered retail price across available color variants.
    const key = [brand, normalize(identity.name), normalize(identity.memory)].join('|');
    if (!groups.has(key)) groups.set(key, { id: key, ...identity, brand, priceCents: 0, products: [] });
    const group = groups.get(key);
    group.priceCents = Math.max(group.priceCents, Number(product.price_retail));
    group.products.push(product);
  }
  return [...groups.values()].sort((a, b) => a.priceCents - b.priceCents || a.name.localeCompare(b.name, 'pt-BR'));
}

function validateSelection(body = {}) {
  const brands = body.brands ?? DEFAULT_BRANDS;
  if (!Array.isArray(brands) || !brands.length || brands.some((b) => !DEFAULT_BRANDS.includes(b))) throw failure('Selecione Xiaomi, POCO ou realme.');
  const groups = body.groups;
  if (groups !== undefined) {
    if (!Array.isArray(groups) || !groups.length || groups.length > 500) throw failure('Envie de 1 a 500 configurações de celulares.');
    const ids = new Set();
    for (const g of groups) {
      if (!g || !Array.isArray(g.productIds) || !g.productIds.length || g.productIds.length > 500
        || typeof g.name !== 'string' || !g.name.trim() || g.name.length > 200
        || typeof g.memory !== 'string' || g.memory.length > 100
        || !Number.isSafeInteger(g.priceCents) || g.priceCents <= 0) throw failure('Card de celular inválido.');
      for (const id of g.productIds) {
        if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw failure('Produto inválido ou repetido na lista.');
        ids.add(id);
      }
    }
    if (ids.size > 2000) throw failure('A lista excede 2000 produtos.');
  }
  return { brands: [...new Set(brands)], groups };
}

async function readPublicImage(value) {
  const inline = String(value || '').match(/^data:image\/(?:png|jpeg|webp);base64,([a-zA-Z0-9+/=\r\n]+)$/);
  if (inline) {
    if (inline[1].length > 20 * 1024 * 1024) return null;
    return sharp(Buffer.from(inline[1], 'base64'), { limitInputPixels: 40000000 }).rotate()
      .resize(920, 652, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  }
  let url;
  try { url = new URL(String(value || ''), 'https://mercadodovale.com.br'); } catch { return null; }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !IMAGE_HOSTS.has(url.hostname)) return null;
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), redirect: 'error' });
  if (!response.ok || !/^image\//.test(response.headers.get('content-type') || '')) return null;
  const maxBytes = 15 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > maxBytes) throw failure('Foto excede 15 MB.', 502);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) throw failure('Foto excede 15 MB.', 502);
    chunks.push(chunk);
  }
  return sharp(Buffer.concat(chunks), { limitInputPixels: 40000000 }).rotate()
    .resize(920, 652, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
}

function registerPhonePriceListRoutes(fastify, dependencies) {
  const { pool, requireSyncKeyOrAdmin, uploadsDir } = dependencies;
  const publicApiUrl = String(dependencies.publicApiUrl || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
  // Limits expensive rendering while coalescing identical concurrent bot requests.
  const inFlight = new Map();
  let activeJobs = 0;
  fastify.post('/admin/marketing/phone-price-list/preview', {
    preHandler: requireSyncKeyOrAdmin,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const selection = validateSelection(req.body);
    const ids = selection.groups?.flatMap((g) => g.productIds);
    const [rows] = await pool.query(`SELECT p.id,p.name,p.brand,p.model_id,p.specs,p.custom_fields,
      CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(p.images,'$[0]')) LIKE 'https://%'
      THEN JSON_ARRAY(JSON_UNQUOTE(JSON_EXTRACT(p.images,'$[0]'))) ELSE JSON_ARRAY() END AS images,
      p.price_retail,p.stock_quantity,p.status,p.hide_from_catalog,p.offer_visibility,p.is_parent,p.is_combo,
      c.name AS category_name,b.name AS brand_name FROM products p
      LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand
      WHERE p.status='active' AND p.stock_quantity>0 ${ids ? 'AND p.id IN (?)' : ''} ORDER BY p.name,p.id`, ids ? [ids] : []);
    const groups = buildPriceListGroups(rows, selection.groups, selection.brands);
    if (!groups.length) return { ok: true, items: [], productCount: 0, generatedAt: new Date().toISOString(), warnings: ['Nenhum celular disponível para as marcas selecionadas.'] };
    const [[company]] = await pool.query('SELECT phone,logo,watermark_url,social_website FROM company_settings LIMIT 1');
    if (!company?.phone) throw failure('Cadastre o WhatsApp oficial nos dados da empresa.', 409);
    const generatedAt = new Date();
    const day = generatedAt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const hydrated = await dependencies.attachCatalogModelColorImages(rows, 'https://mercadodovale.com.br');
    const hydratedById = new Map(hydrated.map((p) => [p.id, p]));
    const pages = paginatePhonePriceList(groups.map((g) => ({ ...g, products: g.products.map((p) => hydratedById.get(p.id) || p) })));
    const requestKey = hash(JSON.stringify({ pages, company, day, layout: 3 }));
    reply.header('Cache-Control', 'no-store');
    if (inFlight.has(requestKey)) return inFlight.get(requestKey);
    if (activeJobs >= 2) throw failure('A geração está ocupada. Tente novamente em instantes.', 503);
    const job = (async () => {
      activeJobs += 1;
      try {
        const warnings = [];
        const imagePromises = new Map();
        const image = (url) => {
          if (!imagePromises.has(url)) imagePromises.set(url, (dependencies.readImage || readPublicImage)(url).catch(() => null));
          return imagePromises.get(url);
        };
        // The approved composition uses this transparent store logo, not the
        // white rectangular watermark stored for other document layouts.
        let logoBuffer;
        try { logoBuffer = await fs.readFile(path.join(__dirname, '../public/brand/mercado-do-vale-logo.png')); } catch {}
        if (!logoBuffer) logoBuffer = await image('https://mercadodovale.com.br/brand/mercado-do-vale-logo.png');
        if (!logoBuffer) logoBuffer = await image(company.logo || company.watermark_url);
        if (!logoBuffer) throw failure('A logomarca da loja está indisponível. Confira os dados da empresa.', 502);
        const directory = path.join(uploadsDir, 'phone-price-lists');
        await fs.mkdir(directory, { recursive: true });
        const items = [];
        for (const page of pages) {
          const pageKey = hash(JSON.stringify({ page, company, day, layout: 3 }));
          let filename = `${pageKey}.png`;
          let target = path.join(directory, filename);
          let cached = false;
          try { await fs.access(target); cached = true; } catch {}
          if (!cached) {
            let missingPhoto = false;
            const cards = await Promise.all(page.items.map(async (card) => {
              let imageBuffer;
              const urls = [...new Set(card.products.flatMap((p) => [...parse(p.resolved_images, []), ...parse(p.model_color_images, []), ...parse(p.images, [])]))];
              for (const url of urls) { imageBuffer = await image(url); if (imageBuffer) break; }
              // Do not silently drop a phone or invent its appearance.
              if (!imageBuffer) { missingPhoto = true; warnings.push(`Foto indisponível: ${card.name} ${card.memory}`); }
              return { ...card, imageBuffer };
            }));
            const buffer = await renderPhonePriceListPage({ ...page, items: cards, logoBuffer,
              whatsapp: displayWhatsapp(company.phone), website: String(company.social_website || 'mercadodovale.com.br').replace(/^https?:\/\//i, '').replace(/\/$/, ''), generatedAt, priceLabel: 'à vista no Pix' });
            // A temporary image failure must be retried on the next request.
            if (missingPhoto) { filename = `${pageKey}-${crypto.randomUUID()}.png`; target = path.join(directory, filename); }
            const temporary = `${target}.${crypto.randomUUID()}.tmp`;
            await fs.writeFile(temporary, buffer);
            await fs.rename(temporary, target);
          }
          items.push({ mediaType: 'image', mediaUrl: `${publicApiUrl}/images/phone-price-lists/${filename}`,
            label: `Tabela ${page.brand} • ${page.pageNumber}/${page.totalPages}`,
            caption: `${page.brand} • Lista de celulares • ${generatedAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Consulte condições e disponibilidade.`,
            offsetSeconds: items.length * 10 });
        }
        return { ok: true, items, generatedAt: generatedAt.toISOString(), productCount: groups.length, warnings };
      } finally { activeJobs -= 1; }
    })();
    inFlight.set(requestKey, job);
    try { return await job; } finally { inFlight.delete(requestKey); }
  });
}

module.exports = { registerPhonePriceListRoutes, buildPriceListGroups, validateSelection, isEligible, resolveBrand, productIdentity, readPublicImage };
