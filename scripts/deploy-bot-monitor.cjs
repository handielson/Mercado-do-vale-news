'use strict';
// bot-monitor-v1/v2: publica a rota de leitura do monitor do robô (services/botMonitorApi.cjs) e os ganchos dela,
// aplicados sobre os arquivos que já estão na VPS (não sobe o vps_server.js inteiro).
//  - v1: registra as rotas /agent/monitor/* logo depois do agente de custo;
//  - v2 (bot-monitor-commands-v1): guarda a api numa constante e, em /n8n-bot/admin-command, manda os comandos
//    "agentes ..." do admin para a fila dos agentes do servidor de casa.
// Uso: node deploy-vps-server-only.cjs --bot-monitor-only   (ou --bot-monitor-check para só conferir)
const openAiFinance = require('./deploy-openai-finance.cjs');

const ANCHOR = "require('./services/agentCostApi.cjs').registerAgentCostRoutes(fastify, { pool, manualCost: productManualCostVps });";
const COMMENT = "// bot-monitor-v1: leitura para os agentes de monitoramento do robô (painel do servidor de casa), chave MDV_MONITOR_KEY.";
const HOOK_V1 = "require('./services/botMonitorApi.cjs').registerBotMonitorRoutes(fastify, { pool });";
const HOOK = "const botMonitorApiVps = require('./services/botMonitorApi.cjs').registerBotMonitorRoutes(fastify, { pool });";
const CMD_ANCHOR = "  const relayCommand = normalizeRelayCommand(req.body?.message || req.body?.command || '');\n  if (!identity || (!command.valid && !relayCommand)) return { handled: false, reply: '' };";
const CMD_MARK = 'bot-monitor-commands-v1';
const CMD = [
  "  const relayCommand = normalizeRelayCommand(req.body?.message || req.body?.command || '');",
  `  // ${CMD_MARK}: "agentes ..." do admin vai para a fila dos agentes do servidor de casa.`,
  "  const agentCommand = require('./services/botMonitorApi.cjs').parseAgentCommand(req.body?.message || req.body?.command || '');",
  '  if (identity && agentCommand) {',
  '    const agentAdmin = await findN8nBotAdminByIdentity(identity);',
  '    if (agentAdmin) return botMonitorApiVps.enqueueCommand({ command: agentCommand, admin: agentAdmin });',
  '  }',
  "  if (!identity || (!command.valid && !relayCommand)) return { handled: false, reply: '' };",
].join('\n');

function once(src, a, b, label) {
  const n = src.split(a).length - 1;
  if (n !== 1) throw Error(`${label} anchor drift (${n})`);
  return src.replace(a, () => b);
}

// v3 (bot-monitor-commands-v2): comando dos agentes digitado no WhatsApp da loja, na conversa do admin
// (chega como mensagem manual da equipe em /n8n-bot/client-control/handoff), vai para a fila em vez de abrir atendimento humano.
const HANDOFF_ANCHOR = "  const handoffBy = String(body.handoffBy || 'whatsapp-manual').trim().slice(0, 120) || 'whatsapp-manual';\n";
const HANDOFF_MARK = 'bot-monitor-commands-v2';
const HANDOFF = HANDOFF_ANCHOR + [
  `  // ${HANDOFF_MARK}: "agentes aprovar 17" / "17 aprovar" digitado pela loja na conversa do admin vai para os agentes.`,
  "  const agentCommandManual = require('./services/botMonitorApi.cjs').parseAgentCommand(message);",
  '  if (agentCommandManual) {',
  '    const agentAdminManual = await findN8nBotAdminByIdentity(identity);',
  '    if (agentAdminManual) return { ok: true, agentCommand: true, ...(await botMonitorApiVps.enqueueCommand({ command: agentCommandManual, admin: agentAdminManual })) };',
  '  }',
].join('\n') + '\n';

function patch(source) {
  let next = String(source).replace(/\r\n/g, '\n');
  if (!next.includes(HOOK)) {
    if (next.includes(HOOK_V1)) next = once(next, HOOK_V1, HOOK, 'Monitor hook');
    else next = once(next, ANCHOR, `${ANCHOR}\n${COMMENT}\n${HOOK}`, 'Agent cost');
  }
  if (!next.includes(CMD_MARK)) next = once(next, CMD_ANCHOR, CMD, 'Admin command');
  if (!next.includes(HANDOFF_MARK)) next = once(next, HANDOFF_ANCHOR, HANDOFF, 'Manual handoff');
  return next;
}

function deploy(ctx) {
  return openAiFinance.deploy({ ...ctx, patchSource: patch, moduleFiles: ['services/agentMonitorLock.cjs', 'services/botErrorLibrary.cjs', 'services/botMonitorApi.cjs'], backupSlug: 'bot-monitor' });
}

module.exports = { patch, deploy, HOOK, CMD_MARK, HANDOFF_MARK };
