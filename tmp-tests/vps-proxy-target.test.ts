import assert from 'node:assert/strict';

import {
  getVpsProxyTargetBaseUrl,
  isPublicProxyPath,
  normalizeVpsProxyBaseUrl,
} from '../api/vps-proxy';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run('normaliza URL base removendo barra final', () => {
  assert.equal(
    normalizeVpsProxyBaseUrl('https://api.xiaomipetrolina.com.br/'),
    'https://api.xiaomipetrolina.com.br',
  );
});

run('usa fallback HTTP apenas para leitura publica conhecida', () => {
  assert.equal(
    getVpsProxyTargetBaseUrl('/products?limit=12', 'GET', 'https://api.xiaomipetrolina.com.br/'),
    'http://api.xiaomipetrolina.com.br',
  );
});

run('usa fallback HTTP para settings publicas da vitrine', () => {
  assert.equal(
    getVpsProxyTargetBaseUrl('/public/company-settings', 'GET', 'https://api.xiaomipetrolina.com.br'),
    'http://api.xiaomipetrolina.com.br',
  );
});

run('usa fallback HTTP para telemetria publica de banners', () => {
  assert.equal(isPublicProxyPath('/banners/banner-1/view', 'POST'), true);
  assert.equal(
    getVpsProxyTargetBaseUrl('/banners/banner-1/view', 'POST', 'https://api.xiaomipetrolina.com.br'),
    'http://api.xiaomipetrolina.com.br',
  );
});

run('mantem HTTPS para rotas administrativas', () => {
  assert.equal(isPublicProxyPath('/company-settings', 'GET'), false);
  assert.equal(
    getVpsProxyTargetBaseUrl('/company-settings', 'GET', 'https://api.xiaomipetrolina.com.br'),
    'https://api.xiaomipetrolina.com.br',
  );
});

run('mantem base customizada sem forcar fallback', () => {
  assert.equal(
    getVpsProxyTargetBaseUrl('/products', 'GET', 'https://api.example.com'),
    'https://api.example.com',
  );
});

console.log('ok');
