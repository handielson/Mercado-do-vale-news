import assert from 'node:assert/strict';

import { buildVpsUrl, resolveVpsBase } from './services/vpsTransport.js';

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run('resolveVpsBase usa proxy local em runtime localhost', () => {
  const base = resolveVpsBase({}, 'localhost');
  assert.equal(base, '/vps-proxy');
});

run('resolveVpsBase usa VPS direta em producao', () => {
  const base = resolveVpsBase({}, 'mercadodovale.com.br');
  assert.equal(base, 'https://api.xiaomipetrolina.com.br');
});

run('buildVpsUrl monta query path quando base e proxy', () => {
  const url = buildVpsUrl('/company-settings', { base: '/vps-proxy' });
  assert.equal(url, '/vps-proxy?path=%2Fcompany-settings');
});

run('buildVpsUrl monta caminho direto quando base e URL absoluta', () => {
  const url = buildVpsUrl('/company-settings', { base: 'https://api.xiaomipetrolina.com.br' });
  assert.equal(url, 'https://api.xiaomipetrolina.com.br/company-settings');
});

run('buildVpsUrl preserva query string em acesso direto', () => {
  const url = buildVpsUrl('/products?search=fone&_t=123', {
    base: 'https://api.xiaomipetrolina.com.br/',
  });
  assert.equal(url, 'https://api.xiaomipetrolina.com.br/products?search=fone&_t=123');
});

console.log('ok');
