const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');

const targetVersion = String(process.argv[2] || '2.35.7').trim();
const mirrorLatestOnly = process.argv.includes('--mirror-latest');

function run(conn, command) {
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

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function getSftp(conn) {
  return new Promise((resolve, reject) => conn.sftp((error, sftp) => error ? reject(error) : resolve(sftp)));
}

function fastGet(sftp, remotePath, localPath) {
  return new Promise((resolve, reject) => sftp.fastGet(remotePath, localPath, (error) => error ? reject(error) : resolve()));
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

async function mirrorLatestToSynologyDrive(conn) {
  const remoteTar = (await run(conn, `ls -1t /var/backups/mdv-system/n8n-pre-upgrade-${shellQuote(targetVersion)}-*.tar.gz | head -n 1`)).trim();
  if (!remoteTar) throw new Error('Backup n8n nao encontrado na VPS para espelhamento');
  await run(conn, `cd /var/backups/mdv-system && sha256sum -c ${shellQuote(`${path.posix.basename(remoteTar)}.sha256`)} >/dev/null`);

  const synologyDir = path.join(process.env.USERPROFILE || '', 'SynologyDrive', 'SynologyDrive', 'backup-mercadodovale', 'db', 'n8n');
  if (!fs.existsSync(path.dirname(synologyDir))) throw new Error(`Raiz do Synology Drive nao encontrada: ${path.dirname(synologyDir)}`);
  fs.mkdirSync(synologyDir, { recursive: true });
  const localTar = path.join(synologyDir, path.posix.basename(remoteTar));
  const localHash = `${localTar}.sha256`;
  const sftp = await getSftp(conn);
  await fastGet(sftp, remoteTar, localTar);
  await fastGet(sftp, `${remoteTar}.sha256`, localHash);
  sftp.end();

  const expected = fs.readFileSync(localHash, 'utf8').trim().split(/\s+/)[0];
  const actual = sha256(localTar);
  if (!expected || actual !== expected) throw new Error('Hash do pacote copiado para o Synology Drive nao confere');
  return { remoteTar, localTar, sha256: actual };
}

function buildRemoteScript(stamp) {
  const name = `n8n-pre-upgrade-${targetVersion}-${stamp}`;
  return `
set -euo pipefail
umask 077
backup_root=/var/backups/mdv-system
backup_name=${shellQuote(name)}
backup_dir="$backup_root/$backup_name"
backup_tar="$backup_root/$backup_name.tar.gz"
backup_hash="$backup_tar.sha256"
test ! -e "$backup_dir"
test ! -e "$backup_tar"
mkdir -p "$backup_dir"

db_container="$(docker ps --filter 'name=n8n_n8n-db.1' --format '{{.Names}}' | head -n 1)"
n8n_container="$(docker ps --filter 'name=n8n_n8n.1' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"
test -n "$n8n_container"

docker exec "$db_container" pg_dump -U postgres -d n8n -Fc --no-owner --no-privileges > "$backup_dir/n8n-postgres.dump"
test -s "$backup_dir/n8n-postgres.dump"

docker exec "$n8n_container" n8n export:workflow --all --output=/tmp/mdv-n8n-workflows.json >/dev/null
docker cp "$n8n_container:/tmp/mdv-n8n-workflows.json" "$backup_dir/n8n-workflows.json" >/dev/null
docker exec "$n8n_container" rm -f /tmp/mdv-n8n-workflows.json
test -s "$backup_dir/n8n-workflows.json"

docker service inspect n8n_n8n n8n_n8n-runner --format '{{.Spec.Name}} {{.Spec.TaskTemplate.ContainerSpec.Image}}' > "$backup_dir/service-images.txt"
docker service inspect n8n_n8n n8n_n8n-runner --format '{{.Spec.Name}}{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' \
  | sed -E 's/=.*$/=<redacted>/' > "$backup_dir/service-env-names.txt"
docker exec "$n8n_container" n8n --version > "$backup_dir/n8n-version.txt"

restore_db="n8n_restorecheck_${stamp.replace(/[^0-9]/g, '')}"
cleanup_restore() {
  docker exec "$db_container" dropdb -U postgres --if-exists "$restore_db" >/dev/null 2>&1 || true
}
trap cleanup_restore EXIT
docker exec "$db_container" createdb -U postgres "$restore_db"
cat "$backup_dir/n8n-postgres.dump" | docker exec -i "$db_container" pg_restore -U postgres -d "$restore_db" --exit-on-error --no-owner --no-privileges
workflow_count="$(docker exec "$db_container" psql -U postgres -d "$restore_db" -X -q -t -A -c 'select count(*) from workflow_entity;')"
active_count="$(docker exec "$db_container" psql -U postgres -d "$restore_db" -X -q -t -A -c 'select count(*) from workflow_entity where active = true;')"
test "$workflow_count" -ge 1
test "$active_count" -ge 1
cleanup_restore
trap - EXIT

cat > "$backup_dir/manifest.txt" <<EOF
type=n8n-pre-upgrade
target_version=${targetVersion}
created_utc=${stamp}
database=n8n
database_format=postgres-custom
restore_test=passed
workflow_count=$workflow_count
active_workflow_count=$active_count
EOF

(cd "$backup_dir" && sha256sum n8n-postgres.dump n8n-workflows.json service-images.txt service-env-names.txt n8n-version.txt manifest.txt > SHA256SUMS)
(cd "$backup_dir" && sha256sum -c SHA256SUMS >/dev/null)
tar -C "$backup_root" -czf "$backup_tar" "$backup_name"
(cd "$backup_root" && sha256sum "$(basename "$backup_tar")" > "$(basename "$backup_hash")")
(cd "$backup_root" && sha256sum -c "$(basename "$backup_hash")" >/dev/null)

printf 'BACKUP_NAME=%s\\n' "$backup_name"
printf 'VPS_PACKAGE=%s\\n' "$backup_tar"
printf 'VPS_HASH=%s\\n' "$backup_hash"
printf 'RESTORE_TEST=passed\\n'
printf 'WORKFLOWS=%s\\n' "$workflow_count"
printf 'ACTIVE_WORKFLOWS=%s\\n' "$active_count"
`;
}

async function main() {
  if (!/^\d+\.\d+\.\d+$/.test(targetVersion)) throw new Error('Versao alvo invalida. Use X.Y.Z.');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '-');
  const script = buildRemoteScript(stamp);
  const encoded = Buffer.from(script, 'utf8').toString('base64');
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    if (!mirrorLatestOnly) {
      const output = await run(conn, `printf %s ${shellQuote(encoded)} | base64 -d | bash`);
      process.stdout.write(output);
    }
    const mirror = await mirrorLatestToSynologyDrive(conn);
    console.log(`SYNOLOGY_PACKAGE=${mirror.localTar}`);
    console.log(`SYNOLOGY_SHA256=${mirror.sha256}`);
  } finally {
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
