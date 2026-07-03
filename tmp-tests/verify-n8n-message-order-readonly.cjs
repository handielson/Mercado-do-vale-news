const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });
  try {
    const dbContainer = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    const services = await runRemote(conn, "docker service ls --filter name=n8n --format '{{.Name}} {{.Replicas}}'");
    const sql = `
COPY (
  SELECT json_build_object(
    'splitCarriesDelay', EXISTS (
      SELECT 1 FROM jsonb_array_elements(nodes::jsonb) node
      WHERE node->>'name' = 'Dividir mensagens'
        AND node->'parameters'->>'jsCode' LIKE '%delayMs: Number(message.delayMs || 0)%'
    ),
    'textUsesDelayMs', EXISTS (
      SELECT 1 FROM jsonb_array_elements(nodes::jsonb) node
      WHERE node->>'name' = 'Enviar WhatsApp'
        AND node->'parameters'->'bodyParameters'->'parameters'::text LIKE '%$json.delayMs%'
    ),
    'imageUsesDelayMs', EXISTS (
      SELECT 1 FROM jsonb_array_elements(nodes::jsonb) node
      WHERE node->>'name' = 'Enviar WhatsApp - Imagem'
        AND node->'parameters'->'bodyParameters'->'parameters'::text LIKE '%$json.delayMs%'
    ),
    'multiColorHasFinalDelay', EXISTS (
      SELECT 1 FROM jsonb_array_elements(nodes::jsonb) node
      WHERE node->>'name' = 'Vendas - Verificar Pos Lista'
        AND node->'parameters'->>'jsCode' LIKE '%1200 + messages.length * 4500%'
    )
  )::text
  FROM workflow_entity
  WHERE id = ${shQuote(WORKFLOW_ID)}
) TO STDOUT;
`;
    const checks = await runRemote(conn, `docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A <<'SQL'\n${sql}\nSQL`);
    console.log('SERVICES');
    console.log(services.trim());
    console.log('CHECKS');
    console.log(checks.trim());
  } finally {
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
