'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Fastify = require('fastify');
const multipart = require('@fastify/multipart');
const { registerPrint3dRecipeFileRoutes, isPrivatePrint3dRoot } = require('../services/print3dRecipeFilesServer.cjs');

const recipeId = '11111111-1111-4111-8111-111111111111';
const root = '/home/SynologyDrive/producao-3d';
const headers = { authorization: 'Bearer admin' };
const recipe = { id: recipeId, sku_snapshot: 'CHAVEIRO-01', revision: 'r1', draft_json: {
  sku: 'CHAVEIRO-01', revision: 'r1', printSummary: { material_gramas: 20, tempo_impressao_minutos: 120 },
} };

function uploadPayload(name, content) {
  const boundary = 'print3d-test-boundary';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload: body, headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

async function fixture({ enabled = true, privateRoot = root, nasFails = false } = {}) {
  const app = Fastify();
  await app.register(multipart);
  const files = [];
  let uploads = 0;
  const pool = { async query(sql, params) {
    if (sql === 'SELECT id FROM print3d_recipe_revisions WHERE id=? LIMIT 1') return [[params[0] === recipeId ? { id: recipeId } : null].filter(Boolean)];
    if (sql.startsWith('SELECT id,sku_snapshot,revision,draft_json FROM print3d_recipe_revisions')) return [[params[0] === recipeId ? recipe : null].filter(Boolean)];
    if (sql.includes('FROM print3d_recipe_files WHERE recipe_id=? AND kind=? AND sha256=?')) return [[files.find(f => f.recipe_id === params[0] && f.kind === params[1] && f.sha256 === params[2])].filter(Boolean)];
    if (sql.startsWith('INSERT INTO print3d_recipe_files')) {
      const [id, recipe_id, kind, printer_profile, original_name, storage_name, synology_path, byte_size, sha256] = params;
      files.push({ id, recipe_id, kind, printer_profile, original_name, storage_name, synology_path, byte_size, sha256 });
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('FROM print3d_recipe_files WHERE recipe_id=? ORDER BY')) return [files.filter(f => f.recipe_id === params[0])];
    if (sql.includes('FROM print3d_recipe_files WHERE id=? LIMIT 1')) return [[files.find(f => f.id === params[0])].filter(Boolean)];
    throw new Error(`SQL inesperado: ${sql}`);
  } };
  registerPrint3dRecipeFileRoutes(app, {
    pool, enabled, privateRoot,
    getBearerAuthContext: async req => req.headers.authorization === 'Bearer admin' ? { isAdmin: true, userId: 'admin-test' } : null,
    uploadPrivate: async ({ folderPath, fileName, fileBuffer, allowedRoot }) => {
      assert.equal(allowedRoot, root);
      assert.equal(folderPath, `${root}/produtos/CHAVEIRO-01/revisoes/r1`);
      assert.ok(fileBuffer.length > 0);
      uploads++;
      if (nasFails) throw new Error('NAS indisponível');
      return `${folderPath}/${fileName}`;
    },
    downloadPrivate: async ({ filePath, allowedRoot }) => {
      if (nasFails) throw new Error('NAS indisponível');
      assert.equal(allowedRoot, root);
      assert.ok(filePath.startsWith(`${root}/produtos/`));
      return Buffer.from('{"material_gramas":20,"tempo_impressao_minutos":120}');
    },
  });
  await app.ready();
  return { app, files, uploads: () => uploads };
}

test('pasta privada não admite caminhos públicos ou travessia', () => {
  assert.equal(isPrivatePrint3dRoot(root), true);
  assert.equal(isPrivatePrint3dRoot('/web/arquivos/producao-3d'), false);
  assert.equal(isPrivatePrint3dRoot('/home/SynologyDrive/../producao-3d'), false);
});

test('upload exige administrador e só registra arquivo após NAS confirmar', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const url = `/admin/print3d/recipes/${recipeId}/files?kind=print-json`;
  const payload = uploadPayload('impressao.json', '{"material_gramas":20,"tempo_impressao_minutos":120}');
  assert.equal((await f.app.inject({ method: 'POST', url, payload: payload.payload, headers: { 'content-type': payload.headers['content-type'] } })).statusCode, 401);
  const first = await f.app.inject({ method: 'POST', url, ...payload });
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(f.files.length, 1);
  assert.equal(f.uploads(), 1);
  const repeat = await f.app.inject({ method: 'POST', url, ...payload });
  assert.equal(repeat.statusCode, 200, repeat.body);
  assert.equal(f.uploads(), 1);
  const listed = (await f.app.inject({ method: 'GET', url: `/admin/print3d/recipes/${recipeId}/files`, headers })).json();
  assert.equal(listed.files.length, 1);
  assert.equal('synology_path' in listed.files[0], false);
  const downloaded = await f.app.inject({ method: 'GET', url: `/admin/print3d/files/${f.files[0].id}/download`, headers });
  assert.equal(downloaded.statusCode, 200, downloaded.body);
  assert.equal(crypto.createHash('sha256').update(downloaded.rawPayload).digest('hex'), f.files[0].sha256);
});

test('JSON divergente e NAS indisponível não geram metadados de arquivo pronto', async t => {
  const f = await fixture({ nasFails: true }); t.after(() => f.app.close());
  const url = `/admin/print3d/recipes/${recipeId}/files?kind=print-json`;
  const wrong = await f.app.inject({ method: 'POST', url, ...uploadPayload('outro.json', '{"material_gramas":21,"tempo_impressao_minutos":120}') });
  assert.equal(wrong.statusCode, 409, wrong.body);
  assert.equal(f.uploads(), 0);
  const failed = await f.app.inject({ method: 'POST', url, ...uploadPayload('impressao.json', '{"material_gramas":20,"tempo_impressao_minutos":120}') });
  assert.equal(failed.statusCode, 502, failed.body);
  assert.equal(f.files.length, 0);
});

test('flag desligada não consulta banco nem NAS', async t => {
  const f = await fixture({ enabled: false }); t.after(() => f.app.close());
  const status = (await f.app.inject({ method: 'GET', url: '/admin/print3d/files/status', headers })).json();
  assert.equal(status.enabled, false);
  assert.equal((await f.app.inject({ method: 'GET', url: `/admin/print3d/recipes/${recipeId}/files`, headers })).statusCode, 503);
  assert.equal(f.uploads(), 0);
});

test('G-code exige identificação da impressora e perfil antes do upload', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const payload = uploadPayload('peca.gcode', '; gcode de teste');
  const missing = await f.app.inject({ method: 'POST', url: `/admin/print3d/recipes/${recipeId}/files?kind=gcode`, ...payload });
  assert.equal(missing.statusCode, 400);
  assert.equal(f.uploads(), 0);
  const saved = await f.app.inject({ method: 'POST', url: `/admin/print3d/recipes/${recipeId}/files?kind=gcode&printerProfile=Bambu%20X1C%20PLA`, ...payload });
  assert.equal(saved.statusCode, 201, saved.body);
  assert.equal(saved.json().file.printer_profile, 'Bambu X1C PLA');
});

test('download bloqueia arquivo cuja integridade difere do hash registrado', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const uploaded = await f.app.inject({ method: 'POST', url: `/admin/print3d/recipes/${recipeId}/files?kind=print-json`,
    ...uploadPayload('impressao.json', '{"material_gramas":20,"tempo_impressao_minutos":120}') });
  assert.equal(uploaded.statusCode, 201, uploaded.body);
  f.files[0].sha256 = '0'.repeat(64);
  const download = await f.app.inject({ method: 'GET', url: `/admin/print3d/files/${f.files[0].id}/download`, headers });
  assert.equal(download.statusCode, 502);
});
