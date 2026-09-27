'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const fs = require('node:fs');
const { registerPrint3dCancellationRoutes } = require('../services/print3dCancellationServer.cjs');
test('rotas de cancelamento 3D exigem a conta ou sessão admin mesmo quando estão desligadas', async t => {
  const app=Fastify(); t.after(()=>app.close());
  registerPrint3dCancellationRoutes(app,{enabled:false,pool:{query(){throw Error('não deveria acessar banco');}},getCustomer:async()=>null,getBearerAuthContext:async()=>null});
  assert.equal((await app.inject({method:'POST',url:'/print3d/orders/11111111-1111-4111-8111-111111111111/cancel'})).statusCode,401);
  assert.equal((await app.inject({method:'POST',url:'/admin/print3d/orders/11111111-1111-4111-8111-111111111111/cancel'})).statusCode,401);
});
test('modo desligado retorna 503 após autenticação e não modifica reservas', async t => {
  const app=Fastify(); t.after(()=>app.close());
  registerPrint3dCancellationRoutes(app,{enabled:false,pool:{query(){throw Error('não deveria acessar banco');}},getCustomer:async()=>({id:'customer'}),getBearerAuthContext:async()=>({isAdmin:true,userId:'admin'})});
  assert.equal((await app.inject({method:'POST',url:'/print3d/orders/11111111-1111-4111-8111-111111111111/cancel',payload:{reason:'Teste'}})).statusCode,503);
  assert.equal((await app.inject({method:'POST',url:'/admin/print3d/orders/expire-pending'})).statusCode,503);
});
test('ambos os servidores permitem somente o cancelamento autenticado pela rota pública 3D e bloqueiam o histórico no CRUD', () => {
  for (const file of ['vps_server.cjs','vps_server.js']) {
    const source=fs.readFileSync(file,'utf8');
    assert.ok(source.includes('[0-9a-f-]{36}\\/cancel'));
    assert.match(source,/print3d_order_cancellation_events/);
  }
});
