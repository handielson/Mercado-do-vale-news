import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');

function assertDuplicateDisplayHandled(file) {
  const source = readFileSync(resolve(root, file), 'utf8');
  const createStart = source.indexOf("fastify.post('/pdv/displays'");
  const patchStart = source.indexOf("fastify.patch('/pdv/displays/:id'");
  const deleteStart = source.indexOf("fastify.delete('/pdv/displays/:id'");

  assert.ok(createStart >= 0, `${file} deve declarar POST /pdv/displays`);
  assert.ok(patchStart > createStart, `${file} deve declarar PATCH /pdv/displays/:id`);
  assert.ok(deleteStart > patchStart, `${file} deve declarar DELETE /pdv/displays/:id`);

  const createBlock = source.slice(createStart, patchStart);
  const patchBlock = source.slice(patchStart, deleteStart);

  for (const [label, block] of [['create', createBlock], ['patch', patchBlock]]) {
    assert.match(block, /catch \(err\)/, `${file} ${label} deve capturar erro de banco`);
    assert.match(block, /err\.code === 'ER_DUP_ENTRY'/, `${file} ${label} deve tratar slug duplicado`);
    assert.match(block, /reply\.code\(409\)/, `${file} ${label} deve retornar conflito controlado`);
    assert.match(block, /Ja existe um display com este nome ou identificador/, `${file} ${label} deve retornar mensagem amigavel`);
  }
}

assertDuplicateDisplayHandled('vps_server.js');
assertDuplicateDisplayHandled('vps_server.cjs');

console.log('pdv display duplicate slug handling static checks passed');
