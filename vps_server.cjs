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
const AUTORESPONDER_DEFAULT_SIGNATURE_MESSAGE = 'Pitoco, assistente virtual do Mercado do Vale. Se precisar de ajuda personalizada, nossa equipe continua o atendimento por aqui.';
const AUTORESPONDER_RESPONSE_TONE_VARIANTS = {
  a: {
    humanIn: 'Certo, vou chamar um atendente para continuar seu atendimento.',
    humanOut: 'Certo, vou chamar um atendente. Estamos fora do horario humano agora, mas sua mensagem ficou registrada.',
    fallback: 'Nao localizei isso com seguranca. Me envie o modelo do aparelho ou o produto que voce procura.',
    autoPause: 'Vou passar para um atendente conferir isso certinho para voce.',
    audioUnsupported: 'Recebi seu audio, mas por aqui preciso que voce envie em texto.',
    orderConfirmed: 'Dados confirmados. Vou separar o pedido para um atendente finalizar.',
    orderHandoff: 'Pedido separado. Vou pausar o bot para nossa equipe finalizar seu atendimento.',
    finish: 'Atendimento finalizado, mas qualquer duvida estamos por aqui.',
  },
  b: {
    humanIn: 'Certo, vou chamar alguem da equipe para te ajudar melhor por aqui.',
    humanOut: 'Certo, vou chamar alguem da equipe. Agora estamos fora do horario humano, mas sua mensagem ja ficou registrada.',
    fallback: 'Ainda nao encontrei exatamente o que voce precisa. Me diga o modelo do aparelho ou mais detalhes do produto?',
    autoPause: 'Para nao te passar uma informacao errada, vou chamar um atendente para conferir com carinho.',
    audioUnsupported: 'Recebi seu audio, mas ainda nao consigo ouvir por aqui. Pode me mandar em texto?',
    orderConfirmed: 'Dados confirmados. Vou deixar o pedido separado para um atendente finalizar com voce.',
    orderHandoff: 'Seu pedido ficou separado. Vou pausar o bot para a equipe continuar o atendimento com voce.',
    finish: 'Atendimento finalizado. Se aparecer qualquer duvida, pode chamar por aqui.',
  },
  c: {
    humanIn: 'Combinado, vou chamar um atendente aqui pra continuar com voce.',
    humanOut: 'Combinado, vou chamar um atendente. Agora estamos fora do horario, mas sua mensagem ja ficou anotada.',
    fallback: 'Nao achei certinho ainda. Me manda o modelo do aparelho ou explica rapidinho o que voce procura?',
    autoPause: 'Vou chamar alguem da equipe pra olhar isso melhor com voce.',
    audioUnsupported: 'Recebi seu audio, mas nao consigo ouvir por aqui ainda. Me manda em texto?',
    orderConfirmed: 'Tudo certo com os dados. Vou separar o pedido pra um atendente finalizar com voce.',
    orderHandoff: 'Pedido separado. Vou pausar o bot por aqui e a equipe continua com voce.',
    finish: 'Atendimento finalizado, mas se precisar e so chamar por aqui.',
  },
};
const AUTORESPONDER_AI_SYSTEM_PROMPT = [
  'Voce e o atendente virtual do Mercado do Vale.',
  'PROIBIDO responder produtos, precos, estoque, prazos, garantias, promocoes ou condicoes que nao estejam no contexto enviado pelo sistema.',
  'Se o sistema nao enviar produtos ou dados suficientes, faca apenas uma pergunta curta para entender o que o cliente procura.',
  'Nunca invente informacoes. Nunca diga que tem um produto sem ele aparecer no contexto oficial.',
  'Responda em portugues do Brasil, com tom educado, direto e vendedor.',
].join('\n');
const AUTORESPONDER_NEEDS_PROMPT_FALLBACK = '';
const AUTORESPONDER_PRODUCT_PAGE_SIZE = 5;
const AUTORESPONDER_MAX_PRODUCT_REPLY_MESSAGES = 10;
const AUTORESPONDER_REPLY_DELAY_SCHEDULE_SECONDS = [4, 9, 16, 24, 33, 43, 54, 66, 79, 93];
const AUTORESPONDER_PRODUCT_RESPONSE_LIMIT = AUTORESPONDER_PRODUCT_PAGE_SIZE * AUTORESPONDER_MAX_PRODUCT_REPLY_MESSAGES;
const AUTORESPONDER_COMPLETE_PRODUCT_RESPONSE_LIMIT = 20;
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
const MP_PIX_FEE_PCT = Number(process.env.MP_PIX_FEE_PCT || 0);
const MP_CARD_FEE_PCT = Number(process.env.MP_CARD_FEE_PCT || 0.0499);

const VPS_AUTH_SECRET = process.env.VPS_AUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET || process.env.SYNC_SECRET || 'dev-vps-auth-secret';
const VPS_AUTH_TOKEN_TTL_SECONDS = Number(process.env.VPS_AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30);
const BRASILAPI_NCM_URL = 'https://brasilapi.com.br/api/ncm/v1';
const ADMIN_NAVIGATION_LOG_LIMIT = 5000;
const blingFinanceListCache = new Map();

function getBlingFinanceCacheKey(query) {
  const params = new URLSearchParams();
  for (const key of ['resourceType', 'pagina', 'limite', 'dataVencimentoInicio', 'dataVencimentoFim', 'situacao']) {
    const value = query?.[key];
    if (value != null && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

function clearBlingFinanceListCache() {
  blingFinanceListCache.clear();
}

const CORS_ORIGINS = [
  'https://www.mercadodovale.com.br',
  'https://mercadodovale.com.br',
  'https://staging.mercadodovale.com.br',
  'https://www.mercadodovale.com',
  'https://mercadodovale.com',
  'https://www.xiaomipetrolina.com.br',
  'https://xiaomipetrolina.com.br',
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

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlJson(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function signVpsAuthToken(payload) {
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlJson({
    ...payload,
    iat: now,
    exp: now + VPS_AUTH_TOKEN_TTL_SECONDS,
  });
  const unsigned = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', VPS_AUTH_SECRET).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function verifyVpsAuthToken(token) {
  const [header, body, signature] = String(token || '').split('.');
  if (!header || !body || !signature) return null;
  const unsigned = `${header}.${body}`;
  const expected = crypto.createHmac('sha256', VPS_AUTH_SECRET).update(unsigned).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function normalizeAuthDocument(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeAuthCustomerType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'admin') return 'ADMIN';
  if (normalized === 'resale' || normalized === 'wholesale' || normalized === 'reseller') return 'RESELLER';
  return 'CUSTOMER';
}

function normalizeAuthEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isAuthEmailConfirmationRequired() {
  const normalized = String(process.env.VPS_AUTH_REQUIRE_EMAIL_CONFIRMATION || 'false').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function publicCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id || row.id,
    company_id: row.company_id,
    name: row.name,
    cpf_cnpj: row.cpf_cnpj,
    customer_type: row.customer_type,
    email: row.email,
    phone: row.phone,
    birth_date: row.birth_date,
    instagram: row.instagram,
    facebook: row.facebook,
    address: typeof row.address === 'string' ? safeJsonParse(row.address, null) : row.address,
    custom_data: typeof row.custom_data === 'string' ? safeJsonParse(row.custom_data, null) : row.custom_data,
    referral_code: row.referral_code,
    avatar_url: row.avatar_url,
    is_active: row.is_active === true || row.is_active === 1 || row.is_active === '1',
    account_status: row.account_status || 'active',
    admin_preview_type: row.admin_preview_type,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function ensureCustomerAuthTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_auth (
      customer_id VARCHAR(80) NOT NULL PRIMARY KEY,
      email VARCHAR(255) NULL,
      cpf_cnpj VARCHAR(32) NULL,
      password_hash TEXT NOT NULL,
      salt VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_customer_auth_email (email),
      UNIQUE KEY uniq_customer_auth_cpf (cpf_cnpj)
    )
  `);
}

async function ensurePasswordResetTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_auth_password_resets (
      id VARCHAR(80) NOT NULL PRIMARY KEY,
      customer_id VARCHAR(80) NOT NULL,
      token_hash VARCHAR(128) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_customer_auth_password_reset_token (token_hash),
      KEY idx_customer_auth_password_reset_customer (customer_id),
      KEY idx_customer_auth_password_reset_expires (expires_at)
    )
  `);
}

function hashAuthResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function getPublicAppUrl() {
  return String(process.env.APP_PUBLIC_URL || process.env.VITE_APP_PUBLIC_URL || 'https://www.mercadodovale.com.br').replace(/\/+$/, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCustomerFirstName(customer) {
  return String(customer?.name || 'cliente').split(' ')[0] || 'cliente';
}

function buildPasswordResetEmail({ customer, resetLink, expiresMinutes }) {
  const firstName = getCustomerFirstName(customer);
  const text = [
    `Ola, ${firstName}.`,
    '',
    'Recebemos uma solicitacao para redefinir sua senha no Mercado do Vale.',
    `Use este link para criar uma nova senha: ${resetLink}`,
    '',
    `Este link expira em ${expiresMinutes} minutos.`,
    'Se voce nao solicitou esta alteracao, ignore este e-mail.',
  ].join('\n');
  const html = `
    <p>Ola, ${escapeHtml(firstName)}.</p>
    <p>Recebemos uma solicitacao para redefinir sua senha no Mercado do Vale.</p>
    <p><a href="${escapeHtml(resetLink)}">Clique aqui para criar uma nova senha</a>.</p>
    <p>Este link expira em ${expiresMinutes} minutos.</p>
    <p>Se voce nao solicitou esta alteracao, ignore este e-mail.</p>
  `;

  return {
    subject: 'Redefinicao de senha - Mercado do Vale',
    text,
    html,
  };
}

function buildPasswordChangedEmail({ customer }) {
  const firstName = getCustomerFirstName(customer);
  const loginUrl = `${getPublicAppUrl()}/cliente/login`;
  const text = [
    `Ola, ${firstName}.`,
    '',
    'Sua senha do Mercado do Vale foi alterada com sucesso.',
    `Se foi voce, nenhuma acao adicional e necessaria. Para entrar novamente, acesse: ${loginUrl}`,
    '',
    'Se voce nao fez esta alteracao, entre em contato com a loja imediatamente.',
  ].join('\n');
  const html = `
    <p>Ola, ${escapeHtml(firstName)}.</p>
    <p>Sua senha do Mercado do Vale foi alterada com sucesso.</p>
    <p>Se foi voce, nenhuma acao adicional e necessaria. Para entrar novamente, acesse <a href="${escapeHtml(loginUrl)}">o login da sua conta</a>.</p>
    <p>Se voce nao fez esta alteracao, entre em contato com a loja imediatamente.</p>
  `;

  return {
    subject: 'Senha alterada - Mercado do Vale',
    text,
    html,
  };
}

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || user || '').trim();
  if (!host || !user || !pass || !from) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  const secureValue = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
  return {
    host,
    port,
    secure: secureValue ? ['1', 'true', 'yes'].includes(secureValue) : port === 465,
    user,
    pass,
    from,
  };
}

function encodeSmtpHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

async function smtpReadResponse(state) {
  while (true) {
    const newline = state.buffer.indexOf('\n');
    if (newline >= 0) break;
    await new Promise((resolve, reject) => {
      state.waiters.push({ resolve, reject });
    });
  }
  const lines = [];
  while (true) {
    const newline = state.buffer.indexOf('\n');
    if (newline < 0) break;
    const line = state.buffer.slice(0, newline + 1);
    state.buffer = state.buffer.slice(newline + 1);
    lines.push(line.trim());
    if (/^\d{3}\s/.test(line)) break;
  }
  const last = lines[lines.length - 1] || '';
  const code = Number(last.slice(0, 3));
  return { code, message: lines.join('\n') };
}

async function smtpWrite(socket, state, command, expectedCodes) {
  socket.write(`${command}\r\n`);
  const response = await smtpReadResponse(state);
  const expected = Array.isArray(expectedCodes) ? expectedCodes : [expectedCodes];
  if (!expected.includes(response.code)) {
    throw new Error(`SMTP command failed: ${response.code}`);
  }
  return response;
}

async function sendSmtpMail(config, message) {
  const net = require('net');
  const tls = require('tls');
  let socket = config.secure
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.createConnection({ host: config.host, port: config.port });
  const state = { buffer: '', waiters: [] };
  socket.on('data', (chunk) => {
    state.buffer += chunk.toString('utf8');
    const waiters = state.waiters.splice(0);
    for (const waiter of waiters) waiter.resolve();
  });
  socket.on('error', (err) => {
    const waiters = state.waiters.splice(0);
    for (const waiter of waiters) waiter.reject(err);
  });

  try {
    await smtpReadResponse(state);
    await smtpWrite(socket, state, `EHLO ${config.host}`, 250);
    if (!config.secure && String(process.env.SMTP_STARTTLS || 'true').toLowerCase() !== 'false') {
      await smtpWrite(socket, state, 'STARTTLS', 220);
      socket = tls.connect({ socket, servername: config.host });
      state.buffer = '';
      await smtpWrite(socket, state, `EHLO ${config.host}`, 250);
    }
    await smtpWrite(socket, state, 'AUTH LOGIN', 334);
    await smtpWrite(socket, state, Buffer.from(config.user).toString('base64'), 334);
    await smtpWrite(socket, state, Buffer.from(config.pass).toString('base64'), 235);
    await smtpWrite(socket, state, `MAIL FROM:<${config.from}>`, 250);
    await smtpWrite(socket, state, `RCPT TO:<${message.to}>`, [250, 251]);
    await smtpWrite(socket, state, 'DATA', 354);
    const boundary = `mdv-${crypto.randomBytes(12).toString('hex')}`;
    const raw = [
      `From: ${encodeSmtpHeader(process.env.SMTP_FROM_NAME || 'Mercado do Vale')} <${config.from}>`,
      `To: <${message.to}>`,
      `Subject: ${encodeSmtpHeader(message.subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      message.text,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      message.html,
      '',
      `--${boundary}--`,
      '.',
      '',
    ].join('\r\n');
    socket.write(raw);
    const dataResponse = await smtpReadResponse(state);
    if (dataResponse.code !== 250) throw new Error(`SMTP DATA failed: ${dataResponse.code}`);
    await smtpWrite(socket, state, 'QUIT', 221).catch(() => null);
    return { sent: true };
  } finally {
    socket.end();
  }
}

async function sendTransactionalEmail(message) {
  const config = getSmtpConfig();
  if (!config) return { sent: false, reason: 'smtp_not_configured' };
  return sendSmtpMail(config, message);
}

function hashVpsPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password || ''), salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve({ salt, hash: derivedKey.toString('hex') });
    });
  });
}

async function verifyVpsPassword(password, salt, expectedHash) {
  const { hash } = await hashVpsPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(String(expectedHash), 'hex'));
}

function getDefaultAdminAuthConfig() {
  const email = normalizeAuthEmail(
    process.env.MDV_ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL ||
    process.env.VPS_ADMIN_EMAIL ||
    process.env.DEFAULT_ADMIN_EMAIL ||
    'admin@mercadodovale.com.br'
  );
  const password = String(
    process.env.MDV_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    process.env.VPS_ADMIN_PASSWORD ||
    process.env.DEFAULT_ADMIN_PASSWORD ||
    ''
  );
  const name = String(
    process.env.MDV_ADMIN_NAME ||
    process.env.ADMIN_NAME ||
    process.env.VPS_ADMIN_NAME ||
    'Administrador Mercado do Vale'
  ).trim();
  const cpfCnpj = normalizeAuthDocument(
    process.env.MDV_ADMIN_CPF_CNPJ ||
    process.env.ADMIN_CPF_CNPJ ||
    process.env.VPS_ADMIN_CPF_CNPJ ||
    ''
  );
  const companyId = String(process.env.COMPANY_ID || process.env.VITE_COMPANY_ID || '9717131e-7b14-4aec-84a4-4317c0489985');
  return { email, password, name, cpfCnpj, companyId };
}

async function ensureDefaultAdminAccount() {
  await ensureCustomerAuthTable();
  const { email, password, name, cpfCnpj, companyId } = getDefaultAdminAuthConfig();
  if (!email) {
    console.warn('[auth] Admin bootstrap skipped: missing MDV_ADMIN_EMAIL/ADMIN_EMAIL.');
    return null;
  }

  let customer = await findCustomerForAuth({ email, cpfCnpj });
  if (!customer) {
    const [admins] = await pool.query('SELECT * FROM customers WHERE customer_type = "ADMIN" ORDER BY updated_at DESC, created_at DESC LIMIT 1');
    customer = admins?.[0] || null;
  }

  if (!customer) {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO customers
       (id, user_id, company_id, name, cpf_cnpj, email, customer_type, is_active, account_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ADMIN', 1, 'active', NOW(), NOW())`,
      [id, id, companyId, name || 'Administrador Mercado do Vale', cpfCnpj || null, email]
    );
    customer = await findCustomerForAuth({ customerId: id });
  } else {
    await pool.query(
      `UPDATE customers
       SET user_id = COALESCE(user_id, id),
           name = COALESCE(NULLIF(name, ''), ?),
           email = ?,
           cpf_cnpj = COALESCE(NULLIF(cpf_cnpj, ''), ?),
           customer_type = 'ADMIN',
           is_active = 1,
           account_status = 'active',
           updated_at = NOW()
       WHERE id = ?`,
      [name || 'Administrador Mercado do Vale', email, cpfCnpj || null, customer.id]
    );
    customer = await findCustomerForAuth({ customerId: customer.id });
  }

  if (!password) {
    const [existingAuth] = await pool.query('SELECT customer_id FROM customer_auth WHERE customer_id = ? LIMIT 1', [customer.id]);
    if (!existingAuth?.[0]) {
      console.warn('[auth] Admin customer exists but has no VPS login. Set MDV_ADMIN_PASSWORD or ADMIN_PASSWORD and restart.');
    }
    return customer;
  }

  if (password.length < 6) {
    console.warn('[auth] Admin bootstrap skipped: admin password must have at least 6 characters.');
    return customer;
  }

  const authEmail = normalizeAuthEmail(customer.email || email);
  const authCpfCnpj = normalizeAuthDocument(customer.cpf_cnpj || cpfCnpj) || null;
  const { salt, hash } = await hashVpsPassword(password);
  await pool.query(
    `INSERT INTO customer_auth (customer_id, email, cpf_cnpj, password_hash, salt)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), cpf_cnpj = VALUES(cpf_cnpj), password_hash = VALUES(password_hash), salt = VALUES(salt), updated_at = NOW()`,
    [customer.id, authEmail, authCpfCnpj, hash, salt]
  );
  console.log(`[auth] Default admin VPS login ensured for ${authEmail}`);
  return customer;
}

async function findCustomerForAuth({ email, cpfCnpj, customerId }) {
  const where = [];
  const params = [];
  if (customerId) {
    where.push('id = ?');
    params.push(customerId);
  }
  if (email) {
    where.push('LOWER(email) = ?');
    params.push(normalizeAuthEmail(email));
  }
  if (cpfCnpj) {
    where.push('REPLACE(REPLACE(REPLACE(cpf_cnpj, ".", ""), "-", ""), "/", "") = ?');
    params.push(normalizeAuthDocument(cpfCnpj));
  }
  if (!where.length) return null;
  const [rows] = await pool.query(`SELECT * FROM customers WHERE ${where.join(' OR ')} LIMIT 1`, params);
  return rows?.[0] || null;
}

function authResponseForCustomer(customer) {
  const safeCustomer = publicCustomer(customer);
  const user = {
    id: safeCustomer.user_id || safeCustomer.id,
    email: safeCustomer.email || '',
    user_metadata: {
      full_name: safeCustomer.name,
      cpf_cnpj: safeCustomer.cpf_cnpj,
    },
  };
  const token = signVpsAuthToken({
    userId: user.id,
    customerId: safeCustomer.id,
    customerType: safeCustomer.customer_type || 'retail',
  });
  return { token, user, customer: safeCustomer, emailConfirmationRequired: isAuthEmailConfirmationRequired() };
}

async function getVpsBearerAuthContext(request) {
  const token = getBearerToken(request);
  if (!token) {
    return { userId: null, customerId: null, isAdmin: false };
  }

  try {
    const payload = verifyVpsAuthToken(token);
    if (!payload?.customerId) return { userId: null, customerId: null, isAdmin: false };
    const [rows] = await pool.query('SELECT id, user_id, customer_type FROM customers WHERE id = ? LIMIT 1', [payload.customerId]);
    const customer = rows?.[0] || null;
    return {
      userId: payload.userId || customer?.user_id || customer?.id || null,
      customerId: customer?.id || null,
      isAdmin: customer?.customer_type === 'ADMIN',
    };
  } catch (err) {
    console.warn('[auth] VPS Bearer validation failed:', err.message);
    return { userId: null, customerId: null, isAdmin: false };
  }
}

async function isAdminBearerToken(request) {
  const auth = await getVpsBearerAuthContext(request);
  return auth.isAdmin;
}

async function requireSyncKeyOrAdmin(request, reply) {
  const key = request.headers['x-sync-key'] || request.headers['x-api-key'];
  if (key && key === process.env.SYNC_SECRET) return;
  if (await isAdminBearerToken(request)) return;
  return reply.code(401).send({ error: 'Unauthorized' });
}

async function requireSyncKeyOrCustomer(request, reply) {
  const key = request.headers['x-sync-key'] || request.headers['x-api-key'];
  if (key && key === process.env.SYNC_SECRET) {
    request.customerAccess = { isSync: true, isAdmin: false, customerId: null };
    return;
  }
  const auth = await getVpsBearerAuthContext(request);
  if (auth.isAdmin) {
    request.customerAccess = { isSync: false, isAdmin: true, customerId: auth.customerId };
    return;
  }
  if (auth.customerId) {
    request.customerAccess = { isSync: false, isAdmin: false, customerId: auth.customerId };
    return;
  }
  return reply.code(401).send({ error: 'Unauthorized' });
}

function hashPdvDisplaySecret(value) {
  return crypto.createHash('sha256').update(String(value || '').trim()).digest('hex');
}

function generatePdvDisplayPairingCode() {
  const left = String(crypto.randomInt(0, 1000)).padStart(3, '0');
  const right = String(crypto.randomInt(0, 1000)).padStart(3, '0');
  return `${left}-${right}`;
}

function normalizePdvDisplayPairingCode(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 6);
  if (digits.length !== 6) return '';
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function generatePdvDisplayToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function parsePdvDisplayJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function mapPdvDisplayRow(row) {
  if (!row) return null;
  return {
    ...row,
    is_active: Number(row.is_active) === 1,
    settings: parsePdvDisplayJson(row.settings_json, {}),
    idle_content: parsePdvDisplayJson(row.idle_content_json, { banners: [], products: [], messages: [] }),
  };
}

function mapPdvPixPaymentRow(row) {
  if (!row) return null;
  return {
    ...row,
    amount: Number(row.amount || 0),
    raw_response: parsePdvDisplayJson(row.raw_response_json, null),
  };
}

function normalizePdvPixStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'approved') return 'approved';
  if (value === 'rejected' || value === 'cancelled' || value === 'canceled' || value === 'refunded') return 'rejected';
  if (value === 'expired') return 'expired';
  if (value === 'pending' || value === 'in_process' || value === 'authorized') return 'pending';
  return value || 'pending';
}

async function getPdvMercadoPagoAccessToken() {
  const [integrations] = await pool.query(
    "SELECT access_token, environment FROM payment_integrations WHERE gateway_name = 'mercado_pago' AND is_active = 1 LIMIT 1"
  );
  const accessToken = integrations?.[0]?.access_token;
  if (!accessToken) return null;
  return {
    accessToken,
    environment: String(integrations?.[0]?.environment || '').toLowerCase() === 'production' ? 'production' : 'sandbox',
  };
}

function buildPdvPixResponse(row) {
  const payment = mapPdvPixPaymentRow(row);
  if (!payment) return null;
  return {
    ...payment,
    qr_code: row.qr_code,
    qr_code_base64: row.qr_code_base64,
    ticket_url: row.ticket_url,
  };
}

fastify.post('/auth/login', async (request, reply) => {
  await ensureCustomerAuthTable();
  const body = request.body || {};
  const email = normalizeAuthEmail(body.email);
  const cpfCnpj = normalizeAuthDocument(body.cpf_cnpj || body.cpf || body.document);
  const password = String(body.password || '');
  if ((!email && !cpfCnpj) || !password) {
    return reply.code(400).send({ error: 'Email/CPF e senha sao obrigatorios' });
  }

  const clauses = [];
  const params = [];
  if (email) {
    clauses.push('ca.email = ?');
    params.push(email);
  }
  if (cpfCnpj) {
    clauses.push('ca.cpf_cnpj = ?');
    params.push(cpfCnpj);
  }

  const [rows] = await pool.query(
    `SELECT c.*, ca.password_hash, ca.salt
     FROM customer_auth ca
     JOIN customers c ON c.id = ca.customer_id
     WHERE ${clauses.join(' OR ')}
     LIMIT 1`,
    params
  );
  const row = rows?.[0] || null;
  if (!row || !(await verifyVpsPassword(password, row.salt, row.password_hash))) {
    return reply.code(401).send({ error: 'Credenciais invalidas' });
  }
  if (row.is_active === 0 || row.account_status === 'pending') {
    return reply.code(403).send({ error: 'Conta pendente ou inativa' });
  }

  return authResponseForCustomer(row);
});

fastify.post('/auth/register', async (request, reply) => {
  await ensureCustomerAuthTable();
  const body = request.body || {};
  const email = normalizeAuthEmail(body.email);
  const cpfCnpj = normalizeAuthDocument(body.cpf_cnpj);
  const password = String(body.password || '');
  const name = String(body.name || '').trim();
  if (!email || !cpfCnpj || !password || !name) {
    return reply.code(400).send({ error: 'Nome, email, CPF/CNPJ e senha sao obrigatorios' });
  }
  if (password.length < 6) {
    return reply.code(400).send({ error: 'A senha deve ter pelo menos 6 caracteres' });
  }

  let customer = await findCustomerForAuth({ email, cpfCnpj });
  const [existingAuth] = await pool.query(
    'SELECT customer_id FROM customer_auth WHERE email = ? OR cpf_cnpj = ? LIMIT 1',
    [email, cpfCnpj]
  );
  if (existingAuth?.[0]) {
    return reply.code(409).send({ error: 'Este email ou CPF/CNPJ ja possui login' });
  }

  const companyId = String(body.company_id || process.env.COMPANY_ID || process.env.VITE_COMPANY_ID || '9717131e-7b14-4aec-84a4-4317c0489985');
  if (!customer) {
    const id = crypto.randomUUID();
    const referralCode = `MV-${id.replace(/-/g, '').slice(0, 5).toUpperCase()}`;
    await pool.query(
      `INSERT INTO customers
       (id, user_id, company_id, name, cpf_cnpj, email, phone, birth_date, customer_type, is_active, account_status, address, referral_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?, NOW(), NOW())`,
      [
        id,
        id,
        companyId,
        name,
        cpfCnpj,
        email,
        body.phone || null,
        body.birth_date || null,
        normalizeAuthCustomerType(body.customer_type),
        body.address ? JSON.stringify(body.address) : null,
        referralCode,
      ]
    );
    customer = await findCustomerForAuth({ customerId: id });
  } else {
    await pool.query(
      `UPDATE customers
       SET user_id = COALESCE(user_id, id), email = COALESCE(NULLIF(email, ''), ?), phone = COALESCE(NULLIF(phone, ''), ?), account_status = 'active', updated_at = NOW()
       WHERE id = ?`,
      [email, body.phone || null, customer.id]
    );
    customer = await findCustomerForAuth({ customerId: customer.id });
  }

  const { salt, hash } = await hashVpsPassword(password);
  await pool.query(
    `INSERT INTO customer_auth (customer_id, email, cpf_cnpj, password_hash, salt)
     VALUES (?, ?, ?, ?, ?)`,
    [customer.id, email, cpfCnpj, hash, salt]
  );

  return reply.code(201).send(authResponseForCustomer(customer));
});

fastify.get('/auth/me', async (request, reply) => {
  const auth = await getVpsBearerAuthContext(request);
  if (!auth.customerId) return reply.code(401).send({ error: 'Unauthorized' });
  const [rows] = await pool.query('SELECT * FROM customers WHERE id = ? LIMIT 1', [auth.customerId]);
  const customer = rows?.[0] || null;
  if (!customer) return reply.code(401).send({ error: 'Unauthorized' });
  return authResponseForCustomer(customer);
});

fastify.post('/auth/password', async (request, reply) => {
  await ensureCustomerAuthTable();
  const auth = await getVpsBearerAuthContext(request);
  if (!auth.customerId) return reply.code(401).send({ error: 'Unauthorized' });
  const password = String(request.body?.password || '');
  if (password.length < 6) return reply.code(400).send({ error: 'A senha deve ter pelo menos 6 caracteres' });
  const [customers] = await pool.query('SELECT id, email, cpf_cnpj FROM customers WHERE id = ? LIMIT 1', [auth.customerId]);
  const customer = customers?.[0] || null;
  if (!customer) return reply.code(404).send({ error: 'Cliente nao encontrado' });
  const { salt, hash } = await hashVpsPassword(password);
  await pool.query(
    `INSERT INTO customer_auth (customer_id, email, cpf_cnpj, password_hash, salt)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), salt = VALUES(salt), updated_at = NOW()`,
    [customer.id, normalizeAuthEmail(customer.email), normalizeAuthDocument(customer.cpf_cnpj), hash, salt]
  );
  return { ok: true };
});

fastify.post('/auth/password-reset/request', async (request, reply) => {
  await ensureCustomerAuthTable();
  await ensurePasswordResetTable();
  const email = normalizeAuthEmail(request.body?.email);
  if (!email || !email.includes('@')) {
    return reply.code(400).send({ error: 'Informe um e-mail valido' });
  }

  const genericResponse = { ok: true };
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.email
     FROM customer_auth ca
     JOIN customers c ON c.id = ca.customer_id
     WHERE ca.email = ?
     LIMIT 1`,
    [email]
  );
  const customer = rows?.[0] || null;
  if (!customer) return genericResponse;

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashAuthResetToken(token);
  const expiresMinutes = Math.max(10, Number(process.env.VPS_AUTH_PASSWORD_RESET_TTL_MINUTES || 60));
  await pool.query(
    `INSERT INTO customer_auth_password_resets (id, customer_id, token_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [crypto.randomUUID(), customer.id, tokenHash, expiresMinutes]
  );

  const resetLink = `${getPublicAppUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`;
  const emailMessage = buildPasswordResetEmail({ customer, resetLink, expiresMinutes });

  try {
    const result = await sendTransactionalEmail({
      to: email,
      ...emailMessage,
    });
    if (!result.sent) console.warn('[auth] Password reset email not sent:', result.reason);
  } catch (err) {
    console.warn('[auth] Password reset email failed:', err.message);
  }

  return genericResponse;
});

fastify.post('/auth/password-reset/confirm', async (request, reply) => {
  await ensureCustomerAuthTable();
  await ensurePasswordResetTable();
  const token = String(request.body?.token || '').trim();
  const password = String(request.body?.password || '');
  if (!token || password.length < 6) {
    return reply.code(400).send({ error: 'Token e senha valida sao obrigatorios' });
  }

  const tokenHash = hashAuthResetToken(token);
  const [rows] = await pool.query(
    `SELECT customer_id, expires_at, used_at
     FROM customer_auth_password_resets
     WHERE token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );
  const reset = rows?.[0] || null;
  if (!reset || reset.used_at || new Date(reset.expires_at).getTime() < Date.now()) {
    return reply.code(400).send({ error: 'Link de recuperacao invalido ou expirado' });
  }

  const [customers] = await pool.query('SELECT id, email, cpf_cnpj FROM customers WHERE id = ? LIMIT 1', [reset.customer_id]);
  const customer = customers?.[0] || null;
  if (!customer) return reply.code(400).send({ error: 'Link de recuperacao invalido ou expirado' });

  const { salt, hash } = await hashVpsPassword(password);
  await pool.query(
    `UPDATE customer_auth
     SET password_hash = ?, salt = ?, updated_at = NOW()
     WHERE customer_id = ?`,
    [hash, salt, customer.id]
  );
  await pool.query(
    'UPDATE customer_auth_password_resets SET used_at = NOW() WHERE token_hash = ?',
    [tokenHash]
  );

  try {
    const email = normalizeAuthEmail(customer.email);
    if (email) {
      const emailMessage = buildPasswordChangedEmail({ customer });
      const result = await sendTransactionalEmail({
        to: email,
        ...emailMessage,
      });
      if (!result.sent) console.warn('[auth] Password changed email not sent:', result.reason);
    }
  } catch (err) {
    console.warn('[auth] Password changed email failed:', err.message);
  }

  return { ok: true };
});

fastify.post('/auth/admin/users', { preHandler: requireSyncKeyOrAdmin }, async (request, reply) => {
  await ensureCustomerAuthTable();
  const body = request.body || {};
  const customerId = String(body.customer_id || '').trim();
  const email = normalizeAuthEmail(body.email);
  const cpfCnpj = normalizeAuthDocument(body.cpf_cnpj);
  const password = String(body.password || '');
  if (!customerId || !email || !cpfCnpj || password.length < 6) {
    return reply.code(400).send({ error: 'customer_id, email, cpf_cnpj e senha valida sao obrigatorios' });
  }
  const [customers] = await pool.query('SELECT id FROM customers WHERE id = ? LIMIT 1', [customerId]);
  if (!customers?.[0]) return reply.code(404).send({ error: 'Cliente nao encontrado' });
  const { salt, hash } = await hashVpsPassword(password);
  await pool.query(
    `INSERT INTO customer_auth (customer_id, email, cpf_cnpj, password_hash, salt)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), cpf_cnpj = VALUES(cpf_cnpj), password_hash = VALUES(password_hash), salt = VALUES(salt), updated_at = NOW()`,
    [customerId, email, cpfCnpj, hash, salt]
  );
  await pool.query('UPDATE customers SET user_id = COALESCE(user_id, id), account_status = "active", updated_at = NOW() WHERE id = ?', [customerId]);
  return { ok: true, customer_id: customerId };
});

function limitText(value, maxLength) {
  const text = String(value || '').trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeNavigationMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const safe = {};
  for (const [key, raw] of Object.entries(value)) {
    const safeKey = limitText(key, 60);
    if (!safeKey) continue;
    if (raw === null || typeof raw === 'number' || typeof raw === 'boolean') {
      safe[safeKey] = raw;
      continue;
    }
    safe[safeKey] = limitText(raw, 300);
  }
  return Object.keys(safe).length ? JSON.stringify(safe) : null;
}

const ADMIN_PREFERENCE_KEY_RE = /^[a-z0-9._:-]{1,80}$/i;

function normalizeAdminPreferenceKey(value) {
  const key = String(value || '').trim();
  return ADMIN_PREFERENCE_KEY_RE.test(key) ? key : '';
}

function parseAdminPreferenceValue(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function normalizeAdminPreferenceValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const text = JSON.stringify(value);
  if (text.length > 10000) return null;
  return text;
}

async function pruneAdminNavigationLogs() {
  await pool.query(
    `DELETE FROM admin_navigation_logs
     WHERE id NOT IN (
       SELECT id FROM (
         SELECT id FROM admin_navigation_logs ORDER BY id DESC LIMIT ?
       ) AS recent_navigation_logs
     )`,
    [ADMIN_NAVIGATION_LOG_LIMIT]
  );
}

fastify.post('/admin/navigation-log', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {
  const body = req.body || {};
  const auth = await getVpsBearerAuthContext(req);
  const pathname = limitText(body.pathname || body.path, 512);
  if (!pathname || (!pathname.startsWith('/admin') && !pathname.startsWith('/pdv'))) {
    return reply.code(400).send({ error: 'Invalid navigation path' });
  }

  const metadata_json = normalizeNavigationMetadata(body.metadata);
  const userAgent = limitText(req.headers['user-agent'], 255);

  await pool.query(
    `INSERT INTO admin_navigation_logs
      (pathname, search, hash_fragment, full_url, title, referrer_path, user_id, customer_id, user_agent, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pathname,
      limitText(body.search, 512),
      limitText(body.hash, 128),
      limitText(body.fullUrl || body.full_url, 1000),
      limitText(body.title, 255),
      limitText(body.referrerPath || body.referrer_path, 512),
      auth.userId || null,
      auth.customerId || null,
      userAgent,
      metadata_json,
    ]
  );

  await pruneAdminNavigationLogs();
  return reply.code(201).send({ ok: true });
});

fastify.get('/admin/navigation-log', { preHandler: requireSyncKeyOrAdmin }, async (req) => {
  const rawLimit = Number(req.query?.limit || 200);
  const limit = Math.max(1, Math.min(ADMIN_NAVIGATION_LOG_LIMIT, Number.isFinite(rawLimit) ? rawLimit : 200));
  const [rows] = await pool.query(
    `SELECT id, created_at, pathname, search, hash_fragment, full_url, title, referrer_path, user_id, customer_id, user_agent, metadata_json
     FROM admin_navigation_logs
     ORDER BY id DESC
     LIMIT ?`,
    [limit]
  );
  return { ok: true, limit, items: rows };
});

// ─── Helpers ───────────────────────────────────────────────────────────────
fastify.get('/admin/preferences/:key', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {
  const key = normalizeAdminPreferenceKey(req.params?.key);
  if (!key) return reply.code(400).send({ error: 'Invalid preference key' });

  const [rows] = await pool.query(
    'SELECT preference_key, value_json, updated_at FROM admin_preferences WHERE preference_key = ? LIMIT 1',
    [key]
  );
  const row = rows?.[0] || null;
  return {
    ok: true,
    key,
    value: parseAdminPreferenceValue(row?.value_json),
    updated_at: row?.updated_at || null,
  };
});

fastify.patch('/admin/preferences/:key', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {
  const key = normalizeAdminPreferenceKey(req.params?.key);
  if (!key) return reply.code(400).send({ error: 'Invalid preference key' });

  const valueJson = normalizeAdminPreferenceValue(req.body?.value);
  if (!valueJson) return reply.code(400).send({ error: 'Invalid preference value' });

  await pool.query(
    `INSERT INTO admin_preferences (preference_key, value_json)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = CURRENT_TIMESTAMP`,
    [key, valueJson]
  );

  return {
    ok: true,
    key,
    value: JSON.parse(valueJson),
  };
});

function normalizeVpsProxyPath(input) {
  const value = Array.isArray(input) ? input[0] : input;
  const proxyPath = String(value || '').trim();
  if (!proxyPath || !proxyPath.startsWith('/')) return '';
  if (proxyPath.startsWith('/api/')) return '';
  return proxyPath;
}

function isVpsProxySensitiveGetPath(proxyPath) {
  return (
    proxyPath.startsWith('/company-settings') ||
    proxyPath.startsWith('/admin/') ||
    proxyPath.startsWith('/table-data/') ||
    proxyPath.startsWith('/images/list')
  );
}

function isVpsProxyPublicProductReadPath(pathname) {
  if (pathname === '/products' || pathname === '/products/category-counts') return true;
  if (/^\/products\/by-category\/[^/]+$/u.test(pathname)) return true;
  if (/^\/products\/by-(?:slug|ean)\/[^/]+$/u.test(pathname)) return true;
  if (/^\/products\/[^/]+\/combo$/u.test(pathname)) return true;
  return /^\/products\/[^/]+$/u.test(pathname);
}

const VPS_PROXY_PUBLIC_TABLE_DATA_READ_TABLES = new Set([
  'cashback_settings',
  'colors',
  'companies',
  'model_color_images',
  'product_reviews',
  'promotions',
]);

function isVpsProxyPublicTableDataReadPath(pathname) {
  const match = pathname.match(/^\/table-data\/([a-zA-Z0-9_]+)$/u);
  return Boolean(match && VPS_PROXY_PUBLIC_TABLE_DATA_READ_TABLES.has(match[1]));
}

function isVpsProxyPublicPath(proxyPath, method = 'GET') {
  const normalizedMethod = String(method || 'GET').toUpperCase();
  const pathname = proxyPath.split('?')[0] || '/';

  if (normalizedMethod === 'POST' && /^\/banners\/[^/]+\/(?:click|view)$/u.test(pathname)) {
    return true;
  }

  if (normalizedMethod === 'POST' && pathname === '/pdv/displays/pair') {
    return true;
  }

  if (normalizedMethod === 'GET' && pathname === '/pdv/display-state') {
    return true;
  }

  if (normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD') return false;

  if (
    pathname === '/banners' ||
    pathname === '/battery-healths' ||
    pathname === '/brands' ||
    pathname === '/catalog-settings' ||
    pathname === '/catalog/metadata' ||
    pathname === '/categories' ||
    pathname === '/check-video' ||
    pathname === '/field-presets' ||
    pathname === '/payment-fees' ||
    pathname === '/public/company-settings' ||
    pathname === '/public/check-video' ||
    pathname === '/rams' ||
    pathname === '/shipping/price-ranges' ||
    pathname === '/shipping/settings' ||
    pathname === '/shipping/zones' ||
    pathname === '/status' ||
    pathname === '/storages' ||
    pathname === '/versions' ||
    pathname === '/warranty-templates'
  ) {
    return true;
  }

  if (pathname.startsWith('/coupons/validate/')) return true;
  if (pathname.startsWith('/video/')) return true;
  if (/^\/versions\/[^/]+$/u.test(pathname)) return true;
  if (isVpsProxyPublicTableDataReadPath(pathname)) return true;

  return isVpsProxyPublicProductReadPath(pathname);
}

function extractVpsProxyFavoritesCustomerId(proxyPath) {
  const match = proxyPath.match(/^\/customers\/([^/]+)\/favorites(?:\/[^/]+)?$/);
  return match?.[1] || null;
}

async function handleBrasilapiNcmProxy(request, reply) {
  const search = String(request.query?.search || '').trim();
  if (!search || search.length < 2) {
    return reply.code(400).send({ error: 'Missing or invalid search parameter' });
  }

  try {
    const upstream = await fetch(`${BRASILAPI_NCM_URL}?search=${encodeURIComponent(search)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    const body = await upstream.text();
    return reply
      .code(upstream.status)
      .header('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
      .header('cache-control', 's-maxage=86400, stale-while-revalidate=604800')
      .send(body);
  } catch (err) {
    return reply.code(502).send({ error: 'BrasilAPI unavailable', detail: err.message });
  }
}

function buildVpsProxyPayload(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  if (request.body == null) return undefined;
  if (Buffer.isBuffer(request.body) || typeof request.body === 'string') return request.body;
  return JSON.stringify(request.body);
}

function buildCopyableDebug(operation, details = {}) {
  return {
    timestamp: new Date().toISOString(),
    operation,
    ...details,
  };
}

function maskDebugValue(value, visible = 4) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= visible) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.max(0, text.length - visible))}${text.slice(-visible)}`;
}

function sanitizeCustomerDebtDebugDetails(details = {}) {
  const sanitized = { ...details };
  if (sanitized.cpf_cnpj) sanitized.cpf_cnpj = maskDebugValue(sanitized.cpf_cnpj);
  if (sanitized.access_token) sanitized.access_token = '[redacted]';
  if (sanitized.authorization) sanitized.authorization = '[redacted]';
  if (sanitized.raw_response && typeof sanitized.raw_response === 'string' && sanitized.raw_response.length > 1200) {
    sanitized.raw_response = sanitized.raw_response.slice(0, 1200);
  }
  if (sanitized.raw_message && typeof sanitized.raw_message === 'string' && sanitized.raw_message.length > 1200) {
    sanitized.raw_message = sanitized.raw_message.slice(0, 1200);
  }
  return sanitized;
}

function buildCustomerDebtDebug(step, details = {}) {
  const sanitized = sanitizeCustomerDebtDebugDetails(details);
  return {
    timestamp: new Date().toISOString(),
    operation: 'customer-debt',
    step,
    details: {
      ...sanitized,
      access_token: details.access_token ? '[redacted]' : sanitized.access_token,
      authorization: details.authorization ? '[redacted]' : sanitized.authorization,
    },
  };
}

function quoteSqlIdentifier(identifier) {
  const value = String(identifier || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }
  return `\`${value}\``;
}

function normalizeDbPayload(payload = {}) {
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [
    key,
    normalizeDbValue(value),
  ]));
}

function normalizeDbValue(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
    return value.slice(0, 19).replace('T', ' ');
  }
  return value && typeof value === 'object' ? JSON.stringify(value) : value;
}

function splitTopLevelCommas(value = '') {
  const parts = [];
  let current = '';
  let depth = 0;
  let quoted = false;
  for (const char of String(value)) {
    if (char === '"') quoted = !quoted;
    if (!quoted && char === '(') depth += 1;
    if (!quoted && char === ')') depth -= 1;
    if (!quoted && depth === 0 && char === ',') {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  return parts;
}

function cleanVpsFilterValue(value) {
  return String(value ?? '').replace(/^"|"$/g, '');
}

function buildVpsDbFilter(column, rawExpression) {
  const field = quoteSqlIdentifier(column);
  const expression = String(rawExpression || '');
  const opMatch = expression.match(/^([a-z.]+)\.(.*)$/i);
  if (!opMatch) throw new Error(`Unsupported filter expression: ${column}=${expression}`);
  const op = opMatch[1];
  const rawValue = cleanVpsFilterValue(opMatch[2]);

  if (op === 'eq') return { sql: `${field} = ?`, params: [rawValue] };
  if (op === 'neq') return { sql: `${field} <> ?`, params: [rawValue] };
  if (op === 'gt') return { sql: `${field} > ?`, params: [rawValue] };
  if (op === 'gte') return { sql: `${field} >= ?`, params: [rawValue] };
  if (op === 'lt') return { sql: `${field} < ?`, params: [rawValue] };
  if (op === 'lte') return { sql: `${field} <= ?`, params: [rawValue] };
  if (op === 'ilike') return { sql: `${field} LIKE ?`, params: [rawValue.replace(/\*/g, '%')] };
  if (op === 'is' && rawValue === 'null') return { sql: `${field} IS NULL`, params: [] };
  if (op === 'not.is' && rawValue === 'null') return { sql: `${field} IS NOT NULL`, params: [] };
  if (op === 'in') {
    const list = rawValue.replace(/^\(|\)$/g, '');
    const values = splitTopLevelCommas(list).map((item) => cleanVpsFilterValue(item.trim())).filter(Boolean);
    if (!values.length) return { sql: '1 = 0', params: [] };
    return { sql: `${field} IN (${values.map(() => '?').join(', ')})`, params: values };
  }

  throw new Error(`Unsupported filter operator: ${op}`);
}

function buildVpsDbOrFilter(rawExpression) {
  const inner = String(rawExpression || '').replace(/^\(|\)$/g, '');
  const filters = splitTopLevelCommas(inner).map((part) => {
    const match = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\.([a-z.]+)\.(.*)$/i);
    if (!match) throw new Error(`Unsupported OR filter: ${part}`);
    return buildVpsDbFilter(match[1], `${match[2]}.${match[3]}`);
  });
  return {
    sql: `(${filters.map((filter) => filter.sql).join(' OR ')})`,
    params: filters.flatMap((filter) => filter.params),
  };
}

function parseVpsDbQuery(query = '') {
  const params = new URLSearchParams(String(query || ''));
  const where = [];
  const values = [];
  let orderSql = '';
  let limitSql = '';
  let selectSql = '*';

  const select = params.get('select');
  if (select && select !== '*') {
    selectSql = select.split(',').map((field) => quoteSqlIdentifier(field.trim())).join(', ');
  }

  for (const [key, value] of params.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue;
    const filter = key === 'or' ? buildVpsDbOrFilter(value) : buildVpsDbFilter(key, value);
    where.push(filter.sql);
    values.push(...filter.params);
  }

  const order = params.get('order');
  if (order) {
    const [column, direction = 'asc'] = order.split('.');
    const normalizedDirection = String(direction).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    orderSql = ` ORDER BY ${quoteSqlIdentifier(column)} ${normalizedDirection}`;
  }

  const limit = Number(params.get('limit'));
  const offset = Number(params.get('offset'));
  if (Number.isFinite(limit) && limit >= 0) {
    limitSql = ' LIMIT ?';
    values.push(limit);
    if (Number.isFinite(offset) && offset > 0) {
      limitSql += ' OFFSET ?';
      values.push(offset);
    }
  }

  return {
    selectSql,
    whereSql: where.length ? ` WHERE ${where.join(' AND ')}` : '',
    orderSql,
    limitSql,
    values,
  };
}

async function vpsDbSelect(table, query) {
  const parsed = parseVpsDbQuery(query);
  const [rows] = await pool.query(
    `SELECT ${parsed.selectSql} FROM ${quoteSqlIdentifier(table)}${parsed.whereSql}${parsed.orderSql}${parsed.limitSql}`,
    parsed.values,
  );
  return rows;
}

async function vpsDbPatch(table, query, payload) {
  const normalized = normalizeDbPayload(payload);
  const entries = Object.entries(normalized);
  if (!entries.length) return vpsDbSelect(table, query);
  const parsed = parseVpsDbQuery(query);
  const setSql = entries.map(([key]) => `${quoteSqlIdentifier(key)} = ?`).join(', ');
  await pool.query(
    `UPDATE ${quoteSqlIdentifier(table)} SET ${setSql}${parsed.whereSql}`,
    [...entries.map(([, value]) => value), ...parsed.values],
  );
  return vpsDbSelect(table, query);
}

async function vpsDbInsert(table, payload) {
  const normalized = normalizeDbPayload(payload);
  const entries = Object.entries(normalized);
  if (!entries.length) throw new Error('Insert payload is empty');
  const columns = entries.map(([key]) => quoteSqlIdentifier(key)).join(', ');
  const placeholders = entries.map(() => '?').join(', ');
  const [result] = await pool.query(
    `INSERT INTO ${quoteSqlIdentifier(table)} (${columns}) VALUES (${placeholders})`,
    entries.map(([, value]) => value),
  );
  const id = normalized.id ?? result.insertId;
  return id ? vpsDbSelect(table, `select=*&id=eq.${encodeURIComponent(String(id))}&limit=1`) : [payload];
}

async function vpsDbDelete(table, query) {
  const parsed = parseVpsDbQuery(query);
  await pool.query(`DELETE FROM ${quoteSqlIdentifier(table)}${parsed.whereSql}`, parsed.values);
  return [];
}

async function vpsDbUpsert(table, query, payload) {
  const params = new URLSearchParams(String(query || ''));
  const conflictColumn = params.get('on_conflict') || 'id';
  const normalized = normalizeDbPayload(payload);
  const entries = Object.entries(normalized);
  const columns = entries.map(([key]) => quoteSqlIdentifier(key)).join(', ');
  const placeholders = entries.map(() => '?').join(', ');
  const updates = entries
    .filter(([key]) => key !== conflictColumn)
    .map(([key]) => `${quoteSqlIdentifier(key)} = VALUES(${quoteSqlIdentifier(key)})`)
    .join(', ');
  await pool.query(
    `INSERT INTO ${quoteSqlIdentifier(table)} (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates || `${quoteSqlIdentifier(conflictColumn)} = ${quoteSqlIdentifier(conflictColumn)}`}`,
    entries.map(([, value]) => value),
  );
  return vpsDbSelect(table, `select=*&${conflictColumn}=eq.${encodeURIComponent(String(normalized[conflictColumn]))}&limit=1`);
}

function isMercadoPagoWebhookPayload(body) {
  if (!body || typeof body !== 'object') return false;
  const type = String(body.type || '').toLowerCase();
  const action = String(body.action || '').toLowerCase();
  return (type === 'payment' || action.startsWith('payment.')) && !!body?.data?.id;
}

function getMercadoPagoPaymentMetadata(payment) {
  return payment?.metadata && typeof payment.metadata === 'object' ? payment.metadata : {};
}

function getCustomerDebtExternalReference(payment) {
  return String(payment?.external_reference || '').trim();
}

function getCustomerDebtWebhookContext(payment) {
  const metadata = getMercadoPagoPaymentMetadata(payment);
  const external_reference = getCustomerDebtExternalReference(payment);
  const referenceDebtId = external_reference.startsWith('customer_debt:')
    ? external_reference.replace('customer_debt:', '').trim()
    : '';
  const debtId = String(metadata.debt_id || referenceDebtId || '').trim();
  const valorLiquido = Number(
    metadata.valor_liquido_centavos ?? metadata.valor_liquido ?? metadata.amount_centavos ?? 0
  );

  return {
    metadata,
    external_reference,
    debtId,
    valorLiquidoCentavos: Number.isFinite(valorLiquido) ? Math.round(valorLiquido) : 0,
  };
}

function isCustomerDebtMercadoPagoPayment(payment) {
  const { metadata, external_reference } = getCustomerDebtWebhookContext(payment);
  return metadata.flow === 'customer_debt' || external_reference.startsWith('customer_debt:');
}

function formatDateOnly(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

async function processCustomerDebtMercadoPagoPayment(payment) {
  const gatewayPaymentId = String(payment?.id || '').trim();
  const { debtId, valorLiquidoCentavos, external_reference, metadata } = getCustomerDebtWebhookContext(payment);

  if (!debtId) {
    return {
      status: 200,
      body: {
        error: 'customer debt not identified',
        debug: buildCustomerDebtDebug('received webhook', {
          step: 'identify customer debt',
          paymentId: gatewayPaymentId,
          external_reference,
          metadata,
        }),
      },
    };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [debts] = await connection.query('SELECT * FROM customer_debts WHERE id = ? FOR UPDATE', [debtId]);
    const debt = debts?.[0];
    if (!debt) {
      await connection.rollback();
      return {
        status: 200,
        body: {
          error: 'customer debt not found',
          debug: buildCustomerDebtDebug('resolved customer debt', {
            step: 'find customer debt',
            paymentId: gatewayPaymentId,
            debtId,
            external_reference,
          }),
        },
      };
    }

    const [existingPayments] = await connection.query(
      'SELECT id, debt_id FROM customer_debt_payments WHERE mercado_pago_id = ? LIMIT 1',
      [gatewayPaymentId]
    );
    if (existingPayments.length > 0) {
      await connection.commit();
      return {
        status: 200,
        body: {
          message: 'already processed',
          debt_id: existingPayments[0].debt_id,
          payment_id: existingPayments[0].id,
          debug: buildCustomerDebtDebug('already processed mercado_pago_id', {
            mercado_pago_id: gatewayPaymentId,
            debt_id: existingPayments[0].debt_id,
          }),
        },
      };
    }

    const [directIntents] = await connection.query(
      'SELECT * FROM customer_debt_payment_intents WHERE provider_intent_id = ? LIMIT 1',
      [gatewayPaymentId]
    );
    let intent = directIntents?.[0] || null;
    if (!intent) {
      const [latestIntents] = await connection.query(
        `SELECT * FROM customer_debt_payment_intents
         WHERE debt_id = ? AND status = 'created'
         ORDER BY created_at DESC LIMIT 1`,
        [debtId]
      );
      intent = latestIntents?.[0] || null;
    }

    if (Number(debt.saldo_devedor || 0) <= 0 || debt.status === 'paid') {
      if (intent) {
        await connection.query(
          'UPDATE customer_debt_payment_intents SET status = ?, raw_response = ? WHERE id = ?',
          ['approved', JSON.stringify(payment), intent.id]
        );
      }
      await connection.commit();
      return { status: 200, body: { message: 'debt already paid', debt_id: debtId } };
    }

    const fallbackAmount = Math.round(Number(payment?.transaction_amount || 0) * 100);
    const valorBase = valorLiquidoCentavos || Number(intent?.valor_liquido || 0) || fallbackAmount;
    const valorPagoCentavos = Math.min(Math.max(0, Math.round(valorBase)), Number(debt.saldo_devedor || 0));

    if (valorPagoCentavos <= 0) {
      await connection.rollback();
      return {
        status: 200,
        body: {
        error: 'invalid customer debt payment amount',
          debug: buildCustomerDebtDebug('validate customer debt payment amount', {
            step: 'validate payment amount',
            paymentId: gatewayPaymentId,
            debtId,
            valorLiquidoCentavos,
            intentValorLiquido: intent?.valor_liquido || null,
            transactionAmount: payment?.transaction_amount || null,
          }),
        },
      };
    }

    const paymentId = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
    const dataPagamento = formatDateOnly(payment?.date_approved || payment?.date_created || new Date());
    const metodoPagamento = String(payment?.payment_method_id || payment?.payment_type_id || 'mercado_pago').slice(0, 40);
    const mercadoPagoLink =
      payment?.transaction_details?.external_resource_url ||
      payment?.point_of_interaction?.transaction_data?.ticket_url ||
      payment?.receipt_url ||
      null;

    await connection.query(
      `INSERT INTO customer_debt_payments
        (id, debt_id, valor_pago, data_pagamento, metodo_pagamento, observacoes, mercado_pago_id, mercado_pago_link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        debtId,
        valorPagoCentavos,
        dataPagamento,
        metodoPagamento,
        'Baixa automatica via Mercado Pago',
        gatewayPaymentId,
        mercadoPagoLink,
      ]
    );

    const novoSaldo = Number(debt.saldo_devedor || 0) - valorPagoCentavos;
    const novoStatus = novoSaldo === 0 ? 'paid' : 'partial';
    await connection.query('UPDATE customer_debts SET saldo_devedor = ?, status = ? WHERE id = ?', [
      novoSaldo,
      novoStatus,
      debtId,
    ]);

    if (intent) {
      await connection.query(
        'UPDATE customer_debt_payment_intents SET status = ?, provider_intent_id = COALESCE(provider_intent_id, ?), raw_response = ? WHERE id = ?',
        ['approved', gatewayPaymentId, JSON.stringify(payment), intent.id]
      );
    }

    const [customers] = await connection.query(
      'SELECT name, cpf_cnpj, phone, email FROM customers WHERE id = ?',
      [debt.customer_id]
    );

    let receiptId = null;
    if (customers.length > 0) {
      const customer = customers[0];
      receiptId = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
      const receiptNumber = `REC-${dataPagamento.replace(/-/g, '')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      await connection.query(
        `INSERT INTO avulso_receipts
          (id, numero, tipo, nome_contato, cpf_cnpj, telefone, email, customer_id, valor, descricao, data_emissao)
         VALUES (?, ?, 'receber', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          receiptId,
          receiptNumber,
          customer.name,
          customer.cpf_cnpj || null,
          customer.phone || null,
          customer.email || null,
          debt.customer_id,
          valorPagoCentavos / 100,
          `Baixa automatica Mercado Pago - Ref: ${debt.descricao}`,
          dataPagamento,
        ]
      );
    }

    await connection.commit();
    return {
      status: 200,
      body: {
        message: 'success',
        flow: 'customer_debt',
        debt_id: debtId,
        payment_id: paymentId,
        receipt_id: receiptId,
        saldo_devedor: novoSaldo,
        status: novoStatus,
        debug: buildCustomerDebtDebug('committed customer debt payment', {
          mercado_pago_id: gatewayPaymentId,
          debt_id: debtId,
          payment_id: paymentId,
          receipt_id: receiptId,
          saldo_devedor: novoSaldo,
          status: novoStatus,
        }),
      },
    };
  } catch (err) {
    await connection.rollback().catch(() => {});
    return {
      status: 200,
      body: {
        error: 'customer debt payment failed',
        debug: buildCustomerDebtDebug('process customer debt payment failed', {
          step: 'process customer debt payment',
          paymentId: gatewayPaymentId,
          debtId,
          external_reference,
          rawMessage: err.message,
          status: err.status || null,
          body: err.body || null,
        }),
      },
    };
  } finally {
    connection.release();
  }
}

async function handleMercadoPagoWebhookVps(body) {
  const paymentId = String(body?.data?.id || '').trim();
  if (!paymentId) {
    return { status: 200, body: { message: 'ignored', reason: 'no payment id' } };
  }

  try {
    const [integrations] = await pool.query(
      "SELECT access_token, is_active FROM payment_integrations WHERE gateway_name = 'mercado_pago' AND is_active = 1 LIMIT 1"
    );
    const integration = integrations?.[0] || null;
    if (!integration?.access_token) {
      return {
        status: 200,
        body: {
          error: 'integration not configured',
          debug: buildCopyableDebug('mercadopago-webhook', {
            step: 'load integration',
            paymentId,
            rawMessage: 'Active Mercado Pago integration not found',
          }),
        },
      };
    }

    const mercadoPagoResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: `Bearer ${integration.access_token}` },
        signal: AbortSignal.timeout(12000),
      }
    );

    if (!mercadoPagoResponse.ok) {
      const rawBody = await mercadoPagoResponse.text().catch(() => '');
      return {
        status: 200,
        body: {
          error: 'payment lookup failed',
          debug: buildCopyableDebug('mercadopago-webhook', {
            step: 'verify payment',
            paymentId,
            mercadoPagoStatus: mercadoPagoResponse.status,
            rawMessage: rawBody.slice(0, 1200),
          }),
        },
      };
    }

    const payment = await mercadoPagoResponse.json();
    if (payment.status !== 'approved') {
      return { status: 200, body: { message: 'ignored', reason: `status=${payment.status}` } };
    }

    if (isCustomerDebtMercadoPagoPayment(payment)) {
      return processCustomerDebtMercadoPagoPayment(payment);
    }

    const gatewayPaymentId = String(payment.id);
    const orders = await vpsDbSelect(
      'orders',
      `select=id,status&gateway_payment_id=eq.${encodeURIComponent(gatewayPaymentId)}&limit=1`
    );
    const order = Array.isArray(orders) ? orders[0] : null;

    if (!order) {
      return {
        status: 200,
        body: {
          error: 'order not found',
          debug: buildCopyableDebug('mercadopago-webhook', {
            step: 'find order',
            paymentId,
            gatewayPaymentId,
            rawMessage: 'No order found for gateway_payment_id',
          }),
        },
      };
    }

    const finalStatuses = ['paid', 'preparing', 'shipped', 'delivered', 'completed'];
    if (finalStatuses.includes(order.status)) {
      return { status: 200, body: { message: 'already processed', order_id: order.id } };
    }

    await vpsDbPatch('orders', `id=eq.${encodeURIComponent(order.id)}`, { status: 'paid', payment_status: 'paid' });

    return { status: 200, body: { message: 'success', order_id: order.id } };
  } catch (err) {
    return {
      status: 200,
      body: {
        error: 'webhook processing failed',
        debug: buildCopyableDebug('mercadopago-webhook', {
          step: 'process webhook',
          paymentId,
          rawMessage: err.message,
          status: err.status || null,
          body: err.body || null,
        }),
      },
    };
  }
}

fastify.get('/api/brasilapi-ncm', handleBrasilapiNcmProxy);

function normalizeShippingCep(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildFrenetShippingBody(body) {
  return {
    SellerCEP: normalizeShippingCep(body.from_cep),
    RecipientCEP: normalizeShippingCep(body.to_cep),
    RecipientCountry: 'BR',
    ShipmentInvoiceValue: Math.max((body.order_value ?? 0) / 100, 10),
    ShippingItemArray: [
      {
        Height: body.height_cm ?? 10,
        Length: body.length_cm ?? 20,
        Quantity: 1,
        Weight: (body.weight_g ?? 300) / 1000,
        Width: body.width_cm ?? 15,
      },
    ],
  };
}

function getMelhorEnvioBaseUrl(sandbox) {
  return sandbox ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br';
}

async function readShippingJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function shippingError(status, error, details = {}) {
  return {
    status,
    body: {
      error,
      debug: buildCopyableDebug('shipping', details),
    },
  };
}

async function handleShippingApiVps(query, body = {}) {
  const provider = String(query?.provider || '');
  const action = String(query?.action || '');

  if (provider === 'frenet' && action === 'calculate') {
    if (!body.token) return shippingError(400, 'Token Frenet nao fornecido', { provider, action, step: 'validate token' });
    if (!body.from_cep || !body.to_cep) return shippingError(400, 'CEP de origem e destino sao obrigatorios', { provider, action, step: 'validate cep' });

    const apiRes = await fetch('https://api.frenet.com.br/shipping/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', token: body.token },
      body: JSON.stringify(buildFrenetShippingBody(body)),
    });
    const data = await readShippingJsonResponse(apiRes);
    if (!apiRes.ok) return shippingError(apiRes.status, data, { provider, action, step: 'frenet quote', upstreamStatus: apiRes.status });
    return { status: 200, body: data };
  }

  if (provider === 'melhor-envio' && action === 'calculate') {
    if (!body.token) return shippingError(400, 'Token do Melhor Envio nao fornecido', { provider, action, step: 'validate token' });
    if (!body.from_cep || !body.to_cep) return shippingError(400, 'CEP de origem e destino sao obrigatorios', { provider, action, step: 'validate cep' });

    const melhorEnvioBody = {
      from: { postal_code: normalizeShippingCep(body.from_cep) },
      to: { postal_code: normalizeShippingCep(body.to_cep) },
      package: {
        height: body.height_cm ?? 10,
        width: body.width_cm ?? 15,
        length: body.length_cm ?? 20,
        weight: (body.weight_g ?? 300) / 1000,
      },
      options: { insurance_value: 0, receipt: false, own_hand: false },
    };

    const apiRes = await fetch(`${getMelhorEnvioBaseUrl(body.sandbox)}/api/v2/me/shipment/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${body.token}`,
        'User-Agent': 'MercadoDoVale/1.0 (suporte@mercadodovale.com)',
      },
      body: JSON.stringify(melhorEnvioBody),
    });
    const data = await readShippingJsonResponse(apiRes);
    if (!apiRes.ok) return shippingError(apiRes.status, data, { provider, action, step: 'melhor-envio calculate', upstreamStatus: apiRes.status, sandbox: !!body.sandbox });
    return { status: 200, body: data };
  }

  if (provider === 'melhor-envio' && action === 'label') {
    if (!body.token || !body.carrier_id || !body.from_cep || !body.to?.name) {
      return shippingError(400, 'Dados incompletos', { provider, action, step: 'validate label payload' });
    }

    const baseUrl = getMelhorEnvioBaseUrl(body.sandbox);
    const baseApiUrl = `${baseUrl}/api/v2`;
    const headers = {
      Authorization: `Bearer ${body.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'MercadoDoVale/1.0 (suporte@mercadodovale.com)',
    };
    const cartBody = {
      service: body.carrier_id,
      from: { postal_code: body.from_cep },
      to: {
        name: body.to.name,
        phone: body.to.phone,
        email: '',
        document: body.to.document,
        company_document: '',
        address: body.to.address,
        city: body.to.city,
        district: body.to.district,
        state_abbr: body.to.state_abbr,
        postal_code: body.to.postal_code,
        number: body.to.number,
        complement: body.to.complement || '',
      },
      package: (body.products || []).map((product) => ({
        name: product.name,
        quantity: product.quantity,
        unitary_value: 1,
        weight: product.weight,
      })),
      options: { insurance_value: 0, receipt: false, own_hand: false },
    };

    const cartRes = await fetch(`${baseUrl}/api/v2/me/cart`, { method: 'POST', headers, body: JSON.stringify(cartBody) });
    const cartData = await readShippingJsonResponse(cartRes);
    if (!cartRes.ok) return shippingError(cartRes.status, cartData?.message || 'Erro ao adicionar ao carrinho', { provider, action, step: 'melhor-envio cart', upstreamStatus: cartRes.status });

    const orderId = cartData?.id;
    if (!orderId) return shippingError(502, 'ID do pedido nao retornado', { provider, action, step: 'melhor-envio cart id' });

    const checkoutRes = await fetch(`${baseUrl}/api/v2/me/shipment/checkout`, { method: 'POST', headers, body: JSON.stringify({ orders: [orderId] }) });
    if (!checkoutRes.ok) {
      const checkoutData = await readShippingJsonResponse(checkoutRes);
      return shippingError(checkoutRes.status, checkoutData?.message || 'Erro no checkout', { provider, action, step: 'melhor-envio checkout', upstreamStatus: checkoutRes.status });
    }

    const generateRes = await fetch(`${baseUrl}/api/v2/me/shipment/generate`, { method: 'POST', headers, body: JSON.stringify({ orders: [orderId] }) });
    if (!generateRes.ok) {
      const generateData = await readShippingJsonResponse(generateRes);
      return shippingError(generateRes.status, generateData?.message || 'Erro ao gerar etiqueta', { provider, action, step: 'melhor-envio generate', upstreamStatus: generateRes.status });
    }

    const printUrl = `${baseUrl}/shipment/print?orders[]=${orderId}&token=${body.token}`;
    return { status: 200, body: { url: printUrl, order_id: orderId } };
  }

  return shippingError(404, 'Provider or action not match', { provider, action, step: 'route dispatch' });
}

fastify.post('/api/shipping', async (request, reply) => {
  try {
    const result = await handleShippingApiVps(request.query, request.body || {});
    return reply.code(result.status).send(result.body);
  } catch (err) {
    return reply.code(500).send({
      error: err.message || 'Erro interno no frete',
      debug: buildCopyableDebug('shipping', {
        provider: String(request.query?.provider || ''),
        action: String(request.query?.action || ''),
        step: 'unexpected exception',
        rawMessage: err.message,
      }),
    });
  }
});

function blingRedirect(reply, location, statusCode = 302) {
  return reply.code(statusCode).header('Location', location).send();
}

function buildBlingCallbackUrl(request, configuredCallbackUrl) {
  if (configuredCallbackUrl) {
    const value = String(configuredCallbackUrl);
    if (value.startsWith('http')) return value;
    const protocol = request.headers['x-forwarded-proto'] || 'https';
    const host = request.headers['x-forwarded-host'] || request.headers.host;
    return `${protocol}://${host}${value}`;
  }
  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  return `${protocol}://${host}/api/auth/callback/bling`;
}

function getShopeeBaseUrlVps(partnerId) {
  if (String(partnerId) === '1229870' || process.env.SHOPEE_ENV === 'sandbox') {
    return 'https://partner.test-stable.shopeemobile.com';
  }
  return 'https://partner.shopeemobile.com';
}

function generateShopeePublicSignVps(partnerId, partnerKey, apiPath, timestamp) {
  const baseString = `${partnerId}${apiPath}${timestamp}`;
  return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

function buildShopeeCallbackUrlVps() {
  const origin = String(process.env.SHOPEE_REDIRECT_BASE_URL || 'https://www.mercadodovale.com.br').replace(/\/+$/, '');
  return `${origin}/api/shopee?action=callback`;
}

async function handleShopeeOAuthVps(request, reply) {
  const action = String(request.query?.action || '');

  if (action === 'auth') {
    try {
      const rows = await vpsDbSelect('company_settings', 'select=shopee_partner_id,shopee_partner_key&limit=1');
      const settings = Array.isArray(rows) ? rows[0] : null;
      if (!settings?.shopee_partner_id || !settings?.shopee_partner_key) {
        return reply.code(400).send({ error: 'Shopee Partner ID e Key não configurados no painel.' });
      }
      const partnerId = String(settings.shopee_partner_id);
      const apiPath = '/api/v2/shop/auth_partner';
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateShopeePublicSignVps(partnerId, settings.shopee_partner_key, apiPath, timestamp);
      const redirectUrl = buildShopeeCallbackUrlVps(request);
      const authUrl = `${getShopeeBaseUrlVps(partnerId)}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirectUrl)}`;
      return reply.code(200).send({ url: authUrl });
    } catch (err) {
      return reply.code(500).send({
        error: err.message,
        debug: buildCopyableDebug('shopee-oauth', {
          step: 'build auth url',
          rawMessage: err.message,
        }),
      });
    }
  }

  if (action === 'callback') {
    const { code, shop_id, main_account_id } = request.query || {};
    if (!code || (!shop_id && !main_account_id)) {
      return reply.type('text/html; charset=utf-8').code(400).send('<h1>Falha na autorização</h1><p>Parâmetros ausentes (code, shop_id).</p>');
    }
    try {
      const rows = await vpsDbSelect('company_settings', 'select=id,shopee_partner_id,shopee_partner_key&limit=1');
      const settings = Array.isArray(rows) ? rows[0] : null;
      if (!settings?.shopee_partner_id || !settings?.shopee_partner_key) {
        return reply.type('text/html; charset=utf-8').code(500).send('<h1>Erro Interno</h1><p>Credenciais da Shopee não encontradas.</p>');
      }
      const partnerId = Number(settings.shopee_partner_id);
      const activeShopId = Number(shop_id || main_account_id);
      const apiPath = '/api/v2/auth/token/get';
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateShopeePublicSignVps(String(partnerId), settings.shopee_partner_key, apiPath, timestamp);
      const tokenUrl = `${getShopeeBaseUrlVps(partnerId)}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, shop_id: activeShopId, partner_id: partnerId }),
        signal: AbortSignal.timeout(15000),
      });
      const tokenData = await tokenResponse.json();
      if (tokenData?.error) {
        return reply.type('text/html; charset=utf-8').code(400).send(`<h1>Erro na comunicação com a Shopee</h1><p>${tokenData.error}: ${tokenData.message || ''}</p>`);
      }
      await vpsDbPatch('company_settings', `id=eq.${encodeURIComponent(String(settings.id))}`, {
        shopee_shop_id: activeShopId.toString(),
        shopee_access_token: tokenData.access_token,
        shopee_refresh_token: tokenData.refresh_token,
      });
      return reply.type('text/html; charset=utf-8').code(200).send(`
        <html><head><title>Shopee Autorizada</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #ee4d2d;">Conexão Bem-Sucedida!</h1>
          <p>A integração com a sua loja Shopee foi completada.</p>
          <p>Você já pode fechar esta aba e voltar para o Painel.</p>
          <script>setTimeout(() => { window.location.href = '/admin/settings/shopee'; }, 5000);</script>
        </body></html>
      `);
    } catch (err) {
      return reply.code(500).send({
        error: err.message,
        debug: buildCopyableDebug('shopee-oauth', {
          step: 'callback token exchange',
          rawMessage: err.message,
        }),
      });
    }
  }

  return reply.code(404).send({ error: 'Route not found or missing action.' });
}

async function handleShopeeWebhookVps(request, reply) {
  if (request.method !== 'POST') return reply.code(405).send({ error: 'Method Not Allowed' });

  try {
    return reply.code(200).send({ message: 'success' });
  } catch (err) {
    console.error('[shopee-webhook] fatal:', buildCopyableDebug('shopee-webhook', {
      step: 'process webhook',
      rawMessage: err.message,
    }));
    return reply.code(200).send({ error: err.message });
  }
}

function generateShopeeShopSignVps(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId) {
  const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

function isRetryableShopeeAuthErrorVps(data) {
  return ['invalid_access_token', 'invalid_acceess_token', 'error_auth'].includes(String(data?.error || ''));
}

async function readShopeeCatalogJsonResponseVps(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function getShopeeCatalogCredentialsVps() {
  const rows = await vpsDbSelect('company_settings', 'select=shopee_partner_id,shopee_partner_key,shopee_access_token,shopee_shop_id,shopee_refresh_token&limit=1');
  const settings = Array.isArray(rows) ? rows[0] : null;
  if (!settings?.shopee_partner_id || !settings?.shopee_partner_key || !settings?.shopee_access_token || !settings?.shopee_shop_id) {
    throw new Error('Shopee não autenticada. Configure as credenciais no painel.');
  }
  return {
    partnerId: String(settings.shopee_partner_id),
    partnerKey: String(settings.shopee_partner_key),
    accessToken: String(settings.shopee_access_token),
    shopId: String(settings.shopee_shop_id),
    refreshToken: settings.shopee_refresh_token ? String(settings.shopee_refresh_token) : '',
  };
}

async function refreshShopeeCatalogTokenVps(creds) {
  if (!creds.refreshToken) throw new Error('Shopee refresh token ausente.');
  const apiPath = '/api/v2/auth/access_token/get';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateShopeePublicSignVps(creds.partnerId, creds.partnerKey, apiPath, timestamp);
  const url = `${getShopeeBaseUrlVps(creds.partnerId)}${apiPath}?partner_id=${creds.partnerId}&timestamp=${timestamp}&sign=${sign}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partner_id: Number(creds.partnerId),
      refresh_token: creds.refreshToken,
      shop_id: Number(creds.shopId),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const tokenData = await readShopeeCatalogJsonResponseVps(response);
  if (!response.ok || tokenData?.error) {
    throw new Error(tokenData?.message || tokenData?.error || 'Erro ao renovar token Shopee');
  }
  await vpsDbPatch('company_settings', 'shopee_partner_id=not.is.null', {
    shopee_access_token: tokenData.access_token,
    shopee_refresh_token: tokenData.refresh_token,
  });
  return {
    ...creds,
    accessToken: String(tokenData.access_token),
    refreshToken: String(tokenData.refresh_token || creds.refreshToken),
  };
}

function buildShopeeCatalogUrlVps(apiPath, creds, extraParams = '') {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateShopeeShopSignVps(creds.partnerId, creds.partnerKey, apiPath, timestamp, creds.accessToken, creds.shopId);
  let url = `${getShopeeBaseUrlVps(creds.partnerId)}${apiPath}?partner_id=${creds.partnerId}&timestamp=${timestamp}&access_token=${encodeURIComponent(creds.accessToken)}&shop_id=${creds.shopId}&sign=${sign}`;
  if (extraParams) url += `&${extraParams}`;
  return url;
}

async function shopeeCatalogRequestVps(method, apiPath, creds, body, extraParams = '', alreadyRetried = false) {
  const response = await fetch(buildShopeeCatalogUrlVps(apiPath, creds, extraParams), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await readShopeeCatalogJsonResponseVps(response);
  if (isRetryableShopeeAuthErrorVps(data) && !alreadyRetried) {
    const refreshedCreds = await refreshShopeeCatalogTokenVps(creds);
    return shopeeCatalogRequestVps(method, apiPath, refreshedCreds, body, extraParams, true);
  }
  return { status: response.status, ok: response.ok, data };
}

async function shopeeCatalogGetVps(apiPath, creds, extraParams = '') {
  return shopeeCatalogRequestVps('GET', apiPath, creds, null, extraParams);
}

async function shopeeCatalogPostVps(apiPath, creds, body = {}, extraParams = '') {
  return shopeeCatalogRequestVps('POST', apiPath, creds, body, extraParams);
}

function clampShopeeCatalogIntVps(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function encodeShopeeCatalogParamsVps(params) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') searchParams.set(key, String(value));
  }
  return searchParams.toString();
}

function requireShopeeCatalogPostVps(request, reply) {
  if (request.method === 'POST') return false;
  reply.code(405).send({ error: 'POST required' });
  return true;
}

function firstShopeeCatalogStringVps(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function isNoShopeeCatalogGtinValueVps(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  return ['SEM GTIN', 'SEM_GTIN', 'NAO POSSUI', 'ISENTO'].includes(normalized);
}

async function resolveShopeeCatalogMediaInputVps(dataUrl, remoteUrl, expectedPrefix) {
  const dataValue = String(dataUrl || '');
  const urlValue = String(remoteUrl || '');

  if (dataValue) {
    const matches = dataValue.match(/^data:([^;]+);base64,(.*)$/);
    if (!matches || !matches[1].startsWith(expectedPrefix)) return null;
    return {
      mimeType: matches[1],
      buffer: Buffer.from(matches[2], 'base64'),
      fileNameHint: `upload.${matches[1].split('/')[1] || 'bin'}`,
    };
  }

  if (urlValue) {
    const response = await fetch(urlValue, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Falha ao baixar midia remota: ${response.status}`);
    const mimeType = response.headers.get('content-type') || (expectedPrefix === 'image/' ? 'image/jpeg' : 'video/mp4');
    if (!mimeType.startsWith(expectedPrefix)) return null;
    return {
      mimeType,
      buffer: Buffer.from(await response.arrayBuffer()),
      fileNameHint: urlValue.split('/').pop() || `upload.${mimeType.split('/')[1] || 'bin'}`,
    };
  }

  return null;
}

function md5ShopeeCatalogHexVps(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function getShopeeCatalogVideoUploadIdVps(data) {
  return firstShopeeCatalogStringVps(
    data?.response?.video_upload_id,
    data?.response?.upload_id,
    data?.video_upload_id,
    data?.upload_id,
  );
}

function getShopeeCatalogVideoUploadStatusVps(data) {
  return String(
    data?.response?.status ||
    data?.response?.video_upload_result?.status ||
    data?.response?.video_info?.status ||
    data?.status ||
    ''
  ).toLowerCase();
}

async function normalizeShopeeCatalogPricePayloadVps(incoming, creds) {
  const itemId = Number(incoming?.item_id);
  const incomingPriceList = Array.isArray(incoming?.price_list) ? incoming.price_list : [];

  if (!Number.isFinite(itemId) || itemId <= 0) {
    return { error: { status: 400, body: { error: 'item_id required' } } };
  }
  if (incomingPriceList.length === 0) {
    return { error: { status: 400, body: { error: 'price_list required' } } };
  }

  const detailResult = await shopeeCatalogGetVps('/api/v2/product/get_item_base_info', creds, encodeShopeeCatalogParamsVps({
    item_id_list: itemId,
    need_tax_info: false,
    need_complaint_policy: false,
  }));
  const currentItem = detailResult.data?.response?.item_list?.[0] || null;
  const hasModel = currentItem?.has_model === true || currentItem?.has_model === 1 || currentItem?.has_model === '1';
  const hasZeroModel = incomingPriceList.some((row) => Number(row?.model_id) === 0);
  const pricePayload = { item_id: itemId, price_list: incomingPriceList };

  if (hasModel || hasZeroModel) {
    const modelResult = await shopeeCatalogGetVps('/api/v2/product/get_model_list', creds, encodeShopeeCatalogParamsVps({ item_id: itemId }));
    const modelList = Array.isArray(modelResult.data?.response?.model) ? modelResult.data.response.model : [];
    const modelIds = modelList.map((model) => Number(model?.model_id)).filter((id) => Number.isFinite(id) && id > 0);
    const firstPrice = incomingPriceList.find((row) => Number(row?.original_price) > 0);
    const fallbackPrice = Number(firstPrice?.original_price);
    const incomingByModel = new Map();

    for (const row of incomingPriceList) {
      const modelId = Number(row?.model_id);
      const price = Number(row?.original_price);
      if (Number.isFinite(modelId) && modelId > 0 && Number.isFinite(price) && price > 0) {
        incomingByModel.set(modelId, price);
      }
    }

    const expandedPriceList = modelIds
      .map((modelId) => ({
        model_id: modelId,
        original_price: Number(incomingByModel.get(modelId) ?? fallbackPrice),
      }))
      .filter((row) => Number.isFinite(row.original_price) && row.original_price > 0);

    if (expandedPriceList.length > 0) {
      pricePayload.price_list = expandedPriceList;
    }
  }

  return { payload: pricePayload };
}

async function mergeShopeeCatalogUpdateItemPayloadVps(incoming, creds) {
  const itemId = Number(incoming?.item_id);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return { error: { status: 400, body: { error: 'item_id required' } } };
  }

  const detailResult = await shopeeCatalogGetVps('/api/v2/product/get_item_base_info', creds, encodeShopeeCatalogParamsVps({
    item_id_list: itemId,
    need_tax_info: true,
    need_complaint_policy: false,
  }));
  const currentItem = detailResult.data?.response?.item_list?.[0] || null;
  const currentDim = currentItem?.dimension || {};
  const hasModel = currentItem?.has_model === true;
  const currentTax = currentItem?.tax_info && typeof currentItem.tax_info === 'object' ? { ...currentItem.tax_info } : {};
  const incomingTax = incoming?.tax_info && typeof incoming.tax_info === 'object' ? { ...incoming.tax_info } : {};
  const incomingGtinCandidate = firstShopeeCatalogStringVps(incomingTax.gtin, incoming.gtin_code);
  const noGtinSelected = isNoShopeeCatalogGtinValueVps(incomingGtinCandidate);
  const resolvedGtin = noGtinSelected
    ? 'SEM GTIN'
    : firstShopeeCatalogStringVps(incomingTax.gtin, incoming.gtin_code, currentTax.gtin, currentItem?.gtin_code, currentItem?.gtin, currentItem?.ean);
  const mergedTax = { ...currentTax, ...incomingTax };

  if (resolvedGtin) {
    mergedTax.gtin = resolvedGtin;
    incoming.gtin_code = resolvedGtin;
  }

  if (hasModel && resolvedGtin) {
    const modelResult = await shopeeCatalogGetVps('/api/v2/product/get_model_list', creds, encodeShopeeCatalogParamsVps({ item_id: itemId }));
    const modelList = Array.isArray(modelResult.data?.response?.model) ? modelResult.data.response.model : [];
    const modelPayload = {
      item_id: itemId,
      model: modelList
        .filter((model) => model?.model_id != null)
        .map((model) => ({ model_id: model.model_id, gtin_code: resolvedGtin })),
    };

    if (modelPayload.model.length > 0) {
      const modelUpdate = await shopeeCatalogPostVps('/api/v2/product/update_model', creds, modelPayload);
      if (modelUpdate.data?.error) return { earlyResult: modelUpdate };
    }
  }

  const payload = {
    ...incoming,
    item_id: itemId,
    condition: incoming.condition ?? currentItem?.condition,
    item_sku: incoming.item_sku ?? currentItem?.item_sku,
    item_weight: incoming.item_weight ?? currentItem?.weight,
    package_length: incoming.package_length ?? currentDim.package_length,
    package_width: incoming.package_width ?? currentDim.package_width,
    package_height: incoming.package_height ?? currentDim.package_height,
    tax_info: Object.keys(mergedTax).length > 0 ? mergedTax : undefined,
  };

  if (!payload.tax_info) delete payload.tax_info;
  if (!payload.gtin_code) delete payload.gtin_code;
  return { payload };
}

async function handleShopeeCatalogVps(request, reply) {
  const action = String(request.query?.action || '');
  const query = request.query || {};

  try {
    if (action === 'attributes' && !query.category_id) return reply.code(400).send({ error: 'category_id required' });
    if (action === 'search_attribute_values' && !query.attribute_id) return reply.code(400).send({ error: 'attribute_id required' });
    if (action === 'brand_list' && !query.category_id) return reply.code(400).send({ error: 'category_id required' });
    if (action === 'get_item_base_info' && !query.item_id_list) return reply.code(400).send({ error: 'item_id_list required' });
    if (action === 'get_model_list' && !query.item_id) return reply.code(400).send({ error: 'item_id required' });

    const creds = await getShopeeCatalogCredentialsVps();
    let result;

    switch (action) {
      case 'categories':
        result = await shopeeCatalogGetVps('/api/v2/product/get_category', creds, encodeShopeeCatalogParamsVps({ language: query.language || 'pt-BR' }));
        break;
      case 'attributes':
        result = await shopeeCatalogGetVps('/api/v2/product/get_attribute_tree', creds, encodeShopeeCatalogParamsVps({ category_id_list: query.category_id, language: query.language || 'pt-BR' }));
        break;
      case 'search_attribute_values':
        result = await shopeeCatalogPostVps('/api/v2/product/search_attribute_value_list', creds, {}, encodeShopeeCatalogParamsVps({
          attribute_id: query.attribute_id,
          keyword: query.keyword,
          cursor: clampShopeeCatalogIntVps(query.cursor, 0, 0, 999999),
          limit: clampShopeeCatalogIntVps(query.limit, 20, 1, 100),
        }));
        break;
      case 'brand_list':
        result = await shopeeCatalogGetVps('/api/v2/product/get_brand_list', creds, encodeShopeeCatalogParamsVps({
          category_id: query.category_id,
          status: query.status || 1,
          page_size: clampShopeeCatalogIntVps(query.page_size, 20, 1, 100),
          offset: clampShopeeCatalogIntVps(query.offset, 0, 0, 999999),
        }));
        break;
      case 'shop_info':
        result = await shopeeCatalogGetVps('/api/v2/shop/get_shop_info', creds);
        break;
      case 'logistics_channel_list':
        result = await shopeeCatalogGetVps('/api/v2/logistics/get_channel_list', creds);
        break;
      case 'warehouse_list':
        result = await shopeeCatalogGetVps('/api/v2/inventory/get_warehouse_list', creds);
        break;
      case 'warehouse_detail':
        result = await shopeeCatalogGetVps('/api/v2/shop/get_warehouse_detail', creds, encodeShopeeCatalogParamsVps({ warehouse_type: query.warehouse_type || 1 }));
        break;
      case 'warehouse_locations':
        result = await shopeeCatalogGetVps('/api/v2/merchant/get_merchant_warehouse_location_list', creds, encodeShopeeCatalogParamsVps({ merchant_id: query.merchant_id }));
        break;
      case 'add_item':
        if (requireShopeeCatalogPostVps(request, reply)) return;
        result = await shopeeCatalogPostVps('/api/v2/product/add_item', creds, request.body || {});
        break;
      case 'update_price': {
        if (requireShopeeCatalogPostVps(request, reply)) return;
        const normalized = await normalizeShopeeCatalogPricePayloadVps(request.body || {}, creds);
        if (normalized.error) return reply.code(normalized.error.status).send(normalized.error.body);
        result = await shopeeCatalogPostVps('/api/v2/product/update_price', creds, normalized.payload);
        break;
      }
      case 'update_stock':
        if (requireShopeeCatalogPostVps(request, reply)) return;
        result = await shopeeCatalogPostVps('/api/v2/product/update_stock', creds, request.body || {});
        break;
      case 'update_model':
        if (requireShopeeCatalogPostVps(request, reply)) return;
        result = await shopeeCatalogPostVps('/api/v2/product/update_model', creds, request.body || {});
        break;
      case 'init_tier_variation':
        if (requireShopeeCatalogPostVps(request, reply)) return;
        result = await shopeeCatalogPostVps('/api/v2/product/init_tier_variation', creds, request.body || {});
        break;
      case 'delete_item':
        if (requireShopeeCatalogPostVps(request, reply)) return;
        result = await shopeeCatalogPostVps('/api/v2/product/delete_item', creds, request.body || {});
        break;
      case 'update_item_status':
        if (requireShopeeCatalogPostVps(request, reply)) return;
        result = await shopeeCatalogPostVps('/api/v2/product/update_item_status', creds, request.body || {});
        break;
      case 'update_item': {
        if (requireShopeeCatalogPostVps(request, reply)) return;
        const merged = await mergeShopeeCatalogUpdateItemPayloadVps({ ...(request.body || {}) }, creds);
        if (merged.error) return reply.code(merged.error.status).send(merged.error.body);
        if (merged.earlyResult) return reply.code(merged.earlyResult.status).send(merged.earlyResult.data);
        result = await shopeeCatalogPostVps('/api/v2/product/update_item', creds, merged.payload);
        break;
      }
      case 'upload_image': {
        if (requireShopeeCatalogPostVps(request, reply)) return;
        const parsed = await resolveShopeeCatalogMediaInputVps(request.body?.image_data_url, request.body?.image_url, 'image/');
        if (!parsed) return reply.code(400).send({ error: 'invalid image_data_url' });
        const ext = parsed.mimeType.split('/')[1] || 'jpg';
        const fileName = String(request.body?.file_name || parsed.fileNameHint || `image_${Date.now()}.${ext}`);
        const formData = new FormData();
        formData.append('image', new Blob([new Uint8Array(parsed.buffer)], { type: parsed.mimeType }), fileName);
        result = await shopeeCatalogMultipartVps('/api/v2/media_space/upload_image', creds, formData);
        break;
      }
      case 'upload_video': {
        if (requireShopeeCatalogPostVps(request, reply)) return;
        const parsed = await resolveShopeeCatalogMediaInputVps(request.body?.video_data_url, request.body?.video_url, 'video/');
        if (!parsed) return reply.code(400).send({ error: 'invalid video input' });
        const ext = parsed.mimeType.split('/')[1] || 'mp4';
        const fileName = String(request.body?.file_name || parsed.fileNameHint || `video_${Date.now()}.${ext}`);
        const startedAt = Date.now();

        const init = await shopeeCatalogPostVps('/api/v2/media_space/init_video_upload', creds, {
          file_md5: md5ShopeeCatalogHexVps(parsed.buffer),
          file_size: parsed.buffer.length,
        });
        if (init.data?.error) return reply.code(200).send(init.data);
        const uploadId = getShopeeCatalogVideoUploadIdVps(init.data);
        if (!uploadId) {
          return reply.code(200).send({
            error: 'video_upload_id_not_found',
            message: 'Shopee nao retornou video_upload_id ao iniciar o upload de video',
            response: init.data?.response,
          });
        }

        const maxPartSize = 4 * 1024 * 1024;
        const partSeqList = [];
        for (let offset = 0, partSeq = 0; offset < parsed.buffer.length; offset += maxPartSize, partSeq += 1) {
          const partBuffer = parsed.buffer.subarray(offset, Math.min(offset + maxPartSize, parsed.buffer.length));
          partSeqList.push(partSeq);
          const formData = new FormData();
          formData.append('video_upload_id', uploadId);
          formData.append('part_seq', String(partSeq));
          formData.append('content_md5', md5ShopeeCatalogHexVps(partBuffer));
          formData.append('part_content', new Blob([new Uint8Array(partBuffer)], { type: 'application/octet-stream' }), `${fileName}.part${partSeq}`);
          const part = await shopeeCatalogMultipartVps('/api/v2/media_space/upload_video_part', creds, formData);
          if (part.data?.error) return reply.code(200).send(part.data);
        }

        const complete = await shopeeCatalogPostVps('/api/v2/media_space/complete_video_upload', creds, {
          video_upload_id: uploadId,
          part_seq_list: partSeqList,
          report_data: { upload_cost: Math.max(1, Date.now() - startedAt) },
        });
        if (complete.data?.error) return reply.code(200).send(complete.data);

        for (let attempt = 0; attempt < 12; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const poll = await shopeeCatalogGetVps('/api/v2/media_space/get_video_upload_result', creds, encodeShopeeCatalogParamsVps({ video_upload_id: uploadId }));
          const status = getShopeeCatalogVideoUploadStatusVps(poll.data);
          if (['success', 'succeeded', 'complete', 'completed'].includes(status) || poll.data?.response?.video_info) {
            return reply.code(200).send({
              error: '',
              message: '',
              response: {
                video_upload_id: uploadId,
                video_info: poll.data?.response?.video_info || null,
                status: poll.data?.response?.status || status,
              },
            });
          }
          if (poll.data?.error) {
            const msg = String(poll.data?.message || '').toLowerCase();
            const waitable = msg.includes('invalid or expired vid') || msg.includes('request vid is abnormal');
            if (!waitable) return reply.code(200).send(poll.data);
          }
        }

        return reply.code(408).send({
          error: 'video_upload_timeout',
          message: 'Upload do video ainda em processamento. Tente salvar novamente em alguns segundos.',
          response: { video_upload_id: uploadId },
        });
      }
      case 'get_full_catalog': {
        const pageSize = clampShopeeCatalogIntVps(query.page_size, 100, 1, 100);
        const maxPages = clampShopeeCatalogIntVps(query.max_pages, 200, 1, 200);
        const maxItems = clampShopeeCatalogIntVps(query.max_items, 0, 0, 20000);
        const itemStatus = String(query.item_status || 'NORMAL');
        const allItemIds = [];
        let offset = 0;
        let hasNextPage = true;
        let safety = 0;

        while (hasNextPage && safety < 200 && safety < maxPages && (maxItems === 0 || allItemIds.length < maxItems)) {
          const listResult = await shopeeCatalogGetVps('/api/v2/product/get_item_list', creds, encodeShopeeCatalogParamsVps({
            offset,
            page_size: pageSize,
            item_status: itemStatus,
          }));
          if (listResult.data?.error) return reply.code(200).send(listResult.data);
          const pageItems = Array.isArray(listResult.data?.response?.item) ? listResult.data.response.item : [];
          for (const item of pageItems) {
            if (item?.item_id != null && (maxItems === 0 || allItemIds.length < maxItems)) allItemIds.push(Number(item.item_id));
          }
          hasNextPage = listResult.data?.response?.has_next_page === true;
          offset = Number(listResult.data?.response?.next_offset ?? (offset + pageSize));
          if (pageItems.length === 0) break;
          safety += 1;
        }

        const uniqueIds = [...new Set(allItemIds)].filter((id) => Number.isFinite(id)).slice(0, maxItems || undefined);
        const itemList = [];
        const detailBatch = 50;
        for (let i = 0; i < uniqueIds.length; i += detailBatch) {
          const batchIds = uniqueIds.slice(i, i + detailBatch).join(',');
          const detailResult = await shopeeCatalogGetVps('/api/v2/product/get_item_base_info', creds, encodeShopeeCatalogParamsVps({
            item_id_list: batchIds,
            need_tax_info: true,
            need_complaint_policy: false,
          }));
          if (detailResult.data?.error) return reply.code(200).send(detailResult.data);
          itemList.push(...(detailResult.data?.response?.item_list || []));
        }

        return reply.code(200).send({
          error: '',
          message: 'success',
          response: { total_count: uniqueIds.length, item_list: itemList },
        });
      }
      case 'get_item_list':
        result = await shopeeCatalogGetVps('/api/v2/product/get_item_list', creds, encodeShopeeCatalogParamsVps({
          offset: clampShopeeCatalogIntVps(query.offset, 0, 0, 999999),
          page_size: clampShopeeCatalogIntVps(query.page_size, 20, 1, 100),
          item_status: query.item_status || 'NORMAL',
        }));
        break;
      case 'get_item_base_info':
        result = await shopeeCatalogGetVps('/api/v2/product/get_item_base_info', creds, encodeShopeeCatalogParamsVps({ item_id_list: query.item_id_list }));
        break;
      case 'get_model_list':
        result = await shopeeCatalogGetVps('/api/v2/product/get_model_list', creds, encodeShopeeCatalogParamsVps({ item_id: query.item_id }));
        break;
      case 'debug':
        result = await shopeeCatalogGetVps('/api/v2/product/get_item_list', creds, encodeShopeeCatalogParamsVps({ offset: 0, page_size: 5, item_status: 'NORMAL' }));
        break;
      default:
        return reply.code(404).send({ error: `Unknown action: ${action}` });
    }

    return reply.code(result.status).send(result.data);
  } catch (err) {
    return reply.code(500).send({
      error: err.message,
      debug: buildCopyableDebug('shopee-catalog', {
        action,
        step: 'catalog request',
        rawMessage: err.message,
      }),
    });
  }
}

function getShopeeActionsPayloadVps(request) {
  if (request.method === 'GET') return request.query || {};
  const body = request.body && typeof request.body === 'object' ? request.body : {};
  return body.payload && typeof body.payload === 'object' ? body.payload : body;
}

function getShopeeActionsActionVps(request) {
  if (request.method === 'GET') return String(request.query?.action || '').trim();
  return String(request.body?.action || '').trim();
}

function requireShopeeActionsPostVps(request, reply) {
  if (request.method === 'POST') return false;
  reply.code(405).send({ error: 'POST required' });
  return true;
}

function firstShopeeActionsNonEmptyVps(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return '';
}

async function loadShopeeActionsProductFromVps(productId) {
  const response = await fetch(`https://api.xiaomipetrolina.com.br/products/${encodeURIComponent(String(productId))}`, {
    signal: AbortSignal.timeout(10000),
  });
  const data = await readShopeeCatalogJsonResponseVps(response);
  if (!response.ok) {
    const err = new Error('Produto não encontrado na VPS');
    err.status = response.status || 404;
    err.body = data;
    throw err;
  }
  return data;
}

function getShopeeActionsProductItemIdVps(product) {
  const value = firstShopeeActionsNonEmptyVps(product?.shopee_item_id, product?.shopeeItemId, product?.shopee_item?.id);
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function stripShopeeActionsHtmlVps(value) {
  return String(value || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
}

async function resolveShopeeActionsImageInputVps(imageUrl) {
  const value = String(imageUrl || '');
  if (!value) return null;

  if (value.startsWith('data:image')) {
    const matches = value.match(/^data:(image\/[\w.+-]+);base64,(.*)$/);
    if (!matches) return null;
    const mimeType = matches[1];
    return {
      buffer: Buffer.from(matches[2], 'base64'),
      mimeType,
      filename: `img_${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`,
    };
  }

  const response = await fetch(value, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) return null;
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get('content-type') || 'image/jpeg',
    filename: value.split('/').pop() || 'image.jpg',
  };
}

async function shopeeCatalogMultipartVps(apiPath, creds, formData) {
  const response = await fetch(buildShopeeCatalogUrlVps(apiPath, creds), {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000),
  });
  const data = await readShopeeCatalogJsonResponseVps(response);
  return { status: response.status, ok: response.ok, data };
}

async function uploadShopeeActionsProductImagesVps(product, creds) {
  const imageIds = [];
  const images = Array.isArray(product?.images) ? product.images : [];

  for (const imageUrl of images.slice(0, 9)) {
    try {
      const image = await resolveShopeeActionsImageInputVps(imageUrl);
      if (!image?.buffer?.length) continue;
      const formData = new FormData();
      formData.append('image', new Blob([new Uint8Array(image.buffer)], { type: image.mimeType }), image.filename);
      const upload = await shopeeCatalogMultipartVps('/api/v2/media_space/upload_image', creds, formData);
      const imageId = upload.data?.response?.image_info?.image_id;
      if (imageId) imageIds.push(imageId);
    } catch (err) {
      console.error('[shopee-actions] image upload failed:', buildCopyableDebug('shopee-actions', {
        action: 'add_item',
        step: 'upload image',
        rawMessage: err.message,
      }));
    }
  }

  return imageIds;
}

async function assertShopeeActionsProductNotLinkedVps(productId, product) {
  const linkedItemId = getShopeeActionsProductItemIdVps(product);
  if (linkedItemId) {
    return { linked: true, itemId: linkedItemId };
  }

  const rows = await vpsDbSelect('shopee_products', `select=shopee_item_id&product_id=eq.${encodeURIComponent(String(productId))}&shopee_item_id=not.is.null&limit=1`);
  const fallbackItemId = Number(Array.isArray(rows) ? rows[0]?.shopee_item_id : 0);
  if (Number.isFinite(fallbackItemId) && fallbackItemId > 0) {
    return { linked: true, itemId: fallbackItemId };
  }

  return { linked: false, itemId: 0 };
}

async function persistShopeeActionsItemLinkVps(productId, product, shopeeItemId) {
  const response = await fetch(`https://api.xiaomipetrolina.com.br/products/${encodeURIComponent(String(productId))}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': process.env.VPS_SYNC_KEY || process.env.SYNC_SECRET || '',
    },
    body: JSON.stringify({ ...product, shopee_item_id: shopeeItemId }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await readShopeeCatalogJsonResponseVps(response);
  return { ok: response.ok, status: response.status, data };
}

async function handleShopeeActionsVps(request, reply) {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return reply.code(405).send({ error: 'Method not allowed' });
  }

  const action = getShopeeActionsActionVps(request);
  const payload = getShopeeActionsPayloadVps(request);
  if (!action) return reply.code(400).send({ error: 'action obrigatória' });

  try {
    if (action === 'get_escrow_list' && (!payload.time_from || !payload.time_to)) return reply.code(400).send({ error: 'time_from e time_to são obrigatórios' });
    if (action === 'get_order_detail' && !payload.order_sn_list) return reply.code(400).send({ error: 'order_sn_list não fornecido' });
    if (['get_tracking_info', 'get_escrow_detail', 'get_shipping_document'].includes(action) && !payload.order_sn) return reply.code(400).send({ error: 'order_sn não fornecido' });
    if (action === 'ship_order' && !payload.order_sn) return reply.code(400).send({ error: 'order_sn não fornecido' });
    if (action === 'add_item' && !payload.product_id) return reply.code(400).send({ error: 'product_id não fornecido' });
    if (['update_stock', 'update_price'].includes(action) && !payload.product_id) return reply.code(400).send({ error: 'product_id não fornecido' });
    if (action === 'update_stock' && payload.stock === undefined) return reply.code(400).send({ error: 'Faltam parametros' });
    if (action === 'update_price' && payload.price === undefined) return reply.code(400).send({ error: 'Faltam parametros' });

    const creds = await getShopeeCatalogCredentialsVps();
    let result;

    switch (action) {
      case 'refresh_token': {
        const refreshedCreds = await refreshShopeeCatalogTokenVps(creds);
        return reply.code(200).send({ success: true, access_token: refreshedCreds.accessToken });
      }

      case 'get_shop_info':
        result = await shopeeCatalogGetVps('/api/v2/shop/get_shop_info', creds);
        return reply.code(result.status).send(result.data);

      case 'get_order_list': {
        let timeTo = payload.time_to;
        let timeFrom = payload.time_from;
        if (!timeFrom) {
          timeTo = Math.floor(Date.now() / 1000);
          timeFrom = timeTo - (15 * 24 * 60 * 60);
        }
        result = await shopeeCatalogGetVps('/api/v2/order/get_order_list', creds, encodeShopeeCatalogParamsVps({
          time_range_field: payload.time_range_field || 'create_time',
          time_from: timeFrom,
          time_to: timeTo,
          page_size: payload.page_size || 50,
          cursor: payload.cursor,
          order_status: payload.order_status,
        }));
        return reply.code(result.status).send(result.data);
      }

      case 'get_escrow_list':
        result = await shopeeCatalogGetVps('/api/v2/payment/get_escrow_list', creds, encodeShopeeCatalogParamsVps({
          release_time_from: payload.time_from,
          release_time_to: payload.time_to,
          page_size: payload.page_size || 50,
          page_no: payload.page_no || 0,
        }));
        return reply.code(result.status).send(result.data);

      case 'get_order_detail': {
        const snParam = Array.isArray(payload.order_sn_list) ? payload.order_sn_list.join(',') : payload.order_sn_list;
        const optionalFields = 'buyer_user_id,buyer_username,estimated_shipping_fee,recipient_address,actual_shipping_fee,goods_to_declare,note,note_update_time,item_list,pay_time,dropshipper,dropshipper_phone,split_up,buyer_cancel_reason,cancel_by,cancel_reason,actual_shipping_fee_confirmed,buyer_cpf_id,fulfillment_flag,pickup_done_time,package_list,shipping_carrier,payment_method,total_amount,invoice_data,checkout_shipping_carrier,reverse_shipping_fee,order_chargeable_weight_gram,edt,prescription_images,prescription_check_status';
        result = await shopeeCatalogGetVps('/api/v2/order/get_order_detail', creds, encodeShopeeCatalogParamsVps({
          order_sn_list: snParam,
          response_optional_fields: optionalFields,
        }));
        return reply.code(result.status).send(result.data);
      }

      case 'get_tracking_info': {
        const orderSn = String(payload.order_sn || '').trim();
        const [trackingResult, numberResult] = await Promise.all([
          shopeeCatalogGetVps('/api/v2/logistics/get_tracking_info', creds, encodeShopeeCatalogParamsVps({ order_sn: orderSn })),
          shopeeCatalogGetVps('/api/v2/logistics/get_tracking_number', creds, encodeShopeeCatalogParamsVps({ order_sn: orderSn })),
        ]);
        const data = trackingResult.data || {};
        if (data.response && numberResult.data?.response) {
          data.response.tracking_number_explicit = numberResult.data.response.tracking_number || numberResult.data.response.first_mile_tracking_number || numberResult.data.response.logistics_tracking_no || '';
        }
        return reply.code(trackingResult.status).send(data);
      }

      case 'get_escrow_detail':
        result = await shopeeCatalogGetVps('/api/v2/payment/get_escrow_detail', creds, encodeShopeeCatalogParamsVps({ order_sn: payload.order_sn }));
        return reply.code(result.status).send(result.data);

      case 'get_shipping_document': {
        const orderSn = String(payload.order_sn || '').trim();
        const shippingDocumentType = payload.shipping_document_type || 'SHIPPING_LABEL';
        const orderList = [{ order_sn: orderSn, shipping_document_type: shippingDocumentType }];
        const infoResult = await shopeeCatalogPostVps('/api/v2/logistics/get_shipping_document_info', creds, { order_list: orderList });
        const docResponse = await fetch(buildShopeeCatalogUrlVps('/api/v2/logistics/download_shipping_document', creds), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_list: orderList }),
          signal: AbortSignal.timeout(20000),
        });
        const contentType = docResponse.headers.get('content-type') || '';
        if (contentType.includes('application/pdf')) {
          const pdfBuffer = Buffer.from(await docResponse.arrayBuffer());
          return reply
            .code(200)
            .header('Content-Type', 'application/pdf')
            .header('Content-Disposition', `attachment; filename="etiqueta-${orderSn}.pdf"`)
            .send(pdfBuffer);
        }
        const docData = await readShopeeCatalogJsonResponseVps(docResponse);
        return reply.code(docResponse.status).send({ info: infoResult.data, doc: docData });
      }

      case 'ship_order': {
        if (requireShopeeActionsPostVps(request, reply)) return;
        const orderSn = String(payload.order_sn || '').trim();
        const requestedPackageNumber = String(payload.package_number || '').trim();
        const orderDetail = await shopeeCatalogGetVps('/api/v2/order/get_order_detail', creds, encodeShopeeCatalogParamsVps({
          order_sn_list: orderSn,
          response_optional_fields: 'package_list,shipping_carrier,order_status,fulfillment_flag',
        }));
        const orderDetailData = orderDetail.data || {};

        if (orderDetailData?.error) {
          return reply.code(200).send({
            error: 'ship_order_precheck_failed',
            message: orderDetailData.message || orderDetailData.error,
            details: orderDetailData,
          });
        }

        const order = orderDetailData?.response?.order_list?.[0];
        if (!order) {
          return reply.code(200).send({
            error: 'ship_order_precheck_failed',
            message: 'Pedido não encontrado na Shopee antes de preparar envio.',
            details: orderDetailData,
          });
        }

        if (order.order_status !== 'READY_TO_SHIP') {
          return reply.code(200).send({
            error: 'ship_order_not_ready',
            message: `Pedido ${orderSn} está com status ${order.order_status || 'desconhecido'}; ship_order só será chamado para READY_TO_SHIP.`,
            details: { order_status: order.order_status },
          });
        }

        const packageList = Array.isArray(order.package_list) ? order.package_list : [];
        const selectedPackage = requestedPackageNumber
          ? packageList.find((pkg) => String(pkg?.package_number || '').trim() === requestedPackageNumber)
          : packageList[0];
        const resolvedPackageNumber = firstShopeeActionsNonEmptyVps(selectedPackage?.package_number, requestedPackageNumber);

        if (!resolvedPackageNumber) {
          return reply.code(200).send({
            error: 'ship_order_package_not_found',
            message: 'Não foi possível identificar o pacote do pedido para validar o preparo de envio.',
            details: { order_sn: orderSn, package_list: packageList },
          });
        }

        const packageDetail = await shopeeCatalogGetVps('/api/v2/order/get_package_detail', creds, encodeShopeeCatalogParamsVps({
          order_sn: orderSn,
          package_number: resolvedPackageNumber,
        }));
        const packageDetailData = packageDetail.data || {};
        const detailPackage = packageDetailData?.response?.package_detail || packageDetailData?.response?.package_list?.[0] || packageDetailData?.response || {};
        const fulfillmentStatus = firstShopeeActionsNonEmptyVps(
          detailPackage.fulfillment_status,
          detailPackage.logistics_status,
          selectedPackage?.fulfillment_status,
          selectedPackage?.logistics_status,
        );
        const isShipmentArrangedRaw = detailPackage.is_shipment_arranged ?? selectedPackage?.is_shipment_arranged;
        const isShipmentArranged = isShipmentArrangedRaw === true || String(isShipmentArrangedRaw).toLowerCase() === 'true';

        if (packageDetailData?.error || !fulfillmentStatus) {
          return reply.code(200).send({
            error: 'ship_order_precheck_failed',
            message: 'Não foi possível confirmar que o pacote está pronto para envio. A chamada ship_order foi bloqueada para preservar a taxa de sucesso da Shopee.',
            details: { package_detail: packageDetailData, package_number: resolvedPackageNumber },
          });
        }

        if (isShipmentArranged || fulfillmentStatus === 'LOGISTICS_REQUEST_CREATED') {
          return reply.code(200).send({
            success: true,
            already_arranged: true,
            message: 'O envio deste pacote já foi preparado anteriormente.',
            details: { package_number: resolvedPackageNumber, fulfillment_status: fulfillmentStatus, is_shipment_arranged: isShipmentArranged },
          });
        }

        if (fulfillmentStatus !== 'LOGISTICS_READY') {
          return reply.code(200).send({
            error: 'ship_order_package_not_ready',
            message: `Pacote ${resolvedPackageNumber} ainda não está pronto para ship_order. Status atual: ${fulfillmentStatus}.`,
            details: { package_number: resolvedPackageNumber, fulfillment_status: fulfillmentStatus, is_shipment_arranged: isShipmentArranged },
          });
        }

        result = await shopeeCatalogPostVps('/api/v2/logistics/ship_order', creds, {
          order_sn: orderSn,
          package_number: resolvedPackageNumber,
          dropoff: {},
        });
        return reply.code(result.status).send(result.data);
      }

      case 'add_item': {
        if (requireShopeeActionsPostVps(request, reply)) return;
        const product = await loadShopeeActionsProductFromVps(payload.product_id);
        const link = await assertShopeeActionsProductNotLinkedVps(payload.product_id, product);
        if (link.linked) {
          return reply.code(409).send({
            error: 'Produto já vinculado à Shopee',
            item_id: link.itemId,
          });
        }

        const imageIdList = await uploadShopeeActionsProductImagesVps(product, creds);
        const description = stripShopeeActionsHtmlVps(product.description) || product.name || '';
        const shopeePayload = {
          original_price: Number(product.price_retail || 0) / 100,
          description: description.substring(0, 3000),
          item_name: String(product.name || '').substring(0, 120),
          normal_stock: product.track_inventory ? Number(product.stock_quantity || 0) : 999,
          weight: Number(product.weight_kg) > 0.05 ? Number(product.weight_kg) : 0.5,
          item_status: 'NORMAL',
          category_id: Number(payload.category_id || product.shopee_category_id || 100013),
          image: { image_id_list: imageIdList.length > 0 ? imageIdList : undefined },
          brand: {
            brand_id: Number(payload.brand_id || product.shopee_brand_id || 0),
            original_brand_name: payload.brand_name || product.brand || 'NoBrand',
          },
          logistics: [
            {
              logistic_id: Number(payload.logistic_id || product.shopee_logistic_id || 30018),
              enabled: true,
            },
          ],
        };

        result = await shopeeCatalogPostVps('/api/v2/product/add_item', creds, shopeePayload);
        if (result.data?.error) return reply.code(400).send({ error: result.data.error, message: result.data.message, details: result.data });
        const shopeeItemId = result.data?.response?.item_id;
        if (shopeeItemId) await persistShopeeActionsItemLinkVps(payload.product_id, product, shopeeItemId);
        return reply.code(200).send({ item_id: shopeeItemId, data: result.data?.response });
      }

      case 'update_stock': {
        if (requireShopeeActionsPostVps(request, reply)) return;
        const product = await loadShopeeActionsProductFromVps(payload.product_id);
        const itemId = getShopeeActionsProductItemIdVps(product);
        if (!itemId) return reply.code(400).send({ error: 'Produto não vinculado a Shopee' });
        result = await shopeeCatalogPostVps('/api/v2/product/update_stock', creds, {
          item_id: itemId,
          stock_list: [{ model_id: 0, normal_stock: Number(payload.stock) }],
        });
        return reply.code(result.status).send(result.data);
      }

      case 'update_price': {
        if (requireShopeeActionsPostVps(request, reply)) return;
        const product = await loadShopeeActionsProductFromVps(payload.product_id);
        const itemId = getShopeeActionsProductItemIdVps(product);
        if (!itemId) return reply.code(400).send({ error: 'Produto não vinculado a Shopee' });
        result = await shopeeCatalogPostVps('/api/v2/product/update_price', creds, {
          item_id: itemId,
          price_list: [{ model_id: 0, original_price: Number(payload.price) / 100 }],
        });
        return reply.code(result.status).send(result.data);
      }

      default:
        return reply.code(400).send({ error: 'Ação desconhecida' });
    }
  } catch (err) {
    return reply.code(500).send({
      error: err.message,
      debug: buildCopyableDebug('shopee-actions', {
        action,
        step: 'actions request',
        rawMessage: err.message,
      }),
    });
  }
}

async function requestBlingToken(params, clientId, clientSecret) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: params.toString(),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text.slice(0, 500) };
  }
  return { response, data };
}

async function readBlingProxyResponse(response) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, statusText: response.statusText, text, json };
}

function summarizeBlingProxyBody(body) {
  const data = Array.isArray(body?.json?.data) ? body.json.data : [];
  return {
    ok: body?.ok,
    status: body?.status,
    statusText: body?.statusText,
    count: data.length,
    error: body?.json?.error || body?.json?.erro || null,
    message: body?.json?.message || body?.json?.mensagem || body?.json?.descricao || null,
    body: data.length > 0 ? undefined : (body?.json || body?.text || null),
  };
}

function normalizeBlingSearchTextVps(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getBlingSearchTokensVps(search) {
  const ignored = new Set(['a', 'as', 'o', 'os', 'de', 'da', 'das', 'do', 'dos', 'e', 'em', 'para', 'por', 'com']);
  return normalizeBlingSearchTextVps(search)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !ignored.has(token));
}

function matchesLooseBlingProductSearchVps(item, search) {
  const query = normalizeBlingSearchTextVps(search);
  if (!query) return true;
  const haystack = normalizeBlingSearchTextVps([
    item?.nome,
    item?.codigo,
    item?.gtin,
    item?.marca,
    item?.categoria?.descricao,
    item?.variacao?.nome,
  ].filter(Boolean).join(' '));
  if (!haystack) return false;
  if (haystack.includes(query)) return true;
  const tokens = getBlingSearchTokensVps(search);
  if (tokens.length === 0) return false;
  const matchedTokens = tokens.filter((token) => haystack.includes(token)).length;
  return matchedTokens >= Math.max(1, Math.ceil(tokens.length * 0.6));
}

async function fetchLooseBlingProductSearchVps(base, headers, search, debug) {
  const maxPages = Number(process.env.BLING_PRODUCT_SEARCH_FALLBACK_MAX_PAGES || 50);
  const seen = new Set();
  const matched = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = base.replace(/pagina=[^&]*/, `pagina=${page}`);
    const response = await fetch(url, { headers });
    const body = await readBlingProxyResponse(response);
    debug?.fallbackPages?.push({ page, ...summarizeBlingProxyBody(body) });

    if (!response.ok) {
      if (page === 1) {
        const error = new Error(`Bling fallback failed at page ${page}: ${response.status} ${response.statusText}`);
        error.blingDebug = debug;
        throw error;
      }
      break;
    }

    const items = Array.isArray(body.json?.data) ? body.json.data : [];
    for (const item of items) {
      if (!item?.id || seen.has(item.id)) continue;
      if (!matchesLooseBlingProductSearchVps(item, search)) continue;
      seen.add(item.id);
      matched.push(item);
    }

    if (items.length < 100 || matched.length >= 100) break;
  }

  return matched;
}

async function refreshBlingStoredAccessTokenVps(settings) {
  if (!settings?.bling_refresh_token || !settings?.bling_client_id || !settings?.bling_client_secret) {
    return settings?.bling_access_token || '';
  }

  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', settings.bling_refresh_token);
  const { response, data } = await requestBlingToken(params, settings.bling_client_id, settings.bling_client_secret);

  if (!response.ok || !data?.access_token) {
    return settings.bling_access_token || '';
  }

  await vpsDbPatch('company_settings', `id=eq.${encodeURIComponent(settings.id)}`, {
    bling_access_token: data.access_token,
    bling_refresh_token: data.refresh_token || settings.bling_refresh_token,
    bling_token_expires_at: new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString(),
  });

  return data.access_token;
}

async function getBlingProductDetailAuthHeaderVps(request) {
  if (request.headers.authorization) return request.headers.authorization;

  const settingsRows = await vpsDbSelect('company_settings', 'select=id,bling_access_token,bling_refresh_token,bling_token_expires_at,bling_client_id,bling_client_secret&limit=1');
  const settings = Array.isArray(settingsRows) ? settingsRows[0] : null;
  if (!settings?.bling_access_token) return '';

  const expiresAt = settings.bling_token_expires_at ? new Date(settings.bling_token_expires_at).getTime() : 0;
  const shouldRefresh = expiresAt && expiresAt <= Date.now();
  const accessToken = shouldRefresh ? await refreshBlingStoredAccessTokenVps(settings) : settings.bling_access_token;
  return accessToken ? `Bearer ${accessToken}` : '';
}

function readBlingStockQuantityVps(item) {
  const stockValue = item?.saldoFisicoTotal ?? item?.saldoFisico ?? item?.saldoVirtualTotal ?? item?.saldoVirtual ?? 0;
  return parseFloat(String(stockValue)) || 0;
}

function getVpsSyncKeyForBlingSyncPrices() {
  return process.env.VPS_SYNC_KEY || process.env.VITE_VPS_SYNC_KEY || process.env.SYNC_SECRET || '';
}

function isLocalVpsBatchHost(host = '') {
  const hostname = String(host).split(':')[0].toLowerCase();
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

function getVpsBatchBaseUrl(request) {
  if (process.env.VITE_VPS_BASE_URL) return process.env.VITE_VPS_BASE_URL.replace(/\/+$/, '');
  if (process.env.VPS_BASE_URL) return process.env.VPS_BASE_URL.replace(/\/+$/, '');
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const proto = request.headers['x-forwarded-proto'] || (isLocalVpsBatchHost(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function loadVpsProductsForBlingSyncPrices(from, to) {
  const select = 'select=id,name,sku,status,category_id,price_retail,price_reseller,price_wholesale,price_cost,stock_quantity,track_inventory,bling_id,bling_parent_id,parent_id';
  const limit = Math.max(0, Number(to) - Number(from) + 1);
  const products = await vpsDbSelect('products', `${select}&limit=${limit}&offset=${Number(from) || 0}`);
  const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM products');
  const total = Number(countRows?.[0]?.total || products.length);
  return { products, total: Number.isFinite(total) ? total : products.length };
}

function buildBlingSyncPricesVpsRows(products) {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    status: p.status === 'active' ? 'active' : p.status,
    category_id: p.category_id,
    price_retail: p.price_retail,
    price_reseller: p.price_reseller,
    price_wholesale: p.price_wholesale,
    price_cost: p.price_cost,
    stock_quantity: p.stock_quantity ?? 0,
    track_inventory: p.track_inventory ?? true,
    bling_id: p.bling_id ?? null,
    bling_parent_id: p.bling_parent_id ?? null,
    parent_id: p.parent_id ?? null,
  }));
}

function isBlingReconcileAuthorizedVps(request) {
  const authHeader = String(request.headers.authorization || '');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const key = String(request.headers['x-sync-key'] || request.headers['x-api-key'] || '');
  const syncKey = getVpsSyncKeyForBlingSyncPrices();
  if (syncKey && key === syncKey) return true;
  return false;
}

async function getValidBlingAccessTokenForReconcileVps() {
  const settingsRows = await vpsDbSelect('company_settings', 'select=id,bling_access_token,bling_refresh_token,bling_token_expires_at,bling_client_id,bling_client_secret&limit=1');
  const settings = Array.isArray(settingsRows) ? settingsRows[0] : null;
  if (!settings?.bling_access_token) throw new Error('Bling not connected');

  const expiresAt = settings.bling_token_expires_at ? new Date(settings.bling_token_expires_at).getTime() : 0;
  if (!expiresAt || expiresAt > Date.now()) return settings.bling_access_token;
  return refreshBlingStoredAccessTokenVps(settings);
}

async function fetchAllLocalProductsForReconcileVps() {
  const [rows] = await pool.query(
    'SELECT id, sku, name, stock_quantity, bling_id FROM products WHERE bling_id IS NOT NULL'
  );
  return Array.isArray(rows) ? rows : [];
}

async function fetchAllBlingProductsForReconcileVps(accessToken) {
  const remoteProducts = [];
  for (let page = 1; ; page += 1) {
    if (page > 1) await sleepBlingReconcileVps(450);
    let response;
    let body;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(`https://www.bling.com.br/Api/v3/produtos?pagina=${page}&limite=100&criterio=5`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      body = await readBlingProxyResponse(response);
      if (response.status === 429 && attempt < 2) {
        await sleepBlingReconcileVps(1200);
        continue;
      }
      break;
    }
    if (!response.ok) throw new Error(`Bling products fetch failed (${response.status}): ${body.text}`);
    const pageItems = Array.isArray(body.json?.data) ? body.json.data : [];
    remoteProducts.push(...pageItems);
    if (pageItems.length < 100) break;
  }
  return remoteProducts;
}

function sleepBlingReconcileVps(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllBlingStocksForReconcileVps(accessToken, productIds = []) {
  const remoteStocks = [];
  for (let page = 1; ; page += 1) {
    const response = await fetch(`https://www.bling.com.br/Api/v3/estoques/saldos?pagina=${page}&limite=100`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 400) break;
    const body = await readBlingProxyResponse(response);
    if (!response.ok) throw new Error(`Bling stock fetch failed (${response.status}): ${body.text}`);
    const pageItems = Array.isArray(body.json?.data) ? body.json.data : [];
    remoteStocks.push(...pageItems);
    if (pageItems.length < 100) break;
  }
  if (remoteStocks.length > 0) return remoteStocks;

  const mappedIds = [...new Set(productIds.map((id) => String(id || '').trim()).filter(Boolean))];
  for (let i = 0; i < mappedIds.length; i += 50) {
    if (i > 0) await sleepBlingReconcileVps(450);
    const chunk = mappedIds.slice(i, i + 50);
    const idsQuery = chunk.map((id) => `idsProdutos[]=${encodeURIComponent(id)}`).join('&');
    let response;
    let body;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(`https://www.bling.com.br/Api/v3/estoques/saldos?pagina=1&limite=100&${idsQuery}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      body = await readBlingProxyResponse(response);
      if (response.status === 429 && attempt < 2) {
        await sleepBlingReconcileVps(1200);
        continue;
      }
      break;
    }
    if (response.status === 400) continue;
    if (!response.ok) throw new Error(`Bling stock fetch failed (${response.status}): ${body.text}`);
    const pageItems = Array.isArray(body.json?.data) ? body.json.data : [];
    remoteStocks.push(...pageItems);
  }
  return remoteStocks;
}

function normalizeReconcileTextVps(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeReconcileIntegerVps(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function getRemoteStockProductIdVps(item) {
  return item?.produto?.id ?? item?.product?.id ?? item?.idProduto ?? item?.id ?? null;
}

function getRemoteStockEntryValueVps(item) {
  if (item?.saldoFisicoTotal !== undefined && item?.saldoFisicoTotal !== null) return { mode: 'total', value: normalizeReconcileIntegerVps(item.saldoFisicoTotal) };
  if (item?.saldoVirtualTotal !== undefined && item?.saldoVirtualTotal !== null) return { mode: 'total', value: normalizeReconcileIntegerVps(item.saldoVirtualTotal) };
  if (item?.saldoFisico !== undefined && item?.saldoFisico !== null) return { mode: 'partial', value: normalizeReconcileIntegerVps(item.saldoFisico) };
  if (item?.saldoVirtual !== undefined && item?.saldoVirtual !== null) return { mode: 'partial', value: normalizeReconcileIntegerVps(item.saldoVirtual) };
  return { mode: 'partial', value: 0 };
}

function buildBlingReconcilePlanVps({ localProducts = [], remoteProducts = [], remoteStocks = [] } = {}) {
  const localByBlingId = new Map();
  for (const localProduct of localProducts) {
    if (localProduct?.bling_id) localByBlingId.set(String(localProduct.bling_id), localProduct);
  }

  const remoteProductsById = new Map();
  for (const remoteProduct of remoteProducts) {
    if (remoteProduct?.id) remoteProductsById.set(String(remoteProduct.id), remoteProduct);
  }

  const remoteStocksById = new Map();
  for (const remoteStock of remoteStocks) {
    const productId = getRemoteStockProductIdVps(remoteStock);
    if (!productId) continue;
    const key = String(productId);
    const entry = getRemoteStockEntryValueVps(remoteStock);
    if (entry.mode === 'total') {
      remoteStocksById.set(key, entry.value);
    } else {
      remoteStocksById.set(key, (remoteStocksById.get(key) || 0) + entry.value);
    }
  }

  const stockChanges = [];
  for (const [blingId, localProduct] of localByBlingId.entries()) {
    const remoteProduct = remoteProductsById.get(blingId);
    const remoteStock = remoteStocksById.get(blingId);
    if (remoteStock !== undefined) {
      const previousStock = normalizeReconcileIntegerVps(localProduct.stock_quantity);
      if (previousStock !== remoteStock) {
        stockChanges.push({ productId: localProduct.id, sku: localProduct.sku || remoteProduct?.codigo || null, blingId: Number(blingId), previousStock, nextStock: remoteStock });
      }
    }
  }

  return {
    stockChanges,
    nameChanges: [],
    totals: { localProducts: localProducts.length, localMappedProducts: localByBlingId.size, remoteProducts: remoteProducts.length, remoteStocks: remoteStocks.length },
  };
}

function summarizeBlingReconcilePlanDetailsVps(plan, limit = 100) {
  return {
    stockChanges: plan.stockChanges.slice(0, limit).map((change) => ({
      productId: change.productId,
      sku: change.sku || null,
      blingId: change.blingId,
      previousStock: change.previousStock,
      nextStock: change.nextStock,
    })),
    nameChanges: plan.nameChanges.slice(0, limit).map((change) => ({
      productId: change.productId,
      sku: change.sku || null,
      blingId: change.blingId,
      previousName: change.previousName,
      nextName: change.nextName,
    })),
  };
}

async function patchVpsForReconcileVps(pathname, body, request) {
  const syncKey = getVpsSyncKeyForBlingSyncPrices();
  if (!syncKey) return false;
  try {
    const response = await fetch(`${getVpsBatchBaseUrl(request)}${pathname}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-sync-key': syncKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function applyReconcileStockChangesVps(changes, request) {
  const applied = [];
  const failed = [];
  for (const change of changes) {
    try {
      await vpsDbPatch('products', `id=eq.${encodeURIComponent(change.productId)}`, { stock_quantity: change.nextStock });
      const vpsUpdated = await patchVpsForReconcileVps('/products/stock', change.blingId ? { bling_id: change.blingId, stock_quantity: change.nextStock } : { sku: change.sku, stock_quantity: change.nextStock }, request);
      applied.push({ ...change, vpsUpdated });
    } catch (err) {
      failed.push({ type: 'stock', sku: change.sku, blingId: change.blingId, reason: err.message });
    }
  }
  return { applied, failed };
}

async function applyReconcileNameChangesVps(changes, request) {
  const applied = [];
  const failed = [];
  for (const change of changes) {
    try {
      await vpsDbPatch('products', `id=eq.${encodeURIComponent(change.productId)}`, { name: change.nextName });
      const vpsUpdated = change.sku ? await patchVpsForReconcileVps('/products/name', { sku: change.sku, name: change.nextName }, request) : false;
      applied.push({ ...change, vpsUpdated });
    } catch (err) {
      failed.push({ type: 'name', sku: change.sku, blingId: change.blingId, reason: err.message });
    }
  }
  return { applied, failed };
}

function extractBlingSerialSaleImeisVps(value) {
  const matches = String(value || '').match(/\b\d{15}\b/g) || [];
  return [...new Set(matches)];
}

function normalizeBlingSerialSaleSkuVps(value) {
  return String(value || '').trim().toUpperCase();
}

function getBlingOrderItemSkuVps(item) {
  return normalizeBlingSerialSaleSkuVps(
    item?.codigo ||
    item?.produto?.codigo ||
    item?.produtoLoja?.codigo ||
    ''
  );
}

function getBlingOrderItemQuantityVps(item) {
  const numeric = Number(item?.quantidade ?? item?.quantity ?? 1);
  if (!Number.isFinite(numeric) || numeric <= 0) return 1;
  return Math.max(1, Math.trunc(numeric));
}

function isBlingSerialSaleOrderCanceledVps(order) {
  const statusText = JSON.stringify(order?.situacao || '').toLowerCase();
  const statusId = Number(order?.situacao?.id ?? order?.situacao);
  return statusId === 12 || statusText.includes('cancel');
}

function buildBlingOrderSkuQuantityMapVps(items = []) {
  const map = new Map();
  for (const item of items) {
    const sku = getBlingOrderItemSkuVps(item);
    if (!sku) continue;
    map.set(sku, (map.get(sku) || 0) + getBlingOrderItemQuantityVps(item));
  }
  return map;
}

async function fetchBlingSalesOrderDetailForSerialSyncVps(accessToken, id) {
  let lastBody = null;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await sleepBlingReconcileVps(1500 * attempt);
    const response = await fetch(`https://www.bling.com.br/Api/v3/pedidos/vendas/${encodeURIComponent(String(id))}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const body = await readBlingProxyResponse(response);
    if (response.ok) return body.json?.data || body.json || null;
    lastBody = body;
    lastStatus = response.status;
    if (response.status === 429) continue;
    break;
  }
  throw new Error(`Bling sale detail fetch failed (${lastStatus}): ${lastBody?.text || ''}`);
}

async function fetchRecentBlingSalesOrdersForSerialSyncVps(accessToken, maxOrders = 25) {
  const orders = [];
  const limit = Math.min(100, Math.max(1, Number(maxOrders) || 25));
  for (let page = 1; orders.length < limit; page += 1) {
    if (page > 1) await sleepBlingReconcileVps(350);
    const response = await fetch(`https://www.bling.com.br/Api/v3/pedidos/vendas?pagina=${page}&limite=100`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const body = await readBlingProxyResponse(response);
    if (!response.ok) throw new Error(`Bling sales fetch failed (${response.status}): ${body.text}`);
    const pageItems = Array.isArray(body.json?.data) ? body.json.data : [];
    orders.push(...pageItems);
    if (pageItems.length < 100) break;
  }
  return orders.slice(0, limit);
}

let unitsSerialSaleColumnsCacheVps = null;

async function getUnitsSerialSaleColumnsVps() {
  if (unitsSerialSaleColumnsCacheVps) return unitsSerialSaleColumnsCacheVps;
  const [cols] = await pool.query('SHOW COLUMNS FROM units');
  const names = new Set((Array.isArray(cols) ? cols : []).map((col) => String(col.Field || '')));
  unitsSerialSaleColumnsCacheVps = {
    imei: names.has('imei_1') ? 'imei_1' : 'imei',
    notes: names.has('internal_notes') ? 'internal_notes' : names.has('notes') ? 'notes' : null,
    soldAt: names.has('sold_at') ? 'sold_at' : null,
  };
  return unitsSerialSaleColumnsCacheVps;
}

async function fetchUnitsByImei1ForSerialSaleSyncVps(imeis = []) {
  const uniqueImeis = [...new Set(imeis.map((imei) => String(imei || '').trim()).filter(Boolean))];
  if (uniqueImeis.length === 0) return new Map();
  const columns = await getUnitsSerialSaleColumnsVps();
  const placeholders = uniqueImeis.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT u.id, u.product_id, u.${columns.imei} AS imei_1, u.status, p.sku AS product_sku
       FROM units u
       LEFT JOIN products p ON p.id = u.product_id
      WHERE u.${columns.imei} IN (${placeholders})`,
    uniqueImeis
  );
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.imei_1) map.set(String(row.imei_1), row);
  }
  return map;
}

async function markUnitSoldFromBlingSerialSaleVps(unit, order, dryRun) {
  const orderNumber = order?.numero || order?.id || '';
  if (dryRun) return { updated: false, productStock: null };

  const note = `Baixa automatica Bling pedido ${orderNumber}`;
  const columns = await getUnitsSerialSaleColumnsVps();
  const sets = [`status = 'sold'`];
  const values = [];
  if (columns.soldAt) sets.push(`${columns.soldAt} = COALESCE(${columns.soldAt}, CURRENT_TIMESTAMP)`);
  if (columns.notes) {
    sets.push(`${columns.notes} = TRIM(CONCAT_WS('\n', NULLIF(${columns.notes}, ''), ?))`);
    values.push(note);
  }
  values.push(unit.id);
  const [result] = await pool.query(
    `UPDATE units
        SET ${sets.join(', ')}
      WHERE id = ? AND status = 'available'`,
    values
  );
  if (!result.affectedRows) return { updated: false, productStock: null };

  const productStock = await syncProductStock(unit.product_id);
  if (productStock !== null && productStock !== undefined) {
    await vpsDbPatch('products', `id=eq.${encodeURIComponent(unit.product_id)}`, { stock_quantity: productStock });
  }
  return { updated: true, productStock };
}

async function processBlingSerialSaleOrderVps(order, accessToken, dryRun) {
  const detail = await fetchBlingSalesOrderDetailForSerialSyncVps(accessToken, order.id);
  const items = Array.isArray(detail?.itens) ? detail.itens : [];
  const orderNumber = detail?.numero || order?.numero || order?.id || '';
  const imeis = extractBlingSerialSaleImeisVps(`${detail?.observacoes || ''} ${detail?.observacoesInternas || ''}`);
  if (imeis.length === 0) return { orderNumber, skipped: true, reason: 'no_imei_in_observations', imeis: 0 };
  if (isBlingSerialSaleOrderCanceledVps(detail || order)) return { orderNumber, skipped: true, reason: 'order_canceled', imeis: imeis.length };

  const skuQuantities = buildBlingOrderSkuQuantityMapVps(items);
  if (skuQuantities.size === 0) return { orderNumber, skipped: true, reason: 'no_item_sku', imeis: imeis.length };

  const unitsByImei = await fetchUnitsByImei1ForSerialSaleSyncVps(imeis);
  const matchedBySku = new Map();
  const sold = [];
  const pending = [];

  for (const imei of imeis) {
    const unit = unitsByImei.get(imei);
    if (!unit) {
      pending.push({ imei, reason: 'unit_not_found' });
      continue;
    }

    const sku = normalizeBlingSerialSaleSkuVps(unit.product_sku);
    const soldQty = skuQuantities.get(sku) || 0;
    if (!soldQty) {
      pending.push({ imei, sku, reason: 'unit_sku_not_in_order' });
      continue;
    }

    const currentMatched = matchedBySku.get(sku) || 0;
    if (currentMatched >= soldQty) {
      pending.push({ imei, sku, reason: 'sku_quantity_exceeded' });
      continue;
    }

    if (unit.status !== 'available') {
      pending.push({ imei, sku, reason: `unit_status_${unit.status || 'unknown'}` });
      continue;
    }

    const result = await markUnitSoldFromBlingSerialSaleVps(unit, detail || order, dryRun);
    if (result.updated || dryRun) {
      matchedBySku.set(sku, currentMatched + 1);
      sold.push({ imei, sku, unitId: unit.id, dryRun, productStock: result.productStock });
    } else {
      pending.push({ imei, sku, reason: 'update_not_applied' });
    }
  }

  return { orderNumber, skipped: false, imeis: imeis.length, sold, pending };
}

async function syncBlingSerialSalesFromRecentOrdersVps({ accessToken, dryRun = true, maxOrders = 25 } = {}) {
  const orders = await fetchRecentBlingSalesOrdersForSerialSyncVps(accessToken, maxOrders);
  const processed = [];
  for (const order of orders) {
    if (!order?.id) continue;
    if (processed.length > 0) await sleepBlingReconcileVps(450);
    const result = await processBlingSerialSaleOrderVps(order, accessToken, dryRun);
    if (!result.skipped || result.reason === 'order_canceled') processed.push(result);
  }
  return {
    ok: true,
    dryRun,
    checkedOrders: orders.length,
    ordersWithImeis: processed.length,
    soldUnits: processed.reduce((sum, order) => sum + (order.sold?.length || 0), 0),
    pendingUnits: processed.reduce((sum, order) => sum + (order.pending?.length || 0), 0),
    details: processed,
  };
}

function resolveBlingWebhookSourceVps(request) {
  return String(request.query?.resource || '') === 'webhook' ? 'bling-legacy' : 'bling-webhook';
}

async function safeInsertBlingWebhookLogVps(source, payload, rawBody) {
  try {
    const storedPayload = payload && typeof payload === 'object'
      ? { ...payload, _route: source }
      : { rawBody, _route: source };
    await vpsDbInsert('webhook_logs', {
      id: crypto.randomUUID(),
      source: source,
      payload: storedPayload,
      received_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[bling-webhook] Failed to persist webhook_logs:', err?.message || err);
  }
}

function readBlingPayloadStockForWebhookDetailsVps(productData, body) {
  const estoque = productData?.estoque || body?.data?.estoque || body?.dados?.estoque;
  const candidates = [
    { value: productData?.stock_quantity, explicitTotal: true },
    { value: productData?.saldoFisicoTotal, explicitTotal: true },
    { value: productData?.saldoFisico, explicitTotal: false },
    { value: productData?.saldoVirtualTotal, explicitTotal: true },
    { value: productData?.saldoVirtual, explicitTotal: false },
    { value: estoque?.saldoFisicoTotal, explicitTotal: true },
    { value: estoque?.saldoFisico, explicitTotal: false },
    { value: estoque?.saldoVirtualTotal, explicitTotal: true },
    { value: estoque?.saldoVirtual, explicitTotal: false },
    { value: body?.data?.saldoFisicoTotal, explicitTotal: true },
    { value: body?.dados?.saldoFisicoTotal, explicitTotal: true },
    { value: body?.data?.saldoVirtualTotal, explicitTotal: true },
    { value: body?.dados?.saldoVirtualTotal, explicitTotal: true },
  ];
  const found = candidates.find((candidate) => candidate.value !== undefined && candidate.value !== null && candidate.value !== '');
  return found ? { value: found.value, hasExplicitTotal: found.explicitTotal } : { value: undefined, hasExplicitTotal: false };
}

function readBlingPayloadStockForWebhookVps(productData, body) {
  return readBlingPayloadStockForWebhookDetailsVps(productData, body).value;
}

async function fetchBlingStockForWebhookVps(blingId, accessToken) {
  try {
    const response = await fetch(`https://www.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${encodeURIComponent(String(blingId))}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    const body = await readBlingProxyResponse(response);
    if (!response.ok) return null;
    const items = Array.isArray(body.json?.data) ? body.json.data : [];
    if (items.length > 0 && items[0].saldoFisicoTotal !== undefined) return Number(items[0].saldoFisicoTotal);
    return items.reduce((total, item) => total + (Number(item?.saldoFisico) || 0), 0);
  } catch {
    return null;
  }
}

async function fetchBlingProductDetailForWebhookVps(blingId, accessToken) {
  try {
    const response = await fetch(`https://www.bling.com.br/Api/v3/produtos/${encodeURIComponent(String(blingId))}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    const body = await readBlingProxyResponse(response);
    if (!response.ok) return null;
    return body.json?.data || null;
  } catch {
    return null;
  }
}

function readBlingCostPriceForWebhookVps(productData, detail) {
  const cost = productData?.precoCusto
    ?? productData?.precoCompra
    ?? productData?.preco_custo
    ?? productData?.preco_compra
    ?? productData?.fornecedor?.precoCusto
    ?? productData?.fornecedor?.precoCompra
    ?? detail?.precoCusto
    ?? detail?.precoCompra
    ?? detail?.preco_custo
    ?? detail?.preco_compra
    ?? detail?.fornecedor?.precoCusto
    ?? detail?.fornecedor?.precoCompra;
  const numericCost = Number(cost);
  return Number.isFinite(numericCost) && numericCost > 0 ? numericCost : null;
}

function pickBlingPriceStockUpdatesVps(updates = {}) {
  const fields = ['price_retail', 'price_wholesale', 'price_cost', 'price_reseller', 'price_promo', 'promo_start', 'promo_end', 'stock_quantity', 'status', 'category_id', 'track_inventory'];
  const picked = {};
  for (const field of fields) {
    if (updates[field] !== undefined) picked[field] = updates[field];
  }
  return picked;
}

function buildBlingPriceTargetSkusVps(primarySku, childProducts = []) {
  const skus = [];
  if (typeof primarySku === 'string' && primarySku.trim()) skus.push(primarySku.trim());
  for (const product of childProducts || []) {
    const sku = typeof product?.sku === 'string' ? product.sku.trim() : '';
    if (sku) skus.push(sku);
  }
  return Array.from(new Set(skus));
}

function buildBlingPriceStockPayloadVps(targetSkus = [], updates = {}) {
  const commercialUpdates = pickBlingPriceStockUpdatesVps(updates);
  return {
    products: buildBlingPriceTargetSkusVps('', targetSkus.map((sku) => ({ sku }))).map((sku) => ({
      sku,
      ...commercialUpdates,
    })),
  };
}

async function patchVpsJsonForWebhookVps(request, pathname, body) {
  const syncKey = getVpsSyncKeyForBlingSyncPrices();
  if (!syncKey) return { ok: false, skipped: 'missing_sync_key' };
  try {
    const response = await fetch(`${getVpsBatchBaseUrl(request)}${pathname}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-sync-key': syncKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return response.ok ? (json || { ok: true }) : { ok: false, status: response.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function syncShopeeStockFromBlingTargetsVps(_stockTargets) {
  return { ok: true, skipped: 'vps_webhook_local_shopee_sync_pending', updated: 0, errors: [] };
}

function normalizeBlingAdminSlugVps(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function patchVpsJsonForBlingAdminVps(request, method, pathname, body) {
  const syncKey = getVpsSyncKeyForBlingSyncPrices();
  if (!syncKey) return { ok: false, skipped: 'missing_sync_key' };
  try {
    const response = await fetch(`${getVpsBatchBaseUrl(request)}${pathname}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Sync-Key': syncKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return response.ok ? (json || { ok: true }) : { ok: false, status: response.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleBlingWebhookVps(request, reply) {
  if (request.method === 'GET') {
    return reply.code(200).send({ ok: true, mode: 'vps-fastify', accepts: 'POST' });
  }
  if (request.method !== 'POST') return reply.code(405).send({ error: 'Method not allowed' });

  if (isMercadoPagoWebhookPayload(request.body)) {
    try {
      const result = await handleMercadoPagoWebhookVps(request.body);
      return reply.code(result.status).send(result.body);
    } catch (err) {
      return reply.code(200).send({ ok: false, error: err.message });
    }
  }

  const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});
  let webhookEventForDebug = '';
  try {
    const body = request.body || {};
    const event = String(body?.event || body?.evento || '').toLowerCase();
    webhookEventForDebug = event;
    const source = resolveBlingWebhookSourceVps(request);
    await safeInsertBlingWebhookLogVps(source, body, rawBody);

    if (!event) return reply.code(200).send({ ok: true, message: 'No event type - ignored' });

    const settingsRows = await vpsDbSelect('company_settings', 'select=id,bling_access_token,bling_refresh_token,bling_token_expires_at,bling_client_id,bling_client_secret&limit=1');
    const settings = Array.isArray(settingsRows) ? settingsRows[0] : null;
    let accessToken = settings?.bling_access_token || null;
    if (settings?.bling_token_expires_at && new Date(settings.bling_token_expires_at).getTime() < Date.now()) {
      accessToken = await refreshBlingStoredAccessTokenVps(settings);
    }

    const isStockEvent = event.includes('stock') || event.includes('estoque') || event.includes('movimentacao');
    if (isStockEvent) {
      const productData = body?.data?.produto || body?.dados?.produto || body?.data || {};
      const blingId = productData?.id;
      const sku = productData?.codigo;
      if (!blingId && !sku) return reply.code(200).send({ ok: true, message: 'No product identifier in stock event' });

      let stockQty = null;
      let stockSource = 'api';
      if (accessToken && blingId) {
        stockQty = await fetchBlingStockForWebhookVps(blingId, accessToken);
      }
      if (stockQty === null) {
        const payloadStock = readBlingPayloadStockForWebhookDetailsVps(productData, body);
        const payloadQty = payloadStock.value !== undefined ? Number(payloadStock.value) : null;
        if (accessToken && (payloadQty === null || (payloadQty === 0 && !payloadStock.hasExplicitTotal))) {
          return reply.code(200).send({
            ok: false,
            message: 'API failed and payload returned 0 - update aborted to avoid an incorrect zero stock',
            reason: 'refusing to zero stock incorrectly',
            blingId,
            sku,
          });
        }
        if (payloadQty === null || !Number.isFinite(payloadQty)) {
          return reply.code(200).send({ ok: false, message: 'No Bling token and no stock in payload' });
        }
        stockQty = payloadQty;
        stockSource = accessToken ? 'payload_api_fallback' : 'payload_no_token';
      }

      let resolvedSku = sku;
      if (!resolvedSku && blingId) {
        const rows = await vpsDbSelect('products', `select=sku&bling_id=eq.${encodeURIComponent(String(blingId))}&limit=1`);
        resolvedSku = Array.isArray(rows) ? rows[0]?.sku : null;
      }

      const vpsPayload = blingId ? { bling_id: blingId, stock_quantity: stockQty } : { sku: resolvedSku, stock_quantity: stockQty };
      const vpsStockResult = await patchVpsJsonForWebhookVps(request, '/products/stock', vpsPayload);
      if (blingId) {
        await vpsDbPatch('products', `bling_id=eq.${encodeURIComponent(String(blingId))}`, { stock_quantity: stockQty });
      } else if (resolvedSku) {
        await vpsDbPatch('products', `sku=eq.${encodeURIComponent(String(resolvedSku))}`, { stock_quantity: stockQty });
      }
      const shopeeStockSync = await syncShopeeStockFromBlingTargetsVps(vpsStockResult?.stockTargets || []);
      return reply.code(200).send({ ok: true, event, sku: resolvedSku, bling_id: blingId, stock_quantity: stockQty, stockSource, vpsUpdated: Boolean(vpsStockResult?.ok), shopeeStockSync });
    }

    const isProductEvent = event.includes('product') || event.includes('produto');
    if (isProductEvent) {
      const productData = body?.data?.produto || body?.dados?.produto || body?.data || {};
      const blingId = productData?.id;
      let resolvedName = productData?.nome || productData?.name;
      let resolvedSku = productData?.codigo;
      const preco = productData?.preco;
      if (!blingId && !resolvedSku) return reply.code(200).send({ ok: true, message: 'No product identifier in product event' });

      let detail = null;
      if (accessToken && blingId && (!resolvedName || !resolvedSku || readBlingCostPriceForWebhookVps(productData, null) === null)) {
        detail = await fetchBlingProductDetailForWebhookVps(blingId, accessToken);
        resolvedName = resolvedName || detail?.nome;
        resolvedSku = resolvedSku || detail?.codigo;
      }
      if (!resolvedSku && blingId) {
        const rows = await vpsDbSelect('products', `select=sku,name&bling_id=eq.${encodeURIComponent(String(blingId))}&limit=1`);
        const product = Array.isArray(rows) ? rows[0] : null;
        resolvedSku = product?.sku;
        resolvedName = resolvedName || product?.name;
      }
      if (!resolvedSku) return reply.code(200).send({ ok: false, message: `SKU not found for bling_id: ${blingId}` });

      const updates = {};
      if (resolvedName) updates.name = resolvedName;
      if (preco !== undefined && preco !== null && Number.isFinite(Number(preco))) {
        updates.price_retail = Math.round(Number(preco) * 100);
      }
      const blingCostPrice = readBlingCostPriceForWebhookVps(productData, detail);
      if (blingCostPrice !== null) {
        updates.price_cost = Math.round(Number(blingCostPrice) * 100);
      }
      const payloadStock = readBlingPayloadStockForWebhookVps(productData, body);
      if (payloadStock !== undefined && payloadStock !== null && Number.isFinite(Number(payloadStock))) {
        updates.stock_quantity = Math.max(0, Math.trunc(Number(payloadStock)));
      }
      if (Object.keys(updates).length === 0) return reply.code(200).send({ ok: true, message: 'Nothing to update' });

      let childPriceTargets = [];
      if (blingId && updates.price_retail !== undefined) {
        const children = await vpsDbSelect('products', `select=sku&bling_parent_id=eq.${encodeURIComponent(String(blingId))}`);
        childPriceTargets = Array.isArray(children) ? children : [];
      }
      const priceTargetSkus = updates.price_retail !== undefined ? buildBlingPriceTargetSkusVps(resolvedSku, childPriceTargets) : [resolvedSku];
      const vpsNameResult = updates.name ? await patchVpsJsonForWebhookVps(request, '/products/name', { sku: resolvedSku, name: updates.name }) : { ok: true };
      const vpsPriceStockResult = Object.keys(pickBlingPriceStockUpdatesVps(updates)).length > 0
        ? await patchVpsJsonForWebhookVps(
          request,
          '/products/prices-stock',
          updates.price_retail !== undefined
            ? buildBlingPriceStockPayloadVps(priceTargetSkus, {
              price_retail: updates.price_retail,
              ...(updates.price_cost !== undefined ? { price_cost: updates.price_cost } : {}),
              ...(priceTargetSkus.length === 1 && updates.stock_quantity !== undefined ? { stock_quantity: updates.stock_quantity } : {}),
            })
            : { products: [{ sku: resolvedSku, ...pickBlingPriceStockUpdatesVps(updates) }] }
        )
        : { ok: true, stockTargets: [] };
      if (blingId) await vpsDbPatch('products', `bling_id=eq.${encodeURIComponent(String(blingId))}`, updates);
      if (updates.price_retail !== undefined && childPriceTargets.length > 0) {
        await vpsDbPatch('products', `bling_parent_id=eq.${encodeURIComponent(String(blingId))}`, { price_retail: updates.price_retail });
      }
      const shopeeStockSync = updates.stock_quantity !== undefined
        ? await syncShopeeStockFromBlingTargetsVps(vpsPriceStockResult?.stockTargets || [])
        : { ok: true, skipped: 'stock_unchanged', updated: 0, errors: [] };
      return reply.code(200).send({ ok: true, event, sku: resolvedSku, priceTargetSkus, updates, vpsUpdated: Boolean(vpsNameResult?.ok && vpsPriceStockResult?.ok), shopeeStockSync });
    }

    return reply.code(200).send({ ok: true, message: `Event '${event}' not handled` });
  } catch (err) {
    return reply.code(200).send({
      ok: false,
      error: err.message,
      debug: buildCopyableDebug('bling-webhook', {
        step: 'handle webhook',
        event: webhookEventForDebug,
        rawMessage: err.message,
      }),
    });
  }
}

async function handleBlingOAuthCallbackVps(request, reply) {
  const query = request.query || {};

  if (query.error) {
    return blingRedirect(reply, `/admin/settings/bling?error=${encodeURIComponent(String(query.error))}`);
  }

  if (!query.code) {
    return blingRedirect(reply, '/admin/settings/bling?error=missing_code');
  }

  try {
    const settingsRows = await vpsDbSelect('company_settings', 'select=id,bling_client_id,bling_client_secret,bling_callback_url&limit=1');
    const settings = Array.isArray(settingsRows) ? settingsRows[0] : null;

    if (!settings?.bling_client_id || !settings?.bling_client_secret) {
      return blingRedirect(reply, '/admin/settings/bling?error=missing_credentials');
    }

    const tokenParams = new URLSearchParams();
    tokenParams.set('grant_type', 'authorization_code');
    tokenParams.set('code', String(query.code));
    tokenParams.set('redirect_uri', buildBlingCallbackUrl(request, settings.bling_callback_url));

    const { response, data } = await requestBlingToken(tokenParams, settings.bling_client_id, settings.bling_client_secret);
    if (!response.ok) {
      const detail = sanitizeBlingOAuthErrorMessage(data);
      console.warn('[bling-oauth-callback] token exchange failed', {
        status: response.status,
        detail,
        redirectHost: (() => {
          try { return new URL(buildBlingCallbackUrl(request, settings.bling_callback_url)).host; } catch { return null; }
        })(),
      });
      return blingRedirect(reply, `/admin/settings/bling?error=token_exchange_failed&status=${response.status}&detail=${encodeURIComponent(detail)}`);
    }

    const expiresAt = new Date(Date.now() + Number(data?.expires_in || 3600) * 1000).toISOString();
    await vpsDbPatch('company_settings', `id=eq.${encodeURIComponent(settings.id)}`, {
      bling_access_token: data?.access_token || null,
      bling_refresh_token: data?.refresh_token || null,
      bling_token_expires_at: expiresAt,
    });

    return blingRedirect(reply, '/admin/settings/bling?connected=true');
  } catch (err) {
    return blingRedirect(reply, `/admin/settings/bling?error=network_error&detail=${encodeURIComponent(err.message || 'unknown')}`);
  }
}

async function handleBlingApiVps(request, reply) {
  const query = request.query || {};
  const resource = String(query.resource || '');

  if (resource === 'oauth-callback' || query?.code) {
    return handleBlingOAuthCallbackVps(request, reply);
  }

  if (resource === 'webhook') {
    return handleBlingWebhookVps(request, reply);
  }

  if (resource === 'webhook-logs') {
    if (request.method !== 'GET') return reply.code(405).send({ error: 'Method not allowed' });
    try {
      const logs = await vpsDbSelect('webhook_logs', 'select=id, source, payload, received_at&order=received_at.desc&limit=20');
      return reply.code(200).send({ ok: true, tableExists: true, logs: Array.isArray(logs) ? logs : [] });
    } catch (err) {
      return reply.code(200).send({ ok: false, tableExists: false, error: err.message, logs: [] });
    }
  }

  if (resource === 'webhook-test') {
    if (request.method !== 'POST') return reply.code(405).send({ error: 'Method not allowed' });
    const body = request.body || {};
    const type = String(body.type || query.type || '').toLowerCase();
    const config = {
      names: {
        event: 'diagnostic.product.name',
        label: 'Nomes',
        data: { produto: { id: 0, nome: 'Teste de webhook - nome' } },
      },
      prices: {
        event: 'diagnostic.product.price',
        label: 'Precos',
        data: { produto: { id: 0, preco: 199.9 }, preco: 199.9 },
      },
      stock: {
        event: 'diagnostic.stock',
        label: 'Estoque',
        data: { produto: { id: 0 }, saldoFisicoTotal: 10, saldoVirtualTotal: 10 },
      },
    }[type];

    if (!config) return reply.code(400).send({ error: 'Invalid webhook test type. Use names, prices or stock.' });

    const callbackUrl = buildBlingCallbackUrl(request);
    const publicBaseUrl = callbackUrl.replace(/\/api\/auth\/callback\/bling$/, '');
    const payload = {
      eventId: crypto.randomUUID(),
      event: config.event,
      diagnostic: true,
      webhookKind: type,
      label: config.label,
      status: 'online',
      source: 'admin-bling-integration',
      captured_at: new Date().toISOString(),
      urls: {
        webhook: `${publicBaseUrl}/api/bling-webhook`,
        callback: callbackUrl,
        legacyWebhook: `${publicBaseUrl}/api/bling?resource=webhook`,
      },
      data: config.data,
    };

    await safeInsertBlingWebhookLogVps('bling-diagnostic', payload, null);
    return reply.code(200).send({ ok: true, type, event: config.event, logged: true, payload });
  }

  if (resource === 'exchange') {
    if (request.method !== 'POST') {
      return reply.code(405).send({ error: 'Method not allowed' });
    }

    const body = request.body || {};
    const { code, client_id, client_secret, redirect_uri, grant_type } = body;
    if (!client_id || !client_secret) return reply.code(400).send({ error: 'Missing client_id or client_secret' });

    const isRefresh = grant_type === 'refresh_token';
    if (isRefresh && !code) return reply.code(400).send({ error: 'Missing refresh_token' });
    if (!isRefresh && (!code || !redirect_uri)) return reply.code(400).send({ error: 'Missing required fields: code, redirect_uri' });

    try {
      const tokenParams = new URLSearchParams();
      if (isRefresh) {
        tokenParams.set('grant_type', 'refresh_token');
        tokenParams.set('refresh_token', String(code));
      } else {
        tokenParams.set('grant_type', 'authorization_code');
        tokenParams.set('code', String(code));
        tokenParams.set('redirect_uri', String(redirect_uri));
      }

      const { response, data } = await requestBlingToken(tokenParams, client_id, client_secret);
      if (!response.ok) {
        return reply.code(response.status).send({
          error: 'token_exchange_failed',
          debug: buildCopyableDebug('bling-oauth', {
            step: 'exchange token',
            grantType: isRefresh ? 'refresh_token' : 'authorization_code',
            upstreamStatus: response.status,
            rawMessage: data?.error?.description || data?.message || 'Bling token exchange failed',
          }),
        });
      }
      return reply.code(200).send({
        access_token: data?.access_token,
        refresh_token: data?.refresh_token || null,
        expires_in: data?.expires_in || 3600,
      });
    } catch (err) {
      return reply.code(500).send({
        error: 'network_error',
        debug: buildCopyableDebug('bling-oauth', {
          step: 'exchange token',
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'product-detail') {
    if (request.method !== 'GET') return reply.code(405).send({ error: 'Method not allowed' });
    if (!query.id) return reply.code(400).send({ error: 'Product ID required' });

    const id = encodeURIComponent(String(query.id));
    const authHeader = await getBlingProductDetailAuthHeaderVps(request);
    if (!authHeader) return reply.code(401).send({ error: 'Bling not connected' });

    try {
      if (query.variacoes === '1') {
        const response = await fetch(`https://www.bling.com.br/Api/v3/produtos/variacoes/${id}`, {
          headers: { Authorization: authHeader, Accept: 'application/json' },
        });
        const body = await readBlingProxyResponse(response);
        if (!response.ok) return reply.code(response.status).send({ error: `Bling error: ${response.status}`, detail: body.text });
        return reply.code(200).send(body.json?.data || {});
      }

      const [productResponse, stockResponse] = await Promise.all([
        fetch(`https://www.bling.com.br/Api/v3/produtos/${id}`, { headers: { Authorization: authHeader, Accept: 'application/json' } }),
        fetch(`https://www.bling.com.br/Api/v3/estoques/saldos?pagina=1&limite=100&idsProdutos[]=${id}`, { headers: { Authorization: authHeader, Accept: 'application/json' } }),
      ]);
      const productBody = await readBlingProxyResponse(productResponse);
      if (!productResponse.ok) return reply.code(productResponse.status).send({ error: `Bling error: ${productResponse.status}`, detail: productBody.text });

      const produto = productBody.json?.data || {};
      let stockQuantity = 0;
      if (stockResponse.ok) {
        const stockBody = await readBlingProxyResponse(stockResponse);
        for (const item of (stockBody.json?.data || [])) {
          stockQuantity += readBlingStockQuantityVps(item);
        }
      }

      if (stockQuantity === 0 && produto?.estoque) {
        stockQuantity = readBlingStockQuantityVps(produto.estoque);
      }

      return reply.code(200).send({ ...produto, stock_quantity: Number(stockQuantity) });
    } catch (err) {
      return reply.code(500).send({
        error: 'network_error',
        debug: buildCopyableDebug('bling-product-detail', {
          resource,
          step: 'product detail proxy',
          id,
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'product-update-fiscal') {
    if (request.method !== 'POST') return reply.code(405).send({ error: 'Method not allowed' });

    const { blingId, ncm, cest, origem } = request.body || {};
    if (!blingId) return reply.code(400).send({ error: 'blingId required' });
    if (!ncm && !cest && origem === undefined) {
      return reply.code(400).send({ error: 'At least one of ncm, cest or origem required' });
    }

    try {
      const authHeader = await getBlingProductDetailAuthHeaderVps(request);
      if (!authHeader) return reply.code(401).send({ error: 'Bling not connected' });

      const encodedId = encodeURIComponent(String(blingId));
      const productResponse = await fetch(`https://www.bling.com.br/Api/v3/produtos/${encodedId}`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });
      const productBody = await readBlingProxyResponse(productResponse);
      if (!productResponse.ok) {
        return reply.code(productResponse.status).send({
          error: 'fetch_failed',
          detail: productBody.text,
          debug: buildCopyableDebug('bling-product-update', {
            resource,
            step: 'fetch product',
            blingId: String(blingId),
            upstreamStatus: productResponse.status,
          }),
        });
      }

      const produto = productBody.json?.data || {};
      const tributacaoAtual = produto.tributacao || {};
      const tributacaoNova = { ...tributacaoAtual };
      if (ncm !== undefined) tributacaoNova.ncm = ncm || null;
      if (cest !== undefined) tributacaoNova.cest = cest || null;
      if (origem !== undefined) tributacaoNova.origem = origem;

      const payload = { ...produto, tributacao: tributacaoNova };
      delete payload.estoque;

      const updateResponse = await fetch(`https://www.bling.com.br/Api/v3/produtos/${encodedId}`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const updateBody = await readBlingProxyResponse(updateResponse);
      if (!updateResponse.ok) {
        return reply.code(updateResponse.status).send({
          ok: false,
          error: 'bling_update_failed',
          detail: updateBody.text,
          debug: buildCopyableDebug('bling-product-update', {
            resource,
            step: 'update fiscal fields',
            blingId: String(blingId),
            upstreamStatus: updateResponse.status,
          }),
        });
      }

      return reply.code(200).send({ ok: true, blingId, ncm, cest });
    } catch (err) {
      return reply.code(500).send({
        error: 'network_error',
        debug: buildCopyableDebug('bling-product-update', {
          resource,
          step: 'product fiscal update',
          blingId: String(blingId || ''),
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'product-update-dimensions') {
    if (request.method !== 'POST') return reply.code(405).send({ error: 'Method not allowed' });

    const { blingIds, updateData } = request.body || {};
    if (!blingIds || !Array.isArray(blingIds) || !updateData) {
      return reply.code(400).send({ error: 'blingIds array and updateData required' });
    }

    try {
      const authHeader = await getBlingProductDetailAuthHeaderVps(request);
      if (!authHeader) return reply.code(401).send({ error: 'Bling not connected' });

      const results = [];
      for (const blingId of blingIds) {
        const encodedId = encodeURIComponent(String(blingId));
        const productResponse = await fetch(`https://www.bling.com.br/Api/v3/produtos/${encodedId}`, {
          headers: { Authorization: authHeader, Accept: 'application/json' },
        });
        const productBody = await readBlingProxyResponse(productResponse);
        if (!productResponse.ok) {
          results.push({ id: blingId, success: false, error: 'fetch_failed', detail: productBody.text });
          continue;
        }

        const produto = productBody.json?.data || {};
        const payload = {
          ...produto,
          pesoBruto: updateData.pesoBruto !== undefined ? updateData.pesoBruto : produto.pesoBruto,
          dimensoes: {
            ...(produto.dimensoes || {}),
            ...(updateData.dimensoes || {}),
          },
        };
        delete payload.estoque;

        const updateResponse = await fetch(`https://www.bling.com.br/Api/v3/produtos/${encodedId}`, {
          method: 'PUT',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        const updateBody = await readBlingProxyResponse(updateResponse);
        if (updateResponse.ok) {
          results.push({ id: blingId, success: true });
        } else {
          results.push({ id: blingId, success: false, error: 'update_failed', detail: updateBody.text });
        }
      }

      return reply.code(200).send({ ok: true, results });
    } catch (err) {
      return reply.code(500).send({
        error: 'network_error',
        debug: buildCopyableDebug('bling-product-update', {
          resource,
          step: 'product dimensions update',
          idsCount: Array.isArray(blingIds) ? blingIds.length : 0,
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'image-proxy') {
    if (request.method !== 'GET') return reply.code(405).send({ error: 'Method not allowed' });
    const imageUrl = request.query?.url;
    if (!imageUrl || typeof imageUrl !== 'string') return reply.code(400).send({ error: 'Missing url parameter' });

    try {
      const parsedUrl = new URL(imageUrl);
      if (parsedUrl.protocol !== 'https:') return reply.code(400).send({ error: 'Only https URLs are supported' });

      const allowedExactHosts = new Set(['orgbling.s3.amazonaws.com', 'i.imgur.com', 'imgur.com']);
      const allowedSuffixes = ['xiaomipetrolina.com.br', 'mercadodovale.com.br'];
      const vpsBase = process.env.VITE_VPS_BASE_URL || process.env.VPS_BASE_URL;
      if (vpsBase) {
        try {
          allowedExactHosts.add(new URL(vpsBase).hostname);
        } catch {
          // ignore invalid optional env URL
        }
      }

      const host = parsedUrl.hostname.toLowerCase();
      const isAllowed = allowedExactHosts.has(host) || allowedSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
      if (!isAllowed) return reply.code(400).send({ error: 'Unsupported image host', host });

      const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(12000) });
      if (!imageResponse.ok) return reply.code(imageResponse.status).send({ error: 'Failed to fetch image from URL' });
      const arrayBuffer = await imageResponse.arrayBuffer();
      return reply
        .header('Content-Type', imageResponse.headers.get('content-type') || 'image/jpeg')
        .header('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
        .code(200)
        .send(Buffer.from(arrayBuffer));
    } catch (err) {
      return reply.code(500).send({
        error: 'network_error',
        debug: buildCopyableDebug('bling-diagnostics', {
          resource,
          step: 'image proxy',
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'debug-product') {
    if (request.method !== 'GET') return reply.code(405).send({ error: 'Method not allowed' });
    const debugBlingId = request.query?.blingId;
    if (!debugBlingId) return reply.code(400).send({ error: 'blingId is required' });

    try {
      const authHeader = await getBlingProductDetailAuthHeaderVps(request);
      if (!authHeader) return reply.code(401).send({ error: 'Bling not connected' });
      const response = await fetch(`https://www.bling.com.br/Api/v3/produtos/${debugBlingId}`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      const body = await readBlingProxyResponse(response);
      if (!response.ok) return reply.code(response.status).send({ error: `Bling error: ${response.status}`, detail: body.text });
      return reply.code(200).send(body.json || {});
    } catch (err) {
      return reply.code(500).send({
        error: 'network_error',
        debug: buildCopyableDebug('bling-diagnostics', {
          resource,
          step: 'debug product',
          blingId: String(debugBlingId || ''),
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'debug-diagnostic') {
    if (request.method !== 'GET') return reply.code(405).send({ error: 'Method not allowed' });
    const debugBlingId = request.query?.blingId;
    if (!debugBlingId) return reply.code(400).send({ error: 'blingId is required' });

    try {
      const authHeader = await getBlingProductDetailAuthHeaderVps(request);
      if (!authHeader) return reply.code(401).send({ error: 'Bling not connected' });
      const [stockResponse, productResponse] = await Promise.all([
        fetch(`https://www.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${debugBlingId}`, {
          headers: { Authorization: authHeader, Accept: 'application/json' },
          signal: AbortSignal.timeout(12000),
        }),
        fetch(`https://www.bling.com.br/Api/v3/produtos/${debugBlingId}`, {
          headers: { Authorization: authHeader, Accept: 'application/json' },
          signal: AbortSignal.timeout(12000),
        }),
      ]);
      const [stockBody, productBody] = await Promise.all([
        readBlingProxyResponse(stockResponse),
        readBlingProxyResponse(productResponse),
      ]);
      return reply.code(200).send({
        stock: stockBody.json,
        product: productBody.json,
        stockStatus: stockResponse.status,
        productStatus: productResponse.status,
      });
    } catch (err) {
      return reply.code(500).send({
        error: 'network_error',
        debug: buildCopyableDebug('bling-diagnostics', {
          resource,
          step: 'debug diagnostic',
          blingId: String(debugBlingId || ''),
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'fix-profile') {
    if (request.method !== 'POST') return reply.code(405).send({ error: 'Method not allowed' });
    const { userId } = request.body || {};
    if (!userId) return reply.code(400).send({ error: 'userId is required' });

    try {
      const companyRows = await vpsDbSelect('companies', 'select=id&slug=eq.mercado-do-vale&limit=1');
      const company = Array.isArray(companyRows) ? companyRows[0] : null;
      if (!company) return reply.code(404).send({ error: 'Company not found' });
      const profileRows = await vpsDbUpsert('profiles', 'on_conflict=id', { id: userId, company_id: company.id });
      return reply.code(200).send({ ok: true, profile: Array.isArray(profileRows) ? profileRows[0] : profileRows, company_id: company.id });
    } catch (err) {
      return reply.code(500).send({
        error: err.message,
        debug: buildCopyableDebug('bling-admin-helpers', {
          resource,
          step: 'fix profile',
          userId: String(userId || ''),
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'sync-model-brand') {
    if (request.method !== 'POST') return reply.code(405).send({ error: 'Method not allowed' });
    const { model_id, brand_name } = request.body || {};
    if (!model_id || !brand_name) return reply.code(400).send({ error: 'model_id and brand_name are required' });

    try {
      const modelRows = await vpsDbSelect('models', `select=id,brand_id,company_id&id=eq.${encodeURIComponent(String(model_id))}&limit=1`);
      const model = Array.isArray(modelRows) ? modelRows[0] : null;
      if (!model) return reply.code(404).send({ error: 'Model not found' });

      const slug = normalizeBlingAdminSlugVps(brand_name);
      const brandRows = await vpsDbSelect('brands', `select=id,name,slug,active,warranty_days&company_id=eq.${encodeURIComponent(String(model.company_id))}&name=ilike.${encodeURIComponent(String(brand_name))}&limit=1`);
      let brandRow = Array.isArray(brandRows) ? brandRows[0] : null;
      let brandId = brandRow?.id;
      let wasCreated = false;

      if (!brandId) {
        const inserted = await vpsDbInsert('brands', {
          company_id: model.company_id,
          name: brand_name,
          slug,
          warranty_days: 90,
          active: true,
        });
        brandRow = Array.isArray(inserted) ? inserted[0] : inserted;
        brandId = brandRow?.id;
        wasCreated = true;
      }

      if (!brandId) return reply.code(500).send({ error: 'Failed to resolve brand' });
      await vpsDbPatch('models', `id=eq.${encodeURIComponent(String(model_id))}`, { brand_id: brandId });

      const vpsBrandPayload = { ...brandRow, company_id: model.company_id };
      const vpsSync = await patchVpsJsonForBlingAdminVps(request, wasCreated ? 'POST' : 'PUT', wasCreated ? '/brands' : `/brands/${encodeURIComponent(String(brandId))}`, vpsBrandPayload);

      return reply.code(200).send({ ok: true, brand_id: brandId, brand_name, model_id, was_created: wasCreated, vpsSync });
    } catch (err) {
      return reply.code(500).send({
        error: err.message,
        debug: buildCopyableDebug('bling-admin-helpers', {
          resource,
          step: 'sync model brand',
          modelId: String(model_id || ''),
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'fix-bling-id') {
    if (request.method !== 'POST') return reply.code(405).send({ error: 'Method not allowed' });
    const { sku, blingId } = request.body || {};
    if (!sku || !blingId) return reply.code(400).send({ error: 'sku e blingId são obrigatórios' });

    try {
      const beforeRows = await vpsDbSelect('products', `select=id,sku,bling_id,stock_quantity&sku=eq.${encodeURIComponent(String(sku))}&limit=1`);
      const before = Array.isArray(beforeRows) ? beforeRows[0] : null;
      const updatedRows = await vpsDbPatch('products', `sku=eq.${encodeURIComponent(String(sku))}`, { bling_id: Number(blingId) });
      return reply.code(200).send({ ok: true, before, after: Array.isArray(updatedRows) ? updatedRows[0] : updatedRows });
    } catch (err) {
      return reply.code(200).send({
        ok: false,
        error: err.message,
        debug: buildCopyableDebug('bling-admin-helpers', {
          resource,
          step: 'fix bling id',
          sku: String(sku || ''),
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'stock') {
    if (request.method !== 'GET') return reply.code(405).send({ error: 'Method not allowed' });
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Missing Authorization header' });

    const page = request.query?.page || 1;
    const reqIdsProdutos = request.query?.['idsProdutos[]'] || request.query?.idsProdutos;
    const ids = reqIdsProdutos ? (Array.isArray(reqIdsProdutos) ? reqIdsProdutos : [reqIdsProdutos]) : [];
    const idsQuery = ids.map((id) => `idsProdutos[]=${encodeURIComponent(String(id))}`).join('&');
    const url = `https://www.bling.com.br/Api/v3/estoques/saldos?pagina=${page}&limite=100${idsQuery ? `&${idsQuery}` : ''}`;

    try {
      const stockResponse = await fetch(url, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });
      const body = await readBlingProxyResponse(stockResponse);
      if (stockResponse.status === 400) return reply.code(200).send({ data: [] });
      if (!stockResponse.ok) {
        return reply.code(stockResponse.status).send({
          error: `Bling stock error: ${stockResponse.status}`,
          detail: body.text,
          debug: buildCopyableDebug('bling-stock', {
            resource,
            page: String(page),
            idsCount: ids.length,
            upstreamStatus: stockResponse.status,
          }),
        });
      }
      return reply.code(200).send(body.json || { data: [] });
    } catch (err) {
      return reply.code(500).send({
        error: 'network_error',
        debug: buildCopyableDebug('bling-stock', {
          resource,
          page: String(page),
          idsCount: ids.length,
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'stock-sync') {
    if (request.method !== 'POST') return reply.code(405).send({ error: 'Method not allowed' });

    const { blingId, quantity, notes } = request.body || {};
    if (!blingId || !quantity) return reply.code(400).send({ error: 'blingId and quantity required' });

    try {
      const authHeader = await getBlingProductDetailAuthHeaderVps(request);
      if (!authHeader) return reply.code(401).send({ error: 'Bling not connected' });

      const configuredDepositId = String(process.env.BLING_STOCK_SYNC_DEPOSIT_ID || '').trim();
      let selectedDeposit = configuredDepositId ? { id: configuredDepositId, descricao: 'configured' } : null;

      if (!selectedDeposit) {
        const preferredDepositName = String(process.env.BLING_STOCK_SYNC_DEPOSIT_NAME || 'Depósito 01 (Loja)').trim();
        const normalizeDepositName = (value) => String(value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
        const preferredDepositKey = normalizeDepositName(preferredDepositName);

        const depositResponse = await fetch('https://www.bling.com.br/Api/v3/depositos?pagina=1&limite=100', {
          headers: { Authorization: authHeader, Accept: 'application/json' },
        });
        const depositBody = await readBlingProxyResponse(depositResponse);
        if (!depositResponse.ok) {
          return reply.code(depositResponse.status).send({
            error: `Bling deposit error: ${depositResponse.status}`,
            detail: depositBody.text,
            debug: buildCopyableDebug('bling-stock-sync', {
              resource,
              step: 'fetch deposit',
              upstreamStatus: depositResponse.status,
            }),
          });
        }

        const deposits = Array.isArray(depositBody.json?.data) ? depositBody.json.data : [];
        selectedDeposit = deposits.find((deposit) => normalizeDepositName(deposit?.descricao || deposit?.nome) === preferredDepositKey)
          || deposits.find((deposit) => normalizeDepositName(deposit?.descricao || deposit?.nome).includes(preferredDepositKey))
          || deposits[0]
          || null;
      }

      const depositoId = selectedDeposit?.id;
      if (!depositoId) return reply.code(422).send({ error: 'No Bling deposit found' });

      const stockResponse = await fetch('https://www.bling.com.br/Api/v3/estoques', {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          produto: { id: blingId },
          deposito: { id: depositoId },
          operacao: 'S',
          quantidade: quantity,
          observacoes: notes || 'Venda PDV Mercado do Vale',
        }),
      });
      const stockBody = await readBlingProxyResponse(stockResponse);
      if (!stockResponse.ok) {
        return reply.code(stockResponse.status).send({
          error: `Bling stock error: ${stockBody.text}`,
          debug: buildCopyableDebug('bling-stock-sync', {
            resource,
            step: 'post stock movement',
            blingId: String(blingId),
            upstreamStatus: stockResponse.status,
          }),
        });
      }

      return reply.code(200).send({
        ok: true,
        depositoId,
        depositoNome: selectedDeposit?.descricao || selectedDeposit?.nome || null,
      });
    } catch (err) {
      return reply.code(500).send({
        error: err.message || 'network_error',
        debug: buildCopyableDebug('bling-stock-sync', {
          resource,
          blingId: String(blingId || ''),
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'sync-prices-vps') {
    if (request.method !== 'POST') return reply.code(405).send({ error: 'Method not allowed' });

    const syncKey = getVpsSyncKeyForBlingSyncPrices();
    if (!syncKey) return reply.code(500).send({ error: 'VPS_SYNC_KEY not configured' });

    const pageSize = 50;
    const page = parseInt(String(query.page || request.body?.page || 0), 10) || 0;
    const dryRun = String(query?.dryRun || request.body?.dryRun || '').toLowerCase() === 'true';
    const from = page * pageSize;
    const to = from + pageSize - 1;

    try {
      const { products, total } = await loadVpsProductsForBlingSyncPrices(from, to);
      if (!products || products.length === 0) {
        return reply.code(200).send({ ok: true, synced: 0, total, hasMore: false, nextPage: null });
      }

      const vpsRows = buildBlingSyncPricesVpsRows(products);
      if (dryRun) {
        const hasMore = from + products.length < total;
        return reply.code(200).send({
          ok: true,
          dryRun: true,
          wouldSync: vpsRows.length,
          page,
          total,
          hasMore,
          nextPage: hasMore ? page + 1 : null,
          sample: vpsRows.slice(0, 3).map((row) => ({
            id: row.id,
            hasBlingId: !!row.bling_id,
            hasBlingParent: !!row.bling_parent_id,
            hasParent: !!row.parent_id,
          })),
        });
      }
      const batchRes = await fetch(`${getVpsBatchBaseUrl(request)}/products/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Key': syncKey },
        body: JSON.stringify(vpsRows),
        signal: AbortSignal.timeout(25000),
      });
      const batchBody = await readBlingProxyResponse(batchRes);
      const batchJson = batchRes.ok ? (batchBody.json || {}) : { upserted: 0 };
      const hasMore = from + products.length < total;

      return reply.code(200).send({
        ok: batchRes.ok,
        synced: batchJson.upserted ?? products.length,
        page,
        total,
        hasMore,
        nextPage: hasMore ? page + 1 : null,
        vpsStatus: batchRes.status,
      });
    } catch (err) {
      return reply.code(500).send({
        error: err.message || 'sync-prices-vps failed',
        debug: buildCopyableDebug('bling-sync-prices-vps', {
          resource,
          page,
          from,
          to,
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'reconcile') {
    if (request.method !== 'GET' && request.method !== 'POST') return reply.code(405).send({ error: 'Method not allowed' });
    if (!isBlingReconcileAuthorizedVps(request)) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const dryRun = String(query?.dryRun || request.body?.dryRun || '').toLowerCase() === 'true';
      const includeDetails = String(query?.details || request.body?.details || '').toLowerCase() === 'true';
      const serialOrders = Math.min(100, Math.max(1, Number(query?.serialOrders || request.body?.serialOrders || 25) || 25));
      const accessToken = await getValidBlingAccessTokenForReconcileVps();
      const serialSales = await syncBlingSerialSalesFromRecentOrdersVps({ accessToken, dryRun, maxOrders: serialOrders });
      const localProducts = await fetchAllLocalProductsForReconcileVps();
      const remoteProducts = await fetchAllBlingProductsForReconcileVps(accessToken);
      const remoteStocks = await fetchAllBlingStocksForReconcileVps(accessToken, localProducts.map((product) => product.bling_id));
      const plan = buildBlingReconcilePlanVps({ localProducts, remoteProducts, remoteStocks });

      if (dryRun) {
        return reply.code(200).send({
          ok: true,
          dryRun: true,
          planned: { stockChanges: plan.stockChanges.length, nameChanges: plan.nameChanges.length },
          serialSales,
          totals: plan.totals,
          ...(includeDetails ? { details: summarizeBlingReconcilePlanDetailsVps(plan) } : {}),
        });
      }

      const stockResult = await applyReconcileStockChangesVps(plan.stockChanges, request);
      return reply.code(200).send({
        ok: true,
        totals: plan.totals,
        serialSales,
        planned: { stockChanges: plan.stockChanges.length, nameChanges: plan.nameChanges.length },
        applied: { stockChanges: stockResult.applied.length, nameChanges: 0 },
        failed: stockResult.failed,
      });
    } catch (err) {
      return reply.code(500).send({
        ok: false,
        error: err.message || 'Unknown error',
        debug: buildCopyableDebug('bling-reconcile', {
          resource,
          dryRun: String(query?.dryRun || request.body?.dryRun || ''),
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'serial-sales-sync') {
    if (request.method !== 'GET' && request.method !== 'POST') return reply.code(405).send({ error: 'Method not allowed' });
    if (!isBlingReconcileAuthorizedVps(request)) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const dryRun = String(query?.dryRun ?? request.body?.dryRun ?? 'true').toLowerCase() !== 'false';
      const maxOrders = Math.min(100, Math.max(1, Number(query?.maxOrders || request.body?.maxOrders || 25) || 25));
      const accessToken = await getValidBlingAccessTokenForReconcileVps();
      const result = await syncBlingSerialSalesFromRecentOrdersVps({ accessToken, dryRun, maxOrders });
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({
        ok: false,
        error: err.message || 'Unknown error',
        debug: buildCopyableDebug('bling-serial-sales-sync', {
          resource,
          dryRun: String(query?.dryRun ?? request.body?.dryRun ?? 'true'),
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'finance') {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Missing Authorization header' });

    const headers = { Authorization: authHeader, Accept: 'application/json', 'Content-Type': 'application/json' };
    const { action, id, resourceType } = query;
    if (!resourceType || !['pagar', 'receber'].includes(resourceType)) {
      return reply.code(400).send({ error: 'resourceType must be "pagar" or "receber"' });
    }

    const base = 'https://www.bling.com.br/Api/v3';
    const endpoint = resourceType === 'pagar' ? 'contas/pagar' : 'contas/receber';
    const sendFinanceError = (status, error, extra = {}) => reply.code(status).send({
      error,
      debug: buildCopyableDebug('bling-finance', {
        resource,
        action: String(action || ''),
        resourceType: String(resourceType || ''),
        id: id ? String(id) : '',
        ...extra,
      }),
    });

    try {
      if (action === 'list' && request.method === 'GET') {
        const { pagina = '1', limite = '100', dataVencimentoInicio, dataVencimentoFim, situacao } = query;
        const forceRefresh = String(query?.forceRefresh || '') === '1';
        const cacheKey = getBlingFinanceCacheKey(query);
        const cached = !forceRefresh ? blingFinanceListCache.get(cacheKey) : null;
        if (cached) {
          return reply.code(200).send({ ...cached.body, meta: { ...(cached.body?.meta || {}), source: 'vps-cache', cachedAt: cached.cachedAt } });
        }
        let url = `${base}/${endpoint}?pagina=${pagina}&limite=${limite}`;
        if (dataVencimentoInicio) url += `&dataVencimentoInicial=${dataVencimentoInicio}`;
        if (dataVencimentoFim) url += `&dataVencimentoFinal=${dataVencimentoFim}`;
        if (situacao) url += `&situacao=${situacao === 'pago' ? 2 : situacao === 'cancelado' ? 5 : situacao === 'em_aberto' ? 1 : situacao}`;
        const response = await fetch(url, { headers });
        const body = await readBlingProxyResponse(response);
        if (!response.ok) {
          return sendFinanceError(response.status, `Bling ${response.status}`, {
            upstreamStatus: response.status,
            detail: body.json?.error?.description || body.text,
          });
        }
        blingFinanceListCache.set(cacheKey, { body: body.json || { data: [] }, cachedAt: new Date().toISOString() });
        return reply.code(200).send(body.json || { data: [] });
      }

      if (action === 'get' && request.method === 'GET' && id) {
        const response = await fetch(`${base}/${endpoint}/${id}`, { headers });
        const body = await readBlingProxyResponse(response);
        if (!response.ok) return sendFinanceError(response.status, `Bling error: ${response.status}`, { upstreamStatus: response.status });
        return reply.code(200).send(body.json || {});
      }

      if (action === 'get-bordero' && request.method === 'GET' && id) {
        const response = await fetch(`${base}/borderos/${id}`, { headers });
        const body = await readBlingProxyResponse(response);
        if (!response.ok) return sendFinanceError(response.status, `Bling bordero error: ${response.status}`, { upstreamStatus: response.status });
        return reply.code(200).send(body.json || {});
      }

      if (action === 'create' && request.method === 'POST') {
        const response = await fetch(`${base}/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(request.body || {}) });
        const body = await readBlingProxyResponse(response);
        if (!response.ok) return sendFinanceError(response.status, body.json || body.text || 'Bling finance create failed', { upstreamStatus: response.status });
        clearBlingFinanceListCache();
        return reply.code(200).send(body.json || {});
      }

      if (action === 'update' && request.method === 'PUT' && id) {
        const response = await fetch(`${base}/${endpoint}/${id}`, { method: 'PUT', headers, body: JSON.stringify(request.body || {}) });
        const body = await readBlingProxyResponse(response);
        if (!response.ok) return sendFinanceError(response.status, body.json || body.text || 'Bling finance update failed', { upstreamStatus: response.status });
        clearBlingFinanceListCache();
        return reply.code(200).send(body.json || {});
      }

      if (action === 'baixar' && request.method === 'POST' && id) {
        const response = await fetch(`${base}/${endpoint}/${id}/baixar`, { method: 'POST', headers, body: JSON.stringify(request.body || {}) });
        const body = await readBlingProxyResponse(response);
        if (!response.ok) return sendFinanceError(response.status, body.json || body.text || 'Bling finance baixar failed', { upstreamStatus: response.status });
        clearBlingFinanceListCache();
        return reply.code(200).send(body.json || {});
      }

      if (action === 'cancelar' && request.method === 'DELETE' && id) {
        const response = await fetch(`${base}/${endpoint}/${id}`, { method: 'DELETE', headers });
        if (!response.ok) return sendFinanceError(response.status, `Bling error: ${response.status}`, { upstreamStatus: response.status });
        clearBlingFinanceListCache();
        return reply.code(200).send({ success: true });
      }

      return reply.code(400).send({ error: 'Invalid action or method' });
    } catch (err) {
      return sendFinanceError(500, 'network_error', { rawMessage: err.message });
    }
  }

  if (resource === 'nf-detail') {
    if (request.method !== 'GET') return reply.code(405).send({ error: 'Method not allowed' });

    const tipo = String(query.tipo || '').toLowerCase();
    const id = query.id ? encodeURIComponent(String(query.id)) : '';
    if (!['nfe', 'nfce'].includes(tipo)) return reply.code(400).send({ error: 'tipo must be nfe or nfce' });
    if (!id) return reply.code(400).send({ error: 'id is required' });

    try {
      const authHeader = await getBlingProductDetailAuthHeaderVps(request);
      if (!authHeader) return reply.code(401).send({ error: 'Bling not connected' });
      const response = await fetch(`https://www.bling.com.br/Api/v3/${tipo}/${id}`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });
      const body = await readBlingProxyResponse(response);
      if (!response.ok) {
        return reply.code(response.status).send({
          error: `Bling ${tipo} detail error: ${response.status}`,
          detail: body.text,
          debug: buildCopyableDebug('bling-nf', {
            resource,
            tipo,
            id,
            upstreamStatus: response.status,
          }),
        });
      }
      return reply.code(200).send(body.json || {});
    } catch (err) {
      return reply.code(500).send({
        error: 'network_error',
        debug: buildCopyableDebug('bling-nf', {
          resource,
          tipo,
          id,
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'nfe' || resource === 'nfce') {
    if (request.method !== 'GET') return reply.code(405).send({ error: 'Method not allowed' });

    const endpoint = resource === 'nfe' ? 'nfe' : 'nfce';
    const inicio = query.dataEmissaoInicio || query.dataEmissaoInicial || '';
    const fim = query.dataEmissaoFim || query.dataEmissaoFinal || '';
    const situacao = query.situacao || '';
    const pagina = query.pagina || '1';
    let url = `https://www.bling.com.br/Api/v3/${endpoint}?pagina=${pagina}&limite=100`;
    if (inicio) url += `&dataEmissaoInicial=${inicio}`;
    if (fim) url += `&dataEmissaoFinal=${fim}`;
    if (situacao) url += `&situacao=${situacao}`;

    try {
      const authHeader = await getBlingProductDetailAuthHeaderVps(request);
      if (!authHeader) return reply.code(401).send({ error: 'Bling not connected' });
      const response = await fetch(url, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });
      const body = await readBlingProxyResponse(response);
      if (!response.ok) {
        return reply.code(response.status).send({
          error: `Bling ${endpoint} error: ${response.status}`,
          detail: body.text,
          debug: buildCopyableDebug('bling-nf', {
            resource,
            endpoint,
            pagina: String(pagina),
            upstreamStatus: response.status,
          }),
        });
      }
      return reply.code(200).send(body.json || { data: [] });
    } catch (err) {
      return reply.code(500).send({
        error: 'network_error',
        debug: buildCopyableDebug('bling-nf', {
          resource,
          endpoint,
          pagina: String(pagina),
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'categories') {
    if (request.method !== 'GET') return reply.code(405).send({ error: 'Method not allowed' });
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Missing Authorization header' });
    const page = request.query?.page || 1;

    try {
      const response = await fetch(`https://www.bling.com.br/Api/v3/categorias/produtos?pagina=${page}&limite=100`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });
      const body = await readBlingProxyResponse(response);
      if (!response.ok) return reply.code(response.status).send({ error: `Bling error: ${response.status}`, detail: body.text });
      return reply.code(200).send(body.json || { data: [] });
    } catch (err) {
      return reply.code(500).send({
        error: 'network_error',
        debug: buildCopyableDebug('bling-products', {
          resource,
          step: 'categories proxy',
          rawMessage: err.message,
        }),
      });
    }
  }

  if (resource === 'products') {
    if (request.method !== 'GET') return reply.code(405).send({ error: 'Method not allowed' });
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.code(401).send({ error: 'Missing Authorization header' });

    const page = request.query?.page || 1;
    const search = request.query?.search ? String(request.query.search) : '';
    const headers = { Authorization: authHeader, Accept: 'application/json' };
    const base = `https://www.bling.com.br/Api/v3/produtos?pagina=${page}&limite=100&criterio=5`;
    const debug = {
      resource,
      page: String(page),
      search,
      searchLength: search.length,
      startedAt: new Date().toISOString(),
      stages: [],
      fallbackPages: [],
    };

    try {
      if (!search) {
        const response = await fetch(base, { headers });
        const body = await readBlingProxyResponse(response);
        debug.stages.push({ name: 'list', ...summarizeBlingProxyBody(body) });
        if (!response.ok) {
          return reply.code(response.status).send({
            error: `Bling error: ${response.status}`,
            detail: body.text,
            debug: buildCopyableDebug('bling-products', debug),
          });
        }
        return reply.code(200).send(body.json || { data: [] });
      }

      const [byName, bySku] = await Promise.all([
        fetch(`${base}&nome=${encodeURIComponent(search)}`, { headers }),
        fetch(`${base}&codigo=${encodeURIComponent(search)}`, { headers }),
      ]);
      const nameBody = await readBlingProxyResponse(byName);
      const skuBody = await readBlingProxyResponse(bySku);
      debug.stages.push({ name: 'by_name', queryParam: 'nome', ...summarizeBlingProxyBody(nameBody) });
      debug.stages.push({ name: 'by_sku', queryParam: 'codigo', ...summarizeBlingProxyBody(skuBody) });

      const nameData = byName.ok ? (nameBody.json || { data: [] }) : { data: [] };
      const skuData = bySku.ok ? (skuBody.json || { data: [] }) : { data: [] };
      const seen = new Set();
      const merged = [];
      for (const item of [...(nameData.data || []), ...(skuData.data || [])]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          merged.push(item);
        }
      }

      if (merged.length === 0) {
        debug.stages.push({ name: 'fallback_loose_start' });
        const looseMatches = await fetchLooseBlingProductSearchVps(base, headers, search, debug);
        debug.stages.push({ name: 'fallback_loose_done', count: looseMatches.length });
        return reply.code(200).send({ data: looseMatches, total: looseMatches.length, searchMode: 'loose', debug });
      }

      return reply.code(200).send({ data: merged, total: merged.length, searchMode: 'direct', debug });
    } catch (err) {
      const responseDebug = err?.blingDebug || debug;
      responseDebug.failedAt = new Date().toISOString();
      responseDebug.exception = { name: err?.name, message: err?.message };
      return reply.code(500).send({
        error: 'bling_products_search_failed',
        message: err?.message || 'Erro inesperado ao buscar produtos no Bling',
        debug: buildCopyableDebug('bling-products', responseDebug),
      });
    }
  }

  return reply.code(400).send({ error: 'Invalid resource. Migrated on VPS: oauth-callback|exchange|categories|products|product-detail|product-update-fiscal|product-update-dimensions|image-proxy|debug-product|debug-diagnostic|fix-profile|sync-model-brand|fix-bling-id|stock|stock-sync|sync-prices-vps|reconcile|serial-sales-sync|finance|nfe|nfce|nf-detail|webhook|webhook-logs|webhook-test' });
}

const TELEGRAM_BOT_MANUAL_VPS = `*Manual do Bot - Mercado do Vale*
--------------------------------

*RELATORIOS*
/relatorio - Fechamento do dia
/vendas - Resumo rapido das vendas de hoje
/top10 - Top 10 produtos mais vendidos

*ESTOQUE*
/estoque - Lista produtos em estoque
/estoque [nome] - Busca produto por nome

*PRECOS*
/preco [nome] - Consulta preco de um produto

*PEDIDOS*
/pedidos - Pedidos online pendentes

*CLIENTES*
/clientes - Novos clientes desta semana

*MODELO*
/modelo [nome] - Variacoes, estoque e custo medio

*CATEGORIA*
/categoria [nome] - Estoque completo de uma categoria

*OUTROS*
/ajuda - Exibe este manual
/ping - Testa se o bot esta online`;

function isAuthorizedTelegramWebhookRequestVps(request) {
  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!secret) return true;
  const received = String(
    request.headers['x-telegram-bot-api-secret-token'] ||
    request.headers['x-telegram-webhook-secret'] ||
    request.query?.secret ||
    request.query?.token ||
    ''
  ).trim();
  return received === secret;
}

function telegramWebhookMoneyFromCentsVps(value) {
  const numeric = Number(value) || 0;
  return `R$ ${(numeric / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function telegramWebhookMoneyRawVps(value) {
  const numeric = Number(value) || 0;
  return `R$ ${numeric.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function telegramWebhookSaoPauloDayRangeVps(now) {
  const start = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function telegramWebhookVariantVps(specs = {}) {
  const safeSpecs = specs && typeof specs === 'object' ? specs : {};
  const color = safeSpecs.color || safeSpecs.cor || '';
  const ram = safeSpecs.ram || '';
  const storage = safeSpecs.storage || '';
  const memory = ram && storage ? `${ram}/${storage}` : (ram || storage);
  return [color, memory].filter(Boolean).join(' - ');
}

function truncateTelegramWebhookMessageVps(message, suffix = '\n\n_... lista truncada._') {
  const value = String(message || '');
  if (value.length <= 3900) return value;
  return `${value.substring(0, 3800)}${suffix}`;
}

async function sendTelegramWebhookMessageVps(token, chatId, text, parseMode = 'Markdown') {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Telegram webhook send failed: ${response.status} ${body.slice(0, 200)}`);
  }
}

async function telegramWebhookSalesTodayVps(now) {
  const { start, end } = telegramWebhookSaoPauloDayRangeVps(now);
  const query = `select=total,profit,created_at,payment_method&status=eq.completed&created_at=gte.${encodeURIComponent(start.toISOString())}&created_at=lte.${encodeURIComponent(end.toISOString())}&order=created_at.desc`;
  const sales = await vpsDbSelect('sales', query);
  return Array.isArray(sales) ? sales : [];
}

async function handleTelegramWebhookCommandVps({ token, chatId, text, command, args, now }) {
  const tz = 'America/Sao_Paulo';

  if (command === '/ping') {
    const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz }).format(now);
    await sendTelegramWebhookMessageVps(token, chatId, `Bot online! ${time}`);
    return;
  }

  if (['/ajuda', '/start', '/help', '/menu'].includes(command)) {
    await sendTelegramWebhookMessageVps(token, chatId, TELEGRAM_BOT_MANUAL_VPS);
    return;
  }

  if (command === '/vendas') {
    const sales = await telegramWebhookSalesTodayVps(now);
    const qty = sales.length;
    const revenue = sales.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
    const profit = sales.reduce((sum, row) => sum + (Number(row.profit) || 0), 0);
    const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: tz }).format(now);
    const message = qty === 0
      ? `*Vendas de hoje (${date})*\n\nNenhuma venda registrada ainda.`
      : `*Vendas de hoje (${date})*\n\nVendas: *${qty}*\nFaturamento: *${telegramWebhookMoneyRawVps(revenue)}*\nLucro: *${telegramWebhookMoneyRawVps(profit)}*`;
    await sendTelegramWebhookMessageVps(token, chatId, message);
    return;
  }

  if (command === '/relatorio') {
    await sendTelegramWebhookMessageVps(token, chatId, 'Gerando relatorio completo...');
    const sales = await telegramWebhookSalesTodayVps(now);
    const products = await vpsDbSelect('products', 'select=stock_quantity&status=eq.active&stock_quantity=gt.0');
    const pendingOrders = await vpsDbSelect('orders', 'select=id&status=eq.pending');
    const revenue = sales.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
    const profit = sales.reduce((sum, row) => sum + (Number(row.profit) || 0), 0);
    const totalStock = (Array.isArray(products) ? products : []).reduce((sum, product) => sum + (Number(product.stock_quantity) || 0), 0);
    const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz }).format(now);
    let message = `*Relatorio Completo - ${date}*\n----------------------------\n\n`;
    message += `*VENDAS DO DIA*\nQuantidade: *${sales.length} venda(s)*\nFaturamento: *${telegramWebhookMoneyRawVps(revenue)}*\nLucro: *${telegramWebhookMoneyRawVps(profit)}*\n\n`;
    message += `*ESTOQUE*\nTotal em estoque: *${totalStock} unidades*\n\n`;
    if (Array.isArray(pendingOrders) && pendingOrders.length > 0) message += `ATENCAO: ${pendingOrders.length} pedido(s) online pendente(s)`;
    await sendTelegramWebhookMessageVps(token, chatId, message);
    return;
  }

  if (command === '/top10') {
    await sendTelegramWebhookMessageVps(token, chatId, 'Buscando produtos mais vendidos...');
    const items = await vpsDbSelect('sale_items', 'select=product_name,quantity,created_at&order=created_at.desc&limit=500');
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      await sendTelegramWebhookMessageVps(token, chatId, 'Nenhuma venda registrada ainda.');
      return;
    }
    const grouped = new Map();
    for (const item of rows) {
      const name = item.product_name || 'Sem nome';
      grouped.set(name, (grouped.get(name) || 0) + (Number(item.quantity) || 1));
    }
    const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    let message = `*Top 10 Produtos Mais Vendidos*\n----------------------------\n\n`;
    sorted.forEach(([name, qty], index) => {
      message += `${index + 1}. *${qty}x* - ${name}\n`;
    });
    await sendTelegramWebhookMessageVps(token, chatId, message);
    return;
  }

  if (command === '/estoque') {
    const searchFilter = args ? `&name=ilike.*${encodeURIComponent(args)}*` : '&limit=30';
    const products = await vpsDbSelect('products', `select=name,stock_quantity,specs,price_pix,price_card&status=eq.active&stock_quantity=gt.0${searchFilter}&order=name.asc`);
    const rows = Array.isArray(products) ? products : [];
    if (!rows.length) {
      await sendTelegramWebhookMessageVps(token, chatId, args ? `Nenhum produto encontrado com *"${args}"*` : 'Nenhum produto em estoque no momento.');
      return;
    }
    let message = args ? `*Estoque - "${args}"* (${rows.length})\n----------------------------\n\n` : `*Estoque Geral* (mostrando ${rows.length})\n----------------------------\n\n`;
    for (const product of rows) {
      const variant = telegramWebhookVariantVps(product.specs);
      message += `*${product.name}*\n`;
      if (variant) message += `_${variant}_\n`;
      message += `Estoque: *${product.stock_quantity} un*`;
      if (product.price_pix) message += ` - PIX: *${telegramWebhookMoneyFromCentsVps(product.price_pix)}*`;
      message += '\n\n';
    }
    if (!args && rows.length === 30) message += '_Use `/estoque [nome]` para buscar um produto especifico._';
    await sendTelegramWebhookMessageVps(token, chatId, truncateTelegramWebhookMessageVps(message, '\n\n_... lista truncada. Use /estoque [nome] para buscar._'));
    return;
  }

  if (command === '/preco') {
    if (!args) {
      await sendTelegramWebhookMessageVps(token, chatId, 'Informe o produto. Ex: `/preco iphone 15 pro`');
      return;
    }
    const products = await vpsDbSelect('products', `select=name,stock_quantity,specs,price_pix,price_card&status=eq.active&name=ilike.*${encodeURIComponent(args)}*&order=name.asc&limit=5`);
    const rows = Array.isArray(products) ? products : [];
    if (!rows.length) {
      await sendTelegramWebhookMessageVps(token, chatId, `Produto *"${args}"* nao encontrado.`);
      return;
    }
    let message = `*Precos - "${args}"*\n----------------------------\n\n`;
    for (const product of rows) {
      const variant = telegramWebhookVariantVps(product.specs);
      message += `*${product.name}*\n`;
      if (variant) message += `_${variant}_\n`;
      if (product.price_pix) message += `PIX: *${telegramWebhookMoneyFromCentsVps(product.price_pix)}*\n`;
      if (product.price_card) message += `Cartao: *${telegramWebhookMoneyFromCentsVps(product.price_card)}*\n`;
      message += `Em estoque: *${product.stock_quantity} un*\n\n`;
    }
    await sendTelegramWebhookMessageVps(token, chatId, message);
    return;
  }

  if (command === '/pedidos') {
    const orders = await vpsDbSelect('orders', 'select=id,customer_name,total,status,created_at,items&status=in.(pending,confirmed)&order=created_at.desc&limit=10');
    const rows = Array.isArray(orders) ? orders : [];
    if (!rows.length) {
      await sendTelegramWebhookMessageVps(token, chatId, 'Nenhum pedido pendente no momento.');
      return;
    }
    let message = `*Pedidos Pendentes/Confirmados* (${rows.length})\n----------------------------\n\n`;
    for (const order of rows) {
      const shortId = String(order.id || '?').substring(0, 8).toUpperCase();
      const date = order.created_at ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(order.created_at)) : '';
      message += `*#${shortId}* - ${order.customer_name || 'Cliente'}\n${telegramWebhookMoneyRawVps(order.total || 0)} - ${date}\n\n`;
    }
    await sendTelegramWebhookMessageVps(token, chatId, message);
    return;
  }

  if (command === '/clientes') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const clients = await vpsDbSelect('customers', `select=name,phone,type,created_at&created_at=gte.${encodeURIComponent(weekAgo.toISOString())}&order=created_at.desc&limit=15`);
    const rows = Array.isArray(clients) ? clients : [];
    if (!rows.length) {
      await sendTelegramWebhookMessageVps(token, chatId, 'Nenhum cliente novo nos ultimos 7 dias.');
      return;
    }
    let message = `*Novos Clientes - Ultimos 7 dias* (${rows.length})\n----------------------------\n\n`;
    for (const client of rows) {
      const date = client.created_at ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: tz }).format(new Date(client.created_at)) : '';
      const typeLabel = client.type === 'atacado' ? 'Atacado' : 'Varejo';
      message += `- *${client.name}* - ${typeLabel} - _${date}_\n`;
      if (client.phone) message += `  ${client.phone}\n`;
      message += '\n';
    }
    await sendTelegramWebhookMessageVps(token, chatId, message);
    return;
  }

  if (command === '/modelo') {
    if (!args) {
      await sendTelegramWebhookMessageVps(token, chatId, 'Informe o modelo. Ex: `/modelo iphone 15`');
      return;
    }
    const products = await vpsDbSelect('products', `select=name,stock_quantity,specs,price_cost&status=eq.active&stock_quantity=gt.0&name=ilike.*${encodeURIComponent(args)}*&order=name.asc`);
    const rows = Array.isArray(products) ? products : [];
    if (!rows.length) {
      await sendTelegramWebhookMessageVps(token, chatId, `Nenhum produto em estoque encontrado para *"${args}"*.`);
      return;
    }
    const grouped = new Map();
    for (const product of rows) {
      const entry = grouped.get(product.name) || { qty: 0, costs: [], specs: product.specs || {} };
      entry.qty += Number(product.stock_quantity) || 0;
      if (product.price_cost && Number(product.price_cost) > 0) entry.costs.push(Number(product.price_cost));
      grouped.set(product.name, entry);
    }
    const totalQty = Array.from(grouped.values()).reduce((sum, entry) => sum + entry.qty, 0);
    let message = `*Modelo - "${args}"* (${grouped.size} variacao(oes) - ${totalQty} un total)\n----------------------------\n\n`;
    for (const [name, entry] of grouped.entries()) {
      const variant = telegramWebhookVariantVps(entry.specs);
      const avgCost = entry.costs.length ? entry.costs.reduce((sum, value) => sum + value, 0) / entry.costs.length : null;
      message += `*${name}*\n`;
      if (variant) message += `_${variant}_\n`;
      message += `Estoque: *${entry.qty} un*`;
      if (avgCost) message += ` - Custo medio: *${telegramWebhookMoneyFromCentsVps(avgCost)}*`;
      message += '\n\n';
    }
    await sendTelegramWebhookMessageVps(token, chatId, truncateTelegramWebhookMessageVps(message));
    return;
  }

  if (command === '/categoria') {
    if (!args) {
      await sendTelegramWebhookMessageVps(token, chatId, 'Informe a categoria. Ex: `/categoria celulares`');
      return;
    }
    const categories = await vpsDbSelect('categories', `select=id,name&name=ilike.*${encodeURIComponent(args)}*&limit=5`);
    const category = Array.isArray(categories) ? categories[0] : null;
    if (!category) {
      await sendTelegramWebhookMessageVps(token, chatId, `Categoria *"${args}"* nao encontrada.`);
      return;
    }
    await sendTelegramWebhookMessageVps(token, chatId, `Carregando estoque de *${category.name}*...`);
    const models = await vpsDbSelect('models', `select=id&category_id=eq.${encodeURIComponent(category.id)}`);
    const modelIds = (Array.isArray(models) ? models : []).map((model) => model.id).filter(Boolean);
    const relationFilter = modelIds.length
      ? `or=(category_id.eq.${encodeURIComponent(category.id)},model_id.in.(${modelIds.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')}))`
      : `category_id=eq.${encodeURIComponent(category.id)}`;
    const products = await vpsDbSelect('products', `select=name,stock_quantity,specs,price_cost,brand&status=eq.active&stock_quantity=gt.0&${relationFilter}&order=name.asc`);
    const rows = Array.isArray(products) ? products : [];
    if (!rows.length) {
      await sendTelegramWebhookMessageVps(token, chatId, `Nenhum produto em estoque na categoria *${category.name}*.`);
      return;
    }
    const grouped = new Map();
    for (const product of rows) {
      const entry = grouped.get(product.name) || { qty: 0, costs: [], specs: product.specs || {} };
      entry.qty += Number(product.stock_quantity) || 0;
      if (product.price_cost && Number(product.price_cost) > 0) entry.costs.push(Number(product.price_cost));
      grouped.set(product.name, entry);
    }
    const totalQty = Array.from(grouped.values()).reduce((sum, entry) => sum + entry.qty, 0);
    const totalValue = Array.from(grouped.values()).reduce((sum, entry) => {
      const avg = entry.costs.length ? entry.costs.reduce((acc, value) => acc + value, 0) / entry.costs.length : 0;
      return sum + avg * entry.qty;
    }, 0);
    let message = `*Categoria: ${category.name}*\n${grouped.size} variacao(oes) - *${totalQty} unidades* em estoque`;
    if (totalValue > 0) message += ` - Custo total: *${telegramWebhookMoneyFromCentsVps(totalValue)}*`;
    message += `\n----------------------------\n\n`;
    for (const [name, entry] of grouped.entries()) {
      const variant = telegramWebhookVariantVps(entry.specs);
      const avgCost = entry.costs.length ? entry.costs.reduce((sum, value) => sum + value, 0) / entry.costs.length : null;
      message += `*${name}*\n`;
      if (variant) message += `_${variant}_\n`;
      message += `Estoque: *${entry.qty} un*`;
      if (avgCost) message += ` - Custo medio: *${telegramWebhookMoneyFromCentsVps(avgCost)}*`;
      message += '\n\n';
    }
    await sendTelegramWebhookMessageVps(token, chatId, truncateTelegramWebhookMessageVps(message, '\n\n_... lista truncada. Use /modelo [nome] para buscar um produto especifico._'));
    return;
  }

  if (text.startsWith('/')) {
    await sendTelegramWebhookMessageVps(token, chatId, `Comando nao reconhecido: *${command}*\n\nDigite /ajuda para ver todos os comandos disponiveis.`);
    return;
  }

  await sendTelegramWebhookMessageVps(token, chatId, `Ola! Nao entendi a mensagem *"${text}"*.\n\nEste bot funciona apenas com comandos. Digite /ajuda para ver o que posso fazer por voce.`);
}

async function handleTelegramWebhookVps(request, reply) {
  if (request.method !== 'POST') return reply.code(200).send({ ok: true });
  const telegramWebhookSecretConfigured = !!String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (telegramWebhookSecretConfigured && !isAuthorizedTelegramWebhookRequestVps(request)) return reply.code(401).send({ error: 'Unauthorized' });

  try {
    const update = request.body || {};
    const message = update?.message || update?.edited_message;
    if (!message?.text) return reply.code(200).send({ ok: true });
    if (!telegramWebhookSecretConfigured) return reply.code(503).send({ error: 'TELEGRAM_WEBHOOK_SECRET not configured' });

    const rows = await vpsDbSelect('telegram_settings', 'select=*&limit=1');
    const settings = Array.isArray(rows) ? rows[0] : null;
    if (!settings?.active || !settings?.bot_token) return reply.code(200).send({ ok: true });

    const token = settings.bot_token;

    const chatId = message.chat?.id || settings.chat_id;
    if (!chatId) return reply.code(200).send({ ok: true });

    const text = String(message.text || '').trim();
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase().replace(/@\w+/g, '');
    const args = parts.slice(1).join(' ');

    await handleTelegramWebhookCommandVps({ token, chatId, text, command, args, now: new Date() });
    return reply.code(200).send({ ok: true });
  } catch (err) {
    console.error('[telegram-webhook] error:', err?.message || err);
    return reply.code(200).send({ ok: true });
  }
}

function isAuthorizedCronDispatcherRequestVps(request) {
  const cronSecret = String(process.env.CRON_SECRET || process.env.SYNC_SECRET || '').trim();
  if (!cronSecret) return false;
  const authHeader = String(request.headers.authorization || '');
  const headerSecret = String(request.headers['x-cron-secret'] || request.headers['x-sync-key'] || request.headers['x-api-key'] || '').trim();
  return authHeader === `Bearer ${cronSecret}` || headerSecret === cronSecret;
}

function cronDispatcherFirstRowVps(rows) {
  return Array.isArray(rows) ? rows[0] || null : null;
}

function parseCronDispatcherTemplatesVps(settings) {
  const templates = settings?.templates;
  if (Array.isArray(templates)) return templates;
  if (typeof templates === 'string' && templates.trim()) {
    try {
      const parsed = JSON.parse(templates);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatCronDispatcherMoneyVps(value) {
  const numeric = Number(value) || 0;
  return `R$ ${numeric.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function cronDispatcherSaoPauloDayRangeVps(now) {
  const start = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function nlDbCronDispatcherVps(value) {
  return String(value || '').replace(/\\n/g, '\n');
}

function safeMarkdownCronDispatcherVps(value) {
  return nlDbCronDispatcherVps(value).replace(/[*_`[\]]/g, (char) => (char === '_' ? ' ' : ''));
}

function buildCronDispatcherScheduleTextVps(slots = []) {
  if (!Array.isArray(slots) || slots.length === 0) return 'Nenhum slot de Instagram cadastrado para a semana.';

  const dayNames = ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado'];
  const contentLabel = { story: 'Story', reels: 'Reels', carrossel: 'Carrossel', post: 'Post Feed' };
  const byDay = new Map();
  for (const slot of slots) {
    const day = Number(slot.day_of_week);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(slot);
  }

  let text = `PROGRAMACAO INSTAGRAM DA SEMANA\n${'='.repeat(28)}\n\n`;
  for (const [day, daySlots] of Array.from(byDay.entries()).sort((a, b) => a[0] - b[0])) {
    text += `${dayNames[day] || `Dia ${day}`}\n${'-'.repeat(22)}\n`;
    for (const slot of daySlots.sort((a, b) => String(a.scheduled_time || '').localeCompare(String(b.scheduled_time || '')))) {
      const time = String(slot.scheduled_time || '??:??').slice(0, 5);
      const label = contentLabel[slot.content_type] || slot.content_type || 'Conteudo';
      text += `\n${time} - ${label}\n`;
      if (slot.hook) text += `Hook: ${safeMarkdownCronDispatcherVps(slot.hook)}\n`;
      if (slot.caption) text += `Legenda: ${safeMarkdownCronDispatcherVps(slot.caption)}\n`;
      if (slot.cta) text += `CTA: ${safeMarkdownCronDispatcherVps(slot.cta)}\n`;
      if (slot.hashtags) text += `Hashtags: ${safeMarkdownCronDispatcherVps(slot.hashtags)}\n`;
      if (slot.visual_notes) text += `Visual: ${safeMarkdownCronDispatcherVps(slot.visual_notes)}\n`;
    }
    text += '\n';
  }

  if (text.length > 3800) return `${text.substring(0, 3700)}\n\n... [+${slots.length} posts. Ver agenda completa no admin]`;
  return `${text}Total: ${slots.length} posts planejados para a semana.`;
}

async function loadCronDispatcherCompanyVariablesVps() {
  try {
    const rows = await vpsDbSelect('company_settings', 'select=name,phone,email,social_instagram,business_hours,address_street,address_city,address_state,address_number,address_neighborhood&limit=1');
    const company = cronDispatcherFirstRowVps(rows);
    if (!company) return {};
    const address = [
      company.address_street,
      company.address_number,
      company.address_neighborhood,
      company.address_city,
      company.address_state,
    ].filter(Boolean).join(', ');
    return {
      '{empresa_nome}': company.name || '',
      '{empresa_telefone}': company.phone || '',
      '{empresa_whatsapp}': company.phone || '',
      '{empresa_email}': company.email || '',
      '{empresa_instagram}': company.social_instagram ? `@${String(company.social_instagram).replace(/^@/, '')}` : '',
      '{empresa_horario}': company.business_hours || '',
      '{empresa_endereco}': address,
    };
  } catch {
    return {};
  }
}

async function loadCronDispatcherSalesVariablesVps(now) {
  const { start, end } = cronDispatcherSaoPauloDayRangeVps(now);
  try {
    const query = `select=total,profit&status=eq.completed&created_at=gte.${encodeURIComponent(start.toISOString())}&created_at=lte.${encodeURIComponent(end.toISOString())}`;
    const sales = await vpsDbSelect('sales', query);
    const rows = Array.isArray(sales) ? sales : [];
    const faturamento = rows.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const lucroTotal = rows.reduce((sum, sale) => sum + (Number(sale.profit) || 0), 0);
    return {
      '{qtd_vendas}': String(rows.length),
      '{faturamento}': formatCronDispatcherMoneyVps(faturamento),
      '{lucro_total}': formatCronDispatcherMoneyVps(lucroTotal),
    };
  } catch {
    return {
      '{qtd_vendas}': '0',
      '{faturamento}': formatCronDispatcherMoneyVps(0),
      '{lucro_total}': formatCronDispatcherMoneyVps(0),
    };
  }
}

async function loadCronDispatcherStockVariablesVps() {
  try {
    const products = await vpsDbSelect('products', 'select=name,stock_quantity,specs,category_id,model_id,price_cost&status=eq.active&stock_quantity=gt.0');
    const rows = Array.isArray(products) ? products : [];
    const phoneWords = ['iphone', 'samsung', 'xiaomi', 'motorola', 'smartphone', 'galaxy', 'poco', 'redmi', 'realme'];
    let estoqueCelulares = 0;
    let estoqueGeral = 0;
    const grouped = new Map();

    for (const product of rows) {
      const qty = Number(product.stock_quantity) || 0;
      estoqueGeral += qty;
      const name = String(product.name || '');
      if (!phoneWords.some((word) => name.toLowerCase().includes(word))) continue;
      estoqueCelulares += qty;
      const specs = product.specs && typeof product.specs === 'object' ? product.specs : {};
      const color = specs.color || specs.cor || '';
      const ram = specs.ram || '';
      const storage = specs.storage || '';
      const memory = ram && storage ? `${ram}/${storage}` : (ram || storage);
      const variant = [color, memory].filter(Boolean).join(' - ');
      const key = variant ? `${name} - ${variant}` : name;
      const existing = grouped.get(key) || { qty: 0, costTotal: 0 };
      grouped.set(key, { qty: existing.qty + qty, costTotal: existing.costTotal + ((Number(product.price_cost) || 0) * qty) });
    }

    const list = Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, data]) => {
        const averageCost = data.qty > 0 ? data.costTotal / data.qty : 0;
        const cost = averageCost > 0 ? ` (${formatCronDispatcherMoneyVps(averageCost / 100)})` : '';
        return `- ${data.qty}x - ${name}${cost}`;
      });

    return {
      '{estoque_celulares}': String(estoqueCelulares),
      '{estoque_geral_loja}': String(estoqueGeral),
      '{estoque_lista_celulares}': list.length ? list.join('\n') : 'Nenhum celular em estoque.',
    };
  } catch {
    return {
      '{estoque_celulares}': '0',
      '{estoque_geral_loja}': '0',
      '{estoque_lista_celulares}': 'Nenhum celular em estoque.',
    };
  }
}

async function loadCronDispatcherInstagramScheduleVps() {
  try {
    const slots = await vpsDbSelect('instagram_schedule', 'select=*&active=eq.true&order=day_of_week.asc,scheduled_time.asc');
    return Array.isArray(slots) ? slots : [];
  } catch {
    return [];
  }
}

async function resolveCronDispatcherTagInlineVps(tag, now) {
  const cfg = tag?.resolver_config && typeof tag.resolver_config === 'object' ? tag.resolver_config : {};
  switch (tag?.resolver_type) {
    case 'static':
      return cfg.value ?? '';
    case 'date_now': {
      const options = cfg.format === 'time'
        ? { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }
        : cfg.format === 'datetime'
          ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }
          : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' };
      return new Intl.DateTimeFormat('pt-BR', options).format(now);
    }
    case 'count_products': {
      const status = cfg.status ? `&status=eq.${encodeURIComponent(cfg.status)}` : '';
      const minStock = cfg.min_stock != null ? `&stock_quantity=gt.${encodeURIComponent(Number(cfg.min_stock) - 1)}` : '';
      const products = await vpsDbSelect('products', `select=id${status}${minStock}`);
      return String(Array.isArray(products) ? products.length : 0);
    }
    case 'sum_products_stock': {
      const status = cfg.status ? `&status=eq.${encodeURIComponent(cfg.status)}` : '';
      const products = await vpsDbSelect('products', `select=stock_quantity${status}`);
      return String((Array.isArray(products) ? products : []).reduce((sum, product) => sum + (Number(product.stock_quantity) || 0), 0));
    }
    case 'list_products': {
      const limit = Number(cfg.limit || 30);
      const format = cfg.format || '- {qty}x - {name} - {color} - {ram}/{storage}';
      const rows = await vpsDbSelect('products', 'select=name,stock_quantity,specs,price_pix,price_card&status=eq.active&stock_quantity=gt.0');
      const products = Array.isArray(rows) ? rows : [];
      if (!products.length) return 'Nenhum item em estoque.';
      const phoneWords = ['iphone', 'samsung', 'xiaomi', 'motorola', 'galaxy', 'poco', 'redmi', 'smartphone'];
      const filtered = cfg.category_slug === 'celulares'
        ? products.filter((product) => phoneWords.some((word) => String(product.name || '').toLowerCase().includes(word)))
        : products;
      const grouped = new Map();
      for (const product of filtered) {
        const specs = product.specs && typeof product.specs === 'object' ? product.specs : {};
        const key = `${product.name || ''}||${specs.color || ''}||${specs.ram || ''}||${specs.storage || ''}`;
        const existing = grouped.get(key);
        if (existing) existing.qty += Number(product.stock_quantity) || 0;
        else grouped.set(key, { qty: Number(product.stock_quantity) || 0, product });
      }
      const lines = Array.from(grouped.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, limit)
        .map(({ qty, product }) => {
          const specs = product.specs && typeof product.specs === 'object' ? product.specs : {};
          const values = {
            qty: String(qty),
            name: product.name || '',
            color: specs.color || '',
            ram: specs.ram || '',
            storage: specs.storage || '',
            avg_price: product.price_pix ? formatCronDispatcherMoneyVps(Number(product.price_pix) / 100) : '',
            price_pix: product.price_pix ? formatCronDispatcherMoneyVps(Number(product.price_pix) / 100) : '',
            price_card: product.price_card ? formatCronDispatcherMoneyVps(Number(product.price_card) / 100) : '',
          };
          let line = format;
          for (const [key, value] of Object.entries(values)) line = line.split(`{${key}}`).join(value);
          return line;
        });
      return lines.length ? lines.join('\n') : 'Nenhum item em estoque.';
    }
    case 'count_sales_today': {
      const { start, end } = cronDispatcherSaoPauloDayRangeVps(now);
      const status = cfg.status ? `&status=eq.${encodeURIComponent(cfg.status)}` : '';
      const rows = await vpsDbSelect('sales', `select=id&created_at=gte.${encodeURIComponent(start.toISOString())}&created_at=lte.${encodeURIComponent(end.toISOString())}${status}`);
      return String(Array.isArray(rows) ? rows.length : 0);
    }
    case 'sum_sales_today': {
      const { start, end } = cronDispatcherSaoPauloDayRangeVps(now);
      const field = String(cfg.field || 'total').replace(/[^a-zA-Z0-9_]/g, '') || 'total';
      const status = cfg.status ? `&status=eq.${encodeURIComponent(cfg.status)}` : '';
      const rows = await vpsDbSelect('sales', `select=${field}&created_at=gte.${encodeURIComponent(start.toISOString())}&created_at=lte.${encodeURIComponent(end.toISOString())}${status}`);
      const total = (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
      return formatCronDispatcherMoneyVps(total);
    }
    default:
      return tag?.preview_value || `{${tag?.name || ''}}`;
  }
}

async function loadCronDispatcherCustomTagVariablesVps(now) {
  try {
    const tags = await vpsDbSelect('system_tags', 'select=*&active=eq.true&resolver_type=neq.system_injected');
    const dict = {};
    for (const tag of Array.isArray(tags) ? tags : []) {
      try {
        dict[`{${tag.name}}`] = await resolveCronDispatcherTagInlineVps(tag, now);
      } catch {
        // Keep dispatch resilient when one custom tag fails.
      }
    }
    return dict;
  } catch {
    return {};
  }
}

async function sendCronDispatcherTelegramMessageVps(settings, text, extra = {}) {
  const response = await fetch(`https://api.telegram.org/bot${settings.bot_token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: settings.chat_id, text, ...extra }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Telegram send failed: ${response.status} ${errorText.slice(0, 200)}`);
  }
}

function applyCronDispatcherTemplateVariablesVps(content, dict) {
  let message = String(content || '');
  for (const [key, value] of Object.entries(dict)) message = message.split(key).join(value || '');
  if (message.length > 4000) return `${message.substring(0, 3900)}\n\n... [mensagem truncada]`;
  return message;
}

async function maybeSendCronDispatcherInstagramReminderVps(settings, now, hour) {
  if (hour !== '08') return false;
  const weekdayName = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(now);
  const dayMap = {
    domingo: 0,
    'segunda-feira': 1,
    'terca-feira': 2,
    'terça-feira': 2,
    'quarta-feira': 3,
    'quinta-feira': 4,
    'sexta-feira': 5,
    sabado: 6,
    'sábado': 6,
  };
  const dayOfWeek = dayMap[weekdayName.toLowerCase()];
  if (dayOfWeek === undefined) return false;

  const rows = await vpsDbSelect('instagram_schedule', `select=*&day_of_week=eq.${dayOfWeek}&active=eq.true&send_telegram_reminder=eq.true&order=scheduled_time.asc`);
  const slots = Array.isArray(rows) ? rows : [];
  if (!slots.length) return false;

  const label = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);
  let message = `Cronograma Instagram - ${label}\nSeu guia completo de conteudo para hoje.\n${'-'.repeat(30)}\n\n`;
  const contentLabel = { story: 'Story', reels: 'Reels', carrossel: 'Carrossel', post: 'Post Feed' };
  for (const slot of slots) {
    const time = String(slot.scheduled_time || '??:??').slice(0, 5);
    message += `${time} - ${contentLabel[slot.content_type] || slot.content_type || 'Conteudo'}\n`;
    if (slot.hook) message += `Hook: ${nlDbCronDispatcherVps(slot.hook)}\n\n`;
    if (slot.caption) message += `Legenda pronta:\n${nlDbCronDispatcherVps(slot.caption)}\n\n`;
    if (slot.cta) message += `CTA: ${nlDbCronDispatcherVps(slot.cta)}\n`;
    if (slot.hashtags) message += `${slot.hashtags}\n`;
    if (slot.visual_notes) message += `Visual: ${slot.visual_notes}\n`;
    message += `\n${'-'.repeat(30)}\n\n`;
  }
  message += `${slots.length} post(s) planejado(s) para hoje.\nAcesse o Estudio de Marketing para gerar as artes.`;
  await sendCronDispatcherTelegramMessageVps(settings, message, { parse_mode: 'Markdown' });
  return true;
}

async function handleCronDispatcherVps(request, reply) {
  if (!String(process.env.CRON_SECRET || process.env.SYNC_SECRET || '').trim()) {
    return reply.code(503).send({ error: 'Cron secret not configured' });
  }
  if (!isAuthorizedCronDispatcherRequestVps(request)) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  try {
    const rows = await vpsDbSelect('telegram_settings', 'select=*&limit=1');
    const settings = cronDispatcherFirstRowVps(rows);
    const hasConfiguredTelegramCredential = !!settings?.bot_token;
    if (!settings || !settings.active || !settings.bot_token || !settings.chat_id) {
      return reply.code(200).send({
        message: 'Telegram integration inactive or not fully configured',
        debug: buildCopyableDebug('cron-dispatcher', {
          hasSettings: !!settings,
          isActive: !!settings?.active,
          hasTelegramCredential: hasConfiguredTelegramCredential,
          hasChatId: !!settings?.chat_id,
        }),
      });
    }

    const templates = parseCronDispatcherTemplatesVps(settings);
    if (!templates.length) return reply.code(200).send({ message: 'No templates configured' });

    const now = new Date();
    const timeParts = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).formatToParts(now);
    const hour = timeParts.find((part) => part.type === 'hour')?.value || '00';
    const currentHourPrefix = `${hour}:`;
    const forceTemplateId = request.query?.forceTemplateId || request.body?.forceTemplateId;

    const scheduledTemplates = templates.filter((template) => {
      if (forceTemplateId) return String(template.id) === String(forceTemplateId);
      return template.type === 'scheduled' && String(template.schedule_time || '').startsWith(currentHourPrefix);
    });
    if (!scheduledTemplates.length) {
      return reply.code(200).send({ message: forceTemplateId ? 'Template nao encontrado.' : `No templates scheduled for hour ${hour}` });
    }

    const instagramSlots = await loadCronDispatcherInstagramScheduleVps();
    const dateText = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(now);
    const dict = {
      ...(await loadCronDispatcherCompanyVariablesVps()),
      ...(await loadCronDispatcherSalesVariablesVps(now)),
      ...(await loadCronDispatcherStockVariablesVps()),
      '{data}': dateText,
      '{agenda_instagram_semana}': buildCronDispatcherScheduleTextVps(instagramSlots),
      ...(await loadCronDispatcherCustomTagVariablesVps(now)),
    };

    let dispatched = 0;
    for (const template of scheduledTemplates) {
      const message = applyCronDispatcherTemplateVariablesVps(template.content, dict);
      try {
        await sendCronDispatcherTelegramMessageVps(settings, message);
        dispatched += 1;
      } catch (err) {
        console.error('[cron-dispatcher] Failed to send template:', template.name || template.id, err.message);
      }
    }

    let instagramReminderSent = false;
    try {
      instagramReminderSent = await maybeSendCronDispatcherInstagramReminderVps(settings, now, hour);
    } catch (err) {
      console.error('[cron-dispatcher] Failed to send Instagram reminder:', err.message);
    }

    return reply.code(200).send({
      success: true,
      message: `Cron ran successfully. Dispatched ${dispatched} templates.`,
      dispatched,
      instagramReminderSent,
    });
  } catch (err) {
    console.error('[cron-dispatcher] fatal error', err);
    return reply.code(500).send({ error: err.message || 'Cron dispatcher failed' });
  }
}

fastify.all('/api/bling-webhook', handleBlingWebhookVps);
fastify.all('/api/bling', handleBlingApiVps);
fastify.get('/api/auth/callback/bling', handleBlingOAuthCallbackVps);
fastify.all('/api/shopee', handleShopeeOAuthVps);
fastify.all('/api/shopee-webhook', handleShopeeWebhookVps);
fastify.all('/api/shopee-catalog', handleShopeeCatalogVps);
fastify.all('/api/shopee-actions', handleShopeeActionsVps);
fastify.all('/api/cron-dispatcher', handleCronDispatcherVps);
fastify.all('/api/telegram-webhook', handleTelegramWebhookVps);

function escapeSitemapXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isLocalSitemapHost(host) {
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(String(host || ''));
}

function buildSitemapBaseUrl(request) {
  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const rawProtocol = forwardedProto || 'https';
  const host = forwardedHost || request.headers.host || 'mercadodovale.com.br';
  const protocol = rawProtocol === 'http' && isLocalSitemapHost(host) ? 'http' : 'https';
  return `${protocol}://${host}`;
}

function formatSitemapDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
  return date.toISOString().split('T')[0];
}

function stripSeoHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function escapeSeoHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSeoBaseUrl(request) {
  return buildSitemapBaseUrl(request);
}

function normalizeSeoImages(images) {
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch {
      images = [];
    }
  }
  return Array.isArray(images) ? images.filter(Boolean) : [];
}

function isSeoPublicImageUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || /^data:/i.test(trimmed)) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizeSeoPublicImages(images, baseUrl) {
  const normalized = [];
  for (const rawImage of normalizeSeoImages(images)) {
    const image = String(rawImage || '').trim();
    const publicImage = image.startsWith('/') ? `${baseUrl}${image}` : image;
    if (isSeoPublicImageUrl(publicImage)) normalized.push(publicImage);
  }
  return [...new Set(normalized)];
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ''));
}

async function loadSeoProductBySlug(slug) {
  const select = `SELECT id, name, description, meta_title, meta_description, keywords, images,
      price_retail, stock_quantity, sku, slug, status, is_parent, exclude_from_seo,
      ${comboStockSql('products')} AS computed_stock_quantity
     FROM products`;
  const filter = `AND name IS NOT NULL
       AND name != ''
       AND (status IN ('active', 'Ativo') OR status IS NULL)
       AND (is_parent = 0 OR is_parent IS NULL)
       AND (exclude_from_seo = 0 OR exclude_from_seo IS NULL)`;

  let [rows] = await pool.query(
    `${select}
     WHERE slug = ?
       ${filter}
     LIMIT 1`,
    [slug]
  );

  if (!rows.length && isUuidLike(slug)) {
    [rows] = await pool.query(
      `${select}
       WHERE id = ?
         ${filter}
       LIMIT 1`,
      [slug]
    );
  }

  return rows[0] || null;
}

function readSeoIndexHtml() {
  const candidates = [
    process.env.VPS_SITE_INDEX_HTML,
    process.env.VPS_SITE_ROOT ? path.join(process.env.VPS_SITE_ROOT, 'current', 'index.html') : '',
    '/var/www/mdv-site/current/index.html',
    path.join(__dirname, 'dist', 'index.html'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf8');
    } catch {
      // Try the next local candidate.
    }
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mercado do Vale</title>
  </head>
  <body>
    <div id="root">Carregando...</div>
  </body>
</html>`;
}

function normalizeSeoKeywords(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function formatSeoPrice(value) {
  const numeric = Number(value || 0) / 100;
  if (!Number.isFinite(numeric) || numeric <= 0) return '0.00';
  return numeric.toFixed(2);
}

function removeExistingSeoHeadTags(html) {
  return String(html || '')
    .replace(/<!--\s*(Open Graph|Twitter Card|Google Shopping)[\s\S]*?-->/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta[^>]*name=["']description["'][^>]*>/gi, '')
    .replace(/<meta[^>]*name=["']keywords["'][^>]*>/gi, '')
    .replace(/<link[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta[^>]*property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<meta[^>]*name=["']twitter:[^"']+["'][^>]*>/gi, '');
}

fastify.get('/api/seo-produto', async (request, reply) => {
  const slug = String(request.query?.slug || '').trim();
  if (!slug) {
    return reply.redirect('/');
  }

  try {
    const baseHtml = readSeoIndexHtml();
    const product = await loadSeoProductBySlug(slug);

    if (!product) {
      return reply
        .header('Content-Type', 'text/html; charset=utf-8')
        .header('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
        .code(200)
        .send(baseHtml);
    }

    const baseUrl = buildSeoBaseUrl(request);
    const publicImages = normalizeSeoPublicImages(product.images, baseUrl);
    const keywords = normalizeSeoKeywords(product.keywords || product.seo_keywords);
    const title = product.meta_title || `${product.name} | Mercado do Vale`;
    const cleanDescription = stripSeoHtml(product.meta_description || product.description || '');
    const description = cleanDescription.slice(0, 155) || `Compre ${product.name} no Mercado do Vale com o melhor preco.`;
    const canonicalSlug = product.slug || slug;
    const url = `${baseUrl}/produto/${encodeURIComponent(canonicalSlug)}`;
    const image = publicImages[0] || `${baseUrl}/og-cover.jpg`;
    const stockQuantity = product.computed_stock_quantity ?? product.stock_quantity ?? 0;
    const availability = Number(stockQuantity) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
    const schemaProduct = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: product.name || '',
      image: publicImages.length ? publicImages.slice(0, 5) : [image],
      description,
      sku: product.sku || '',
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: 'BRL',
        price: formatSeoPrice(product.price_retail),
        availability,
        itemCondition: 'https://schema.org/NewCondition',
      },
    };
    const schemaBreadcrumb = {
      '@context': 'https://schema.org/',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
        { '@type': 'ListItem', position: 2, name: 'Produtos', item: `${baseUrl}/catalog` },
        { '@type': 'ListItem', position: 3, name: product.name || title, item: url },
      ],
    };

    const safeTitle = escapeSeoHtml(title);
    const safeDescription = escapeSeoHtml(description);
    const safeImage = escapeSeoHtml(image);
    const metaTags = `
    <!-- SEO Injetado via VPS Fastify (seo-produto) -->
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    ${keywords.length ? `<meta name="keywords" content="${escapeSeoHtml(keywords.join(', '))}" />` : ''}
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="product" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:secure_url" content="${safeImage}" />
    <meta property="og:site_name" content="Mercado do Vale" />
    <meta property="og:locale" content="pt_BR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${url}" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImage}" />
    <script type="application/ld+json">${JSON.stringify(schemaProduct)}</script>
    <script type="application/ld+json">${JSON.stringify(schemaBreadcrumb)}</script>
    <!-- Fim SEO seo-produto -->
`;

    const finalHtml = removeExistingSeoHeadTags(baseHtml)
      .replace('<head>', `<head>\n${metaTags}`);

    return reply
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
      .code(200)
      .send(finalHtml);
  } catch (err) {
    return reply.code(500).send({
      error: 'Failed to generate product SEO HTML',
      debug: buildCopyableDebug('seo-produto', {
        step: 'render product seo',
        slug,
        rawMessage: err.message,
      }),
    });
  }
});

fastify.get('/api/sitemap', async (request, reply) => {
  try {
    const [products] = await pool.query(
      `SELECT slug, MAX(updated_at) AS updated_at
       FROM products
       WHERE slug IS NOT NULL
         AND slug != ''
         AND name IS NOT NULL
         AND name != ''
         AND (status IN ('active', 'Ativo') OR status IS NULL)
         AND (is_parent = 0 OR is_parent IS NULL)
         AND (exclude_from_seo = 0 OR exclude_from_seo IS NULL)
       GROUP BY slug
       ORDER BY updated_at DESC
       LIMIT 5000`
    );

    const baseUrl = buildSitemapBaseUrl(request);
    const productUrls = products.map((product) => `    <url>
        <loc>${escapeSitemapXml(`${baseUrl}/produto/${product.slug}`)}</loc>
        <lastmod>${formatSitemapDate(product.updated_at)}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
    </url>`).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${escapeSitemapXml(`${baseUrl}/`)}</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${escapeSitemapXml(`${baseUrl}/quem-somos`)}</loc>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${escapeSitemapXml(`${baseUrl}/faq`)}</loc>
        <changefreq>monthly</changefreq>
        <priority>0.5</priority>
    </url>
${productUrls}
</urlset>`;

    return reply
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
      .code(200)
      .send(xml.trim());
  } catch (err) {
    return reply.code(500).send({
      error: 'Failed to generate sitemap',
      debug: buildCopyableDebug('sitemap', {
        step: 'query products',
        rawMessage: err.message,
      }),
    });
  }
});

fastify.get('/api/mercadopago-webhook', async () => ({ ok: true, mode: 'vps-fastify', accepts: 'POST' }));

fastify.post('/api/mercadopago-webhook', async (request, reply) => {
  if (!isMercadoPagoWebhookPayload(request.body)) {
    return reply.code(200).send({ message: 'ignored', reason: 'not payment webhook' });
  }

  const result = await handleMercadoPagoWebhookVps(request.body);
  return reply.code(result.status).send(result.body);
});

fastify.all('/api/vps-proxy', async (request, reply) => {
  if (request.query?.brasilapi === 'ncm') {
    return handleBrasilapiNcmProxy(request, reply);
  }

  const method = String(request.method || 'GET').toUpperCase();
  const vpsProxyTargetPath = normalizeVpsProxyPath(request.query?.path);
  if (!vpsProxyTargetPath) {
    return reply.code(400).send({ error: 'Missing or invalid query param: path' });
  }

  const auth = await getVpsBearerAuthContext(request);
  const isWrite = method !== 'GET' && method !== 'HEAD';
  const isPublicPath = isVpsProxyPublicPath(vpsProxyTargetPath, method);
  const favoritesCustomerId = extractVpsProxyFavoritesCustomerId(vpsProxyTargetPath);

  if (favoritesCustomerId) {
    if (!auth.userId) return reply.code(401).send({ error: 'Auth required' });
    if (!auth.isAdmin && auth.customerId !== favoritesCustomerId) {
      return reply.code(403).send({ error: 'Forbidden for this customer' });
    }
  } else if (vpsProxyTargetPath === '/cart/sync') {
    if (!auth.userId) return reply.code(401).send({ error: 'Auth required' });
    const bodyCustomerId = request.body?.customerId ? String(request.body.customerId) : null;
    if (!auth.isAdmin && (!bodyCustomerId || auth.customerId !== bodyCustomerId)) {
      return reply.code(403).send({ error: 'Forbidden for this customer' });
    }
  } else if (!isPublicPath && (isWrite || isVpsProxySensitiveGetPath(vpsProxyTargetPath)) && !auth.isAdmin) {
    return reply.code(403).send({ error: 'Admin required' });
  }

  const needsInternalSyncKey = !isPublicPath || isVpsProxyPublicTableDataReadPath(vpsProxyTargetPath.split('?')[0] || '/');
  if (needsInternalSyncKey && !process.env.SYNC_SECRET) {
    return reply.code(500).send({ error: 'SYNC_SECRET not configured on server' });
  }

  const headers = {
    accept: String(request.headers.accept || 'application/json'),
  };
  const contentType = request.headers['content-type'];
  if (contentType) headers['content-type'] = String(contentType);
  if (needsInternalSyncKey) headers['x-sync-key'] = process.env.SYNC_SECRET;

  const response = await fastify.inject({
    method,
    url: vpsProxyTargetPath,
    headers,
    payload: buildVpsProxyPayload(request),
  });

  reply.code(response.statusCode);
  const responseContentType = response.headers['content-type'];
  if (responseContentType) reply.header('content-type', responseContentType);
  const cacheControl = response.headers['cache-control'];
  if (cacheControl) reply.header('cache-control', cacheControl);
  return reply.send(response.rawPayload);
});

const jsonStr = (v) => v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));
const optionalBool = (v) => v == null ? null : (v ? 1 : 0);

// Rejeita descrições obviamente inválidas que aparecem em alguns paths de save
// (ex.: '0', '<p>0</p>', strings só com dígitos/espaços, <5 chars úteis).
// Retorna null para essas; preserva o valor caso seja descrição real.
function sanitizeDescription(v) {
  if (v == null) return null;
  if (typeof v !== 'string') return null;
  const text = v.replace(/<[^>]+>/g, '').trim();
  if (!text) return null;
  if (text.length < 5) return null;
  if (/^[0-9\s]+$/.test(text)) return null;
  return v;
}
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

const AUTORESPONDER_AUDIO_UNSUPPORTED_REPLY = 'Recebi seu áudio, mas ainda não consigo ouvir por aqui. Pode me mandar em texto?';

function normalizeAutoresponderResponseToneMode(value) {
  const mode = String(value || 'auto_abc').trim().toLowerCase();
  return ['a', 'b', 'c', 'auto_abc'].includes(mode) ? mode : 'auto_abc';
}

function normalizeAutoresponderAttendantName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAutoresponderStableToneKey(sender = '') {
  const text = String(sender || '');
  let total = 0;
  for (let index = 0; index < text.length; index += 1) {
    total = (total + text.charCodeAt(index) * (index + 1)) % 9973;
  }
  return ['a', 'b', 'c'][total % 3];
}

function selectAutoresponderResponseTone(settings = null, sender = '') {
  const mode = normalizeAutoresponderResponseToneMode(settings?.response_tone_mode);
  if (mode === 'auto_abc') return getAutoresponderStableToneKey(sender);
  return mode;
}

function getAutoresponderToneMessage(settings = null, sender = '', key = '', fallback = '') {
  const toneKey = selectAutoresponderResponseTone(settings, sender);
  return AUTORESPONDER_RESPONSE_TONE_VARIANTS[toneKey]?.[key] || fallback || '';
}

function getAutoresponderFixedToneMessage(settings = null, sender = '', key = '', configuredValue = '', defaultValue = '') {
  const configured = String(configuredValue || '').trim();
  if (configured && configured !== defaultValue) return configured;
  return getAutoresponderToneMessage(settings, sender, key, defaultValue);
}

function isAutoresponderAudioMessage(message) {
  const raw = String(message || '').trim();
  if (!raw) return false;
  const text = normalizeAutoresponderText(raw)
    .replace(/[^\w\s\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const withoutBrackets = text.replace(/^\[|\]$/g, '').trim();
  const exactPlaceholders = new Set([
    'audio',
    'audio message',
    'mensagem de audio',
    'mensagem de voz',
    'voice message',
    'ptt',
  ]);
  if (exactPlaceholders.has(withoutBrackets)) return true;
  return withoutBrackets.length <= 80
    && /\b(audio message|mensagem de audio|mensagem de voz|voice message|ptt)\b/.test(withoutBrackets);
}

function collectAutoresponderPayloadStrings(value, depth = 0) {
  if (depth > 3 || value == null) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectAutoresponderPayloadStrings(item, depth + 1));
  }
  if (typeof value !== 'object') return [];

  const strings = [];
  const directKeys = [
    'type',
    'messageType',
    'message_type',
    'mediaType',
    'media_type',
    'mimetype',
    'mimeType',
    'mime_type',
    'contentType',
    'content_type',
    'kind',
    'event',
    'ptt',
    'audio',
    'voice',
    'media',
    'fileName',
    'filename',
  ];
  for (const key of directKeys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      strings.push(String(value[key]));
    }
  }

  const nestedKeys = ['message', 'audioMessage', 'mediaMessage', 'data', 'payload', 'media', 'file', 'document'];
  for (const key of nestedKeys) {
    if (value[key] && typeof value[key] === 'object') {
      strings.push(...collectAutoresponderPayloadStrings(value[key], depth + 1));
    }
  }
  return strings;
}

function isAutoresponderAudioPayload(payload, message = '') {
  if (isAutoresponderAudioMessage(message)) return true;
  const text = normalizeAutoresponderText(collectAutoresponderPayloadStrings(payload).join(' '));
  if (!text) return false;
  return /\b(audio|ptt|voice|voicenote|audiomessage|mensagem de audio|mensagem de voz)\b/.test(text)
    || text.includes('audio/');
}

function isAutoresponderHumanRequest(message) {
  const text = normalizeAutoresponderText(message);
  return /\b(humano|atendente|pessoa|vendedor|gerente|especialista)\b/.test(text)
    || text.includes('falar com alguem')
    || text.includes('pessoa real')
    || text.includes('atendimento humano');
}

function isAutoresponderStoreStatusRequest(message) {
  const text = normalizeAutoresponderText(message)
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return false;
  const mentionsStore = /\b(loja|voces|voce|atendimento|mercado do vale)\b/.test(text);
  const mentionsHours = /\b(horario|funcionamento|abre|abrem|abrir|aberto|aberta|fechado|fechada|fecha|fecham|expediente)\b/.test(text);
  if (mentionsHours && (mentionsStore || /\b(esta|ta|tá|estao|estao|ainda|hoje|agora)\b/.test(text))) return true;
  return /^(esta|ta|tá|estao|estao) (aberto|aberta|fechado|fechada)( agora)?$/.test(text);
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

function getAutoresponderContactFirstNameFromName(name) {
  const cleanName = normalizeAutoresponderContactName(name);
  const firstName = cleanName.split(' ')[0] || '';
  return firstName.length >= 2 ? firstName : cleanName;
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
  const firstName = getAutoresponderContactFirstNameFromName(name);
  await pool.query(
    `INSERT INTO autoresponder_conversations
      (sender, last_message_at, contact_name, contact_name_status, contact_name_confirmed, google_contact_resource_name, contact_name_updated_at)
     VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       contact_name = ?,
       contact_name_status = ?,
       contact_name_confirmed = ?,
       google_contact_resource_name = ?,
       contact_name_updated_at = CURRENT_TIMESTAMP`,
    [sender, firstName || name, status, name, googleResult?.resourceName || null, firstName || name, status, name, googleResult?.resourceName || null]
  );
}

function formatAutoresponderContactSavedReply(name, googleResult) {
  const firstName = getAutoresponderContactFirstNameFromName(name);
  if (googleResult?.ok) {
    return `Perfeito, ${firstName}! Vou salvar seu contato aqui. ✅`;
  }
  return `Perfeito, ${firstName}! Vou deixar seu contato salvo aqui. ✅`;
}

function formatAutoresponderContactFollowUpReply() {
  return 'Em que posso ajudar voce hoje? ✨';
}

function isAutoresponderInvalidContactNameReply(message) {
  return isAutoresponderYes(message)
    || isAutoresponderNo(message)
    || isAutoresponderExplicitCatalogListRequest(message)
    || isAutoresponderStandaloneDeliveryQuoteRequest(message)
    || normalizeAutoresponderCep(message);
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
    if (isAutoresponderInvalidContactNameReply(message) || typedName.length < 2 || typedName.split(' ').length > 5) {
      return 'Me envie apenas o nome que devo colocar no seu contato, por favor. 😊';
    }
    return confirmAutoresponderContactName(sender, typedName);
  }

  return null;
}

function getAutoresponderGreetingPeriod(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false,
  }).format(now));
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
}

function sanitizeBlingOAuthErrorMessage(data) {
  const raw = data?.error?.description || data?.error_description || data?.message || data?.error || 'Bling token exchange failed';
  return String(raw)
    .replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]')
    .slice(0, 180);
}

function isAutoresponderDefaultGreetingFlowMessage(value) {
  const text = normalizeAutoresponderText(value).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return text === 'bom dia seja bem vindo ao mercado do vale como posso ajudar voce hoje';
}

function getAutoresponderGreetingReply(message, contactFirstName = '', settings = null) {
  const customGreeting = getAutoresponderConversationFlowMessage(settings, 'greeting_reply', '');
  if (customGreeting && !isAutoresponderDefaultGreetingFlowMessage(customGreeting)) return customGreeting;
  const period = getAutoresponderGreetingPeriod();
  const greeting = period === 'morning'
    ? 'Bom dia'
    : period === 'afternoon'
      ? 'Boa tarde'
      : 'Boa noite';
  const emoji = period === 'night' ? '🌙' : '✨';
  const firstName = getAutoresponderContactFirstNameFromName(contactFirstName);
  const nameText = firstName ? `, ${firstName}` : '';
  return `${greeting}${nameText}! 😊 Seja bem-vindo ao Mercado do Vale.\nComo posso ajudar voce hoje? ${emoji}`;
}

function getAutoresponderSignatureMessage(settings) {
  if (settings?.signature_enabled === 0 || settings?.signature_enabled === false) return '';
  return String(settings?.signature_message || AUTORESPONDER_DEFAULT_SIGNATURE_MESSAGE).trim();
}

function applyAutoresponderGreetingPrefix(replyText, settings, shouldPrefixGreeting) {
  const text = String(replyText || '').trim();
  const prefix = String(settings?.greeting_prefix || '').trim();
  if (!shouldPrefixGreeting || !prefix || text.startsWith(prefix)) return text;
  return `${prefix}\n\n${text}`;
}

function appendAutoresponderSignatureMessage(replyText, settings) {
  const text = String(replyText || '').trim();
  const signature = getAutoresponderSignatureMessage(settings);
  if (!text || !signature || text.includes(signature)) return text;
  return `${text}\n\n${signature}`;
}

function formatAutoresponderReply(replyText, settings, shouldPrefixGreeting) {
  return appendAutoresponderSignatureMessage(
    applyAutoresponderGreetingPrefix(replyText, settings, shouldPrefixGreeting),
    settings
  );
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
    `SELECT id, match_type, pattern, reply_type, reply_text, reply_tag_id, reply_search_query, next_state, attachment_url, attachment_caption, auto_apply_tag_id
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

const AUTORESPONDER_DEFAULT_CONVERSATION_FLOW_KEYWORDS = {
  phone_list_opt_in: ['sim', 'quero', 'manda', 'pode mandar', 'lista', 'quero ver', 'manda lista'],
};

const AUTORESPONDER_DEFAULT_CONVERSATION_FLOW_MESSAGES = {
  greeting_reply: 'Bom dia! Seja bem-vindo ao Mercado do Vale. Como posso ajudar voce hoje?',
  phone_list_prompt: AUTORESPONDER_NEEDS_PROMPT_FALLBACK,
  phone_list_reply: 'Encontrei estas opcoes para celulares:',
  name_prompt: 'Qual seu nome para seguirmos com o atendimento?',
  product_choice_prompt: 'Responda com o numero da opcao ou com o nome/modelo do produto.',
  fulfillment_prompt: 'Agora preciso confirmar se sera retirada na loja ou entrega.',
  delivery_cep_prompt: 'Combinado: entrega. Me envie o CEP da entrega. Pode mandar somente os numeros.',
  pickup_reply: 'Combinado: retirada na loja. Agora vamos combinar a forma de pagamento.',
  payment_prompt: 'Como prefere pagar? Pix, dinheiro, debito ou cartao de credito?',
  human_handoff_reply: 'Vou chamar nossa equipe para continuar seu atendimento por aqui.',
};

function normalizeAutoresponderConversationFlowKeywords(value) {
  const parsed = parsePublicJson(value, value && typeof value === 'object' ? value : {});
  const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  const normalized = {};
  for (const [flowKey, defaults] of Object.entries(AUTORESPONDER_DEFAULT_CONVERSATION_FLOW_KEYWORDS)) {
    const rawValues = Object.prototype.hasOwnProperty.call(source, flowKey) ? source[flowKey] : defaults;
    const values = Array.isArray(rawValues) ? rawValues : String(rawValues || '').split(',');
    normalized[flowKey] = [...new Set(values
      .map((keyword) => normalizeAutoresponderText(keyword).trim())
      .filter(Boolean))];
  }
  return normalized;
}

function normalizeAutoresponderConversationFlowMessages(value) {
  const parsed = parsePublicJson(value, value && typeof value === 'object' ? value : {});
  const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  const normalized = {};
  for (const [messageKey, fallback] of Object.entries(AUTORESPONDER_DEFAULT_CONVERSATION_FLOW_MESSAGES)) {
    const rawValue = Object.prototype.hasOwnProperty.call(source, messageKey) ? source[messageKey] : fallback;
    normalized[messageKey] = String(rawValue || fallback).trim();
  }
  return normalized;
}

function getAutoresponderConversationFlowMessage(settings, messageKey, fallback = '') {
  const normalized = normalizeAutoresponderConversationFlowMessages(settings?.conversation_flow_messages);
  return normalized[messageKey] || fallback || AUTORESPONDER_DEFAULT_CONVERSATION_FLOW_MESSAGES[messageKey] || '';
}

function getAutoresponderConversationFlowKeywords(settings, flowKey) {
  const normalized = normalizeAutoresponderConversationFlowKeywords(settings?.conversation_flow_keywords);
  return normalized[flowKey] || [];
}

function doesAutoresponderMessageMatchFlowKeywords(message, keywords) {
  const text = normalizeAutoresponderText(message).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  return (Array.isArray(keywords) ? keywords : []).some((keyword) => {
    const normalizedKeyword = normalizeAutoresponderText(keyword).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    return normalizedKeyword && text === normalizedKeyword;
  });
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

function maskAutoresponderOpenAiKey(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  if (key.length <= 10) return '********';
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

function sanitizeAutoresponderSettings(row) {
  if (!row) return null;
  const openaiApiKey = String(row.openai_api_key || '').trim();
  const openaiAdminApiKey = String(row.openai_admin_api_key || process.env.OPENAI_ADMIN_KEY || process.env.OPENAI_ADMIN_API_KEY || '').trim();
  const { openai_api_key, ...safe } = row;
  const { openai_admin_api_key, ...publicSettings } = safe;
  return {
    ...publicSettings,
    has_openai_api_key: openaiApiKey.length > 0,
    openai_api_key_masked: maskAutoresponderOpenAiKey(openaiApiKey),
    has_openai_admin_api_key: openaiAdminApiKey.length > 0,
    openai_admin_api_key_masked: maskAutoresponderOpenAiKey(openaiAdminApiKey),
  };
}

const AUTORESPONDER_AI_TRAINING_TYPES = new Set([
  'store_instruction',
  'faq',
  'category_guidance',
  'policy',
]);

function normalizeAutoresponderAiTrainingType(value) {
  const type = String(value || 'store_instruction').trim();
  return AUTORESPONDER_AI_TRAINING_TYPES.has(type) ? type : 'store_instruction';
}

function sanitizeAutoresponderAiTrainingInput(body = {}, partial = false) {
  const input = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'title')) {
    input.title = String(body.title || '').trim();
    if (!input.title) throw new Error('Titulo do treinamento e obrigatorio');
    if (input.title.length > 120) throw new Error('Titulo deve ter no maximo 120 caracteres');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'training_type')) {
    input.training_type = normalizeAutoresponderAiTrainingType(body.training_type);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'keywords')) {
    input.keywords = String(body.keywords || '').trim();
    if (input.keywords.length > 1000) throw new Error('Palavras-chave devem ter no maximo 1000 caracteres');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'content')) {
    input.content = String(body.content || '').trim();
    if (!input.content) throw new Error('Conteudo do treinamento e obrigatorio');
    if (input.content.length > 8000) throw new Error('Conteudo deve ter no maximo 8000 caracteres');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'priority')) {
    const priority = Number(body.priority || 0);
    if (!Number.isFinite(priority)) throw new Error('Prioridade invalida');
    input.priority = Math.trunc(priority);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'active')) {
    input.active = boolInt(body.active);
  }

  return input;
}

async function loadActiveAutoresponderAiTraining(limit = 12) {
  const [rows] = await pool.query(
    `SELECT id, title, training_type, keywords, content, priority
     FROM autoresponder_ai_training
     WHERE active = 1
     ORDER BY priority DESC, id ASC
     LIMIT ?`,
    [Math.max(1, Math.min(Number(limit) || 12, 30))]
  );
  return rows;
}

function buildAutoresponderAiTrainingContext(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const lines = ['Treinamento adicional aprovado pelo Mercado do Vale:'];
  entries.forEach((entry, index) => {
    const keywords = String(entry.keywords || '').trim();
    lines.push(`${index + 1}. [${entry.training_type}] ${entry.title}`);
    if (keywords) lines.push(`   Palavras-chave: ${keywords}`);
    lines.push(`   Instrucao para IA: ${entry.content}`);
  });
  return lines.join('\n');
}

function normalizeAutoresponderAiConversationMemoryLimit(value) {
  const number = Number(value || 20);
  if ([10, 20, 30, 50].includes(number)) return number;
  return Math.max(1, Math.min(Math.round(number) || 20, 50));
}

function normalizeAutoresponderAiConversationMemoryDays(value) {
  const number = Number(value || 7);
  return Number.isFinite(number) ? Math.max(1, Math.min(Math.round(number), 90)) : 7;
}

async function loadAutoresponderAiConversationMemory({ sender, settings = null } = {}) {
  if (Number(settings?.ai_conversation_memory_enabled ?? 1) !== 1) return [];
  const senderKey = normalizeAutoresponderSender(sender) || String(sender || '').trim();
  if (!senderKey) return [];
  const limit = normalizeAutoresponderAiConversationMemoryLimit(settings?.ai_conversation_memory_limit);
  const days = normalizeAutoresponderAiConversationMemoryDays(settings?.ai_conversation_memory_days);
  const [rows] = await pool.query(
    `SELECT created_at, question, reply_text, intent, ai_assisted
     FROM autoresponder_logs
     WHERE sender = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY created_at DESC
     LIMIT ${limit}`,
    [senderKey, days]
  );
  return Array.isArray(rows) ? rows.reverse() : [];
}

function buildAutoresponderAiConversationMemoryContext(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const lines = ['Memoria recente desta conversa no WhatsApp:'];
  rows.forEach((row, index) => {
    const question = limitText(String(row?.question || '').trim(), 500) || '(sem texto)';
    const reply = limitText(String(row?.reply_text || '').trim(), 700);
    const intent = String(row?.intent || '').trim();
    const createdAt = row?.created_at ? String(row.created_at).slice(0, 19) : '';
    lines.push(`${index + 1}. ${createdAt ? `[${createdAt}] ` : ``}Cliente: ${question}`);
    if (reply) lines.push(`   Bot${intent ? ` (${intent})` : ``}: ${reply}`);
  });
  return lines.join('\n');
}

function getAutoresponderAiConfig(settings = null) {
  const settingsKey = String(settings?.openai_api_key || '').trim();
  const envKey = String(process.env.OPENAI_API_KEY || '').trim();
  const apiKey = settingsKey || envKey;
  const settingsEnabled = settings?.ai_enabled == null ? null : Number(settings.ai_enabled) === 1;
  const envEnabled = String(process.env.AUTORESPONDER_AI_ENABLED || '').trim() === '1';
  return {
    enabled: settingsEnabled == null ? envEnabled : settingsEnabled,
    apiKey,
    model: String(settings?.ai_model || process.env.AUTORESPONDER_AI_MODEL || 'gpt-5-nano').trim() || 'gpt-5-nano',
  };
}

function isAutoresponderAiEnabled(settings = null) {
  const config = getAutoresponderAiConfig(settings);
  return config.enabled && config.apiKey.length > 0;
}

async function isAutoresponderAiLimitReached(settings = null) {
  const dailyLimit = Math.max(0, Number(settings?.ai_daily_limit || 0));
  const monthlyLimit = Math.max(0, Number(settings?.ai_monthly_limit || 0));
  if (dailyLimit <= 0 && monthlyLimit <= 0) return false;

  if (dailyLimit > 0) {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM autoresponder_logs
       WHERE ai_assisted = 1
         AND created_at >= CURDATE()`
    );
    if (Number(row?.total || 0) >= dailyLimit) return true;
  }

  if (monthlyLimit > 0) {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM autoresponder_logs
       WHERE ai_assisted = 1
         AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
    );
    if (Number(row?.total || 0) >= monthlyLimit) return true;
  }

  return false;
}

function calculateAutoresponderAiEstimatedCostUsd({ inputTokens = 0, outputTokens = 0, settings = null } = {}) {
  const inputPrice = Math.max(0, Number(settings?.ai_input_cost_per_1m_usd || 0));
  const outputPrice = Math.max(0, Number(settings?.ai_output_cost_per_1m_usd || 0));
  const inputCost = (Math.max(0, Number(inputTokens) || 0) / 1000000) * inputPrice;
  const outputCost = (Math.max(0, Number(outputTokens) || 0) / 1000000) * outputPrice;
  const total = inputCost + outputCost;
  return Number.isFinite(total) && total > 0 ? Number(total.toFixed(8)) : null;
}

function getAutoresponderOpenAiAdminKey(settings = null) {
  return String(
    settings?.openai_admin_api_key ||
    process.env.OPENAI_ADMIN_KEY ||
    process.env.OPENAI_ADMIN_API_KEY ||
    ''
  ).trim();
}

function getCurrentMonthUnixRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startTime: Math.floor(start.getTime() / 1000),
    endTime: Math.floor(now.getTime() / 1000),
  };
}

function sumOpenAiCostsResponseUsd(payload) {
  let total = 0;
  for (const bucket of Array.isArray(payload?.data) ? payload.data : []) {
    for (const result of Array.isArray(bucket?.results) ? bucket.results : []) {
      const currency = String(result?.amount?.currency || 'usd').toLowerCase();
      const value = Number(result?.amount?.value || 0);
      if (currency === 'usd' && Number.isFinite(value)) total += value;
    }
  }
  return Number(total.toFixed(6));
}

async function fetchOpenAiOfficialCostsUsd({ settings = null } = {}) {
  const apiKey = getAutoresponderOpenAiAdminKey(settings);
  if (!apiKey) {
    return { available: false, status: 'missing_admin_key', cost_usd: null };
  }

  const { startTime, endTime } = getCurrentMonthUnixRange();
  let page = '';
  let total = 0;

  try {
    for (let requestIndex = 0; requestIndex < 4; requestIndex += 1) {
      const params = new URLSearchParams({
        start_time: String(startTime),
        end_time: String(endTime),
        bucket_width: '1d',
        limit: '31',
      });
      if (page) params.set('page', page);

      const response = await fetch(`https://api.openai.com/v1/organization/costs?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(Number(process.env.OPENAI_COSTS_TIMEOUT_MS || 6000)),
      });

      if (!response.ok) {
        console.warn('[autoresponder-ai-finance] OpenAI costs failed:', response.status, await response.text());
        return { available: false, status: `openai_error_${response.status}`, cost_usd: null };
      }

      const payload = await response.json();
      total += sumOpenAiCostsResponseUsd(payload);
      if (!payload?.has_more || !payload?.next_page) break;
      page = String(payload.next_page);
    }

    return {
      available: true,
      status: 'ok',
      cost_usd: Number(total.toFixed(6)),
      updated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[autoresponder-ai-finance] OpenAI costs unavailable:', err.message);
    return { available: false, status: 'request_failed', cost_usd: null };
  }
}

function extractAutoresponderOpenAiText(responseJson) {
  if (typeof responseJson?.output_text === 'string') return responseJson.output_text.trim();
  const chunks = [];
  for (const item of Array.isArray(responseJson?.output) ? responseJson.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

function normalizeAutoresponderOpenAiUsage(responseJson, model, settings = null) {
  const usage = responseJson?.usage || {};
  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
  const aiInputTokens = Number.isFinite(inputTokens) && inputTokens > 0 ? Math.trunc(inputTokens) : null;
  const aiOutputTokens = Number.isFinite(outputTokens) && outputTokens > 0 ? Math.trunc(outputTokens) : null;
  return {
    ai_assisted: 1,
    ai_model: String(model || '').trim() || null,
    ai_input_tokens: aiInputTokens,
    ai_output_tokens: aiOutputTokens,
    ai_estimated_cost_usd: calculateAutoresponderAiEstimatedCostUsd({
      inputTokens: aiInputTokens || 0,
      outputTokens: aiOutputTokens || 0,
      settings,
    }),
  };
}

async function callAutoresponderOpenAi({ input, maxOutputTokens = 120, settings = null, sender = null }) {
  if (!isAutoresponderAiEnabled(settings)) return null;
  if (await isAutoresponderAiLimitReached(settings)) return null;
  const aiConfig = getAutoresponderAiConfig(settings);
  try {
    const trainingContext = buildAutoresponderAiTrainingContext(await loadActiveAutoresponderAiTraining());
    const conversationContext = buildAutoresponderAiConversationMemoryContext(
      await loadAutoresponderAiConversationMemory({ sender, settings })
    );
    const globalContext = limitText(String(settings?.ai_context_memory || '').trim(), 6000);
    const instructions = [
      AUTORESPONDER_AI_SYSTEM_PROMPT,
      globalContext ? `Memoria personalizada e instrucoes globais da IA:\n${globalContext}` : '',
      conversationContext,
      trainingContext,
    ].filter(Boolean).join('\n\n');
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model,
        instructions,
        input,
        max_output_tokens: maxOutputTokens,
      }),
      signal: AbortSignal.timeout(Number(process.env.AUTORESPONDER_AI_TIMEOUT_MS || 5000)),
    });
    if (!response.ok) {
      console.warn('[autoresponder-ai] OpenAI response failed:', response.status, await response.text());
      return null;
    }
    const responseJson = await response.json();
    const text = extractAutoresponderOpenAiText(responseJson);
    if (!text) return null;
    return {
      text,
      aiMeta: normalizeAutoresponderOpenAiUsage(responseJson, aiConfig.model, settings),
    };
  } catch (err) {
    console.warn('[autoresponder-ai] skipped:', err.message);
    return null;
  }
}

async function buildAutoresponderNeedsPromptReply({ message, contactFirstName = '', settings = null } = {}) {
  const customPrompt = getAutoresponderConversationFlowMessage(settings, 'phone_list_prompt', '');
  const normalizedCustomPrompt = normalizeAutoresponderText(customPrompt);
  const isLegacyPrompt = normalizedCustomPrompt.includes('atras de celular novo')
    && normalizedCustomPrompt.includes('lista do que temos')
    && normalizedCustomPrompt.includes('ou deseja alguma outra coisa');
  if (customPrompt && !isLegacyPrompt) return { text: customPrompt, aiMeta: null };
  const name = String(contactFirstName || '').trim();
  const needsPrompt = await callAutoresponderOpenAi({
    input: [
      'O cliente acabou de cumprimentar ou iniciar conversa.',
      `Mensagem do cliente: ${String(message || '').trim() || '(vazia)'}`,
      name ? `Nome do cliente: ${name}` : '',
      'Nao ha produtos consultados ainda. Nao envie pergunta comercial depois da saudacao.',
      'Nao cite produtos, precos, estoque, garantia, entrega ou promocoes.',
    ].filter(Boolean).join('\n'),
    maxOutputTokens: 90,
    settings,
  });
  return {
    text: needsPrompt?.text || AUTORESPONDER_NEEDS_PROMPT_FALLBACK,
    aiMeta: needsPrompt?.aiMeta || null,
  };
}

async function buildAutoresponderAiFallbackReply({ message, contactFirstName = '', settings = null, sender = null } = {}) {
  const name = String(contactFirstName || '').trim();
  return callAutoresponderOpenAi({
    input: [
      'Nenhuma resposta pronta ou produto correspondente foi encontrado para esta mensagem.',
      `Mensagem do cliente: ${String(message || '').trim() || '(vazia)'}`,
      name ? `Nome do cliente: ${name}` : '',
      'Responda diretamente a pergunta como atendente do Mercado do Vale, usando somente o treinamento aprovado fornecido nas instrucoes.',
      'Se a informacao necessaria nao estiver no treinamento, diga de forma natural que precisa confirmar com a equipe e faca no maximo uma pergunta realmente necessaria.',
      'Nao envie uma resposta generica pedindo modelo ou tipo de produto, a menos que isso seja indispensavel para responder a pergunta.',
      'Nao invente politicas, produtos, precos, estoque, garantias ou condicoes.',
    ].filter(Boolean).join('\n'),
    maxOutputTokens: 160,
    settings,
    sender,
  });
}

async function buildAutoresponderAiFirstReply({ message, contactFirstName = '', settings = null, sender = null } = {}) {
  const name = String(contactFirstName || '').trim();
  return callAutoresponderOpenAi({
    input: [
      'O cliente acabou de enviar uma mensagem inicial ou pergunta geral no WhatsApp.',
      `Mensagem do cliente: ${String(message || '').trim() || '(vazia)'}`,
      name ? `Nome do cliente: ${name}` : '',
      'Responda como atendente virtual do Mercado do Vale, de forma curta, natural e util.',
      'Se a mensagem tiver mais de uma pergunta, responda todas as perguntas na mesma resposta.',
      'Use somente o treinamento aprovado fornecido nas instrucoes.',
      'Se o cliente perguntar sobre entrega ou frete, diga que fazemos entrega e peca o CEP para consultar.',
      'Se faltar informacao para responder com seguranca, faca no maximo uma pergunta objetiva.',
      'Nao invente politicas, produtos, precos, estoque, garantias ou condicoes.',
    ].filter(Boolean).join('\n'),
    maxOutputTokens: 190,
    settings,
    sender,
  });
}

function parseAutoresponderAiJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const objectText = jsonText.startsWith('{') ? jsonText : jsonText.match(/\{[\s\S]*\}/)?.[0];
  if (!objectText) return null;
  try {
    return JSON.parse(objectText);
  } catch {
    return null;
  }
}

async function buildAutoresponderAiIntentPlan({ message, contactFirstName = '', settings = null, sender = null } = {}) {
  const name = String(contactFirstName || '').trim();
  const aiPlan = await callAutoresponderOpenAi({
    input: [
      'Voce e o leitor inicial do atendimento do Mercado do Vale.',
      'Leia a mensagem inteira e classifique as intencoes antes das respostas fixas do sistema.',
      `Mensagem do cliente: ${String(message || '').trim() || '(vazia)'}`,
      name ? `Nome do cliente: ${name}` : '',
      'Responda SOMENTE JSON valido, sem markdown.',
      'Campos booleanos: greeting, store_status, catalog_request, delivery_quote, payment_question, warranty_question, human_request, needs_ai_text_answer.',
      'catalog_request = pergunta sobre produto, celular, smartphone, tablet, receptor, acessorio, opcoes, lista, estoque ou disponibilidade.',
      'store_status = pergunta se a loja esta aberta, fechada, horario, funcionamento ou feriado.',
      'delivery_quote = pergunta sobre entrega, frete, CEP, motoboy ou delivery.',
      'needs_ai_text_answer = pergunta geral que nao dependa de estoque, preco, horario, frete, garantia ou dado que precisa vir do sistema.',
    ].filter(Boolean).join('\n'),
    maxOutputTokens: 120,
    settings,
    sender,
  });
  const parsed = parseAutoresponderAiJsonObject(aiPlan?.text);
  if (!parsed || typeof parsed !== 'object') return null;
  return {
    greeting: parsed.greeting === true,
    storeStatusRequest: parsed.store_status === true,
    catalogRequest: parsed.catalog_request === true,
    deliveryQuote: parsed.delivery_quote === true,
    paymentQuestion: parsed.payment_question === true,
    warrantyRequest: parsed.warranty_question === true,
    humanRequest: parsed.human_request === true,
    needsAiTextAnswer: parsed.needs_ai_text_answer === true,
    aiMeta: aiPlan.aiMeta,
  };
}

function shouldAutoresponderTryAiFirst({ message, detectedIntent, purchaseFlow }) {
  const text = normalizeAutoresponderText(message).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (hasAutoresponderCartItems(purchaseFlow)) return false;
  if (detectedIntent?.greetingOnly) return false;
  if (detectedIntent?.humanRequest || detectedIntent?.storeStatusRequest || detectedIntent?.warrantyRequest) return false;
  if (detectedIntent?.numberedChoice || detectedIntent?.moreRequest) return false;
  if (normalizeAutoresponderCep(message)) return false;
  if (isAutoresponderCatalogRequest(message)) return false;
  if (detectAutoresponderGenericDeviceCatalogFamily(message)) return false;
  if (extractAutoresponderProductSearchTokens(message).length > 0 && /\b(tem|teria|vende|quero|procuro|busco|valor|preco|quanto)\b/.test(text)) {
    return false;
  }
  return /[?]|(\b(qual|quais|como|quando|onde|porque|por que|faz|fazem|tem|pode|aceita|entrega|frete|garantia|troca|funciona)\b)/.test(text);
}

const AUTORESPONDER_GENERIC_PHONE_CATALOG_WORDS = new Set([
  'celular', 'celulares', 'smartphone', 'smartphones', 'aparelho', 'aparelhos',
  'telefone', 'telefones', 'phone', 'phones',
]);

const AUTORESPONDER_GENERIC_TABLET_CATALOG_WORDS = new Set([
  'tablet', 'tablets',
]);

const AUTORESPONDER_GENERIC_RECEIVER_CATALOG_WORDS = new Set([
  'receptor', 'receptores',
]);

const AUTORESPONDER_GENERIC_PHONE_CATALOG_FILLER_WORDS = new Set([
  'tem', 'teria', 'vende', 'vendem', 'voces', 'voce', 'vc', 'ai', 'aqui',
  'de', 'do', 'da', 'dos', 'das', 'um', 'uma', 'uns', 'umas', 'algum',
  'alguns', 'alguma', 'algumas', 'novo', 'novos', 'nova', 'novas',
  'disponivel', 'disponiveis', 'pra', 'para', 'quero', 'queria',
  ...AUTORESPONDER_GENERIC_PHONE_CATALOG_WORDS,
  ...AUTORESPONDER_GENERIC_TABLET_CATALOG_WORDS,
  ...AUTORESPONDER_GENERIC_RECEIVER_CATALOG_WORDS,
]);

function isAutoresponderExplicitCatalogListRequest(message) {
  const text = normalizeAutoresponderText(message).trim();
  if (!text) return false;
  if (text === 'lista') return true;
  return /^(lista|listar|catalogo|opcoes)\b/.test(text) || /\b(manda|mande|envia|envie|mostrar|mostra|ver)\b.*\blista\b/.test(text);
}

function isAutoresponderGenericPhoneCatalogRequest(message) {
  return detectAutoresponderGenericDeviceCatalogFamily(message) === 'smartphone';
}

function detectAutoresponderGenericDeviceCatalogFamily(message) {
  const text = normalizeAutoresponderText(message).trim();
  if (!text || isAutoresponderExplicitCatalogListRequest(text) || isAutoresponderCompleteProductListKeyword(text)) return null;
  const tokens = text.split(/\s+/).filter(Boolean);
  const family = tokens.some((token) => AUTORESPONDER_GENERIC_PHONE_CATALOG_WORDS.has(token))
    ? 'smartphone'
    : tokens.some((token) => AUTORESPONDER_GENERIC_TABLET_CATALOG_WORDS.has(token))
      ? 'tablet'
      : tokens.some((token) => AUTORESPONDER_GENERIC_RECEIVER_CATALOG_WORDS.has(token))
        ? 'receptor'
        : null;
  if (!family) return null;
  const meaningfulTokens = tokens.filter((token) => !AUTORESPONDER_GENERIC_PHONE_CATALOG_FILLER_WORDS.has(token));
  return meaningfulTokens.length === 0 ? family : null;
}

function buildAutoresponderPhoneCatalogRefinementPrompt() {
  return buildAutoresponderDeviceCatalogRefinementPrompt('smartphone');
}

function buildAutoresponderDeviceCatalogRefinementPrompt(family = 'smartphone') {
  const introByFamily = {
    smartphone: 'Temos celulares disponiveis sim.',
    tablet: 'Temos tablets disponiveis sim.',
    receptor: 'Temos receptores disponiveis sim.',
  };
  return [
    introByFamily[family] || introByFamily.smartphone,
    'Voce procura algum modelo, marca ou faixa de preco em especial?',
    'Ex: iPhone ate R$ 2.000, Xiaomi com camera boa, Samsung barato.',
    '',
    'Se quiser receber a lista dos disponiveis, responda "lista".',
  ].join('\n');
}

function isAutoresponderCatalogRequest(message) {
  const text = normalizeAutoresponderText(message).trim();
  if (!text) return false;
  if (isAutoresponderCompleteProductListKeyword(text)) return true;
  const asksForList = [
    'qual', 'quais', 'lista', 'listar', 'opcoes', 'opcao', 'catalogo',
    'modelos', 'disponivel', 'disponiveis', 'tem', 'voces tem', 'voce tem', 'vc tem',
  ].some((keyword) => text.includes(keyword));
  const asksForPhone = [
    'celular', 'celulares', 'smartphone', 'smartphones', 'aparelho', 'aparelhos',
    'telefone', 'telefones', 'iphone', 'iphones', 'xiaomi', 'samsung', 'motorola',
    'tablet', 'tablets', 'tablte', 'tabltes', 'receptor', 'receptores',
  ].some((keyword) => text.includes(keyword));
  return asksForList && asksForPhone;
}

function findAutoresponderCatalogCategoryForMessage(message, categories) {
  const text = normalizeAutoresponderText(message).trim();
  const safeCategories = Array.isArray(categories) ? categories : [];
  if (!text || safeCategories.length === 0) return null;

  const phoneCategoryHints = [
    'celular', 'celulares', 'smartphone', 'smartphones', 'aparelho', 'aparelhos',
    'telefone', 'telefones', 'phone', 'phones', 'iphone', 'xiaomi', 'samsung',
    'tablet', 'tablets', 'tablte', 'tabltes', 'receptor', 'receptores',
  ];
  const asksForPhone = phoneCategoryHints.some((keyword) => text.includes(keyword));
  const preferredPhoneCategoryNames = ['smartphones', 'smartphone', 'celulares', 'celular'];
  if (asksForPhone) {
    const preferredCategory = preferredPhoneCategoryNames
      .map((preferredName) => safeCategories.find((category) => (
        normalizeAutoresponderText(category?.name || '').trim() === preferredName
        || normalizeAutoresponderText(category?.slug || '').trim() === preferredName
      )))
      .find(Boolean);
    if (preferredCategory) return preferredCategory;
    return null;
  }

  const directMatch = safeCategories.find((category) => {
    const name = normalizeAutoresponderText(category?.name || '').trim();
    return name && (text.includes(name) || name.includes(text));
  });
  if (directMatch) return directMatch;

  return null;
}

function isAutoresponderPhoneCatalogCategoryMessage(message) {
  const text = normalizeAutoresponderText(message).trim();
  if (!text) return false;
  return /\b(celular|celulares|smartphone|smartphones|telefone|telefones|aparelho|aparelhos|iphone|xiaomi|samsung|motorola)\b/.test(text);
}

async function findAutoresponderPreferredPhoneCatalogCategory() {
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.slug, COUNT(p.id) AS product_count
     FROM categories c
     JOIN products p ON p.category_id = c.id
      AND p.status = 'active'
      AND (p.is_parent = 0 OR p.is_parent IS NULL)
      AND p.stock_quantity > 0
     WHERE LOWER(c.slug) IN ('smartphones', 'smartphone')
        OR LOWER(c.name) IN ('smartphones', 'smartphone')
     GROUP BY c.id, c.name, c.slug
     ORDER BY
       CASE
         WHEN LOWER(c.slug) = 'smartphones' THEN 0
         WHEN LOWER(c.name) = 'smartphones' THEN 1
         ELSE 2
       END,
       product_count DESC,
       c.name ASC
     LIMIT 1`
  );
  return rows[0] || null;
}

async function resolveAutoresponderCatalogCategoryForMessage(message, categories) {
  const selectedCategory = findAutoresponderCatalogCategoryForMessage(message, categories);
  if (selectedCategory?.id || !isAutoresponderPhoneCatalogCategoryMessage(message)) return selectedCategory;
  return findAutoresponderPreferredPhoneCatalogCategory();
}

function extractAutoresponderBudgetCents(message) {
  const text = String(message || '').toLowerCase();
  const budgetPattern = /(?:ate|até|maximo|max|abaixo de|menos de|por volta de|na faixa de)\s*(?:r\$\s*)?([\d.,]+)/i;
  const match = text.match(budgetPattern);
  if (!match) return 0;
  const raw = String(match[1] || '').trim();
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/\./g, '');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

function getAutoresponderBudgetCategoryRequest(message, categories) {
  const budgetCents = extractAutoresponderBudgetCents(message);
  if (budgetCents <= 0) return null;
  const category = findAutoresponderCatalogCategoryForMessage(message, categories);
  if (!category?.id) return null;
  return { category, budgetCents };
}

async function resolveAutoresponderReplyTemplate(replyText, settings = null) {
  let text = String(replyText || '');
  if (!text.includes('{categorias_disponiveis}') && !/\{categoria:[^}]+\}/i.test(text)) return text;

  let categories = null;
  if (text.includes('{categorias_disponiveis}')) {
    categories = await findAutoresponderAvailableCategories(100);
    text = text.split('{categorias_disponiveis}').join(formatAutoresponderGreetingCategoryListReply(categories));
  }

  const categoryMatches = Array.from(text.matchAll(/\{categoria:([^}]+)\}/gi));
  if (categoryMatches.length === 0) return text;

  categories = categories || await findAutoresponderAvailableCategories(100);
  for (const match of categoryMatches) {
    const rawName = String(match[1] || '').trim();
    const normalizedName = normalizeAutoresponderText(rawName).trim();
    const category = categories.find((item) => normalizeAutoresponderText(item?.name || '').trim() === normalizedName)
      || categories.find((item) => normalizeAutoresponderText(item?.name || '').includes(normalizedName));
    let replacement = `Nao encontrei a categoria "${rawName}".`;
    if (category) {
      const pageSize = getAutoresponderInitialProductPageSize(category.name);
      const total = await countAutoresponderProductsByCategory(category.id);
      const products = await findAutoresponderProductsByCategory(category.id, pageSize);
      replacement = await formatAutoresponderProductSearchReply(products, category.name, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(category.name) });
    }
    text = text.split(match[0]).join(replacement);
  }

  return text;
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
  if (choiceNumber > 0) {
    const option = safeOptions[choiceNumber - 1] || null;
    return option ? { ...option, option_number: choiceNumber } : null;
  }

  const text = normalizeAutoresponderText(message).trim();
  if (text.length < 4) return null;
  const tokens = text.split(/\s+/).filter((token) => token.length >= 2);
  if (tokens.length < 2) return null;

  const selectedIndex = safeOptions.findIndex((option) => {
    const name = normalizeAutoresponderText(option?.name || '');
    const sku = normalizeAutoresponderText(option?.sku || '');
    if (sku && sku === text) return true;
    if (!name) return false;
    return tokens.every((token) => name.includes(token));
  });
  return selectedIndex >= 0
    ? { ...safeOptions[selectedIndex], option_number: selectedIndex + 1 }
    : null;
}

async function buildAutoresponderPurchaseActionPrompt(product, selectedOption) {
  const selectedProduct = product || selectedOption || {};
  const card = await formatAutoresponderProductCardLine({
    name: product?.name || selectedOption?.name || 'Produto selecionado',
    representative: selectedProduct,
    products: [selectedProduct],
    priceRange: product ? null : undefined,
    colors: getAutoresponderAvailableColors([selectedProduct]),
  }, Number(selectedOption?.option_number || 1));

  const productUrl = getAutoresponderProductUrl(selectedProduct);
  const detailsBlock = [
    'Para ver a configuracao, fotos e video dele, clica aqui',
    productUrl,
    '',
    'Para comprar digite *1* ou responda com *comprar*',
  ].join('\n');

  return `${card}\n\n${detailsBlock}`;
}

function buildAutoresponderVariationPrompt(variations) {
  const available = filterAutoresponderAvailableProducts(variations);
  const lines = [
    'Antes de seguir, escolha a cor/variacao disponivel:',
    '',
  ];
  available.forEach((variation, index) => {
    const color = getAutoresponderProductColor(variation) || 'cor sob consulta';
    const price = formatAutoresponderCurrency(getAutoresponderProductPrice(variation));
    const stock = Number(variation?.stock_quantity || 0);
    lines.push(`${index + 1}. ${color} - ${price}${stock > 0 ? ` (${stock} em estoque)` : ''}`);
  });
  lines.push('');
  lines.push('Responda com o numero ou com a cor desejada.');
  return lines.join('\n');
}

function findAutoresponderSelectedVariation(message, variations) {
  const available = filterAutoresponderAvailableProducts(variations);
  const text = normalizeAutoresponderText(message).trim();
  const number = text.match(/^\d{1,2}$/) ? Number(text) : null;
  if (number && available[number - 1]) return available[number - 1];
  return available.find((variation) => {
    const color = normalizeAutoresponderText(getAutoresponderProductColor(variation));
    const name = normalizeAutoresponderText(variation?.name || '');
    return (color && (color === text || color.includes(text) || text.includes(color)))
      || (name && (name === text || name.includes(text)));
  }) || null;
}

function shouldAutoresponderAskVariation(variations) {
  const available = filterAutoresponderAvailableProducts(variations);
  if (available.length <= 1) return false;
  const colors = getAutoresponderAvailableColors(available);
  return colors.length > 1 || available.length > 1;
}

function isAutoresponderPurchaseBuyRequest(message) {
  const text = normalizeAutoresponderText(message).trim();
  return [
    '1',
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
    '2',
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

function getAutoresponderShippingCents(purchaseFlow = {}) {
  const price = Number(purchaseFlow?.shipping_quote?.price);
  if (!Number.isFinite(price) || price <= 0) return 0;
  return Math.round(price * 100);
}

function calculateAutoresponderCartTotalsWithShipping(cartItems, purchaseFlow = {}) {
  const totals = calculateAutoresponderCartTotals(cartItems);
  const shippingCents = getAutoresponderShippingCents(purchaseFlow);
  return {
    ...totals,
    shipping_cents: shippingCents,
    total_cents: totals.subtotal_cents + shippingCents,
  };
}

function formatAutoresponderCartPaymentLine(plan) {
  const installmentLine = formatAutoresponderInstallmentLine(plan);
  return installmentLine ? installmentLine.replace('Parcelamento:', 'Parcelamento no cartao:') : '';
}

async function formatAutoresponderCartSummaryReply(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const totals = calculateAutoresponderCartTotals(safeItems);
  const paymentPlan = await calculateAutoresponderMaxInstallment(totals.total_cents);
  const paymentLine = formatAutoresponderCartPaymentLine(paymentPlan);
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
  if (paymentLine) lines.push(paymentLine);
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

function normalizeAutoresponderCep(value) {
  const digits = String(value || '').replace(/\D+/g, '');
  return digits.length === 8 ? digits : '';
}

function formatAutoresponderCep(value) {
  const cep = normalizeAutoresponderCep(value);
  return cep ? cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : '';
}

function parseAutoresponderNumberComplement(message) {
  const text = normalizeAutoresponderDeliveryAddress(message);
  if (!text) return null;
  const match = text.match(/^(\d+[a-zA-Z]?|s\/n|sn|sem numero)(?:\s*(?:[-,]\s*)?(.+))?$/i);
  if (match) {
    return {
      number: match[1],
      complement: normalizeAutoresponderDeliveryAddress(match[2] || ''),
    };
  }
  return null;
}

function isAutoresponderFullName(value) {
  const cleanName = normalizeAutoresponderContactName(value);
  if (!cleanName || cleanName.toLowerCase() === 'nao informado') return false;
  const parts = cleanName.split(/\s+/).filter((part) => part.length >= 2);
  return parts.length >= 2;
}

function buildAutoresponderFullNamePrompt(settings = null) {
  return getAutoresponderConversationFlowMessage(settings, 'name_prompt', 'Para finalizar o pedido, me envie seu nome completo.');
}

function buildAutoresponderPickupConfirmationReply(settings = null) {
  return getAutoresponderConversationFlowMessage(settings, 'pickup_reply', 'Combinado: retirada na loja. Agora vamos combinar a forma de pagamento.');
}

function buildAutoresponderDeliveryAddressPrompt(settings = null) {
  return getAutoresponderConversationFlowMessage(settings, 'delivery_cep_prompt', 'Combinado: entrega. Me envie o CEP da entrega. Pode mandar somente os numeros.');
}

function buildAutoresponderDeliveryCepNotFoundReply() {
  return 'Nao consegui encontrar esse CEP. Confira os 8 numeros e me envie novamente.';
}

function buildAutoresponderDeliveryCepConfirmationReply(address, shippingQuote) {
  const lines = [
    'Encontrei este endereco:',
    `Rua: ${address.street || 'nao informado'}`,
    `Bairro: ${address.neighborhood || 'nao informado'}`,
    `Cidade: ${address.city || 'nao informado'} - ${address.state || ''}`.trim(),
    `CEP: ${formatAutoresponderCep(address.cep)}`,
    '',
  ];
  if (shippingQuote) {
    lines.push('Frete:');
    lines.push(`${shippingQuote.name}: ${shippingQuote.isFree ? 'Gratis' : formatAutoresponderCurrency(Number(shippingQuote.price || 0))}`);
    if (shippingQuote.daysLabel) lines.push(`Prazo: ${shippingQuote.daysLabel}`);
    lines.push('');
  } else {
    lines.push('Nao encontrei uma regra de frete automatica para esse CEP. Vou deixar para o atendente confirmar o valor.');
    lines.push('');
  }
  lines.push('Se estiver correto, me envie o numero da casa.');
  lines.push('Se tiver complemento, pode mandar junto. Ex: 123 apto 202');
  lines.push('Se esse nao for o endereco, envie outro CEP.');
  return lines.join('\n');
}

function isAutoresponderStandaloneDeliveryQuoteRequest(message) {
  const text = normalizeAutoresponderText(message).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  const mentionsDelivery = /\b(entrega|entregar|entregam|delivery|frete|motoboy|enviar|envia|mandar|manda)\b/.test(text);
  const asksAboutService = /\b(faz|fazem|tem|trabalha|trabalham|quanto|valor|preco|consulta|consultar)\b/.test(text) || text.includes('?');
  return mentionsDelivery && asksAboutService;
}

function shouldAutoresponderRuleAwaitStandaloneDeliveryCep(rule, resolvedText = '') {
  if (!rule || String(rule.reply_type || 'text') !== 'text') return false;
  const text = normalizeAutoresponderText([
    rule.name,
    rule.pattern,
    rule.reply_text,
    resolvedText,
  ].filter(Boolean).join(' '));
  const asksCep = /\bcep\b/.test(text);
  const deliveryContext = /\b(entrega|entregar|delivery|frete|motoboy|enviar|mandar)\b/.test(text);
  return asksCep && deliveryContext;
}

function buildAutoresponderStandaloneDeliveryCepReply(address, shippingQuote) {
  const lines = [
    'Atendemos esse CEP:',
    `Rua: ${address.street || 'nao informado'}`,
    `Bairro: ${address.neighborhood || 'nao informado'}`,
    `Cidade: ${address.city || 'nao informado'} - ${address.state || ''}`.trim(),
    `CEP: ${formatAutoresponderCep(address.cep)}`,
    '',
  ];
  if (shippingQuote) {
    lines.push('Frete estimado:');
    lines.push(`${shippingQuote.name}: ${shippingQuote.isFree ? 'Gratis' : formatAutoresponderCurrency(Number(shippingQuote.price || 0))}`);
    if (shippingQuote.daysLabel) lines.push(`Prazo: ${shippingQuote.daysLabel}`);
  } else {
    lines.push('Nao encontrei uma regra automatica de frete para esse CEP. Um atendente confirma o valor certinho.');
  }
  lines.push('');
  lines.push('Para fechar o valor com produto, responda com o numero ou nome do item que voce quer.');
  return lines.join('\n');
}

function buildAutoresponderDeliveryNumberPrompt() {
  return 'Agora me envie o numero da casa/predio. Se tiver complemento, pode mandar junto. Ex: 123, apto 202';
}

function formatAutoresponderDeliveryAddress(address) {
  if (!address) return 'Endereco nao informado';
  const firstLine = [address.street, address.number].filter(Boolean).join(', ');
  const cityLine = [address.neighborhood, [address.city, address.state].filter(Boolean).join('/')].filter(Boolean).join(' - ');
  return [
    firstLine,
    address.complement ? `Complemento: ${address.complement}` : '',
    cityLine,
    address.cep ? `CEP: ${formatAutoresponderCep(address.cep)}` : '',
  ].filter(Boolean).join('\n');
}

function buildAutoresponderDeliveryAddressSavedReply(purchaseFlow = {}) {
  const totals = calculateAutoresponderCartTotalsWithShipping(purchaseFlow.items, purchaseFlow);
  const lines = [
    'Endereco anotado.',
    '',
    'Endereco de entrega:',
    formatAutoresponderDeliveryAddress(purchaseFlow.delivery_address),
  ];
  if (purchaseFlow.shipping_quote) {
    lines.push('');
    lines.push(`Frete: ${purchaseFlow.shipping_quote.isFree ? 'Gratis' : formatAutoresponderCurrency(Number(purchaseFlow.shipping_quote.price || 0))}`);
    lines.push(`Total com frete: ${formatAutoresponderCurrency(totals.total_cents / 100)}`);
  }
  lines.push('');
  lines.push('Agora vamos combinar a forma de pagamento.');
  return lines.join('\n');
}

async function promptAutoresponderPaymentMethod({ senderKey, message, purchaseFlow, settings, intent = 'purchase_payment_method_prompt' }) {
  const totals = calculateAutoresponderCartTotalsWithShipping(purchaseFlow.items, purchaseFlow);
  const nextFlow = {
    ...purchaseFlow,
    status: 'awaiting_payment_method',
    totals,
    selected_payment: null,
  };
  const replyText = formatAutoresponderReply(buildAutoresponderPaymentMethodPrompt(nextFlow), settings, false);
  await saveAutoresponderPurchaseFlow(senderKey, nextFlow);
  await logAutoresponderReply({
    sender: senderKey,
    message,
    intent,
    replyText,
    matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
    matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
  });
  await upsertAutoresponderSuccessConversation(senderKey);
  return { replies: [{ message: replyText }] };
}

async function handleAutoresponderDeliveryCepLookup({ senderKey, message, purchaseFlow, settings, cep }) {
  const normalizedCep = normalizeAutoresponderCep(cep || message);
  if (!normalizedCep) return null;

  const cepAddress = await lookupAutoresponderCep(normalizedCep);
  if (!cepAddress) {
    const replyText = formatAutoresponderReply(buildAutoresponderDeliveryCepNotFoundReply(), settings, false);
    await logAutoresponderReply({
      sender: senderKey,
      message,
      intent: 'purchase_delivery_cep_not_found',
      replyText,
      matchedCount: 0,
      matchedProducts: [],
    });
    await upsertAutoresponderSuccessConversation(senderKey);
    return { replies: [{ message: replyText }] };
  }

  const shippingOptions = await calculateAutoresponderShippingOptions(normalizedCep, purchaseFlow.items, cepAddress);
  const shippingQuote = shippingOptions[0] || null;
  const replyText = formatAutoresponderReply(buildAutoresponderDeliveryCepConfirmationReply(cepAddress, shippingQuote), settings, false);
  await saveAutoresponderPurchaseFlow(senderKey, {
    ...purchaseFlow,
    status: 'awaiting_delivery_cep_confirmation',
    fulfillment: 'delivery',
    delivery_address_lookup: cepAddress,
    shipping_options: shippingOptions,
    shipping_quote: shippingQuote,
  });
  await logAutoresponderReply({
    sender: senderKey,
    message,
    intent: 'purchase_delivery_cep_quote',
    replyText,
    matchedCount: shippingOptions.length,
    matchedProducts: shippingOptions,
  });
  await upsertAutoresponderSuccessConversation(senderKey);
  return { replies: [{ message: replyText }] };
}

async function handleAutoresponderStandaloneDeliveryCepLookup({ senderKey, message, purchaseFlow, settings, cep }) {
  const normalizedCep = normalizeAutoresponderCep(cep || message);
  if (!normalizedCep) return null;

  const cepAddress = await lookupAutoresponderCep(normalizedCep);
  if (!cepAddress) {
    const replyText = formatAutoresponderReply(buildAutoresponderDeliveryCepNotFoundReply(), settings, false);
    await saveAutoresponderPurchaseFlow(senderKey, {
      ...purchaseFlow,
      status: 'awaiting_standalone_delivery_cep',
      items: [],
    });
    await logAutoresponderReply({
      sender: senderKey,
      message,
      intent: 'standalone_delivery_cep_not_found',
      replyText,
      matchedCount: 0,
    });
    await upsertAutoresponderSuccessConversation(senderKey);
    return { replies: [{ message: replyText }] };
  }

  const shippingOptions = await calculateAutoresponderShippingOptions(normalizedCep, [], cepAddress);
  const shippingQuote = shippingOptions[0] || null;
  const replyText = formatAutoresponderReply(buildAutoresponderStandaloneDeliveryCepReply(cepAddress, shippingQuote), settings, false);
  await saveAutoresponderPurchaseFlow(senderKey, {
    ...purchaseFlow,
    status: 'idle',
    items: [],
    standalone_delivery_address_lookup: cepAddress,
    standalone_shipping_options: shippingOptions,
    standalone_shipping_quote: shippingQuote,
  });
  await logAutoresponderReply({
    sender: senderKey,
    message,
    intent: 'standalone_delivery_cep_quote',
    replyText,
    matchedCount: shippingOptions.length,
    matchedProducts: shippingOptions,
  });
  await upsertAutoresponderSuccessConversation(senderKey);
  return { replies: [{ message: replyText }] };
}

async function handleAutoresponderEngineDeliveryFlowV2({ senderKey, message, settings, purchaseFlow }) {
  const currentPurchaseFlow = purchaseFlow || await getAutoresponderPurchaseFlow(senderKey);
  if (
    hasAutoresponderCartItems(currentPurchaseFlow) &&
    (
      currentPurchaseFlow?.status === 'awaiting_delivery_address' ||
      currentPurchaseFlow?.status === 'awaiting_delivery_cep_confirmation' ||
      currentPurchaseFlow?.status === 'awaiting_delivery_number' ||
      currentPurchaseFlow?.status === 'summary_ready' ||
      currentPurchaseFlow?.fulfillment === 'delivery'
    )
  ) {
    return null;
  }
  const [{ normalizeConversationState }, { deliveryFlowHandler }] = await Promise.all([
    import('./services/autoresponder/engine/state.js'),
    import('./services/autoresponder/engine/flows/delivery.js'),
  ]);
  const state = normalizeConversationState(currentPurchaseFlow?.conversation_state || {});
  if (state.flow === 'purchase' && state.step === 'awaiting_fulfillment') {
    return null;
  }
  const canHandle = deliveryFlowHandler.canHandle({ message, state, settings, context: {} });
  if (!canHandle) return null;

  const deliveryReply = await deliveryFlowHandler.handle({
    sender: senderKey,
    message,
    state,
    settings,
    context: {
      lookupCep: lookupAutoresponderCep,
      calculateShippingOptions: calculateAutoresponderShippingOptions,
    },
  });
  if (!deliveryReply) return null;
  if (deliveryReply.intent === 'contextual_fallback' && state.flow !== 'delivery') return null;

  await saveAutoresponderPurchaseFlow(senderKey, {
    ...currentPurchaseFlow,
    conversation_state: deliveryReply.nextState,
  });
  await logAutoresponderReply({
    sender: senderKey,
    message,
    intent: deliveryReply.intent,
    replyText: deliveryReply.message,
    matchedCount: deliveryReply.matchedCount,
    matchedProducts: deliveryReply.matchedProducts,
  });
  await upsertAutoresponderSuccessConversation(senderKey);
  return { replies: [{ message: deliveryReply.message }] };
}

function isAutoresponderEngineV2Enabled() {
  return process.env.AUTORESPONDER_ENGINE_V2 === '1';
}

async function handleAutoresponderEngineProductSearchFlowV2({ senderKey, message, settings, purchaseFlow }) {
  if (!isAutoresponderEngineV2Enabled()) return null;

  const currentPurchaseFlow = purchaseFlow || await getAutoresponderPurchaseFlow(senderKey);
  const [{ normalizeConversationState }, { productSearchFlowHandler }] = await Promise.all([
    import('./services/autoresponder/engine/state.js'),
    import('./services/autoresponder/engine/flows/product-search.js'),
  ]);
  const state = normalizeConversationState(currentPurchaseFlow?.conversation_state || {});
  const productSearchTokens = state.flow === 'product_search'
    ? []
    : extractAutoresponderProductSearchTokens(message);
  const searchKeyword = productSearchTokens.join(' ');
  const pageSize = searchKeyword ? getAutoresponderInitialProductPageSize(searchKeyword) : AUTORESPONDER_PRODUCT_RESPONSE_LIMIT;
  let searchMeta = { hasMore: false, total: 0 };
  const canHandle = productSearchFlowHandler.canHandle({ message, state, settings, context: { productSearchTokens } });
  if (!canHandle) return null;

  const productReply = await productSearchFlowHandler.handle({
    sender: senderKey,
    message,
    state,
    settings,
    context: {
      productSearchTokens,
      pageSize,
      get hasMore() {
        return searchMeta.hasMore;
      },
      get total() {
        return searchMeta.total;
      },
      async findProducts(tokens) {
        const rows = await findAutoresponderProductsByTokens(tokens, pageSize + 1);
        searchMeta.hasMore = rows.length > pageSize;
        searchMeta.total = await countAutoresponderProductsByTokens(tokens);
        return rows.slice(0, pageSize);
      },
      buildProductOptions: buildAutoresponderProductOptions,
      findSelectedProduct(selectedMessage, options) {
        return findAutoresponderSelectedOptionFromMessage(
          selectedMessage,
          options,
          getAutoresponderNumberedChoice(selectedMessage)
        );
      },
      async buildProductDetailReply(selectedProduct) {
        const product = selectedProduct?.id ? await findAutoresponderProductById(selectedProduct.id) : null;
        return buildAutoresponderPurchaseActionPrompt(product, selectedProduct);
      },
    },
  });
  if (!productReply) return null;
  if (productReply.intent === 'contextual_fallback' && state.flow !== 'product_search') return null;

  const purchaseFlowPatch = {
    ...currentPurchaseFlow,
    conversation_state: productReply.nextState,
  };
  if (productReply.intent === 'product_selected') {
    purchaseFlowPatch.status = 'awaiting_product_action';
    purchaseFlowPatch.selected_product = productReply.nextState?.data?.selected_product || productReply.matchedProducts?.[0] || null;
  }

  await saveAutoresponderPurchaseFlow(senderKey, purchaseFlowPatch);
  if (productReply.intent === 'product_search') {
    await upsertAutoresponderOptionsConversation(senderKey, productReply.matchedProducts, {
      source: 'tokens',
      tokens: productSearchTokens,
      keyword: searchKeyword,
      offset: 0,
      limit: pageSize,
      total: searchMeta.total,
      hasMore: searchMeta.hasMore,
    });
  }
  await logAutoresponderReply({
    sender: senderKey,
    message,
    intent: productReply.intent,
    replyText: productReply.message,
    matchedCount: productReply.matchedCount,
    matchedProducts: productReply.matchedProducts,
  });
  await upsertAutoresponderSuccessConversation(senderKey);
  return { replies: [{ message: productReply.message }] };
}

function buildAutoresponderEnginePurchaseFlowPatch(currentPurchaseFlow, purchaseReply) {
  const nextState = purchaseReply?.nextState || {};
  const data = nextState.data && typeof nextState.data === 'object' ? nextState.data : {};
  const purchaseFlowPatch = {
    ...currentPurchaseFlow,
    conversation_state: purchaseReply.nextState,
  };

  if (nextState.flow === 'purchase' && nextState.step === 'awaiting_action') {
    purchaseFlowPatch.status = 'awaiting_product_action';
    purchaseFlowPatch.selected_product = data.selected_product || purchaseFlowPatch.selected_product || null;
  }
  if (nextState.flow === 'purchase' && nextState.step === 'awaiting_variation') {
    purchaseFlowPatch.status = 'awaiting_variation';
    purchaseFlowPatch.variation_options = data.variation_options || [];
    purchaseFlowPatch.selected_product = data.selected_product || purchaseFlowPatch.selected_product || null;
  }
  if (nextState.flow === 'purchase' && nextState.step === 'awaiting_quantity') {
    purchaseFlowPatch.status = 'awaiting_quantity';
    purchaseFlowPatch.selected_product = data.selected_product || purchaseFlowPatch.selected_product || null;
    purchaseFlowPatch.requested_quantity = null;
  }
  if (nextState.flow === 'purchase' && nextState.step === 'item_added') {
    purchaseFlowPatch.status = 'item_added';
    purchaseFlowPatch.items = Array.isArray(data.items) ? data.items : [];
    purchaseFlowPatch.requested_quantity = data.requested_quantity || purchaseFlowPatch.requested_quantity || null;
  }
  if (nextState.flow === 'purchase' && nextState.step === 'awaiting_fulfillment') {
    purchaseFlowPatch.status = 'summary_ready';
    purchaseFlowPatch.items = Array.isArray(data.items) ? data.items : purchaseFlowPatch.items;
  }
  if (nextState.flow === 'delivery' && nextState.step === 'awaiting_cep') {
    purchaseFlowPatch.status = 'awaiting_delivery_address';
    purchaseFlowPatch.fulfillment = 'delivery';
    purchaseFlowPatch.items = Array.isArray(data.items) ? data.items : purchaseFlowPatch.items;
  }
  if (nextState.flow === 'payment' && nextState.step === 'awaiting_payment_method') {
    purchaseFlowPatch.status = 'awaiting_payment_method';
    purchaseFlowPatch.fulfillment = data.fulfillment || purchaseFlowPatch.fulfillment || 'pickup';
    purchaseFlowPatch.items = Array.isArray(data.items) ? data.items : purchaseFlowPatch.items;
    purchaseFlowPatch.totals = calculateAutoresponderCartTotalsWithShipping(purchaseFlowPatch.items, purchaseFlowPatch);
  }
  if (nextState.flow === 'customer_data' && nextState.step === 'awaiting_name') {
    purchaseFlowPatch.status = 'awaiting_customer_full_name';
    purchaseFlowPatch.selected_payment = data.payment || purchaseFlowPatch.selected_payment || null;
  }
  if (nextState.flow === 'customer_data' && nextState.step === 'awaiting_document') {
    purchaseFlowPatch.status = 'awaiting_customer_document';
    purchaseFlowPatch.customer_data = {
      ...(purchaseFlowPatch.customer_data || {}),
      name: data.customer_name || purchaseFlowPatch.customer_data?.name || null,
    };
  }
  if (nextState.flow === 'handoff' && nextState.step === 'ready') {
    purchaseFlowPatch.status = 'customer_registration_ready';
    purchaseFlowPatch.customer_data = {
      ...(purchaseFlowPatch.customer_data || {}),
      cpf_cnpj: data.customer_document || purchaseFlowPatch.customer_data?.cpf_cnpj || null,
    };
  }

  return purchaseFlowPatch;
}

function buildAutoresponderEngineSelectedPayment(method, purchaseFlow = {}) {
  const cartTotals = calculateAutoresponderCartTotalsWithShipping(purchaseFlow.items, purchaseFlow);
  if (method === 'pix') {
    return { method, label: 'Pix', total_cents: cartTotals.total_cents, base_total_cents: cartTotals.total_cents };
  }
  if (method === 'cash') {
    return { method, label: 'Dinheiro', total_cents: cartTotals.total_cents, base_total_cents: cartTotals.total_cents };
  }
  if (method === 'debit') {
    return { method, label: 'Debito', total_cents: cartTotals.total_cents, base_total_cents: cartTotals.total_cents };
  }
  return null;
}

async function handleAutoresponderEnginePurchaseFlowV2({ senderKey, message, settings, purchaseFlow }) {
  if (!isAutoresponderEngineV2Enabled()) return null;

  const currentPurchaseFlow = purchaseFlow || await getAutoresponderPurchaseFlow(senderKey);
  const [{ normalizeConversationState }, { purchaseFlowHandler }] = await Promise.all([
    import('./services/autoresponder/engine/state.js'),
    import('./services/autoresponder/engine/flows/purchase.js'),
  ]);
  const state = normalizeConversationState(currentPurchaseFlow?.conversation_state || {});
  if (!purchaseFlowHandler.canHandle({ message, state, settings, context: {} })) return null;

  const purchaseReply = await purchaseFlowHandler.handle({
    sender: senderKey,
    message,
    state,
    settings,
    context: {
      isBuyRequest: isAutoresponderPurchaseBuyRequest,
      isDetailsRequest: isAutoresponderPurchaseDetailsRequest,
      isAddMoreRequest: isAutoresponderPurchaseAddMoreRequest,
      isFinalizeRequest: isAutoresponderPurchaseFinalizeRequest,
      isDeliveryRequest(input) {
        return getAutoresponderPurchaseFulfillmentChoice(input) === 'delivery';
      },
      isPickupRequest(input) {
        return getAutoresponderPurchaseFulfillmentChoice(input) === 'pickup';
      },
      parseQuantity: parseAutoresponderRequestedQuantity,
      parsePaymentMethod: getAutoresponderPaymentMethodChoice,
      parseCustomerDocument: normalizeAutoresponderCustomerDocument,
      buildSelectedPayment(method, data) {
        return buildAutoresponderEngineSelectedPayment(method, { ...currentPurchaseFlow, ...data });
      },
      async findProductVariations(selectedProduct) {
        const product = selectedProduct?.id ? await findAutoresponderProductById(selectedProduct.id) : selectedProduct;
        const variations = await findAutoresponderProductVariations(product || selectedProduct);
        return shouldAutoresponderAskVariation(variations) ? variations : [product || selectedProduct];
      },
      findSelectedVariation: findAutoresponderSelectedVariation,
      async buildProductDetailReply(selectedProduct) {
        const product = selectedProduct?.id ? await findAutoresponderProductById(selectedProduct.id) : selectedProduct;
        return formatAutoresponderReply(
          await buildAutoresponderPurchaseActionPrompt(product, selectedProduct),
          settings,
          false
        );
      },
      buildVariationPrompt(variations) {
        return formatAutoresponderReply(buildAutoresponderVariationPrompt(variations), settings, false);
      },
      buildQuantityPrompt(product) {
        return formatAutoresponderReply(buildAutoresponderQuantityPrompt(product), settings, false);
      },
      buildStockBlockedReply(product, quantity) {
        const availableStock = Math.max(Number(product?.stock_quantity || 0), 0);
        const text = availableStock <= 0
          ? buildAutoresponderOutOfStockReply(product)
          : buildAutoresponderInsufficientStockReply(product, quantity, availableStock);
        return formatAutoresponderReply(text, settings, false);
      },
      async buildCartItem(product, quantity) {
        const fullProduct = product?.id ? await findAutoresponderProductById(product.id) : product;
        const selectedProduct = fullProduct || product;
        const unitPriceCents = getAutoresponderProductPriceCents(selectedProduct);
        return {
          product_id: selectedProduct.id,
          name: selectedProduct.name || product.name || null,
          sku: selectedProduct.sku || product.sku || null,
          slug: selectedProduct.slug || product.slug || null,
          quantity,
          unit_price_cents: unitPriceCents,
          subtotal_cents: unitPriceCents * quantity,
        };
      },
      buildItemAddedPrompt(item) {
        return formatAutoresponderReply(buildAutoresponderItemAddedPrompt(item), settings, false);
      },
      buildAddMorePrompt() {
        return formatAutoresponderReply(buildAutoresponderAddMorePrompt(), settings, false);
      },
      async buildFulfillmentPrompt(_settings) {
        return formatAutoresponderReply(await formatAutoresponderCartSummaryReply(currentPurchaseFlow.items || state.data?.items || []), settings, false);
      },
      buildDeliveryCepPrompt() {
        return formatAutoresponderReply(buildAutoresponderDeliveryAddressPrompt(settings), settings, false);
      },
      buildPaymentMethodPrompt(nextData) {
        return formatAutoresponderReply(buildAutoresponderPaymentMethodPrompt({ ...currentPurchaseFlow, ...nextData }), settings, false);
      },
      buildCustomerNamePrompt() {
        return formatAutoresponderReply(buildAutoresponderFullNamePrompt(settings), settings, false);
      },
      buildCustomerDocumentPrompt() {
        return formatAutoresponderReply(buildAutoresponderCustomerDocumentPrompt(), settings, false);
      },
      buildHandoffReadyReply(nextData) {
        return formatAutoresponderReply(buildAutoresponderCustomerOrderHandoffReply(settings, senderKey), settings, false);
      },
    },
  });
  if (!purchaseReply) return null;
  if (purchaseReply.intent === 'contextual_fallback' && !['purchase', 'payment', 'customer_data', 'handoff'].includes(state.flow)) return null;

  const purchaseFlowPatch = buildAutoresponderEnginePurchaseFlowPatch(currentPurchaseFlow, purchaseReply);
  if (purchaseReply.intent === 'purchase_handoff_ready') {
    const customerDocument = normalizeAutoresponderCustomerDocument(purchaseFlowPatch?.customer_data?.cpf_cnpj || purchaseFlowPatch?.cpf_cnpj);
    const documentCustomerData = {
      ...(purchaseFlowPatch.customer_data || {}),
      cpf_cnpj: customerDocument,
    };
    const existingCustomer = await findAutoresponderExistingCustomer(documentCustomerData);
    const nextPurchaseFlow = {
      ...purchaseFlowPatch,
      status: 'customer_registration_ready',
      customer_data: mergeAutoresponderExistingCustomerData(documentCustomerData, existingCustomer),
      existing_customer: existingCustomer,
      cpf_cnpj: customerDocument,
    };
    const customerRecord = await createOrUpdateAutoresponderCustomer(
      nextPurchaseFlow.customer_data || {},
      nextPurchaseFlow,
      senderKey
    );
    const linkedPurchaseFlow = buildAutoresponderCustomerLinkedPurchaseFlow(nextPurchaseFlow, customerRecord);
    const attendantSummary = formatAutoresponderAttendantOrderSummary(linkedPurchaseFlow, senderKey);
    const handoffPurchaseFlow = {
      ...linkedPurchaseFlow,
      attendant_summary: attendantSummary,
      status: 'pedido_em_andamento',
      handoff_created_at: new Date().toISOString(),
    };
    const pauseMinutes = Number(settings.human_pause_minutes) > 0 ? Number(settings.human_pause_minutes) : 60;
    await saveAutoresponderPurchaseFlow(senderKey, handoffPurchaseFlow);
    await logAutoresponderReply({
      sender: senderKey,
      message,
      intent: 'purchase_customer_upserted',
      replyText: purchaseReply.message,
      matchedCount: customerRecord ? 1 : 0,
      matchedProducts: customerRecord ? [customerRecord] : [],
    });
    await logAutoresponderReply({
      sender: senderKey,
      message,
      intent: 'purchase_request',
      replyText: purchaseReply.message,
      matchedCount: 1,
      matchedProducts: [handoffPurchaseFlow],
    });
    await pauseAutoresponderConversationForPurchase(senderKey, pauseMinutes);
    await upsertAutoresponderSuccessConversation(senderKey);
    return { replies: [{ message: purchaseReply.message }] };
  }
  await saveAutoresponderPurchaseFlow(senderKey, purchaseFlowPatch);
  await logAutoresponderReply({
    sender: senderKey,
    message,
    intent: purchaseReply.intent,
    replyText: purchaseReply.message,
    matchedCount: purchaseReply.matchedCount,
    matchedProducts: purchaseReply.matchedProducts,
  });
  await upsertAutoresponderSuccessConversation(senderKey);
  return { replies: [{ message: purchaseReply.message }] };
}

async function handleAutoresponderDeliveryNumberInput({ senderKey, message, purchaseFlow, settings }) {
  const numberData = parseAutoresponderNumberComplement(message);
  if (!numberData) return null;

  const lookup = purchaseFlow.delivery_address_lookup || {};
  const deliveryAddress = {
    cep: normalizeAutoresponderCep(lookup.cep),
    street: lookup.street || '',
    neighborhood: lookup.neighborhood || '',
    city: lookup.city || '',
    state: lookup.state || '',
    number: numberData.number,
    complement: numberData.complement,
  };
  const nextFlow = {
    ...purchaseFlow,
    status: 'awaiting_payment_method',
    fulfillment: 'delivery',
    delivery_address: deliveryAddress,
  };
  const replyText = formatAutoresponderReply(
    `${buildAutoresponderDeliveryAddressSavedReply(nextFlow)}\n\n${buildAutoresponderPaymentMethodPrompt(nextFlow)}`,
    settings,
    false
  );
  await saveAutoresponderPurchaseFlow(senderKey, nextFlow);
  await logAutoresponderReply({
    sender: senderKey,
    message,
    intent: 'purchase_delivery_number_saved',
    replyText,
    matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
    matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
  });
  await upsertAutoresponderSuccessConversation(senderKey);
  return { replies: [{ message: replyText }] };
}

async function getAutoresponderCustomerDataSnapshot(sender, payload = {}, purchaseFlow = {}) {
  const contactState = await getAutoresponderContactNameState(sender);
  const confirmedName = normalizeAutoresponderContactName(
    purchaseFlow?.customer_data?.name ||
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
  const cartTotals = calculateAutoresponderCartTotalsWithShipping(purchaseFlow?.items, purchaseFlow);
  const paymentPlan = await calculateAutoresponderMaxInstallment(cartTotals.total_cents);
  return {
    name: confirmedName || 'nao informado',
    phone: phone || 'nao informado',
    cpf_cnpj: cpfCnpj || null,
    fulfillment: purchaseFlow?.fulfillment || null,
    address: purchaseFlow?.fulfillment === 'delivery'
      ? formatAutoresponderDeliveryAddress(purchaseFlow?.delivery_address)
      : 'Retirada na loja',
    shipping_quote: purchaseFlow?.shipping_quote || null,
    cart_totals: cartTotals,
    payment_plan: purchaseFlow?.selected_payment || paymentPlan,
  };
}

async function lookupAutoresponderCep(cepValue) {
  const cep = normalizeAutoresponderCep(cepValue);
  if (!cep) return null;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        cep,
        street: data.street || '',
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        state: data.state || '',
        lat: Number(data.location?.coordinates?.latitude) || null,
        lng: Number(data.location?.coordinates?.longitude) || null,
      };
    }
  } catch (err) {
    console.warn('[autoresponder] BrasilAPI CEP lookup error:', err.message);
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      cep,
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
      lat: null,
      lng: null,
    };
  } catch (err) {
    console.warn('[autoresponder] ViaCEP lookup error:', err.message);
    return null;
  }
}

function autoresponderCepInRanges(cepValue, ranges = []) {
  const cep = normalizeAutoresponderCep(cepValue);
  if (!cep) return false;
  return (Array.isArray(ranges) ? ranges : []).some((range) => {
    const [from, to] = String(range || '').split(':').map((part) => part.replace(/\D+/g, ''));
    if (!from) return false;
    if (!to) return cep === from;
    return cep >= from && cep <= to;
  });
}

function autoresponderShippingDaysLabel(min, max) {
  const safeMin = Number(min || 0);
  const safeMax = Number(max || safeMin || 0);
  if (safeMin === 0 && safeMax === 0) return 'Hoje';
  if (safeMin === safeMax) return `${safeMin} dia${safeMin > 1 ? 's uteis' : ' util'}`;
  return `${safeMin}-${safeMax} dias uteis`;
}

function autoresponderHaversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function calculateAutoresponderShippingOptions(cepValue, cartItems = [], address = null) {
  const cep = normalizeAutoresponderCep(cepValue);
  if (!cep) return [];
  const totals = calculateAutoresponderCartTotals(cartItems);

  const [[settings]] = await pool.query('SELECT * FROM shipping_settings LIMIT 1');
  if (!settings || settings.local_delivery_enabled === 0) return [];

  const [zones] = await pool.query('SELECT * FROM shipping_zones WHERE enabled = 1 ORDER BY display_order ASC');
  const ranges = await listAutoresponderShippingPriceRanges();
  const rangesByZone = new Map();
  ranges.forEach((range) => {
    const current = rangesByZone.get(range.zone_id) || [];
    current.push(range);
    rangesByZone.set(range.zone_id, current);
  });

  let originAddress = null;
  if (settings.origin_cep) originAddress = await lookupAutoresponderCep(settings.origin_cep);
  const hasCoords = originAddress?.lat && originAddress?.lng && address?.lat && address?.lng;
  const distanceKm = hasCoords
    ? autoresponderHaversineKm(Number(originAddress.lat), Number(originAddress.lng), Number(address.lat), Number(address.lng))
    : null;

  const options = [];
  zones.forEach((zone) => {
    const cities = typeof zone.cities === 'string' ? JSON.parse(zone.cities || '[]') : (zone.cities || []);
    const cepRanges = typeof zone.cep_ranges === 'string' ? JSON.parse(zone.cep_ranges || '[]') : (zone.cep_ranges || []);
    const cityMatch = Array.isArray(cities) && cities.some((city) => normalizeAutoresponderText(city) === normalizeAutoresponderText(address?.city || ''));
    const cepMatch = autoresponderCepInRanges(cep, cepRanges);
    if (!cityMatch && !cepMatch && zone.type !== 'national') return;

    const zoneRanges = rangesByZone.get(zone.id) || [];
    const minOrderFree = Number(zone.min_order_free || 0);
    const meetsFreeOrder = minOrderFree > 0 && totals.subtotal_cents >= minOrderFree;
    const estimatedDaysMin = Number(zone.estimated_days_min || 0);
    const estimatedDaysMax = Number(zone.estimated_days_max || estimatedDaysMin);

    if (zone.type === 'local_free' && (!minOrderFree || meetsFreeOrder)) {
      options.push({
        id: zone.id,
        name: zone.name,
        price: 0,
        isFree: true,
        daysLabel: autoresponderShippingDaysLabel(estimatedDaysMin, estimatedDaysMax),
        type: zone.type,
      });
      return;
    }

    if (zone.type === 'local_paid' && meetsFreeOrder) {
      options.push({
        id: zone.id,
        name: zone.name,
        price: 0,
        isFree: true,
        daysLabel: autoresponderShippingDaysLabel(estimatedDaysMin, estimatedDaysMax),
        type: zone.type,
      });
      return;
    }

    const distanceRange = distanceKm == null ? null : zoneRanges.find((range) => {
      if (!Object.prototype.hasOwnProperty.call(range, 'min_km')) return false;
      const minKm = Number(range.min_km || 0);
      const maxKm = Object.prototype.hasOwnProperty.call(range, 'max_km') ? range.max_km : null;
      return distanceKm >= minKm && (maxKm == null || distanceKm <= Number(maxKm));
    });
    const price = distanceRange
      ? Number(distanceRange.price || 0)
      : zone.fixed_price != null
        ? Number(zone.fixed_price || 0)
        : zone.price_per_km && distanceKm != null
          ? Math.ceil(distanceKm * Number(zone.price_per_km || 0))
          : null;

    if (price == null) return;
    options.push({
      id: zone.id,
      name: distanceRange?.label ? `${zone.name} (${distanceRange.label})` : zone.name,
      price,
      isFree: price <= 0,
      daysLabel: autoresponderShippingDaysLabel(
        distanceRange?.estimated_days_min ?? estimatedDaysMin,
        distanceRange?.estimated_days_max ?? estimatedDaysMax
      ),
      type: zone.type,
    });
  });

  return options.sort((a, b) => {
    if (a.isFree && !b.isFree) return -1;
    if (!a.isFree && b.isFree) return 1;
    return Number(a.price || 0) - Number(b.price || 0);
  });
}

async function listAutoresponderShippingPriceRanges() {
  try {
    const [columns] = await pool.query('SHOW COLUMNS FROM shipping_price_ranges');
    const columnNames = new Set((Array.isArray(columns) ? columns : []).map((column) => String(column.Field || '').toLowerCase()));
    if (!columnNames.has('min_km')) return [];
    const [ranges] = await pool.query('SELECT * FROM shipping_price_ranges ORDER BY min_km ASC');
    return Array.isArray(ranges) ? ranges : [];
  } catch (err) {
    console.warn('[autoresponder] shipping_price_ranges unavailable:', err.message);
    return [];
  }
}

function normalizeAutoresponderCustomerLookupPhone(value) {
  const digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length > 11) return digits.slice(2);
  return digits;
}

function buildAutoresponderCustomerLookupCandidates(customerData = {}) {
  const phone = normalizeAutoresponderCustomerLookupPhone(customerData.phone);
  const cpfCnpj = normalizeAutoresponderCustomerDocument(customerData.cpf_cnpj);
  const email = String(customerData.email || '').trim().toLowerCase();
  const candidates = [];
  if (phone) {
    candidates.push({ field: 'phone', value: phone });
    candidates.push({ field: 'phone', value: `55${phone}` });
  }
  if (cpfCnpj) candidates.push({ field: 'cpf_cnpj', value: cpfCnpj });
  if (email && email.includes('@')) candidates.push({ field: 'email', value: email });

  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.field}:${candidate.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildAutoresponderCustomerLookupFilter(candidates) {
  return candidates
    .map((candidate) => `${candidate.field}.eq.${encodeURIComponent(candidate.value)}`)
    .join(',');
}

function normalizeAutoresponderExistingCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || null,
    cpf_cnpj: normalizeAutoresponderCustomerDocument(row.cpf_cnpj) || null,
    email: row.email || null,
    phone: row.phone || null,
    address: row.address || null,
    is_active: row.is_active == null ? true : Boolean(row.is_active),
  };
}

let autoresponderCompanyIdCache = null;

async function getAutoresponderCompanyId() {
  if (autoresponderCompanyIdCache) return autoresponderCompanyIdCache;
  try {
    const rows = await vpsDbSelect('companies', 'select=id&slug=eq.mercado-do-vale&limit=1');
    autoresponderCompanyIdCache = rows?.[0]?.id || null;
    return autoresponderCompanyIdCache;
  } catch (err) {
    console.warn('[autoresponder] company lookup error:', err.message);
    return null;
  }
}

async function findAutoresponderExistingCustomer(customerData = {}) {
  const candidates = buildAutoresponderCustomerLookupCandidates(customerData);
  if (candidates.length === 0) return null;

  const query = [
    'select=id,name,cpf_cnpj,email,phone,address,is_active',
    `or=(${buildAutoresponderCustomerLookupFilter(candidates)})`,
    'limit=1',
  ].join('&');

  try {
    const rows = await vpsDbSelect('customers', query);
    return normalizeAutoresponderExistingCustomer(rows?.[0]);
  } catch (err) {
    console.warn('[autoresponder] customer lookup error:', err.message);
    return null;
  }
}

function mergeAutoresponderExistingCustomerData(customerData = {}, existingCustomer = null) {
  if (!existingCustomer) return customerData;
  return {
    ...customerData,
    name: existingCustomer.name || customerData.name,
    phone: existingCustomer.phone || customerData.phone,
    cpf_cnpj: existingCustomer.cpf_cnpj || customerData.cpf_cnpj || null,
    email: existingCustomer.email || customerData.email || null,
    existing_customer_id: existingCustomer.id,
  };
}

function buildAutoresponderCustomerAddress(customerData = {}, purchaseFlow = {}) {
  if (purchaseFlow?.fulfillment !== 'delivery') return undefined;
  const address = purchaseFlow?.delivery_address;
  if (address && typeof address === 'object') {
    return {
      street: address.street || '',
      number: address.number || '',
      complement: address.complement || '',
      neighborhood: address.neighborhood || '',
      city: address.city || '',
      state: address.state || '',
      zipCode: normalizeAutoresponderCep(address.cep),
    };
  }
  const addressText = normalizeAutoresponderDeliveryAddress(address || customerData?.address || '');
  if (!addressText || addressText === 'Retirada na loja') return undefined;
  return {
    street: addressText,
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
  };
}

function buildAutoresponderReferralCode(customerId) {
  const hash = String(customerId || '').replace(/-/g, '').slice(0, 5).toUpperCase() || 'WHATS';
  return `MV-${hash}`;
}

async function buildAutoresponderCustomerPayload(customerData = {}, purchaseFlow = {}, sender = '') {
  const companyId = await getAutoresponderCompanyId();
  const name = normalizeAutoresponderContactName(customerData.name);
  const phone = normalizeAutoresponderCustomerLookupPhone(customerData.phone || sender);
  const cpfCnpj = normalizeAutoresponderCustomerDocument(customerData.cpf_cnpj);
  const email = String(customerData.email || '').trim().toLowerCase();
  const address = buildAutoresponderCustomerAddress(customerData, purchaseFlow);

  const payload = {
    name: name && name !== 'nao informado' ? name : 'Cliente WhatsApp',
    cpf_cnpj: cpfCnpj || null,
    phone: phone || null,
    customer_type: 'retail',
    is_active: true,
    custom_data: {
      source: 'whatsapp_autoresponder',
      whatsapp_sender: normalizeAutoresponderSender(sender),
      purchase_flow_status: purchaseFlow?.status || null,
    },
  };

  if (companyId) payload.company_id = companyId;
  if (email && email.includes('@')) payload.email = email;
  if (address) payload.address = address;

  return payload;
}

async function createOrUpdateAutoresponderCustomer(customerData = {}, purchaseFlow = {}, sender = '') {
  const payload = await buildAutoresponderCustomerPayload(customerData, purchaseFlow, sender);
  const existingCustomer = purchaseFlow?.existing_customer || null;

  try {
    if (existingCustomer?.id) {
      const updatePayload = { ...payload };
      delete updatePayload.company_id;
      delete updatePayload.customer_type;
      delete updatePayload.is_active;
      delete updatePayload.custom_data;
      Object.keys(updatePayload).forEach((key) => {
        if (updatePayload[key] == null || updatePayload[key] === '') delete updatePayload[key];
      });
      const rows = await vpsDbPatch('customers', `id=eq.${encodeURIComponent(existingCustomer.id)}`, updatePayload);
      return normalizeAutoresponderExistingCustomer(rows?.[0]) || existingCustomer;
    }

    const newId = crypto.randomUUID();
    const insertPayload = {
      id: newId,
      referral_code: buildAutoresponderReferralCode(newId),
      ...payload,
    };
    const rows = await vpsDbInsert('customers', insertPayload);
    return normalizeAutoresponderExistingCustomer(rows?.[0]);
  } catch (err) {
    console.warn('[autoresponder] customer upsert error:', err.message);
    return existingCustomer || null;
  }
}

function buildAutoresponderCustomerDataConfirmationReply(customerData) {
  const shippingQuote = customerData?.shipping_quote || null;
  const totals = customerData?.cart_totals || null;
  const lines = [
    'Confirme os dados do pedido:',
    `Nome: ${customerData?.name || 'nao informado'}`,
    `Telefone: ${customerData?.phone || 'nao informado'}`,
    `Endereco: ${customerData?.address || 'Retirada na loja'}`,
  ];
  if (shippingQuote) {
    lines.push(`Frete: ${shippingQuote.isFree ? 'Gratis' : formatAutoresponderCurrency(Number(shippingQuote.price || 0))}`);
  }
  if (totals) {
    lines.push(`Total com frete: ${formatAutoresponderCurrency(Number(totals.total_cents || 0) / 100)}`);
  }
  const paymentLine = formatAutoresponderCartPaymentLine(customerData?.payment_plan);
  if (paymentLine) lines.push(paymentLine);
  lines.push('');
  lines.push('Esta tudo certo? Responda "sim" para confirmar ou "nao" para ajustar com um atendente.');
  return lines.join('\n');
}

function buildAutoresponderCustomerDataConfirmedReply(settings = null, sender = '') {
  return getAutoresponderToneMessage(settings, sender, 'orderConfirmed', 'Dados confirmados. Vou separar o pedido para um atendente finalizar com voce.');
}

function formatAutoresponderAttendantOrderSummary(purchaseFlow = {}, sender = '') {
  const customer = purchaseFlow.customer_record || purchaseFlow.existing_customer || {};
  const customerData = purchaseFlow.customer_data || {};
  const totals = calculateAutoresponderCartTotalsWithShipping(purchaseFlow.items, purchaseFlow);
  const selectedPayment = purchaseFlow.selected_payment || purchaseFlow.payment_plan || null;
  const lines = [
    'Pedido WhatsApp - fechamento assistido',
    `Cliente: ${customer.name || customerData.name || 'nao informado'}`,
    `Telefone: ${customer.phone || customerData.phone || sender || 'nao informado'}`,
    `CPF/CNPJ: ${customer.cpf_cnpj || customerData.cpf_cnpj || 'nao informado'}`,
    `Cliente ID: ${purchaseFlow.customer_id || customer.id || 'nao vinculado'}`,
    '',
    'Itens:',
  ];

  (Array.isArray(purchaseFlow.items) ? purchaseFlow.items : []).forEach((item, index) => {
    const quantity = Number(item?.quantity || 0);
    const name = item?.name || 'produto';
    const unitPrice = formatAutoresponderCurrency(Number(item?.unit_price_cents || 0) / 100);
    const subtotal = formatAutoresponderCurrency(Number(item?.subtotal_cents || 0) / 100);
    lines.push(`${index + 1}. ${quantity}x ${name} - ${unitPrice} cada - Subtotal: ${subtotal}`);
  });

  lines.push('');
  lines.push(`Subtotal: ${formatAutoresponderCurrency(Number(totals.subtotal_cents || 0) / 100)}`);
  if (Number(totals.shipping_cents || 0) > 0) {
    lines.push(`Frete: ${formatAutoresponderCurrency(Number(totals.shipping_cents || 0) / 100)}`);
  }
  lines.push(`Total: ${formatAutoresponderCurrency(Number(totals.total_cents || 0) / 100)}`);

  if (selectedPayment?.installments) {
    lines.push(`Pagamento: Cartao em ${selectedPayment.installments}x de ${formatAutoresponderCurrency(Number(selectedPayment.value_cents || selectedPayment.value || 0) / 100)}`);
    if (Number(selectedPayment.entry_cents || 0) > 0) {
      lines.push(`Entrada: ${formatAutoresponderCurrency(Number(selectedPayment.entry_cents || 0) / 100)}`);
    }
    lines.push(`Total no cartao: ${formatAutoresponderCurrency(Number(selectedPayment.total_cents || selectedPayment.total || 0) / 100)}`);
  } else if (selectedPayment?.method) {
    lines.push(`Pagamento: ${selectedPayment.label || selectedPayment.method}`);
    lines.push(`Total a vista: ${formatAutoresponderCurrency(Number(selectedPayment.total_cents || totals.total_cents || 0) / 100)}`);
  } else {
    lines.push('Pagamento: nao escolhido');
  }

  lines.push(`Entrega/retirada: ${purchaseFlow.fulfillment === 'delivery' ? 'Entrega' : 'Retirada na loja'}`);
  if (purchaseFlow.fulfillment === 'delivery') {
    lines.push(`Endereco: ${formatAutoresponderDeliveryAddress(purchaseFlow.delivery_address)}`);
  }
  lines.push(`Observacoes: origem WhatsApp AutoResponder; sender ${sender || 'nao informado'}`);
  return lines.join('\n');
}

function buildAutoresponderCustomerOrderHandoffReply(settings = null, sender = '') {
  return getAutoresponderToneMessage(settings, sender, 'orderHandoff', 'Seu pedido foi separado para um atendente finalizar com voce. Vou pausar o bot por aqui para nossa equipe continuar o atendimento.');
}

function buildAutoresponderCustomerLinkedPurchaseFlow(purchaseFlow = {}, customerRecord = null) {
  return {
    ...purchaseFlow,
    status: 'customer_record_ready',
    customer_id: customerRecord?.id || purchaseFlow?.customer_id || null,
    customer_record: customerRecord,
    customer_linked_at: new Date().toISOString(),
  };
}

async function pauseAutoresponderConversationForPurchase(sender, pauseMinutes = 60) {
  const minutes = Number(pauseMinutes) > 0 ? Number(pauseMinutes) : 60;
  await pool.query(
    `INSERT INTO autoresponder_conversations
      (sender, last_message_at, last_bot_reply_at, total_messages, paused_until, pause_reason)
     VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, DATE_ADD(NOW(), INTERVAL ? MINUTE), 'pedido_em_andamento')
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       last_bot_reply_at = CURRENT_TIMESTAMP,
       total_messages = total_messages + 1,
       paused_until = DATE_ADD(NOW(), INTERVAL ? MINUTE),
       pause_reason = 'pedido_em_andamento'`,
    [sender, minutes, minutes]
  );
}

function buildAutoresponderCustomerDataNeedsUpdateReply() {
  return 'Sem problema. Vou deixar marcado para um atendente ajustar seus dados antes de finalizar.';
}

function hasAutoresponderRepeatedDigitsOnly(digits) {
  return /^(\d)\1+$/.test(String(digits || ''));
}

function validateAutoresponderCpf(digits) {
  if (!/^\d{11}$/.test(digits) || hasAutoresponderRepeatedDigitsOnly(digits)) return false;

  const calculateDigit = (baseLength) => {
    let sum = 0;
    for (let i = 0; i < baseLength; i += 1) {
      sum += Number(digits[i]) * (baseLength + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10]);
}

function validateAutoresponderCnpj(digits) {
  if (!/^\d{14}$/.test(digits) || hasAutoresponderRepeatedDigitsOnly(digits)) return false;

  const calculateDigit = (baseLength) => {
    const weights = baseLength === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calculateDigit(12) === Number(digits[12]) && calculateDigit(13) === Number(digits[13]);
}

function normalizeAutoresponderCustomerDocument(message) {
  const digits = String(message || '').replace(/\D+/g, '');
  if (digits.length === 11 && validateAutoresponderCpf(digits)) return digits;
  if (digits.length === 14 && validateAutoresponderCnpj(digits)) return digits;
  return '';
}

function buildAutoresponderCustomerDocumentPrompt() {
  return 'Para completar o cadastro, me envie o CPF/CNPJ do cliente. Pode mandar apenas os numeros.';
}

function buildAutoresponderCustomerDocumentSavedReply() {
  return 'Dados minimos do cadastro anotados. Vou separar o pedido para um atendente finalizar com voce.';
}

async function findAutoresponderProductsByTag(tagId, limit = 5, offset = 0) {
  const safeLimit = getAutoresponderProductQueryLimit(limit);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const numericTagId = Number(tagId);
  const [rows] = await pool.query(
    `SELECT id, model_id, category_id, brand, name, sku, slug, price_retail, price_promo, stock_quantity, specs, custom_fields,
       warranty_type, warranty_template_id,
       (SELECT name FROM brands WHERE CAST(brands.id AS CHAR) = products.brand OR brands.name = products.brand LIMIT 1) AS brand_name,
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
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 100);
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
  const safeLimit = getAutoresponderProductQueryLimit(limit);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const [rows] = await pool.query(
    `SELECT id, model_id, category_id, brand, name, sku, slug, price_retail, price_promo, stock_quantity, specs, custom_fields,
       warranty_type, warranty_template_id,
       (SELECT name FROM brands WHERE CAST(brands.id AS CHAR) = products.brand OR brands.name = products.brand LIMIT 1) AS brand_name,
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

async function findAutoresponderProductsByCategoryBudget(categoryId, budgetCents, limit = 5, offset = 0) {
  const safeLimit = getAutoresponderProductQueryLimit(limit);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const safeBudget = Math.max(Math.round(Number(budgetCents) || 0), 0);
  if (!categoryId || safeBudget <= 0) return [];
  const [rows] = await pool.query(
    `SELECT id, model_id, category_id, brand, name, sku, slug, price_retail, price_promo, stock_quantity, specs, custom_fields,
       warranty_type, warranty_template_id,
       (SELECT name FROM brands WHERE CAST(brands.id AS CHAR) = products.brand OR brands.name = products.brand LIMIT 1) AS brand_name,
       (SELECT warranty_days FROM brands WHERE CAST(brands.id AS CHAR) = products.brand OR brands.name = products.brand LIMIT 1) AS brand_warranty_days,
       (SELECT warranty_days FROM categories WHERE categories.id = products.category_id LIMIT 1) AS category_warranty_days,
       JSON_UNQUOTE(JSON_EXTRACT(images, '$[0]')) AS imageUrl
     FROM products
     WHERE status = 'active'
       AND (is_parent = 0 OR is_parent IS NULL)
       AND stock_quantity > 0
       AND category_id = ?
       AND COALESCE(NULLIF(price_promo, 0), price_retail) <= ?
     ORDER BY COALESCE(NULLIF(price_promo, 0), price_retail) DESC, updated_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [categoryId, safeBudget]
  );
  return rows;
}

async function countAutoresponderProductsByCategoryBudget(categoryId, budgetCents) {
  const safeBudget = Math.max(Math.round(Number(budgetCents) || 0), 0);
  if (!categoryId || safeBudget <= 0) return 0;
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM products
     WHERE status = 'active'
       AND (is_parent = 0 OR is_parent IS NULL)
       AND stock_quantity > 0
       AND category_id = ?
       AND COALESCE(NULLIF(price_promo, 0), price_retail) <= ?`,
    [categoryId, safeBudget]
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

function normalizeAutoresponderPriceCents(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount);
}

function getAutoresponderProductPrice(product) {
  return getAutoresponderProductPriceCents(product) / 100;
}

function getAutoresponderProductPriceCents(product) {
  const promoPrice = normalizeAutoresponderPriceCents(product?.price_promo);
  const retailPrice = normalizeAutoresponderPriceCents(product?.price_retail);
  return promoPrice > 0 ? promoPrice : retailPrice;
}

function getAutoresponderProductGroupKey(product) {
  const groupId = product?.model_id || product?.id;
  return String(groupId || '').trim();
}

function getAutoresponderProductBrandName(product) {
  const rawBrand = product?.brand_name || product?.brandName || product?.brand || '';
  return String(rawBrand || '').trim() || 'Outras marcas';
}

function sortAutoresponderProductGroupsByBrand(groups) {
  return [...(Array.isArray(groups) ? groups : [])].sort((a, b) => {
    const brandCompare = normalizeAutoresponderText(a?.brandName)
      .localeCompare(normalizeAutoresponderText(b?.brandName), 'pt-BR');
    if (brandCompare !== 0) return brandCompare;
    return normalizeAutoresponderText(a?.name).localeCompare(normalizeAutoresponderText(b?.name), 'pt-BR');
  });
}

function formatAutoresponderProductBrandHeading(brandName) {
  return String(brandName || 'Outras marcas').trim();
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

function getAutoresponderRequestedInstallments(message) {
  const text = normalizeAutoresponderText(message).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const patterns = [
    /\bem\s+(\d{1,2})\s*x\b/,
    /\b(\d{1,2})\s*x\b/,
    /\b(\d{1,2})\s+vezes\b/,
    /\bparcela(?:r|s)?\s+(?:em\s+)?(\d{1,2})\b/,
    /\bdivide\s+(?:em\s+)?(\d{1,2})\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const installments = Number(match[1]);
    if (Number.isInteger(installments) && installments >= 1 && installments <= 12) return installments;
  }
  if (/\b(parcelamento|parcelas|parcelar|cartao|cartao de credito)\b/.test(text)) return 12;
  return null;
}

function isAutoresponderInstallmentChoiceRequest(message) {
  const text = normalizeAutoresponderText(message).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return /\b(quero|vou querer|escolho|pode ser|fecha|fechar|fechado|combinado|deixa|coloca|bota)\b/.test(text)
    && /\b(\d{1,2}\s*x|\d{1,2}\s+vezes|parcelar|parcelas|cartao)\b/.test(text);
}

async function calculateAutoresponderInstallmentOptions(priceCents, maxInstallments = 12) {
  const safePriceCents = Math.max(Math.round(Number(priceCents) || 0), 0);
  const safeMaxInstallments = Math.min(Math.max(Number(maxInstallments) || 12, 1), 12);
  if (safePriceCents <= 0) return [];

  let feesByInstallment = new Map();
  try {
    const [rows] = await pool.query(
      `SELECT installments, applied_fee_pct
       FROM payment_fees
       WHERE channel = ?
         AND installments BETWEEN 2 AND ?
       ORDER BY installments ASC, applied_fee_pct ASC`,
      ['presencial', safeMaxInstallments]
    );
    feesByInstallment = rows.reduce((map, row) => {
      const installments = Number(row.installments || 0);
      if (!Number.isInteger(installments) || installments < 2) return map;
      if (!map.has(installments)) map.set(installments, Number(row.applied_fee_pct || 0));
      return map;
    }, new Map());
  } catch (err) {
    console.warn('[autoresponder] installment table calculation skipped:', err.message);
  }

  return Array.from({ length: safeMaxInstallments }, (_, index) => {
    const installments = index + 1;
    const appliedFeePct = installments === 1 ? 0 : Number(feesByInstallment.get(installments) || 0);
    const total = Math.round(safePriceCents * (1 + appliedFeePct / 100));
    return {
      installments,
      value: Math.round(total / installments),
      total,
      appliedFeePct,
    };
  });
}

function formatAutoresponderInstallmentLine(plan) {
  if (!plan?.installments || !plan?.value) return '';
  return `Parcelamento: ate ${plan.installments}x de ${formatAutoresponderCurrency(plan.value / 100)}`;
}

function getAutoresponderCheapestProduct(products) {
  const available = filterAutoresponderAvailableProducts(products);
  return available
    .slice()
    .sort((a, b) => getAutoresponderProductPriceCents(a) - getAutoresponderProductPriceCents(b))[0]
    || available[0]
    || null;
}

function normalizeAutoresponderMemoryLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const compact = text.replace(/\s+/g, '').toUpperCase();
  const match = compact.match(/^(\d+(?:GB|G|TB|T))$/i);
  if (!match) return text;
  return compact
    .replace(/(\d+)G$/i, '$1GB')
    .replace(/(\d+)T$/i, '$1TB');
}

function getAutoresponderProductVariationLabel(product) {
  const specs = parsePublicJson(product?.specs, product?.specs || {}) || {};
  const customFields = parsePublicJson(product?.custom_fields, product?.custom_fields || {}) || {};
  const ram = normalizeAutoresponderMemoryLabel(
    specs.ram || specs.memoria_ram || specs.memory_ram || customFields.ram || customFields.memoria_ram
  );
  const storage = normalizeAutoresponderMemoryLabel(
    specs.storage || specs.armazenamento || specs.memoria || specs.capacity || customFields.storage || customFields.armazenamento || customFields.memoria || customFields.capacity
  );
  if (ram && storage) return `${ram}/${storage}`;

  const explicitVersion = String(specs.version || specs.versao || customFields.version || customFields.versao || '').trim();
  if (explicitVersion) return explicitVersion;

  const name = String(product?.name || '');
  const slashMatch = name.match(/\b(\d+\s*(?:gb|g|tb|t))\s*\/\s*(\d+\s*(?:gb|g|tb|t))\b/i);
  if (slashMatch) {
    return `${normalizeAutoresponderMemoryLabel(slashMatch[1])}/${normalizeAutoresponderMemoryLabel(slashMatch[2])}`;
  }
  const pairMatch = name.match(/\b(\d+\s*(?:gb|g))\s+(?:ram\s+)?(\d+\s*(?:gb|g|tb|t))\b/i);
  if (pairMatch) {
    return `${normalizeAutoresponderMemoryLabel(pairMatch[1])}/${normalizeAutoresponderMemoryLabel(pairMatch[2])}`;
  }
  return '';
}

async function formatAutoresponderProductCardPaymentLine(product) {
  const priceCents = getAutoresponderProductPriceCents(product);
  const options = await calculateAutoresponderInstallmentOptions(priceCents, 12);
  const plan = options.find((option) => Number(option.installments) === 12) || options[options.length - 1];
  if (!plan?.installments || !plan?.value || !plan?.total) return '';
  return `💳 Cartao: ${plan.installments}x de ${formatAutoresponderCurrency(plan.value / 100)} (total ${formatAutoresponderCurrency(plan.total / 100)})`;
}

async function formatAutoresponderProductCardLine(group, number) {
  const product = getAutoresponderCheapestProduct(group?.products) || group?.representative || {};
  const variationLabel = getAutoresponderProductVariationLabel(product);
  const paymentLine = await formatAutoresponderProductCardPaymentLine(product);
  const productUrl = getAutoresponderProductUrl(product);
  const lines = [
    `${number}. ${group?.name || product?.name || 'Produto'}`,
  ];
  if (variationLabel) lines.push(`📱 ${variationLabel}`);
  lines.push(`💰 ${group?.priceRange || formatAutoresponderCurrency(getAutoresponderProductPrice(product))} à vista no PIX`);
  if (paymentLine) lines.push(paymentLine);
  if (Array.isArray(group?.colors) && group.colors.length > 0) {
    lines.push(`🎨 Cores: ${group.colors.join(', ')}`);
  }
  if (productUrl) {
    lines.push('🔗 Ver produto:');
    lines.push(productUrl);
  }
  return lines.join('\n');
}

function buildAutoresponderSelectedInstallmentPayment(requestedInstallments, installmentOptions, totalCents) {
  const options = Array.isArray(installmentOptions) ? installmentOptions : [];
  const selectedOption = options.find((option) => Number(option.installments) === Number(requestedInstallments));
  if (!selectedOption) return null;
  return {
    method: 'credit',
    installments: Number(selectedOption.installments),
    value_cents: Number(selectedOption.value || 0),
    total_cents: Number(selectedOption.total || 0),
    base_total_cents: Number(totalCents || 0),
    entry_cents: Number(selectedOption.entry_cents || 0),
    card_base_cents: Number(selectedOption.card_base_cents || totalCents || 0),
    applied_fee_pct: Number(selectedOption.appliedFeePct || 0),
    label: `Cartao em ${selectedOption.installments}x de ${formatAutoresponderCurrency(Number(selectedOption.value || 0) / 100)}`,
  };
}

function buildAutoresponderSelectedInstallmentReply(selectedPayment) {
  if (!selectedPayment) {
    return 'Nao consegui confirmar essa parcela agora. Me diga novamente em quantas vezes voce quer fazer.';
  }
  return [
    'Combinado, deixei o pagamento como:',
    `Cartao em ${selectedPayment.installments}x de ${formatAutoresponderCurrency(Number(selectedPayment.value_cents || 0) / 100)}`,
    Number(selectedPayment.entry_cents || 0) > 0 ? `Entrada: ${formatAutoresponderCurrency(Number(selectedPayment.entry_cents || 0) / 100)}` : '',
    `Total no cartao: ${formatAutoresponderCurrency(Number(selectedPayment.total_cents || 0) / 100)}`,
    '',
    'Agora vou confirmar os dados do cadastro para separar seu pedido.',
  ].filter(Boolean).join('\n');
}

function buildAutoresponderPaymentMethodPrompt(purchaseFlow = {}) {
  const totals = calculateAutoresponderCartTotalsWithShipping(purchaseFlow.items, purchaseFlow);
  return [
    'Como prefere pagar? Pix, dinheiro, debito ou cartao de credito?',
    '',
    `Total a vista: ${formatAutoresponderCurrency(Number(totals.total_cents || 0) / 100)}`,
  ].join('\n');
}

function getAutoresponderPaymentMethodChoice(message) {
  const text = normalizeAutoresponderText(message).trim();
  if (/\b(pix)\b/.test(text)) return 'pix';
  if (/\b(dinheiro|especie)\b/.test(text)) return 'cash';
  if (/\b(debito|cartao de debito)\b/.test(text)) return 'debit';
  if (/\b(credito|cartao|cartao de credito|parcelado|parcelar)\b/.test(text)) return 'credit';
  return null;
}

function buildAutoresponderCashPaymentSelectedReply(method, purchaseFlow = {}) {
  const labels = {
    pix: 'Pix',
    cash: 'dinheiro',
    debit: 'debito',
  };
  const totals = calculateAutoresponderCartTotalsWithShipping(purchaseFlow.items, purchaseFlow);
  return [
    `Combinado, deixei o pagamento como ${labels[method] || 'a vista'}.`,
    `Total a vista: ${formatAutoresponderCurrency(Number(totals.total_cents || 0) / 100)}`,
    '',
    'Agora vou confirmar os dados do cadastro para separar seu pedido.',
  ].join('\n');
}

function buildAutoresponderCardEntryPrompt(purchaseFlow = {}) {
  const totals = calculateAutoresponderCartTotalsWithShipping(purchaseFlow.items, purchaseFlow);
  return [
    'Vai ter entrada para abater antes de parcelar no cartao?',
    '',
    `Total do pedido: ${formatAutoresponderCurrency(Number(totals.total_cents || 0) / 100)}`,
    '',
    'Se tiver, envie o valor da entrada. Ex: 200',
    'Se nao tiver entrada, responda "sem entrada".',
  ].join('\n');
}

function parseAutoresponderPaymentEntryCents(message, totalCents = 0) {
  const text = normalizeAutoresponderText(message).trim();
  if (/^(sem entrada|nao|não|0|zero)$/.test(text)) return 0;
  const raw = String(message || '').replace(/[^\d,\.]/g, '').trim();
  if (!raw) return null;
  let normalized = raw;
  if (raw.includes(',') && raw.includes('.')) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (raw.includes(',')) {
    normalized = raw.replace(',', '.');
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const cents = Math.round(amount * 100);
  const safeTotal = Math.max(Math.round(Number(totalCents) || 0), 0);
  if (safeTotal > 0 && cents >= safeTotal) return safeTotal;
  return cents;
}

function attachAutoresponderEntryToInstallments(options, entryCents, cardBaseCents) {
  return (Array.isArray(options) ? options : []).map((option) => ({
    ...option,
    entry_cents: Math.max(Math.round(Number(entryCents) || 0), 0),
    card_base_cents: Math.max(Math.round(Number(cardBaseCents) || 0), 0),
  }));
}

function buildAutoresponderInstallmentTableReply(installmentOptions, totalCents = 0, entryCents = 0) {
  const options = Array.isArray(installmentOptions) ? installmentOptions : [];
  const cardBaseCents = Math.max(Number(totalCents || 0) - Number(entryCents || 0), 0);
  const lines = [
    'Tabela do cartao',
    `Total do pedido: ${formatAutoresponderCurrency(Number(totalCents || 0) / 100)}`,
  ];
  if (Number(entryCents || 0) > 0) {
    lines.push(`Entrada: ${formatAutoresponderCurrency(Number(entryCents || 0) / 100)}`);
  }
  lines.push(`Valor no cartao: ${formatAutoresponderCurrency(cardBaseCents / 100)}`);
  lines.push('');
  options.forEach((option) => {
    lines.push(`${option.installments}x de ${formatAutoresponderCurrency(Number(option.value || 0) / 100)} = ${formatAutoresponderCurrency(Number(option.total || 0) / 100)}`);
  });
  lines.push('');
  lines.push('Responda com a parcela escolhida. Ex: 5x');
  return lines.join('\n');
}

function formatAutoresponderSpecificInstallmentReply(requestedInstallments, installmentOptions, totalCents) {
  const options = Array.isArray(installmentOptions) ? installmentOptions : [];
  const requestedOption = options.find((option) => Number(option.installments) === Number(requestedInstallments))
    || options[options.length - 1];
  const lines = [
    'Parcelamento do carrinho',
    `Total base: ${formatAutoresponderCurrency(Number(totalCents || 0) / 100)}`,
  ];

  if (requestedOption) {
    lines.push('');
    lines.push(`Em ${requestedOption.installments}x fica ${formatAutoresponderCurrency(requestedOption.value / 100)} = ${formatAutoresponderCurrency(requestedOption.total / 100)}`);
  }

  lines.push('');
  lines.push('Tabela completa:');
  options.forEach((option) => {
    lines.push(`${option.installments}x de ${formatAutoresponderCurrency(option.value / 100)} = ${formatAutoresponderCurrency(option.total / 100)}`);
  });
  return lines.join('\n');
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
      brandName: getAutoresponderProductBrandName(representative),
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
  return '';
}

const AUTORESPONDER_COMPLETE_PRODUCT_LIST_WORDS = new Set([
  'celular',
  'celulares',
  'smartphone',
  'smartphones',
  'tablet',
  'tablets',
  'tablte',
  'tabltes',
  'receptor',
  'receptores',
]);

function isAutoresponderCompleteProductListKeyword(keyword) {
  const text = normalizeAutoresponderText(keyword)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /\b(lista completa|catalogo completo|todos os modelos|todas as opcoes|ver tudo|mostrar tudo)\b/.test(text);
}

function getAutoresponderProductQueryLimit(limit) {
  const safeLimit = Math.max(Number(limit) || AUTORESPONDER_PRODUCT_PAGE_SIZE, 1);
  const maxLimit = safeLimit > AUTORESPONDER_PRODUCT_RESPONSE_LIMIT
    ? AUTORESPONDER_COMPLETE_PRODUCT_RESPONSE_LIMIT
    : AUTORESPONDER_PRODUCT_RESPONSE_LIMIT;
  return Math.min(safeLimit, maxLimit);
}

const AUTORESPONDER_ACCESSORY_SEARCH_WORDS = [
  'acessorio', 'acessorios', 'capa', 'capas', 'capinha', 'capinhas',
  'pelicula', 'peliculas', 'case', 'cases', 'carregador', 'cabo', 'cabos',
  'fonte', 'fontes', 'controle', 'controles', 'suporte', 'suportes',
  'antena', 'antenas', 'adaptador', 'adaptadores', 'vidro', 'lente',
];

function detectAutoresponderDeviceFamilyFromSearch(keyword) {
  const text = normalizeAutoresponderText(keyword).trim();
  if (!text) return null;
  if (/\b(tablet|tablets|tab|pad|ipad)\b/.test(text) || text.includes('redmi pad') || text.includes('galaxy tab')) {
    return 'tablet';
  }
  if (/\b(receptor|receptores|btv|htv|azamerica|cinebox|duosat|globalsat|gosat|tocom)\b/.test(text) || text.includes('az america')) {
    return 'receptor';
  }
  if (/\b(celular|celulares|smartphone|smartphones|iphone|iphones|xiaomi|redmi|poco|galaxy|motorola|moto|samsung)\b/.test(text)) {
    return 'smartphone';
  }
  return null;
}

function isAutoresponderAccessorySearchKeyword(keyword) {
  const text = normalizeAutoresponderText(keyword).trim();
  return AUTORESPONDER_ACCESSORY_SEARCH_WORDS.some((word) => text.includes(word));
}

function isAutoresponderAccessoryProduct(product) {
  const baseProduct = product?.representative || product || {};
  const text = normalizeAutoresponderText([
    baseProduct.name,
    baseProduct.category_name,
    baseProduct.categoryName,
    baseProduct.specs,
    baseProduct.custom_fields,
  ].filter(Boolean).join(' '));
  return AUTORESPONDER_ACCESSORY_SEARCH_WORDS.some((word) => text.includes(word));
}

function buildAutoresponderModelAccessorySearchTitle(products, keyword, total) {
  const family = detectAutoresponderDeviceFamilyFromSearch(keyword);
  if (!family || isAutoresponderAccessorySearchKeyword(keyword)) return null;
  const safeProducts = Array.isArray(products) ? products : [];
  if (!safeProducts.some((product) => isAutoresponderAccessoryProduct(product))) return null;

  const modelText = String(keyword || '').trim();
  const count = Math.max(Number(total) || safeProducts.length, safeProducts.length);
  const intro = modelText
    ? `Para ${modelText}, encontrei ${count} itens relacionados no sistema.`
    : `Encontrei ${count} itens relacionados no sistema.`;
  const accessoryLineByFamily = {
    smartphone: 'Encontramos alguns acessorios para esse smartphone:',
    tablet: 'Encontramos alguns acessorios para esse tablet:',
    receptor: 'Encontramos alguns acessorios para esse receptor:',
  };
  return `${intro}\n${accessoryLineByFamily[family]}`;
}

function splitAutoresponderModelAccessoryGroups(groupedProducts, keyword) {
  const safeGroups = Array.isArray(groupedProducts) ? groupedProducts : [];
  const family = detectAutoresponderDeviceFamilyFromSearch(keyword);
  if (!family || isAutoresponderAccessorySearchKeyword(keyword)) {
    return { primaryGroups: safeGroups, accessoryGroups: [] };
  }
  const primaryGroups = [];
  const accessoryGroups = [];
  for (const group of safeGroups) {
    const products = Array.isArray(group?.products) ? group.products : [group?.representative].filter(Boolean);
    const accessory = products.some((product) => isAutoresponderAccessoryProduct(product));
    if (accessory) accessoryGroups.push(group);
    else primaryGroups.push(group);
  }
  if (primaryGroups.length === 0 || accessoryGroups.length === 0) {
    return { primaryGroups: safeGroups, accessoryGroups: [] };
  }
  return { primaryGroups, accessoryGroups };
}

async function buildAutoresponderModelAccessoryFollowUpReplies(accessoryGroups, keyword, numberOffset = 0) {
  const safeGroups = Array.isArray(accessoryGroups) ? accessoryGroups : [];
  if (safeGroups.length === 0) return [];
  const chunks = chunkAutoresponderArray(safeGroups, AUTORESPONDER_PRODUCT_PAGE_SIZE);
  const replies = [];
  let previousBrandName = '';
  for (const [chunkIndex, chunk] of chunks.entries()) {
    const firstNumber = Number(numberOffset || 0) + (chunkIndex * AUTORESPONDER_PRODUCT_PAGE_SIZE) + 1;
    const lines = [chunkIndex === 0 ? 'Encontramos tambem capinha para ele:' : 'Mais acessorios compativeis:'];
    const cardLines = await Promise.all(chunk.map((group, index) => (
      formatAutoresponderProductCardLine(group, firstNumber + index)
    )));
    for (const [index, group] of chunk.entries()) {
      const brandName = group?.brandName || 'Outras marcas';
      if (brandName !== previousBrandName) {
        lines.push(formatAutoresponderProductBrandHeading(brandName));
        previousBrandName = brandName;
      }
      lines.push(cardLines[index]);
    }
    replies.push(lines.join('\n\n'));
  }
  return replies;
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

function isAutoresponderXiaomiBrand(brandName) {
  const text = normalizeAutoresponderText(brandName);
  return /\b(xiaomi|redmi|poco)\b/.test(text);
}

function isAutoresponderRealmeBrand(brandName) {
  return /\brealme\b/.test(normalizeAutoresponderText(brandName));
}

function formatAutoresponderProductWarrantyLine(product) {
  const productWarrantyType = String(product?.warranty_type || 'brand').toLowerCase();
  const brandName = String(product?.brand || '').trim();
  const brandPeriod = formatAutoresponderWarrantyPeriod(product?.brand_warranty_days);
  const categoryPeriod = formatAutoresponderWarrantyPeriod(product?.category_warranty_days);
  const period = categoryPeriod || brandPeriod;

  if (productWarrantyType === 'custom' || productWarrantyType === 'template' || product?.warranty_template_id) {
    return 'Garantia: conforme termo configurado neste produto.';
  }

  if (productWarrantyType === 'none' || productWarrantyType === 'sem_garantia') {
    return 'Garantia: consulte um atendente para confirmar a cobertura deste produto.';
  }

  if (productWarrantyType === 'category') {
    return `Garantia: ${categoryPeriod ? `${categoryPeriod} conforme configuracao deste produto` : 'conforme configuracao deste produto'}`;
  }

  if (isAutoresponderXiaomiBrand(brandName)) {
    return `Garantia: ${period ? `${period} pela loja` : 'pela loja'}`;
  }

  if (isAutoresponderRealmeBrand(brandName)) {
    return `Garantia: ${period ? `${period} pelo fabricante` : 'pelo fabricante'}`;
  }

  if (productWarrantyType === 'store' || productWarrantyType === 'loja') {
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
  const lines = ['vamos ficar com qual deles hoje? quer ver a lista completa?'];
  if (hasMore) {
    lines.push('Se quiser ver mais opcoes, digite "mais".');
  }
  return lines.join('\n');
}

function getAutoresponderInitialProductPageSize(keyword = '') {
  return isAutoresponderCompleteProductListKeyword(keyword)
    ? AUTORESPONDER_COMPLETE_PRODUCT_RESPONSE_LIMIT
    : AUTORESPONDER_PRODUCT_PAGE_SIZE;
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
    .map((message, index) => ({
      message,
      delaySeconds: AUTORESPONDER_REPLY_DELAY_SCHEDULE_SECONDS[index]
        ?? AUTORESPONDER_REPLY_DELAY_SCHEDULE_SECONDS[AUTORESPONDER_REPLY_DELAY_SCHEDULE_SECONDS.length - 1] + ((index - AUTORESPONDER_REPLY_DELAY_SCHEDULE_SECONDS.length + 1) * 16),
    }));
}

function formatAutoresponderReplies(replyMessages, settings, shouldPrefixGreeting) {
  const messages = (Array.isArray(replyMessages) ? replyMessages : [replyMessages])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (messages.length === 0) return [];
  const formatted = [
    applyAutoresponderGreetingPrefix(messages[0], settings, shouldPrefixGreeting),
    ...messages.slice(1),
  ];
  formatted[formatted.length - 1] = appendAutoresponderSignatureMessage(formatted[formatted.length - 1], settings);
  return formatted;
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

  const groupedProducts = sortAutoresponderProductGroupsByBrand(groupAutoresponderProductsByModel(availableProducts));
  const isCompleteList = Boolean(pagination?.completeList);
  const splitGroups = splitAutoresponderModelAccessoryGroups(groupedProducts, keyword);
  const primaryGroups = splitGroups.primaryGroups;
  const accessoryGroups = splitGroups.accessoryGroups;
  const total = pagination?.total || groupedProducts.length;
  const offset = Number(pagination?.offset || 0);
  const chunks = chunkAutoresponderArray(primaryGroups, AUTORESPONDER_PRODUCT_PAGE_SIZE);
  const visibleChunks = isCompleteList
    ? chunks
    : chunks.slice(0, AUTORESPONDER_MAX_PRODUCT_REPLY_MESSAGES);
  const replies = [];
  let previousBrandName = '';
  for (const [chunkIndex, chunk] of visibleChunks.entries()) {
    const firstNumber = offset + (chunkIndex * AUTORESPONDER_PRODUCT_PAGE_SIZE) + 1;
    const title = chunkIndex === 0
      ? (keyword
        ? `Encontrei estas opcoes para ${keyword}:`
        : 'Encontrei estas opcoes:')
      : 'Mais opcoes:';
    const lines = [title];
    const cardLines = await Promise.all(chunk.map((group, index) => (
      formatAutoresponderProductCardLine(group, firstNumber + index)
    )));
    for (const [index, group] of chunk.entries()) {
      const brandName = group?.brandName || 'Outras marcas';
      if (brandName !== previousBrandName) {
        lines.push(formatAutoresponderProductBrandHeading(brandName));
        previousBrandName = brandName;
      }
      lines.push(cardLines[index]);
    }
    replies.push(lines.join('\n\n'));
  }
  replies.push(...await buildAutoresponderModelAccessoryFollowUpReplies(accessoryGroups, keyword, offset + primaryGroups.length));

  if (replies.length > 0 && (groupedProducts.length > 1 || safeProducts.length > groupedProducts.length)) {
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
  if (!isCompleteList && replies.length > 0) {
    replies[replies.length - 1] = `${replies[replies.length - 1]}\n\nEra isso que voce estava procurando?`;
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
    storeStatusRequest: isAutoresponderStoreStatusRequest(message),
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
    `SELECT id, model_id, category_id, brand, name, sku, slug, description, price_retail, price_promo, stock_quantity, specs, custom_fields,
       warranty_type, warranty_template_id,
       (SELECT name FROM brands WHERE CAST(brands.id AS CHAR) = products.brand OR brands.name = products.brand LIMIT 1) AS brand_name,
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

function formatAutoresponderProductDescriptionLine(product) {
  const description = stripShopeeActionsHtmlVps(product?.description || '');
  if (!description) return '';
  const compact = description.length > 260 ? `${description.slice(0, 257).trim()}...` : description;
  return `Descricao: ${compact}`;
}

async function findAutoresponderProductVariations(product) {
  if (!product?.model_id) return product ? [product] : [];
  const [rows] = await pool.query(
    `SELECT id, model_id, category_id, brand, name, sku, slug, price_retail, price_promo, stock_quantity, specs, custom_fields
     FROM products
     WHERE status = 'active'
       AND (is_parent = 0 OR is_parent IS NULL)
       AND stock_quantity > 0
       AND model_id = ?
     ORDER BY price_retail ASC, name ASC`,
    [product.model_id]
  );
  return rows.length > 0 ? rows : [product];
}

function formatAutoresponderProductVariationsBlock(variations) {
  const available = filterAutoresponderAvailableProducts(variations);
  if (available.length === 0) return '';

  const byName = new Map();
  for (const variation of available) {
    const name = String(variation?.name || 'Opcao disponivel').trim();
    const key = normalizeAutoresponderText(name);
    const existing = byName.get(key) || { name, items: [] };
    existing.items.push(variation);
    byName.set(key, existing);
  }

  const lines = ['Variacoes disponiveis:'];
  let optionNumber = 1;
  for (const group of byName.values()) {
    const colors = getAutoresponderAvailableColors(group.items);
    const priceRange = formatAutoresponderPriceRange(group.items);
    if (colors.length > 0) {
      colors.forEach((color) => {
        const colorItems = group.items.filter((item) => normalizeAutoresponderText(getAutoresponderProductColor(item)) === normalizeAutoresponderText(color));
        const colorPrice = formatAutoresponderPriceRange(colorItems.length > 0 ? colorItems : group.items);
        lines.push(`${optionNumber}. ${color} - ${colorPrice}`);
        optionNumber += 1;
      });
    } else {
      lines.push(`${optionNumber}. ${group.name} - ${priceRange}`);
      optionNumber += 1;
    }
  }
  return lines.join('\n');
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

  const variationsBlock = formatAutoresponderProductVariationsBlock(
    await findAutoresponderProductVariations(product)
  );
  if (variationsBlock) {
    lines.push('');
    lines.push(variationsBlock);
  }

  const installmentLine = formatAutoresponderInstallmentLine(
    await calculateAutoresponderMaxInstallment(getAutoresponderProductPriceCents(product))
  );
  if (installmentLine) {
    lines.push('');
    lines.push(installmentLine.replace('Parcelamento:', 'Parcelamento no cartao:'));
  }

  const warrantyLine = formatAutoresponderProductWarrantyLine(product);
  if (warrantyLine) {
    lines.push('');
    lines.push(warrantyLine);
  }

  if (product.slug) {
    lines.push('');
    lines.push('Link do produto:');
    lines.push(getAutoresponderProductUrl(product));
    lines.push('');
    lines.push('Acesse o link para ver especificacoes, fotos e video demonstrativo do produto.');
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
    const pageSize = getAutoresponderInitialProductPageSize();
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
  'oi', 'ola', 'opa', 'bom', 'boa', 'dia', 'tarde', 'noite',
  'sim', 'nao', 'não',
]);

function isAutoresponderLikelyProductModelRequest(message) {
  const text = normalizeAutoresponderText(message).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (isAutoresponderStandaloneDeliveryQuoteRequest(message) || normalizeAutoresponderCep(message)) return false;
  if (/\b(tem|teria|vende|vendem|quero|queria|procuro|busco|valor|preco|quanto|modelo|produto|celular|smartphone|tablet|receptor)\b/.test(text)) return true;
  return /\b(redmi|poco|iphone|samsung|galaxy|motorola|moto|realme|xiaomi|note|pro|max|plus|ultra|c\d{1,3}|a\d{1,3})\b/.test(text);
}

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

  const safeLimit = getAutoresponderProductQueryLimit(limit);
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
       (SELECT name FROM brands WHERE CAST(brands.id AS CHAR) = products.brand OR brands.name = products.brand LIMIT 1) AS brand_name,
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

function getAutoresponderFallbackReply(settings, nextFallbackCount, sender = '') {
  const threshold = Number(settings?.auto_pause_fallback_threshold) > 0
    ? Number(settings.auto_pause_fallback_threshold)
    : 3;
  const shouldAutoPause = nextFallbackCount >= threshold;
  const replyText = shouldAutoPause
    ? getAutoresponderFixedToneMessage(settings, sender, 'autoPause', settings?.auto_pause_fallback_message || settings?.fallback_message, AUTORESPONDER_DEFAULT_AUTO_PAUSE_MESSAGE)
    : getAutoresponderFixedToneMessage(settings, sender, 'fallback', settings?.fallback_message, AUTORESPONDER_DEFAULT_FALLBACK_MESSAGE);

  return { replyText, shouldAutoPause };
}

async function handleAutoresponderGlobalFallbackCuration({
  senderKey,
  message,
  settings,
  contactFirstName = '',
  shouldPrefixGreeting = false,
}) {
  const aiFallback = await buildAutoresponderAiFallbackReply({ message, contactFirstName, settings, sender: senderKey });
  if (aiFallback?.text) {
    const replyText = formatAutoresponderReply(aiFallback.text, settings, shouldPrefixGreeting);
    await logAutoresponderReply({
      sender: senderKey,
      message,
      intent: 'ai_fallback',
      replyText,
      matchedCount: 0,
      aiMeta: aiFallback.aiMeta,
    });
    await upsertAutoresponderSuccessConversation(senderKey);
    return { replies: [{ message: replyText }] };
  }

  const fallbackState = await getAutoresponderFallbackState(senderKey);
  const nextFallbackCount = fallbackState.consecutiveFallbacks + 1;
  const fallbackReply = getAutoresponderFallbackReply(settings, nextFallbackCount, senderKey);
  const replyText = formatAutoresponderReply(fallbackReply.replyText, settings, shouldPrefixGreeting);
  const autoPauseMinutes = Number(settings.auto_pause_fallback_minutes) > 0
    ? Number(settings.auto_pause_fallback_minutes)
    : 30;
  const intent = nextFallbackCount >= 2 ? 'curation_candidate' : 'global_fallback';

  await logAutoresponderReply({
    sender: senderKey,
    message,
    intent,
    replyText,
    matchedCount: 0,
  });

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

  return { replies: [{ message: replyText }] };
}

async function logAutoresponderReply({
  sender,
  message,
  intent,
  replyText,
  matchedCount = 0,
  matchedRuleId = null,
  matchedProducts = null,
  aiMeta = null,
}) {
  await pool.query(
    `INSERT INTO autoresponder_logs
      (sender, question, intent, matched_rule_id, matched_products, matched_count, reply_text, response_time_ms, is_group, ai_assisted, ai_model, ai_input_tokens, ai_output_tokens, ai_estimated_cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      aiMeta?.ai_assisted ? 1 : 0,
      aiMeta?.ai_model || null,
      aiMeta?.ai_input_tokens == null ? null : Number(aiMeta.ai_input_tokens),
      aiMeta?.ai_output_tokens == null ? null : Number(aiMeta.ai_output_tokens),
      aiMeta?.ai_estimated_cost_usd == null ? null : Number(aiMeta.ai_estimated_cost_usd),
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

async function hasRecentAutoresponderNeedsPrompt(sender, validityMinutes = 15) {
  const minutes = Number(validityMinutes) > 0 ? Number(validityMinutes) : 15;
  const [rows] = await pool.query(
    `SELECT id
     FROM autoresponder_logs
     WHERE sender = ?
       AND intent = 'greeting_needs_prompt'
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
     ORDER BY id DESC
     LIMIT 1`,
    [sender, minutes]
  );
  return rows.length > 0;
}

async function classifyAutoresponderNeedsPromptReplyWithAi({ message, settings }) {
  const aiReply = await callAutoresponderOpenAi({
    input: [
      'Classifique a resposta do cliente a um pedido anterior para receber lista de celulares disponiveis.',
      `Resposta do cliente: ${String(message || '').trim()}`,
      'Responda exatamente uma destas opcoes:',
      'phone_list_opt_in = cliente quer receber/ver a lista de celulares',
      'other = cliente pediu outra coisa, esta confuso ou nao confirmou a lista',
    ].join('\n'),
    maxOutputTokens: 20,
    settings,
  });
  const text = normalizeAutoresponderText(aiReply?.text || '').trim();
  return text.includes('phone_list_opt_in') ? 'phone_list_opt_in' : 'other';
}

async function handleAutoresponderPhoneListOptIn({ sender, message, settings, shouldPrefixGreeting }) {
  if (!(await hasRecentAutoresponderNeedsPrompt(sender))) return null;
  const flowKeywords = getAutoresponderConversationFlowKeywords(settings, 'phone_list_opt_in');
  const matchesBuiltInConfirmation = isAutoresponderYes(message) || isAutoresponderExplicitCatalogListRequest(message);
  const matchesConfiguredKeyword = doesAutoresponderMessageMatchFlowKeywords(message, flowKeywords)
    || matchesBuiltInConfirmation;
  const classification = matchesConfiguredKeyword
    ? 'phone_list_opt_in'
    : await classifyAutoresponderNeedsPromptReplyWithAi({ message, settings });
  if (classification === 'phone_list_opt_in') {
    // Continue below and send the phone catalog.
  } else {
    return null;
  }

  const categories = await findAutoresponderAvailableCategories(100);
  const selectedCategory = await resolveAutoresponderCatalogCategoryForMessage('smartphones', categories);
  if (!selectedCategory?.id) return null;

  const pageSize = getAutoresponderInitialProductPageSize(selectedCategory.name);
  const rows = await findAutoresponderProductsByCategory(selectedCategory.id, pageSize + 1);
  const products = rows.slice(0, pageSize);
  const hasMore = rows.length > pageSize;
  const total = await countAutoresponderProductsByCategory(selectedCategory.id);
  const productOptions = buildAutoresponderProductOptions(products);
  const productReplyMessages = appendAutoresponderReplyFooter(
    await formatAutoresponderProductSearchReplies(products, selectedCategory.name, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(selectedCategory.name) }),
    formatAutoresponderProductReplyInstructions(hasMore)
  );
  const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
  const replyText = replyMessages.join('\n\n');

  await logAutoresponderReply({
    sender,
    message,
    intent: 'catalog_phone_opt_in',
    replyText,
    matchedCount: products.length,
    matchedProducts: productOptions,
  });
  await upsertAutoresponderOptionsConversation(sender, productOptions, {
    source: 'category',
    categoryId: selectedCategory.id,
    keyword: selectedCategory.name,
    offset: 0,
    limit: pageSize,
    total,
    hasMore,
    completeList: isAutoresponderCompleteProductListKeyword(selectedCategory.name),
  });

  return { replies: formatAutoresponderProReplies(replyMessages) };
}

async function buildAutoresponderCatalogCategoryReplyData(message, settings, shouldPrefixGreeting = false) {
  const categories = await findAutoresponderAvailableCategories(100);
  const selectedCategory = await resolveAutoresponderCatalogCategoryForMessage(message, categories);
  if (!selectedCategory?.id) return null;

  const pageSize = getAutoresponderInitialProductPageSize(selectedCategory.name);
  const rows = await findAutoresponderProductsByCategory(selectedCategory.id, pageSize + 1);
  const products = rows.slice(0, pageSize);
  const hasMore = rows.length > pageSize;
  const total = await countAutoresponderProductsByCategory(selectedCategory.id);
  const productOptions = buildAutoresponderProductOptions(products);
  const productReplyMessages = appendAutoresponderReplyFooter(
    await formatAutoresponderProductSearchReplies(products, selectedCategory.name, settings, {
      offset: 0,
      limit: pageSize,
      total,
      completeList: isAutoresponderCompleteProductListKeyword(selectedCategory.name),
    }),
    formatAutoresponderProductReplyInstructions(hasMore)
  );
  const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
  return {
    selectedCategory,
    pageSize,
    products,
    hasMore,
    total,
    productOptions,
    replyMessages,
  };
}

async function buildAutoresponderGreetingCatalogReplyData(message, contactFirstName, settings) {
  if (!isAutoresponderGreeting(message) || !isAutoresponderCatalogRequest(message)) return null;
  const catalogData = await buildAutoresponderCatalogCategoryReplyData(message, settings, false);
  if (!catalogData) return null;
  const greetingText = getAutoresponderGreetingReply(message, contactFirstName, settings);
  return {
    ...catalogData,
    greetingText,
    replyMessages: [
      greetingText,
      ...catalogData.replyMessages,
    ],
  };
}

function buildAutoresponderReplyMessagesWithSeparateGreeting(replyMessages, { message, contactFirstName = '', settings = null, shouldIncludeGreeting = false } = {}) {
  const messages = Array.isArray(replyMessages) ? replyMessages : [replyMessages];
  if (!shouldIncludeGreeting) return formatAutoresponderReplies(messages, settings, false);
  const greetingText = getAutoresponderGreetingReply(message, contactFirstName, settings);
  return formatAutoresponderReplies([greetingText, ...messages], settings, false);
}

async function buildAutoresponderPriorityProductSearchReplyData({ message, contactFirstName = '', settings = null, shouldPrefixGreeting = false } = {}) {
  if (normalizeAutoresponderCep(message)) return null;
  const normalizedMessage = normalizeAutoresponderText(message).trim();
  if (
    /\b(lista|catalogo|opcoes|modelos|ver|mostrar|manda|mande|tem|vende|quero|procuro)\b/.test(normalizedMessage)
    && /\b(celular|celulares|smartphone|smartphones|telefone|telefones|aparelho|aparelhos)\b/.test(normalizedMessage)
    && !/\b(redmi|iphone|iphones|xiaomi|poco|galaxy|motorola|moto|samsung|note|pro|max|plus|ultra)\b/.test(normalizedMessage)
  ) return null;
  if (!isAutoresponderLikelyProductModelRequest(message)) return null;
  const productSearchTokens = extractAutoresponderProductSearchTokens(message);
  if (productSearchTokens.length === 0) return null;
  const genericPhoneSearchTokens = new Set([
    'celular', 'celulares', 'smartphone', 'smartphones',
    'telefone', 'telefones', 'phone', 'phones', 'aparelho', 'aparelhos',
  ]);
  if (productSearchTokens.every((token) => genericPhoneSearchTokens.has(token))) return null;

  const searchKeyword = productSearchTokens.join(' ');
  const pageSize = getAutoresponderInitialProductPageSize(searchKeyword);
  const rows = await findAutoresponderProductsByTokens(productSearchTokens, pageSize + 1);
  const products = rows.slice(0, pageSize);
  if (products.length === 0) return null;

  const hasMore = rows.length > pageSize;
  const total = await countAutoresponderProductsByTokens(productSearchTokens);
  const productOptions = buildAutoresponderProductOptions(products);
  const productReplyMessages = appendAutoresponderReplyFooter(
    await formatAutoresponderProductSearchReplies(products, searchKeyword, settings, {
      offset: 0,
      limit: pageSize,
      total,
      completeList: isAutoresponderCompleteProductListKeyword(searchKeyword),
    }),
    formatAutoresponderProductReplyInstructions(hasMore)
  );
  const replyMessages = buildAutoresponderReplyMessagesWithSeparateGreeting(productReplyMessages, {
    message,
    contactFirstName,
    settings,
    shouldIncludeGreeting: shouldPrefixGreeting || isAutoresponderGreeting(message),
  });

  return {
    productSearchTokens,
    searchKeyword,
    pageSize,
    products,
    productOptions,
    hasMore,
    total,
    replyMessages,
  };
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

function buildAutoresponderStoreStatusReply(storeStatus) {
  const status = String(storeStatus?.status || '');
  if (status === 'open') {
    return 'Estamos abertos agora. Pode mandar sua mensagem por aqui ou visitar a loja.';
  }
  if (status === 'closing_soon') {
    return 'Estamos abertos agora, mas ja perto de fechar. Se quiser, me manda sua duvida por aqui que eu te ajudo.';
  }
  if (status === 'holiday') {
    const holidayName = storeStatus?.message || storeStatus?.holiday?.name;
    return holidayName
      ? `Hoje a loja esta fechada por conta do feriado: ${holidayName}.`
      : 'Hoje a loja esta fechada por conta de feriado.';
  }
  return 'No momento a loja esta fechada, mas pode mandar sua mensagem por aqui que vamos te responder assim que possivel.';
}

function buildAutoresponderStoreStatusReplyMessages({ message, contactFirstName = '', settings = null, storeStatus = null, shouldIncludeGreeting = null } = {}) {
  const statusText = buildAutoresponderStoreStatusReply(storeStatus);
  const includeGreeting = shouldIncludeGreeting == null ? isAutoresponderGreeting(message) : Boolean(shouldIncludeGreeting);
  if (!includeGreeting) return formatAutoresponderReplies([statusText], settings, false);
  const greetingText = getAutoresponderGreetingReply(message, contactFirstName, settings);
  return formatAutoresponderReplies([greetingText, statusText], settings, false);
}

async function getAutoresponderReplyCount(sender, windowHours) {
  const hours = Number(windowHours) > 0 ? Number(windowHours) : 24;
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM autoresponder_logs
     WHERE sender = ?
       AND reply_text IS NOT NULL
       AND reply_text <> ''
       AND created_at >= COALESCE(
         (SELECT reply_window_started_at
          FROM autoresponder_conversations
          WHERE sender = ?
          LIMIT 1),
         DATE_SUB(NOW(), INTERVAL ? HOUR)
       )`,
    [sender, sender, hours]
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
// ─── Evolution API Proxies ──────────────────────────────────────────────────
const EVOLUTION_GLOBAL_API_KEY = 'ChaveSecretaGeradaParaAutenticacaoEvolution123!';
const EVOLUTION_BASE_URL = 'http://127.0.0.1:8080';
const EVOLUTION_INSTANCE_NAME = 'mercado_do_vale';

function formatEvolutionMessage(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatEvolutionMessage).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

async function callEvolutionApiDetailed(endpoint, method = 'GET', body = null) {
  const response = await fetch(`${EVOLUTION_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'apikey': EVOLUTION_GLOBAL_API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
  const text = await response.text();
  let parsed = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return {
    ok: response.ok,
    status: response.status,
    body: parsed,
  };
}

async function callEvolutionApi(endpoint, method = 'GET', body = null) {
  const result = await callEvolutionApiDetailed(endpoint, method, body);
  return result.body;
}

async function sendAutoresponderEvolutionTextMessage(sender, text) {
  const number = normalizeAutoresponderSender(sender);
  if (!number) {
    throw new Error('sender is required');
  }
  return callEvolutionApiDetailed(`/message/sendText/${EVOLUTION_INSTANCE_NAME}`, 'POST', {
    number,
    text,
  });
}

function buildAutoresponderEvolutionWebhookConfig() {
  return {
    enabled: true,
    url: 'https://api.xiaomipetrolina.com.br/autoresponder-webhook',
    byEvents: false,
    webhookByEvents: false,
    base64: false,
    webhookBase64: false,
    headers: {
      'x-autoresponder-token': process.env.AUTORESPONDER_TOKEN || ''
    },
    events: ['CONNECTION_UPDATE', 'MESSAGES_UPSERT']
  };
}

async function syncAutoresponderEvolutionWebhook() {
  return callEvolutionApiDetailed(`/webhook/set/${EVOLUTION_INSTANCE_NAME}`, 'POST', {
    webhook: buildAutoresponderEvolutionWebhookConfig()
  });
}

fastify.get('/autoresponder/whatsapp/state', { preHandler: requireSyncKey }, async (req, reply) => {
  try {
    const result = await callEvolutionApi(`/instance/connectionState/${EVOLUTION_INSTANCE_NAME}`);
    return result;
  } catch (err) {
    return reply.code(500).send({ error: err.message });
  }
});

fastify.get('/autoresponder/whatsapp/debug', { preHandler: requireSyncKey }, async (req, reply) => {
  try {
    const [evolutionStatus, fetchInstances, connectionState] = await Promise.all([
      callEvolutionApiDetailed('/'),
      callEvolutionApiDetailed('/instance/fetchInstances'),
      callEvolutionApiDetailed(`/instance/connectionState/${EVOLUTION_INSTANCE_NAME}`),
    ]);

    return {
      baseUrl: EVOLUTION_BASE_URL,
      instanceName: EVOLUTION_INSTANCE_NAME,
      evolutionStatus,
      fetchInstances,
      connectionState,
    };
  } catch (err) {
    return reply.code(500).send({
      error: true,
      message: err.message,
      baseUrl: EVOLUTION_BASE_URL,
      instanceName: EVOLUTION_INSTANCE_NAME,
    });
  }
});

fastify.get('/autoresponder/whatsapp/connect', { preHandler: requireSyncKey }, async (req, reply) => {
  try {
    const createBody = {
      instanceName: EVOLUTION_INSTANCE_NAME,
      qrcode: true,
      number: process.env.EVOLUTION_INSTANCE_NUMBER || '',
      integration: 'WHATSAPP-BAILEYS',
      webhook: buildAutoresponderEvolutionWebhookConfig()
    };

    const createResult = await callEvolutionApiDetailed('/instance/create', 'POST', createBody);
    const createMessage = formatEvolutionMessage(createResult.body?.message || createResult.body?.response || createResult.body);
    const alreadyExists = /already exists|existe|exist|in use/i.test(createMessage);
    if ((!createResult.ok || createResult.body?.error === true) && !alreadyExists) {
      return reply.code(502).send({
        error: true,
        phase: 'create',
        message: createMessage || 'Evolution API failed to create the WhatsApp instance.',
        evolutionStatus: createResult.status,
        evolution: createResult.body,
      });
    }

    const webhookResult = await syncAutoresponderEvolutionWebhook().catch((err) => ({
      ok: false,
      status: 0,
      body: { message: err.message || 'Evolution webhook sync failed' }
    }));
    const connectResult = await callEvolutionApiDetailed(`/instance/connect/${EVOLUTION_INSTANCE_NAME}`);
    if (!connectResult.ok || connectResult.body?.error === true) {
      return reply.code(502).send({
        error: true,
        phase: 'connect',
        message: formatEvolutionMessage(connectResult.body?.message || connectResult.body?.response || connectResult.body)
          || 'Evolution API failed to connect the WhatsApp instance.',
        evolutionStatus: connectResult.status,
        evolution: connectResult.body,
        webhook: webhookResult.body,
      });
    }
    return { ...connectResult.body, webhook: webhookResult.body };
  } catch (err) {
    return reply.code(500).send({ error: err.message });
  }
});

fastify.post('/autoresponder/whatsapp/sync-webhook', { preHandler: requireSyncKey }, async (req, reply) => {
  try {
    const webhookResult = await syncAutoresponderEvolutionWebhook();
    if (!webhookResult.ok || webhookResult.body?.error === true) {
      return reply.code(502).send({
        error: true,
        phase: 'webhook',
        message: formatEvolutionMessage(webhookResult.body?.message || webhookResult.body?.response || webhookResult.body)
          || 'Evolution API failed to sync the WhatsApp webhook.',
        evolutionStatus: webhookResult.status,
        evolution: webhookResult.body,
      });
    }
    return { ok: true, webhook: webhookResult.body };
  } catch (err) {
    return reply.code(500).send({ error: err.message });
  }
});

fastify.post('/autoresponder/whatsapp/disconnect', { preHandler: requireSyncKey }, async (req, reply) => {
  try {
    const result = await callEvolutionApi(`/instance/logout/${EVOLUTION_INSTANCE_NAME}`, 'POST');
    return result;
  } catch (err) {
    return reply.code(500).send({ error: err.message });
  }
});

// ─── AutoResponder WhatsApp (Fase 1A/1B) ─────────────────────────────────────
fastify.get('/autoresponder/settings', { preHandler: requireSyncKey }, async () => {
  const [rows] = await pool.query('SELECT * FROM autoresponder_settings WHERE id = 1 LIMIT 1');
  return sanitizeAutoresponderSettings(rows[0] || null);
});

fastify.patch('/autoresponder/settings', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  if (!Object.prototype.hasOwnProperty.call(body, 'manual_finish_pause_days')) {
    if (Object.prototype.hasOwnProperty.call(body, 'days_paused_after_finish')) {
      body.manual_finish_pause_days = body.days_paused_after_finish;
    } else if (Object.prototype.hasOwnProperty.call(body, 'finish_pause_days')) {
      body.manual_finish_pause_days = body.finish_pause_days;
    }
  }
  const allowed = {
    enabled: (v) => boolInt(v),
    human_message_in_hours: (v) => String(v ?? ''),
    human_message_out_of_hours: (v) => String(v ?? ''),
    human_pause_minutes: (v) => Number(v),
    manual_finish_pause_days: (v) => Math.max(1, Math.min(Math.round(Number(v) || 30), 3650)),
    response_tone_mode: (v) => normalizeAutoresponderResponseToneMode(v),
    auto_pause_fallback_threshold: (v) => Number(v),
    auto_pause_fallback_minutes: (v) => Number(v),
    auto_pause_fallback_message: (v) => String(v ?? ''),
    max_replies_per_conversation: (v) => Number(v),
    max_replies_window_hours: (v) => Number(v),
    greeting_prefix: (v) => String(v ?? ''),
    fallback_message: (v) => String(v ?? ''),
    signature_enabled: (v) => boolInt(v),
    signature_message: (v) => String(v ?? ''),
    send_product_images: (v) => boolInt(v),
    max_images_per_response: (v) => Number(v),
    use_numbered_lists: (v) => boolInt(v),
    numbered_list_threshold: (v) => Number(v),
    numbered_list_validity_minutes: (v) => Number(v),
    product_tag_keywords: (v) => jsonStr(v || {}),
    conversation_flow_keywords: (v) => jsonStr(normalizeAutoresponderConversationFlowKeywords(v)),
    conversation_flow_messages: (v) => jsonStr(normalizeAutoresponderConversationFlowMessages(v)),
    archive_to_synology: (v) => boolInt(v),
    archive_after_days: (v) => Number(v),
    ai_enabled: (v) => boolInt(v),
    ai_model: (v) => String(v || 'gpt-5-nano').trim() || 'gpt-5-nano',
    ai_daily_limit: (v) => Math.max(0, Number(v) || 0),
    ai_monthly_limit: (v) => Math.max(0, Number(v) || 0),
    ai_credit_balance_usd: (v) => Math.max(0, Number(v) || 0),
    ai_credit_alert_usd: (v) => Math.max(0, Number(v) || 0),
    ai_input_cost_per_1m_usd: (v) => Math.max(0, Number(v) || 0),
    ai_output_cost_per_1m_usd: (v) => Math.max(0, Number(v) || 0),
    ai_conversation_memory_enabled: (v) => boolInt(v),
    ai_conversation_memory_limit: (v) => normalizeAutoresponderAiConversationMemoryLimit(v),
    ai_conversation_memory_days: (v) => normalizeAutoresponderAiConversationMemoryDays(v),
    ai_context_memory: (v) => String(v ?? '').slice(0, 6000),
    openai_api_key: (v) => String(v || '').trim(),
    openai_admin_api_key: (v) => String(v || '').trim(),
  };

  const sets = [];
  const values = [];
  for (const [key, normalize] of Object.entries(allowed)) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    if (key === 'openai_api_key' && !String(body[key] || '').trim()) continue;
    if (key === 'openai_admin_api_key' && !String(body[key] || '').trim()) continue;
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
  return sanitizeAutoresponderSettings(rows[0] || null);
});

fastify.get('/autoresponder/ai-training', { preHandler: requireSyncKey }, async (request) => {
  const type = String(request.query?.type || '').trim();
  const active = request.query?.active;
  const where = [];
  const values = [];

  if (type) {
    where.push('training_type = ?');
    values.push(normalizeAutoresponderAiTrainingType(type));
  }
  if (active !== undefined && active !== null && String(active) !== '') {
    where.push('active = ?');
    values.push(boolInt(active));
  }

  const sql = [
    'SELECT * FROM autoresponder_ai_training',
    where.length ? `WHERE ${where.join(' AND ')}` : '',
    'ORDER BY priority DESC, id ASC',
  ].filter(Boolean).join(' ');

  const [rows] = await pool.query(sql, values);
  return rows;
});

fastify.post('/autoresponder/ai-training', { preHandler: requireSyncKey }, async (request, reply) => {
  let input;
  try {
    input = sanitizeAutoresponderAiTrainingInput(request.body || {}, false);
  } catch (err) {
    return reply.code(400).send({ error: err.message });
  }

  const [result] = await pool.query(
    `INSERT INTO autoresponder_ai_training (title, training_type, keywords, content, priority, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.title, input.training_type, input.keywords, input.content, input.priority, input.active]
  );
  const [rows] = await pool.query('SELECT * FROM autoresponder_ai_training WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0] || null;
});

fastify.patch('/autoresponder/ai-training/:id', { preHandler: requireSyncKey }, async (request, reply) => {
  const id = Number(request.params.id);
  if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'Invalid id' });

  let input;
  try {
    input = sanitizeAutoresponderAiTrainingInput(request.body || {}, true);
  } catch (err) {
    return reply.code(400).send({ error: err.message });
  }

  const entries = Object.entries(input);
  if (entries.length === 0) return reply.code(400).send({ error: 'No valid training fields provided' });

  const sets = entries.map(([key]) => `${key} = ?`);
  const values = entries.map(([, value]) => value);
  values.push(id);

  await pool.query(`UPDATE autoresponder_ai_training SET ${sets.join(', ')} WHERE id = ?`, values);
  const [rows] = await pool.query('SELECT * FROM autoresponder_ai_training WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
});

fastify.delete('/autoresponder/ai-training/:id', { preHandler: requireSyncKey }, async (request, reply) => {
  const id = Number(request.params.id);
  if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'Invalid id' });
  await pool.query('DELETE FROM autoresponder_ai_training WHERE id = ?', [id]);
  return reply.code(204).send();
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
  next_state: (v) => normalizeAutoresponderRuleNextState(v),
  attachment_url: (v) => v == null ? null : String(v),
  attachment_caption: (v) => v == null ? null : String(v),
  auto_apply_tag_id: (v) => v == null || v === '' ? null : Number(v),
  tag_ids: (v) => jsonStr(v || []),
  priority: (v) => Number(v || 0),
  active: (v) => boolInt(v),
};

function normalizeAutoresponderRuleNextState(value) {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'string' ? parsePublicJson(value, value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const flow = String(parsed.flow || 'none');
  const step = String(parsed.step || 'idle');
  return jsonStr({
    flow,
    step,
    data: parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data) ? parsed.data : {},
    last_intent: parsed.last_intent == null ? null : String(parsed.last_intent),
    expires_at: parsed.expires_at == null ? null : String(parsed.expires_at),
  });
}

async function applyRuleNextState(senderKey, matchedRule, purchaseFlow = null) {
  if (!matchedRule?.next_state) return null;
  const [{ normalizeConversationState }] = await Promise.all([
    import('./services/autoresponder/engine/state.js'),
  ]);
  const nextState = normalizeConversationState(parsePublicJson(matchedRule.next_state, matchedRule.next_state));
  const currentPurchaseFlow = purchaseFlow || await getAutoresponderPurchaseFlow(senderKey);
  await saveAutoresponderPurchaseFlow(senderKey, {
    ...currentPurchaseFlow,
    conversation_state: nextState,
  });
  return nextState;
}

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

fastify.get('/autoresponder/category-tags', { preHandler: requireSyncKey }, async () => {
  const [rows] = await pool.query(
    `SELECT
       c.id,
       c.name,
       c.slug,
       c.parent_id,
       c.warranty_days,
       c.updated_at,
       COUNT(p.id) AS product_count,
       COALESCE(SUM(CASE WHEN COALESCE(p.stock_quantity, 0) > 0 THEN 1 ELSE 0 END), 0) AS in_stock_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
      AND p.status = 'active'
      AND (p.is_parent = 0 OR p.is_parent IS NULL)
     GROUP BY c.id, c.name, c.slug, c.parent_id, c.warranty_days, c.updated_at, c.sort_order
     ORDER BY COALESCE(c.sort_order, 999999), c.name ASC`
  );
  return rows.map((row) => ({
    ...row,
    product_count: Number(row.product_count || 0),
    in_stock_count: Number(row.in_stock_count || 0),
    appears_on_greeting: Number(row.in_stock_count || 0) > 0,
  }));
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

fastify.get('/autoresponder/attendants', { preHandler: requireSyncKey }, async (req) => {
  const params = [];
  let sql = 'SELECT * FROM autoresponder_attendants WHERE 1=1';
  if (req.query?.active !== undefined && req.query?.active !== null && String(req.query.active) !== '') {
    sql += ' AND active = ?';
    params.push(boolInt(req.query.active));
  }
  sql += ' ORDER BY active DESC, name ASC, id ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
});

fastify.post('/autoresponder/attendants', { preHandler: requireSyncKey }, async (req, reply) => {
  const name = normalizeAutoresponderAttendantName(req.body?.name);
  if (!name) return reply.code(400).send({ error: 'name is required' });
  await pool.query(
    `INSERT INTO autoresponder_attendants (name, active)
     VALUES (?, 1)
     ON DUPLICATE KEY UPDATE active = 1`,
    [name]
  );
  const [rows] = await pool.query('SELECT * FROM autoresponder_attendants WHERE name = ? LIMIT 1', [name]);
  return rows[0] || null;
});

fastify.delete('/autoresponder/attendants/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return reply.code(400).send({ error: 'Invalid id' });
  await pool.query('UPDATE autoresponder_attendants SET active = 0 WHERE id = ?', [id]);
  return { ok: true };
});

fastify.get('/autoresponder/conversations', { preHandler: requireSyncKey }, async (req) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const status = req.query.status;
  const tagId = req.query.tag_id;
  const attendantName = String(req.query.attendant_name || '').trim();
  let sql = 'SELECT * FROM autoresponder_conversations WHERE 1=1';
  const params = [];
  if (status === 'paused') sql += ' AND paused_until > NOW()';
  if (status === 'active') sql += " AND (paused_until IS NULL OR paused_until <= NOW()) AND (pause_reason IS NULL OR pause_reason <> 'manual_finished')";
  if (status === 'finished') sql += " AND pause_reason = 'manual_finished'";
  if (tagId) {
    sql += ' AND JSON_CONTAINS(tag_ids, JSON_ARRAY(?))';
    params.push(Number(tagId));
  }
  if (attendantName === '__none__') {
    sql += " AND (attendant_name IS NULL OR attendant_name = '')";
  } else if (attendantName) {
    sql += ' AND attendant_name = ?';
    params.push(attendantName);
  }
  sql += ` ORDER BY last_message_at DESC LIMIT ${limit} OFFSET ${offset}`;
  const [rows] = await pool.query(sql, params);
  return rows;
});

fastify.get('/autoresponder/conversations/:sender/logs', { preHandler: requireSyncKey }, async (req) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const [rows] = await pool.query(
    `SELECT id, created_at, sender, question, intent, matched_rule_id, matched_count, reply_text, response_time_ms, ai_assisted, ai_model
     FROM autoresponder_logs
     WHERE sender = ?
     ORDER BY created_at DESC
     LIMIT ${limit}`,
    [req.params.sender]
  );
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

fastify.post('/autoresponder/conversations/:sender/reset-counters', { preHandler: requireSyncKey }, async (req) => {
  await pool.query(
    `INSERT INTO autoresponder_conversations (sender, last_message_at)
     VALUES (?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       paused_until = NULL,
       pause_reason = NULL,
       consecutive_fallbacks = 0,
       reply_count = 0,
       reply_window_started_at = CURRENT_TIMESTAMP,
       last_options_offered = NULL,
       last_options_at = NULL,
       purchase_flow = NULL,
       purchase_flow_updated_at = NULL`,
    [req.params.sender]
  );
  return { ok: true };
});

fastify.post('/autoresponder/conversations/:sender/attendant', { preHandler: requireSyncKey }, async (req, reply) => {
  const sender = normalizeAutoresponderSender(req.params.sender) || String(req.params.sender || '').trim();
  if (!sender) return reply.code(400).send({ error: 'sender is required' });

  const attendantName = normalizeAutoresponderAttendantName(req.body?.attendant_name);
  if (attendantName) {
    const [attendants] = await pool.query(
      'SELECT id, name FROM autoresponder_attendants WHERE name = ? AND active = 1 LIMIT 1',
      [attendantName]
    );
    if (!attendants[0]) return reply.code(400).send({ error: 'attendant_name is not registered' });
  }

  const [previousRows] = await pool.query(
    'SELECT attendant_name FROM autoresponder_conversations WHERE sender = ? LIMIT 1',
    [sender]
  );
  const previousAttendantName = previousRows[0]?.attendant_name || null;
  if ((previousAttendantName || '') === (attendantName || '')) {
    return {
      ok: true,
      sender,
      attendant_name: attendantName || null,
      previous_attendant_name: previousAttendantName,
      unchanged: true,
    };
  }

  await pool.query(
    `INSERT INTO autoresponder_conversations (sender, last_message_at, attendant_name, attendant_updated_at)
     VALUES (?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       last_message_at = CURRENT_TIMESTAMP,
       attendant_name = ?,
       attendant_updated_at = CURRENT_TIMESTAMP`,
    [sender, attendantName || null, attendantName || null]
  );

  await logAutoresponderReply({
    sender,
    message: 'Alteracao de atendente',
    intent: 'attendant_changed',
    replyText: `Atendente: ${previousAttendantName || 'sem atendente'} -> ${attendantName || 'sem atendente'}`,
    matchedCount: 0,
  });

  return {
    ok: true,
    sender,
    attendant_name: attendantName || null,
    previous_attendant_name: previousAttendantName,
  };
});

fastify.post('/autoresponder/conversations/:sender/manual-message', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  const sender = normalizeAutoresponderSender(req.params.sender) || String(req.params.sender || '').trim();
  let message = String(body.message || '').trim();
  const attendantName = String(body.attendant_name || '').trim();
  const sendTagId = body.send_tag_id == null || body.send_tag_id === '' ? null : Number(body.send_tag_id);
  const finishAttendance = body.finish_attendance === true;
  let defaultFinishPauseDays = 30;
  if (finishAttendance && (body.pause_minutes === undefined || body.pause_minutes === null || body.pause_minutes === '')) {
    const [settingsRows] = await pool.query('SELECT manual_finish_pause_days FROM autoresponder_settings WHERE id = 1 LIMIT 1');
    const configuredDays = Number(settingsRows[0]?.manual_finish_pause_days || 30);
    if (Number.isFinite(configuredDays)) {
      defaultFinishPauseDays = Math.max(1, Math.min(Math.round(configuredDays), 3650));
    }
  }
  const rawPauseMinutes = Number(body.pause_minutes || (finishAttendance ? defaultFinishPauseDays * 1440 : 240));
  const pauseMinutes = Math.max(1, Math.min(rawPauseMinutes, finishAttendance ? 60 * 24 * 3650 : 60 * 24 * 7));

  if (!sender) return reply.code(400).send({ error: 'sender is required' });
  if (!message) return reply.code(400).send({ error: 'message is required' });
  if (sendTagId != null && !Number.isFinite(sendTagId)) return reply.code(400).send({ error: 'send_tag_id is invalid' });

  if (finishAttendance && message === 'Atendimento finalizado, mas qualquer duvida estamos por aqui.') {
    const [settingsRows] = await pool.query('SELECT response_tone_mode FROM autoresponder_settings WHERE id = 1 LIMIT 1');
    message = getAutoresponderToneMessage(settingsRows[0] || null, sender, 'finish', message);
  }

  let evolutionResult;
  try {
    evolutionResult = await sendAutoresponderEvolutionTextMessage(sender, message);
  } catch (err) {
    return reply.code(502).send({ error: err.message || 'Evolution API send failed' });
  }

  if (!evolutionResult.ok || evolutionResult.body?.error === true) {
    return reply.code(502).send({
      error: true,
      message: formatEvolutionMessage(evolutionResult.body?.message || evolutionResult.body?.response || evolutionResult.body) || 'Evolution API failed to send the WhatsApp message.',
      evolutionStatus: evolutionResult.status,
      evolution: evolutionResult.body,
    });
  }

  const intent = finishAttendance ? 'manual_finished' : 'manual_message';
  await logAutoresponderReply({
    sender,
    message: attendantName ? `Atendente: ${attendantName}` : 'Atendimento manual',
    intent,
    replyText: message,
    matchedCount: 0,
  });

  if (finishAttendance) {
    await pool.query(
      `INSERT INTO autoresponder_conversations (sender, last_message_at, paused_until, pause_reason)
       VALUES (?, CURRENT_TIMESTAMP, DATE_ADD(NOW(), INTERVAL ? MINUTE), 'manual_finished')
       ON DUPLICATE KEY UPDATE
         last_message_at = CURRENT_TIMESTAMP,
         paused_until = DATE_ADD(NOW(), INTERVAL ? MINUTE),
         pause_reason = 'manual_finished'`,
      [sender, pauseMinutes, pauseMinutes]
    );
  } else {
    await pool.query(
      `INSERT INTO autoresponder_conversations (sender, last_message_at, paused_until, pause_reason)
       VALUES (?, CURRENT_TIMESTAMP, DATE_ADD(NOW(), INTERVAL ? MINUTE), 'human_handoff')
       ON DUPLICATE KEY UPDATE
         last_message_at = CURRENT_TIMESTAMP,
         paused_until = DATE_ADD(NOW(), INTERVAL ? MINUTE),
         pause_reason = 'human_handoff'`,
      [sender, pauseMinutes, pauseMinutes]
    );
  }

  if (attendantName) {
    await pool.query(
      `UPDATE autoresponder_conversations
       SET attendant_name = ?, attendant_updated_at = CURRENT_TIMESTAMP
       WHERE sender = ? AND (attendant_name IS NULL OR attendant_name = '')`,
      [attendantName, sender]
    );
  }

  if (sendTagId != null) {
    await applyAutoresponderRuleConversationTag(sender, sendTagId);
  }

  return {
    ok: true,
    sender,
    message,
    attendant_name: attendantName || null,
    send_tag_id: sendTagId,
    pause_reason: finishAttendance ? 'manual_finished' : 'human_handoff',
    evolution: evolutionResult.body,
  };
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

fastify.delete('/autoresponder/unanswered', { preHandler: requireSyncKey }, async (req, reply) => {
  const question = String(req.query?.question || '').trim();
  if (!question) return reply.code(400).send({ error: 'question is required' });
  const [result] = await pool.query(
    `DELETE FROM autoresponder_logs
     WHERE intent = 'fallback'
       AND question = ?`,
    [question]
  );
  return { ok: true, deleted: Number(result?.affectedRows || 0) };
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
  const [[aiFinanceRaw]] = await pool.query(
    `SELECT
       COUNT(*) AS month_responses,
       COALESCE(SUM(ai_input_tokens), 0) AS month_input_tokens,
       COALESCE(SUM(ai_output_tokens), 0) AS month_output_tokens,
       COALESCE(SUM(ai_estimated_cost_usd), 0) AS month_estimated_cost_usd,
       COALESCE(SUM(CASE WHEN created_at >= CURDATE() THEN ai_estimated_cost_usd ELSE 0 END), 0) AS today_estimated_cost_usd,
       COALESCE(SUM(CASE WHEN created_at >= CURDATE() THEN ai_input_tokens ELSE 0 END), 0) AS today_input_tokens,
       COALESCE(SUM(CASE WHEN created_at >= CURDATE() THEN ai_output_tokens ELSE 0 END), 0) AS today_output_tokens
     FROM autoresponder_logs
     WHERE ai_assisted = 1
       AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
  );
  const [settingsRows] = await pool.query('SELECT ai_credit_balance_usd, ai_credit_alert_usd, openai_admin_api_key FROM autoresponder_settings WHERE id = 1 LIMIT 1');
  const aiFinanceSettings = settingsRows[0] || {};
  const creditBalanceUsd = Number(aiFinanceSettings?.ai_credit_balance_usd || 0);
  const monthEstimatedCostUsd = Number(aiFinanceRaw?.month_estimated_cost_usd || 0);
  const openAiOfficialCosts = await fetchOpenAiOfficialCostsUsd({ settings: aiFinanceSettings });
  const openAiOfficialMonthCostUsd = openAiOfficialCosts.cost_usd == null ? null : Number(openAiOfficialCosts.cost_usd);
  const aiFinance = {
    month_responses: Number(aiFinanceRaw?.month_responses || 0),
    month_input_tokens: Number(aiFinanceRaw?.month_input_tokens || 0),
    month_output_tokens: Number(aiFinanceRaw?.month_output_tokens || 0),
    month_estimated_cost_usd: Number(monthEstimatedCostUsd.toFixed(6)),
    today_estimated_cost_usd: Number(Number(aiFinanceRaw?.today_estimated_cost_usd || 0).toFixed(6)),
    today_input_tokens: Number(aiFinanceRaw?.today_input_tokens || 0),
    today_output_tokens: Number(aiFinanceRaw?.today_output_tokens || 0),
    credit_balance_usd: creditBalanceUsd,
    credit_alert_usd: Number(aiFinanceSettings?.ai_credit_alert_usd || 0),
    remaining_credit_usd: Number((creditBalanceUsd - monthEstimatedCostUsd).toFixed(6)),
    has_openai_admin_api_key: getAutoresponderOpenAiAdminKey(aiFinanceSettings).length > 0,
    openai_official_cost_status: openAiOfficialCosts.status,
    openai_official_cost_updated_at: openAiOfficialCosts.updated_at || null,
    openai_official_month_cost_usd: openAiOfficialMonthCostUsd,
    openai_official_remaining_credit_usd: openAiOfficialMonthCostUsd == null
      ? null
      : Number((creditBalanceUsd - openAiOfficialMonthCostUsd).toFixed(6)),
  };
  const topProducts = await getAutoresponderTopProducts(10);
  return { source: 'mysql', summary: { ...summary, ai_finance: aiFinance }, byIntent, topRules, topProducts };
});

fastify.get('/autoresponder/store-status', { preHandler: requireSyncKey }, async () => {
  return getCachedAutoresponderStoreStatus();
});

async function buildAutoresponderTestReply({ message, sender, contactFirstName }) {
  const [settingsRows] = await pool.query('SELECT * FROM autoresponder_settings WHERE id = 1 LIMIT 1');
  const settings = settingsRows[0];
  if (!settings) {
    return {
      intent: 'settings_missing',
      matched_count: 0,
      replies: [],
      warning: 'Configuracoes do AutoResponder nao encontradas.',
    };
  }

  const detectedIntent = detectAutoresponderIntent(message);
  let shouldPrefixGreeting = detectedIntent.greeting;
  const normalizedSender = normalizeAutoresponderSender(sender) || 'teste-bot';
  const purchaseFlow = await getAutoresponderPurchaseFlow(normalizedSender);
  const aiIntentPlan = await buildAutoresponderAiIntentPlan({ message, contactFirstName, settings, sender: normalizedSender });
  shouldPrefixGreeting = shouldPrefixGreeting || Boolean(aiIntentPlan?.greeting);

  const priorityProductReply = await buildAutoresponderPriorityProductSearchReplyData({
    message,
    contactFirstName,
    settings,
    shouldPrefixGreeting,
  });
  if (priorityProductReply) {
    return {
      intent: 'product_search_priority',
      matched_count: priorityProductReply.products.length,
      replies: formatAutoresponderProReplies(priorityProductReply.replyMessages),
      sender: normalizedSender,
    };
  }

  const phoneListOptInReply = await handleAutoresponderPhoneListOptIn({
    sender: normalizedSender,
    message,
    settings,
    shouldPrefixGreeting: false,
  });
  if (phoneListOptInReply) return {
    intent: 'catalog_phone_opt_in',
    matched_count: phoneListOptInReply.replies?.length || 0,
    replies: phoneListOptInReply.replies,
    sender: normalizedSender,
  };

  if (isAutoresponderAudioMessage(message)) {
    const audioReplyText = getAutoresponderToneMessage(settings, normalizedSender, 'audioUnsupported', AUTORESPONDER_AUDIO_UNSUPPORTED_REPLY);
    return {
      intent: 'audio_unsupported',
      matched_count: 0,
      replies: [{ message: audioReplyText }],
      sender: normalizedSender,
    };
  }

  const engineDeliveryReply = await handleAutoresponderEngineDeliveryFlowV2({
    senderKey: normalizedSender,
    message,
    settings,
    purchaseFlow,
  });
  if (engineDeliveryReply) {
    return {
      intent: normalizeAutoresponderCep(message) ? 'delivery_cep_quote' : 'delivery_cep_prompt',
      matched_count: 0,
      replies: engineDeliveryReply.replies,
      sender: normalizedSender,
    };
  }

  const greetingCatalogReply = await buildAutoresponderGreetingCatalogReplyData(message, contactFirstName, settings);
  if (greetingCatalogReply) {
    return {
      intent: 'greeting_catalog_category',
      matched_count: greetingCatalogReply.products.length,
      replies: formatAutoresponderProReplies(greetingCatalogReply.replyMessages),
      sender: normalizedSender,
    };
  }

  if (isAutoresponderAudioMessage(message)) {
    const audioReplyText = getAutoresponderToneMessage(settings, normalizedSender, 'audioUnsupported', AUTORESPONDER_AUDIO_UNSUPPORTED_REPLY);
    return {
      intent: 'audio_unsupported',
      matched_count: 0,
      replies: [{ message: audioReplyText }],
      sender: normalizedSender,
    };
  }

  if (detectedIntent.greetingOnly) {
    const greetingText = getAutoresponderGreetingReply(message, contactFirstName, settings);
    const contactState = await getAutoresponderContactNameState(normalizedSender);
    const contactNameStatus = String(contactState?.contact_name_status || '');
    return {
      intent: 'greeting',
      matched_count: 0,
      replies: [{ message: greetingText }],
      sender: normalizedSender,
    };
  }

  if (detectedIntent.storeStatusRequest) {
    const storeStatus = await getCachedAutoresponderStoreStatus();
    const replyText = buildAutoresponderStoreStatusReply(storeStatus);
    return {
      intent: 'store_status',
      matched_count: 0,
      replies: [{ message: formatAutoresponderReply(replyText, settings, shouldPrefixGreeting) }],
      sender: normalizedSender,
    };
  }

  if (detectedIntent.storeStatusRequest || aiIntentPlan?.storeStatusRequest) {
    const storeStatus = await getCachedAutoresponderStoreStatus();
    const replyMessages = buildAutoresponderStoreStatusReplyMessages({
      message,
      contactFirstName,
      settings,
      storeStatus,
      shouldIncludeGreeting: shouldPrefixGreeting,
    });
    return {
      intent: 'store_status',
      matched_count: 0,
      replies: formatAutoresponderProReplies(replyMessages),
      sender: normalizedSender,
    };
  }

  if (detectedIntent.humanRequest) {
    const storeStatus = await getCachedAutoresponderStoreStatus();
    const humanReplyText = isAutoresponderStoreInHumanHours(storeStatus)
      ? getAutoresponderFixedToneMessage(settings, normalizedSender, 'humanIn', settings.human_message_in_hours, AUTORESPONDER_DEFAULT_HUMAN_IN_HOURS)
      : getAutoresponderFixedToneMessage(settings, normalizedSender, 'humanOut', settings.human_message_out_of_hours || settings.human_message_in_hours, AUTORESPONDER_DEFAULT_HUMAN_OUT_OF_HOURS);
    return {
      intent: 'human_request',
      matched_count: 0,
      replies: [{ message: formatAutoresponderReply(humanReplyText, settings, shouldPrefixGreeting) }],
      sender: normalizedSender,
    };
  }

  if (shouldAutoresponderTryAiFirst({ message, detectedIntent, purchaseFlow })) {
    const aiFirst = await buildAutoresponderAiFirstReply({ message, contactFirstName, settings, sender: normalizedSender });
    if (aiFirst?.text) {
      return {
        intent: 'ai_first',
        matched_count: 0,
        replies: [{ message: formatAutoresponderReply(aiFirst.text, settings, shouldPrefixGreeting) }],
        aiMeta: aiFirst.aiMeta,
        sender: normalizedSender,
      };
    }
  }

  const matchedRule = await findAutoresponderRuleMatch(message);
  if (matchedRule) {
    const replyType = String(matchedRule.reply_type || 'text');
    if (replyType === 'product_by_tag') {
      const keyword = matchedRule.reply_text || matchedRule.name || 'produtos';
      const pageSize = getAutoresponderInitialProductPageSize(keyword);
      const rows = await findAutoresponderProductsByTag(matchedRule.reply_tag_id, pageSize + 1);
      const products = rows.slice(0, pageSize);
      const hasMore = rows.length > pageSize;
      const total = await countAutoresponderProductsByTag(matchedRule.reply_tag_id);
      const productReplyMessages = appendAutoresponderRuleAttachmentToReplies(
        appendAutoresponderReplyFooter(
          await formatAutoresponderProductSearchReplies(products, keyword, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(keyword) }),
          formatAutoresponderProductReplyInstructions(hasMore)
        ),
        matchedRule
      );
      const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
      return {
        intent: 'rule_product_tag',
        matched_count: products.length,
        matched_rule_id: matchedRule.id,
        replies: formatAutoresponderProReplies(replyMessages),
        sender: normalizedSender,
      };
    }

    if (replyType === 'product_search') {
      const keyword = matchedRule.reply_search_query;
      const pageSize = getAutoresponderInitialProductPageSize(keyword);
      const ruleSearchTokens = extractAutoresponderProductSearchTokens(matchedRule.reply_search_query);
      const rows = await findAutoresponderProductsByTokens(ruleSearchTokens, pageSize + 1);
      const products = rows.slice(0, pageSize);
      const hasMore = rows.length > pageSize;
      const total = await countAutoresponderProductsByTokens(ruleSearchTokens);
      const productReplyMessages = appendAutoresponderRuleAttachmentToReplies(
        appendAutoresponderReplyFooter(
          await formatAutoresponderProductSearchReplies(products, keyword, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(keyword) }),
          formatAutoresponderProductReplyInstructions(hasMore)
        ),
        matchedRule
      );
      const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
      return {
        intent: 'rule_product_search',
        matched_count: products.length,
        matched_rule_id: matchedRule.id,
        replies: formatAutoresponderProReplies(replyMessages),
        sender: normalizedSender,
      };
    }

    const resolvedRuleText = await resolveAutoresponderReplyTemplate(
      appendAutoresponderRuleAttachment(matchedRule.reply_text, matchedRule),
      settings
    );
    return {
      intent: 'rule_text',
      matched_count: 1,
      matched_rule_id: matchedRule.id,
      replies: [{ message: formatAutoresponderReply(resolvedRuleText, settings, shouldPrefixGreeting) }],
      sender: normalizedSender,
    };
  }

  const productTagMatch = findAutoresponderProductTagKeyword(message, settings);
  if (productTagMatch) {
    const pageSize = getAutoresponderInitialProductPageSize(productTagMatch.keyword);
    const rows = await findAutoresponderProductsByTag(productTagMatch.tagId, pageSize + 1);
    const products = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;
    const total = await countAutoresponderProductsByTag(productTagMatch.tagId);
    const productReplyMessages = appendAutoresponderReplyFooter(
      await formatAutoresponderProductSearchReplies(products, productTagMatch.keyword, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(productTagMatch.keyword) }),
      formatAutoresponderProductReplyInstructions(hasMore)
    );
    const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
    return {
      intent: 'product_tag',
      matched_count: products.length,
      replies: formatAutoresponderProReplies(replyMessages),
      sender: normalizedSender,
    };
  }

  {
    const categories = await findAutoresponderAvailableCategories(100);
    const budgetRequest = getAutoresponderBudgetCategoryRequest(message, categories);
    if (budgetRequest?.category?.id) {
      const budgetKeyword = budgetRequest.category.name;
      const pageSize = getAutoresponderInitialProductPageSize(budgetKeyword);
      const rows = await findAutoresponderProductsByCategoryBudget(budgetRequest.category.id, budgetRequest.budgetCents, pageSize + 1);
      const products = rows.slice(0, pageSize);
      const hasMore = rows.length > pageSize;
      const total = await countAutoresponderProductsByCategoryBudget(budgetRequest.category.id, budgetRequest.budgetCents);
      if (products.length > 0) {
        const keyword = `${budgetKeyword} ate ${formatAutoresponderCurrency(budgetRequest.budgetCents / 100)}`;
        const productReplyMessages = appendAutoresponderReplyFooter(
          await formatAutoresponderProductSearchReplies(products, keyword, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(budgetKeyword) }),
          formatAutoresponderProductReplyInstructions(hasMore)
        );
        const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
        return {
          intent: 'catalog_budget',
          matched_count: products.length,
          replies: formatAutoresponderProReplies(replyMessages),
          sender: normalizedSender,
        };
      }
    }
  }

  const genericDeviceCatalogFamily = detectAutoresponderGenericDeviceCatalogFamily(message);
  if (genericDeviceCatalogFamily) {
    const replyText = formatAutoresponderReply(
      buildAutoresponderDeviceCatalogRefinementPrompt(genericDeviceCatalogFamily),
      settings,
      shouldPrefixGreeting
    );
    return {
      intent: genericDeviceCatalogFamily === 'smartphone' ? 'catalog_phone_refinement' : 'catalog_device_refinement',
      matched_count: 0,
      replies: [{ message: replyText }],
      sender: normalizedSender,
    };
  }

  if (isAutoresponderCatalogRequest(message)) {
    const categories = await findAutoresponderAvailableCategories(100);
    const selectedCategory = await resolveAutoresponderCatalogCategoryForMessage(message, categories);
    if (selectedCategory?.id) {
      const pageSize = getAutoresponderInitialProductPageSize(selectedCategory.name);
      const rows = await findAutoresponderProductsByCategory(selectedCategory.id, pageSize + 1);
      const products = rows.slice(0, pageSize);
      const hasMore = rows.length > pageSize;
      const total = await countAutoresponderProductsByCategory(selectedCategory.id);
      const productReplyMessages = appendAutoresponderReplyFooter(
        await formatAutoresponderProductSearchReplies(products, selectedCategory.name, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(selectedCategory.name) }),
        formatAutoresponderProductReplyInstructions(hasMore)
      );
      const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
      return {
        intent: 'catalog_category',
        matched_count: products.length,
        replies: formatAutoresponderProReplies(replyMessages),
        sender: normalizedSender,
      };
    }
  }

  const productSearchTokens = extractAutoresponderProductSearchTokens(message);
  if (productSearchTokens.length > 0) {
    const searchKeyword = productSearchTokens.join(' ');
    const pageSize = getAutoresponderInitialProductPageSize(searchKeyword);
    const rows = await findAutoresponderProductsByTokens(productSearchTokens, pageSize + 1);
    const products = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;
    if (products.length > 0) {
      const total = await countAutoresponderProductsByTokens(productSearchTokens);
      const productReplyMessages = appendAutoresponderReplyFooter(
        await formatAutoresponderProductSearchReplies(products, searchKeyword, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(searchKeyword) }),
        formatAutoresponderProductReplyInstructions(hasMore)
      );
      const replyMessages = buildAutoresponderReplyMessagesWithSeparateGreeting(productReplyMessages, {
        message,
        contactFirstName,
        settings,
        shouldIncludeGreeting: shouldPrefixGreeting || isAutoresponderGreeting(message),
      });
      return {
        intent: 'product_search',
        matched_count: products.length,
        replies: formatAutoresponderProReplies(replyMessages),
        sender: normalizedSender,
      };
    }
  }

  const aiFallback = await buildAutoresponderAiFallbackReply({ message, contactFirstName, settings, sender: normalizedSender });
  if (aiFallback?.text) {
    return {
      intent: 'ai_fallback',
      matched_count: 0,
      replies: [{ message: formatAutoresponderReply(aiFallback.text, settings, shouldPrefixGreeting) }],
      aiMeta: aiFallback.aiMeta,
      sender: normalizedSender,
    };
  }

  const fallbackReply = getAutoresponderFallbackReply(settings, 1, normalizedSender);
  return {
    intent: 'fallback',
    matched_count: 0,
    replies: [{ message: formatAutoresponderReply(fallbackReply.replyText, settings, shouldPrefixGreeting) }],
    sender: normalizedSender,
  };
}

fastify.post('/autoresponder/test-reply', { preHandler: requireSyncKey }, async (req, reply) => {
  const startedAt = Date.now();
  const body = req.body || {};
  const message = String(body.message || '').trim();
  if (!message) return reply.code(400).send({ error: 'message is required' });

  const result = await buildAutoresponderTestReply({
    message,
    sender: body.sender || 'teste-bot',
    contactFirstName: body.contactFirstName || body.contact_first_name || '',
  });

  return {
    ok: true,
    message,
    sender: result.sender || normalizeAutoresponderSender(body.sender) || 'teste-bot',
    intent: result.intent || 'unknown',
    matched_count: Number(result.matched_count || 0),
    matched_rule_id: result.matched_rule_id || null,
    response_time_ms: Date.now() - startedAt,
    replies: Array.isArray(result.replies) ? result.replies : [],
    warning: result.warning || null,
  };
});

fastify.patch('/products/:id/tags', { preHandler: requireSyncKey }, async (req, reply) => {
  const tagIds = Array.isArray(req.body?.tag_ids) ? req.body.tag_ids.map(Number).filter(Number.isFinite) : null;
  if (!tagIds) return reply.code(400).send({ error: 'tag_ids array is required' });
  await pool.query('UPDATE products SET tag_ids = ? WHERE id = ?', [jsonStr(tagIds), req.params.id]);
  return { ok: true, tag_ids: tagIds };
});

function extractEvolutionMessageText(messagePayload) {
  const message = messagePayload || {};
  return String(
    message.conversation
    || message.extendedTextMessage?.text
    || message.imageMessage?.caption
    || message.videoMessage?.caption
    || message.buttonsResponseMessage?.selectedDisplayText
    || message.buttonsResponseMessage?.selectedButtonId
    || message.listResponseMessage?.title
    || message.listResponseMessage?.singleSelectReply?.selectedRowId
    || message.templateButtonReplyMessage?.selectedDisplayText
    || message.templateButtonReplyMessage?.selectedId
    || ''
  ).trim();
}

function normalizeEvolutionWebhookPayload(rawPayload) {
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  const key = data.key && typeof data.key === 'object' ? data.key : {};
  const eventName = String(payload.event || payload.type || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const remoteJid = String(key.remoteJid || data.remoteJid || data.from || '').trim();
  const remoteJidAlt = String(key.remoteJidAlt || data.remoteJidAlt || '').trim();
  const participant = String(key.participant || data.participant || '').trim();
  const participantAlt = String(key.participantAlt || data.participantAlt || '').trim();
  const senderJid = remoteJid.endsWith('@lid') && remoteJidAlt ? remoteJidAlt : remoteJid;
  const participantJid = participant.endsWith('@lid') && participantAlt ? participantAlt : participant;
  const messagePayload = data.message || payload.message || {};
  const messageText = extractEvolutionMessageText(messagePayload) || String(data.text || data.messageText || '').trim();
  const isEvolution = Boolean(
    payload.instance
    || payload.instanceName
    || payload.server_url
    || key.remoteJid
    || eventName === 'MESSAGES_UPSERT'
  );

  if (!isEvolution) return null;

  const pushName = String(data.pushName || payload.pushName || payload.name || '').trim();
  return {
    sender: senderJid || participantJid,
    message: messageText,
    isGroup: remoteJid.endsWith('@g.us'),
    fromMe: key.fromMe === true || data.fromMe === true,
    pushName,
    name: pushName,
    event: eventName,
    messageId: String(key.id || data.messageId || data.id || '').trim(),
    evolutionMessageSource: String(data.source || payload.source || '').trim(),
    source: 'evolution',
  };
}

const autoresponderEvolutionWebhookEvents = new Map();

function consumeAutoresponderEvolutionWebhookEvent(messageId) {
  const key = String(messageId || '').trim();
  if (!key) return false;
  const now = Date.now();
  const expiresAt = autoresponderEvolutionWebhookEvents.get(key) || 0;
  if (expiresAt > now) return true;
  autoresponderEvolutionWebhookEvents.set(key, now + 10 * 60 * 1000);
  if (autoresponderEvolutionWebhookEvents.size > 2000) {
    for (const [eventId, eventExpiresAt] of autoresponderEvolutionWebhookEvents) {
      if (eventExpiresAt <= now) autoresponderEvolutionWebhookEvents.delete(eventId);
    }
  }
  return false;
}

function releaseAutoresponderEvolutionWebhookEvent(messageId) {
  const key = String(messageId || '').trim();
  if (key) autoresponderEvolutionWebhookEvents.delete(key);
}

async function sendAutoresponderEvolutionReplies(sender, replies) {
  const replyItems = Array.isArray(replies) ? replies : [];
  const results = [];
  for (const replyItem of replyItems) {
    const text = String(replyItem?.message || replyItem || '').trim();
    if (!text) continue;
    results.push(await sendAutoresponderEvolutionTextMessage(sender, text));
  }
  return results;
}

fastify.addHook('onSend', async (req, reply, payload) => {
  if (!String(req.url || '').startsWith('/autoresponder-webhook')) return payload;
  if (req.autoresponderWebhookSource === 'evolution') {
    try {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (reply.statusCode >= 400 || !Object.prototype.hasOwnProperty.call(parsed || {}, 'replies')) return payload;
      const replies = Array.isArray(parsed?.replies) ? parsed.replies : [];
      const sent = await sendAutoresponderEvolutionReplies(req.autoresponderSender, replies);
      const allSent = sent.every((item) => item.ok);
      if (!allSent) {
        releaseAutoresponderEvolutionWebhookEvent(req.autoresponderMessageId);
        reply.code(502);
      }
      reply.header('Content-Type', 'application/json; charset=utf-8');
      return JSON.stringify({
        ok: allSent,
        source: 'evolution',
        sender: req.autoresponderSender,
        replies: replies.length,
        sent: sent.map((item) => ({ ok: item.ok, status: item.status, body: item.body })),
      });
    } catch (err) {
      reply.code(502);
      return JSON.stringify({ ok: false, source: 'evolution', error: err.message || 'Evolution send failed' });
    }
  }
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
      const rawPayload = { ...(req.query || {}), ...nestedQuery, ...requestBody };
      const evolutionPayload = normalizeEvolutionWebhookPayload(rawPayload);
      const payload = { ...rawPayload, ...(evolutionPayload || {}) };
      const sender = String(payload.sender || payload.from || payload.phone || payload.number || payload.contact || '').trim();
      const message = String(payload.message || payload.text || payload.query || payload.body || payload.received_message || '').trim();
      const isGroup = payload.isGroup === true || String(payload.isGroup || '').toLowerCase() === 'true';
      const senderKey = normalizeAutoresponderSender(sender) || sender || 'unknown';
      req.autoresponderWebhookSource = payload.source || '';
      req.autoresponderSender = senderKey;
      req.autoresponderMessageId = payload.messageId || '';
      if (payload.source === 'evolution' && payload.event && payload.event !== 'MESSAGES_UPSERT') {
        return { replies: [] };
      }
      if (payload.source === 'evolution' && !normalizeAutoresponderSender(sender)) {
        return { replies: [] };
      }
      if (payload.source === 'evolution' && consumeAutoresponderEvolutionWebhookEvent(payload.messageId)) {
        return { replies: [], duplicate: true };
      }
      const detectedIntent = detectAutoresponderIntent(message);
      let shouldPrefixGreeting = detectedIntent.greeting;
      const contactFirstName = getAutoresponderContactFirstName(payload);

      const [settingsRows] = await pool.query('SELECT * FROM autoresponder_settings WHERE id = 1 LIMIT 1');
      const settings = settingsRows[0];
      if (!settings || Number(settings.enabled) !== 1) {
        return { replies: [] };
      }

      if (await isAutoresponderBlocked(sender)) {
        return { replies: [] };
      }

      if (payload.fromMe === true) {
        return { replies: [] };
      }

      if (isGroup) {
        return { replies: [] };
      }

      const isAudioPayload = isAutoresponderAudioPayload(payload, message);
      if (!message && !isAudioPayload) {
        await touchAutoresponderConversation(senderKey);
        return { replies: [] };
      }

      if (isAudioPayload) {
        const audioReplyText = getAutoresponderToneMessage(settings, senderKey, 'audioUnsupported', AUTORESPONDER_AUDIO_UNSUPPORTED_REPLY);
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'audio_unsupported',
          replyText: audioReplyText,
          matchedCount: 0,
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: audioReplyText }] };
      }

      const [conversationRows] = await pool.query(
        'SELECT paused_until, pause_reason FROM autoresponder_conversations WHERE sender = ? LIMIT 1',
        [senderKey]
      );
      const pausedUntil = conversationRows[0]?.paused_until ? new Date(conversationRows[0].paused_until) : null;
      if (pausedUntil && pausedUntil.getTime() > Date.now()) {
        if (String(conversationRows[0]?.pause_reason || '') === 'human_request') {
          await pool.query(
            `UPDATE autoresponder_conversations
             SET paused_until = NULL, pause_reason = NULL
             WHERE sender = ?`,
            [senderKey]
          );
        } else {
          await touchAutoresponderConversation(senderKey);
          return { replies: [] };
        }
      }

      const purchaseFlow = await getAutoresponderPurchaseFlow(senderKey);
      const hasActivePurchaseFlow = hasAutoresponderCartItems(purchaseFlow);
      const aiIntentPlan = await buildAutoresponderAiIntentPlan({ message, contactFirstName, settings, sender: senderKey });
      shouldPrefixGreeting = shouldPrefixGreeting || Boolean(aiIntentPlan?.greeting);

      const priorityProductReply = await buildAutoresponderPriorityProductSearchReplyData({
        message,
        contactFirstName,
        settings,
        shouldPrefixGreeting,
      });
      if (priorityProductReply) {
        const replyText = priorityProductReply.replyMessages.join('\n\n');
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'product_search_priority',
          replyText,
          matchedCount: priorityProductReply.products.length,
          matchedProducts: priorityProductReply.productOptions,
          aiMeta: aiIntentPlan?.aiMeta || null,
        });
        await upsertAutoresponderOptionsConversation(senderKey, priorityProductReply.productOptions, {
          source: 'search',
          tokens: priorityProductReply.productSearchTokens,
          offset: 0,
          limit: priorityProductReply.pageSize,
          total: priorityProductReply.total,
          hasMore: priorityProductReply.hasMore,
          completeList: isAutoresponderCompleteProductListKeyword(priorityProductReply.searchKeyword),
        });
        return { replies: formatAutoresponderProReplies(priorityProductReply.replyMessages) };
      }

      const phoneListOptInReply = await handleAutoresponderPhoneListOptIn({
        sender: senderKey,
        message,
        settings,
        shouldPrefixGreeting: false,
      });
      if (phoneListOptInReply) return phoneListOptInReply;

      const replyLimit = Number(settings.max_replies_per_conversation) > 0
        ? Number(settings.max_replies_per_conversation)
        : 20;
      const replyWindowHours = Number(settings.max_replies_window_hours) > 0
        ? Number(settings.max_replies_window_hours)
        : 24;
      const recentReplyCount = await getAutoresponderReplyCount(senderKey, replyWindowHours);
      if (!hasActivePurchaseFlow && !(detectedIntent.storeStatusRequest || aiIntentPlan?.storeStatusRequest) && recentReplyCount >= replyLimit) {
        await touchAutoresponderConversation(senderKey);
        return { replies: [] };
      }

      const engineDeliveryReply = await handleAutoresponderEngineDeliveryFlowV2({
        senderKey,
        message,
        settings,
      });
      if (engineDeliveryReply) return engineDeliveryReply;

      const engineProductSearchReply = await handleAutoresponderEngineProductSearchFlowV2({
        senderKey,
        message,
        settings,
      });
      if (engineProductSearchReply) return engineProductSearchReply;

      const enginePurchaseReply = await handleAutoresponderEnginePurchaseFlowV2({
        senderKey,
        message,
        settings,
        purchaseFlow,
      });
      if (enginePurchaseReply) return enginePurchaseReply;

      const greetingCatalogReply = await buildAutoresponderGreetingCatalogReplyData(message, contactFirstName, settings);
      if (greetingCatalogReply) {
        const replyText = greetingCatalogReply.replyMessages.join('\n\n');
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'greeting_catalog_category',
          replyText,
          matchedCount: greetingCatalogReply.products.length,
          matchedProducts: greetingCatalogReply.productOptions,
        });
        await upsertAutoresponderOptionsConversation(senderKey, greetingCatalogReply.productOptions, {
          source: 'category',
          categoryId: greetingCatalogReply.selectedCategory.id,
          keyword: greetingCatalogReply.selectedCategory.name,
          offset: 0,
          limit: greetingCatalogReply.pageSize,
          total: greetingCatalogReply.total,
          hasMore: greetingCatalogReply.hasMore,
          completeList: isAutoresponderCompleteProductListKeyword(greetingCatalogReply.selectedCategory.name),
        });

        return { replies: formatAutoresponderProReplies(greetingCatalogReply.replyMessages) };
      }

      const contactFlowReply = await handleAutoresponderContactNameFlow({ sender: senderKey, message, contactFirstName });
      if (contactFlowReply) {
        const contactFlowReplies = Array.isArray(contactFlowReply) ? contactFlowReply : [contactFlowReply];
        const formattedContactFlowReplies = formatAutoresponderReplies(contactFlowReplies, settings, false);
        const contactFlowReplyText = formattedContactFlowReplies.join('\n\n');
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'contact_name',
          replyText: contactFlowReplyText,
          matchedCount: formattedContactFlowReplies.length,
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: formattedContactFlowReplies.map((replyMessage) => ({ message: replyMessage })) };
      }

      if (detectedIntent.storeStatusRequest || aiIntentPlan?.storeStatusRequest) {
        const storeStatus = await getCachedAutoresponderStoreStatus();
        const replyMessages = buildAutoresponderStoreStatusReplyMessages({
          message,
          contactFirstName,
          settings,
          storeStatus,
          shouldIncludeGreeting: shouldPrefixGreeting,
        });
        const replyText = replyMessages.join('\n\n');
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'store_status',
          replyText,
          matchedCount: 0,
          aiMeta: aiIntentPlan?.aiMeta || null,
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: formatAutoresponderProReplies(replyMessages) };
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
            ? '\n\nQual seu nome para seguirmos com o atendimento?'
          : '';
        const greetingText = getAutoresponderGreetingReply(message, contactFirstName, settings);
        if (shouldConfirmContactName || shouldAskContactName) {
          const replyText = [greetingText, contactPrompt.trim()].filter(Boolean).join('\n\n');
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'contact_name_prompt',
            replyText,
            matchedCount: 0,
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: greetingText }, { message: contactPrompt.trim() }] };
        }

        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'greeting',
          replyText: greetingText,
          matchedCount: 0,
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: greetingText }] };
      }

      if (detectedIntent.warrantyRequest) {
        return handleAutoresponderWarrantyRequest({
          sender: senderKey,
          message,
          settings,
          purchaseFlow,
          shouldPrefixGreeting,
        });
      }

      if (shouldAutoresponderTryAiFirst({ message, detectedIntent, purchaseFlow })) {
        const aiFirst = await buildAutoresponderAiFirstReply({ message, contactFirstName, settings, sender: senderKey });
        if (aiFirst?.text) {
          const replyText = formatAutoresponderReply(aiFirst.text, settings, shouldPrefixGreeting);
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'ai_first',
            replyText,
            matchedCount: 0,
            aiMeta: aiFirst.aiMeta,
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
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
        const replyText = formatAutoresponderReply(await formatAutoresponderCartSummaryReply(items), settings, false);
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
          const nextFlow = {
            ...purchaseFlow,
            status: 'awaiting_payment_method',
            fulfillment: 'pickup',
            delivery_address: null,
          };
          const replyText = formatAutoresponderReply(
            `${buildAutoresponderPickupConfirmationReply(settings)}\n\n${buildAutoresponderPaymentMethodPrompt(nextFlow)}`,
            settings,
            false
          );
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...nextFlow,
            totals: calculateAutoresponderCartTotalsWithShipping(nextFlow.items, nextFlow),
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
          const replyText = formatAutoresponderReply(buildAutoresponderDeliveryAddressPrompt(settings), settings, false);
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

      if (purchaseFlow.status === 'awaiting_standalone_delivery_cep' && !hasAutoresponderCartItems(purchaseFlow)) {
        const cep = normalizeAutoresponderCep(message);
        if (cep) {
          return await handleAutoresponderStandaloneDeliveryCepLookup({ senderKey, message, purchaseFlow, settings, cep });
        }
        const replyText = formatAutoresponderReply(buildAutoresponderDeliveryAddressPrompt(settings), settings, false);
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
      }

      if (purchaseFlow.status === 'awaiting_delivery_address' && hasAutoresponderCartItems(purchaseFlow)) {
        const cep = normalizeAutoresponderCep(message);
        if (cep) {
          return await handleAutoresponderDeliveryCepLookup({ senderKey, message, purchaseFlow, settings, cep });
        }
        const replyText = formatAutoresponderReply(buildAutoresponderDeliveryAddressPrompt(settings), settings, false);
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
      }

      if (purchaseFlow.status === 'awaiting_delivery_cep_confirmation' && hasAutoresponderCartItems(purchaseFlow)) {
        const replacementCep = normalizeAutoresponderCep(message);
        if (replacementCep) {
          return await handleAutoresponderDeliveryCepLookup({ senderKey, message, purchaseFlow, settings, cep: replacementCep });
        }
        const directNumberReply = await handleAutoresponderDeliveryNumberInput({ senderKey, message, purchaseFlow, settings });
        if (directNumberReply) return directNumberReply;
        if (isAutoresponderNo(message)) {
          const nextFlow = {
            ...purchaseFlow,
            status: 'awaiting_delivery_address',
            delivery_address_lookup: null,
            shipping_options: [],
            shipping_quote: null,
          };
          await saveAutoresponderPurchaseFlow(senderKey, nextFlow);
          const replyText = formatAutoresponderReply(buildAutoresponderDeliveryAddressPrompt(settings), settings, false);
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
        if (isAutoresponderYes(message)) {
          const replyText = formatAutoresponderReply(buildAutoresponderDeliveryNumberPrompt(), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            status: 'awaiting_delivery_number',
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_delivery_cep_confirmed',
            replyText,
            matchedCount: purchaseFlow.shipping_quote ? 1 : 0,
            matchedProducts: purchaseFlow.shipping_quote ? [purchaseFlow.shipping_quote] : [],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
      }

      if (purchaseFlow.status === 'awaiting_delivery_number' && hasAutoresponderCartItems(purchaseFlow)) {
        const numberReply = await handleAutoresponderDeliveryNumberInput({ senderKey, message, purchaseFlow, settings });
        if (numberReply) return numberReply;
      }

      if (purchaseFlow.status === 'awaiting_payment_method' && hasAutoresponderCartItems(purchaseFlow)) {
        const paymentMethod = getAutoresponderPaymentMethodChoice(message);
        const cartTotals = calculateAutoresponderCartTotalsWithShipping(purchaseFlow.items, purchaseFlow);
        if (paymentMethod && ['pix', 'cash', 'debit'].includes(paymentMethod)) {
          const selectedPayment = {
            method: paymentMethod,
            label: paymentMethod === 'pix' ? 'Pix' : paymentMethod === 'cash' ? 'Dinheiro' : 'Debito',
            total_cents: cartTotals.total_cents,
            base_total_cents: cartTotals.total_cents,
          };
          const nextFlow = {
            ...purchaseFlow,
            status: 'customer_data_pending',
            totals: cartTotals,
            selected_payment: selectedPayment,
          };
          const replyText = formatAutoresponderReply(buildAutoresponderCashPaymentSelectedReply(paymentMethod, nextFlow), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, nextFlow);
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_payment_cash_selected',
            replyText,
            matchedCount: 1,
            matchedProducts: [selectedPayment],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }

        if (paymentMethod === 'credit') {
          const nextFlow = {
            ...purchaseFlow,
            status: 'awaiting_card_entry',
            totals: cartTotals,
            payment_method: 'credit',
          };
          const replyText = formatAutoresponderReply(buildAutoresponderCardEntryPrompt(nextFlow), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, nextFlow);
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_payment_card_entry_prompt',
            replyText,
            matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
            matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }

        return await promptAutoresponderPaymentMethod({ senderKey, message, purchaseFlow, settings });
      }

      if (purchaseFlow.status === 'awaiting_card_entry' && hasAutoresponderCartItems(purchaseFlow)) {
        const cartTotals = calculateAutoresponderCartTotalsWithShipping(purchaseFlow.items, purchaseFlow);
        const entryCents = parseAutoresponderPaymentEntryCents(message, cartTotals.total_cents);
        if (entryCents === null) {
          const replyText = formatAutoresponderReply(buildAutoresponderCardEntryPrompt(purchaseFlow), settings, false);
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
        const cardBaseCents = Math.max(Number(cartTotals.total_cents || 0) - Number(entryCents || 0), 0);
        const installmentOptions = attachAutoresponderEntryToInstallments(
          await calculateAutoresponderInstallmentOptions(cardBaseCents, 12),
          entryCents,
          cardBaseCents
        );
        const nextFlow = {
          ...purchaseFlow,
          status: 'awaiting_card_installments',
          totals: cartTotals,
          card_entry_cents: entryCents,
          card_base_cents: cardBaseCents,
          installment_options: installmentOptions,
        };
        const replyText = formatAutoresponderReply(
          buildAutoresponderInstallmentTableReply(installmentOptions, cartTotals.total_cents, entryCents),
          settings,
          false
        );
        await saveAutoresponderPurchaseFlow(senderKey, nextFlow);
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'purchase_payment_card_installments',
          replyText,
          matchedCount: installmentOptions.length,
          matchedProducts: installmentOptions,
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
      }

      if (purchaseFlow.status === 'awaiting_card_installments' && hasAutoresponderCartItems(purchaseFlow)) {
        const requestedInstallments = getAutoresponderRequestedInstallments(message);
        const cartTotals = calculateAutoresponderCartTotalsWithShipping(purchaseFlow.items, purchaseFlow);
        const entryCents = Number(purchaseFlow.card_entry_cents || 0);
        const cardBaseCents = Math.max(Number(cartTotals.total_cents || 0) - entryCents, 0);
        const installmentOptions = Array.isArray(purchaseFlow.installment_options) && purchaseFlow.installment_options.length > 0
          ? purchaseFlow.installment_options
          : attachAutoresponderEntryToInstallments(
            await calculateAutoresponderInstallmentOptions(cardBaseCents, 12),
            entryCents,
            cardBaseCents
          );
        const selectedPayment = requestedInstallments
          ? buildAutoresponderSelectedInstallmentPayment(requestedInstallments, installmentOptions, cardBaseCents)
          : null;
        if (selectedPayment) {
          const nextFlow = {
            ...purchaseFlow,
            status: 'customer_data_pending',
            totals: cartTotals,
            selected_payment: selectedPayment,
          };
          const replyText = formatAutoresponderReply(buildAutoresponderSelectedInstallmentReply(selectedPayment), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, nextFlow);
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_payment_card_selected',
            replyText,
            matchedCount: 1,
            matchedProducts: [selectedPayment],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
        const replyText = formatAutoresponderReply(
          buildAutoresponderInstallmentTableReply(installmentOptions, cartTotals.total_cents, entryCents),
          settings,
          false
        );
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
      }

      if (purchaseFlow.status === 'awaiting_customer_full_name' && hasAutoresponderCartItems(purchaseFlow)) {
        const fullName = normalizeAutoresponderContactName(message);
        if (isAutoresponderFullName(fullName)) {
          const nextFlow = {
            ...purchaseFlow,
            status: 'customer_data_pending',
            customer_data: {
              ...(purchaseFlow.customer_data || {}),
              name: fullName,
            },
          };
          await saveAutoresponderPurchaseFlow(senderKey, nextFlow);
          const customerData = await getAutoresponderCustomerDataSnapshot(senderKey, payload, nextFlow);
          const existingCustomer = await findAutoresponderExistingCustomer(customerData);
          const mergedCustomerData = mergeAutoresponderExistingCustomerData(customerData, existingCustomer);
          const replyText = formatAutoresponderReply(buildAutoresponderCustomerDataConfirmationReply(mergedCustomerData), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...nextFlow,
            status: 'awaiting_customer_confirmation',
            customer_data: mergedCustomerData,
            existing_customer: existingCustomer,
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_customer_full_name_saved',
            replyText,
            matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
            matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
          });
          if (existingCustomer) {
            await logAutoresponderReply({
              sender: senderKey,
              message,
              intent: 'purchase_existing_customer_found',
              replyText,
              matchedCount: 1,
              matchedProducts: [existingCustomer],
            });
          } else {
            await logAutoresponderReply({
              sender: senderKey,
              message,
              intent: 'purchase_existing_customer_not_found',
              replyText,
              matchedCount: 0,
              matchedProducts: [],
            });
          }
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
        const replyText = formatAutoresponderReply(buildAutoresponderFullNamePrompt(settings), settings, false);
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
      }

      if (purchaseFlow.status === 'customer_data_pending' && hasAutoresponderCartItems(purchaseFlow)) {
        let customerData = await getAutoresponderCustomerDataSnapshot(senderKey, payload, purchaseFlow);
        if (!isAutoresponderFullName(customerData.name)) {
          const replyText = formatAutoresponderReply(buildAutoresponderFullNamePrompt(settings), settings, false);
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            status: 'awaiting_customer_full_name',
            customer_data: {
              ...(purchaseFlow.customer_data || {}),
              ...customerData,
            },
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_customer_full_name_prompt',
            replyText,
            matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
            matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
        const existingCustomer = await findAutoresponderExistingCustomer(customerData);
        customerData = mergeAutoresponderExistingCustomerData(customerData, existingCustomer);
        const replyText = formatAutoresponderReply(buildAutoresponderCustomerDataConfirmationReply(customerData), settings, false);
        await saveAutoresponderPurchaseFlow(senderKey, {
          ...purchaseFlow,
          status: 'awaiting_customer_confirmation',
          customer_data: customerData,
          existing_customer: existingCustomer,
        });
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'purchase_customer_data_confirmation',
          replyText,
          matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
          matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
        });
        if (existingCustomer) {
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_existing_customer_found',
            replyText,
            matchedCount: 1,
            matchedProducts: [existingCustomer],
          });
        } else {
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_existing_customer_not_found',
            replyText,
            matchedCount: 0,
            matchedProducts: [],
          });
        }
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

          const nextPurchaseFlow = {
            ...purchaseFlow,
            status: 'customer_registration_ready',
            customer_data_confirmed: true,
          };
          const customerRecord = await createOrUpdateAutoresponderCustomer(
            nextPurchaseFlow.customer_data || {},
            nextPurchaseFlow,
            senderKey
          );
          const linkedPurchaseFlow = buildAutoresponderCustomerLinkedPurchaseFlow(nextPurchaseFlow, customerRecord);
          const attendantSummary = formatAutoresponderAttendantOrderSummary(linkedPurchaseFlow, senderKey);
          const handoffPurchaseFlow = {
            ...linkedPurchaseFlow,
            attendant_summary: attendantSummary,
            status: 'pedido_em_andamento',
            handoff_created_at: new Date().toISOString(),
          };
          const replyText = formatAutoresponderReply(buildAutoresponderCustomerOrderHandoffReply(settings, senderKey), settings, false);
          const pauseMinutes = Number(settings.human_pause_minutes) > 0 ? Number(settings.human_pause_minutes) : 60;
          await saveAutoresponderPurchaseFlow(senderKey, handoffPurchaseFlow);
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_customer_upserted',
            replyText,
            matchedCount: customerRecord ? 1 : 0,
            matchedProducts: customerRecord ? [customerRecord] : [],
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_request',
            replyText,
            matchedCount: 1,
            matchedProducts: [handoffPurchaseFlow],
          });
          await pauseAutoresponderConversationForPurchase(senderKey, pauseMinutes);
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
          const documentCustomerData = {
            ...(purchaseFlow.customer_data || {}),
            cpf_cnpj: customerDocument,
          };
          const existingCustomer = await findAutoresponderExistingCustomer(documentCustomerData);
          const nextPurchaseFlow = {
            ...purchaseFlow,
            status: 'customer_registration_ready',
            customer_data: mergeAutoresponderExistingCustomerData(documentCustomerData, existingCustomer),
            existing_customer: existingCustomer,
            cpf_cnpj: customerDocument,
          };
          const customerRecord = await createOrUpdateAutoresponderCustomer(
            nextPurchaseFlow.customer_data || {},
            nextPurchaseFlow,
            senderKey
          );
          const linkedPurchaseFlow = buildAutoresponderCustomerLinkedPurchaseFlow(nextPurchaseFlow, customerRecord);
          const attendantSummary = formatAutoresponderAttendantOrderSummary(linkedPurchaseFlow, senderKey);
          const handoffPurchaseFlow = {
            ...linkedPurchaseFlow,
            attendant_summary: attendantSummary,
            status: 'pedido_em_andamento',
            handoff_created_at: new Date().toISOString(),
          };
          const replyText = formatAutoresponderReply(buildAutoresponderCustomerOrderHandoffReply(settings, senderKey), settings, false);
          const pauseMinutes = Number(settings.human_pause_minutes) > 0 ? Number(settings.human_pause_minutes) : 60;
          await saveAutoresponderPurchaseFlow(senderKey, handoffPurchaseFlow);
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_customer_upserted',
            replyText,
            matchedCount: customerRecord ? 1 : 0,
            matchedProducts: customerRecord ? [customerRecord] : [],
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_request',
            replyText,
            matchedCount: 1,
            matchedProducts: [handoffPurchaseFlow],
          });
          await pauseAutoresponderConversationForPurchase(senderKey, pauseMinutes);
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
      }

      const requestedInstallments = getAutoresponderRequestedInstallments(message);
      if (requestedInstallments && hasAutoresponderCartItems(purchaseFlow)) {
        const cartTotals = calculateAutoresponderCartTotalsWithShipping(purchaseFlow.items, purchaseFlow);
        const installmentOptions = await calculateAutoresponderInstallmentOptions(cartTotals.total_cents, 12);
        if (isAutoresponderInstallmentChoiceRequest(message)) {
          const selectedPayment = buildAutoresponderSelectedInstallmentPayment(
            requestedInstallments,
            installmentOptions,
            cartTotals.total_cents
          );
          const replyText = formatAutoresponderReply(
            buildAutoresponderSelectedInstallmentReply(selectedPayment),
            settings,
            false
          );
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            selected_payment: selectedPayment,
            totals: cartTotals,
          });
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'purchase_installment_selected',
            replyText,
            matchedCount: selectedPayment ? 1 : 0,
            matchedProducts: selectedPayment ? [selectedPayment] : [],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
        const replyText = formatAutoresponderReply(
          formatAutoresponderSpecificInstallmentReply(requestedInstallments, installmentOptions, cartTotals.total_cents),
          settings,
          false
        );
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'purchase_specific_installment_quote',
          replyText,
          matchedCount: Array.isArray(purchaseFlow.items) ? purchaseFlow.items.length : 0,
          matchedProducts: Array.isArray(purchaseFlow.items) ? purchaseFlow.items : [],
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
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
          const pageSize = getAutoresponderInitialProductPageSize(selectedCategory.name);
          const rows = await findAutoresponderProductsByCategory(selectedCategory.id, pageSize + 1);
          const products = rows.slice(0, pageSize);
          const hasMore = rows.length > pageSize;
          const total = await countAutoresponderProductsByCategory(selectedCategory.id);
          const productOptions = buildAutoresponderProductOptions(products);
          const productReplyMessages = appendAutoresponderReplyFooter(
            await formatAutoresponderProductSearchReplies(products, selectedCategory.name, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(selectedCategory.name) }),
            formatAutoresponderProductReplyInstructions(hasMore)
          );
          const replyMessages = buildAutoresponderReplyMessagesWithSeparateGreeting(productReplyMessages, {
            message,
            contactFirstName,
            settings,
            shouldIncludeGreeting: shouldPrefixGreeting || isAutoresponderGreeting(message),
          });
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
          const variations = await findAutoresponderProductVariations(selectedProduct);
          if (shouldAutoresponderAskVariation(variations)) {
            const replyText = formatAutoresponderReply(buildAutoresponderVariationPrompt(variations), settings, false);
            await saveAutoresponderPurchaseFlow(senderKey, {
              ...purchaseFlow,
              status: 'awaiting_variation',
              variation_options: variations.map((variation) => ({
                id: variation.id,
                name: variation.name,
                sku: variation.sku,
                slug: variation.slug,
                color: getAutoresponderProductColor(variation),
                price_cents: getAutoresponderProductPriceCents(variation),
                stock_quantity: variation.stock_quantity == null ? null : Number(variation.stock_quantity),
              })),
            });
            await logAutoresponderReply({
              sender: senderKey,
              message,
              intent: 'purchase_variation_prompt',
              replyText,
              matchedCount: variations.length,
              matchedProducts: variations,
            });
            await upsertAutoresponderSuccessConversation(senderKey);
            return { replies: [{ message: replyText }] };
          }
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
          const replyText = formatAutoresponderReply(
            await buildAutoresponderPurchaseActionPrompt(product, purchaseFlow.selected_product),
            settings,
            false
          );

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

      if (purchaseFlow.status === 'awaiting_variation' && purchaseFlow.selected_product?.id) {
        const product = await findAutoresponderProductById(purchaseFlow.selected_product.id);
        const variations = Array.isArray(purchaseFlow.variation_options) && purchaseFlow.variation_options.length > 0
          ? purchaseFlow.variation_options
          : await findAutoresponderProductVariations(product || purchaseFlow.selected_product);
        const selectedVariation = findAutoresponderSelectedVariation(message, variations);
        if (!selectedVariation) {
          const replyText = formatAutoresponderReply(buildAutoresponderVariationPrompt(variations), settings, false);
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
        const fullVariation = await findAutoresponderProductById(selectedVariation.id) || selectedVariation;
        const replyText = formatAutoresponderReply(buildAutoresponderQuantityPrompt(fullVariation), settings, false);
        await saveAutoresponderPurchaseFlow(senderKey, {
          ...purchaseFlow,
          status: 'awaiting_quantity',
          selected_product: {
            id: fullVariation.id,
            name: fullVariation.name || selectedVariation.name || null,
            sku: fullVariation.sku || selectedVariation.sku || null,
            slug: fullVariation.slug || selectedVariation.slug || null,
            color: getAutoresponderProductColor(fullVariation) || selectedVariation.color || null,
            price_cents: getAutoresponderProductPriceCents(fullVariation),
            stock_quantity: fullVariation.stock_quantity == null ? selectedVariation.stock_quantity || null : Number(fullVariation.stock_quantity),
          },
          requested_quantity: null,
        });
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'purchase_variation_selected',
          replyText,
          matchedCount: 1,
          matchedProducts: [fullVariation],
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
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
          const replyText = formatAutoresponderReply(await buildAutoresponderPurchaseActionPrompt(product, selectedOption), settings, false);
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
            : pagination.source === 'category'
              ? await findAutoresponderProductsByCategory(pagination.categoryId, pageSize + 1, nextOffset)
              : pagination.source === 'category_budget'
                ? await findAutoresponderProductsByCategoryBudget(pagination.categoryId, pagination.budgetCents, pageSize + 1, nextOffset)
              : await findAutoresponderProductsByTokens(pagination.tokens || [], pageSize + 1, nextOffset);
          const products = rows.slice(0, pageSize);
          const hasMore = rows.length > pageSize;
          if (products.length > 0) {
            const productOptions = buildAutoresponderProductOptions(products);
            const keyword = pagination.source === 'tag'
              ? (pagination.keyword || 'mais produtos')
              : pagination.source === 'category'
                ? (pagination.keyword || 'produtos')
                : pagination.source === 'category_budget'
                  ? (pagination.keyword || 'produtos')
                : (pagination.tokens || []).join(' ');
            const total = Number(pagination.total || 0) > 0
              ? Number(pagination.total)
              : (pagination.source === 'tag'
                ? await countAutoresponderProductsByTag(pagination.tagId)
                : pagination.source === 'category'
                  ? await countAutoresponderProductsByCategory(pagination.categoryId)
                  : pagination.source === 'category_budget'
                    ? await countAutoresponderProductsByCategoryBudget(pagination.categoryId, pagination.budgetCents)
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
        if (pagination?.source && !pagination.hasMore) {
          const replyText = formatAutoresponderReply(
            'Ja te mostrei as opcoes disponiveis dessa lista. Responda com o numero ou nome do produto que eu te mando os detalhes.',
            settings,
            false
          );
          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'more_products_exhausted',
            replyText,
            matchedCount: Array.isArray(context.items) ? context.items.length : 0,
            matchedProducts: Array.isArray(context.items) ? context.items : [],
          });
          await upsertAutoresponderSuccessConversation(senderKey);
          return { replies: [{ message: replyText }] };
        }
      }

      if (detectedIntent.humanRequest) {
        const storeStatus = await getCachedAutoresponderStoreStatus();
        const humanReplyText = isAutoresponderStoreInHumanHours(storeStatus)
          ? getAutoresponderFixedToneMessage(settings, senderKey, 'humanIn', settings.human_message_in_hours, AUTORESPONDER_DEFAULT_HUMAN_IN_HOURS)
          : getAutoresponderFixedToneMessage(settings, senderKey, 'humanOut', settings.human_message_out_of_hours || settings.human_message_in_hours, AUTORESPONDER_DEFAULT_HUMAN_OUT_OF_HOURS);
        const replyText = formatAutoresponderReply(humanReplyText, settings, shouldPrefixGreeting);

        await pool.query(
          `INSERT INTO autoresponder_logs
            (sender, question, intent, matched_count, reply_text, response_time_ms, is_group)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [senderKey, message || null, 'human_request', 0, replyText, 0, 0]
        );

        await upsertAutoresponderSuccessConversation(senderKey);

        return { replies: [{ message: replyText }] };
      }

      const latePhoneListOptInReply = await handleAutoresponderPhoneListOptIn({
        sender: senderKey,
        message,
        settings,
        shouldPrefixGreeting,
      });
      if (latePhoneListOptInReply) return latePhoneListOptInReply;

      const matchedRule = await findAutoresponderRuleMatch(message);
      if (matchedRule) {
        await pool.query(
          'UPDATE autoresponder_rules SET hits = hits + 1 WHERE id = ?',
          [matchedRule.id]
        );

        if (String(matchedRule.reply_type || 'text') === 'product_by_tag') {
          const keyword = matchedRule.reply_text || matchedRule.name || 'produtos';
          const pageSize = getAutoresponderInitialProductPageSize(keyword);
          const rows = await findAutoresponderProductsByTag(matchedRule.reply_tag_id, pageSize + 1);
          const products = rows.slice(0, pageSize);
          const hasMore = rows.length > pageSize;
          const total = await countAutoresponderProductsByTag(matchedRule.reply_tag_id);
          const productOptions = buildAutoresponderProductOptions(products);
          const productReplyMessages = appendAutoresponderRuleAttachmentToReplies(
            appendAutoresponderReplyFooter(
              await formatAutoresponderProductSearchReplies(products, keyword, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(keyword) }),
              formatAutoresponderProductReplyInstructions(hasMore)
            ),
            matchedRule
          );
          const replyMessages = buildAutoresponderReplyMessagesWithSeparateGreeting(productReplyMessages, {
            message,
            contactFirstName,
            settings,
            shouldIncludeGreeting: shouldPrefixGreeting || isAutoresponderGreeting(message),
          });
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
            keyword,
            offset: 0,
            limit: pageSize,
            total,
            hasMore,
          });
          await applyAutoresponderRuleConversationTag(senderKey, matchedRule.auto_apply_tag_id);

          return { replies: formatAutoresponderProReplies(replyMessages) };
        }

        if (String(matchedRule.reply_type || 'text') === 'product_search') {
          const keyword = matchedRule.reply_search_query;
          const pageSize = getAutoresponderInitialProductPageSize(keyword);
          const ruleSearchTokens = extractAutoresponderProductSearchTokens(matchedRule.reply_search_query);
          const rows = await findAutoresponderProductsByTokens(ruleSearchTokens, pageSize + 1);
          const products = rows.slice(0, pageSize);
          const hasMore = rows.length > pageSize;
          const total = await countAutoresponderProductsByTokens(ruleSearchTokens);
          const productOptions = buildAutoresponderProductOptions(products);
          const productReplyMessages = appendAutoresponderRuleAttachmentToReplies(
            appendAutoresponderReplyFooter(
              await formatAutoresponderProductSearchReplies(products, keyword, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(keyword) }),
              formatAutoresponderProductReplyInstructions(hasMore)
            ),
            matchedRule
          );
          const replyMessages = buildAutoresponderReplyMessagesWithSeparateGreeting(productReplyMessages, {
            message,
            contactFirstName,
            settings,
            shouldIncludeGreeting: shouldPrefixGreeting || isAutoresponderGreeting(message),
          });
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

        const resolvedRuleText = await resolveAutoresponderReplyTemplate(
          appendAutoresponderRuleAttachment(matchedRule.reply_text, matchedRule),
          settings
        );
        const replyText = formatAutoresponderReply(
          resolvedRuleText,
          settings,
          shouldPrefixGreeting
        );
        const awaitsStandaloneDeliveryCep = shouldAutoresponderRuleAwaitStandaloneDeliveryCep(matchedRule, resolvedRuleText);
        if (awaitsStandaloneDeliveryCep && !hasAutoresponderCartItems(purchaseFlow)) {
          await saveAutoresponderPurchaseFlow(senderKey, {
            ...purchaseFlow,
            status: 'awaiting_standalone_delivery_cep',
            items: [],
          });
        }

        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: awaitsStandaloneDeliveryCep ? 'standalone_delivery_cep_prompt' : 'rule_text',
          replyText,
          matchedCount: 1,
          matchedRuleId: matchedRule.id,
        });
        await applyRuleNextState(senderKey, matchedRule, purchaseFlow);
        await upsertAutoresponderSuccessConversation(senderKey);
        await applyAutoresponderRuleConversationTag(senderKey, matchedRule.auto_apply_tag_id);

        return { replies: [{ message: replyText }] };
      }

      const productTagMatch = findAutoresponderProductTagKeyword(message, settings);
      if (productTagMatch) {
        const pageSize = getAutoresponderInitialProductPageSize(productTagMatch.keyword);
        const rows = await findAutoresponderProductsByTag(productTagMatch.tagId, pageSize + 1);
        const products = rows.slice(0, pageSize);
        const hasMore = rows.length > pageSize;
        const total = await countAutoresponderProductsByTag(productTagMatch.tagId);
        const productOptions = buildAutoresponderProductOptions(products);
        const productReplyMessages = appendAutoresponderReplyFooter(
          await formatAutoresponderProductSearchReplies(products, productTagMatch.keyword, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(productTagMatch.keyword) }),
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
          completeList: isAutoresponderCompleteProductListKeyword(productTagMatch.keyword),
        });

        return { replies: formatAutoresponderProReplies(replyMessages) };
      }

      {
        const categories = await findAutoresponderAvailableCategories(100);
        const budgetRequest = getAutoresponderBudgetCategoryRequest(message, categories);
        if (budgetRequest?.category?.id) {
          const budgetKeyword = budgetRequest.category.name;
          const pageSize = getAutoresponderInitialProductPageSize(budgetKeyword);
          const rows = await findAutoresponderProductsByCategoryBudget(budgetRequest.category.id, budgetRequest.budgetCents, pageSize + 1);
          const products = rows.slice(0, pageSize);
          const hasMore = rows.length > pageSize;
          const total = await countAutoresponderProductsByCategoryBudget(budgetRequest.category.id, budgetRequest.budgetCents);
          if (products.length > 0) {
            const productOptions = buildAutoresponderProductOptions(products);
            const keyword = `${budgetKeyword} ate ${formatAutoresponderCurrency(budgetRequest.budgetCents / 100)}`;
            const productReplyMessages = appendAutoresponderReplyFooter(
              await formatAutoresponderProductSearchReplies(products, keyword, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(budgetKeyword) }),
              formatAutoresponderProductReplyInstructions(hasMore)
            );
            const replyMessages = formatAutoresponderReplies(productReplyMessages, settings, shouldPrefixGreeting);
            const replyText = replyMessages.join('\n\n');

            await logAutoresponderReply({
              sender: senderKey,
              message,
              intent: 'catalog_budget',
              replyText,
              matchedCount: products.length,
              matchedProducts: productOptions,
            });
            await upsertAutoresponderOptionsConversation(senderKey, productOptions, {
              source: 'category_budget',
              categoryId: budgetRequest.category.id,
              budgetCents: budgetRequest.budgetCents,
              keyword,
              offset: 0,
              limit: pageSize,
              total,
              hasMore,
              completeList: isAutoresponderCompleteProductListKeyword(budgetKeyword),
            });

            return { replies: formatAutoresponderProReplies(replyMessages) };
          }
        }
      }

      const genericDeviceCatalogFamily = detectAutoresponderGenericDeviceCatalogFamily(message);
      if (genericDeviceCatalogFamily) {
        const replyText = formatAutoresponderReply(
          buildAutoresponderDeviceCatalogRefinementPrompt(genericDeviceCatalogFamily),
          settings,
          shouldPrefixGreeting
        );

        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: genericDeviceCatalogFamily === 'smartphone' ? 'catalog_phone_refinement' : 'catalog_device_refinement',
          replyText,
          matchedCount: 0,
        });
        await upsertAutoresponderSuccessConversation(senderKey);

        return { replies: [{ message: replyText }] };
      }

      if (isAutoresponderCatalogRequest(message)) {
        const categories = await findAutoresponderAvailableCategories(100);
        const selectedCategory = await resolveAutoresponderCatalogCategoryForMessage(message, categories);
        if (selectedCategory?.id) {
          const pageSize = getAutoresponderInitialProductPageSize(selectedCategory.name);
          const rows = await findAutoresponderProductsByCategory(selectedCategory.id, pageSize + 1);
          const products = rows.slice(0, pageSize);
          const hasMore = rows.length > pageSize;
          const total = await countAutoresponderProductsByCategory(selectedCategory.id);
          const productOptions = buildAutoresponderProductOptions(products);
          const productReplyMessages = appendAutoresponderReplyFooter(
            await formatAutoresponderProductSearchReplies(products, selectedCategory.name, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(selectedCategory.name) }),
            formatAutoresponderProductReplyInstructions(hasMore)
          );
          const replyMessages = buildAutoresponderReplyMessagesWithSeparateGreeting(productReplyMessages, {
            message,
            contactFirstName,
            settings,
            shouldIncludeGreeting: shouldPrefixGreeting || isAutoresponderGreeting(message),
          });
          const replyText = replyMessages.join('\n\n');

          await logAutoresponderReply({
            sender: senderKey,
            message,
            intent: 'catalog_category',
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
            completeList: isAutoresponderCompleteProductListKeyword(selectedCategory.name),
          });

          return { replies: formatAutoresponderProReplies(replyMessages) };
        }
      }

      const productSearchTokens = extractAutoresponderProductSearchTokens(message);
      if (productSearchTokens.length > 0) {
        const searchKeyword = productSearchTokens.join(' ');
        const pageSize = getAutoresponderInitialProductPageSize(searchKeyword);
        const rows = await findAutoresponderProductsByTokens(productSearchTokens, pageSize + 1);
        const products = rows.slice(0, pageSize);
        const hasMore = rows.length > pageSize;
        if (products.length > 0) {
          const total = await countAutoresponderProductsByTokens(productSearchTokens);
          const productOptions = buildAutoresponderProductOptions(products);
          const productReplyMessages = appendAutoresponderReplyFooter(
            await formatAutoresponderProductSearchReplies(products, searchKeyword, settings, { offset: 0, limit: pageSize, total, completeList: isAutoresponderCompleteProductListKeyword(searchKeyword) }),
            formatAutoresponderProductReplyInstructions(hasMore)
          );
          const replyMessages = buildAutoresponderReplyMessagesWithSeparateGreeting(productReplyMessages, {
            message,
            contactFirstName,
            settings,
            shouldIncludeGreeting: shouldPrefixGreeting || isAutoresponderGreeting(message),
          });
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
            completeList: isAutoresponderCompleteProductListKeyword(searchKeyword),
          });

          return { replies: formatAutoresponderProReplies(replyMessages) };
        }
      }

      const aiFallback = await buildAutoresponderAiFallbackReply({ message, contactFirstName, settings, sender: senderKey });
      if (aiFallback?.text) {
        const replyText = formatAutoresponderReply(aiFallback.text, settings, shouldPrefixGreeting);
        await logAutoresponderReply({
          sender: senderKey,
          message,
          intent: 'ai_fallback',
          replyText,
          matchedCount: 0,
          aiMeta: aiFallback.aiMeta,
        });
        await upsertAutoresponderSuccessConversation(senderKey);
        return { replies: [{ message: replyText }] };
      }

      return await handleAutoresponderGlobalFallbackCuration({
        senderKey,
        message,
        settings,
        contactFirstName,
        shouldPrefixGreeting,
      });
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

async function cleanupAutoresponderTestFlowSender(sender) {
  const senderKey = normalizeAutoresponderSender(sender) || String(sender || '').trim();
  if (!senderKey) return;
  await pool.query('DELETE FROM autoresponder_logs WHERE sender = ?', [senderKey]);
  await pool.query('DELETE FROM autoresponder_conversations WHERE sender = ?', [senderKey]);
}

async function runAutoresponderTestFlow({ messages, sender, contactFirstName, cleanup = true }) {
  const senderKey = normalizeAutoresponderSender(sender) || `teste-fluxo-${Date.now()}`;
  const token = process.env.AUTORESPONDER_TOKEN || '';
  if (!token) {
    return {
      ok: false,
      sender: senderKey,
      steps: [],
      final_purchase_flow: null,
      warning: 'AUTORESPONDER_TOKEN nao configurado na VPS.',
    };
  }

  await cleanupAutoresponderTestFlowSender(senderKey);
  const steps = [];
  let finalPurchaseFlow = null;

  try {
    for (let index = 0; index < messages.length; index += 1) {
      const message = String(messages[index] || '').trim();
      if (!message) continue;

      const startedAt = Date.now();
      const injected = await fastify.inject({
        method: 'POST',
        url: '/autoresponder-webhook',
        headers: {
          'content-type': 'application/json',
          'x-autoresponder-token': token,
        },
        payload: {
          sender: senderKey,
          message,
          isGroup: false,
          name: contactFirstName || '',
        },
      });

      let body = null;
      try {
        body = injected.payload ? JSON.parse(injected.payload) : null;
      } catch {
        body = { raw: injected.payload };
      }

      steps.push({
        index: steps.length + 1,
        message,
        status_code: injected.statusCode,
        response_time_ms: Date.now() - startedAt,
        replies: Array.isArray(body?.replies) ? body.replies : [],
        body,
      });
    }

    const [conversationRows] = await pool.query(
      'SELECT purchase_flow FROM autoresponder_conversations WHERE sender = ? LIMIT 1',
      [senderKey]
    );
    finalPurchaseFlow = normalizeAutoresponderPurchaseFlow(conversationRows[0]?.purchase_flow);
  } finally {
    if (cleanup) {
      await cleanupAutoresponderTestFlowSender(senderKey);
    }
  }

  return {
    ok: steps.every((step) => step.status_code >= 200 && step.status_code < 300),
    sender: senderKey,
    steps,
    final_purchase_flow: finalPurchaseFlow,
    cleanup,
  };
}

async function runAutoresponderInternalChatMessage({ message, sender, contactFirstName }) {
  const senderKey = normalizeAutoresponderSender(sender) || String(sender || '').trim();
  const text = String(message || '').trim();
  const token = process.env.AUTORESPONDER_TOKEN || '';
  if (!senderKey) {
    return { ok: false, error: 'sender is required' };
  }
  if (!text) {
    return { ok: false, error: 'message is required' };
  }
  if (!token) {
    return {
      ok: false,
      sender: senderKey,
      message: text,
      status_code: 500,
      response_time_ms: 0,
      replies: [],
      warning: 'AUTORESPONDER_TOKEN nao configurado na VPS.',
    };
  }

  const startedAt = Date.now();
  const injected = await fastify.inject({
    method: 'POST',
    url: '/autoresponder-webhook',
    headers: {
      'content-type': 'application/json',
      'x-autoresponder-token': token,
    },
    payload: {
      sender: senderKey,
      message: text,
      isGroup: false,
      name: contactFirstName || '',
    },
  });

  let body = null;
  try {
    body = injected.payload ? JSON.parse(injected.payload) : null;
  } catch {
    body = { raw: injected.payload };
  }

  const [conversationRows] = await pool.query(
    'SELECT purchase_flow FROM autoresponder_conversations WHERE sender = ? LIMIT 1',
    [senderKey]
  );

  return {
    ok: injected.statusCode >= 200 && injected.statusCode < 300,
    sender: senderKey,
    message: text,
    status_code: injected.statusCode,
    response_time_ms: Date.now() - startedAt,
    replies: Array.isArray(body?.replies) ? body.replies : [],
    body,
    final_purchase_flow: normalizeAutoresponderPurchaseFlow(conversationRows[0]?.purchase_flow),
  };
}

fastify.post('/autoresponder/test-flow', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  const messages = Array.isArray(body.messages)
    ? body.messages.map((item) => String(item || '').trim()).filter(Boolean)
    : String(body.messages || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

  if (messages.length === 0) return reply.code(400).send({ error: 'messages array is required' });
  if (messages.length > 20) return reply.code(400).send({ error: 'maximum 20 messages per test flow' });

  return runAutoresponderTestFlow({
    messages,
    sender: body.sender || `teste-fluxo-${Date.now()}`,
    contactFirstName: body.contactFirstName || body.contact_first_name || '',
    cleanup: body.cleanup !== false,
  });
});

fastify.post('/autoresponder/internal-chat/message', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  const result = await runAutoresponderInternalChatMessage({
    message: body.message,
    sender: body.sender || `laboratorio-whatsapp-${Date.now()}`,
    contactFirstName: body.contactFirstName || body.contact_first_name || 'Cliente',
  });
  if (!result.ok && result.error) return reply.code(400).send({ error: result.error });
  return result;
});

fastify.post('/autoresponder/internal-chat/reset', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  const sender = normalizeAutoresponderSender(body.sender) || String(body.sender || '').trim();
  if (!sender) return reply.code(400).send({ error: 'sender is required' });
  await cleanupAutoresponderTestFlowSender(sender);
  return { ok: true, sender };
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
// Models: routed through the VPS so the frontend uses VPS database endpoints.
const MODEL_COMPANY_SLUG = 'mercado-do-vale';
const MODEL_PAGE_SIZE = 1000;

function generateModelSlug(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapVpsModel(row) {
  if (!row) return null;
  const templateValues = parseJsonCell(row.template_values, {});
  const eans = parseJsonCell(row.eans, null);
  const name = String(row.name || '').trim();
  return {
    id: row.id,
    name,
    slug: row.slug || generateModelSlug(name || row.id),
    brand_id: row.brand_id,
    active: row.active === undefined || row.active === null ? true : Boolean(row.active),
    created: row.created_at,
    updated: row.updated_at,
    category_id: row.category_id || undefined,
    description: row.description || undefined,
    template_values: templateValues && typeof templateValues === 'object' ? templateValues : {},
    eans: Array.isArray(eans) ? eans : undefined,
  };
}

function parseJsonCell(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function resolveModelCompanyId(companyId) {
  if (companyId) return companyId;
  return getDefaultCompanyIdForCatalog();
}

async function selectModelsFromVpsDb({ companyId, brandId, backfilled = false } = {}) {
  const resolvedCompanyId = await resolveModelCompanyId(companyId);
  const rows = [];
  for (let offset = 0; ; offset += MODEL_PAGE_SIZE) {
    const parts = [
      'select=*',
      `company_id=eq.${encodeURIComponent(resolvedCompanyId)}`,
      'order=name.asc',
      `limit=${MODEL_PAGE_SIZE}`,
      `offset=${offset}`,
    ];
    if (brandId) parts.splice(2, 0, `brand_id=eq.${encodeURIComponent(brandId)}`);
    const page = await vpsDbSelect('models', parts.join('&'));
    const list = Array.isArray(page) ? page : [];
    rows.push(...list);
    if (list.length < MODEL_PAGE_SIZE) break;
  }
  if (rows.length === 0 && !backfilled) {
    await backfillModelsFromVpsProducts(resolvedCompanyId);
    return selectModelsFromVpsDb({ companyId: resolvedCompanyId, brandId, backfilled: true });
  }
  return rows;
}

function firstTextValue(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text && text.toLowerCase() !== 'null' && text.toLowerCase() !== 'undefined') return text;
  }
  return '';
}

async function backfillModelsFromVpsProducts(companyId) {
  const [productModels] = await pool.query(
    `SELECT
       p.model_id AS id,
       MIN(p.name) AS product_name,
       MIN(p.category_id) AS category_id,
       MIN(COALESCE(b.id, p.brand)) AS brand_id,
       MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.custom_fields, '$.model')), 'null')) AS custom_model,
       MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.specs, '$.model')), 'null')) AS specs_model
     FROM products p
     LEFT JOIN brands b ON CAST(b.id AS CHAR) = p.brand OR b.name = p.brand
     WHERE p.model_id IS NOT NULL AND p.model_id <> ''
     GROUP BY p.model_id`
  );

  for (const row of productModels) {
    const name = firstTextValue(row.custom_model, row.specs_model, row.product_name, row.id);
    const brandId = firstTextValue(row.brand_id);
    if (!row.id || !name || !brandId) continue;

    await vpsDbInsert('models', {
      id: row.id,
      company_id: companyId,
      brand_id: brandId,
      category_id: row.category_id || null,
      name,
      slug: generateModelSlug(name),
      template_values: {},
      active: 1,
    }).catch((error) => {
      if (!isVpsDbConflict(error)) throw error;
    });
  }
}

function isVpsDbConflict(error) {
  const text = `${error?.message || ''} ${JSON.stringify(error?.body || {})}`.toLowerCase();
  return error?.status === 409 || text.includes('duplicate') || text.includes('unique') || text.includes('23505');
}

fastify.get('/models', { preHandler: requireSyncKeyOrAdmin }, async (req) => {
  const rows = await selectModelsFromVpsDb({
    companyId: req.query?.company_id,
    brandId: req.query?.brand_id,
  });
  return rows.map(mapVpsModel);
});

fastify.get('/models/:id', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {
  const companyId = await resolveModelCompanyId(req.query?.company_id);
  const rows = await vpsDbSelect(
    'models',
    `select=*&id=eq.${encodeURIComponent(req.params.id)}&company_id=eq.${encodeURIComponent(companyId)}&limit=1`
  );
  const model = mapVpsModel(Array.isArray(rows) ? rows[0] : null);
  if (!model) return reply.code(404).send({ error: 'Modelo nao encontrado.' });
  return model;
});

fastify.post('/models', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  if (!body.name || !body.brand_id) {
    return reply.code(400).send({ error: 'name and brand_id are required' });
  }

  const companyId = await resolveModelCompanyId(body.company_id);
  const slug = generateModelSlug(body.name);
  const existing = await vpsDbSelect(
    'models',
    [
      'select=id',
      `company_id=eq.${encodeURIComponent(companyId)}`,
      `brand_id=eq.${encodeURIComponent(body.brand_id)}`,
      `slug=eq.${encodeURIComponent(slug)}`,
      'limit=1',
    ].join('&')
  );

  if (Array.isArray(existing) && existing.length > 0) {
    return reply.code(409).send({ error: 'Ja existe um modelo com esse nome para esta marca.' });
  }

  try {
    const modelId = body.id || crypto.randomUUID();
    const rows = await vpsDbInsert('models', {
      id: modelId,
      company_id: companyId,
      brand_id: body.brand_id,
      name: String(body.name).trim(),
      slug,
      category_id: body.category_id || null,
      description: body.description || null,
      template_values: body.template_values || {},
      eans: Array.isArray(body.eans) && body.eans.length ? body.eans : null,
    });
    return reply.code(201).send(mapVpsModel(Array.isArray(rows) ? rows[0] : rows));
  } catch (error) {
    if (isVpsDbConflict(error)) {
      return reply.code(409).send({ error: 'Ja existe um modelo com esse nome para esta marca.' });
    }
    throw error;
  }
});

fastify.put('/models/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  if (!body.name || !body.brand_id) {
    return reply.code(400).send({ error: 'name and brand_id are required' });
  }

  const companyId = await resolveModelCompanyId(body.company_id);
  const currentRows = await vpsDbSelect(
    'models',
    `select=*&id=eq.${encodeURIComponent(req.params.id)}&company_id=eq.${encodeURIComponent(companyId)}&limit=1`
  );
  const current = Array.isArray(currentRows) ? currentRows[0] : null;
  if (!current) return reply.code(404).send({ error: 'Modelo nao encontrado.' });

  const payload = {
    name: String(body.name).trim(),
    brand_id: body.brand_id,
    category_id: body.category_id || null,
    description: body.description || null,
    template_values: body.template_values || {},
    eans: Array.isArray(body.eans) && body.eans.length ? body.eans : null,
  };
  if (payload.name !== current.name) payload.slug = generateModelSlug(payload.name);

  try {
    const rows = await vpsDbPatch(
      'models',
      `id=eq.${encodeURIComponent(req.params.id)}&company_id=eq.${encodeURIComponent(companyId)}`,
      payload
    );
    let updated = Array.isArray(rows) ? rows[0] : rows;
    if (!updated) {
      const fallbackRows = await vpsDbSelect(
        'models',
        `select=*&id=eq.${encodeURIComponent(req.params.id)}&company_id=eq.${encodeURIComponent(companyId)}&limit=1`
      );
      updated = Array.isArray(fallbackRows) ? fallbackRows[0] : fallbackRows;
    }
    return mapVpsModel(updated || { ...current, ...payload, company_id: companyId });
  } catch (error) {
    if (isVpsDbConflict(error)) {
      return reply.code(409).send({ error: 'Ja existe um modelo com esse nome para esta marca.' });
    }
    throw error;
  }
});

fastify.delete('/models/:id', { preHandler: requireSyncKey }, async (req) => {
  const companyId = await resolveModelCompanyId(req.query?.company_id);
  await vpsDbDelete(
    'models',
    `id=eq.${encodeURIComponent(req.params.id)}&company_id=eq.${encodeURIComponent(companyId)}`
  );
  return { ok: true };
});

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
// Substitui 3-4 queries separadas ao banco da VPS. Resultado cacheável por 5 min.
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
function normalizeCatalogProductSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function comboStockSql(productAlias = 'products') {
  return `(CASE WHEN ${productAlias}.is_combo = 1 THEN COALESCE((
    SELECT MIN(component_stock)
    FROM (
      SELECT pc.combo_product_id,
        CASE
          WHEN MAX(COALESCE(pc.component_type, 'fixed')) = 'choice_group'
            THEN FLOOR(SUM(child.stock_quantity) / NULLIF(MAX(pc.quantity), 0))
          ELSE MIN(FLOOR(child.stock_quantity / NULLIF(pc.quantity, 0)))
        END AS component_stock
      FROM product_combos pc
      JOIN products child ON child.id = pc.child_product_id
      GROUP BY pc.combo_product_id,
        COALESCE(pc.component_type, 'fixed'),
        CASE
          WHEN COALESCE(pc.component_type, 'fixed') = 'choice_group' THEN COALESCE(pc.group_key, pc.parent_product_id, pc.id)
          ELSE pc.id
        END
    ) combo_components
    WHERE combo_components.combo_product_id = ${productAlias}.id
  ), 0) ELSE ${productAlias}.stock_quantity END)`;
}

fastify.get('/products', { config: { rateLimit: { max: 900, timeWindow: '1 minute' } } }, async (req, reply) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 500, 2000);
  const offset = parseInt(req.query.offset) || 0;
  const category = req.query.category;
  const status   = req.query.status;
  const search   = req.query.search;
  const normalizedSearch = normalizeCatalogProductSearchText(search);
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
    ? `id, model_id, category_id, brand, name, sku, ean, alternative_eans, description,
       price_cost, price_retail, price_reseller, price_wholesale,
       price_promo, promo_start, promo_end,
       is_combo, combo_discount_type, combo_discount_value,
       ${comboStockSql('products')} AS stock_quantity,
       track_inventory, is_gift,
       warranty_type, warranty_template_id,
       ${imgCol},
       status, parent_id, is_parent, bling_id, bling_parent_id, video_url,
       slug, origin, specs, custom_fields, kits,
       offer_type, offer_parent_product_id, offer_visibility,
       shopee_strategy, shopee_offer_status, shopee_offer_error,
       exclude_from_seo, meta_title, meta_description, keywords, view_count, production_days, created_at, updated_at`
    : `id, model_id, category_id, brand, name, sku, ean, alternative_eans, description,
       price_cost, price_retail, price_reseller, price_wholesale,
       price_promo, promo_start, promo_end,
       is_combo, combo_discount_type, combo_discount_value,
       ${comboStockSql('products')} AS stock_quantity,
       track_inventory, is_gift,
       warranty_type, warranty_template_id,
       images, status, parent_id, is_parent, bling_id, bling_parent_id, video_url,
       slug, origin, specs, custom_fields, kits,
       offer_type, offer_parent_product_id, offer_visibility,
       shopee_strategy, shopee_offer_status, shopee_offer_error,
       exclude_from_seo, meta_title, meta_description, keywords, view_count, production_days, created_at, updated_at`;


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
  if (normalizedSearch) {
    const searchLike = `%${normalizedSearch}%`;
    sql += ` AND (
      name COLLATE utf8mb4_unicode_ci LIKE ?
      OR sku COLLATE utf8mb4_unicode_ci LIKE ?
      OR ean COLLATE utf8mb4_unicode_ci LIKE ?
      OR CAST(alternative_eans AS CHAR) COLLATE utf8mb4_unicode_ci LIKE ?
      OR brand COLLATE utf8mb4_unicode_ci LIKE ?
      OR model_id COLLATE utf8mb4_unicode_ci LIKE ?
      OR slug COLLATE utf8mb4_unicode_ci LIKE ?
      OR CAST(specs AS CHAR) COLLATE utf8mb4_unicode_ci LIKE ?
      OR CAST(custom_fields AS CHAR) COLLATE utf8mb4_unicode_ci LIKE ?
    )`;
    params.push(searchLike, searchLike, searchLike, searchLike, searchLike, searchLike, searchLike, searchLike, searchLike);
  }
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
  sql += ` ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, CASE WHEN (is_parent = 0 OR is_parent IS NULL) THEN 0 ELSE 1 END, ${sortBy} ${sortDir} LIMIT ? OFFSET ?`;
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

fastify.get('/products/by-ids', { config: { rateLimit: { max: 900, timeWindow: '1 minute' } } }, async (req, reply) => {
  const ids = [...new Set(String(req.query?.ids || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean))]
    .slice(0, 100);

  if (!ids.length) return [];

  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT *,
      ${comboStockSql('products')} AS stock_quantity
     FROM products
     WHERE id IN (${placeholders})
     ORDER BY FIELD(id, ${placeholders})`,
    [...ids, ...ids]
  );

  return rows.map(r => ({
    ...r,
    images:           typeof r.images === 'string'           ? JSON.parse(r.images)           : (r.images ?? []),
    specs:            typeof r.specs === 'string'            ? JSON.parse(r.specs)            : r.specs,
    alternative_eans: typeof r.alternative_eans === 'string' ? JSON.parse(r.alternative_eans) : r.alternative_eans,
    custom_fields:    typeof r.custom_fields === 'string'    ? JSON.parse(r.custom_fields)    : r.custom_fields,
    kits:             typeof r.kits === 'string'             ? JSON.parse(r.kits)             : r.kits,
  }));
});

fastify.get('/products/:id', { config: { rateLimit: { max: 900, timeWindow: '1 minute' } } }, async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT *,
      ${comboStockSql('products')} AS stock_quantity
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
      ${comboStockSql('products')} AS stock_quantity
     FROM products WHERE slug = ?`,
    [slugParam]
  );

  // Fallback: slug pode ser um UUID (produto sem slug no banco)
  if (!rows.length && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(slugParam)) {
    [rows] = await pool.query(
      `SELECT *,
        ${comboStockSql('products')} AS stock_quantity
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
    `SELECT *, ${comboStockSql('products')} AS stock_quantity
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
    `SELECT pc.child_product_id as id, pc.quantity,
            COALESCE(pc.component_type, 'fixed') AS component_type,
            pc.group_key, pc.parent_product_id, pc.group_label,
            p.name, p.sku, p.price_retail, p.price_cost, p.price_reseller, p.price_wholesale,
            p.images, p.stock_quantity, p.weight_kg, p.dimensions, p.bling_id, p.parent_id
     FROM product_combos pc
     JOIN products p ON p.id = pc.child_product_id
     WHERE pc.combo_product_id = ?`,
    [req.params.id]
  );
  return rows.map(r => ({
    ...r,
    images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images,
    dimensions: typeof r.dimensions === 'string' ? JSON.parse(r.dimensions || '{}') : r.dimensions
  }));
});


// ─── Products (write) ──────────────────────────────────────────────────────

// Batch upsert — used by Bling import and admin writes
function normalizeStockLocationCode(value = '') {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

function stockBool(value) {
  return value === true || value === 1 || value === '1';
}

function stockNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function parseStockJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

async function getDefaultStockCompanyId() {
  const [productCompanyRows] = await pool.query(`
    SELECT company_id AS id, COUNT(*) AS total
    FROM products
    WHERE company_id IS NOT NULL
    GROUP BY company_id
    ORDER BY total DESC, MIN(created_at) ASC
    LIMIT 1
  `).catch(() => [null]);
  if (productCompanyRows?.[0]?.id) return productCompanyRows[0].id;
  const [stockCompanyRows] = await pool.query(`
    SELECT company_id AS id, COUNT(*) AS total
    FROM stock_deposits
    WHERE company_id IS NOT NULL AND is_active = 1
    GROUP BY company_id
    ORDER BY total DESC, MIN(created_at) ASC
    LIMIT 1
  `).catch(() => [null]);
  if (stockCompanyRows?.[0]?.id) return stockCompanyRows[0].id;
  const [companyRows] = await pool.query('SELECT id FROM companies ORDER BY created_at ASC LIMIT 1').catch(() => [null]);
  if (companyRows?.[0]?.id) return companyRows[0].id;
  return '00000000-0000-0000-0000-000000000000';
}

async function ensureDefaultStockLocation(companyId) {
  const targetCompanyId = companyId || await getDefaultStockCompanyId();
  const [existingDeposits] = await pool.query(
    'SELECT id FROM stock_deposits WHERE company_id = ? AND code = ? LIMIT 1',
    [targetCompanyId, 'LOJA-PRINCIPAL']
  );
  let depositId = existingDeposits?.[0]?.id;
  if (!depositId) {
    depositId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO stock_deposits (id, company_id, name, code, type, is_default, is_active)
       VALUES (?, ?, 'Loja Principal', 'LOJA-PRINCIPAL', 'store', 1, 1)`,
      [depositId, targetCompanyId]
    );
  } else {
    await pool.query(
      `UPDATE stock_deposits
       SET name='Loja Principal', type='store', is_default=1, is_active=1, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [depositId]
    );
  }

  const [existingLocations] = await pool.query(
    'SELECT id FROM stock_locations WHERE deposit_id = ? AND code = ? LIMIT 1',
    [depositId, 'ESTOQUE-GERAL']
  );
  let locationId = existingLocations?.[0]?.id;
  if (!locationId) {
    locationId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO stock_locations (id, company_id, deposit_id, name, code, description, is_default, is_active)
       VALUES (?, ?, ?, 'Estoque Geral', 'ESTOQUE-GERAL', 'Local padrao criado automaticamente para migracao inicial de estoque.', 1, 1)`,
      [locationId, targetCompanyId, depositId]
    );
  } else {
    await pool.query(
      `UPDATE stock_locations
       SET name='Estoque Geral', description='Local padrao criado automaticamente para migracao inicial de estoque.',
           is_default=1, is_active=1, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [locationId]
    );
  }

  return { depositId, locationId, companyId: targetCompanyId };
}

async function ensureIncomingStockLocation(companyId) {
  const targetCompanyId = companyId || await getDefaultStockCompanyId();
  const [existingDeposits] = await pool.query(
    'SELECT id FROM stock_deposits WHERE company_id = ? AND code = ? LIMIT 1',
    [targetCompanyId, 'DEPOSITO']
  );
  let depositId = existingDeposits?.[0]?.id;
  if (!depositId) {
    depositId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO stock_deposits (id, company_id, name, code, type, is_default, is_active)
       VALUES (?, ?, 'Deposito', 'DEPOSITO', 'warehouse', 0, 1)`,
      [depositId, targetCompanyId]
    );
  } else {
    await pool.query(
      `UPDATE stock_deposits
       SET name='Deposito', type='warehouse', is_active=1, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [depositId]
    );
  }

  const [existingLocations] = await pool.query(
    'SELECT id FROM stock_locations WHERE deposit_id = ? AND code = ? LIMIT 1',
    [depositId, 'ENTRADA-CONFERENCIA']
  );
  let locationId = existingLocations?.[0]?.id;
  if (!locationId) {
    locationId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO stock_locations (id, company_id, deposit_id, name, code, description, is_default, is_active)
       VALUES (?, ?, ?, 'Entrada / Conferencia', 'ENTRADA-CONFERENCIA', 'Local automatico para saldo recebido de integracoes antes da conferencia fisica.', 0, 1)`,
      [locationId, targetCompanyId, depositId]
    );
  } else {
    await pool.query(
      `UPDATE stock_locations
       SET name='Entrada / Conferencia', description='Local automatico para saldo recebido de integracoes antes da conferencia fisica.',
           is_active=1, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [locationId]
    );
  }

  return { depositId, locationId, companyId: targetCompanyId };
}

async function seedDefaultStockLocations() {
  const [companies] = await pool.query('SELECT id FROM companies').catch(() => [null]);
  if (companies?.length) {
    for (const company of companies) {
      await ensureDefaultStockLocation(company.id);
      await ensureIncomingStockLocation(company.id);
    }
    return;
  }
  const companyId = await getDefaultStockCompanyId();
  await ensureDefaultStockLocation(companyId);
  await ensureIncomingStockLocation(companyId);
}

async function backfillProductStockLocations() {
  const [companies] = await pool.query('SELECT DISTINCT company_id AS id FROM products WHERE company_id IS NOT NULL');
  for (const company of companies || []) {
    await ensureDefaultStockLocation(company.id);
  }

  const [productsToBackfill] = await pool.query(`
    SELECT p.id, p.company_id, COALESCE(p.stock_quantity, 0) AS stock_quantity
    FROM products p
    WHERE COALESCE(p.stock_quantity, 0) > 0
      AND NOT EXISTS (SELECT 1 FROM product_stock_locations psl WHERE psl.product_id = p.id)
  `);

  for (const product of productsToBackfill || []) {
    const target = await ensureDefaultStockLocation(product.company_id);
    await pool.query(
      `INSERT INTO product_stock_locations
        (id, company_id, product_id, deposit_id, location_id, quantity, reserved_quantity)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), updated_at = CURRENT_TIMESTAMP`,
      [crypto.randomUUID(), target.companyId, product.id, target.depositId, target.locationId, stockNumber(product.stock_quantity)]
    );
    await pool.query(
      `INSERT INTO stock_location_movements
        (id, company_id, product_id, to_deposit_id, to_location_id, quantity, movement_type, reason, reference_type,
         previous_to_quantity, new_to_quantity, notes)
       SELECT ?, ?, ?, ?, ?, ?, 'sync', 'inventory', 'initial_migration', 0, ?,
              'Saldo inicial migrado de products.stock_quantity para Loja Principal / Estoque Geral.'
       WHERE NOT EXISTS (
         SELECT 1 FROM stock_location_movements
         WHERE product_id = ? AND reference_type = 'initial_migration'
       )`,
      [
        crypto.randomUUID(),
        target.companyId,
        product.id,
        target.depositId,
        target.locationId,
        stockNumber(product.stock_quantity),
        stockNumber(product.stock_quantity),
        product.id,
      ]
    );
  }
}

async function syncProductStockFromLocations(productId) {
  const [[row]] = await pool.query(
    'SELECT COALESCE(SUM(quantity), 0) AS quantity FROM product_stock_locations WHERE product_id = ?',
    [productId]
  );
  const quantity = stockNumber(row?.quantity);
  await pool.query('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [quantity, productId]);
  return quantity;
}

async function materializeProductUndistributedStock(productId, reason = 'undistributed_stock', notes = null) {
  const [[product]] = await pool.query(
    'SELECT id, company_id, COALESCE(stock_quantity, 0) AS stock_quantity FROM products WHERE id = ? LIMIT 1',
    [productId]
  );
  if (!product) return { ok: false, materialized: 0 };

  const [[sumRow]] = await pool.query(
    'SELECT COALESCE(SUM(quantity), 0) AS quantity FROM product_stock_locations WHERE product_id = ?',
    [productId]
  );
  const target = Math.max(0, Math.trunc(stockNumber(product.stock_quantity)));
  const currentTotal = Math.max(0, Math.trunc(stockNumber(sumRow?.quantity)));
  const delta = target - currentTotal;
  if (delta <= 0) return { ok: true, materialized: 0 };

  const companyId = product.company_id || await getDefaultStockCompanyId();
  const incoming = await ensureIncomingStockLocation(companyId);
  const current = await getStockLocationRow(productId, incoming.depositId, incoming.locationId, true);
  const previous = stockNumber(current?.quantity);
  const reserved = stockNumber(current?.reserved_quantity);
  const next = previous + delta;
  await upsertStockLocationBalance({
    companyId,
    productId,
    depositId: incoming.depositId,
    locationId: incoming.locationId,
    quantity: next,
    reservedQuantity: reserved,
  });
  await pool.query(
    `INSERT INTO stock_location_movements
      (id, company_id, product_id, to_deposit_id, to_location_id, quantity, movement_type, reason,
       reference_type, previous_to_quantity, new_to_quantity, notes)
     VALUES (?, ?, ?, ?, ?, ?, 'sync', ?, 'undistributed_stock', ?, ?, ?)`,
    [
      crypto.randomUUID(),
      companyId,
      productId,
      incoming.depositId,
      incoming.locationId,
      delta,
      reason,
      previous,
      next,
      notes || 'Saldo sem local definido materializado em Deposito / Entrada-Conferencia para permitir transferencia.',
    ]
  );

  return { ok: true, materialized: delta };
}

async function reconcileProductStockLocationsToTotal(productId, targetQuantity, reason = 'external_stock_sync', notes = null) {
  const target = Math.max(0, Math.trunc(stockNumber(targetQuantity)));
  const [[product]] = await pool.query('SELECT id, company_id FROM products WHERE id = ? LIMIT 1', [productId]);
  if (!product) return { ok: false, appliedDelta: 0 };

  const [[sumRow]] = await pool.query(
    'SELECT COALESCE(SUM(quantity), 0) AS quantity FROM product_stock_locations WHERE product_id = ?',
    [productId]
  );
  const currentTotal = Math.max(0, Math.trunc(stockNumber(sumRow?.quantity)));
  let delta = target - currentTotal;
  if (delta === 0) {
    await syncProductStockFromLocations(productId);
    return { ok: true, appliedDelta: 0 };
  }

  const companyId = product.company_id || await getDefaultStockCompanyId();

  if (delta > 0) {
    const incoming = await ensureIncomingStockLocation(companyId);
    const current = await getStockLocationRow(productId, incoming.depositId, incoming.locationId, true);
    const previous = stockNumber(current?.quantity);
    const reserved = stockNumber(current?.reserved_quantity);
    const next = previous + delta;
    await upsertStockLocationBalance({
      companyId,
      productId,
      depositId: incoming.depositId,
      locationId: incoming.locationId,
      quantity: next,
      reservedQuantity: reserved,
    });
    await pool.query(
      `INSERT INTO stock_location_movements
        (id, company_id, product_id, to_deposit_id, to_location_id, quantity, movement_type, reason,
         reference_type, previous_to_quantity, new_to_quantity, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'sync', ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), companyId, productId, incoming.depositId, incoming.locationId, delta, reason, 'external_stock_total', previous, next, notes || 'Saldo recebido de integracao externa em Deposito / Entrada-Conferencia.']
    );
  } else {
    let remaining = Math.abs(delta);
    const [sources] = await pool.query(
      `SELECT psl.*
       FROM product_stock_locations psl
       LEFT JOIN stock_deposits sd ON sd.id = psl.deposit_id
       LEFT JOIN stock_locations sl ON sl.id = psl.location_id
       WHERE psl.product_id = ? AND (psl.quantity - psl.reserved_quantity) > 0
       ORDER BY sd.is_default DESC, sl.is_default DESC, psl.quantity DESC
       FOR UPDATE`,
      [productId]
    );

    for (const source of sources || []) {
      if (remaining <= 0) break;
      const previous = stockNumber(source.quantity);
      const available = Math.max(0, previous - stockNumber(source.reserved_quantity));
      const decrement = Math.min(remaining, available);
      if (decrement <= 0) continue;
      const next = previous - decrement;
      await upsertStockLocationBalance({
        companyId,
        productId,
        depositId: source.deposit_id,
        locationId: source.location_id,
        quantity: next,
        reservedQuantity: stockNumber(source.reserved_quantity),
      });
      await pool.query(
        `INSERT INTO stock_location_movements
          (id, company_id, product_id, from_deposit_id, from_location_id, quantity, movement_type, reason,
           reference_type, previous_from_quantity, new_from_quantity, notes)
         VALUES (?, ?, ?, ?, ?, ?, 'sync', ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), companyId, productId, source.deposit_id, source.location_id, decrement, reason, 'external_stock_total', previous, next, notes]
      );
      remaining -= decrement;
    }
  }

  const syncedTotal = await syncProductStockFromLocations(productId);
  return { ok: syncedTotal === target, appliedDelta: delta, syncedTotal };
}

async function getStockLocationRow(productId, depositId, locationId, lock = false) {
  const [rows] = await pool.query(
    `SELECT * FROM product_stock_locations
     WHERE product_id = ? AND deposit_id = ? AND location_id = ?
     ${lock ? 'FOR UPDATE' : ''}`,
    [productId, depositId, locationId]
  );
  return rows?.[0] || null;
}

async function upsertStockLocationBalance({ companyId, productId, depositId, locationId, quantity, reservedQuantity = 0 }) {
  await pool.query(
    `INSERT INTO product_stock_locations
      (id, company_id, product_id, deposit_id, location_id, quantity, reserved_quantity)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       quantity = VALUES(quantity),
       reserved_quantity = VALUES(reserved_quantity),
       updated_at = CURRENT_TIMESTAMP`,
    [crypto.randomUUID(), companyId, productId, depositId, locationId, quantity, reservedQuantity]
  );
  return getStockLocationRow(productId, depositId, locationId);
}

function mapStockDeposit(row) {
  return { ...row, is_default: Boolean(row.is_default), is_active: Boolean(row.is_active) };
}

function mapStockLocation(row) {
  return { ...row, is_default: Boolean(row.is_default), is_active: Boolean(row.is_active) };
}

function mapProductStockLocation(row) {
  return {
    id: row.id,
    company_id: row.company_id,
    product_id: row.product_id,
    deposit_id: row.deposit_id,
    location_id: row.location_id,
    quantity: stockNumber(row.quantity),
    reserved_quantity: stockNumber(row.reserved_quantity),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deposit: row.deposit_name ? {
      id: row.deposit_id,
      company_id: row.company_id,
      name: row.deposit_name,
      code: row.deposit_code,
      type: row.deposit_type,
      cep: row.deposit_cep,
      address: row.deposit_address,
      is_default: Boolean(row.deposit_is_default),
      is_active: Boolean(row.deposit_is_active),
      created_at: row.deposit_created_at,
      updated_at: row.deposit_updated_at,
    } : null,
    location: row.location_name ? {
      id: row.location_id,
      company_id: row.company_id,
      deposit_id: row.deposit_id,
      name: row.location_name,
      code: row.location_code,
      description: row.location_description,
      is_default: Boolean(row.location_is_default),
      is_active: Boolean(row.location_is_active),
      created_at: row.location_created_at,
      updated_at: row.location_updated_at,
    } : null,
  };
}

fastify.get('/stock-locations/deposits', { preHandler: requireSyncKey }, async () => {
  const companyId = await getDefaultStockCompanyId();
  const [rows] = await pool.query(`
    SELECT *
    FROM stock_deposits
    WHERE is_active = 1 AND company_id = ?
    ORDER BY is_default DESC, name ASC
  `, [companyId]);
  return rows.map(mapStockDeposit);
});

const STOCK_LOCATION_IMPORT_TABLES = [
  'stock_deposits',
  'stock_locations',
  'product_stock_locations',
  'stock_location_movements',
];

const STOCK_LOCATION_IMPORT_DELETE_ORDER = [
  'stock_location_movements',
  'product_stock_locations',
  'stock_locations',
  'stock_deposits',
];

const STOCK_LOCATION_IMPORT_INSERT_ORDER = [
  'stock_deposits',
  'stock_locations',
  'product_stock_locations',
  'stock_location_movements',
];

async function getTableColumnsForImport(connection, tableName) {
  const [columns] = await connection.query(`DESCRIBE \`${tableName}\``);
  return new Set(columns.map((column) => column.Field));
}

function normalizeImportedRows(rows, columns) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row) => Object.fromEntries(
      Object.entries(row)
        .filter(([key]) => columns.has(key))
        .map(([key, value]) => [key, value === undefined ? null : value])
    ))
    .filter((row) => Object.keys(row).length > 0);
}

async function bulkInsertImportedRows(connection, tableName, rows) {
  if (!rows.length) return 0;
  const columns = Object.keys(rows[0]);
  const colList = columns.map((column) => `\`${column}\``).join(', ');
  let inserted = 0;

  for (let index = 0; index < rows.length; index += 250) {
    const chunk = rows.slice(index, index + 250);
    const placeholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
    const values = chunk.flatMap((row) => columns.map((column) => row[column] ?? null));
    await connection.query(`INSERT INTO \`${tableName}\` (${colList}) VALUES ${placeholders}`, values);
    inserted += chunk.length;
  }

  return inserted;
}

async function replaceStockLocationTablesFromImport(input) {
  const connection = await pool.getConnection();
  const result = { deleted: {}, inserted: {} };

  try {
    await connection.beginTransaction();

    for (const table of STOCK_LOCATION_IMPORT_DELETE_ORDER) {
      const [deleteResult] = await connection.query(`DELETE FROM \`${table}\``);
      result.deleted[table] = Number(deleteResult.affectedRows || 0);
    }

    for (const table of STOCK_LOCATION_IMPORT_INSERT_ORDER) {
      const columns = await getTableColumnsForImport(connection, table);
      const rows = normalizeImportedRows(input?.[table], columns);
      result.inserted[table] = await bulkInsertImportedRows(connection, table, rows);
    }

    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

fastify.post('/admin/stock-locations/import', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body || {};
  for (const table of STOCK_LOCATION_IMPORT_TABLES) {
    if (!Array.isArray(body[table])) {
      return reply.code(400).send({ error: `Missing array for ${table}` });
    }
  }

  return replaceStockLocationTablesFromImport(body);
});

fastify.post('/stock-locations/deposits', { preHandler: requireSyncKey }, async (req, reply) => {
  const input = req.body || {};
  const name = String(input.name || '').trim();
  const code = normalizeStockLocationCode(input.code || input.name);
  if (!name) return reply.code(400).send({ error: 'Informe o nome do deposito.' });
  if (!code) return reply.code(400).send({ error: 'Informe um codigo valido para o deposito.' });

  const companyId = input.company_id || await getDefaultStockCompanyId();
  const id = crypto.randomUUID();
  if (stockBool(input.is_default)) {
    await pool.query('UPDATE stock_deposits SET is_default = 0 WHERE company_id = ?', [companyId]);
  }
  await pool.query(
    `INSERT INTO stock_deposits
      (id, company_id, name, code, type, cep, address, is_default, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, companyId, name, code, input.type || 'warehouse', input.cep || null, input.address || null, stockBool(input.is_default) ? 1 : 0]
  );
  const [rows] = await pool.query('SELECT * FROM stock_deposits WHERE id = ?', [id]);
  return mapStockDeposit(rows[0]);
});

fastify.patch('/stock-locations/deposits/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const input = req.body || {};
  const name = String(input.name || '').trim();
  const code = normalizeStockLocationCode(input.code || input.name);
  if (!name) return reply.code(400).send({ error: 'Informe o nome do deposito.' });
  if (!code) return reply.code(400).send({ error: 'Informe um codigo valido para o deposito.' });

  const [[current]] = await pool.query('SELECT company_id FROM stock_deposits WHERE id = ? LIMIT 1', [req.params.id]);
  if (!current) return reply.code(404).send({ error: 'Deposito nao encontrado.' });
  if (stockBool(input.is_default)) {
    await pool.query('UPDATE stock_deposits SET is_default = 0 WHERE company_id = ?', [current.company_id]);
  }
  await pool.query(
    `UPDATE stock_deposits
     SET name=?, code=?, type=?, cep=?, address=?, is_default=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [name, code, input.type || 'warehouse', input.cep || null, input.address || null, stockBool(input.is_default) ? 1 : 0, req.params.id]
  );
  const [rows] = await pool.query('SELECT * FROM stock_deposits WHERE id = ?', [req.params.id]);
  return mapStockDeposit(rows[0]);
});

fastify.get('/stock-locations/locations', { preHandler: requireSyncKey }, async (req) => {
  const params = [];
  let where = 'WHERE is_active = 1';
  if (req.query?.deposit_id) {
    where += ' AND deposit_id = ?';
    params.push(String(req.query.deposit_id));
  } else {
    where += ' AND company_id = ?';
    params.push(await getDefaultStockCompanyId());
  }
  const [rows] = await pool.query(`
    SELECT *
    FROM stock_locations
    ${where}
    ORDER BY is_default DESC, name ASC
  `, params);
  return rows.map(mapStockLocation);
});

fastify.post('/stock-locations/locations', { preHandler: requireSyncKey }, async (req, reply) => {
  const input = req.body || {};
  const name = String(input.name || '').trim();
  const code = normalizeStockLocationCode(input.code || input.name);
  if (!input.deposit_id) return reply.code(400).send({ error: 'Selecione o deposito do local.' });
  if (!name) return reply.code(400).send({ error: 'Informe o nome do local.' });
  if (!code) return reply.code(400).send({ error: 'Informe um codigo valido para o local.' });

  const [[deposit]] = await pool.query('SELECT company_id FROM stock_deposits WHERE id = ? LIMIT 1', [input.deposit_id]);
  if (!deposit) return reply.code(404).send({ error: 'Deposito nao encontrado.' });
  if (stockBool(input.is_default)) {
    await pool.query('UPDATE stock_locations SET is_default = 0 WHERE deposit_id = ?', [input.deposit_id]);
  }
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO stock_locations
      (id, company_id, deposit_id, name, code, description, is_default, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, deposit.company_id, input.deposit_id, name, code, input.description || null, stockBool(input.is_default) ? 1 : 0]
  );
  const [rows] = await pool.query('SELECT * FROM stock_locations WHERE id = ?', [id]);
  return mapStockLocation(rows[0]);
});

fastify.patch('/stock-locations/locations/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const input = req.body || {};
  const name = String(input.name || '').trim();
  const code = normalizeStockLocationCode(input.code || input.name);
  if (!input.deposit_id) return reply.code(400).send({ error: 'Selecione o deposito do local.' });
  if (!name) return reply.code(400).send({ error: 'Informe o nome do local.' });
  if (!code) return reply.code(400).send({ error: 'Informe um codigo valido para o local.' });

  const [[deposit]] = await pool.query('SELECT company_id FROM stock_deposits WHERE id = ? LIMIT 1', [input.deposit_id]);
  if (!deposit) return reply.code(404).send({ error: 'Deposito nao encontrado.' });
  if (stockBool(input.is_default)) {
    await pool.query('UPDATE stock_locations SET is_default = 0 WHERE deposit_id = ?', [input.deposit_id]);
  }
  await pool.query(
    `UPDATE stock_locations
     SET company_id=?, deposit_id=?, name=?, code=?, description=?, is_default=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [deposit.company_id, input.deposit_id, name, code, input.description || null, stockBool(input.is_default) ? 1 : 0, req.params.id]
  );
  const [rows] = await pool.query('SELECT * FROM stock_locations WHERE id = ?', [req.params.id]);
  return rows[0] ? mapStockLocation(rows[0]) : reply.code(404).send({ error: 'Local nao encontrado.' });
});

fastify.get('/stock-locations/products/:productId/distribution', { preHandler: requireSyncKey }, async (req) => {
  await materializeProductUndistributedStock(
    req.params.productId,
    'distribution_open',
    'Saldo sem local definido materializado automaticamente ao abrir a distribuicao.'
  );
  const [rows] = await pool.query(`
    SELECT
      psl.*,
      sd.name AS deposit_name, sd.code AS deposit_code, sd.type AS deposit_type, sd.cep AS deposit_cep,
      sd.address AS deposit_address, sd.is_default AS deposit_is_default, sd.is_active AS deposit_is_active,
      sd.created_at AS deposit_created_at, sd.updated_at AS deposit_updated_at,
      sl.name AS location_name, sl.code AS location_code, sl.description AS location_description,
      sl.is_default AS location_is_default, sl.is_active AS location_is_active,
      sl.created_at AS location_created_at, sl.updated_at AS location_updated_at
    FROM product_stock_locations psl
    LEFT JOIN stock_deposits sd ON sd.id = psl.deposit_id
    LEFT JOIN stock_locations sl ON sl.id = psl.location_id
    WHERE psl.product_id = ?
    ORDER BY psl.quantity DESC, sd.is_default DESC, sd.name ASC, sl.is_default DESC, sl.name ASC
  `, [req.params.productId]);
  return rows.map(mapProductStockLocation);
});

fastify.get('/stock-locations/locations/:locationId/contents', { preHandler: requireSyncKey }, async (req) => {
  const [rows] = await pool.query(`
    SELECT
      psl.product_id, psl.quantity, psl.reserved_quantity,
      sd.id AS deposit_id, sd.name AS deposit_name,
      sl.id AS location_id, sl.name AS location_name,
      p.name AS product_name, p.sku, p.ean, p.stock_quantity AS total_stock, p.images, p.specs
    FROM product_stock_locations psl
    JOIN products p ON p.id = psl.product_id
    LEFT JOIN stock_deposits sd ON sd.id = psl.deposit_id
    LEFT JOIN stock_locations sl ON sl.id = psl.location_id
    WHERE psl.location_id = ? AND psl.quantity > 0
    ORDER BY psl.quantity DESC
  `, [req.params.locationId]);
  return rows.map((row) => {
    const images = parseStockJson(row.images, []);
    return {
      product_id: row.product_id,
      product_name: row.product_name || '(sem nome)',
      sku: row.sku || null,
      ean: row.ean || null,
      product_image: Array.isArray(images) ? images[0] || null : null,
      total_stock: stockNumber(row.total_stock),
      quantity: stockNumber(row.quantity),
      reserved_quantity: stockNumber(row.reserved_quantity),
      available: stockNumber(row.quantity) - stockNumber(row.reserved_quantity),
      deposit_id: row.deposit_id,
      deposit_name: row.deposit_name || null,
      location_id: row.location_id,
      location_name: row.location_name || null,
      specs: parseStockJson(row.specs, null),
    };
  });
});

fastify.get('/stock-locations/movements', { preHandler: requireSyncKey }, async (req) => {
  const where = [];
  const params = [];
  if (req.query?.productId) { where.push('product_id = ?'); params.push(String(req.query.productId)); }
  if (req.query?.movementType) { where.push('movement_type = ?'); params.push(String(req.query.movementType)); }
  if (req.query?.referenceType) { where.push('reference_type = ?'); params.push(String(req.query.referenceType)); }
  if (req.query?.referenceId) { where.push('reference_id = ?'); params.push(String(req.query.referenceId)); }
  if (req.query?.locationId) {
    where.push('(from_location_id = ? OR to_location_id = ?)');
    params.push(String(req.query.locationId), String(req.query.locationId));
  }
  const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 200);
  const [rows] = await pool.query(`
    SELECT slm.*,
      p.name AS product_name, p.sku AS product_sku, p.ean AS product_ean, p.specs AS product_specs
    FROM stock_location_movements slm
    LEFT JOIN products p ON p.id = slm.product_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY slm.created_at DESC
    LIMIT ${limit}
  `, params);
  return rows.map((row) => ({
    ...row,
    quantity: stockNumber(row.quantity),
    previous_from_quantity: row.previous_from_quantity == null ? null : stockNumber(row.previous_from_quantity),
    new_from_quantity: row.new_from_quantity == null ? null : stockNumber(row.new_from_quantity),
    previous_to_quantity: row.previous_to_quantity == null ? null : stockNumber(row.previous_to_quantity),
    new_to_quantity: row.new_to_quantity == null ? null : stockNumber(row.new_to_quantity),
    product: row.product_name ? {
      id: row.product_id,
      name: row.product_name,
      sku: row.product_sku || null,
      ean: row.product_ean || null,
      specs: parseStockJson(row.product_specs, null),
    } : null,
  }));
});

fastify.post('/stock-locations/entries', { preHandler: requireSyncKey }, async (req, reply) => {
  const input = req.body || {};
  const quantity = stockNumber(input.quantity);
  if (!input.product_id || !input.deposit_id || !input.location_id) return reply.code(400).send({ error: 'Produto, deposito e local sao obrigatorios.' });
  if (quantity <= 0) return reply.code(400).send({ error: 'Informe uma quantidade valida para a entrada.' });
  if (!String(input.reason || '').trim()) return reply.code(400).send({ error: 'Informe o motivo da entrada.' });

  const [[product]] = await pool.query('SELECT company_id FROM products WHERE id = ? LIMIT 1', [input.product_id]);
  if (!product) return reply.code(404).send({ error: 'Produto nao encontrado.' });
  const current = await getStockLocationRow(input.product_id, input.deposit_id, input.location_id, true);
  const previous = stockNumber(current?.quantity);
  const reserved = stockNumber(current?.reserved_quantity);
  const next = previous + quantity;
  const row = await upsertStockLocationBalance({
    companyId: product.company_id || await getDefaultStockCompanyId(),
    productId: input.product_id,
    depositId: input.deposit_id,
    locationId: input.location_id,
    quantity: next,
    reservedQuantity: reserved,
  });
  await pool.query(
    `INSERT INTO stock_location_movements
      (id, company_id, product_id, to_deposit_id, to_location_id, quantity, movement_type, reason, reference_type,
       previous_to_quantity, new_to_quantity, notes)
     VALUES (?, ?, ?, ?, ?, ?, 'in', ?, 'manual_entry', ?, ?, ?)`,
    [crypto.randomUUID(), product.company_id, input.product_id, input.deposit_id, input.location_id, quantity, String(input.reason).trim(), previous, next, input.notes || null]
  );
  await syncProductStockFromLocations(input.product_id);
  return row;
});

fastify.post('/stock-locations/adjustments', { preHandler: requireSyncKey }, async (req, reply) => {
  const input = req.body || {};
  const targetQuantity = stockNumber(input.quantity);
  if (targetQuantity < 0) return reply.code(400).send({ error: 'Informe uma quantidade valida para o ajuste.' });
  if (!String(input.reason || '').trim()) return reply.code(400).send({ error: 'Informe o motivo do ajuste.' });

  const [[product]] = await pool.query('SELECT company_id FROM products WHERE id = ? LIMIT 1', [input.product_id]);
  if (!product) return reply.code(404).send({ error: 'Produto nao encontrado.' });
  const current = await getStockLocationRow(input.product_id, input.deposit_id, input.location_id, true);
  const previous = stockNumber(current?.quantity);
  const reserved = stockNumber(current?.reserved_quantity);
  if (targetQuantity < reserved) return reply.code(400).send({ error: 'A quantidade ajustada nao pode ficar menor que o saldo reservado atual.' });
  const row = await upsertStockLocationBalance({
    companyId: product.company_id || await getDefaultStockCompanyId(),
    productId: input.product_id,
    depositId: input.deposit_id,
    locationId: input.location_id,
    quantity: targetQuantity,
    reservedQuantity: reserved,
  });
  await pool.query(
    `INSERT INTO stock_location_movements
      (id, company_id, product_id, from_deposit_id, from_location_id, to_deposit_id, to_location_id, quantity,
       movement_type, reason, reference_type, previous_from_quantity, new_from_quantity, previous_to_quantity, new_to_quantity, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'adjustment', ?, 'manual_adjustment', ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), product.company_id, input.product_id, input.deposit_id, input.location_id, input.deposit_id, input.location_id,
      Math.abs(targetQuantity - previous), String(input.reason).trim(), previous, targetQuantity, previous, targetQuantity, input.notes || null]
  );
  await syncProductStockFromLocations(input.product_id);
  return row;
});

fastify.post('/stock-locations/transfers', { preHandler: requireSyncKey }, async (req, reply) => {
  const input = req.body || {};
  const quantity = stockNumber(input.quantity);
  if (quantity <= 0) return reply.code(400).send({ error: 'Informe uma quantidade valida para a transferencia.' });
  if (input.from_location_id === input.to_location_id) return reply.code(400).send({ error: 'A origem e destino precisam ser diferentes.' });

  const [[product]] = await pool.query('SELECT company_id FROM products WHERE id = ? LIMIT 1', [input.product_id]);
  if (!product) return reply.code(404).send({ error: 'Produto nao encontrado.' });
  const source = await getStockLocationRow(input.product_id, input.from_deposit_id, input.from_location_id, true);
  const sourceQuantity = stockNumber(source?.quantity);
  const sourceReserved = stockNumber(source?.reserved_quantity);
  if (sourceQuantity - sourceReserved < quantity) return reply.code(400).send({ error: 'Saldo disponivel insuficiente na origem.' });
  const target = await getStockLocationRow(input.product_id, input.to_deposit_id, input.to_location_id, true);
  const targetQuantity = stockNumber(target?.quantity);
  const targetReserved = stockNumber(target?.reserved_quantity);

  await upsertStockLocationBalance({
    companyId: product.company_id || await getDefaultStockCompanyId(),
    productId: input.product_id,
    depositId: input.from_deposit_id,
    locationId: input.from_location_id,
    quantity: sourceQuantity - quantity,
    reservedQuantity: sourceReserved,
  });
  await upsertStockLocationBalance({
    companyId: product.company_id || await getDefaultStockCompanyId(),
    productId: input.product_id,
    depositId: input.to_deposit_id,
    locationId: input.to_location_id,
    quantity: targetQuantity + quantity,
    reservedQuantity: targetReserved,
  });
  await pool.query(
    `INSERT INTO stock_location_movements
      (id, company_id, product_id, from_deposit_id, from_location_id, to_deposit_id, to_location_id, quantity,
       movement_type, reason, reference_type, previous_from_quantity, new_from_quantity, previous_to_quantity, new_to_quantity, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'transfer', ?, 'manual_transfer', ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), product.company_id, input.product_id, input.from_deposit_id, input.from_location_id, input.to_deposit_id, input.to_location_id,
      quantity, String(input.reason || 'Transferencia interna').trim(), sourceQuantity, sourceQuantity - quantity, targetQuantity, targetQuantity + quantity, input.notes || null]
  );
  await syncProductStockFromLocations(input.product_id);
  const [rows] = await pool.query(`
    SELECT psl.*
    FROM product_stock_locations psl
    WHERE psl.product_id = ? AND psl.location_id IN (?, ?)
    ORDER BY psl.updated_at DESC
  `, [input.product_id, input.from_location_id, input.to_location_id]);
  return rows;
});

async function getPriorityStockSources(productId) {
  const [rows] = await pool.query(
    `SELECT psl.*, sd.is_default AS deposit_is_default, sl.is_default AS location_is_default
     FROM product_stock_locations psl
     LEFT JOIN stock_deposits sd ON sd.id = psl.deposit_id
     LEFT JOIN stock_locations sl ON sl.id = psl.location_id
     WHERE psl.product_id = ? AND (psl.quantity - psl.reserved_quantity) > 0
     ORDER BY sd.is_default DESC, sl.is_default DESC, psl.quantity DESC`,
    [productId]
  );
  return rows || [];
}

async function insertStockMovement(row) {
  await pool.query(
    `INSERT INTO stock_location_movements
      (id, company_id, product_id, from_deposit_id, from_location_id, to_deposit_id, to_location_id, quantity,
       movement_type, reason, reference_type, reference_id, previous_from_quantity, new_from_quantity,
       previous_to_quantity, new_to_quantity, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      row.company_id,
      row.product_id,
      row.from_deposit_id || null,
      row.from_location_id || null,
      row.to_deposit_id || null,
      row.to_location_id || null,
      row.quantity,
      row.movement_type,
      row.reason,
      row.reference_type || null,
      row.reference_id || null,
      row.previous_from_quantity == null ? null : row.previous_from_quantity,
      row.new_from_quantity == null ? null : row.new_from_quantity,
      row.previous_to_quantity == null ? null : row.previous_to_quantity,
      row.new_to_quantity == null ? null : row.new_to_quantity,
      row.notes || null,
    ]
  );
}

fastify.post('/stock-locations/priority-decrements', { preHandler: requireSyncKey }, async (req, reply) => {
  const input = req.body || {};
  const quantity = stockNumber(input.quantity);
  if (!input.product_id || quantity <= 0) return reply.code(400).send({ error: 'Produto e quantidade sao obrigatorios.' });
  const [[product]] = await pool.query('SELECT company_id FROM products WHERE id = ? LIMIT 1', [input.product_id]);
  if (!product) return reply.code(404).send({ error: 'Produto nao encontrado.' });
  const sources = await getPriorityStockSources(input.product_id);
  const totalAvailable = sources.reduce((sum, row) => sum + Math.max(0, stockNumber(row.quantity) - stockNumber(row.reserved_quantity)), 0);
  if (totalAvailable < quantity) return reply.code(400).send({ error: 'insufficient_stock_by_location' });

  let remaining = quantity;
  const result = [];
  for (const source of sources) {
    if (remaining <= 0) break;
    const previous = stockNumber(source.quantity);
    const available = Math.max(0, previous - stockNumber(source.reserved_quantity));
    const decrement = Math.min(remaining, available);
    if (decrement <= 0) continue;
    const next = previous - decrement;
    await upsertStockLocationBalance({
      companyId: source.company_id || product.company_id,
      productId: input.product_id,
      depositId: source.deposit_id,
      locationId: source.location_id,
      quantity: next,
      reservedQuantity: stockNumber(source.reserved_quantity),
    });
    await insertStockMovement({
      company_id: source.company_id || product.company_id,
      product_id: input.product_id,
      from_deposit_id: source.deposit_id,
      from_location_id: source.location_id,
      quantity: decrement,
      movement_type: 'sale',
      reason: String(input.reason || '').trim() || 'Baixa por prioridade',
      reference_type: input.reference_type || null,
      reference_id: input.reference_id || null,
      previous_from_quantity: previous,
      new_from_quantity: next,
      notes: input.notes || null,
    });
    result.push({ stock_location_id: source.id, deposit_id: source.deposit_id, location_id: source.location_id, quantity_decremented: decrement, previous_quantity: previous, new_quantity: next });
    remaining -= decrement;
  }
  await syncProductStockFromLocations(input.product_id);
  return result;
});

fastify.post('/stock-locations/priority-reservations', { preHandler: requireSyncKey }, async (req, reply) => {
  const input = req.body || {};
  const quantity = stockNumber(input.quantity);
  if (!input.product_id || quantity <= 0) return reply.code(400).send({ error: 'Produto e quantidade sao obrigatorios.' });
  const [[product]] = await pool.query('SELECT company_id FROM products WHERE id = ? LIMIT 1', [input.product_id]);
  if (!product) return reply.code(404).send({ error: 'Produto nao encontrado.' });
  const sources = await getPriorityStockSources(input.product_id);
  const totalAvailable = sources.reduce((sum, row) => sum + Math.max(0, stockNumber(row.quantity) - stockNumber(row.reserved_quantity)), 0);
  if (totalAvailable < quantity) return reply.code(400).send({ error: 'insufficient_stock_by_location' });

  let remaining = quantity;
  const result = [];
  for (const source of sources) {
    if (remaining <= 0) break;
    const previousReserved = stockNumber(source.reserved_quantity);
    const available = Math.max(0, stockNumber(source.quantity) - previousReserved);
    const reserve = Math.min(remaining, available);
    if (reserve <= 0) continue;
    const nextReserved = previousReserved + reserve;
    await upsertStockLocationBalance({
      companyId: source.company_id || product.company_id,
      productId: input.product_id,
      depositId: source.deposit_id,
      locationId: source.location_id,
      quantity: stockNumber(source.quantity),
      reservedQuantity: nextReserved,
    });
    await insertStockMovement({
      company_id: source.company_id || product.company_id,
      product_id: input.product_id,
      from_deposit_id: source.deposit_id,
      from_location_id: source.location_id,
      quantity: reserve,
      movement_type: 'reservation',
      reason: String(input.reason || '').trim() || 'Reserva por prioridade',
      reference_type: input.reference_type || 'order_reservation',
      reference_id: input.reference_id || null,
      previous_from_quantity: stockNumber(source.quantity),
      new_from_quantity: stockNumber(source.quantity),
      notes: input.notes || null,
    });
    result.push({ stock_location_id: source.id, deposit_id: source.deposit_id, location_id: source.location_id, quantity_reserved: reserve, previous_reserved_quantity: previousReserved, new_reserved_quantity: nextReserved });
    remaining -= reserve;
  }
  return result;
});

async function processOrderReservation(orderId, mode, reason, notes) {
  const targetReferenceType = mode === 'consume' ? 'order' : 'order_release';
  const targetMovementType = mode === 'consume' ? 'sale' : 'release_reservation';
  const [existing] = await pool.query(
    'SELECT id FROM stock_location_movements WHERE reference_type = ? AND reference_id = ? AND movement_type = ? LIMIT 1',
    [targetReferenceType, orderId, targetMovementType]
  );
  if (existing?.length) return [];
  const [reservations] = await pool.query(
    `SELECT * FROM stock_location_movements
     WHERE reference_type = 'order_reservation' AND reference_id = ? AND movement_type = 'reservation'
     ORDER BY created_at ASC`,
    [orderId]
  );
  const result = [];
  for (const reservation of reservations || []) {
    const current = await getStockLocationRow(reservation.product_id, reservation.from_deposit_id, reservation.from_location_id, false);
    if (!current) throw new Error('order_reservation_stock_inconsistent');
    const previousQuantity = stockNumber(current.quantity);
    const previousReserved = stockNumber(current.reserved_quantity);
    const quantity = stockNumber(reservation.quantity);
    if (previousReserved < quantity || (mode === 'consume' && previousQuantity < quantity)) throw new Error('order_reservation_stock_inconsistent');
    const nextQuantity = mode === 'consume' ? previousQuantity - quantity : previousQuantity;
    const nextReserved = previousReserved - quantity;
    await upsertStockLocationBalance({
      companyId: current.company_id,
      productId: reservation.product_id,
      depositId: reservation.from_deposit_id,
      locationId: reservation.from_location_id,
      quantity: nextQuantity,
      reservedQuantity: nextReserved,
    });
    await insertStockMovement({
      company_id: current.company_id,
      product_id: reservation.product_id,
      from_deposit_id: reservation.from_deposit_id,
      from_location_id: reservation.from_location_id,
      quantity,
      movement_type: targetMovementType,
      reason,
      reference_type: targetReferenceType,
      reference_id: orderId,
      previous_from_quantity: previousQuantity,
      new_from_quantity: nextQuantity,
      notes,
    });
    result.push({ reservation_movement_id: reservation.id, product_id: reservation.product_id, deposit_id: reservation.from_deposit_id, location_id: reservation.from_location_id, quantity_processed: quantity, previous_quantity: previousQuantity, new_quantity: nextQuantity, previous_reserved_quantity: previousReserved, new_reserved_quantity: nextReserved });
    if (mode === 'consume') await syncProductStockFromLocations(reservation.product_id);
  }
  return result;
}

fastify.post('/stock-locations/order-reservations/consume', { preHandler: requireSyncKey }, async (req) => {
  const input = req.body || {};
  return processOrderReservation(input.order_id, 'consume', String(input.reason || '').trim() || 'Baixa de reserva', input.notes || null);
});

fastify.post('/stock-locations/order-reservations/release', { preHandler: requireSyncKey }, async (req) => {
  const input = req.body || {};
  return processOrderReservation(input.order_id, 'release', String(input.reason || '').trim() || 'Liberacao de reserva', input.notes || null);
});

async function restoreStockFromMovements(referenceType, restoreReferenceType, referenceId, reason, notes) {
  const [existing] = await pool.query(
    'SELECT id FROM stock_location_movements WHERE reference_type = ? AND reference_id = ? AND movement_type = ? LIMIT 1',
    [restoreReferenceType, referenceId, 'cancel']
  );
  if (existing?.length) return [];
  const [movements] = await pool.query(
    `SELECT * FROM stock_location_movements
     WHERE reference_type = ? AND reference_id = ? AND movement_type = 'sale'
     ORDER BY created_at ASC`,
    [referenceType, referenceId]
  );
  const result = [];
  for (const movement of movements || []) {
    const current = await getStockLocationRow(movement.product_id, movement.from_deposit_id, movement.from_location_id, false);
    const previous = stockNumber(current?.quantity);
    const quantity = stockNumber(movement.quantity);
    const next = previous + quantity;
    await upsertStockLocationBalance({
      companyId: movement.company_id || current?.company_id || await getDefaultStockCompanyId(),
      productId: movement.product_id,
      depositId: movement.from_deposit_id,
      locationId: movement.from_location_id,
      quantity: next,
      reservedQuantity: stockNumber(current?.reserved_quantity),
    });
    await insertStockMovement({
      company_id: movement.company_id || current?.company_id || await getDefaultStockCompanyId(),
      product_id: movement.product_id,
      to_deposit_id: movement.from_deposit_id,
      to_location_id: movement.from_location_id,
      quantity,
      movement_type: 'cancel',
      reason,
      reference_type: restoreReferenceType,
      reference_id: referenceId,
      previous_to_quantity: previous,
      new_to_quantity: next,
      notes,
    });
    await syncProductStockFromLocations(movement.product_id);
    result.push({ [`${referenceType}_movement_id`]: movement.id, product_id: movement.product_id, deposit_id: movement.from_deposit_id, location_id: movement.from_location_id, quantity_restored: quantity, previous_quantity: previous, new_quantity: next });
  }
  return result;
}

fastify.post('/stock-locations/sale-restores', { preHandler: requireSyncKey }, async (req) => {
  const input = req.body || {};
  return restoreStockFromMovements('sale', 'sale_restore', input.sale_id, String(input.reason || '').trim() || 'Restauracao de venda', input.notes || null);
});

fastify.post('/stock-locations/order-restores', { preHandler: requireSyncKey }, async (req) => {
  const input = req.body || {};
  return restoreStockFromMovements('order', 'order_restore', input.order_id, String(input.reason || '').trim() || 'Restauracao de pedido', input.notes || null);
});

async function buildStockPathDeactivationCheck(type, id) {
  const where = type === 'deposit' ? 'psl.deposit_id = ?' : 'psl.location_id = ?';
  const [rows] = await pool.query(`
    SELECT
      psl.product_id, p.name AS product_name, p.sku, psl.deposit_id, psl.location_id,
      sd.name AS deposit_name, sl.name AS location_name,
      psl.quantity, psl.reserved_quantity
    FROM product_stock_locations psl
    JOIN products p ON p.id = psl.product_id
    LEFT JOIN stock_deposits sd ON sd.id = psl.deposit_id
    LEFT JOIN stock_locations sl ON sl.id = psl.location_id
    WHERE ${where} AND (psl.quantity > 0 OR psl.reserved_quantity > 0)
    ORDER BY p.name ASC
  `, [id]);
  const pendingItems = rows.map((row) => ({
    product_id: row.product_id,
    product_name: row.product_name || '(sem nome)',
    sku: row.sku || null,
    deposit_id: row.deposit_id,
    deposit_name: row.deposit_name || null,
    location_id: row.location_id,
    location_name: row.location_name || null,
    quantity: stockNumber(row.quantity),
    reserved_quantity: stockNumber(row.reserved_quantity),
  }));
  return { target_type: type, target_id: id, can_deactivate: pendingItems.length === 0, pending_items: pendingItems };
}

fastify.get('/stock-locations/deposits/:id/deactivation-check', { preHandler: requireSyncKey }, async (req) => {
  return buildStockPathDeactivationCheck('deposit', req.params.id);
});

fastify.get('/stock-locations/locations/:id/deactivation-check', { preHandler: requireSyncKey }, async (req) => {
  return buildStockPathDeactivationCheck('location', req.params.id);
});

fastify.post('/stock-locations/deposits/:id/deactivate', { preHandler: requireSyncKey }, async (req, reply) => {
  const check = await buildStockPathDeactivationCheck('deposit', req.params.id);
  if (!check.can_deactivate) return reply.code(409).send(check);
  await pool.query('UPDATE stock_deposits SET is_active = 0, is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
  await pool.query('UPDATE stock_locations SET is_active = 0, is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE deposit_id = ?', [req.params.id]);
  return { ok: true };
});

fastify.post('/stock-locations/locations/:id/deactivate', { preHandler: requireSyncKey }, async (req, reply) => {
  const check = await buildStockPathDeactivationCheck('location', req.params.id);
  if (!check.can_deactivate) return reply.code(409).send(check);
  await pool.query('UPDATE stock_locations SET is_active = 0, is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
  return { ok: true };
});

fastify.get('/stock-locations/divergences', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query(`
    SELECT
      p.company_id,
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      COALESCE(p.stock_quantity, 0) AS product_stock_quantity,
      COALESCE(SUM(psl.quantity), 0) AS location_stock_quantity,
      (COALESCE(SUM(psl.quantity), 0) - COALESCE(p.stock_quantity, 0)) AS difference
    FROM products p
    LEFT JOIN product_stock_locations psl ON psl.product_id = p.id
    GROUP BY p.company_id, p.id, p.name, p.sku, p.stock_quantity
    HAVING difference <> 0
    ORDER BY product_name ASC
  `);
  return rows.map(row => ({
    ...row,
    product_stock_quantity: Number(row.product_stock_quantity || 0),
    location_stock_quantity: Number(row.location_stock_quantity || 0),
    difference: Number(row.difference || 0),
  }));
});

fastify.post('/products/:id/view', { preHandler: requireSyncKey }, async (req, reply) => {
  const productId = String(req.params.id || '').trim();
  if (!productId) return reply.code(400).send({ error: 'product id required' });

  const { customer_id, session_id } = req.body || {};
  await pool.query(
    `INSERT INTO product_views (product_id, customer_id, session_id)
     VALUES (?, ?, ?)`,
    [
      productId,
      customer_id ? String(customer_id) : null,
      session_id ? String(session_id) : null,
    ]
  );

  const [result] = await pool.query(
    `UPDATE products SET view_count=COALESCE(view_count,0)+1, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [productId]
  );

  return { ok: true, affectedRows: result.affectedRows };
});

const SERIALIZED_PRODUCT_IDENTIFIER_FIELDS = ['imei1', 'imei2', 'serial'];
const SERIALIZED_UNIT_IDENTIFIER_FIELDS = ['imei_1', 'imei_2', 'serial'];

function normalizeSerializedIdentifierValue(value) {
  return String(value || '').trim();
}

function normalizeSerializedIdentifierKey(value) {
  return normalizeSerializedIdentifierValue(value).toLowerCase();
}

function parseSerializedSpecsInput(specs) {
  if (!specs) return {};
  if (typeof specs === 'string') {
    try {
      return JSON.parse(specs) || {};
    } catch (_err) {
      return {};
    }
  }
  return typeof specs === 'object' ? specs : {};
}

function collectProductSerializedIdentifiers(product = {}) {
  const specs = parseSerializedSpecsInput(product.specs);
  return {
    imei1: normalizeSerializedIdentifierValue(specs.imei1),
    imei2: normalizeSerializedIdentifierValue(specs.imei2),
    serial: normalizeSerializedIdentifierValue(specs.serial),
  };
}

function collectUnitSerializedIdentifiers(unit = {}) {
  return {
    imei_1: normalizeSerializedIdentifierValue(unit.imei_1),
    imei_2: normalizeSerializedIdentifierValue(unit.imei_2),
    serial: normalizeSerializedIdentifierValue(unit.serial),
  };
}

function findSerializedIdentifierDuplicateInBatch(items, collectIdentifiers, idField = 'id') {
  const seen = new Map();
  for (const [index, item] of (items || []).entries()) {
    const itemId = item?.[idField] ? String(item[idField]) : '';
    const identifiers = collectIdentifiers(item);
    for (const [field, rawValue] of Object.entries(identifiers)) {
      const value = normalizeSerializedIdentifierValue(rawValue);
      if (!value) continue;
      const key = `${field}:${normalizeSerializedIdentifierKey(value)}`;
      const previous = seen.get(key);
      if (previous && previous.index !== index) {
        return { field, value, conflict: previous };
      }
      if (!previous) {
        seen.set(key, {
          index,
          itemId,
          name: item?.name || null,
          sku: item?.sku || null,
          product_id: item?.product_id || null,
        });
      }
    }
  }
  return null;
}

async function findProductSerializedIdentifierConflict(identifiers, excludeProductId = null) {
  const clauses = [];
  const params = [];
  for (const field of SERIALIZED_PRODUCT_IDENTIFIER_FIELDS) {
    const value = normalizeSerializedIdentifierValue(identifiers?.[field]);
    if (!value) continue;
    clauses.push(`LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(specs, '$.${field}')))) = ?`);
    params.push(normalizeSerializedIdentifierKey(value));
  }
  if (!clauses.length) return null;

  const where = [];
  const whereParams = [];
  if (excludeProductId) {
    where.push('id <> ?');
    whereParams.push(String(excludeProductId));
  }
  where.push(`(${clauses.join(' OR ')})`);

  const [rows] = await pool.query(
    `SELECT id, name, sku,
            JSON_UNQUOTE(JSON_EXTRACT(specs, '$.imei1')) AS imei1,
            JSON_UNQUOTE(JSON_EXTRACT(specs, '$.imei2')) AS imei2,
            JSON_UNQUOTE(JSON_EXTRACT(specs, '$.serial')) AS serial
       FROM products
      WHERE ${where.join(' AND ')}
      LIMIT 1`,
    [...whereParams, ...params]
  );
  const row = rows?.[0];
  if (!row) return null;

  for (const field of SERIALIZED_PRODUCT_IDENTIFIER_FIELDS) {
    const value = normalizeSerializedIdentifierValue(identifiers?.[field]);
    if (value && normalizeSerializedIdentifierKey(row[field]) === normalizeSerializedIdentifierKey(value)) {
      return { field, value, table: 'products', id: row.id, name: row.name, sku: row.sku };
    }
  }
  return null;
}

async function findUnitSerializedIdentifierConflict(identifiers, excludeUnitId = null) {
  const clauses = [];
  const params = [];
  for (const field of SERIALIZED_UNIT_IDENTIFIER_FIELDS) {
    const value = normalizeSerializedIdentifierValue(identifiers?.[field]);
    if (!value) continue;
    clauses.push(`LOWER(TRIM(${field})) = ?`);
    params.push(normalizeSerializedIdentifierKey(value));
  }
  if (!clauses.length) return null;

  const where = [];
  const whereParams = [];
  if (excludeUnitId) {
    where.push('u.id <> ?');
    whereParams.push(String(excludeUnitId));
  }
  where.push(`(${clauses.join(' OR ')})`);

  const [rows] = await pool.query(
    `SELECT u.id, u.product_id, u.imei_1, u.imei_2, u.serial, p.name AS product_name, p.sku AS product_sku
       FROM units u
       LEFT JOIN products p ON p.id = u.product_id
      WHERE ${where.join(' AND ')}
      LIMIT 1`,
    [...whereParams, ...params]
  );
  const row = rows?.[0];
  if (!row) return null;

  for (const field of SERIALIZED_UNIT_IDENTIFIER_FIELDS) {
    const value = normalizeSerializedIdentifierValue(identifiers?.[field]);
    if (value && normalizeSerializedIdentifierKey(row[field]) === normalizeSerializedIdentifierKey(value)) {
      return { field, value, table: 'units', id: row.id, product_id: row.product_id, name: row.product_name, sku: row.product_sku };
    }
  }
  return null;
}

function serializedIdentifierConflictPayload(conflict) {
  const label = conflict?.field === 'imei1' || conflict?.field === 'imei_1'
    ? 'IMEI 1'
    : conflict?.field === 'imei2' || conflict?.field === 'imei_2'
      ? 'IMEI 2'
      : 'Serial';
  return {
    error: 'duplicate_serialized_identifier',
    message: `${label} ja cadastrado: ${conflict?.value || ''}`,
    field: conflict?.field,
    value: conflict?.value,
    conflict,
  };
}

fastify.post('/products/batch', { preHandler: requireSyncKey }, async (req, reply) => {
  const products = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return reply.code(400).send({ error: 'Expected non-empty array' });
  }

  const batchDuplicate = findSerializedIdentifierDuplicateInBatch(products, collectProductSerializedIdentifiers);
  if (batchDuplicate) {
    return reply.code(409).send(serializedIdentifierConflictPayload({
      ...batchDuplicate,
      table: 'request_batch',
    }));
  }

  const results = { upserted: 0, errors: [] };

  for (const p of products) {
    try {
      const conflict = await findProductSerializedIdentifierConflict(
        collectProductSerializedIdentifiers(p),
        p.id || null
      );
      if (conflict) {
        results.errors.push({ id: p.id, name: p.name, ...serializedIdentifierConflictPayload(conflict) });
        continue;
      }

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
          offer_type, offer_parent_product_id, offer_visibility,
          shopee_strategy, shopee_offer_status, shopee_offer_error,
          meta_title, meta_description, keywords
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
          offer_type=VALUES(offer_type),
          offer_parent_product_id=VALUES(offer_parent_product_id),
          offer_visibility=VALUES(offer_visibility),
          shopee_strategy=VALUES(shopee_strategy),
          shopee_offer_status=VALUES(shopee_offer_status),
          shopee_offer_error=VALUES(shopee_offer_error),
          meta_title=IF(VALUES(meta_title) IS NULL, meta_title, VALUES(meta_title)),
          meta_description=IF(VALUES(meta_description) IS NULL, meta_description, VALUES(meta_description)),
          keywords=IF(VALUES(keywords) IS NULL, keywords, VALUES(keywords)),
          updated_at=CURRENT_TIMESTAMP`,
        [
          p.id, p.name, p.slug || null, p.sku || null,
          p.ean || null, jsonStr(p.alternative_eans), sanitizeDescription(p.description),
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
          p.offer_type || null, p.offer_parent_product_id || null, p.offer_visibility || 'visible',
          p.shopee_strategy || 'variation', p.shopee_offer_status || null, p.shopee_offer_error || null,
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
async function getShopeeStockTargetsForProductIds(productIds) {
  const ids = [...new Set((productIds || []).map(id => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const comboStock = comboStockSql('p');
  const [rows] = await pool.query(
    `SELECT p.id, p.sku, p.offer_type, p.shopee_strategy, p.track_inventory, ${comboStock} AS stock_quantity
       FROM products p
      WHERE p.id IN (${placeholders})
     UNION
     SELECT p.id, p.sku, p.offer_type, p.shopee_strategy, p.track_inventory, ${comboStock} AS stock_quantity
       FROM product_combos pc
       JOIN products p ON p.id = pc.combo_product_id
      WHERE pc.child_product_id IN (${placeholders})`,
    [...ids, ...ids]
  );
  return rows.map(row => ({
    id: row.id,
    sku: row.sku,
    offer_type: row.offer_type || null,
    shopee_strategy: row.shopee_strategy || null,
    stock_quantity: Number(row.track_inventory) === 0 ? 999 : Math.max(0, Math.trunc(Number(row.stock_quantity || 0))),
  }));
}

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
  const changedProductIds = [];
  const locationSync = [];

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
      if (result.affectedRows && p.stock_quantity !== undefined) {
        const lookupWhere = p.id ? 'id=?' : 'sku=?';
        const [changedRows] = await pool.query(`SELECT id FROM products WHERE ${lookupWhere}`, [p.id || p.sku]);
        for (const row of changedRows || []) {
          changedProductIds.push(row.id);
          locationSync.push({
            product_id: row.id,
            ...(await reconcileProductStockLocationsToTotal(
              row.id,
              p.stock_quantity,
              'prices_stock_update',
              'Total de estoque atualizado por sincronizacao comercial e reconciliado com os locais.'
            )),
          });
        }
      }
    } catch (err) {
      results.errors.push({ id: p.id, sku: p.sku, error: err.message });
    }
  }

  results.stockTargets = await getShopeeStockTargetsForProductIds(changedProductIds);
  results.locationSync = locationSync;
  return results;
});

// Single product update
fastify.put('/products/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const p = req.body;
  const conflict = await findProductSerializedIdentifierConflict(
    collectProductSerializedIdentifiers(p),
    req.params.id
  );
  if (conflict) return reply.code(409).send(serializedIdentifierConflictPayload(conflict));

  await pool.query(
    `UPDATE products SET
      name=?, slug=?, sku=?, ean=?, alternative_eans=?,
      description=?, technical_specifications=?,
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
      sanitizeDescription(p.description), sanitizeDescription(p.technical_specifications),
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

// Update specs.tags_venda (cross-sell) by product id. Usa JSON_SET pra mexer
// só nessa chave dentro do JSON de specs.
fastify.patch('/products/:id/tags-venda', { preHandler: requireSyncKey }, async (req, reply) => {
  const { tags_venda } = req.body || {};
  if (!Array.isArray(tags_venda)) {
    return reply.code(400).send({ error: 'tags_venda deve ser um array' });
  }
  const cleaned = tags_venda
    .filter(t => typeof t === 'string')
    .map(t => t.trim())
    .filter(Boolean);
  const [result] = await pool.query(
    `UPDATE products
       SET specs = JSON_SET(COALESCE(specs, JSON_OBJECT()), '$.tags_venda', CAST(? AS JSON)),
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [JSON.stringify(cleaned), req.params.id]
  );
  if (!result.affectedRows) return reply.code(404).send({ error: 'not found' });
  return { ok: true, tags_venda: cleaned };
});

// Update description + technical_specifications by SKU (used by description sync)
fastify.patch('/products/description', { preHandler: requireSyncKey }, async (req, reply) => {
  const { sku, description, technical_specifications } = req.body || {};
  if (!sku) return reply.code(400).send({ error: 'sku required' });
  const [result] = await pool.query(
    'UPDATE products SET description=?, technical_specifications=?, updated_at=CURRENT_TIMESTAMP WHERE sku=?',
    [sanitizeDescription(description), sanitizeDescription(technical_specifications), sku]
  );
  return { ok: true, affectedRows: result.affectedRows };
});

// Update stock_quantity by SKU (used by Bling webhook — estoque event)
fastify.patch('/products/stock', { preHandler: requireSyncKey }, async (req, reply) => {
  const { sku, bling_id, stock_quantity } = req.body || {};
  if (!sku && !bling_id) return reply.code(400).send({ error: 'sku or bling_id required' });
  if (stock_quantity === undefined || stock_quantity === null) return reply.code(400).send({ error: 'stock_quantity required' });
  const qty = Math.max(0, parseInt(stock_quantity, 10) || 0);

  const whereSql = sku ? 'p.sku = ?' : 'p.bling_id = ?';
  const whereValue = sku || String(bling_id);
  const [matchedRows] = await pool.query(
    `SELECT p.id, p.sku, p.bling_id, p.specs,
            COUNT(u.id) AS unit_count
       FROM products p
       LEFT JOIN units u ON u.product_id = p.id
      WHERE ${whereSql}
      GROUP BY p.id, p.sku, p.bling_id, p.specs
      ORDER BY CASE WHEN p.status = 'active' THEN 0 ELSE 1 END,
               COUNT(u.id) DESC,
               p.created_at ASC`,
    [whereValue]
  );

  const isSerializedMatch = (matchedRows || []).some((row) => {
    if (Number(row.unit_count || 0) > 0) return true;
    const specs = typeof row.specs === 'string' ? (() => { try { return JSON.parse(row.specs || '{}'); } catch { return {}; } })() : (row.specs || {});
    return Boolean(specs.imei1 || specs.imei2 || specs.serial || specs.serial_number);
  });

  if (isSerializedMatch) {
    const canonical = matchedRows?.[0];
    if (!canonical) return { ok: true, affectedRows: 0, serializedStockReference: true };
    await pool.query(
      `UPDATE products
          SET custom_fields = JSON_SET(COALESCE(custom_fields, JSON_OBJECT()), '$.bling_stock_quantity', ?, '$.bling_stock_synced_at', CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [qty, canonical.id]
    );
    const availableStock = await syncProductStock(canonical.id);
    const stockTargets = await getShopeeStockTargetsForProductIds([canonical.id]);
    return {
      ok: true,
      affectedRows: 1,
      serializedStockReference: true,
      product_id: canonical.id,
      bling_stock_quantity: qty,
      stock_quantity: availableStock,
      duplicateMatches: matchedRows.length,
      stockTargets,
    };
  }

  let result;
  let changedRows = [];
  [result] = await pool.query(
    `UPDATE products SET stock_quantity=?, updated_at=CURRENT_TIMESTAMP WHERE ${sku ? 'sku=?' : 'bling_id=?'}`,
    [qty, whereValue]
  );
  [changedRows] = await pool.query(`SELECT id FROM products WHERE ${sku ? 'sku=?' : 'bling_id=?'}`, [whereValue]);
  const locationSync = [];
  for (const row of changedRows || []) {
    locationSync.push(await reconcileProductStockLocationsToTotal(row.id, qty, 'bling_stock_sync', 'Total externo de estoque sincronizado para manter a distribuicao por local.'));
  }
  const stockTargets = await getShopeeStockTargetsForProductIds(changedRows.map(row => row.id));
  return { ok: true, affectedRows: result.affectedRows, locationSync, stockTargets };
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

// Cria/atualiza grupo de variacoes gravando apenas o parent_id dos produtos.
fastify.patch('/products/variation-group', { preHandler: requireSyncKey }, async (req, reply) => {
  const parentId = String(req.body?.parent_id || '').trim();
  const childIds = Array.isArray(req.body?.child_ids)
    ? Array.from(new Set(req.body.child_ids.map(id => String(id || '').trim()).filter(Boolean)))
    : [];

  if (!parentId || childIds.length < 2 || !childIds.includes(parentId)) {
    return reply.code(400).send({ ok: false, error: 'parent_id and child_ids including parent are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [parentRows] = await conn.query('SELECT id FROM products WHERE id=? LIMIT 1', [parentId]);
    if (!Array.isArray(parentRows) || parentRows.length === 0) {
      await conn.rollback();
      return reply.code(404).send({ ok: false, error: 'parent product not found' });
    }

    const childrenToLink = childIds.filter(id => id !== parentId);
    let updated = 0;

    const [parentResult] = await conn.query(
      'UPDATE products SET parent_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [parentId]
    );
    updated += parentResult.affectedRows || 0;

    if (childrenToLink.length > 0) {
      const placeholders = childrenToLink.map(() => '?').join(',');
      const [childResult] = await conn.query(
        `UPDATE products SET parent_id=?, updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
        [parentId, ...childrenToLink]
      );
      updated += childResult.affectedRows || 0;
    }

    await conn.commit();
    return { ok: true, parent_id: parentId, child_ids: childIds, updated };
  } catch (err) {
    await conn.rollback();
    req.log.error({ err }, 'products variation group update failed');
    return reply.code(500).send({ ok: false, error: err.message });
  } finally {
    conn.release();
  }
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
  const { product_id, order_id, sale_id, status, company_id, ids } = req.query;
  const conds = [];
  const params = [];
  const idList = String(ids || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (product_id) { conds.push('u.product_id = ?'); params.push(product_id); }
  if (order_id)   { conds.push('u.order_id = ?');   params.push(order_id); }
  if (sale_id)    { conds.push('u.sale_id = ?');    params.push(sale_id); }
  if (company_id) { conds.push('p.company_id = ?'); params.push(company_id); }
  if (idList.length > 0) {
    conds.push(`u.id IN (${idList.map(() => '?').join(', ')})`);
    params.push(...idList);
  }
  if (status && status !== 'all') { conds.push('u.status = ?'); params.push(status); }
  if (conds.length === 0) return reply.code(400).send({ error: 'product_id, order_id, sale_id, company_id or ids required' });
  const [rows] = await pool.query(
    `SELECT u.*, p.company_id, p.name AS product_name, p.sku AS product_sku
       FROM units u
       LEFT JOIN products p ON p.id = u.product_id
      WHERE ${conds.join(' AND ')}
      ORDER BY u.created_at ASC`,
    params
  );
  return rows;
});

// Busca por IMEI 1, IMEI 2 ou serial (usado no PDV)
fastify.get('/units/by-identifier/:q', async (req, reply) => {
  const q = normalizeSerializedIdentifierKey(req.params.q);
  if (!q) return reply.code(400).send({ error: 'identifier required' });
  const [rows] = await pool.query(
    `SELECT u.*, p.name AS product_name, p.sku AS product_sku
       FROM units u
       LEFT JOIN products p ON p.id = u.product_id
      WHERE LOWER(TRIM(u.imei_1)) = ? OR LOWER(TRIM(u.imei_2)) = ? OR LOWER(TRIM(u.serial)) = ?`,
    [q, q, q]
  );
  return rows;
});

// Cria 1 unidade
fastify.post('/units', { preHandler: requireSyncKey }, async (req, reply) => {
  const u = req.body || {};
  if (!u.product_id) return reply.code(400).send({ error: 'product_id required' });
  const id = u.id || require('crypto').randomUUID();
  const conflict = await findUnitSerializedIdentifierConflict(collectUnitSerializedIdentifiers(u), id);
  if (conflict) return reply.code(409).send(serializedIdentifierConflictPayload(conflict));

  await pool.query(
    `INSERT INTO units (
       id, product_id, imei_1, imei_2, serial, status, \`condition\`,
       internal_notes, cost_price, deposit_id, location_id, order_id, sale_id, reserved_at, sold_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, u.product_id,
      u.imei_1 || null, u.imei_2 || null, u.serial || null,
      u.status || 'available',
      u.condition || 'new',
      u.internal_notes || null,
      u.cost_price ?? null,
      u.deposit_id || null, u.location_id || null,
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
  const batchDuplicate = findSerializedIdentifierDuplicateInBatch(items, collectUnitSerializedIdentifiers);
  if (batchDuplicate) {
    return reply.code(409).send(serializedIdentifierConflictPayload({
      ...batchDuplicate,
      table: 'request_batch',
    }));
  }

  const results = { inserted: 0, errors: [] };
  const productIds = new Set();
  for (const u of items) {
    try {
      if (!u.product_id) throw new Error('product_id required');
      const id = u.id || require('crypto').randomUUID();
      const conflict = await findUnitSerializedIdentifierConflict(collectUnitSerializedIdentifiers(u), id);
      if (conflict) {
        results.errors.push({ serial: u.serial, imei_1: u.imei_1, ...serializedIdentifierConflictPayload(conflict) });
        continue;
      }

      await pool.query(
        `INSERT INTO units (
           id, product_id, imei_1, imei_2, serial, status, \`condition\`,
           internal_notes, cost_price, deposit_id, location_id
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, u.product_id,
          u.imei_1 || null, u.imei_2 || null, u.serial || null,
          u.status || 'available',
          u.condition || 'new',
          u.internal_notes || null,
          u.cost_price ?? null,
          u.deposit_id || null,
          u.location_id || null,
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
    'reserved_at', 'sold_at', 'deposit_id', 'location_id',
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
  const conflict = await findUnitSerializedIdentifierConflict(collectUnitSerializedIdentifiers(u), req.params.id);
  if (conflict) return reply.code(409).send(serializedIdentifierConflictPayload(conflict));

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
  // expects body to be a Product payload + `combo_children` and optional `combo_choice_groups`
  const p = req.body;
  const id = p.id || require('crypto').randomUUID();
  const children = p.combo_children || [];
  const choiceGroups = p.combo_choice_groups || [];
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO products (
        id, name, slug, sku, is_combo, combo_discount_type, combo_discount_value,
        price_retail, price_wholesale, price_cost, price_reseller,
        status, track_inventory, images, category_id, brand,
        description, specs, dimensions, weight_kg, is_virtual,
        offer_type, offer_parent_product_id, offer_visibility,
        shopee_strategy, shopee_offer_status, shopee_offer_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, p.name, p.slug || null, p.sku || null, 1, p.combo_discount_type || null, p.combo_discount_value || 0,
        p.price_retail || 0, p.price_wholesale || 0, p.price_cost || 0, p.price_reseller || 0,
        p.status || 'active', p.track_inventory ? 1 : 0, jsonStr(p.images), p.category_id || null, p.brand || null,
        sanitizeDescription(p.description), jsonStr({ technical_specifications: p.technical_specifications, tags: p.tags }), jsonStr(p.dimensions), p.weight_kg || null, p.is_virtual ? 1 : 0,
        p.offer_type || null, p.offer_parent_product_id || null, p.offer_visibility || 'visible',
        p.shopee_strategy || 'variation', p.shopee_offer_status || null, p.shopee_offer_error || null
      ]
    );

    for (const child of children) {
      const pcId = require('crypto').randomUUID();
      await connection.query(
        `INSERT INTO product_combos
          (id, combo_product_id, child_product_id, quantity, component_type, group_key, parent_product_id, group_label)
         VALUES (?, ?, ?, ?, 'fixed', NULL, NULL, NULL)`,
        [pcId, id, child.id, child.quantity || 1]
      );
    }

    for (const group of choiceGroups) {
      const groupKey = group.group_key || `parent:${group.parent_product_id || require('crypto').randomUUID()}`;
      const options = Array.isArray(group.options) ? group.options : [];
      for (const option of options) {
        if (!option?.id) continue;
        const pcId = require('crypto').randomUUID();
        await connection.query(
          `INSERT INTO product_combos
            (id, combo_product_id, child_product_id, quantity, component_type, group_key, parent_product_id, group_label)
           VALUES (?, ?, ?, ?, 'choice_group', ?, ?, ?)`,
          [pcId, id, option.id, group.quantity || 1, groupKey, group.parent_product_id || null, group.label || null]
        );
      }
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
  const choiceGroups = p.combo_choice_groups || [];
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE products SET 
        name=?, slug=?, sku=?, is_combo=1, combo_discount_type=?, combo_discount_value=?,
        price_retail=?, price_wholesale=?, price_cost=?, price_reseller=?,
        status=?, images=?, category_id=?, brand=?, description=?, specs=?, dimensions=?, weight_kg=?, is_virtual=?,
        offer_type=?, offer_parent_product_id=?, offer_visibility=?,
        shopee_strategy=?, shopee_offer_status=?, shopee_offer_error=?,
        updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [
        p.name, p.slug || null, p.sku || null, p.combo_discount_type || null, p.combo_discount_value || 0,
        p.price_retail || 0, p.price_wholesale || 0, p.price_cost || 0, p.price_reseller || 0,
        p.status || 'active', jsonStr(p.images), p.category_id || null, p.brand || null,
        sanitizeDescription(p.description), jsonStr({ technical_specifications: p.technical_specifications, tags: p.tags }), jsonStr(p.dimensions), p.weight_kg || null, p.is_virtual ? 1 : 0,
        p.offer_type || null, p.offer_parent_product_id || null, p.offer_visibility || 'visible',
        p.shopee_strategy || 'variation', p.shopee_offer_status || null, p.shopee_offer_error || null,
        comboId
      ]
    );

    await connection.query(`DELETE FROM product_combos WHERE combo_product_id = ?`, [comboId]);

    for (const child of children) {
      const pcId = require('crypto').randomUUID();
      await connection.query(
        `INSERT INTO product_combos
          (id, combo_product_id, child_product_id, quantity, component_type, group_key, parent_product_id, group_label)
         VALUES (?, ?, ?, ?, 'fixed', NULL, NULL, NULL)`,
        [pcId, comboId, child.id, child.quantity || 1]
      );
    }

    for (const group of choiceGroups) {
      const groupKey = group.group_key || `parent:${group.parent_product_id || require('crypto').randomUUID()}`;
      const options = Array.isArray(group.options) ? group.options : [];
      for (const option of options) {
        if (!option?.id) continue;
        const pcId = require('crypto').randomUUID();
        await connection.query(
          `INSERT INTO product_combos
            (id, combo_product_id, child_product_id, quantity, component_type, group_key, parent_product_id, group_label)
           VALUES (?, ?, ?, ?, 'choice_group', ?, ?, ?)`,
          [pcId, comboId, option.id, group.quantity || 1, groupKey, group.parent_product_id || null, group.label || null]
        );
      }
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

// Offers (read/write)
fastify.get('/offers', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT *,
      ${comboStockSql('products')} AS stock_quantity
     FROM products
     WHERE offer_type IS NOT NULL
     ORDER BY updated_at DESC`
  );
  return rows.map(r => ({
    ...r,
    images: typeof r.images === 'string' ? JSON.parse(r.images || '[]') : (r.images ?? []),
    specs: typeof r.specs === 'string' ? JSON.parse(r.specs || '{}') : r.specs,
    alternative_eans: typeof r.alternative_eans === 'string' ? JSON.parse(r.alternative_eans || '[]') : r.alternative_eans,
    custom_fields: typeof r.custom_fields === 'string' ? JSON.parse(r.custom_fields || '{}') : r.custom_fields,
    kits: typeof r.kits === 'string' ? JSON.parse(r.kits || '[]') : r.kits,
  }));
});

fastify.post('/offers', { preHandler: requireSyncKey }, async (req, reply) => {
  const response = await fastify.inject({
    method: 'POST',
    url: '/combos',
    headers: { 'x-sync-key': req.headers['x-sync-key'] || req.headers['x-api-key'] },
    payload: { ...(req.body || {}), is_combo: true },
  });
  const payload = response.body ? JSON.parse(response.body) : {};
  return reply.code(response.statusCode).send(payload);
});

fastify.put('/offers/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const response = await fastify.inject({
    method: 'PUT',
    url: `/combos/${req.params.id}`,
    headers: { 'x-sync-key': req.headers['x-sync-key'] || req.headers['x-api-key'] },
    payload: req.body || {},
  });
  const payload = response.body ? JSON.parse(response.body) : {};
  return reply.code(response.statusCode).send(payload);
});

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
    'bling_client_id', 'bling_client_secret', 'bling_callback_url',
    'bling_access_token', 'bling_refresh_token', 'bling_token_expires_at',

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
const LEGACY_RESOURCE_TABLES = {
  customers: process.env.LEGACY_CUSTOMERS_TABLE || 'legacy_customers',
  phones: process.env.LEGACY_PHONES_TABLE || 'legacy_phones',
  brands: process.env.LEGACY_BRANDS_TABLE || 'legacy_brands',
  categories: process.env.LEGACY_CATEGORIES_TABLE || 'legacy_categories',
  sales: process.env.LEGACY_SALES_TABLE || 'legacy_sales',
};

const LEGACY_FILTER_COLUMNS = new Set([
  'id',
  'cpf',
  'cpf_cnpj',
  'imei1',
  'status',
  'device_type',
  'customer_id',
]);

function parseLegacyOrder(rawOrder) {
  const value = String(rawOrder || '').trim();
  if (!value) return '';
  const [column, direction = 'asc'] = value.split('.');
  if (!isValidTable(column)) return '';
  return ` ORDER BY \`${column}\` ${String(direction).toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`;
}

function buildLegacyWhere(query = {}) {
  const clauses = [];
  const params = [];

  for (const column of LEGACY_FILTER_COLUMNS) {
    const value = query[column];
    if (value == null || value === '') continue;
    clauses.push(`\`${column}\` = ?`);
    params.push(String(value));
  }

  if (query.startDate) {
    clauses.push('`date` >= ?');
    params.push(String(query.startDate));
  }
  if (query.endDate) {
    clauses.push('`date` <= ?');
    params.push(String(query.endDate));
  }

  return {
    sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

fastify.get('/legacy/:resource', { preHandler: requireSyncKey }, async (req, reply) => {
  const resource = String(req.params.resource || '');
  const table = LEGACY_RESOURCE_TABLES[resource];
  if (!table || !isValidTable(table)) {
    return reply.code(404).send({ error: 'Legacy resource not configured' });
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit) || 500, 1), 5000);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  const where = buildLegacyWhere(req.query);
  const order = parseLegacyOrder(req.query.order);

  try {
    const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total FROM \`${table}\`${where.sql}`, where.params);
    const [rows] = await pool.query(
      `SELECT * FROM \`${table}\`${where.sql}${order} LIMIT ? OFFSET ?`,
      [...where.params, limit, offset],
    );
    return {
      resource,
      table,
      total: Number(countRow?.total || 0),
      limit,
      offset,
      rows,
    };
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return reply.code(404).send({ error: 'Legacy table not found', table });
    }
    throw error;
  }
});

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

function normalizeTableDataValue(value) {
  if (value === undefined) return null;
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return value;
}

// INSERT individual
fastify.post('/table-data/:name', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name } = req.params;
  if (!isValidTable(name)) return reply.code(400).send({ error: 'Invalid table name' });

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reply.code(400).send({ error: 'Body must be a JSON object' });
  }

  const pk = await getPrimaryKey(pool, name);
  const insertBody = { ...body };
  if (pk === 'id' && !insertBody.id) insertBody.id = crypto.randomUUID();

  const cols = Object.keys(insertBody);
  const vals = Object.values(insertBody).map(normalizeTableDataValue);
  const placeholders = cols.map(() => '?').join(', ');
  const colList = cols.map(c => `\`${c}\``).join(', ');

  await pool.query(
    `INSERT INTO \`${name}\` (${colList}) VALUES (${placeholders})`,
    vals
  );

  const [rows] = await pool.query(
    `SELECT * FROM \`${name}\` WHERE \`${pk}\` = ? LIMIT 1`,
    [insertBody[pk] ?? vals[0]]
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

  const pk = await getPrimaryKey(pool, name);
  const insertRows = rows.map(row => {
    const next = { ...row };
    if (pk === 'id' && !next.id) next.id = crypto.randomUUID();
    return next;
  });

  const cols = Object.keys(insertRows[0]);
  const colList = cols.map(c => `\`${c}\``).join(', ');
  const placeholders = `(${cols.map(() => '?').join(', ')})`;
  const allPlaceholders = insertRows.map(() => placeholders).join(', ');
  const allValues = insertRows.flatMap(r => cols.map(c => normalizeTableDataValue(r[c])));

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
  const vals = [...entries.map(([, v]) => normalizeTableDataValue(v)), pkValue];

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
// --- Schema Inspector ---
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

fastify.patch('/catalog-settings', { preHandler: requireSyncKey }, async (req, reply) => {
  const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const [columns] = await pool.query('DESCRIBE catalog_settings');
  const columnNames = new Set(columns.map(column => column.Field));
  const blockedColumns = new Set(['id', 'created_at', 'user_id']);
  const writableEntries = Object.entries(payload).filter(([key]) => (
    columnNames.has(key) && !blockedColumns.has(key)
  ));

  if (writableEntries.length === 0) {
    return reply.code(400).send({ error: 'no writable catalog settings fields provided' });
  }

  const normalizeValue = value => {
    if (value !== null && typeof value === 'object') return JSON.stringify(value);
    return value;
  };

  const [existingRows] = await pool.query('SELECT id FROM catalog_settings LIMIT 1');
  const hasUpdatedAt = columnNames.has('updated_at');
  const quoted = name => `\`${name}\``;

  if (existingRows.length > 0) {
    const setClauses = writableEntries.map(([key]) => `${quoted(key)} = ?`);
    const params = writableEntries.map(([, value]) => normalizeValue(value));
    if (hasUpdatedAt) {
      setClauses.push('`updated_at` = CURRENT_TIMESTAMP');
    }
    params.push(existingRows[0].id);
    await pool.query(`UPDATE catalog_settings SET ${setClauses.join(', ')} WHERE id = ?`, params);
  } else {
    const insertEntries = [...writableEntries];
    if (columnNames.has('id')) insertEntries.unshift(['id', require('crypto').randomUUID()]);
    const insertColumns = insertEntries.map(([key]) => quoted(key));
    const placeholders = insertEntries.map(() => '?');
    const params = insertEntries.map(([, value]) => normalizeValue(value));
    if (hasUpdatedAt) {
      insertColumns.push('`updated_at`');
      placeholders.push('CURRENT_TIMESTAMP');
    }
    await pool.query(
      `INSERT INTO catalog_settings (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      params,
    );
  }

  const [rows] = await pool.query('SELECT * FROM catalog_settings LIMIT 1');
  reply.header('Cache-Control', 'no-store');
  return rows[0] || null;
});

// ─── PDP Section Headers ───────────────────────────────────────────────────
// Lista de frases que viram cabeçalhos com quebra de parágrafo + negrito na PDP.
fastify.get('/pdp-section-headers', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT id, phrase, sort_order, created_at, updated_at
     FROM pdp_section_headers
     ORDER BY sort_order ASC, phrase ASC`
  );
  reply.header('Cache-Control', 'public, max-age=300, s-maxage=600');
  return rows;
});

fastify.post('/pdp-section-headers', { preHandler: requireSyncKey }, async (req, reply) => {
  const { phrase, sort_order } = req.body || {};
  const trimmed = typeof phrase === 'string' ? phrase.trim() : '';
  if (!trimmed) return reply.code(400).send({ error: 'phrase required' });
  if (trimmed.length > 255) return reply.code(400).send({ error: 'phrase too long (max 255)' });
  const id = require('crypto').randomUUID();
  const order = Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0;
  try {
    await pool.query(
      `INSERT INTO pdp_section_headers (id, phrase, sort_order) VALUES (?, ?, ?)`,
      [id, trimmed, order]
    );
    return { id, phrase: trimmed, sort_order: order };
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return reply.code(409).send({ error: 'phrase já existe' });
    }
    throw err;
  }
});

fastify.put('/pdp-section-headers/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const { phrase, sort_order } = req.body || {};
  const updates = [];
  const values = [];
  if (phrase !== undefined) {
    const trimmed = typeof phrase === 'string' ? phrase.trim() : '';
    if (!trimmed) return reply.code(400).send({ error: 'phrase vazia' });
    if (trimmed.length > 255) return reply.code(400).send({ error: 'phrase too long (max 255)' });
    updates.push('phrase = ?'); values.push(trimmed);
  }
  if (sort_order !== undefined && Number.isFinite(Number(sort_order))) {
    updates.push('sort_order = ?'); values.push(Number(sort_order));
  }
  if (updates.length === 0) return reply.code(400).send({ error: 'nothing to update' });
  values.push(req.params.id);
  try {
    const [result] = await pool.query(
      `UPDATE pdp_section_headers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    if (!result.affectedRows) return reply.code(404).send({ error: 'not found' });
    return { ok: true };
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return reply.code(409).send({ error: 'phrase já existe' });
    }
    throw err;
  }
});

fastify.delete('/pdp-section-headers/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const [result] = await pool.query('DELETE FROM pdp_section_headers WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return reply.code(404).send({ error: 'not found' });
  return { ok: true };
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
       IF(r.id IS NULL, NULL, JSON_OBJECT(
         'id',r.id,'zone_id',r.zone_id,'label',r.label,'min_km',r.min_km,'max_km',r.max_km,
         'price',r.price,'estimated_days_min',r.estimated_days_min,'estimated_days_max',r.estimated_days_max
       ))
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
    cities: parsePublicJson(z.cities, []),
    cep_ranges: parsePublicJson(z.cep_ranges, []),
    price_ranges: parsePublicJson(z.price_ranges, []).filter(Boolean),
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
  const locationSync = await reconcileProductStockLocationsToTotal(
    req.params.id,
    p.stock_quantity || 0,
    'product_update',
    'Total de estoque editado no cadastro e reconciliado com os locais.'
  );
  return { ok: true, locationSync };
});

fastify.get('/shipping/price-ranges', async (req, reply) => {
  const zoneId = String(req.query?.zone_id || '').trim();
  if (!zoneId) return reply.code(400).send({ error: 'zone_id obrigatorio' });
  const [rows] = await pool.query(
    'SELECT * FROM shipping_price_ranges WHERE zone_id=? ORDER BY min_km ASC',
    [zoneId]
  );
  reply.header('Cache-Control', 'public, max-age=300');
  return rows;
});

fastify.post('/shipping/price-ranges', { preHandler: requireSyncKey }, async (req, reply) => {
  const r = req.body;
  const id = r.id || require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO shipping_price_ranges
     (id,zone_id,label,min_km,max_km,price,estimated_days_min,estimated_days_max)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id,r.zone_id,r.label,r.min_km??0,r.max_km??null,r.price??0,
     r.estimated_days_min??0,r.estimated_days_max??1]
  );
  return { ok: true, id };
});

fastify.get('/customer/purchases', async (req, reply) => {
  const auth = await getVpsBearerAuthContext(req);
  if (!auth.customerId) return reply.code(401).send({ error: 'Unauthorized' });

  const requestedCustomerId = String(req.query?.customer_id || '').trim();
  const customerId = auth.isAdmin && requestedCustomerId ? requestedCustomerId : auth.customerId;

  const [customers] = await pool.query(
    'SELECT * FROM customers WHERE id = ? LIMIT 1',
    [customerId]
  );
  const customer = customers?.[0] || null;
  if (!customer) return reply.code(404).send({ error: 'Cliente nao encontrado' });

  const [sales] = await pool.query(
    'SELECT * FROM sales WHERE customer_id = ? ORDER BY created_at DESC LIMIT 200',
    [customerId]
  );
  const saleIds = sales.map(row => row.id).filter(Boolean);
  let saleItems = [];
  if (saleIds.length > 0) {
    const [rows] = await pool.query(
      'SELECT * FROM sale_items WHERE sale_id IN (?) ORDER BY created_at ASC',
      [saleIds]
    );
    saleItems = rows;
  }
  const saleItemsBySaleId = new Map();
  for (const item of saleItems) {
    const list = saleItemsBySaleId.get(String(item.sale_id)) || [];
    list.push(item);
    saleItemsBySaleId.set(String(item.sale_id), list);
  }

  const orderConditions = ['customer_id = ?'];
  const orderParams = [customerId];
  if (customer.email) {
    orderConditions.push('LOWER(customer_email) = ?');
    orderParams.push(String(customer.email).toLowerCase());
  }

  const [orders] = await pool.query(
    `SELECT * FROM orders WHERE (${orderConditions.join(' OR ')}) ORDER BY created_at DESC LIMIT 200`,
    orderParams
  );
  const orderIds = orders.map(row => row.id).filter(Boolean);
  let orderItems = [];
  if (orderIds.length > 0) {
    const [rows] = await pool.query(
      'SELECT * FROM order_items WHERE order_id IN (?) ORDER BY created_at ASC',
      [orderIds]
    );
    orderItems = rows;
  }
  const orderItemsByOrderId = new Map();
  for (const item of orderItems) {
    const list = orderItemsByOrderId.get(String(item.order_id)) || [];
    list.push(item);
    orderItemsByOrderId.set(String(item.order_id), list);
  }

  return {
    customer: publicCustomer(customer),
    sales: sales.map(sale => ({
      ...sale,
      items: saleItemsBySaleId.get(String(sale.id)) || [],
      customer: {
        id: String(customer.id),
        name: String(customer.name || ''),
        cpf_cnpj: customer.cpf_cnpj || undefined,
      },
    })),
    orders: orders.map(order => ({
      ...order,
      items: orderItemsByOrderId.get(String(order.id)) || [],
    })),
  };
});

fastify.patch('/shipping/price-ranges/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const r = req.body;
  await pool.query(
    `UPDATE shipping_price_ranges SET
     zone_id=?,label=?,min_km=?,max_km=?,price=?,estimated_days_min=?,estimated_days_max=?
     WHERE id=?`,
    [r.zone_id,r.label,r.min_km??0,r.max_km??null,r.price??0,
     r.estimated_days_min??0,r.estimated_days_max??1,req.params.id]
  );
  return { ok: true };
});

fastify.delete('/shipping/price-ranges/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM shipping_price_ranges WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── Payment Fees ───────────────────────────────────────────────────────────
// Displays Android + Pix PDV
fastify.get('/pdv/displays', { preHandler: requireSyncKey }, async () => {
  const [rows] = await pool.query('SELECT * FROM pdv_displays ORDER BY created_at DESC');
  return rows.map(mapPdvDisplayRow);
});

fastify.post('/pdv/displays', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const name = String(body.name || '').trim();
  if (!name) return reply.code(400).send({ error: 'name obrigatorio' });
  const id = crypto.randomUUID();
  const slug = String(body.slug || name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || id.slice(0, 8);
  const type = ['cashier', 'ads', 'hybrid'].includes(String(body.type)) ? String(body.type) : 'cashier';
  const orientation = ['portrait', 'landscape'].includes(String(body.orientation)) ? String(body.orientation) : 'landscape';
  await pool.query(
    `INSERT INTO pdv_displays
      (id, name, slug, type, orientation, cashier_key, is_active, settings_json, idle_content_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      slug,
      type,
      orientation,
      body.cashier_key ? String(body.cashier_key).trim() : null,
      body.is_active === false ? 0 : 1,
      JSON.stringify(body.settings || {}),
      JSON.stringify(body.idle_content || { banners: [], products: [], messages: [] }),
    ]
  );
  const [rows] = await pool.query('SELECT * FROM pdv_displays WHERE id = ? LIMIT 1', [id]);
  return reply.code(201).send(mapPdvDisplayRow(rows[0]));
});

fastify.patch('/pdv/displays/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const [existingRows] = await pool.query('SELECT * FROM pdv_displays WHERE id = ? LIMIT 1', [req.params.id]);
  if (!existingRows.length) return reply.code(404).send({ error: 'Display nao encontrado' });
  const current = mapPdvDisplayRow(existingRows[0]);
  const type = ['cashier', 'ads', 'hybrid'].includes(String(body.type)) ? String(body.type) : current.type;
  const orientation = ['portrait', 'landscape'].includes(String(body.orientation)) ? String(body.orientation) : current.orientation;
  await pool.query(
    `UPDATE pdv_displays SET
      name = ?, slug = ?, type = ?, orientation = ?, cashier_key = ?, is_active = ?,
      settings_json = ?, idle_content_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      body.name ? String(body.name).trim() : current.name,
      body.slug ? String(body.slug).trim() : current.slug,
      type,
      orientation,
      body.cashier_key === undefined ? current.cashier_key : (body.cashier_key ? String(body.cashier_key).trim() : null),
      body.is_active === undefined ? (current.is_active ? 1 : 0) : (body.is_active ? 1 : 0),
      JSON.stringify(body.settings === undefined ? current.settings : body.settings),
      JSON.stringify(body.idle_content === undefined ? current.idle_content : body.idle_content),
      req.params.id,
    ]
  );
  const [rows] = await pool.query('SELECT * FROM pdv_displays WHERE id = ? LIMIT 1', [req.params.id]);
  return mapPdvDisplayRow(rows[0]);
});

fastify.delete('/pdv/displays/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const [[approved]] = await pool.query(
    'SELECT COUNT(*) AS total FROM pdv_pix_payments WHERE display_id = ? AND status = "approved"',
    [req.params.id]
  );
  if (Number(approved?.total || 0) > 0) {
    return reply.code(409).send({ error: 'Nao e possivel excluir display com Pix aprovado vinculado' });
  }
  await pool.query('DELETE FROM pdv_display_pairing_codes WHERE display_id = ?', [req.params.id]);
  await pool.query('DELETE FROM pdv_display_tokens WHERE display_id = ?', [req.params.id]);
  await pool.query('UPDATE pdv_pix_payments SET display_id = NULL WHERE display_id = ?', [req.params.id]);
  await pool.query('DELETE FROM pdv_displays WHERE id = ?', [req.params.id]);
  return { ok: true };
});

fastify.post('/pdv/displays/:id/pairing-code', { preHandler: requireSyncKey }, async (req, reply) => {
  const [displays] = await pool.query('SELECT id FROM pdv_displays WHERE id = ? LIMIT 1', [req.params.id]);
  if (!displays.length) return reply.code(404).send({ error: 'Display nao encontrado' });
  const code = generatePdvDisplayPairingCode();
  const id = crypto.randomUUID();
  const expiresMinutes = Math.max(5, Number(req.body?.expires_minutes || 30));
  await pool.query(
    `INSERT INTO pdv_display_pairing_codes (id, display_id, code_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [id, req.params.id, hashPdvDisplaySecret(code), expiresMinutes]
  );
  return reply.code(201).send({ id, display_id: req.params.id, code, expires_minutes: expiresMinutes });
});

fastify.post('/pdv/displays/pair', async (req, reply) => {
  const code = normalizePdvDisplayPairingCode(req.body?.code);
  if (!code) return reply.code(400).send({ error: 'codigo invalido' });
  const [codes] = await pool.query(
    `SELECT pc.*, d.is_active
       FROM pdv_display_pairing_codes pc
       JOIN pdv_displays d ON d.id = pc.display_id
      WHERE pc.code_hash = ? AND pc.consumed_at IS NULL AND pc.expires_at > NOW()
      LIMIT 1`,
    [hashPdvDisplaySecret(code)]
  );
  const pairing = codes[0];
  if (!pairing || Number(pairing.is_active) !== 1) return reply.code(404).send({ error: 'Codigo expirado ou invalido' });
  const token = generatePdvDisplayToken();
  const tokenId = crypto.randomUUID();
  await pool.query('UPDATE pdv_display_pairing_codes SET consumed_at = NOW() WHERE id = ?', [pairing.id]);
  await pool.query('UPDATE pdv_display_tokens SET revoked_at = NOW() WHERE display_id = ? AND revoked_at IS NULL', [pairing.display_id]);
  await pool.query(
    'INSERT INTO pdv_display_tokens (id, display_id, token_hash) VALUES (?, ?, ?)',
    [tokenId, pairing.display_id, hashPdvDisplaySecret(token)]
  );
  await pool.query('UPDATE pdv_displays SET paired_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [pairing.display_id]);
  return reply.code(201).send({ display_id: pairing.display_id, token });
});

fastify.post('/pdv/displays/:displayId/revoke-token', { preHandler: requireSyncKey }, async (req) => {
  await pool.query('UPDATE pdv_display_tokens SET revoked_at = NOW() WHERE display_id = ? AND revoked_at IS NULL', [req.params.displayId]);
  await pool.query('UPDATE pdv_displays SET paired_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.displayId]);
  return { ok: true };
});

fastify.post('/pdv/displays/trash/cleanup', { preHandler: requireSyncKey }, async () => {
  const [expiredCodes] = await pool.query(
    'DELETE FROM pdv_display_pairing_codes WHERE consumed_at IS NOT NULL OR expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)'
  );
  const [revokedTokens] = await pool.query(
    'DELETE FROM pdv_display_tokens WHERE revoked_at IS NOT NULL AND revoked_at < DATE_SUB(NOW(), INTERVAL 7 DAY)'
  );
  const [testPix] = await pool.query(
    `DELETE FROM pdv_pix_payments
      WHERE status IN ('pending', 'rejected', 'expired', 'failed')
        AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND (sale_draft_id IS NULL OR sale_draft_id LIKE 'test%')`
  );
  return {
    ok: true,
    deleted: {
      pairing_codes: expiredCodes.affectedRows || 0,
      revoked_tokens: revokedTokens.affectedRows || 0,
      test_pix_payments: testPix.affectedRows || 0,
    },
  };
});

fastify.post('/pdv/pix-payments', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const amount = Math.round(Number(body.amount || body.amount_cents || 0));
  if (!amount || amount <= 0) return reply.code(400).send({ error: 'amount obrigatorio em centavos' });
  const mp = await getPdvMercadoPagoAccessToken();
  if (!mp?.accessToken) return reply.code(400).send({ error: 'Mercado Pago nao configurado' });
  const id = crypto.randomUUID();
  const localReference = String(body.local_reference || `pdv:${id}`);
  const displayId = body.display_id ? String(body.display_id) : null;
  const payload = {
    transaction_amount: Number((amount / 100).toFixed(2)),
    description: String(body.description || 'Venda PDV Mercado do Vale').slice(0, 120),
    payment_method_id: 'pix',
    external_reference: localReference,
    metadata: {
      flow: 'pdv_pix',
      pdv_pix_payment_id: id,
      sale_draft_id: body.sale_draft_id || null,
      cashier_key: body.cashier_key || null,
      display_id: displayId,
    },
    notification_url: 'https://www.mercadodovale.com.br/api/mercadopago-webhook',
    payer: {
      email: String(body.payer_email || 'cliente@mercadodovale.com.br'),
    },
  };
  if (body.expires_at) payload.date_of_expiration = new Date(body.expires_at).toISOString();
  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mp.accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': id,
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    await pool.query(
      `INSERT INTO pdv_pix_payments
        (id, sale_draft_id, local_reference, cashier_key, display_id, amount, status, raw_response_json)
       VALUES (?, ?, ?, ?, ?, ?, 'failed', ?)`,
      [id, body.sale_draft_id || null, localReference, body.cashier_key || null, displayId, amount, JSON.stringify(raw)]
    );
    return reply.code(502).send({ error: 'Falha ao criar Pix Mercado Pago', detail: raw?.message || raw?.error || response.statusText });
  }
  const qr = raw?.point_of_interaction?.transaction_data || {};
  await pool.query(
    `INSERT INTO pdv_pix_payments
      (id, sale_draft_id, local_reference, cashier_key, display_id, mercado_pago_payment_id, amount, status, qr_code, qr_code_base64, ticket_url, raw_response_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      body.sale_draft_id || null,
      localReference,
      body.cashier_key || null,
      displayId,
      raw.id ? String(raw.id) : null,
      amount,
      normalizePdvPixStatus(raw.status),
      qr.qr_code || null,
      qr.qr_code_base64 || null,
      qr.ticket_url || null,
      JSON.stringify(raw),
    ]
  );
  if (displayId) {
    await pool.query('UPDATE pdv_displays SET active_pix_payment_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id, displayId]);
  }
  const [rows] = await pool.query('SELECT * FROM pdv_pix_payments WHERE id = ? LIMIT 1', [id]);
  return reply.code(201).send(buildPdvPixResponse(rows[0]));
});

fastify.get('/pdv/pix-payments/:id/status', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM pdv_pix_payments WHERE id = ? LIMIT 1', [req.params.id]);
  const current = rows[0];
  if (!current) return reply.code(404).send({ error: 'Pix nao encontrado' });
  if (!current.mercado_pago_payment_id) return buildPdvPixResponse(current);
  const mp = await getPdvMercadoPagoAccessToken();
  if (!mp?.accessToken) return reply.code(400).send({ error: 'Mercado Pago nao configurado' });
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(current.mercado_pago_payment_id)}`, {
    headers: { Authorization: `Bearer ${mp.accessToken}` },
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) return reply.code(502).send({ error: 'Falha ao consultar Mercado Pago', detail: raw?.message || raw?.error || response.statusText });
  await pool.query(
    'UPDATE pdv_pix_payments SET status = ?, raw_response_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [normalizePdvPixStatus(raw.status), JSON.stringify(raw), req.params.id]
  );
  const [updatedRows] = await pool.query('SELECT * FROM pdv_pix_payments WHERE id = ? LIMIT 1', [req.params.id]);
  return buildPdvPixResponse(updatedRows[0]);
});

fastify.post('/pdv/displays/:displayId/active-pix', { preHandler: requireSyncKey }, async (req, reply) => {
  const pixPaymentId = String(req.body?.pix_payment_id || '').trim();
  if (!pixPaymentId) return reply.code(400).send({ error: 'pix_payment_id obrigatorio' });
  const [payments] = await pool.query('SELECT id FROM pdv_pix_payments WHERE id = ? LIMIT 1', [pixPaymentId]);
  if (!payments.length) return reply.code(404).send({ error: 'Pix nao encontrado' });
  await pool.query('UPDATE pdv_pix_payments SET display_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.displayId, pixPaymentId]);
  await pool.query('UPDATE pdv_displays SET active_pix_payment_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [pixPaymentId, req.params.displayId]);
  return { ok: true };
});

fastify.delete('/pdv/displays/:displayId/active-pix', { preHandler: requireSyncKey }, async (req) => {
  await pool.query('UPDATE pdv_displays SET active_pix_payment_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.displayId]);
  return { ok: true };
});

fastify.get('/pdv/display-state', async (req, reply) => {
  const token = getBearerToken(req) || String(req.query?.token || '');
  if (!token) return reply.code(401).send({ error: 'Unauthorized' });
  const tokenHash = hashPdvDisplaySecret(token);
  const [tokenRows] = await pool.query(
    `SELECT dt.display_id
       FROM pdv_display_tokens dt
       JOIN pdv_displays d ON d.id = dt.display_id
      WHERE dt.token_hash = ? AND dt.revoked_at IS NULL AND d.is_active = 1
      LIMIT 1`,
    [tokenHash]
  );
  const displayId = tokenRows?.[0]?.display_id;
  if (!displayId) return reply.code(401).send({ error: 'Token revogado ou invalido' });
  await pool.query('UPDATE pdv_display_tokens SET last_seen_at = NOW() WHERE token_hash = ?', [tokenHash]);
  const [displayRows] = await pool.query('SELECT * FROM pdv_displays WHERE id = ? LIMIT 1', [displayId]);
  const display = mapPdvDisplayRow(displayRows[0]);
  let active_pix = null;
  if (display?.active_pix_payment_id) {
    const [pixRows] = await pool.query('SELECT * FROM pdv_pix_payments WHERE id = ? LIMIT 1', [display.active_pix_payment_id]);
    active_pix = buildPdvPixResponse(pixRows[0]);
  }
  return { display, active_pix };
});

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
function mapBannerRow(r) {
  return {
    ...r,
    active: r.active === 1,
    clicks_count: r.clicks_count ?? r.click_count ?? 0,
    views_count: r.views_count ?? r.view_count ?? 0,
  };
}

fastify.get('/banners', async (req, reply) => {
  const where = req.query.active === 'true' ? 'WHERE active=1' : '';
  const [rows] = await pool.query(
    `SELECT * FROM banners ${where} ORDER BY display_order ASC, created_at DESC`
  );
  reply.header('Cache-Control', 'public, max-age=120');
  return rows.map(mapBannerRow);
});

fastify.get('/banners/:id', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM banners WHERE id=?', [req.params.id]);
  if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
  reply.header('Cache-Control', 'no-store');
  return mapBannerRow(rows[0]);
});

fastify.post('/banners', { preHandler: requireSyncKey }, async (req, reply) => {
  const b = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO banners (id,title,image_url,link_url,active,display_order,start_date,end_date)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id,b.title||null,b.image_url||null,b.link_url||b.link_target||null,b.active?1:0,b.display_order||0,b.start_date||null,b.end_date||null]
  );
  const [rows] = await pool.query('SELECT * FROM banners WHERE id=?', [id]);
  return mapBannerRow(rows[0]);
});

fastify.patch('/banners/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const b = req.body;
  const allowedBannerFields = ['title', 'image_url', 'link_url', 'link_target', 'active', 'display_order', 'start_date', 'end_date'];
  const sets = [];
  const params = [];
  for (const field of allowedBannerFields) {
    if (b[field] === undefined) continue;
    if (field === 'link_target') {
      sets.push('link_url=?');
      params.push(b[field] || null);
      continue;
    }
    sets.push(`${field}=?`);
    params.push(field === 'active' ? (b[field] ? 1 : 0) : b[field]);
  }
  if (sets.length > 0) {
    sets.push('updated_at=CURRENT_TIMESTAMP');
    params.push(req.params.id);
    await pool.query(`UPDATE banners SET ${sets.join(', ')} WHERE id=?`, params);
  }
  const [rows] = await pool.query('SELECT * FROM banners WHERE id=?', [req.params.id]);
  if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
  return mapBannerRow(rows[0]);
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

function sanitizeDeliveryTeamMemberPayload(input = {}) {
  const name = String(input.name || '').trim();
  const cpfCnpj = String(input.cpf_cnpj || '').trim();
  const documentDigits = cpfCnpj.replace(/\D/g, '');
  const deliveryFee = input.delivery_fee === undefined || input.delivery_fee === null || input.delivery_fee === ''
    ? undefined
    : Number(input.delivery_fee);

  if (!name) {
    const error = new Error('Nome do entregador e obrigatorio');
    error.statusCode = 400;
    throw error;
  }
  if (![11, 14].includes(documentDigits.length)) {
    const error = new Error('CPF/CNPJ do entregador invalido');
    error.statusCode = 400;
    throw error;
  }
  if (deliveryFee !== undefined && !Number.isFinite(deliveryFee)) {
    const error = new Error('Valor por entrega invalido');
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    name,
    cpf_cnpj: cpfCnpj,
    role: 'delivery',
    employment_type: ['clt', 'freelancer', 'pj'].includes(input.employment_type) ? input.employment_type : 'freelancer',
    hire_date: input.hire_date || new Date().toISOString().slice(0, 10),
    phone: input.phone ? String(input.phone).trim() : undefined,
    pix_key_type: ['cpf', 'phone', 'email', 'random'].includes(input.pix_key_type) ? input.pix_key_type : 'phone',
    pix_key: input.pix_key ? String(input.pix_key).trim() : undefined,
    bank_name: input.bank_name ? String(input.bank_name).trim() : undefined,
    delivery_fee: deliveryFee,
    is_active: true,
    admin_notes: input.admin_notes ? String(input.admin_notes).trim() : undefined,
  };

  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

fastify.post('/team/delivery', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {
  try {
    const payload = sanitizeDeliveryTeamMemberPayload(req.body || {});
    const rows = await vpsDbInsert('team_members', payload);
    const created = Array.isArray(rows) ? rows[0] : rows;
    return reply.code(201).send(created);
  } catch (err) {
    const status = err.statusCode || err.status || 500;
    if (status === 409 || err.body?.code === '23505') {
      return reply.code(409).send({ error: 'Entregador ja cadastrado com este CPF/CNPJ', code: 'DUPLICATE_DELIVERY_PERSON' });
    }
    return reply.code(status >= 400 && status < 600 ? status : 500).send({
      error: err.message || 'Erro ao cadastrar entregador',
      detail: err.body || undefined,
    });
  }
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

function getSynologyRequestPort(urlObj) {
  if (urlObj.port) return parseInt(urlObj.port, 10);
  return urlObj.protocol === 'https:' ? 443 : 80;
}

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

function describeSynologyErrorCode(code) {
  const descriptions = {
    100: 'Unknown error',
    101: 'Missing api, method or version parameter',
    105: 'Session has no permission',
    106: 'Session timeout',
    107: 'Session interrupted by duplicate login',
    119: 'SID not found',
    400: 'Invalid file operation parameter',
    407: 'Operation not permitted',
    408: 'No such file or directory',
    414: 'File already exists',
    415: 'Disk quota exceeded',
    416: 'No space left on device',
    418: 'Illegal name or path',
    1800: 'Missing or mismatched Content-Length',
    1802: 'No filename information in file content',
    1805: 'Cannot overwrite existing file without overwrite parameter',
  };
  return descriptions[Number(code)] || null;
}

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
  const port = getSynologyRequestPort(urlObj);
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
      port: getSynologyRequestPort(urlObj),
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
      port: getSynologyRequestPort(urlObj),
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
    debug: buildCopyableDebug('synology-video-upload', {
      uploadId: id,
      step: 'queued',
      folder,
      fileName,
      cdnUrl: url,
    }),
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
    debug: job.debug || null,
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
  const synologyPort = getSynologyRequestPort(new URL(SYNO_URL));
  const synologyHost = (() => {
    try {
      const parsed = new URL(SYNO_URL);
      return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
    } catch {
      return 'invalid-synology-url';
    }
  })();

  // ── Responde 200 IMEDIATAMENTE (evita timeout 524 do Cloudflare) ──────────
  reply.code(200).send({ ok: true, uploadId: uploadJob.id, status: uploadJob.status, name: fileName, url: cdnUrl, debug: uploadJob.debug });

  // ── Upload ao Synology em background (sem bloquear o cliente) ─────────────
  setImmediate(async () => {
    try {
      updateSynologyUploadStatus(uploadJob.id, {
        status: 'uploading',
        progress: 95,
        message: 'Enviando arquivo ao Synology',
        debug: buildCopyableDebug('synology-video-upload', {
          uploadId: uploadJob.id,
          step: 'synology_request',
          folder,
          folderPath,
          fileName,
          fileSizeBytes: fileBuf.length,
          synologyHost,
          synologyPort,
          cdnUrl,
        }),
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
      const uploadPath = `/webapi/entry.cgi?_sid=${encodeURIComponent(sid)}`;
      const result = await new Promise((resolve, reject) => {
        const options = {
          hostname: urlObj.hostname, port: getSynologyRequestPort(urlObj),
          path: uploadPath, method: 'POST', rejectUnauthorized: false,
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
        if (folder === 'videos') {
          const videoCacheKey = path.parse(fileName).name.trim().replace(/\s+/g, '').toUpperCase();
          if (videoCacheKey) {
            videoExistenceCache.set(videoCacheKey, { exists: true, url: cdnUrl, cachedAt: Date.now() });
          }
        }
        updateSynologyUploadStatus(uploadJob.id, {
          status: 'success',
          progress: 100,
          message: 'Upload concluido no Synology',
          debug: buildCopyableDebug('synology-video-upload', {
            uploadId: uploadJob.id,
            step: 'synology_success',
            folder,
            folderPath,
            fileName,
            fileSizeBytes: fileBuf.length,
            synologyHost,
            synologyPort,
            cdnUrl,
          }),
        });
        console.log(`[synology] Upload OK: ${folderPath}/${fileName}`);
      } else {
        const synologyError = result && typeof result === 'object' ? result.error || result : result;
        const synologyErrorDescription = synologyError && typeof synologyError === 'object'
          ? describeSynologyErrorCode(synologyError.code)
          : null;
        updateSynologyUploadStatus(uploadJob.id, {
          status: 'error',
          progress: 100,
          message: 'Synology recusou o upload',
          error: 'Synology upload failed',
          detail: JSON.stringify(synologyError),
          debug: buildCopyableDebug('synology-video-upload', {
            uploadId: uploadJob.id,
            step: 'synology_rejected',
            folder,
            folderPath,
            fileName,
            fileSizeBytes: fileBuf.length,
            synologyHost,
            synologyPort,
            cdnUrl,
            synologyError,
            synologyErrorDescription,
          }),
        });
        console.error(`[synology] Upload FAILED: ${fileName}`, result.error);
      }
    } catch (err) {
      updateSynologyUploadStatus(uploadJob.id, {
        status: 'error',
        progress: 100,
        message: 'Erro ao enviar ao Synology',
        error: err.message,
        debug: buildCopyableDebug('synology-video-upload', {
          uploadId: uploadJob.id,
          step: 'synology_exception',
          folder,
          folderPath,
          fileName,
          fileSizeBytes: fileBuf?.length || 0,
          synologyHost,
          synologyPort,
          cdnUrl,
          exception: { name: err?.name || 'Error', message: err?.message || String(err) },
        }),
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

async function addIndexIfMissing(table, indexName, column) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  if (Number(row.cnt) === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (\`${column}\`)`);
    console.log(`[migration] Added index ${table}.${indexName}`);
  } else {
    console.log(`[migration] index ${table}.${indexName} already exists - skip`);
  }
}

async function addUniqueIndexIfMissing(table, indexName, column) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  if (Number(row.cnt) === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${indexName}\` (\`${column}\`)`);
    console.log(`[migration] Added unique index ${table}.${indexName}`);
  } else {
    console.log(`[migration] unique index ${table}.${indexName} already exists - skip`);
  }
}

async function dropIndexIfExists(table, indexName) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  if (Number(row.cnt) > 0) {
    await pool.query(`ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``);
    console.log(`[migration] Dropped index ${table}.${indexName}`);
  } else {
    console.log(`[migration] index ${table}.${indexName} not found - skip`);
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

const DEFAULT_EMAIL_TEMPLATES = [
  {
    id: 'email-order-success',
    slug: 'order_success',
    name: 'Compra realizada com sucesso',
    category: 'sales',
    trigger_key: 'order_success',
    subject: 'Recebemos seu pedido #{pedido_numero}',
    preheader: 'Seu pedido foi registrado e ja esta em processamento.',
    html_body: '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;"><h1>Pedido confirmado</h1><p>Ola, {{cliente_nome}}.</p><p>Recebemos sua compra <strong>#{{pedido_numero}}</strong> no valor de <strong>{{pedido_total}}</strong>.</p><p>{{pedido_itens}}</p><p><a href="{{pedido_link}}">Ver pedido</a></p></div>',
    text_body: 'Ola, {{cliente_nome}}. Recebemos sua compra #{{pedido_numero}} no valor de {{pedido_total}}. Acompanhe: {{pedido_link}}',
    variables: ['{{cliente_nome}}', '{{pedido_numero}}', '{{pedido_total}}', '{{pedido_itens}}', '{{pedido_link}}'],
  },
  {
    id: 'email-promotions',
    slug: 'promotions',
    name: 'Promocoes',
    category: 'marketing',
    trigger_key: 'promotions',
    subject: '{{promocao_titulo}} no Mercado do Vale',
    preheader: 'Ofertas selecionadas para voce.',
    html_body: '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;"><h1>{{promocao_titulo}}</h1><p>{{promocao_descricao}}</p><p><a href="{{promocao_link}}">Ver ofertas</a></p><p>Valido ate {{promocao_validade}}.</p></div>',
    text_body: '{{promocao_titulo}} - {{promocao_descricao}} Ver ofertas: {{promocao_link}}',
    variables: ['{{cliente_nome}}', '{{promocao_titulo}}', '{{promocao_descricao}}', '{{promocao_link}}', '{{promocao_validade}}'],
  },
  {
    id: 'email-new-items',
    slug: 'new_items',
    name: 'Itens novos',
    category: 'catalog',
    trigger_key: 'new_items',
    subject: 'Novidades chegaram ao Mercado do Vale',
    preheader: 'Confira os produtos que acabaram de entrar.',
    html_body: '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;"><h1>Novidades na loja</h1><p>Ola, {{cliente_nome}}.</p><p>Separamos os itens novos que chegaram hoje:</p><div>{{produtos_novos}}</div><p><a href="{{catalogo_link}}">Abrir catalogo</a></p></div>',
    text_body: 'Novidades na loja: {{produtos_novos}}. Veja o catalogo: {{catalogo_link}}',
    variables: ['{{cliente_nome}}', '{{produtos_novos}}', '{{catalogo_link}}'],
  },
  {
    id: 'email-password-reset',
    slug: 'password_reset',
    name: 'Recuperacao de senha',
    category: 'auth',
    trigger_key: 'password_reset',
    subject: 'Redefinicao de senha - Mercado do Vale',
    preheader: 'Use o link para criar uma nova senha.',
    html_body: '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;"><p>Ola, {{cliente_nome}}.</p><p>Recebemos uma solicitacao para redefinir sua senha no Mercado do Vale.</p><p><a href="{{reset_link}}">Clique aqui para criar uma nova senha</a>.</p><p>Este link expira em {{expira_em_minutos}} minutos.</p><p>Se voce nao solicitou esta alteracao, ignore este e-mail.</p></div>',
    text_body: 'Ola, {{cliente_nome}}. Use este link para criar uma nova senha: {{reset_link}}.',
    variables: ['{{cliente_nome}}', '{{reset_link}}', '{{expira_em_minutos}}'],
  },
  {
    id: 'email-password-changed',
    slug: 'password_changed',
    name: 'Senha alterada',
    category: 'auth',
    trigger_key: 'password_changed',
    subject: 'Senha alterada - Mercado do Vale',
    preheader: 'Aviso de seguranca da sua conta.',
    html_body: '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;"><p>Ola, {{cliente_nome}}.</p><p>Sua senha do Mercado do Vale foi alterada com sucesso.</p><p>Se foi voce, nenhuma acao adicional e necessaria. Para entrar novamente, acesse <a href="{{login_link}}">o login da sua conta</a>.</p><p>Se voce nao fez esta alteracao, entre em contato com a loja imediatamente.</p></div>',
    text_body: 'Ola, {{cliente_nome}}. Sua senha foi alterada. Se nao foi voce, entre em contato com a loja imediatamente.',
    variables: ['{{cliente_nome}}', '{{login_link}}'],
  },
  {
    id: 'email-registration-confirmation',
    slug: 'registration_confirmation',
    name: 'Confirmacao de cadastro',
    category: 'auth',
    trigger_key: 'registration_confirmation',
    subject: 'Confirme seu cadastro no Mercado do Vale',
    preheader: 'Falta pouco para ativar sua conta.',
    html_body: '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;"><p>Ola, {{cliente_nome}}.</p><p>Para confirmar seu cadastro no Mercado do Vale, clique no link abaixo:</p><p><a href="{{confirmacao_link}}">Confirmar cadastro</a></p><p>Se voce nao criou esta conta, ignore este e-mail.</p></div>',
    text_body: 'Ola, {{cliente_nome}}. Confirme seu cadastro: {{confirmacao_link}}',
    variables: ['{{cliente_nome}}', '{{confirmacao_link}}'],
  },
];

async function seedDefaultEmailTemplates() {
  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    await pool.query(
      `INSERT INTO email_templates
        (id, slug, name, category, trigger_key, subject, preheader, html_body, text_body, variables, active, is_system)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
       ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        category = VALUES(category),
        trigger_key = VALUES(trigger_key),
        variables = VALUES(variables),
        is_system = 1`,
      [
        template.id,
        template.slug,
        template.name,
        template.category,
        template.trigger_key,
        template.subject,
        template.preheader,
        template.html_body,
        template.text_body,
        JSON.stringify(template.variables),
      ]
    );
  }
}

async function getDefaultCompanyIdForCatalog() {
  try {
    const [rows] = await pool.query(
      "SELECT id FROM companies WHERE slug = 'mercado-do-vale' LIMIT 1"
    );
    if (rows?.[0]?.id) return rows[0].id;
  } catch (error) {
    console.warn('[migration] default company lookup by slug failed:', error.message);
  }

  try {
    const [rows] = await pool.query('SELECT id FROM companies LIMIT 1');
    if (rows?.[0]?.id) return rows[0].id;
  } catch (error) {
    console.warn('[migration] fallback company lookup failed:', error.message);
  }

  return '9717131e-7b14-4aec-84a4-4317c0489985';
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_combos (
      id CHAR(36) PRIMARY KEY,
      combo_product_id CHAR(36) NOT NULL,
      child_product_id CHAR(36) NOT NULL,
      quantity INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_product_combos_combo (combo_product_id),
      INDEX idx_product_combos_child (child_product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_views (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      product_id CHAR(36) NOT NULL,
      customer_id VARCHAR(255) NULL,
      session_id VARCHAR(255) NULL,
      viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_product_views_product (product_id, viewed_at)
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
  await addColumnIfMissing('product_combos', 'component_type',    "VARCHAR(32) NOT NULL DEFAULT 'fixed'");
  await addColumnIfMissing('product_combos', 'group_key',         'VARCHAR(120) DEFAULT NULL');
  await addColumnIfMissing('product_combos', 'parent_product_id', 'CHAR(36) DEFAULT NULL');
  await addColumnIfMissing('product_combos', 'group_label',       'VARCHAR(255) DEFAULT NULL');

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
    CREATE TABLE IF NOT EXISTS email_templates (
      id VARCHAR(80) PRIMARY KEY,
      slug VARCHAR(120) NOT NULL UNIQUE,
      name VARCHAR(160) NOT NULL,
      category VARCHAR(40) NOT NULL DEFAULT 'custom',
      trigger_key VARCHAR(120) NULL,
      subject VARCHAR(255) NOT NULL,
      preheader VARCHAR(255) NULL,
      html_body MEDIUMTEXT NOT NULL,
      text_body TEXT NULL,
      variables JSON NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      is_system TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email_templates_category (category),
      INDEX idx_email_templates_trigger (trigger_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await seedDefaultEmailTemplates();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS autoresponder_settings (
      id INT PRIMARY KEY,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      human_message_in_hours TEXT NULL,
      human_message_out_of_hours TEXT NULL,
      human_pause_minutes INT NOT NULL DEFAULT 60,
      manual_finish_pause_days INT NOT NULL DEFAULT 30,
      response_tone_mode VARCHAR(16) NOT NULL DEFAULT 'auto_abc',
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
      conversation_flow_keywords JSON NULL,
      conversation_flow_messages JSON NULL,
      signature_enabled TINYINT(1) NOT NULL DEFAULT 1,
      signature_message TEXT NULL,
      ai_daily_limit INT NOT NULL DEFAULT 0,
      ai_monthly_limit INT NOT NULL DEFAULT 0,
      ai_credit_balance_usd DECIMAL(12,6) NOT NULL DEFAULT 0,
      ai_credit_alert_usd DECIMAL(12,6) NOT NULL DEFAULT 5,
      ai_input_cost_per_1m_usd DECIMAL(12,6) NOT NULL DEFAULT 0,
      ai_output_cost_per_1m_usd DECIMAL(12,6) NOT NULL DEFAULT 0,
      ai_conversation_memory_enabled TINYINT(1) NOT NULL DEFAULT 1,
      ai_conversation_memory_limit INT NOT NULL DEFAULT 20,
      ai_conversation_memory_days INT NOT NULL DEFAULT 7,
      ai_context_memory TEXT NULL,
      openai_admin_api_key TEXT NULL,
      archive_to_synology TINYINT(1) NOT NULL DEFAULT 1,
      archive_after_days INT NOT NULL DEFAULT 7,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await addColumnIfMissing('autoresponder_settings', 'signature_enabled', 'TINYINT(1) NOT NULL DEFAULT 1');
  await addColumnIfMissing('autoresponder_settings', 'manual_finish_pause_days', 'INT NOT NULL DEFAULT 30');
  await addColumnIfMissing('autoresponder_settings', 'response_tone_mode', "VARCHAR(16) NOT NULL DEFAULT 'auto_abc'");
  await addColumnIfMissing('autoresponder_settings', 'signature_message', 'TEXT NULL');
  await addColumnIfMissing('autoresponder_settings', 'ai_enabled', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing('autoresponder_settings', 'ai_model', "VARCHAR(80) NOT NULL DEFAULT 'gpt-5-nano'");
  await addColumnIfMissing('autoresponder_settings', 'openai_api_key', 'TEXT NULL');
  await addColumnIfMissing('autoresponder_settings', 'ai_daily_limit', 'INT NOT NULL DEFAULT 0');
  await addColumnIfMissing('autoresponder_settings', 'ai_monthly_limit', 'INT NOT NULL DEFAULT 0');
  await addColumnIfMissing('autoresponder_settings', 'ai_credit_balance_usd', 'DECIMAL(12,6) NOT NULL DEFAULT 0');
  await addColumnIfMissing('autoresponder_settings', 'ai_credit_alert_usd', 'DECIMAL(12,6) NOT NULL DEFAULT 5');
  await addColumnIfMissing('autoresponder_settings', 'ai_input_cost_per_1m_usd', 'DECIMAL(12,6) NOT NULL DEFAULT 0');
  await addColumnIfMissing('autoresponder_settings', 'ai_output_cost_per_1m_usd', 'DECIMAL(12,6) NOT NULL DEFAULT 0');
  await addColumnIfMissing('autoresponder_settings', 'ai_conversation_memory_enabled', 'TINYINT(1) NOT NULL DEFAULT 1');
  await addColumnIfMissing('autoresponder_settings', 'ai_conversation_memory_limit', 'INT NOT NULL DEFAULT 20');
  await addColumnIfMissing('autoresponder_settings', 'ai_conversation_memory_days', 'INT NOT NULL DEFAULT 7');
  await addColumnIfMissing('autoresponder_settings', 'ai_context_memory', 'TEXT NULL');
  await addColumnIfMissing('autoresponder_settings', 'openai_admin_api_key', 'TEXT NULL');
  await addColumnIfMissing('autoresponder_settings', 'conversation_flow_keywords', 'JSON NULL');
  await addColumnIfMissing('autoresponder_settings', 'conversation_flow_messages', 'JSON NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS autoresponder_ai_training (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(120) NOT NULL,
      training_type ENUM('store_instruction','faq','category_guidance','policy') NOT NULL DEFAULT 'store_instruction',
      keywords TEXT NULL,
      content TEXT NOT NULL,
      priority INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ai_training_active_priority (active, priority, id),
      INDEX idx_ai_training_type (training_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await addColumnIfMissing('autoresponder_ai_training', 'keywords', 'TEXT NULL');

  await pool.query(`
    INSERT IGNORE INTO autoresponder_settings (
      id,
      enabled,
      human_message_in_hours,
      human_message_out_of_hours,
      auto_pause_fallback_message,
      greeting_prefix,
      fallback_message,
      signature_enabled,
      signature_message,
      product_tag_keywords,
      conversation_flow_keywords,
      conversation_flow_messages
    ) VALUES (
      1,
      0,
      '${AUTORESPONDER_DEFAULT_HUMAN_IN_HOURS}',
      '${AUTORESPONDER_DEFAULT_HUMAN_OUT_OF_HOURS}',
      '${AUTORESPONDER_DEFAULT_AUTO_PAUSE_MESSAGE}',
      'Ola!',
      '${AUTORESPONDER_DEFAULT_FALLBACK_MESSAGE}',
      1,
      '${AUTORESPONDER_DEFAULT_SIGNATURE_MESSAGE}',
      JSON_OBJECT(),
      '${jsonStr(AUTORESPONDER_DEFAULT_CONVERSATION_FLOW_KEYWORDS)}',
      '${jsonStr(AUTORESPONDER_DEFAULT_CONVERSATION_FLOW_MESSAGES)}'
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
      next_state JSON NULL,
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
  await addColumnIfMissing('autoresponder_rules', 'next_state', 'JSON NULL');

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
    CREATE TABLE IF NOT EXISTS autoresponder_attendants (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_autoresponder_attendants_active_name (active, name)
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
      ai_assisted TINYINT(1) NOT NULL DEFAULT 0,
      ai_model VARCHAR(80) NULL,
      ai_input_tokens INT NULL,
      ai_output_tokens INT NULL,
      ai_estimated_cost_usd DECIMAL(14,8) NULL,
      is_group TINYINT(1) NOT NULL DEFAULT 0,
      INDEX idx_created (created_at),
      INDEX idx_unmatched (matched_count, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await addColumnIfMissing('autoresponder_logs', 'ai_assisted', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing('autoresponder_logs', 'ai_model', 'VARCHAR(80) NULL');
  await addColumnIfMissing('autoresponder_logs', 'ai_input_tokens', 'INT NULL');
  await addColumnIfMissing('autoresponder_logs', 'ai_output_tokens', 'INT NULL');
  await addColumnIfMissing('autoresponder_logs', 'ai_estimated_cost_usd', 'DECIMAL(14,8) NULL');

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
      reply_count INT NOT NULL DEFAULT 0,
      reply_window_started_at TIMESTAMP NULL,
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
      attendant_name VARCHAR(120) NULL,
      attendant_updated_at TIMESTAMP NULL,
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
  await addColumnIfMissing('autoresponder_conversations', 'reply_count', 'INT NOT NULL DEFAULT 0');
  await addColumnIfMissing('autoresponder_conversations', 'reply_window_started_at', 'TIMESTAMP NULL');
  await addColumnIfMissing('autoresponder_conversations', 'attendant_name', 'VARCHAR(120) NULL');
  await addColumnIfMissing('autoresponder_conversations', 'attendant_updated_at', 'TIMESTAMP NULL');
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

  const defaultCompanyId = await getDefaultCompanyIdForCatalog();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalog_sections (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id CHAR(36) NOT NULL,
      section_type VARCHAR(40) NOT NULL DEFAULT 'custom',
      title VARCHAR(255) NOT NULL,
      subtitle TEXT NULL,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      display_order INT NOT NULL DEFAULT 0,
      max_products INT NOT NULL DEFAULT 8,
      layout_style VARCHAR(40) NOT NULL DEFAULT 'grid',
      show_view_all TINYINT(1) NOT NULL DEFAULT 1,
      view_all_url VARCHAR(500) NULL,
      filter_categories JSON NULL,
      filter_brands JSON NULL,
      filter_min_price DECIMAL(12,2) NULL,
      filter_max_price DECIMAL(12,2) NULL,
      filter_tags JSON NULL,
      pinned_product_ids JSON NULL,
      sort_by VARCHAR(80) NOT NULL DEFAULT 'updated_at',
      sort_direction VARCHAR(10) NOT NULL DEFAULT 'desc',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_catalog_sections_user_type_title (user_id, section_type, title),
      INDEX idx_catalog_sections_enabled_order (is_enabled, display_order),
      INDEX idx_catalog_sections_user_order (user_id, display_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(
    `INSERT IGNORE INTO catalog_sections
      (id, user_id, section_type, title, subtitle, is_enabled, display_order, max_products, layout_style, show_view_all, view_all_url, sort_by, sort_direction)
     VALUES
      (UUID(), ?, 'recent', 'Mais Recentes', 'Produtos adicionados recentemente', 1, 10, 8, 'grid', 1, '/produtos/mais-recentes', 'updated_at', 'desc'),
      (UUID(), ?, 'featured', 'Destaques', 'Produtos em destaque', 1, 20, 8, 'grid', 1, '/produtos/destaques', 'updated_at', 'desc'),
      (UUID(), ?, 'bestsellers', 'Mais Vendidos', 'Os produtos mais populares', 1, 30, 8, 'grid', 1, NULL, 'sales_count', 'desc')`,
    [defaultCompanyId, defaultCompanyId, defaultCompanyId]
  );
  console.log('[migration] catalog_sections table: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS custom_fields (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      company_id CHAR(36) NOT NULL,
      \`key\` VARCHAR(120) NOT NULL,
      label VARCHAR(255) NOT NULL,
      category VARCHAR(40) NOT NULL DEFAULT 'spec',
      field_type VARCHAR(40) NOT NULL DEFAULT 'text',
      options JSON NULL,
      validation JSON NULL,
      placeholder VARCHAR(255) NULL,
      help_text TEXT NULL,
      table_config JSON NULL,
      is_system TINYINT(1) NOT NULL DEFAULT 0,
      display_order INT NOT NULL DEFAULT 999,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_custom_fields_company_key (company_id, \`key\`),
      INDEX idx_custom_fields_company (company_id),
      INDEX idx_custom_fields_category (category),
      INDEX idx_custom_fields_order (display_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(
    `INSERT IGNORE INTO custom_fields
      (id, company_id, \`key\`, label, category, field_type, options, validation, placeholder, is_system, display_order)
     VALUES
      (UUID(), ?, 'category_id', 'Categoria', 'basic', 'select', JSON_ARRAY(), JSON_OBJECT(), NULL, 1, 1),
      (UUID(), ?, 'brand', 'Marca', 'basic', 'text', JSON_ARRAY(), JSON_OBJECT(), NULL, 1, 2),
      (UUID(), ?, 'model', 'Modelo', 'basic', 'text', JSON_ARRAY(), JSON_OBJECT(), NULL, 1, 3),
      (UUID(), ?, 'name', 'Nome do Produto', 'basic', 'text', JSON_ARRAY(), JSON_OBJECT(), NULL, 1, 4),
      (UUID(), ?, 'sku', 'SKU', 'basic', 'text', JSON_ARRAY(), JSON_OBJECT(), NULL, 1, 5),
      (UUID(), ?, 'description', 'Descricao', 'basic', 'textarea', JSON_ARRAY(), JSON_OBJECT(), NULL, 1, 6),
      (UUID(), ?, 'color', 'Cor', 'spec', 'text', JSON_ARRAY(), JSON_OBJECT(), 'Ex: Preto, Azul', 1, 11),
      (UUID(), ?, 'storage', 'Armazenamento', 'spec', 'text', JSON_ARRAY(), JSON_OBJECT(), 'Ex: 128GB, 256GB', 1, 12),
      (UUID(), ?, 'ram', 'RAM', 'spec', 'text', JSON_ARRAY(), JSON_OBJECT(), 'Ex: 4GB, 8GB', 1, 13),
      (UUID(), ?, 'battery_health', 'Saude da Bateria', 'spec', 'number', JSON_ARRAY(), JSON_OBJECT(), '0-100%', 1, 15),
      (UUID(), ?, 'battery_mah', 'Bateria (mAh)', 'spec', 'number', JSON_ARRAY(), JSON_OBJECT(), 'Ex: 5000', 1, 16),
      (UUID(), ?, 'display', 'Display (pol)', 'spec', 'number', JSON_ARRAY(), JSON_OBJECT(), 'Ex: 6.7', 1, 17),
      (UUID(), ?, 'price_cost', 'Preco de Custo', 'price', 'number', JSON_ARRAY(), JSON_OBJECT(), NULL, 1, 18),
      (UUID(), ?, 'price_retail', 'Preco Varejo', 'price', 'number', JSON_ARRAY(), JSON_OBJECT(), NULL, 1, 19),
      (UUID(), ?, 'price_reseller', 'Preco Revenda', 'price', 'number', JSON_ARRAY(), JSON_OBJECT(), NULL, 1, 20),
      (UUID(), ?, 'price_wholesale', 'Preco Atacado', 'price', 'number', JSON_ARRAY(), JSON_OBJECT(), NULL, 1, 21)`,
    Array(16).fill(defaultCompanyId)
  );
  console.log('[migration] custom_fields table: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS models (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      company_id CHAR(36) NOT NULL,
      brand_id CHAR(36) NOT NULL,
      category_id CHAR(36) NULL,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      description LONGTEXT NULL,
      template_values JSON NULL,
      eans JSON NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_models_company_brand_slug (company_id, brand_id, slug),
      INDEX idx_models_company_name (company_id, name),
      INDEX idx_models_brand_id (brand_id),
      INDEX idx_models_category_id (category_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await addColumnIfMissing('models', 'company_id', 'CHAR(36) NULL');
  await addColumnIfMissing('models', 'brand_id', 'CHAR(36) NULL');
  await addColumnIfMissing('models', 'category_id', 'CHAR(36) NULL');
  await addColumnIfMissing('models', 'slug', 'VARCHAR(255) NULL');
  await addColumnIfMissing('models', 'description', 'LONGTEXT NULL');
  await addColumnIfMissing('models', 'template_values', 'JSON NULL');
  await addColumnIfMissing('models', 'eans', 'JSON NULL');
  await addColumnIfMissing('models', 'active', 'TINYINT(1) NOT NULL DEFAULT 1');
  await addColumnIfMissing('models', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('models', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await addIndexIfMissing('models', 'idx_models_brand_id', 'brand_id');
  await addIndexIfMissing('models', 'idx_models_category_id', 'category_id');
  console.log('[migration] models table: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cashback_settings (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      coins_per_real DECIMAL(10,2) NOT NULL DEFAULT 1,
      min_purchase_for_coins DECIMAL(10,2) NOT NULL DEFAULT 0,
      coins_to_brl_rate DECIMAL(10,2) NOT NULL DEFAULT 100,
      max_redeem_percent DECIMAL(10,2) NOT NULL DEFAULT 20,
      min_coins_to_redeem INT NOT NULL DEFAULT 100,
      coins_per_referral_purchase INT NULL,
      referral_coins_per_real DECIMAL(10,4) NOT NULL DEFAULT 0.5000,
      review_coins INT NOT NULL DEFAULT 0,
      checkin_base_coins INT NOT NULL DEFAULT 1,
      checkin_streak_milestones JSON NOT NULL,
      coins_expire_after_days INT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(
    `INSERT IGNORE INTO cashback_settings
      (id, coins_per_real, min_purchase_for_coins, coins_to_brl_rate, max_redeem_percent, min_coins_to_redeem, referral_coins_per_real, review_coins, checkin_base_coins, checkin_streak_milestones, active)
     VALUES
      ('00000000-0000-4000-8000-000000000001', 1, 0, 100, 20, 100, 0.5, 0, 1, JSON_ARRAY(JSON_OBJECT('day', 7, 'bonus', 10), JSON_OBJECT('day', 14, 'bonus', 20), JSON_OBJECT('day', 30, 'bonus', 50)), 1)`
  );
  console.log('[migration] cashback_settings table: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coin_balances (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_id CHAR(36) NOT NULL,
      balance INT NOT NULL DEFAULT 0,
      lifetime_earned INT NOT NULL DEFAULT 0,
      lifetime_spent INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_coin_balances_customer (customer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coin_transactions (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_id CHAR(36) NOT NULL,
      amount INT NOT NULL,
      type VARCHAR(40) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'completed',
      description TEXT NULL,
      reference_id CHAR(36) NULL,
      reference_type VARCHAR(40) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_coin_transactions_customer_created (customer_id, created_at),
      INDEX idx_coin_transactions_reference (reference_type, reference_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkin_logs (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_id CHAR(36) NOT NULL,
      checkin_date DATE NOT NULL,
      coins_earned INT NOT NULL DEFAULT 0,
      streak_day INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_checkin_logs_customer_date (customer_id, checkin_date),
      INDEX idx_checkin_logs_customer_date (customer_id, checkin_date),
      INDEX idx_checkin_logs_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_reviews (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      product_id CHAR(36) NOT NULL,
      customer_id CHAR(36) NOT NULL,
      rating INT NOT NULL,
      review_text TEXT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      admin_reply TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_product_reviews_product_status (product_id, status),
      INDEX idx_product_reviews_customer (customer_id),
      INDEX idx_product_reviews_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] public catalog support tables: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS model_color_images (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      company_id CHAR(36) NULL,
      model_id CHAR(36) NOT NULL,
      color_id CHAR(36) NOT NULL,
      images JSON NULL,
      image_url TEXT NULL,
      display_order INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_model_color_images_company_model_color (company_id, model_id, color_id),
      INDEX idx_model_color_images_company (company_id),
      INDEX idx_model_color_images_model (model_id),
      INDEX idx_model_color_images_color (color_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] model_color_images table: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_deposits (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      company_id CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(120) NOT NULL,
      type VARCHAR(40) NOT NULL DEFAULT 'warehouse',
      cep VARCHAR(20) NULL,
      address TEXT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_stock_deposits_company_code (company_id, code),
      INDEX idx_stock_deposits_company_id (company_id),
      INDEX idx_stock_deposits_active (company_id, is_active),
      INDEX idx_stock_deposits_default (company_id, is_default)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_locations (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      company_id CHAR(36) NOT NULL,
      deposit_id CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(120) NOT NULL,
      description TEXT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_stock_locations_deposit_code (deposit_id, code),
      INDEX idx_stock_locations_company_id (company_id),
      INDEX idx_stock_locations_deposit_id (deposit_id),
      INDEX idx_stock_locations_active (deposit_id, is_active),
      INDEX idx_stock_locations_default (deposit_id, is_default)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await dropIndexIfExists('stock_locations', 'uniq_stock_locations_deposit_code');
  const [[stockLocationCodeIndex]] = await pool.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_locations' AND INDEX_NAME = 'idx_stock_locations_deposit_code'`
  );
  if (Number(stockLocationCodeIndex.cnt) === 0) {
    await pool.query('ALTER TABLE `stock_locations` ADD INDEX `idx_stock_locations_deposit_code` (`deposit_id`, `code`)');
    console.log('[migration] Added index stock_locations.idx_stock_locations_deposit_code');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_stock_locations (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      company_id CHAR(36) NOT NULL,
      product_id CHAR(36) NOT NULL,
      deposit_id CHAR(36) NOT NULL,
      location_id CHAR(36) NOT NULL,
      quantity INT NOT NULL DEFAULT 0,
      reserved_quantity INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_product_stock_location (product_id, deposit_id, location_id),
      INDEX idx_product_stock_locations_company_id (company_id),
      INDEX idx_product_stock_locations_product_id (product_id),
      INDEX idx_product_stock_locations_deposit_id (deposit_id),
      INDEX idx_product_stock_locations_location_id (location_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_location_movements (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      company_id CHAR(36) NOT NULL,
      product_id CHAR(36) NOT NULL,
      from_deposit_id CHAR(36) NULL,
      from_location_id CHAR(36) NULL,
      to_deposit_id CHAR(36) NULL,
      to_location_id CHAR(36) NULL,
      quantity INT NOT NULL,
      movement_type VARCHAR(40) NOT NULL,
      reason VARCHAR(255) NOT NULL DEFAULT 'inventory',
      reference_type VARCHAR(80) NULL,
      reference_id CHAR(36) NULL,
      previous_from_quantity INT NULL,
      new_from_quantity INT NULL,
      previous_to_quantity INT NULL,
      new_to_quantity INT NULL,
      notes TEXT NULL,
      created_by CHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_stock_location_movements_company_id (company_id),
      INDEX idx_stock_location_movements_product_id (product_id),
      INDEX idx_stock_location_movements_created_at (created_at),
      INDEX idx_stock_location_movements_reference (reference_type, reference_id),
      INDEX idx_stock_location_movements_from_location (from_location_id),
      INDEX idx_stock_location_movements_to_location (to_location_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await seedDefaultStockLocations();
  await backfillProductStockLocations();
  console.log('[migration] stock location tables: OK');

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
      deposit_id      CHAR(36) NULL,
      location_id     CHAR(36) NULL,
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
      INDEX idx_units_status     (status),
      INDEX idx_units_deposit_id (deposit_id),
      INDEX idx_units_location_id (location_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await addColumnIfMissing('units', 'product_id', 'CHAR(36) NULL');
  await addColumnIfMissing('units', 'imei_1', 'VARCHAR(20) NULL');
  await addColumnIfMissing('units', 'imei_2', 'VARCHAR(20) NULL');
  await addColumnIfMissing('units', 'serial', 'VARCHAR(100) NULL');
  await addColumnIfMissing('units', 'status', "VARCHAR(20) NOT NULL DEFAULT 'available'");
  await addColumnIfMissing('units', 'condition', "VARCHAR(20) NOT NULL DEFAULT 'new'");
  await addColumnIfMissing('units', 'internal_notes', 'TEXT NULL');
  await addColumnIfMissing('units', 'cost_price', 'INT NULL');
  await addColumnIfMissing('units', 'deposit_id', 'CHAR(36) NULL');
  await addColumnIfMissing('units', 'location_id', 'CHAR(36) NULL');
  await addColumnIfMissing('units', 'order_id', 'CHAR(36) NULL');
  await addColumnIfMissing('units', 'sale_id', 'CHAR(36) NULL');
  await addColumnIfMissing('units', 'reserved_at', 'TIMESTAMP NULL');
  await addColumnIfMissing('units', 'sold_at', 'TIMESTAMP NULL');
  await addColumnIfMissing('units', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('units', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await addIndexIfMissing('units', 'idx_units_product_id', 'product_id');
  await addIndexIfMissing('units', 'idx_units_imei_1', 'imei_1');
  await addIndexIfMissing('units', 'idx_units_imei_2', 'imei_2');
  await addIndexIfMissing('units', 'idx_units_serial', 'serial');
  await addIndexIfMissing('units', 'idx_units_status', 'status');
  await addIndexIfMissing('units', 'idx_units_deposit_id', 'deposit_id');
  await addIndexIfMissing('units', 'idx_units_location_id', 'location_id');
  console.log('[migration] units table: OK');

  // Stock sync de units é feito em app-level (helper syncProductStock chamado pelos
  // endpoints /units). Trigger MySQL exige privilégio SUPER que o usuário não tem
  // (ER_BINLOG_CREATE_ROUTINE_NEED_SUPER quando binlog está ativo).

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pdp_section_headers (
      id CHAR(36) PRIMARY KEY,
      phrase VARCHAR(255) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_phrase (phrase)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  // Seed com cabeçalhos que já estavam hardcoded — só insere se a tabela estiver vazia.
  const [pdpHdrCount] = await pool.query('SELECT COUNT(*) AS c FROM pdp_section_headers');
  if (Number(pdpHdrCount[0]?.c || 0) === 0) {
    await pool.query(
      `INSERT INTO pdp_section_headers (id, phrase, sort_order) VALUES (UUID(), ?, ?), (UUID(), ?, ?)`,
      ['Características do Produto', 10, 'Conteúdo da embalagem', 20]
    );
  }
  console.log('[migration] pdp_section_headers table: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_navigation_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      pathname VARCHAR(512) NOT NULL,
      search VARCHAR(512) NULL,
      hash_fragment VARCHAR(128) NULL,
      full_url VARCHAR(1000) NULL,
      title VARCHAR(255) NULL,
      referrer_path VARCHAR(512) NULL,
      user_id VARCHAR(80) NULL,
      customer_id VARCHAR(80) NULL,
      user_agent VARCHAR(255) NULL,
      metadata_json JSON NULL,
      INDEX idx_admin_navigation_created (created_at),
      INDEX idx_admin_navigation_path (pathname)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] admin_navigation_logs table: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_preferences (
      preference_key VARCHAR(80) PRIMARY KEY,
      value_json JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] admin_preferences table: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS avulso_receipts (
      id VARCHAR(36) PRIMARY KEY,
      numero VARCHAR(40) NOT NULL,
      tipo ENUM('receber','pagar') NOT NULL DEFAULT 'receber',
      nome_contato VARCHAR(255) NOT NULL,
      cpf_cnpj VARCHAR(30) NULL,
      telefone VARCHAR(30) NULL,
      email VARCHAR(255) NULL,
      customer_id VARCHAR(36) NULL,
      valor DECIMAL(12,2) NOT NULL,
      descricao TEXT NOT NULL,
      data_emissao DATE NOT NULL,
      created_by VARCHAR(80) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_avulso_receipts_created (created_at),
      INDEX idx_avulso_receipts_tipo (tipo),
      INDEX idx_avulso_receipts_customer (customer_id),
      INDEX idx_avulso_receipts_numero (numero)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] avulso_receipts table: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pdv_displays (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      slug VARCHAR(120) NOT NULL,
      type ENUM('cashier','ads','hybrid') NOT NULL DEFAULT 'cashier',
      orientation ENUM('portrait','landscape') NOT NULL DEFAULT 'landscape',
      cashier_key VARCHAR(120) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      settings_json JSON NULL,
      idle_content_json JSON NULL,
      active_pix_payment_id CHAR(36) NULL,
      paired_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_pdv_displays_slug (slug),
      INDEX idx_pdv_displays_cashier (cashier_key),
      INDEX idx_pdv_displays_active_pix (active_pix_payment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pdv_display_pairing_codes (
      id CHAR(36) PRIMARY KEY,
      display_id CHAR(36) NOT NULL,
      code_hash VARCHAR(128) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      consumed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_pdv_display_pairing_code_hash (code_hash),
      INDEX idx_pdv_display_pairing_display (display_id),
      INDEX idx_pdv_display_pairing_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pdv_display_tokens (
      id CHAR(36) PRIMARY KEY,
      display_id CHAR(36) NOT NULL,
      token_hash VARCHAR(128) NOT NULL,
      revoked_at TIMESTAMP NULL,
      last_seen_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_pdv_display_token_hash (token_hash),
      INDEX idx_pdv_display_tokens_display (display_id),
      INDEX idx_pdv_display_tokens_revoked (revoked_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pdv_pix_payments (
      id CHAR(36) PRIMARY KEY,
      sale_draft_id VARCHAR(120) NULL,
      local_reference VARCHAR(160) NULL,
      cashier_key VARCHAR(120) NULL,
      display_id CHAR(36) NULL,
      mercado_pago_payment_id VARCHAR(120) NULL,
      amount INT NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      qr_code MEDIUMTEXT NULL,
      qr_code_base64 MEDIUMTEXT NULL,
      ticket_url TEXT NULL,
      raw_response_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_pdv_pix_mp_payment (mercado_pago_payment_id),
      INDEX idx_pdv_pix_status (status),
      INDEX idx_pdv_pix_display (display_id),
      INDEX idx_pdv_pix_cashier (cashier_key),
      INDEX idx_pdv_pix_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] pdv display and pix tables: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_debts (
      id CHAR(36) PRIMARY KEY,
      customer_id VARCHAR(255) NOT NULL,
      sale_id VARCHAR(36) NULL,
      valor_total BIGINT NOT NULL,
      saldo_devedor BIGINT NOT NULL,
      descricao TEXT NOT NULL,
      data_vencimento DATE NOT NULL,
      status ENUM('pending', 'paid', 'partial', 'cancelled') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_customer_debts_customer (customer_id),
      INDEX idx_customer_debts_status (status),
      INDEX idx_customer_debts_vencimento (data_vencimento),
      INDEX idx_customer_debts_sale (sale_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] customer_debts table: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_debt_payments (
      id CHAR(36) PRIMARY KEY,
      debt_id CHAR(36) NOT NULL,
      valor_pago BIGINT NOT NULL,
      data_pagamento DATE NOT NULL,
      metodo_pagamento VARCHAR(40) NOT NULL,
      observacoes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_debt_payments_debt (debt_id),
      INDEX idx_debt_payments_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] customer_debt_payments table: OK');

  await addColumnIfMissing('customer_debt_payments', 'mercado_pago_id', 'VARCHAR(100) DEFAULT NULL');
  await addColumnIfMissing('customer_debt_payments', 'mercado_pago_link', 'TEXT DEFAULT NULL');
  await addColumnIfMissing('customer_debt_payments', 'recibo_id', 'VARCHAR(80) DEFAULT NULL');
  await addColumnIfMissing('customer_debt_payments', 'recibo_numero', 'VARCHAR(80) DEFAULT NULL');
  await addUniqueIndexIfMissing('customer_debt_payments', 'uniq_customer_debt_payments_mp_id', 'mercado_pago_id');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_debt_payment_intents (
      id CHAR(36) PRIMARY KEY,
      debt_id CHAR(36) NOT NULL,
      provider VARCHAR(50) NOT NULL DEFAULT 'mercado_pago',
      provider_intent_id VARCHAR(100) DEFAULT NULL,
      metodo VARCHAR(30) NOT NULL,
      valor_liquido BIGINT NOT NULL,
      valor_cobrado BIGINT NOT NULL,
      taxa_pct DECIMAL(10,6) NOT NULL DEFAULT 0,
      status ENUM('created','approved','expired','cancelled','failed') DEFAULT 'created',
      checkout_url TEXT DEFAULT NULL,
      qr_code TEXT DEFAULT NULL,
      qr_code_base64 LONGTEXT DEFAULT NULL,
      raw_response JSON DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_debt_payment_intents_debt (debt_id),
      INDEX idx_debt_payment_intents_provider (provider_intent_id),
      INDEX idx_debt_payment_intents_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] customer_debt_payment_intents table: OK');

  await ensureDefaultAdminAccount();
}

async function syncSerializedProductStockFromUnits(productId) {
  if (!productId) return null;
  const [[product]] = await pool.query('SELECT id, company_id FROM products WHERE id = ? LIMIT 1', [productId]);
  if (!product) return null;

  const companyId = product.company_id || await getDefaultStockCompanyId();
  const fallback = await ensureDefaultStockLocation(companyId);
  const [unitRows] = await pool.query(
    `SELECT
       COALESCE(deposit_id, ?) AS deposit_id,
       COALESCE(location_id, ?) AS location_id,
       SUM(CASE WHEN status IN ('available', 'reserved') THEN 1 ELSE 0 END) AS physical_quantity,
       SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_quantity,
       SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) AS reserved_quantity
     FROM units
     WHERE product_id = ? AND status IN ('available', 'reserved')
     GROUP BY COALESCE(deposit_id, ?), COALESCE(location_id, ?)`,
    [fallback.depositId, fallback.locationId, productId, fallback.depositId, fallback.locationId]
  );

  await pool.query('DELETE FROM product_stock_locations WHERE product_id = ?', [productId]);
  for (const row of unitRows || []) {
    const quantity = Math.max(0, Math.trunc(Number(row.physical_quantity || 0)));
    if (quantity <= 0) continue;
    await upsertStockLocationBalance({
      companyId,
      productId,
      depositId: row.deposit_id,
      locationId: row.location_id,
      quantity,
      reservedQuantity: Math.max(0, Math.trunc(Number(row.reserved_quantity || 0))),
    });
  }

  const available = (unitRows || []).reduce((sum, row) => sum + Math.max(0, Math.trunc(Number(row.available_quantity || 0))), 0);
  await pool.query('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [available, productId]);
  return available;
}

// Recalcula products.stock_quantity a partir das unidades serializadas disponiveis.
async function syncProductStock(productId) {
  return syncSerializedProductStockFromUnits(productId);
}

// ─── Recibos Avulsos ────────────────────────────────────────────────────────

fastify.post('/financial/avulso-receipts', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { tipo, nome_contato, cpf_cnpj, telefone, email, customer_id, valor, descricao, data_emissao } = body;

  if (!nome_contato || typeof nome_contato !== 'string' || !nome_contato.trim()) {
    return reply.code(400).send({ error: 'nome_contato obrigatorio' });
  }
  if (!valor || isNaN(Number(valor)) || Number(valor) <= 0) {
    return reply.code(400).send({ error: 'valor invalido' });
  }
  if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
    return reply.code(400).send({ error: 'descricao obrigatoria' });
  }
  if (!data_emissao || !/^\d{4}-\d{2}-\d{2}$/.test(data_emissao)) {
    return reply.code(400).send({ error: 'data_emissao invalida (YYYY-MM-DD)' });
  }

  const tipoNorm = tipo === 'pagar' ? 'pagar' : 'receber';
  const prefixo = tipoNorm === 'receber' ? 'REC' : 'PAG';
  const datePart = data_emissao.replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  const numero = `${prefixo}-${datePart}-${rand}`;
  const id = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();

  await pool.query(
    `INSERT INTO avulso_receipts
      (id, numero, tipo, nome_contato, cpf_cnpj, telefone, email, customer_id, valor, descricao, data_emissao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      numero,
      tipoNorm,
      nome_contato.trim(),
      cpf_cnpj?.trim() || null,
      telefone?.trim() || null,
      email?.trim() || null,
      customer_id?.trim() || null,
      Number(valor),
      descricao.trim(),
      data_emissao,
    ]
  );

  return reply.code(201).send({
    id,
    numero,
    tipo: tipoNorm,
    nome_contato: nome_contato.trim(),
    cpf_cnpj: cpf_cnpj?.trim() || null,
    telefone: telefone?.trim() || null,
    email: email?.trim() || null,
    customer_id: customer_id?.trim() || null,
    valor: Number(valor),
    descricao: descricao.trim(),
    data_emissao,
  });
});

fastify.get('/financial/avulso-receipts', { preHandler: requireSyncKey }, async (req, reply) => {
  const { tipo, search, limit = 50, offset = 0, data_inicio, data_fim, customer_id } = req.query || {};

  const conditions = [];
  const params = [];

  if (tipo === 'receber' || tipo === 'pagar') {
    conditions.push('tipo = ?');
    params.push(tipo);
  }
  if (customer_id) {
    conditions.push('customer_id = ?');
    params.push(customer_id);
  }
  if (data_inicio) {
    conditions.push('data_emissao >= ?');
    params.push(data_inicio);
  }
  if (data_fim) {
    conditions.push('data_emissao <= ?');
    params.push(data_fim);
  }
  if (search && typeof search === 'string' && search.trim()) {
    conditions.push('(nome_contato LIKE ? OR descricao LIKE ? OR numero LIKE ? OR cpf_cnpj LIKE ?)');
    const s = `%${search.trim()}%`;
    params.push(s, s, s, s);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), 200);
  const safeOffset = Math.max(0, parseInt(offset) || 0);

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM avulso_receipts ${where}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT * FROM avulso_receipts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, safeLimit, safeOffset]
  );

  return { rows, total: Number(total), limit: safeLimit, offset: safeOffset };
});

// ─── Crediário Próprio (Recebimento a Prazo) ─────────────────────────────────

// Listar débitos de clientes
fastify.get('/financial/customer-debts', { preHandler: requireSyncKeyOrCustomer }, async (req, reply) => {
  let { customer_id, status, limit = 50, offset = 0 } = req.query || {};
  const access = req.customerAccess || {};
  if (!access.isSync && !access.isAdmin) customer_id = access.customerId;
  if (!access.isSync && !access.isAdmin && req.query?.customer_id && String(req.query.customer_id) !== String(access.customerId)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }
  const conditions = [];
  const params = [];

  if (customer_id) {
    conditions.push('customer_id = ?');
    params.push(customer_id);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), 200);
  const safeOffset = Math.max(0, parseInt(offset) || 0);

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM customer_debts ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT * FROM customer_debts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );

    return { rows, total: Number(total), limit: safeLimit, offset: safeOffset };
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Erro no banco de dados ao buscar debitos' });
  }
});

// Listar pagamentos de crediário
fastify.get('/financial/customer-debts/payments', { preHandler: requireSyncKeyOrCustomer }, async (req, reply) => {
  let { customer_id, debt_id, limit = 50, offset = 0 } = req.query || {};
  const access = req.customerAccess || {};
  if (!access.isSync && !access.isAdmin) customer_id = access.customerId;
  if (!access.isSync && !access.isAdmin && req.query?.customer_id && String(req.query.customer_id) !== String(access.customerId)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }
  
  let queryStr = '';
  const params = [];

  if (debt_id) {
    queryStr = 'SELECT p.*, d.customer_id, d.descricao as debito_descricao FROM customer_debt_payments p JOIN customer_debts d ON p.debt_id = d.id WHERE p.debt_id = ?';
    params.push(debt_id);
  } else if (customer_id) {
    queryStr = 'SELECT p.*, d.customer_id, d.descricao as debito_descricao FROM customer_debt_payments p JOIN customer_debts d ON p.debt_id = d.id WHERE d.customer_id = ?';
    params.push(customer_id);
  } else {
    queryStr = 'SELECT p.*, d.customer_id, d.descricao as debito_descricao FROM customer_debt_payments p JOIN customer_debts d ON p.debt_id = d.id';
  }

  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), 200);
  const safeOffset = Math.max(0, parseInt(offset) || 0);

  try {
    const [rows] = await pool.query(
      `${queryStr} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );
    return { rows };
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Erro no banco de dados ao buscar pagamentos de debitos' });
  }
});

// Criar débito manual
fastify.post('/financial/customer-debts/manual', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { customer_id, valor_total, descricao, data_vencimento } = body;

  if (!customer_id) {
    return reply.code(400).send({ error: 'customer_id obrigatorio' });
  }
  if (!valor_total || isNaN(Number(valor_total)) || Number(valor_total) <= 0) {
    return reply.code(400).send({ error: 'valor_total invalido' });
  }
  if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
    return reply.code(400).send({ error: 'descricao obrigatoria' });
  }
  if (!data_vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(data_vencimento)) {
    return reply.code(400).send({ error: 'data_vencimento invalida (YYYY-MM-DD)' });
  }

  const id = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
  const valor = Math.round(Number(valor_total)); // em centavos

  try {
    await pool.query(
      `INSERT INTO customer_debts (id, customer_id, sale_id, valor_total, saldo_devedor, descricao, data_vencimento, status)
       VALUES (?, ?, NULL, ?, ?, ?, ?, 'pending')`,
      [id, customer_id, valor, valor, descricao.trim(), data_vencimento]
    );

    return reply.code(201).send({
      id,
      customer_id,
      valor_total: valor,
      saldo_devedor: valor,
      descricao: descricao.trim(),
      data_vencimento,
      status: 'pending'
    });
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Erro no banco de dados ao criar debito manual' });
  }
});

// Registrar pagamento / abate de débito (Transacionado)
// Criar debito vinculado a uma venda PDV a prazo
fastify.post('/financial/customer-debts/from-sale', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { customer_id, sale_id, valor_total, descricao, data_vencimento } = body;

  if (!customer_id) {
    return reply.code(400).send({
      error: 'customer_id obrigatorio',
      debug: buildCustomerDebtDebug('validate from-sale payload', { sale_id, customer_id, valor_total, data_vencimento }),
    });
  }
  if (!sale_id) {
    return reply.code(400).send({
      error: 'sale_id obrigatorio',
      debug: buildCustomerDebtDebug('validate from-sale payload', { sale_id, customer_id, valor_total, data_vencimento }),
    });
  }
  if (!valor_total || isNaN(Number(valor_total)) || Number(valor_total) <= 0) {
    return reply.code(400).send({
      error: 'valor_total invalido',
      debug: buildCustomerDebtDebug('validate from-sale payload', { sale_id, customer_id, valor_total, data_vencimento }),
    });
  }
  if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
    return reply.code(400).send({
      error: 'descricao obrigatoria',
      debug: buildCustomerDebtDebug('validate from-sale payload', { sale_id, customer_id, valor_total, data_vencimento }),
    });
  }
  if (!data_vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(data_vencimento)) {
    return reply.code(400).send({
      error: 'data_vencimento invalida (YYYY-MM-DD)',
      debug: buildCustomerDebtDebug('validate from-sale payload', { sale_id, customer_id, valor_total, data_vencimento }),
    });
  }

  const valor = Math.round(Number(valor_total)); // em centavos

  try {
    const [existing] = await pool.query(
      'SELECT * FROM customer_debts WHERE sale_id = ? LIMIT 1',
      [sale_id]
    );

    if (existing.length > 0) {
      return reply.code(200).send(existing[0]);
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();

    await pool.query(
      `INSERT INTO customer_debts (id, customer_id, sale_id, valor_total, saldo_devedor, descricao, data_vencimento, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, customer_id, sale_id, valor, valor, descricao.trim(), data_vencimento]
    );

    return reply.code(201).send({
      id,
      customer_id,
      sale_id,
      valor_total: valor,
      saldo_devedor: valor,
      descricao: descricao.trim(),
      data_vencimento,
      status: 'pending'
    });
  } catch (err) {
    req.log.error({
      debug: buildCustomerDebtDebug('insert from-sale debt failed', {
        sale_id,
        customer_id,
        valor_total,
        data_vencimento,
        error: err?.message,
      }),
    });
    return reply.code(500).send({
      error: 'Erro no banco de dados ao criar debito da venda a prazo',
      debug: buildCustomerDebtDebug('insert from-sale debt failed', {
        sale_id,
        customer_id,
        valor_total,
        data_vencimento,
      }),
    });
  }
});

fastify.delete('/financial/customer-debts/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const id = String(req.params?.id || '').trim();
  if (!id) {
    return reply.code(400).send({ error: 'id obrigatorio' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [debts] = await connection.query('SELECT * FROM customer_debts WHERE id = ? FOR UPDATE', [id]);
    if (debts.length === 0) {
      await connection.rollback();
      return reply.code(404).send({ error: 'Debito nao encontrado' });
    }

    const [[{ total: paymentCount }]] = await connection.query(
      'SELECT COUNT(*) AS total FROM customer_debt_payments WHERE debt_id = ?',
      [id]
    );
    if (Number(paymentCount || 0) > 0) {
      await connection.rollback();
      return reply.code(409).send({ error: 'Nao e possivel excluir debito com pagamentos registrados' });
    }

    await connection.query('DELETE FROM customer_debt_payment_intents WHERE debt_id = ?', [id]);
    await connection.query('DELETE FROM customer_debts WHERE id = ?', [id]);
    await connection.commit();
    return { success: true, id };
  } catch (err) {
    await connection.rollback();
    req.log.error(err);
    return reply.code(500).send({ error: 'Erro no banco de dados ao excluir debito' });
  } finally {
    connection.release();
  }
});

fastify.delete('/financial/customer-debt-payments/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const id = String(req.params?.id || '').trim();
  if (!id) {
    return reply.code(400).send({ error: 'id obrigatorio' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [payments] = await connection.query('SELECT * FROM customer_debt_payments WHERE id = ? FOR UPDATE', [id]);
    if (payments.length === 0) {
      await connection.rollback();
      return reply.code(404).send({ error: 'Pagamento nao encontrado' });
    }

    const payment = payments[0];
    const [debts] = await connection.query('SELECT * FROM customer_debts WHERE id = ? FOR UPDATE', [payment.debt_id]);
    if (debts.length === 0) {
      await connection.rollback();
      return reply.code(404).send({ error: 'Debito vinculado nao encontrado' });
    }

    await connection.query('DELETE FROM customer_debt_payments WHERE id = ?', [id]);
    if (payment.recibo_id) {
      await connection.query('DELETE FROM avulso_receipts WHERE id = ?', [payment.recibo_id]);
    }

    const [[{ total_pago: totalPago }]] = await connection.query(
      'SELECT COALESCE(SUM(valor_pago), 0) AS total_pago FROM customer_debt_payments WHERE debt_id = ?',
      [payment.debt_id]
    );
    const debt = debts[0];
    const paid = Math.max(0, Math.round(Number(totalPago || 0)));
    const total = Math.max(0, Math.round(Number(debt.valor_total || 0)));
    const novoSaldo = Math.max(0, total - paid);
    const novoStatus = novoSaldo <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';

    await connection.query(
      'UPDATE customer_debts SET saldo_devedor = ?, status = ? WHERE id = ?',
      [novoSaldo, novoStatus, payment.debt_id]
    );

    await connection.commit();
    return { success: true, payment_id: id, debt_id: payment.debt_id, novo_saldo: novoSaldo, novo_status: novoStatus };
  } catch (err) {
    await connection.rollback();
    req.log.error(err);
    return reply.code(500).send({ error: 'Erro no banco de dados ao excluir pagamento' });
  } finally {
    connection.release();
  }
});

fastify.post('/financial/customer-debts/mp-intent', { preHandler: requireSyncKeyOrCustomer }, async (req, reply) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { debt_id, valor_liquido, metodo } = body;

  if (!debt_id) {
    return reply.code(400).send({
      error: 'debt_id obrigatorio',
      debug: buildCustomerDebtDebug('validate mercado pago intent payload', { debt_id, valor_liquido, metodo }),
    });
  }
  if (!valor_liquido || isNaN(Number(valor_liquido)) || Number(valor_liquido) <= 0) {
    return reply.code(400).send({
      error: 'valor_liquido invalido',
      debug: buildCustomerDebtDebug('validate mercado pago intent payload', { debt_id, valor_liquido, metodo }),
    });
  }
  if (!['pix', 'card'].includes(String(metodo))) {
    return reply.code(400).send({
      error: 'metodo deve ser pix ou card',
      debug: buildCustomerDebtDebug('validate mercado pago intent payload', { debt_id, valor_liquido, metodo }),
    });
  }

  const valorLiquido = Math.round(Number(valor_liquido));
  const taxa = String(metodo) === 'pix' ? MP_PIX_FEE_PCT : MP_CARD_FEE_PCT;
  const valorCobrado = Math.ceil(valorLiquido / (1 - taxa));
  const intentId = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
  const external_reference = `customer_debt:${debt_id}`;
  const metadata = {
    flow: 'customer_debt',
    debt_id,
    valor_liquido_centavos: valorLiquido
  };

  try {
    const [debts] = await pool.query('SELECT * FROM customer_debts WHERE id = ? LIMIT 1', [debt_id]);
    if (debts.length === 0) {
      return reply.code(404).send({
        error: 'Debito nao encontrado',
        debug: buildCustomerDebtDebug('mercado pago intent debt not found', { debt_id, metodo, valor_liquido }),
      });
    }

    const debt = debts[0];
    const access = req.customerAccess || {};
    if (!access.isSync && !access.isAdmin && String(debt.customer_id) !== String(access.customerId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    if (!['pending', 'partial'].includes(String(debt.status))) {
      return reply.code(400).send({
        error: 'Debito nao esta em aberto',
        debug: buildCustomerDebtDebug('mercado pago intent debt not open', { debt_id, metodo, status: debt.status }),
      });
    }
    if (valorLiquido > Number(debt.saldo_devedor || 0)) {
      return reply.code(400).send({
        error: 'valor_liquido excede saldo_devedor',
        debug: buildCustomerDebtDebug('mercado pago intent amount exceeds debt balance', {
          debt_id,
          metodo,
          valor_liquido,
          saldo_devedor: debt.saldo_devedor,
        }),
      });
    }

    const [integrations] = await pool.query(
      "SELECT access_token, environment FROM payment_integrations WHERE gateway_name = 'mercado_pago' AND is_active = 1 LIMIT 1"
    );
    const accessToken = integrations?.[0]?.access_token;
    const mpEnvironment = String(integrations?.[0]?.environment || '').toLowerCase() === 'production' ? 'production' : 'sandbox';
    if (!accessToken) {
      return reply.code(400).send({
        error: 'Mercado Pago nao configurado',
        debug: buildCustomerDebtDebug('mercado pago integration missing', { debt_id, metodo, valor_liquido }),
      });
    }
    const tokenLooksSandbox = /^TEST-/i.test(String(accessToken));

    const notificationUrl = 'https://www.mercadodovale.com.br/api/mercadopago-webhook';
    const amountReais = Number((valorCobrado / 100).toFixed(2));
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    let mpResponse;
    let providerIntentId = null;
    let checkoutUrl = null;
    let qrCode = null;
    let qrCodeBase64 = null;

    if (String(metodo) === 'pix') {
      const payload = {
        transaction_amount: amountReais,
        description: `Crediario Mercado do Vale - ${String(debt.descricao || debt.id).slice(0, 80)}`,
        payment_method_id: 'pix',
        external_reference,
        metadata,
        notification_url: notificationUrl,
        date_of_expiration: expiresAt.toISOString(),
        payer: {
          email: 'cliente@mercadodovale.com.br'
        }
      };

      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': intentId
        },
        body: JSON.stringify(payload)
      });

      mpResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        req.log.error({
          debug: buildCustomerDebtDebug('mercado pago intent failed', {
            debt_id,
            metodo,
            valor_liquido,
            valor_cobrado: valorCobrado,
            mercado_pago_status: response.status,
            raw_message: JSON.stringify(mpResponse).slice(0, 1200),
          }),
        });
        await pool.query(
          `INSERT INTO customer_debt_payment_intents
            (id, debt_id, metodo, valor_liquido, valor_cobrado, taxa_pct, status, raw_response, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, ?)`,
          [intentId, debt_id, metodo, valorLiquido, valorCobrado, taxa, JSON.stringify(mpResponse), expiresAt]
        );
        return reply.code(502).send({
          error: 'Falha ao criar cobranca Mercado Pago',
          debug: buildCustomerDebtDebug('mercado pago intent failed', {
            debt_id,
            metodo,
            mercado_pago_status: response.status,
            raw_message: JSON.stringify(mpResponse).slice(0, 1200),
          }),
        });
      }

      providerIntentId = String(mpResponse.id || '');
      qrCode = mpResponse?.point_of_interaction?.transaction_data?.qr_code || null;
      qrCodeBase64 = mpResponse?.point_of_interaction?.transaction_data?.qr_code_base64 || null;
      checkoutUrl = mpResponse?.point_of_interaction?.transaction_data?.ticket_url || null;
    } else {
      const payload = {
        items: [{
          id: debt_id,
          title: `Crediario Mercado do Vale`,
          description: String(debt.descricao || debt.id).slice(0, 250),
          quantity: 1,
          currency_id: 'BRL',
          unit_price: amountReais
        }],
        external_reference,
        metadata,
        notification_url: notificationUrl,
        expires: true,
        expiration_date_to: expiresAt.toISOString(),
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
          installments: 12
        }
      };

      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      mpResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        req.log.error({
          debug: buildCustomerDebtDebug('mercado pago intent failed', {
            debt_id,
            metodo,
            valor_liquido,
            valor_cobrado: valorCobrado,
            mercado_pago_status: response.status,
            raw_message: JSON.stringify(mpResponse).slice(0, 1200),
          }),
        });
        await pool.query(
          `INSERT INTO customer_debt_payment_intents
            (id, debt_id, metodo, valor_liquido, valor_cobrado, taxa_pct, status, raw_response, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, ?)`,
          [intentId, debt_id, metodo, valorLiquido, valorCobrado, taxa, JSON.stringify(mpResponse), expiresAt]
        );
        return reply.code(502).send({
          error: 'Falha ao criar checkout Mercado Pago',
          debug: buildCustomerDebtDebug('mercado pago intent failed', {
            debt_id,
            metodo,
            mercado_pago_status: response.status,
            raw_message: JSON.stringify(mpResponse).slice(0, 1200),
          }),
        });
      }

      providerIntentId = String(mpResponse.id || '');
      checkoutUrl = mpResponse.init_point || mpResponse.sandbox_init_point || null;
    }
    const isSandboxIntent = tokenLooksSandbox || mpEnvironment === 'sandbox' || String(checkoutUrl || '').includes('/sandbox/');

    await pool.query(
      `INSERT INTO customer_debt_payment_intents
        (id, debt_id, provider_intent_id, metodo, valor_liquido, valor_cobrado, taxa_pct, status, checkout_url, qr_code, qr_code_base64, raw_response, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'created', ?, ?, ?, ?, ?)`,
      [
        intentId,
        debt_id,
        providerIntentId,
        metodo,
        valorLiquido,
        valorCobrado,
        taxa,
        checkoutUrl,
        qrCode,
        qrCodeBase64,
        JSON.stringify(mpResponse),
        expiresAt
      ]
    );

    return reply.code(201).send({
      id: intentId,
      debt_id,
      provider: 'mercado_pago',
      provider_intent_id: providerIntentId,
      metodo,
      valor_liquido: valorLiquido,
      valor_cobrado: valorCobrado,
      taxa_pct: taxa,
      status: 'created',
      checkout_url: checkoutUrl,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      environment: isSandboxIntent ? 'sandbox' : 'production',
      is_sandbox: isSandboxIntent,
      external_reference,
      metadata,
      expires_at: expiresAt.toISOString()
    });
  } catch (err) {
    req.log.error({
      debug: buildCustomerDebtDebug('mercado pago intent failed', {
        debt_id,
        metodo,
        valor_liquido,
        error: err?.message,
      }),
    });
    return reply.code(500).send({
      error: 'Erro ao criar intent Mercado Pago do crediario',
      debug: buildCustomerDebtDebug('mercado pago intent failed', { debt_id, metodo, valor_liquido }),
    });
  }
});

fastify.post('/financial/customer-debts/pay', { preHandler: requireSyncKey }, async (req, reply) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { debt_id, valor_pago, data_pagamento, metodo_pagamento, observacoes } = body;

  if (!debt_id) {
    return reply.code(400).send({ error: 'debt_id obrigatorio' });
  }
  if (!valor_pago || isNaN(Number(valor_pago)) || Number(valor_pago) <= 0) {
    return reply.code(400).send({ error: 'valor_pago invalido' });
  }
  if (!data_pagamento || !/^\d{4}-\d{2}-\d{2}$/.test(data_pagamento)) {
    return reply.code(400).send({ error: 'data_pagamento invalida (YYYY-MM-DD)' });
  }
  if (!metodo_pagamento) {
    return reply.code(400).send({ error: 'metodo_pagamento obrigatorio' });
  }

  const valorPagoCentavos = Math.round(Number(valor_pago));
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Obter e travar o registro do débito para atualização segura
    const [debts] = await connection.query(
      'SELECT * FROM customer_debts WHERE id = ? FOR UPDATE',
      [debt_id]
    );

    if (debts.length === 0) {
      await connection.rollback();
      return reply.code(404).send({ error: 'Debito nao encontrado' });
    }

    const debt = debts[0];
    if (debt.saldo_devedor <= 0 || debt.status === 'paid') {
      await connection.rollback();
      return reply.code(400).send({ error: 'Este debito ja esta totalmente quitado' });
    }

    if (valorPagoCentavos > debt.saldo_devedor) {
      await connection.rollback();
      return reply.code(400).send({ 
        error: `Valor pago excede o saldo devedor. Saldo atual: R$ ${(debt.saldo_devedor / 100).toFixed(2)}` 
      });
    }

    // 2. Inserir o registro de pagamento
    const paymentId = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
    await connection.query(
      `INSERT INTO customer_debt_payments (id, debt_id, valor_pago, data_pagamento, metodo_pagamento, observacoes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [paymentId, debt_id, valorPagoCentavos, data_pagamento, metodo_pagamento, observacoes || null]
    );

    // 3. Atualizar o saldo devedor e status do débito
    const novoSaldo = debt.saldo_devedor - valorPagoCentavos;
    const novoStatus = novoSaldo === 0 ? 'paid' : 'partial';

    await connection.query(
      'UPDATE customer_debts SET saldo_devedor = ?, status = ? WHERE id = ?',
      [novoSaldo, novoStatus, debt_id]
    );

    // 4. Buscar dados do cliente para registrar o recibo avulso
    const [customers] = await connection.query(
      'SELECT name, cpf_cnpj, phone, email FROM customers WHERE id = ?',
      [debt.customer_id]
    );

    let reciboId = null;
    let reciboNumero = null;

    if (customers.length > 0) {
      const customer = customers[0];
      reciboId = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
      const prefixo = 'REC';
      const datePart = data_pagamento.replace(/-/g, '');
      const rand = String(Math.floor(Math.random() * 9000) + 1000);
      reciboNumero = `${prefixo}-${datePart}-${rand}`;

      // A tabela avulso_receipts armazena valor em DECIMAL (Reais).
      // Dividimos centavos por 100.
      const valorReais = valorPagoCentavos / 100;
      const descRecibo = `Abate de Crediario - Ref: ${debt.descricao}`;

      await connection.query(
        `INSERT INTO avulso_receipts
          (id, numero, tipo, nome_contato, cpf_cnpj, telefone, email, customer_id, valor, descricao, data_emissao)
         VALUES (?, ?, 'receber', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reciboId,
          reciboNumero,
          customer.name,
          customer.cpf_cnpj || null,
          customer.phone || null,
          customer.email || null,
          debt.customer_id,
          valorReais,
          descRecibo,
          data_pagamento
        ]
      );

      await connection.query(
        'UPDATE customer_debt_payments SET recibo_id = ?, recibo_numero = ? WHERE id = ?',
        [reciboId, reciboNumero, paymentId]
      );
    }

    await connection.commit();

    return {
      success: true,
      debt_id,
      novo_saldo: novoSaldo,
      novo_status: novoStatus,
      payment_id: paymentId,
      recibo_id: reciboId,
      recibo_numero: reciboNumero
    };

  } catch (err) {
    await connection.rollback();
    req.log.error(err);
    return reply.code(500).send({ error: 'Erro ao processar baixa de debito' });
  } finally {
    connection.release();
  }
});

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
