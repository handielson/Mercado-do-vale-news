import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../scripts/backup-n8n-before-upgrade.cjs', import.meta.url), 'utf8');

assert.match(source, /pg_dump[\s\S]*-Fc[\s\S]*--no-owner[\s\S]*--no-privileges/, 'backup must use a portable custom-format PostgreSQL dump');
assert.match(source, /pg_restore[\s\S]*--exit-on-error/, 'backup must be restore-tested before approval');
assert.match(source, /n8n export:workflow --all/, 'active n8n workflows must be exported separately');
assert.match(source, /sha256sum -c SHA256SUMS/, 'backup contents must be hash-verified');
assert.match(source, /\/var\/backups\/mdv-system/, 'primary package must stay in the VPS backup root');
assert.match(source, /SynologyDrive'[\s\S]*'SynologyDrive'[\s\S]*'backup-mercadodovale'[\s\S]*'db'[\s\S]*'n8n'/, 'package must be mirrored through the active Windows Synology Drive client');
assert.match(source, /fastGet\(sftp, remoteTar, localTar\)/, 'the VPS package must be downloaded into Synology Drive');
assert.match(source, /actual !== expected/, 'the mirrored package must be hash-verified locally');
assert.match(source, /sed -E 's\/=\.\*\$\/=<redacted>\/'/, 'service environment values must be redacted');
assert.doesNotMatch(source, /export:credentials[\s\S]*--decrypted/, 'backup must never export decrypted credentials');

console.log('n8n pre-upgrade backup static checks passed');
