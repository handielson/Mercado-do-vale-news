'use strict';
// bot-monitor-v1: publica só a rota de leitura do monitor do robô (services/botMonitorApi.cjs) e o gancho dela,
// aplicado sobre os arquivos que já estão na VPS (não sobe o vps_server.js inteiro).
// Uso: node deploy-vps-server-only.cjs --bot-monitor-only   (ou --bot-monitor-check para só conferir)
const openAiFinance = require('./deploy-openai-finance.cjs');

const ANCHOR = "require('./services/agentCostApi.cjs').registerAgentCostRoutes(fastify, { pool, manualCost: productManualCostVps });";
const HOOK = "// bot-monitor-v1: leitura para os agentes de monitoramento do robô (painel do servidor de casa), chave MDV_MONITOR_KEY.\nrequire('./services/botMonitorApi.cjs').registerBotMonitorRoutes(fastify, { pool });";

function patch(source) {
  const next = String(source).replace(/\r\n/g, '\n');
  if (next.includes("require('./services/botMonitorApi.cjs')")) return next;
  if (next.split(ANCHOR).length !== 2) throw Error('Agent cost anchor drift');
  return next.replace(ANCHOR, `${ANCHOR}\n${HOOK}`);
}

function deploy(ctx) {
  return openAiFinance.deploy({ ...ctx, patchSource: patch, moduleFiles: ['services/botMonitorApi.cjs'], backupSlug: 'bot-monitor' });
}

module.exports = { patch, deploy, HOOK };
