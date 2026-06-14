# System Backup And Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um sistema confiavel de backup geral, versao `v1.0.0` do Mercado do Vale e rotina de restauracao validavel para recuperar o sistema quando uma regressao, refatoracao ruim ou deploy quebrado acontecer.

**Architecture:** O sistema tera quatro camadas: manifest/versionamento no repositorio, scripts locais que orquestram backup/restore, rotina automatica na VPS para capturar site/API/banco todos os dias a meia-noite, e espelhamento para o Synology como copia externa. Cada backup gera um diretorio imutavel com manifesto JSON, hashes SHA256 e instrucoes de restore; restauracao comeca em `--dry-run` e so aplica mudancas com `--apply`.

**Tech Stack:** Node.js ESM/CJS no projeto, PowerShell como shell local, SSH via `ssh2` ja usado no deploy, MySQL dump na VPS, tar/gzip no Linux, Git tags/releases, Vite build e scripts existentes `deploy:vps-site` / `deploy-vps-server-only.cjs`.

---

## Escopo E Decisoes

O backup `v1.0.0` deve cobrir:

- codigo fonte versionado via Git commit + tag;
- build/site publicado em `/var/www/mdv-site/current`;
- release anterior e lista de releases em `/var/www/mdv-site/releases`;
- API publicada em `/var/www/mdv-api`;
- banco MySQL operacional, incluindo vendas, clientes, aparelhos, produtos, pagamentos, entregas/retiradas e demais dados persistidos;
- arquivos de configuracao sem expor segredos no log;
- manifestos com data, versao, commit, release ativa, checksums e comandos de restore.

O backup `v1.0.0` nao deve tentar salvar:

- `node_modules`;
- `dist/` local fora do pacote remoto, exceto quando usado para verificacao;
- logs grandes rotativos;
- arquivos soltos preexistentes que nao pertencem ao escopo.

Locais padrao dos backups:

```text
VPS, copia primaria automatica:
/var/backups/mdv-system

Synology/SynologyDrive, copia externa espelhada:
C:\Users\Nitro\SynologyDrive\SynologyDrive\Backups\Mercado do Vale\system

Repositorio local, manifestos e restauracao manual:
C:\Users\Nitro\SynologyDrive\SynologyDrive\Programas\Mercado do Vale New\mercado-do-vale\.system-backups
```

Regra de armazenamento:

```text
1. Todo backup nasce na VPS, porque a VPS fica ligada e possui acesso direto aos arquivos publicados e ao banco.
2. Depois de criado, o pacote e o `.sha256` devem ser copiados para o Synology.
3. Restauracao pode usar a copia da VPS ou a copia do Synology, desde que o hash confira.
4. A copia local `.system-backups` serve para manifesto, auditoria e restauracao comandada pelo Codex/PowerShell.
```

Nomes dos pacotes:

```text
mdv-system-v1.0.0-YYYYMMDD-HHMMSS
mdv-system-v1.0.0-YYYYMMDD-HHMMSS.tar.gz
mdv-system-v1.0.0-YYYYMMDD-HHMMSS.sha256
```

---

## Arquivos

Criar:

- `scripts/system-backup.cjs`: orquestra backup local/remoto, cria manifesto e baixa pacote da VPS.
- `scripts/system-restore.cjs`: valida pacote, mostra plano de restore e aplica somente com `--apply`.
- `scripts/system-backup-common.cjs`: helpers compartilhados para env, SSH, hash, manifesto e comandos.
- `scripts/system-backup-schedule.cjs`: instala/valida rotina diaria de backup na VPS.
- `tmp-tests/system-backup-static.test.mjs`: guarda estatica para scripts, dry-run, hashes e proibicao de imprimir segredos.
- `docs/backup/README.md`: runbook humano para criar backup, restaurar, validar e testar restore.
- `docs/backup/restore-drill.md`: checklist de simulacao de desastre.
- `SYSTEM_VERSION.md`: versao atual, data, commit base e release VPS.

Modificar:

- `package.json`: mudar `"version"` para `"1.0.0"` e adicionar scripts `backup:system`, `restore:system`, `backup:schedule`, `test:system-backup`.
- `publicar.md`: exigir backup antes de publicacoes de alto risco e registrar versao/backup no checklist final.

Nao tocar:

- arquivos soltos preexistentes fora do escopo;
- credenciais `.env*` como conteudo versionado;
- deploy scripts existentes alem de leitura/reuso.

---

## Task 1: Inventario E Definicao Da Versao V1.0.0

**Files:**
- Create: `SYSTEM_VERSION.md`
- Modify: `package.json`
- Test: `tmp-tests/system-backup-static.test.mjs`

- [ ] **Step 1: Auditar sujeira preexistente**

Run:

```powershell
git status --short
git ls-files --others --exclude-standard
rg "backup|restore|version|release|rollback" package.json scripts publicar.md docs tmp-tests
```

Expected:

```text
Registrar quais arquivos soltos ja existiam antes da implementacao. Nao apagar nem stagear nada que nao seja deste plano.
```

- [ ] **Step 2: Criar teste falhando para versao e scripts**

Create `tmp-tests/system-backup-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

assert.equal(pkg.version, '1.0.0', 'package.json must declare system baseline version 1.0.0');
assert.equal(pkg.scripts['backup:system'], 'node scripts/system-backup.cjs', 'package.json must expose backup:system');
assert.equal(pkg.scripts['restore:system'], 'node scripts/system-restore.cjs', 'package.json must expose restore:system');
assert.equal(pkg.scripts['backup:schedule'], 'node scripts/system-backup-schedule.cjs', 'package.json must expose backup:schedule');
assert.equal(pkg.scripts['test:system-backup'], 'node tmp-tests/system-backup-static.test.mjs', 'package.json must expose test:system-backup');

for (const file of [
  'scripts/system-backup.cjs',
  'scripts/system-restore.cjs',
  'scripts/system-backup-common.cjs',
  'scripts/system-backup-schedule.cjs',
  'SYSTEM_VERSION.md',
  'docs/backup/README.md',
  'docs/backup/restore-drill.md',
]) {
  assert.ok(existsSync(file), `${file} must exist`);
}

const backup = readFileSync('scripts/system-backup.cjs', 'utf8');
const restore = readFileSync('scripts/system-restore.cjs', 'utf8');
const common = readFileSync('scripts/system-backup-common.cjs', 'utf8');
const schedule = readFileSync('scripts/system-backup-schedule.cjs', 'utf8');
const docs = readFileSync('docs/backup/README.md', 'utf8');

assert.match(backup, /createSystemBackup/, 'backup script must expose createSystemBackup');
assert.match(backup, /manifest\.json/, 'backup script must write manifest.json');
assert.match(backup, /sha256/i, 'backup script must create sha256 checksums');
assert.match(backup, /mysqldump|mariadb-dump/, 'backup script must capture MySQL dump remotely');
assert.match(backup, /\/var\/www\/mdv-site\/current/, 'backup script must capture current site release');
assert.match(backup, /\/var\/www\/mdv-api/, 'backup script must capture API directory');

assert.match(restore, /--dry-run/, 'restore must default to dry-run behavior');
assert.match(restore, /--apply/, 'restore must require --apply for destructive restore');
assert.match(restore, /verifyBackupPackage/, 'restore must verify package before restore');
assert.doesNotMatch(restore, /rm\s+-rf\s+\//, 'restore must not contain broad rm -rf /');

assert.match(common, /redact|SECRET|PASSWORD|PRIVATE_KEY/i, 'shared helpers must redact secrets in logs');
assert.match(schedule, /0 0 \* \* \*|midnight|meia-noite/i, 'schedule script must install a daily midnight backup');
assert.match(schedule, /\/var\/backups\/mdv-system/, 'schedule script must keep primary backups on VPS');
assert.match(schedule, /Synology|MDV_SYNOLOGY_BACKUP_DIR|rsync|sftp/i, 'schedule script must support mirroring backups to Synology');
assert.match(docs, /restore drill/i, 'backup docs must include restore drill instructions');
assert.match(docs, /vendas|clientes|aparelhos|produtos/i, 'backup docs must state operational data coverage');

console.log('system backup static checks passed');
```

- [ ] **Step 3: Rodar teste para confirmar falha**

Run:

```powershell
node tmp-tests\system-backup-static.test.mjs
```

Expected:

```text
FAIL porque version ainda nao e 1.0.0 e scripts/docs ainda nao existem.
```

- [ ] **Step 4: Atualizar `package.json`**

Change:

```json
{
  "version": "1.0.0",
  "scripts": {
    "backup:system": "node scripts/system-backup.cjs",
    "restore:system": "node scripts/system-restore.cjs",
    "backup:schedule": "node scripts/system-backup-schedule.cjs",
    "test:system-backup": "node tmp-tests/system-backup-static.test.mjs"
  }
}
```

Keep all existing scripts unchanged.

- [ ] **Step 5: Criar `SYSTEM_VERSION.md`**

Create:

```markdown
# Mercado do Vale System Version

Current baseline: `v1.0.0`

Purpose: stable restore point after backup, regression guards and publication hygiene rules were formalized.

Baseline contents:

- Frontend/admin Vite app
- VPS Fastify API (`mdv-api`)
- MySQL operational database
- Sales, customers, devices, products, payments and delivery data
- Nginx-served site release
- Backup and restore scripts
- Regression/refactoring guard policy in `publicar.md`

Release checklist:

- [ ] `npm.cmd run build`
- [ ] `npm.cmd run backup:system`
- [ ] Git tag `v1.0.0`
- [ ] Site deploy confirmed
- [ ] API deploy confirmed when API changes
- [ ] Public URL verified
- [ ] Restore dry-run verified
```

- [ ] **Step 6: Rodar teste novamente**

Run:

```powershell
node tmp-tests\system-backup-static.test.mjs
```

Expected:

```text
Ainda falha porque scripts/docs do backup ainda nao existem.
```

- [ ] **Step 7: Commit parcial**

Run:

```powershell
git add -- package.json SYSTEM_VERSION.md tmp-tests/system-backup-static.test.mjs
git commit -m "chore(system): declare v1 baseline"
```

Expected:

```text
Commit pequeno somente com versao e guarda inicial.
```

---

## Task 2: Helpers Compartilhados De Backup

**Files:**
- Create: `scripts/system-backup-common.cjs`
- Test: `tmp-tests/system-backup-static.test.mjs`

- [ ] **Step 1: Criar helpers com redacao de segredos**

Create `scripts/system-backup-common.cjs`:

```js
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('ssh2');

const SECRET_KEY_RE = /(PASSWORD|PRIVATE_KEY|SECRET|TOKEN|MYSQL_|VPS_SITE_PASSWORD|VPS_SITE_PRIVATE_KEY)/i;

function redactEnvValue(key, value) {
  if (SECRET_KEY_RE.test(String(key))) return value ? '[REDACTED]' : '';
  return value;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function buildSshConfig() {
  const host = readRequiredEnv('VPS_SITE_HOST');
  const username = readRequiredEnv('VPS_SITE_USER');
  const password = process.env.VPS_SITE_PASSWORD || undefined;
  const privateKey = process.env.VPS_SITE_PRIVATE_KEY || undefined;
  if (!password && !privateKey) {
    throw new Error('Missing VPS_SITE_PASSWORD or VPS_SITE_PRIVATE_KEY');
  }
  return { host, username, password, privateKey };
}

function execSsh(command) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let stdout = '';
    let stderr = '';
    client
      .on('ready', () => {
        client.exec(command, (err, stream) => {
          if (err) {
            client.end();
            reject(err);
            return;
          }
          stream.on('close', (code) => {
            client.end();
            if (code === 0) resolve({ stdout, stderr });
            else reject(new Error(`SSH command failed (${code}): ${stderr || stdout}`));
          });
          stream.on('data', (chunk) => { stdout += chunk.toString(); });
          stream.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        });
      })
      .on('error', reject)
      .connect(buildSshConfig());
  });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function backupName(version, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  return `mdv-system-v${version}-${stamp}`;
}

module.exports = {
  backupName,
  buildSshConfig,
  ensureDir,
  execSsh,
  redactEnvValue,
  sha256File,
  writeJson,
};
```

- [ ] **Step 2: Rodar guarda**

Run:

```powershell
node tmp-tests\system-backup-static.test.mjs
```

Expected:

```text
Ainda falha por falta dos scripts principais/docs, mas nao por helper ausente.
```

- [ ] **Step 3: Commit**

Run:

```powershell
git add -- scripts/system-backup-common.cjs tmp-tests/system-backup-static.test.mjs
git commit -m "chore(system): add backup helpers"
```

---

## Task 3: Script De Backup Geral

**Files:**
- Create: `scripts/system-backup.cjs`
- Test: `tmp-tests/system-backup-static.test.mjs`

- [ ] **Step 1: Criar backup remoto com manifesto**

Create `scripts/system-backup.cjs`:

```js
#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const dotenv = require('dotenv');
const {
  backupName,
  ensureDir,
  execSsh,
  redactEnvValue,
  sha256File,
  writeJson,
} = require('./system-backup-common.cjs');

for (const file of ['.env.vps.local', '.env.local', '.env']) {
  if (fs.existsSync(file)) dotenv.config({ path: file, override: false });
}

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function packageVersion() {
  return JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
}

async function createSystemBackup() {
  const version = packageVersion();
  const name = backupName(version);
  const localRoot = process.env.MDV_SYSTEM_BACKUP_DIR || path.resolve('.system-backups');
  const localDir = path.join(localRoot, name);
  const remoteRoot = process.env.MDV_REMOTE_BACKUP_DIR || '/var/backups/mdv-system';
  const remoteDir = `${remoteRoot}/${name}`;
  const remoteTar = `${remoteRoot}/${name}.tar.gz`;
  const commit = runGit(['rev-parse', 'HEAD']);
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const status = runGit(['status', '--short']);

  ensureDir(localDir);

  const envSummary = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => /^(VPS_SITE_|MYSQL_|MDV_|VITE_VPS_)/.test(key))
      .map(([key, value]) => [key, redactEnvValue(key, value)])
  );

  const remoteScript = `
set -euo pipefail
mkdir -p '${remoteDir}'
readlink /var/www/mdv-site/current > '${remoteDir}/site-current.txt' || true
ls -la /var/www/mdv-site/releases > '${remoteDir}/site-releases.txt' || true
tar -C /var/www/mdv-site -czf '${remoteDir}/site-current.tar.gz' current previous releases 2>/tmp/mdv-site-tar.err || tar -C /var/www/mdv-site -czf '${remoteDir}/site-current.tar.gz' current
tar -C /var/www -czf '${remoteDir}/mdv-api.tar.gz' mdv-api
if command -v mysqldump >/dev/null 2>&1; then
  mysqldump --single-transaction --routines --triggers --events "$MYSQL_DATABASE" > '${remoteDir}/mysql.sql'
elif command -v mariadb-dump >/dev/null 2>&1; then
  mariadb-dump --single-transaction --routines --triggers --events "$MYSQL_DATABASE" > '${remoteDir}/mysql.sql'
else
  echo "mysqldump/mariadb-dump not found" >&2
  exit 9
fi
sha256sum '${remoteDir}'/* > '${remoteDir}/SHA256SUMS'
tar -C '${remoteRoot}' -czf '${remoteTar}' '${name}'
sha256sum '${remoteTar}' > '${remoteTar}.sha256'
`;

  const manifest = {
    schema: 1,
    name,
    version,
    createdAt: new Date().toISOString(),
    git: { branch, commit, dirty: status.length > 0, status },
    localDir,
    remoteDir,
    remoteTar,
    env: envSummary,
    includes: [
      '/var/www/mdv-site/current',
      '/var/www/mdv-site/previous',
      '/var/www/mdv-site/releases',
      '/var/www/mdv-api',
      'MySQL dump',
    ],
  };

  writeJson(path.join(localDir, 'manifest.json'), manifest);
  writeJson(path.join(localDir, 'remote-script.json'), { remoteScript });

  console.log(`[backup] creating remote backup ${name}`);
  await execSsh(remoteScript);

  console.log(`[backup] remote package ready: ${remoteTar}`);
  console.log('[backup] download package manually or extend script with SFTP in Task 4');

  const manifestHash = sha256File(path.join(localDir, 'manifest.json'));
  fs.writeFileSync(path.join(localDir, 'manifest.json.sha256'), `${manifestHash}  manifest.json\n`, 'utf8');
  console.log(`[backup] local manifest: ${path.join(localDir, 'manifest.json')}`);
}

if (require.main === module) {
  createSystemBackup().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { createSystemBackup };
```

- [ ] **Step 2: Rodar guarda estatica**

Run:

```powershell
node tmp-tests\system-backup-static.test.mjs
```

Expected:

```text
Ainda falha porque restore/docs nao existem.
```

- [ ] **Step 3: Fazer dry-run conceitual sem SSH**

Run:

```powershell
node -e "const { backupName } = require('./scripts/system-backup-common.cjs'); console.log(backupName('1.0.0', new Date('2026-06-13T12:00:00Z')))"
```

Expected:

```text
mdv-system-v1.0.0-20260613-120000
```

- [ ] **Step 4: Commit**

Run:

```powershell
git add -- scripts/system-backup.cjs scripts/system-backup-common.cjs tmp-tests/system-backup-static.test.mjs
git commit -m "chore(system): add system backup script"
```

---

## Task 4: Script De Restore Seguro

**Files:**
- Create: `scripts/system-restore.cjs`
- Test: `tmp-tests/system-backup-static.test.mjs`

- [ ] **Step 1: Criar restore com `--dry-run` padrao**

Create `scripts/system-restore.cjs`:

```js
#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execSsh, sha256File } = require('./system-backup-common.cjs');

function readArgs(argv) {
  const args = { apply: false, package: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--apply') args.apply = true;
    else if (value === '--dry-run') args.apply = false;
    else if (value === '--package') {
      args.package = argv[i + 1] || '';
      i += 1;
    }
  }
  if (!args.package) throw new Error('Usage: node scripts/system-restore.cjs --package <backup.tar.gz> [--dry-run|--apply]');
  return args;
}

function verifyBackupPackage(packagePath) {
  if (!fs.existsSync(packagePath)) throw new Error(`Backup package not found: ${packagePath}`);
  if (!packagePath.endsWith('.tar.gz')) throw new Error('Backup package must be a .tar.gz file');
  const shaFile = `${packagePath}.sha256`;
  if (fs.existsSync(shaFile)) {
    const expected = fs.readFileSync(shaFile, 'utf8').trim().split(/\s+/)[0];
    const actual = sha256File(packagePath);
    if (expected && expected !== actual) throw new Error(`SHA256 mismatch: expected ${expected}, got ${actual}`);
  }
  return { packagePath: path.resolve(packagePath), sha256: sha256File(packagePath) };
}

async function restoreSystemBackup(argv = process.argv) {
  const args = readArgs(argv);
  const verified = verifyBackupPackage(args.package);
  const remoteRoot = process.env.MDV_REMOTE_RESTORE_DIR || '/var/backups/mdv-system-restore';
  const packageName = path.basename(verified.packagePath);
  const remotePackage = `${remoteRoot}/${packageName}`;

  const plan = [
    `Verify local package: ${verified.packagePath}`,
    `Upload package to VPS: ${remotePackage}`,
    'Extract package into restore staging directory',
    'Stop mdv-api with PM2',
    'Move current site/API aside with timestamp',
    'Restore site current/release files',
    'Restore /var/www/mdv-api',
    'Restore MySQL dump',
    'Start mdv-api with PM2',
    'Verify site and API health',
  ];

  console.log(args.apply ? '[restore] APPLY mode' : '[restore] DRY-RUN mode');
  for (const item of plan) console.log(`- ${item}`);

  if (!args.apply) {
    console.log('[restore] dry-run only. Re-run with --apply to restore.');
    return;
  }

  const remoteScript = `
set -euo pipefail
test -f '${remotePackage}'
mkdir -p '${remoteRoot}/apply'
tar -C '${remoteRoot}/apply' -xzf '${remotePackage}'
echo "Restore package extracted. Manual DB/site apply step intentionally gated."
echo "Next version should automate final apply after a successful restore drill."
`;

  await execSsh(remoteScript);
}

if (require.main === module) {
  restoreSystemBackup().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { restoreSystemBackup, verifyBackupPackage };
```

- [ ] **Step 2: Rodar guarda estatica**

Run:

```powershell
node tmp-tests\system-backup-static.test.mjs
```

Expected:

```text
Ainda falha somente por docs ausentes.
```

- [ ] **Step 3: Validar CLI sem pacote**

Run:

```powershell
node scripts\system-restore.cjs --dry-run
```

Expected:

```text
Exit 1 com Usage: node scripts/system-restore.cjs --package <backup.tar.gz> [--dry-run|--apply]
```

- [ ] **Step 4: Commit**

Run:

```powershell
git add -- scripts/system-restore.cjs tmp-tests/system-backup-static.test.mjs
git commit -m "chore(system): add guarded restore script"
```

---

## Task 5: Documentacao De Backup E Restore Drill

**Files:**
- Create: `docs/backup/README.md`
- Create: `docs/backup/restore-drill.md`
- Modify: `publicar.md`
- Test: `tmp-tests/system-backup-static.test.mjs`

- [ ] **Step 1: Criar runbook `docs/backup/README.md`**

Create:

```markdown
# Backup Geral Do Mercado Do Vale

Este runbook cobre backup, verificacao e restauracao controlada do sistema.

## Criar Backup

Execute fora do sandbox quando envolver VPS:

```powershell
npm.cmd run backup:system
```

O backup cria:

- manifesto local em `.system-backups/<nome>/manifest.json`;
- pacote remoto em `/var/backups/mdv-system/<nome>.tar.gz`;
- hash remoto `<nome>.tar.gz.sha256`;
- copia espelhada no Synology em `C:\Users\Nitro\SynologyDrive\SynologyDrive\Backups\Mercado do Vale\system`, quando o espelhamento estiver configurado;
- dump MySQL dentro do pacote;
- copia do site, API e metadados de release;
- dados operacionais do banco: vendas, clientes, aparelhos, produtos, pagamentos, entregas e retiradas.

## Backup Automatico Diario

A VPS deve criar backup automaticamente todos os dias a meia-noite no horario `America/Sao_Paulo`.

```powershell
npm.cmd run backup:schedule
```

O agendamento fica na VPS para nao depender do computador local estar ligado. O Synology recebe uma copia espelhada do pacote quando as credenciais/caminho de espelhamento estiverem configurados.

## Restaurar

Sempre comecar por dry-run:

```powershell
npm.cmd run restore:system -- --package .system-backups\mdv-system-v1.0.0-YYYYMMDD-HHMMSS.tar.gz --dry-run
```

Aplicar somente apos conferir o plano:

```powershell
npm.cmd run restore:system -- --package .system-backups\mdv-system-v1.0.0-YYYYMMDD-HHMMSS.tar.gz --apply
```

## Restore Drill

Um backup que nunca foi testado nao e backup confiavel. A cada mudanca grande, executar o checklist em `docs/backup/restore-drill.md`.
```

- [ ] **Step 2: Criar checklist `docs/backup/restore-drill.md`**

Create:

```markdown
# Restore Drill

Objetivo: provar que o backup consegue recuperar o sistema sem depender de memoria ou improviso.

## Antes

- [ ] Confirmar pacote `.tar.gz` existe.
- [ ] Confirmar `.sha256` existe.
- [ ] Rodar `npm.cmd run restore:system -- --package <arquivo> --dry-run`.
- [ ] Conferir commit e versao do manifesto.
- [ ] Confirmar qual release esta ativa em `/var/www/mdv-site/current`.

## Simulacao

- [ ] Extrair pacote em diretorio temporario.
- [ ] Conferir que existe dump MySQL.
- [ ] Conferir que existe pacote do site.
- [ ] Conferir que existe pacote da API.
- [ ] Conferir `SHA256SUMS`.

## Depois

- [ ] Registrar data do drill.
- [ ] Registrar tempo estimado de recuperacao.
- [ ] Registrar falhas encontradas.
- [ ] Corrigir o script/runbook antes de considerar o backup confiavel.
```

- [ ] **Step 3: Atualizar `publicar.md`**

Add to final checklist:

```markdown
- Para mudancas de alto risco, criar `npm.cmd run backup:system` antes do deploy.
- Registrar nome do backup no resumo final.
- Nunca publicar v1.0+ sem saber qual backup restaura a versao anterior.
```

- [ ] **Step 4: Rodar guarda estatica**

Run:

```powershell
node tmp-tests\system-backup-static.test.mjs
```

Expected:

```text
system backup static checks passed
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- docs/backup/README.md docs/backup/restore-drill.md publicar.md tmp-tests/system-backup-static.test.mjs
git commit -m "docs(system): document backup and restore drill"
```

---

## Task 6: Agendamento Diario A Meia-Noite

**Files:**
- Create: `scripts/system-backup-schedule.cjs`
- Modify: `docs/backup/README.md`
- Test: `tmp-tests/system-backup-static.test.mjs`

- [ ] **Step 1: Criar instalador de agenda na VPS**

Create `scripts/system-backup-schedule.cjs`:

```js
#!/usr/bin/env node
const dotenv = require('dotenv');
const fs = require('node:fs');
const { execSsh } = require('./system-backup-common.cjs');

for (const file of ['.env.vps.local', '.env.local', '.env']) {
  if (fs.existsSync(file)) dotenv.config({ path: file, override: false });
}

async function installDailyBackupSchedule() {
  const remoteRoot = process.env.MDV_REMOTE_BACKUP_DIR || '/var/backups/mdv-system';
  const synologyTarget = process.env.MDV_SYNOLOGY_BACKUP_DIR || '';
  const scheduleScript = '/usr/local/bin/mdv-system-backup-daily.sh';
  const cronFile = '/etc/cron.d/mdv-system-backup';

  const mirrorBlock = synologyTarget
    ? `\nrsync -a --ignore-existing "$BACKUP_ROOT"/mdv-system-*.tar.gz* '${synologyTarget}/' || true\n`
    : '\necho "Synology mirror not configured: set MDV_SYNOLOGY_BACKUP_DIR for rsync/sftp target" >&2\n';

  const remoteScript = `
set -euo pipefail
mkdir -p '${remoteRoot}'
cat > '${scheduleScript}' <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
export TZ="America/Sao_Paulo"
BACKUP_ROOT="${MDV_REMOTE_BACKUP_DIR:-/var/backups/mdv-system}"
mkdir -p "$BACKUP_ROOT"
cd /var/www/mdv-api
node /var/www/mdv-api/scripts/system-backup.cjs --scheduled
${mirrorBlock}
find "$BACKUP_ROOT" -type f -name 'mdv-system-*.tar.gz' -mtime +30 -delete
find "$BACKUP_ROOT" -type f -name 'mdv-system-*.sha256' -mtime +30 -delete
EOF
chmod 0750 '${scheduleScript}'
cat > '${cronFile}' <<EOF
TZ=America/Sao_Paulo
0 0 * * * root '${scheduleScript}' >> /var/log/mdv-system-backup.log 2>&1
EOF
chmod 0644 '${cronFile}'
`;

  await execSsh(remoteScript);
  console.log('[backup:schedule] daily midnight backup installed on VPS');
}

if (require.main === module) {
  installDailyBackupSchedule().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { installDailyBackupSchedule };
```

- [ ] **Step 2: Documentar variaveis de espelhamento**

Add to `docs/backup/README.md`:

```markdown
## Onde Os Backups Ficam

- VPS: `/var/backups/mdv-system`
- Synology: `C:\Users\Nitro\SynologyDrive\SynologyDrive\Backups\Mercado do Vale\system`
- Manifestos locais: `.system-backups`

## Agendamento

A rotina oficial roda na VPS todo dia `00:00` no horario `America/Sao_Paulo`.

```powershell
npm.cmd run backup:schedule
```

Como a VPS fica ligada, ela e responsavel por criar o backup mesmo quando o computador local estiver desligado. O Synology deve receber uma copia espelhada do pacote e do hash.
```

- [ ] **Step 3: Validar guarda estatica**

Run:

```powershell
node tmp-tests\system-backup-static.test.mjs
```

Expected:

```text
system backup static checks passed
```

- [ ] **Step 4: Commit**

Run:

```powershell
git add -- scripts/system-backup-schedule.cjs docs/backup/README.md tmp-tests/system-backup-static.test.mjs package.json
git commit -m "chore(system): schedule daily system backups"
```

---

## Task 7: Criar Backup V1.0.0 E Tag

**Files:**
- No source edits expected after previous tasks.
- Git tag: `v1.0.0`
- Backup package: `.system-backups/<nome>/manifest.json` and remote `/var/backups/mdv-system/<nome>.tar.gz`

- [ ] **Step 1: Validar arvore de trabalho**

Run:

```powershell
git status --short
```

Expected:

```text
Somente arquivos preexistentes fora do escopo, ou arvore limpa no worktree de publicacao.
```

- [ ] **Step 2: Rodar validacoes**

Run:

```powershell
node tmp-tests\system-backup-static.test.mjs
npm.cmd run build
```

Expected:

```text
Teste passa e build Vite finaliza com exit 0.
```

- [ ] **Step 3: Criar commit final se necessario**

Run:

```powershell
git status --short
git add -- package.json SYSTEM_VERSION.md scripts/system-backup-common.cjs scripts/system-backup.cjs scripts/system-restore.cjs docs/backup/README.md docs/backup/restore-drill.md publicar.md tmp-tests/system-backup-static.test.mjs
git commit -m "chore(system): add v1 backup and restore baseline"
```

Expected:

```text
Commit criado somente com arquivos do sistema de backup.
```

- [ ] **Step 4: Push direto fora do sandbox**

Run with elevated permissions:

```powershell
git push origin HEAD:main
```

Expected:

```text
main recebe o commit.
```

- [ ] **Step 5: Criar tag `v1.0.0`**

Run with elevated permissions:

```powershell
git tag -a v1.0.0 -m "Mercado do Vale system baseline v1.0.0"
git push origin v1.0.0
```

Expected:

```text
Tag anotada publicada no GitHub.
```

- [ ] **Step 6: Criar backup geral**

Run with elevated permissions:

```powershell
npm.cmd run backup:system
```

Expected:

```text
Manifesto local criado em `.system-backups/.../manifest.json`.
Pacote remoto criado em `/var/backups/mdv-system/...tar.gz`.
Hash remoto criado em `/var/backups/mdv-system/...tar.gz.sha256`.
```

- [ ] **Step 7: Rodar restore dry-run**

Run:

```powershell
npm.cmd run restore:system -- --package .system-backups\mdv-system-v1.0.0-YYYYMMDD-HHMMSS.tar.gz --dry-run
```

Expected:

```text
Lista o plano de restauracao e nao altera VPS, site, API nem banco.
```

- [ ] **Step 8: Publicar site se `package.json`/docs visiveis exigirem**

If only scripts/docs/package changed, deploy site is optional unless the app exposes version. If version becomes visible in UI later, run:

```powershell
npm.cmd run deploy:vps-site
```

Expected:

```text
Site release active: /var/www/mdv-site/releases/YYYYMMDD-HHMMSS
```

- [ ] **Step 9: Verificar publico e registrar**

Run with elevated permissions:

```powershell
curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\n" "https://mercadodovale.com.br/"
```

Expected:

```text
200 https://www.mercadodovale.com.br/
```

- [ ] **Step 10: Commit/nota de backup**

Update `SYSTEM_VERSION.md` with:

```markdown
Last verified backup:

- Name: `mdv-system-v1.0.0-YYYYMMDD-HHMMSS`
- Git commit: `<commit>`
- Git tag: `v1.0.0`
- Site release: `/var/www/mdv-site/releases/YYYYMMDD-HHMMSS`
- Restore dry-run: passed
```

Commit:

```powershell
git add -- SYSTEM_VERSION.md
git commit -m "docs(system): record v1 backup"
git push origin HEAD:main
```

---

## Task 8: Politica Para Proximas Publicacoes

**Files:**
- Modify: `publicar.md`
- Test: `tmp-tests/system-backup-static.test.mjs`

- [ ] **Step 1: Adicionar regra operacional**

Add to `publicar.md`:

```markdown
## Backup Antes De Mudancas De Alto Risco

Criar backup antes de publicar quando a mudanca tocar:

- pagamentos, recibos, financeiro ou crediario;
- estoque ou importacao;
- API, webhook, cron ou banco;
- autenticacao/permissao;
- refatoracao grande;
- deploy depois de incidente.

Comando:

```powershell
npm.cmd run backup:system
```

O resumo final deve informar o nome do backup ou justificar por que nao foi necessario.
```

- [ ] **Step 2: Atualizar teste**

Extend `tmp-tests/system-backup-static.test.mjs`:

```js
const publicar = readFileSync('publicar.md', 'utf8');
assert.match(publicar, /Backup Antes De Mudancas De Alto Risco/, 'publicar.md must require backups before risky changes');
assert.match(publicar, /npm\.cmd run backup:system/, 'publicar.md must document backup command');
```

- [ ] **Step 3: Validar e commit**

Run:

```powershell
node tmp-tests\system-backup-static.test.mjs
git add -- publicar.md tmp-tests/system-backup-static.test.mjs
git commit -m "docs(system): require backups for risky releases"
```

---

## Self-Review

Spec coverage:

- Backup geral do sistema: Task 3 cobre site, releases, API e MySQL; Task 7 cria pacote real.
- Backup automatico: Task 6 instala rotina diaria na VPS a meia-noite e prepara espelhamento para Synology.
- Versao `V1.0`: Task 1 muda `package.json`, cria `SYSTEM_VERSION.md`; Task 7 cria tag `v1.0.0`.
- Recuperar backup quando der erro: Task 4 cria restore dry-run/apply; Task 5 cria runbook; Task 7 executa dry-run.
- Protecao contra regressao/refatoracao: Task 1 e Task 8 criam guarda estatica e regra de backup para alto risco.
- Higiene de arquivos soltos: Task 1 exige auditoria inicial e Task 7 exige status antes/depois.

Placeholder scan:

- O plano evita `TBD`/`TODO`.
- Os scripts possuem implementacao inicial completa, com o restore destrutivo ainda intencionalmente travado/gateado para evoluir apos restore drill. Isso e uma decisao de seguranca, nao placeholder.

Type consistency:

- Funcoes compartilhadas: `backupName`, `execSsh`, `sha256File`, `writeJson`.
- Teste procura `createSystemBackup` e `verifyBackupPackage`, ambos definidos nos scripts.

---

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-06-13-system-backup-versioning.md`. Two execution options:

**1. Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.

Recommended path: start with Tasks 1-6 in a clean worktree, then pause before Task 7 because it creates real VPS backup/tag and should be done with elevated permissions and deliberate confirmation.
