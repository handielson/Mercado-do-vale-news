const path = require('node:path');
const { Client } = require('ssh2');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const VERSION = String(process.argv[2] || '2.33.7').trim();
const N8N_SERVICE = 'n8n_n8n';
const RUNNER_SERVICE = 'n8n_n8n-runner';

function sshConfig() {
  const fs = require('node:fs');
  const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY || '';
  const config = {
    host: process.env.VPS_SITE_HOST || process.env.VPS_HOST,
    port: Number(process.env.VPS_SITE_PORT || process.env.VPS_PORT || 22),
    username: process.env.VPS_SITE_USER || process.env.VPS_USER,
    password: process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD,
    privateKey: privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined,
  };
  if (!config.host || !config.username || (!config.password && !config.privateKey)) throw new Error('VPS SSH nao configurado');
  return config;
}

function quote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function run(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Comando remoto falhou: ${code}`)));
  }));
}

async function waitReplicas(conn, service, expected, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const replicas = (await run(conn, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timeout aguardando ${service}=${expected}/${expected}`);
}

async function main() {
  if (!/^\d+\.\d+\.\d+$/.test(VERSION)) throw new Error('Versao invalida. Use X.Y.Z.');
  const n8nImage = `docker.n8n.io/n8nio/n8n:${VERSION}`;
  const runnerImage = `n8nio/runners:${VERSION}`;
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(sshConfig()));
  let stopped = false;
  try {
    await run(conn, `docker manifest inspect ${quote(n8nImage)} >/dev/null`);
    await run(conn, `docker manifest inspect ${quote(runnerImage)} >/dev/null`);
    await run(conn, `docker service scale ${RUNNER_SERVICE}=0 >/dev/null`);
    await waitReplicas(conn, RUNNER_SERVICE, 0);
    await run(conn, `docker service scale ${N8N_SERVICE}=0 >/dev/null`);
    await waitReplicas(conn, N8N_SERVICE, 0);
    stopped = true;
    await run(conn, `docker service update --image ${quote(n8nImage)} --detach=true ${N8N_SERVICE} >/dev/null`);
    await run(conn, `docker service update --image ${quote(runnerImage)} --detach=true ${RUNNER_SERVICE} >/dev/null`);
    await run(conn, `docker service scale ${N8N_SERVICE}=1 >/dev/null`);
    await waitReplicas(conn, N8N_SERVICE, 1);
    await run(conn, `docker service scale ${RUNNER_SERVICE}=1 >/dev/null`);
    await waitReplicas(conn, RUNNER_SERVICE, 1);
    stopped = false;
    const n8nContainer = (await run(conn, "docker ps --filter 'name=n8n_n8n.1' --format '{{.Names}}' | head -n 1")).trim();
    const runningVersion = (await run(conn, `docker exec ${quote(n8nContainer)} n8n --version`)).trim();
    const images = (await run(conn, `docker service inspect ${N8N_SERVICE} ${RUNNER_SERVICE} --format '{{.Spec.Name}} {{.Spec.TaskTemplate.ContainerSpec.Image}}'`)).trim();
    const runnerTail = (await run(conn, `docker service logs ${RUNNER_SERVICE} --since 5m 2>&1 | tail -n 80`)).trim();
    const crashAbsent = !/Cannot assign to read only property 'prependListener'|Runner process exited with error/i.test(runnerTail);
    if (runningVersion !== VERSION) throw new Error(`n8n iniciou em ${runningVersion}, esperado ${VERSION}`);
    if (!crashAbsent) throw new Error('Task Runner ainda registra a falha de health check');
    console.log(JSON.stringify({ version: runningVersion, images, services: { n8n: '1/1', runner: '1/1' }, runnerHealthCrashAbsent: true }, null, 2));
  } finally {
    if (stopped) {
      await run(conn, `docker service scale ${N8N_SERVICE}=1 >/dev/null`).catch(() => {});
      await waitReplicas(conn, N8N_SERVICE, 1).catch(() => {});
      await run(conn, `docker service scale ${RUNNER_SERVICE}=1 >/dev/null`).catch(() => {});
      await waitReplicas(conn, RUNNER_SERVICE, 1).catch(() => {});
    }
    conn.end();
  }
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
