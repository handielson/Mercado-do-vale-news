'use strict';

// bot-error-alerts-v1: o workflow "Mercado do Vale - Erros do Bot WhatsApp" (mdvBotError2026a) passa a mandar cada falha
// para a API (POST /n8n-bot/error-alerts), que agrupa por incidente e avisa os administradores.
// Se a API não responder, a saída de erro do nó cai no alerta direto pela Evolution (comportamento antigo, sem agrupar).

const MARK = 'bot-error-alerts-v1';
const WORKFLOW_ID = 'mdvBotError2026a';
const API_URL = 'https://api.xiaomipetrolina.com.br/n8n-bot/error-alerts';
const N = {
  trigger: 'Erro do workflow', admins: 'Erros - Buscar administradores', prepare: 'Erros - Preparar alerta',
  api: 'Erros - Agrupar na API', direct: 'Erros - Alerta direto', send: 'Erros - Avisar administradores',
};

const PREPARE = `// ${MARK}: uma falha -> um item para a API agrupar por incidente.
const failure = $('${N.trigger}').first().json || {};
const admins = Array.isArray($json.adminNumbers) ? $json.adminNumbers : [];
const execution = failure.execution || {};
const workflow = failure.workflow || {};
const error = execution.error || {};
const clean = (value, limit) => String(value || '').replace(/[\\u0000-\\u001f\\u007f]/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, limit);
const numbers = [...new Set(admins
  .filter((admin) => admin && admin.active !== false && Number(admin.active) !== 0)
  .map((admin) => String(admin.phone || admin.remote_jid || '').replace('@s.whatsapp.net', '').replace(/\\D/g, ''))
  .filter(Boolean))];
if (!numbers.length) return [];
return [{ json: {
  workflowName: clean(workflow.name || workflow.id || 'Workflow desconhecido', 160),
  node: clean(execution.lastNodeExecuted || 'Nao informado', 160),
  error: clean(error.message || error.description || 'Erro sem mensagem', 900),
  executionId: clean(execution.id || '', 80),
  executionUrl: clean(execution.url || '', 500),
  admins: numbers,
} }];`;

const DIRECT = `// ${MARK}: a API não respondeu; avisa direto pela Evolution (sem agrupar).
const alert = $('${N.prepare}').first().json || {};
const text = [
  '⚠️ Falha no bot do Mercado do Vale', '',
  'Workflow: ' + alert.workflowName, 'Nó: ' + alert.node, 'Erro: ' + alert.error,
  alert.executionId ? 'Execução: ' + alert.executionId : '', alert.executionUrl ? 'Abrir: ' + alert.executionUrl : '',
  '(alerta direto: a API de agrupamento não respondeu)',
].filter(Boolean).join('\\n').slice(0, 3500);
return (alert.admins || []).map((number) => ({ json: { number, text } }));`;

function patchErrorWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const find = (name) => next.nodes.find((node) => node.name === name);
  for (const name of [N.trigger, N.admins, N.prepare, N.send]) if (!find(name)) throw new Error(`Nó ausente: ${name}`);
  if (find(N.api)) return next; // já aplicado
  const prepare = find(N.prepare);
  prepare.parameters = { ...prepare.parameters, jsCode: PREPARE };
  const send = find(N.send);
  next.nodes.push({
    id: 'mdv-bot-error-group-api', name: N.api, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [800, -120], onError: 'continueErrorOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 2000,
    parameters: {
      method: 'POST', url: API_URL, sendHeaders: true,
      headerParameters: { parameters: [{ name: 'x-sync-key', value: '={{$env.SYNC_SECRET}}' }] },
      sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json) }}', options: { timeout: 15000 },
    },
  });
  next.nodes.push({ id: 'mdv-bot-error-direct', name: N.direct, type: 'n8n-nodes-base.code', typeVersion: 2, position: [1040, 80], parameters: { jsCode: DIRECT } });
  send.position = [1280, 80];
  next.connections[N.prepare] = { main: [[{ node: N.api, type: 'main', index: 0 }]] };
  next.connections[N.api] = { main: [[], [{ node: N.direct, type: 'main', index: 0 }]] };
  next.connections[N.direct] = { main: [[{ node: N.send, type: 'main', index: 0 }]] };
  return next;
}

module.exports = { MARK, WORKFLOW_ID, API_URL, NAMES: N, PREPARE, DIRECT, patchErrorWorkflow };
