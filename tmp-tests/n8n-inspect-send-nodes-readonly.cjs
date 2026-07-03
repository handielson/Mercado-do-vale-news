const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAMES = ['Dividir mensagens', 'Enviar WhatsApp', 'Enviar WhatsApp - Imagem', 'Enviar WhatsApp - Tipo imagem?'];

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
    const sql = `
COPY (
  SELECT encode(convert_to(json_agg(node)::text, 'UTF8'), 'hex')
  FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node
  WHERE id = ${shQuote(WORKFLOW_ID)}
    AND node->>'name' IN (${NODE_NAMES.map(shQuote).join(', ')})
) TO STDOUT;
`;
    const out = await runRemote(conn, `docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A <<'SQL'\n${sql}\nSQL`);
    console.log(JSON.stringify(JSON.parse(Buffer.from(out.trim(), 'hex').toString('utf8')), null, 2));
  } finally {
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
