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

run('resolveVpsBase usa proxy em producao', () => {
  const base = resolveVpsBase({}, 'mercadodovale.com.br');
  assert.equal(base, '/api/vps-proxy');
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

run('buildVpsUrl usa proxy server-side para catalogo publico em producao', () => {
  const url = buildVpsUrl('/products?search=fone&_t=123', {
    env: {},
    runtimeHostname: 'mercadodovale.com.br',
  });
  assert.equal(url, '/api/vps-proxy?path=%2Fproducts%3Fsearch%3Dfone%26_t%3D123');
});

run('buildVpsUrl usa proxy server-side para company-settings em producao', () => {
  const url = buildVpsUrl('/company-settings', {
    env: {},
    runtimeHostname: 'mercadodovale.com.br',
  });
  assert.equal(url, '/api/vps-proxy?path=%2Fcompany-settings');
});

run('buildVpsUrl usa proxy server-side para company-settings publico em producao', () => {
  const url = buildVpsUrl('/public/company-settings', {
    env: {},
    runtimeHostname: 'mercadodovale.com.br',
  });
  assert.equal(url, '/api/vps-proxy?path=%2Fpublic%2Fcompany-settings');
});

run('buildVpsUrl permite VPS direta para leitura publica quando flag explicita esta ativa', () => {
  const url = buildVpsUrl('/products?search=fone&_t=123', {
    env: { VITE_ALLOW_DIRECT_PUBLIC_VPS: '1' },
    runtimeHostname: 'mercadodovale.com.br',
  });
  assert.equal(url, 'https://api.xiaomipetrolina.com.br/products?search=fone&_t=123');
});

run('buildVpsUrl usa proxy server-side para favoritos em producao', () => {
  const url = buildVpsUrl('/customers/abc/favorites', {
    env: {},
    runtimeHostname: 'mercadodovale.com.br',
  });
  assert.equal(url, '/api/vps-proxy?path=%2Fcustomers%2Fabc%2Ffavorites');
});

run('buildVpsUrl usa proxy server-side para synology em producao', () => {
  const url = buildVpsUrl('/synology/files?folder=videos', {
    env: {},
    runtimeHostname: 'mercadodovale.com.br',
  });
  assert.equal(url, '/api/vps-proxy?path=%2Fsynology%2Ffiles%3Ffolder%3Dvideos');
});

run('buildVpsUrl respeita metodo para rotas publicas com escrita protegida', () => {
  const url = buildVpsUrl('/shipping/settings', {
    env: {},
    runtimeHostname: 'mercadodovale.com.br',
    method: 'PATCH',
  });
  assert.equal(url, '/api/vps-proxy?path=%2Fshipping%2Fsettings');
});

console.log('ok');
