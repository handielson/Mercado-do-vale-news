'use strict';
const { createStorefrontAuthSecurity } = require('./storefrontAuthSecurity.cjs');
const { verificationClientIp } = require('./customerPhoneVerificationServer.cjs');
const paths = new Set(['/auth/login', '/auth/register', '/auth/password', '/auth/password-reset/request',
  '/auth/password-reset/confirm', '/auth/phone/request', '/auth/phone/verify']);

function registerCustomerAuthProtection(fastify, options) {
  const enabled = options.enabled === true;
  const security = createStorefrontAuthSecurity({ ...options, scope: 'mercado_do_vale' });
  // Register before auth routes. OAuth callbacks and 3D routes have their own protections.
  fastify.addHook('preHandler', async (request, reply) => {
    const path = request.routeOptions?.url || String(request.url || '').split('?')[0];
    if (!enabled || request.method !== 'POST' || !paths.has(path)) return;
    reply.header('Cache-Control', 'no-store');
    try { await security.verifyCaptcha(request.body?.captcha_token); }
    catch (error) { return reply.code(error.statusCode || 503).send({ error: error.message }); }
  });
  return {
    enabled,
    async login(request, { accountId, identifier, check }) {
      if (!enabled) return { valid: await check(), blocked: false };
      return security.login({ accountId, identifier, ip: verificationClientIp(request), check });
    },
    async clearAccount(connection, accountId) {
      if (enabled) await security.clearAccount(connection, accountId);
    },
  };
}
module.exports = { registerCustomerAuthProtection };
