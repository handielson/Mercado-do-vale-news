import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('layouts/AdminLayout.tsx', 'utf8');

assert.match(source, /data-storefront-brand="loja_3d"/, 'o painel deve reservar uma marca identificada para a 3DMV');
assert.match(source, /to="\/loja-3d"[\s\S]{0,300}target="_blank"/, 'a marca 3DMV deve abrir a loja em outra aba');
assert.match(source, /Área reservada para a logomarca 3DMV/, 'o espaço da logomarca 3DMV deve permanecer explícito enquanto não há imagem cadastrada');
