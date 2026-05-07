require('dotenv').config();
const fastify = require('fastify')({ logger: false, bodyLimit: 500 * 1024 * 1024 }); // 500MB
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { validateMediaUploadPath } = require('./services/vpsUploadPathPolicy.cjs');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const AUTORESPONDER_ATTACHMENT_SYNOLOGY_FOLDER = process.env.AUTORESPONDER_ATTACHMENT_SYNOLOGY_FOLDER || 'imagens';
const AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR = process.env.AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR || '/volume1/backups/autoresponder';
const AUTORESPONDER_DEFAULT_HUMAN_IN_HOURS = 'Certo, vou chamar um especialista para te atender. Por favor aguarde um instante.';
const AUTORESPONDER_DEFAULT_HUMAN_OUT_OF_HOURS = 'Certo, vou chamar um especialista. Estamos fora do horario de atendimento humano agora, mas sua mensagem ficou registrada e vamos te responder assim que possivel.';
const AUTORESPONDER_DEFAULT_FALLBACK_MESSAGE = 'Nao consegui localizar exatamente isso agora. Me diga o modelo do aparelho ou o tipo de produto que voce procura.';
const AUTORESPONDER_DEFAULT_AUTO_PAUSE_MESSAGE = 'Vou chamar um atendente para te ajudar melhor. Assim conseguimos conferir certinho pra voce.';
const AUTORESPONDER_PRODUCT_PAGE_SIZE = 5;
const AUTORESPONDER_MAX_PRODUCT_REPLY_MESSAGES = 10;
const AUTORESPONDER_PRODUCT_REPLY_DELAY_SECONDS = 3;
const AUTORESPONDER_PRODUCT_RESPONSE_LIMIT = AUTORESPONDER_PRODUCT_PAGE_SIZE * AUTORESPONDER_MAX_PRODUCT_REPLY_MESSAGES;
const AUTORESPONDER_RULE_TEMPLATES = [
  { name: 'Saudacao manha', pattern: 'bom dia, oi bom dia, dia' },
  { name: 'Saudacao tarde', pattern: 'boa tarde, tarde' },
  { name: 'Saudacao noite', pattern: 'boa noite, noite' },
  { name: 'Saudacao generica', pattern: 'oi, ola, e ai, eai, opa, eae' },
  { name: 'Despedida', pattern: 'tchau, obrigado, obrigada, valeu, vlw, agradecido, brigado' },
  { name: 'Endereco/localizacao', pattern: 'onde, endereco, localizacao, fica, ficam, lugar, mapa, maps' },
  { name: 'Horario de funcionamento', pattern: 'horario, abre, fecha, funcionamento, hora, aberto, fechado' },
  { name: 'Estacionamento', pattern: 'estacionamento, vaga, estacionar, carro' },
  { name: 'Entrega/frete', pattern: 'entrega, frete, delivery, mandar, enviar, entregar, motoboy' },
  { name: 'Formas de pagamento', pattern: 'pagamento, pago, pix, cartao, parcela, parcelar, dinheiro, boleto, debito' },
  { name: 'Desconto a vista / PIX', pattern: 'desconto, a vista, avista, pix, dinheiro, abate' },
  { name: 'Nota fiscal', pattern: 'nota fiscal, nf, cupom, fiscal, sefaz, recibo' },
  { name: 'Garantia', pattern: 'garantia, prazo, defeito, problema, queimou, parou' },
  { name: 'Troca/devolucao', pattern: 'troca, trocar, devolucao, devolver, arrependimento' },
  { name: 'Assistencia tecnica', pattern: 'assistencia, conserto, consertar, tecnico, reparo, manutencao' },
  { name: 'Troca de tela / pelicula', pattern: 'tela, pelicula, trocar tela, quebrou, rachou' },
  { name: 'Desbloqueio', pattern: 'desbloqueio, desbloquear, conta google, mi account, icloud, frp' },
  { name: 'Aceita usado/seminovo', pattern: 'usado, seminovo, semi novo, troca por outro, dou de entrada, valor do meu' },
  { name: 'Catalogo / produtos', pattern: 'catalogo, produtos, lista, voces tem, o que vendem' },
  { name: 'Promocoes/ofertas', pattern: 'promocao, oferta, ofertinha, desconto, barato, baratinho' },
  {
    name: 'Falar com humano',
    pattern: 'humano, atendente, pessoa, real, falar com alguem, especialista, vendedor, gerente',
    replyText: AUTORESPONDER_DEFAULT_HUMAN_IN_HOURS,
    priority: 1000,
    active: 1,
  },
  { name: 'Fallback auto', pattern: '*', matchType: 'exact', active: 0 },
];

function isImmutableImageDerivative(filePath = '') {
  return /-\d+\.(webp|avif)$/i.test(filePath);
}

function safeAutoresponderAttachmentFilename(originalFilename = '') {
  const originalExt = path.extname(originalFilename || '').toLowerCase() || '.bin';
  const safeExt = originalExt.replace(/[^a-z0-9.]/g, '') || '.bin';
  return `autoresponder-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${safeExt}`;
}


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_AUTH_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const CORS_ORIGINS = [
  'https://www.mercadodovale.com.br',
  'https://mercadodovale.com.br',
  'https://www.mercadodovale.com',
  'https://mercadodovale.com',
  'https://www.xiaomipetrolina.com.br',
  'https://xiaomipetrolina.com.br',
  'https://mercado-do-vale-news.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

fastify.register(require('@fastify/cors'), {
  origin: (origin, cb) => {
    if (!origin || CORS_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// Serve static images from /var/www/mdv-api/uploads/
fastify.register(require('@fastify/static'), {
  root: UPLOADS_DIR,
  prefix: '/images/',
  decorateReply: false,
  setHeaders: (res, filePath) => {
    // Allow images cross-origin; CDN-Cache-Control impede Cloudflare de cachear
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (isImmutableImageDerivative(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('CDN-Cache-Control', 'public, max-age=31536000, immutable');
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('CDN-Cache-Control', 'no-store'); // Cloudflare não cacheia imagens
  },
});

// Multipart support for file uploads
fastify.register(require('@fastify/multipart'), {
  limits: { fileSize: 500 * 1024 * 1024 }, // Synology video uploads can be large; smaller routes set their own limits.
});

// Compressão HTTP gzip/br — reduz payload JSON de 90MB → ~8MB, compact+gzip → ~800KB
fastify.register(require('@fastify/compress'), {
  global: true,
  encodings: ['gzip', 'deflate'],
});

// Security headers for API responses
fastify.register(require('@fastify/helmet'), {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  // Allow images to be loaded cross-origin (e.g., mercadodovale.com.br loading from api.xiaomipetrolina.com.br)
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// Basic per-IP rate limit to reduce brute-force and abuse on public endpoints
fastify.register(require('@fastify/rate-limit'), {
  global: true,
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  allowList: (req) => {
    const syncKey = req.headers['x-sync-key'] || req.headers['x-api-key'];
    if (syncKey && syncKey === process.env.SYNC_SECRET) return true;
    const ip = req.ip || '';
    return ip === '127.0.0.1' || ip === '::1';
  },
  errorResponseBuilder: function (_req, context) {
    return {
      error: 'Too many requests',
      statusCode: 429,
      retryAfter: context.after,
    };
  },
});


// ─── Auth middleware for write endpoints ───────────────────────────────────
function requireSyncKey(request, reply, done) {
  const key = request.headers['x-sync-key'] || request.headers['x-api-key'];
  if (!key || key !== process.env.SYNC_SECRET) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
}

function requireAutoresponderToken(request, reply, done) {
  const configuredToken = process.env.AUTORESPONDER_TOKEN || '';
  const receivedToken =
    request.headers['x-autoresponder-token'] ||
    request.query?.token ||
    request.query?.autoresponder_token ||
    request.query?.x_autoresponder_token ||
    '';
  if (!configuredToken || receivedToken !== configuredToken) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
}

function getBearerToken(request) {
  const auth = String(request.headers.authorization || '');
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
}

async function isAdminBearerToken(request) {
  if (!SUPABASE_URL || !SUPABASE_AUTH_KEY) return false;
  const token = getBearerToken(request);
  if (!token) return false;

  try {
    const authRes = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_AUTH_KEY,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!authRes.ok) return false;

    const user = await authRes.json();
    const userId = user?.id;
    if (!userId) return false;

    const customerRes = await fetch(
      `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/customers?select=customer_type&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_AUTH_KEY,
          Authorization: `Bearer ${SUPABASE_AUTH_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!customerRes.ok) return false;

    const customers = await customerRes.json();
    return customers?.[0]?.customer_type === 'ADMIN';
  } catch (err) {
    console.warn('[auth] Supabase admin Bearer validation failed:', err.message);
    return false;
  }
}

async function requireSyncKeyOrAdmin(request, reply) {
  const key = request.headers['x-sync-key'] || request.headers['x-api-key'];
  if (key && key === process.env.SYNC_SECRET) return;
  if (await isAdminBearerToken(request)) return;
  return reply.code(401).send({ error: 'Unauthorized' });
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const jsonStr = (v) => v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));
const optionalBool = (v) => v == null ? null : (v ? 1 : 0);
const boolInt = (v) => v ? 1 : 0;

function normalizeAutoresponderSender(value) {
  return String(value || '').replace(/\D+/g, '');
}

function normalizeAutoresponderText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isAutoresponderHumanRequest(message) {
  const text = normalizeAutoresponderText(message);
  return /\b(humano|atendente|pessoa|vendedor|gerente|especialista)\b/.test(text)
    || text.includes('falar com alguem')
    || text.includes('pessoa real')
    || text.includes('atendimento humano');
}

function isAutoresponderWarrantyRequest(message) {
  const text = normalizeAutoresponderText(message);
  return /\b(garantia|garantias|garantido|defeito|defeitos|cobertura|assistencia)\b/.test(text);
}

function isAutoresponderGreeting(message) {
  const text = normalizeAutoresponderText(message).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return /(^|\s)(oi|ola|bom dia|boa tarde|boa noite|e ai|opa)(\s|$)/.test(text);
}

function isAutoresponderGreetingOnly(message) {
  const text = normalizeAutoresponderText(message).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return /^(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|opa|bomdia|boatarde|boanoite)$/.test(text);
}

function getAutoresponderContactFirstName(payload) {
  const rawName = String(
    payload?.senderName ||
    payload?.contactName ||
    payload?.pushName ||
    payload?.sender_name ||
    payload?.contact_name ||
    payload?.name ||
    ''
  ).trim();
  const cleanName = rawName
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const firstName = cleanName.split(' ')[0] || '';
  return firstName.length >= 2 ? firstName : '';
}

function normalizeAutoresponderContactName(value) {
  return String(value || '')
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function isAutoresponderYes(message) {
  const text = normalizeAutoresponderText(message).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return /^(sim|s|isso|correto|confirmo|pode|pode sim|ta certo|esta certo)$/.test(text);
}

function isAutoresponderNo(message) {
  const text = normalizeAutoresponderText(message).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return /^(nao|n|não|errado|nao e|nao eh|nao sou|outro nome)$/.test(text);
}

function formatAutoresponderPhoneForGoogle(sender) {
  const digits = normalizeAutoresponderSender(sender);
  if (!digits) return '';
  return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
}

async function getGoogleContactsAccessToken() {
  const clientId = process.env.GOOGLE_CONTACTS_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CONTACTS_CLIENT_SECRET || '';
  const refreshToken = process.env.GOOGLE_CONTACTS_REFRESH_TOKEN || '';
  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token || null;
}

async function createOrUpdateGoogleContact({ sender, name }) {
  const accessToken = await getGoogleContactsAccessToken();
  if (!accessToken) return { ok: false, skipped: true, reason: 'google_contacts_not_configured' };

  const phoneNumber = formatAutoresponderPhoneForGoogle(sender);
  if (!phoneNumber || !name) return { ok: false, skipped: true, reason: 'missing_contact_data' };

  const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      names: [{ givenName: name }],
      phoneNumbers: [{ value: phoneNumber }],
      biographies: [{ value: 'Cliente WhatsApp Mercado do Vale' }],
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Google contact create failed: ${res.status} ${await res.text()}`);
  }
  const contact = await res.json();
  return { ok: true, resourceName: contact.resourceName || null };
}

async function getAutoresponderContactNameState(sender) {
  const [rows] = await pool.query(
    `SELECT contact_name_status, contact_name_suggestion, contact_name_confirmed, google_contact_resource_name
     FROM autoresponder_conversations
     WHERE sender = ?
     LIMIT 1`,
    [sender]
  );
  return rows[0] || null;
}

async function startAutoresponderContactNameConfirmation(sender, suggestedName) {
  await pool.query(
    `INSERT INTO autoresponder_conversations
      (sender, last_message_at, contact_name_status, contact_name_suggestion, contact_name_updated_at)
     VALUES (?, CURRENT_TIMESTAMP, 'awaiting_name_confirmation', ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       contact_name_status = 'awaiting_name_confirmation',
       contact_name_suggestion = ?,
       contact_name_updated_at = CURRENT_TIMESTAMP`,
    [sender, suggestedName, suggestedName]
  );
}

async function markAutoresponderContactNameAwaitingInput(sender) {
  await pool.query(
    `INSERT INTO autoresponder_conversations
      (sender, last_message_at, contact_name_status, contact_name_updated_at)
     VALUES (?, CURRENT_TIMESTAMP, 'awaiting_name_input', CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       contact_name_status = 'awaiting_name_input',
       contact_name_updated_at = CURRENT_TIMESTAMP`,
    [sender]
  );
}

async function saveAutoresponderConfirmedContactName(sender, name, googleResult) {
  const status = googleResult?.ok ? 'saved_to_google' : 'google_pending';
  await pool.query(
    `INSERT INTO autoresponder_conversations
      (sender, last_message_at, contact_name_status, contact_name_confirmed, google_contact_resource_name, contact_name_updated_at)
     VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       contact_name_status = ?,
       contact_name_confirmed = ?,
       google_contact_resource_name = ?,
       contact_name_updated_at = CURRENT_TIMESTAMP`,
    [sender, status, name, googleResult?.resourceName || null, status, name, googleResult?.resourceName || null]
  );
}

function formatAutoresponderContactSavedReply(name, googleResult) {
  if (googleResult?.ok) {
    return `Perfeito, ${name}! Vou salvar seu contato aqui. ✅`;
  }
  return `Perfeito, ${name}! Vou deixar seu contato salvo aqui. ✅`;
}

function formatAutoresponderContactFollowUpReply() {
  return 'Em que posso ajudar voce hoje? ✨';
}

async function confirmAutoresponderContactName(sender, name) {
  const googleResult = await createOrUpdateGoogleContact({ sender, name }).catch((err) => {
    console.warn('[autoresponder] google contact save failed:', err.message);
    return { ok: false, skipped: true, reason: 'google_contact_error' };
  });
  await saveAutoresponderConfirmedContactName(sender, name, googleResult);
  return [
    formatAutoresponderContactSavedReply(name, googleResult),
    formatAutoresponderContactFollowUpReply(),
  ];
}

async function handleAutoresponderContactNameFlow({ sender, message, contactFirstName }) {
  const state = await getAutoresponderContactNameState(sender);
  const status = String(state?.contact_name_status || '');
  const suggestedName = normalizeAutoresponderContactName(state?.contact_name_suggestion || contactFirstName);

  if (status === 'saved_to_google' || status === 'google_pending') return null;

  if (status === 'awaiting_name_confirmation') {
    if (isAutoresponderYes(message) && suggestedName) {
      return confirmAutoresponderContactName(sender, suggestedName);
    }
    if (isAutoresponderNo(message)) {
      await markAutoresponderContactNameAwaitingInput(sender);
      return 'Sem problema 😊\nQual nome devo colocar no seu contato?';
    }
    return null;
  }

  if (status === 'awaiting_name_input') {
    const typedName = normalizeAutoresponderContactName(message);
    if (typedName.length < 2 || typedName.split(' ').length > 5) {
      return 'Me envie apenas o nome que devo colocar no seu contato, por favor. 😊';
    }
    return confirmAutoresponderContactName(sender, typedName);
  }

  return null;
}

function getAutoresponderGreetingPeriod(message) {
  const text = normalizeAutoresponderText(message);
  if (text.includes('bom dia') || text === 'bomdia') return 'morning';
  if (text.includes('boa tarde') || text === 'boatarde') return 'afternoon';
  if (text.includes('boa noite') || text === 'boanoite') return 'night';

  const hour = Number(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false,
  }).format(new Date()));
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
}

function getAutoresponderGreetingReply(message, contactFirstName = '') {
  const period = getAutoresponderGreetingPeriod(message);
  const greeting = period === 'morning'
    ? 'Bom dia'
    : period === 'afternoon'
      ? 'Boa tarde'
      : 'Boa noite';
  const emoji = period === 'night' ? '🌙' : '✨';
  const nameText = contactFirstName ? `, ${contactFirstName}` : '';
  return `${greeting}${nameText}! 😊 Seja bem-vindo ao Mercado do Vale.\nComo posso ajudar voce hoje? ${emoji}`;
}

function formatAutoresponderReply(replyText, settings, shouldPrefixGreeting) {
  const text = String(replyText || '').trim();
  const prefix = String(settings?.greeting_prefix || '').trim();
  if (!shouldPrefixGreeting || !prefix || text.startsWith(prefix)) return text;
  return `${prefix}\n\n${text}`;
}

function appendAutoresponderRuleAttachment(replyText, rule) {
  const attachmentUrl = String(rule?.attachment_url || '').trim();
  const attachmentCaption = String(rule?.attachment_caption || '').trim();
  if (!attachmentUrl) return replyText;

  const lines = [String(replyText || '').trim(), ''];
  if (attachmentCaption) lines.push(attachmentCaption);
  lines.push(`Anexo: ${attachmentUrl}`);
  return lines.filter((line, index) => line || index === 1).join('\n');
}

function splitAutoresponderRulePattern(pattern) {
  return String(pattern || '')
    .split(/[\n,;|]+/)
    .map((part) => normalizeAutoresponderText(part).trim())
    .filter(Boolean);
}

function doesAutoresponderRuleMatch(message, rule) {
  const text = normalizeAutoresponderText(message);
  const pattern = String(rule?.pattern || '').trim();
  const normalizedPattern = normalizeAutoresponderText(pattern).trim();
  const matchType = String(rule?.match_type || 'any_keyword').toLowerCase();
  if (!text || !pattern) return false;

  if (matchType === 'regex') {
    try {
      return new RegExp(pattern, 'i').test(String(message || ''));
    } catch (err) {
      console.warn('[autoresponder] invalid rule regex ignored:', err.message);
      return false;
    }
  }

  if (matchType === 'exact') {
    return text.trim() === normalizedPattern;
  }

  const keywords = splitAutoresponderRulePattern(pattern);
  if (keywords.length === 0) return false;

  if (matchType === 'all_keywords') {
    return keywords.every((keyword) => text.includes(keyword));
  }

  return keywords.some((keyword) => text.includes(keyword));
}

async function findAutoresponderRuleMatch(message) {
  const [rows] = await pool.query(
    `SELECT id, match_type, pattern, reply_type, reply_text, reply_tag_id, reply_search_query, attachment_url, attachment_caption, auto_apply_tag_id
     FROM autoresponder_rules
     WHERE active = 1
     ORDER BY priority DESC, id ASC`
  );

  return rows.find((rule) => {
    const replyType = String(rule.reply_type || 'text');
    if (replyType === 'text' && !String(rule.reply_text || '').trim()) return false;
    if (replyType === 'product_by_tag' && !rule.reply_tag_id) return false;
    if (replyType === 'product_search' && !String(rule.reply_search_query || '').trim()) return false;
    return doesAutoresponderRuleMatch(message, rule);
  }) || null;
}

function normalizeAutoresponderTagKeywordMap(value) {
  const parsed = parsePublicJson(value, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];

  const entries = [];
  for (const [key, rawValue] of Object.entries(parsed)) {
    const normalizedKey = normalizeAutoresponderText(key).trim();
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    if (/^\d+$/.test(String(key))) {
      for (const keyword of values) {
        const normalizedKeyword = normalizeAutoresponderText(keyword).trim();
        if (normalizedKeyword) entries.push({ keyword: normalizedKeyword, tagId: Number(key) });
      }
      continue;
    }

    for (const tagId of values) {
      const numericTagId = Number(tagId);
      if (normalizedKey && Number.isFinite(numericTagId)) {
        entries.push({ keyword: normalizedKey, tagId: numericTagId });
      }
    }
  }

  return entries;
}

function findAutoresponderProductTagKeyword(message, settings) {
  const text = normalizeAutoresponderText(message);
  const entries = normalizeAutoresponderTagKeywordMap(settings?.product_tag_keywords);
  return entries.find((entry) => text.includes(entry.keyword)) || null;
}

function buildAutoresponderCategoryOptions(categories) {
  return (Array.isArray(categories) ? categories : []).map((category) => ({
    type: 'category',
    id: category.id,
    name: category.name,
    productCount: Number(category.product_count || 0),
  }));
}

function formatAutoresponderGreetingCategoryListReply(categories) {
  const options = buildAutoresponderCategoryOptions(categories);
  if (options.length === 0) return '';
  const lines = [
    'Categorias disponiveis:',
    ...options.map((category, index) => `${index + 1}. ${category.name}`),
    '',
    'Responda com o numero ou nome da categoria.',
  ];
  return lines.join('\n');
}

function findAutoresponderSelectedCategoryFromMessage(message, categories, numberedChoice = null) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const choiceNumber = Number(numberedChoice || 0);
  if (choiceNumber > 0) return safeCategories[choiceNumber - 1] || null;

  const text = normalizeAutoresponderText(message).trim();
  if (text.length < 2) return null;
  return safeCategories.find((category) => normalizeAutoresponderText(category?.name || '').trim() === text) || null;
}

function isAutoresponderMoreRequest(message) {
  const text = normalizeAutoresponderText(message).trim();
  return ['mais', 'ver mais', 'proximos', 'proximo', 'mais opcoes', 'mais opções'].includes(text);
}

function buildAutoresponderOptionsContext(items, pagination = null) {
  return {
    items: Array.isArray(items) ? items : [],
    pagination,
  };
}

function normalizeAutoresponderOptionsContext(value) {
  const parsed = parsePublicJson(value, []);
  if (Array.isArray(parsed)) return buildAutoresponderOptionsContext(parsed, null);
  if (!parsed || typeof parsed !== 'object') return buildAutoresponderOptionsContext([], null);
  return buildAutoresponderOptionsContext(parsed.items || [], parsed.pagination || null);
}

async function getAutoresponderOptionsContext(sender, validityMinutes) {
  const minutes = Number(validityMinutes) > 0 ? Number(validityMinutes) : 30;
  const [rows] = await pool.query(
    `SELECT last_options_offered
     FROM autoresponder_conversations
     WHERE sender = ?
       AND last_options_offered IS NOT NULL
       AND last_options_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
     LIMIT 1`,
    [sender, minutes]
  );
  return normalizeAutoresponderOptionsContext(rows[0]?.last_options_offered);
}

function normalizeAutoresponderPurchaseFlow(value) {
  const parsed = parsePublicJson(value, null);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { status: 'idle', items: [] };
  }

  return {
    ...parsed,
    status: String(parsed.status || 'idle'),
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

async function getAutoresponderPurchaseFlow(sender) {
  const [rows] = await pool.query(
    `SELECT purchase_flow
     FROM autoresponder_conversations
     WHERE sender = ?
     LIMIT 1`,
    [sender]
  );
  return normalizeAutoresponderPurchaseFlow(rows[0]?.purchase_flow);
}

async function saveAutoresponderPurchaseFlow(sender, purchaseFlow) {
  const normalized = normalizeAutoresponderPurchaseFlow(purchaseFlow);
  await pool.query(
    `INSERT INTO autoresponder_conversations
      (sender, last_message_at, purchase_flow, purchase_flow_updated_at)
     VALUES (?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       purchase_flow = ?,
       purchase_flow_updated_at = CURRENT_TIMESTAMP`,
    [sender, jsonStr(normalized), jsonStr(normalized)]
  );
  return normalized;
}

async function clearAutoresponderPurchaseFlow(sender) {
  await pool.query(
    `UPDATE autoresponder_conversations
     SET purchase_flow = NULL,
         purchase_flow_updated_at = CURRENT_TIMESTAMP
     WHERE sender = ?`,
    [sender]
  );
}

function findAutoresponderSelectedOptionFromMessage(message, options, numberedChoice = null) {
  const safeOptions = Array.isArray(options) ? options : [];
  const choiceNumber = Number(numberedChoice || 0);
  if (choiceNumber > 0) return safeOptions[choiceNumber - 1] || null;

  const text = normalizeAutoresponderText(message).trim();
  if (text.length < 4) return null;
  const tokens = text.split(/\s+/).filter((token) => token.length >= 2);
  if (tokens.length < 2) return null;

  return safeOptions.find((option) => {
    const name = normalizeAutoresponderText(option?.name || '');
    const sku = normalizeAutoresponderText(option?.sku || '');
    if (sku && sku === text) return true;
    if (!name) return false;
    return tokens.every((token) => name.includes(token));
  }) || null;
}

function buildAutoresponderPurchaseActionPrompt(product, selectedOption) {
  const productName = product?.name || selectedOption?.name || 'produto selecionado';
  const priceLine = product ? `\nValor: ${formatAutoresponderCurrency(getAutoresponderProductPrice(product))}` : '';
  return `Certo, voce escolheu:\n${productName}${priceLine}\n\nQuer comprar esse produto ou ver detalhes primeiro?\nResponda "comprar" ou "detalhes".`;
}

function isAutoresponderPurchaseBuyRequest(message) {
  const text = normalizeAutoresponderText(message).trim();
  return [
    'comprar',
    'quero comprar',
    'vou comprar',
    'comprar esse',
    'comprar este',
    'quero esse',
    'quero este',
    'fechar',
  ].includes(text);
}

function isAutoresponderPurchaseDetailsRequest(message) {
  const text = normalizeAutoresponderText(message).trim();
  return [
    'detalhes',
    'ver detalhes',
    'detalhe',
    'mais detalhes',
    'informacoes',
    'informacao',
    'mais informacoes',
  ].includes(text);
}

function isAutoresponderPurchaseAddMoreRequest(message) {
  const text = normalizeAutoresponderText(message).trim();
  return [
    'adicionar mais',
    'mais produtos',
    'colocar mais',
    'incluir mais',
    'comprar mais',
    'continuar comprando',
    'adicionar outro',
    'outro produto',
    'mais um',
  ].includes(text);
}

function isAutoresponderPurchaseCancelRequest(message) {
  const text = normalizeAutoresponderText(message).trim();
  return [
    'cancelar',
    'cancelar compra',
    'cancelar pedido',
    'cancelar carrinho',
    'limpar carrinho',
    'desistir',
    'nao quero mais',
  ].includes(text);
}

function isAutoresponderPurchaseFinalizeRequest(message) {
  const text = normalizeAutoresponderText(message).trim();
  return [
    'finalizar',
    'fechar pedido',
    'fechar compra',
    'concluir',
    'concluir pedido',
    'resumo',
    'ver resumo',
    'resumo do pedido',
  ].includes(text);
}

function getAutoresponderPurchaseRemoveItemIndex(message) {
  const text = normalizeAutoresponderText(message).trim();
  const match = text.match(/^(?:remover|tirar|excluir)\s+(?:item\s+)?(\d{1,2})$/);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function hasAutoresponderCartItems(purchaseFlow) {
  return Array.isArray(purchaseFlow?.items) && purchaseFlow.items.length > 0;
}

function buildAutoresponderQuantityPrompt(product) {
  const productName = product?.name || 'produto selecionado';
  const stock = Number(product?.stock_quantity);
  const stockLine = Number.isFinite(stock) && stock > 0 ? `\nEstoque disponivel agora: ${stock}.` : '';
  return `Perfeito. Quantas unidades voce deseja?\n${productName}${stockLine}\n\nResponda apenas com a quantidade.`;
}

function parseAutoresponderRequestedQuantity(message) {
  const text = normalizeAutoresponderText(message).trim();
  const exactNumber = text.match(/^\d{1,3}$/);
  if (exactNumber) return Number(exactNumber[0]);
  const unitMatch = text.match(/^(\d{1,3})\s*(un|unidade|unidades|peca|pecas)$/);
  return unitMatch ? Number(unitMatch[1]) : null;
}

function buildAutoresponderOutOfStockReply(product) {
  const productName = product?.name || 'produto selecionado';
  return `Esse produto ficou sem estoque agora: ${productName}.\n\nPosso te mostrar outra opcao ou chamar um atendente para conferir alternativa.`;
}

function buildAutoresponderInsufficientStockReply(product, requestedQuantity, availableStock) {
  const productName = product?.name || 'produto selecionado';
  return `Temos apenas ${availableStock} unidade(s) disponiveis de ${productName}.\n\nVoce pediu ${requestedQuantity}. Responda uma quantidade ate ${availableStock} ou peça atendimento.`;
}

function buildAutoresponderItemAddedPrompt(item) {
  const quantity = Number(item?.quantity || 0);
  const productName = item?.name || 'produto selecionado';
  return `Adicionei ao carrinho: ${quantity} unidade(s) de ${productName}.\n\nQuer adicionar mais produtos ou finalizar?`;
}

function buildAutoresponderAddMorePrompt() {
  return 'Qual produto voce quer adicionar agora? Pode mandar o nome/modelo ou escolher uma opcao de uma lista recente.';
}

function buildAutoresponderCartCancelledReply() {
  return 'Carrinho cancelado. Se quiser, posso te ajudar a escolher outros produtos.';
}

function buildAutoresponderItemRemovedReply(item, remainingItems) {
  const productName = item?.name || 'item selecionado';
  const remainingCount = Array.isArray(remainingItems) ? remainingItems.length : 0;
  if (remainingCount <= 0) {
    return `Removi do carrinho: ${productName}.\n\nSeu carrinho ficou vazio.`;
  }
  return `Removi do carrinho: ${productName}.\n\nAinda ficou ${remainingCount} item(ns) no carrinho.`;
}

function calculateAutoresponderCartTotals(cartItems) {
  const items = Array.isArray(cartItems) ? cartItems : [];
  const subtotalCents = items.reduce((total, item) => total + Number(item?.subtotal_cents || 0), 0);
  return {
    itemCount: items.length,
    subtotal_cents: subtotalCents,
    total_cents: subtotalCents,
  };
}

function formatAutoresponderCartSummaryReply(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const totals = calculateAutoresponderCartTotals(safeItems);
  const lines = ['Resumo do pedido'];

  safeItems.forEach((item, index) => {
    const quantity = Number(item?.quantity || 0);
    const name = item?.name || 'produto';
    const unitPrice = formatAutoresponderCurrency(Number(item?.unit_price_cents || 0) / 100);
    const subtotal = formatAutoresponderCurrency(Number(item?.subtotal_cents || 0) / 100);
    lines.push(`${index + 1}. ${quantity}x ${name} - ${unitPrice} cada - Subtotal: ${subtotal}`);
  });

  lines.push(`Subtotal: ${formatAutoresponderCurrency(totals.subtotal_cents / 100)}`);
  lines.push(`Total: ${formatAutoresponderCurrency(totals.total_cents / 100)}`);
  lines.push('');
  lines.push('Agora preciso confirmar se sera retirada na loja ou entrega.');
  return lines.join('\n');
}

function getAutoresponderPurchaseFulfillmentChoice(message) {
  const text = normalizeAutoresponderText(message).trim();
  if (/\b(retirada|retirar|buscar|busco|loja|balcao)\b/.test(text)) return 'pickup';
  if (/\b(entrega|entregar|delivery|frete|motoboy|enviar|mandar)\b/.test(text)) return 'delivery';
  return null;
}

function normalizeAutoresponderDeliveryAddress(message) {
  return String(message || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function buildAutoresponderPickupConfirmationReply() {
  return 'Combinado: retirada na loja. Agora vou confirmar os dados do cadastro para separar seu pedido.';
}

function buildAutoresponderDeliveryAddressPrompt() {
  return 'Combinado: entrega. Me envie o endereco completo com rua, numero, bairro, cidade e ponto de referencia se tiver.';
}

function buildAutoresponderDeliveryAddressSavedReply() {
  return 'Endereco anotado. Agora vou confirmar os dados do cadastro para separar seu pedido.';
}

async function getAutoresponderCustomerDataSnapshot(sender, payload = {}, purchaseFlow = {}) {
  const contactState = await getAutoresponderContactNameState(sender);
  const confirmedName = normalizeAutoresponderContactName(
    contactState?.contact_name_confirmed ||
    payload?.contactName ||
    payload?.senderName ||
    payload?.pushName ||
    ''
  );
  const phone = formatAutoresponderPhoneForGoogle(sender) || normalizeAutoresponderSender(sender);
  const cpfCnpj = normalizeAutoresponderCustomerDocument(
    purchaseFlow?.customer_data?.cpf_cnpj ||
    payload?.cpf_cnpj ||
    payload?.cpf ||
    payload?.cnpj ||
    ''
  );
  return {
    name: confirmedName || 'nao informado',
    phone: phone || 'nao informado',
    cpf_cnpj: cpfCnpj || null,
    fulfillment: purchaseFlow?.fulfillment || null,
    address: purchaseFlow?.fulfillment === 'delivery'
      ? normalizeAutoresponderDeliveryAddress(purchaseFlow?.delivery_address)
      : 'Retirada na loja',
  };
}

function buildAutoresponderCustomerDataConfirmationReply(customerData) {
  const lines = [
    'Confirme os dados do pedido:',
    `Nome: ${customerData?.name || 'nao informado'}`,
    `Telefone: ${customerData?.phone || 'nao informado'}`,
    `Endereco: ${customerData?.address || 'Retirada na loja'}`,
    '',
    'Esta tudo certo? Responda "sim" para confirmar ou "nao" para ajustar com um atendente.',
  ];
  return lines.join('\n');
}

function buildAutoresponderCustomerDataConfirmedReply() {
  return 'Dados confirmados. Vou separar o pedido para um atendente finalizar com voce.';
}

function buildAutoresponderCustomerDataNeedsUpdateReply() {
  return 'Sem problema. Vou deixar marcado para um atendente ajustar seus dados antes de finalizar.';
}

function normalizeAutoresponderCustomerDocument(message) {
  const digits = String(message || '').replace(/\D+/g, '');
  if (digits.length === 11 || digits.length === 14) return digits;
  return '';
}

function buildAutoresponderCustomerDocumentPrompt() {
  return 'Para completar o cadastro, me envie o CPF/CNPJ do cliente. Pode mandar apenas os numeros.';
}

function buildAutoresponderCustomerDocumentSavedReply() {
  return 'Dados minimos do cadastro anotados. Vou separar o pedido para um atendente finalizar com voce.';
}

async function findAutoresponderProductsByTag(tagId, limit = 5, offset = 0) {
  const safeLimit = Math.min(Math.max(Number(limit) || AUTORESPONDER_PRODUCT_PAGE_SIZE, 1), AUTORESPONDER_PRODUCT_RESPONSE_LIMIT);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const numericTagId = Number(tagId);
  const [rows] = await pool.query(
    `SELECT id, model_id, category_id, brand, name, sku, slug, price_retail, price_promo, stock_quantity, specs, custom_fields,
       warranty_type, warranty_template_id,
       (SELECT warranty_days FROM brands WHERE CAST(brands.id AS CHAR) = products.brand OR brands.name = products.brand LIMIT 1) AS brand_warranty_days,
       (SELECT warranty_days FROM categories WHERE categories.id = products.category_id LIMIT 1) AS category_warranty_days,
       JSON_UNQUOTE(JSON_EXTRACT(images, '$[0]')) AS imageUrl
     FROM products
     WHERE status = 'active'
       AND (is_parent = 0 OR is_parent IS NULL)
       AND (
         JSON_CONTAINS(tag_ids, JSON_ARRAY(?))
         OR JSON_CONTAINS(tag_ids, JSON_ARRAY(CAST(? AS CHAR)))
       )
     ORDER BY stock_quantity > 0 DESC, updated_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [Number.isFinite(numericTagId) ? numericTagId : tagId, String(tagId)]
  );
  return rows;
}

async function findAutoresponderAvailableCategories(limit = 12) {
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 20);
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.slug, COUNT(p.id) AS product_count
     FROM categories c
     JOIN products p ON p.category_id = c.id
      AND p.status = 'active'
      AND (p.is_parent = 0 OR p.is_parent IS NULL)
      AND p.stock_quantity > 0
     GROUP BY c.id, c.name, c.slug, c.sort_order
     ORDER BY c.sort_order ASC, product_count DESC, c.name ASC
     LIMIT ${safeLimit}`
  );
  return rows;
}

async function findAutoresponderProductsByCategory(categoryId, limit = 5, offset = 0) {
  const safeLimit = Math.min(Math.max(Number(limit) || AUTORESPONDER_PRODUCT_PAGE_SIZE, 1), AUTORESPONDER_PRODUCT_RESPONSE_LIMIT);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const [rows] = await pool.query(
    `SELECT id, model_id, category_id, brand, name, sku, slug, price_retail, price_promo, stock_quantity, specs, custom_fields,
       warranty_type, warranty_template_id,
       (SELECT warranty_days FROM brands WHERE CAST(brands.id AS CHAR) = products.brand OR brands.name = products.brand LIMIT 1) AS brand_warranty_days,
       (SELECT warranty_days FROM categories WHERE categories.id = products.category_id LIMIT 1) AS category_warranty_days,
       JSON_UNQUOTE(JSON_EXTRACT(images, '$[0]')) AS imageUrl
     FROM products
     WHERE status = 'active'
       AND (is_parent = 0 OR is_parent IS NULL)
       AND stock_quantity > 0
       AND category_id = ?
     ORDER BY updated_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [categoryId]
  );
  return rows;
}

async function countAutoresponderProductsByCategory(categoryId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM products
     WHERE status = 'active'
       AND (is_parent = 0 OR is_parent IS NULL)
       AND stock_quantity > 0
       AND category_id = ?`,
    [categoryId]
  );
  return Number(rows[0]?.total || 0);
}

async function countAutoresponderProductsByTag(tagId) {
  const numericTagId = Number(tagId);
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM products
     WHERE status = 'active'
       AND (is_parent = 0 OR is_parent IS NULL)
       AND stock_quantity > 0
       AND (
         JSON_CONTAINS(tag_ids, JSON_ARRAY(?))
         OR JSON_CONTAINS(tag_ids, JSON_ARRAY(CAST(? AS CHAR)))
       )`,
    [Number.isFinite(numericTagId) ? numericTagId : tagId, String(tagId)]
  );
  return Number(rows[0]?.total || 0);
}

function formatAutoresponderCurrency(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeAutoresponderPriceValue(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return amount / 100;
}

function getAutoresponderProductPrice(product) {
  const promoPrice = normalizeAutoresponderPriceValue(product?.price_promo);
  const retailPrice = normalizeAutoresponderPriceValue(product?.price_retail);
  return promoPrice > 0 ? promoPrice : retailPrice;
}

function getAutoresponderProductPriceCents(product) {
  return Math.round(getAutoresponderProductPrice(product) * 100);
}

function getAutoresponderProductGroupKey(product) {
  const groupId = product?.model_id || product?.id;
  return String(groupId || '').trim();
}

function formatAutoresponderPriceRange(products) {
  const prices = (Array.isArray(products) ? products : [])
    .map((product) => getAutoresponderProductPrice(product))
    .filter((price) => Number.isFinite(price) && price > 0);

  if (prices.length === 0) return formatAutoresponderCurrency(0);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  if (minPrice === maxPrice) return formatAutoresponderCurrency(minPrice);
  return `de ${formatAutoresponderCurrency(minPrice)} a ${formatAutoresponderCurrency(maxPrice)}`;
}

async function calculateAutoresponderMaxInstallment(priceCents, maxInstallments = 12) {
  const safePriceCents = Math.max(Math.round(Number(priceCents) || 0), 0);
  const safeMaxInstallments = Math.min(Math.max(Number(maxInstallments) || 12, 2), 24);
  if (safePriceCents <= 0) return null;

  try {
    const [rows] = await pool.query(
      `SELECT installments, applied_fee_pct
       FROM payment_fees
       WHERE channel = ?
         AND installments BETWEEN 2 AND ?
       ORDER BY installments DESC, applied_fee_pct ASC
       LIMIT 1`,
      ['presencial', safeMaxInstallments]
    );

    const fee = rows[0];
    if (!fee) return null;

    const installments = Number(fee.installments || 0);
    const appliedFeePct = Number(fee.applied_fee_pct || 0);
    if (!Number.isFinite(installments) || installments < 2) return null;

    const total = Math.round(priceCents * (1 + appliedFeePct / 100));
    return {
      installments,
      value: Math.round(total / installments),
      total,
      appliedFeePct,
    };
  } catch (err) {
    console.warn('[autoresponder] installment calculation skipped:', err.message);
    return null;
  }
}

function formatAutoresponderInstallmentLine(plan) {
  if (!plan?.installments || !plan?.value) return '';
  return `Parcelamento: ate ${plan.installments}x de ${formatAutoresponderCurrency(plan.value / 100)}`;
}

function getAutoresponderProductColor(product) {
  const specs = parsePublicJson(product?.specs, product?.specs || {}) || {};
  const customFields = parsePublicJson(product?.custom_fields, product?.custom_fields || {}) || {};
  const rawColor =
    specs.color ||
    specs.cor ||
    specs.colour ||
    customFields.color ||
    customFields.cor ||
    customFields.colour ||
    '';
  return String(rawColor || '').trim();
}

function getAutoresponderAvailableColors(products) {
  const colors = [];
  const seen = new Set();
  for (const product of Array.isArray(products) ? products : []) {
    if (!isAutoresponderProductAvailable(product)) continue;
    const color = getAutoresponderProductColor(product);
    if (!color) continue;
    const key = normalizeAutoresponderText(color);
    if (seen.has(key)) continue;
    seen.add(key);
    colors.push(color);
  }
  return colors;
}

function isAutoresponderProductAvailable(product) {
  return Number(product?.stock_quantity || 0) > 0;
}

function filterAutoresponderAvailableProducts(products) {
  return (Array.isArray(products) ? products : []).filter(isAutoresponderProductAvailable);
}

function formatAutoresponderUnavailableProductReply(keyword) {
  return 'No momento nao encontrei esse produto disponivel em estoque.\nPosso chamar um atendente para conferir uma alternativa parecida pra voce.';
}

function groupAutoresponderProductsByModel(products) {
  const groupsByKey = new Map();
  for (const product of filterAutoresponderAvailableProducts(products)) {
    const key = getAutoresponderProductGroupKey(product);
    if (!key) continue;
    if (!groupsByKey.has(key)) groupsByKey.set(key, []);
    groupsByKey.get(key).push(product);
  }

  return Array.from(groupsByKey.entries()).map(([key, items]) => {
    const representative = items.find((product) => Number(product?.stock_quantity || 0) > 0) || items[0];
    return {
      key,
      model_id: representative?.model_id || null,
      name: representative?.name || 'Produto',
      products: items,
      representative,
      count: items.length,
      stockQuantity: items.reduce((total, product) => total + Number(product?.stock_quantity || 0), 0),
      priceRange: formatAutoresponderPriceRange(items),
      colors: getAutoresponderAvailableColors(items),
    };
  });
}

function buildAutoresponderProductOptions(products) {
  return groupAutoresponderProductsByModel(filterAutoresponderAvailableProducts(products)).map((group) => {
    const product = group.representative;
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      imageUrl: getAutoresponderProductMainImage(product),
    };
  });
}

function parseAutoresponderProductImages(value) {
  const parsed = parsePublicJson(value, []);
  if (Array.isArray(parsed)) return parsed.filter(Boolean);
  return value ? [String(value)] : [];
}

function pickFirstAutoresponderProductImage(...values) {
  for (const value of values) {
    const [image] = parseAutoresponderProductImages(value);
    if (image) return String(image);
  }
  return null;
}

function isAutoresponderUsedProduct(product) {
  const condition = normalizeAutoresponderText(
    product?.condition || product?.product_condition || product?.status_condition || ''
  );
  return ['usado', 'used', 'seminovo', 'semi novo'].some((keyword) => condition.includes(keyword));
}

function getAutoresponderProductMainImage(product) {
  if (product?.imageUrl) return String(product.imageUrl);
  if (product?.image_url) return String(product.image_url);
  if (product?.main_image_url) return String(product.main_image_url);

  const isUsedProduct = isAutoresponderUsedProduct(product);
  if (isUsedProduct) {
    return pickFirstAutoresponderProductImage(
      product?.images,
      product?.custom_images,
      product?.customImages,
      product?.product_images,
      product?.productImages,
      product?.model_color_images,
      product?.modelColorImages
    );
  }

  return pickFirstAutoresponderProductImage(
    product?.model_color_images,
    product?.modelColorImages,
    product?.images,
    product?.custom_images,
    product?.customImages,
    product?.product_images,
    product?.productImages
  );
}

function shouldAutoresponderSendProductImages(settings) {
  return Number(settings?.send_product_images) === 1 && Number(settings?.max_images_per_response || 0) > 0;
}

function getAutoresponderProductUrl(product) {
  const slug = product?.slug || product?.id;
  return slug ? `https://www.mercadodovale.com.br/produto/${slug}` : null;
}

function getAutoresponderCatalogSearchUrl(keyword) {
  const query = String(keyword || '').trim();
  if (!query) return 'https://www.mercadodovale.com.br/catalog';
  return `https://www.mercadodovale.com.br/catalog?search=${encodeURIComponent(query)}`;
}

function formatAutoresponderPaginationSummary({ offset = 0, limit = AUTORESPONDER_PRODUCT_PAGE_SIZE, total = 0 } = {}) {
  const safeTotal = Math.max(Number(total) || 0, 0);
  if (safeTotal <= 0) return '';
  const safeLimit = Math.max(Number(limit) || AUTORESPONDER_PRODUCT_PAGE_SIZE, 1);
  const page = Math.floor(Math.max(Number(offset) || 0, 0) / safeLimit) + 1;
  return `Pagina ${page} - encontramos ${safeTotal} produtos relacionados.`;
}

function formatAutoresponderWarrantyPeriod(days) {
  const safeDays = Number(days || 0);
  if (!Number.isFinite(safeDays) || safeDays <= 0) return '';
  if (safeDays % 30 === 0) {
    const months = safeDays / 30;
    return months === 1 ? '1 mes' : `${months} meses`;
  }
  return safeDays === 1 ? '1 dia' : `${safeDays} dias`;
}

function formatAutoresponderProductWarrantyLine(product) {
  const productWarrantyType = String(product?.warranty_type || 'brand').toLowerCase();
  const brandName = String(product?.brand || '').trim();
  const brandPeriod = formatAutoresponderWarrantyPeriod(product?.brand_warranty_days);
  const categoryPeriod = formatAutoresponderWarrantyPeriod(product?.category_warranty_days);

  if (productWarrantyType === 'custom' || productWarrantyType === 'template' || product?.warranty_template_id) {
    return 'Garantia: conforme termo configurado neste produto.';
  }

  if (productWarrantyType === 'none' || productWarrantyType === 'sem_garantia') {
    return 'Garantia: consulte um atendente para confirmar a cobertura deste produto.';
  }

  if (productWarrantyType === 'category') {
    return `Garantia: ${categoryPeriod ? `${categoryPeriod} conforme configuracao deste produto` : 'conforme configuracao deste produto'}`;
  }

  if (productWarrantyType === 'store' || productWarrantyType === 'loja') {
    const period = categoryPeriod || brandPeriod;
    return `Garantia: ${period ? `${period} pela loja` : 'pela loja'}`;
  }

  if (productWarrantyType === 'brand' && brandName) {
    return `Garantia: ${brandPeriod ? `${brandPeriod} pela ${brandName}` : `pela ${brandName}`}`;
  }

  if (productWarrantyType === 'brand') {
    return `Garantia: ${brandPeriod ? `${brandPeriod} conforme marca configurada neste produto` : 'conforme marca configurada neste produto'}`;
  }

  return '';
}

function formatAutoresponderProductReplyInstructions(hasMore) {
  const lines = ['Responda com o numero da opcao ou com o nome/modelo do produto.'];
  if (hasMore) lines.push('Se quiser ver mais opcoes, digite "mais".');
  return lines.join('\n');
}

function chunkAutoresponderArray(items, size) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeSize = Math.max(Number(size) || 1, 1);
  const chunks = [];
  for (let index = 0; index < safeItems.length; index += safeSize) {
    chunks.push(safeItems.slice(index, index + safeSize));
  }
  return chunks;
}

function formatAutoresponderProReplies(messages) {
  return (Array.isArray(messages) ? messages : [messages])
    .map((message) => String(message || '').trim())
    .filter(Boolean)
    .slice(0, AUTORESPONDER_MAX_PRODUCT_REPLY_MESSAGES)
    .map((message, index) => ({
      message,
      delaySeconds: index * AUTORESPONDER_PRODUCT_REPLY_DELAY_SECONDS,
    }));
}

function formatAutoresponderReplies(replyMessages, settings, shouldPrefixGreeting) {
  const messages = (Array.isArray(replyMessages) ? replyMessages : [replyMessages])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (messages.length === 0) return [];
  return [
    formatAutoresponderReply(messages[0], settings, shouldPrefixGreeting),
    ...messages.slice(1),
  ];
}

function appendAutoresponderReplyFooter(replyMessages, footerText) {
  const messages = (Array.isArray(replyMessages) ? replyMessages : [replyMessages])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const footer = String(footerText || '').trim();
  if (messages.length === 0 || !footer) return messages;
  messages[messages.length - 1] = `${messages[messages.length - 1]}\n\n${footer}`;
  return messages;
}

function appendAutoresponderRuleAttachmentToReplies(replyMessages, rule) {
  const messages = (Array.isArray(replyMessages) ? replyMessages : [replyMessages])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (messages.length === 0) return messages;
  messages[messages.length - 1] = appendAutoresponderRuleAttachment(messages[messages.length - 1], rule);
  return messages;
}

async function formatAutoresponderProductCaption(product, group = null) {
  const priceText = group?.priceRange || formatAutoresponderCurrency(getAutoresponderProductPrice(product));
  const priceCents = getAutoresponderProductPriceCents(product);
  const installmentLine = formatAutoresponderInstallmentLine(
    await calculateAutoresponderMaxInstallment(priceCents)
  );
  const lines = [
    `*${product?.name || 'Produto'}*`,
    `Preco: ${priceText}`,
  ];
  if (installmentLine) lines.push(installmentLine);
  if (Array.isArray(group?.colors) && group.colors.length > 0) {
    lines.push(`Cores disponiveis: ${group.colors.join(', ')}`);
  }
  const url = getAutoresponderProductUrl(product);
  if (url) lines.push(`Link: ${url}`);
  return lines.join('\n');
}

async function formatAutoresponderProductSearchReply(products, keyword, settings = null, pagination = null) {
  return (await formatAutoresponderProductSearchReplies(products, keyword, settings, pagination)).join('\n\n');
}

async function formatAutoresponderProductSearchReplies(products, keyword, settings = null, pagination = null) {
  const safeProducts = Array.isArray(products) ? products : [];
  const availableProducts = filterAutoresponderAvailableProducts(safeProducts);
  if (safeProducts.length > 0 && availableProducts.length === 0) {
    return [formatAutoresponderUnavailableProductReply(keyword)];
  }
  if (safeProducts.length === 0) {
    return [formatAutoresponderProductListReply(safeProducts, keyword)];
  }

  const groupedProducts = groupAutoresponderProductsByModel(availableProducts);
  const total = pagination?.total || groupedProducts.length;
  const offset = Number(pagination?.offset || 0);
  const chunks = chunkAutoresponderArray(groupedProducts, AUTORESPONDER_PRODUCT_PAGE_SIZE)
    .slice(0, AUTORESPONDER_MAX_PRODUCT_REPLY_MESSAGES);
  const replies = chunks.map((chunk, chunkIndex) => {
    const firstNumber = offset + (chunkIndex * AUTORESPONDER_PRODUCT_PAGE_SIZE) + 1;
    const lastNumber = firstNumber + chunk.length - 1;
    const title = chunkIndex === 0
      ? (keyword
        ? `Encontrei ${total} produtos relacionados para ${keyword}. Vou enviar de ${AUTORESPONDER_PRODUCT_PAGE_SIZE} em ${AUTORESPONDER_PRODUCT_PAGE_SIZE}:`
        : `Encontrei ${total} produtos relacionados. Vou enviar de ${AUTORESPONDER_PRODUCT_PAGE_SIZE} em ${AUTORESPONDER_PRODUCT_PAGE_SIZE}:`)
      : `Mais opcoes (${firstNumber}-${lastNumber} de ${total}):`;
    const lines = [title];
    lines.push(...chunk.map((group, index) => {
      const colorText = Array.isArray(group.colors) && group.colors.length > 0
        ? `\nCores disponiveis: ${group.colors.join(', ')}`
        : '';
      return `${firstNumber + index}. ${group.name}\nPreco: ${group.priceRange}${colorText}`;
    }));
    return lines.join('\n\n');
  });

  if (groupedProducts.length > 1 || safeProducts.length > groupedProducts.length) {
    replies[replies.length - 1] = `${replies[replies.length - 1]}\n\nVer busca no site: ${getAutoresponderCatalogSearchUrl(keyword)}`;
  }
  const paginationSummary = formatAutoresponderPaginationSummary({
    offset,
    limit: pagination?.limit || AUTORESPONDER_PRODUCT_RESPONSE_LIMIT,
    total,
  });
  if (paginationSummary) {
    replies[replies.length - 1] = `${replies[replies.length - 1]}\n\n${paginationSummary}`;
  }

  return replies;
}

function formatAutoresponderProductListReply(products, keyword) {
  const safeProducts = Array.isArray(products) ? products : [];
  const availableProducts = filterAutoresponderAvailableProducts(safeProducts);
  if (safeProducts.length > 0 && availableProducts.length === 0) {
    return formatAutoresponderUnavailableProductReply(keyword);
  }
  if (safeProducts.length === 0) {
    return `Nao encontrei produtos ativos para "${keyword}".`;
  }

  const title = keyword
    ? `Encontrei estas opcoes para ${keyword}:`
    : 'Encontrei estas opcoes:';
  const lines = groupAutoresponderProductsByModel(availableProducts).map((group, index) => {
    const colorText = Array.isArray(group.colors) && group.colors.length > 0
      ? ` (${group.colors.join(', ')})`
      : '';
    return `${index + 1}. ${group.name} - ${group.priceRange}${colorText}`;
  });

  return `${title}\n${lines.join('\n')}`;
}

function getAutoresponderNumberedChoice(message) {
  const match = String(message || '').trim().match(/^(\d{1,2})$/);
  if (!match) return null;
  const choice = Number(match[1]);
  return Number.isInteger(choice) && choice > 0 ? choice : null;
}

function detectAutoresponderIntent(message) {
  return {
    greeting: isAutoresponderGreeting(message),
    greetingOnly: isAutoresponderGreetingOnly(message),
    humanRequest: isAutoresponderHumanRequest(message),
    warrantyRequest: isAutoresponderWarrantyRequest(message),
    numberedChoice: getAutoresponderNumberedChoice(message),
    moreRequest: isAutoresponderMoreRequest(message),
  };
}

async function getAutoresponderNumberedChoiceContext(sender, validityMinutes) {
  const context = await getAutoresponderOptionsContext(sender, validityMinutes);
  return context.items;
}

async function findAutoresponderProductById(productId) {
  const [rows] = await pool.query(
    `SELECT id, model_id, category_id, brand, name, sku, slug, price_retail, price_promo, stock_quantity, specs, custom_fields,
       warranty_type, warranty_template_id,
       (SELECT warranty_days FROM brands WHERE CAST(brands.id AS CHAR) = products.brand OR brands.name = products.brand LIMIT 1) AS brand_warranty_days,
       (SELECT warranty_days FROM categories WHERE categories.id = products.category_id LIMIT 1) AS category_warranty_days,
       JSON_UNQUOTE(JSON_EXTRACT(images, '$[0]')) AS imageUrl
     FROM products
     WHERE id = ?
     LIMIT 1`,
    [productId]
  );
  return rows[0] || null;
}

async function formatAutoresponderProductDetailReply(product, settings = null) {
  if (!product) {
    return 'Nao encontrei os detalhes desse produto agora.';
  }
  if (!isAutoresponderProductAvailable(product)) {
    return formatAutoresponderUnavailableProductReply(product.name);
  }

  const price = getAutoresponderProductPrice(product);
  const lines = [
    product.name,
    `Preco: ${formatAutoresponderCurrency(price)}`,
  ];
  if (product.sku) lines.push(`SKU: ${product.sku}`);

  const installmentLine = formatAutoresponderInstallmentLine(
    await calculateAutoresponderMaxInstallment(getAutoresponderProductPriceCents(product))
  );
  if (installmentLine) lines.push(installmentLine);

  const warrantyLine = formatAutoresponderProductWarrantyLine(product);
  if (warrantyLine) lines.push(warrantyLine);

  if (product.slug) {
    lines.push(`Link: ${getAutoresponderProductUrl(product)}`);
  }

  if (shouldAutoresponderSendProductImages(settings)) {
    const imageUrl = getAutoresponderProductMainImage(product);
    if (imageUrl) lines.push(`Imagem: ${imageUrl}`);
  }

  return lines.join('\n');
}

const AUTORESPONDER_WARRANTY_SEARCH_STOPWORDS = new Set([
  'a', 'as', 'o', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'da', 'das', 'do', 'dos', 'e', 'ou', 'para', 'pra', 'pro',
  'com', 'sem', 'por', 'no', 'na', 'nos', 'nas',
  'qual', 'quais', 'quanto', 'quantos', 'quantas', 'tempo', 'prazo',
  'tem', 'ter', 'tens', 'voces', 'voce', 'vc', 'produto', 'produtos',
  'garantia', 'garantias', 'garantido', 'defeito', 'defeitos', 'cobertura', 'assistencia',
]);

function extractAutoresponderWarrantySearchTokens(message) {
  const text = normalizeAutoresponderText(message)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return [...new Set(text.split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !AUTORESPONDER_WARRANTY_SEARCH_STOPWORDS.has(token))
    .slice(0, 6))];
}

function formatAutoresponderWarrantyRefinementReply(options = []) {
  const optionHint = Array.isArray(options) && options.length > 0
    ? '\nSe for um dos itens da lista, responda o numero dele.'
    : '';
  return `Para te passar a garantia certinha, me diga a marca ou o produto. Exemplo: "garantia Samsung" ou "garantia do Redmi Note 14".${optionHint}`;
}

async function handleAutoresponderWarrantyRequest({ sender, message, settings, purchaseFlow, shouldPrefixGreeting }) {
  const tokens = extractAutoresponderWarrantySearchTokens(message);

  if (tokens.length === 0 && purchaseFlow?.selected_product?.id) {
    const product = await findAutoresponderProductById(purchaseFlow.selected_product.id);
    const selectedProduct = product || purchaseFlow.selected_product;
    const warrantyLine = formatAutoresponderProductWarrantyLine(selectedProduct)
      || 'Garantia: me diga a marca ou o modelo para eu confirmar certinho.';
    const replyText = formatAutoresponderReply(
      `${selectedProduct?.name || 'Produto selecionado'}\n${warrantyLine}`,
      settings,
      false
    );
    await logAutoresponderReply({
      sender,
      message,
      intent: 'warranty_request',
      replyText,
      matchedCount: product ? 1 : 0,
      matchedProducts: [selectedProduct],
    });
    await upsertAutoresponderSuccessConversation(sender);
    return { replies: [{ message: replyText }] };
  }

  if (tokens.length > 0) {
    const pageSize = AUTORESPONDER_PRODUCT_RESPONSE_LIMIT;
    const rows = await findAutoresponderProductsByTokens(tokens, pageSize + 1);
    const products = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;

    if (products.length === 1) {
      const product = products[0];
      const warrantyLine = formatAutoresponderProductWarrantyLine(product)
        || 'Garantia: consulte um atendente para confirmar a cobertura deste produto.';
      const replyText = formatAutoresponderReply(`${product.name}\n${warrantyLine}`, settings, shouldPrefixGreeting);
      await logAutoresponderReply({
        sender,
        message,
        intent: 'warranty_request',
        replyText,
        matchedCount: 1,
        matchedProducts: [product],
      });
      await upsertAutoresponderSuccessConversation(sender);
      return { replies: [{ message: replyText }] };
    }

    if (products.length > 1) {
      const total = await countAutoresponderProductsByTokens(tokens);
      const productOptions = buildAutoresponderProductOptions(products);
      const productReplyMessages = appendAutoresponderReplyFooter(
        await formatAutoresponderProductSearchReplies(products, tokens.join(' '), settings, { offset: 0, limit: pageSize, total }),
        `${formatAutoresponderWarrantyRefinementReply(productOptions)}${hasMore ? '\nTambem posso mostrar mais opcoes se voce responder "mais".' : ''}`
      );
      const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
      const replyText = replyMessages.join('\n\n');

      await logAutoresponderReply({
        sender,
        message,
        intent: 'warranty_refine',
        replyText,
        matchedCount: products.length,
        matchedProducts: productOptions,
      });
      await upsertAutoresponderOptionsConversation(sender, productOptions, {
        source: 'search',
        tokens,
        offset: 0,
        limit: pageSize,
        total,
        hasMore,
      });

      return { replies: formatAutoresponderProReplies(replyMessages) };
    }
  }

  const context = await getAutoresponderOptionsContext(sender, Number(settings?.numbered_list_validity_minutes) || 30);
  const replyText = formatAutoresponderReply(
    formatAutoresponderWarrantyRefinementReply(context.items),
    settings,
    shouldPrefixGreeting
  );
  await logAutoresponderReply({
    sender,
    message,
    intent: 'warranty_refine',
    replyText,
    matchedCount: 0,
  });
  await upsertAutoresponderSuccessConversation(sender);
  return { replies: [{ message: replyText }] };
}

const AUTORESPONDER_PRODUCT_SEARCH_STOPWORDS = new Set([
  'a', 'as', 'o', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'da', 'das', 'do', 'dos', 'e', 'ou', 'para', 'pra', 'pro',
  'com', 'sem', 'por', 'no', 'na', 'nos', 'nas',
  'tem', 'ter', 'tens', 'voces', 'voce', 'vc', 'quero', 'queria',
  'preciso', 'procuro', 'ver', 'verificar', 'valor', 'preco', 'quanto',
  'produto', 'produtos', 'catalogo', 'lista', 'vende', 'vendem',
]);

function extractAutoresponderProductSearchTokens(message) {
  const text = normalizeAutoresponderText(message)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return [...new Set(text.split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !AUTORESPONDER_PRODUCT_SEARCH_STOPWORDS.has(token))
    .slice(0, 6))];
}

function buildAutoresponderProductSearchScoreSql(tokens) {
  const parts = [];
  const params = [];
  for (const token of Array.isArray(tokens) ? tokens : []) {
    const safeToken = normalizeAutoresponderText(token).trim();
    if (!safeToken) continue;
    parts.push(`CASE
      WHEN LOWER(COALESCE(sku, '')) = ? THEN 100
      WHEN LOWER(COALESCE(name, '')) LIKE ? THEN 60
      WHEN LOWER(COALESCE(name, '')) LIKE ? THEN 45
      WHEN LOWER(COALESCE(brand, '')) LIKE ? THEN 30
      WHEN LOWER(COALESCE(CAST(specs AS CHAR), '')) LIKE ? THEN 20
      WHEN LOWER(COALESCE(CAST(custom_fields AS CHAR), '')) LIKE ? THEN 15
      ELSE 0
    END`);
    params.push(
      safeToken,
      `${safeToken}%`,
      `%${safeToken}%`,
      `%${safeToken}%`,
      `%${safeToken}%`,
      `%${safeToken}%`
    );
  }
  return {
    sql: parts.length > 0 ? parts.join(' + ') : '0',
    params,
  };
}

async function findAutoresponderProductsByTokens(tokens, limit = 5, offset = 0) {
  const safeTokens = Array.isArray(tokens) ? tokens.slice(0, 6) : [];
  if (safeTokens.length === 0) return [];

  const safeLimit = Math.min(Math.max(Number(limit) || AUTORESPONDER_PRODUCT_PAGE_SIZE, 1), AUTORESPONDER_PRODUCT_RESPONSE_LIMIT);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const clauses = safeTokens.map(() => `(LOWER(COALESCE(name, '')) LIKE ?
    OR LOWER(COALESCE(sku, '')) LIKE ?
    OR LOWER(COALESCE(brand, '')) LIKE ?
    OR LOWER(COALESCE(CAST(specs AS CHAR), '')) LIKE ?
    OR LOWER(COALESCE(CAST(custom_fields AS CHAR), '')) LIKE ?)`);
  const whereParams = [];
  for (const token of safeTokens) {
    const like = `%${normalizeAutoresponderText(token).trim()}%`;
    whereParams.push(like, like, like, like, like);
  }
  const score = buildAutoresponderProductSearchScoreSql(safeTokens);

  const [rows] = await pool.query(
    `SELECT id, model_id, category_id, brand, name, sku, slug, price_retail, price_promo, stock_quantity, specs, custom_fields,
       warranty_type, warranty_template_id,
       (SELECT warranty_days FROM brands WHERE CAST(brands.id AS CHAR) = products.brand OR brands.name = products.brand LIMIT 1) AS brand_warranty_days,
       (SELECT warranty_days FROM categories WHERE categories.id = products.category_id LIMIT 1) AS category_warranty_days,
       JSON_UNQUOTE(JSON_EXTRACT(images, '$[0]')) AS imageUrl,
       (${score.sql}) AS search_score
     FROM products
     WHERE status = 'active'
       AND (is_parent = 0 OR is_parent IS NULL)
       AND ${clauses.join(' AND ')}
     ORDER BY stock_quantity > 0 DESC, search_score DESC, updated_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [...score.params, ...whereParams]
  );
  return rows;
}

async function countAutoresponderProductsByTokens(tokens) {
  const safeTokens = Array.isArray(tokens) ? tokens.slice(0, 6) : [];
  if (safeTokens.length === 0) return 0;

  const clauses = safeTokens.map(() => `(LOWER(COALESCE(name, '')) LIKE ?
    OR LOWER(COALESCE(sku, '')) LIKE ?
    OR LOWER(COALESCE(brand, '')) LIKE ?
    OR LOWER(COALESCE(CAST(specs AS CHAR), '')) LIKE ?
    OR LOWER(COALESCE(CAST(custom_fields AS CHAR), '')) LIKE ?)`);
  const params = [];
  for (const token of safeTokens) {
    const like = `%${normalizeAutoresponderText(token).trim()}%`;
    params.push(like, like, like, like, like);
  }

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM products
     WHERE status = 'active'
       AND (is_parent = 0 OR is_parent IS NULL)
       AND stock_quantity > 0
       AND ${clauses.join(' AND ')}`,
    params
  );
  return Number(rows[0]?.total || 0);
}

async function getAutoresponderFallbackState(sender) {
  const [rows] = await pool.query(
    'SELECT consecutive_fallbacks FROM autoresponder_conversations WHERE sender = ? LIMIT 1',
    [sender]
  );
  return {
    consecutiveFallbacks: Number(rows[0]?.consecutive_fallbacks || 0),
  };
}

function getAutoresponderFallbackReply(settings, nextFallbackCount) {
  const threshold = Number(settings?.auto_pause_fallback_threshold) > 0
    ? Number(settings.auto_pause_fallback_threshold)
    : 3;
  const shouldAutoPause = nextFallbackCount >= threshold;
  const replyText = shouldAutoPause
    ? (settings?.auto_pause_fallback_message || settings?.fallback_message || AUTORESPONDER_DEFAULT_AUTO_PAUSE_MESSAGE)
    : (settings?.fallback_message || AUTORESPONDER_DEFAULT_FALLBACK_MESSAGE);

  return { replyText, shouldAutoPause };
}

async function logAutoresponderReply({
  sender,
  message,
  intent,
  replyText,
  matchedCount = 0,
  matchedRuleId = null,
  matchedProducts = null,
}) {
  await pool.query(
    `INSERT INTO autoresponder_logs
      (sender, question, intent, matched_rule_id, matched_products, matched_count, reply_text, response_time_ms, is_group)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sender,
      message || null,
      intent,
      matchedRuleId,
      matchedProducts == null ? null : jsonStr(matchedProducts),
      matchedCount,
      replyText,
      0,
      0,
    ]
  );
}

async function upsertAutoresponderSuccessConversation(sender) {
  await pool.query(
    `INSERT INTO autoresponder_conversations (sender, last_message_at, last_bot_reply_at, total_messages, consecutive_fallbacks)
     VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, 0)
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       last_bot_reply_at = CURRENT_TIMESTAMP,
       total_messages = total_messages + 1,
       consecutive_fallbacks = 0`,
    [sender]
  );
}

async function upsertAutoresponderOptionsConversation(sender, options, pagination = null) {
  const optionsJson = jsonStr(buildAutoresponderOptionsContext(options, pagination));
  await pool.query(
    `INSERT INTO autoresponder_conversations
      (sender, last_message_at, last_bot_reply_at, total_messages, consecutive_fallbacks, last_options_offered, last_options_at)
     VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, 0, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       last_bot_reply_at = CURRENT_TIMESTAMP,
       total_messages = total_messages + 1,
       consecutive_fallbacks = 0,
       last_options_offered = ?,
       last_options_at = CURRENT_TIMESTAMP`,
    [sender, optionsJson, optionsJson]
  );
}

async function applyAutoresponderRuleConversationTag(sender, tagId) {
  const numericTagId = Number(tagId);
  if (!Number.isFinite(numericTagId) || numericTagId <= 0) return;

  const [rows] = await pool.query(
    'SELECT tag_ids FROM autoresponder_conversations WHERE sender = ? LIMIT 1',
    [sender]
  );
  const existingTags = parsePublicJson(rows[0]?.tag_ids, []);
  const tags = Array.isArray(existingTags) ? existingTags.map(Number).filter(Number.isFinite) : [];
  if (!tags.includes(numericTagId)) tags.push(numericTagId);

  await pool.query(
    'UPDATE autoresponder_conversations SET tag_ids = ? WHERE sender = ?',
    [jsonStr(tags), sender]
  );
}

const DEFAULT_AUTORESPONDER_HOURS = {
  monday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
  tuesday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
  wednesday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
  thursday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
  friday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:30' },
  saturday: { isOpen: true, openTime: '08:00', closeTime: '12:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:30' },
  sunday: { isOpen: false, openTime: '08:00', closeTime: '12:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:30' },
};

const AUTORESPONDER_DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getSaoPauloDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dateString = `${map.year}-${map.month}-${map.day}`;
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday);

  return {
    dateString,
    weekdayIndex: weekdayIndex >= 0 ? weekdayIndex : date.getDay(),
    currentTimeMinutes: Number(map.hour) * 60 + Number(map.minute),
  };
}

function parseAutoresponderTimeToMinutes(value, fallback) {
  const [hour, minute] = String(value || fallback).split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return parseAutoresponderTimeToMinutes(fallback, '00:00');
  }
  return hour * 60 + minute;
}

function formatAutoresponderDateUtc(date) {
  return date.toISOString().slice(0, 10);
}

function addDaysUtc(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function getBrazilianEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function getAutoresponderBrazilNationalHoliday(dateString) {
  const year = Number(dateString.slice(0, 4));
  if (!Number.isFinite(year)) return null;

  const fixedHolidays = {
    [`${year}-01-01`]: 'Confraternizacao Universal',
    [`${year}-04-21`]: 'Tiradentes',
    [`${year}-05-01`]: 'Dia do Trabalhador',
    [`${year}-09-07`]: 'Independencia do Brasil',
    [`${year}-10-12`]: 'Nossa Senhora Aparecida',
    [`${year}-11-02`]: 'Finados',
    [`${year}-11-15`]: 'Proclamacao da Republica',
    [`${year}-12-25`]: 'Natal',
  };
  if (fixedHolidays[dateString]) {
    return { date: dateString, name: fixedHolidays[dateString], type: 'national' };
  }

  const easter = getBrazilianEasterDate(year);
  const movableHolidays = {
    [formatAutoresponderDateUtc(addDaysUtc(easter, -48))]: 'Carnaval',
    [formatAutoresponderDateUtc(addDaysUtc(easter, -47))]: 'Carnaval',
    [formatAutoresponderDateUtc(addDaysUtc(easter, -2))]: 'Sexta-feira Santa',
    [formatAutoresponderDateUtc(addDaysUtc(easter, 60))]: 'Corpus Christi',
  };
  if (movableHolidays[dateString]) {
    return { date: dateString, name: movableHolidays[dateString], type: 'national' };
  }

  return null;
}

function getAutoresponderStoreStatus(companySettingsRow, now = new Date()) {
  const businessHours = parsePublicJson(companySettingsRow?.business_hours, DEFAULT_AUTORESPONDER_HOURS) || DEFAULT_AUTORESPONDER_HOURS;
  const holidayOverrides = parsePublicJson(companySettingsRow?.holiday_overrides, []) || [];
  const localHolidays = parsePublicJson(companySettingsRow?.local_holidays, []) || [];
  const { dateString, weekdayIndex, currentTimeMinutes } = getSaoPauloDateParts(now);

  if (localHolidays.some((holiday) => holiday?.date === dateString)) {
    return { status: 'holiday' };
  }

  const nationalHoliday = getAutoresponderBrazilNationalHoliday(dateString);
  if (nationalHoliday && !holidayOverrides.includes(dateString)) {
    return { status: 'holiday', holiday: nationalHoliday, message: nationalHoliday.name };
  }

  const dayName = AUTORESPONDER_DAYS_OF_WEEK[weekdayIndex] || 'sunday';
  const todaySchedule = { ...DEFAULT_AUTORESPONDER_HOURS[dayName], ...(businessHours[dayName] || {}) };

  if (!todaySchedule.isOpen) {
    return { status: 'closed' };
  }

  const openTimeMinutes = parseAutoresponderTimeToMinutes(todaySchedule.openTime, '08:00');
  const closeTimeMinutes = parseAutoresponderTimeToMinutes(todaySchedule.closeTime, '18:00');

  if (todaySchedule.hasLunchBreak && todaySchedule.lunchStart && todaySchedule.lunchEnd) {
    const lunchStartMinutes = parseAutoresponderTimeToMinutes(todaySchedule.lunchStart, '12:00');
    const lunchEndMinutes = parseAutoresponderTimeToMinutes(todaySchedule.lunchEnd, '13:30');
    if (currentTimeMinutes >= lunchStartMinutes && currentTimeMinutes < lunchEndMinutes) {
      return { status: 'closed' };
    }
  }

  if (currentTimeMinutes >= openTimeMinutes && currentTimeMinutes < closeTimeMinutes) {
    return { status: closeTimeMinutes - currentTimeMinutes <= 30 ? 'closing_soon' : 'open' };
  }

  return { status: 'closed' };
}

function isAutoresponderStoreInHumanHours(storeStatus) {
  return storeStatus?.status === 'open' || storeStatus?.status === 'closing_soon';
}

const AUTORESPONDER_STORE_STATUS_CACHE_TTL_MS = 60 * 1000;
let autoresponderStoreStatusCache = null;

function clearAutoresponderStoreStatusCache() {
  autoresponderStoreStatusCache = null;
}

async function getCachedAutoresponderStoreStatus() {
  const nowMs = Date.now();
  if (
    autoresponderStoreStatusCache
    && autoresponderStoreStatusCache.expiresAt > nowMs
  ) {
    return autoresponderStoreStatusCache.value;
  }

  const [companyRows] = await pool.query(
    'SELECT business_hours, holiday_overrides, local_holidays FROM company_settings LIMIT 1'
  );
  const value = getAutoresponderStoreStatus(companyRows[0] || null);
  autoresponderStoreStatusCache = {
    value,
    expiresAt: nowMs + AUTORESPONDER_STORE_STATUS_CACHE_TTL_MS,
  };
  return value;
}

async function getAutoresponderReplyCount(sender, windowHours) {
  const hours = Number(windowHours) > 0 ? Number(windowHours) : 24;
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM autoresponder_logs
     WHERE sender = ?
       AND reply_text IS NOT NULL
       AND reply_text <> ''
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [sender, hours]
  );
  return Number(rows[0]?.total || 0);
}

async function touchAutoresponderConversation(sender) {
  await pool.query(
    `INSERT INTO autoresponder_conversations (sender, last_message_at, total_messages)
     VALUES (?, CURRENT_TIMESTAMP, 1)
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       total_messages = total_messages + 1`,
    [sender]
  );
}

async function isAutoresponderBlocked(sender) {
  const rawSender = String(sender || '').trim();
  const normalizedSender = normalizeAutoresponderSender(rawSender);
  if (!rawSender && !normalizedSender) return false;

  const [rows] = await pool.query(
    'SELECT pattern, pattern_type FROM autoresponder_blocklist WHERE active = 1'
  );

  for (const row of rows) {
    const pattern = String(row.pattern || '').trim();
    if (!pattern) continue;

    const patternType = String(row.pattern_type || 'exact').toLowerCase();
    const normalizedPattern = normalizeAutoresponderSender(pattern);

    if (patternType === 'regex') {
      try {
        if (new RegExp(pattern).test(rawSender)) return true;
      } catch (err) {
        console.warn('[autoresponder] invalid blocklist regex ignored:', err.message);
      }
      continue;
    }

    if (patternType === 'prefix') {
      if (normalizedPattern && normalizedSender.startsWith(normalizedPattern)) return true;
      if (rawSender.startsWith(pattern)) return true;
      continue;
    }

    if ((normalizedPattern && normalizedSender === normalizedPattern) || rawSender === pattern) {
      return true;
    }
  }

  return false;
}

function parsePublicJson(v, fallback) {
  if (v == null || v === '') return fallback;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function buildPublicCompanyAddress(row) {
  if (row.address) return String(row.address);

  const parts = [];
  if (row.address_street) parts.push(`${row.address_street}, ${row.address_number || 'S/N'}`);
  if (row.address_complement) parts.push(row.address_complement);
  if (row.address_neighborhood) parts.push(row.address_neighborhood);

  const cityState = [row.address_city, row.address_state].filter(Boolean).join(' - ');
  if (cityState) parts.push(cityState);
  if (row.address_zip_code) parts.push(`CEP: ${row.address_zip_code}`);

  return parts.filter(Boolean).join(' - ');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function sanitizePublicCompanySettings(row) {
  if (!row) return null;

  const companyName = row.company_name || row.name || 'Mercado do Vale';

  return {
    id: row.id || undefined,
    company_name: companyName,
    name: row.name || companyName,
    razao_social: row.razao_social || null,
    cnpj: row.cnpj || null,
    data_abertura: row.data_abertura || null,
    phone: row.phone || null,
    email: row.email || null,
    logo: row.logo || null,
    receipt_logo_url: row.receipt_logo_url || null,
    favicon: row.favicon || null,
    address: buildPublicCompanyAddress(row),
    address_zip_code: row.address_zip_code || null,
    address_street: row.address_street || null,
    address_number: row.address_number || null,
    address_complement: row.address_complement || null,
    address_neighborhood: row.address_neighborhood || null,
    address_city: row.address_city || null,
    address_state: row.address_state || null,
    address_lat: row.address_lat ?? null,
    address_lng: row.address_lng ?? null,
    social_instagram: row.social_instagram || null,
    social_facebook: row.social_facebook || null,
    social_youtube: row.social_youtube || null,
    social_website: row.social_website || null,
    google_reviews_link: row.google_reviews_link || null,
    google_analytics_id: row.google_analytics_id || null,
    pix_discount_percentage: row.pix_discount_percentage == null ? null : Number(row.pix_discount_percentage),
    business_hours: parsePublicJson(row.business_hours, null),
    holiday_overrides: parsePublicJson(row.holiday_overrides, []),
    local_holidays: parsePublicJson(row.local_holidays, []),
    business_hours_display_text: row.business_hours_display_text || null,
    store_label_open: row.store_label_open || null,
    store_label_closed: row.store_label_closed || null,
    store_label_closing_soon: row.store_label_closing_soon || null,
    store_label_lunch: row.store_label_lunch || null,
    extended_warranty_options: parsePublicJson(row.extended_warranty_options, []),
    extended_warranty_terms_text: row.extended_warranty_terms_text || null,
    synology_video_base_url: row.synology_video_base_url || null,
    synology_video_extension: row.synology_video_extension || '.mp4',
    description: row.description || null,
    catalog_footer_text: row.catalog_footer_text || null,
    about_us_text: row.about_us_text || null,
    about_us_image_url: row.about_us_image_url || null,
    maintenance_mode: row.maintenance_mode === 1 || row.maintenance_mode === true,
    maintenance_message: row.maintenance_message || null,
    maintenance_bypass_hash: row.maintenance_bypass_key ? sha256Hex(row.maintenance_bypass_key) : null,
    updated_at: row.updated_at || null,
  };
}

// ─── Health ────────────────────────────────────────────────────────────────
fastify.get('/health', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  db: 'mysql'
}));

// ─── Upload de imagem de produto ───────────────────────────────────────────
// ─── AutoResponder WhatsApp (Fase 1A/1B) ─────────────────────────────────────
fastify.get('/autoresponder/settings', { preHandler: requireSyncKey }, async () => {
  const [rows] = await pool.query('SELECT * FROM autoresponder_settings WHERE id = 1 LIMIT 1');
  return rows[0] || null;
});

fastify.patch('/autoresponder/settings', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  const allowed = {
    enabled: (v) => boolInt(v),
    human_message_in_hours: (v) => String(v ?? ''),
    human_message_out_of_hours: (v) => String(v ?? ''),
    human_pause_minutes: (v) => Number(v),
    auto_pause_fallback_threshold: (v) => Number(v),
    auto_pause_fallback_minutes: (v) => Number(v),
    auto_pause_fallback_message: (v) => String(v ?? ''),
    max_replies_per_conversation: (v) => Number(v),
    max_replies_window_hours: (v) => Number(v),
    greeting_prefix: (v) => String(v ?? ''),
    fallback_message: (v) => String(v ?? ''),
    send_product_images: (v) => boolInt(v),
    max_images_per_response: (v) => Number(v),
    use_numbered_lists: (v) => boolInt(v),
    numbered_list_threshold: (v) => Number(v),
    numbered_list_validity_minutes: (v) => Number(v),
    product_tag_keywords: (v) => jsonStr(v || {}),
    archive_to_synology: (v) => boolInt(v),
    archive_after_days: (v) => Number(v),
  };

  const sets = [];
  const values = [];
  for (const [key, normalize] of Object.entries(allowed)) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const value = normalize(body[key]);
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return reply.code(400).send({ error: `Invalid numeric value for ${key}` });
    }
    sets.push(`${key} = ?`);
    values.push(value);
  }

  if (sets.length === 0) {
    return reply.code(400).send({ error: 'No valid settings fields provided' });
  }

  values.push(1);
  await pool.query(`UPDATE autoresponder_settings SET ${sets.join(', ')} WHERE id = ?`, values);
  const [rows] = await pool.query('SELECT * FROM autoresponder_settings WHERE id = 1 LIMIT 1');
  return rows[0] || null;
});

function buildAutoresponderUpdateSet(body, allowed) {
  const sets = [];
  const values = [];
  for (const [key, normalize] of Object.entries(allowed)) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const value = normalize(body[key]);
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return { error: `Invalid numeric value for ${key}` };
    }
    sets.push(`${key} = ?`);
    values.push(value);
  }
  return { sets, values };
}

const autoresponderRuleFields = {
  name: (v) => String(v ?? ''),
  match_type: (v) => String(v ?? 'any_keyword'),
  pattern: (v) => String(v ?? ''),
  reply_type: (v) => String(v ?? 'text'),
  reply_text: (v) => String(v ?? ''),
  reply_tag_id: (v) => v == null || v === '' ? null : Number(v),
  reply_search_query: (v) => v == null ? null : String(v),
  attachment_url: (v) => v == null ? null : String(v),
  attachment_caption: (v) => v == null ? null : String(v),
  auto_apply_tag_id: (v) => v == null || v === '' ? null : Number(v),
  tag_ids: (v) => jsonStr(v || []),
  priority: (v) => Number(v || 0),
  active: (v) => boolInt(v),
};

fastify.get('/autoresponder/rules', { preHandler: requireSyncKey }, async (req) => {
  const active = req.query.active;
  const tagId = req.query.tag_id;
  let sql = 'SELECT * FROM autoresponder_rules WHERE 1=1';
  const params = [];
  if (active != null) {
    sql += ' AND active = ?';
    params.push(boolInt(active === 'true' || active === '1' || active === true));
  }
  if (tagId) {
    sql += ' AND JSON_CONTAINS(tag_ids, JSON_ARRAY(?))';
    params.push(Number(tagId));
  }
  sql += ' ORDER BY priority DESC, id ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
});

fastify.post('/autoresponder/rules', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  if (!body.name || !body.pattern) {
    return reply.code(400).send({ error: 'name and pattern are required' });
  }
  const columns = Object.keys(autoresponderRuleFields).filter((key) => Object.prototype.hasOwnProperty.call(body, key));
  const values = columns.map((key) => autoresponderRuleFields[key](body[key]));
  await pool.query(
    `INSERT INTO autoresponder_rules (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    values
  );
  const [rows] = await pool.query('SELECT * FROM autoresponder_rules WHERE id = LAST_INSERT_ID()');
  return rows[0];
});

fastify.patch('/autoresponder/rules/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  const built = buildAutoresponderUpdateSet(body, autoresponderRuleFields);
  if (built.error) return reply.code(400).send({ error: built.error });
  if (built.sets.length === 0) return reply.code(400).send({ error: 'No valid rule fields provided' });
  built.values.push(req.params.id);
  await pool.query(`UPDATE autoresponder_rules SET ${built.sets.join(', ')} WHERE id = ?`, built.values);
  const [rows] = await pool.query('SELECT * FROM autoresponder_rules WHERE id = ?', [req.params.id]);
  return rows[0] || null;
});

fastify.delete('/autoresponder/rules/:id', { preHandler: requireSyncKey }, async (req) => {
  await pool.query('DELETE FROM autoresponder_rules WHERE id = ?', [req.params.id]);
  return { ok: true };
});

fastify.post('/autoresponder/rules/from-question', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  const logId = body.log_id;
  let question = String(body.question || '').trim();
  if (logId && !question) {
    const [rows] = await pool.query('SELECT question FROM autoresponder_logs WHERE id = ?', [logId]);
    question = String(rows[0]?.question || '').trim();
  }
  if (!question) return reply.code(400).send({ error: 'question or log_id is required' });

  const ruleBody = {
    name: body.name || `Curadoria: ${question.slice(0, 60)}`,
    match_type: body.match_type || 'exact',
    pattern: body.pattern || question,
    reply_type: 'text',
    reply_text: body.reply_text || '',
    priority: body.priority == null ? 0 : Number(body.priority),
    active: body.active == null ? 0 : boolInt(body.active),
    tag_ids: body.tag_ids || [],
  };
  const columns = Object.keys(autoresponderRuleFields).filter((key) => Object.prototype.hasOwnProperty.call(ruleBody, key));
  const values = columns.map((key) => autoresponderRuleFields[key](ruleBody[key]));
  await pool.query(
    `INSERT INTO autoresponder_rules (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    values
  );
  const [rows] = await pool.query('SELECT * FROM autoresponder_rules WHERE id = LAST_INSERT_ID()');
  return rows[0];
});

fastify.post('/autoresponder/upload-attachment', { preHandler: requireSyncKey }, async (req, reply) => {
  const data = await req.file();
  if (!data) return reply.code(400).send({ error: 'file is required' });

  const chunks = [];
  for await (const chunk of data.file) chunks.push(chunk);
  const fileBuf = Buffer.concat(chunks);
  const filename = safeAutoresponderAttachmentFilename(data.filename);

  if (SYNO_USER && SYNO_PASS) {
    try {
      const synologyResult = await uploadAutoresponderAttachmentToSynology({ fileName: filename, fileBuf });
      return { ok: true, url: synologyResult.url, filename, storage: 'synology' };
    } catch (err) {
      console.warn('[autoresponder/upload-attachment] Synology unavailable for autoresponder attachment:', err.message);
    }
  }

  const dir = path.join(UPLOADS_DIR, 'autoresponder', 'attachments');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, filename);
  fs.writeFileSync(dest, fileBuf);

  const baseUrl = process.env.API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
  const url = `${baseUrl}/images/autoresponder/attachments/${filename}`;
  return { ok: true, url, filename, storage: 'local' };
});

const autoresponderTagFields = {
  name: (v) => String(v ?? ''),
  color: (v) => String(v || '#6b7280'),
  description: (v) => v == null ? null : String(v),
  scopes: (v) => Array.isArray(v) ? v.join(',') : String(v ?? ''),
  show_on_bot: (v) => boolInt(v),
};

fastify.get('/autoresponder/tags', { preHandler: requireSyncKey }, async (req) => {
  const scope = req.query.scope;
  let sql = 'SELECT * FROM autoresponder_tags';
  const params = [];
  if (scope) {
    sql += ' WHERE FIND_IN_SET(?, scopes)';
    params.push(scope);
  }
  sql += ' ORDER BY name ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
});

fastify.post('/autoresponder/tags', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  if (!body.name || !body.scopes) return reply.code(400).send({ error: 'name and scopes are required' });
  const columns = Object.keys(autoresponderTagFields).filter((key) => Object.prototype.hasOwnProperty.call(body, key));
  const values = columns.map((key) => autoresponderTagFields[key](body[key]));
  await pool.query(
    `INSERT INTO autoresponder_tags (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    values
  );
  const [rows] = await pool.query('SELECT * FROM autoresponder_tags WHERE id = LAST_INSERT_ID()');
  return rows[0];
});

fastify.patch('/autoresponder/tags/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const built = buildAutoresponderUpdateSet(req.body || {}, autoresponderTagFields);
  if (built.error) return reply.code(400).send({ error: built.error });
  if (built.sets.length === 0) return reply.code(400).send({ error: 'No valid tag fields provided' });
  built.values.push(req.params.id);
  await pool.query(`UPDATE autoresponder_tags SET ${built.sets.join(', ')} WHERE id = ?`, built.values);
  const [rows] = await pool.query('SELECT * FROM autoresponder_tags WHERE id = ?', [req.params.id]);
  return rows[0] || null;
});

fastify.delete('/autoresponder/tags/:id', { preHandler: requireSyncKey }, async (req) => {
  await pool.query('DELETE FROM autoresponder_tags WHERE id = ?', [req.params.id]);
  return { ok: true };
});

fastify.get('/autoresponder/blocklist', { preHandler: requireSyncKey }, async () => {
  const [rows] = await pool.query('SELECT * FROM autoresponder_blocklist ORDER BY created_at DESC, id DESC');
  return rows;
});

fastify.post('/autoresponder/blocklist', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  if (!body.pattern) return reply.code(400).send({ error: 'pattern is required' });
  await pool.query(
    `INSERT INTO autoresponder_blocklist (pattern, pattern_type, contact_name, reason, active)
     VALUES (?, ?, ?, ?, ?)`,
    [
      String(body.pattern),
      String(body.pattern_type || 'exact'),
      body.contact_name == null ? null : String(body.contact_name),
      body.reason == null ? null : String(body.reason),
      body.active == null ? 1 : boolInt(body.active),
    ]
  );
  const [rows] = await pool.query('SELECT * FROM autoresponder_blocklist WHERE id = LAST_INSERT_ID()');
  return rows[0];
});

fastify.post('/autoresponder/blocklist/bulk', { preHandler: requireSyncKey }, async (req, reply) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) return reply.code(400).send({ error: 'items are required' });
  for (const item of items) {
    const pattern = typeof item === 'string' ? item : item.pattern;
    if (!pattern) continue;
    await pool.query(
      `INSERT INTO autoresponder_blocklist (pattern, pattern_type, contact_name, reason, active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        String(pattern),
        typeof item === 'string' ? 'exact' : String(item.pattern_type || 'exact'),
        typeof item === 'string' ? null : (item.contact_name == null ? null : String(item.contact_name)),
        typeof item === 'string' ? null : (item.reason == null ? null : String(item.reason)),
        typeof item === 'string' || item.active == null ? 1 : boolInt(item.active),
      ]
    );
  }
  return { ok: true };
});

fastify.patch('/autoresponder/blocklist/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  const fields = {
    pattern: (v) => String(v ?? ''),
    pattern_type: (v) => String(v || 'exact'),
    contact_name: (v) => v == null ? null : String(v),
    reason: (v) => v == null ? null : String(v),
    active: (v) => boolInt(v),
  };
  const columns = Object.keys(fields).filter((key) => Object.prototype.hasOwnProperty.call(body, key));
  if (columns.length === 0) return reply.code(400).send({ error: 'no fields to update' });
  if (Object.prototype.hasOwnProperty.call(body, 'pattern') && !String(body.pattern || '').trim()) {
    return reply.code(400).send({ error: 'pattern is required' });
  }
  const values = columns.map((key) => fields[key](body[key]));
  await pool.query(
    `UPDATE autoresponder_blocklist SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
    [...values, req.params.id]
  );
  const [rows] = await pool.query('SELECT * FROM autoresponder_blocklist WHERE id = ?', [req.params.id]);
  return rows[0] || null;
});

fastify.delete('/autoresponder/blocklist/:id', { preHandler: requireSyncKey }, async (req) => {
  await pool.query('DELETE FROM autoresponder_blocklist WHERE id = ?', [req.params.id]);
  return { ok: true };
});

fastify.get('/autoresponder/conversations', { preHandler: requireSyncKey }, async (req) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const status = req.query.status;
  const tagId = req.query.tag_id;
  let sql = 'SELECT * FROM autoresponder_conversations WHERE 1=1';
  const params = [];
  if (status === 'paused') sql += ' AND paused_until > NOW()';
  if (status === 'active') sql += ' AND (paused_until IS NULL OR paused_until <= NOW())';
  if (tagId) {
    sql += ' AND JSON_CONTAINS(tag_ids, JSON_ARRAY(?))';
    params.push(Number(tagId));
  }
  sql += ` ORDER BY last_message_at DESC LIMIT ${limit} OFFSET ${offset}`;
  const [rows] = await pool.query(sql, params);
  return rows;
});

fastify.post('/autoresponder/conversations/:sender/pause', { preHandler: requireSyncKey }, async (req) => {
  const body = req.body || {};
  const minutes = Number(body.minutes || 60);
  await pool.query(
    `INSERT INTO autoresponder_conversations (sender, last_message_at, paused_until, pause_reason)
     VALUES (?, CURRENT_TIMESTAMP, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       paused_until = DATE_ADD(NOW(), INTERVAL ? MINUTE),
       pause_reason = ?`,
    [req.params.sender, minutes, body.reason || 'admin', minutes, body.reason || 'admin']
  );
  return { ok: true };
});

fastify.post('/autoresponder/conversations/:sender/resume', { preHandler: requireSyncKey }, async (req) => {
  await pool.query(
    `UPDATE autoresponder_conversations
     SET paused_until = NULL, pause_reason = NULL
     WHERE sender = ?`,
    [req.params.sender]
  );
  return { ok: true };
});

fastify.post('/autoresponder/conversations/:sender/tags', { preHandler: requireSyncKey }, async (req) => {
  const tagIds = Array.isArray(req.body?.tag_ids) ? req.body.tag_ids.map(Number).filter(Number.isFinite) : [];
  await pool.query(
    `INSERT INTO autoresponder_conversations (sender, last_message_at, tag_ids)
     VALUES (?, CURRENT_TIMESTAMP, ?)
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       tag_ids = ?`,
    [req.params.sender, jsonStr(tagIds), jsonStr(tagIds)]
  );
  return { ok: true, tag_ids: tagIds };
});

fastify.get('/autoresponder/unanswered', { preHandler: requireSyncKey }, async (req) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const [rows] = await pool.query(
    `SELECT question, COUNT(*) AS occurrences, MAX(created_at) AS last_seen_at
     FROM autoresponder_logs
     WHERE intent = 'fallback'
       AND question IS NOT NULL
       AND question <> ''
     GROUP BY question
     ORDER BY occurrences DESC, last_seen_at DESC
     LIMIT ${limit}`
  );
  return rows;
});

async function getAutoresponderTopProducts(limit = 10) {
  const [rows] = await pool.query(
    `SELECT matched_products
     FROM autoresponder_logs
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       AND matched_products IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 500`
  );
  return aggregateAutoresponderProductsFromRows(rows, limit);
}

function normalizeAutoresponderMatchedProducts(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

function aggregateAutoresponderProductsFromRows(rows = [], limit = 10) {
  const products = new Map();
  for (const row of rows) {
    const matchedProducts = normalizeAutoresponderMatchedProducts(row.matched_products);
    if (!Array.isArray(matchedProducts)) continue;
    for (const product of matchedProducts) {
      if (!product || !product.id) continue;
      const id = String(product.id);
      const current = products.get(id) || {
        id,
        name: product.name || 'Produto sem nome',
        sku: product.sku || null,
        total: 0,
      };
      current.total += 1;
      if (!current.name && product.name) current.name = product.name;
      if (!current.sku && product.sku) current.sku = product.sku;
      products.set(id, current);
    }
  }
  return Array.from(products.values())
    .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit);
}

function emptyAutoresponderStats(source = 'mysql', warning = null) {
  return {
    source,
    warning,
    summary: {
      total_messages: 0,
      unique_senders: 0,
      fallback_messages: 0,
      product_messages: 0,
      human_requests: 0,
      avg_response_time_ms: 0,
    },
    byIntent: [],
    topRules: [],
    topProducts: [],
  };
}

function parseAutoresponderArchiveDate(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return { value: raw, year, month, day };
}

function buildAutoresponderSynologyArchivePath(dateParts) {
  return path.join(AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR, dateParts.year, dateParts.month, `${dateParts.day}.json.gz`);
}

function extractAutoresponderArchiveRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.logs)) return payload.logs;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function aggregateAutoresponderArchiveStats(rows = []) {
  const summary = {
    total_messages: rows.length,
    unique_senders: 0,
    fallback_messages: 0,
    product_messages: 0,
    human_requests: 0,
    avg_response_time_ms: 0,
  };
  const senders = new Set();
  const byIntentMap = new Map();
  const topRulesMap = new Map();
  let responseTimeTotal = 0;
  let responseTimeCount = 0;

  for (const row of rows) {
    const intent = row.intent || 'unknown';
    if (row.sender) senders.add(String(row.sender));
    if (intent === 'fallback') summary.fallback_messages += 1;
    if (['product_tag', 'product_search', 'rule_product_tag', 'rule_product_search'].includes(intent)) {
      summary.product_messages += 1;
    }
    if (intent === 'human_request') summary.human_requests += 1;
    byIntentMap.set(intent, (byIntentMap.get(intent) || 0) + 1);

    const responseTime = Number(row.response_time_ms);
    if (Number.isFinite(responseTime)) {
      responseTimeTotal += responseTime;
      responseTimeCount += 1;
    }

    if (row.matched_rule_id) {
      const id = String(row.matched_rule_id);
      const current = topRulesMap.get(id) || {
        id,
        name: row.matched_rule_name || `Regra ${id}`,
        hits: 0,
      };
      current.hits += 1;
      if (!current.name && row.matched_rule_name) current.name = row.matched_rule_name;
      topRulesMap.set(id, current);
    }
  }

  summary.unique_senders = senders.size;
  summary.avg_response_time_ms = responseTimeCount ? Math.round(responseTimeTotal / responseTimeCount) : 0;

  return {
    summary,
    byIntent: Array.from(byIntentMap.entries())
      .map(([intent, total]) => ({ intent, total }))
      .sort((a, b) => b.total - a.total || String(a.intent).localeCompare(String(b.intent))),
    topRules: Array.from(topRulesMap.values())
      .sort((a, b) => b.hits - a.hits || String(a.name).localeCompare(String(b.name)))
      .slice(0, 10),
    topProducts: aggregateAutoresponderProductsFromRows(rows, 10),
  };
}

async function loadAutoresponderSynologyStats(filters = {}) {
  const dateParts = parseAutoresponderArchiveDate(filters.from);
  if (!dateParts) {
    return {
      ...emptyAutoresponderStats('synology', 'Synology stats archive is not available yet; use from=YYYY-MM-DD'),
      source: 'synology',
    };
  }

  const archivePath = buildAutoresponderSynologyArchivePath(dateParts);
  if (!fs.existsSync(archivePath)) {
    return {
      ...emptyAutoresponderStats('synology', `Synology stats archive not found for ${dateParts.value}`),
      source: 'synology',
      archive_date: dateParts.value,
    };
  }

  try {
    const compressed = await fs.promises.readFile(archivePath);
    const payload = JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));
    const rows = extractAutoresponderArchiveRows(payload);
    return {
      source: 'synology',
      warning: null,
      archive_date: dateParts.value,
      ...aggregateAutoresponderArchiveStats(rows),
    };
  } catch (err) {
    console.warn('[autoresponder/stats] failed to read Synology stats archive:', err.message);
    return {
      ...emptyAutoresponderStats('synology', `Synology stats archive read failed for ${dateParts.value}`),
      source: 'synology',
      archive_date: dateParts.value,
    };
  }
}

fastify.get('/autoresponder/stats', { preHandler: requireSyncKey }, async (req) => {
  const source = req.query?.source === 'synology' ? 'synology' : 'mysql';
  if (source === 'synology') {
    return loadAutoresponderSynologyStats(req.query || {});
  }

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS total_messages,
            COUNT(DISTINCT sender) AS unique_senders,
            SUM(intent = 'fallback') AS fallback_messages,
            SUM(intent IN ('product_tag','product_search','rule_product_tag','rule_product_search')) AS product_messages,
            SUM(intent = 'human_request') AS human_requests,
            ROUND(AVG(response_time_ms), 0) AS avg_response_time_ms
     FROM autoresponder_logs
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
  );
  const [byIntent] = await pool.query(
    `SELECT intent, COUNT(*) AS total
     FROM autoresponder_logs
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY intent
     ORDER BY total DESC`
  );
  const [topRules] = await pool.query(
    `SELECT id, name, hits
     FROM autoresponder_rules
     WHERE hits > 0
     ORDER BY hits DESC
     LIMIT 10`
  );
  const topProducts = await getAutoresponderTopProducts(10);
  return { source: 'mysql', summary, byIntent, topRules, topProducts };
});

fastify.get('/autoresponder/store-status', { preHandler: requireSyncKey }, async () => {
  return getCachedAutoresponderStoreStatus();
});

fastify.patch('/products/:id/tags', { preHandler: requireSyncKey }, async (req, reply) => {
  const tagIds = Array.isArray(req.body?.tag_ids) ? req.body.tag_ids.map(Number).filter(Number.isFinite) : null;
  if (!tagIds) return reply.code(400).send({ error: 'tag_ids array is required' });
  await pool.query('UPDATE products SET tag_ids = ? WHERE id = ?', [jsonStr(tagIds), req.params.id]);
  return { ok: true, tag_ids: tagIds };
});

fastify.addHook('onSend', async (req, reply, payload) => {
  if (!String(req.url || '').startsWith('/autoresponder-webhook')) return payload;
  const responseFormat = String(req.query?.format || req.query?.response_format || '').toLowerCase();
  if (!['text', 'plain', 'message'].includes(responseFormat)) return payload;
  try {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const message = Array.isArray(parsed?.replies) ? String(parsed.replies[0]?.message || '') : '';
    reply.header('Content-Type', 'text/plain; charset=utf-8');
    return message;
  } catch {
    return payload;
  }
});

fastify.route({
  method: ['GET', 'POST'],
  url: '/autoresponder-webhook',
  preHandler: requireAutoresponderToken,
  config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  handler: async (req) => {
    try {
      const requestBody = req.body || {};
      const nestedQuery = requestBody && typeof requestBody.query === 'object' ? requestBody.query : {};
      const payload = { ...(req.query || {}), ...nestedQuery, ...requestBody };
      const sender = String(payload.sender || payload.from || payload.phone || payload.number || payload.contact || '').trim();
      const message = String(payload.message || payload.text || payload.query || payload.body || payload.received_message || '').trim();
      const isGroup = payload.isGroup === true || String(payload.isGroup || '').toLowerCase() === 'true';
      const senderKey = normalizeAutoresponderSender(sender) || sender || 'unknown';
      const detectedIntent = detectAutoresponderIntent(message);
      const shouldPrefixGreeting = detectedIntent.greeting;
      const contactFirstName = getAutoresponderContactFirstName(payload);

      const [settingsRows] = await pool.query('SELECT * FROM autoresponder_settings WHERE id = 1 LIMIT 1');
      const settings = settingsRows[0];
      if (!settings || Number(settings.enabled) !== 1) {
        return { replies: [] };
      }

      if (await isAutoresponderBlocked(sender)) {
        return { replies: [] };
      }

      if (isGroup) {
        return { replies: [] };
      }

      const [conversationRows] = await pool.query(
        'SELECT paused_until FROM autoresponder_conversations WHERE sender = ? LIMIT 1',
        [senderKey]
      );
      const pausedUntil = conversationRows[0]?.paused_until ? new Date(conversationRows[0].paused_until) : null;
      if (pausedUntil && pausedUntil.getTime() > Date.now()) {
        await touchAutoresponderConversation(senderKey);
        return { replies: [] };
      }

      const replyLimit = Number(settings.max_replies_per_conversation) > 0
        ? Number(settings.max_replies_per_conversation)
        : 20;
      const replyWindowHours = Number(settings.max_replies_window_hours) > 0
        ? Number(settings.max_replies_window_hours)
        : 24;
      const recentReplyCount = await getAutoresponderReplyCount(senderKey, replyWindowHours);
      if (recentReplyCount >= replyLimit) {
        await touchAutoresponderConversation(senderKey);
        return { replies: [] };
      }

      const contactFlowReply = await handleAutoresponderContactNameFlow({ sender: senderKey, message, contactFirstName });
      if (contactFlowReply) {
        const contactFlowReplies = Array.isArray(contactFlowReply) ? contactFlowReply : [contactFlowReply];
        const contactFlowReplyText = contactFlowReplies.join('\n\n');
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'contact_name',
          replyText: contactFlowReplyText,
          matchedCount: contactFlowReplies.length,
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: contactFlowReplies.map((replyMessage) => ({ message: replyMessage })) };
      }

      if (detectedIntent.greetingOnly) {
        const contactState = await getAutoresponderContactNameState(senderKey);
        const contactNameStatus = String(contactState?.contact_name_status || '');
        const shouldConfirmContactName = contactFirstName
          && !['awaiting_name_confirmation', 'awaiting_name_input', 'saved_to_google', 'google_pending'].includes(contactNameStatus);
        const shouldAskContactName = !contactFirstName
          && !['awaiting_name_confirmation', 'awaiting_name_input', 'saved_to_google', 'google_pending'].includes(contactNameStatus);
        if (shouldConfirmContactName) {
          await startAutoresponderContactNameConfirmation(senderKey, contactFirstName);
        } else if (shouldAskContactName) {
          await markAutoresponderContactNameAwaitingInput(senderKey);
        }
        const contactPrompt = shouldConfirmContactName
          ? `\n\nSeu nome e ${contactFirstName}? \u{1F60A}\nResponda "sim" para confirmar ou "nao" para informar outro nome.`
          : shouldAskContactName
            ? '\n\nComo devo chamar voce? \u{1F60A}'
          : '';
        const greetingText = getAutoresponderGreetingReply(message, contactFirstName);
        const categories = await findAutoresponderAvailableCategories();
        const categoryOptions = buildAutoresponderCategoryOptions(categories);
        const categoryListText = formatAutoresponderGreetingCategoryListReply(categories);
        const replyText = [greetingText, contactPrompt.trim(), categoryListText].filter(Boolean).join('\n\n');
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'greeting_category_list',
          replyText,
          matchedCount: categoryOptions.length,
          matchedProducts: categoryOptions,
        });
        await upsertAutoresponderOptionsConversation(senderKey, categoryOptions, {
          source: 'category_list',
          offset: 0,
          limit: categoryOptions.length,
          total: categoryOptions.length,
          hasMore: false,
        });
        if (shouldConfirmContactName || shouldAskContactName) {
          return { replies: [{ message: greetingText }, { message: [contactPrompt.trim(), categoryListText].filter(Boolean).join('\n\n') }] };
        }
        return { replies: [{ message: replyText }] };
      }

      const purchaseFlow = await getAutoresponderPurchaseFlow(senderKey);
      if (detectedIntent.warrantyRequest) {
        return handleAutoresponderWarrantyRequest({
          sender: senderKey,
          message,
          settings,
          purchaseFlow,
          shouldPrefixGreeting,
        });
      }

      if (hasAutoresponderCartItems(purchaseFlow) && isAutoresponderPurchaseCancelRequest(message)) {
        const replyText = formatAutoresponderReply(buildAutoresponderCartCancelledReply(), settings, false);
        await clearAutoresponderPurchaseFlow(senderKey);
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'purchase_cancelled',
          replyText,
          matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
          matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
      }

      if (hasAutoresponderCartItems(purchaseFlow) && isAutoresponderPurchaseFinalizeRequest(message)) {
        const items = Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [];
        const cartTotals = calculateAutoresponderCartTotals(items);
        const replyText = formatAutoresponderReply(formatAutoresponderCartSummaryReply(items), settings, false);
        await saveAutoresponderPurchaseFlow(senderKey, {
          ...purchaseFlow,
          status: 'summary_ready',
          selected_product: null,
          requested_quantity: null,
          totals: cartTotals,
        });
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'purchase_summary',
          replyText,
          matchedCount: items.length,
          matchedProducts: items,
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
      }

      if (purchaseFlow.status === 'summary_ready' && hasAutoresponderCartItems(purchaseFlow)) {
        const fulfillmentChoice = getAutoresponderPurchaseFulfillmentChoice(message);
        if (fulfillmentChoice === 'pickup') {
          const replyText = formatAutoresponderReply(buildAutoresponderPickupConfirmationReply(), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            status: 'customer_data_pending',
            fulfillment: 'pickup',
            delivery_address: null,
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_fulfillment_pickup',
            replyText,
            matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
            matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }

        if (fulfillmentChoice === 'delivery') {
          const replyText = formatAutoresponderReply(buildAutoresponderDeliveryAddressPrompt(), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            status: 'awaiting_delivery_address',
            fulfillment: 'delivery',
            delivery_address: null,
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_fulfillment_delivery',
            replyText,
            matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
            matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
      }

      if (purchaseFlow.status === 'awaiting_delivery_address' && hasAutoresponderCartItems(purchaseFlow)) {
        const deliveryAddress = normalizeAutoresponderDeliveryAddress(message);
        if (deliveryAddress.length >= 10) {
          const replyText = formatAutoresponderReply(buildAutoresponderDeliveryAddressSavedReply(), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            status: 'customer_data_pending',
            fulfillment: 'delivery',
            delivery_address: deliveryAddress,
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_delivery_address',
            replyText,
            matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
            matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
      }

      if (purchaseFlow.status === 'customer_data_pending' && hasAutoresponderCartItems(purchaseFlow)) {
        const customerData = await getAutoresponderCustomerDataSnapshot(senderKey, payload, purchaseFlow);
        const replyText = formatAutoresponderReply(buildAutoresponderCustomerDataConfirmationReply(customerData), settings, false);
        await saveAutoresponderPurchaseFlow(senderKey, {
          ...purchaseFlow,
          status: 'awaiting_customer_confirmation',
          customer_data: customerData,
        });
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'purchase_customer_data_confirmation',
          replyText,
          matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
          matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
      }

      if (purchaseFlow.status === 'awaiting_customer_confirmation' && hasAutoresponderCartItems(purchaseFlow)) {
        if (isAutoresponderYes(message)) {
          const customerDocument = normalizeAutoresponderCustomerDocument(purchaseFlow?.customer_data?.cpf_cnpj);
          if (!customerDocument) {
            const replyText = formatAutoresponderReply(buildAutoresponderCustomerDocumentPrompt(), settings, false);
            await saveAutoresponderPurchaseFlow(senderKey, {
              ...purchaseFlow,
              status: 'awaiting_customer_document',
              customer_data_confirmed: true,
            });
            await logAutoresponderReply({
              sender: senderKey,
              message,
              intent: 'purchase_customer_document_prompt',
              replyText,
              matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
              matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
            });
            await upsertAutoresponderSuccessConversation(senderKey);
            return { replies: [{ message: replyText }] };
          }

          const replyText = formatAutoresponderReply(buildAutoresponderCustomerDataConfirmedReply(), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            status: 'customer_data_confirmed',
            customer_data_confirmed: true,
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_customer_data_confirmed',
            replyText,
            matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
            matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }

        if (isAutoresponderNo(message)) {
          const replyText = formatAutoresponderReply(buildAutoresponderCustomerDataNeedsUpdateReply(), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            status: 'customer_data_update_needed',
            customer_data_confirmed: false,
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_customer_data_needs_update',
            replyText,
            matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
            matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
      }

      if (purchaseFlow.status === 'awaiting_customer_document' && hasAutoresponderCartItems(purchaseFlow)) {
        const customerDocument = normalizeAutoresponderCustomerDocument(message);
        if (customerDocument) {
          const replyText = formatAutoresponderReply(buildAutoresponderCustomerDocumentSavedReply(), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            status: 'customer_registration_ready',
            customer_data: {
              ...(purchaseFlow.customer_data || {}),
              cpf_cnpj: customerDocument,
            },
            cpf_cnpj: customerDocument,
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_customer_document_saved',
            replyText,
            matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
            matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
      }

      const categoryContext = normalizeAutoresponderOptionsContext(
        (await pool.query(
          `SELECT last_options_offered
           FROM autoresponder_conversations
           WHERE sender = ?
             AND last_options_offered IS NOT NULL
             AND last_options_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
           LIMIT 1`,
          [senderKey, Number(settings.numbered_list_validity_minutes) > 0 ? Number(settings.numbered_list_validity_minutes) : 30]
        ))[0][0]?.last_options_offered
      );
      if (categoryContext?.pagination?.source === 'category_list') {
        const selectedCategory = findAutoresponderSelectedCategoryFromMessage(message, categoryContext.items, detectedIntent.numberedChoice);
        if (selectedCategory?.id) {
          const pageSize = AUTORESPONDER_PRODUCT_RESPONSE_LIMIT;
          const rows = await findAutoresponderProductsByCategory(selectedCategory.id, pageSize + 1);
          const products = rows.slice(0, pageSize);
          const hasMore = rows.length > pageSize;
          const total = await countAutoresponderProductsByCategory(selectedCategory.id);
          const productOptions = buildAutoresponderProductOptions(products);
          const productReplyMessages = appendAutoresponderReplyFooter(
            await formatAutoresponderProductSearchReplies(products, selectedCategory.name, settings, { offset: 0, limit: pageSize, total }),
            formatAutoresponderProductReplyInstructions(hasMore)
          );
          const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
          const replyText = replyMessages.join('\n\n');

          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'category_selected',
            replyText,
            matchedCount: products.length,
            matchedProducts: productOptions,
          });
          await upsertAutoresponderOptionsConversation(senderKey, productOptions, {
            source: 'category',
            categoryId: selectedCategory.id,
            keyword: selectedCategory.name,
            offset: 0,
            limit: pageSize,
            total,
            hasMore,
          });

          return { replies: formatAutoresponderProReplies(replyMessages) };
        }
      }

      const removeItemIndex = getAutoresponderPurchaseRemoveItemIndex(message);
      if (hasAutoresponderCartItems(purchaseFlow) && removeItemIndex !== null) {
        const currentItems = Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [];
        const removedItem = currentItems[removeItemIndex] || null;
        if (removedItem) {
          const remainingItems = currentItems.filter((_, index) => index !== removeItemIndex);
          const replyText = formatAutoresponderReply(buildAutoresponderItemRemovedReply(removedItem, remainingItems), settings, false);
          if (remainingItems.length === 0) {
            await clearAutoresponderPurchaseFlow(senderKey);
          } else {
            await saveAutoresponderPurchaseFlow(senderKey, {
              ...purchaseFlow,
              status: 'item_added',
              items: remainingItems,
            });
          }
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_item_removed',
            replyText,
            matchedCount: remainingItems.length,
            matchedProducts: remainingItems,
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
      }

      if (purchaseFlow.status === 'awaiting_product_action' && purchaseFlow.selected_product?.id) {
        if (isAutoresponderPurchaseBuyRequest(message)) {
          const product = await findAutoresponderProductById(purchaseFlow.selected_product.id);
          const selectedProduct = product || purchaseFlow.selected_product;
          const replyText = formatAutoresponderReply(buildAutoresponderQuantityPrompt(selectedProduct), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            status: 'awaiting_quantity',
            selected_product: {
              ...purchaseFlow.selected_product,
              name: selectedProduct?.name || purchaseFlow.selected_product.name || null,
              sku: selectedProduct?.sku || purchaseFlow.selected_product.sku || null,
              slug: selectedProduct?.slug || purchaseFlow.selected_product.slug || null,
              price_cents: product ? getAutoresponderProductPriceCents(product) : purchaseFlow.selected_product.price_cents || null,
              stock_quantity: selectedProduct?.stock_quantity == null ? purchaseFlow.selected_product.stock_quantity || null : Number(selectedProduct.stock_quantity),
            },
            requested_quantity: null,
          });

          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_quantity_prompt',
            replyText,
            matchedCount: 1,
            matchedProducts: [purchaseFlow.selected_product],
          });
          await upsertAutoresponderSuccessConversation(senderKey);

          return { replies: [{ message: replyText }] };
        }

        if (isAutoresponderPurchaseDetailsRequest(message)) {
          const product = await findAutoresponderProductById(purchaseFlow.selected_product.id);
          const detailText = await formatAutoresponderProductDetailReply(product, settings);
          const replyText = formatAutoresponderReply(`${detailText}\n\nSe quiser comprar, responda "comprar".`, settings, false);

          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_product_details',
            replyText,
            matchedCount: product ? 1 : 0,
            matchedProducts: [purchaseFlow.selected_product],
          });
          await upsertAutoresponderSuccessConversation(senderKey);

          return { replies: [{ message: replyText }] };
        }
      }

      if (purchaseFlow.status === 'awaiting_quantity' && purchaseFlow.selected_product?.id) {
        const requestedQuantity = parseAutoresponderRequestedQuantity(message);
        const product = await findAutoresponderProductById(purchaseFlow.selected_product.id);
        const selectedProduct = product || purchaseFlow.selected_product;

        if (!requestedQuantity || requestedQuantity < 1) {
          const replyText = formatAutoresponderReply(buildAutoresponderQuantityPrompt(selectedProduct), settings, false);
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_quantity_invalid',
            replyText,
            matchedCount: 1,
            matchedProducts: [purchaseFlow.selected_product],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }

        const availableStock = Math.max(Number(selectedProduct?.stock_quantity || 0), 0);
        if (availableStock <= 0) {
          const replyText = formatAutoresponderReply(buildAutoresponderOutOfStockReply(selectedProduct), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            status: 'stock_blocked',
            requested_quantity: requestedQuantity,
            selected_product: {
              ...purchaseFlow.selected_product,
              stock_quantity: 0,
            },
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_stock_blocked',
            replyText,
            matchedCount: 0,
            matchedProducts: [purchaseFlow.selected_product],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }

        if (requestedQuantity > availableStock) {
          const replyText = formatAutoresponderReply(
            buildAutoresponderInsufficientStockReply(selectedProduct, requestedQuantity, availableStock),
            settings,
            false
          );
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            status: 'awaiting_quantity',
            requested_quantity: null,
            selected_product: {
              ...purchaseFlow.selected_product,
              stock_quantity: availableStock,
            },
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_stock_limited',
            replyText,
            matchedCount: 1,
            matchedProducts: [purchaseFlow.selected_product],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }

        const unitPriceCents = product ? getAutoresponderProductPriceCents(product) : Number(purchaseFlow.selected_product.price_cents || 0);
        const item = {
          product_id: purchaseFlow.selected_product.id,
          name: selectedProduct?.name || purchaseFlow.selected_product.name || null,
          sku: selectedProduct?.sku || purchaseFlow.selected_product.sku || null,
          slug: selectedProduct?.slug || purchaseFlow.selected_product.slug || null,
          quantity: requestedQuantity,
          unit_price_cents: unitPriceCents,
          subtotal_cents: unitPriceCents * requestedQuantity,
        };
        const replyText = formatAutoresponderReply(buildAutoresponderItemAddedPrompt(item), settings, false);
        await saveAutoresponderPurchaseFlow(senderKey, {
          ...purchaseFlow,
          status: 'item_added',
          requested_quantity: requestedQuantity,
          selected_product: {
            ...purchaseFlow.selected_product,
            stock_quantity: availableStock,
          },
          items: [...(Array.isArray(purchaseFlow.items) ? purchaseFlow.items : []), item],
        });
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'purchase_item_added',
          replyText,
          matchedCount: 1,
          matchedProducts: [item],
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
      }

      if (purchaseFlow.status === 'item_added' && isAutoresponderPurchaseAddMoreRequest(message)) {
        const replyText = formatAutoresponderReply(buildAutoresponderAddMorePrompt(), settings, false);
        await saveAutoresponderPurchaseFlow(senderKey, {
          ...purchaseFlow,
          status: 'adding_more',
          selected_product: null,
          requested_quantity: null,
          items: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
        });
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'purchase_add_more_prompt',
          replyText,
          matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
          matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
      }

      const numberedChoice = detectedIntent.numberedChoice;
      if (Number(settings.use_numbered_lists) === 1) {
        const options = await getAutoresponderNumberedChoiceContext(senderKey, settings.numbered_list_validity_minutes);
        const selectedOption = findAutoresponderSelectedOptionFromMessage(message, options, numberedChoice);
        if (selectedOption?.id) {
          const product = await findAutoresponderProductById(selectedOption.id);
          const replyText = formatAutoresponderReply(buildAutoresponderPurchaseActionPrompt(product, selectedOption), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, {
            status: 'awaiting_product_action',
            selected_product: {
              id: selectedOption.id,
              name: product?.name || selectedOption.name || null,
              sku: product?.sku || selectedOption.sku || null,
              slug: product?.slug || selectedOption.slug || null,
              price_cents: product ? getAutoresponderProductPriceCents(product) : null,
              stock_quantity: product?.stock_quantity == null ? null : Number(product.stock_quantity),
            },
            items: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
          });

          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_product_selected',
            replyText,
            matchedCount: product ? 1 : 0,
            matchedProducts: [selectedOption],
          });
          await upsertAutoresponderSuccessConversation(senderKey);

          return { replies: [{ message: replyText }] };
        }
      }

      if (detectedIntent.moreRequest && Number(settings.use_numbered_lists) === 1) {
        const context = await getAutoresponderOptionsContext(senderKey, settings.numbered_list_validity_minutes);
        const pagination = context.pagination;
        if (pagination?.source && pagination.hasMore) {
          const pageSize = Number(pagination.limit) > 0 ? Number(pagination.limit) : AUTORESPONDER_PRODUCT_RESPONSE_LIMIT;
          const nextOffset = Number(pagination.offset || 0) + pageSize;
          const rows = pagination.source === 'tag'
            ? await findAutoresponderProductsByTag(pagination.tagId, pageSize + 1, nextOffset)
            : await findAutoresponderProductsByTokens(pagination.tokens || [], pageSize + 1, nextOffset);
          const products = rows.slice(0, pageSize);
          const hasMore = rows.length > pageSize;
          if (products.length > 0) {
            const productOptions = buildAutoresponderProductOptions(products);
            const keyword = pagination.source === 'tag'
              ? (pagination.keyword || 'mais produtos')
              : (pagination.tokens || []).join(' ');
            const total = Number(pagination.total || 0) > 0
              ? Number(pagination.total)
              : (pagination.source === 'tag'
                ? await countAutoresponderProductsByTag(pagination.tagId)
                : await countAutoresponderProductsByTokens(pagination.tokens || []));
            const productReplyMessages = appendAutoresponderReplyFooter(
              await formatAutoresponderProductSearchReplies(products, keyword, settings, { offset: nextOffset, limit: pageSize, total }),
              formatAutoresponderProductReplyInstructions(hasMore)
            );
            const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, false);
            const replyText = replyMessages.join('\n\n');

            await logAutoresponderReply({
              sender: senderKey,
              message,
              intent: 'more_products',
              replyText,
              matchedCount: products.length,
              matchedProducts: productOptions,
            });
            await upsertAutoresponderOptionsConversation(senderKey, productOptions, {
              ...pagination,
              offset: nextOffset,
              limit: pageSize,
              total,
              hasMore,
            });

            return { replies: formatAutoresponderProReplies(replyMessages) };
          }
        }
      }

      if (detectedIntent.humanRequest) {
        const pauseMinutes = Number(settings.human_pause_minutes) > 0 ? Number(settings.human_pause_minutes) : 60;
        const storeStatus = await getCachedAutoresponderStoreStatus();
        const humanReplyText = isAutoresponderStoreInHumanHours(storeStatus)
          ? (settings.human_message_in_hours || AUTORESPONDER_DEFAULT_HUMAN_IN_HOURS)
          : (settings.human_message_out_of_hours || settings.human_message_in_hours || AUTORESPONDER_DEFAULT_HUMAN_OUT_OF_HOURS);
        const replyText = formatAutoresponderReply(humanReplyText, settings, shouldPrefixGreeting);

        await pool.query(
          `INSERT INTO autoresponder_logs
            (sender, question, intent, matched_count, reply_text, response_time_ms, is_group)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [senderKey, message || null, 'human_request', 0, replyText, 0, 0]
        );

        await pool.query(
          `INSERT INTO autoresponder_conversations
            (sender, last_message_at, last_bot_reply_at, total_messages, paused_until, pause_reason)
           VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, DATE_ADD(NOW(), INTERVAL ? MINUTE), 'human_request')
           ON DUPLICATE KEY UPDATE
             last_message_at = CURRENT_TIMESTAMP,
             last_bot_reply_at = CURRENT_TIMESTAMP,
             total_messages = total_messages + 1,
             paused_until = DATE_ADD(NOW(), INTERVAL ? MINUTE),
             pause_reason = 'human_request'`,
          [senderKey, pauseMinutes, pauseMinutes]
        );

        return { replies: [{ message: replyText }] };
      }

      const matchedRule = await findAutoresponderRuleMatch(message);
      if (matchedRule) {
        await pool.query(
          'UPDATE autoresponder_rules SET hits = hits + 1 WHERE id = ?',
          [matchedRule.id]
        );

        if (String(matchedRule.reply_type || 'text') === 'product_by_tag') {
          const pageSize = AUTORESPONDER_PRODUCT_RESPONSE_LIMIT;
          const rows = await findAutoresponderProductsByTag(matchedRule.reply_tag_id, pageSize + 1);
          const products = rows.slice(0, pageSize);
          const hasMore = rows.length > pageSize;
          const total = await countAutoresponderProductsByTag(matchedRule.reply_tag_id);
          const productOptions = buildAutoresponderProductOptions(products);
          const productReplyMessages = appendAutoresponderRuleAttachmentToReplies(
            appendAutoresponderReplyFooter(
              await formatAutoresponderProductSearchReplies(products, matchedRule.reply_text || matchedRule.name || 'produtos', settings, { offset: 0, limit: pageSize, total }),
              formatAutoresponderProductReplyInstructions(hasMore)
            ),
            matchedRule
          );
          const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
          const replyText = replyMessages.join('\n\n');

          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'rule_product_tag',
            replyText,
            matchedCount: products.length,
            matchedRuleId: matchedRule.id,
            matchedProducts: productOptions,
          });
          await upsertAutoresponderOptionsConversation(senderKey, productOptions, {
            source: 'tag',
            tagId: matchedRule.reply_tag_id,
            keyword: matchedRule.reply_text || 'produtos',
            offset: 0,
            limit: pageSize,
            total,
            hasMore,
          });
          await applyAutoresponderRuleConversationTag(senderKey, matchedRule.auto_apply_tag_id);

          return { replies: formatAutoresponderProReplies(replyMessages) };
        }

        if (String(matchedRule.reply_type || 'text') === 'product_search') {
          const pageSize = AUTORESPONDER_PRODUCT_RESPONSE_LIMIT;
          const ruleSearchTokens = extractAutoresponderProductSearchTokens(matchedRule.reply_search_query);
          const rows = await findAutoresponderProductsByTokens(ruleSearchTokens, pageSize + 1);
          const products = rows.slice(0, pageSize);
          const hasMore = rows.length > pageSize;
          const total = await countAutoresponderProductsByTokens(ruleSearchTokens);
          const productOptions = buildAutoresponderProductOptions(products);
          const productReplyMessages = appendAutoresponderRuleAttachmentToReplies(
            appendAutoresponderReplyFooter(
              await formatAutoresponderProductSearchReplies(products, matchedRule.reply_search_query, settings, { offset: 0, limit: pageSize, total }),
              formatAutoresponderProductReplyInstructions(hasMore)
            ),
            matchedRule
          );
          const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
          const replyText = replyMessages.join('\n\n');

          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'rule_product_search',
            replyText,
            matchedCount: products.length,
            matchedRuleId: matchedRule.id,
            matchedProducts: productOptions,
          });
          await upsertAutoresponderOptionsConversation(senderKey, productOptions, {
            source: 'search',
            tokens: ruleSearchTokens,
            offset: 0,
            limit: pageSize,
            total,
            hasMore,
          });
          await applyAutoresponderRuleConversationTag(senderKey, matchedRule.auto_apply_tag_id);

          return { replies: formatAutoresponderProReplies(replyMessages) };
        }

        const replyText = formatAutoresponderReply(
          appendAutoresponderRuleAttachment(matchedRule.reply_text, matchedRule),
          settings,
          shouldPrefixGreeting
        );

        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'rule_text',
          replyText,
          matchedCount: 1,
          matchedRuleId: matchedRule.id,
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        await applyAutoresponderRuleConversationTag(senderKey, matchedRule.auto_apply_tag_id);

        return { replies: [{ message: replyText }] };
      }

      const productTagMatch = findAutoresponderProductTagKeyword(message, settings);
      if (productTagMatch) {
        const pageSize = AUTORESPONDER_PRODUCT_RESPONSE_LIMIT;
        const rows = await findAutoresponderProductsByTag(productTagMatch.tagId, pageSize + 1);
        const products = rows.slice(0, pageSize);
        const hasMore = rows.length > pageSize;
        const total = await countAutoresponderProductsByTag(productTagMatch.tagId);
        const productOptions = buildAutoresponderProductOptions(products);
        const productReplyMessages = appendAutoresponderReplyFooter(
          await formatAutoresponderProductSearchReplies(products, productTagMatch.keyword, settings, { offset: 0, limit: pageSize, total }),
          formatAutoresponderProductReplyInstructions(hasMore)
        );
        const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
        const replyText = replyMessages.join('\n\n');

        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'product_tag',
          replyText,
          matchedCount: products.length,
          matchedProducts: productOptions,
        });
        await upsertAutoresponderOptionsConversation(senderKey, productOptions, {
          source: 'tag',
          tagId: productTagMatch.tagId,
          keyword: productTagMatch.keyword,
          offset: 0,
          limit: pageSize,
          total,
          hasMore,
        });

        return { replies: formatAutoresponderProReplies(replyMessages) };
      }

      const productSearchTokens = extractAutoresponderProductSearchTokens(message);
      if (productSearchTokens.length > 0) {
        const pageSize = AUTORESPONDER_PRODUCT_RESPONSE_LIMIT;
        const rows = await findAutoresponderProductsByTokens(productSearchTokens, pageSize + 1);
        const products = rows.slice(0, pageSize);
        const hasMore = rows.length > pageSize;
        if (products.length > 0) {
          const total = await countAutoresponderProductsByTokens(productSearchTokens);
          const productOptions = buildAutoresponderProductOptions(products);
          const productReplyMessages = appendAutoresponderReplyFooter(
            await formatAutoresponderProductSearchReplies(products, productSearchTokens.join(' '), settings, { offset: 0, limit: pageSize, total }),
            formatAutoresponderProductReplyInstructions(hasMore)
          );
          const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
          const replyText = replyMessages.join('\n\n');

          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'product_search',
            replyText,
            matchedCount: products.length,
            matchedProducts: productOptions,
          });
          await upsertAutoresponderOptionsConversation(senderKey, productOptions, {
            source: 'search',
            tokens: productSearchTokens,
            offset: 0,
            limit: pageSize,
            total,
            hasMore,
          });

          return { replies: formatAutoresponderProReplies(replyMessages) };
        }
      }

      const fallbackState = await getAutoresponderFallbackState(senderKey);
      const nextFallbackCount = fallbackState.consecutiveFallbacks + 1;
      const fallbackReply = getAutoresponderFallbackReply(settings, nextFallbackCount);
      const replyText = formatAutoresponderReply(fallbackReply.replyText, settings, shouldPrefixGreeting);
      const autoPauseMinutes = Number(settings.auto_pause_fallback_minutes) > 0
        ? Number(settings.auto_pause_fallback_minutes)
        : 30;

      await pool.query(
        `INSERT INTO autoresponder_logs
          (sender, question, intent, matched_count, reply_text, response_time_ms, is_group)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [senderKey, message || null, 'fallback', 0, replyText, 0, 0]
      );

      if (fallbackReply.shouldAutoPause) {
        await pool.query(
          `INSERT INTO autoresponder_conversations
            (sender, last_message_at, last_bot_reply_at, total_messages, consecutive_fallbacks, paused_until, pause_reason)
           VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 'auto_fallback')
           ON DUPLICATE KEY UPDATE
             last_message_at = CURRENT_TIMESTAMP,
             last_bot_reply_at = CURRENT_TIMESTAMP,
             total_messages = total_messages + 1,
             consecutive_fallbacks = ?,
             paused_until = DATE_ADD(NOW(), INTERVAL ? MINUTE),
             pause_reason = 'auto_fallback'`,
          [senderKey, nextFallbackCount, autoPauseMinutes, nextFallbackCount, autoPauseMinutes]
        );
      } else {
        await pool.query(
          `INSERT INTO autoresponder_conversations
            (sender, last_message_at, last_bot_reply_at, total_messages, consecutive_fallbacks)
           VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, ?)
           ON DUPLICATE KEY UPDATE
             last_message_at = CURRENT_TIMESTAMP,
             last_bot_reply_at = CURRENT_TIMESTAMP,
             total_messages = total_messages + 1,
             consecutive_fallbacks = ?`,
          [senderKey, nextFallbackCount, nextFallbackCount]
        );
      }

      return {
        replies: [{ message: replyText }],
      };
    } catch (err) {
      console.error('[autoresponder] webhook failed:', err);
      return {
        replies: [
          {
            message: 'Tivemos uma instabilidade no atendimento automatico. Um atendente vai te responder em breve.',
          },
        ],
      };
    }
  },
});

// POST /products/:id/upload-image  (multipart/form-data, campo "file")
// Retorna: { url: "https://api.xiaomipetrolina.com.br/images/products/:id/img-N.webp" }
fastify.post('/products/:id/upload-image', { preHandler: requireSyncKey }, async (req, reply) => {
  const { id } = req.params;

  // Ler o arquivo do multipart
  const data = await req.file();
  if (!data) return reply.code(400).send({ error: 'Nenhum arquivo enviado' });

  // Diretório de destino
  const dir = path.join(UPLOADS_DIR, 'products', id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Contar imagens existentes para numerar a nova
  const existing = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  const ext = path.extname(data.filename || '').replace('.', '') || 'jpg';
  const fname = `img-${existing.length + 1}.${ext}`;
  const dest = path.join(dir, fname);

  // Salvar o arquivo
  const chunks = [];
  for await (const chunk of data.file) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  fs.writeFileSync(dest, buffer);

  const url = `https://api.xiaomipetrolina.com.br/images/products/${id}/${fname}`;
  return reply.send({ url, filename: fname });
});

fastify.post('/admin/migrate/production-days', { preHandler: requireSyncKey }, async (req, reply) => {
  const results = [];
  // Verifica via INFORMATION_SCHEMA e adiciona apenas se não existir
  const checks = [
    { table: 'categories', column: 'production_days' },
    { table: 'products',   column: 'production_days' },
  ];
  for (const { table, column } of checks) {
    try {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      if (cols.length > 0) {
        results.push({ table, column, skipped: true, reason: 'column already exists' });
        continue;
      }
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} INT DEFAULT NULL`);
      results.push({ table, column, ok: true });
    } catch (e) {
      results.push({ table, column, ok: false, error: e.message });
    }
  }
  return { migrated: true, results };
});

// Auditoria do estado de linkage pai/filho. Apenas leitura, nao modifica nada.
// Versao otimizada: evita EXISTS com CAST (que nao usa indice) usando JOIN em pre-set.
fastify.get('/admin/migrate/parent-linkage-audit', { preHandler: requireSyncKey }, async (req, reply) => {
  // 1. Totais simples (sem JOIN, rapido)
  const [[totals]] = await pool.query(`
    SELECT
      COUNT(*) AS total_products,
      SUM(CASE WHEN bling_id IS NOT NULL THEN 1 ELSE 0 END) AS with_bling_id,
      SUM(CASE WHEN bling_parent_id IS NOT NULL AND bling_parent_id != '' THEN 1 ELSE 0 END) AS with_bling_parent_id,
      SUM(CASE WHEN parent_id IS NOT NULL AND parent_id != '' THEN 1 ELSE 0 END) AS with_parent_id,
      SUM(CASE WHEN is_parent = 1 THEN 1 ELSE 0 END) AS marked_as_parent
    FROM products
  `);

  const [[uniqueParents]] = await pool.query(`
    SELECT COUNT(DISTINCT bling_parent_id) AS unique_bling_parents_referenced
    FROM products
    WHERE bling_parent_id IS NOT NULL AND bling_parent_id != ''
  `);

  // 2. Pre-set de bling_ids como string (para JOIN com bling_parent_id que eh TEXT).
  //    Buscar so os bling_ids que sao referenciados como pai - reduz o conjunto.
  const [referencedParentIds] = await pool.query(`
    SELECT DISTINCT bling_parent_id AS bling_parent_id_str
    FROM products
    WHERE bling_parent_id IS NOT NULL AND bling_parent_id != ''
  `);

  let pending_closure = 0;
  let orphan_children = 0;

  if (referencedParentIds.length > 0) {
    // Quais desses bling_parent_ids tem produto local com bling_id correspondente?
    const parentIdsList = referencedParentIds.map(r => r.bling_parent_id_str);
    const placeholders = parentIdsList.map(() => '?').join(',');

    const [matchedParents] = await pool.query(
      `SELECT CAST(bling_id AS CHAR) AS bling_id_str
       FROM products
       WHERE bling_id IS NOT NULL AND CAST(bling_id AS CHAR) IN (${placeholders})`,
      parentIdsList
    );

    const matchedSet = new Set(matchedParents.map(r => r.bling_id_str));
    const matchedParentIdsList = parentIdsList.filter(id => matchedSet.has(id));
    const orphanParentIdsList = parentIdsList.filter(id => !matchedSet.has(id));

    // Quantos filhos sao candidatos ao fechamento (bling_parent_id matched, sem parent_id ainda)
    if (matchedParentIdsList.length > 0) {
      const ph2 = matchedParentIdsList.map(() => '?').join(',');
      const [[c1]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM products
         WHERE bling_parent_id IN (${ph2})
           AND (parent_id IS NULL OR parent_id = '')`,
        matchedParentIdsList
      );
      pending_closure = c1.cnt;
    }

    // Quantos filhos sao orfaos (bling_parent_id existe mas pai nao foi importado)
    if (orphanParentIdsList.length > 0) {
      const ph3 = orphanParentIdsList.map(() => '?').join(',');
      const [[c2]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM products WHERE bling_parent_id IN (${ph3})`,
        orphanParentIdsList
      );
      orphan_children = c2.cnt;
    }
  }

  return {
    audit: {
      ...totals,
      ...uniqueParents,
      pending_closure,
      orphan_children,
    }
  };
});

// Lista os bling_ids dos pais que sao referenciados pelos filhos mas nao existem localmente.
// Usado pelo backfill na UI admin para puxar esses produtos do Bling.
fastify.get('/admin/migrate/missing-parents-list', { preHandler: requireSyncKey }, async (req, reply) => {
  // 1. Pega todos os bling_parent_id distintos referenciados por filhos
  const [refs] = await pool.query(`
    SELECT DISTINCT bling_parent_id
    FROM products
    WHERE bling_parent_id IS NOT NULL AND bling_parent_id != ''
  `);
  const referencedIds = refs.map(r => r.bling_parent_id);

  if (referencedIds.length === 0) {
    return { missing_parent_ids: [], total_referenced: 0 };
  }

  // 2. Pega os bling_ids dos produtos que ja existem localmente (como string para comparar)
  const placeholders = referencedIds.map(() => '?').join(',');
  const [existing] = await pool.query(
    `SELECT CAST(bling_id AS CHAR) AS bling_id_str
     FROM products
     WHERE bling_id IS NOT NULL AND CAST(bling_id AS CHAR) IN (${placeholders})`,
    referencedIds
  );
  const existingSet = new Set(existing.map(r => r.bling_id_str));

  // 3. Filtra: faltantes = referenciados que nao existem localmente
  const missing = referencedIds.filter(id => !existingSet.has(String(id)));

  // Conta filhos por pai (informacao util para UI mostrar "X variantes deste pai")
  let childCounts = {};
  if (missing.length > 0) {
    const ph = missing.map(() => '?').join(',');
    const [counts] = await pool.query(
      `SELECT bling_parent_id, COUNT(*) AS cnt
       FROM products
       WHERE bling_parent_id IN (${ph})
       GROUP BY bling_parent_id`,
      missing
    );
    childCounts = Object.fromEntries(counts.map(r => [r.bling_parent_id, r.cnt]));
  }

  return {
    missing_parent_ids: missing.map(id => ({
      bling_id: Number(id),
      child_count: childCounts[id] || 0,
    })),
    total_referenced: referencedIds.length,
    total_missing: missing.length,
  };
});

// Fechamento de circuito: popula parent_id (UUID local) dos filhos baseado em bling_parent_id.
// Para cada filho com bling_parent_id, encontra o produto local cujo bling_id corresponde
// e seta o parent_id apontando pra ele. Idempotente.
fastify.post('/admin/migrate/close-parent-linkage', { preHandler: requireSyncKey }, async (req, reply) => {
  // CAST necessario porque bling_parent_id eh TEXT mas bling_id eh BIGINT (drift de tipo).
  // O JOIN restringe a pais marcados (is_parent=1) por seguranca.
  const [result] = await pool.query(`
    UPDATE products child
    JOIN products parent
      ON parent.bling_id IS NOT NULL
     AND CAST(parent.bling_id AS CHAR) = child.bling_parent_id
     AND parent.is_parent = 1
    SET child.parent_id = parent.id
    WHERE child.bling_parent_id IS NOT NULL
      AND child.bling_parent_id != ''
      AND (child.parent_id IS NULL OR child.parent_id = '')
  `);

  return {
    closed: true,
    affected: result.affectedRows,
    changed: result.changedRows,
  };
});

// Marca produtos como is_parent=true. Recebe lista de bling_ids.
// Chamado pela UI apos o backfill terminar de importar os pais.
fastify.post('/admin/migrate/mark-as-parents', { preHandler: requireSyncKey }, async (req, reply) => {
  const { bling_ids } = req.body || {};
  if (!Array.isArray(bling_ids) || bling_ids.length === 0) {
    return reply.code(400).send({ error: 'bling_ids array required' });
  }

  // Sanitiza para apenas numeros
  const ids = bling_ids.map(Number).filter(n => Number.isFinite(n) && n > 0);
  if (ids.length === 0) {
    return reply.code(400).send({ error: 'no valid bling_ids' });
  }

  const placeholders = ids.map(() => '?').join(',');
  const [result] = await pool.query(
    `UPDATE products SET is_parent = 1 WHERE bling_id IN (${placeholders})`,
    ids
  );

  return {
    requested: ids.length,
    affected: result.affectedRows,
    changed: result.changedRows,
  };
});

// Adiciona indices para o linkage pai/filho (Bling). Idempotente.
// Disparar manualmente uma vez apos as colunas existirem (runMigrations cuida disso no boot).
fastify.post('/admin/migrate/parent-linkage-indexes', { preHandler: requireSyncKey }, async (req, reply) => {
  const results = [];
  // Nota sobre key length: parent_id e bling_parent_id foram criados como TEXT
  // pelo cadastro manual anterior (drift do schema vs tipos no codigo).
  // MySQL exige key length para indexar TEXT/BLOB. 36 cobre UUID, 20 cobre BIGINT em texto.
  // bling_id e is_parent usam tipos numericos corretos (sem prefixo necessario).
  const indexes = [
    { name: 'idx_products_parent_id',        table: 'products', cols: '(parent_id(36))' },
    { name: 'idx_products_bling_id',         table: 'products', cols: '(bling_id)' },
    { name: 'idx_products_bling_parent_id',  table: 'products', cols: '(bling_parent_id(20))' },
    { name: 'idx_products_is_parent',        table: 'products', cols: '(is_parent)' },
  ];
  for (const { name, table, cols } of indexes) {
    try {
      const [[row]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, name]
      );
      if (Number(row.cnt) > 0) {
        results.push({ index: name, skipped: true, reason: 'already exists' });
        continue;
      }
      await pool.query(`CREATE INDEX \`${name}\` ON \`${table}\` ${cols}`);
      results.push({ index: name, ok: true });
    } catch (e) {
      results.push({ index: name, ok: false, error: e.message });
    }
  }
  return { migrated: true, results };
});


// Presets de campos de categoria: grupos pré-configurados de visibilidade

fastify.get('/field-presets', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT id, name, description, config, created_at, updated_at
     FROM field_presets
     ORDER BY name ASC`
  );
  return rows.map(r => ({
    ...r,
    config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config,
  }));
});

fastify.post('/field-presets', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name, description, config } = req.body || {};
  if (!name || !config) return reply.code(400).send({ error: 'name and config required' });
  const [result] = await pool.query(
    `INSERT INTO field_presets (id, name, description, config)
     VALUES (UUID(), ?, ?, ?)`,
    [name, description || null, jsonStr(config)]
  );
  const [rows] = await pool.query('SELECT * FROM field_presets WHERE id = (SELECT id FROM field_presets ORDER BY created_at DESC LIMIT 1)');
  const row = rows[0];
  return { ...row, config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config };
});

fastify.put('/field-presets/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name, description, config } = req.body || {};
  if (!name || !config) return reply.code(400).send({ error: 'name and config required' });
  await pool.query(
    `UPDATE field_presets SET name=?, description=?, config=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [name, description || null, jsonStr(config), req.params.id]
  );
  return { ok: true };
});

fastify.delete('/field-presets/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM field_presets WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── Categories ────────────────────────────────────────────────────────────
fastify.get('/categories', { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } }, async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT id, parent_id, name, slug, config, warranty_days, production_days, sort_order,
            extended_warranty_enabled, margin_wholesale, margin_reseller,
            created_at, updated_at
     FROM categories
     ORDER BY sort_order ASC, name ASC`
  );
  const result = rows.map(r => ({
    ...r,
    config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config,
  }));
  reply.header('Cache-Control', 'public, max-age=60, s-maxage=120');
  return result;
});

// POST /categories — criar nova categoria
fastify.post('/categories', { preHandler: requireSyncKey }, async (req, reply) => {
  const b = req.body;
  if (!b.id || !b.name) return reply.code(400).send({ error: 'id e name são obrigatórios' });

  const slug = b.slug || b.name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  await pool.query(
    `INSERT INTO categories (id, parent_id, name, slug, config, warranty_days, production_days,
       sort_order, extended_warranty_enabled, margin_wholesale, margin_reseller, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       parent_id = VALUES(parent_id), name = VALUES(name), slug = VALUES(slug),
       config = VALUES(config), warranty_days = VALUES(warranty_days),
       production_days = VALUES(production_days), sort_order = VALUES(sort_order),
       extended_warranty_enabled = VALUES(extended_warranty_enabled),
       margin_wholesale = VALUES(margin_wholesale), margin_reseller = VALUES(margin_reseller),
       updated_at = NOW()`,
    [
      b.id, b.parent_id || null, b.name, slug,
      jsonStr(b.config || {}),
      b.warranty_days || 90, b.production_days || 0, b.sort_order || 0,
      b.extended_warranty_enabled ? 1 : 0,
      b.margin_wholesale || null, b.margin_reseller || null,
    ]
  );
  reply.code(201).send({ ok: true, id: b.id });
});

// PUT /categories/:id — atualizar categoria
fastify.put('/categories/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const { id } = req.params;
  const b = req.body;

  const slug = b.slug || (b.name ? b.name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : undefined);

  const hasParentId = Object.prototype.hasOwnProperty.call(b, 'parent_id');

  if (hasParentId) {
    await pool.query(
      `UPDATE categories SET
         parent_id = ?, name = ?, slug = ?, config = ?, warranty_days = ?,
         production_days = ?, sort_order = ?, extended_warranty_enabled = ?,
         margin_wholesale = ?, margin_reseller = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        b.parent_id || null,
        b.name, slug, jsonStr(b.config || {}),
        b.warranty_days || 90, b.production_days || 0, b.sort_order ?? 0,
        b.extended_warranty_enabled ? 1 : 0,
        b.margin_wholesale || null, b.margin_reseller || null,
        id,
      ]
    );
  } else {
    await pool.query(
      `UPDATE categories SET
         name = ?, slug = ?, config = ?, warranty_days = ?,
         production_days = ?, sort_order = ?, extended_warranty_enabled = ?,
         margin_wholesale = ?, margin_reseller = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        b.name, slug, jsonStr(b.config || {}),
        b.warranty_days || 90, b.production_days || 0, b.sort_order ?? 0,
        b.extended_warranty_enabled ? 1 : 0,
        b.margin_wholesale || null, b.margin_reseller || null,
        id,
      ]
    );
  }
  reply.send({ ok: true });
});

// DELETE /categories/:id — excluir categoria
fastify.delete('/categories/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const { id } = req.params;
  await pool.query('DELETE FROM categories WHERE id = ?', [id]);
  reply.send({ ok: true });
});

// PATCH /categories/sort-order — reordenar múltiplas categorias e/ou reparentar
fastify.patch('/categories/sort-order', { preHandler: requireSyncKey }, async (req, reply) => {
  const updates = req.body; // Array<{ id, sort_order, parent_id? }>
  if (!Array.isArray(updates) || updates.length === 0) return reply.code(400).send({ error: 'Array esperado' });

  await Promise.all(updates.map(u => {
    const hasParentId = Object.prototype.hasOwnProperty.call(u, 'parent_id');
    if (hasParentId) {
      return pool.query(
        `UPDATE categories SET sort_order = ?, parent_id = ?, updated_at = NOW() WHERE id = ?`,
        [u.sort_order ?? 0, u.parent_id || null, u.id]
      );
    }

    return pool.query(
      `UPDATE categories SET sort_order = ?, updated_at = NOW() WHERE id = ?`,
      [u.sort_order ?? 0, u.id]
    );
  }));
  reply.send({ ok: true, updated: updates.length });
});

// ─── Produtos por categoria (painel admin de categorias) ───────────────────
fastify.get('/products/by-category/:categoryId', async (req, reply) => {
  const { categoryId } = req.params;
  const page  = Math.max(1, parseInt(req.query.page  || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20')));
  const offset = (page - 1) * limit;

  // Exclui produtos pai (agregadores) - eles nao sao vendaveis na vitrine
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM products
     WHERE category_id = ? AND (is_parent = 0 OR is_parent IS NULL)`,
    [categoryId]
  );

  const [rows] = await pool.query(
    `SELECT
       id, name, sku, brand, category_id, status,
       price_retail, stock_quantity,
       JSON_UNQUOTE(JSON_EXTRACT(images, '$[0]')) AS thumbnail,
       1 AS is_primary_category
     FROM products
     WHERE category_id = ? AND (is_parent = 0 OR is_parent IS NULL)
     ORDER BY name ASC
     LIMIT ? OFFSET ?`,
    [categoryId, limit, offset]
  );

  return {
    items: rows,
    total: Number(total),
    page,
    limit,
    hasMore: offset + rows.length < Number(total),
  };
});

// ─── Category product counts (para navegação do catálogo) ──────────────────
fastify.get('/products/category-counts', { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } }, async (req, reply) => {
  const [[categories], [counts]] = await Promise.all([
    pool.query(
      `SELECT id, parent_id
       FROM categories`
    ),
    pool.query(
      `SELECT
         category_id,
         COUNT(*) AS count,
         SUM(CASE WHEN (track_inventory = 0 OR stock_quantity > 0) THEN 1 ELSE 0 END) AS in_stock_count
       FROM products
       WHERE status = 'active' AND category_id IS NOT NULL
         AND (is_parent = 0 OR is_parent IS NULL)
       GROUP BY category_id`
    ),
  ]);

  const countMap = {};
  for (const row of counts) {
    countMap[row.category_id] = {
      count: Number(row.count) || 0,
      in_stock_count: Number(row.in_stock_count) || 0,
    };
  }

  categories.forEach(cat => {
    if (!countMap[cat.id]) countMap[cat.id] = { count: 0, in_stock_count: 0 };
  });

  categories.filter(c => !c.parent_id).forEach(parent => {
    const children = categories.filter(c => c.parent_id === parent.id);
    for (const child of children) {
      countMap[parent.id].count += countMap[child.id]?.count || 0;
      countMap[parent.id].in_stock_count += countMap[child.id]?.in_stock_count || 0;
    }
  });

  const rows = categories.map(cat => ({
    category_id: cat.id,
    count: countMap[cat.id]?.count || 0,
    in_stock_count: countMap[cat.id]?.in_stock_count || 0,
  }));

  reply.header('Cache-Control', 'public, max-age=60, s-maxage=180');
  return rows;
});

// ─── Catalog Metadata (1 chamada = categorias+counts+marcas+preços) ─────────
// Substitui 3-4 queries separadas ao Supabase. Resultado cacheável por 5 min.
fastify.get('/catalog/metadata', { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } }, async (req, reply) => {
  const [[categories], [counts], [brands], [priceRow]] = await Promise.all([
    // 1. Todas as categorias com parent_id e sort_order
    pool.query(
      `SELECT id, name, parent_id, sort_order
       FROM categories
       ORDER BY sort_order ASC, name ASC`
    ),
    // 2. Contagem de produtos ativos por categoria (com in_stock_count)
    pool.query(
      `SELECT
         category_id,
         COUNT(*) AS count,
         SUM(CASE WHEN (track_inventory = 0 OR stock_quantity > 0) THEN 1 ELSE 0 END) AS in_stock_count
       FROM products
       WHERE status = 'active' AND category_id IS NOT NULL
         AND (is_parent = 0 OR is_parent IS NULL)
       GROUP BY category_id`
    ),
    // 3. Marcas únicas com contagem (exclui produtos pai)
    pool.query(
      `SELECT brand AS name, COUNT(*) AS count
       FROM products
       WHERE status = 'active' AND brand IS NOT NULL AND brand != ''
         AND (is_parent = 0 OR is_parent IS NULL)
       GROUP BY brand
       ORDER BY count DESC`
    ),
    // 4. Faixa de preços (min/max) (exclui produtos pai)
    pool.query(
      `SELECT MIN(price_retail) AS min_price, MAX(price_retail) AS max_price
       FROM products
       WHERE status = 'active' AND price_retail > 0
         AND (is_parent = 0 OR is_parent IS NULL)`
    ),
  ]);

  // Montar mapa de counts por category_id com base nos produtos diretos
  const countMap = {};
  for (const row of counts) {
    countMap[row.category_id] = {
      count: Number(row.count) || 0,
      in_stock_count: Number(row.in_stock_count) || 0,
    };
  }

  // Garantir que toda categoria tenha registro no countMap
  categories.forEach(cat => {
    if (!countMap[cat.id]) countMap[cat.id] = { count: 0, in_stock_count: 0 };
  });

  // Agregar contagem de filhos para as categorias pai
  categories.filter(c => !c.parent_id).forEach(parent => {
    const children = categories.filter(c => c.parent_id === parent.id);
    for (const child of children) {
      countMap[parent.id].count += (countMap[child.id]?.count || 0);
      countMap[parent.id].in_stock_count += (countMap[child.id]?.in_stock_count || 0);
    }
  });

  // Juntar categorias com seus counts
  const categoriesWithCounts = categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    parent_id: cat.parent_id || null,
    sort_order: cat.sort_order,
    count: countMap[cat.id]?.count || 0,
    in_stock_count: countMap[cat.id]?.in_stock_count || 0,
  }));

  const priceRange = priceRow[0]?.min_price != null
    ? { min: Number(priceRow[0].min_price), max: Number(priceRow[0].max_price) }
    : null;

  reply.header('Cache-Control', 'public, max-age=300, s-maxage=600');
  return {
    categories: categoriesWithCounts,
    brands: brands.map(b => ({ name: b.name, count: Number(b.count) })),
    priceRange,
  };
});


// ─── Brands (read) ─────────────────────────────────────────────────────────
fastify.get('/brands', { config: { rateLimit: { max: 180, timeWindow: '1 minute' } } }, async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT id, name, slug, logo_url, warranty_days, active FROM brands ORDER BY name`
  );
  reply.header('Cache-Control', 'public, max-age=300, s-maxage=600');
  return rows;
});

// ─── Brand CRUD (write) ────────────────────────────────────────────────────
fastify.post('/brands', { preHandler: requireSyncKey }, async (req, reply) => {
  const b = req.body;
  await pool.query(
    `INSERT INTO brands (id, name, slug, active, warranty_days, logo_url, company_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name=VALUES(name), slug=VALUES(slug), active=VALUES(active),
       warranty_days=VALUES(warranty_days), logo_url=VALUES(logo_url)`,
    [b.id, b.name, b.slug || null, b.active ? 1 : 1, b.warranty_days || 90, b.logo_url || null, b.company_id || null]
  );
  reply.code(201).send({ ok: true });
});

fastify.put('/brands/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const b = req.body;
  await pool.query(
    `UPDATE brands SET name=?, slug=?, active=?, warranty_days=?, logo_url=? WHERE id=?`,
    [b.name, b.slug || null, b.active ? 1 : 1, b.warranty_days || 90, b.logo_url || null, req.params.id]
  );
  return { ok: true };
});

fastify.delete('/brands/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query(`DELETE FROM brands WHERE id=?`, [req.params.id]);
  return { ok: true };
});

// ─── Products (read) ───────────────────────────────────────────────────────
fastify.get('/products', { config: { rateLimit: { max: 900, timeWindow: '1 minute' } } }, async (req, reply) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 500, 2000);
  const offset = parseInt(req.query.offset) || 0;
  const category = req.query.category;
  const status   = req.query.status;
  const search   = req.query.search;
  const favoritesOnly = req.query.favoritesOnly === 'true';
  const customerId = req.query.customerId;
  const compact  = req.query.compact === 'true'; // sem images (evita 90+ MB de base64)

  // Colunas — compact exclui base64 mas inclui primeira URL de imagem (thumbnail)
  const imgCol = compact
    ? `CASE
        WHEN images IS NOT NULL
          AND JSON_LENGTH(images) > 0
          AND JSON_UNQUOTE(JSON_EXTRACT(images, '$[0]')) LIKE 'http%'
        THEN JSON_ARRAY(JSON_UNQUOTE(JSON_EXTRACT(images, '$[0]')))
        ELSE JSON_ARRAY()
      END as images`
    : 'images';

  const cols = compact
    ? `id, model_id, category_id, brand, name, sku, ean, alternative_eans,
       price_cost, price_retail, price_reseller, price_wholesale,
       price_promo, promo_start, promo_end,
       is_combo, combo_discount_type, combo_discount_value,
       (CASE WHEN is_combo = 1 THEN COALESCE((SELECT MIN(FLOOR(child.stock_quantity / pc.quantity)) FROM product_combos pc JOIN products child ON child.id = pc.child_product_id WHERE pc.combo_product_id = products.id), 0) ELSE stock_quantity END) AS stock_quantity,
       track_inventory, is_gift,
       warranty_type, warranty_template_id,
       ${imgCol},
       status, parent_id, is_parent, bling_id, bling_parent_id, video_url,
       slug, origin, specs, custom_fields, kits, exclude_from_seo, meta_title, meta_description, keywords, view_count, production_days, created_at, updated_at`
    : `id, model_id, category_id, brand, name, sku, ean, alternative_eans,
       price_cost, price_retail, price_reseller, price_wholesale,
       price_promo, promo_start, promo_end,
       is_combo, combo_discount_type, combo_discount_value,
       (CASE WHEN is_combo = 1 THEN COALESCE((SELECT MIN(FLOOR(child.stock_quantity / pc.quantity)) FROM product_combos pc JOIN products child ON child.id = pc.child_product_id WHERE pc.combo_product_id = products.id), 0) ELSE stock_quantity END) AS stock_quantity,
       track_inventory, is_gift,
       warranty_type, warranty_template_id,
       images, status, parent_id, is_parent, bling_id, bling_parent_id, video_url,
       slug, origin, specs, custom_fields, kits, exclude_from_seo, meta_title, meta_description, keywords, view_count, production_days, created_at, updated_at`;


  let sql = `SELECT ${cols} FROM products WHERE 1=1`;
  const params = [];

  if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
  else if (!status && !search)    { sql += ' AND status = ?'; params.push('active'); }
  // When search is provided without explicit status → no status filter (allows finding by SKU/EAN regardless of status)
  // status=all: retorna todos os status (admin)

  // Filtro de produtos pai (agregadores). Por padrao escondemos da vitrine publica.
  // Admin (status=all) ou consumidores que precisem ver pais devem passar include_parents=true.
  const includeParents = req.query.include_parents === 'true' || status === 'all';
  if (!includeParents) {
    sql += ' AND (is_parent = 0 OR is_parent IS NULL)';
  }

  if (category) {
    const categoryIds = String(category).split(',').map(id => id.trim()).filter(Boolean);
    if (categoryIds.length === 1) {
      sql += ' AND category_id = ?';
      params.push(categoryIds[0]);
    } else if (categoryIds.length > 1) {
      const placeholders = categoryIds.map(() => '?').join(',');
      sql += ` AND category_id IN (${placeholders})`;
      params.push(...categoryIds);
    }
  }
  if (search)             { sql += ' AND (name LIKE ? OR sku LIKE ? OR ean LIKE ? OR model_id LIKE ? OR slug LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  if (req.query.parent_id){ sql += ' AND parent_id = ?';     params.push(req.query.parent_id); }
  if (req.query.sku)      { sql += ' AND sku = ?';           params.push(req.query.sku); }
  if (req.query.ean)      { sql += ' AND (ean = ? OR JSON_CONTAINS(alternative_eans, JSON_QUOTE(?)))'; params.push(req.query.ean, req.query.ean); }
  if (req.query.model_id) { sql += ' AND model_id = ?';      params.push(req.query.model_id); }
  if (req.query.bling_id) { sql += ' AND bling_id = ?';     params.push(req.query.bling_id); }

  if (favoritesOnly && customerId) {
    sql += ' AND id IN (SELECT product_id FROM customer_favorites WHERE customer_id = ?)';
    params.push(customerId);
  }

  // Ordenação dinâmica (whitelist contra SQL injection)
  const ALLOWED_SORT = ['name', 'created_at', 'updated_at', 'price_retail', 'view_count', 'sales_count', 'stock_quantity'];
  const sortBy  = ALLOWED_SORT.includes(req.query.sort_by) ? req.query.sort_by : 'name';
  const sortDir = req.query.sort_direction === 'desc' ? 'DESC' : 'ASC';
  sql += ` ORDER BY ${sortBy} ${sortDir} LIMIT ? OFFSET ?`;
  params.push(limit, offset);


  if (search || status === 'all') { // Log explicitly what we are about to query
    console.log(`[VPS GET /products] search="${search || ''}", status="${status || ''}", SQL: ${sql}`);
  }

  const [rows] = await pool.query(sql, params);
  
  if (search || status === 'all') {
    console.log(`[VPS GET /products] Returned ${rows.length} rows for search="${search || ''}"`);
  }

  const result = rows.map(r => ({
    ...r,
    images:           typeof r.images === 'string'           ? JSON.parse(r.images)           : (r.images ?? []),
    specs:            typeof r.specs === 'string'            ? JSON.parse(r.specs)            : r.specs,
    alternative_eans: typeof r.alternative_eans === 'string' ? JSON.parse(r.alternative_eans) : r.alternative_eans,
    custom_fields:    typeof r.custom_fields === 'string'    ? JSON.parse(r.custom_fields)    : r.custom_fields,
    kits:             typeof r.kits === 'string'             ? JSON.parse(r.kits)             : r.kits,
  }));

  // Sem cache para admin (status=all) ou buscas dinâmicas (search)
  // search requests NUNCA devem ser cacheados pelo CDN, pois o resultado
  // varia por query e o cache stale causaria resultados vazios persistentes.
  if (status === 'all' || search) {
    reply.header('Cache-Control', 'no-store');
  } else {
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=180');
  }
  return result;

});

fastify.get('/products/:id', { config: { rateLimit: { max: 900, timeWindow: '1 minute' } } }, async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT *,
      (CASE WHEN is_combo = 1 THEN COALESCE((SELECT MIN(FLOOR(child.stock_quantity / pc.quantity)) FROM product_combos pc JOIN products child ON child.id = pc.child_product_id WHERE pc.combo_product_id = products.id), 0) ELSE stock_quantity END) AS stock_quantity
     FROM products WHERE id = ?`, 
    [req.params.id]
  );
  if (!rows.length) { reply.code(404); return { error: 'Not found' }; }
  const r = rows[0];
  return {
    ...r,
    images:           typeof r.images === 'string'           ? JSON.parse(r.images)           : (r.images ?? []),
    specs:            typeof r.specs === 'string'            ? JSON.parse(r.specs)            : r.specs,
    alternative_eans: typeof r.alternative_eans === 'string' ? JSON.parse(r.alternative_eans) : r.alternative_eans,
    custom_fields:    typeof r.custom_fields === 'string'    ? JSON.parse(r.custom_fields)    : r.custom_fields,
    kits:             typeof r.kits === 'string'             ? JSON.parse(r.kits)             : r.kits,
  };
});

// Busca por slug (para PublicProductPage)
// Fallback: se não encontrar por slug E o parâmetro for um UUID, busca por ID
fastify.get('/products/by-slug/:slug', async (req, reply) => {
  const slugParam = req.params.slug;

  let rows;
  [rows] = await pool.query(
    `SELECT *,
      (CASE WHEN is_combo = 1 THEN COALESCE((SELECT MIN(FLOOR(child.stock_quantity / pc.quantity)) FROM product_combos pc JOIN products child ON child.id = pc.child_product_id WHERE pc.combo_product_id = products.id), 0) ELSE stock_quantity END) AS stock_quantity
     FROM products WHERE slug = ?`,
    [slugParam]
  );

  // Fallback: slug pode ser um UUID (produto sem slug no banco)
  if (!rows.length && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(slugParam)) {
    [rows] = await pool.query(
      `SELECT *,
        (CASE WHEN is_combo = 1 THEN COALESCE((SELECT MIN(FLOOR(child.stock_quantity / pc.quantity)) FROM product_combos pc JOIN products child ON child.id = pc.child_product_id WHERE pc.combo_product_id = products.id), 0) ELSE stock_quantity END) AS stock_quantity
       FROM products WHERE id = ?`,
      [slugParam]
    );
  }

  if (!rows.length) { reply.code(404); return { error: 'Not found' }; }
  const r = rows[0];

  // Se eh produto pai (agregador), retorna apenas redirect_to_slug pro primeiro filho ativo.
  // O pai eh transparente pro cliente - URL eh redirecionada pelo frontend pra um filho real.
  // Ordena por estoque (preferindo com estoque) e nome.
  if (Number(r.is_parent) === 1) {
    const [variantRows] = await pool.query(
      `SELECT slug FROM products
       WHERE parent_id = ?
         AND status = 'active'
         AND id != ?
         AND slug IS NOT NULL AND slug != ''
       ORDER BY (CASE WHEN (track_inventory = 0 OR stock_quantity > 0) THEN 0 ELSE 1 END), name ASC
       LIMIT 1`,
      [r.id, r.id]
    );
    if (variantRows.length > 0 && variantRows[0].slug) {
      return {
        is_parent_redirect: true,
        redirect_to_slug: variantRows[0].slug,
      };
    }
    // Pai sem filhos disponiveis - retorna 404
    reply.code(404);
    return { error: 'No available variants for this parent' };
  }

  return {
    ...r,
    images:           typeof r.images === 'string'           ? JSON.parse(r.images)           : (r.images ?? []),
    specs:            typeof r.specs === 'string'            ? JSON.parse(r.specs)            : r.specs,
    alternative_eans: typeof r.alternative_eans === 'string' ? JSON.parse(r.alternative_eans) : r.alternative_eans,
    custom_fields:    typeof r.custom_fields === 'string'    ? JSON.parse(r.custom_fields)    : r.custom_fields,
    kits:             typeof r.kits === 'string'             ? JSON.parse(r.kits)             : r.kits,
  };
});

// Busca por EAN
fastify.get('/products/by-ean/:ean', async (req, reply) => {
  const ean = req.params.ean;
  const [rows] = await pool.query(
    `SELECT *, (CASE WHEN is_combo = 1 THEN 0 ELSE stock_quantity END) AS stock_quantity
     FROM products
     WHERE ean = ? OR JSON_CONTAINS(alternative_eans, JSON_QUOTE(?))`,
    [ean, ean]
  );
  return rows.map(r => ({
    ...r,
    images:           typeof r.images === 'string'           ? JSON.parse(r.images)           : (r.images ?? []),
    specs:            typeof r.specs === 'string'            ? JSON.parse(r.specs)            : r.specs,
    alternative_eans: typeof r.alternative_eans === 'string' ? JSON.parse(r.alternative_eans) : r.alternative_eans,
    kits:             typeof r.kits === 'string'             ? JSON.parse(r.kits)             : r.kits,
  }));
});

fastify.get('/products/:id/combo', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT pc.child_product_id as id, pc.quantity, p.name, p.sku, p.price_retail, p.price_cost, p.images, p.stock_quantity
     FROM product_combos pc
     JOIN products p ON p.id = pc.child_product_id
     WHERE pc.combo_product_id = ?`,
    [req.params.id]
  );
  return rows.map(r => ({
    ...r,
    images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images
  }));
});


// ─── Products (write) ──────────────────────────────────────────────────────

// Batch upsert — used by Bling import and admin writes
fastify.post('/products/batch', { preHandler: requireSyncKey }, async (req, reply) => {
  const products = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return reply.code(400).send({ error: 'Expected non-empty array' });
  }

  const results = { upserted: 0, errors: [] };

  for (const p of products) {
    try {
      await pool.query(
        `INSERT INTO products (
          id, name, slug, sku, ean, alternative_eans, description,
          price_retail, price_wholesale, price_cost, price_reseller,
          price_promo, promo_start, promo_end,
          stock_quantity, status, category_id, brand, model_id,
          images, specs, custom_fields, dimensions, weight_kg,
          ncm, cest, origin, bling_id, bling_parent_id, parent_id,
          video_url, track_inventory, is_gift, is_virtual,
          warranty_type, warranty_template_id, company_id, kits,
          meta_title, meta_description, keywords
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          name=IF(VALUES(name) IS NULL, name, VALUES(name)),
          slug=IF(VALUES(slug) IS NULL, slug, VALUES(slug)),
          sku=IF(VALUES(sku) IS NULL, sku, VALUES(sku)),
          ean=IF(VALUES(ean) IS NULL, ean, VALUES(ean)),
          alternative_eans=IF(VALUES(alternative_eans) IS NULL, alternative_eans, VALUES(alternative_eans)),
          description=IF(VALUES(description) IS NULL, description, VALUES(description)),
          price_retail=IF(VALUES(price_retail) IS NULL, price_retail, VALUES(price_retail)),
          price_wholesale=IF(VALUES(price_wholesale) IS NULL, price_wholesale, VALUES(price_wholesale)),
          price_cost=IF(VALUES(price_cost) IS NULL, price_cost, VALUES(price_cost)),
          price_reseller=IF(VALUES(price_reseller) IS NULL, price_reseller, VALUES(price_reseller)),
          price_promo=IF(VALUES(price_promo) IS NULL, price_promo, VALUES(price_promo)),
          promo_start=IF(VALUES(promo_start) IS NULL, promo_start, VALUES(promo_start)),
          promo_end=IF(VALUES(promo_end) IS NULL, promo_end, VALUES(promo_end)),
          stock_quantity=IF(VALUES(stock_quantity) IS NULL, stock_quantity, VALUES(stock_quantity)),
          status=IF(VALUES(status) IS NULL, status, VALUES(status)),
          category_id=IF(VALUES(category_id) IS NULL, category_id, VALUES(category_id)),
          brand=IF(VALUES(brand) IS NULL, brand, VALUES(brand)),
          model_id=IF(VALUES(model_id) IS NULL, model_id, VALUES(model_id)),
          images=IF(VALUES(images) IS NULL, images, VALUES(images)),
          specs=IF(VALUES(specs) IS NULL, specs, VALUES(specs)),
          custom_fields=IF(VALUES(custom_fields) IS NULL, custom_fields, VALUES(custom_fields)),
          dimensions=IF(VALUES(dimensions) IS NULL, dimensions, VALUES(dimensions)),
          weight_kg=IF(VALUES(weight_kg) IS NULL, weight_kg, VALUES(weight_kg)),
          ncm=IF(VALUES(ncm) IS NULL, ncm, VALUES(ncm)),
          cest=IF(VALUES(cest) IS NULL, cest, VALUES(cest)),
          origin=IF(VALUES(origin) IS NULL, origin, VALUES(origin)),
          bling_id=IF(VALUES(bling_id) IS NULL, bling_id, VALUES(bling_id)),
          bling_parent_id=IF(VALUES(bling_parent_id) IS NULL, bling_parent_id, VALUES(bling_parent_id)),
          parent_id=IF(VALUES(parent_id) IS NULL, parent_id, VALUES(parent_id)),
          video_url=IF(VALUES(video_url) IS NULL, video_url, VALUES(video_url)),
          track_inventory=IF(VALUES(track_inventory) IS NULL, track_inventory, VALUES(track_inventory)),
          is_gift=IF(VALUES(is_gift) IS NULL, is_gift, VALUES(is_gift)),
          is_virtual=IF(VALUES(is_virtual) IS NULL, is_virtual, VALUES(is_virtual)),
          warranty_type=IF(VALUES(warranty_type) IS NULL, warranty_type, VALUES(warranty_type)),
          warranty_template_id=IF(VALUES(warranty_template_id) IS NULL, warranty_template_id, VALUES(warranty_template_id)),
          kits=IF(VALUES(kits) IS NULL, kits, VALUES(kits)),
          meta_title=IF(VALUES(meta_title) IS NULL, meta_title, VALUES(meta_title)),
          meta_description=IF(VALUES(meta_description) IS NULL, meta_description, VALUES(meta_description)),
          keywords=IF(VALUES(keywords) IS NULL, keywords, VALUES(keywords)),
          updated_at=CURRENT_TIMESTAMP`,
        [
          p.id, p.name, p.slug || null, p.sku || null,
          p.ean || null, jsonStr(p.alternative_eans), p.description || null,
          p.price_retail ?? null, p.price_wholesale ?? null,
          p.price_cost ?? null, p.price_reseller ?? null,
          p.price_promo ?? null, p.promo_start || null, p.promo_end || null,
          p.stock_quantity ?? null, p.status ?? null,
          p.category_id || null, p.brand || null, p.model_id || null,
          jsonStr(p.images), jsonStr(p.specs), jsonStr(p.custom_fields),
          jsonStr(p.dimensions), p.weight_kg || null,
          p.ncm || null, p.cest || null, p.origin || null,
          p.bling_id || null, p.bling_parent_id || null, p.parent_id || null,
          p.video_url || null,
          optionalBool(p.track_inventory), optionalBool(p.is_gift), optionalBool(p.is_virtual),
          p.warranty_type ?? null, p.warranty_template_id || null,
          p.company_id || null, jsonStr(p.kits),
          p.meta_title || null, p.meta_description || null, p.keywords || null,
        ]
      );
      results.upserted++;
    } catch (err) {
      results.errors.push({ id: p.id, name: p.name, error: err.message });
    }
  }

  return results;
});

// Price/stock sync: deliberately updates only commercial fields.
fastify.patch('/products/prices-stock', { preHandler: requireSyncKey }, async (req, reply) => {
  const products = Array.isArray(req.body) ? req.body : req.body?.products;
  if (!Array.isArray(products) || products.length === 0) {
    return reply.code(400).send({ error: 'Expected non-empty array' });
  }

  const allowedFields = [
    'price_retail',
    'price_wholesale',
    'price_cost',
    'price_reseller',
    'price_promo',
    'promo_start',
    'promo_end',
    'stock_quantity',
    'status',
    'category_id',
    'track_inventory',
  ];
  const results = { updated: 0, skipped: 0, errors: [] };

  for (const p of products) {
    try {
      const sets = [];
      const params = [];
      for (const field of allowedFields) {
        if (p[field] !== undefined) {
          sets.push(`${field}=?`);
          params.push(field === 'track_inventory' ? (p[field] ? 1 : 0) : p[field]);
        }
      }

      if (sets.length === 0 || (!p.id && !p.sku)) {
        results.skipped++;
        continue;
      }

      sets.push('updated_at=CURRENT_TIMESTAMP');
      const where = p.id ? 'id=?' : 'sku=?';
      params.push(p.id || p.sku);
      const [result] = await pool.query(
        `UPDATE products SET ${sets.join(', ')} WHERE ${where}`,
        params
      );
      results.updated += result.affectedRows || 0;
    } catch (err) {
      results.errors.push({ id: p.id, sku: p.sku, error: err.message });
    }
  }

  return results;
});

// Single product update
fastify.put('/products/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const p = req.body;
  await pool.query(
    `UPDATE products SET
      name=?, slug=?, sku=?, ean=?, alternative_eans=?,
      price_retail=?, price_wholesale=?, price_cost=?, price_reseller=?,
      price_promo=?, promo_start=?, promo_end=?,
      stock_quantity=?, status=?, category_id=?, brand=?, model_id=?,
      images=?, specs=?, custom_fields=?, dimensions=?, weight_kg=?,
      ncm=?, cest=?, origin=?, bling_id=?, bling_parent_id=?, parent_id=?,
      video_url=?, track_inventory=?, is_gift=?,
      warranty_type=?, warranty_template_id=?, kits=?,
      meta_title=?, meta_description=?, keywords=?,
      production_days=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?`,
    [
      p.name, p.slug || null, p.sku || null,
      p.ean || null, jsonStr(p.alternative_eans),
      p.price_retail || null, p.price_wholesale || null,
      p.price_cost || null, p.price_reseller || null,
      p.price_promo || null, p.promo_start || null, p.promo_end || null,
      p.stock_quantity || 0, p.status || 'active',
      p.category_id || null, p.brand || null, p.model_id || null,
      jsonStr(p.images), jsonStr(p.specs), jsonStr(p.custom_fields),
      jsonStr(p.dimensions), p.weight_kg || null,
      p.ncm || null, p.cest || null, p.origin || null,
      p.bling_id || null, p.bling_parent_id || null, p.parent_id || null,
      p.video_url || null,
      p.track_inventory ? 1 : 0, p.is_gift ? 1 : 0,
      p.warranty_type || 'brand', p.warranty_template_id || null, jsonStr(p.kits),
      p.meta_title || null, p.meta_description || null, p.keywords || null,
      p.production_days != null ? parseInt(p.production_days) : null,
      req.params.id,
    ]
  );
  return { ok: true };
});

// Delete product (and children)
fastify.delete('/products/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query(`DELETE FROM products WHERE id=? OR parent_id=?`, [req.params.id, req.params.id]);
  return { ok: true };
});

// Update images by SKU (used by image bank sync)
fastify.patch('/products/images', { preHandler: requireSyncKey }, async (req, reply) => {
  const { sku, images } = req.body || {};
  if (!sku || !images) return reply.code(400).send({ error: 'sku and images required' });
  const [result] = await pool.query(
    'UPDATE products SET images=?, updated_at=CURRENT_TIMESTAMP WHERE sku=?',
    [JSON.stringify(images), sku]
  );
  // affectedRows=0 means the SKU doesn't exist in VPS MySQL yet
  return { ok: true, affectedRows: result.affectedRows };
});

// Update description + technical_specifications by SKU (used by description sync)
fastify.patch('/products/description', { preHandler: requireSyncKey }, async (req, reply) => {
  const { sku, description, technical_specifications } = req.body || {};
  if (!sku) return reply.code(400).send({ error: 'sku required' });
  const [result] = await pool.query(
    'UPDATE products SET description=?, technical_specifications=?, updated_at=CURRENT_TIMESTAMP WHERE sku=?',
    [description ?? null, technical_specifications ?? null, sku]
  );
  return { ok: true, affectedRows: result.affectedRows };
});

// Update stock_quantity by SKU (used by Bling webhook — estoque event)
fastify.patch('/products/stock', { preHandler: requireSyncKey }, async (req, reply) => {
  const { sku, bling_id, stock_quantity } = req.body || {};
  if (!sku && !bling_id) return reply.code(400).send({ error: 'sku or bling_id required' });
  if (stock_quantity === undefined || stock_quantity === null) return reply.code(400).send({ error: 'stock_quantity required' });
  const qty = Math.max(0, parseInt(stock_quantity, 10) || 0);
  let result;
  if (sku) {
    [result] = await pool.query(
      'UPDATE products SET stock_quantity=?, updated_at=CURRENT_TIMESTAMP WHERE sku=?',
      [qty, sku]
    );
  } else {
    [result] = await pool.query(
      'UPDATE products SET stock_quantity=?, updated_at=CURRENT_TIMESTAMP WHERE bling_id=?',
      [qty, String(bling_id)]
    );
  }
  return { ok: true, affectedRows: result.affectedRows };
});

// Update product name by SKU (used by Bling webhook — produto event)
fastify.patch('/products/name', { preHandler: requireSyncKey }, async (req, reply) => {
  const { sku, name } = req.body || {};
  if (!sku || !name) return reply.code(400).send({ error: 'sku and name required' });
  const [result] = await pool.query(
    'UPDATE products SET name=?, updated_at=CURRENT_TIMESTAMP WHERE sku=?',
    [name, sku]
  );
  return { ok: true, affectedRows: result.affectedRows };
});


fastify.patch('/products/:id/seo', { preHandler: requireSyncKey }, async (req, reply) => {
  const { exclude_from_seo } = req.body;
  await pool.query(
    'UPDATE products SET exclude_from_seo=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [exclude_from_seo ? 1 : 0, req.params.id]
  );
  return { ok: true };
});

// Bulk update category + specs for multiple products
fastify.patch('/products/bulk-category', { preHandler: requireSyncKey }, async (req, reply) => {
  const { ids, category_id, specs } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return reply.code(400).send({ error: 'ids[] required' });
  }
  if (!category_id) {
    return reply.code(400).send({ error: 'category_id required' });
  }

  // Build placeholders for IN clause
  const placeholders = ids.map(() => '?').join(', ');

  if (specs && Object.keys(specs).length > 0) {
    // Merge specs: keep existing specs not overwritten by the new ones
    await pool.query(
      `UPDATE products
       SET category_id = ?,
           specs = JSON_MERGE_PATCH(COALESCE(specs, '{}'), ?),
           updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders})`,
      [category_id, JSON.stringify(specs), ...ids]
    );
  } else {
    await pool.query(
      `UPDATE products
       SET category_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders})`,
      [category_id, ...ids]
    );
  }

  return { ok: true, updated: ids.length };
});

// ─── Product Categories (multi-category) ──────────────────────────────────────
// POST /product-categories — adiciona produto a categoria extra
fastify.post('/product-categories', { preHandler: requireSyncKey }, async (req, reply) => {
  const { product_id, category_id } = req.body || {};
  if (!product_id || !category_id) {
    return reply.code(400).send({ error: 'product_id and category_id required' });
  }
  await pool.query(
    `INSERT IGNORE INTO product_categories (product_id, category_id) VALUES (?, ?)`,
    [product_id, category_id]
  );
  return { ok: true };
});

// DELETE /product-categories/:product_id/:category_id — remove produto de categoria extra
fastify.delete('/product-categories/:product_id/:category_id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query(
    `DELETE FROM product_categories WHERE product_id = ? AND category_id = ?`,
    [req.params.product_id, req.params.category_id]
  );
  return { ok: true };
});

// PATCH /products/:id/category — move produto para outra categoria principal
fastify.patch('/products/:id/category', { preHandler: requireSyncKey }, async (req, reply) => {
  const { category_id } = req.body || {};
  if (!category_id) return reply.code(400).send({ error: 'category_id required' });
  await pool.query(
    `UPDATE products SET category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [category_id, req.params.id]
  );
  // Remove da tabela extra caso estivesse lá para evitar duplicata visual
  await pool.query(
    `DELETE FROM product_categories WHERE product_id = ? AND category_id = ?`,
    [req.params.id, category_id]
  );
  return { ok: true };
});

// ─── Units (inventory de unidades serializadas: 1 linha por aparelho) ──────

// Lista unidades — filtra por product_id, order_id ou sale_id (FIFO por created_at)
fastify.get('/units', async (req, reply) => {
  const { product_id, order_id, sale_id, status } = req.query;
  const conds = [];
  const params = [];
  if (product_id) { conds.push('product_id = ?'); params.push(product_id); }
  if (order_id)   { conds.push('order_id = ?');   params.push(order_id); }
  if (sale_id)    { conds.push('sale_id = ?');    params.push(sale_id); }
  if (status && status !== 'all') { conds.push('status = ?'); params.push(status); }
  if (conds.length === 0) return reply.code(400).send({ error: 'product_id, order_id or sale_id required' });
  const [rows] = await pool.query(
    `SELECT * FROM units WHERE ${conds.join(' AND ')} ORDER BY created_at ASC`,
    params
  );
  return rows;
});

// Busca por IMEI 1, IMEI 2 ou serial (usado no PDV)
fastify.get('/units/by-identifier/:q', async (req, reply) => {
  const q = req.params.q;
  if (!q) return reply.code(400).send({ error: 'identifier required' });
  const [rows] = await pool.query(
    `SELECT u.*, p.name AS product_name, p.sku AS product_sku
       FROM units u
       LEFT JOIN products p ON p.id = u.product_id
      WHERE u.imei_1 = ? OR u.imei_2 = ? OR u.serial = ?`,
    [q, q, q]
  );
  return rows;
});

// Cria 1 unidade
fastify.post('/units', { preHandler: requireSyncKey }, async (req, reply) => {
  const u = req.body || {};
  if (!u.product_id) return reply.code(400).send({ error: 'product_id required' });
  const id = u.id || require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO units (
       id, product_id, imei_1, imei_2, serial, status, \`condition\`,
       internal_notes, cost_price, order_id, sale_id, reserved_at, sold_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, u.product_id,
      u.imei_1 || null, u.imei_2 || null, u.serial || null,
      u.status || 'available',
      u.condition || 'new',
      u.internal_notes || null,
      u.cost_price ?? null,
      u.order_id || null, u.sale_id || null,
      u.reserved_at || null, u.sold_at || null,
    ]
  );
  await syncProductStock(u.product_id);
  const [rows] = await pool.query('SELECT * FROM units WHERE id = ?', [id]);
  reply.code(201);
  return rows[0];
});

// Cria N unidades em batch (usado pelo cadastro em massa)
fastify.post('/units/batch', { preHandler: requireSyncKey }, async (req, reply) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return reply.code(400).send({ error: 'Expected non-empty array' });
  }
  const results = { inserted: 0, errors: [] };
  const productIds = new Set();
  for (const u of items) {
    try {
      if (!u.product_id) throw new Error('product_id required');
      const id = u.id || require('crypto').randomUUID();
      await pool.query(
        `INSERT INTO units (
           id, product_id, imei_1, imei_2, serial, status, \`condition\`,
           internal_notes, cost_price
         ) VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          id, u.product_id,
          u.imei_1 || null, u.imei_2 || null, u.serial || null,
          u.status || 'available',
          u.condition || 'new',
          u.internal_notes || null,
          u.cost_price ?? null,
        ]
      );
      productIds.add(u.product_id);
      results.inserted++;
    } catch (err) {
      results.errors.push({ serial: u.serial, imei_1: u.imei_1, error: err.message });
    }
  }
  for (const pid of productIds) await syncProductStock(pid);
  return results;
});

// Atualiza unidade (status, IMEIs, notes, vínculos com order/sale)
fastify.put('/units/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const u = req.body || {};
  const allowed = [
    'imei_1', 'imei_2', 'serial', 'status', 'condition',
    'internal_notes', 'cost_price', 'order_id', 'sale_id',
    'reserved_at', 'sold_at',
  ];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (k in u) {
      sets.push(k === 'condition' ? '`condition` = ?' : `${k} = ?`);
      vals.push(u[k] ?? null);
    }
  }
  if (!sets.length) return reply.code(400).send({ error: 'No fields to update' });
  vals.push(req.params.id);
  await pool.query(`UPDATE units SET ${sets.join(', ')} WHERE id = ?`, vals);
  const [rows] = await pool.query('SELECT * FROM units WHERE id = ?', [req.params.id]);
  if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
  await syncProductStock(rows[0].product_id);
  return rows[0];
});

// Deleta unidade
fastify.delete('/units/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const [target] = await pool.query('SELECT product_id FROM units WHERE id = ?', [req.params.id]);
  const [result] = await pool.query('DELETE FROM units WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return reply.code(404).send({ error: 'Not found' });
  if (target[0]) await syncProductStock(target[0].product_id);
  return { ok: true };
});

// ─── Combos (write) ─────────────────────────────────────────────────────────

fastify.post('/combos', { preHandler: requireSyncKey }, async (req, reply) => {
  // expects body to be a Product payload + `combo_children` (array of { id, quantity })
  const p = req.body;
  const id = p.id || require('crypto').randomUUID();
  const children = p.combo_children || [];
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO products (
        id, name, slug, sku, is_combo, combo_discount_type, combo_discount_value,
        price_retail, price_wholesale, price_cost, price_reseller,
        status, track_inventory, images, category_id, brand,
        description, specs, dimensions, weight_kg, is_virtual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, p.name, p.slug || null, p.sku || null, 1, p.combo_discount_type || null, p.combo_discount_value || 0,
        p.price_retail || 0, p.price_wholesale || 0, p.price_cost || 0, p.price_reseller || 0,
        p.status || 'active', p.track_inventory ? 1 : 0, jsonStr(p.images), p.category_id || null, p.brand || null,
        p.description || null, jsonStr({ technical_specifications: p.technical_specifications, tags: p.tags }), jsonStr(p.dimensions), p.weight_kg || null, p.is_virtual ? 1 : 0
      ]
    );

    for (const child of children) {
      const pcId = require('crypto').randomUUID();
      await connection.query(
        `INSERT INTO product_combos (id, combo_product_id, child_product_id, quantity) VALUES (?, ?, ?, ?)`,
        [pcId, id, child.id, child.quantity || 1]
      );
    }
    
    await connection.commit();
    reply.code(201).send({ ok: true, id });
  } catch (err) {
    await connection.rollback();
    reply.code(500).send({ error: err.message });
  } finally {
    connection.release();
  }
});

fastify.put('/combos/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const p = req.body;
  const comboId = req.params.id;
  const children = p.combo_children || [];
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE products SET 
        name=?, slug=?, sku=?, is_combo=1, combo_discount_type=?, combo_discount_value=?,
        price_retail=?, price_wholesale=?, price_cost=?, price_reseller=?,
        status=?, images=?, category_id=?, brand=?, description=?, specs=?, dimensions=?, weight_kg=?, is_virtual=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [
        p.name, p.slug || null, p.sku || null, p.combo_discount_type || null, p.combo_discount_value || 0,
        p.price_retail || 0, p.price_wholesale || 0, p.price_cost || 0, p.price_reseller || 0,
        p.status || 'active', jsonStr(p.images), p.category_id || null, p.brand || null,
        p.description || null, jsonStr({ technical_specifications: p.technical_specifications, tags: p.tags }), jsonStr(p.dimensions), p.weight_kg || null, p.is_virtual ? 1 : 0,
        comboId
      ]
    );

    await connection.query(`DELETE FROM product_combos WHERE combo_product_id = ?`, [comboId]);

    for (const child of children) {
      const pcId = require('crypto').randomUUID();
      await connection.query(
        `INSERT INTO product_combos (id, combo_product_id, child_product_id, quantity) VALUES (?, ?, ?, ?)`,
        [pcId, comboId, child.id, child.quantity || 1]
      );
    }
    
    await connection.commit();
    reply.send({ ok: true, id: comboId });
  } catch (err) {
    await connection.rollback();
    reply.code(500).send({ error: err.message });
  } finally {
    connection.release();
  }
});


// ─── Image Bank ────────────────────────────────────────────────────────────

// POST /images/upload — salva arquivo no filesystem
// multipart/form-data: file (binary) + path (string)
fastify.post('/images/upload', { preHandler: requireSyncKey }, async (req, reply) => {
  const parts = req.parts();
  let fileBuf = null;
  let filePath = null;

  for await (const part of parts) {
    if (part.type === 'file' && part.fieldname === 'file') {
      const chunks = [];
      for await (const chunk of part.file) chunks.push(chunk);
      fileBuf = Buffer.concat(chunks);
    } else if (part.fieldname === 'path') {
      filePath = part.value;
    }
  }

  if (!fileBuf || !filePath) return reply.code(400).send({ error: 'file and path required' });

  // Sanitize: allow only approved media upload paths.
  const validation = validateMediaUploadPath(filePath);
  if (!validation.ok) {
    return reply.code(400).send({ error: validation.error || 'Invalid path' });
  }
  const safe = validation.safePath;

  const dest = path.join(UPLOADS_DIR, safe);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, fileBuf);

  const url = `${process.env.API_BASE_URL || 'https://api.xiaomipetrolina.com.br'}/images/${safe}`;
  return { ok: true, url, path: safe };
});

// GET /images/list?prefix=products/SKU — lista arquivos (recursivo) num prefixo
fastify.get('/images/list', async (req, reply) => {
  const prefix = (req.query.prefix || 'products').replace(/^\/+/, '');
  const dir = path.join(UPLOADS_DIR, prefix);
  const baseUrl = process.env.API_BASE_URL || 'https://api.xiaomipetrolina.com.br';

  if (!fs.existsSync(dir)) return [];

  function walkDir(d) {
    const entries = [];
    for (const item of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, item.name);
      if (item.isDirectory()) entries.push(...walkDir(full));
      else if (item.name.endsWith('.webp')) {
        const rel = path.relative(UPLOADS_DIR, full).replace(/\\/g, '/');
        entries.push({ path: rel, url: `${baseUrl}/images/${rel}`, filename: item.name });
      }
    }
    return entries;
  }

  reply.header('Cache-Control', 'no-store');
  return walkDir(dir);
});

// DELETE /images/file — remove arquivo
fastify.delete('/images/file', { preHandler: requireSyncKey }, async (req, reply) => {
  const filePath = req.body?.path;
  if (!filePath) return reply.code(400).send({ error: 'path required' });

  const safe = path.normalize(filePath).replace(/^\/+/, '');
  if (safe.startsWith('..') || !safe.startsWith('products/')) {
    return reply.code(400).send({ error: 'Invalid path' });
  }

  const dest = path.join(UPLOADS_DIR, safe);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  return { ok: true };
});

// ─── Company Settings ──────────────────────────────────────────────────────
fastify.get('/company-settings', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM company_settings LIMIT 1');
  reply.header('Cache-Control', 'no-store');
  return rows[0] || null;
});

fastify.get('/public/company-settings', { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } }, async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM company_settings LIMIT 1');
  reply.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800');
  return sanitizePublicCompanySettings(rows[0] || null);
});

// ─── Company Settings (PATCH) ─────────────────────────────────────────────
fastify.patch('/company-settings', { preHandler: requireSyncKey }, async (req, reply) => {
  const ALLOWED = [
    'company_name', 'address', 'phone', 'cnpj', 'email', 'header_text', 'footer_text',
    'warranty_terms', 'receipt_logo_url', 'receipt_width', 'show_company_info',
    'show_order_number', 'show_timestamp', 'show_seller_info', 'warranty_template',
    'warranty_show_logo', 'warranty_show_company_name', 'warranty_show_cnpj',
    'warranty_show_phone', 'warranty_show_email', 'warranty_show_address',
    'payment_receipt_template', 'receipt_extra_page_text', 'receipt_extra_page_qr_url',
    'receipt_show_extra_page', 'extended_warranty_options', 'extended_warranty_terms_text',
    'pix_discount_percentage', 'default_a4_header', 'default_thermal_header',
    'debt_clearance_template', 'delivery_receipt_template', 'extended_warranty_template',
    'ai_prompts', 'business_hours', 'holiday_overrides', 'local_holidays',
    'business_hours_display_text',
    'store_label_open', 'store_label_closed', 'store_label_closing_soon', 'store_label_lunch',
    'synology_video_base_url', 'synology_video_extension',

    // Campos de Identidade / Dados Gerais (usados por companyToRow em companyService.ts)
    'name', 'razao_social', 'state_registration', 'cnae', 'situacao_cadastral',
    'data_abertura', 'porte', 'logo', 'watermark_url', 'favicon',
    
    // Shopee Integration
    'shopee_partner_id', 'shopee_partner_key', 'shopee_shop_id', 
    'shopee_access_token', 'shopee_refresh_token',

    // Campos de Endereço Extensos
    'address_zip_code', 'address_street', 'address_number', 'address_complement',
    'address_neighborhood', 'address_city', 'address_state', 'address_lat', 'address_lng',
    
    // Redes Sociais e Contatos Visuais
    'social_instagram', 'social_facebook', 'social_youtube', 'social_website',
    'google_reviews_link',
    
    // Dados Financeiros
    'pix_key', 'pix_key_type', 'pix_beneficiary_name',
    'bank_name', 'bank_agency', 'bank_account',
    
    // Campos adicionais e integrações
    'description', 'internal_notes', 'google_analytics_id', 'catalog_footer_text',
    'maintenance_mode', 'maintenance_message', 'maintenance_bypass_key',
    'about_us_text', 'about_us_image_url'
  ];
  const body = req.body;
  const updates = [];
  const params = [];
  for (const key of ALLOWED) {
    if (key in body) {
      const val = body[key];
      updates.push(`${key} = ?`);
      params.push(val !== null && typeof val === 'object' ? JSON.stringify(val) : val);
    }
  }
  if (updates.length === 0) return reply.code(400).send({ error: 'No valid fields to update' });
  const [existing] = await pool.query('SELECT id FROM company_settings LIMIT 1');
  if (existing.length === 0) return reply.code(404).send({ error: 'No company settings found' });
  params.push(existing[0].id);
  await pool.query(`UPDATE company_settings SET ${updates.join(', ')} WHERE id = ?`, params);
  clearAutoresponderStoreStatusCache();
  const [rows] = await pool.query('SELECT * FROM company_settings WHERE id = ?', [existing[0].id]);
  return rows[0];
});

// ─── Versions CRUD ───────────────────────────────────────────────────────────
fastify.get('/versions', async (req, reply) => {
  const active = req.query.active;
  let sql = 'SELECT * FROM versions';
  const params = [];
  if (active !== undefined) { sql += ' WHERE active = ?'; params.push(Number(active)); }
  sql += ' ORDER BY name';
  const [rows] = await pool.query(sql, params);
  return rows;
});

fastify.get('/versions/:id', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM versions WHERE id = ?', [req.params.id]);
  return rows[0] || reply.code(404).send({ error: 'Not found' });
});

fastify.post('/versions', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name, active = 1 } = req.body;
  const id = require('crypto').randomUUID();
  await pool.query('INSERT INTO versions (id, name, active) VALUES (?, ?, ?)', [id, name, active ? 1 : 0]);
  const [rows] = await pool.query('SELECT * FROM versions WHERE id = ?', [id]);
  reply.code(201);
  return rows[0];
});

fastify.patch('/versions/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name, active } = req.body;
  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
  if (!updates.length) return reply.code(400).send({ error: 'No fields to update' });
  params.push(req.params.id);
  await pool.query(`UPDATE versions SET ${updates.join(', ')} WHERE id = ?`, params);
  const [rows] = await pool.query('SELECT * FROM versions WHERE id = ?', [req.params.id]);
  return rows[0] || reply.code(404).send({ error: 'Not found' });
});

fastify.delete('/versions/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const [result] = await pool.query('DELETE FROM versions WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return reply.code(404).send({ error: 'Not found' });
  return { ok: true };
});
// ─── Table Data Viewer (protegido por X-Sync-Key) ────────────────────────────
fastify.get('/table-data/:name', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  // Validar nome da tabela (apenas chars seguros)
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    return reply.code(400).send({ error: 'Invalid table name' });
  }

  const [[countRow]] = await pool.query(`SELECT COUNT(*) as total FROM \`${name}\``);
  const [rows] = await pool.query(`SELECT * FROM \`${name}\` LIMIT ? OFFSET ?`, [limit, offset]);

  return {
    table: name,
    total: Number(countRow.total),
    limit,
    offset,
    rows,
  };
});

// ─── Relatório Administrativo: Ranking de Favoritos ──────────────────────────
fastify.get('/admin/reports/favorites-ranking', { preHandler: requireSyncKey }, async (req, reply) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const sql = `
      SELECT 
        cf.product_id, 
        COUNT(cf.customer_id) as favorite_count,
        p.name, p.sku, p.images, p.price_retail, p.stock_quantity
      FROM customer_favorites cf
      JOIN products p ON p.id = cf.product_id
      GROUP BY cf.product_id
      ORDER BY favorite_count DESC
      LIMIT ?
    `;
    const [rows] = await pool.query(sql, [limit]);
    
    // Parse JSON images
    const result = rows.map(r => ({
      ...r,
      images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || [])
    }));
    
    return result;
  } catch (error) {
    console.error('Error fetching favorites ranking:', error);
    reply.code(500).send({ error: 'Failed to fetch favorites ranking' });
  }
});

// ─── Relatório Administrativo: Ranking de Carrinhos ──────────────────────────
fastify.get('/admin/reports/carts-ranking', { preHandler: requireSyncKey }, async (req, reply) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const sql = `
      SELECT 
        cc.product_id, 
        COUNT(DISTINCT cc.customer_id) as cart_count,
        SUM(cc.quantity) as total_quantity,
        p.name, p.sku, p.images, p.price_retail, p.stock_quantity
      FROM customer_carts cc
      JOIN products p ON p.id = cc.product_id
      GROUP BY cc.product_id
      ORDER BY cart_count DESC, total_quantity DESC
      LIMIT ?
    `;
    const [rows] = await pool.query(sql, [limit]);
    
    // Parse JSON images
    const result = rows.map(r => ({
      ...r,
      images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || [])
    }));
    
    return result;
  } catch (error) {
    console.error('Error fetching carts ranking:', error);
    reply.code(500).send({ error: 'Failed to fetch carts ranking' });
  }
});

// ─── Sincronização de Carrinho do Cliente ───────────────────────────────────────
fastify.post('/cart/sync', { preHandler: requireSyncKey }, async (req, reply) => {
  const { customerId, items } = req.body;
  if (!customerId || !Array.isArray(items)) {
    return reply.code(400).send({ error: 'customerId and items array required' });
  }

  const connection = await pool.getConnection();
  try {
    // Basic table creation check
    await connection.query(`CREATE TABLE IF NOT EXISTS customer_carts (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_id VARCHAR(255) NOT NULL,
      product_id CHAR(36) NOT NULL,
      quantity INT DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_unique_cart (customer_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

    await connection.beginTransaction();

    // Remove old cart items for this customer
    await connection.query('DELETE FROM customer_carts WHERE customer_id = ?', [customerId]);

    // Insert new cart items
    if (items.length > 0) {
      const values = items.map(i => [customerId, i.product_id, i.quantity]);
      await connection.query(
        'INSERT INTO customer_carts (customer_id, product_id, quantity) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    return { ok: true, synced: items.length };
  } catch (error) {
    await connection.rollback();
    console.error('Error syncing cart:', error);
    reply.code(500).send({ error: 'Failed to sync cart' });
  } finally {
    connection.release();
  }
});

// ─── Table CRUD (protegido por X-Sync-Key) ───────────────────────────────────

// Helper: detectar PK de uma tabela
async function getPrimaryKey(pool, tableName) {
  const [keys] = await pool.query(
    `SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY'`
  );
  return keys[0]?.Column_name || 'id';
}

// Validação de nome de tabela
function isValidTable(name) {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

// INSERT individual
fastify.post('/table-data/:name', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name } = req.params;
  if (!isValidTable(name)) return reply.code(400).send({ error: 'Invalid table name' });

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reply.code(400).send({ error: 'Body must be a JSON object' });
  }

  const cols = Object.keys(body);
  const vals = Object.values(body);
  const placeholders = cols.map(() => '?').join(', ');
  const colList = cols.map(c => `\`${c}\``).join(', ');

  await pool.query(
    `INSERT INTO \`${name}\` (${colList}) VALUES (${placeholders})`,
    vals
  );

  const pk = await getPrimaryKey(pool, name);
  const [rows] = await pool.query(
    `SELECT * FROM \`${name}\` WHERE \`${pk}\` = ? LIMIT 1`,
    [body[pk] ?? vals[0]]
  );

  reply.code(201);
  return rows[0] || { ok: true };
});

// INSERT em massa (array de objetos)
fastify.post('/table-data/:name/bulk', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name } = req.params;
  if (!isValidTable(name)) return reply.code(400).send({ error: 'Invalid table name' });

  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return reply.code(400).send({ error: 'Body must be a non-empty array' });
  }

  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `\`${c}\``).join(', ');
  const placeholders = `(${cols.map(() => '?').join(', ')})`;
  const allPlaceholders = rows.map(() => placeholders).join(', ');
  const allValues = rows.flatMap(r => cols.map(c => r[c] ?? null));

  await pool.query(
    `INSERT INTO \`${name}\` (${colList}) VALUES ${allPlaceholders}`,
    allValues
  );

  return { inserted: rows.length };
});

// UPDATE por PK
fastify.patch('/table-data/:name/:pkValue', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name, pkValue } = req.params;
  if (!isValidTable(name)) return reply.code(400).send({ error: 'Invalid table name' });

  const pkCol = req.query.pk || await getPrimaryKey(pool, name);
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reply.code(400).send({ error: 'Body must be a JSON object' });
  }

  const entries = Object.entries(body).filter(([k]) => k !== pkCol);
  if (!entries.length) return reply.code(400).send({ error: 'No fields to update' });

  const setClauses = entries.map(([k]) => `\`${k}\` = ?`).join(', ');
  const vals = [...entries.map(([, v]) => v), pkValue];

  await pool.query(`UPDATE \`${name}\` SET ${setClauses} WHERE \`${pkCol}\` = ?`, vals);

  const [rows] = await pool.query(`SELECT * FROM \`${name}\` WHERE \`${pkCol}\` = ? LIMIT 1`, [pkValue]);
  return rows[0] || reply.code(404).send({ error: 'Not found' });
});

// DELETE por PK
fastify.delete('/table-data/:name/:pkValue', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name, pkValue } = req.params;
  if (!isValidTable(name)) return reply.code(400).send({ error: 'Invalid table name' });

  const pkCol = req.query.pk || await getPrimaryKey(pool, name);
  const [result] = await pool.query(`DELETE FROM \`${name}\` WHERE \`${pkCol}\` = ?`, [pkValue]);

  if (result.affectedRows === 0) return reply.code(404).send({ error: 'Row not found' });
  return { ok: true, deleted: 1 };
});

// EXPORT completo (para backup)
fastify.get('/table-data/:name/export', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name } = req.params;
  if (!isValidTable(name)) return reply.code(400).send({ error: 'Invalid table name' });

  const [rows] = await pool.query(`SELECT * FROM \`${name}\``);
  reply.header('Content-Disposition', `attachment; filename="${name}.json"`);
  return rows;
});
﻿// --- Schema Inspector ---
fastify.get('/schema/tables', { preHandler: requireSyncKey }, async (req, reply) => {
  const [tables] = await pool.query('SHOW TABLES');
  const result = {};
  for (const row of tables) {
    const tableName = Object.values(row)[0];
    const [columns] = await pool.query('DESCRIBE ??', [tableName]);
    result[tableName] = columns.map(c => ({ field: c.Field, type: c.Type, null: c.Null, key: c.Key, default: c.Default }));
  }
  return result;
}); 
fastify.get('/schema/table/:name', { preHandler: requireSyncKey }, async (req, reply) => {
  const [columns] = await pool.query('DESCRIBE ??', [req.params.name]);
  return columns.map(c => ({ field: c.Field, type: c.Type, null: c.Null, key: c.Key, default: c.Default }));
});
// ─── Catalog Settings ──────────────────────────────────────────────────────
fastify.get('/catalog-settings', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM catalog_settings LIMIT 1');
  reply.header('Cache-Control', 'public, max-age=900, s-maxage=1800');
  return rows[0] || null;
});

// ─── VPS Status ─────────────────────────────────────────────────────────────
fastify.get('/status', async (req, reply) => {
  const t0 = Date.now();
  let mysqlOk = false; let mysqlMs = 0;
  let productTotal = 0; let productActive = 0;

  try {
    const t1 = Date.now();
    const [[row]] = await pool.query(
      `SELECT COUNT(*) as total, SUM(status='active') as active FROM products`
    );
    mysqlMs = Date.now() - t1;
    mysqlOk = true;
    productTotal  = Number(row.total);
    productActive = Number(row.active);
  } catch {}

  // Count images in uploads dir
  let imageCount = 0; let imagesSizeMb = 0;
  function walkCount(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walkCount(full);
      else if (e.name.endsWith('.webp')) {
        imageCount++;
        try { imagesSizeMb += fs.statSync(full).size / 1048576; } catch {}
      }
    }
  }
  walkCount(UPLOADS_DIR);

  // Disk info via df
  let diskTotalGb = null; let diskFreeGb = null;
  try {
    const { execSync } = require('child_process');
    const out = execSync("df -k /var/www/mdv-api --output=size,avail 2>/dev/null | tail -1")
      .toString().trim().split(/\s+/);
    diskTotalGb = Math.round(Number(out[0]) / 1048576 * 10) / 10;
    diskFreeGb  = Math.round(Number(out[1]) / 1048576 * 10) / 10;
  } catch {}

  const m = process.memoryUsage();
  return {
    ok: true,
    uptime_seconds: Math.floor(process.uptime()),
    response_ms: Date.now() - t0,
    memory: {
      rss_mb:        Math.round(m.rss / 1048576),
      heap_used_mb:  Math.round(m.heapUsed / 1048576),
      heap_total_mb: Math.round(m.heapTotal / 1048576),
    },
    mysql: { ok: mysqlOk, ping_ms: mysqlMs },
    disk: { total_gb: diskTotalGb, free_gb: diskFreeGb },
    products: { total: productTotal, active: productActive },
    images: { total: imageCount, size_mb: Math.round(imagesSizeMb * 10) / 10 },
  };
});


// ─── Shipping Settings ──────────────────────────────────────────────────────
fastify.get('/shipping/settings', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM shipping_settings LIMIT 1');
  reply.header('Cache-Control', 'public, max-age=300');
  if (!rows[0]) return null;
  const row = rows[0];
  // extra_config: mysql2 retorna JSON column como string em algumas versões
  if (row.extra_config && typeof row.extra_config === 'string') {
    try { row.extra_config = JSON.parse(row.extra_config); } catch { row.extra_config = null; }
  }
  return row;
});

fastify.patch('/shipping/settings', { preHandler: requireSyncKey }, async (req, reply) => {
  const s = req.body;
  const [rows] = await pool.query('SELECT id FROM shipping_settings LIMIT 1');
  if (rows.length === 0) {
    await pool.query(
      `INSERT INTO shipping_settings (id,origin_cep,origin_label,secondary_origin_cep,secondary_origin_label,
       melhor_envio_token,melhor_envio_sandbox,melhor_envio_enabled,melhor_envio_allowed_services,
       frenet_token,frenet_enabled,local_delivery_enabled,
       enable_progressive_shipping_subsidy,min_order_value_for_subsidy,
       default_subsidy_discount_percent,profit_margin_percentage_cap,extra_config)
       VALUES (UUID(),?,?,?,?,?,?,?,?,?,?,?,
       ?,?,?,?,?)`,
      [s.origin_cep,s.origin_label,s.secondary_origin_cep,s.secondary_origin_label,
       s.melhor_envio_token,s.melhor_envio_sandbox?1:0,s.melhor_envio_enabled?1:0,
       s.melhor_envio_allowed_services,s.frenet_token,s.frenet_enabled?1:0,s.local_delivery_enabled?1:0,
       s.enable_progressive_shipping_subsidy?1:0, s.min_order_value_for_subsidy||0,
       s.default_subsidy_discount_percent!=null?s.default_subsidy_discount_percent:100,
       s.profit_margin_percentage_cap!=null?s.profit_margin_percentage_cap:20,
       s.extra_config!=null?JSON.stringify(s.extra_config):null]
    );
  } else {
    await pool.query(
      `UPDATE shipping_settings SET
       origin_cep=COALESCE(?,origin_cep), origin_label=COALESCE(?,origin_label),
       secondary_origin_cep=COALESCE(?,secondary_origin_cep), secondary_origin_label=COALESCE(?,secondary_origin_label),
       melhor_envio_token=COALESCE(?,melhor_envio_token), melhor_envio_sandbox=COALESCE(?,melhor_envio_sandbox),
       melhor_envio_enabled=COALESCE(?,melhor_envio_enabled), melhor_envio_allowed_services=COALESCE(?,melhor_envio_allowed_services),
       frenet_token=COALESCE(?,frenet_token), frenet_enabled=COALESCE(?,frenet_enabled),
       local_delivery_enabled=COALESCE(?,local_delivery_enabled),
       enable_progressive_shipping_subsidy=COALESCE(?,enable_progressive_shipping_subsidy),
       min_order_value_for_subsidy=COALESCE(?,min_order_value_for_subsidy),
       default_subsidy_discount_percent=COALESCE(?,default_subsidy_discount_percent),
       profit_margin_percentage_cap=COALESCE(?,profit_margin_percentage_cap),
       extra_config=COALESCE(?,extra_config),
       updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [s.origin_cep,s.origin_label,s.secondary_origin_cep,s.secondary_origin_label,
       s.melhor_envio_token,s.melhor_envio_sandbox!=null?s.melhor_envio_sandbox?1:0:null,
       s.melhor_envio_enabled!=null?s.melhor_envio_enabled?1:0:null,s.melhor_envio_allowed_services,
       s.frenet_token,s.frenet_enabled!=null?s.frenet_enabled?1:0:null,
       s.local_delivery_enabled!=null?s.local_delivery_enabled?1:0:null,
       s.enable_progressive_shipping_subsidy!=null?s.enable_progressive_shipping_subsidy?1:0:null,
       s.min_order_value_for_subsidy,
       s.default_subsidy_discount_percent,
       s.profit_margin_percentage_cap,
       s.extra_config!=null?JSON.stringify(s.extra_config):null,
       rows[0].id]
    );
  }
  return { ok: true };
});

// ─── Shipping Zones ─────────────────────────────────────────────────────────
fastify.get('/shipping/zones', async (req, reply) => {
  const [zones] = await pool.query(
    `SELECT z.*, JSON_ARRAYAGG(
       IF(r.id IS NULL, NULL, JSON_OBJECT('id',r.id,'min_order',r.min_order,'max_order',r.max_order,'price',r.price))
     ) as price_ranges
     FROM shipping_zones z
     LEFT JOIN shipping_price_ranges r ON r.zone_id = z.id
     GROUP BY z.id
     ORDER BY z.display_order ASC`
  );
  reply.header('Cache-Control', 'public, max-age=300');
  return zones.map(z => ({
    ...z,
    enabled: z.enabled === 1,
    cities: z.cities ? JSON.parse(z.cities) : null,
    cep_ranges: z.cep_ranges ? JSON.parse(z.cep_ranges) : null,
    price_ranges: (z.price_ranges ? JSON.parse(z.price_ranges) : []).filter(Boolean),
  }));
});

fastify.post('/shipping/zones', { preHandler: requireSyncKey }, async (req, reply) => {
  const z = req.body;
  const id = z.id || require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO shipping_zones (id,name,type,enabled,cities,cep_ranges,max_km_free,price_per_km,fixed_price,min_order_free,estimated_days_min,estimated_days_max,display_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,z.name,z.type,z.enabled?1:0,jsonStr(z.cities),jsonStr(z.cep_ranges),
     z.max_km_free||null,z.price_per_km||null,z.fixed_price||null,z.min_order_free||null,
     z.estimated_days_min||null,z.estimated_days_max||null,z.display_order||0]
  );
  return { ok: true, id };
});

fastify.patch('/shipping/zones/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const z = req.body;
  await pool.query(
    `UPDATE shipping_zones SET name=?,type=?,enabled=?,cities=?,cep_ranges=?,max_km_free=?,price_per_km=?,
     fixed_price=?,min_order_free=?,estimated_days_min=?,estimated_days_max=?,display_order=?,updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [z.name,z.type,z.enabled?1:0,jsonStr(z.cities),jsonStr(z.cep_ranges),
     z.max_km_free||null,z.price_per_km||null,z.fixed_price||null,z.min_order_free||null,
     z.estimated_days_min||null,z.estimated_days_max||null,z.display_order||0,req.params.id]
  );
  return { ok: true };
});

fastify.delete('/shipping/zones/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM shipping_zones WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── Payment Fees ───────────────────────────────────────────────────────────
fastify.get('/payment-fees', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT * FROM payment_fees ORDER BY channel, method, installments`
  );
  reply.header('Cache-Control', 'public, max-age=900');
  return rows;
});

fastify.put('/payment-fees', { preHandler: requireSyncKey }, async (req, reply) => {
  const fees = req.body;
  if (!Array.isArray(fees)) return reply.code(400).send({ error: 'Array required' });
  await pool.query('DELETE FROM payment_fees');
  for (const f of fees) {
    await pool.query(
      `INSERT INTO payment_fees (id,method,installments,operator_fee_pct,applied_fee_pct,channel)
       VALUES (COALESCE(?,UUID()),?,?,?,?,?)`,
      [f.id||null,f.method||null,f.installments,f.operator_fee_pct||0,f.applied_fee_pct||0,f.channel||'all']
    );
  }
  return { ok: true, count: fees.length };
});

// ─── Coupons ────────────────────────────────────────────────────────────────
fastify.get('/coupons', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
  return rows.map(r => ({ ...r, active: r.active === 1 }));
});

fastify.get('/coupons/validate/:code', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT * FROM coupons WHERE code=? AND active=1
     AND (expires_at IS NULL OR expires_at > NOW())
     AND (max_uses IS NULL OR uses_count < max_uses)`,
    [req.params.code.toUpperCase()]
  );
  if (!rows.length) return reply.code(404).send({ error: 'Cupom inválido ou expirado' });
  return { ...rows[0], active: rows[0].active === 1 };
});

fastify.post('/coupons', { preHandler: requireSyncKey }, async (req, reply) => {
  const c = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO coupons (id,code,type,value,min_order,max_uses,expires_at,active,target_type)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id,c.code.toUpperCase(),c.type,c.value,c.min_order||0,c.max_uses||null,c.expires_at||null,c.active?1:0,c.target_type||'all']
  );
  return { ok: true, id };
});

fastify.patch('/coupons/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const c = req.body;
  await pool.query(
    `UPDATE coupons SET code=?,type=?,value=?,min_order=?,max_uses=?,expires_at=?,active=?,target_type=?,updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [c.code.toUpperCase(),c.type,c.value,c.min_order||0,c.max_uses||null,c.expires_at||null,c.active?1:0,c.target_type||'all',req.params.id]
  );
  return { ok: true };
});

fastify.delete('/coupons/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM coupons WHERE id=?', [req.params.id]);
  return { ok: true };
});

// POST /coupons/:code/use — incrementa uses_count
fastify.post('/coupons/:code/use', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query(`UPDATE coupons SET uses_count=uses_count+1 WHERE code=?`, [req.params.code]);
  return { ok: true };
});

// ─── Banners ────────────────────────────────────────────────────────────────
fastify.get('/banners', async (req, reply) => {
  const where = req.query.active === 'true' ? 'WHERE active=1' : '';
  const [rows] = await pool.query(
    `SELECT * FROM banners ${where} ORDER BY display_order ASC, created_at DESC`
  );
  reply.header('Cache-Control', 'public, max-age=120');
  return rows.map(r => ({ ...r, active: r.active === 1 }));
});

fastify.post('/banners', { preHandler: requireSyncKey }, async (req, reply) => {
  const b = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO banners (id,title,image_url,link_url,active,display_order,start_date,end_date)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id,b.title||null,b.image_url||null,b.link_url||b.link_target||null,b.active?1:0,b.display_order||0,b.start_date||null,b.end_date||null]
  );
  return { ok: true, id };
});

fastify.patch('/banners/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const b = req.body;
  await pool.query(
    `UPDATE banners SET title=?,image_url=?,link_url=?,active=?,display_order=?,start_date=?,end_date=?
     WHERE id=?`,
    [b.title||null,b.image_url||null,b.link_url||b.link_target||null,b.active?1:0,b.display_order||0,b.start_date||null,b.end_date||null,req.params.id]
  );
  return { ok: true };
});

fastify.delete('/banners/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM banners WHERE id=?', [req.params.id]);
  return { ok: true };
});

fastify.post('/banners/:id/click', async (req, reply) => {
  await pool.query(`UPDATE banners SET click_count=COALESCE(click_count,0)+1 WHERE id=?`, [req.params.id]);
  return { ok: true };
});

fastify.post('/banners/:id/view', async (req, reply) => {
  await pool.query(`UPDATE banners SET view_count=COALESCE(view_count,0)+1 WHERE id=?`, [req.params.id]);
  return { ok: true };
});

// POST /banners/upload — upload de imagem de banner
fastify.post('/banners/upload', { preHandler: requireSyncKey }, async (req, reply) => {
  const parts = req.parts();
  let fileBuf = null; let origName = 'banner.webp';
  for await (const part of parts) {
    if (part.type === 'file' && part.fieldname === 'file') {
      origName = part.filename || origName;
      const chunks = [];
      for await (const chunk of part.file) chunks.push(chunk);
      fileBuf = Buffer.concat(chunks);
    }
  }
  if (!fileBuf) return reply.code(400).send({ error: 'file required' });
  const ext = path.extname(origName) || '.webp';
  const fname = `${Date.now()}${ext}`;
  const bannerDir = path.join(UPLOADS_DIR, 'banners');
  fs.mkdirSync(bannerDir, { recursive: true });
  fs.writeFileSync(path.join(bannerDir, fname), fileBuf);
  const baseUrl = process.env.API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
  return { ok: true, url: `${baseUrl}/images/banners/${fname}`, path: `banners/${fname}` };
});

// ─── Warranty Templates ─────────────────────────────────────────────────────
fastify.get('/warranty-templates', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM warranty_templates ORDER BY name');
  reply.header('Cache-Control', 'public, max-age=900');
  return rows.map(r => ({ ...r, is_default: r.is_default === 1 }));
});

fastify.post('/warranty-templates', { preHandler: requireSyncKey }, async (req, reply) => {
  const t = req.body;
  const id = require('crypto').randomUUID();
  if (t.is_default) await pool.query('UPDATE warranty_templates SET is_default=0');
  await pool.query(
    `INSERT INTO warranty_templates (id,name,content,is_default) VALUES (?,?,?,?)`,
    [id, t.name, t.content||null, t.is_default?1:0]
  );
  return { ok: true, id };
});

fastify.patch('/warranty-templates/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const t = req.body;
  if (t.is_default) await pool.query('UPDATE warranty_templates SET is_default=0');
  await pool.query(
    `UPDATE warranty_templates SET name=?,content=?,is_default=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [t.name, t.content||null, t.is_default?1:0, req.params.id]
  );
  return { ok: true };
});

fastify.delete('/warranty-templates/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM warranty_templates WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── RAMs ───────────────────────────────────────────────────────────────────
fastify.get('/rams', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM rams WHERE active=1 ORDER BY value ASC');
  reply.header('Cache-Control', 'public, max-age=900');
  return rows;
});

fastify.get('/rams/all', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM rams ORDER BY value ASC');
  return rows;
});

fastify.post('/rams', { preHandler: requireSyncKey }, async (req, reply) => {
  const r = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(`INSERT INTO rams (id,value,label,active) VALUES (?,?,?,?)`, [id,r.value,r.label,r.active?1:0]);
  return { ok: true, id };
});

fastify.patch('/rams/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const r = req.body;
  await pool.query(`UPDATE rams SET value=?,label=?,active=? WHERE id=?`, [r.value,r.label,r.active?1:0,req.params.id]);
  return { ok: true };
});

fastify.delete('/rams/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM rams WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── Storages ───────────────────────────────────────────────────────────────
fastify.get('/storages', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM storages WHERE active=1 ORDER BY value ASC');
  reply.header('Cache-Control', 'public, max-age=900');
  return rows;
});

fastify.get('/storages/all', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM storages ORDER BY value ASC');
  return rows;
});

fastify.post('/storages', { preHandler: requireSyncKey }, async (req, reply) => {
  const r = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(`INSERT INTO storages (id,value,label,active) VALUES (?,?,?,?)`, [id,r.value,r.label,r.active?1:0]);
  return { ok: true, id };
});

fastify.patch('/storages/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const r = req.body;
  await pool.query(`UPDATE storages SET value=?,label=?,active=? WHERE id=?`, [r.value,r.label,r.active?1:0,req.params.id]);
  return { ok: true };
});

fastify.delete('/storages/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM storages WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── Battery Healths ────────────────────────────────────────────────────────
fastify.get('/battery-healths', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM battery_healths ORDER BY value DESC');
  reply.header('Cache-Control', 'public, max-age=900');
  return rows;
});

fastify.post('/battery-healths', { preHandler: requireSyncKey }, async (req, reply) => {
  const r = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(`INSERT INTO battery_healths (id,value,label) VALUES (?,?,?)`, [id,r.value,r.label]);
  return { ok: true, id };
});

fastify.delete('/battery-healths/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM battery_healths WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── Team Members ────────────────────────────────────────────────────────────────

const videoExistenceCache = new Map();
const VIDEO_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutos

// GET /public/check-video?sku=SKU — verifica existência via Synology FileStation
fastify.get('/public/check-video', async (req, reply) => {
  const sku = req.query.sku;
  if (!sku) return reply.code(400).send({ error: 'sku required' });

  const cleanSku = sku.trim().replace(/\s+/g, '').toUpperCase();
  const [rows] = await pool.query('SELECT synology_video_extension FROM company_settings LIMIT 1').catch(() => [[]]);
  const ext = rows?.[0]?.synology_video_extension || '.mp4';
  const fileName = `${cleanSku}${ext}`;

  // Retorna do cache se ainda válido
  const cached = videoExistenceCache.get(cleanSku);
  if (cached && (Date.now() - cached.cachedAt) < VIDEO_CACHE_TTL_MS) {
    return reply.send({ exists: cached.exists, ...(cached.url ? { url: cached.url } : {}) });
  }

  const canonicalUrl = `https://videos.mercadodovale.com.br/${encodeURIComponent(fileName)}`;

  // Verifica existência via FileStation API (não depende do CDN)
  try {
    if (SYNO_USER && SYNO_PASS) {
      const sid = await synoLogin();
      const filePath = `${SYNO_FOLDERS.videos}/${fileName}`;
      const urlObj = new URL(SYNO_URL);
      const data = await synoHttpGet(urlObj,
        `/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=getinfo&path=${encodeURIComponent(filePath)}&_sid=${sid}`
      );
      const exists = data.success === true && data.data?.files?.[0]?.name != null;
      videoExistenceCache.set(cleanSku, { exists, url: exists ? canonicalUrl : null, cachedAt: Date.now() });
      return reply.send({ exists, ...(exists ? { url: canonicalUrl } : {}) });
    }
  } catch (err) {
    console.warn('[public/check-video] Synology API error, tentando fallback via HEAD no CDN:', err.message);

    // Fallback robusto: tenta validar existência do arquivo no CDN.
    try {
      const headResp = await fetch(canonicalUrl, { method: 'HEAD' });
      if (headResp.ok) {
        videoExistenceCache.set(cleanSku, { exists: true, url: canonicalUrl, cachedAt: Date.now() });
        return reply.send({ exists: true, url: canonicalUrl });
      }
    } catch (headErr) {
      console.warn('[public/check-video] HEAD fallback falhou:', headErr.message);
    }
  }

  // Sem Synology e sem confirmação via CDN: trata como inexistente.
  return reply.send({ exists: false });
});

fastify.get('/team', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query('SELECT id,name,role,email,phone,active FROM team_members ORDER BY name');
  return rows.map(r => ({ ...r, active: r.active === 1 }));
});

fastify.post('/team', { preHandler: requireSyncKey }, async (req, reply) => {
  const m = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO team_members (id,name,role,email,phone,active,pin) VALUES (?,?,?,?,?,?,?)`,
    [id,m.name,m.role||null,m.email||null,m.phone||null,m.active?1:0,m.pin||null]
  );
  return { ok: true, id };
});

fastify.patch('/team/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const m = req.body;
  await pool.query(
    `UPDATE team_members SET name=?,role=?,email=?,phone=?,active=?,pin=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [m.name,m.role||null,m.email||null,m.phone||null,m.active?1:0,m.pin||null,req.params.id]
  );
  return { ok: true };
});

fastify.delete('/team/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM team_members WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── Synology CDN Manager ──────────────────────────────────────────────────
// Rotas para gerenciar arquivos nos CDNs do Synology NAS
// Funciona de qualquer rede via QuickConnect (sem CORS: chamadas server-side)

function normalizeSynologyUrl(rawUrl) {
  const fallback = 'https://handielson.direct.quickconnect.to:5001';
  const input = (rawUrl || fallback).trim().replace(/^"|"$/g, '');
  try {
    const parsed = new URL(input);
    const lanQuickConnectPrefix = /^(\d{1,3}-){3}\d{1,3}\./;
    if (lanQuickConnectPrefix.test(parsed.hostname)) {
      parsed.hostname = parsed.hostname.replace(lanQuickConnectPrefix, '');
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

const SYNO_URL  = normalizeSynologyUrl(process.env.SYNOLOGY_URL || 'https://dsm-api.xiaomipetrolina.com.br');
const SYNO_USER = process.env.SYNOLOGY_USER || '';
const SYNO_PASS = process.env.SYNOLOGY_PASS || '';

const SYNO_FOLDERS = {
  imagens:  '/web/imagens',
  videos:   '/web/videos',
  arquivos: '/web/arquivos',
};
const SYNO_CDN = {
  imagens:  'https://imagens.xiaomipetrolina.com.br',
  videos:   'https://videos.mercadodovale.com.br',
  arquivos: 'https://arquivos.xiaomipetrolina.com.br',
};

// Local SynologyDrive paths (used when Synology API is unreachable from WSL)
// Convert Windows path to WSL path if running in WSL
let SYNOLOGY_DRIVE_BASE = process.env.SYNOLOGY_DRIVE_BASE || 'C:\\Users\\Nitro\\SynologyDrive\\SynologyDrive';
if (process.platform === 'linux' && SYNOLOGY_DRIVE_BASE.includes('\\')) {
  // Convert C:\Users\... to /mnt/c/Users/...
  const match = SYNOLOGY_DRIVE_BASE.match(/^([A-Z]):\\/);
  if (match) {
    const drive = match[1].toLowerCase();
    const rest = SYNOLOGY_DRIVE_BASE.slice(3).replace(/\\/g, '/');
    SYNOLOGY_DRIVE_BASE = `/mnt/${drive}/${rest}`;
  }
}
const LOCAL_FOLDERS = {
  imagens: process.env.SYNOLOGY_LOCAL_IMAGENS_PATH || 'backup-mercadodovale/imagens/products',
  videos: process.env.SYNOLOGY_LOCAL_VIDEOS_PATH || 'Videos de Produtos',
  arquivos: process.env.SYNOLOGY_LOCAL_ARQUIVOS_PATH || 'backup-mercadodovale/arquivos',
};

// Function to list files from local SynologyDrive folder
function listLocalSynologyFiles(folder, limit = 10000, offset = 0) {
  const configured = LOCAL_FOLDERS[folder] || '';
  const folderPath = path.isAbsolute(configured) ? configured : path.join(SYNOLOGY_DRIVE_BASE, configured);
  
  try {
    if (!fs.existsSync(folderPath)) {
      return { ok: false, error: `Folder not found: ${folder}` };
    }

    let files = fs.readdirSync(folderPath, { withFileTypes: true })
      .filter(f => f.isFile())
      .map(f => {
        try {
          const stat = fs.statSync(path.join(folderPath, f.name));
          return {
            name: f.name,
            size: stat.size,
            modified: new Date(stat.mtime).toISOString(),
          };
        } catch (e) {
          return null;
        }
      })
      .filter(f => f !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    const total = files.length;
    const paginated = files.slice(offset, offset + limit);

    return {
      ok: true,
      data: {
        files: paginated,
        total: total,
      },
    };
  } catch (e) {
    console.error(`[listLocalSynologyFiles] Error for ${folder}:`, e.message);
    return { ok: false, error: e.message };
  }
}
function synoHttpGet(urlObj, path, timeoutMs = 15000) {
  const https = require('https');
  const port = urlObj.port ? parseInt(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80);
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname: urlObj.hostname, port, path, rejectUnauthorized: false }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { 
        try { 
          const parsed = JSON.parse(d);
          resolve(parsed);
        } catch (e) {
          console.error('[synoHttpGet] JSON parse error. Response:', d.slice(0, 500));
          reject(new Error(`Invalid JSON response from Synology: ${d.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error(`Synology request timeout (${Math.round(timeoutMs / 1000)}s)`)); });
  });
}

async function synoLogin(timeoutMs = 15000) {
  const qs = `api=SYNO.API.Auth&version=7&method=login&account=${encodeURIComponent(SYNO_USER)}&passwd=${encodeURIComponent(SYNO_PASS)}&session=FileStation&format=sid`;
  const urlObj = new URL(SYNO_URL);
  try {
    const j = await synoHttpGet(urlObj, `/webapi/auth.cgi?${qs}`, timeoutMs);
    if (j.success) return j.data.sid;
    console.error('[synoLogin] Auth failed:', j.error);
    throw new Error('Synology login failed: ' + JSON.stringify(j.error || j));
  } catch (err) {
    console.error('[synoLogin] Error:', err.message);
    throw err;
  }
}

async function synoApiGet(apiPath) {
  const urlObj = new URL(SYNO_URL);
  return synoHttpGet(urlObj, apiPath);
}

async function uploadAutoresponderAttachmentToSynology({ fileName, fileBuf }) {
  const folder = AUTORESPONDER_ATTACHMENT_SYNOLOGY_FOLDER;
  if (!SYNO_FOLDERS[folder]) {
    throw new Error(`Invalid autoresponder Synology folder: ${folder}`);
  }

  const folderPath = SYNO_FOLDERS[folder];
  const url = `${SYNO_CDN[folder]}/${fileName}`;
  const sid = await synoLogin();
  const boundary = `MDVAutoresponderBoundary${Date.now()}`;

  const textFields = [
    ['api', 'SYNO.FileStation.Upload'],
    ['version', '2'],
    ['method', 'upload'],
    ['path', folderPath],
    ['create_parents', 'true'],
    ['overwrite', 'true'],
    ['_sid', sid],
  ].map(([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`).join('');

  const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const body = Buffer.concat([Buffer.from(textFields), Buffer.from(fileHeader), fileBuf, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const https = require('https');
  const urlObj = new URL(SYNO_URL);

  const result = await new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      port: parseInt(urlObj.port) || 5001,
      path: '/webapi/entry.cgi',
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };
    const r = https.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch (e) {
          reject(e);
        }
      });
    });
    r.on('error', reject);
    r.setTimeout(30000, () => r.destroy(new Error('Synology upload timeout for autoresponder attachment')));
    r.write(body);
    r.end();
  });

  if (!result.success) {
    throw new Error(`Synology upload failed: ${JSON.stringify(result.error || result)}`);
  }

  return { ok: true, url, filename: fileName, storage: 'synology' };
}




// GET /video/:filename — streaming proxy de vídeo do Synology (sem depender do CDN quebrado)
fastify.get('/video/:filename', async (req, reply) => {
  const { filename } = req.params;
  if (!filename || !filename.match(/^[\w\-. ]+\.(mp4|webm|mov|avi|mkv)$/i)) {
    return reply.code(400).send({ error: 'Invalid filename' });
  }
  if (!SYNO_USER || !SYNO_PASS) return reply.code(503).send({ error: 'Synology not configured' });

  try {
    const sid = await synoLogin();
    const filePath = encodeURIComponent(`${SYNO_FOLDERS['videos']}/${filename}`);
    const urlObj = new URL(SYNO_URL);
    const https = require('https');
    const downloadPath = `/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${filePath}&mode=stream&_sid=${sid}`;

    const headers = {};
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const r = https.request({
      hostname: urlObj.hostname,
      port: parseInt(urlObj.port) || 5001,
      path: downloadPath,
      method: 'GET',
      headers: headers,
      rejectUnauthorized: false,
    }, (res) => {
      // Check if Synology returned a JSON API error instead of a file
      if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
        reply.raw.writeHead(404, { 'Content-Type': 'application/json' });
        res.pipe(reply.raw);
        return;
      }

      // Forward headers from Synology (important for 206 Partial Content and Content-Length)
      const replyHeaders = {
        'Cache-Control': 'public, max-age=3600',
        'Accept-Ranges': 'bytes',
      };
      
      if (res.headers['content-type']) replyHeaders['Content-Type'] = res.headers['content-type'];
      if (res.headers['content-length']) replyHeaders['Content-Length'] = res.headers['content-length'];
      if (res.headers['content-range']) replyHeaders['Content-Range'] = res.headers['content-range'];

      reply.raw.writeHead(res.statusCode || 200, replyHeaders);
      res.pipe(reply.raw);
    });
    r.on('error', (err) => { console.error('[video proxy] error:', err.message); });
    r.end();

    // Retorna sem value — o stream está sendo gerenciado manualmente
    await new Promise((resolve) => reply.raw.on('finish', resolve));
    return;
  } catch (err) {
    return reply.code(500).send({ error: 'Video unavailable' });
  }
});

// GET /synology/files?folder=imagens|videos|arquivos
fastify.get('/synology/files', { preHandler: requireSyncKey }, async (req, reply) => {
  const folder = req.query.folder;
  if (!SYNO_FOLDERS[folder]) return reply.code(400).send({ error: 'Invalid folder' });

  const limit = parseInt(req.query.limit) || 10000;
  const offset = parseInt(req.query.offset) || 0;

  const cdn = SYNO_CDN[folder];

  // 1) Try Synology API first (primary source of truth)
  try {
    if (SYNO_USER && SYNO_PASS) {
      const sid = await synoLogin();
      const data = await synoApiGet(
        `/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list&folder_path=${encodeURIComponent(SYNO_FOLDERS[folder])}&additional=%5B%22size%22%2C%22time%22%5D&limit=${limit}&offset=${offset}&_sid=${sid}`
      );

      if (data.success) {
        const files = (data.data?.files || [])
          .filter(f => !f.isdir)
          .map(f => ({
            name: f.name,
            size: f.additional?.size || 0,
            modified: f.additional?.time?.mtime ? new Date(f.additional.time.mtime * 1000).toISOString() : null,
            url: `${cdn}/${f.name}`,
          }));

        reply.header('Cache-Control', 'no-store');
        reply.header('X-Total-Count', String(data.data?.total || files.length));
        return files;
      }

      console.warn(`[synology/files] API returned error for ${folder}:`, data.error);
    }
  } catch (err) {
    console.warn(`[synology/files] API fallback for ${folder}:`, err.message);
  }

  // 2) Fallback to local SynologyDrive mirror
  const result = listLocalSynologyFiles(folder, limit, offset);
  if (!result.ok) {
    // Synology inacessível e path local não existe — retorna lista vazia (sem erro 500)
    console.warn(`[synology/files] Unreachable for ${folder}: ${result.error}`);
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Total-Count', '0');
    reply.header('X-Synology-Unreachable', 'true');
    return [];
  }

  const files = result.data.files.map(f => ({
    ...f,
    url: `${cdn}/${f.name}`,
  }));

  reply.header('Cache-Control', 'no-store');
  reply.header('X-Total-Count', String(result.data.total || files.length));
  return files;
});

const SYNOLOGY_UPLOAD_STATUS_TTL_MS = 30 * 60 * 1000;
const synologyUploadStatus = new Map();

function createSynologyUploadStatus({ folder, fileName, url }) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const now = Date.now();
  const job = {
    id,
    folder,
    fileName,
    url,
    status: 'queued',
    progress: 90,
    message: 'Aguardando envio ao Synology',
    createdAt: now,
    updatedAt: now,
  };
  synologyUploadStatus.set(id, job);
  const cleanup = setTimeout(() => synologyUploadStatus.delete(id), SYNOLOGY_UPLOAD_STATUS_TTL_MS);
  if (typeof cleanup.unref === 'function') cleanup.unref();
  return job;
}

function updateSynologyUploadStatus(id, patch) {
  const job = synologyUploadStatus.get(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: Date.now() });
  return job;
}

function serializeSynologyUploadStatus(job) {
  return {
    id: job.id,
    folder: job.folder,
    name: job.fileName,
    url: job.url,
    status: job.status,
    progress: job.progress,
    message: job.message,
    error: job.error || null,
    detail: job.detail || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

fastify.get('/synology/upload-status', { preHandler: requireSyncKey }, async (req, reply) => {
  const id = String(req.query.id || '').trim();
  if (!id) return reply.code(400).send({ error: 'id required' });

  const job = synologyUploadStatus.get(id);
  if (!job) return reply.code(404).send({ error: 'Upload status not found or expired' });

  reply.header('Cache-Control', 'no-store');
  return serializeSynologyUploadStatus(job);
});

// POST /synology/upload?folder=imagens|videos|arquivos
fastify.post('/synology/upload', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {
  const folder = req.query.folder;
  if (!SYNO_FOLDERS[folder]) return reply.code(400).send({ error: 'Invalid folder' });
  if (!SYNO_USER || !SYNO_PASS) return reply.code(500).send({ error: 'Synology credentials not configured' });

  const parts = req.parts({ limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB para vídeos
  let fileBuf = null;
  let fileName = null;

  for await (const part of parts) {
    if (part.type === 'file' && part.fieldname === 'file') {
      fileName = part.filename;
      const chunks = [];
      for await (const chunk of part.file) chunks.push(chunk);
      fileBuf = Buffer.concat(chunks);
    }
  }

  if (!fileBuf || !fileName) return reply.code(400).send({ error: 'file field required' });

  const folderPath = SYNO_FOLDERS[folder];
  const cdnUrl = `${SYNO_CDN[folder]}/${fileName}`;
  const uploadJob = createSynologyUploadStatus({ folder, fileName, url: cdnUrl });

  // ── Responde 200 IMEDIATAMENTE (evita timeout 524 do Cloudflare) ──────────
  reply.code(200).send({ ok: true, uploadId: uploadJob.id, status: uploadJob.status, name: fileName, url: cdnUrl });

  // ── Upload ao Synology em background (sem bloquear o cliente) ─────────────
  setImmediate(async () => {
    try {
      updateSynologyUploadStatus(uploadJob.id, {
        status: 'uploading',
        progress: 95,
        message: 'Enviando arquivo ao Synology',
      });
      const sid = await synoLogin();
      const boundary = `MDVBoundary${Date.now()}`;

      const textFields = [
        ['api', 'SYNO.FileStation.Upload'],
        ['version', '2'],
        ['method', 'upload'],
        ['path', folderPath],
        ['create_parents', 'true'],
        ['overwrite', 'true'],
        ['_sid', sid],
      ].map(([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`).join('');

      const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
      const body = Buffer.concat([Buffer.from(textFields), Buffer.from(fileHeader), fileBuf, Buffer.from(`\r\n--${boundary}--\r\n`)]);

      const https = require('https');
      const urlObj = new URL(SYNO_URL);
      const result = await new Promise((resolve, reject) => {
        const options = {
          hostname: urlObj.hostname, port: parseInt(urlObj.port) || 5001,
          path: '/webapi/entry.cgi', method: 'POST', rejectUnauthorized: false,
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
        };
        const r = https.request(options, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
        });
        r.on('error', reject);
        r.write(body);
        r.end();
      });

      if (result.success) {
        updateSynologyUploadStatus(uploadJob.id, {
          status: 'success',
          progress: 100,
          message: 'Upload concluido no Synology',
        });
        console.log(`[synology] Upload OK: ${folderPath}/${fileName}`);
      } else {
        updateSynologyUploadStatus(uploadJob.id, {
          status: 'error',
          progress: 100,
          message: 'Synology recusou o upload',
          error: 'Synology upload failed',
          detail: JSON.stringify(result.error || result),
        });
        console.error(`[synology] Upload FAILED: ${fileName}`, result.error);
      }
    } catch (err) {
      updateSynologyUploadStatus(uploadJob.id, {
        status: 'error',
        progress: 100,
        message: 'Erro ao enviar ao Synology',
        error: err.message,
      });
      console.error(`[synology] Background upload error: ${fileName}`, err.message);
    }
  });
});

// DELETE /synology/file?folder=imagens&name=arquivo.jpg
fastify.delete('/synology/file', { preHandler: requireSyncKey }, async (req, reply) => {
  const { folder, name } = req.query;
  if (!SYNO_FOLDERS[folder]) return reply.code(400).send({ error: 'Invalid folder' });
  if (!name) return reply.code(400).send({ error: 'name required' });
  if (!SYNO_USER || !SYNO_PASS) return reply.code(500).send({ error: 'Synology credentials not configured' });

  const sid = await synoLogin();
  const filePath = `${SYNO_FOLDERS[folder]}/${name}`;
  const data = await synoApiGet(
    `/webapi/entry.cgi?api=SYNO.FileStation.Delete&version=2&method=start&path=${encodeURIComponent(filePath)}&accurate_progress=true&_sid=${sid}`
  );

  if (!data.success) return reply.code(500).send({ error: 'Delete failed', detail: data.error });
  return { ok: true };
});

// ─── Synology Command Queue ───────────────────────────────────────────────────
// Admin enfileira comandos (ex: restart do cloudflared). Um poller rodando no
// Synology via DSM Task Scheduler consome a fila e executa localmente. Contorna
// o caso em que o tunnel CF está caído e a VPS não alcança o Synology direto.

const SYNO_COMMAND_TTL_MS = 5 * 60 * 1000;
const synologyProcessStartedAt = new Date();
let synologyLastStatusSnapshot = null;
let synologyServicesPromise = null;
let synologyCommandQueue = null;

async function getSynologyServices() {
  if (!synologyServicesPromise) {
    synologyServicesPromise = Promise.all([
      import('./services/synologyNasStatusService.js'),
      import('./services/synologyCommandQueueService.js'),
    ]).then(([statusService, queueService]) => {
      if (!synologyCommandQueue) {
        synologyCommandQueue = queueService.createSynologyCommandQueue({ ttlMs: SYNO_COMMAND_TTL_MS });
      }

      return {
        buildSynologyStatusResponse: statusService.buildSynologyStatusResponse,
        normalizeSynologyStatusPayload: statusService.normalizeSynologyStatusPayload,
        createSynologyCommandQueue: queueService.createSynologyCommandQueue,
      };
    });
  }

  return synologyServicesPromise;
}

async function getSynologyCommandQueue() {
  await getSynologyServices();
  if (!synologyCommandQueue) {
    const { createSynologyCommandQueue } = await getSynologyServices();
    synologyCommandQueue = createSynologyCommandQueue({ ttlMs: SYNO_COMMAND_TTL_MS });
  }
  return synologyCommandQueue;
}

function requireSynoPollKey(request, reply, done) {
  const expected = process.env.SYNOLOGY_POLL_KEY;
  if (!expected) {
    reply.code(500).send({ error: 'SYNOLOGY_POLL_KEY not configured on VPS' });
    return;
  }
  const key = request.headers['x-poll-key'];
  if (!key || key !== expected) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
}

// Admin enfileira um restart
fastify.post('/synology/enqueue-restart', { preHandler: requireSyncKey }, async (req, reply) => {
  if (!process.env.SYNOLOGY_POLL_KEY) {
    return reply.code(500).send({ error: 'SYNOLOGY_POLL_KEY not configured on VPS' });
  }
  const queue = await getSynologyCommandQueue();
  const result = queue.enqueue('restart-cloudflared', new Date());
  if (!result.ok) {
    return reply.code(409).send({
      error: 'Command already pending',
      command: result.command,
      reason: result.reason,
    });
  }
  return { ok: true, command: result.command };
});

fastify.post('/synology/enqueue-reboot', { preHandler: requireSyncKey }, async (req, reply) => {
  if (!process.env.SYNOLOGY_POLL_KEY) {
    return reply.code(500).send({ error: 'SYNOLOGY_POLL_KEY not configured on VPS' });
  }
  const queue = await getSynologyCommandQueue();
  const result = queue.enqueue('reboot-nas', new Date());
  if (!result.ok) {
    return reply.code(409).send({
      error: 'Command already pending',
      command: result.command,
      reason: result.reason,
    });
  }
  return { ok: true, command: result.command };
});

// Admin consulta status (pra UI mostrar "executado", "pendente", etc)
fastify.get('/synology/command-status', { preHandler: requireSyncKey }, async () => {
  const queue = await getSynologyCommandQueue();
  const command = queue.getStatus(new Date());
  return command || null;
});

fastify.get('/synology/status', { preHandler: requireSyncKey }, async () => {
  const { buildSynologyStatusResponse } = await getSynologyServices();
  const queue = await getSynologyCommandQueue();
  const now = new Date();
  return buildSynologyStatusResponse({
    snapshot: synologyLastStatusSnapshot,
    command: queue.getStatus(now),
    now,
    processStartedAt: synologyProcessStartedAt,
  });
});

fastify.post('/synology/report-status', { preHandler: requireSynoPollKey }, async (req) => {
  const { normalizeSynologyStatusPayload } = await getSynologyServices();
  synologyLastStatusSnapshot = normalizeSynologyStatusPayload(req.body || {}, new Date());
  return {
    ok: true,
    snapshot: synologyLastStatusSnapshot,
  };
});

// Synology consome a fila (polling periódico via DSM Task Scheduler)
fastify.get('/synology/poll-command', { preHandler: requireSynoPollKey }, async () => {
  const queue = await getSynologyCommandQueue();
  return queue.poll(new Date());
});

// Synology confirma execução
fastify.post('/synology/ack-command', { preHandler: requireSynoPollKey }, async (req) => {
  const queue = await getSynologyCommandQueue();
  return queue.ack(req.body || {}, new Date());
});

// ─── Customer Favorites ────────────────────────────────────────────────────────

fastify.get('/customers/:id/favorites', { preHandler: requireSyncKey }, async (req, reply) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT product_id FROM customer_favorites WHERE customer_id = ?', [id]);
    reply.header('Cache-Control', 'no-store');
    return rows.map(r => r.product_id);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Database error fetching favorites' });
  }
});

fastify.post('/customers/:id/favorites', { preHandler: requireSyncKey }, async (req, reply) => {
  const { id } = req.params;
  const { productId } = req.body;
  if (!productId) return reply.code(400).send({ error: 'Missing productId' });
  try {
    await pool.query('INSERT IGNORE INTO customer_favorites (customer_id, product_id) VALUES (?, ?)', [id, productId]);
    return { success: true };
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Database error adding favorite' });
  }
});

fastify.delete('/customers/:id/favorites/:productId', { preHandler: requireSyncKey }, async (req, reply) => {
  const { id, productId } = req.params;
  try {
    await pool.query('DELETE FROM customer_favorites WHERE customer_id = ? AND product_id = ?', [id, productId]);
    return { success: true };
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Database error removing favorite' });
  }
});

// ─── Video existence check ───────────────────────────────────────────────────
// GET /check-video?sku=PI153D
// Verifica se existe um vídeo no Synology NAS para o SKU informado via FileStation API.
fastify.get('/check-video', { config: { rateLimit: { max: 180, timeWindow: '1 minute' } } }, async (req, reply) => {
  reply.header('Cache-Control', 'public, max-age=300');
  const sku = req.query.sku;
  if (!sku) return reply.code(400).send({ error: 'sku required', exists: false });
  try {
    const [[setting]] = await pool.query(
      'SELECT synology_video_extension FROM company_settings LIMIT 1'
    ).catch(() => [[null]]);
    const ext = (setting && setting.synology_video_extension) || '.mp4';
    const cleanSku = sku.trim().replace(/\s+/g, '').toUpperCase();
    const fileName = `${cleanSku}${ext}`;
    const canonicalUrl = `https://videos.mercadodovale.com.br/${encodeURIComponent(fileName)}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const headResp = await fetch(canonicalUrl, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeoutId);
      if (headResp.ok) {
        return { exists: true, url: canonicalUrl };
      }
      if (headResp.status === 404) {
        return { exists: false, url: null };
      }
    } catch (headErr) {
      console.warn('[check-video] HEAD direto falhou, tentando Synology curto:', headErr.message);
    }

    // Tenta validar via Synology primeiramente
    if (SYNO_USER && SYNO_PASS) {
      try {
        const sid = await synoLogin(2500);
        const filePath = `${SYNO_FOLDERS.videos}/${fileName}`;
        const urlObj = new URL(SYNO_URL);
        const data = await synoHttpGet(urlObj,
          `/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=getinfo&path=${encodeURIComponent(filePath)}&_sid=${sid}`,
          2500
        );
        const exists = data.success === true && data.data?.files?.[0]?.name != null;
        return { exists, url: exists ? canonicalUrl : null };
      } catch (synoErr) {
        console.warn('[check-video] Synology indisponível, tentando HEAD fallback no CDN:', synoErr.message);
        
        // Fallback: validar existência do arquivo no CDN via HEAD request (com timeout)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
          const headResp = await fetch(canonicalUrl, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timeoutId);
          if (headResp.ok) {
            return { exists: true, url: canonicalUrl };
          }
        } catch (headErr) {
          console.warn('[check-video] HEAD fallback falhou:', headErr.message);
        }
        
        // Sem Synology e sem confirmação via CDN: retorna false (pessimista)
        return { exists: false, url: null };
      }
    }

    // Quando Synology não configurado: tenta HEAD fallback direto
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
      const headResp = await fetch(canonicalUrl, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeoutId);
      if (headResp.ok) {
        return { exists: true, url: canonicalUrl };
      }
    } catch (headErr) {
      console.warn('[check-video] HEAD direto falhou:', headErr.message);
    }
    
    return { exists: false, url: null };
  } catch (err) {
    console.error('[check-video] Erro geral:', err.message);
    return { exists: false, url: null };
  }
});

// ─── Auto-migrations ────────────────────────────────────────────────────────
async function addColumnIfMissing(table, column, definition) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (Number(row.cnt) === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`[migration] Added ${table}.${column}`);
  } else {
    console.log(`[migration] ${table}.${column} already exists — skip`);
  }
}

async function seedAutoresponderRuleTemplates() {
  for (const template of AUTORESPONDER_RULE_TEMPLATES) {
    await pool.query(
      `INSERT INTO autoresponder_rules
        (name, match_type, pattern, reply_type, reply_text, priority, active, tag_ids)
       SELECT ?, ?, ?, 'text', ?, ?, ?, JSON_ARRAY()
       WHERE NOT EXISTS (
         SELECT 1 FROM autoresponder_rules WHERE name = ? LIMIT 1
       )`,
      [
        template.name,
        template.matchType || 'any_keyword',
        template.pattern,
        template.replyText || '',
        Number(template.priority || 0),
        Number(template.active || 0),
        template.name,
      ]
    );
  }
}

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_favorites (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_id VARCHAR(255) NOT NULL,
      product_id CHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY idx_unique_fav (customer_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_carts (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_id VARCHAR(255) NOT NULL,
      product_id CHAR(36) NOT NULL,
      quantity INT DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_unique_cart (customer_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await addColumnIfMissing('company_settings', 'synology_video_base_url', 'TEXT DEFAULT NULL');
  await addColumnIfMissing('company_settings', 'synology_video_extension', "VARCHAR(20) DEFAULT '.mp4'");
  await addColumnIfMissing('products', 'exclude_from_seo', "TINYINT(1) DEFAULT 0");
  await addColumnIfMissing('products', 'meta_title', "VARCHAR(255) NULL");
  await addColumnIfMissing('products', 'meta_description', "TEXT NULL");
  await addColumnIfMissing('products', 'keywords', "TEXT NULL");
  await addColumnIfMissing('products', 'view_count', "INT DEFAULT 0");

  // Linkage pai/filho (Bling) - permite combos/kits referenciarem produtos pai (agregados)
  await addColumnIfMissing('products', 'parent_id',       'CHAR(36) DEFAULT NULL');
  await addColumnIfMissing('products', 'bling_id',        'BIGINT DEFAULT NULL');
  await addColumnIfMissing('products', 'bling_parent_id', 'BIGINT DEFAULT NULL');
  await addColumnIfMissing('products', 'is_parent',       'TINYINT(1) NOT NULL DEFAULT 0');

  await addColumnIfMissing('shipping_settings', 'extra_config', 'JSON NULL');
  console.log('[migration] company_settings synology columns: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_fees (
      id CHAR(36) PRIMARY KEY,
      method VARCHAR(50) NOT NULL,
      installments INT NOT NULL DEFAULT 1,
      operator_fee_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
      applied_fee_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
      channel VARCHAR(50) NOT NULL DEFAULT 'presencial',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_fee_unique (method, installments, channel)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS autoresponder_settings (
      id INT PRIMARY KEY,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      human_message_in_hours TEXT NULL,
      human_message_out_of_hours TEXT NULL,
      human_pause_minutes INT NOT NULL DEFAULT 60,
      auto_pause_fallback_threshold INT NOT NULL DEFAULT 3,
      auto_pause_fallback_minutes INT NOT NULL DEFAULT 30,
      auto_pause_fallback_message TEXT NULL,
      max_replies_per_conversation INT NOT NULL DEFAULT 20,
      max_replies_window_hours INT NOT NULL DEFAULT 24,
      greeting_prefix TEXT NULL,
      fallback_message TEXT NULL,
      send_product_images TINYINT(1) NOT NULL DEFAULT 1,
      max_images_per_response INT NOT NULL DEFAULT 1,
      use_numbered_lists TINYINT(1) NOT NULL DEFAULT 1,
      numbered_list_threshold INT NOT NULL DEFAULT 2,
      numbered_list_validity_minutes INT NOT NULL DEFAULT 30,
      product_tag_keywords JSON NULL,
      archive_to_synology TINYINT(1) NOT NULL DEFAULT 1,
      archive_after_days INT NOT NULL DEFAULT 7,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    INSERT IGNORE INTO autoresponder_settings (
      id,
      enabled,
      human_message_in_hours,
      human_message_out_of_hours,
      auto_pause_fallback_message,
      greeting_prefix,
      fallback_message,
      product_tag_keywords
    ) VALUES (
      1,
      0,
      '${AUTORESPONDER_DEFAULT_HUMAN_IN_HOURS}',
      '${AUTORESPONDER_DEFAULT_HUMAN_OUT_OF_HOURS}',
      '${AUTORESPONDER_DEFAULT_AUTO_PAUSE_MESSAGE}',
      'Ola!',
      '${AUTORESPONDER_DEFAULT_FALLBACK_MESSAGE}',
      JSON_OBJECT()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS autoresponder_rules (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      match_type ENUM('any_keyword','all_keywords','regex','exact') NOT NULL DEFAULT 'any_keyword',
      pattern TEXT NOT NULL,
      reply_type ENUM('text','product_by_tag','product_search') NOT NULL DEFAULT 'text',
      reply_text TEXT NULL,
      reply_tag_id INT NULL,
      reply_search_query VARCHAR(255) NULL,
      attachment_url VARCHAR(500) NULL,
      attachment_caption TEXT NULL,
      auto_apply_tag_id INT NULL,
      tag_ids JSON NULL,
      priority INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      hits INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_active_priority (active, priority)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await seedAutoresponderRuleTemplates();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS autoresponder_tags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
      description VARCHAR(200) NULL,
      scopes SET('rule','conversation','product') NOT NULL,
      show_on_bot TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS autoresponder_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sender VARCHAR(30) NULL,
      question TEXT NULL,
      intent VARCHAR(30) NULL,
      matched_rule_id BIGINT NULL,
      matched_products JSON NULL,
      matched_count INT NOT NULL DEFAULT 0,
      reply_text TEXT NULL,
      response_time_ms INT NULL,
      is_group TINYINT(1) NOT NULL DEFAULT 0,
      INDEX idx_created (created_at),
      INDEX idx_unmatched (matched_count, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS autoresponder_conversations (
      sender VARCHAR(30) PRIMARY KEY,
      first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_bot_reply_at TIMESTAMP NULL,
      paused_until TIMESTAMP NULL,
      pause_reason VARCHAR(50) NULL,
      paused_by_user_id INT NULL,
      consecutive_fallbacks INT NOT NULL DEFAULT 0,
      total_messages INT NOT NULL DEFAULT 0,
      tag_ids JSON NULL,
      last_options_offered JSON NULL,
      last_options_at TIMESTAMP NULL,
      purchase_flow JSON NULL,
      purchase_flow_updated_at TIMESTAMP NULL,
      contact_name_status VARCHAR(40) NULL,
      contact_name_suggestion VARCHAR(120) NULL,
      contact_name_confirmed VARCHAR(120) NULL,
      google_contact_resource_name VARCHAR(120) NULL,
      contact_name_updated_at TIMESTAMP NULL,
      INDEX idx_paused (paused_until)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS autoresponder_blocklist (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      pattern VARCHAR(100) NOT NULL,
      pattern_type ENUM('exact','prefix','regex') NOT NULL DEFAULT 'exact',
      contact_name VARCHAR(255) NULL,
      reason TEXT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by_user_id INT NULL,
      INDEX idx_active (active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await addColumnIfMissing('products', 'tag_ids', 'JSON NULL');
  await addColumnIfMissing('autoresponder_conversations', 'contact_name_status', 'VARCHAR(40) NULL');
  await addColumnIfMissing('autoresponder_conversations', 'contact_name_suggestion', 'VARCHAR(120) NULL');
  await addColumnIfMissing('autoresponder_conversations', 'contact_name_confirmed', 'VARCHAR(120) NULL');
  await addColumnIfMissing('autoresponder_conversations', 'google_contact_resource_name', 'VARCHAR(120) NULL');
  await addColumnIfMissing('autoresponder_conversations', 'contact_name_updated_at', 'TIMESTAMP NULL');
  await addColumnIfMissing('autoresponder_conversations', 'purchase_flow', 'JSON NULL');
  await addColumnIfMissing('autoresponder_conversations', 'purchase_flow_updated_at', 'TIMESTAMP NULL');
  console.log('[migration] autoresponder phase 1A tables: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS field_presets (
      id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
      name        VARCHAR(100) NOT NULL,
      description TEXT,
      config      JSON         NOT NULL,
      created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] field_presets table: OK');

  // Tabela de unidades físicas serializadas (1 linha por aparelho com IMEI/serial)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS units (
      id              CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      product_id      CHAR(36) NOT NULL,
      imei_1          VARCHAR(20)  NULL,
      imei_2          VARCHAR(20)  NULL,
      serial          VARCHAR(100) NULL,
      status          VARCHAR(20)  NOT NULL DEFAULT 'available',
      \`condition\`     VARCHAR(20)  NOT NULL DEFAULT 'new',
      internal_notes  TEXT NULL,
      cost_price      INT NULL,
      order_id        CHAR(36) NULL,
      sale_id         CHAR(36) NULL,
      reserved_at     TIMESTAMP NULL,
      sold_at         TIMESTAMP NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_units_product_id (product_id),
      INDEX idx_units_imei_1     (imei_1),
      INDEX idx_units_imei_2     (imei_2),
      INDEX idx_units_serial     (serial),
      INDEX idx_units_status     (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] units table: OK');

  // Stock sync de units é feito em app-level (helper syncProductStock chamado pelos
  // endpoints /units). Trigger MySQL exige privilégio SUPER que o usuário não tem
  // (ER_BINLOG_CREATE_ROUTINE_NEED_SUPER quando binlog está ativo).
}

// Recalcula products.stock_quantity = COUNT(units WHERE status='available') para o produto.
async function syncProductStock(productId) {
  if (!productId) return;
  await pool.query(
    `UPDATE products SET stock_quantity = (
       SELECT COUNT(*) FROM units WHERE product_id = ? AND status = 'available'
     ), updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [productId, productId]
  );
}

// Start
runMigrations().then(() => {
  fastify.listen({ port: process.env.PORT || 4000, host: '0.0.0.0' }, (err) => {
    if (err) { console.error(err); process.exit(1); }
    console.log(`MDV API rodando na porta ${process.env.PORT || 4000}`);
  });
}).catch((err) => {
  console.error('[startup] migration failed:', err);
  process.exit(1);
});
