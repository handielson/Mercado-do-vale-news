const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dollar(value, tag) {
  return `$${tag}$${String(value).replace(new RegExp(`\\$${tag}\\$`, 'g'), '')}$${tag}$`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`))
      ));
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
    });
  });
}

function psql(conn, dbContainer, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A`, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`))
      ));
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.end(sql);
    });
  });
}

async function waitServiceReplicas(conn, serviceName, expected, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const replicas = (await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(serviceName)} --format '{{.Replicas}}' | head -n 1`,
    )).trim();
    if (replicas === `${expected}/${expected}`) return replicas;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timed out waiting for ${serviceName} replicas ${expected}/${expected}`);
}

function readJson(conn, dbContainer, sql) {
  return psql(conn, dbContainer, `COPY (${sql}) TO STDOUT;`).then((text) => JSON.parse(text.trim()));
}

const identityCode = `const source = $json || {};
return [{ json: {
  ...source,
  output: 'Sou Nina, sua agente virtual da Mercado do Vale. 😊||Posso te ajudar com produtos, pagamento, entrega, retirada, endereco da loja ou chamar um atendente quando precisar.'
} }];`;

const attendantHoursCode = `return (async () => {
const source = $json || {};
const lineBreak = '||';
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const dayNames = {
  sunday: 'domingo',
  monday: 'segunda-feira',
  tuesday: 'terca-feira',
  wednesday: 'quarta-feira',
  thursday: 'quinta-feira',
  friday: 'sexta-feira',
  saturday: 'sabado',
};
const defaultHours = {
  monday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  tuesday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  wednesday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  thursday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  friday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  saturday: { isOpen: true, openTime: '08:00', closeTime: '14:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:30' },
  sunday: { isOpen: false, openTime: '08:00', closeTime: '12:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:30' },
};
const minutesOf = (value) => {
  const [h, m] = String(value || '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : 0;
};
const now = new Date();
const local = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const todayKey = days[local.getDay()];
const currentMinutes = local.getHours() * 60 + local.getMinutes();
async function getSettings() {
  try {
    const res = await fetch('https://api.xiaomipetrolina.com.br/public/company-settings', { headers: { Accept: 'application/json' } });
    if (!res.ok) return { business_hours: defaultHours };
    const row = await res.json();
    return { ...row, business_hours: row?.business_hours || defaultHours };
  } catch {
    return { business_hours: defaultHours };
  }
}
const settings = await getSettings();
const business_hours = settings.business_hours || defaultHours;
const scheduleOf = (key) => ({ ...defaultHours[key], ...(business_hours[key] || {}) });
const today = scheduleOf(todayKey);
const nextOpenDay = () => {
  for (let offset = 1; offset <= 7; offset += 1) {
    const key = days[(local.getDay() + offset) % 7];
    const schedule = scheduleOf(key);
    if (schedule.isOpen) return { key, schedule };
  }
  return null;
};
const base = 'Vou chamar um atendente para continuar com voce por aqui.';
let availability = '';
if (!today.isOpen) {
  const next = nextOpenDay();
  availability = next
    ? 'No momento nao estamos com atendimento online. Voltamos na ' + dayNames[next.key] + ' as ' + (next.schedule.openTime || '08:00') + '.'
    : 'No momento nao estamos com atendimento online. Assim que possivel um atendente responde por aqui.';
} else {
  const open = minutesOf(today.openTime || '08:00');
  const close = minutesOf(today.closeTime || '18:00');
  const lunchStart = minutesOf(today.lunchStart || '12:00');
  const lunchEnd = minutesOf(today.lunchEnd || '14:00');
  const inLunch = today.hasLunchBreak && currentMinutes >= lunchStart && currentMinutes < lunchEnd;
  const isOpenNow = currentMinutes >= open && currentMinutes < close && !inLunch;
  if (isOpenNow) availability = 'Estamos em horario de atendimento online agora.';
  else if (inLunch) availability = 'No momento estamos em pausa de atendimento. Voltamos hoje as ' + (today.lunchEnd || '14:00') + '.';
  else if (currentMinutes < open) availability = 'No momento nao estamos com atendimento online. Hoje voltamos as ' + (today.openTime || '08:00') + '.';
  else {
    const next = nextOpenDay();
    availability = next
      ? 'No momento nao estamos com atendimento online. Voltamos na ' + dayNames[next.key] + ' as ' + (next.schedule.openTime || '08:00') + '.'
      : 'No momento nao estamos com atendimento online. Assim que possivel um atendente responde por aqui.';
  }
}
const note = 'Mesmo assim, a qualquer momento um atendente pode abrir a conversa e responder por aqui.';
return [{ json: { ...source, output: base + '||' + availability + '||' + note } }];
})();`;

function addOrReplaceNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}

function patchClassifierSystemMessage(message) {
  let next = String(message || '');
  if (!next.includes('- identidade_bot')) {
    next = next.replace('- pedido_humano\n', '- pedido_humano\n- identidade_bot\n');
  }
  if (!next.includes('nome da agente virtual')) {
    next = next.replace(
      '- Pedido para falar com atendente, vendedor ou humano: pedido_humano.\n',
      '- Pedido para falar com atendente, vendedor ou humano: pedido_humano.\n- Perguntas sobre seu nome, quem e voce, nome da agente virtual ou identidade do bot: identidade_bot.\n',
    );
  }
  if (!next.includes('Nao comece toda resposta com Claro')) {
    next += '\nRegra de tom: Nao comece toda resposta com Claro. Use confirmacoes somente quando fizer sentido no contexto.\n';
  }
  return next;
}

function patchParseClassifier(code) {
  let next = String(code || '');
  next = next.replace(/const allowed = new Set\(\[([^\]]*)\]\);/, (match, values) => {
    let nextValues = values;
    if (!nextValues.includes('identidade_bot')) {
      nextValues = nextValues.replace("'pedido_humano'", "'pedido_humano', 'identidade_bot'");
    }
    if (!nextValues.includes('localizacao_loja')) {
      nextValues = nextValues.replace("'horario_loja'", "'horario_loja', 'localizacao_loja'");
    }
    return `const allowed = new Set([${nextValues}]);`;
  });
  if (!next.includes('const storeLocationIntent =')) {
    next = next.replace(
      "\nconst botIdentityIntent =",
      "\nconst storeLocationIntent = /\\b(onde fica|onde e|endereco|endereco da loja|localizacao|localizacao da loja|manda a localizacao|manda o endereco|mapa|maps|rota|como chegar)\\b/.test(normalizedMessageForIntent)\n  && /\\b(loja|mercado do vale|voces|voce|ai|endereco|localizacao|mapa|maps|rota)\\b/.test(normalizedMessageForIntent);\nconst botIdentityIntent =",
    );
  }
  if (!next.includes('const storeLocationIntent =')) {
    next = next.replace(
      "\nconst intencao =",
      "\nconst storeLocationIntent = /\\b(onde fica|onde e|endereco|endereco da loja|localizacao|localizacao da loja|manda a localizacao|manda o endereco|mapa|maps|rota|como chegar)\\b/.test(normalizedMessageForIntent)\n  && /\\b(loja|mercado do vale|voces|voce|ai|endereco|localizacao|mapa|maps|rota)\\b/.test(normalizedMessageForIntent);\nconst intencao =",
    );
  }
  if (!next.includes('const botIdentityIntent =')) {
    next = next.replace(
      "\nconst intencao =",
      "\nconst botIdentityIntent = /\\b(como (e|eh) seu nome|qual (e|eh) seu nome|seu nome|quem (e|eh) voce|voce se chama|como voce se chama|nome do bot|nome da atendente virtual)\\b/.test(normalizedMessageForIntent);\nconst intencao =",
    );
  }
  next = next.replace(
    /const intencao =[\s\S]*?;\nconst venda =/,
    "const intencao = botIdentityIntent\n  ? 'identidade_bot'\n  : (storeHoursIntent ? 'horario_loja' : (storeLocationIntent ? 'localizacao_loja' : (paymentPolicyIntent ? 'formas_pagamento' : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback'))));\nconst venda =",
  );
  if (!next.includes('botIdentityIntent')) throw new Error('Could not patch bot identity intent');
  if (!next.includes('storeLocationIntent')) throw new Error('Could not patch store location intent');
  new Function('$json', next);
  return next;
}

function ensureSwitchOutput(nodes, connections) {
  const switchNode = nodes.find((node) => node.name === 'Switch Especialistas');
  if (!switchNode) throw new Error('Switch Especialistas not found');
  const values = switchNode.parameters?.rules?.values || [];
  const exists = values.some((rule) => rule.outputKey === 'identidade_bot' || JSON.stringify(rule).includes('identidade_bot'));
  if (!exists) {
    const fallbackIndex = values.findIndex((rule) => rule.outputKey === 'fallback');
    const rule = {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        combinator: 'and',
        conditions: [{
          id: 'intent-identidade-bot',
          operator: { type: 'string', operation: 'equals' },
          leftValue: '={{$json.intencao}}',
          rightValue: 'identidade_bot',
        }],
      },
      renameOutput: true,
      outputKey: 'identidade_bot',
    };
    if (fallbackIndex >= 0) values.splice(fallbackIndex, 0, rule);
    else values.push(rule);
  }

  const fallbackTarget = [{ node: 'Agente Geral - Atendimento', type: 'main', index: 0 }];
  const main = connections['Switch Especialistas']?.main || [];
  const desiredIndex = values.findIndex((rule) => rule.outputKey === 'identidade_bot');
  while (main.length < values.length) main.push(fallbackTarget);
  main[desiredIndex] = [{ node: 'Identidade - Nina', type: 'main', index: 0 }];
  connections['Switch Especialistas'] = { main };
}

function patchStoreLocation(nodes) {
  const node = nodes.find((item) => item.name === 'Loja - Localizacao');
  if (!node?.parameters?.jsCode) return;
  node.parameters.jsCode = String(node.parameters.jsCode).replace(
    "  'Claro 😊',\n  'A loja fica neste endereco:',",
    "  'A loja fica neste endereco:',",
  );
}

function patchWorkflow(nodes, connections) {
  const classifier = nodes.find((node) => node.name === 'Agente Inicial - Classificador');
  const parse = nodes.find((node) => node.name === 'Parse Classificacao');
  if (!classifier || !parse) throw new Error('Required nodes not found');

  if (classifier.parameters?.options?.systemMessage) {
    classifier.parameters.options.systemMessage = patchClassifierSystemMessage(classifier.parameters.options.systemMessage);
  }
  parse.parameters.jsCode = patchParseClassifier(parse.parameters.jsCode);

  addOrReplaceNode(nodes, {
    id: 'bot-identity-nina-001',
    name: 'Identidade - Nina',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2080, 320],
    parameters: { jsCode: identityCode },
  });
  new Function('$json', identityCode);

  addOrReplaceNode(nodes, {
    id: 'attendant-hours-specialist-001',
    name: 'Atendente - Horario',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2976, 144],
    parameters: { jsCode: attendantHoursCode },
  });
  new Function('$json', '$env', attendantHoursCode);

  patchStoreLocation(nodes);
  ensureSwitchOutput(nodes, connections);

  connections['Identidade - Nina'] = { main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]] };
  connections['Atendente - Horario'] = { main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]] };

  for (const [sourceName, value] of Object.entries(connections)) {
    for (const output of value.main || []) {
      for (const edge of output || []) {
        if (edge.node === 'Especialista - Humano') edge.node = 'Atendente - Horario';
      }
    }
    connections[sourceName] = value;
  }

  const oldHumanIndex = nodes.findIndex((node) => node.name === 'Especialista - Humano');
  if (oldHumanIndex >= 0) nodes.splice(oldHumanIndex, 1);
  delete connections['Especialista - Humano'];
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });

  let servicesStopped = false;
  try {
    const dbContainer = (await runRemote(
      conn,
      "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1",
    )).trim();
    if (!dbContainer) throw new Error('n8n Postgres container not found');

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const entity = await readJson(conn, dbContainer, `
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'versionId', "versionId",
        'activeVersionId', "activeVersionId"
      )::text
      FROM workflow_entity
      WHERE id = ${shQuote(WORKFLOW_ID)}
    `);

    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes, connections);

    const updateSql = `
\\set ON_ERROR_STOP on

UPDATE workflow_entity
SET nodes = ${dollar(JSON.stringify(nodes), 'nodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'connjson')}::json,
    "versionId" = "activeVersionId",
    "updatedAt" = NOW()
WHERE id = ${shQuote(WORKFLOW_ID)};

UPDATE workflow_history
SET nodes = ${dollar(JSON.stringify(nodes), 'histnodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'histconnjson')}::json,
    "updatedAt" = NOW()
WHERE "workflowId" = ${shQuote(WORKFLOW_ID)};

COPY (
  SELECT json_build_object(
    'versionAligned', (SELECT "versionId" = "activeVersionId" FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}),
    'identityIntent', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Parse Classificacao' AND node->'parameters'->>'jsCode' LIKE '%identidade_bot%'),
    'identityNode', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Identidade - Nina'),
    'attendantHoursNode', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Atendente - Horario'),
    'oldHumanClaro', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Especialista - Humano' AND node::text LIKE '%Claro%Vou chamar%')
  )::text
) TO STDOUT;
`;
    const result = JSON.parse((await psql(conn, dbContainer, updateSql)).trim());

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitServiceReplicas(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitServiceReplicas(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
