'use strict';
const {paymentsConfigured,createMpAdapter,verifyWebhook,createCharge,settlePayment,listCharges,refreshCharge} = require('./print3dPayments.cjs');
function registerPrint3dPaymentRoutes(app,{pool,getCustomer,env=process.env,fetchImpl,adapter=createMpAdapter(env,fetchImpl)}) {
  const collectorId = env.MDV_PRINT3D_MP_COLLECTOR_ID;
  const run = fn => async (req,reply) => {
    reply.header('Cache-Control','no-store');
    if (!paymentsConfigured(env)) return reply.code(503).send({error:'Pagamentos 3D ainda não habilitados.'});
    try { return await fn(req); }
    catch(error) {
      if (error.statusCode) return reply.code(error.statusCode).send({error:error.message});
      // Do not log provider bodies, customer data or credentials.
      req.log?.error({code:error.code || 'payment_failure'},'print3d-payment');
      return reply.code(500).send({error:'Não foi possível concluir o pagamento 3D.'});
    }
  };
  const customer = async(req,reply)=>{
    const value = await getCustomer(req);
    if (!value?.id) return reply.code(401).send({error:'Entre na sua conta 3D.'});
    req.print3dPaymentCustomer = value;
  };
  const options = {preHandler:customer,bodyLimit:4096,config:{rateLimit:{max:12,timeWindow:'1 minute'}}};
  app.post('/print3d/orders/:id/payment',options,run(req=>createCharge(pool,{orderId:req.params.id,customer:req.print3dPaymentCustomer,body:req.body,adapter,collectorId})));
  app.get('/print3d/orders/:id/payment',options,run(req=>listCharges(pool,{orderId:req.params.id,customerId:req.print3dPaymentCustomer.id})));
  app.post('/print3d/orders/:id/payment/refresh',options,run(req=>refreshCharge(pool,{orderId:req.params.id,customerId:req.print3dPaymentCustomer.id,chargeId:req.body?.charge_id,adapter,collectorId})));
  app.post('/print3d/payments/webhook',{bodyLimit:8192},run(async req=>{
    const id = verifyWebhook(req,env.MDV_PRINT3D_MP_WEBHOOK_SECRET);
    const payment = await adapter.get(id);
    // Lookup only the immutable reference obtained from authenticated provider API.
    const match = /^print3d:([0-9a-f-]{36})$/i.exec(payment?.external_reference || '');
    if (!match) return {received:true,ignored:true};
    await settlePayment(pool,{payment,chargeId:match[1],collectorId});
    return {received:true};
  }));
}
module.exports = {registerPrint3dPaymentRoutes};
