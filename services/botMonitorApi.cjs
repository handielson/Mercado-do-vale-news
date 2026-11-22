'use strict';

// bot-monitor-v1 (21/11/2026): leitura para os agentes de monitoramento do robô (painel do servidor de casa).
// - só leitura; acesso com a chave MDV_MONITOR_KEY no cabeçalho x-agent-key (sem a variável, a rota fica desligada);
// - POST /agent/monitor/alert {text}: manda o alerta dos agentes no WhatsApp para os admins ativos (com freio);
// - GET /agent/monitor/snapshot?horas=N (1 a 48, padrão 24): conversas recentes do robô (n8n_bot_messages),
//   controles por cliente (pausa humana/bloqueio), atendimentos humanos abertos, respostas repetidas,
//   tempo de resposta do robô e estado da instância da Evolution.
// - GET /agent/monitor/conversation?jid=...&limite=N : mensagens de uma conversa (48 h), para os agentes de IA;
// - GET /agent/monitor/products?q=termo|termo : produtos ativos que batem com os termos (preço, promoção, estoque);
// - GET /agent/monitor/commands : comandos "agentes ..." que o admin mandou no WhatsApp (entrega uma vez só);
// - POST /agent/monitor/send {remote_jid, text} : mensagem ao cliente, só depois de aprovação no painel (o painel garante);
// - POST /agent/monitor/handoffs/close {older_than_hours} : fecha atendimentos humanos abertos antigos (aprovado no painel).
// Telefone e texto saem truncados; nada de payload bruto.

// Comando do admin no WhatsApp para os agentes: "agentes", "agentes pausar alertas", "agentes aprovar 1"...
const AGENT_COMMAND = /^agentes?(?:\s+(status|pausar|reativar|rodar|aprovar|recusar|reprovar|ajuda)(?:\s+([\s\S]{1,300}))?)?\s*$/i;
// bot-monitor-commands-v2: formas curtas do admin — "17 aprovar", "aprovar 17", "16 reprovar, motivo…", "#16 recusa".
const DECISAO = '(aprovar|aprova|aprovo|aprovado|aprovada|recusar|recusa|recuso|recusado|recusada|reprovar|reprova|reprovo|reprovado|reprovada)';
const SHORT_NUM_FIRST = new RegExp(`^#?(\\d{1,4})\\s*[-:,.]?\\s*${DECISAO}\\b[\\s,.:;-]*([\\s\\S]{0,300})$`, 'i');
const SHORT_ACTION_FIRST = new RegExp(`^${DECISAO}\\s*#?(\\d{1,4})\\b[\\s,.:;-]*([\\s\\S]{0,300})$`, 'i');
const decisao = (word) => (/^aprov/i.test(word) ? 'aprovar' : 'recusar');
function parseAgentCommand(value) {
  const text = String(value || '').trim();
  const m = text.match(AGENT_COMMAND);
  if (m) {
    const action = (m[1] || 'status').toLowerCase();
    const target = clean(m[2] || '', 300);
    return { action: action === 'reprovar' ? 'recusar' : action, target: ['aprovar', 'recusar', 'reprovar'].includes(action) ? target : target.toLowerCase() };
  }
  const a = text.match(SHORT_NUM_FIRST);
  if (a) return { action: decisao(a[2]), target: clean(`${a[1]} ${a[3] || ''}`, 300) };
  const b = text.match(SHORT_ACTION_FIRST);
  if (b) return { action: decisao(b[1]), target: clean(`${b[2]} ${b[3] || ''}`, 300) };
  return null;
}

const crypto = require('node:crypto');
const { createBotErrorLibrary } = require('./botErrorLibrary.cjs');
const { createAgentMonitorLock } = require('./agentMonitorLock.cjs');

const clean = (value, limit) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
const digits = (value) => String(value ?? '').replace(/\D/g, '');
const num = (value) => (value == null ? null : Number(value));

function clampHours(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 24;
  return Math.min(n, 48);
}

// Junta as mensagens de cada conversa: última do cliente, última do robô/equipe e quantas o cliente mandou sem resposta.
function summarizeConversations(rows) {
  const byJid = new Map();
  for (const r of rows) {
    const jid = String(r.remote_jid || '');
    if (!jid || jid.endsWith('@g.us') || jid.includes('broadcast')) continue;
    let c = byJid.get(jid);
    if (!c) {
      c = { remote_jid: jid, phone: digits(r.phone) || null, contact_name: null, inbound: 0, outbound: 0,
        last_in_at: null, last_in_text: null, last_out_at: null, last_out_text: null, last_out_source: null, unanswered_in: 0 };
      byJid.set(jid, c);
    }
    if (!c.phone && r.phone) c.phone = digits(r.phone);
    if (r.contact_name) c.contact_name = clean(r.contact_name, 80);
    const at = num(r.ts);
    if (r.direction === 'inbound') {
      c.inbound += 1;
      c.last_in_at = at;
      c.last_in_text = clean(r.message_text, 200) || `[${clean(r.message_type, 40) || 'mídia'}]`;
      c.unanswered_in += 1;
    } else {
      c.outbound += 1;
      c.last_out_at = at;
      c.last_out_text = clean(r.message_text, 200) || `[${clean(r.message_type, 40) || 'mídia'}]`;
      c.last_out_source = clean(r.source_node, 80) || null;
      c.unanswered_in = 0;
    }
  }
  return [...byJid.values()];
}

// Mesmo texto do robô para o mesmo cliente em menos de 2 minutos = provável resposta duplicada/loop.
function findDuplicates(rows, windowSec = 120) {
  const last = new Map();
  const found = [];
  for (const r of rows) {
    if (r.direction === 'inbound') continue;
    const text = clean(r.message_text, 400);
    if (!text || /^\[.*\]$/.test(text)) continue; // [Áudio], [imagem]... são marcadores, não texto repetido
    const key = `${r.remote_jid}|${text.toLowerCase()}`;
    const at = num(r.ts);
    const prev = last.get(key);
    if (prev != null && at - prev <= windowSec) found.push({ remote_jid: String(r.remote_jid), text: text.slice(0, 160), at, gap_sec: at - prev });
    last.set(key, at);
  }
  return found;
}

// Tempo entre a mensagem do cliente e a próxima resposta, na janela pedida.
function responseTimes(rows) {
  const pending = new Map();
  const gaps = [];
  for (const r of rows) {
    const jid = String(r.remote_jid);
    if (r.direction === 'inbound') { if (!pending.has(jid)) pending.set(jid, num(r.ts)); }
    else if (pending.has(jid)) { gaps.push(num(r.ts) - pending.get(jid)); pending.delete(jid); }
  }
  gaps.sort((a, b) => a - b);
  const pick = (q) => (gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(q * gaps.length))] : null);
  return { samples: gaps.length, p50_sec: pick(0.5), p90_sec: pick(0.9), max_sec: gaps.length ? gaps[gaps.length - 1] : null };
}

function createBotMonitorApi({ pool, key = process.env.MDV_MONITOR_KEY, evolution = {}, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const expected = Buffer.from(String(key || ''));
  const evo = {
    url: String(evolution.url ?? process.env.EVOLUTION_SERVER_URL ?? '').replace(/\/+$/, ''),
    key: evolution.key ?? process.env.EVOLUTION_API_KEY ?? '',
    instance: evolution.instance ?? process.env.N8N_BOT_EVOLUTION_INSTANCE_NAME ?? '',
  };

  function authorize(headers = {}) {
    if (expected.length < 32) return false;
    const got = Buffer.from(String(headers['x-agent-key'] || ''));
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  }

  async function evolutionState() {
    if (!evo.url || !evo.key || !evo.instance || typeof fetchImpl !== 'function') return { state: 'desconhecido', note: 'Evolution não configurada' };
    const started = now();
    try {
      const res = await fetchImpl(`${evo.url}/instance/connectionState/${encodeURIComponent(evo.instance)}`, {
        headers: { apikey: evo.key }, signal: AbortSignal.timeout(8000),
      });
      const body = await res.json().catch(() => ({}));
      return { state: clean(body?.instance?.state || (res.ok ? 'desconhecido' : `http ${res.status}`), 40), instance: evo.instance, ms: now() - started };
    } catch (error) {
      return { state: 'erro', note: clean(error?.message || error, 160), ms: now() - started };
    }
  }

  // Nome do perfil do WhatsApp (pushName) pela Evolution, só para quem não tem nome; guarda 6 h.
  const pushCache = new Map();
  async function pushNames(jids) {
    const out = new Map();
    if (!evo.url || !evo.key || !evo.instance || typeof fetchImpl !== 'function') return out;
    const falta = [];
    for (const jid of jids) {
      const c = pushCache.get(jid);
      if (c && now() - c.at < 6 * 3600e3) { if (c.name) out.set(jid, c.name); } else falta.push(jid);
    }
    const fila = falta.slice(0, 40);
    for (let i = 0; i < fila.length; i += 5) {
      await Promise.all(fila.slice(i, i + 5).map(async (jid) => {
        try {
          const res = await fetchImpl(`${evo.url}/chat/findContacts/${encodeURIComponent(evo.instance)}`, {
            method: 'POST', headers: { apikey: evo.key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ where: { remoteJid: jid } }), signal: AbortSignal.timeout(6000),
          });
          const list = await res.json().catch(() => []);
          const name = clean(Array.isArray(list) ? list[0]?.pushName : '', 80) || null;
          pushCache.set(jid, { name, at: now() });
          if (name) out.set(jid, name);
        } catch {}
      }));
    }
    return out;
  }

  async function customerNames(phones) {
    const tails = [...new Set(phones.map((p) => digits(p).slice(-8)).filter((t) => t.length === 8))];
    if (!tails.length) return new Map();
    const [rows] = await pool.query(
      `SELECT name, RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 8) AS tail FROM customers
        WHERE phone IS NOT NULL AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 8) IN (?)`,
      [tails],
    );
    const map = new Map();
    for (const r of rows || []) if (r.name && !map.has(r.tail)) map.set(r.tail, clean(r.name, 80));
    return map;
  }

  async function snapshot(query = {}) {
    const hours = clampHours(query.horas);
    const [messages] = await pool.query(
      `SELECT remote_jid, phone, direction, message_text, message_type, source_node, contact_name, UNIX_TIMESTAMP(created_at) AS ts
         FROM n8n_bot_messages
        WHERE created_at >= NOW() - INTERVAL ? HOUR
        ORDER BY created_at, id`,
      [hours],
    );
    const rows = messages || [];
    const conversations = summarizeConversations(rows);
    const jids = conversations.map((c) => c.remote_jid);
    const controls = new Map();
    if (jids.length) {
      const [ctl] = await pool.query(
        `SELECT remote_jid, blocked, UNIX_TIMESTAMP(human_handoff_until) AS handoff_until, human_handoff_by
           FROM n8n_bot_client_controls WHERE remote_jid IN (?)`,
        [jids],
      );
      for (const r of ctl || []) controls.set(String(r.remote_jid), r);
    }
    const names = await customerNames(conversations.map((c) => c.phone).filter(Boolean));
    for (const c of conversations) {
      const ctl = controls.get(c.remote_jid);
      c.blocked = !!(ctl && Number(ctl.blocked));
      c.handoff_until = ctl ? num(ctl.handoff_until) : null;
      c.handoff_by = ctl ? clean(ctl.human_handoff_by, 60) || null : null;
      c.customer_name = c.phone ? names.get(c.phone.slice(-8)) || null : null;
    }
    const semNome = conversations.filter((c) => !c.customer_name && !c.contact_name).map((c) => c.remote_jid);
    const perfis = await pushNames(semNome);
    for (const c of conversations) if (!c.contact_name && perfis.has(c.remote_jid)) c.contact_name = perfis.get(c.remote_jid);
    const [handoffs] = await pool.query(
      `SELECT remote_jid, phone, contact_name, code, status, UNIX_TIMESTAMP(requested_at) AS requested_at,
              UNIX_TIMESTAMP(expires_at) AS expires_at, UNIX_TIMESTAMP(last_admin_response_at) AS last_admin_response_at
         FROM n8n_bot_handoffs WHERE status = 'open' ORDER BY requested_at DESC LIMIT 200`,
    );
    const [global] = await pool.query('SELECT paused, UNIX_TIMESTAMP(changed_at) AS changed_at FROM n8n_bot_global_control LIMIT 1');
    return {
      generated_at: Math.floor(now() / 1000),
      hours,
      bot_paused: !!(global?.[0] && Number(global[0].paused)),
      evolution: await evolutionState(),
      response_times: responseTimes(rows),
      totals: { messages: rows.length, inbound: rows.filter((r) => r.direction === 'inbound').length, conversations: conversations.length },
      conversations,
      handoffs_open: (handoffs || []).map((h) => ({
        remote_jid: String(h.remote_jid), phone: digits(h.phone) || null, contact_name: clean(h.contact_name, 80) || null,
        requested_at: num(h.requested_at), expires_at: num(h.expires_at), last_admin_response_at: num(h.last_admin_response_at),
      })),
      duplicates: findDuplicates(rows),
    };
  }

  // Alerta dos agentes no WhatsApp: vai do número do robô para os números de admin ativos (n8n_bot_admin_numbers).
  // Freio: no máximo 30 por hora e o mesmo texto só uma vez a cada 20 min.
  const enviados = [];
  const ultimos = new Map();
  // manda direto para os admins ativos (sem freio): usado pela trava de emergência
  async function enviarAdmins(text) {
    if (!evo.url || !evo.key || !evo.instance || typeof fetchImpl !== 'function') throw new Error('Evolution não configurada.');
    const [rows] = await pool.query('SELECT phone FROM n8n_bot_admin_numbers WHERE active = 1');
    const numbers = [...new Set((rows || []).map((r) => digits(r.phone)).filter((n) => n.length >= 10))];
    let sent = 0;
    for (const number of numbers) {
      try {
        const res = await fetchImpl(`${evo.url}/message/sendText/${encodeURIComponent(evo.instance)}`, {
          method: 'POST', headers: { apikey: evo.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ number, text: String(text).slice(0, 3500) }), signal: AbortSignal.timeout(15000),
        });
        if (res.ok) sent += 1;
      } catch {}
    }
    if (!sent) throw new Error('WhatsApp não enviou.');
    return sent;
  }
  const trava = createAgentMonitorLock({ pool, sendAdmins: enviarAdmins, now });
  async function alert(body = {}) {
    const text = String(body.text ?? '').replace(/\u0000/g, '').trim().slice(0, 3500);
    if (!text) throw Object.assign(new Error('Texto vazio.'), { statusCode: 400 });
    if (!evo.url || !evo.key || !evo.instance || typeof fetchImpl !== 'function') throw Object.assign(new Error('Evolution não configurada.'), { statusCode: 503 });
    const agora = now();
    while (enviados.length && agora - enviados[0] > 3600e3) enviados.shift();
    if (enviados.length >= 30) return { ok: false, skipped: 'limite_hora', sent: 0 };
    const chave = text.toLowerCase();
    if (ultimos.has(chave) && agora - ultimos.get(chave) < 20 * 60e3) return { ok: true, skipped: 'repetido', sent: 0 };
    const [rows] = await pool.query('SELECT phone FROM n8n_bot_admin_numbers WHERE active = 1');
    const numbers = [...new Set((rows || []).map((r) => digits(r.phone)).filter((n) => n.length >= 10))];
    if (!numbers.length) return { ok: false, skipped: 'sem_admin', sent: 0 };
    let sent = 0;
    for (const number of numbers) {
      try {
        const res = await fetchImpl(`${evo.url}/message/sendText/${encodeURIComponent(evo.instance)}`, {
          method: 'POST', headers: { apikey: evo.key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number, text }), signal: AbortSignal.timeout(15000),
        });
        if (res.ok) sent += 1;
      } catch {}
    }
    if (sent) { enviados.push(agora); ultimos.set(chave, agora); }
    for (const [k, v] of ultimos) if (agora - v > 3600e3) ultimos.delete(k);
    return { ok: sent > 0, sent, admins: numbers.length };
  }

  let commandsReady = null;
  function ensureCommandsTable() {
    if (!commandsReady) commandsReady = pool.query(`CREATE TABLE IF NOT EXISTS agent_monitor_commands (
      id BIGINT AUTO_INCREMENT PRIMARY KEY, action VARCHAR(20) NOT NULL, target VARCHAR(300) NOT NULL DEFAULT '',
      admin_phone VARCHAR(32) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, consumed_at TIMESTAMP NULL,
      KEY idx_pending (consumed_at, id)) DEFAULT CHARSET=utf8mb4`)
      // bot-monitor-commands-v2: motivo da recusa cabe no alvo.
      .then(() => pool.query("ALTER TABLE agent_monitor_commands MODIFY target VARCHAR(300) NOT NULL DEFAULT ''"))
      .catch((e) => { commandsReady = null; throw e; });
    return commandsReady;
  }
  async function enqueueCommand({ command, admin = {} }) {
    await ensureCommandsTable();
    await pool.query('INSERT INTO agent_monitor_commands (action, target, admin_phone) VALUES (?, ?, ?)', [command.action, command.target, digits(admin.phone).slice(0, 32) || null]);
    const what = command.action === 'ajuda' ? 'Pedido de ajuda' : `${command.action}${command.target ? ` ${String(command.target).slice(0, 60)}` : ''}`;
    return { handled: true, reply: `🤖 Agentes: recebi "${what}". O servidor aplica em até 1 minuto e te responde aqui.` };
  }
  async function commands() {
    await ensureCommandsTable();
    const [rows] = await pool.query('SELECT id, action, target, admin_phone, UNIX_TIMESTAMP(created_at) AS at FROM agent_monitor_commands WHERE consumed_at IS NULL ORDER BY id LIMIT 20');
    const list = rows || [];
    if (list.length) await pool.query('UPDATE agent_monitor_commands SET consumed_at = CURRENT_TIMESTAMP WHERE id IN (?) AND consumed_at IS NULL', [list.map((r) => r.id)]);
    return { commands: list.map((r) => ({ id: Number(r.id), action: r.action, target: r.target, at: num(r.at) })) };
  }

  async function conversation(query = {}) {
    const jid = clean(query.jid, 120);
    if (!jid) throw Object.assign(new Error('Conversa não informada.'), { statusCode: 400 });
    const n = Number.parseInt(query.limite, 10);
    const limit = Number.isFinite(n) && n > 0 ? Math.min(n, 80) : 40;
    const [rows] = await pool.query(
      `SELECT direction, message_text, message_type, source_node, UNIX_TIMESTAMP(created_at) AS ts FROM n8n_bot_messages
        WHERE remote_jid = ? AND created_at >= NOW() - INTERVAL 48 HOUR ORDER BY created_at DESC, id DESC LIMIT ?`, [jid, limit]);
    return { remote_jid: jid, messages: (rows || []).reverse().map((r) => ({
      from: r.direction === 'inbound' ? 'cliente' : (String(r.source_node || '').includes('handoff') || String(r.source_node || '').includes('admin') ? 'equipe' : 'robo'),
      text: clean(r.message_text, 1200) || `[${clean(r.message_type, 40) || 'mídia'}]`, at: num(r.ts),
    })) };
  }

  async function products(query = {}) {
    const terms = String(query.q || '').split('|').map((t) => clean(t, 40)).filter((t) => t.length >= 2).slice(0, 8);
    if (!terms.length) return { products: [] };
    const seen = new Map();
    for (const term of terms) {
      const [rows] = await pool.query(
        `SELECT id, name, sku, price_retail, price_promo, promo_start, promo_end, stock_quantity,
                JSON_UNQUOTE(JSON_EXTRACT(specs, '$.color')) AS cor, JSON_UNQUOTE(JSON_EXTRACT(specs, '$.ram')) AS ram,
                JSON_UNQUOTE(JSON_EXTRACT(specs, '$.storage')) AS armazenamento
           FROM products
          WHERE status = 'active' AND (is_parent = 0 OR is_parent IS NULL) AND name LIKE ? ORDER BY stock_quantity > 0 DESC, sales_count DESC LIMIT 30`,
        [`%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`]);
      for (const r of rows || []) {
        if (seen.has(r.id)) continue;
        const t = now();
        const promoOn = r.price_promo && Number(r.price_promo) > 0 && (!r.promo_start || Date.parse(r.promo_start) <= t) && (!r.promo_end || Date.parse(r.promo_end) >= t);
        // preços ficam em centavos no banco; aqui saem em reais
        // variação (cor, memória) vem de specs; só esses campos saem (specs também tem IMEI e serial, que nunca saem)
        const variante = [clean(r.ram, 12) && clean(r.armazenamento, 12) ? `${clean(r.ram, 12)}/${clean(r.armazenamento, 12)}` : clean(r.ram || r.armazenamento, 12), clean(r.cor, 30)]
          .filter((v) => v && v !== 'null').join(' ');
        seen.set(r.id, { name: clean(r.name, 160), variant: variante || null, sku: clean(r.sku, 60), price: r.price_retail == null ? null : Number(r.price_retail) / 100,
          promo_price: promoOn ? Number(r.price_promo) / 100 : null, stock: Number(r.stock_quantity || 0), term });
      }
    }
    return { products: [...seen.values()].slice(0, 80) };
  }

  async function sendToCustomer(body = {}) {
    await trava.exigirDestravado();
    const jid = clean(body.remote_jid, 120);
    const text = String(body.text ?? '').trim().slice(0, 2000);
    if (!jid || !text || jid.endsWith('@g.us')) throw Object.assign(new Error('Conversa ou texto inválido.'), { statusCode: 400 });
    if (!evo.url || !evo.key || !evo.instance || typeof fetchImpl !== 'function') throw Object.assign(new Error('Evolution não configurada.'), { statusCode: 503 });
    const [rows] = await pool.query('SELECT phone FROM n8n_bot_messages WHERE remote_jid = ? AND created_at >= NOW() - INTERVAL 7 DAY ORDER BY id DESC LIMIT 1', [jid]);
    if (!rows?.length) throw Object.assign(new Error('Conversa sem mensagens nos últimos 7 dias.'), { statusCode: 404 });
    const number = jid.endsWith('@s.whatsapp.net') ? jid.replace('@s.whatsapp.net', '') : jid;
    const res = await fetchImpl(`${evo.url}/message/sendText/${encodeURIComponent(evo.instance)}`, {
      method: 'POST', headers: { apikey: evo.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ number, text }), signal: AbortSignal.timeout(15000),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(`Evolution respondeu ${res.status}.`), { statusCode: 502 });
    await pool.query(`INSERT INTO n8n_bot_messages (remote_jid, phone, direction, message_text, message_type, source_node, wa_message_id, created_at)
      VALUES (?, ?, 'outbound', ?, 'text', 'agente-servidor-aprovado', ?, CURRENT_TIMESTAMP)`,
      [jid, digits(rows[0].phone) || '', text, clean(out?.key?.id, 160) || null]).catch(() => {});
    return { ok: true };
  }

  async function closeHandoffs(body = {}) {
    await trava.exigirDestravado();
    const h = Number.parseInt(body.older_than_hours, 10);
    const hours = Number.isFinite(h) && h >= 2 ? Math.min(h, 24 * 90) : 2;
    const [r] = await pool.query(`UPDATE n8n_bot_handoffs SET status = 'closed', last_admin_phone = 'agente-pausa-esquecida'
      WHERE status = 'open' AND requested_at < UTC_TIMESTAMP() - INTERVAL ? HOUR`, [hours]);
    return { ok: true, closed: Number(r?.affectedRows || 0), older_than_hours: hours };
  }

  // delivery-alert-v1: o robô disse ao cliente que vamos chamar um motoboy → avisa o admin no WhatsApp na hora.
  const DELIVERY_MARK = /chamar um motoboy/i;
  async function deliveryAlertFromLog(body = {}) {
    if (String(body.direction || '') !== 'outbound') return { skipped: 'direcao' };
    const text = String(body.message || body.text || body.message_text || '');
    if (!DELIVERY_MARK.test(text)) return { skipped: 'texto' };
    const jid = clean(body.remoteJid || body.remote_jid, 120);
    if (!jid || jid.endsWith('@g.us')) return { skipped: 'conversa' };
    const phone = digits(jid.split('@')[0]);
    const [rows] = await pool.query(`SELECT contact_name, message_text FROM n8n_bot_messages WHERE remote_jid = ? AND direction = 'inbound'
      AND created_at >= NOW() - INTERVAL 2 HOUR ORDER BY id DESC LIMIT 5`, [jid]);
    const name = clean((rows || []).map((r) => r.contact_name).find(Boolean) || '', 60);
    const pedido = clean((rows || [])[0]?.message_text || '', 160);
    const national = phone.startsWith('55') && phone.length >= 12 ? phone.slice(2) : phone;
    const local = national.slice(2);
    const quem = [name, national.length >= 10 ? `(${national.slice(0, 2)}) ${local.slice(0, -4)}-${local.slice(-4)}` : phone].filter(Boolean).join(' · ');
    const aviso = `🛵 *Entrega esperando você*\nCliente: ${quem || jid}\n${pedido ? `Pediu: "${pedido}"\n` : ''}`
      + 'O robô disse que vamos chamar um motoboy e que já já confirmamos a entrega.\n'
      + `➜ Responda pelo WhatsApp da loja: https://wa.me/${phone}`;
    return alert({ text: aviso });
  }

  return { authorize, snapshot, evolutionState, alert, enqueueCommand, commands, conversation, products, sendToCustomer, closeHandoffs, trava, deliveryAlertFromLog };
}

function registerBotMonitorRoutes(fastify, { pool, ...options } = {}) {
  const api = createBotMonitorApi({ pool, ...options });
  fastify.get('/agent/monitor/snapshot', async (request, reply) => {
    if (!api.authorize(request.headers)) return reply.code(401).send({ error: 'Chave do monitor inválida.' });
    try {
      reply.header('Cache-Control', 'no-store');
      return await api.snapshot(request.query || {});
    } catch (error) {
      console.error('[bot-monitor] snapshot failed:', error?.message || error);
      return reply.code(500).send({ error: 'Falha ao montar o retrato do robô.' });
    }
  });
  const route = (method, url, fn) => fastify[method](url, async (request, reply) => {
    if (!api.authorize(request.headers)) return reply.code(401).send({ error: 'Chave do monitor inválida.' });
    try {
      reply.header('Cache-Control', 'no-store');
      return await fn(method === 'get' ? request.query || {} : request.body || {});
    } catch (error) {
      if (error?.statusCode) return reply.code(error.statusCode).send({ error: error.message });
      console.error(`[bot-monitor] ${url} failed:`, error?.message || error);
      return reply.code(500).send({ error: 'Falha no monitor do robô.' });
    }
  });
  route('get', '/agent/monitor/conversation', api.conversation);
  route('get', '/agent/monitor/products', api.products);
  route('get', '/agent/monitor/commands', api.commands);
  route('post', '/agent/monitor/send', api.sendToCustomer);
  route('post', '/agent/monitor/handoffs/close', api.closeHandoffs);
  // agent-lock-v1: trava de emergência (destravar só com código mandado no WhatsApp dos admins)
  route('get', '/agent/monitor/lock', () => api.trava.estado());
  route('post', '/agent/monitor/lock', (b) => api.trava.travar(b));
  route('post', '/agent/monitor/unlock/request', () => api.trava.pedirCodigo());
  route('post', '/agent/monitor/unlock', (b) => api.trava.destravar(b));

  // bot-error-library-v1: biblioteca de erros (services/botErrorLibrary.cjs)
  const biblioteca = createBotErrorLibrary({ pool });
  api.biblioteca = biblioteca;
  route('get', '/agent/monitor/errors', biblioteca.listar);
  route('get', '/agent/monitor/errors/similar', biblioteca.parecidos);
  route('post', '/agent/monitor/errors', biblioteca.registrar);
  fastify.post('/agent/monitor/errors/:id', async (request, reply) => {
    if (!api.authorize(request.headers)) return reply.code(401).send({ error: 'Chave do monitor inválida.' });
    try { return await biblioteca.atualizar(request.params?.id, request.body || {}); }
    catch (error) { return reply.code(error?.statusCode || 500).send({ error: error?.statusCode ? error.message : 'Falha na biblioteca de erros.' }); }
  });
  // erros do n8n (workflow de erros → /n8n-bot/error-alerts) entram sozinhos na biblioteca
  fastify.addHook('onResponse', async (request, reply) => {
    if (request.method !== 'POST' || reply.statusCode >= 300) return;
    const url = request.routeOptions?.url || request.routerPath || String(request.url || '').split('?')[0];
    if (url !== '/n8n-bot/error-alerts') return;
    const b = request.body || {};
    const workflow = clean(b.workflowName || 'Workflow', 120);
    const erro = clean(b.error || 'Erro sem mensagem', 300);
    biblioteca.registrar({
      chave: `n8n|${workflow.toLowerCase()}|${erro.toLowerCase().replace(/\d+/g, '#')}`,
      titulo: `${workflow}: ${erro}`.slice(0, 200), sintoma: erro, onde: `n8n · ${clean(b.node || 'nó não informado', 100)}`, origem: 'n8n', tags: 'n8n,erro-execucao',
    }).catch((e) => console.warn('[bot-error-library] n8n:', e?.message || e));
  });
  fastify.post('/agent/monitor/alert', async (request, reply) => {
    if (!api.authorize(request.headers)) return reply.code(401).send({ error: 'Chave do monitor inválida.' });
    try {
      return await api.alert(request.body || {});
    } catch (error) {
      if (error?.statusCode) return reply.code(error.statusCode).send({ error: error.message });
      console.error('[bot-monitor] alert failed:', error?.message || error);
      return reply.code(500).send({ error: 'Falha ao mandar o alerta.' });
    }
  });
  return api;
}

module.exports = { parseAgentCommand, createBotMonitorApi, registerBotMonitorRoutes, summarizeConversations, findDuplicates, responseTimes, clampHours };
