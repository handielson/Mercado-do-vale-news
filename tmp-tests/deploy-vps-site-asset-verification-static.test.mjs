import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('scripts/deploy-vps-site.cjs', 'utf8');

assert.match(
  source,
  /function listRemoteFiles\(/,
  'deploy deve listar arquivos remotos apos upload'
);

assert.match(
  source,
  /function assertRemoteReleaseComplete\(/,
  'deploy deve ter uma trava de release remota completa'
);

const uploadIndex = source.indexOf('await uploadDirectory(sftp, DIST_DIR, releaseDir);');
const verifyIndex = source.indexOf('await assertRemoteReleaseComplete(sftp, DIST_DIR, releaseDir);');
const switchIndex = source.indexOf('const switchCommand = [');

assert.ok(uploadIndex >= 0, 'deploy deve fazer upload do dist');
assert.ok(verifyIndex > uploadIndex, 'verificacao remota deve ocorrer depois do upload');
assert.ok(switchIndex > verifyIndex, 'deploy so deve trocar current depois de validar assets remotos');

assert.match(
  source,
  /throw new Error\([\s\S]*Deploy bloqueado: release remota incompleta/,
  'deploy deve falhar explicitamente se asset local nao existir no VPS'
);

console.log('deploy VPS asset verification static checks passed');
