import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../services/smartphonePhotoIntakeServer.cjs', import.meta.url), 'utf8');
const frontendService = fs.readFileSync(new URL('../services/smartphonePhotoIntakeService.ts', import.meta.url), 'utf8');

assert.match(source, /const DEFAULT_MODEL = 'gpt-5\.6-luna'/, 'deve usar o modelo de leitura definido');
assert.match(source, /detail: 'original'/, 'deve enviar a etiqueta na resolução original');
assert.match(source, /function toPublicIntake[\s\S]*photo_private_path, photo_sha256/, 'deve ocultar caminho privado e hash');
assert.match(source, /return toPublicIntake\(await loadIntake\(intake\.id\)\)/, 'respostas devem usar a versão pública');
assert.match(source, /fastify\.get\('\/smartphone-photo-intakes\/:id\/photo'[\s\S]*Cache-Control', 'private, no-store'/, 'foto deve ser servida apenas pelo endpoint protegido');
assert.match(source, /validatePhotoExtraction\(\{[\s\S]*body\.detected_imei_1 \?\? intake\.detected_imei_1/, 'edições manuais devem recalcular a validação');
assert.match(source, /scoreCatalogModel[\s\S]*fullLabel[\s\S]*getBrandFamily/, 'modelo deve considerar submarcas sem aceitar homônimo de outra marca');
assert.match(source, /translateColorToPtBr[\s\S]*matched_color_id/, 'cor lida deve ser traduzida e vinculada à tabela de cores');
assert.match(source, /repairPendingPhotoIntakes\(\)/, 'itens que já estavam na fila devem ser corrigidos automaticamente');
assert.match(source, /resolvePhotoIntakeCompanyId[\s\S]*slug='mercado-do-vale'/, 'uploads sem company_id devem usar a empresa real do catálogo, nunca o valor literal default');
assert.match(source, /SET company_id=\?, detected_color=\?/, 'pendências antigas devem receber a empresa real antes do casamento de modelo e cor');
assert.match(source, /if \(!intake\.matched_color_id\)[\s\S]*Selecione ou cadastre a cor/, 'finalização deve exigir cor estruturada');
assert.match(source, /color_id: intake\.matched_color_id/, 'produto final deve guardar o identificador da cor');
assert.match(source, /SELECT id FROM units WHERE imei_1 IN[\s\S]*already_registered/, 'edições manuais devem repetir a checagem de duplicidade');
assert.match(source, /beginTransaction\(\)[\s\S]*FOR UPDATE[\s\S]*commit\(\)/, 'finalização deve ser transacional e bloquear a pendência');
assert.match(source, /confirm-group-prices[\s\S]*matched_model_id=\?[\s\S]*matched_color_id=\?[\s\S]*detected_ram[\s\S]*detected_storage[\s\S]*FOR UPDATE/, 'confirmação em grupo deve usar a combinação exata e bloquear as linhas');
assert.match(source, /updated_count: groupRows\.length/, 'confirmação em grupo deve informar quantos aparelhos foram atualizados');
assert.doesNotMatch(source, /budget|spending[_A-Za-z]*limit|monthly[_A-Za-z]*limit/i, 'a leitura não deve ser bloqueada por limite financeiro');

assert.match(frontendService, /getCompanyId\(\)[\s\S]*company_id: companyId/, 'frontend deve informar a empresa ao salvar margens');
assert.match(frontendService, /async function upload[\s\S]*getCompanyId\(\)[\s\S]*formData\.append\('company_id', companyId\)/, 'upload da foto deve informar a empresa pela fonte central');
assert.match(source, /SELECT company_id FROM brands WHERE id=\?[\s\S]*brandRows\?\.\[0\]\?\.company_id/, 'API deve usar a empresa da marca quando companies nao tiver a empresa padrao');
assert.match(source, /const name = String\(model\.name \|\| ''\)\.trim\(\)/, 'produto criado por foto deve usar apenas o nome canonico do modelo');
assert.doesNotMatch(source, /const name = String\(request\.body\?\.name \|\| \[model\.name/, 'nome do produto nao deve incorporar RAM, armazenamento ou cor');
assert.match(source, /findExactIntakeProduct\(connection, intake\)/, 'deve vincular automaticamente uma configuracao identica');
assert.match(source, /reserveAvailableSku\(connection, request\.body\?\.sku, intake, model\)/, 'deve gerar outro SKU quando o informado ja estiver ocupado');

console.log('smartphone photo intake server static test passed');
