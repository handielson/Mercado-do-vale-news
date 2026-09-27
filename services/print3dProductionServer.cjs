'use strict';
const { listProductionJobs,recordProductionProgress } = require('./print3dProduction.cjs');
function registerPrint3dProductionRoutes(app, { pool,getBearerAuthContext,getCustomer,enabled = false }) {
  const admin = async (req, reply) => {
    reply.header('Cache-Control','no-store');
    const auth = await getBearerAuthContext(req);
    if (!auth?.isAdmin || !auth.userId) return reply.code(401).send({ error:'Sessão de administrador necessária.' });
    req.print3dProductionActor = String(auth.userId);
  };
  const customer = async (req, reply) => {
    reply.header('Cache-Control','no-store');
    const value = await getCustomer(req);
    if (!value?.id) return reply.code(401).send({ error:'Entre na sua conta 3D.' });
    req.print3dProductionCustomer = value.id;
  };
  const run = handler => async (req, reply) => {
    if (!enabled) return reply.code(503).send({ error:'Produção 3D ainda não habilitada.' });
    try { return await handler(req); }
    catch (error) {
      if (error.statusCode) return reply.code(error.statusCode).send({ error:error.message });
      req.log?.error({ err:error },'print3d-production');
      return reply.code(500).send({ error:'Não foi possível consultar ou registrar a produção.' });
    }
  };
  app.get('/admin/print3d/production',{ preHandler:admin },async (req, reply) => {
    if (!enabled) return { enabled:false, jobs:[] };
    return run(async () => ({ enabled:true, jobs:await listProductionJobs(pool,{ admin:true }) }))(req, reply);
  });
  app.get('/print3d/production',{ preHandler:customer },run(async req => ({ jobs:await listProductionJobs(pool,{ customerId:req.print3dProductionCustomer }) })));
  app.post('/admin/print3d/production/:id/progress',{ preHandler:admin,bodyLimit:8192 },run(req =>
    recordProductionProgress(pool,{ jobId:req.params.id,actorId:req.print3dProductionActor,body:req.body })));
}
module.exports = { registerPrint3dProductionRoutes };
