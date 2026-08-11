import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../services/smartphonePhotoIntakeServer.cjs', import.meta.url), 'utf8');

assert.match(source, /const DEFAULT_MODEL = 'gpt-5\.6-luna'/, 'deve usar o modelo de leitura definido');
assert.match(source, /detail: 'original'/, 'deve enviar a etiqueta na resolução original');
assert.match(source, /function toPublicIntake[\s\S]*photo_private_path, photo_sha256/, 'deve ocultar caminho privado e hash');
assert.match(source, /return toPublicIntake\(await loadIntake\(intake\.id\)\)/, 'respostas devem usar a versão pública');
assert.match(source, /fastify\.get\('\/smartphone-photo-intakes\/:id\/photo'[\s\S]*Cache-Control', 'private, no-store'/, 'foto deve ser servida apenas pelo endpoint protegido');
assert.match(source, /validatePhotoExtraction\(\{[\s\S]*body\.detected_imei_1 \?\? intake\.detected_imei_1/, 'edições manuais devem recalcular a validação');
assert.match(source, /SELECT id FROM units WHERE imei_1 IN[\s\S]*already_registered/, 'edições manuais devem repetir a checagem de duplicidade');
assert.match(source, /beginTransaction\(\)[\s\S]*FOR UPDATE[\s\S]*commit\(\)/, 'finalização deve ser transacional e bloquear a pendência');
assert.doesNotMatch(source, /budget|spending[_A-Za-z]*limit|monthly[_A-Za-z]*limit/i, 'a leitura não deve ser bloqueada por limite financeiro');

console.log('smartphone photo intake server static test passed');
