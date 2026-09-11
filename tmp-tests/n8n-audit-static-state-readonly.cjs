const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
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

async function psql(conn, container, sql) {
  return runRemote(
    conn,
    `docker exec -i ${shellQuote(container)} psql -U postgres -d n8n -X -q -t -A <<'SQL'\n\\set ON_ERROR_STOP on\n${sql}\nSQL`,
  );
}

function findStaticKeys(code) {
  const keys = new Set();
  const patterns = [
    /staticData(?:For\w+)?\s*\.\s*([A-Za-z_$][\w$]*)/g,
    /staticData(?:For\w+)?\s*\?\.\s*([A-Za-z_$][\w$]*)/g,
    /staticData(?:For\w+)?\s*\[\s*['"]([^'"]+)['"]\s*\]/g,
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) keys.add(match[1]);
  }
  return [...keys].sort();
}

function findTtls(code) {
  const values = new Set();
  for (const match of code.matchAll(/expiresAt\s*[:=][^\n;]{0,100}/g)) {
    const expression = match[0]
      .replace(/\s+/g, ' ')
      .replace(/\b\d{7,}\b/g, '<timestamp>')
      .slice(0, 140);
    values.add(expression);
  }
  return [...values];
}

function findStateFields(code) {
  const fields = new Set();
  const patterns = [
    /\bactiveState\s*\?*\.\s*([A-Za-z_$][\w$]*)/g,
    /\bstate\s*\?*\.\s*([A-Za-z_$][\w$]*)/g,
    /\borderDraft\s*\?*\.\s*([A-Za-z_$][\w$]*)/g,
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) fields.add(match[1]);
  }
  return [...fields].sort();
}

function classifyKey(key) {
  const map = {
    salesPostList: 'estado comercial e selecao numerica',
    pendingDeviceClarification: 'desambiguacao de aparelho',
    pendingPhoneStockListOffer: 'oferta de lista apos indisponibilidade',
    optionalCustomerName: 'convite opcional de nome',
    googleContactNameCache: 'cache de nome do Google Contacts',
    botSentMessageIds: 'deduplicacao de mensagens do proprio bot',
  };
  return map[key] || 'revisao manual necessaria';
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const container = (await runRemote(
      conn,
      "docker ps --filter 'name=n8n_n8n-db.1' --format '{{.Names}}' | head -n 1",
    )).trim();
    if (!container) throw new Error('Container Postgres do n8n nao encontrado');

    const sql = `
COPY (
  SELECT encode(convert_to(json_build_object(
    'name', name,
    'active', active,
    'versionId', "versionId",
    'activeVersionId', "activeVersionId",
    'nodes', nodes::jsonb,
    'connections', connections::jsonb
  )::text, 'UTF8'), 'hex')
  FROM workflow_entity
  WHERE id = ${sqlQuote(WORKFLOW_ID)}
  LIMIT 1
) TO STDOUT;
`;
    const encoded = (await psql(conn, container, sql)).trim();
    if (!encoded) throw new Error('Workflow nao encontrado');
    const workflow = JSON.parse(Buffer.from(encoded, 'hex').toString('utf8'));
    const nodes = [];
    const allKeys = new Set();
    for (const node of workflow.nodes || []) {
      const code = String(node.parameters?.jsCode || '');
      if (!code.includes('$getWorkflowStaticData')) continue;
      const keys = findStaticKeys(code);
      keys.forEach((key) => allKeys.add(key));
      nodes.push({
        node: node.name,
        type: node.type,
        keys,
        purposes: keys.map((key) => classifyKey(key)),
        ttlExpressions: findTtls(code),
        stateFields: findStateFields(code),
      });
    }
    const incoming = {};
    for (const [source, outputs] of Object.entries(workflow.connections || {})) {
      for (const branches of Object.values(outputs || {})) {
        for (const branch of branches || []) {
          for (const edge of branch || []) {
            incoming[edge.node] ||= [];
            incoming[edge.node].push(source);
          }
        }
      }
    }
    const staticNames = new Set(nodes.map((node) => node.node));
    for (const node of nodes) {
      const outputs = workflow.connections?.[node.node]?.main || [];
      node.incoming = [...new Set(incoming[node.node] || [])].sort();
      node.outgoing = [...new Set(outputs.flat().map((edge) => edge.node))].sort();
      node.adjacentStaticNodes = [...new Set([...node.incoming, ...node.outgoing].filter((name) => staticNames.has(name)))].sort();
    }
    console.log(JSON.stringify({
      mode: 'readonly',
      workflow: {
        id: WORKFLOW_ID,
        name: workflow.name,
        active: workflow.active,
        versionAligned: workflow.versionId === workflow.activeVersionId,
      },
      staticStateNodeCount: nodes.length,
      staticStateKeys: [...allKeys].sort(),
      productLookupParameters: (workflow.nodes || []).find((node) => node.name === 'Vendas - Buscar Produtos')?.parameters || null,
      nodes,
    }, null, 2));
  } finally {
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
