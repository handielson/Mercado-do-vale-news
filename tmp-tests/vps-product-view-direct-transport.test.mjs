import assert from 'node:assert/strict';

const transport = await import('../services/vpsTransport.js');

const directUrl = transport.buildVpsUrl('/products/prod-123/view', {
  env: {
    MODE: 'production',
    VITE_VPS_SYNC_KEY: 'test-sync-key',
  },
  runtimeHostname: 'mercadodovale.com.br',
  method: 'POST',
});

assert.equal(
  directUrl,
  'https://api.xiaomipetrolina.com.br/products/prod-123/view',
  'product view writes must go directly to VPS in production static site builds',
);

console.log('VPS product view direct transport check passed');
