'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('admin 3D cancela apenas pedido sem pagamento confirmado pelo endpoint 3D administrativo',()=>{
  const client=fs.readFileSync('services/print3dAdminClient.ts','utf8');
  const page=fs.readFileSync('pages/admin/print3d/Print3dRecordsPage.tsx','utf8');
  assert.match(client,/\/admin\/print3d\/orders\/\$\{encodeURIComponent\(id\)\}\/cancel/);
  assert.match(page,/order\.confirmed_cents === 0/); assert.match(page,/cancelPrint3dAdminOrder\(order\.id/);
  assert.match(page,/Cancelar e liberar reservas/); assert.match(page,/entrada confirmada exigem análise de estorno/i);
});
