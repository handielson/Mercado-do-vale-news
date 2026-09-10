const crypto = require('node:crypto');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const MAIN_WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const ERROR_WORKFLOW_ID = 'mdvBotError2026a';
const ERROR_WORKFLOW_NAME = 'Mercado do Vale - Erros do Bot WhatsApp';
const MAIN_WORKFLOW_NAME = 'Mercado do Vale - Bot WhatsApp Producao';
const APPLY = process.argv.includes('--apply');
const CONFIRMATION = 'APLICAR-MELHORIAS-N8N-BOT';

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function dollarQuote(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Conteudo invalido para ${tag}`);
  return `$${tag}$${String(value)}$${tag}$`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || stdout || `Comando remoto falhou: ${code}`));
      });
    });
  });
}

async function psql(conn, dbContainer, sql) {
  return runRemote(
    conn,
    `docker exec -i ${shellQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A <<'SQL'\n\\set ON_ERROR_STOP on\n${sql}\nSQL`,
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function findNode(nodes, name) {
  const node = nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`No obrigatorio ausente no workflow principal: ${name}`);
  return clone(node);
}

function setBodyParameter(node, name, value) {
  const parameters = node.parameters?.bodyParameters?.parameters;
  if (!Array.isArray(parameters)) throw new Error(`Body parameters ausentes em ${node.name}`);
  const entry = parameters.find((parameter) => parameter.name === name);
  if (!entry) throw new Error(`Parametro ${name} ausente em ${node.name}`);
  entry.value = value;
}

function buildErrorWorkflow(mainWorkflow) {
  const fetchAdmins = findNode(mainWorkflow.nodes, 'Controle Bot - Buscar Admin Global');
  fetchAdmins.id = 'mdv-bot-error-fetch-admins';
  fetchAdmins.name = 'Erros - Buscar administradores';
  fetchAdmins.position = [320, 0];
  fetchAdmins.retryOnFail = true;
  fetchAdmins.maxTries = 3;
  fetchAdmins.waitBetweenTries = 5000;
  fetchAdmins.onError = 'continueRegularOutput';

  const sendAlert = findNode(mainWorkflow.nodes, 'Controle Bot - Responder Admin');
  sendAlert.id = 'mdv-bot-error-send-alert';
  sendAlert.name = 'Erros - Avisar administradores';
  sendAlert.position = [800, 0];
  sendAlert.retryOnFail = true;
  sendAlert.maxTries = 3;
  sendAlert.waitBetweenTries = 5000;
  sendAlert.onError = 'continueRegularOutput';
  sendAlert.parameters.options = { ...(sendAlert.parameters.options || {}), timeout: 20000 };
  setBodyParameter(sendAlert, 'number', '={{$json.number}}');
  setBodyParameter(sendAlert, 'text', '={{$json.text}}');

  const prepareCode = String.raw`
const failure = $('Erro do workflow').first().json || {};
const admins = Array.isArray($json.adminNumbers) ? $json.adminNumbers : [];
const execution = failure.execution || {};
const workflow = failure.workflow || {};
const error = execution.error || {};

const clean = (value, limit) => String(value || '')
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, limit);

const workflowName = clean(workflow.name || workflow.id || 'Workflow desconhecido', 160);
const failedNode = clean(execution.lastNodeExecuted || 'Nao informado', 160);
const errorMessage = clean(error.message || error.description || 'Erro sem mensagem', 900);
const executionUrl = clean(execution.url || '', 500);
const executionId = clean(execution.id || '', 80);
const text = [
  '⚠️ Falha no bot do Mercado do Vale',
  '',
  'Workflow: ' + workflowName,
  'No: ' + failedNode,
  'Erro: ' + errorMessage,
  executionId ? 'Execucao: ' + executionId : '',
  executionUrl ? 'Abrir: ' + executionUrl : '',
].filter(Boolean).join('\n').slice(0, 3500);

const seen = new Set();
const output = [];
for (const admin of admins) {
  if (!admin || admin.active === false || Number(admin.active) === 0) continue;
  const number = String(admin.phone || admin.remote_jid || '')
    .replace('@s.whatsapp.net', '')
    .replace(/\D/g, '');
  if (!number || seen.has(number)) continue;
  seen.add(number);
  output.push({ json: { number, text } });
}
return output;
`.trim();

  const nodes = [
    {
      id: 'mdv-bot-error-trigger',
      name: 'Erro do workflow',
      type: 'n8n-nodes-base.errorTrigger',
      typeVersion: 1,
      position: [80, 0],
      parameters: {},
    },
    fetchAdmins,
    {
      id: 'mdv-bot-error-prepare-alert',
      name: 'Erros - Preparar alerta',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [560, 0],
      parameters: { jsCode: prepareCode },
    },
    sendAlert,
  ];

  return {
    id: ERROR_WORKFLOW_ID,
    name: ERROR_WORKFLOW_NAME,
    active: false,
    nodes,
    connections: {
      'Erro do workflow': { main: [[{ node: 'Erros - Buscar administradores', type: 'main', index: 0 }]] },
      'Erros - Buscar administradores': { main: [[{ node: 'Erros - Preparar alerta', type: 'main', index: 0 }]] },
      'Erros - Preparar alerta': { main: [[{ node: 'Erros - Avisar administradores', type: 'main', index: 0 }]] },
    },
    settings: {
      executionOrder: 'v1',
      availableInMCP: false,
      saveDataErrorExecution: 'all',
      saveDataSuccessExecution: 'all',
    },
    staticData: null,
    pinData: {},
    versionId: crypto.randomUUID(),
    meta: { templateCredsSetupCompleted: true },
    description: 'Recebe falhas nao tratadas do bot principal e avisa somente os administradores ativos cadastrados no controle oficial. Nao inclui dados de clientes no alerta.',
  };
}

function validateWorkflow(workflow) {
  const names = new Set();
  const ids = new Set();
  for (const node of workflow.nodes) {
    if (!node.name || names.has(node.name)) throw new Error(`Nome de no invalido ou duplicado: ${node.name}`);
    if (!node.id || ids.has(node.id)) throw new Error(`ID de no invalido ou duplicado: ${node.id}`);
    names.add(node.name);
    ids.add(node.id);
  }
  for (const [source, outputs] of Object.entries(workflow.connections || {})) {
    if (!names.has(source)) throw new Error(`Origem inexistente: ${source}`);
    for (const branches of Object.values(outputs)) {
      for (const branch of branches || []) {
        for (const edge of branch || []) {
          if (!names.has(edge.node)) throw new Error(`Destino inexistente: ${edge.node}`);
        }
      }
    }
  }
  if (!workflow.nodes.some((node) => node.type === 'n8n-nodes-base.errorTrigger')) {
    throw new Error('Workflow de erro sem Error Trigger');
  }
}

async function readContext(conn, dbContainer) {
  const sql = `
COPY (
  SELECT encode(convert_to(json_build_object(
    'id', we.id,
    'name', we.name,
    'active', we.active,
    'nodes', we.nodes::jsonb,
    'connections', we.connections::jsonb,
    'settings', coalesce(we.settings::jsonb, '{}'::jsonb),
    'activeVersionId', we."activeVersionId",
    'projectId', sw."projectId"
  )::text, 'UTF8'), 'hex')
  FROM workflow_entity we
  JOIN shared_workflow sw ON sw."workflowId" = we.id
  WHERE we.id = ${sqlQuote(MAIN_WORKFLOW_ID)}
  LIMIT 1
) TO STDOUT;
`;
  const encoded = (await psql(conn, dbContainer, sql)).trim();
  if (!encoded) throw new Error('Workflow principal nao encontrado');
  return JSON.parse(Buffer.from(encoded, 'hex').toString('utf8'));
}

async function createBackup(conn, dbContainer, n8nContainer, stamp) {
  const backupName = `n8n-bot-hardening-${stamp}`;
  const backupDir = `/var/backups/mdv-system/${backupName}`;
  const script = `
set -euo pipefail
umask 077
backup_dir=${shellQuote(backupDir)}
test ! -e "$backup_dir"
mkdir -p "$backup_dir"
docker exec ${shellQuote(dbContainer)} pg_dump -U postgres -d n8n -Fc --no-owner --no-privileges > "$backup_dir/n8n-postgres.dump"
docker exec ${shellQuote(n8nContainer)} n8n export:workflow --all --output=/tmp/mdv-n8n-hardening-backup.json >/dev/null
docker cp ${shellQuote(`${n8nContainer}:/tmp/mdv-n8n-hardening-backup.json`)} "$backup_dir/workflows.json" >/dev/null
docker exec ${shellQuote(n8nContainer)} rm -f /tmp/mdv-n8n-hardening-backup.json
test -s "$backup_dir/n8n-postgres.dump"
test -s "$backup_dir/workflows.json"
(cd "$backup_dir" && sha256sum n8n-postgres.dump workflows.json > SHA256SUMS && sha256sum -c SHA256SUMS >/dev/null)
tar -C /var/backups/mdv-system -czf "$backup_dir.tar.gz" ${shellQuote(backupName)}
printf '%s' "$backup_dir"
`;
  return (await runRemote(conn, `printf %s ${shellQuote(Buffer.from(script).toString('base64'))} | base64 -d | bash`)).trim();
}

async function validateImportInIsolatedContainer(conn, errorWorkflow) {
  const image = (await runRemote(
    conn,
    "docker service inspect n8n_n8n --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'",
  )).trim();
  if (!image) throw new Error('Imagem do servico n8n nao encontrada');
  const remoteFile = `/tmp/${ERROR_WORKFLOW_ID}-validate-${process.pid}.json`;
  const payload = Buffer.from(JSON.stringify([errorWorkflow])).toString('base64');
  await runRemote(conn, `printf %s ${shellQuote(payload)} | base64 -d > ${shellQuote(remoteFile)}`);
  try {
    await runRemote(
      conn,
      `docker run --rm --entrypoint n8n -v ${shellQuote(`${remoteFile}:/tmp/workflow.json:ro`)} ${shellQuote(image)} import:workflow --input=/tmp/workflow.json`,
    );
  } finally {
    await runRemote(conn, `rm -f ${shellQuote(remoteFile)}`);
  }
}

async function applyChanges(conn, dbContainer, n8nContainer, context, errorWorkflow) {
  const remoteFile = `/tmp/${ERROR_WORKFLOW_ID}.json`;
  const importPayload = JSON.stringify([errorWorkflow]);
  await runRemote(
    conn,
    `printf %s ${shellQuote(Buffer.from(importPayload).toString('base64'))} | base64 -d > ${shellQuote(remoteFile)} && docker cp ${shellQuote(remoteFile)} ${shellQuote(`${n8nContainer}:/tmp/${ERROR_WORKFLOW_ID}.json`)} >/dev/null`,
  );
  try {
    await runRemote(
      conn,
      `docker exec ${shellQuote(n8nContainer)} n8n import:workflow --input=${shellQuote(`/tmp/${ERROR_WORKFLOW_ID}.json`)} --projectId=${shellQuote(context.projectId)}`,
    );
    await runRemote(conn, `docker exec ${shellQuote(n8nContainer)} n8n publish:workflow --id=${shellQuote(ERROR_WORKFLOW_ID)}`);

    const newSettings = {
      ...(context.settings || {}),
      availableInMCP: false,
      errorWorkflow: ERROR_WORKFLOW_ID,
    };
    const description = 'Atendimento oficial do WhatsApp Mercado do Vale: controle manual, contexto, classificacao, vendas, catalogo, memoria e envio pela Evolution API.';
    const sql = `
BEGIN;
UPDATE workflow_entity
SET name = ${sqlQuote(MAIN_WORKFLOW_NAME)},
    description = ${sqlQuote(description)},
    settings = ${dollarQuote(JSON.stringify(newSettings), 'settings')}::json,
    "updatedAt" = NOW()
WHERE id = ${sqlQuote(MAIN_WORKFLOW_ID)};
UPDATE workflow_history
SET name = ${sqlQuote(MAIN_WORKFLOW_NAME)},
    description = ${sqlQuote(description)},
    "updatedAt" = NOW()
WHERE "workflowId" = ${sqlQuote(MAIN_WORKFLOW_ID)}
  AND "versionId" = ${sqlQuote(context.activeVersionId)};
COMMIT;
`;
    await psql(conn, dbContainer, sql);
  } finally {
    await runRemote(conn, `docker exec ${shellQuote(n8nContainer)} rm -f ${shellQuote(`/tmp/${ERROR_WORKFLOW_ID}.json`)} >/dev/null 2>&1 || true; rm -f ${shellQuote(remoteFile)}`);
  }
}

async function verify(conn, dbContainer) {
  const sql = `
COPY (
  SELECT json_build_object(
    'mainActive', main.active,
    'mainName', main.name,
    'mcpDisabled', coalesce((main.settings::jsonb->>'availableInMCP')::boolean, false) = false,
    'errorWorkflowAssigned', main.settings::jsonb->>'errorWorkflow' = ${sqlQuote(ERROR_WORKFLOW_ID)},
    'mainVersionAligned', main."versionId" = main."activeVersionId",
    'errorExists', err.id IS NOT NULL,
    'errorActive', coalesce(err.active, false),
    'errorHasTrigger', coalesce(err.nodes::jsonb @> '[{"type":"n8n-nodes-base.errorTrigger"}]'::jsonb, false),
    'errorMcpDisabled', coalesce((err.settings::jsonb->>'availableInMCP')::boolean, false) = false,
    'mainCustomerSendRetryUnchanged', (
      SELECT bool_and(coalesce(node->>'retryOnFail', 'false') = 'false')
      FROM jsonb_array_elements(main.nodes::jsonb) node
      WHERE node->>'name' IN ('Enviar WhatsApp', 'Enviar WhatsApp - Imagem')
    )
  )::text
  FROM workflow_entity main
  LEFT JOIN workflow_entity err ON err.id = ${sqlQuote(ERROR_WORKFLOW_ID)}
  WHERE main.id = ${sqlQuote(MAIN_WORKFLOW_ID)}
) TO STDOUT;
`;
  return JSON.parse((await psql(conn, dbContainer, sql)).trim());
}

async function main() {
  if (APPLY && process.env.CONFIRM_N8N_HARDEN !== CONFIRMATION) {
    throw new Error(`Para aplicar, defina CONFIRM_N8N_HARDEN=${CONFIRMATION}`);
  }
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const dbContainer = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db.1' --format '{{.Names}}' | head -n 1")).trim();
    const n8nContainer = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n.1' --format '{{.Names}}' | head -n 1")).trim();
    if (!dbContainer || !n8nContainer) throw new Error('Containers n8n nao encontrados');

    const context = await readContext(conn, dbContainer);
    if (!context.active) throw new Error('Workflow principal nao esta ativo');
    if (!context.projectId) throw new Error('Projeto do workflow principal nao encontrado');
    const errorWorkflow = buildErrorWorkflow(context);
    validateWorkflow(errorWorkflow);
    await validateImportInIsolatedContainer(conn, errorWorkflow);

    const plan = {
      mode: APPLY ? 'apply' : 'dry-run',
      mainWorkflowId: MAIN_WORKFLOW_ID,
      mainCurrentName: context.name,
      mainNewName: MAIN_WORKFLOW_NAME,
      disableMcp: true,
      assignErrorWorkflow: ERROR_WORKFLOW_ID,
      errorWorkflowNodes: errorWorkflow.nodes.map((node) => node.name),
      adminSource: 'n8n-bot/global-control',
      customerSendRetryChanged: false,
      isolatedImportValidation: 'passed',
    };
    console.log(JSON.stringify(plan, null, 2));
    if (!APPLY) return;

    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '-');
    const backupDir = await createBackup(conn, dbContainer, n8nContainer, stamp);
    console.log(`BACKUP_DIR=${backupDir}`);
    await applyChanges(conn, dbContainer, n8nContainer, context, errorWorkflow);
    const result = await verify(conn, dbContainer);
    console.log(JSON.stringify(result, null, 2));
    if (!Object.values(result).every((value) => value === true || value === MAIN_WORKFLOW_NAME)) {
      throw new Error('Verificacao final do hardening nao passou integralmente');
    }
  } finally {
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
