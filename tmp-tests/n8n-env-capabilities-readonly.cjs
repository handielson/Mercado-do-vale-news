const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || stdout || `Remote command failed: ${code}`));
      });
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
    const command = `
set -eu
docker service inspect n8n_n8n --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}'
`;
    const raw = await runRemote(conn, command);
    const envList = JSON.parse(raw.trim());
    const names = envList.map((entry) => String(entry).split('=')[0]).sort();
    console.log(JSON.stringify({
      hasEvolutionServerUrl: names.includes('EVOLUTION_SERVER_URL'),
      hasEvolutionApiKey: names.includes('EVOLUTION_API_KEY'),
      hasSyncKey: names.some((name) => /SYNC|VPS|API.*KEY|SECRET/.test(name)),
      matchingNames: names.filter((name) => /SYNC|VPS|API.*KEY|SECRET|MDV|N8N_BLOCK_ENV_ACCESS/.test(name)),
    }, null, 2));
  } finally {
    conn.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
