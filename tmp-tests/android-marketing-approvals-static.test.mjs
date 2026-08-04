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
assert.match(activity, /Revisar e decidir/);
assert.match(activity, /Confirmar aprovação/);
assert.match(activity, /Confirmar rejeição/);
assert.match(activity, /decideMarketingApproval\(approval, "approve"/);
assert.match(activity, /decideMarketingApproval\(approval, "reject"/);
assert.match(model, /Impacto imediato máximo/);
assert.match(model, /Teto mensal autorizado/);
assert.match(model, /Critério de sucesso/);
assert.match(model, /Como desfazer/);
assert.match(model, /Erro registrado/);
assert.match(gradle, /versionCode = 58/);
assert.match(gradle, /versionName = "0\.13\.1"/);

console.log('android marketing approvals: OK');
