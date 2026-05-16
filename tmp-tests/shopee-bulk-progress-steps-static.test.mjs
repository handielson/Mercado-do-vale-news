import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../pages/admin/settings/ShopeePage.tsx', import.meta.url), 'utf8');

for (const label of [
    'Baixando fotos',
    'Enviando fotos a Shopee',
    'Preparando video',
    'Enviando video a Shopee',
    'Validando categoria e atributos',
    'Publicando anuncio',
    'Atualizando estoque/preco',
    'Salvando vinculo local',
]) {
    assert.match(source, new RegExp(label));
}

assert.match(source, /type SyncStepStatus = 'idle' \| 'running' \| 'done' \| 'error' \| 'skipped'/);
assert.match(source, /setSyncStepRunning/);
assert.match(source, /setSyncStepDone/);
assert.match(source, /setSyncStepError/);
assert.match(source, /syncResult/);
assert.match(source, /Ver no Seller/);
assert.match(source, /Ver anuncio/);
assert.match(source, /Copiar logs do erro/);

console.log('shopee bulk progress step static checks passed');
