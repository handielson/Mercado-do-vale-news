const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createBotMonitorApi, summarizeConversations, findDuplicates, responseTimes, clampHours, parseAgentCommand } = require('../services/botMonitorApi.cjs');
const { patch } = require('../scripts/deploy-bot-monitor.cjs');

const KEY = 'm'.repeat(40);

test('monitor: chave obrigatória e longa; sem MDV_MONITOR_KEY a rota fica desligada', () => {
  const api = createBotMonitorApi({ pool: {}, key: KEY, fetchImpl: null });
  assert.equal(api.authorize({ 'x-agent-key': KEY }), true);
  assert.equal(api.authorize({ 'x-agent-key': 'errada' }), false);
  assert.equal(api.authorize({}), false);
  assert.equal(createBotMonitorApi({ pool: {}, key: '' }).authorize({ 'x-agent-key': '' }), false);
  assert.equal(createBotMonitorApi({ pool: {}, key: 'curta' }).authorize({ 'x-agent-key': 'curta' }), false);
});

test('janela de horas fica entre 1 e 48 (padrão 24)', () => {
  assert.equal(clampHours(undefined), 24);
  assert.equal(clampHours('0'), 24);
  assert.equal(clampHours('6'), 6);
  assert.equal(clampHours('500'), 48);
});

const rows = [
  { remote_jid: '5587999990001@s.whatsapp.net', phone: '5587999990001', direction: 'inbound', message_text: 'tem capinha?', ts: 1000 },
  { remote_jid: '5587999990001@s.whatsapp.net', phone: '5587999990001', direction: 'outbound', message_text: 'Temos sim!', source_node: 'Controle Bot - Registrar Saida', ts: 1010 },
  { remote_jid: '5587999990001@s.whatsapp.net', phone: '5587999990001', direction: 'inbound', message_text: 'qual valor?', ts: 1100 },
  { remote_jid: '5587999990001@s.whatsapp.net', phone: '5587999990001', direction: 'inbound', message_text: '?', ts: 1200 },
  { remote_jid: '5587999990002@s.whatsapp.net', phone: '5587999990002', direction: 'inbound', message_text: 'oi', ts: 1300 },
  { remote_jid: '5587999990002@s.whatsapp.net', phone: '5587999990002', direction: 'outbound', message_text: 'Olá! Como posso ajudar?', ts: 1305 },
  { remote_jid: '5587999990002@s.whatsapp.net', phone: '5587999990002', direction: 'outbound', message_text: 'Olá! Como posso ajudar?', ts: 1330 },
  { remote_jid: '120363000@g.us', phone: null, direction: 'inbound', message_text: 'grupo', ts: 1400 },
];

test('resumo por conversa: conta o que o cliente mandou sem resposta e ignora grupos', () => {
  const list = summarizeConversations(rows);
  assert.equal(list.length, 2, 'grupo fica de fora');
  const a = list.find((c) => c.phone === '5587999990001');
  assert.equal(a.unanswered_in, 2);
  assert.equal(a.last_in_text, '?');
  assert.equal(a.last_out_at, 1010);
  const b = list.find((c) => c.phone === '5587999990002');
  assert.equal(b.unanswered_in, 0);
});

test('resposta repetida do robô em menos de 2 min vira suspeita de loop; marcador de mídia não conta', () => {
  const d = findDuplicates(rows);
  assert.equal(d.length, 1);
  assert.equal(d[0].gap_sec, 25);
  const midia = [
    { remote_jid: 'x', direction: 'outbound', message_text: '[Áudio enviado pelo atendente]', ts: 1 },
    { remote_jid: 'x', direction: 'outbound', message_text: '[Áudio enviado pelo atendente]', ts: 20 },
  ];
  assert.equal(findDuplicates(midia).length, 0);
});

test('nome do perfil vem da Evolution só para quem não tem nome, e fica guardado', async () => {
  const pedidos = [];
  const fetchImpl = async (url, opt) => { pedidos.push(JSON.parse(opt.body).where.remoteJid); return { json: async () => [{ pushName: 'Carla' }] }; };
  const pool = { async query(sql) {
    if (sql.includes('FROM n8n_bot_messages')) return [[{ remote_jid: 'j1', phone: '5587999990001', direction: 'inbound', message_text: 'oi', ts: 1 }]];
    if (sql.includes('n8n_bot_global_control')) return [[{ paused: 0 }]];
    return [[]];
  } };
  const api = createBotMonitorApi({ pool, key: KEY, fetchImpl, evolution: { url: 'https://e', key: 'k', instance: 'i' } });
  api.evolutionState = async () => ({});
  const s1 = await api.snapshot({});
  assert.equal(s1.conversations[0].contact_name, 'Carla');
  await api.snapshot({});
  assert.deepEqual(pedidos.filter((j) => j === 'j1').length, 1, 'cache evita pedir de novo');
});

test('tempo de resposta do robô usa a primeira mensagem do cliente até a próxima resposta', () => {
  const r = responseTimes(rows);
  assert.equal(r.samples, 2);
  assert.equal(r.p50_sec, 10);
  assert.equal(r.max_sec, 10);
});

test('snapshot junta controles, nome do cadastro e atendimentos abertos sem expor payload', async () => {
  const calls = [];
  const pool = { async query(sql, params) {
    calls.push(sql.replace(/\s+/g, ' '));
    if (sql.includes('FROM n8n_bot_messages')) return [rows];
    if (sql.includes('FROM n8n_bot_client_controls')) return [[{ remote_jid: '5587999990001@s.whatsapp.net', blocked: 0, handoff_until: 2000, human_handoff_by: 'loja' }]];
    if (sql.includes('FROM customers')) return [[{ name: 'João Silva', tail: '99990001' }]];
    if (sql.includes('FROM n8n_bot_handoffs')) return [[{ remote_jid: 'x@s.whatsapp.net', phone: '558700000000', status: 'open', requested_at: 900 }]];
    if (sql.includes('n8n_bot_global_control')) return [[{ paused: 0 }]];
    return [[]];
  } };
  const api = createBotMonitorApi({ pool, key: KEY, fetchImpl: null, now: () => 5000 * 1000 });
  const s = await api.snapshot({ horas: '12' });
  assert.equal(s.hours, 12);
  assert.equal(s.bot_paused, false);
  const a = s.conversations.find((c) => c.phone === '5587999990001');
  assert.equal(a.customer_name, 'João Silva');
  assert.equal(a.handoff_until, 2000);
  assert.equal(s.handoffs_open.length, 1);
  assert.ok(!JSON.stringify(s).includes('payload_json'));
  assert.ok(calls[0].includes("NOW() - INTERVAL ? HOUR"), 'janela pela hora do próprio MySQL');
  assert.ok(!calls.some((c) => /payload_json/.test(c)), 'não lê o payload bruto');
});

test('deploy: ganchos entram uma vez (rotas + comandos do admin), inclusive sobre a v1 já publicada', () => {
  const anchor = "require('./services/agentCostApi.cjs').registerAgentCostRoutes(fastify, { pool, manualCost: productManualCostVps });";
  const admin = "  const relayCommand = normalizeRelayCommand(req.body?.message || req.body?.command || '');\n  if (!identity || (!command.valid && !relayCommand)) return { handled: false, reply: '' };";
  const src = `a\n${anchor}\nb\n${admin}\nc\n`;
  const once = patch(src);
  assert.equal(patch(once), once, 'idempotente');
  assert.ok(once.includes("const botMonitorApiVps = require('./services/botMonitorApi.cjs').registerBotMonitorRoutes(fastify, { pool });"));
  assert.ok(once.indexOf('bot-monitor-commands-v1') > once.indexOf('const relayCommand'), 'comando antes do teste de comando válido');
  const v1 = `a\n${anchor}\n// bot-monitor-v1: x\nrequire('./services/botMonitorApi.cjs').registerBotMonitorRoutes(fastify, { pool });\nb\n${admin}\n`;
  const up = patch(v1);
  assert.equal(up.split('registerBotMonitorRoutes').length - 1, 1, 'v1 vira constante, sem registrar duas vezes');
  assert.throws(() => patch('sem gancho'), /anchor/);
});

test('o código do servidor no repositório registra a rota e os comandos do monitor', () => {
  for (const f of ['vps_server.js', 'vps_server.cjs']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(src.includes("const botMonitorApiVps = require('./services/botMonitorApi.cjs').registerBotMonitorRoutes(fastify, { pool });"), f);
    assert.ok(src.includes('bot-monitor-commands-v1'), f);
  }
});

test('comando "agentes ..." do admin: reconhece ações e ignora o resto', () => {
  assert.deepEqual(parseAgentCommand('agentes'), { action: 'status', target: '' });
  assert.deepEqual(parseAgentCommand('Agentes pausar Alertas'), { action: 'pausar', target: 'alertas' });
  assert.deepEqual(parseAgentCommand('agente aprovar 2'), { action: 'aprovar', target: '2' });
  assert.equal(parseAgentCommand('agentes vendem muito?'), null);
  assert.equal(parseAgentCommand('pausar'), null);
});

test('fila de comandos: grava, entrega uma vez e marca como lido', async () => {
  const sqls = [];
  const pool = { async query(sql, params) {
    sqls.push([sql.replace(/\s+/g, ' '), params]);
    if (sql.startsWith('SELECT id, action')) return [[{ id: 7, action: 'pausar', target: 'alertas', at: 10 }]];
    return [{ affectedRows: 1 }];
  } };
  const api = createBotMonitorApi({ pool, key: KEY, fetchImpl: null });
  const r = await api.enqueueCommand({ command: { action: 'pausar', target: 'alertas' }, admin: { phone: '+55 87 99624-0000' } });
  assert.equal(r.handled, true);
  assert.match(r.reply, /pausar alertas/);
  const c = await api.commands();
  assert.deepEqual(c.commands, [{ id: 7, action: 'pausar', target: 'alertas', at: 10 }]);
  assert.ok(sqls.some(([q, p]) => q.startsWith('UPDATE agent_monitor_commands SET consumed_at') && p[0][0] === 7));
  assert.ok(sqls.some(([q]) => q.includes('CREATE TABLE IF NOT EXISTS agent_monitor_commands')));
});

test('produtos: busca por termo, centavos viram reais, promoção só dentro do prazo, e o estoque', async () => {
  const pool = { async query(sql, params) {
    assert.match(sql, /status = 'active'/);
    assert.equal(params[0], '%redmi 15%');
    return [[{ id: 'p1', name: 'Redmi 15C 128GB', sku: 'R15', price_retail: '99900.00', price_promo: '89900', promo_start: '2026-01-01', promo_end: '2026-12-31', stock_quantity: 3 },
      { id: 'p2', name: 'Redmi 15 256GB', sku: 'R15B', price_retail: '129900.00', price_promo: '100', promo_start: '2025-01-01', promo_end: '2025-02-01', stock_quantity: 0 }]];
  } };
  const api = createBotMonitorApi({ pool, key: KEY, fetchImpl: null, now: () => Date.parse('2026-11-21') });
  const r = await api.products({ q: 'redmi 15' });
  assert.deepEqual(r.products.map((p) => [p.sku, p.price, p.promo_price, p.stock]), [['R15', 999, 899, 3], ['R15B', 1299, null, 0]]);
});

test('produtos: traz a variação (memória e cor) e nunca IMEI ou serial', async () => {
  let sqlVisto = '';
  const pool = { async query(sql) {
    sqlVisto = sql;
    return [[{ id: 'x', name: 'Poco X8 Pro 5G', sku: 'PX8', price_retail: '266000.00', stock_quantity: 1, cor: 'Branco', ram: '8GB', armazenamento: '256GB' },
      { id: 'y', name: 'Capa Poco', sku: 'CP', price_retail: '1490.00', stock_quantity: 2, cor: null, ram: null, armazenamento: null }]];
  } };
  const api = createBotMonitorApi({ pool, key: KEY, fetchImpl: null });
  const r = await api.products({ q: 'poco x8 pro' });
  assert.equal(r.products[0].variant, '8GB/256GB Branco');
  assert.equal(r.products[1].variant, null);
  assert.ok(!/imei|serial/i.test(sqlVisto), 'não lê IMEI nem serial');
  assert.ok(!/imei|serial/i.test(JSON.stringify(r)));
});

test('conversa: separa cliente, robô e equipe, em ordem', async () => {
  const pool = { async query() { return [[
    { direction: 'outbound', message_text: 'Oi! Vou chamar alguém', source_node: 'whatsapp-manual-handoff', ts: 3 },
    { direction: 'outbound', message_text: 'Temos sim', source_node: 'Controle Bot - Registrar Saida', ts: 2 },
    { direction: 'inbound', message_text: 'tem capa?', ts: 1 }]]; } };
  const api = createBotMonitorApi({ pool, key: KEY, fetchImpl: null });
  const r = await api.conversation({ jid: 'x@s.whatsapp.net' });
  assert.deepEqual(r.messages.map((m) => m.from), ['cliente', 'robo', 'equipe']);
  await assert.rejects(api.conversation({}), /não informada/);
});

test('fechar atendimentos antigos: no mínimo 2 h e conta os fechados', async () => {
  let got;
  const pool = { async query(sql, params) { got = [sql, params]; return [{ affectedRows: 5 }]; } };
  const api = createBotMonitorApi({ pool, key: KEY, fetchImpl: null });
  assert.deepEqual(await api.closeHandoffs({ older_than_hours: 1 }), { ok: true, closed: 5, older_than_hours: 2 });
  assert.match(got[0], /status = 'open' AND requested_at < UTC_TIMESTAMP\(\) - INTERVAL \? HOUR/);
});

test('mensagem ao cliente: só para conversa recente e registra como do agente', async () => {
  const sqls = [];
  const pool = { async query(sql, params) { sqls.push(sql); if (sql.startsWith('SELECT phone')) return [params[0] === 'ok@s.whatsapp.net' ? [{ phone: '5587' }] : []]; return [{}]; } };
  const envios = [];
  const fetchImpl = async (url, opt) => { envios.push(JSON.parse(opt.body)); return { ok: true, json: async () => ({ key: { id: 'W1' } }) }; };
  const api = createBotMonitorApi({ pool, key: KEY, fetchImpl, evolution: { url: 'https://e', key: 'k', instance: 'bot' } });
  await assert.rejects(api.sendToCustomer({ remote_jid: 'velho@s.whatsapp.net', text: 'oi' }), /7 dias/);
  await assert.rejects(api.sendToCustomer({ remote_jid: 'g@g.us', text: 'oi' }), /inválido/);
  assert.deepEqual(await api.sendToCustomer({ remote_jid: 'ok@s.whatsapp.net', text: 'Oi!' }), { ok: true });
  assert.deepEqual(envios, [{ number: 'ok', text: 'Oi!' }]);
  assert.ok(sqls.some((q) => q.includes("'agente-servidor-aprovado'")));
});

test('alerta: manda para os admins ativos, segura repetição e respeita limite por hora', async () => {
  const envios = [];
  const fetchImpl = async (url, opt) => { envios.push({ url, body: JSON.parse(opt.body) }); return { ok: true, json: async () => ({}) }; };
  const pool = { async query(sql) { assert.match(sql, /n8n_bot_admin_numbers WHERE active = 1/); return [[{ phone: '+55 87 99624-0000' }, { phone: '5587996240000' }]]; } };
  let t = 0;
  const api = createBotMonitorApi({ pool, key: KEY, fetchImpl, evolution: { url: 'https://e', key: 'k', instance: 'bot' }, now: () => t });
  const r = await api.alert({ text: 'Evolution caiu' });
  assert.deepEqual([r.ok, r.sent, envios.length], [true, 1, 1], 'mesmo número em formatos diferentes vira um só');
  assert.match(envios[0].url, /message\/sendText\/bot$/);
  assert.equal(envios[0].body.number, '5587996240000');
  assert.equal((await api.alert({ text: 'Evolution caiu' })).skipped, 'repetido');
  t = 21 * 60e3;
  assert.equal((await api.alert({ text: 'Evolution caiu' })).sent, 1, 'depois de 20 min pode repetir');
  for (let i = 0; i < 40; i++) await api.alert({ text: `x${i}` });
  assert.equal((await api.alert({ text: 'mais um' })).skipped, 'limite_hora');
  await assert.rejects(api.alert({ text: '  ' }), /vazio/);
});
