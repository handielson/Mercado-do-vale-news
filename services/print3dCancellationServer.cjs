'use strict';

const { cancelPrint3dOrder, expireDuePrint3dOrders } = require('./print3dCancellation.cjs');

function registerPrint3dCancellationRoutes(app, { pool, getCustomer, getBearerAuthContext, enabled = false, cancelProviderCharges }) {
  const customer = async (request, reply) => {
    const account = await getCustomer(request);
    if (!account?.id) return reply.code(401).send({ error:'Entre na sua conta 3D.' });
    request.print3dCancellationCustomer = account;
  };
  const admin = async (request, reply) => {
    const auth = await getBearerAuthContext(request);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error:'Sessão de administrador necessária.' });
    request.print3dCancellationAdmin = auth;
  };
  const run = handler => async (request, reply) => {
    reply.header('Cache-Control','no-store');
    if (!enabled) return reply.code(503).send({ error:'Cancelamentos 3D ainda não habilitados.' });
    try { return await handler(request); }
    catch (error) {
      if (error.statusCode) return reply.code(error.statusCode).send({ error:error.message });
      request.log?.error({ code:error.code || 'print3d_cancellation_failure' }, 'print3d-cancellation');
      return reply.code(500).send({ error:'Não foi possível cancelar o pedido 3D.' });
    }
  };
  const cancel = input => async request => {
    const result=await cancelPrint3dOrder(pool,input(request));
    const provider_cancellations=result.cancelled && cancelProviderCharges
      ? await cancelProviderCharges(request.params.id) : [];
    return {...result,provider_cancellations};
  };
  app.post('/print3d/orders/:id/cancel', { preHandler:customer, bodyLimit:2048, config:{ rateLimit:{ max:5,timeWindow:'1 minute' } } }, run(cancel(request =>
    ({ orderId:request.params.id, actorType:'customer', actorId:request.print3dCancellationCustomer.id, reason:request.body?.reason || 'Cancelamento solicitado pelo cliente.' })
  )));
  app.post('/admin/print3d/orders/:id/cancel', { preHandler:admin, bodyLimit:2048, config:{ rateLimit:{ max:20,timeWindow:'1 minute' } } }, run(cancel(request =>
    ({ orderId:request.params.id, actorType:'admin', actorId:request.print3dCancellationAdmin.userId, reason:request.body?.reason || 'Cancelamento administrativo.' })
  )));
  app.post('/admin/print3d/orders/expire-pending', { preHandler:admin, bodyLimit:512, config:{ rateLimit:{ max:5,timeWindow:'1 minute' } } }, run(request => {
    const rawLimit = request.body?.limit;
    const limit = rawLimit === undefined ? 100 : Number(rawLimit);
    return expireDuePrint3dOrders(pool, { limit });
  }));
}

module.exports = { registerPrint3dCancellationRoutes };
