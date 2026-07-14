const path = require('path');
const vm = require('node:vm');

const workspace = path.resolve(__dirname, '..', '..', '..', 'mercado-do-vale');
try {
  require('dotenv').config({ path: path.join(workspace, '.env.vps.local') });
  require('dotenv').config({ path: path.join(workspace, '.env.local') });
} catch {}
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}

function execute(code, conversation) {
  const source = { conversation, remoteJid: '559999999999@s.whatsapp.net', Instancia: 'botmercadodovale' };
  return vm.runInNewContext(`(function(){${code}})()`, {
    $json: { ...source, output: 'RESPOSTA' },
    $: (name) => ({ first: () => ({ json: name === 'switc Mensagens' ? source : {} }) }),
    $getWorkflowStaticData: () => ({}),
    Date,
  });
}

async function main() {
  const { Client } = require('ssh2');
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    const services = await runRemote(conn, "docker service ls --filter name=n8n --format '{{.Name}} {{.Replicas}}'");
    const sql = `COPY (
      SELECT encode(convert_to(json_build_object(
        'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
        'splitCode', (SELECT node->'parameters'->>'jsCode' FROM jsonb_array_elements(we.nodes::jsonb) node WHERE node->>'name'='Dividir mensagens')
      )::text, 'UTF8'), 'hex')
      FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId"
      WHERE we.id='SkrkB4vyKVDnQ68t'
    ) TO STDOUT;`;
    const raw = await runRemote(conn, `docker exec ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A -c ${shQuote(sql)}`);
    const data = JSON.parse(Buffer.from(raw.trim(), 'hex').toString('utf8'));
    new Function(data.splitCode);
    const declineItems = execute(data.splitCode, 'Nãoooo');
    const questionItems = execute(data.splitCode, 'Não tem Redmi 15?');
    const serviceMap = Object.fromEntries(services.trim().split(/\r?\n/).filter(Boolean).map((line) => {
      const [name, replicas] = line.trim().split(/\s+/);
      return [name, replicas];
    }));
    console.log(JSON.stringify({
      entityHistoryEqual: data.entityHistoryEqual,
      declineMessages: declineItems.map((item) => item.json.message),
      declineHasNameInvitation: declineItems.some((item) => /prefere ser chamado/i.test(item.json.message)),
      productQuestionKeepsNormalFlow: questionItems.length >= 1,
      n8nReplicas: serviceMap.n8n_n8n,
      runnerReplicas: serviceMap['n8n_n8n-runner'],
      evolutionReplicas: serviceMap['n8n_evolution-api'],
      codeCompiles: true,
    }, null, 2));
  } finally {
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
