const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { readLegacyVpsConst: readConst } = require('./vps-ssh-config.cjs');
const localEnv = fs.existsSync(path.join(root, '.env.local'))
  ? fs.readFileSync(path.join(root, '.env.local'), 'utf8')
  : '';

const API = 'https://api.xiaomipetrolina.com.br';


function readLocalEnv(name) {
  const match = localEnv.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim().replace(/^"|"$/g, '') : '';
}

const syncKey = readLocalEnv('SYNC_SECRET') || readLocalEnv('VITE_VPS_SYNC_KEY');
const autoresponderToken = readLocalEnv('AUTORESPONDER_TOKEN');

if (!syncKey) throw new Error('Missing SYNC_SECRET/VITE_VPS_SYNC_KEY in .env.local');
if (!autoresponderToken) throw new Error('Missing AUTORESPONDER_TOKEN in .env.local');

async function api(pathname, options = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.admin ? { 'X-Sync-Key': syncKey } : {}),
      ...(options.bot ? { 'X-Autoresponder-Token': autoresponderToken } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function botMessage(sender, message, extra = {}) {
  return api('/autoresponder-webhook', {
    method: 'POST',
    bot: true,
    body: JSON.stringify({ sender, message, isGroup: false, ...extra }),
  });
}

async function admin(pathname, method = 'GET', body) {
  return api(pathname, {
    method,
    admin: true,
    body: body == null ? undefined : JSON.stringify(body),
  });
}

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => resolve({ code, stdout, stderr, command }));
      stream.on('data', (data) => {
        stdout += data.toString();
      });
      stream.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    });
  });
}

async function withSsh(fn) {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({
        host: readConst('VpsHost'),
        port: 22,
        username: readConst('VpsUser'),
        password: readConst('VpsPass'),
        readyTimeout: 15000,
      });
  });
  try {
    return await fn(conn);
  } finally {
    conn.end();
  }
}

async function remoteNode(conn, code) {
  const encoded = Buffer.from(code, 'utf8').toString('base64');
  const command = `cd /var/www/mdv-api && node -e "eval(Buffer.from('${encoded}','base64').toString('utf8'))"`;
  const result = await exec(conn, command);
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || `Remote node failed: ${command}`);
  }
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  const jsonLine = [...lines].reverse().find((line) => line.trim().startsWith('{'));
  if (!jsonLine) throw new Error(`Remote node did not return JSON: ${result.stdout}`);
  return JSON.parse(jsonLine);
}

function assertStatus(label, response, expected = 200) {
  if (response.status !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${response.status}: ${JSON.stringify(response.body)}`);
  }
}

function replies(response) {
  return Array.isArray(response.body?.replies) ? response.body.replies : [];
}

async function main() {
  const stamp = Date.now();
  const report = {
    ok: false,
    checks: {},
    notes: [],
  };

  await withSsh(async (conn) => {
    const schema = await remoteNode(conn, `
      require('dotenv').config({ path: '/var/www/mdv-api/.env' });
      const mysql = require('mysql2/promise');
      (async () => {
        const pool = mysql.createPool({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASS,
          database: process.env.DB_NAME,
        });
        const expected = [
          'autoresponder_settings',
          'autoresponder_rules',
          'autoresponder_tags',
          'autoresponder_logs',
          'autoresponder_conversations',
          'autoresponder_blocklist',
        ];
        const [tables] = await pool.query(
          'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (?) ORDER BY table_name',
          [expected]
        );
        const [tagCol] = await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'tag_ids'"
        );
        const [promoTags] = await pool.query("SELECT id, name, scopes FROM autoresponder_tags WHERE LOWER(name) IN ('promoÃ§Ã£o','promocao')");
        const [skuRows] = await pool.query(
          "SELECT id, name, sku, price_retail, price_promo, tag_ids FROM products WHERE sku = 'CSRN144GRO' LIMIT 1"
        );
        await pool.end();
        console.log(JSON.stringify({
          tables: tables.map((row) => row.table_name || row.TABLE_NAME),
          products_tag_ids_column: tagCol.length > 0,
          promoTags,
          sku: skuRows[0] || null,
        }));
      })().catch((err) => {
        console.error(err);
        process.exit(1);
      });
    `);
    report.checks.schema = schema;
    report.checks.pm2_logs = await exec(conn, 'pm2 logs mdv-api --lines 80 --nostream');
  });

  const settingsBefore = await admin('/autoresponder/settings');
  assertStatus('settings before', settingsBefore);
  report.checks.settings_before = {
    enabled: settingsBefore.body?.enabled,
    human_pause_minutes: settingsBefore.body?.human_pause_minutes,
    auto_pause_fallback_threshold: settingsBefore.body?.auto_pause_fallback_threshold,
    auto_pause_fallback_minutes: settingsBefore.body?.auto_pause_fallback_minutes,
    fallback_message: settingsBefore.body?.fallback_message,
    greeting_prefix: settingsBefore.body?.greeting_prefix,
  };

  if (Number(settingsBefore.body?.enabled) !== 1) {
    const enabled = await admin('/autoresponder/settings', 'PATCH', { enabled: true });
    assertStatus('enable bot', enabled);
  }

  const phoneBase = String(stamp).slice(-8);
  const fallbackSender = `558799${phoneBase}01`;
  const fallback = await botMessage(fallbackSender, 'qual o endereco codexxyz');
  assertStatus('fallback', fallback);
  if (replies(fallback).length < 1) throw new Error('fallback did not reply');
  report.checks.fallback = replies(fallback)[0]?.message || '';

  const pausedSender = `558799${phoneBase}02`;
  const pause = await admin(`/autoresponder/conversations/${encodeURIComponent(pausedSender)}/pause`, 'POST', {
    minutes: 5,
    reason: 'codex checklist test',
  });
  assertStatus('pause conversation', pause);
  const paused = await botMessage(pausedSender, 'tem capa para note 14');
  assertStatus('paused silence', paused);
  if (replies(paused).length !== 0) throw new Error('paused conversation replied unexpectedly');
  report.checks.paused_conversation = 'replies empty';

  const blockedSender = `558799${phoneBase}03`;
  const block = await admin('/autoresponder/blocklist', 'POST', {
    pattern: blockedSender,
    pattern_type: 'exact',
    contact_name: 'Codex checklist test',
    reason: 'temporary checklist validation',
    active: true,
  });
  assertStatus('create blocklist', block);
  const blocked = await botMessage(blockedSender, 'tem capa para note 14');
  assertStatus('blocked silence', blocked);
  if (replies(blocked).length !== 0) throw new Error('blocked sender replied unexpectedly');
  report.checks.blocklist = { id: block.body?.id, result: 'replies empty' };
  if (block.body?.id) {
    const cleanup = await admin(`/autoresponder/blocklist/${block.body.id}`, 'DELETE');
    assertStatus('delete blocklist', cleanup);
    report.checks.blocklist.cleanup = cleanup.body;
  }

  const autopauseSender = `558799${phoneBase}04`;
  const autoMessages = [];
  for (let i = 1; i <= 3; i += 1) {
    const response = await botMessage(autopauseSender, `pergunta sem match codexzz ${stamp} ${i}`);
    assertStatus(`autopause ${i}`, response);
    autoMessages.push(replies(response).map((item) => item.message).join('\n'));
  }
  if (!autoMessages[2] || !/atendente|ajudar/i.test(autoMessages[2])) {
    throw new Error(`auto-pause third reply did not look like handoff: ${autoMessages[2]}`);
  }
  const autoPausedSilence = await botMessage(autopauseSender, `pergunta depois da pausa ${stamp}`);
  assertStatus('autopause silence', autoPausedSilence);
  if (replies(autoPausedSilence).length !== 0) throw new Error('auto-paused sender replied unexpectedly');
  report.checks.auto_pause = {
    first: autoMessages[0],
    second: autoMessages[1],
    third: autoMessages[2],
    after_pause: 'replies empty',
  };

  let promoTags = report.checks.schema.promoTags || [];
  if (promoTags.length === 0) {
    const createdPromo = await admin('/autoresponder/tags', 'POST', {
      name: 'PromoÃ§Ã£o',
      color: '#ef4444',
      description: 'Produtos em promoÃ§Ã£o/oferta',
      scopes: ['rule', 'conversation', 'product'],
      show_on_bot: true,
    });
    assertStatus('create PromoÃ§Ã£o tag', createdPromo);
    promoTags = [createdPromo.body];
    report.checks.promo_tag_seeded = createdPromo.body;
  }

  if (!report.checks.schema.sku) {
    report.notes.push('promoÃ§Ã£o not tested: reference SKU CSRN144GRO was not found');
  } else {
    const promoTag = promoTags[0];
    let tagIds = [];
    try {
      tagIds = Array.isArray(report.checks.schema.sku.tag_ids)
        ? report.checks.schema.sku.tag_ids
        : JSON.parse(report.checks.schema.sku.tag_ids || '[]');
    } catch {}
    const originalTagIds = tagIds.map(Number).filter(Number.isFinite);
    let productTagsWerePatched = false;
    if (!originalTagIds.includes(Number(promoTag.id))) {
      const updatedTags = [...originalTagIds, Number(promoTag.id)];
      const patchProduct = await admin(`/products/${encodeURIComponent(report.checks.schema.sku.id)}/tags`, 'PATCH', {
        tag_ids: updatedTags,
      });
      assertStatus('patch product promo tag', patchProduct);
      report.checks.promo_product_tag_patched = updatedTags;
      productTagsWerePatched = true;
    }
    const keywords = settingsBefore.body?.product_tag_keywords || {};
    const nextKeywords = typeof keywords === 'string' ? JSON.parse(keywords || '{}') : { ...keywords };
    nextKeywords.promocao = promoTag.id;
    nextKeywords['promoÃ§Ã£o'] = promoTag.id;
    const patchSettings = await admin('/autoresponder/settings', 'PATCH', {
      product_tag_keywords: nextKeywords,
    });
    assertStatus('patch promo keywords', patchSettings);
    const promoSender = `558799${phoneBase}05`;
    const promo = await botMessage(promoSender, 'promoÃ§Ã£o');
    assertStatus('promo message', promo);
    if (replies(promo).length < 1) throw new Error('promoÃ§Ã£o did not reply');
    report.checks.promo = replies(promo)[0]?.message || '';
    if (productTagsWerePatched) {
      const restoreProduct = await admin(`/products/${encodeURIComponent(report.checks.schema.sku.id)}/tags`, 'PATCH', {
        tag_ids: originalTagIds,
      });
      assertStatus('restore product promo tag', restoreProduct);
      report.checks.promo_product_tag_restored = originalTagIds;
    }
  }

  const stats = await admin('/autoresponder/stats?source=mysql');
  assertStatus('stats', stats);
  report.checks.stats = stats.body;
  report.ok = true;
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
