import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(file) {
  return readFileSync(file, 'utf8');
}

const layout = read('layouts/AdminLayout.tsx');
const routes = read('routes/index.tsx');
const page = read('pages/admin/settings/SystemBackupPage.tsx');
const service = read('services/systemBackupService.ts');
const server = read('vps_server.js');
const serverCjs = read('vps_server.cjs');
const deploy = read('deploy-vps-server-only.cjs');
const pkg = JSON.parse(read('package.json'));

assert.equal(
  pkg.scripts['test:system-backup-admin'],
  'node tmp-tests/system-backup-admin-static.test.mjs',
  'package.json must expose the system backup admin regression guard',
);

assert.match(layout, /Backup Sistema/, 'admin menu must expose Backup Sistema');
assert.match(layout, /\/admin\/settings\/system-backup/, 'admin menu must link to system backup page');

assert.match(routes, /SystemBackupPage/, 'routes must lazy-load SystemBackupPage');
assert.match(routes, /\/admin\/settings\/system-backup/, 'routes must register the protected backup page');

assert.match(page, /Fazer backup agora/, 'page must keep the manual backup button');
assert.match(page, /type="time"/, 'page must keep editable time input');
assert.match(page, /partial/, 'page must show a non-success state when Synology mirror is pending');
assert.match(page, /saveSystemBackupSchedule/, 'page must save the editable schedule');
assert.match(page, /runSystemBackupNow/, 'page must call manual backup action');
assert.match(page, /refreshing/, 'page must expose a visible refresh-in-progress state');
assert.match(page, /Atualizando\.\.\./, 'refresh button must communicate that it is working');
assert.match(page, /Tentar enviar para Synology/, 'partial backups must expose a retry action for Synology mirror');
assert.match(page, /Lista de detalhes do backup/, 'page must render a detailed backup step list after backup starts or finishes');
assert.match(page, /Acompanhamento ao vivo/, 'page must show a live tracking panel');
assert.match(page, /Ultimo sinal/, 'page must show the latest backend heartbeat timestamp');
assert.match(page, /mirroring/, 'page must keep visible progress while Synology retry request is in flight');
assert.match(page, /snapshot\?\.status\.state !== 'running' && !mirroring/, 'page must keep polling while retrying Synology');
assert.match(page, /backup-mercadodovale\/db|\/var\/backups\/mdv-system/, 'page must show backup locations');
assert.match(page, /vendas, clientes, aparelhos e produtos|Pagamentos, entregas e retiradas/, 'page must disclose operational data coverage');
assert.match(page, /role="progressbar"/, 'page must show an online progress bar while backup is running');
assert.match(page, /setInterval\(\(\) => \{[\s\S]*load\(\)/, 'page must keep polling status while backup is running');

assert.match(service, /\/admin\/system-backup/, 'service must call backend snapshot endpoint');
assert.match(service, /\/admin\/system-backup\/run/, 'service must call backend manual run endpoint');
assert.match(service, /\/admin\/system-backup\/synology-retry/, 'service must call backend Synology retry endpoint');
assert.match(service, /scheduleTime/, 'service must expose scheduleTime');
assert.match(service, /progress\?: number/, 'service status must expose backup progress');
assert.match(service, /step\?: string/, 'service status must expose backup step');
assert.match(service, /updatedAt\?: string/, 'service status must expose the latest backend heartbeat');
assert.match(service, /events\?: SystemBackupEvent/, 'service status must expose backup detail events');

assert.match(deploy, /vps_server\.cjs/, 'API deploy must upload vps_server.cjs because PM2 may execute that entrypoint');
assert.match(deploy, /remoteName: 'vps_server\.cjs'|`\$\{appDir\}\/vps_server\.cjs`/, 'API deploy must write the CJS server file remotely');

for (const [name, source] of [['vps_server.js', server], ['vps_server.cjs', serverCjs]]) {
  assert.match(source, /fastify\.get\('\/admin\/system-backup'/, `${name} must expose backup snapshot endpoint`);
  assert.match(source, /fastify\.patch\('\/admin\/system-backup'/, `${name} must expose schedule save endpoint`);
  assert.match(source, /fastify\.post\('\/admin\/system-backup\/run'/, `${name} must expose manual run endpoint`);
  assert.match(source, /requireAdminBearerToken/, `${name} backup endpoints must require admin bearer auth`);
  assert.doesNotMatch(
    source,
    /fastify\.(get|patch|post)\('\/admin\/system-backup[^']*', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${name} backup endpoints must not accept sync key auth`,
  );
  assert.match(source, /scheduleNextSystemBackup/, `${name} must schedule automatic backups`);
  assert.match(source, /SYSTEM_BACKUP_DEFAULT_TIME = '00:00'/, `${name} must default to midnight`);
  assert.match(source, /Estado running antigo foi invalidado/, `${name} must invalidate stale running backups after restart`);
  assert.match(source, /state: synologyMirror\?\.ok \? 'success' : 'partial'/, `${name} must not mark Synology mirror failures as full success`);
  assert.match(source, /SYSTEM_BACKUP_RETENTION_DAYS/, `${name} must define backup retention`);
  assert.match(source, /-mtime \+\$\{SYSTEM_BACKUP_RETENTION_DAYS\}/, `${name} must clean old backup files`);
  assert.match(source, /SYNOLOGY_BACKUP_FOLDER \|\| '\/backup-mercadodovale\/db'/, `${name} must reuse the existing Synology backup channel`);
  assert.match(source, /uploadSystemBackupArtifactsToSynology/, `${name} must mirror package and checksum to Synology`);
  assert.match(source, /retrySystemBackupSynologyMirror/, `${name} must allow retrying a partial Synology mirror`);
  assert.match(source, /fastify\.post\('\/admin\/system-backup\/synology-retry'/, `${name} must expose Synology mirror retry endpoint`);
  assert.match(source, /events: \[/, `${name} backup status must keep a detail event list`);
  assert.match(source, /appendSystemBackupEvent/, `${name} must append detailed backup events`);
  assert.match(source, /touchSystemBackupStatus/, `${name} must refresh heartbeat while long steps are still running`);
  assert.match(source, /systemBackupHeartbeat/, `${name} must keep a heartbeat timer for long-running backup steps`);
  assert.match(source, /updateSystemBackupProgress\(92, 'Enviando pacote para Synology'\)/, `${name} must report package upload to Synology`);
  assert.match(source, /updateSystemBackupProgress\(96, 'Enviando hash para Synology'\)/, `${name} must report checksum upload to Synology`);
  assert.match(source, /\.sha256/, `${name} must create and mirror checksum files`);
  assert.match(source, /headers\.authorization = incomingAuthorization/, `${name} vps proxy must forward admin bearer auth`);
  assert.match(source, /__MDV_PROGRESS__/, `${name} backup shell must emit progress markers`);
  assert.match(source, /progress: 100/, `${name} backup status must reach 100 percent`);
  assert.match(source, /updateSystemBackupProgress\(90, 'Enviando para Synology'\)/, `${name} backup status must report Synology upload step`);
  assert.match(source, /mysqldump|mariadb-dump/, `${name} must backup MySQL data`);
  assert.match(source, /mdv-site\.tar\.gz/, `${name} must backup published site`);
  assert.match(source, /mdv-api\.tar\.gz/, `${name} must backup API directory`);
}

console.log('system backup admin static checks passed');
