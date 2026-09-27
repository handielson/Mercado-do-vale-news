'use strict';
const { createPrint3dCheckout,listPrint3dOrders } = require('./print3dCheckout.cjs');
function registerPrint3dCheckoutRoutes(app,{pool,getCustomer,loadQuote,verifyShipping,enabled=false,dispatchEnabled=false,companyId}) {
  const customer = async (req,reply) => {
    reply.header('Cache-Control','no-store');
    const account = await getCustomer(req);
    if (!account?.id) return reply.code(401).send({error:'Entre na sua conta 3D.'});
    req.print3dCheckoutCustomer = account.id;
    req.print3dCheckoutAuthVersion = account.auth_version;
  };
  const run = handler => async (req,reply) => {
    if (!enabled) return reply.code(503).send({error:'Finalização de pedidos 3D ainda não habilitada.'});
    try { return await handler(req); }
    catch (error) {
      if (error.statusCode) return reply.code(error.statusCode).send({error:error.message});
      req.log?.error({err:error},'print3d-checkout');
      return reply.code(500).send({error:'Não foi possível finalizar ou consultar seu pedido.'});
    }
  };
  app.get('/print3d/checkout',async (req,reply) => {
    reply.header('Cache-Control','no-store');
    return {storefront:'loja_3d',enabled:Boolean(enabled),payment_mode:enabled ? 'pix' : 'pending_configuration'};
  });
  app.post('/print3d/checkout',{preHandler:customer,bodyLimit:49152,config:{rateLimit:{max:10,timeWindow:'1 minute'}}},run(req =>
    createPrint3dCheckout(pool,{customerId:req.print3dCheckoutCustomer,authVersion:req.print3dCheckoutAuthVersion,
      body:req.body,companyId,loadQuote,verifyShipping})));
  app.get('/print3d/orders',{preHandler:customer},run(async req =>
    ({orders:await listPrint3dOrders(pool,{customerId:req.print3dCheckoutCustomer,includeDispatch:dispatchEnabled})})));
  app.get('/print3d/orders/:id',{preHandler:customer},run(async req => {
    const [order] = await listPrint3dOrders(pool,{customerId:req.print3dCheckoutCustomer,orderId:req.params.id,includeDispatch:dispatchEnabled});
    return {order};
  }));
}
module.exports = { registerPrint3dCheckoutRoutes };
