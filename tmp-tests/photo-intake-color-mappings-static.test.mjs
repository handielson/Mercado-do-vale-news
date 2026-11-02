import assert from 'node:assert/strict';
import fs from 'node:fs';

// Cadastro por foto: tela "Cores mapeadas" (listar, trocar e apagar a ligação cor da etiqueta → cor do catálogo).
const server = fs.readFileSync(new URL('../services/smartphonePhotoIntakeServer.cjs', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../services/smartphonePhotoIntakeService.ts', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../pages/admin/products/SmartphonePhotoIntakePage.tsx', import.meta.url), 'utf8');
const editor = fs.readFileSync(new URL('../components/products/photo-intake/ColorMappingEditor.tsx', import.meta.url), 'utf8');

assert.match(server, /fastify\.get\('\/smartphone-photo-color-mappings', \{ preHandler: requireSyncKey \}/);
assert.match(server, /fastify\.patch\('\/smartphone-photo-color-mappings\/:id', \{ preHandler: requireSyncKey \}/);
assert.match(server, /fastify\.delete\('\/smartphone-photo-color-mappings\/:id', \{ preHandler: requireSyncKey \}/);
assert.match(server, /SELECT id,name FROM colors WHERE id=\? AND active=1 LIMIT 1', \[colorId\]/, 'só aceita cor ativa');
assert.match(server, /DELETE FROM smartphone_photo_color_mappings WHERE id=\? LIMIT 1/);
assert.match(service, /listColorMappings,\n  updateColorMapping,\n  deleteColorMapping,/);
assert.match(page, /type ViewMode = 'queue' \| 'margins' \| 'colors';/);
assert.match(page, /<Palette size=\{17\} \/> Cores mapeadas/);
assert.match(page, /listColorMappings\(\)\.then\(setColorMappings\)\.catch\(\(\) => setColorMappings\(\[\]\)\)/, 'falha não trava a página');
assert.match(editor, /confirmId === mapping\.id \?/, 'apagar pede confirmação');

console.log('photo intake color mappings static test passed');
