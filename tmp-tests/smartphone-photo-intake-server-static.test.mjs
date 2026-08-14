import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../services/smartphonePhotoIntakeServer.cjs', import.meta.url), 'utf8');
const frontendService = fs.readFileSync(new URL('../services/smartphonePhotoIntakeService.ts', import.meta.url), 'utf8');
const capturePanel = fs.readFileSync(new URL('../components/products/photo-intake/PhotoCapturePanel.tsx', import.meta.url), 'utf8');
const reviewCard = fs.readFileSync(new URL('../components/products/photo-intake/PhotoIntakeReviewCard.tsx', import.meta.url), 'utf8');
const queue = fs.readFileSync(new URL('../components/products/photo-intake/PhotoIntakeQueue.tsx', import.meta.url), 'utf8');

assert.match(source, /const DEFAULT_MODEL = 'gpt-5\.6-luna'/, 'deve usar o modelo de leitura definido');
assert.match(source, /detail: 'original'/, 'deve enviar a etiqueta na resolução original');
assert.match(source, /function toPublicIntake[\s\S]*photo_private_path, photo_sha256/, 'deve ocultar caminho privado e hash');
assert.match(source, /return toPublicIntake\(await loadIntake\(intake\.id\)\)/, 'respostas devem usar a versão pública');
assert.match(source, /fastify\.get\('\/smartphone-photo-intakes\/:id\/photo'[\s\S]*Cache-Control', 'private, no-store'/, 'foto deve ser servida apenas pelo endpoint protegido');
assert.match(source, /validatePhotoExtraction\(\{[\s\S]*body\.detected_imei_1 \?\? intake\.detected_imei_1/, 'edições manuais devem recalcular a validação');
assert.match(source, /scoreCatalogModel[\s\S]*fullLabel[\s\S]*getBrandFamily/, 'modelo deve considerar submarcas sem aceitar homônimo de outra marca');
assert.match(source, /translateColorToPtBr[\s\S]*matched_color_id/, 'cor lida deve ser traduzida e vinculada à tabela de cores');
assert.match(source, /smartphone_photo_color_mappings[\s\S]*source_color_key/, 'mapeamentos de cor devem ser persistidos para reutilização');
assert.match(source, /SELECT c\.id,c\.name FROM smartphone_photo_color_mappings/, 'leitura futura deve consultar os mapeamentos persistidos');
assert.match(source, /INSERT INTO smartphone_photo_color_mappings[\s\S]*ON DUPLICATE KEY UPDATE/, 'uma cor mapeada manualmente deve atualizar a regra existente');
assert.match(source, /repairPendingPhotoIntakes\(\)/, 'itens que já estavam na fila devem ser corrigidos automaticamente');
assert.match(source, /resolvePhotoIntakeCompanyId[\s\S]*slug='mercado-do-vale'/, 'uploads sem company_id devem usar a empresa real do catálogo, nunca o valor literal default');
assert.match(source, /SET company_id=\?, detected_color=\?/, 'pendências antigas devem receber a empresa real antes do casamento de modelo e cor');
assert.match(source, /if \(!intake\.matched_color_id\)[\s\S]*Selecione ou cadastre a cor/, 'finalização deve exigir cor estruturada');
assert.match(source, /color_id: intake\.matched_color_id/, 'produto final deve guardar o identificador da cor');
assert.match(source, /SELECT id FROM units WHERE \(imei_1 IN[\s\S]*intake_id IS NULL OR intake_id <> \?[\s\S]*already_registered/, 'edições manuais devem checar duplicidade sem acusar o próprio pré-cadastro');
assert.match(source, /const duplicateValues = \[validation\.value\.imei1[\s\S]*intake_id IS NULL OR intake_id <> \?[\s\S]*duplicateValues, intake\.id/, 'nova leitura deve ignorar unidades do próprio pré-cadastro');
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
assert.match(reviewCard, /Produto já cadastrado\.[\s\S]*não será criado outro produto/, 'a conferência deve informar quando a variação já existe');
assert.match(queue, /Produto já cadastrado/, 'a fila deve identificar variações já cadastradas');
assert.match(source, /reserveAvailableSku\(connection, request\.body\?\.sku, intake, model\)/, 'deve gerar outro SKU quando o informado ja estiver ocupado');
assert.match(source, /No campo RAM, informe somente a memória física; não some nem inclua expansão ou RAM virtual/, 'IA deve extrair apenas a RAM física da etiqueta');
assert.match(capturePanel, /function isDuplicateQueuePhotoError[\s\S]*\[VPS\\\]\\s\*409[\s\S]*Esta foto já está na fila/, 'frontend deve reconhecer especificamente a duplicidade informada pela API');
assert.match(capturePanel, /smartphonePhotoIntakeService\.upload\(file, batchId\)[\s\S]*catch \(error\)[\s\S]*duplicateCount \+= 1[\s\S]*continue;/, 'uma foto duplicada não deve interromper o restante do lote');
assert.match(capturePanel, /uploadFailureCount \+= 1[\s\S]*continue;/, 'uma falha individual de upload não deve cancelar as próximas fotos');
assert.match(capturePanel, /foto\(s\) repetida\(s\)[\s\S]*As demais continuaram normalmente/, 'o resumo deve informar as fotos repetidas ignoradas');

console.log('smartphone photo intake server static test passed');
