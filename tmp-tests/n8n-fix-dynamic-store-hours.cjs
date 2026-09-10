const assert = require('node:assert/strict');
const vm = require('node:vm');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MARKER = 'dynamic-store-hours-v364';
const APPLY = process.argv.includes('--apply');
const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function run(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0
      ? resolve(stdout)
      : reject(new Error(stderr || stdout || `remote command failed: ${code}`)));
  }));
}

function psql(connection, container, sql) {
  return new Promise((resolve, reject) => {
    connection.exec(`docker exec -i ${shQuote(container)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0
        ? resolve(stdout)
        : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
      stream.end(sql);
    });
  });
}

async function waitService(connection, service, expected, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await run(connection, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}

function findNode(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  assert.ok(node, `Node not found: ${name}`);
  return node;
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  assert.notEqual(first, -1, `Anchor not found: ${label}`);
  assert.equal(source.indexOf(search, first + search.length), -1, `Anchor duplicated: ${label}`);
  return source.replace(search, replacement);
}

const storeHoursCode = `return (async () => {
// ${MARKER}:store-specialist
const source = $json || {};
const lineBreak = '[[BR]]';
const normalize = (value) => String(value || '')
  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
const validTime = (value) => /^([01]\\d|2[0-3]):[0-5]\\d$/.test(String(value || '')) ? String(value) : '';
const parseHours = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed : null; } catch { return null; }
};
const scheduleOf = (hours, key) => {
  const row = hours?.[key];
  if (!row || typeof row !== 'object' || typeof row.isOpen !== 'boolean') return null;
  const schedule = {
    isOpen: row.isOpen,
    openTime: validTime(row.openTime),
    closeTime: validTime(row.closeTime),
    hasLunchBreak: row.hasLunchBreak === true,
    lunchStart: validTime(row.lunchStart),
    lunchEnd: validTime(row.lunchEnd),
  };
  if (schedule.isOpen && (!schedule.openTime || !schedule.closeTime)) return null;
  if (schedule.hasLunchBreak && (!schedule.lunchStart || !schedule.lunchEnd)) return null;
  return schedule;
};
const minutesOf = (value) => { const [hour, minute] = String(value).split(':').map(Number); return hour * 60 + minute; };
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const dayNames = { sunday: 'domingo', monday: 'segunda-feira', tuesday: 'terca-feira', wednesday: 'quarta-feira', thursday: 'quinta-feira', friday: 'sexta-feira', saturday: 'sabado' };
const local = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Recife' }));
const todayKey = days[local.getDay()];
const currentMinutes = local.getHours() * 60 + local.getMinutes();
const text = normalize(source.conversation || source.classificacaoMensagem || '');
const asksLunch = /\\b(almoco|pausa)\\b/.test(text);
const asksClose = /\\b(fecha|fecham|ate que horas|ate quando)\\b/.test(text);
const asksOpen = /\\b(abre|abrem|que horas abre)\\b/.test(text);
let businessHours = null;
try {
  const response = await fetch('https://api.xiaomipetrolina.com.br/public/company-settings', { headers: { Accept: 'application/json' } });
  if (response.ok) {
    const data = await response.json();
    const row = Array.isArray(data) ? data[0] : (data?.rows?.[0] || data);
    businessHours = parseHours(row?.business_hours);
  }
} catch {}
const today = scheduleOf(businessHours, todayKey);
if (!today) {
  return [{ json: { ...source, output: 'Nao consegui consultar o horario cadastrado da loja agora.' + lineBreak + 'Vou pedir para um atendente confirmar para voce.' } }];
}
const nextOpenDay = () => {
  for (let offset = 1; offset <= 7; offset += 1) {
    const key = days[(local.getDay() + offset) % 7];
    const schedule = scheduleOf(businessHours, key);
    if (schedule?.isOpen) return { key, schedule };
  }
  return null;
};
let output = '';
if (!today.isOpen) {
  const next = nextOpenDay();
  output = next
    ? 'Hoje a loja esta fechada.' + lineBreak + 'Voltamos na ' + dayNames[next.key] + ' as ' + next.schedule.openTime + '.'
    : 'Hoje a loja esta fechada.' + lineBreak + 'Vou pedir para um atendente confirmar o proximo horario.';
} else if (asksLunch) {
  output = today.hasLunchBreak
    ? 'Hoje a pausa para almoco e de ' + today.lunchStart + ' ate ' + today.lunchEnd + '.'
    : 'Hoje nao ha pausa para almoco cadastrada no horario da loja.';
} else if (asksClose) {
  output = 'Hoje fechamos as ' + today.closeTime + '.';
  if (today.hasLunchBreak) output += lineBreak + 'A pausa para almoco e de ' + today.lunchStart + ' ate ' + today.lunchEnd + '.';
} else if (asksOpen) {
  output = 'Hoje abrimos as ' + today.openTime + ' e fechamos as ' + today.closeTime + '.';
  if (today.hasLunchBreak) output += lineBreak + 'A pausa para almoco e de ' + today.lunchStart + ' ate ' + today.lunchEnd + '.';
} else {
  const inLunch = today.hasLunchBreak && currentMinutes >= minutesOf(today.lunchStart) && currentMinutes < minutesOf(today.lunchEnd);
  const isOpenNow = currentMinutes >= minutesOf(today.openTime) && currentMinutes < minutesOf(today.closeTime) && !inLunch;
  if (inLunch) output = 'Agora estamos em pausa para almoco.' + lineBreak + 'Voltamos hoje as ' + today.lunchEnd + '.';
  else if (isOpenNow) output = 'Estamos abertos agora.' + lineBreak + 'Hoje atendemos ate ' + today.closeTime + '.';
  else if (currentMinutes < minutesOf(today.openTime)) output = 'Agora a loja ainda esta fechada.' + lineBreak + 'Hoje abrimos as ' + today.openTime + '.';
  else {
    const next = nextOpenDay();
    output = 'Agora a loja ja esta fechada.' + lineBreak + (next
      ? 'Voltamos na ' + dayNames[next.key] + ' as ' + next.schedule.openTime + '.'
      : 'Vou pedir para um atendente confirmar o proximo horario.');
  }
}
return [{ json: { ...source, output } }];
})();`;

const attendantHoursCode = `return (async () => {
// ${MARKER}:human-handoff
const source = $json || {};
const lineBreak = '[[BR]]';
const validTime = (value) => /^([01]\\d|2[0-3]):[0-5]\\d$/.test(String(value || '')) ? String(value) : '';
const parseHours = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed : null; } catch { return null; }
};
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const local = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Recife' }));
const todayKey = days[local.getDay()];
let today = null;
try {
  const response = await fetch('https://api.xiaomipetrolina.com.br/public/company-settings', { headers: { Accept: 'application/json' } });
  if (response.ok) {
    const data = await response.json();
    const row = Array.isArray(data) ? data[0] : (data?.rows?.[0] || data);
    const hours = parseHours(row?.business_hours);
    const value = hours?.[todayKey];
    if (value && typeof value.isOpen === 'boolean') today = {
      isOpen: value.isOpen,
      openTime: validTime(value.openTime), closeTime: validTime(value.closeTime),
      hasLunchBreak: value.hasLunchBreak === true,
      lunchStart: validTime(value.lunchStart), lunchEnd: validTime(value.lunchEnd),
    };
    if (today?.isOpen && (!today.openTime || !today.closeTime)) today = null;
    if (today?.hasLunchBreak && (!today.lunchStart || !today.lunchEnd)) today = null;
  }
} catch {}
let availability = 'Nao consegui consultar o horario cadastrado agora; um atendente confirma assim que abrir a conversa.';
if (today) {
  if (!today.isOpen) availability = 'Hoje a loja esta fechada, conforme o horario cadastrado.';
  else {
    const minutesOf = (value) => { const [hour, minute] = String(value).split(':').map(Number); return hour * 60 + minute; };
    const current = local.getHours() * 60 + local.getMinutes();
    const inLunch = today.hasLunchBreak && current >= minutesOf(today.lunchStart) && current < minutesOf(today.lunchEnd);
    const openNow = current >= minutesOf(today.openTime) && current < minutesOf(today.closeTime) && !inLunch;
    if (openNow) availability = 'Estamos em horario de atendimento agora.';
    else if (inLunch) availability = 'Estamos na pausa cadastrada e voltamos hoje as ' + today.lunchEnd + '.';
    else if (current < minutesOf(today.openTime)) availability = 'Hoje o atendimento comeca as ' + today.openTime + '.';
    else availability = 'O atendimento de hoje encerrou as ' + today.closeTime + '.';
  }
}
return [{ json: { ...source, output: 'Vou chamar um atendente para continuar com voce por aqui.' + lineBreak + availability + lineBreak + 'Mesmo assim, a qualquer momento um atendente pode abrir a conversa e responder por aqui.' } }];
})();`;

function patchParseClassifier(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`${MARKER}:classifier`)) return;
  code = replaceOnce(
    code,
    "const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'formas_pagamento', 'entrega_frete', 'fallback', 'localizacao_loja']);",
    "const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'formas_pagamento', 'entrega_frete', 'horario_loja', 'fallback', 'localizacao_loja']);",
    'classifier allowed intents',
  );
  const intentAnchor = `const intencao = deliveryFreightIntentV337
  ? 'entrega_frete'`;
  const replacement = `// ${MARKER}:classifier
const storeHoursTermsV364 = /\\b(?:horario|funcionamento|abre|abrem|abrir|aberto|aberta|fechado|fechada|fecha|fecham|expediente|almoco|pausa)\\b/.test(usedPolicyNormalizedV161);
const storeHoursSubjectV364 = /\\b(?:loja|vcs|voces|voce|mercado do vale|agora|hoje|que horas|hora|sai|saem|volta|voltam)\\b/.test(usedPolicyNormalizedV161);
const storeHoursIntentV364 = storeHoursTermsV364 && storeHoursSubjectV364;
const intencao = storeHoursIntentV364
  ? 'horario_loja'
  : (deliveryFreightIntentV337
  ? 'entrega_frete'`;
  code = replaceOnce(code, intentAnchor, replacement, 'classifier intent priority');
  code = replaceOnce(
    code,
    ": (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback')));",
    ": (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback'))));",
    'classifier parenthesis',
  );
  new Function('$json', '$', code);
  node.parameters.jsCode = code;
}

function patchSalesContext(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`${MARKER}:sales-context`)) return;
  assert.ok(code.trim().endsWith('}];'), 'Sales context return anchor changed');
  code = replaceOnce(code, 'const source = $json;', `return (async () => {
// ${MARKER}:sales-context
const source = $json;`, 'sales context wrapper');
  const returnAnchor = `return [{
  json: {`;
  const helper = `const dayNamesV364 = { monday: 'segunda-feira', tuesday: 'terca-feira', wednesday: 'quarta-feira', thursday: 'quinta-feira', friday: 'sexta-feira', saturday: 'sabado', sunday: 'domingo' };
const orderedDaysV364 = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const validTimeV364 = (value) => /^([01]\\d|2[0-3]):[0-5]\\d$/.test(String(value || '')) ? String(value) : '';
const loadStoreHoursV364 = async () => {
  try {
    const response = await fetch('https://api.xiaomipetrolina.com.br/public/company-settings', { headers: { Accept: 'application/json' } });
    if (!response.ok) return 'HORARIO_OFICIAL_INDISPONIVEL';
    const data = await response.json();
    const row = Array.isArray(data) ? data[0] : (data?.rows?.[0] || data);
    let hours = row?.business_hours;
    if (typeof hours === 'string') { try { hours = JSON.parse(hours); } catch { return 'HORARIO_OFICIAL_INDISPONIVEL'; } }
    if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return 'HORARIO_OFICIAL_INDISPONIVEL';
    const lines = orderedDaysV364.map((key) => {
      const schedule = hours[key];
      if (!schedule || typeof schedule.isOpen !== 'boolean') return '';
      if (!schedule.isOpen) return dayNamesV364[key] + ': fechado';
      const open = validTimeV364(schedule.openTime);
      const close = validTimeV364(schedule.closeTime);
      if (!open || !close) return '';
      let line = dayNamesV364[key] + ': ' + open + '-' + close;
      if (schedule.hasLunchBreak === true) {
        const lunchStart = validTimeV364(schedule.lunchStart);
        const lunchEnd = validTimeV364(schedule.lunchEnd);
        if (!lunchStart || !lunchEnd) return '';
        line += '; almoco ' + lunchStart + '-' + lunchEnd;
      } else line += '; sem pausa de almoco cadastrada';
      return line;
    }).filter(Boolean);
    return lines.length === orderedDaysV364.length ? lines.join(' | ') : 'HORARIO_OFICIAL_INDISPONIVEL';
  } catch { return 'HORARIO_OFICIAL_INDISPONIVEL'; }
};
const storeHoursContextV364 = await loadStoreHoursV364();

${returnAnchor}`;
  code = replaceOnce(code, returnAnchor, helper, 'sales context dynamic hours');
  code = replaceOnce(code, `    salesConversationState: activeState ? {`, `    storeHoursContext: storeHoursContextV364,
    salesConversationState: activeState ? {`, 'sales context output');
  code = `${code.trim()}\n})();`;
  new Function('$json', '$getWorkflowStaticData', 'fetch', code);
  node.parameters.jsCode = code;
}

function patchSalesAgent(node) {
  let text = String(node.parameters?.text || '');
  if (!text.includes(`${MARKER}:agent-input`)) {
    text = replaceOnce(
      text,
      `  + 'Status deterministico da consulta: ' + $('Vendas - Contexto Produtos').first().json.salesAvailabilityStatus + '\\n'`,
      `  + 'Status deterministico da consulta: ' + $('Vendas - Contexto Produtos').first().json.salesAvailabilityStatus + '\\n'
  + 'Horario oficial cadastrado no sistema: ' + ($('Vendas - Preparar Contexto IA').first().json.storeHoursContext || 'HORARIO_OFICIAL_INDISPONIVEL') + '\\n' // ${MARKER}:agent-input`,
      'sales agent official hours input',
    );
    node.parameters.text = text;
  }
  const options = node.parameters.options || (node.parameters.options = {});
  let prompt = String(options.systemMessage || '');
  if (!prompt.includes(`${MARKER}:agent-rule`)) {
    prompt = replaceOnce(
      prompt,
      '- Use somente os fatos recebidos. Nao invente nem deduza estoque, preco, produto, cor, memoria, link, prazo, disponibilidade ou caracteristica tecnica.',
      `- Use somente os fatos recebidos. Nao invente nem deduza estoque, preco, produto, cor, memoria, link, prazo, disponibilidade ou caracteristica tecnica.
- Horario de abertura, fechamento e almoco so pode vir do campo "Horario oficial cadastrado no sistema". Nunca use memoria da conversa, conhecimento geral ou suposicao para informar horario. Se o campo estiver HORARIO_OFICIAL_INDISPONIVEL, nao cite nenhum horario: diga que um atendente precisa confirmar. // ${MARKER}:agent-rule`,
      'sales agent official hours rule',
    );
    options.systemMessage = prompt;
  }
}

function patchWorkflow(workflow) {
  patchParseClassifier(findNode(workflow.nodes, 'Parse Classificacao'));
  findNode(workflow.nodes, 'Loja - Horario Atendimento').parameters.jsCode = storeHoursCode;
  findNode(workflow.nodes, 'Atendente - Horario').parameters.jsCode = attendantHoursCode;
  patchSalesContext(findNode(workflow.nodes, 'Vendas - Preparar Contexto IA'));
  patchSalesAgent(findNode(workflow.nodes, 'Especialista - Vendas'));
  return workflow;
}

const registeredHoursFixture = {
  monday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  tuesday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  wednesday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  thursday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  friday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  saturday: { isOpen: true, openTime: '08:00', closeTime: '14:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:30' },
  sunday: { isOpen: false, openTime: '08:00', closeTime: '12:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:30' },
};

class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-09-10T15:30:00.000Z'])); }
  static now() { return new Date('2026-09-10T15:30:00.000Z').getTime(); }
}

async function validate(workflow) {
  for (const node of workflow.nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
    if (node.parameters?.jsCode) new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', 'fetch', node.parameters.jsCode);
  }

  const parseCode = findNode(workflow.nodes, 'Parse Classificacao').parameters.jsCode;
  const classify = (conversation, modelIntent) => vm.runInNewContext(`(function(){${parseCode}})()`, {
    $json: { output: JSON.stringify({ intencao: modelIntent, mensagem: conversation, venda: {}, fluxo_venda: {} }) },
    $: () => ({ first: () => ({ json: { conversation, recentMessages: [] } }) }),
    Date: FixedDate,
  })[0].json.intencao;
  assert.equal(classify('Vcs sai pra o almoço que horas?', 'pedido_humano'), 'horario_loja');
  assert.equal(classify('Eu ia depois do almoço', 'vendas_produtos'), 'vendas_produtos');

  const fetchOk = async () => ({ ok: true, json: async () => ({ business_hours: registeredHoursFixture }) });
  const direct = await vm.runInNewContext(`(async function(){${storeHoursCode}})()`, {
    $json: { conversation: 'Vcs sai pra o almoço que horas?' }, fetch: fetchOk, Date: FixedDate,
  });
  assert.match(direct[0].json.output, /12:00.*14:00/);
  const unavailable = await vm.runInNewContext(`(async function(){${storeHoursCode}})()`, {
    $json: { conversation: 'Qual o horario de almoço?' }, fetch: async () => { throw new Error('offline'); }, Date: FixedDate,
  });
  assert.match(unavailable[0].json.output, /Nao consegui consultar o horario cadastrado/);
  assert.doesNotMatch(unavailable[0].json.output, /\\b(?:12|13|14):00\\b/);

  const salesContextCode = findNode(workflow.nodes, 'Vendas - Preparar Contexto IA').parameters.jsCode;
  const salesContext = await vm.runInNewContext(`(async function(){${salesContextCode}})()`, {
    $json: { conversation: 'Eu ia depois do almoço', remoteJid: '559999999999@s.whatsapp.net' },
    $getWorkflowStaticData: () => ({}), fetch: fetchOk, Date: FixedDate,
  });
  assert.match(salesContext[0].json.storeHoursContext, /quinta-feira: 08:00-18:00; almoco 12:00-14:00/);

  const agent = findNode(workflow.nodes, 'Especialista - Vendas');
  assert.ok(agent.parameters.text.includes(`${MARKER}:agent-input`));
  assert.ok(agent.parameters.options.systemMessage.includes(`${MARKER}:agent-rule`));
  assert.match(agent.parameters.options.systemMessage, /Nunca use memoria da conversa/);
  assert.doesNotMatch(storeHoursCode, /defaultHours|SYNC_SECRET|xiaomipetrolina\.com\.br\/company-settings'/);
  assert.doesNotMatch(attendantHoursCode, /defaultHours|SYNC_SECRET|xiaomipetrolina\.com\.br\/company-settings'/);
  return {
    directQuestionIntent: 'horario_loja',
    contextualSalesIntentPreserved: true,
    registeredLunchUsed: direct[0].json.output,
    safeApiFailure: unavailable[0].json.output,
    salesContextGrounded: salesContext[0].json.storeHoursContext.includes('almoco 12:00-14:00'),
  };
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = (await run(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n Postgres container not found');
    const readSql = `COPY (
      SELECT encode(convert_to(json_build_object(
        'nodes', nodes::jsonb, 'connections', connections::jsonb,
        'activeVersionId', "activeVersionId", 'versionId', "versionId", 'active', active
      )::text, 'UTF8'), 'hex')
      FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`;
    const workflow = JSON.parse(Buffer.from((await psql(connection, db, readSql)).trim(), 'hex').toString('utf8'));
    assert.equal(workflow.active, true, 'workflow must be active');
    assert.equal(workflow.versionId, workflow.activeVersionId, 'workflow versions must be aligned');
    const originalConnections = JSON.stringify(workflow.connections);
    patchWorkflow(workflow);
    assert.equal(JSON.stringify(workflow.connections), originalConnections, 'hours fix must not change graph connections');
    const validation = await validate(workflow);
    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, workflowId: WORKFLOW_ID, marker: MARKER, validation }, null, 2));
      return;
    }

    const activeExecutionsSql = `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`;
    assert.equal(Number((await psql(connection, db, activeExecutionsSql)).trim()), 0, 'workflow has active executions; retry after they finish');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-before-${MARKER}-${timestamp}.json`;
    await run(connection, 'mkdir -p /root/n8n-backups && chmod 700 /root/n8n-backups');
    const backupSql = `COPY (
      SELECT json_build_object('workflow', row_to_json(workflow), 'activeHistory', row_to_json(history))::text
      FROM workflow_entity workflow LEFT JOIN workflow_history history
        ON history."workflowId"=workflow.id AND history."versionId"=workflow."activeVersionId"
      WHERE workflow.id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`;
    const backup = await psql(connection, db, backupSql);
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(backupPath, Buffer.from(backup, 'utf8'), (writeError) => {
        sftp.end();
        writeError ? reject(writeError) : resolve();
      });
    }));
    await run(connection, `chmod 600 ${shQuote(backupPath)} && sha256sum ${shQuote(backupPath)} > ${shQuote(`${backupPath}.sha256`)}`);

    await run(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 0);
    await run(connection, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(connection, 'n8n_n8n', 0);
    servicesStopped = true;
    assert.equal(Number((await psql(connection, db, activeExecutionsSql)).trim()), 0, 'execution appeared during shutdown');
    assert.equal((await psql(connection, db, `COPY (SELECT "activeVersionId" FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`)).trim(), workflow.activeVersionId);

    const nodesPath = `/tmp/${WORKFLOW_ID}-${MARKER}-${timestamp}-nodes.json`;
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(nodesPath, Buffer.from(JSON.stringify(workflow.nodes), 'utf8'), (writeError) => {
        sftp.end();
        writeError ? reject(writeError) : resolve();
      });
    }));
    await run(connection, `docker cp ${shQuote(nodesPath)} ${shQuote(db)}:${shQuote(nodesPath)}`);
    try {
      await psql(connection, db, `BEGIN;
        UPDATE workflow_entity SET nodes=pg_read_file('${nodesPath}')::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
        UPDATE workflow_history SET nodes=pg_read_file('${nodesPath}')::json, "updatedAt"=NOW()
          WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(workflow.activeVersionId)};
        COMMIT;`);
    } finally {
      await run(connection, `rm -f ${shQuote(nodesPath)}`).catch(() => {});
      await run(connection, `docker exec ${shQuote(db)} rm -f ${shQuote(nodesPath)}`).catch(() => {});
    }

    await run(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    const verifySql = `COPY (
      SELECT json_build_object(
        'active', workflow.active,
        'versionAligned', workflow."versionId"=workflow."activeVersionId",
        'entityHistoryEqual', workflow.nodes::jsonb=history.nodes::jsonb AND workflow.connections::jsonb=history.connections::jsonb,
        'classifier', workflow.nodes::text LIKE '%${MARKER}:classifier%',
        'storeSpecialist', workflow.nodes::text LIKE '%${MARKER}:store-specialist%',
        'salesContext', workflow.nodes::text LIKE '%${MARKER}:sales-context%',
        'agentRule', workflow.nodes::text LIKE '%${MARKER}:agent-rule%',
        'hardcodedFallbackRemoved', NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(workflow.nodes::jsonb) node
          WHERE node->>'name' IN ('Loja - Horario Atendimento', 'Atendente - Horario')
            AND node->'parameters'->>'jsCode' LIKE '%defaultHours%'
        )
      )::text
      FROM workflow_entity workflow JOIN workflow_history history
        ON history."workflowId"=workflow.id AND history."versionId"=workflow."activeVersionId"
      WHERE workflow.id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`;
    const verification = JSON.parse((await psql(connection, db, verifySql)).trim());
    assert.deepEqual(verification, {
      active: true, versionAligned: true, entityHistoryEqual: true,
      classifier: true, storeSpecialist: true, salesContext: true,
      agentRule: true, hardcodedFallbackRemoved: true,
    });
    const health = (await run(connection, "curl -fsS --max-time 15 https://n8n.mercadodovale.com.br/healthz")).trim();
    console.log(JSON.stringify({ apply: true, workflowId: WORKFLOW_ID, marker: MARKER, backupPath, validation, verification, health }, null, 2));
  } finally {
    if (servicesStopped) {
      await run(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n', 1).catch(() => {});
      await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

module.exports = { MARKER, patchWorkflow, validate };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
