'use strict';
const { createStorefrontAuthSecurity } = require('./storefrontAuthSecurity.cjs');
module.exports = { createPrint3dAuthSecurity: options => createStorefrontAuthSecurity({ ...options, scope: 'loja_3d' }) };
