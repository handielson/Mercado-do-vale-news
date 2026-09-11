const vm = require('node:vm');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MARKER = 'birthday-correction-handoff-wording-v372';
const APPLY = process.argv.includes('--apply');

function quote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}

function runRemote(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0
      ? resolve(stdout)
      : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}

function psql(connection, container, sql) {
  return new Promise((resolve, reject) => {
    connection.exec(`docker exec -i ${quote(container)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`, (error, stream) => {
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
    const replicas = (await runRemote(
      connection,
      `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`
    )).trim();
    if (replicas === `${expected}/${expected}`) return replicas;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timeout waiting for ${service}=${expected}/${expected}`);
}

function findNode(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  if (!node) throw new Error(`Node not found: ${name}`);
  return node;
}

function patchResolver(code) {
  let next = String(code || '');
  if (!next.includes(MARKER)) {
    const block = `// ${MARKER}\nconst birthdayCorrectionV372 = (() => {\n  const history = normalize(String($json.conversationHistory || source.conversationHistory || '').slice(-1600));\n  const current = normalize(text);\n  const dateMatch = String(text || '').match(/\\b([0-3]?\\d)\\s*[\\/-]\\s*([01]?\\d)\\b/);\n  const hasRecentBirthdayGreeting = /loja.{0,80}parabens pelo seu dia/.test(history);\n  const correctionLanguage = /\\b(mas|na verdade|data correta|meu aniversario|meu niver|e dia|eh dia|aniversario e|aniversario eh)\\b/.test(current);\n  if (!hasRecentBirthdayGreeting || !dateMatch || !correctionLanguage) return null;\n  const day = Number(dateMatch[1]);\n  const month = Number(dateMatch[2]);\n  if (day < 1 || day > 31 || month < 1 || month > 12) return null;\n  const date = String(day).padStart(2, '0') + '/' + String(month).padStart(2, '0');\n  return {\n    acao: 'chamar_atendente',\n    intencao: 'correcao_data_aniversario',\n    confianca: 1,\n    motivo: 'Cliente corrigiu a data de aniversario apos uma felicitacao automatica.',\n    data_aniversario_informada: date,\n  };\n})();\n`;
    const anchor = 'const legacy = legacyDecision($json, text);';
    if (!next.includes(anchor)) throw new Error('Resolver anchor not found');
    next = next.replace(anchor, `${block}${anchor}`);
    next = next.replace(
      'const decision = contextualMediaDecisionV287 ||',
      'const decision = birthdayCorrectionV372 || contextualMediaDecisionV287 ||'
    );
    next = next.replace(
      /^(\s*)conversationDecision: decision,/m,
      "$1birthdayCorrectionActive: Boolean(birthdayCorrectionV372),\n$1birthdayCorrectionDate: String(birthdayCorrectionV372?.data_aniversario_informada || ''),\n$1conversationDecision: decision,"
    );
    if (!next.includes('birthdayCorrectionDate:')) throw new Error('Resolver output anchor not found');
  }
  if (!next.includes('const decision = birthdayCorrectionV372 ||')) {
    throw new Error('Birthday correction priority was not installed');
  }
  new Function(next);
  return next;
}

const attendantCode = `// ${MARKER}:attendant-message
const source = $json || {};
const lineBreak = '[[BR]]';
const correctionDate = String(source.birthdayCorrectionDate || '').trim();
const output = source.birthdayCorrectionActive && correctionDate
  ? 'Voce tem razao — seu aniversario e em ' + correctionDate + '. Desculpe por termos enviado os parabens na data errada, e obrigado por avisar.' + lineBreak + 'Vou encaminhar a correcao do cadastro para nossa equipe conferir.'
  : 'Certo. Vou encaminhar sua conversa para nossa equipe.' + lineBreak + 'Um atendente continuara por aqui no horario de atendimento.';
return [{ json: { ...source, output } }];`;

function patchWorkflow(nodes) {
  const resolver = findNode(nodes, 'Resolver Acao de Conversacao');
  const attendant = findNode(nodes, 'Atendente - Horario');
  resolver.parameters.jsCode = patchResolver(resolver.parameters.jsCode);
  attendant.parameters.jsCode = attendantCode;
  new Function(attendant.parameters.jsCode);
  return nodes;
}

function runResolver(code, text, history, rawOutput = '') {
  const source = { conversation: text, conversationHistory: history, remoteJid: '559999999999@s.whatsapp.net' };
  return vm.runInNewContext(`(function(){${code}})()`, {
    $json: { ...source, output: rawOutput },
    $: () => ({ first: () => ({ json: source }) }),
    $getWorkflowStaticData: () => ({}),
    Date,
  })[0].json;
}

function runAttendant(code, input) {
  return vm.runInNewContext(`(function(){${code}})()`, { $json: input })[0].json;
}

function validate(nodes) {
  const resolverCode = findNode(nodes, 'Resolver Acao de Conversacao').parameters.jsCode;
  const handoffCode = findNode(nodes, 'Atendente - Horario').parameters.jsCode;
  const history = 'Loja: 🎉 Parabens pelo seu dia Cliente! Feliz aniversario!';
  const correction = runResolver(resolverCode, 'Obrigado, mas 11/10. Mesmo assim, muito obrigado', history);
  const ordinaryThanks = runResolver(
    resolverCode,
    'Obrigado mesmo',
    history,
    JSON.stringify({ acao: 'responder_direto', intencao: 'conversa_simples', confianca: 0.9 })
  );
  const correctionReply = runAttendant(handoffCode, correction).output;
  const genericReply = runAttendant(handoffCode, {}).output;
  const result = {
    correctionAction: correction.conversationAction,
    correctionIntent: correction.conversationIntent,
    correctionDate: correction.birthdayCorrectionDate,
    correctionReply,
    ordinaryThanksAction: ordinaryThanks.conversationAction,
    genericReply,
    codeCompiles: true,
  };
  if (result.correctionAction !== 'chamar_atendente') throw new Error('Birthday correction did not route to handoff');
  if (result.correctionDate !== '11/10') throw new Error('Birthday date was not preserved');
  if (!/desculpe/i.test(result.correctionReply) || !/11\/10/.test(result.correctionReply)) throw new Error('Correction reply is not contextual');
  if (!/encaminhar sua conversa/i.test(result.genericReply)) throw new Error('Generic handoff wording was not updated');
  return result;
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection
    .on('ready', resolve)
    .on('error', reject)
    .connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const container = (await runRemote(
      connection,
      "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1"
    )).trim();
    if (!container) throw new Error('Container Postgres do n8n nao encontrado');
    const raw = JSON.parse((await psql(connection, container, `COPY (
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'activeVersionId', "activeVersionId"
      )::text FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}
    ) TO STDOUT;`)).trim());
    const nodes = patchWorkflow(JSON.parse(Buffer.from(raw.nodesHex, 'hex').toString('utf8')));
    const validation = validate(nodes);
    if (!APPLY) {
      console.log(JSON.stringify({ dryRun: true, workflowId: WORKFLOW_ID, validation }, null, 2));
      return;
    }

    const activeExecutions = Number((await psql(connection, container, `COPY (
      SELECT count(*) FROM execution_entity
      WHERE "workflowId"=${quote(WORKFLOW_ID)} AND status IN ('new','running')
    ) TO STDOUT;`)).trim());
    if (activeExecutions !== 0) throw new Error(`Workflow has ${activeExecutions} active executions`);

    const backupName = `/root/n8n-backups/${WORKFLOW_ID}-before-${MARKER}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const backupSql = `COPY (SELECT json_build_object(
      'workflowId', id,
      'activeVersionId', "activeVersionId",
      'nodes', nodes::jsonb,
      'connections', connections::jsonb
    )::text FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    await runRemote(connection, `mkdir -p /root/n8n-backups && docker exec ${quote(container)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1 -c ${quote(backupSql)} > ${quote(backupName)}`);
    await runRemote(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 0);
    await runRemote(connection, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(connection, 'n8n_n8n', 0);
    servicesStopped = true;

    const nodesJson = JSON.stringify(nodes);
    const sql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity
SET nodes=${dollar(nodesJson, 'nodes')}::json, "versionId"="activeVersionId", "updatedAt"=NOW()
WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history
SET nodes=${dollar(nodesJson, 'hnodes')}::json, "updatedAt"=NOW()
WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(raw.activeVersionId)};
COPY (
  SELECT json_build_object(
    'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
    'markerPresent', we.nodes::text LIKE '%${MARKER}%'
  )::text
  FROM workflow_entity we
  JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId"
  WHERE we.id=${quote(WORKFLOW_ID)}
) TO STDOUT;`;
    const result = JSON.parse((await psql(connection, container, sql)).trim());

    await runRemote(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    await runRemote(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    console.log(JSON.stringify({ applied: true, backupName, validation, ...result }, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n', 1).catch(() => {});
      await runRemote(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

module.exports = { patchResolver, patchWorkflow, validate, attendantCode };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
