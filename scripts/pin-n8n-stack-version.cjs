const path = require('node:path');
const { Client } = require('ssh2');
const { control: inspectIngress } = require('./n8n-upgrade-ingress-control.cjs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const VERSION = String(process.argv[2] || '2.33.7').trim();
const staleExecutionArg = process.argv.find((arg) => arg.startsWith('--stale-executions='));
const STALE_EXECUTION_IDS = staleExecutionArg ? staleExecutionArg.split('=')[1].split(',').filter(Boolean) : [];
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
  if (STALE_EXECUTION_IDS.some((id) => !/^\d+$/.test(id)) || new Set(STALE_EXECUTION_IDS).size !== STALE_EXECUTION_IDS.length) throw new Error('IDs de execucoes obsoletas invalidos');
  const n8nImage = `docker.n8n.io/n8nio/n8n:${VERSION}`;
  const runnerImage = `n8nio/runners:${VERSION}`;
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(sshConfig()));
  let stopped = false;
  let databaseMayHaveMigrated = false;
  let staleNeedsClosure = false;
  let backupDir = '';
  let oldN8nImage = '';
  let oldRunnerImage = '';
  try {
    await run(conn, `docker manifest inspect ${quote(n8nImage)} >/dev/null`);
    await run(conn, `docker manifest inspect ${quote(runnerImage)} >/dev/null`);
    backupDir = (await run(conn, `find /var/backups/mdv-system -maxdepth 1 -type d -mmin -30 -name ${quote(`n8n-pre-upgrade-${VERSION}-*`)} -printf '%T@ %p\\n' | sort -nr | head -n 1 | cut -d' ' -f2-`)).trim();
    if (!backupDir) throw new Error(`Backup pre-upgrade recente para ${VERSION} nao encontrado`);
    await run(conn, `test -s ${quote(`${backupDir}/n8n-postgres.dump`)} && grep -qx 'restore_test=passed' ${quote(`${backupDir}/manifest.txt`)} && cd ${quote(backupDir)} && sha256sum -c SHA256SUMS >/dev/null`);
    oldN8nImage = (await run(conn, `docker service inspect ${N8N_SERVICE} --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'`)).trim();
    oldRunnerImage = (await run(conn, `docker service inspect ${RUNNER_SERVICE} --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'`)).trim();
    await run(conn, `docker service inspect ${N8N_SERVICE} --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep -q '^N8N_ENCRYPTION_KEY='`);
    await run(conn, `docker service inspect ${N8N_SERVICE} --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep -q '^N8N_USER_MANAGEMENT_JWT_SECRET='`);
    await run(conn, `docker service inspect ${N8N_SERVICE} --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep -qx 'DB_POSTGRESDB_HOST=n8n-db'`);
    await run(conn, `docker service inspect ${RUNNER_SERVICE} --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep -qx 'N8N_BLOCK_ENV_ACCESS_IN_NODE=false'`);
    const ingress = await inspectIngress(conn, 'status');
    if (ingress.evolution.enabled || ingress.meta.enabled
      || !(ingress.evolution.configMatches || ingress.evolution.disabledConfigCleared)
      || !ingress.meta.workerProcessOnline || !ingress.meta.workerConfigured
      || ingress.meta.planningJobs || ingress.meta.sendingBlocks) {
      throw new Error('Ingressos WhatsApp/Meta nao estao quiescentes ou configurados para o upgrade');
    }
    const dbContainer = (await run(conn, "docker ps --filter 'name=n8n_n8n-db.1' --format '{{.Names}}' | head -n 1")).trim();
    const runningIds = (await run(conn, `docker exec ${quote(dbContainer)} psql -U postgres -d n8n -X -q -t -A -c ${quote(`select id from execution_entity where status='running' order by id;`)}`)).trim().split(/\s+/).filter(Boolean);
    if (runningIds.join(',') !== [...STALE_EXECUTION_IDS].sort((a, b) => Number(a) - Number(b)).join(',')) {
      throw new Error(`Existem execucoes em andamento nao autorizadas: ${runningIds.join(',')}`);
    }
    staleNeedsClosure = runningIds.length > 0;
    stopped = true;
    await run(conn, `docker service scale ${RUNNER_SERVICE}=0 >/dev/null`);
    await waitReplicas(conn, RUNNER_SERVICE, 0);
    await run(conn, `docker service scale ${N8N_SERVICE}=0 >/dev/null`);
    await waitReplicas(conn, N8N_SERVICE, 0);
    if (staleNeedsClosure) {
      const changed = (await run(conn, `docker exec ${quote(dbContainer)} psql -U postgres -d n8n -X -q -t -A -c ${quote(`update execution_entity set status='crashed', "stoppedAt"=now() where id in (${STALE_EXECUTION_IDS.join(',')}) and status='running' and "startedAt" < now() - interval '30 minutes' returning id;`)}`)).trim().split(/\s+/).filter(Boolean);
      if (changed.length !== STALE_EXECUTION_IDS.length || changed.some((id) => !STALE_EXECUTION_IDS.includes(id))) throw new Error('Execucoes obsoletas nao foram atualizadas integralmente');
    }
    await run(conn, `docker service update --image ${quote(n8nImage)} --detach=true ${N8N_SERVICE} >/dev/null`);
    await run(conn, `docker service update --image ${quote(runnerImage)} --detach=true ${RUNNER_SERVICE} >/dev/null`);
    databaseMayHaveMigrated = true;
    await run(conn, `docker service scale ${N8N_SERVICE}=1 >/dev/null`);
    await waitReplicas(conn, N8N_SERVICE, 1);
    await run(conn, `docker service scale ${RUNNER_SERVICE}=1 >/dev/null`);
    await waitReplicas(conn, RUNNER_SERVICE, 1);
    const n8nContainer = (await run(conn, "docker ps --filter 'name=n8n_n8n.1' --format '{{.Names}}' | head -n 1")).trim();
    const runningVersion = (await run(conn, `docker exec ${quote(n8nContainer)} n8n --version`)).trim();
    const images = (await run(conn, `docker service inspect ${N8N_SERVICE} ${RUNNER_SERVICE} --format '{{.Spec.Name}} {{.Spec.TaskTemplate.ContainerSpec.Image}}'`)).trim();
    const runnerTail = (await run(conn, `docker service logs ${RUNNER_SERVICE} --since 5m 2>&1 | tail -n 80`)).trim();
    const crashAbsent = !/Cannot assign to read only property 'prependListener'|Runner process exited with error/i.test(runnerTail);
    if (runningVersion !== VERSION) throw new Error(`n8n iniciou em ${runningVersion}, esperado ${VERSION}`);
    if (!crashAbsent) throw new Error('Task Runner ainda registra a falha de health check');
    const health = (await run(conn, "curl -fsS https://n8n.mercadodovale.com.br/healthz")).trim();
    const consistency = (await run(conn, `docker exec ${quote(dbContainer)} psql -U postgres -d n8n -X -q -t -A -c ${quote(`select count(*), count(*) filter (where we.nodes::jsonb=wh.nodes::jsonb and we.connections::jsonb=wh.connections::jsonb) from workflow_entity we left join workflow_history wh on wh."workflowId"=we.id and wh."versionId"=we."activeVersionId" where we.active=true;`)}`)).trim();
    const [activeWorkflowCount, matchingWorkflowCount] = consistency.split('|').map(Number);
    if (!activeWorkflowCount || matchingWorkflowCount !== activeWorkflowCount) throw new Error('Workflow ativo e historico divergiram apos o upgrade');
    stopped = false;
    console.log(JSON.stringify({ version: runningVersion, images, services: { n8n: '1/1', runner: '1/1' }, health, activeWorkflowHistoryMatches: matchingWorkflowCount, activeWorkflowCount, runnerHealthCrashAbsent: true, staleExecutionsClosed: STALE_EXECUTION_IDS, rollbackBackup: backupDir }, null, 2));
  } catch (error) {
    if (stopped) {
      await run(conn, `docker service scale ${RUNNER_SERVICE}=0 ${N8N_SERVICE}=0 >/dev/null`).catch(() => {});
      await waitReplicas(conn, RUNNER_SERVICE, 0).catch(() => {});
      await waitReplicas(conn, N8N_SERVICE, 0).catch(() => {});
      if (databaseMayHaveMigrated && backupDir) {
        const dbContainer = (await run(conn, "docker ps --filter 'name=n8n_n8n-db.1' --format '{{.Names}}' | head -n 1")).trim();
        await run(conn, `docker exec ${quote(dbContainer)} dropdb -U postgres --if-exists n8n && docker exec ${quote(dbContainer)} createdb -U postgres n8n && cat ${quote(`${backupDir}/n8n-postgres.dump`)} | docker exec -i ${quote(dbContainer)} pg_restore -U postgres -d n8n --exit-on-error --no-owner --no-privileges`);
      }
      if (oldN8nImage) await run(conn, `docker service update --image ${quote(oldN8nImage)} --detach=true ${N8N_SERVICE} >/dev/null`).catch(() => {});
      if (oldRunnerImage) await run(conn, `docker service update --image ${quote(oldRunnerImage)} --detach=true ${RUNNER_SERVICE} >/dev/null`).catch(() => {});
      await run(conn, `docker service scale ${N8N_SERVICE}=1 >/dev/null`).catch(() => {});
      await waitReplicas(conn, N8N_SERVICE, 1).catch(() => {});
      await run(conn, `docker service scale ${RUNNER_SERVICE}=1 >/dev/null`).catch(() => {});
      await waitReplicas(conn, RUNNER_SERVICE, 1).catch(() => {});
    }
    throw error;
  } finally {
    conn.end();
  }
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
