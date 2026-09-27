'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { signPrint3dCustomerSession, verifyPrint3dCustomerSession } = require('../services/print3dCustomerSession.cjs');

const secret = 'test-secret-that-is-longer-than-thirty-two-bytes';
const id = '12345678-1234-1234-1234-123456789abc';

test('sessão 3D autentica somente sua conta e expira em sete dias', () => {
  const token = signPrint3dCustomerSession(id, secret, 1000);
  assert.deepEqual(verifyPrint3dCustomerSession(token, secret, 1001), { customer_id: id, storefront: 'loja_3d', auth_version: 1 });
  assert.equal(verifyPrint3dCustomerSession(token, secret, 1000 + 7 * 86400), null);
});

test('sessão 3D não aceita outro segredo, assinatura adulterada ou formato MDV', () => {
  const token = signPrint3dCustomerSession(id, secret, 1000);
  assert.equal(verifyPrint3dCustomerSession(token, 'another-secret-longer-than-thirty-two-bytes', 1001), null);
  assert.equal(verifyPrint3dCustomerSession(`${token.slice(0, -2)}xx`, secret, 1001), null);
  const [header, payload, signature] = token.split('.');
  const mdvSignature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  assert.notEqual(signature, mdvSignature);
  assert.equal(verifyPrint3dCustomerSession(`${header}.${payload}.${mdvSignature}`, secret, 1001), null);
});
