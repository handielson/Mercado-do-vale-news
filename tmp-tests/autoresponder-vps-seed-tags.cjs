const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const localEnv = fs.existsSync(path.join(root, '.env.local'))
  ? fs.readFileSync(path.join(root, '.env.local'), 'utf8')
  : '';

function readLocalEnv(name) {
  const match = localEnv.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim().replace(/^"|"$/g, '') : '';
}

const syncKey = readLocalEnv('SYNC_SECRET') || readLocalEnv('VITE_VPS_SYNC_KEY');
if (!syncKey) throw new Error('Missing SYNC_SECRET/VITE_VPS_SYNC_KEY in .env.local');

const API = 'https://api.xiaomipetrolina.com.br';

const seedTags = [
  { name: 'Promoção', color: '#ef4444', description: 'Produtos em promoção/oferta', scopes: ['rule', 'conversation', 'product'], show_on_bot: true },
  { name: 'Novidade', color: '#10b981', description: 'Produtos novos/lançamentos', scopes: ['rule', 'conversation', 'product'], show_on_bot: true },
  { name: 'Saudação', color: '#3b82f6', description: 'Regras de saudação', scopes: ['rule'], show_on_bot: false },
  { name: 'Informações', color: '#10b981', description: 'Informações gerais da loja', scopes: ['rule'], show_on_bot: false },
  { name: 'Venda', color: '#a855f7', description: 'Regras com intenção de venda', scopes: ['rule'], show_on_bot: false },
  { name: 'Pós-venda', color: '#f97316', description: 'Suporte após compra', scopes: ['rule'], show_on_bot: false },
  { name: 'Atendimento', color: '#dc2626', description: 'Fluxos de atendimento humano', scopes: ['rule'], show_on_bot: false },
  { name: 'Lead quente', color: '#22c55e', description: 'Cliente com alta intenção de compra', scopes: ['conversation'], show_on_bot: false },
  { name: 'Aguardando resposta', color: '#eab308', description: 'Conversa aguardando resposta humana', scopes: ['conversation'], show_on_bot: false },
  { name: 'VIP', color: '#a855f7', description: 'Cliente VIP', scopes: ['conversation'], show_on_bot: false },
  { name: 'Reclamação', color: '#f97316', description: 'Conversa com reclamação', scopes: ['conversation'], show_on_bot: false },
  { name: 'Fornecedor', color: '#3b82f6', description: 'Contato de fornecedor', scopes: ['conversation'], show_on_bot: false },
  { name: 'Sem interesse', color: '#71717a', description: 'Cliente sem interesse no momento', scopes: ['conversation'], show_on_bot: false },
];

async function request(pathname, options = {}) {
  const response = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      'X-Sync-Key': syncKey,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${pathname} failed ${response.status}: ${text}`);
  }
  return body;
}

async function main() {
  const existing = await request('/autoresponder/tags');
  const byName = new Map(existing.map((tag) => [String(tag.name).toLowerCase(), tag]));
  const created = [];
  const present = [];

  for (const tag of seedTags) {
    const key = tag.name.toLowerCase();
    if (byName.has(key)) {
      present.push(byName.get(key));
      continue;
    }
    const createdTag = await request('/autoresponder/tags', {
      method: 'POST',
      body: JSON.stringify(tag),
    });
    created.push(createdTag);
    byName.set(key, createdTag);
  }

  const settings = await request('/autoresponder/settings');
  const rawKeywords = settings.product_tag_keywords || {};
  const keywords = typeof rawKeywords === 'string' ? JSON.parse(rawKeywords || '{}') : { ...rawKeywords };
  const promo = byName.get('promoção');
  const novidade = byName.get('novidade');
  for (const word of ['promoção', 'promocao', 'oferta', 'ofertinha', 'desconto', 'barato', 'baratinho']) {
    if (promo?.id) keywords[word] = promo.id;
  }
  for (const word of ['novidade', 'novo', 'nova', 'lançamento', 'lancamento', 'chegou']) {
    if (novidade?.id) keywords[word] = novidade.id;
  }
  const savedSettings = await request('/autoresponder/settings', {
    method: 'PATCH',
    body: JSON.stringify({ product_tag_keywords: keywords }),
  });

  console.log(JSON.stringify({
    ok: true,
    created: created.map((tag) => tag.name),
    already_present: present.map((tag) => tag.name),
    total_seed_tags: seedTags.length,
    keyword_count: Object.keys(savedSettings.product_tag_keywords || {}).length,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
