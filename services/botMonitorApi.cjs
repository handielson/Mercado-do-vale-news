'use strict';

// bot-monitor-v1 (21/11/2026): leitura para os agentes de monitoramento do robô (painel do servidor de casa).
// - só leitura; acesso com a chave MDV_MONITOR_KEY no cabeçalho x-agent-key (sem a variável, a rota fica desligada);
// - GET /agent/monitor/snapshot?horas=N (1 a 48, padrão 24): conversas recentes do robô (n8n_bot_messages),
//   controles por cliente (pausa humana/bloqueio), atendimentos humanos abertos, respostas repetidas,
//   tempo de resposta do robô e estado da instância da Evolution.
// Telefone e texto saem truncados; nada de payload bruto.

const crypto = require('node:crypto');

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

  return { authorize, snapshot, evolutionState };
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
  return api;
}

module.exports = { createBotMonitorApi, registerBotMonitorRoutes, summarizeConversations, findDuplicates, responseTimes, clampHours };
