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

const storeHoursCode = `return (async () => {
const source = $json;
const lineBreak = '||';
const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\\u0300-\\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\\s]/g, ' ')
  .replace(/\\s+/g, ' ')
  .trim();
const text = normalize(source.conversation || source.classificacaoMensagem || '');
const asksClose = /\\b(fecha|fecham|fecha que horas|ate que horas|ate quando)\\b/.test(text);
const asksOpen = /\\b(abre|abrem|abre que horas|que horas abre)\\b/.test(text);
const asksNow = /\\b(aberto|aberta|fechado|fechada|agora|hoje)\\b/.test(text) || (!asksClose && !asksOpen);
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
const minutesOf = (value) => {
  const [h, m] = String(value || '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : 0;
};
const now = new Date();
const local = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const todayKey = days[local.getDay()];
const currentMinutes = local.getHours() * 60 + local.getMinutes();
const defaultHours = {
  monday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  tuesday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  wednesday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  thursday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  friday: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' },
  saturday: { isOpen: true, openTime: '08:00', closeTime: '14:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:30' },
  sunday: { isOpen: false, openTime: '08:00', closeTime: '12:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:30' },
};
async function getSettings() {
  try {
    const res = await fetch('https://api.xiaomipetrolina.com.br/company-settings', {
      headers: { 'x-sync-key': $env.SYNC_SECRET || '', Accept: 'application/json' },
    });
    if (!res.ok) return { business_hours: defaultHours };
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : (data.rows?.[0] || data);
    return { ...row, business_hours: row?.business_hours || defaultHours };
  } catch (error) {
    return { business_hours: defaultHours };
  }
}
const settings = await getSettings();
const business_hours = settings.business_hours || defaultHours;
const today = { ...defaultHours[todayKey], ...(business_hours[todayKey] || {}) };
const nextOpenDay = () => {
  for (let offset = 1; offset <= 7; offset += 1) {
    const key = days[(local.getDay() + offset) % 7];
    const schedule = { ...defaultHours[key], ...(business_hours[key] || {}) };
    if (schedule.isOpen) return { key, schedule };
  }
  return null;
};
let output = '';
if (!today.isOpen) {
  const next = nextOpenDay();
  output = next
    ? 'Hoje a loja esta fechada.' + lineBreak + 'Voltamos na ' + dayNames[next.key] + ' as ' + (next.schedule.openTime || '08:00') + '.'
    : 'Hoje a loja esta fechada.' + lineBreak + 'Pode mandar sua mensagem por aqui que respondemos assim que possivel.';
} else {
  const open = minutesOf(today.openTime || '08:00');
  const close = minutesOf(today.closeTime || '18:00');
  const lunchStart = minutesOf(today.lunchStart || '12:00');
  const lunchEnd = minutesOf(today.lunchEnd || '14:00');
  const inLunch = today.hasLunchBreak && currentMinutes >= lunchStart && currentMinutes < lunchEnd;
  const isOpenNow = currentMinutes >= open && currentMinutes < close && !inLunch;
  if (asksClose) {
    output = 'Hoje fechamos as ' + (today.closeTime || '18:00') + '.';
    if (today.hasLunchBreak) output += lineBreak + 'Temos pausa para almoco de ' + (today.lunchStart || '12:00') + ' ate ' + (today.lunchEnd || '14:00') + '.';
  } else if (asksOpen) {
    output = 'Hoje abrimos as ' + (today.openTime || '08:00') + ' e fechamos as ' + (today.closeTime || '18:00') + '.';
    if (today.hasLunchBreak) output += lineBreak + 'Pausa para almoco: ' + (today.lunchStart || '12:00') + ' ate ' + (today.lunchEnd || '14:00') + '.';
  } else if (inLunch) {
    output = 'Agora estamos em pausa para almoco.' + lineBreak + 'Voltamos hoje as ' + (today.lunchEnd || '14:00') + '.';
  } else if (isOpenNow) {
    output = 'Estamos abertos agora.' + lineBreak + 'Hoje atendemos ate ' + (today.closeTime || '18:00') + '.';
  } else if (currentMinutes < open) {
    output = 'Agora a loja ainda esta fechada.' + lineBreak + 'Hoje abrimos as ' + (today.openTime || '08:00') + '.';
  } else {
    const next = nextOpenDay();
    output = 'Agora a loja ja esta fechada.';
    output += next ? lineBreak + 'Voltamos na ' + dayNames[next.key] + ' as ' + (next.schedule.openTime || '08:00') + '.' : lineBreak + 'Pode mandar sua mensagem por aqui que respondemos assim que possivel.';
  }
  if (asksNow && !output) output = isOpenNow ? 'Estamos abertos agora.' : 'No momento a loja esta fechada.';
}
return [{ json: { ...source, output } }];
})();`;

function patchClassifierSystemMessage(code) {
  let next = String(code || '');
  if (!next.includes('- horario_loja')) {
    next = next.replace(
      "- fallback\\n",
      "- horario_loja\\n- fallback\\n",
    );
  }
  if (!next.includes('Perguntas sobre horario')) {
    next = next.replace(
      "- Pedido para falar com atendente, vendedor ou humano: pedido_humano.\\n",
      "- Pedido para falar com atendente, vendedor ou humano: pedido_humano.\\n- Perguntas sobre horario de funcionamento, se a loja esta aberta, que horas abre, que horas fecha, pausa de almoco ou expediente: horario_loja.\\n",
    );
  }
  return next;
}

function patchParseCode(code) {
  let next = String(code || '');
  next = next.replace(
    "const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'fallback']);",
    "const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'horario_loja', 'fallback']);",
  );
  if (!next.includes('storeHoursIntent')) {
    next = next.replace(
      "const intencao = allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback';",
      "const normalizedMessageForIntent = String(source.conversation || parsed.mensagem || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();\nconst storeHoursIntent = /\\b(horario|funcionamento|abre|abrem|abrir|aberto|aberta|fechado|fechada|fecha|fecham|expediente|almoco|almoço)\\b/.test(normalizedMessageForIntent)\n  && /\\b(loja|voces|voce|mercado do vale|agora|hoje|que horas|hora)\\b/.test(normalizedMessageForIntent);\nconst intencao = storeHoursIntent\n  ? 'horario_loja'\n  : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback');",
    );
  }
  new Function('$json', next);
  return next;
}

function ensureStoreHoursNode(nodes) {
  let node = nodes.find((item) => item.name === 'Loja - Horario Atendimento');
  if (!node) {
    node = {
      parameters: { jsCode: storeHoursCode },
      id: 'loja-horario-atendimento',
      name: 'Loja - Horario Atendimento',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2080, -112],
    };
    nodes.push(node);
  } else {
    node.parameters = node.parameters || {};
    node.parameters.jsCode = storeHoursCode;
  }
  new Function('$json', '$env', storeHoursCode);
}

function ensureSwitchRule(nodes, connections) {
  const switchNode = nodes.find((item) => item.name === 'Switch Especialistas');
  if (!switchNode) throw new Error('Switch Especialistas not found');
  const values = switchNode.parameters?.rules?.values || [];
  const exists = values.some((rule) => rule.outputKey === 'horario_loja'
    || JSON.stringify(rule).includes('horario_loja'));
  if (!exists) {
    values.splice(5, 0, {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
          version: 3,
        },
        combinator: 'and',
        conditions: [{
          id: 'intent-horario-loja',
          operator: { type: 'string', operation: 'equals' },
          leftValue: '={{$json.intencao}}',
          rightValue: 'horario_loja',
        }],
      },
      renameOutput: true,
      outputKey: 'horario_loja',
    });
  }
  switchNode.parameters.rules.values = values;

  const current = connections['Switch Especialistas']?.main || [];
  const oldFallback = current[5] || [];
  current[5] = [{ node: 'Loja - Horario Atendimento', type: 'main', index: 0 }];
  if (!current[6]) current[6] = oldFallback;
  connections['Switch Especialistas'] = { main: current };
  connections['Loja - Horario Atendimento'] = {
    main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]],
  };
}

function patchWorkflow(nodes, connections) {
  const classifier = nodes.find((item) => item.name === 'Agente Inicial - Classificador');
  const parse = nodes.find((item) => item.name === 'Parse Classificacao');
  if (!classifier || !parse) throw new Error('Classifier or parse node not found');

  const prompt = classifier.parameters?.options?.systemMessage;
  if (typeof prompt === 'string') {
    classifier.parameters.options.systemMessage = patchClassifierSystemMessage(prompt);
  } else if (classifier.parameters?.text) {
    classifier.parameters.text = patchClassifierSystemMessage(classifier.parameters.text);
  } else {
    const serialized = JSON.stringify(classifier.parameters || {});
    if (!serialized.includes('horario_loja')) {
      throw new Error('Classifier system prompt path not found');
    }
  }

  parse.parameters.jsCode = patchParseCode(parse.parameters.jsCode);
  ensureStoreHoursNode(nodes);
  ensureSwitchRule(nodes, connections);
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });

  let servicesStopped = false;
  try {
    const dbContainer = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
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
    "updatedAt" = NOW()
WHERE id = ${shQuote(WORKFLOW_ID)};

UPDATE workflow_history
SET nodes = ${dollar(JSON.stringify(nodes), 'histnodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'histconnjson')}::json,
    "updatedAt" = NOW()
WHERE "workflowId" = ${shQuote(WORKFLOW_ID)}
  AND "versionId" = ${shQuote(entity.activeVersionId)};

COPY (
  SELECT json_build_object(
    'intent', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Parse Classificacao' AND node->'parameters'->>'jsCode' LIKE '%horario_loja%'),
    'node', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Loja - Horario Atendimento'),
    'route', (connections::jsonb ? 'Loja - Horario Atendimento')
  )::text
  FROM workflow_entity
  WHERE id = ${shQuote(WORKFLOW_ID)}
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
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
    }
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
