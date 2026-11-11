'use strict';

// bot-error-alerts-v1 (11/11/2026): um alerta por incidente do bot, em vez de um por execução com erro.
// O workflow de erros do n8n manda cada falha para cá; a API agrupa por workflow + erro (o nó varia na mesma pane):
//  - 1ª falha: avisa na hora;
//  - mais falhas iguais: só conta (lembrete a cada 30 min se continuar);
//  - 10 min sem falhas: manda o resumo "parou" com o total.
// Antes o agrupamento ficava nos dados estáticos do n8n, que não seguravam execuções paralelas (09:39 de 11/11:
// ~20 mensagens iguais) e nem gravavam quando o próprio banco do n8n estava sem conexão.

const QUIET_MS = 10 * 60 * 1000;
const REMINDER_MS = 30 * 60 * 1000;

const clean = (value, limit) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
const errorKey = (workflow, error) => `${clean(workflow, 160).toLowerCase()}|${clean(error, 300).toLowerCase().replace(/\d+/g, '#')}`;
const clock = (ms, timeZone = 'America/Recife') => new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
const phones = (list) => [...new Set((Array.isArray(list) ? list : []).map((value) => String(value || '').replace('@s.whatsapp.net', '').replace(/\D/g, '')).filter((value) => value.length >= 10))];

function createBotErrorAlerts({ send, now = () => Date.now(), quietMs = QUIET_MS, reminderMs = REMINDER_MS } = {}) {
  const incidents = new Map();
  const deliver = async (numbers, text) => {
    const results = await Promise.allSettled(numbers.map((number) => send(number, text)));
    return results.filter((result) => result.status === 'fulfilled').length;
  };

  async function report(input = {}) {
    const at = now();
    const workflow = clean(input.workflowName || 'Workflow desconhecido', 160);
    const error = clean(input.error || 'Erro sem mensagem', 900);
    const node = clean(input.node || 'Nao informado', 160);
    const executionId = clean(input.executionId, 80);
    const executionUrl = clean(input.executionUrl, 500);
    const admins = phones(input.admins);
    const key = errorKey(workflow, error);
    let incident = incidents.get(key);
    if (incident && at - incident.lastAt > quietMs) { await finish(key, incident); incident = null; }
    if (!incident) {
      incident = { key, workflow, error, firstAt: at, lastAt: at, count: 1, nodes: new Set([node]), admins, lastExecutionId: executionId, lastReminderAt: at };
      incidents.set(key, incident);
      const text = [
        '⚠️ Falha no bot do Mercado do Vale', '',
        `Workflow: ${workflow}`, `Nó: ${node}`, `Erro: ${error}`,
        executionId ? `Execução: ${executionId}` : '', executionUrl ? `Abrir: ${executionUrl}` : '', '',
        'Se continuar, eu agrupo as falhas iguais e aviso o total quando parar.',
      ].filter((line, index, lines) => line !== '' || lines[index - 1] !== '').join('\n').trim();
      return { sent: await deliver(admins, text), grouped: false, count: 1 };
    }
    incident.count += 1;
    incident.lastAt = at;
    incident.nodes.add(node);
    incident.lastExecutionId = executionId || incident.lastExecutionId;
    for (const admin of admins) if (!incident.admins.includes(admin)) incident.admins.push(admin);
    if (at - incident.lastReminderAt >= reminderMs) {
      incident.lastReminderAt = at;
      const text = `⚠️ O bot continua com falhas: ${incident.count} desde ${clock(incident.firstAt)}.\nErro: ${incident.error}${incident.lastExecutionId ? `\nÚltima execução: ${incident.lastExecutionId}` : ''}`;
      return { sent: await deliver(incident.admins, text), grouped: true, count: incident.count };
    }
    return { sent: 0, grouped: true, count: incident.count };
  }

  async function finish(key, incident) {
    incidents.delete(key);
    if (incident.count < 2) return 0;
    const text = `✅ As falhas do bot pararam: ${incident.count} falhas iguais entre ${clock(incident.firstAt)} e ${clock(incident.lastAt)}.\nErro: ${incident.error}${incident.lastExecutionId ? `\nÚltima execução: ${incident.lastExecutionId}` : ''}`;
    return deliver(incident.admins, text);
  }

  async function sweep() {
    const at = now();
    let sent = 0;
    for (const [key, incident] of [...incidents]) if (at - incident.lastAt > quietMs) sent += await finish(key, incident);
    return sent;
  }

  const snapshot = () => [...incidents.values()].map(({ nodes, admins, ...incident }) => ({ ...incident, nodes: [...nodes], admins: admins.length }));
  return { report, sweep, snapshot };
}

function registerBotErrorAlertRoutes(fastify, { guard, evolutionUrl, evolutionKey, instanceName, fetchImpl = globalThis.fetch, logger = console } = {}) {
  const send = async (number, text) => {
    const response = await fetchImpl(`${String(evolutionUrl || '').replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(instanceName)}`, {
      method: 'POST', headers: { 'content-type': 'application/json', apikey: evolutionKey }, body: JSON.stringify({ number, text }), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Evolution respondeu ${response.status}`);
  };
  const alerts = createBotErrorAlerts({ send });
  const timer = setInterval(() => { alerts.sweep().catch((error) => logger.warn?.('[bot-error-alerts] resumo falhou:', error?.message || error)); }, 60 * 1000);
  timer.unref?.();
  fastify.post('/n8n-bot/error-alerts', { preHandler: guard }, async (req, reply) => {
    if (!evolutionUrl || !evolutionKey || !instanceName) return reply.code(503).send({ ok: false, error: 'Evolution não configurada na API' });
    return { ok: true, ...(await alerts.report(req.body || {})) };
  });
  fastify.get('/n8n-bot/error-alerts', { preHandler: guard }, async () => ({ ok: true, incidents: alerts.snapshot() }));
  return alerts;
}

module.exports = { QUIET_MS, REMINDER_MS, createBotErrorAlerts, registerBotErrorAlertRoutes };
