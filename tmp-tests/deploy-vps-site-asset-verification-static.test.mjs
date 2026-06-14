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

assert.match(
  source,
  /function createReleaseArchive\(/,
  'deploy deve empacotar o dist em um arquivo unico antes do upload'
);

assert.match(
  source,
  /tar[\s\S]*-czf/,
  'deploy deve criar um tar.gz local do dist'
);

assert.match(
  source,
  /tar -xzf/,
  'deploy deve extrair o tar.gz no VPS'
);

const archiveIndex = source.indexOf('const archivePath = createReleaseArchive(releaseName);');
const uploadIndex = source.indexOf('await uploadFile(sftp, archivePath, remoteArchivePath);');
const extractIndex = source.indexOf('tar -xzf');
const verifyIndex = source.indexOf('await assertRemoteReleaseComplete(verifySftp, DIST_DIR, releaseDir);');
const switchIndex = source.indexOf('const switchCommand = [');

assert.ok(archiveIndex >= 0, 'deploy deve criar o pacote da release');
assert.ok(uploadIndex > archiveIndex, 'deploy deve enviar o pacote unico para o VPS');
assert.ok(extractIndex > uploadIndex, 'deploy deve extrair o pacote depois do upload');
assert.ok(verifyIndex > extractIndex, 'verificacao remota deve ocorrer depois da extracao');
assert.ok(switchIndex > verifyIndex, 'deploy so deve trocar current depois de validar assets remotos');

assert.match(
  source,
  /throw new Error\([\s\S]*Deploy bloqueado: release remota incompleta/,
  'deploy deve falhar explicitamente se asset local nao existir no VPS'
);

console.log('deploy VPS asset verification static checks passed');
