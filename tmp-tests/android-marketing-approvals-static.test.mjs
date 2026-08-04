import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const activity = readFileSync(
  'android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/MainActivity.kt',
  'utf8',
);
const model = readFileSync(
  'android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/domain/MarketingApproval.kt',
  'utf8',
);
const gradle = readFileSync('android/admin-estoque/app/build.gradle.kts', 'utf8');

assert.match(activity, /Central de Aprovações/);
assert.match(activity, /\/admin\/marketing\/approvals\?limit=30/);
assert.match(activity, /it\.status in setOf\("pending", "approved", "executing"\)/);
assert.match(activity, /Histórico recente/);
assert.match(activity, /não representam falha atual/);
assert.match(activity, /Tentativa antiga — substituída com sucesso/);
assert.match(activity, /it\.status == "succeeded"/);
assert.match(activity, /Revisar e decidir/);
assert.match(activity, /Confirmar aprovação/);
assert.match(activity, /Confirmar rejeição/);
assert.match(activity, /decideMarketingApproval\(approval, "approve"/);
assert.match(activity, /decideMarketingApproval\(approval, "reject"/);
assert.match(model, /Impacto imediato máximo/);
assert.match(model, /Teto mensal autorizado/);
assert.match(model, /Critério de sucesso/);
assert.match(model, /Como desfazer/);
assert.match(model, /Motivo desta tentativa/);
assert.match(model, /fun errorExplanation\(\)/);
assert.match(model, /a Meta recusou um parâmetro enviado/);
assert.match(model, /fun creativeCards\(\)/);
assert.match(activity, /Criativos que você está aprovando/);
assert.match(activity, /marketingCreativeGallery/);
assert.match(activity, /loadProductImage\(card\.imageUrl, photo\)/);
assert.match(activity, /Crescimento de seguidores durante a campanha/);
assert.match(activity, /Seguidores no início/);
assert.match(gradle, /versionCode = 61/);
assert.match(gradle, /versionName = "0\.13\.4"/);

console.log('android marketing approvals: OK');
