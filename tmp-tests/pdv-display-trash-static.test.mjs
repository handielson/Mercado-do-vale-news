import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');

const adminPage = read('pages/admin/settings/DisplaysPage.tsx');
const displayPage = read('pages/display/DisplayPage.tsx');
const service = read('services/pdvDisplayService.ts');
const server = read('vps_server.js');
const plan = read('docs/planos/android.md');

const adminSnippets = [
  'updateIdleContent',
  'addIdleMessage',
  'removeIdleMessage',
  'updateIdleBanner',
  'addIdleBanner',
  'removeIdleBanner',
  'updateIdleProduct',
  'addIdleProduct',
  'removeIdleProduct',
  'Conteudo ocioso',
  'Mensagens',
  'Banners',
  'Produtos em destaque',
  'Imagem URL',
  'Remover',
  'idle_content',
  'showAdsDuringPix',
  'handleCleanupTrash',
  'cleanupTrash',
  'Excluir lixo',
  'window.confirm',
];

for (const snippet of adminSnippets) {
  assert.ok(adminPage.includes(snippet), `DisplaysPage.tsx deve conter ${snippet}`);
}

const displaySnippets = [
  'idle_content.messages',
  'idle_content.banners',
  'idle_content.products',
  'showAdsDuringPix',
  'Obrigado por comprar no Mercado do Vale',
];

for (const snippet of displaySnippets) {
  assert.ok(displayPage.includes(snippet), `DisplayPage.tsx deve conter ${snippet}`);
}

assert.ok(service.includes('cleanupTrash'), 'pdvDisplayService.ts deve expor cleanupTrash');
assert.ok(server.includes('/pdv/displays/trash/cleanup'), 'vps_server.js deve expor rota de limpeza');
assert.ok(
  server.includes("status IN ('pending', 'rejected', 'expired', 'failed')"),
  'limpeza deve limitar Pix removidos a status nao aprovados'
);

assert.ok(plan.includes('### 2026-06-04 - Bloco Fase 7 Propagandas E Limpeza'), 'android.md deve registrar inicio da Fase 7');

console.log('pdv display trash/content static checks passed');
